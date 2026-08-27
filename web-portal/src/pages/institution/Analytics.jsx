import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import dashboardStyles from "../../components/features/dashboard/Dashboard.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
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
  });
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

        const [contentSnap, landmarkSnap, poiSnap] = await Promise.all([
          getDocs(query(collection(db, "content"), where("institutionId", "==", institutionId))),
          getDocs(query(collection(db, "markers"), where("institutionId", "==", institutionId))),
          getDocs(query(collection(db, "pois"), where("institutionId", "==", institutionId))),
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
        });
      } catch (fetchError) {
        console.error("Unable to load institution analytics:", fetchError);
        setError("Unable to load live analytics.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const typeLabels = Object.keys(analytics.byType);
  const engagementData = {
    labels: typeLabels.length ? typeLabels : ["No content"],
    datasets: [
      {
        label: "Content items",
        data: typeLabels.length ? typeLabels.map((type) => analytics.byType[type]) : [0],
        fill: false,
        borderColor: "#d4af37",
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: {
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
      </div>

      <div
        className={`${dashboardStyles.chartCard} ${dashboardStyles.fullWidth}`}
      >
        <h3>Content By Type</h3>
        <div className={dashboardStyles.chartContainer}>
          <Line
            data={engagementData}
            options={{ ...options, maintainAspectRatio: false }}
          />
        </div>
      </div>
    </div>
  );
};

export default InstituteAnalytics;
