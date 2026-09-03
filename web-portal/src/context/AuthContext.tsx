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
  User,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  currentUser: User | null;
  currentRole: "admin" | "institution" | null;
  login: (
    email: string,
    password: string,
    expectedRole: "admin" | "institution",
  ) => Promise<{
    success: boolean;
    role?: "admin" | "institution";
    message?: string;
  }>;
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
  const [currentRole, setCurrentRole] = useState<
    "admin" | "institution" | null
  >(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const login = async (
    email: string,
    password: string,
    expectedRole: "admin" | "institution",
  ): Promise<{
    success: boolean;
    role?: "admin" | "institution";
    message?: string;
  }> => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // Look up the role in Firestore
      const userRef = doc(db, "users", cred.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
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
          : storedRole === "institute" || storedRole === "institution"
            ? "institution"
            : null;

      if (!role || role !== expectedRole) {
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

      return { success: true, role };
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

  const logout = async (): Promise<void> => {
    try {
      const currentPath = window.location.pathname;

      // Clear sessionStorage
      sessionStorage.removeItem("scenaryExpectedRole");
      sessionStorage.removeItem("scenaryUserId");

      await signOut(auth);
      setCurrentUser(null);
      setCurrentRole(null);

      if (currentPath.includes("institution")) {
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
        setLoading(false);
        return;
      }

      // If Firebase user matches this tab's stored session, update state
      if (user.uid === expectedUserId) {
        const profile = await getDoc(doc(db, "users", user.uid));
        if (String(profile.data()?.status || "Active").toLowerCase() === "banned") {
          sessionStorage.removeItem("scenaryExpectedRole");
          sessionStorage.removeItem("scenaryUserId");
          await signOut(auth);
          setCurrentUser(null);
          setCurrentRole(null);
          setLoading(false);
          return;
        }
        setCurrentUser(user);
        setCurrentRole(expectedRole);
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
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, currentRole, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
