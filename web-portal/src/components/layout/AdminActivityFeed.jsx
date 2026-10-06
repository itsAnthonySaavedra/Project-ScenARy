import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import styles from "./AdminActivityFeed.module.css";

const activityLabels = {
  "content.created": "Added content",
  "content.updated": "Updated content",
  "floorPlan.uploaded": "Uploaded a floor plan",
  "floorPlan.poi_placed": "Placed a POI pin",
  "floorPlan.poi_pin_removed": "Removed a POI pin",
  "landmark.updated": "Updated a landmark",
  "landmark.poi_qr_generated": "Generated a landmark QR",
  "poi.created": "Added a point of interest",
  "poi.updated": "Updated a point of interest",
  "poi.deleted": "Removed a point of interest",
};

const relevantActions = new Set(Object.keys(activityLabels));

const formatTime = (value) => {
  if (!value) return "Just now";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "Just now" : date.toLocaleString();
};

const AdminActivityFeed = () => {
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [clearedAt, setClearedAt] = useState(0);
  const storageKey = currentUser?.uid ? `scenary-admin-activity-cleared:${currentUser.uid}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      setClearedAt(Number(localStorage.getItem(storageKey)) || 0);
    } catch {
      setClearedAt(0);
    }
  }, [storageKey]);

  useEffect(() => {
    const recentLogs = query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(recentLogs, (snapshot) => {
      const institutionActivities = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data({ serverTimestamps: "estimate" }) }))
        .filter((item) => item.actorRole === "institution" && relevantActions.has(item.action))
        .slice(0, 20);
      setActivities(institutionActivities);
      setLoading(false);
      setHasError(false);
    }, (error) => {
      console.error("Unable to load institution activity:", error);
      setLoading(false);
      setHasError(true);
    });
  }, []);

  const visibleActivities = activities.filter((activity) => {
    const timestamp = activity.createdAt?.toMillis?.() || 0;
    return timestamp > clearedAt;
  });

  const clearNotifications = () => {
    const timestamp = Date.now();
    setClearedAt(timestamp);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, String(timestamp));
    } catch (error) {
      console.error("Unable to save cleared notification state:", error);
    }
  };

  return (
    <section className={styles.feed} aria-label="Recent institution activity">
      <div className={styles.heading}>
        <div className={styles.titleGroup}>
          <span className={styles.icon} aria-hidden="true"><i className="fa-solid fa-bell" /></span>
          <div>
            <h3>Institution activity</h3>
            <small><span className={styles.liveDot} /> Live updates</small>
          </div>
          <span className={styles.count}>{visibleActivities.length}</span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.clearButton} onClick={clearNotifications} disabled={visibleActivities.length === 0}>Clear</button>
          <Link to="/admin/activity-logs" className={styles.allLink}>View all activity</Link>
        </div>
      </div>

      <div className={styles.scrollArea} role="log" aria-live="polite" aria-relevant="additions text">
        {loading ? (
          <p className={styles.empty}>Loading recent activity...</p>
        ) : hasError ? (
          <p className={styles.empty}>Activity updates are unavailable.</p>
        ) : visibleActivities.length === 0 ? (
          <p className={styles.empty}>No recent institution updates.</p>
        ) : visibleActivities.map((activity) => {
          const metadata = activity.metadata || {};
          const subject = metadata.fileName || metadata.modelFileName || metadata.imageFileName || metadata.title || metadata.name;
          return (
            <article className={styles.activity} key={activity.id}>
              <span className={styles.activityIcon} aria-hidden="true"><i className="fa-solid fa-arrow-up-from-bracket" /></span>
              <div className={styles.activityText}>
                <strong>{activityLabels[activity.action]}{subject ? `: ${subject}` : ""}</strong>
                <small>{activity.actorName || "Institution account"} · {formatTime(activity.createdAt)}</small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default AdminActivityFeed;