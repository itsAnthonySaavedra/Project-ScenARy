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
  const [usersById, setUsersById] = useState({});
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const [snapshot, usersSnapshot, institutionsSnapshot] = await Promise.all([
          getDocs(collection(db, "auditLogs")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "institutions")),
        ]);
        const loadedLogs = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort((left, right) => {
            const leftTime = left.createdAt?.toMillis?.() || 0;
            const rightTime = right.createdAt?.toMillis?.() || 0;
            return rightTime - leftTime;
          });
        setLogs(loadedLogs);
        setUsersById(Object.fromEntries(usersSnapshot.docs.map((item) => {
          const profile = item.data();
          return [item.id, profile.username || profile.name || profile.displayName || profile.email?.split("@")[0] || "Unknown user"];
        })));
        setInstitutions(institutionsSnapshot.docs.map((item) => ({ id: item.id, name: item.data().name || "Unnamed institution" })));
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
    const institutionId = log.institutionId || log.metadata?.institutionId || (log.entityType === "institution" ? log.entityId : "");
    const institutionMatches = selectedInstitutionId === "all" || institutionId === selectedInstitutionId;
    return institutionMatches && `${log.action} ${log.entityType} ${log.actorName || usersById[log.actorId] || ""} ${log.actorId || ""} ${metadata}`
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

      <div className={tableStyles.controls} style={{ justifyContent: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
        <input
          className={tableStyles.searchBar}
          type="search"
          placeholder="Search actions or users"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select value={selectedInstitutionId} onChange={(event) => setSelectedInstitutionId(event.target.value)} aria-label="Filter activity by institution" style={{ minWidth: "240px", padding: "0.8rem", background: "#0a0a0a", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}>
          <option value="all">All institutions</option>
          {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
        </select>
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
                  <td>{log.entityType === "user" ? usersById[log.entityId] || "User" : log.entityType === "institution" ? institutions.find((item) => item.id === log.entityId)?.name || "Institution" : log.entityType || "-"}</td>
                  <td>{log.actorName || usersById[log.actorId] || (log.actorId ? "Unknown user" : "System")}</td>
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
