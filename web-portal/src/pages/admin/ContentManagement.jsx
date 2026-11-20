import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import "@google/model-viewer";
import { db } from "../../lib/firebase";
import { deleteStorageFile, inspectGlbTextures, MAX_GLB_FILE_SIZE_BYTES, uploadStorageFile } from "../../lib/storageUpload";
import { useAuth } from "../../context/AuthContext";
import { writeAuditLog } from "../../lib/auditLog";
import tableStyles from "../../components/common/Tables.module.css";
import commonStyles from "../../components/common/Common.module.css";
import Modal from "../../components/common/Modal";
import TourPackageUpload from "../../components/common/TourPackageUpload";
import ContentPreview from "../../components/common/ContentPreview";
import ModelSpawnPointEditor from "../../components/common/ModelSpawnPointEditor";
import QuizEditor from "../../components/common/QuizEditor";
import FunFactsEditor from "../../components/common/FunFactsEditor";
import { CONTENT_SCOPES, getContentScope } from "../../lib/contentScope";
import {
  CONTENT_TYPES,
  MODEL_CONTENT_TYPE,
  normalizeContentType,
} from "../../lib/contentTypes";
import { buildModelEditPatch, createDefaultQuizQuestion, normalizeFunFacts, normalizeQuizQuestions } from "../../lib/contentData";
import {
  getContentQualityIssues,
  hasPublishedInstitutionARContent,
  isContentReady,
} from "../../lib/contentQuality";
import { createDefaultModelSpawnPoint, normalizeModelSpawnPoint, serializeModelSpawnPoint } from "../../lib/modelSpawnPoint";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage.js";
import { editTourMetadata, isTourPackage, publishTourDraft } from "../../lib/tourPackageStore.js";

