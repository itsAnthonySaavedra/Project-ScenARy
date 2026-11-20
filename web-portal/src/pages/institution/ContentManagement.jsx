import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  doc,
  getDoc,
  serverTimestamp,
  arrayUnion,
  writeBatch,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../../lib/firebase";
import { deleteStorageFile, inspectGlbTextures, MAX_GLB_FILE_SIZE_BYTES, uploadStorageFile } from "../../lib/storageUpload";
import { writeAuditLog } from "../../lib/auditLog";
import tableStyles from "../../components/common/Tables.module.css";
import commonStyles from "../../components/common/Common.module.css";
import Modal from "../../components/common/Modal";
import ContentPreview from "../../components/common/ContentPreview";
import PageHeader from "../../components/common/PageHeader";
import ModelSpawnPointEditor from "../../components/common/ModelSpawnPointEditor";
import QuizEditor from "../../components/common/QuizEditor";
import FunFactsEditor from "../../components/common/FunFactsEditor";
import { CONTENT_SCOPES, getContentScope } from "../../lib/contentScope";
import {
  CONTENT_TYPES,
  MODEL_CONTENT_TYPE,
  getContentAssignmentLimitError,
  normalizeContentType,
} from "../../lib/contentTypes";
import { createDefaultQuizQuestion, normalizeFunFacts, normalizeQuizQuestions } from "../../lib/contentData";
import {
  getContentQualityIssues,
  getInstitutionContentReadiness,
  hasPublishedInstitutionARContent,
  hasReadyLandmarkARContent,
  isContentReady,
} from "../../lib/contentQuality";
import { createDefaultModelSpawnPoint, normalizeModelSpawnPoint, serializeModelSpawnPoint } from "../../lib/modelSpawnPoint";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";
import { approveTourForInstitution, isTourPackage } from "../../lib/tourPackageStore.js";
import { useAuth } from "../../context/AuthContext";
import LandmarkDiscussion from "../../components/common/LandmarkDiscussion";

