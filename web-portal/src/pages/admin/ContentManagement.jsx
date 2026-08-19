import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import "@google/model-viewer";
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

  // Edit Mode Tracking State Fields
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDocId, setEditDocId] = useState(null);

  // Delete State
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Controlled form values to enable pre-population during edit
  const [formTitle, setFormTitle] = useState("");
  const [formInstitutionId, setFormInstitutionId] = useState("");
  const [formInfoUrl, setFormInfoUrl] = useState("");
  const [formInfoDesc, setFormInfoDesc] = useState("");
  const [formModelUrl, setFormModelUrl] = useState("");
  const [formFactText, setFormFactText] = useState("");

  // Dynamic Quiz Questions Array State
  const [quizQuestions, setQuizQuestions] = useState([
    { question: "", answer: "True" },
  ]);

  // Modals
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentContent, setCurrentContent] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- FETCH DATA ---
  const fetchData = async () => {
    try {
      const contentSnap = await getDocs(collection(db, "content"));
      setContents(
        contentSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((item) =>
            ["Information", "3D Model", "Quiz", "Audio"].includes(item.type),
          ),
      );

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

  // --- QUIZ FIELDS MANAGEMENT ---
  const addQuizQuestionField = () => {
    setQuizQuestions([...quizQuestions, { question: "", answer: "True" }]);
  };

  const updateQuizQuestionValue = (index, field, value) => {
    const updated = [...quizQuestions];
    updated[index][field] = value;
    setQuizQuestions(updated);
  };

  const removeQuizQuestionField = (index) => {
    if (quizQuestions.length === 1) return;
    setQuizQuestions(quizQuestions.filter((_, i) => i !== index));
  };

  // --- OPEN MODAL CLEANING FUNCTION ---
  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setEditDocId(null);
    setFormTitle("");
    setFormInstitutionId("");
    setFormInfoUrl("");
    setFormInfoDesc("");
    setFormModelUrl("");
    setFormFactText("");
    setSelectedType("");
    setQuizQuestions([{ question: "", answer: "True" }]);
    setIsAddModalOpen(true);
  };

  // --- EDIT ROW POPULATION HANDLER ---
  const handleEditClick = (item) => {
    setIsEditMode(true);
    setEditDocId(item.id);
    setFormTitle(item.title || "");
    setFormInstitutionId(item.institutionId || "");
    setSelectedType(item.type || "");

    if (item.type === "Information") {
      setFormInfoUrl(item.data?.imageUrl || "");
      setFormInfoDesc(item.data?.description || "");
    } else if (item.type === "3D Model") {
      setFormModelUrl(item.data?.modelPath || "");
    } else if (item.type === "Quiz") {
      if (item.data?.quizzes && item.data.quizzes.length > 0) {
        setQuizQuestions(
          item.data.quizzes.map((q) => ({
            question: q.question || "",
            answer: q.correctAnswer || "True",
          })),
        );
      } else {
        setQuizQuestions([{ question: "", answer: "True" }]);
      }
    } else if (item.type === "Fun Fact") {
      setFormFactText(item.data?.fact || "");
    }

    setIsAddModalOpen(true);
  };

  // --- DELETE HANDLERS ---
  const handleConfirmDeleteClick = (id) => {
    setDeleteDocId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteDocId) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "content", deleteDocId));
      await fetchData();
      setIsDeleteModalOpen(false);
      setDeleteDocId(null);
    } catch (error) {
      console.error("Delete Error:", error);
      alert("Error deleting item.");
    } finally {
      setLoading(false);
    }
  };

  // --- FORM SUBMIT HANDLER ---
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let contentData = {};

    try {
      if (selectedType === "Information") {
        contentData = {
          description: formInfoDesc,
          imageUrl: formInfoUrl || "",
        };
      } else if (selectedType === "3D Model") {
        contentData = { modelPath: formModelUrl || "" };
      } else if (selectedType === "Quiz") {
        contentData = {
          quizzes: quizQuestions.map((q, index) => ({
            id: index + 1,
            question: q.question,
            correctAnswer: q.answer,
          })),
        };
      } else if (selectedType === "Fun Fact") {
        contentData = {
          fact: formFactText,
        };
      }

      if (isEditMode && editDocId) {
        const docRef = doc(db, "content", editDocId);
        await updateDoc(docRef, {
          title: formTitle,
          institutionId: formInstitutionId,
          data: contentData,
          updatedAt: serverTimestamp(),
        });
      } else {
        const newShell = {
          title: formTitle,
          type: selectedType,
          institutionId: formInstitutionId,
          status: "Published",
          data: contentData,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, "content"), newShell);
      }

      await fetchData();

      setIsAddModalOpen(false);
      setIsEditMode(false);
      setEditDocId(null);
      setFormTitle("");
      setFormInstitutionId("");
      setFormInfoUrl("");
      setFormInfoDesc("");
      setFormModelUrl("");
      setFormFactText("");
      setSelectedType("");
      setQuizQuestions([{ question: "", answer: "True" }]);
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
      {/* 1. CONTROLS */}
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
            onClick={handleOpenCreateModal}
          >
            <i className="fa-solid fa-plus"></i> Create Content
          </button>
        </div>
      </div>

      {/* 2. TABLE BOX */}
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
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className={tableStyles.btnAction}
                        onClick={() => handleView(item)}
                        title="View Content Details"
                      >
                        <i className="fa-solid fa-file-alt"></i>
                      </button>

                      <button
                        className={tableStyles.btnAction}
                        onClick={() => handleEditClick(item)}
                        title="Modify Content Node"
                        style={{
                          background: "rgba(193, 154, 75, 0.15)",
                          color: "#C19A4B",
                        }}
                      >
                        <i className="fa-solid fa-edit"></i>
                      </button>

                      <button
                        className={tableStyles.btnAction}
                        onClick={() => handleConfirmDeleteClick(item.id)}
                        title="Delete Content Node"
                        style={{
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#ef4444",
                        }}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
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

      {/* MODAL: CREATE / EDIT CONTENT */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedType("");
        }}
        title={isEditMode ? "Edit Content Component Node" : "Add New Content"}
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
          onSubmit={handleFormSubmit}
          style={{ maxHeight: "75vh", overflowY: "auto", paddingRight: "10px" }}
        >
          <div className={commonStyles.formGroup}>
            <label>Title</label>
            <input
              name="title"
              className={commonStyles.formControl}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </div>
          <div className={commonStyles.formGroup}>
            <label>Assign Institution</label>
            <select
              name="institutionId"
              className={commonStyles.formControl}
              value={formInstitutionId}
              onChange={(e) => setFormInstitutionId(e.target.value)}
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
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              disabled={isEditMode}
              style={{ opacity: isEditMode ? 0.6 : 1 }}
            >
              <option value="">Select Type</option>
              <option value="Information">
                Information (Image & Description)
              </option>
              <option value="Quiz">True / False Quiz</option>
              <option value="3D Model">3D Model (Paste .glb Link)</option>
              <option value="Fun Fact">Fun Fact</option>
            </select>
          </div>

          {selectedType && (
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                padding: "15px",
                borderRadius: "8px",
                marginTop: "10px",
              }}
            >
              {/* INFORMATION FORMAT */}
              {selectedType === "Information" && (
                <>
                  <div className={commonStyles.formGroup}>
                    <label>Image URL</label>
                    <input
                      name="imageUrl"
                      className={commonStyles.formControl}
                      placeholder="https://..."
                      value={formInfoUrl}
                      onChange={(e) => setFormInfoUrl(e.target.value)}
                    />
                  </div>
                  <div className={commonStyles.formGroup}>
                    <label>Description</label>
                    <textarea
                      name="description"
                      className={commonStyles.formControl}
                      rows={3}
                      value={formInfoDesc}
                      onChange={(e) => setFormInfoDesc(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {/* 3D MODEL LINK */}
              {selectedType === "3D Model" && (
                <div className={commonStyles.formGroup}>
                  <label>Model URL (.glb)</label>
                  <input
                    name="modelUrl"
                    className={commonStyles.formControl}
                    placeholder="https://.../model.glb"
                    value={formModelUrl}
                    onChange={(e) => setFormModelUrl(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* TRUE / FALSE QUIZ */}
              {selectedType === "Quiz" && (
                <div>
                  <h4 style={{ color: "#C19A4B", marginBottom: "1rem" }}>
                    Construct True / False Question Set
                  </h4>
                  {quizQuestions.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                        paddingBottom: "15px",
                        marginBottom: "15px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifySpace: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <label style={{ fontSize: "0.85rem", color: "#aaa" }}>
                          Question {idx + 1}
                        </label>
                        {quizQuestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuizQuestionField(idx)}
                            style={{
                              background: "transparent",
                              color: "#ef4444",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        className={commonStyles.formControl}
                        style={{ marginTop: "5px", marginBottom: "8px" }}
                        placeholder="Enter statement..."
                        value={item.question}
                        onChange={(e) =>
                          updateQuizQuestionValue(
                            idx,
                            "question",
                            e.target.value,
                          )
                        }
                        required
                      />
                      <label
                        style={{ fontSize: "0.8rem", marginRight: "10px" }}
                      >
                        Correct Answer:
                      </label>
                      <select
                        value={item.answer}
                        onChange={(e) =>
                          updateQuizQuestionValue(idx, "answer", e.target.value)
                        }
                        style={{
                          padding: "4px 8px",
                          background: "#1a1a1a",
                          border: "1px solid #333",
                          color: "#fff",
                          borderRadius: "4px",
                        }}
                      >
                        <option value="True">True</option>
                        <option value="False">False</option>
                      </select>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addQuizQuestionField}
                    style={{
                      padding: "6px 12px",
                      background: "rgba(193, 154, 75, 0.2)",
                      border: "1px solid #C19A4B",
                      color: "#C19A4B",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    + Add Question
                  </button>
                </div>
              )}

              {/* FUN FACT STRUCTURE */}
              {selectedType === "Fun Fact" && (
                <div className={commonStyles.formGroup}>
                  <label>Fun Fact Text</label>
                  <textarea
                    name="factText"
                    className={commonStyles.formControl}
                    rows={3}
                    placeholder="Enter an interesting fact..."
                    value={formFactText}
                    onChange={(e) => setFormFactText(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className={commonStyles.btnUpdate}
            disabled={loading || !selectedType}
            style={{ width: "100%", marginTop: "1.5rem" }}
          >
            {loading
              ? "Processing..."
              : isEditMode
                ? "Apply Inplace Changes"
                : "Save Content"}
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

            {/* PREVIEW 3D MODEL IF APPLICABLE */}
            {currentContent.type === "3D Model" && currentContent.data?.modelPath && (
              <div style={{ width: "100%", height: "300px", marginBottom: "15px" }}>
                <model-viewer
                  src={currentContent.data.modelPath}
                  alt={currentContent.title}
                  auto-rotate
                  camera-controls
                  style={{ width: "100%", height: "100%", backgroundColor: "#111" }}
                ></model-viewer>
              </div>
            )}

            <div
              style={{
                maxHeight: "300px",
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

      {/* MODAL: DELETE CONFIRMATION */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Delete"
        actions={
          <>
            <button
              className={commonStyles.btnCancel}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{
                padding: "0.5rem 1rem",
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {loading ? "Deleting..." : "Delete Node"}
            </button>
          </>
        }
      >
        <p style={{ color: "#ccc" }}>
          Are you sure you want to delete this content item? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default ContentManagement;