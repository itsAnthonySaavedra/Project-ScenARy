import React, { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./Login.module.css";

const PasswordChange: React.FC = () => {
  const {
    currentUser,
    currentRole,
    mustChangePassword,
    changePassword,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!currentUser) {
    return <Navigate to="/login?type=admin" replace />;
  }

  if (!mustChangePassword) {
    return (
      <Navigate
        to={currentRole === "institution" ? "/institution/dashboard" : "/admin/dashboard"}
        replace
      />
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate(currentRole === "institution" ? "/institution/dashboard" : "/admin/dashboard");
    } catch (changeError) {
      console.error("Password change failed:", changeError);
      const code = changeError?.code;
      setError(
        code === "auth/wrong-password" || code === "auth/invalid-credential"
          ? "Your current password is incorrect."
          : code === "auth/weak-password"
            ? "Choose a stronger password."
            : "Unable to update your password. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authWrapper}>
        <div className={styles.glassCard}>
          <div className={styles.logoArea}>
            <i className={`fa-solid fa-key ${styles.logoIcon}`} aria-hidden="true"></i>
            <h3>Change your password</h3>
            <p>A new account must set a personal password before continuing.</p>
          </div>

          {error && (
            <div role="alert" style={{ color: "#ef4444", marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="current-password">Temporary / current password</label>
              <input
                id="current-password"
                type="password"
                className={styles.formControl}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                className={styles.formControl}
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                type="password"
                className={styles.formControl}
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                disabled={saving}
              />
            </div>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? "Updating password..." : "Update password"}
            </button>
            <button
              type="button"
              className={styles.btnBack}
              onClick={logout}
              disabled={saving}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordChange;
