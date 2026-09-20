import React, { useEffect, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { findNumericValue, getRatingStats, loadFeedback, loadUserAnalytics } from "../../lib/userAnalytics";
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
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [usersSnap, institutionSnap, contentSnap, landmarkSnap, poiSnap, analyticsRows, feedbackRows, logSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "institutions")),
          getDocs(collection(db, "content")),
          getDocs(collection(db, "markers")),
          getDocs(collection(db, "pois")),
          loadUserAnalytics(),
          loadFeedback(),
          getDocs(collection(db, "auditLogs")),
        ]);
        const content = contentSnap.docs.map((item) => item.data() as ContentItem);
        const contentByInstitution = content.reduce<Record<string, number>>((counts, item) => {
          if (item.institutionId) counts[item.institutionId] = (counts[item.institutionId] || 0) + 1;
          return counts;
        }, {});
        const institutions = institutionSnap.docs
          .map((item) => ({ id: item.id, name: String(item.data().name || "Unnamed institution"), content: contentByInstitution[item.id] || 0 }))
          .sort((left, right) => right.content - left.content);
        const logs = logSnap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort((left, right) => (right.createdAt?.toMillis?.() || 0) - (left.createdAt?.toMillis?.() || 0))
          .slice(0, 5);

        setData({
          users: usersSnap.size,
          institutions,
          content,
          landmarks: landmarkSnap.size,
          pois: poiSnap.size,
          interactions: analyticsRows.reduce((total, item) => total + findNumericValue(item, ["interactionCount"]), 0),
          feedback: feedbackRows,
          logs,
        });
      } catch (fetchError) {
        console.error("Error fetching admin dashboard:", fetchError);
        setError("Unable to load all dashboard data.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <div className={styles.dashboardState}>Loading platform overview...</div>;
  if (error) return <div className={styles.dashboardState}>{error}</div>;

  const ratingStats = getRatingStats(data.feedback);
  const contentTypes = ["Information", "3D Model", "Quiz", "Audio", "Other"];
  const typeCounts = contentTypes.map((type) => type === "Other"
    ? data.content.filter((item) => !contentTypes.slice(0, -1).includes(item.type || "")).length
    : data.content.filter((item) => item.type === type).length);
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
