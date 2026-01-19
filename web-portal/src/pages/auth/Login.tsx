// src/pages/Login.tsx
import React, { useState, FormEvent } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./Login.module.css";

const Login: React.FC = () => {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Determine portal type from URL query
  const loginType = searchParams.get("type") || "institute";
  const isAdmin = loginType === "admin";

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Call login from AuthContext (returns { success, role, message })
      const result = await login(email, password);

      if (!result.success) {
        setError(result.message || "Login failed");
        setLoading(false);
        return;
      }

      // Block login if role doesn't match the portal
      if (result.role !== loginType) {
        setError("Access denied: wrong portal for this account.");
        setLoading(false);
        return;
      }

      // Redirect based on role
      navigate(
        result.role === "admin" ? "/admin/dashboard" : "/institute/dashboard",
      );
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <button className={styles.btnBack} onClick={() => navigate("/")}>
        <i className="fa-solid fa-arrow-left"></i> Back to Home
      </button>

      <div className={styles.authWrapper}>
        <div className={styles.glassCard}>
          <div className={styles.logoArea}>
            <i className={`fa-solid fa-landmark ${styles.logoIcon}`}></i>
            <h3>ScenARy V2</h3>
            <p>{isAdmin ? "Administrator Portal" : "Institution Portal"}</p>
          </div>

          {error && (
            <div
              style={{
                color: "#ef4444",
                background: "rgba(239, 68, 68, 0.1)",
                padding: "0.8rem",
                borderRadius: "4px",
                marginBottom: "1rem",
                fontSize: "0.9rem",
                border: "1px solid rgba(239, 68, 68, 0.2)",
              }}
            >
              <i
                className="fa-solid fa-circle-exclamation"
                style={{ marginRight: "0.5rem" }}
              ></i>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label>Email</label>
              <input
                type="email"
                className={styles.formControl}
                placeholder={
                  isAdmin ? "admin@scenary.com" : "contact@institute.com"
                }
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Password</label>
              <input
                type="password"
                className={styles.formControl}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={loading}
            >
              {loading
                ? "Logging in..."
                : `Login as ${isAdmin ? "Admin" : "Institute"}`}
            </button>
          </form>

          <div className={styles.authFooter}>
            <p style={{ fontSize: "0.8rem" }}>
              {isAdmin
                ? "Restricted area for ScenARy administrators only."
                : "Not a partner yet? Contact our sales team."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
