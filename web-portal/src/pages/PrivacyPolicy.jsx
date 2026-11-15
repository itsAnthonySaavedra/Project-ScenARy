import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getFirebaseErrorMessage } from "../lib/firebaseErrorMessage";
import styles from "./PrivacyPolicy.module.css";

const LegalDocument = ({ documentId, title }) => {
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPrivacyPolicy = async () => {
      try {
        const snapshot = await getDoc(doc(db, "siteSettings", documentId));
        if (snapshot.exists()) {
          const data = snapshot.data();
          setContent(data.content || "");
          setUpdatedAt(data.updatedAt?.toDate?.() || null);
        }
      } catch (err) {
        console.error(`Error fetching ${title}:`, err);
        setError(getFirebaseErrorMessage(err, `${title} could not be loaded.`));
      } finally {
        setLoading(false);
      }
    };

    fetchPrivacyPolicy();
  }, [documentId, title]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>ScenARy</Link>
        <Link to="/">Home</Link>
      </header>
      <article className={styles.content}>
        <h1>{title}</h1>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : content.trim() ? (
          <>
            {updatedAt && (
              <p className={styles.updated}>
                Last updated: {updatedAt.toLocaleString()}
              </p>
            )}
            <div className={styles.policy}>{content}</div>
          </>
        ) : (
          <p>This document has not been published yet.</p>
        )}
      </article>
    </main>
  );
};

export const TermsAndConditions = () => (
  <LegalDocument documentId="termsAndConditions" title="Terms & Conditions" />
);

const PrivacyPolicy = () => (
  <LegalDocument documentId="privacyPolicy" title="Privacy Policy" />
);

export default PrivacyPolicy;
