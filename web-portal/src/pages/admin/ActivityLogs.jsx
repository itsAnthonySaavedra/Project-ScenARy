import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import tableStyles from "../../components/common/Tables.module.css";

const formatDate = (value) => {
  if (!value) return "Unknown";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const snapshot = await getDocs(collection(db, "auditLogs"));
        const loadedLogs = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort((left, right) => {
            const leftTime = left.createdAt?.toMillis?.() || 0;
            const rightTime = right.createdAt?.toMillis?.() || 0;
            return rightTime - leftTime;
          });
        setLogs(loadedLogs);
      } catch (fetchError) {
        console.error("Error fetching activity logs:", fetchError);
        setError("Unable to load activity logs.");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const metadata = JSON.stringify(log.metadata || {});
    return `${log.action} ${log.entityType} ${log.actorId || ""} ${metadata}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
  });

  return (
    <div className={tableStyles.pageWrapper}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ color: "#fff", marginBottom: "0.5rem" }}>Activity Logs</h2>
        <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
          Review important actions recorded by the web portal.
        </p>
      </div>

      <div className={tableStyles.controls} style={{ justifyContent: "flex-start" }}>
        <input
          className={tableStyles.searchBar}
          type="search"
          placeholder="Search actions or users"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className={tableStyles.tableContainer}>
        {loading ? (
          <p style={{ color: "#c19a4b" }}>Loading activity...</p>
        ) : error ? (
          <p style={{ color: "#f87171" }}>{error}</p>
        ) : filteredLogs.length === 0 ? (
          <p style={{ color: "#999" }}>No activity logs found.</p>
        ) : (
          <table className={tableStyles.adminTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.createdAt)}</td>
                  <td>{log.action || "-"}</td>
                  <td>{`${log.entityType || "-"}${log.entityId ? ` (${log.entityId})` : ""}`}</td>
                  <td>{log.actorId || "System"}</td>
                  <td>{log.source || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ActivityLogs;
