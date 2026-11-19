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
import PageHeader from "../../components/common/PageHeader";
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
import { MODEL_CONTENT_TYPE, LEGACY_MODEL_CONTENT_TYPES } from "../../lib/contentTypes";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";
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
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [feedbackSearchTerm, setFeedbackSearchTerm] = useState("");
  const [feedback, setFeedback] = useState([]);
  const [feedbackPeriod, setFeedbackPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [siteRevenue, setSiteRevenue] = useState({ amountCentavos: 0, passCount: 0 });
  const [siteRevenueLoading, setSiteRevenueLoading] = useState(true);
  const [siteRevenueError, setSiteRevenueError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        setSiteRevenueLoading(false);
        return;
      }

      try {
        const profile = await getDoc(doc(db, "users", user.uid));
        const institutionId = profile.data()?.institutionId;
        if (!institutionId) {
          setLoading(false);
          setSiteRevenueLoading(false);
          return;
        }

        setSiteRevenueLoading(true);
        setSiteRevenueError("");
        const [contentSnap, landmarkSnap, poiSnap, analyticsRows, feedbackRows, revenueSnap] = await Promise.all([
          getDocs(query(collection(db, "content"), where("institutionId", "==", institutionId))),
          getDocs(query(collection(db, "landmarks"), where("institutionId", "==", institutionId))),
          getDocs(query(collection(db, "pois"), where("institutionId", "==", institutionId))),
          loadUserAnalytics(institutionId),
          loadFeedback(institutionId),
          getDocs(collection(db, "siteAccess", institutionId, "transactions")).catch((revenueLoadError) => {
            console.error("Unable to load institution site revenue:", revenueLoadError);
            setSiteRevenueError(
              getFirebaseErrorMessage(revenueLoadError, "Unable to load recorded pass revenue."),
            );
            return null;
          }),
        ]);

        if (revenueSnap) {
          const transactions = revenueSnap.docs
            .map((item) => item.data())
            .filter(
              (item) =>
                item.currency === "PHP" &&
                Number.isSafeInteger(item.amountCentavos) &&
                item.amountCentavos >= 0,
            );
          setSiteRevenue({
            amountCentavos: transactions.reduce((total, item) => total + item.amountCentavos, 0),
            passCount: transactions.length,
          });
        } else {
          setSiteRevenue({ amountCentavos: 0, passCount: 0 });
        }
        setSiteRevenueLoading(false);

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
        setSiteRevenueLoading(false);
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
      ? LEGACY_MODEL_CONTENT_TYPES.reduce(
        (count, legacyType) => count + (analytics.byType[legacyType] || 0),
        analytics.byType[type] || 0,
      )
      : analytics.byType[type] || 0,
  }));
  const periodDays = Number(feedbackPeriod);
  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);
  periodStart.setDate(periodStart.getDate() - periodDays + 1);
  const feedbackForPeriod = feedback.filter((item) => {
    const date = typeof item.createdAt?.toDate === "function" ? item.createdAt.toDate() : new Date(item.createdAt);
    return !Number.isNaN(date.getTime()) && date >= periodStart;
  });
  const userQuery = userSearchTerm.trim().toLowerCase();
  const feedbackQuery = feedbackSearchTerm.trim().toLowerCase();
  const filteredUsers = userAnalytics.filter((item) =>
    [item.username, item.email, item.userId]
      .some((value) => String(value || "").toLowerCase().includes(userQuery)),
  );
  const filteredFeedback = feedbackForPeriod.filter((item) =>
    [item.username, item.email, item.comment, item.rating]
      .some((value) => String(value ?? "").toLowerCase().includes(feedbackQuery)),
  );
  const ratingStats = getRatingStats(feedbackForPeriod);
  const selectedUser = userAnalytics.find((item) => item.id === selectedUserId);
  const selectedUserMetrics = selectedUser ? getUserAnalyticsMetrics(selectedUser) : null;
  const engagementTotals = userAnalytics.reduce((totals, item) => {
    const metrics = getUserAnalyticsMetrics(item);
    return {
      arClicks: totals.arClicks + metrics.arClicks,
      vrClicks: totals.vrClicks + metrics.vrClicks,
      quizClicks: totals.quizClicks + metrics.quizClicks,
      quizAttempts: totals.quizAttempts + metrics.quizAttempts,
      sessions: totals.sessions + metrics.sessionCount,
      sessionSeconds: totals.sessionSeconds + metrics.totalSessionDurationSeconds,
      quizQuestions: totals.quizQuestions + metrics.totalQuizQuestions,
      quizCorrect: totals.quizCorrect + (metrics.quizAverage === null ? 0 : metrics.quizAverage * metrics.totalQuizQuestions / 100),
    };
  }, { arClicks: 0, vrClicks: 0, quizClicks: 0, quizAttempts: 0, sessions: 0, sessionSeconds: 0, quizQuestions: 0, quizCorrect: 0 });
  const institutionQuizAverage = engagementTotals.quizQuestions
    ? (engagementTotals.quizCorrect / engagementTotals.quizQuestions) * 100
    : null;
  const siteRevenueLabel = siteRevenueError
    ? "Unavailable"
    : siteRevenueLoading
      ? "Loading..."
      : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
      }).format(siteRevenue.amountCentavos / 100);
  const selectedUserFeedback = selectedUser
    ? feedbackForPeriod.filter((item) => item.userId === (selectedUser.userId || selectedUser.id))
    : [];
  const feedbackTrend = Array.from({ length: periodDays }, (_, index) => {
    const date = new Date(periodStart);
    date.setDate(periodStart.getDate() + index);
    const dateKey = date.toLocaleDateString();
    return {
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: feedbackForPeriod.filter((item) => {
        const createdAt = typeof item.createdAt?.toDate === "function" ? item.createdAt.toDate() : new Date(item.createdAt);
        return !Number.isNaN(createdAt.getTime()) && createdAt.toLocaleDateString() === dateKey;
      }).length,
    };
  });
  const feedbackTrendData = {
    labels: feedbackTrend.map((item) => item.label),
    datasets: [{ label: "Feedback responses", data: feedbackTrend.map((item) => item.count), backgroundColor: "#d4af37", borderRadius: 4 }],
  };
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
      <PageHeader
        eyebrow="Institution reports"
        title="Analytics"
        description="Review visitor interactions, content performance, and recorded access revenue."
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <p style={{ color: "#aaa", margin: 0 }}>Interaction totals and user summaries are all-time. Feedback below follows the selected period.</p>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#ddd" }} htmlFor="feedback-period">Feedback period
          <select id="feedback-period" value={feedbackPeriod} onChange={(event) => setFeedbackPeriod(event.target.value)} style={{ padding: "0.5rem", background: "#111", color: "#fff", border: "1px solid #555" }}>
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
          </select>
        </label>
      </div>
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
            <i className="fa-solid fa-coins"></i>
          </div>
          <div className={dashboardStyles.statInfo}>
            <h3>Recorded Pass Revenue</h3>
            <div className={dashboardStyles.value}>{siteRevenueLabel}</div>
            <small style={{ color: "#888" }}>
              {siteRevenue.passCount} recorded day passes
            </small>
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
      {siteRevenueError ? (
        <p role="alert" style={{ color: "#fca5a5" }}>{siteRevenueError}</p>
      ) : (
        <p style={{ color: "#888" }}>
          Revenue reflects admin-granted day passes recorded for your institution. One-minute tests and phone purchases are not included.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
        <section className={dashboardStyles.chartCard}>
          <h3>Clicks</h3>
          <div style={{ display: "grid", gap: "0.65rem" }}>
            {[["AR", engagementTotals.arClicks], ["VR", engagementTotals.vrClicks], ["Quiz", engagementTotals.quizClicks]].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>
        </section>
        <section className={dashboardStyles.chartCard}>
          <h3>Quizzes</h3>
          <div style={{ display: "grid", gap: "0.65rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>Attempts</span><strong>{engagementTotals.quizAttempts}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>Accuracy</span><strong>{institutionQuizAverage === null ? "-" : `${institutionQuizAverage.toFixed(1)}%`}</strong></div>
          </div>
        </section>
        <section className={dashboardStyles.chartCard}>
          <h3>Sessions</h3>
          <div style={{ display: "grid", gap: "0.65rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>Sessions</span><strong>{engagementTotals.sessions}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#ddd" }}><span>Total time</span><strong>{formatDuration(engagementTotals.sessionSeconds)}</strong></div>
          </div>
        </section>
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
      <div className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`} style={{ marginTop: "2rem" }}><h3>Feedback activity</h3>{feedbackForPeriod.length === 0 ? <p style={{ color: "#888" }}>No feedback in this period.</p> : <div className={dashboardStyles.chartContainer}><Bar data={feedbackTrendData} options={{ ...options, maintainAspectRatio: false, scales: { ...options.scales, x: { ...options.scales.x, ticks: { ...options.scales.x.ticks, maxTicksLimit: 10 } } } }} /></div>}</div>
      <div className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`} style={{ marginTop: "2rem" }}><h3>Rating Distribution</h3>{ratingStats.reviewCount === 0 ? <p style={{ color: "#888" }}>No star ratings in this period.</p> : ratingStats.distribution.map((item) => <div key={item.rating} style={{ display: "grid", gridTemplateColumns: "70px 1fr 50px", gap: "0.75rem", alignItems: "center", margin: "0.5rem 0" }}><span>{item.rating} star{item.rating === 1 ? "" : "s"}</span><div style={{ height: "8px", background: "#333" }}><div style={{ width: `${(item.count / ratingStats.reviewCount) * 100}%`, height: "100%", background: "#d4af37" }} /></div><span style={{ color: "#aaa" }}>{item.count}</span></div>)}</div>
      <div className={dashboardStyles.chartsGrid} style={{ marginTop: "2rem" }}>
        <div className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`}>
          <h3>Users</h3>
          <input
            type="search"
            aria-label="Search users"
            placeholder="Search users by name or email"
            value={userSearchTerm}
            onChange={(event) => setUserSearchTerm(event.target.value)}
            style={{ width: "min(100%, 360px)", padding: "0.65rem", marginBottom: "1rem", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "4px" }}
          />
          {userAnalytics.length === 0 ? <p style={{ color: "#888" }}>No cached user analytics yet.</p> : filteredUsers.length === 0 ? <p style={{ color: "#888" }}>No users match that search.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>User</th><th>Interactions</th><th>AR clicks</th><th>VR clicks</th><th>Quiz clicks</th><th>Quiz attempts</th><th>Sessions</th><th>Session time</th><th>Last active</th></tr></thead><tbody>{filteredUsers.slice().sort((left, right) => left.username.localeCompare(right.username)).map((item) => { const metrics = getUserAnalyticsMetrics(item); return <tr key={item.id}><td><button type="button" onClick={() => setSelectedUserId(item.id)} style={{ border: 0, padding: 0, background: "none", color: "#d4af37", cursor: "pointer", textDecoration: "underline" }}>{item.username}</button></td><td>{findNumericValue(item, ["interactionCount"]) || 0}</td><td>{metrics.arClicks}</td><td>{metrics.vrClicks}</td><td>{metrics.quizClicks}</td><td>{metrics.quizAttempts}</td><td>{metrics.sessionCount}</td><td>{formatDuration(metrics.totalSessionDurationSeconds)}</td><td>{formatAnalyticsDate(metrics.lastActiveAt)}</td></tr>; })}</tbody></table></div>}
        </div>
        {selectedUser && <div className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}><h3>{selectedUser.username}</h3><button type="button" onClick={() => setSelectedUserId("")} style={{ border: "1px solid #777", color: "#ddd", background: "transparent", padding: "0.45rem 0.75rem", cursor: "pointer" }}>Back to users</button></div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>Interactions</th><th>AR clicks</th><th>VR clicks</th><th>Quiz clicks</th><th>Comments</th><th>Rating average</th><th>Quiz average</th><th>Quiz attempts</th><th>Sessions</th><th>Clicks / session</th><th>Avg. session</th><th>Last click</th><th>Last session</th><th>Last session duration</th><th>Last quiz</th></tr></thead><tbody><tr><td>{findNumericValue(selectedUser, ["interactionCount"]) || 0}</td><td>{selectedUserMetrics.arClicks}</td><td>{selectedUserMetrics.vrClicks}</td><td>{selectedUserMetrics.quizClicks}</td><td>{selectedUserMetrics.commentCount}</td><td>{selectedUserMetrics.ratingAverage === null ? "-" : `${selectedUserMetrics.ratingAverage.toFixed(1)} / 5`}</td><td>{selectedUserMetrics.quizAverage === null ? "-" : `${selectedUserMetrics.quizAverage.toFixed(1)}%`}</td><td>{selectedUserMetrics.quizAttempts}</td><td>{selectedUserMetrics.sessionCount}</td><td>{selectedUserMetrics.clicksPerSession === null ? "-" : selectedUserMetrics.clicksPerSession.toFixed(1)}</td><td>{formatDuration(selectedUserMetrics.averageSessionDurationSeconds)}</td><td>{formatAnalyticsDate(selectedUserMetrics.lastClickAt)}</td><td>{formatAnalyticsDate(selectedUserMetrics.lastSessionAt)}</td><td>{formatDuration(selectedUserMetrics.lastSessionDurationSeconds)}</td><td>{formatAnalyticsDate(selectedUserMetrics.lastQuizAt)}</td></tr></tbody></table></div>{selectedUserFeedback.map((item) => <p key={item.id} style={{ color: "#ccc" }}>{item.rating ? `${item.rating}/5 · ` : ""}{cleanFeedbackComment(item.comment) || "Rated without a comment"}</p>)}</div>}
        <div className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`}>
          <h3>Recent Feedback ({feedbackForPeriod.filter((item) => item.comment?.trim()).length} comments)</h3>
          <input
            type="search"
            aria-label="Search feedback"
            placeholder="Search feedback by user, comment, or rating"
            value={feedbackSearchTerm}
            onChange={(event) => setFeedbackSearchTerm(event.target.value)}
            style={{ width: "min(100%, 360px)", padding: "0.65rem", marginBottom: "1rem", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "4px" }}
          />
          {feedbackForPeriod.length === 0 ? <p style={{ color: "#888" }}>No feedback in this period.</p> : filteredFeedback.length === 0 ? <p style={{ color: "#888" }}>No feedback matches that search.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>User</th><th>Rating</th><th>Date</th><th>Comment</th></tr></thead><tbody>{filteredFeedback.map((item) => <tr key={item.id}><td>{item.username}</td><td>{item.rating ? `${item.rating}/5` : "Unrated"}</td><td>{formatAnalyticsDate(item.createdAt)}</td><td>{item.comment ? cleanFeedbackComment(item.comment) : "—"}</td></tr>)}</tbody></table></div>}
        </div>
      </div>
    </div>
  );
};

export default InstituteAnalytics;
