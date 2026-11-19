import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";
import { normalizeContentType } from "../../lib/contentTypes";
import ContentPreview from "../../components/common/ContentPreview";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import commonStyles from "../../components/common/Common.module.css";
import tableStyles from "../../components/common/Tables.module.css";

const AdminContentView = () => {
  const [items, setItems] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [search, setSearch] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [previewItem, setPreviewItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contentError, setContentError] = useState("");
  const [institutionError, setInstitutionError] = useState("");

  useEffect(() => {
    const unsubscribeContent = onSnapshot(
      collection(db, "content"),
      (snapshot) => {
        setItems(snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
          type: normalizeContentType(item.data().type),
        })));
        setLoading(false);
        setContentError("");
      },
      (snapshotError) => {
        console.error("Unable to load read-only content view:", snapshotError);
        setContentError(getFirebaseErrorMessage(snapshotError, "Unable to load content. Please try again."));
        setLoading(false);
      },
    );
    const unsubscribeInstitutions = onSnapshot(
      collection(db, "institutions"),
      (snapshot) => {
        setInstitutions(snapshot.docs
          .map((item) => ({ id: item.id, name: item.data().name || item.id }))
          .sort((left, right) => left.name.localeCompare(right.name)));
        setInstitutionError("");
      },
      (snapshotError) => {
        console.error("Unable to load institutions for content filtering:", snapshotError);
        setInstitutionError(getFirebaseErrorMessage(snapshotError, "Unable to load institution filters."));
      },
    );

    return () => {
      unsubscribeContent();
      unsubscribeInstitutions();
    };
  }, []);

  const institutionNames = useMemo(
    () => new Map(institutions.map((institution) => [institution.id, institution.name])),
    [institutions],
  );
  const statuses = useMemo(
    () => [
      "All",
      ...new Set(items.map((item) => item.status).filter(Boolean).sort((a, b) => a.localeCompare(b))),
    ],
    [items],
  );
  const filteredItems = useMemo(() => items.filter((item) => {
    const institutionName = institutionNames.get(item.institutionId) || "Unassigned";
    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    const matchesInstitution = institutionFilter === "All" || item.institutionId === institutionFilter;
    const searchValue = [
      item.title,
      item.type,
      item.targetName,
      item.scope,
      institutionName,
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && matchesInstitution && searchValue.includes(search.toLowerCase());
  }), [institutionFilter, institutionNames, items, search, statusFilter]);
  const error = contentError || institutionError;

  return (
    <div className={tableStyles.pageWrapper}>
      <PageHeader
        eyebrow="Administration"
        title="View Content"
        description="Browse content across institutions. This view is read-only; Curators handle review and publication."
      />
      {error && <div role="alert" style={{ color: "#fca5a5", marginBottom: "1rem" }}>{error}</div>}
      <div className={tableStyles.tableContainer}>
        <div className={tableStyles.controls} style={{ justifyContent: "flex-start" }}>
          <input
            type="search"
            className={tableStyles.searchBar}
            aria-label="Search content"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, type, or landmark"
          />
          <select
            className={commonStyles.formControl}
            aria-label="Filter content by institution"
            value={institutionFilter}
            onChange={(event) => setInstitutionFilter(event.target.value)}
            style={{ width: "auto", minWidth: 220 }}
          >
            <option value="All">All institutions</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>{institution.name}</option>
            ))}
          </select>
          <select
            className={commonStyles.formControl}
            aria-label="Filter content by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{ width: "auto", minWidth: 220 }}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status === "All" ? "All statuses" : status}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p role="status" style={{ color: "#aaa", padding: "1rem" }}>Loading content...</p>
        ) : filteredItems.length === 0 ? (
          <p style={{ color: "#999", padding: "1rem" }}>No content matches these filters.</p>
        ) : (
          <table className={tableStyles.adminTable}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Institution</th>
                <th>Landmark / Area</th>
                <th>Status</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ color: "#fff", fontWeight: 500 }}>{item.title || "Untitled"}</td>
                  <td>{item.type || "Unknown"}</td>
                  <td>{institutionNames.get(item.institutionId) || "Unassigned"}</td>
                  <td>{item.targetName || item.scope || item.contentScope || "—"}</td>
                  <td>{item.status || "Draft"}</td>
                  <td>
                    <button
                      type="button"
                      className={tableStyles.btnAction}
                      onClick={() => setPreviewItem(item)}
                      aria-label={`Preview ${item.title || "content"}`}
                    >
                      Preview
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        title={previewItem?.title || "Content preview"}
        size="wide"
      >
        {previewItem && <ContentPreview content={previewItem} />}
      </Modal>
    </div>
  );
};

export default AdminContentView;
