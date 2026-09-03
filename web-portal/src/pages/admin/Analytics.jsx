import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { formatAnalyticsDate, getRatingStats, loadFeedback, loadUserAnalytics } from "../../lib/userAnalytics";

const AdminAnalytics = () => {
    const [rows, setRows] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [institutions, setInstitutions] = useState({});
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([loadUserAnalytics(), loadFeedback(), getDocs(collection(db, "institutions"))])
            .then(([analyticsRows, feedbackRows, institutionSnap]) => {
                setRows(analyticsRows);
                setFeedback(feedbackRows);
                setInstitutions(Object.fromEntries(institutionSnap.docs.map((item) => [item.id, item.data().name])));
            })
            .catch((loadError) => {
                console.error("Unable to load platform analytics:", loadError);
                setError("Unable to load platform analytics.");
            });
    }, []);

    const totalInteractions = rows.reduce((total, item) => total + Number(item.interactionCount || 0), 0);
    const ratingStats = getRatingStats(feedback);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {error && <p style={{ color: "#fbbf24" }}>{error}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                <div className="chart-card"><h3>Cached Interactions</h3><strong style={{ fontSize: "2rem", color: "#d4af37" }}>{totalInteractions}</strong></div>
                <div className="chart-card"><h3>Average Rating</h3><strong style={{ fontSize: "2rem", color: "#d4af37" }}>{ratingStats.average === null ? "-" : `${ratingStats.average.toFixed(1)} / 5`}</strong><p style={{ color: "#888" }}>{ratingStats.reviewCount} reviews</p></div>
                <div className="chart-card"><h3>Feedback Records</h3><strong style={{ fontSize: "2rem", color: "#d4af37" }}>{feedback.length}</strong></div>
            </div>
            <div className="chart-card full-width"><h3>Rating Distribution</h3>{ratingStats.reviewCount === 0 ? <p style={{ color: "#888" }}>No star ratings have been submitted yet.</p> : ratingStats.distribution.map((item) => <div key={item.rating} style={{ display: "grid", gridTemplateColumns: "70px 1fr 50px", gap: "0.75rem", alignItems: "center", margin: "0.5rem 0" }}><span>{item.rating} star{item.rating === 1 ? "" : "s"}</span><div style={{ height: "8px", background: "#333" }}><div style={{ width: `${(item.count / ratingStats.reviewCount) * 100}%`, height: "100%", background: "#d4af37" }} /></div><span style={{ color: "#aaa" }}>{item.count}</span></div>)}</div>
            <div className="chart-card full-width"><h3>Users By Cached Engagement</h3>{rows.length === 0 ? <p style={{ color: "#888" }}>No cached user analytics yet.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>User</th><th>Institution</th><th>Interactions</th><th>Ratings</th><th>Last active</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td>{item.displayName || item.email || item.userId || item.id}</td><td>{institutions[item.institutionId] || item.institutionId || "—"}</td><td>{item.interactionCount || 0}</td><td>{item.ratingCount || 0}</td><td>{formatAnalyticsDate(item.lastInteractionAt)}</td></tr>)}</tbody></table></div>}</div>
            <div className="chart-card full-width"><h3>Recent Feedback</h3>{feedback.length === 0 ? <p style={{ color: "#888" }}>No feedback has been submitted yet.</p> : feedback.slice(0, 20).map((item) => <div key={item.id} style={{ borderBottom: "1px solid #333", padding: "0.75rem 0" }}><strong>{item.rating ? `${item.rating}/5` : "Unrated"}</strong><span style={{ color: "#888", marginLeft: "0.75rem" }}>{institutions[item.institutionId] || "Platform"} - {formatAnalyticsDate(item.createdAt)}</span>{item.comment && <p style={{ margin: "0.35rem 0 0", color: "#ccc" }}>{item.comment}</p>}</div>)}</div>
        </div>
    );
};

export default AdminAnalytics;
