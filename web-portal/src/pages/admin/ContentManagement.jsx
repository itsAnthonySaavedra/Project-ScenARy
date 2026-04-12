import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import tableStyles from "../../components/common/Tables.module.css";
import commonStyles from "../../components/common/Common.module.css";
import Modal from "../../components/common/Modal";

const ContentManagement = () => {
  // --- STATE ---
  const [contents, setContents] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [filter, setFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");

  // Modals
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentContent, setCurrentContent] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- FETCH DATA ---
  const fetchData = async () => {
    try {
      const contentSnap = await getDocs(collection(db, "content"));
      setContents(contentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const instSnap = await getDocs(collection(db, "institutions"));
      setInstitutions(
        instSnap.docs.map((d) => ({ id: d.id, name: d.data().name })),
      );
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- HANDLERS ---
  const handleAddShell = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const type = formData.get("type");

    let contentData = {};

    try {
      // Logic adjusted to take URL strings directly
      if (type === "Information") {
        contentData = {
          description: formData.get("description"),
          imageUrl: formData.get("imageUrl") || "",
        };
      } else if (type === "Video") {
        contentData = { videoUrl: formData.get("videoUrl") };
      } else if (type === "3D Model") {
        contentData = { modelPath: formData.get("modelUrl") || "" };
      } else if (type === "Quiz") {
        contentData = {
          quizzes: [
            { id: 1, q: formData.get("q1"), a: formData.get("a1") },
            { id: 2, q: formData.get("q2"), a: formData.get("a2") },
            { id: 3, q: formData.get("q3"), a: formData.get("a3") },
          ],
        };
      }

      const newShell = {
        title: formData.get("title"),
        type: type,
        institutionId: formData.get("institutionId"),
        status: "Published",
        data: contentData,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "content"), newShell);
      await fetchData();
      setIsAddModalOpen(false);
      setSelectedType("");
      e.target.reset();
    } catch (error) {
      console.error("Save Error:", error);
      alert("Error saving content. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleView = (item) => {
    setCurrentContent(item);
    setIsViewModalOpen(true);
  };

  const filteredContents = contents
    .filter((c) => (filter === "All" ? true : c.status === "Awaiting Content"))
    .filter((c) => c.title?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ width: "100%", padding: "20px" }}>
      {/* 1. CONTROLS: Now completely outside the glass box for better spacing */}
      <div className={tableStyles.controls} style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            className={`${tableStyles.tabBtn} ${filter === "All" ? tableStyles.active : ""}`}
            onClick={() => setFilter("All")}
          >
            All Content
          </button>
          <button
            className={`${tableStyles.tabBtn} ${filter === "Pending" ? tableStyles.active : ""}`}
            onClick={() => setFilter("Pending")}
          >
            Awaiting Content
          </button>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <input
            type="text"
            className={tableStyles.searchBar}
            placeholder="Search content..."
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className={tableStyles.btnAdd}
            onClick={() => setIsAddModalOpen(true)}
          >
            <i className="fa-solid fa-plus"></i> Create Content
          </button>
        </div>
      </div>

      {/* 2. TABLE BOX: Glass container purely for the list */}
      <div className={tableStyles.tableContainer}>
        <table className={tableStyles.adminTable}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Institution</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContents.length > 0 ? (
              filteredContents.map((item) => (
                <tr key={item.id}>
                  <td style={{ color: "#fff", fontWeight: "500" }}>
                    {item.title}
                  </td>
                  <td>
                    {institutions.find((i) => i.id === item.institutionId)
                      ?.name || "Unassigned"}
                  </td>
                  <td>{item.type}</td>
                  <td>
                    <span
                      style={{
                        color:
                          item.status === "Published" ? "#4ade80" : "#fbbf24",
                        border: `1px solid ${item.status === "Published" ? "#4ade80" : "#fbbf24"}`,
                        padding: "0.2rem 0.6rem",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className={tableStyles.btnAction}
                      onClick={() => handleView(item)}
                    >
                      <i className="fa-solid fa-file-alt"></i>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "#888",
                  }}
                >
                  No content found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: CREATE CONTENT */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedType("");
        }}
        title="Add New Content"
        actions={
          <button
            className={commonStyles.btnCancel}
            onClick={() => setIsAddModalOpen(false)}
          >
            Cancel
          </button>
        }
      >
        <form
          onSubmit={handleAddShell}
          style={{ maxHeight: "75vh", overflowY: "auto", paddingRight: "10px" }}
        >
          <div className={commonStyles.formGroup}>
            <label>Title</label>
            <input name="title" className={commonStyles.formControl} required />
          </div>
          <div className={commonStyles.formGroup}>
            <label>Assign Institution</label>
            <select
              name="institutionId"
              className={commonStyles.formControl}
              required
            >
              <option value="">Select Institution</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>
          <div className={commonStyles.formGroup}>
            <label>Content Type</label>
            <select
              name="type"
              className={commonStyles.formControl}
              required
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">Select Type</option>
              <option value="Information">
                Information (Paste Image Link)
              </option>
              <option value="Quiz">Quiz (3 Questions)</option>
              <option value="Video">Video Link</option>
              <option value="3D Model">3D Model (Paste .glb Link)</option>
            </select>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              padding: "15px",
              borderRadius: "8px",
              marginTop: "10px",
            }}
          >
            {selectedType === "Information" && (
              <>
                <div className={commonStyles.formGroup}>
                  <label>Image URL</label>
                  <input
                    name="imageUrl"
                    className={commonStyles.formControl}
                    placeholder="https://..."
                  />
                </div>
                <div className={commonStyles.formGroup}>
                  <label>Description</label>
                  <textarea
                    name="description"
                    className={commonStyles.formControl}
                    rows={3}
                  />
                </div>
              </>
            )}
            {selectedType === "Video" && (
              <div className={commonStyles.formGroup}>
                <label>YouTube URL</label>
                <input
                  name="videoUrl"
                  className={commonStyles.formControl}
                  placeholder="https://youtube.com/..."
                />
              </div>
            )}
            {selectedType === "3D Model" && (
              <div className={commonStyles.formGroup}>
                <label>Model URL (.glb)</label>
                <input
                  name="modelUrl"
                  className={commonStyles.formControl}
                  placeholder="https://github.com/user/repo/raw/..."
                />
              </div>
            )}
            {selectedType === "Quiz" && (
              <>
                {[1, 2, 3].map((num) => (
                  <div
                    key={num}
                    style={{
                      marginBottom: "15px",
                      paddingBottom: "10px",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <p
                      style={{
                        color: "#C19A4B",
                        fontWeight: "600",
                        marginBottom: "5px",
                      }}
                    >
                      Question {num}
                    </p>
                    <input
                      name={`q${num}`}
                      className={commonStyles.formControl}
                      style={{ marginBottom: "10px" }}
                      placeholder="Enter Question"
                    />
                    <input
                      name={`a${num}`}
                      className={commonStyles.formControl}
                      placeholder="Enter Correct Answer"
                    />
                  </div>
                ))}
              </>
            )}
          </div>

          <button
            type="submit"
            className={commonStyles.btnUpdate}
            disabled={loading}
            style={{ width: "100%", marginTop: "1.5rem" }}
          >
            {loading ? "Saving..." : "Save Content"}
          </button>
        </form>
      </Modal>

      {/* MODAL: VIEW DETAILS */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={currentContent?.title}
        actions={
          <button
            className={commonStyles.btnCancel}
            onClick={() => setIsViewModalOpen(false)}
          >
            Close
          </button>
        }
      >
        {currentContent && (
          <div style={{ color: "#ccc" }}>
            <p style={{ marginBottom: "10px" }}>
              <strong>Type:</strong> {currentContent.type}
            </p>
            <div
              style={{
                maxHeight: "400px",
                overflow: "auto",
                background: "#0a0a0a",
                borderRadius: "4px",
              }}
            >
              <pre
                style={{
                  padding: "1rem",
                  fontSize: "0.8rem",
                  color: "#4ade80",
                }}
              >
                {JSON.stringify(currentContent.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ContentManagement;
