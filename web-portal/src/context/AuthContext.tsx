// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { writeAuditLog } from "../lib/auditLog";

export type UserRole = "admin" | "superadmin" | "institution";

interface AuthContextType {
  currentUser: User | null;
  currentRole: UserRole | null;
  mustChangePassword: boolean;
  login: (
    email: string,
    password: string,
    expectedRole: "admin" | "institution",
  ) => Promise<{
    success: boolean;
    role?: UserRole;
    mustChangePassword?: boolean;
    message?: string;
  }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const login = async (
    email: string,
    password: string,
    expectedRole: "admin" | "institution",
  ): Promise<{
    success: boolean;
    role?: UserRole;
    mustChangePassword?: boolean;
    message?: string;
  }> => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // Look up the role in Firestore
      const userRef = doc(db, "users", cred.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await signOut(auth);
        return {
          success: false,
          message: "User profile not found in Firestore",
        };
      }

      const profile = snap.data();
      if (String(profile.status || "Active").toLowerCase() === "banned") {
        await signOut(auth);
        return { success: false, message: "This account has been banned. Contact an administrator." };
      }

      const storedRole = String(profile.role || "").toLowerCase();
      const role =
        storedRole === "admin"
          ? "admin"
          : storedRole === "superadmin"
            ? "superadmin"
            : storedRole === "institute" || storedRole === "institution"
              ? "institution"
              : null;

      const roleMatchesPortal =
        expectedRole === "admin"
          ? role === "admin" || role === "superadmin"
          : role === "institution";
      if (!role || !roleMatchesPortal) {
        await signOut(auth);
        return {
          success: false,
          message: "Access denied: wrong portal for this account.",
        };
      }

      // Store the expected role in sessionStorage for this tab
      sessionStorage.setItem("scenaryExpectedRole", expectedRole);
      sessionStorage.setItem("scenaryUserId", cred.user.uid);

      // Immediately update state with the new user
      setCurrentUser(cred.user);
      setCurrentRole(role);
      const passwordChangeRequired = profile.mustChangePassword === true;
      setMustChangePassword(passwordChangeRequired);
      await writeAuditLog({
        actorId: cred.user.uid,
        actorRole: role,
        action: "auth.login",
        entityType: "user",
        entityId: cred.user.uid,
        metadata: { portal: expectedRole },
      });

      return { success: true, role, mustChangePassword: passwordChangeRequired };
    } catch (error: any) {
      console.error("Login error:", error);

      let message = "Login failed. Please try again.";
      if (error.code === "auth/user-not-found")
        message = "No account found with this email.";
      if (error.code === "auth/wrong-password") message = "Incorrect password.";
      if (error.code === "auth/invalid-email")
        message = "Invalid email address.";

      return { success: false, message };
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<void> => {
    if (!currentUser?.email) {
      throw new Error("A signed-in email account is required to change the password.");
    }

    const credential = EmailAuthProvider.credential(
      currentUser.email,
      currentPassword,
    );
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);
    await updateDoc(doc(db, "users", currentUser.uid), {
      mustChangePassword: false,
    });
    setMustChangePassword(false);
    await writeAuditLog({
      actorId: currentUser.uid,
      actorRole: currentRole,
      action: "auth.password_changed",
      entityType: "user",
      entityId: currentUser.uid,
    });
  };

  const logout = async (): Promise<void> => {
    try {
      // Clear sessionStorage
      sessionStorage.removeItem("scenaryExpectedRole");
      sessionStorage.removeItem("scenaryUserId");

      await signOut(auth);
      await writeAuditLog({
        actorId: currentUser?.uid,
        actorRole: currentRole,
        action: "auth.logout",
        entityType: "user",
        entityId: currentUser?.uid,
        metadata: {
          portal: currentRole === "institution" ? "institution" : "admin",
        },
      });
      setCurrentUser(null);
      setCurrentRole(null);
      setMustChangePassword(false);

      if (currentRole === "institution") {
        navigate("/login?type=institution");
      } else {
        navigate("/login?type=admin");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Check if this tab has a stored session
      const expectedRole = sessionStorage.getItem("scenaryExpectedRole") as
        | "admin"
        | "institution"
        | null;
      const expectedUserId = sessionStorage.getItem("scenaryUserId");

      // If no stored session for this tab, stay logged out
      if (!expectedRole || !expectedUserId) {
        setCurrentUser(null);
        setCurrentRole(null);
        setMustChangePassword(false);
        setLoading(false);
        return;
      }

      // If Firebase user is null but we have a stored session,
      // the global auth was cleared (by another tab's logout)
      // Clear our session and stay logged out
      if (!user) {
        sessionStorage.removeItem("scenaryExpectedRole");
        sessionStorage.removeItem("scenaryUserId");
        setCurrentUser(null);
        setCurrentRole(null);
        setMustChangePassword(false);
        setLoading(false);
        return;
      }

      // If Firebase user matches this tab's stored session, update state
      if (user.uid === expectedUserId) {
        const profile = await getDoc(doc(db, "users", user.uid));
        const userProfile = profile.data();
        if (
          !profile.exists() ||
          String(userProfile?.status || "Active").toLowerCase() === "banned"
        ) {
          sessionStorage.removeItem("scenaryExpectedRole");
          sessionStorage.removeItem("scenaryUserId");
          await signOut(auth);
          setCurrentUser(null);
          setCurrentRole(null);
          setMustChangePassword(false);
          setLoading(false);
          return;
        }
        const storedRole = String(userProfile.role || "").toLowerCase();
        const role: UserRole | null =
          storedRole === "admin" || storedRole === "superadmin"
            ? storedRole
            : storedRole === "institute" || storedRole === "institution"
              ? "institution"
              : null;
        const roleMatchesPortal =
          expectedRole === "admin"
            ? role === "admin" || role === "superadmin"
            : role === "institution";
        if (!role || !roleMatchesPortal) {
          sessionStorage.removeItem("scenaryExpectedRole");
          sessionStorage.removeItem("scenaryUserId");
          await signOut(auth);
          setCurrentUser(null);
          setCurrentRole(null);
          setMustChangePassword(false);
          setLoading(false);
          return;
        }
        setCurrentUser(user);
        setCurrentRole(role);
        setMustChangePassword(userProfile.mustChangePassword === true);
        setLoading(false);
        return;
      }

      // If Firebase user doesn't match this tab's session (another user logged in globally),
      // clear this tab's stored session to prevent stale auth
      console.warn(
        "Auth mismatch detected: different user logged in from another tab. Clearing session.",
      );
      sessionStorage.removeItem("scenaryExpectedRole");
      sessionStorage.removeItem("scenaryUserId");
      setCurrentUser(null);
      setCurrentRole(null);
      setMustChangePassword(false);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        mustChangePassword,
        login,
        changePassword,
        logout,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}
