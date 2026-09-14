import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { writeAuditLog } from "../../lib/auditLog";
import {
    findNumericValue,
    formatAnalyticsDate,
    formatDuration,
    getRatingStats,
    getUserAnalyticsMetrics,
    loadFeedback,
    loadUserAnalytics,
    removeFeedback,
} from "../../lib/userAnalytics";

const AdminAnalytics = () => {
    const { currentUser, currentRole } = useAuth();
    const [rows, setRows] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [institutions, setInstitutions] = useState([]);
    const [selectedInstitutionId, setSelectedInstitutionId] = useState("all");
    const [error, setError] = useState("");
    const [deletingFeedbackId, setDeletingFeedbackId] = useState("");

    useEffect(() => {
        writeAuditLog({ actorId: currentUser?.uid, actorRole: currentRole, action: "analytics.viewed", entityType: "analytics", metadata: { portal: "admin" } });
        Promise.all([loadUserAnalytics(), loadFeedback(), getDocs(collection(db, "institutions"))])
            .then(([analyticsRows, feedbackRows, institutionSnap]) => {
                setRows(analyticsRows);
                setFeedback(feedbackRows);
                setInstitutions(institutionSnap.docs.map((item) => ({ id: item.id, name: item.data().name })));
            })
            .catch((loadError) => {
                console.error("Unable to load platform analytics:", loadError);
                setError("Unable to load platform analytics.");
            });
    }, [currentRole, currentUser?.uid]);

    const institutionNames = Object.fromEntries(institutions.map((item) => [item.id, item.name]));
    const selectedRows = selectedInstitutionId === "all" ? rows : rows.filter((item) => item.institutionId === selectedInstitutionId);
    const selectedFeedback = selectedInstitutionId === "all" ? feedback : feedback.filter((item) => item.institutionId === selectedInstitutionId);
    const totalInteractions = selectedRows.reduce((total, item) => total + findNumericValue(item, ["interactionCount"]), 0);
    const ratingStats = getRatingStats(selectedFeedback);

    const handleRemoveFeedback = async (feedbackId) => {
        if (!window.confirm("Remove this feedback permanently?")) return;
        setDeletingFeedbackId(feedbackId);
        try {
            await removeFeedback(feedbackId);
            await writeAuditLog({ actorId: currentUser?.uid, actorRole: currentRole, action: "feedback.deleted", entityType: "feedback", entityId: feedbackId });
            setFeedback((current) => current.filter((item) => item.id !== feedbackId));
        } catch (deleteError) {
            console.error("Unable to remove feedback:", deleteError);
            setError("Unable to remove that feedback.");
        } finally {
            setDeletingFeedbackId("");
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {error && <p style={{ color: "#fbbf24" }}>{error}</p>}
            <div className="chart-card full-width" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <label htmlFor="analytics-institution" style={{ color: "#aaa" }}>View institution</label>
                <select id="analytics-institution" value={selectedInstitutionId} onChange={(event) => setSelectedInstitutionId(event.target.value)} style={{ minWidth: "240px", padding: "0.65rem", background: "#222", color: "#fff", border: "1px solid #555", borderRadius: "4px" }}>
                    <option value="all">All institutions</option>
                    {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
                </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                <div className="chart-card"><h3>Cached Interactions</h3><strong style={{ fontSize: "2rem", color: "#d4af37" }}>{totalInteractions}</strong></div>
                <div className="chart-card"><h3>Average Rating</h3><strong style={{ fontSize: "2rem", color: "#d4af37" }}>{ratingStats.average === null ? "-" : `${ratingStats.average.toFixed(1)} / 5`}</strong><p style={{ color: "#888" }}>{ratingStats.reviewCount} reviews</p></div>
                <div className="chart-card"><h3>Feedback Records</h3><strong style={{ fontSize: "2rem", color: "#d4af37" }}>{selectedFeedback.length}</strong></div>
            </div>
            <div className="chart-card full-width"><h3>Rating Distribution</h3>{ratingStats.reviewCount === 0 ? <p style={{ color: "#888" }}>No star ratings have been submitted yet.</p> : ratingStats.distribution.map((item) => <div key={item.rating} style={{ display: "grid", gridTemplateColumns: "70px 1fr 50px", gap: "0.75rem", alignItems: "center", margin: "0.5rem 0" }}><span>{item.rating} star{item.rating === 1 ? "" : "s"}</span><div style={{ height: "8px", background: "#333" }}><div style={{ width: `${(item.count / ratingStats.reviewCount) * 100}%`, height: "100%", background: "#d4af37" }} /></div><span style={{ color: "#aaa" }}>{item.count}</span></div>)}</div>
            <div className="chart-card full-width"><h3>Users By Cached Engagement</h3>{selectedRows.length === 0 ? <p style={{ color: "#888" }}>No cached user analytics for this selection.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>User</th><th>Institution</th><th>Interactions</th><th>Comments</th><th>Ratings</th><th>Last active</th></tr></thead><tbody>{selectedRows.map((item) => <tr key={item.id}><td>{item.displayName || item.email || item.userId || item.id}</td><td>{institutionNames[item.institutionId] || item.institutionId || "—"}</td><td>{findNumericValue(item, ["interactionCount"])}</td><td>{findNumericValue(item, ["commentCount"])}</td><td>{findNumericValue(item, ["ratingCount"])}</td><td>{formatAnalyticsDate(item.lastInteractionAt)}</td></tr>)}</tbody></table></div>}</div>
            <div className="chart-card full-width"><h3>Detailed User Analytics</h3>{selectedRows.length === 0 ? <p style={{ color: "#888" }}>No detailed user analytics for this selection.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>User</th><th>Comments</th><th>Rating average</th><th>Quiz average</th><th>Quiz attempts</th><th>Clicks / session</th><th>Avg. session</th><th>Last quiz</th></tr></thead><tbody>{selectedRows.map((item) => { const metrics = getUserAnalyticsMetrics(item); return <tr key={`details-${item.id}`}><td>{item.displayName || item.email || item.userId || item.id}</td><td>{metrics.commentCount}</td><td>{metrics.ratingAverage === null ? "-" : `${metrics.ratingAverage.toFixed(1)} / 5`}</td><td>{metrics.quizAverage === null ? "-" : `${metrics.quizAverage.toFixed(1)}%`}</td><td>{metrics.quizAttempts}</td><td>{metrics.clicksPerSession === null ? "-" : metrics.clicksPerSession.toFixed(1)}</td><td>{formatDuration(metrics.averageSessionDurationSeconds)}</td><td>{formatAnalyticsDate(metrics.lastQuizAt)}</td></tr>; })}</tbody></table></div>}</div>
            <div className="chart-card full-width"><h3>Recent Feedback</h3>{selectedFeedback.length === 0 ? <p style={{ color: "#888" }}>No feedback has been submitted for this selection.</p> : selectedFeedback.slice(0, 20).map((item) => <div key={item.id} style={{ borderBottom: "1px solid #333", padding: "0.75rem 0", display: "flex", justifyContent: "space-between", gap: "1rem" }}><div><strong>{item.rating ? `${item.rating}/5` : "Unrated"}</strong><span style={{ color: "#888", marginLeft: "0.75rem" }}>{institutionNames[item.institutionId] || "Platform"} - {formatAnalyticsDate(item.createdAt)}</span>{item.comment && <p style={{ margin: "0.35rem 0 0", color: "#ccc" }}>{item.comment}</p>}</div><button type="button" onClick={() => handleRemoveFeedback(item.id)} disabled={deletingFeedbackId === item.id} title="Remove feedback" style={{ alignSelf: "flex-start", border: "1px solid #ef4444", color: "#ef4444", background: "transparent", padding: "0.4rem 0.6rem", cursor: "pointer" }}>{deletingFeedbackId === item.id ? "Removing..." : "Remove"}</button></div>)}</div>
        </div>
    );
};

export default AdminAnalytics;
