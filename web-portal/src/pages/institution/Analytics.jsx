import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import {
  findNumericValue,
  formatAnalyticsDate,
  formatDuration,
  getRatingStats,
  getUserAnalyticsMetrics,
  cleanFeedbackComment,
  loadFeedback,
  loadUserAnalytics,
  toRating,
} from "../../lib/userAnalytics";
import { MODEL_CONTENT_TYPE, LEGACY_MODEL_CONTENT_TYPE } from "../../lib/contentTypes";
import dashboardStyles from "../../components/features/dashboard/Dashboard.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

const InstituteAnalytics = () => {
  const [analytics, setAnalytics] = useState({
    content: 0,
    published: 0,
    landmarks: 0,
    pois: 0,
    byType: {},
    interactionCount: 0,
    ratingCount: 0,
    ratingTotal: 0,
    commentCount: 0,
  });
  const [userAnalytics, setUserAnalytics] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const profile = await getDoc(doc(db, "users", user.uid));
        const institutionId = profile.data()?.institutionId;
        if (!institutionId) {
          setLoading(false);
          return;
        }

        const [contentSnap, landmarkSnap, poiSnap, analyticsRows, feedbackRows] = await Promise.all([
          getDocs(query(collection(db, "content"), where("institutionId", "==", institutionId))),
          getDocs(query(collection(db, "markers"), where("institutionId", "==", institutionId))),
          getDocs(query(collection(db, "pois"), where("institutionId", "==", institutionId))),
          loadUserAnalytics(institutionId),
          loadFeedback(institutionId),
        ]);

        const byType = contentSnap.docs.reduce((counts, item) => {
          const type = item.data().type || "Other";
          counts[type] = (counts[type] || 0) + 1;
          return counts;
        }, {});

        setAnalytics({
          content: contentSnap.size,
          published: contentSnap.docs.filter((item) => item.data().status === "Published").length,
          landmarks: landmarkSnap.size,
          pois: poiSnap.size,
          byType,
          interactionCount: analyticsRows.reduce((total, item) => total + Number(item.interactionCount || 0), 0),
          ratingCount: analyticsRows.reduce((total, item) => total + Number(item.ratingCount || 0), 0),
          ratingTotal: analyticsRows.reduce((total, item) => total + toRating(item), 0),
          commentCount: feedbackRows.filter((item) => item.comment?.trim()).length,
        });
        setUserAnalytics(analyticsRows);
        setFeedback(feedbackRows);
      } catch (fetchError) {
        console.error("Unable to load institution analytics:", fetchError);
        setError("Unable to load live analytics.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const contentTypeOrder = ["Information", "Quiz", MODEL_CONTENT_TYPE];
  const contentTypeCounts = contentTypeOrder.map((type) => ({
    type,
    count: type === MODEL_CONTENT_TYPE
      ? (analytics.byType[type] || 0) + (analytics.byType[LEGACY_MODEL_CONTENT_TYPE] || 0)
      : analytics.byType[type] || 0,
  }));
  const ratingStats = getRatingStats(feedback);
  const selectedUser = userAnalytics.find((item) => item.id === selectedUserId);
  const selectedUserMetrics = selectedUser ? getUserAnalyticsMetrics(selectedUser) : null;
  const selectedUserFeedback = selectedUser
    ? feedback.filter((item) => item.userId === (selectedUser.userId || selectedUser.id))
    : [];
  const engagementData = {
    labels: contentTypeCounts.map((item) => item.type),
    datasets: [
      {
        label: "Content items",
        data: contentTypeCounts.map((item) => item.count),
        backgroundColor: ["#d4af37", "#eab308", "#fbbf24"],
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: "#a8a29e" },
        grid: { color: "rgba(255, 255, 255, 0.05)" },
      },
      x: { ticks: { color: "#a8a29e" }, grid: { display: false } },
    },
  };

  if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading live analytics...</div>;
  if (error) return <div style={{ padding: 20, color: "#fbbf24" }}>{error}</div>;

  return (
    <div>
      <div className={dashboardStyles.statsGrid}>
        <div className={dashboardStyles.statCard}>
          <div className={dashboardStyles.statIcon}>
            <i className="fa-solid fa-users"></i>
          </div>
          <div className={dashboardStyles.statInfo}>
            <h3>Total Content</h3>
            <div className={dashboardStyles.value}>{analytics.content}</div>
          </div>
        </div>
        <div className={dashboardStyles.statCard}>
          <div className={dashboardStyles.statIcon}>
            <i className="fa-solid fa-clock"></i>
          </div>
          <div className={dashboardStyles.statInfo}>
            <h3>Published Content</h3>
            <div className={dashboardStyles.value}>{analytics.published}</div>
          </div>
        </div>
        <div className={dashboardStyles.statCard}>
          <div className={dashboardStyles.statIcon}>
            <i className="fa-solid fa-location-dot"></i>
          </div>
          <div className={dashboardStyles.statInfo}>
            <h3>Landmarks</h3>
            <div className={dashboardStyles.value}>{analytics.landmarks}</div>
          </div>
        </div>
        <div className={dashboardStyles.statCard}>
          <div className={dashboardStyles.statIcon}>
            <i className="fa-solid fa-qrcode"></i>
          </div>
          <div className={dashboardStyles.statInfo}>
            <h3>POIs</h3>
            <div className={dashboardStyles.value}>{analytics.pois}</div>
          </div>
        </div>
        <div className={dashboardStyles.statCard}>
          <div className={dashboardStyles.statIcon}><i className="fa-solid fa-hand-pointer"></i></div>
          <div className={dashboardStyles.statInfo}><h3>User Interactions</h3><div className={dashboardStyles.value}>{analytics.interactionCount}</div></div>
        </div>
        <div className={dashboardStyles.statCard}>
          <div className={dashboardStyles.statIcon}><i className="fa-solid fa-star"></i></div>
          <div className={dashboardStyles.statInfo}><h3>Average Rating</h3><div className={dashboardStyles.value}>{ratingStats.average === null ? "-" : `${ratingStats.average.toFixed(1)} / 5`}</div><small style={{ color: "#888" }}>{ratingStats.reviewCount} reviews</small></div>
        </div>
      </div>

      <div
        className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`}
      >
        <h3>Content By Type</h3>
        <div className={dashboardStyles.chartContainer}>
          <Bar
            data={engagementData}
            options={{ ...options, maintainAspectRatio: false }}
          />
        </div>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
          {contentTypeCounts.map(({ type, count }) => (
            <div key={type} style={{ color: "#ddd", fontSize: "0.9rem" }}>
              <strong>{type}:</strong> {count}
            </div>
          ))}
        </div>
      </div>
      <div className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`} style={{ marginTop: "2rem" }}><h3>Rating Distribution</h3>{ratingStats.reviewCount === 0 ? <p style={{ color: "#888" }}>No star ratings have been submitted yet.</p> : ratingStats.distribution.map((item) => <div key={item.rating} style={{ display: "grid", gridTemplateColumns: "70px 1fr 50px", gap: "0.75rem", alignItems: "center", margin: "0.5rem 0" }}><span>{item.rating} star{item.rating === 1 ? "" : "s"}</span><div style={{ height: "8px", background: "#333" }}><div style={{ width: `${(item.count / ratingStats.reviewCount) * 100}%`, height: "100%", background: "#d4af37" }} /></div><span style={{ color: "#aaa" }}>{item.count}</span></div>)}</div>
      <div className={dashboardStyles.chartsGrid} style={{ marginTop: "2rem" }}>
        <div className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`}><h3>Users</h3>{userAnalytics.length === 0 ? <p style={{ color: "#888" }}>No cached user analytics yet.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>User</th><th>Interactions</th><th>Last active</th></tr></thead><tbody>{userAnalytics.slice().sort((left, right) => left.username.localeCompare(right.username)).map((item) => <tr key={item.id}><td><button type="button" onClick={() => setSelectedUserId(item.id)} style={{ border: 0, padding: 0, background: "none", color: "#d4af37", cursor: "pointer", textDecoration: "underline" }}>{item.username}</button></td><td>{findNumericValue(item, ["interactionCount"]) || 0}</td><td>{formatAnalyticsDate(item.lastInteractionAt)}</td></tr>)}</tbody></table></div>}</div>
        {selectedUser && <div className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}><h3>{selectedUser.username}</h3><button type="button" onClick={() => setSelectedUserId("")} style={{ border: "1px solid #777", color: "#ddd", background: "transparent", padding: "0.45rem 0.75rem", cursor: "pointer" }}>Back to users</button></div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>Interactions</th><th>Comments</th><th>Rating average</th><th>Quiz average</th><th>Quiz attempts</th><th>Clicks / session</th><th>Avg. session</th><th>Last quiz</th><th>Last active</th></tr></thead><tbody><tr><td>{findNumericValue(selectedUser, ["interactionCount"]) || 0}</td><td>{selectedUserMetrics.commentCount}</td><td>{selectedUserMetrics.ratingAverage === null ? "-" : `${selectedUserMetrics.ratingAverage.toFixed(1)} / 5`}</td><td>{selectedUserMetrics.quizAverage === null ? "-" : `${selectedUserMetrics.quizAverage.toFixed(1)}%`}</td><td>{selectedUserMetrics.quizAttempts}</td><td>{selectedUserMetrics.clicksPerSession === null ? "-" : selectedUserMetrics.clicksPerSession.toFixed(1)}</td><td>{formatDuration(selectedUserMetrics.averageSessionDurationSeconds)}</td><td>{formatAnalyticsDate(selectedUserMetrics.lastQuizAt)}</td><td>{formatAnalyticsDate(selectedUser.lastInteractionAt)}</td></tr></tbody></table></div>{selectedUserFeedback.map((item) => <p key={item.id} style={{ color: "#ccc" }}>{item.rating ? `${item.rating}/5 · ` : ""}{cleanFeedbackComment(item.comment) || "Rated without a comment"}</p>)}</div>}
        <div className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`}><h3>Recent Feedback ({analytics.commentCount} comments)</h3>{feedback.length === 0 ? <p style={{ color: "#888" }}>No feedback has been submitted yet.</p> : feedback.slice(0, 10).map((item) => <div key={item.id} style={{ borderBottom: "1px solid #333", padding: "0.75rem 0" }}><strong>{item.rating ? `${item.rating}/5` : "Unrated"}</strong><span style={{ color: "#888", marginLeft: "0.75rem" }}>{formatAnalyticsDate(item.createdAt)}</span>{item.comment && <p style={{ margin: "0.35rem 0 0", color: "#ccc" }}>{cleanFeedbackComment(item.comment)}</p>}</div>)}</div>
      </div>
    </div>
  );
};

export default InstituteAnalytics;
