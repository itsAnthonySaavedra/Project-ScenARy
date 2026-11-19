import React, { useEffect, useState } from "react";
import styles from "../components/common/Common.module.css";
import PageHeader from "../components/common/PageHeader";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getFirebaseErrorMessage } from "../lib/firebaseErrorMessage";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";

const legalDocuments = [
  {
    id: "termsAndConditions",
    title: "Terms & Conditions",
    fieldId: "terms-and-conditions-content",
    path: "/terms-and-conditions",
  },
  {
    id: "privacyPolicy",
    title: "Privacy Policy",
    fieldId: "privacy-policy-content",
    path: "/privacy-policy",
  },
];

const Settings = ({ adminMode = false }) => {
  const { currentUser } = useAuth();
  const [role, setRole] = useState("Loading...");
  const [displayName, setDisplayName] = useState("Loading...");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState(""); // Needed for re-authentication
  const [message, setMessage] = useState({ type: "", text: "" });
  const [policyLoading, setPolicyLoading] = useState(adminMode);
  const [legalContent, setLegalContent] = useState({});
  const [legalUpdatedAt, setLegalUpdatedAt] = useState({});
  const [savingDocument, setSavingDocument] = useState("");
  const [legalMessages, setLegalMessages] = useState({});

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword) return;

    try {
      setMessage({ type: "info", text: "Updating..." });

      // 1. Re-authenticate the user (Security Requirement)
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword,
      );
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Update the password
      await updatePassword(currentUser, newPassword);

      setMessage({ type: "success", text: "Password updated successfully!" });
      setNewPassword("");
      setCurrentPassword("");
    } catch (err) {
      console.error(err);
      setMessage({
        type: "error",
        text: err.message.includes("wrong-password")
          ? "Current password is incorrect."
          : "Failed to update password.",
      });
    }
  };

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

  useEffect(() => {
    if (!adminMode) return;

    const fetchLegalDocuments = async () => {
      try {
        const snapshots = await Promise.all(
          legalDocuments.map(({ id }) =>
            getDoc(doc(db, "siteSettings", id)),
          ),
        );
        const content = {};
        const updatedAt = {};
        snapshots.forEach((snapshot, index) => {
          if (!snapshot.exists()) return;
          const documentId = legalDocuments[index].id;
          const data = snapshot.data();
          content[documentId] = data.content || "";
          updatedAt[documentId] = data.updatedAt?.toDate?.() || null;
        });
        setLegalContent(content);
        setLegalUpdatedAt(updatedAt);
      } catch (err) {
        console.error("Error fetching legal documents:", err);
        setLegalMessages({
          load: {
            type: "error",
            text: getFirebaseErrorMessage(err, "Could not load legal documents."),
          },
        });
      } finally {
        setPolicyLoading(false);
      }
    };

    fetchLegalDocuments();
  }, [adminMode]);

  const handleSaveLegalDocument = async (e, documentId) => {
    e.preventDefault();
    const content = legalContent[documentId] || "";
    const document = legalDocuments.find(({ id }) => id === documentId);
    if (!content.trim()) {
      setLegalMessages((current) => ({
        ...current,
        [documentId]: { type: "error", text: `${document.title} cannot be empty.` },
      }));
      return;
    }

    setSavingDocument(documentId);
    setLegalMessages((current) => ({
      ...current,
      [documentId]: { type: "", text: "" },
    }));
    try {
      await setDoc(
        doc(db, "siteSettings", documentId),
        {
          content,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
        },
        { merge: true },
      );
      setLegalUpdatedAt((current) => ({ ...current, [documentId]: new Date() }));
      setLegalMessages((current) => ({
        ...current,
        [documentId]: { type: "success", text: `${document.title} saved.` },
      }));
    } catch (err) {
      console.error(`Error saving ${document.title}:`, err);
      setLegalMessages((current) => ({
        ...current,
        [documentId]: {
          type: "error",
          text: getFirebaseErrorMessage(err, `Could not save ${document.title}.`),
        },
      }));
    } finally {
      setSavingDocument("");
    }
  };

  const formattedRole =
    role.toLowerCase() === "superadmin"
      ? "Super Admin"
      : role.toLowerCase() === "admin"
        ? "Admin"
        : "Content Creator";

  return (
    <div className={styles.settingsContainer}>
      <PageHeader
        eyebrow={adminMode ? "Administration" : "Account"}
        title={adminMode ? "Settings" : "Profile"}
        description={adminMode ? "Manage account preferences and platform policies." : "Review your profile and account security settings."}
      />
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
          {/* Password Change Section */}
          <div
            style={{
              marginTop: "2rem",
              paddingTop: "2rem",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              width: "100%",
            }}
          >
            <h4>Change Password</h4>

            {message.text && (
              <p
                style={{
                  color: message.type === "success" ? "#4ade80" : "#f87171",
                  fontSize: "0.8rem",
                }}
              >
                {message.text}
              </p>
            )}

            <div className={styles.formGroup} style={{ marginTop: "1rem" }}>
              <label>Current Password</label>
              <input
                type="password"
                className={styles.formControl}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Required to verify it's you"
              />
            </div>

            <div className={styles.formGroup}>
              <label>New Password</label>
              <input
                type="password"
                className={styles.formControl}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <button
              onClick={handleUpdatePassword}
              className={styles.btnOutline}
              style={{ alignSelf: "flex-end", marginTop: "0.5rem" }}
            >
              Update Password
            </button>
          </div>
          <button
            className={styles.btnPrimary}
            style={{ alignSelf: "flex-end", marginTop: "1rem" }}
          >
            Save Changes
          </button>
        </div>
      </div>

      {adminMode && (
        <>
          {legalDocuments.map((document) => {
            const message = legalMessages[document.id] || legalMessages.load;
            const updatedAt = legalUpdatedAt[document.id];
            const isSaving = savingDocument === document.id;

            return (
              <section
                key={document.id}
                className={styles.settingsCard}
                style={{ alignItems: "stretch", flexDirection: "column", gap: "1rem" }}
              >
                <div>
                  <h2>{document.title}</h2>
                  <p>
                    Public page:{" "}
                    <a href={document.path} target="_blank" rel="noreferrer">
                      {document.path}
                    </a>
                  </p>
                  <p>
                    Last updated:{" "}
                    {updatedAt ? updatedAt.toLocaleString() : "Not published"}
                  </p>
                </div>
                <form onSubmit={(e) => handleSaveLegalDocument(e, document.id)}>
                  <div className={styles.formGroup}>
                    <label htmlFor={document.fieldId}>{document.title} text</label>
                    <textarea
                      id={document.fieldId}
                      className={styles.formControl}
                      value={legalContent[document.id] || ""}
                      onChange={(e) =>
                        setLegalContent((current) => ({
                          ...current,
                          [document.id]: e.target.value,
                        }))
                      }
                      rows={14}
                      disabled={policyLoading || isSaving}
                      required
                    />
                  </div>
                  {message?.text && (
                    <p
                      role="status"
                      style={{
                        color: message.type === "success" ? "#4ade80" : "#f87171",
                        marginTop: "0.75rem",
                      }}
                    >
                      {message.text}
                    </p>
                  )}
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    style={{ display: "block", marginLeft: "auto", marginTop: "1rem" }}
                    disabled={policyLoading || Boolean(savingDocument)}
                  >
                    {policyLoading
                      ? "Loading..."
                      : isSaving
                        ? "Saving..."
                        : `Save ${document.title}`}
                  </button>
                </form>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
};

export default Settings;