const ContentManagement = () => {
  const { currentUser, currentRole } = useAuth();
  const isAdmin = ["admin", "superadmin"].includes(currentRole || "");

  // --- STATE ---
  const [contents, setContents] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get("filter") || "All";
  const setFilter = (value) => setSearchParams(value === "All" ? {} : { filter: value }, { replace: true });
  const [scopeFilter, setScopeFilter] = useState("All");
  const [institutionFilter, setInstitutionFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [formScope, setFormScope] = useState("");

  // Edit Mode Tracking State Fields
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDocId, setEditDocId] = useState(null);

  // Delete State
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Controlled form values to enable pre-population during edit
  const [formTitle, setFormTitle] = useState("");
  const [formInstitutionId, setFormInstitutionId] = useState("");
  const [formStatus, setFormStatus] = useState("Awaiting Content");
  const [formInfoDesc, setFormInfoDesc] = useState("");
  const [formModelUrl, setFormModelUrl] = useState("");
  const [formModelSpawnPoint, setFormModelSpawnPoint] = useState(createDefaultModelSpawnPoint);
  const [modelSpawnPointEnabled, setModelSpawnPointEnabled] = useState(false);
  const [modelFile, setModelFile] = useState(null);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [modelUploadProgress, setModelUploadProgress] = useState(0);
  const [formFacts, setFormFacts] = useState([""]);

  // Dynamic Quiz Questions Array State
  const [quizQuestions, setQuizQuestions] = useState([createDefaultQuizQuestion()]);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);

  // Modals
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentContent, setCurrentContent] = useState(null);
  const [usageByContent, setUsageByContent] = useState({});
  const [dataLoadError, setDataLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [approvingContentId, setApprovingContentId] = useState("");
  const [deactivatingContentId, setDeactivatingContentId] = useState("");
  const [isTourUploadOpen, setIsTourUploadOpen] = useState(false);
  const [tourUploadNotice, setTourUploadNotice] = useState("");

  useEffect(() => {
    let markers = [];
    let pois = [];
    let tours = [];
    const updateUsage = () => {
      const usage = {};
      const addUsage = (contentIds, source) => (contentIds || []).forEach((contentId) => {
        usage[contentId] = usage[contentId] || { landmarks: 0, pois: 0, tours: 0 };
        usage[contentId][source] += 1;
      });
      markers.forEach((item) => addUsage(item.data().contentIds, "landmarks"));
      pois.forEach((item) => addUsage(item.data().contentIds, "pois"));
      tours.forEach((item) => addUsage(item.data().moduleIds, "tours"));
      setUsageByContent(usage);
    };
    const handleSnapshotError = (error) => {
      console.error("Unable to receive content management updates:", error);
      setDataLoadError("Unable to load the latest content data. Please try again later.");
    };

    const unsubscribers = [
      onSnapshot(collection(db, "content"), (snapshot) => {
        setContents(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data(), type: normalizeContentType(item.data().type) }))
            .filter((item) => CONTENT_TYPES.includes(item.type)),
        );
      }, handleSnapshotError),
      onSnapshot(collection(db, "institutions"), (snapshot) => {
        setInstitutions(snapshot.docs.map((item) => ({ id: item.id, name: item.data().name })));
      }, handleSnapshotError),
      onSnapshot(collection(db, "landmarks"), (snapshot) => {
        markers = snapshot.docs;
        updateUsage();
      }, handleSnapshotError),
      onSnapshot(collection(db, "pois"), (snapshot) => {
        pois = snapshot.docs;
        updateUsage();
      }, handleSnapshotError),
      onSnapshot(collection(db, "tours"), (snapshot) => {
        tours = snapshot.docs;
        updateUsage();
      }, handleSnapshotError),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const handleTourUploaded = (item) => {
    setIsTourUploadOpen(false);
    setTourUploadNotice("Tour uploaded. It’s ready for the institution to preview and approve.");
    setFilter("Awaiting Content");
    setScopeFilter("All");
    setInstitutionFilter("All");
    setSearchTerm("");
    void writeAuditLog({
      actorId: currentUser?.uid, actorRole: currentRole, action: "content.tour-zip-uploaded",
      entityType: "content", entityId: item.id,
      metadata: { institutionId: item.institutionId, landmarkId: item.landmarkId, fileName: item.fileName },
    });
  };

  // --- OPEN MODAL CLEANING FUNCTION ---
  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setEditDocId(null);
    setFormTitle("");
    setFormInstitutionId("");
    setFormStatus("Awaiting Content");
    setFormScope("");
    setFormInfoDesc("");
    setFormModelUrl("");
    setFormModelSpawnPoint(createDefaultModelSpawnPoint());
    setModelSpawnPointEnabled(false);
    setModelFile(null);
    setFormFacts([""]);
    setSelectedType("");
    setQuizQuestions([createDefaultQuizQuestion()]);
    setShuffleQuestions(false);
    setShuffleAnswers(false);
    setIsAddModalOpen(true);
  };

  // --- EDIT ROW POPULATION HANDLER ---
  const handleEditClick = (item) => {
    setIsEditMode(true);
    setEditDocId(item.id);
    setFormTitle(item.title || "");
    setFormInstitutionId(item.institutionId || "");
    setFormStatus(item.status || "Awaiting Content");
    setFormScope(item.scope || item.contentScope || "");
    setSelectedType(normalizeContentType(item.type || ""));

    if (item.type === "Information") {
      setFormInfoDesc(item.data?.description || "");
    } else if (normalizeContentType(item.type) === MODEL_CONTENT_TYPE) {
      setFormModelUrl(item.data?.modelUrl || item.data?.modelPath || "");
      setFormModelSpawnPoint(normalizeModelSpawnPoint(item.data));
      setModelSpawnPointEnabled(item.data?.spawnX !== undefined || item.data?.SpawnZ !== undefined || Boolean(item.data?.spawnPoint));
      setModelFile(null);
    } else if (item.type === "Quiz") {
      if (item.data?.quizzes && item.data.quizzes.length > 0) {
        setQuizQuestions(normalizeQuizQuestions(item.data.quizzes));
        setShuffleQuestions(item.data.shuffleQuestions === true);
        setShuffleAnswers(item.data.shuffleAnswers === true);
      } else {
        setQuizQuestions([createDefaultQuizQuestion()]);
      }
    } else if (item.type === "Fun Fact") {
      setFormFacts(normalizeFunFacts(item.data));
    }

    setIsAddModalOpen(true);
  };

  // --- ADMIN DEACTIVATE / REACTIVATE CONTENT (ADMIN ONLY) ---
  const handleToggleDeactivateContent = async (item) => {
    if (!isAdmin) {
      setApprovalError("Only an administrator can deactivate or reactivate content.");
      return;
    }
    const isDeactivated = item.status === "Deactivated";
    const nextStatus = isDeactivated ? "Awaiting Content" : "Deactivated";
    setDeactivatingContentId(item.id);
    setApprovalError("");
    try {
      await updateDoc(doc(db, "content", item.id), {
        status: nextStatus,
        deactivated: !isDeactivated,
        deactivatedAt: isDeactivated ? null : serverTimestamp(),
        deactivatedBy: isDeactivated ? null : currentUser?.uid || null,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actorId: currentUser?.uid,
        actorRole: currentRole,
        action: isDeactivated ? "content.reactivated" : "content.deactivated",
        entityType: "content",
        entityId: item.id,
        metadata: { institutionId: item.institutionId || null, title: item.title, status: nextStatus },
      });
    } catch (error) {
      console.error("Unable to change content deactivation status:", error);
      setApprovalError(getFirebaseErrorMessage(error, "Unable to update content status."));
    } finally {
      setDeactivatingContentId("");
    }
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
      const contentToDelete = contents.find((item) => item.id === deleteDocId);
      const storagePath = contentToDelete?.data?.modelStoragePath;
      if (isTourPackage(contentToDelete)) {
        await deleteDoc(doc(db, "content", deleteDocId));
        try { await deleteStorageFile(storagePath); }
        catch (error) { console.warn("Tour record deleted, but model cleanup failed:", error); }
      } else {
        if (storagePath) {
          await deleteStorageFile(storagePath);
        }
        await deleteDoc(doc(db, "content", deleteDocId));
      }
      await writeAuditLog({ actorId: currentUser?.uid, actorRole: currentRole, action: "content.deleted", entityType: "content", entityId: deleteDocId });
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
    const editedContent = contents.find((item) => item.id === editDocId);
    const isModelContent = normalizeContentType(selectedType) === MODEL_CONTENT_TYPE;
    const institutionContents = contents.filter(
      (item) => item.institutionId === formInstitutionId,
    );
    const institutionChanged =
      isEditMode && editedContent?.institutionId !== formInstitutionId;
    const institutionApproved =
      !institutionChanged &&
      (editedContent?.institutionApproved === true ||
        editedContent?.status === "Published");
    if (formStatus === "Deactivated" && !isAdmin) {
      alert("Only an administrator can deactivate content.");
      return;
    }
    if (isTourPackage(editedContent) && (institutionChanged || formScope !== "Landmark" ||
      formModelUrl.trim() !== editedContent.data.modelUrl || modelFile ||
      (formStatus !== editedContent.status && !["Rejected", "Archived", "Deactivated"].includes(formStatus)))) {
      alert("Use Upload interactive tour to replace the model and Approve & publish to publish a reviewed ZIP.");
      return;
    }
    if (isModelContent && formStatus === "Published" && !institutionApproved) {
      alert("The institution must approve this VR model before an admin can publish it.");
      return;
    }
    if (
      isModelContent &&
      formStatus === "Awaiting Admin Approval" &&
      !institutionApproved
    ) {
      alert("The institution must approve this VR model before it can enter admin review.");
      return;
    }
    if (
      isModelContent &&
      formStatus === "Published" &&
      !hasPublishedInstitutionARContent(institutionContents)
    ) {
      alert("The institution must have complete, published AR content before this VR model can be published.");
      return;
    }
    setLoading(true);

    let contentData = {};

    try {
      if (selectedType === "Information") {
        contentData = {
          description: formInfoDesc,
        };
      } else if (selectedType === MODEL_CONTENT_TYPE) {
        contentData = {
          modelUrl: formModelUrl.trim(),
          ...(modelSpawnPointEnabled ? serializeModelSpawnPoint(formModelSpawnPoint) : {}),
          ...(modelFile ? { modelFileName: modelFile.fileName, modelFileType: modelFile.fileType, modelStoragePath: modelFile.storagePath } : {}),
        };
      } else if (selectedType === "Quiz") {
        contentData = {
          quizzes: quizQuestions.map((question, index) => ({
            id: index + 1,
            question: question.question,
            questionType: question.questionType || "true-false",
            ...(question.questionType === "multiple-choice"
              ? { options: question.options }
              : {}),
            correctAnswer: question.correctAnswer,
          })),
          shuffleQuestions,
          shuffleAnswers,
        };
      } else if (selectedType === "Fun Fact") {
        contentData = {
          facts: formFacts,
          fact: formFacts[0] || "",
        };
      }

      const qualityIssues = getContentQualityIssues({
        title: formTitle,
        type: selectedType,
        scope: formScope,
        data: contentData,
      });
      if (qualityIssues.length) {
        alert(qualityIssues.join(" | "));
        return;
      }

      if (isEditMode && editDocId) {
        const docRef = doc(db, "content", editDocId);
        const retainModelMetadata = isModelContent && !institutionChanged &&
          normalizeContentType(editedContent?.type) === MODEL_CONTENT_TYPE;
        if (isTourPackage(editedContent)) {
          await editTourMetadata(editedContent, formTitle, contentData, formStatus);
        } else await updateDoc(docRef, {
          title: formTitle,
          scope: formScope,
          institutionId: formInstitutionId.trim(),
          status:
            isModelContent && institutionChanged
              ? "Awaiting Content"
              : formStatus,
          deactivated: formStatus === "Deactivated",
          ...(retainModelMetadata
            ? buildModelEditPatch(contentData, editedContent.data ?? {}, deleteField())
            : { data: contentData }),
          ...(isModelContent && institutionChanged
            ? {
                institutionApproved: false,
                institutionApprovedAt: null,
                institutionApprovedBy: null,
              }
            : {}),
          ...(isModelContent
            ? {
                adminApproved: formStatus === "Published",
                adminApprovedAt:
                  formStatus === "Published" ? serverTimestamp() : null,
                adminApprovedBy:
                  formStatus === "Published" ? currentUser?.uid || null : null,
              }
            : {}),
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog({ actorId: currentUser?.uid, actorRole: currentRole, action: "content.updated", entityType: "content", entityId: editDocId, metadata: { title: formTitle, type: selectedType, institutionId: formInstitutionId, status: formStatus } });
      } else {
        const newShell = {
          title: formTitle,
          type: selectedType,
          scope: formScope,
          institutionId: formInstitutionId.trim(),
          status: formStatus,
          deactivated: formStatus === "Deactivated",
          ...(isModelContent
            ? {
                institutionApproved: false,
                adminApproved: false,
              }
            : {}),
          data: contentData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const createdContent = await addDoc(collection(db, "content"), newShell);
        await writeAuditLog({ actorId: currentUser?.uid, actorRole: currentRole, action: "content.created", entityType: "content", entityId: createdContent.id, metadata: { title: formTitle, type: selectedType, institutionId: formInstitutionId, status: formStatus } });
      }

      setIsAddModalOpen(false);
      setIsEditMode(false);
      setEditDocId(null);
      setFormTitle("");
      setFormInstitutionId("");
      setFormStatus("Awaiting Content");
      setFormScope("");
      setFormInfoDesc("");
      setFormModelUrl("");
      setFormModelSpawnPoint(createDefaultModelSpawnPoint());
      setModelSpawnPointEnabled(false);
      setModelFile(null);
      setFormFacts([""]);
      setSelectedType("");
      setQuizQuestions([createDefaultQuizQuestion()]);
      setShuffleQuestions(false);
      setShuffleAnswers(false);
    } catch (error) {
      console.error("Save Error:", error);
      alert(getFirebaseErrorMessage(error, isTourPackage(editedContent) ? error.message : "Error saving content. Check console."));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminApproveModel = async (item) => {
    if (normalizeContentType(item.type) !== MODEL_CONTENT_TYPE) return;
    if (item.institutionApproved !== true) {
      setApprovalError("The institution must approve this model before admin approval.");
      return;
    }
    const institutionContents = contents.filter(
      (content) => content.institutionId === item.institutionId,
    );
    if (!hasPublishedInstitutionARContent(institutionContents)) {
      setApprovalError(
        "Complete, published AR content is required before this model can be approved.",
      );
      return;
    }
    if (!isContentReady(item)) {
      setApprovalError("Complete the model details before approving it.");
      return;
    }

    setApprovalError("");
    setApprovingContentId(item.id);
    try {
      if (isTourPackage(item)) {
        await publishTourDraft(item, currentUser?.uid || null);
      } else await updateDoc(doc(db, "content", item.id), {
        adminApproved: true,
        adminApprovedAt: serverTimestamp(),
        adminApprovedBy: currentUser?.uid || null,
        status: "Published",
        deactivated: false,
        updatedAt: serverTimestamp(),
      });
      try {
        await writeAuditLog({
          actorId: currentUser?.uid,
          actorRole: currentRole,
          action: "content.admin-approved",
          entityType: "content",
          entityId: item.id,
          metadata: { institutionId: item.institutionId, title: item.title },
          throwOnFailure: true,
        });
      } catch (auditError) {
        console.error("Model was published, but its audit record could not be written:", auditError);
        setApprovalError("The model was published, but its activity record could not be written.");
      }
    } catch (error) {
      console.error("Unable to publish the VR model:", error);
      setApprovalError(getFirebaseErrorMessage(error, isTourPackage(item) ? error.message : "Unable to publish the VR model. Please try again."));
    } finally {
      setApprovingContentId("");
    }
  };

  const handleView = (item) => {
    setCurrentContent(item);
    setIsViewModalOpen(true);
  };

  const editedContent = contents.find((item) => item.id === editDocId);
  const editingTourPackage = isTourPackage(editedContent);
  const filteredContents = contents
    .filter((c) => filter === "All" || (filter === "Needs attention" ? !isContentReady(c) : c.status === filter))
    .filter((c) => scopeFilter === "All" || getContentScope(c) === scopeFilter)
    .filter((c) => institutionFilter === "All" || (institutionFilter === "Unassigned" ? !c.institutionId : c.institutionId === institutionFilter))
    .filter((c) => c.title?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ width: "100%", padding: "20px" }}>
      {dataLoadError && <p role="alert" style={{ color: "#f87171" }}>{dataLoadError}</p>}
      {approvalError && <p role="alert" style={{ color: "#f87171" }}>{approvalError}</p>}
      {tourUploadNotice && <p role="status">{tourUploadNotice}</p>}

      {/* 1. CONTROLS */}
      <div className={tableStyles.controls} style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {["All", "Awaiting Content", "Awaiting Admin Approval", "Published", "Rejected", "Deactivated", "Needs attention"].map((tabStatus) => (
            <button
              key={tabStatus}
              className={`${tableStyles.tabBtn} ${filter === tabStatus ? tableStyles.active : ""}`}
              onClick={() => setFilter(tabStatus)}
            >
              {tabStatus === "All" ? "All Content" : tabStatus}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <select
            className={commonStyles.formControl}
            aria-label="Filter content by area"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
          >
            <option value="All">All Areas</option>
            {CONTENT_SCOPES.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
          </select>
          <select
            className={commonStyles.formControl}
            aria-label="Filter content by institution"
            value={institutionFilter}
            onChange={(e) => setInstitutionFilter(e.target.value)}
          >
            <option value="All">All Institutions</option>
            <option value="Unassigned">Unassigned</option>
            {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
          </select>
          <input
            type="text"
            className={tableStyles.searchBar}
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className={tableStyles.btnAdd}
            type="button"
            onClick={() => { setTourUploadNotice(""); setIsTourUploadOpen(true); }}
          >
            Upload interactive tour
          </button>
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
              <th>Area</th>
              <th>Usage</th>
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
                    {item.institutionId ? (
                      <span style={{ color: "#4ade80" }}>
                        <i className="fa-solid fa-link" style={{ marginRight: "0.4rem" }} />
                        {institutions.find((i) => i.id === item.institutionId)?.name || "Linked institution"}
                      </span>
                    ) : (
                      <span style={{ color: "#fbbf24" }}>
                        <i className="fa-solid fa-link-slash" style={{ marginRight: "0.4rem" }} />
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td>{item.type}</td>
                  <td>{item.scope || item.contentScope || "Unclassified"}</td>
                  <td>
                    {(() => {
                      const usage = usageByContent[item.id] || { landmarks: 0, pois: 0, tours: 0 };
                      const total = usage.landmarks + usage.pois + usage.tours;
                      const linked = total > 0;
                      return <span style={{ color: linked ? "#4ade80" : "#fbbf24" }} title={linked ? `${usage.landmarks} landmarks, ${usage.pois} POIs, ${usage.tours} tours` : "Not assigned to a landmark, POI, or tour"}>
                        <i className={`fa-solid ${linked ? "fa-link" : "fa-link-slash"}`} style={{ marginRight: "0.4rem" }} />
                        {linked ? `${total} linked` : "Unused"}
                      </span>;
                    })()}
                  </td>
                  <td>
                    <span
                      style={{
                        color:
                          item.status === "Published"
                            ? "#4ade80"
                            : item.status === "Rejected" || item.status === "Deactivated"
                              ? "#f87171"
                              : "#fbbf24",
                        border: `1px solid ${
                          item.status === "Published"
                            ? "#4ade80"
                            : item.status === "Rejected" || item.status === "Deactivated"
                              ? "#f87171"
                              : "#fbbf24"
                        }`,
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
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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

                      {isAdmin && (
                        <button
                          type="button"
                          className={tableStyles.btnAction}
                          disabled={deactivatingContentId === item.id}
                          onClick={() => handleToggleDeactivateContent(item)}
                          title={item.status === "Deactivated" ? "Reactivate Content" : "Deactivate Content"}
                          style={{
                            background: "rgba(251, 191, 36, 0.15)",
                            color: item.status === "Deactivated" ? "#4ade80" : "#fbbf24",
                          }}
                        >
                          <i className={`fa-solid ${item.status === "Deactivated" ? "fa-rotate-left" : "fa-ban"}`}></i>
                        </button>
                      )}

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

                      {normalizeContentType(item.type) === MODEL_CONTENT_TYPE &&
                        item.status !== "Published" &&
                        item.status !== "Deactivated" &&
                        (!isTourPackage(item) || item.status === "Awaiting Admin Approval" || item.status === "Awaiting Content") && (
                          <button
                            type="button"
                            className={commonStyles.btnPrimary}
                            onClick={() => handleAdminApproveModel(item)}
                            disabled={
                              approvingContentId === item.id ||
                              item.institutionApproved !== true ||
                              !hasPublishedInstitutionARContent(
                                contents.filter(
                                  (content) =>
                                    content.institutionId === item.institutionId,
                                ),
                              ) ||
                              !isContentReady(item)
                            }
                            title={
                              item.institutionApproved !== true
                                ? "Waiting for institution approval"
                                : !hasPublishedInstitutionARContent(
                                      contents.filter(
                                        (content) =>
                                          content.institutionId === item.institutionId,
                                      ),
                                    )
                                  ? "Complete and publish AR content first"
                                  : !isContentReady(item)
                                    ? "Complete the model details before approval"
                                    : "Approve and publish this model"
                            }
                          >
                            {approvingContentId === item.id
                              ? "Publishing..."
                              : "Approve & publish"}
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
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

      {isTourUploadOpen && (
        <TourPackageUpload institutions={institutions} onClose={() => setIsTourUploadOpen(false)} onSaved={handleTourUploaded} />
      )}

      {/* MODAL: CREATE / EDIT CONTENT */}
      <Modal
        isOpen={isAddModalOpen}
        size="wide"
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedType("");
        }}
        title={isEditMode ? "Edit Content" : "Add New Content"}
        actions={
          <button
            className={commonStyles.btnCancel}
            onClick={() => setIsAddModalOpen(false)}
          >
            Cancel
          </button>
        }
      >
        <form onSubmit={handleFormSubmit}>
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
              disabled={editingTourPackage}
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
              {CONTENT_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type === "Information"
                    ? "Information (Description)"
                    : type === "Quiz"
                      ? "Quiz (true/false or multiple choice)"
                      : type === MODEL_CONTENT_TYPE
                        ? "VR Model (.glb)"
                        : type}
                </option>
              ))}
            </select>
            <small style={{ display: "block", color: "#888", marginTop: 6 }}>
              Reusable content can be assigned to multiple targets. Assignment limits are enforced per Landmark or POI.
            </small>
          </div>
          <div className={commonStyles.formGroup}>
            <label>Content Area</label>
            <select
              className={commonStyles.formControl}
              value={formScope}
              onChange={(e) => setFormScope(e.target.value)}
              disabled={editingTourPackage}
              required
            >
              <option value="">Select Content Area</option>
              {CONTENT_SCOPES.map((scope) => (
                <option key={scope} value={scope}>{scope}</option>
              ))}
            </select>
          </div>

          <div className={commonStyles.formGroup}>
            <label>Review Status</label>
            <select
              name="status"
              className={commonStyles.formControl}
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
            >
              <option value="Awaiting Content" disabled={editingTourPackage && editedContent.status !== "Awaiting Content"}>Awaiting Content</option>
              <option value="Awaiting Admin Approval" disabled={editingTourPackage && editedContent.status !== "Awaiting Admin Approval"}>Awaiting Admin Approval</option>
              <option
                value="Published"
                disabled={
                  (editingTourPackage && editedContent.status !== "Published") ||
                  (normalizeContentType(selectedType) === MODEL_CONTENT_TYPE &&
                  !(
                    editedContent?.institutionApproved === true ||
                    editedContent?.status === "Published"
                  ))
                }
              >
                Published
              </option>
              <option value="Rejected">Rejected</option>
              <option value="Archived">Archived</option>
              <option value="Deactivated" disabled={!isAdmin}>Deactivated</option>
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
              {selectedType === "Information" && (
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
              )}

              {selectedType === MODEL_CONTENT_TYPE && (
                <div className={commonStyles.formGroup}>
                  {editingTourPackage ? <p>{editedContent.data.exhibits?.length || 0} trigger links · Upload a new ZIP to replace this tour.</p> : <>
                  <label>Upload VR Model (.glb)</label>
                  <input
                    type="file"
                    accept=".glb,model/gltf-binary,application/octet-stream"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > MAX_GLB_FILE_SIZE_BYTES) {
                        alert("VR models must be 1 GB or smaller.");
                        e.target.value = "";
                        return;
                      }
                      setUploadingModel(true);
                      setModelUploadProgress(0);
                      try {
                        const textureInfo = await inspectGlbTextures(file);
                        if (textureInfo.externalImageUris.length > 0) {
                          throw new Error("This GLB references external texture files. Export it with textures embedded, then try again.");
                        }
                        const uploaded = await uploadStorageFile(file, `content-models/${formInstitutionId || "unassigned"}`, setModelUploadProgress);
                        setModelFile(uploaded);
                        setFormModelUrl(uploaded.url);
                      } catch (error) {
                        console.error("Model upload error:", error);
                        alert(error.message || "Unable to upload the VR model. Check Firebase Storage permissions.");
                      } finally {
                        setUploadingModel(false);
                      }
                    }}
                    style={{ color: "#ccc", marginBottom: "0.75rem" }}
                  />
                  <small style={{ display: "block", color: "#888", marginBottom: "0.75rem" }}>Upload a GLB file, maximum 1 GB. GLB keeps the model, geometry, and textures together.</small>
                  {modelFile && <small style={{ display: "block", color: "#4ade80", marginBottom: "0.75rem" }}>Uploaded: {modelFile.fileName}</small>}
                  {uploadingModel && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <small style={{ display: "block", color: "#fbbf24" }}>Uploading model... {Math.floor(modelUploadProgress)}%</small>
                      <progress value={modelUploadProgress} max="100" aria-label="GLB upload progress" style={{ width: "100%", marginTop: 6 }} />
                    </div>
                  )}
                  <label>Or use an existing model URL</label>
                  <input
                    name="modelUrl"
                    className={commonStyles.formControl}
                    placeholder="https://.../model.glb"
                    value={formModelUrl}
                    onChange={(e) => setFormModelUrl(e.target.value)}
                    required
                  />
                  </>}
                  <ModelSpawnPointEditor enabled={modelSpawnPointEnabled} onEnabledChange={setModelSpawnPointEnabled} value={formModelSpawnPoint} onChange={setFormModelSpawnPoint} modelUrl={formModelUrl} />
                </div>
              )}

              {selectedType === "Quiz" && (
                <QuizEditor
                  questions={quizQuestions}
                  setQuestions={setQuizQuestions}
                  shuffleQuestions={shuffleQuestions}
                  setShuffleQuestions={setShuffleQuestions}
                  shuffleAnswers={shuffleAnswers}
                  setShuffleAnswers={setShuffleAnswers}
                />
              )}

              {selectedType === "Fun Fact" && (
                <FunFactsEditor facts={formFacts} setFacts={setFormFacts} />
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
        size={normalizeContentType(currentContent?.type) === MODEL_CONTENT_TYPE ? "wide" : "default"}
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
          <ContentPreview content={currentContent} />
        )}
      </Modal>

      {/* MODAL: DELETE CONFIRMATION */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Hard Delete"
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
          Are you sure you want to permanently delete this content item? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default ContentManagement;