const InstituteContentManagement = () => {
  const { currentRole } = useAuth();
  const [contents, setContents] = useState([]);
  const [institutionLandmarks, setInstitutionLandmarks] = useState([]);
  const [discussionLandmarkId, setDiscussionLandmarkId] = useState("");
  const [assignmentTargets, setAssignmentTargets] = useState([]);
  const [selectedContentIds, setSelectedContentIds] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [assigningContent, setAssigningContent] = useState(false);
  const [filter, setFilter] = useState("All");
  const [scopeFilter, setScopeFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [formScope, setFormScope] = useState("");
  const [formStatus, setFormStatus] = useState("Awaiting Content");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDocId, setEditDocId] = useState(null);
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formInfoDesc, setFormInfoDesc] = useState("");
  const [formFacts, setFormFacts] = useState([""]);
  const [formModelUrl, setFormModelUrl] = useState("");
  const [formModelSpawnPoint, setFormModelSpawnPoint] = useState(createDefaultModelSpawnPoint);
  const [modelSpawnPointEnabled, setModelSpawnPointEnabled] = useState(false);
  const [modelFile, setModelFile] = useState(null);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [modelUploadProgress, setModelUploadProgress] = useState(0);
  const [formCustomData, setFormCustomData] = useState("");
  const [formNeedsAttention, setFormNeedsAttention] = useState(false);
  const [userInstitutionId, setUserInstitutionId] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [quizQuestions, setQuizQuestions] = useState([createDefaultQuizQuestion()]);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentContent, setCurrentContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [contentLoadError, setContentLoadError] = useState("");
  const [contentReadyCheckLoaded, setContentReadyCheckLoaded] = useState(false);
  const [saveWarning, setSaveWarning] = useState("");
  const [approvalError, setApprovalError] = useState("");
  const [approvingContentId, setApprovingContentId] = useState("");

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          try {
            const userDocSnap = await getDoc(doc(db, "users", user.uid));
            if (userDocSnap.exists() && userDocSnap.data().institutionId) {
              setUserInstitutionId(userDocSnap.data().institutionId);
            } else {
              setContentLoadError("Your account is not linked to an institution. Contact an administrator.");
            }
          } catch (error) {
            console.error("Profile extraction error:", error);
            setContentLoadError(
              getFirebaseErrorMessage(error, "Unable to load your institution profile."),
            );
          }
        } else {
          setUserInstitutionId(null);
        }
        setIsAuthChecking(false);
      },
      (error) => {
        console.error("Unable to verify the signed-in user for content management:", error);
        setContentLoadError(
          getFirebaseErrorMessage(error, "Unable to verify your sign-in. Refresh and try again."),
        );
        setIsAuthChecking(false);
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthChecking) return undefined;
    if (!userInstitutionId) {
      setContents([]);
      setInstitutionLandmarks([]);
      setDiscussionLandmarkId("");
      setAssignmentTargets([]);
      return undefined;
    }

    const institutionId = userInstitutionId.trim();
    const unsubscribeContent = onSnapshot(
      query(collection(db, "content"), where("institutionId", "==", institutionId)),
      (snapshot) => {
        setContents(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data(), type: normalizeContentType(item.data().type) }))
            .filter((item) => CONTENT_TYPES.includes(item.type)),
        );
        setContentReadyCheckLoaded(true);
        setContentLoadError("");
      },
      (error) => {
        console.error("Unable to receive institution content updates:", error);
        setContentLoadError(
          getFirebaseErrorMessage(error, "Unable to load content updates. Please try again later."),
        );
      },
    );

    const updateAssignmentTargets = (landmarkDocs, poiDocs) => {
      setAssignmentTargets([
        ...landmarkDocs.map((item) => ({
          id: item.id,
          targetKey: `landmarks:${item.id}`,
          name: item.data().landmarkName || item.data().institutionName || "Unnamed landmark",
          collectionName: "landmarks",
          scope: "Landmark",
          contentIds: item.data().contentIds || [],
        })),
        ...poiDocs.map((item) => ({
          id: item.id,
          targetKey: `pois:${item.id}`,
          name: item.data().name || "Unnamed POI",
          collectionName: "pois",
          scope: "POI",
          landmarkId: item.data().landmarkId,
          contentIds: item.data().contentIds || [],
        })),
      ]);
    };

    let landmarks = [];
    let pois = [];

    const unsubscribeLandmarks = onSnapshot(
      query(collection(db, "landmarks"), where("institutionId", "==", institutionId)),
      (snapshot) => {
        landmarks = snapshot.docs;
        const parsedLandmarks = landmarks.map((item) => ({
          id: item.id,
          ...item.data(),
        }));
        setInstitutionLandmarks(parsedLandmarks);
        setDiscussionLandmarkId((prev) =>
          parsedLandmarks.some((l) => l.id === prev) ? prev : parsedLandmarks[0]?.id || "",
        );
        updateAssignmentTargets(landmarks, pois);
      },
      (error) => {
        console.error("Unable to receive landmark assignment updates:", error);
        setContentLoadError(
          getFirebaseErrorMessage(error, "Unable to load landmark assignment targets."),
        );
      },
    );

    const unsubscribePois = onSnapshot(
      query(collection(db, "pois"), where("institutionId", "==", institutionId)),
      (snapshot) => {
        pois = snapshot.docs;
        updateAssignmentTargets(landmarks, pois);
      },
      (error) => {
        console.error("Unable to receive POI assignment updates:", error);
        setContentLoadError(
          getFirebaseErrorMessage(error, "Unable to load POI assignment targets."),
        );
      },
    );

    return () => {
      unsubscribeContent();
      unsubscribeLandmarks();
      unsubscribePois();
    };
  }, [userInstitutionId, isAuthChecking]);

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setEditDocId(null);
    setFormTitle("");
    setFormScope("");
    setFormStatus("Awaiting Content");
    setFormInfoDesc("");
    setFormFacts([""]);
    setFormModelUrl("");
    setFormModelSpawnPoint(createDefaultModelSpawnPoint());
    setModelSpawnPointEnabled(false);
    setModelFile(null);
    setFormCustomData("");
    setFormNeedsAttention(false);
    setSelectedType("");
    setQuizQuestions([createDefaultQuizQuestion()]);
    setShuffleQuestions(false);
    setShuffleAnswers(false);
    setFormError("");
    setIsAddModalOpen(true);
  };

  const handleEditClick = (item) => {
    if (isTourPackage(item) || normalizeContentType(item.type) === MODEL_CONTENT_TYPE) return;
    setIsEditMode(true);
    setEditDocId(item.id);
    setFormError("");
    setFormTitle(item.title || "");
    setFormScope(item.scope || item.contentScope || "");
    setFormStatus(item.status === "Published" ? "Published" : "Awaiting Content");
    setSelectedType(normalizeContentType(item.type || ""));
    setFormFacts(normalizeFunFacts(item.data));
    setFormModelUrl(item.data?.modelUrl || item.data?.modelPath || "");
    setFormModelSpawnPoint(normalizeModelSpawnPoint(item.data));
    setModelSpawnPointEnabled(
      item.data?.spawnX !== undefined || item.data?.SpawnZ !== undefined || Boolean(item.data?.spawnPoint),
    );
    setModelFile(null);
    setFormCustomData(
      item.data?.customData ? JSON.stringify(item.data.customData, null, 2) : "",
    );
    setFormNeedsAttention(item.needsAttention === true);

    if (item.type === "Information") {
      setFormInfoDesc(item.data?.description || "");
    } else if (item.type === "Quiz") {
      setQuizQuestions(normalizeQuizQuestions(item.data?.quizzes));
      setShuffleQuestions(item.data?.shuffleQuestions === true);
      setShuffleAnswers(item.data?.shuffleAnswers === true);
    }

    setIsAddModalOpen(true);
  };

  const handleDuplicateClick = (item) => {
    if (isTourPackage(item) || normalizeContentType(item.type) === MODEL_CONTENT_TYPE) return;
    const data = item.data || {};
    handleOpenCreateModal();
    setFormTitle(`${item.title || "Untitled content"} (copy)`);
    setFormScope(getContentScope(item));
    setFormStatus("Awaiting Content");
    setSelectedType(normalizeContentType(item.type || ""));
    setFormNeedsAttention(item.needsAttention === true);
    setFormInfoDesc(data.description || "");
    setFormFacts(normalizeFunFacts(data));
    setFormModelUrl(data.modelUrl || data.modelPath || "");
    setFormModelSpawnPoint(normalizeModelSpawnPoint(data));
    setModelSpawnPointEnabled(
      data.spawnX !== undefined || data.SpawnZ !== undefined || Boolean(data.spawnPoint),
    );
    setFormCustomData(data.customData ? JSON.stringify(data.customData, null, 2) : "");
    if (item.type === "Quiz") {
      setQuizQuestions(normalizeQuizQuestions(data.quizzes));
      setShuffleQuestions(data.shuffleQuestions === true);
      setShuffleAnswers(data.shuffleAnswers === true);
    }
  };

  const handleConfirmDeleteClick = (item) => {
    if (!userInstitutionId || item.institutionId !== userInstitutionId.trim()) {
      setApprovalError("You can only delete content belonging to your own institution.");
      return;
    }
    setDeleteDocId(item.id);
    setIsDeleteModalOpen(true);
  };

  const handleHardDelete = async () => {
    if (!deleteDocId || !userInstitutionId) return;
    const itemToDelete = contents.find((item) => item.id === deleteDocId);
    if (!itemToDelete || itemToDelete.institutionId !== userInstitutionId.trim()) {
      setApprovalError("You can only delete content belonging to your own institution.");
      setIsDeleteModalOpen(false);
      setDeleteDocId(null);
      return;
    }

    setLoading(true);
    setApprovalError("");
    try {
      const storagePath = itemToDelete.data?.modelStoragePath;
      if (storagePath) {
        try {
          await deleteStorageFile(storagePath);
        } catch (storageError) {
          console.warn("Unable to remove attached storage asset before deleting content:", storageError);
        }
      }
      await deleteDoc(doc(db, "content", deleteDocId));
      setSelectedContentIds((current) => current.filter((id) => id !== deleteDocId));
      try {
        await writeAuditLog({
          actorId: getAuth().currentUser?.uid,
          actorRole: "institution",
          action: "content.deleted",
          entityType: "content",
          entityId: deleteDocId,
          metadata: { institutionId: userInstitutionId, title: itemToDelete.title },
          throwOnFailure: true,
        });
      } catch (auditError) {
        console.error("Content deleted, but audit log failed:", auditError);
      }
      setIsDeleteModalOpen(false);
      setDeleteDocId(null);
    } catch (error) {
      console.error("Unable to delete institution content:", error);
      setApprovalError(getFirebaseErrorMessage(error, "Unable to delete this content item."));
    } finally {
      setLoading(false);
    }
  };

  const assignSelectedContent = async () => {
    const target = assignmentTargets.find((item) => item.targetKey === selectedTargetId);
    if (!target || selectedContentIds.length === 0) return;
    const compatibleIds = selectedContentIds.filter((id) => {
      const item = contents.find((content) => content.id === id);
      return item && getContentScope(item) === target.scope;
    });
    if (compatibleIds.length === 0) {
      setBulkMessage(`Select content scoped to ${target.scope} to assign it to this target.`);
      return;
    }
    const assignedIds = target.contentIds || [];
    const newCompatibleIds = compatibleIds.filter((id) => !assignedIds.includes(id));
    const limitError = getContentAssignmentLimitError(
      target.scope,
      [...assignedIds, ...newCompatibleIds],
      contents,
    );
    if (limitError) {
      setBulkMessage(limitError);
      return;
    }
    setAssigningContent(true);
    setBulkMessage("");
    try {
      await updateDoc(doc(db, target.collectionName, target.id), { contentIds: arrayUnion(...compatibleIds) });
      let auditWarning = "";
      try {
        await writeAuditLog({
          actorId: getAuth().currentUser?.uid,
          actorRole: "institution",
          action: "content.bulk_assigned",
          entityType: target.scope.toLowerCase(),
          entityId: target.id,
          metadata: { institutionId: userInstitutionId, contentIds: compatibleIds },
          throwOnFailure: true,
        });
      } catch (auditError) {
        console.error("Content was assigned, but its audit record could not be written:", auditError);
        auditWarning = " The content was assigned, but its activity record could not be written.";
      }
      setSelectedContentIds([]);
      setSelectedTargetId("");
      let successMessage = `${compatibleIds.length} item${compatibleIds.length === 1 ? "" : "s"} assigned to ${target.name}.`;
      if (compatibleIds.length < selectedContentIds.length) {
        successMessage = `${compatibleIds.length} compatible item${compatibleIds.length === 1 ? " was" : "s were"} assigned to ${target.name}; items from other content areas were skipped.`;
      }
      setBulkMessage(`${successMessage}${auditWarning}`);
    } catch (error) {
      console.error("Unable to bulk assign content:", error);
      setBulkMessage(
        getFirebaseErrorMessage(error, "Unable to assign content. Please try again."),
      );
    } finally {
      setAssigningContent(false);
    }
  };

  // --- SUBMIT HANDLING ---
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!userInstitutionId) {
      setFormError("Your account is not linked to an institution. Contact an administrator.");
      return;
    }
    const existingContent = contents.find((item) => item.id === editDocId);
    const editingLegacyPoiContent =
      isEditMode &&
      existingContent &&
      getContentScope(existingContent) === "POI" &&
      existingContent.type === selectedType;
    if (
      formScope === "POI" &&
      !["Information", "Fun Fact", "Quiz"].includes(selectedType) &&
      !editingLegacyPoiContent
    ) {
      setFormError("Only Information, Fun Fact, and Quiz content can be added to POIs.");
      return;
    }
    if (
      !isEditMode &&
      ["Information", MODEL_CONTENT_TYPE, "Quiz"].includes(selectedType) &&
      !contentReadyCheckLoaded
    ) {
      setFormError("Wait for institution content to finish loading before adding this item.");
      return;
    }
    if (
      normalizeContentType(selectedType) === MODEL_CONTENT_TYPE &&
      currentRole !== "developer"
    ) {
      setFormError("Only a Developer / 3D modeller can upload a VR model.");
      return;
    }
    if (
      normalizeContentType(selectedType) === MODEL_CONTENT_TYPE &&
      !hasPublishedInstitutionARContent(contents)
    ) {
      setFormError(
        "Publish at least one complete Information, Fun Fact, or Quiz item before uploading a VR model.",
      );
      return;
    }
    setLoading(true);
    setFormError("");
    setSaveWarning("");

    let contentData = {};
    let contentSaved = false;

    try {
      const customData = formCustomData.trim()
        ? JSON.parse(formCustomData)
        : {};

      if (selectedType === "Information") {
        contentData = {
          description: formInfoDesc,
        };
      } else if (selectedType === "Fun Fact") {
        contentData = {
          facts: formFacts,
          fact: formFacts[0] || "",
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
      } else if (selectedType === MODEL_CONTENT_TYPE) {
        contentData = {
          modelUrl: formModelUrl.trim(),
          ...(modelSpawnPointEnabled ? serializeModelSpawnPoint(formModelSpawnPoint) : {}),
          ...(modelFile
            ? {
                modelFileName: modelFile.fileName,
                modelFileType: modelFile.fileType,
                modelStoragePath: modelFile.storagePath,
              }
            : {}),
        };
      }

      contentData = {
        ...contentData,
        customData,
      };

      const qualityIssues = getContentQualityIssues({
        title: formTitle,
        type: selectedType,
        scope: formScope,
        data: contentData,
      });
      if (qualityIssues.length > 0) {
        setFormError(qualityIssues.join(" | "));
        setLoading(false);
        return;
      }

      const chosenStatus = formStatus === "Published" ? "Published" : "Awaiting Content";
      if (chosenStatus === "Published" && formNeedsAttention) {
        setFormError("Uncheck 'Mark as needs attention' or save as unpublished before publishing.");
        setLoading(false);
        return;
      }

      let savedContentId = editDocId;
      if (isEditMode && editDocId) {
        const docRef = doc(db, "content", editDocId);
        await updateDoc(docRef, {
          title: formTitle,
          scope: formScope,
          data: contentData,
          needsAttention: formNeedsAttention,
          status:
            normalizeContentType(selectedType) === MODEL_CONTENT_TYPE
              ? "Awaiting Content"
              : chosenStatus,
          ...(normalizeContentType(selectedType) === MODEL_CONTENT_TYPE
            ? {
                institutionApproved: false,
                institutionApprovedAt: null,
                institutionApprovedBy: null,
                adminApproved: false,
                adminApprovedAt: null,
                adminApprovedBy: null,
              }
            : {}),
          updatedAt: serverTimestamp(),
        });
        contentSaved = true;
      } else {
        const payload = {
          title: formTitle,
          type: selectedType,
          scope: formScope,
          institutionId: userInstitutionId.trim(),
          status:
            normalizeContentType(selectedType) === MODEL_CONTENT_TYPE
              ? "Awaiting Content"
              : chosenStatus,
          ...(normalizeContentType(selectedType) === MODEL_CONTENT_TYPE
            ? {
                institutionApproved: false,
                adminApproved: false,
              }
            : {}),
          needsAttention: formNeedsAttention,
          data: contentData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const createdContent = await addDoc(collection(db, "content"), payload);
        savedContentId = createdContent.id;
        contentSaved = true;
      }

      try {
        await writeAuditLog({
          actorId: getAuth().currentUser?.uid,
          actorRole: "institution",
          action: isEditMode ? "content.updated" : "content.created",
          entityType: "content",
          entityId: savedContentId,
          metadata: {
            title: formTitle,
            type: selectedType,
            scope: formScope,
            status: chosenStatus,
            institutionId: userInstitutionId,
            fileName: contentData.modelFileName || null,
          },
          throwOnFailure: true,
        });
      } catch (auditError) {
        console.error("Content saved, but its audit record could not be written:", auditError);
        setSaveWarning("Content was saved, but its activity record could not be written.");
      }

      setIsAddModalOpen(false);
      setIsEditMode(false);
      setEditDocId(null);
      setFormTitle("");
      setFormScope("");
      setFormStatus("Awaiting Content");
      setFormInfoDesc("");
      setFormFacts([""]);
      setFormModelUrl("");
      setFormModelSpawnPoint(createDefaultModelSpawnPoint());
      setModelSpawnPointEnabled(false);
      setModelFile(null);
      setFormCustomData("");
      setFormNeedsAttention(false);
      setSelectedType("");
      setQuizQuestions([createDefaultQuizQuestion()]);
      setShuffleQuestions(false);
      setShuffleAnswers(false);
      setFormError("");
    } catch (error) {
      console.error("Database Transaction Error:", error);
      if (contentSaved) {
        setSaveWarning("Content was saved, but a follow-up action failed. Check the content list before retrying.");
      } else {
        setFormError(
          error instanceof SyntaxError
            ? "Custom data must contain valid JSON."
            : getFirebaseErrorMessage(error, "Unable to save content. Please try again."),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInstitutionApproveModel = async (item) => {
    if (normalizeContentType(item.type) !== MODEL_CONTENT_TYPE) return;
    if (item.developerApproved !== true) {
      setApprovalError("The Developer must review and approve the model before Curator verification.");
      return;
    }
    const hasARForModel = hasReadyARForModel(item);
    if (!hasARForModel) {
      setApprovalError(
        "Complete AR content must be assigned to this landmark before approving its VR model.",
      );
      return;
    }
    if (!isContentReady(item)) {
      setApprovalError("Complete the model details before approving it.");
      return;
    }

    const modelLandmark = item.targetId
      ? assignmentTargets.find(
          (target) => target.id === item.targetId && target.collectionName === "landmarks",
        )
      : null;
    const relatedContentIds = new Set([
      ...(Array.isArray(modelLandmark?.contentIds) ? modelLandmark.contentIds : []),
      ...assignmentTargets
        .filter((target) => target.collectionName === "pois" && target.landmarkId === item.targetId)
        .flatMap((target) => (Array.isArray(target.contentIds) ? target.contentIds : [])),
    ]);
    const pairedARContent = modelLandmark
      ? contents.filter(
          (content) =>
            relatedContentIds.has(content.id) &&
            ["Information", "Fun Fact", "Quiz"].includes(normalizeContentType(content.type)) &&
            content.status === "Awaiting Content" &&
            isContentReady(content),
        )
      : [];
    if (pairedARContent.length >= 500) {
      setApprovalError(
        "This landmark has too many AR items to release atomically with its VR model. Reduce the number of assigned items and retry.",
      );
      return;
    }

    setApprovalError("");
    setApprovingContentId(item.id);
    try {
      if (isTourPackage(item)) {
        await approveTourForInstitution(item, getAuth().currentUser?.uid || null);
      } else {
        const now = serverTimestamp();
        const curatorId = getAuth().currentUser?.uid || null;
        const releaseBatch = writeBatch(db);
        releaseBatch.update(doc(db, "content", item.id), {
          curatorApproved: true,
          curatorApprovedAt: now,
          curatorApprovedBy: curatorId,
          institutionApproved: true,
          institutionApprovedAt: now,
          institutionApprovedBy: curatorId,
          status: "Published",
          updatedAt: now,
        });
        pairedARContent.forEach((content) => {
          releaseBatch.update(doc(db, "content", content.id), {
            status: "Published",
            releasedWithModelId: item.id,
            updatedAt: now,
          });
        });
        await releaseBatch.commit();
      }
      try {
        await writeAuditLog({
          actorId: getAuth().currentUser?.uid,
          actorRole: "institution",
          action: "content.curator-approved",
          entityType: "content",
          entityId: item.id,
          metadata: {
            institutionId: userInstitutionId,
            title: item.title,
            developerApproved: true,
            pairedARContentIds: pairedARContent.map((content) => content.id),
          },
          throwOnFailure: true,
        });
      } catch (auditError) {
        console.error("Model was approved, but its audit record could not be written:", auditError);
        setApprovalError("The model was approved, but its activity record could not be written.");
      }
    } catch (error) {
      console.error("Unable to approve the VR model:", error);
      setApprovalError(
        getFirebaseErrorMessage(
          error,
          isTourPackage(item) ? error.message : "Unable to approve the VR model. Please try again.",
        ),
      );
    } finally {
      setApprovingContentId("");
    }
  };

  const hasReadyARForModel = (item) => {
    if (!item.targetId) return false;
    const modelLandmark = assignmentTargets.find(
      (target) => target.id === item.targetId && target.collectionName === "landmarks",
    );
    if (!modelLandmark) return false;
    const relatedContentIds = new Set([
      ...(Array.isArray(modelLandmark.contentIds) ? modelLandmark.contentIds : []),
      ...assignmentTargets
        .filter((target) => target.collectionName === "pois" && target.landmarkId === item.targetId)
        .flatMap((target) => (Array.isArray(target.contentIds) ? target.contentIds : [])),
    ]);
    return hasReadyLandmarkARContent(
      { ...modelLandmark, contentIds: [...relatedContentIds] },
      contents,
    );
  };

  const handleView = (item) => {
    setCurrentContent(item);
    setIsViewModalOpen(true);
  };

  const filteredContents = contents
    .filter((c) => filter === "All" || (filter === "Needs attention" ? !isContentReady(c) : c.status === filter))
    .filter((c) => scopeFilter === "All" || getContentScope(c) === scopeFilter)
    .filter((c) => c.title?.toLowerCase().includes(searchTerm.toLowerCase()));

  const incompleteCount = contents.filter((item) => !isContentReady(item)).length;
  const siteReadiness = getInstitutionContentReadiness(contents);
  const activeDiscussionLandmark = institutionLandmarks.find((item) => item.id === discussionLandmarkId);

  if (isAuthChecking) {
    return (
      <div style={{ padding: "20px", color: "#fff" }}>
        Loading Dashboard Identity...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", padding: "20px" }}>
      <PageHeader
        eyebrow="Curator workspace"
        title="Content Management"
        description="Create, publish or unpublish, and manage AR content for your institution, then review VR models and coordinate with your 3D modeller."
      />
      <div
        role="status"
        style={{
          color: siteReadiness.isReady ? "#4ade80" : "#fbbf24",
          background: siteReadiness.isReady ? "rgba(74,222,128,.08)" : "rgba(251,191,36,.08)",
          border: `1px solid ${siteReadiness.isReady ? "rgba(74,222,128,.3)" : "rgba(251,191,36,.3)"}`,
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
        }}
      >
        {contentReadyCheckLoaded
          ? siteReadiness.isReady
            ? "Site setup is ready: it has published Information and AR/VR content."
            : `Site setup is incomplete. Add ${siteReadiness.missing.join(" and ")}. Items must pass content checks and be published together after Curator verification.`
          : "Checking site setup readiness..."}
      </div>
      {contentLoadError && (
        <div role="alert" style={{ color: "#fca5a5", marginBottom: 16 }}>
          {contentLoadError}
        </div>
      )}
      {approvalError && (
        <div role="alert" style={{ color: "#fca5a5", marginBottom: 16 }}>
          {approvalError}
        </div>
      )}
      {saveWarning && (
        <div role="alert" style={{ color: "#fbbf24", marginBottom: 16 }}>
          {saveWarning}
        </div>
      )}

      {/* CONTROLS */}
      <div className={tableStyles.controls} style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {[
            "All",
            "Awaiting Content",
            "Awaiting Curator Approval",
            "Awaiting Admin Approval",
            "Published",
            "Rejected",
            "Deactivated",
            "Needs attention",
          ].map((status) => (
            <button
              key={status}
              className={`${tableStyles.tabBtn} ${filter === status ? tableStyles.tabBtnAdminActive : ""}`}
              onClick={() => setFilter(status)}
            >
              {status === "All" ? "All Content" : status}
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
            {CONTENT_SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {scope}
              </option>
            ))}
          </select>
          <input
            type="text"
            className={tableStyles.searchBar}
            placeholder="Search your items..."
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className={tableStyles.btnAdd}
            onClick={handleOpenCreateModal}
            disabled={!userInstitutionId}
          >
            <i className="fa-solid fa-plus"></i> Create Content
          </button>
        </div>
      </div>

      <p style={{ color: "#888", marginBottom: "1.5rem" }}>
        Create reusable content here, choose whether it is Published or Unpublished, and assign it from Landmark or POI management. You can permanently delete your own content items; only administrators can deactivate content.
      </p>

      {selectedContentIds.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span style={{ color: "#ddd" }}>{selectedContentIds.length} selected</span>
          <select
            className={commonStyles.formControl}
            aria-label="Choose assignment target"
            value={selectedTargetId}
            onChange={(event) => setSelectedTargetId(event.target.value)}
            style={{ maxWidth: 320 }}
          >
            <option value="">Assign to landmark or POI...</option>
            {assignmentTargets.map((target) => (
              <option key={target.targetKey} value={target.targetKey}>
                {target.scope}: {target.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={commonStyles.btnPrimary}
            disabled={!selectedTargetId || assigningContent}
            onClick={assignSelectedContent}
          >
            {assigningContent ? "Assigning..." : "Assign selected"}
          </button>
          <button
            type="button"
            className={commonStyles.btnCancel}
            onClick={() => setSelectedContentIds([])}
          >
            Clear selection
          </button>
        </div>
      )}
      {bulkMessage && (
        <p
          role="status"
          style={{ color: /^(Unable|Select|Each |VR models)/.test(bulkMessage) ? "#fbbf24" : "#86efac" }}
        >
          {bulkMessage}
        </p>
      )}
      <div
        style={{
          color: incompleteCount > 0 ? "#fbbf24" : "#4ade80",
          marginBottom: "1rem",
        }}
      >
        {incompleteCount > 0
          ? `${incompleteCount} content item${incompleteCount === 1 ? "" : "s"} need attention before use.`
          : "All content items are ready for use."}
      </div>

      {/* INVENTORY TABLE BOX */}
      <div className={tableStyles.tableContainer}>
        <table className={tableStyles.adminTable}>
          <thead>
            <tr>
              <th>
                <span className="sr-only">Select</span>
              </th>
              <th>Title</th>
              <th>Institution</th>
              <th>Type</th>
              <th>Area</th>
              <th>Status</th>
              <th>Quality</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContents.length > 0 ? (
              filteredContents.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.title || "content"}`}
                      checked={selectedContentIds.includes(item.id)}
                      onChange={() =>
                        setSelectedContentIds((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id],
                        )
                      }
                    />
                  </td>
                  <td style={{ color: "#fff", fontWeight: "500" }}>{item.title}</td>
                  <td>
                    <span style={{ color: "#4ade80", whiteSpace: "nowrap" }}>
                      <i className="fa-solid fa-link" style={{ marginRight: "0.4rem" }} />
                      Linked to this institution
                    </span>
                  </td>
                  <td>{item.type}</td>
                  <td>{item.scope || item.contentScope || "Unclassified"}</td>
                  <td>
                    <span
                      style={{
                        color:
                          item.status === "Published"
                            ? "#4ade80"
                            : item.status === "Deactivated"
                              ? "#f87171"
                              : "#fbbf24",
                        border: `1px solid ${
                          item.status === "Published"
                            ? "#4ade80"
                            : item.status === "Deactivated"
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
                    <span
                      title={getContentQualityIssues(item).join(", ")}
                      style={{
                        color: isContentReady(item) ? "#4ade80" : "#fbbf24",
                      }}
                    >
                      {isContentReady(item) ? "Ready" : "Needs attention"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        className={tableStyles.btnAction}
                        onClick={() => handleView(item)}
                        title="View Metadata Source"
                      >
                        <i className="fa-solid fa-file-alt"></i>
                      </button>

                      {!isTourPackage(item) && normalizeContentType(item.type) !== MODEL_CONTENT_TYPE && (
                        <button
                          className={tableStyles.btnAction}
                          onClick={() => handleEditClick(item)}
                          title="Modify Content Node Inplace"
                          style={{
                            background: "rgba(193, 154, 75, 0.15)",
                            color: "#C19A4B",
                          }}
                        >
                          <i className="fa-solid fa-edit"></i>
                        </button>
                      )}
                      {!isTourPackage(item) && normalizeContentType(item.type) !== MODEL_CONTENT_TYPE && (
                        <button
                          className={tableStyles.btnAction}
                          onClick={() => handleDuplicateClick(item)}
                          title="Duplicate content"
                        >
                          <i className="fa-solid fa-copy"></i>
                        </button>
                      )}

                      <button
                        type="button"
                        className={tableStyles.btnAction}
                        onClick={() => handleConfirmDeleteClick(item)}
                        title="Permanently Delete Content"
                        style={{
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#ef4444",
                        }}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>

                      {item.type === MODEL_CONTENT_TYPE &&
                        item.status === "Awaiting Curator Approval" &&
                        !item.curatorApproved && (
                          <button
                            type="button"
                            className={commonStyles.btnPrimary}
                            onClick={() => handleInstitutionApproveModel(item)}
                            disabled={
                              approvingContentId === item.id ||
                              !hasReadyARForModel(item) ||
                              !isContentReady(item)
                            }
                            title={
                              !hasReadyARForModel(item)
                                ? "Add complete AR content for this landmark before approving its model"
                                : !isContentReady(item)
                                  ? "Complete the model details before approval"
                                  : "Verify and approve this model"
                            }
                          >
                            {approvingContentId === item.id ? "Approving..." : "Verify and approve"}
                          </button>
                        )}
                      {item.type === MODEL_CONTENT_TYPE && item.status === "Awaiting Curator Approval" && (
                        <span style={{ color: "#fbbf24" }}>Awaiting Curator verification</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "#888",
                  }}
                >
                  No content found for your institution.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CURATOR <-> 3D MODELLER COMMUNICATION THREAD */}
      {userInstitutionId && (
        <section
          aria-label="Communicate with 3D modeller"
          style={{
            marginTop: "2rem",
            padding: "1.25rem",
            borderRadius: 12,
            background: "#151515",
            border: "1px solid #34312a",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            <div>
              <h2 style={{ margin: 0, color: "#f3d16f", fontSize: "1.15rem" }}>
                Communicate with 3D Modeller
              </h2>
              <p style={{ margin: "0.25rem 0 0", color: "#a8a29e", fontSize: "0.85rem" }}>
                Coordinate with your assigned 3D modeller on landmark models, spawn orientation, textures, or AR references.
              </p>
            </div>
            {institutionLandmarks.length > 0 && (
              <select
                aria-label="Select landmark thread for 3D modeller communication"
                className={commonStyles.formControl}
                value={discussionLandmarkId}
                onChange={(e) => setDiscussionLandmarkId(e.target.value)}
                style={{ maxWidth: 320 }}
              >
                {institutionLandmarks.map((landmark) => (
                  <option key={landmark.id} value={landmark.id}>
                    {landmark.landmarkName || landmark.institutionName || "Unnamed landmark"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {institutionLandmarks.length === 0 ? (
            <p style={{ color: "#888", margin: 0 }}>
              No landmarks are assigned to your institution yet. Once a landmark is created, you can message your 3D modeller here.
            </p>
          ) : (
            discussionLandmarkId && (
              <LandmarkDiscussion
                institutionId={userInstitutionId}
                landmarkId={discussionLandmarkId}
                title={`Modeller Thread · ${
                  activeDiscussionLandmark?.landmarkName ||
                  activeDiscussionLandmark?.institutionName ||
                  "Landmark"
                }`}
              />
            )
          )}
        </section>
      )}

      {/* MODAL: INPUT FIELDS CONFIGURATION WORKSPACE CONTAINER */}
      <Modal
        isOpen={isAddModalOpen}
        size="wide"
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedType("");
          setQuizQuestions([{ question: "", answer: "True" }]);
        }}
        title={isEditMode ? "Edit Content" : "Add New Institution Content"}
        actions={
          <button className={commonStyles.btnCancel} onClick={() => setIsAddModalOpen(false)}>
            Cancel
          </button>
        }
      >
        <form onSubmit={handleFormSubmit}>
          {formError && (
            <div
              role="alert"
              style={{
                color: "#fbbf24",
                background: "rgba(251, 191, 36, 0.1)",
                border: "1px solid rgba(251, 191, 36, 0.35)",
                borderRadius: "4px",
                padding: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              {formError}
            </div>
          )}
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
              {CONTENT_TYPES.filter(
                (type) =>
                  (currentRole === "developer" || type !== MODEL_CONTENT_TYPE) &&
                  (formScope !== "POI" ||
                    isEditMode ||
                    ["Information", "Fun Fact", "Quiz"].includes(type)),
              ).map((type) => (
                <option
                  key={type}
                  value={type}
                  disabled={
                    type === MODEL_CONTENT_TYPE && !hasPublishedInstitutionARContent(contents)
                  }
                >
                  {type}
                </option>
              ))}
            </select>
            {formScope === "POI" && (
              <small style={{ color: "#888" }}>
                POIs can use Information, Fun Fact, and Quiz content. VR models remain limited to landmarks.
              </small>
            )}
            <small style={{ display: "block", color: "#888", marginTop: 6 }}>
              Information, quizzes, and VR models can be reused across targets; limits apply per Landmark or POI assignment. Fun Facts are unlimited.
            </small>
            {!hasPublishedInstitutionARContent(contents) && (
              <small role="status" style={{ display: "block", color: "#fbbf24", marginTop: 6 }}>
                Publish one complete Information, Fun Fact, or Quiz item before creating a VR model.
              </small>
            )}
          </div>

          <div className={commonStyles.formGroup}>
            <label>Content Area</label>
            <select
              className={commonStyles.formControl}
              value={formScope}
              onChange={(e) => {
                setFormScope(e.target.value);
                if (
                  !isEditMode &&
                  e.target.value === "POI" &&
                  !["Information", "Fun Fact", "Quiz"].includes(selectedType)
                ) {
                  setSelectedType("");
                }
              }}
              required
            >
              <option value="">Select Content Area</option>
              {CONTENT_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
          </div>

          {normalizeContentType(selectedType) !== MODEL_CONTENT_TYPE && (
            <div className={commonStyles.formGroup}>
              <label htmlFor="institution-content-status">Publication Status</label>
              <select
                id="institution-content-status"
                className={commonStyles.formControl}
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
              >
                <option value="Awaiting Content">Unpublished (Awaiting Content / Draft)</option>
                <option value="Published">Published</option>
              </select>
            </div>
          )}

          <label
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              color: "#fbbf24",
              margin: "1rem 0",
            }}
          >
            <input
              type="checkbox"
              checked={formNeedsAttention}
              onChange={(e) => setFormNeedsAttention(e.target.checked)}
            />
            Mark as needs attention
          </label>

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

              {selectedType === "Fun Fact" && (
                <FunFactsEditor facts={formFacts} setFacts={setFormFacts} />
              )}

              {selectedType === MODEL_CONTENT_TYPE && (
                <div className={commonStyles.formGroup}>
                  <label>Upload VR Model (.glb)</label>
                  <input
                    type="file"
                    accept=".glb,model/gltf-binary,application/octet-stream"
                    disabled={!hasPublishedInstitutionARContent(contents)}
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
                          throw new Error(
                            "This GLB references external texture files. Export it with textures embedded, then try again.",
                          );
                        }
                        const uploaded = await uploadStorageFile(
                          file,
                          `content-models/${userInstitutionId}`,
                          setModelUploadProgress,
                        );
                        setModelFile(uploaded);
                        setFormModelUrl(uploaded.url);
                      } catch (error) {
                        console.error("Model upload error:", error);
                        setFormError(
                          getFirebaseErrorMessage(error, error.message || "Unable to upload the VR model."),
                        );
                      } finally {
                        setUploadingModel(false);
                      }
                    }}
                    style={{ color: "#ccc", marginBottom: "0.75rem" }}
                  />
                  <small style={{ display: "block", color: "#888", marginBottom: "0.75rem" }}>
                    Upload a GLB file, maximum 1 GB. GLB keeps the model, geometry, and textures together.
                  </small>
                  {modelFile && (
                    <small style={{ display: "block", color: "#4ade80", marginBottom: "0.75rem" }}>
                      Uploaded: {modelFile.fileName}
                    </small>
                  )}
                  {uploadingModel && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <small style={{ display: "block", color: "#fbbf24" }}>
                        Uploading model... {Math.floor(modelUploadProgress)}%
                      </small>
                      <progress
                        value={modelUploadProgress}
                        max="100"
                        aria-label="GLB upload progress"
                        style={{ width: "100%", marginTop: 6 }}
                      />
                    </div>
                  )}
                  <label>Or use an existing model URL</label>
                  <input
                    className={commonStyles.formControl}
                    placeholder="https://.../model.glb"
                    value={formModelUrl}
                    onChange={(e) => setFormModelUrl(e.target.value)}
                    disabled={!hasPublishedInstitutionARContent(contents)}
                    required
                  />
                  <ModelSpawnPointEditor
                    enabled={modelSpawnPointEnabled}
                    onEnabledChange={setModelSpawnPointEnabled}
                    value={formModelSpawnPoint}
                    onChange={setFormModelSpawnPoint}
                    modelUrl={formModelUrl}
                  />
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

              <div className={commonStyles.formGroup}>
                <label>Custom Data (JSON)</label>
                <textarea
                  className={commonStyles.formControl}
                  rows={4}
                  placeholder='{"period":"18th century","materials":["stone"]}'
                  value={formCustomData}
                  onChange={(e) => setFormCustomData(e.target.value)}
                />
                <small>
                  Optional extra metadata saved with this content. The portal stores it but does not currently use it in its own display or logic. Leave blank if you do not need it; otherwise enter valid JSON.
                </small>
              </div>
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

      {/* MODAL: HARD DELETE CONFIRMATION */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteDocId(null);
        }}
        title="Confirm Permanent Delete"
        actions={
          <>
            <button
              className={commonStyles.btnCancel}
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteDocId(null);
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleHardDelete}
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
              {loading ? "Deleting..." : "Permanently Delete"}
            </button>
          </>
        }
      >
        <p style={{ color: "#ccc" }}>
          Are you sure you want to permanently delete this content item? This cannot be undone.
        </p>
      </Modal>

      {/* MODAL: INSPECT SUBSECTION ENTRIES */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={currentContent?.title}
        size={normalizeContentType(currentContent?.type) === MODEL_CONTENT_TYPE ? "wide" : "default"}
        actions={
          <button className={commonStyles.btnCancel} onClick={() => setIsViewModalOpen(false)}>
            Close
          </button>
        }
      >
        {currentContent && (
          <>
            <ContentPreview content={currentContent} />
            {currentContent.targetId && (
              <LandmarkDiscussion
                institutionId={userInstitutionId}
                landmarkId={currentContent.targetId}
              />
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default InstituteContentManagement;