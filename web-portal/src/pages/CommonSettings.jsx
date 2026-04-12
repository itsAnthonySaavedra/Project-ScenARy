import React, { useEffect, useState } from "react";
import styles from "../components/common/Common.module.css";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const Settings = () => {
  const { currentUser } = useAuth();
  const [role, setRole] = useState("Loading...");
  const [displayName, setDisplayName] = useState("Loading...");

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!currentUser) return;
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setRole(data.role || "User");
          setDisplayName(data.name || "User");
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
        setDisplayName(currentUser.email || "User");
      }
    };
    fetchUserInfo();
  }, [currentUser]);

  const formattedRole =
    role.toLowerCase() === "super admin"
      ? "Super Admin"
      : role.toLowerCase() === "admin"
        ? "Admin"
        : "Content Creator";

  return (
    <div className={styles.settingsContainer}>
      <div
        className={`${styles.settingsCard} ${styles.profileCard}`}
        style={{
          height: "auto",
          flexDirection: "column",
          padding: "3rem",
          gap: "1.5rem",
        }}
      >
        {/* Fixed Alignment for Icon Container */}
        <div
          className={styles.profileIconLarge}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <i
            className={`fa-solid ${role.toLowerCase().includes("admin") ? "fa-user-shield" : "fa-user"}`}
          ></i>
        </div>

        <div style={{ textAlign: "center" }}>
          {/* Display Name is now ABOVE the role */}
          <h2 style={{ marginBottom: "0.2rem" }}>{displayName}</h2>

          {/* Role is now BELOW the name */}
          <h3
            style={{
              fontSize: "1.1rem",
              color: "var(--color-primary, #d4af37)",
              margin: "0",
            }}
          >
            {formattedRole}
          </h3>

          {/* Email remains at the bottom */}
          <p style={{ color: "#a8a29e", marginTop: "0.5rem" }}>
            {currentUser?.email}
          </p>
        </div>

        <div
          style={{
            width: "100%",
            marginTop: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div className={styles.formGroup}>
            <label>Display Name</label>
            <input
              type="text"
              className={styles.formControl}
              key={displayName}
              defaultValue={displayName}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Email Address</label>
            <input
              type="email"
              className={styles.formControl}
              defaultValue={currentUser?.email || ""}
              disabled
            />
          </div>
          <button
            className={styles.btnPrimary}
            style={{ alignSelf: "flex-end", marginTop: "1rem" }}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* System Preferences section remains the same */}
      <div
        className={styles.settingsCard}
        style={{
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "1.5rem",
        }}
      >
        <h3>System Preferences</h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            width: "100%",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            paddingBottom: "1rem",
          }}
        >
          <div>
            <h4 style={{ color: "#fff", fontSize: "1rem" }}>
              Maintenance Mode
            </h4>
            <p style={{ color: "#a8a29e", fontSize: "0.8rem" }}>
              Disable access for all non-admin users
            </p>
          </div>
          <div className={styles.toggleSwitch}>
            <input type="checkbox" id="sys-maintenance" />
            <label htmlFor="sys-maintenance"></label>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            width: "100%",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h4 style={{ color: "#fff", fontSize: "1rem" }}>
              Email Notifications
            </h4>
            <p style={{ color: "#a8a29e", fontSize: "0.8rem" }}>
              Receive reports and alerts via email
            </p>
          </div>
          <div className={styles.toggleSwitch}>
            <input type="checkbox" id="sys-notifications" defaultChecked />
            <label htmlFor="sys-notifications"></label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
