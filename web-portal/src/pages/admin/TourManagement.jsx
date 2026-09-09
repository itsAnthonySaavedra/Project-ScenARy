import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import tableStyles from "../../components/common/Tables.module.css";
import commonStyles from "../../components/common/Common.module.css";
import Modal from "../../components/common/Modal";

const TourManagement = () => {
  const [tours, setTours] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [contents, setContents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [institutionFilter, setInstitutionFilter] = useState("All");
  const [selectedTour, setSelectedTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const [tourSnap, institutionSnap, contentSnap] = await Promise.all([
          getDocs(collection(db, "tours")),
          getDocs(collection(db, "institutions")),
          getDocs(collection(db, "content")),
        ]);

        setTours(tourSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
        setInstitutions(
          institutionSnap.docs.map((item) => ({
            id: item.id,
            name: item.data().name || item.id,
          })),
        );
        setContents(contentSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
      } catch (fetchError) {
        console.error("Error fetching tour management data:", fetchError);
        setError("Unable to load tour data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const institutionNames = new Map(
    institutions.map((institution) => [institution.id, institution.name]),
  );
  const contentById = new Map(contents.map((content) => [content.id, content]));
  const statuses = [
    "All",
    ...new Set(tours.map((tour) => tour.status).filter(Boolean)),
  ];

  const filteredTours = tours.filter((tour) => {
    const institutionName = institutionNames.get(tour.institutionId) || "Unknown institution";
    const searchValue = `${tour.title || ""} ${institutionName}`.toLowerCase();
    const matchesSearch = searchValue.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || tour.status === statusFilter;
    const matchesInstitution =
      institutionFilter === "All" || tour.institutionId === institutionFilter;

    return matchesSearch && matchesStatus && matchesInstitution;
  });

  const getModuleTitles = (tour) =>
    (tour.moduleIds || []).map((moduleId) => contentById.get(moduleId) || { id: moduleId });

  return (
    <div className={tableStyles.pageWrapper}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ color: "#fff", marginBottom: "0.5rem" }}>Tour Management</h2>
        <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
          Review tours created by institutions and inspect their attached content.
        </p>
      </div>

      <div className={tableStyles.controls} style={{ justifyContent: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <input
          className={tableStyles.searchBar}
          type="search"
          placeholder="Search tours or institutions"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select
          className={commonStyles.formControl}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter tours by status"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status === "All" ? "All statuses" : status}
            </option>
          ))}
        </select>
        <select
          className={commonStyles.formControl}
          value={institutionFilter}
          onChange={(event) => setInstitutionFilter(event.target.value)}
          aria-label="Filter tours by institution"
        >
          <option value="All">All institutions</option>
          {institutions.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.name}
            </option>
          ))}
        </select>
      </div>

      <div className={tableStyles.tableContainer}>
        {loading ? (
          <p style={{ color: "#c19a4b" }}>Loading tours...</p>
        ) : error ? (
          <p style={{ color: "#f87171" }}>{error}</p>
        ) : filteredTours.length === 0 ? (
          <p style={{ color: "#999" }}>No tours match the current filters.</p>
        ) : (
          <table className={tableStyles.adminTable}>
            <thead>
              <tr>
                <th>Tour</th>
                <th>Institution</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Content</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTours.map((tour) => (
                <tr key={tour.id}>
                  <td>{tour.title || "Untitled tour"}</td>
                  <td>{institutionNames.get(tour.institutionId) || "Unknown institution"}</td>
                  <td>{tour.duration ? `${tour.duration} mins` : "-"}</td>
                  <td>{tour.status || "-"}</td>
                  <td>{tour.moduleIds?.length || 0} modules</td>
                  <td>
                    <button
                      type="button"
                      className={tableStyles.btnAction}
                      onClick={() => setSelectedTour(tour)}
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={Boolean(selectedTour)}
        onClose={() => setSelectedTour(null)}
        title={selectedTour?.title || "Tour details"}
      >
        {selectedTour && (
          <div style={{ color: "#ddd" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <small style={{ color: "#999" }}>Institution</small>
                <p style={{ margin: "0.25rem 0 0" }}>
                  {institutionNames.get(selectedTour.institutionId) || "Unknown institution"}
                </p>
              </div>
              <div>
                <small style={{ color: "#999" }}>Status</small>
                <p style={{ margin: "0.25rem 0 0" }}>{selectedTour.status || "-"}</p>
              </div>
              <div>
                <small style={{ color: "#999" }}>Duration</small>
                <p style={{ margin: "0.25rem 0 0" }}>
                  {selectedTour.duration ? `${selectedTour.duration} minutes` : "-"}
                </p>
              </div>
              <div>
                <small style={{ color: "#999" }}>Attached content</small>
                <p style={{ margin: "0.25rem 0 0" }}>{selectedTour.moduleIds?.length || 0} modules</p>
              </div>
            </div>

            <h4 style={{ color: "#c19a4b", marginBottom: "0.75rem" }}>Description</h4>
            <p style={{ color: "#aaa", marginTop: 0 }}>
              {selectedTour.description || "No description provided."}
            </p>

            <h4 style={{ color: "#c19a4b", marginBottom: "0.75rem" }}>Attached content</h4>
            {getModuleTitles(selectedTour).length === 0 ? (
              <p style={{ color: "#777" }}>No content has been attached.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {getModuleTitles(selectedTour).map((content) => (
                  <li key={content.id} style={{ marginBottom: "0.5rem" }}>
                    {content.title || `Missing content (${content.id})`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TourManagement;
