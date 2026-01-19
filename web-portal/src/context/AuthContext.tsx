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
  login: (
    email: string,
    password: string,
  ) => Promise<{
    success: boolean;
    role?: "admin" | "institute";
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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const login = async (
    email: string,
    password: string,
  ): Promise<{
    success: boolean;
    role?: "admin" | "institute";
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

      const role = snap.data().role as "admin" | "institute";

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
      await signOut(auth);
      navigate("/login?type=admin");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
