import React, { useEffect, useState } from "react";
import StatCard from "../../components/features/dashboard/StatCard";
import HistoryItem from "../../components/features/dashboard/HistoryItem";
import styles from "../../components/features/dashboard/Dashboard.module.css";
import { db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

interface Stat {
  title: string;
  value: string;
  change: string;
  icon: string;
  color: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stat[]>([
    {
      title: "Total Users",
      value: "0",
      change: "+0%",
      icon: "fa-users",
      color: "gold",
    },
    {
      title: "Institutions",
      value: "0", // initial value 0
      change: "+0%",
      icon: "fa-university",
      color: "blue",
    },
    {
      title: "Content Items",
      value: "0",
      change: "",
      icon: "fa-vr-cardboard",
      color: "green",
    },
    {
      title: "Published Content",
      value: "0",
      change: "",
      icon: "fa-check-circle",
      color: "purple",
    },
    {
      title: "Landmarks",
      value: "0",
      change: "",
      icon: "fa-location-dot",
      color: "blue",
    },
    {
      title: "POIs",
      value: "0",
      change: "",
      icon: "fa-qrcode",
      color: "gold",
    },
  ]);

  const [history] = useState([
    {
      title: "New User Registration",
      time: "2 mins ago",
      icon: "fa-user-plus",
    },
    {
      title: "Tour Updated: Fort San Pedro",
      time: "15 mins ago",
      icon: "fa-edit",
    },
    {
      title: "New Institution Request",
      time: "1 hour ago",
      icon: "fa-envelope",
    },
    {
      title: "System Backup Completed",
      time: "4 hours ago",
      icon: "fa-database",
    },
  ]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersSnap, instSnap, contentSnap, landmarkSnap, poiSnap] =
          await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(collection(db, "institutions")),
            getDocs(collection(db, "content")),
            getDocs(collection(db, "markers")),
            getDocs(collection(db, "pois")),
          ]);

        const totalUsers = usersSnap.size;
        const totalInstitutions = instSnap.size;
        const totalContent = contentSnap.size;
        const publishedContent = contentSnap.docs.filter(
          (item) => item.data().status === "Published",
        ).length;
        const totalLandmarks = landmarkSnap.size;
        const totalPois = poiSnap.size;

        setStats((prevStats) =>
          prevStats.map((s) => {
            if (s.title === "Total Users")
              return { ...s, value: totalUsers.toString() };
            if (s.title === "Institutions")
              return { ...s, value: totalInstitutions.toString() };
            if (s.title === "Content Items")
              return { ...s, value: totalContent.toString() };
            if (s.title === "Published Content")
              return { ...s, value: publishedContent.toString() };
            if (s.title === "Landmarks")
              return { ...s, value: totalLandmarks.toString() };
            if (s.title === "POIs")
              return { ...s, value: totalPois.toString() };
            return s;
          }),
        );
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
      }
    };

    fetchStats();
  }, []);

  return (
    <div>
      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Charts Section */}
      <div className={styles.chartsGrid}>
        <div className={`${styles.chartCard} ${styles.fullWidth}`}>
          <h3>Platform Growth & Engagement</h3>
          <div className={styles.chartContainer}>
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px dashed #444",
                borderRadius: "8px",
                color: "#666",
              }}
            >
              Interactive Chart Component (Recharts/Chart.js)
            </div>
          </div>
        </div>

        <div className={styles.chartCard}>
          <h3>User Demographics</h3>
          <div className={styles.chartContainer}>
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px dashed #444",
                borderRadius: "8px",
                color: "#666",
              }}
            >
              Pie Chart Component
            </div>
          </div>
        </div>

        <div className={styles.chartCard}>
          <h3>Recent Activity</h3>
          <div
            className={styles.recentHistoryContainer}
            style={{ border: "none", padding: 0, background: "transparent" }}
          >
            {history.map((item, index) => (
              <HistoryItem key={index} {...item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
