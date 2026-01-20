// src/pages/admin/Dashboard.tsx
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
      value: "45",
      change: "+5%",
      icon: "fa-university",
      color: "blue",
    },
    {
      title: "Active Tours",
      value: "89",
      change: "+8%",
      icon: "fa-vr-cardboard",
      color: "green",
    },
    {
      title: "Total Views",
      value: "15.2k",
      change: "+24%",
      icon: "fa-eye",
      color: "purple",
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
    const fetchUsers = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const totalUsers = usersSnap.docs.length;

        setStats((prevStats) =>
          prevStats.map((s) =>
            s.title === "Total Users"
              ? { ...s, value: totalUsers.toString() }
              : s,
          ),
        );
      } catch (err) {
        console.error("Error fetching users for dashboard:", err);
      }
    };

    fetchUsers();
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
