import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { writeAuditLog } from "../../lib/auditLog";
import { downloadCsv } from "../../lib/exportCsv";
import {
    findNumericValue,
    formatAnalyticsDate,
    formatDuration,
    getRatingStats,
    getUserAnalyticsMetrics,
    cleanFeedbackComment,
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
    const [selectedUserId, setSelectedUserId] = useState("");
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
    const selectedMetrics = selectedRows.map((item) => getUserAnalyticsMetrics(item));
    const metricTotals = selectedMetrics.reduce((totals, metrics) => ({
        arClicks: totals.arClicks + metrics.arClicks,
        vrClicks: totals.vrClicks + metrics.vrClicks,
        quizClicks: totals.quizClicks + metrics.quizClicks,
        quizAttempts: totals.quizAttempts + metrics.quizAttempts,
        sessions: totals.sessions + metrics.sessionCount,
        sessionSeconds: totals.sessionSeconds + metrics.totalSessionDurationSeconds,
        quizQuestions: totals.quizQuestions + metrics.totalQuizQuestions,
        quizCorrect: totals.quizCorrect + (metrics.quizAverage === null ? 0 : metrics.quizAverage * metrics.totalQuizQuestions / 100),
    }), { arClicks: 0, vrClicks: 0, quizClicks: 0, quizAttempts: 0, sessions: 0, sessionSeconds: 0, quizQuestions: 0, quizCorrect: 0 });
    const overallQuizAverage = metricTotals.quizQuestions
        ? (metricTotals.quizCorrect / metricTotals.quizQuestions) * 100
        : null;
    const ratingStats = getRatingStats(selectedFeedback);
    const selectedUser = selectedRows.find((item) => item.id === selectedUserId);
    const selectedUserMetrics = selectedUser ? getUserAnalyticsMetrics(selectedUser) : null;
    const selectedUserFeedback = selectedUser
        ? selectedFeedback.filter((item) => item.userId === (selectedUser.userId || selectedUser.id))
        : [];
    const exportAnalytics = () => downloadCsv("scenary-analytics.csv", selectedRows.map((item) => {
        const metrics = getUserAnalyticsMetrics(item);
        return {
            user: item.username,
            institution: institutionNames[item.institutionId] || "Unassigned",
            interactions: findNumericValue(item, ["interactionCount"]),
            comments: metrics.commentCount,
            ratingAverage: metrics.ratingAverage === null ? "" : metrics.ratingAverage.toFixed(2),
            quizAverage: metrics.quizAverage === null ? "" : metrics.quizAverage.toFixed(2),
            quizAttempts: metrics.quizAttempts,
            arClicks: metrics.arClicks,
            vrClicks: metrics.vrClicks,
            quizClicks: metrics.quizClicks,
            sessions: metrics.sessionCount,
            totalSessionTime: metrics.totalSessionDurationSeconds,
            lastActive: formatAnalyticsDate(metrics.lastActiveAt),
        };
    }));

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
                <select id="analytics-institution" value={selectedInstitutionId} onChange={(event) => { setSelectedInstitutionId(event.target.value); setSelectedUserId(""); }} style={{ minWidth: "240px", padding: "0.65rem", background: "#222", color: "#fff", border: "1px solid #555", borderRadius: "4px" }}>
                    <option value="all">All institutions</option>
                    {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
                </select>
                <button type="button" onClick={exportAnalytics} disabled={!selectedRows.length} className="btn-outline" style={{ padding: "0.65rem 0.9rem", cursor: selectedRows.length ? "pointer" : "not-allowed" }}><i className="fa-solid fa-download" style={{ marginRight: "0.4rem" }} />Export CSV</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                <div className="chart-card"><h3>Interactions</h3><strong style={{ fontSize: "2rem", color: "#d4af37" }}>{totalInteractions}</strong></div>
                <div className="chart-card"><h3>Average Rating</h3><strong style={{ fontSize: "2rem", color: "#d4af37" }}>{ratingStats.average === null ? "-" : `${ratingStats.average.toFixed(1)} / 5`}</strong><p style={{ color: "#888" }}>{ratingStats.reviewCount} reviews</p></div>
                <div className="chart-card"><h3>Feedback Records</h3><strong style={{ fontSize: "2rem", color: "#d4af37" }}>{selectedFeedback.length}</strong></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
                <section className="chart-card"><h3>Clicks</h3><div style={{ display: "grid", gap: "0.65rem" }}><div style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>AR</span><strong>{metricTotals.arClicks}</strong></div><div style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>VR</span><strong>{metricTotals.vrClicks}</strong></div><div style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>Quiz</span><strong>{metricTotals.quizClicks}</strong></div></div></section>
                <section className="chart-card"><h3>Quizzes</h3><div style={{ display: "grid", gap: "0.65rem" }}><div style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>Attempts</span><strong>{metricTotals.quizAttempts}</strong></div><div style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>Accuracy</span><strong>{overallQuizAverage === null ? "-" : `${overallQuizAverage.toFixed(1)}%`}</strong></div></div></section>
                <section className="chart-card"><h3>Sessions</h3><div style={{ display: "grid", gap: "0.65rem" }}><div style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>Sessions</span><strong>{metricTotals.sessions}</strong></div><div style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>Total time</span><strong>{formatDuration(metricTotals.sessionSeconds)}</strong></div></div></section>
            </div>
            <div className="chart-card full-width"><h3>Rating Distribution</h3>{ratingStats.reviewCount === 0 ? <p style={{ color: "#888" }}>No star ratings have been submitted yet.</p> : ratingStats.distribution.map((item) => <div key={item.rating} style={{ display: "grid", gridTemplateColumns: "70px 1fr 50px", gap: "0.75rem", alignItems: "center", margin: "0.5rem 0" }}><span>{item.rating} star{item.rating === 1 ? "" : "s"}</span><div style={{ height: "8px", background: "#333" }}><div style={{ width: `${(item.count / ratingStats.reviewCount) * 100}%`, height: "100%", background: "#d4af37" }} /></div><span style={{ color: "#aaa" }}>{item.count}</span></div>)}</div>
            <div className="chart-card full-width"><h3>Users</h3>{selectedRows.length === 0 ? <p style={{ color: "#888" }}>No cached user analytics for this selection.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>User</th><th>Institution</th><th>Interactions</th><th>AR clicks</th><th>VR clicks</th><th>Quiz clicks</th><th>Quiz attempts</th><th>Sessions</th><th>Last active</th></tr></thead><tbody>{selectedRows.slice().sort((left, right) => left.username.localeCompare(right.username)).map((item) => { const metrics = getUserAnalyticsMetrics(item); return <tr key={item.id}><td><button type="button" onClick={() => setSelectedUserId(item.id)} style={{ border: 0, padding: 0, background: "none", color: "#d4af37", cursor: "pointer", textDecoration: "underline" }}>{item.username}</button></td><td>{institutionNames[item.institutionId] || "—"}</td><td>{findNumericValue(item, ["interactionCount"])}</td><td>{metrics.arClicks}</td><td>{metrics.vrClicks}</td><td>{metrics.quizClicks}</td><td>{metrics.quizAttempts}</td><td>{metrics.sessionCount}</td><td>{formatAnalyticsDate(metrics.lastActiveAt)}</td></tr>; })}</tbody></table></div>}</div>
            {selectedUser && <div className="chart-card full-width"><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}><h3>{selectedUser.username}</h3><button type="button" onClick={() => setSelectedUserId("")} style={{ border: "1px solid #777", color: "#ddd", background: "transparent", padding: "0.45rem 0.75rem", cursor: "pointer" }}>Back to users</button></div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>Interactions</th><th>AR clicks</th><th>VR clicks</th><th>Quiz clicks</th><th>Comments</th><th>Rating average</th><th>Quiz average</th><th>Quiz attempts</th><th>Sessions</th><th>Clicks / session</th><th>Avg. session</th><th>Last click</th><th>Last session</th><th>Last session duration</th><th>Last quiz</th></tr></thead><tbody><tr><td>{findNumericValue(selectedUser, ["interactionCount"])}</td><td>{selectedUserMetrics.arClicks}</td><td>{selectedUserMetrics.vrClicks}</td><td>{selectedUserMetrics.quizClicks}</td><td>{selectedUserMetrics.commentCount}</td><td>{selectedUserMetrics.ratingAverage === null ? "-" : `${selectedUserMetrics.ratingAverage.toFixed(1)} / 5`}</td><td>{selectedUserMetrics.quizAverage === null ? "-" : `${selectedUserMetrics.quizAverage.toFixed(1)}%`}</td><td>{selectedUserMetrics.quizAttempts}</td><td>{selectedUserMetrics.sessionCount}</td><td>{selectedUserMetrics.clicksPerSession === null ? "-" : selectedUserMetrics.clicksPerSession.toFixed(1)}</td><td>{formatDuration(selectedUserMetrics.averageSessionDurationSeconds)}</td><td>{formatAnalyticsDate(selectedUserMetrics.lastClickAt)}</td><td>{formatAnalyticsDate(selectedUserMetrics.lastSessionAt)}</td><td>{formatDuration(selectedUserMetrics.lastSessionDurationSeconds)}</td><td>{formatAnalyticsDate(selectedUserMetrics.lastQuizAt)}</td></tr></tbody></table></div>{selectedUserFeedback.map((item) => <p key={item.id} style={{ color: "#ccc" }}>{item.rating ? `${item.rating}/5 · ` : ""}{cleanFeedbackComment(item.comment) || "Rated without a comment"}</p>)}</div>}
            <div className="chart-card full-width"><h3>Recent Feedback</h3>{selectedFeedback.length === 0 ? <p style={{ color: "#888" }}>No feedback has been submitted for this selection.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>User</th><th>Rating</th><th>Institution</th><th>Date</th><th>Comment</th><th>Actions</th></tr></thead><tbody>{selectedFeedback.slice(0, 20).map((item) => <tr key={item.id}><td>{item.username}</td><td>{item.rating ? `${item.rating}/5` : "Unrated"}</td><td>{institutionNames[item.institutionId] || "Platform"}</td><td>{formatAnalyticsDate(item.createdAt)}</td><td>{item.comment ? cleanFeedbackComment(item.comment) : "—"}</td><td><button type="button" onClick={() => handleRemoveFeedback(item.id)} disabled={deletingFeedbackId === item.id} title="Remove feedback" style={{ border: "1px solid #ef4444", color: "#ef4444", background: "transparent", padding: "0.4rem 0.6rem", cursor: "pointer" }}>{deletingFeedbackId === item.id ? "Removing..." : "Remove"}</button></td></tr>)}</tbody></table></div>}</div>
        </div>
    );
};

export default AdminAnalytics;
