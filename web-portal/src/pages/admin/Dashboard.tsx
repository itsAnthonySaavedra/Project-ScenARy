import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { findNumericValue, getRatingStats, loadFeedback } from "../../lib/userAnalytics";
import { MODEL_CONTENT_TYPE, normalizeContentType } from "../../lib/contentTypes";
import styles from "../../components/features/dashboard/Dashboard.module.css";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip);

type Institution = { id: string; name: string; content: number };
type ContentItem = { type?: string; status?: string; institutionId?: string };
type DashboardData = {
  users: number;
  institutions: Institution[];
  content: ContentItem[];
  landmarks: number;
  pois: number;
  interactions: number;
  feedback: any[];
  logs: any[];
};

const emptyData: DashboardData = {
  users: 0,
  institutions: [],
  content: [],
  landmarks: 0,
  pois: 0,
  interactions: 0,
  feedback: [],
  logs: [],
};

const formatDate = (value: any) => {
  if (!value) return "Unknown time";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let institutions = [] as Institution[];
    let content = [] as ContentItem[];
    const unsubscribe = [
      onSnapshot(collection(db, "users"), (snapshot) => {
        setData((current) => ({ ...current, users: snapshot.size }));
      }, handleSnapshotError),
      onSnapshot(collection(db, "institutions"), (snapshot) => {
        institutions = snapshot.docs.map((item) => ({
          id: item.id,
          name: String(item.data().name || "Unnamed institution"),
          content: content.filter((entry) => entry.institutionId === item.id).length,
        })).sort((left, right) => right.content - left.content);
        setData((current) => ({ ...current, institutions }));
        setLoading(false);
      }, handleSnapshotError),
      onSnapshot(collection(db, "content"), (snapshot) => {
        content = snapshot.docs.map((item) => item.data() as ContentItem);
        institutions = institutions.map((institution) => ({
          ...institution,
          content: content.filter((item) => item.institutionId === institution.id).length,
        })).sort((left, right) => right.content - left.content);
        setData((current) => ({ ...current, content, institutions }));
        setLoading(false);
      }, handleSnapshotError),
      onSnapshot(collection(db, "markers"), (snapshot) => {
        setData((current) => ({ ...current, landmarks: snapshot.size }));
        setLoading(false);
      }, handleSnapshotError),
      onSnapshot(collection(db, "pois"), (snapshot) => {
        setData((current) => ({ ...current, pois: snapshot.size }));
        setLoading(false);
      }, handleSnapshotError),
      onSnapshot(collection(db, "userAnalytics"), (snapshot) => {
        const interactions = snapshot.docs.reduce(
          (total, item) => total + findNumericValue(item.data(), ["interactionCount"]),
          0,
        );
        setData((current) => ({ ...current, interactions }));
        setLoading(false);
      }, handleSnapshotError),
      onSnapshot(query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(5)), (snapshot) => {
        const logs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        setData((current) => ({ ...current, logs }));
        setLoading(false);
      }, handleSnapshotError),
    ];

    const loadSecondaryData = async () => {
      try {
        const feedbackRows = await loadFeedback();
        setData((current) => ({
          ...current,
          feedback: feedbackRows,
        }));
      } catch (fetchError) {
        console.error("Error fetching secondary admin dashboard data:", fetchError);
        setError("Unable to load all dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    function handleSnapshotError(snapshotError: Error) {
      console.error("Error receiving admin dashboard updates:", snapshotError);
      setError("Unable to load all dashboard data.");
      setLoading(false);
    }

    loadSecondaryData();
    return () => unsubscribe.forEach((stop) => stop());
  }, []);

  if (loading) return <div className={styles.dashboardState}>Loading platform overview...</div>;
  if (error) return <div className={styles.dashboardState}>{error}</div>;

  const ratingStats = getRatingStats(data.feedback);
  const contentTypes = ["Information", "Fun Fact", MODEL_CONTENT_TYPE, "Quiz", "Other"];
  const typeCounts = contentTypes.map((type) => type === "Other"
    ? data.content.filter((item) => !contentTypes.slice(0, -1).includes(normalizeContentType(item.type || ""))).length
    : data.content.filter((item) => normalizeContentType(item.type) === type).length);
  const published = data.content.filter((item) => item.status === "Published").length;
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
  const statItems: [string, number, string][] = [
    ["Total users", data.users, "fa-users"],
    ["Institutions", data.institutions.length, "fa-university"],
    ["Content items", data.content.length, "fa-layer-group"],
    ["Published content", published, "fa-circle-check"],
    ["Landmarks", data.landmarks, "fa-landmark"],
    ["POIs", data.pois, "fa-location-dot"],
  ];

  return (
    <div className={styles.institutionDashboard}>
      <section className={styles.dashboardIntro}>
        <div>
          <p className={styles.eyebrow}>Platform overview</p>
          <h1>ScenARy operations</h1>
          <p className={styles.introMeta}>A live view of institutions, content, and visitor activity.</p>
        </div>
        <div className={styles.institutionMeta}>
          <span><i className="fa-solid fa-chart-line"></i> Visitor interactions</span>
          <strong>{data.interactions.toLocaleString()}</strong>
        </div>
      </section>

      <section className={styles.statsGrid}>
        {statItems.map(([title, value, icon]) => (
          <div className={styles.statCard} key={title}>
            <div className={styles.statIcon}><i className={`fa-solid ${icon}`}></i></div>
            <div className={styles.statInfo}><h3>{title}</h3><div className={styles.value}>{value}</div></div>
          </div>
        ))}
      </section>

      <section className={styles.quickActions} aria-label="Quick actions">
        <button type="button" className={styles.quickAction} onClick={() => navigate("/admin/content")}><i className="fa-solid fa-layer-group" /> Manage content</button>
        <button type="button" className={styles.quickAction} onClick={() => navigate("/admin/users")}><i className="fa-solid fa-users" /> Manage users</button>
        <button type="button" className={styles.quickAction} onClick={() => navigate("/admin/analytics")}><i className="fa-solid fa-chart-pie" /> Open analytics</button>
        <button type="button" className={styles.quickAction} onClick={() => navigate("/admin/activity-logs")}><i className="fa-solid fa-list-check" /> Review activity</button>
      </section>

      <section className={styles.dashboardCharts}>
        <div className={styles.chartCard}>
          <div className={styles.cardHeading}><div><p className={styles.eyebrow}>Library composition</p><h3>Content by type</h3></div><span>{data.content.length} total</span></div>
          <div className={styles.chartContainer}><Doughnut data={{ labels: contentTypes, datasets: [{ data: typeCounts, backgroundColor: ["#d4af37", "#bb8066", "#5f8f88", "#8b83a7", "#756f69"], borderWidth: 0 }] }} options={{ ...chartOptions, cutout: "68%" }} /></div>
          <div className={styles.chartLegend}>{contentTypes.map((type, index) => <span key={type}><i className={styles.legendDot}></i>{type}<strong>{typeCounts[index]}</strong></span>)}</div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.cardHeading}><div><p className={styles.eyebrow}>Institution coverage</p><h3>Content distribution</h3></div><span>Top 6</span></div>
          <div className={styles.chartContainer}><Bar data={{ labels: data.institutions.slice(0, 6).map((item) => item.name.length > 18 ? `${item.name.slice(0, 18)}...` : item.name), datasets: [{ data: data.institutions.slice(0, 6).map((item) => item.content), backgroundColor: "#d4af37", borderRadius: 5, barThickness: 24 }] }} options={{ ...chartOptions, scales: { y: { beginAtZero: true, ticks: { color: "#a8a29e" }, grid: { color: "rgba(255,255,255,.06)" } }, x: { ticks: { color: "#a8a29e" }, grid: { display: false } } } }} /></div>
        </div>
      </section>

      <section className={styles.dashboardCharts}>
        <div className={styles.chartCard}>
          <div className={styles.cardHeading}><div><p className={styles.eyebrow}>Visitor feedback</p><h3>Platform sentiment</h3></div><span>{ratingStats.reviewCount} reviews</span></div>
          <div className={styles.feedbackSummary}><strong>{ratingStats.average === null ? "-" : ratingStats.average.toFixed(1)}</strong><span>/ 5 average rating</span></div>
          {ratingStats.distribution.slice(1).reverse().map((item) => <div className={styles.ratingRow} key={item.rating}><span>{item.rating} stars</span><div><i style={{ width: `${ratingStats.reviewCount ? (item.count / ratingStats.reviewCount) * 100 : 0}%` }}></i></div><strong>{item.count}</strong></div>)}
        </div>
        <div className={styles.chartCard}>
          <div className={styles.cardHeading}><div><p className={styles.eyebrow}>Audit trail</p><h3>Recent activity</h3></div></div>
          {data.logs.length === 0 ? <p className={styles.emptyState}>No recorded platform activity yet.</p> : data.logs.map((log) => <div className={styles.feedbackItem} key={log.id}><span className={styles.feedbackRating}><i className="fa-solid fa-bolt"></i></span><p><strong>{log.action || "Activity"}</strong><br /><small>{log.entityType || "system"} · {formatDate(log.createdAt)}</small></p></div>)}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
