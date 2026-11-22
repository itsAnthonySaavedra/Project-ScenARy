import React, { useCallback, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../../lib/firebase";
import { deleteStorageFile, uploadStorageFile } from "../../lib/storageUpload";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import commonStyles from "../../components/common/Common.module.css";
import PageHeader from "../../components/common/PageHeader";
import SetupFlowBanner from "../../components/common/SetupFlowBanner";
import LandmarkDiscussion from "../../components/common/LandmarkDiscussion";
import { getContentScope } from "../../lib/contentScope";
import {
  getContentAssignmentLimitError,
  MODEL_CONTENT_TYPE,
  normalizeContentType,
} from "../../lib/contentTypes";
import { isContentReady } from "../../lib/contentQuality";
import { writeAuditLog } from "../../lib/auditLog";
import { syncGeneratedInstitutionTour } from "../../lib/generatedTours";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";

const landmarkPinIcon = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52" style="filter: drop-shadow(0 3px 4px rgba(0,0,0,.45))">
    <path d="M22 2C10.95 2 2 10.72 2 21.48 2 35.1 22 50 22 50s20-14.9 20-28.52C42 10.72 33.05 2 22 2Z" fill="#f4c542" stroke="#755300" stroke-width="2"/>
    <circle cx="22" cy="21" r="11" fill="#fffaf0"/>
    <path d="M14.5 25.5V18l7.5-4 7.5 4v7.5h-5v-5h-5v5h-5Z" fill="#755300" stroke="#755300" stroke-linejoin="round"/>
    <path d="M20 17.5h4" stroke="#fffaf0" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  iconSize: [44, 52],
  iconAnchor: [22, 50],
  popupAnchor: [0, -46],
});

const DEFAULT_CENTER = [10.3157, 123.8854];
const CEBU_BOUNDS = [
  [9.3826, 123.2324],
  [11.35, 124.1],
];

const hasValidCoords = (item) =>
  typeof item?.lat === "number" &&
  Number.isFinite(item.lat) &&
  typeof item?.lng === "number" &&
  Number.isFinite(item.lng);

const formatErrorDetail = (error, fallback) => {
  const base = getFirebaseErrorMessage(error, fallback);
  const code = error?.code ? `[${error.code}] ` : "";
  const detail = error?.message && !base.includes(error.message) ? ` (${error.message})` : "";
  return `${code}${base}${detail}`;
};

const isPoiPublished = (poi) => poi?.status === "Published" || poi?.isPublished === true;

const getPoiContentTypeSet = (poi, contents = []) => {
  const ids = Array.isArray(poi?.contentIds) ? poi.contentIds : [];
  const types = new Set();
  for (const item of contents) {
    if (ids.includes(item.id) && getContentScope(item) === "POI" && isContentReady(item)) {
      types.add(normalizeContentType(item.type));
    }
  }
  return types;
};

const isPoiContentComplete = (poi, contents = []) => {
  const types = getPoiContentTypeSet(poi, contents);
  return types.has("Information") && types.has("Quiz") && types.has("Fun Fact");
};

/**
 * Evaluates landmark readiness requiring:
 * 1. Complete landmark info (name, description, coordinates)
 * 2. Landmark-scoped (Area: "Landmark") Information, Quiz, Fun Fact, and published VR model
 * 3. At least 1 published POI under the landmark with POI-scoped (Area: "POI") Information, Quiz, and Fun Fact
 */
const evaluateLandmarkReadiness = (
  landmark,
  {
    contents = [],
    pois = [],
    overrideLandmarkContentIds = null,
    overrideName = null,
    overrideDescription = null,
    overrideCoords = null,
  } = {},
) => {
  if (!landmark) {
    return {
      canPublish: false,
      hasInfo: false,
      hasLandmarkInformation: false,
      hasLandmarkQuiz: false,
      hasLandmarkFunFact: false,
      hasLandmarkVR: false,
      hasCompletePoi: false,
      missingLandmarkTypes: ["Information", "Quiz", "Fun Fact", "VR model"],
      missingPoiSummary: "at least 1 published POI with POI-area Information, Quiz, and Fun Fact",
      missing: [
        "landmark name, description, and coordinates",
        "Landmark area missing: Information, Quiz, Fun Fact, VR model",
        "POI area missing: at least 1 published POI with POI-area Information, Quiz, and Fun Fact",
      ],
    };
  }

  const name = (overrideName ?? landmark.landmarkName ?? landmark.institutionName ?? "").trim();
  const description = (overrideDescription ?? landmark.info?.description ?? landmark.description ?? "").trim();
  const coordsOk = overrideCoords
    ? Number.isFinite(Number(overrideCoords.lat)) && Number.isFinite(Number(overrideCoords.lng))
    : hasValidCoords(landmark);
  const hasInfo = Boolean(name && description && coordsOk);

  const landmarkContentIds = new Set(
    Array.isArray(overrideLandmarkContentIds)
      ? overrideLandmarkContentIds
      : Array.isArray(landmark.contentIds)
        ? landmark.contentIds
        : [],
  );

  const landmarkScopedItems = contents.filter(
    (item) =>
      getContentScope(item) === "Landmark" &&
      (landmarkContentIds.has(item.id) || item.targetId === landmark.id),
  );

  const hasLandmarkInformation = landmarkScopedItems.some(
    (item) => normalizeContentType(item.type) === "Information" && isContentReady(item),
  );
  const hasLandmarkQuiz = landmarkScopedItems.some(
    (item) => normalizeContentType(item.type) === "Quiz" && isContentReady(item),
  );
  const hasLandmarkFunFact = landmarkScopedItems.some(
    (item) => normalizeContentType(item.type) === "Fun Fact" && isContentReady(item),
  );
  const hasLandmarkVR = landmarkScopedItems.some(
    (item) =>
      normalizeContentType(item.type) === MODEL_CONTENT_TYPE &&
      item.status === "Published" &&
      isContentReady(item),
  );

  const missingLandmarkTypes = [];
  if (!hasLandmarkInformation) missingLandmarkTypes.push("Information");
  if (!hasLandmarkQuiz) missingLandmarkTypes.push("Quiz");
  if (!hasLandmarkFunFact) missingLandmarkTypes.push("Fun Fact");
  if (!hasLandmarkVR) missingLandmarkTypes.push("VR model");

  const linkedPois = pois.filter((poi) => poi.landmarkId === landmark.id);
  const hasCompletePoi = linkedPois.some(
    (poi) => isPoiPublished(poi) && isPoiContentComplete(poi, contents),
  );

  const missingPoiSummary =
    linkedPois.length === 0
      ? "at least 1 published POI with POI-area Information, Quiz, and Fun Fact"
      : "at least 1 published POI having POI-area Information, Quiz, and Fun Fact";

  const missing = [];
  if (!hasInfo) missing.push("landmark name, description, and coordinates");
  if (missingLandmarkTypes.length > 0) {
    missing.push(`Landmark area missing: ${missingLandmarkTypes.join(", ")}`);
  }
  if (!hasCompletePoi) {
    missing.push(`POI area missing: ${missingPoiSummary}`);
  }

  return {
    canPublish: hasInfo && missingLandmarkTypes.length === 0 && hasCompletePoi,
    hasInfo,
    hasLandmarkInformation,
    hasLandmarkQuiz,
    hasLandmarkFunFact,
    hasLandmarkVR,
    hasCompletePoi,
    missingLandmarkTypes,
    missingPoiSummary,
    missing,
  };
};

const PinPlacementEvents = ({ enabled, onPickCoords }) => {
  useMapEvents({
    click: (event) => {
      if (!enabled) return;
      onPickCoords({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
};

const LandmarkManagement = () => {
  const [institutionId, setInstitutionId] = useState(null);
  const [landmarks, setLandmarks] = useState([]);
  const [pois, setPois] = useState([]);
  const [allContent, setAllContent] = useState([]);
  const [availableContent, setAvailableContent] = useState([]);
  const [selectedContentIds, setSelectedContentIds] = useState([]);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState("");
  const [draftCoords, setDraftCoords] = useState(null);
  const [savingPinLocation, setSavingPinLocation] = useState(false);
  const [formStatus, setFormStatus] = useState("Unpublished");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    imageStoragePath: "",
    imageFileName: "",
    imageFileType: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  const loadData = useCallback(async (id) => {
    setLoading(true);
    try {
      const [landmarkSnap, poiSnap, contentSnap] = await Promise.all([
        getDocs(query(collection(db, "landmarks"), where("institutionId", "==", id))),
        getDocs(query(collection(db, "pois"), where("institutionId", "==", id))),
        getDocs(query(collection(db, "content"), where("institutionId", "==", id))),
      ]);
      const landmarkItems = landmarkSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
      const poiItems = poiSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
      const contentItems = contentSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
      setLandmarks(landmarkItems);
      setPois(poiItems);
      setAllContent(contentItems);
      setAvailableContent(contentItems.filter((item) => getContentScope(item) === "Landmark"));
      setPageError("");
    } catch (error) {
      console.error("Unable to load landmark management data:", error);
      setPageError(
        formatErrorDetail(error, "Unable to load landmark data. Check your connection and try again."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      getAuth(),
      (user) => {
        if (!user) {
          setLoading(false);
          return;
        }
        (async () => {
          try {
            const profile = await getDoc(doc(db, "users", user.uid));
            if (profile.exists() && profile.data().institutionId) {
              const id = profile.data().institutionId;
              setInstitutionId(id);
              await loadData(id);
            } else {
              setPageError("Your account is not linked to an institution. Contact an administrator.");
              setLoading(false);
            }
          } catch (error) {
            console.error("Unable to initialize landmark management:", error);
            setPageError(
              formatErrorDetail(error, "Unable to load landmark management. Refresh and try again."),
            );
            setLoading(false);
          }
        })();
      },
      (error) => {
        console.error("Unable to check the signed-in user for landmark management:", error);
        setPageError(formatErrorDetail(error, "Unable to verify your sign-in."));
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [loadData]);

  const updateField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const selectLandmark = useCallback(
    (landmark) => {
      if (!landmark) return;
      setSelectedLandmarkId(landmark.id);
      setFormStatus(landmark.status === "Published" ? "Published" : "Unpublished");
      setDraftCoords(
        hasValidCoords(landmark)
          ? { lat: landmark.lat, lng: landmark.lng }
          : { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] },
      );
      setPageNotice("");
      setPageError("");
      setForm({
        name: landmark.landmarkName || landmark.institutionName || "",
        description: landmark.info?.description ?? landmark.description ?? "",
        imageUrl: landmark.imageUrl || "",
        imageStoragePath: landmark.imageStoragePath || "",
        imageFileName: landmark.imageFileName || "",
        imageFileType: landmark.imageFileType || "",
      });
      setImageFile(null);
      setSelectedContentIds(
        (landmark.contentIds || []).filter((contentId) =>
          availableContent.some((item) => item.id === contentId),
        ),
      );
    },
    [availableContent],
  );

  const selectedLandmark = landmarks.find((item) => item.id === selectedLandmarkId);
  const targetLandmark = selectedLandmark || landmarks[0];

  const readiness = evaluateLandmarkReadiness(targetLandmark, {
    contents: allContent,
    pois,
    overrideLandmarkContentIds:
      targetLandmark && selectedLandmarkId === targetLandmark.id ? selectedContentIds : null,
    overrideName: targetLandmark && selectedLandmarkId === targetLandmark.id ? form.name : null,
    overrideDescription:
      targetLandmark && selectedLandmarkId === targetLandmark.id ? form.description : null,
    overrideCoords: targetLandmark && selectedLandmarkId === targetLandmark.id ? draftCoords : null,
  });

  const applyLandmarkPublishStatus = async (nextStatus) => {
    if (!institutionId || !selectedLandmark) {
      setPageError("Select a landmark first.");
      return;
    }

    const normalizedNext = nextStatus === "Published" ? "Published" : "Unpublished";

    if (normalizedNext === "Published" && !readiness.canPublish) {
      setPageError(
        `Cannot publish landmark yet. Missing: ${readiness.missing.join("; ")}.`,
      );
      setFormStatus("Unpublished");
      return;
    }

    setUpdatingStatus(true);
    setPageError("");
    setPageNotice("");
    try {
      const isPublished = normalizedNext === "Published";
      await updateDoc(doc(db, "landmarks", selectedLandmark.id), {
        status: normalizedNext,
        isPublished,
        publishedAt: isPublished ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });

      setFormStatus(normalizedNext);
      setLandmarks((current) =>
        current.map((item) =>
          item.id === selectedLandmark.id
            ? { ...item, status: normalizedNext, isPublished }
            : item,
        ),
      );

      let tourWarning = "";
      try {
        await syncGeneratedInstitutionTour(institutionId);
      } catch (tourError) {
        console.error("Landmark status updated, but generated tour refresh failed:", tourError);
        tourWarning = " Status updated, but its generated tour could not be refreshed.";
      }

      try {
        await writeAuditLog({
          actorId: getAuth().currentUser?.uid,
          actorRole: "institution",
          action: isPublished ? "landmark.published" : "landmark.unpublished",
          entityType: "landmark",
          entityId: selectedLandmark.id,
          metadata: { institutionId, status: normalizedNext, isPublished },
          throwOnFailure: true,
        });
      } catch (auditError) {
        console.error("Landmark status updated, but audit log failed:", auditError);
      }

      setPageNotice(
        isPublished
          ? `Landmark "${form.name || selectedLandmark.landmarkName || selectedLandmark.institutionName || "Landmark"}" is now Published.${tourWarning}`
          : `Landmark hidden (Unpublished).${tourWarning}`,
      );
    } catch (error) {
      console.error("Unable to update landmark publish status:", error);
      setPageError(formatErrorDetail(error, "Unable to update landmark status."));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSavePinLocation = async () => {
    if (!institutionId || !selectedLandmarkId || !draftCoords) {
      setPageError("Select a landmark and choose a pin position first.");
      return;
    }
    const lat = Number(draftCoords.lat);
    const lng = Number(draftCoords.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setPageError("Enter valid latitude and longitude coordinates.");
      return;
    }

    setSavingPinLocation(true);
    setPageError("");
    setPageNotice("");
    try {
      await updateDoc(doc(db, "landmarks", selectedLandmarkId), {
        lat,
        lng,
        updatedAt: serverTimestamp(),
      });
      setLandmarks((current) =>
        current.map((item) => (item.id === selectedLandmarkId ? { ...item, lat, lng } : item)),
      );
      let tourWarning = "";
      try {
        await syncGeneratedInstitutionTour(institutionId);
      } catch (tourError) {
        console.error("Pin location saved, but generated tour refresh failed:", tourError);
        tourWarning = " Pin saved, but its generated tour could not be refreshed.";
      }
      try {
        await writeAuditLog({
          actorId: getAuth().currentUser?.uid,
          actorRole: "institution",
          action: "landmark.location-updated",
          entityType: "landmark",
          entityId: selectedLandmarkId,
          metadata: { institutionId, lat, lng },
          throwOnFailure: true,
        });
      } catch (auditError) {
        console.error("Pin location saved, but audit log failed:", auditError);
      }
      setPageNotice(`Pin position updated to ${lat.toFixed(6)}, ${lng.toFixed(6)}.${tourWarning}`);
    } catch (error) {
      console.error("Unable to update landmark pin position:", error);
      setPageError(formatErrorDetail(error, "Unable to save the new pin location."));
    } finally {
      setSavingPinLocation(false);
    }
  };

  const saveLandmark = async (event) => {
    event.preventDefault();
    if (!institutionId || !selectedLandmarkId) {
      setPageError("Select a landmark before saving.");
      return;
    }
    const name = form.name.trim();
    const description = form.description.trim();
    if (!name || !description) {
      setPageError("Enter both a landmark name and description.");
      return;
    }

    const nextContentIds = selectedContentIds.filter((contentId) =>
      availableContent.some((item) => item.id === contentId),
    );
    const nextReadiness = evaluateLandmarkReadiness(selectedLandmark, {
      contents: allContent,
      pois,
      overrideLandmarkContentIds: nextContentIds,
      overrideName: name,
      overrideDescription: description,
      overrideCoords: draftCoords,
    });

    if (formStatus === "Published" && !nextReadiness.canPublish) {
      setPageError(
        `Cannot save as Published yet. Missing: ${nextReadiness.missing.join("; ")}.`,
      );
      return;
    }

    const assignmentLimitError = getContentAssignmentLimitError(
      "Landmark",
      nextContentIds,
      availableContent,
    );
    if (assignmentLimitError) {
      setPageError(assignmentLimitError);
      return;
    }

    setSaving(true);
    setPageError("");
    setPageNotice("");
    const previousStoragePath = form.imageStoragePath;
    let uploadedImage = null;
    try {
      uploadedImage = imageFile
        ? await uploadStorageFile(imageFile, `markers/${institutionId}`)
        : null;
      const coordUpdates =
        draftCoords && Number.isFinite(Number(draftCoords.lat)) && Number.isFinite(Number(draftCoords.lng))
          ? { lat: Number(draftCoords.lat), lng: Number(draftCoords.lng) }
          : {};
      const isPublished = formStatus === "Published";

      await updateDoc(doc(db, "landmarks", selectedLandmarkId), {
        landmarkName: name,
        description,
        info: { description },
        status: formStatus,
        isPublished,
        ...(isPublished ? { publishedAt: serverTimestamp() } : { publishedAt: null }),
        ...coordUpdates,
        imageUrl: uploadedImage?.url || form.imageUrl,
        imageStoragePath: uploadedImage?.storagePath || form.imageStoragePath,
        imageFileName: uploadedImage?.fileName || form.imageFileName,
        imageFileType: uploadedImage?.fileType || form.imageFileType,
        contentIds: nextContentIds,
        updatedAt: serverTimestamp(),
      });
      if (uploadedImage && previousStoragePath && previousStoragePath !== uploadedImage.storagePath) {
        try {
          await deleteStorageFile(previousStoragePath);
        } catch (oldFileError) {
          console.error("Unable to delete previous landmark picture:", oldFileError);
        }
      }
    } catch (error) {
      console.error("Unable to save landmark:", error);
      if (uploadedImage?.storagePath) {
        try {
          await deleteStorageFile(uploadedImage.storagePath);
        } catch (cleanupError) {
          console.error("Unable to clean up the uploaded image after the landmark save failed:", cleanupError);
        }
      }
      setPageError(
        formatErrorDetail(error, "Unable to save the landmark. Check your connection and try again."),
      );
      setSaving(false);
      return;
    }

    const warnings = [];
    try {
      await syncGeneratedInstitutionTour(institutionId);
    } catch (tourError) {
      console.error("Landmark saved, but its generated tour could not be refreshed:", tourError);
      warnings.push("The landmark was saved, but its generated tour could not be refreshed.");
    }
    try {
      await writeAuditLog({
        actorId: getAuth().currentUser?.uid,
        actorRole: "institution",
        action: "landmark.updated",
        entityType: "landmark",
        entityId: selectedLandmarkId,
        metadata: {
          institutionId,
          name,
          status: formStatus,
          ...(uploadedImage ? { imageFileName: uploadedImage.fileName } : {}),
        },
        throwOnFailure: true,
      });
    } catch (error) {
      console.error("Landmark saved, but its audit record could not be written:", error);
      warnings.push("Its activity record could not be written.");
    }
    try {
      setForm((current) => ({
        ...current,
        name,
        description,
        ...(uploadedImage
          ? {
              imageUrl: uploadedImage.url,
              imageStoragePath: uploadedImage.storagePath,
              imageFileName: uploadedImage.fileName,
              imageFileType: uploadedImage.fileType,
            }
          : {}),
      }));
      setImageFile(null);
      await loadData(institutionId);
    } finally {
      setSaving(false);
    }
    if (warnings.length) setPageError(warnings.join(" "));
    else setPageNotice("Landmark saved.");
  };

  const activePinCoords =
    draftCoords && Number.isFinite(Number(draftCoords.lat)) && Number.isFinite(Number(draftCoords.lng))
      ? [Number(draftCoords.lat), Number(draftCoords.lng)]
      : hasValidCoords(selectedLandmark)
        ? [selectedLandmark.lat, selectedLandmark.lng]
        : DEFAULT_CENTER;

  const landmarkPois = targetLandmark
    ? pois.filter((poi) => poi.landmarkId === targetLandmark.id)
    : [];
  const activeContentIds =
    targetLandmark && selectedLandmarkId === targetLandmark.id
      ? selectedContentIds
      : targetLandmark?.contentIds || [];
  const linkedContentItems = activeContentIds
    .map((id) => allContent.find((item) => item.id === id))
    .filter(Boolean);
  const publishedContentCount = linkedContentItems.filter(
    (item) => item.status === "Published",
  ).length;

  const currentEffectiveStatus = selectedLandmarkId
    ? formStatus
    : targetLandmark?.status === "Published"
      ? "Published"
      : "Unpublished";

  const hasPublishedPoi = pois.some(isPoiPublished);

  if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading landmarks...</div>;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 24px", color: "#ccc" }}>
      <PageHeader
        eyebrow="Experience design"
        title="Landmarks"
        description="Curate landmark details, imagery, Landmark/POI content readiness, publish status, and pin positions for your institution."
      />
      <SetupFlowBanner
        hasLandmarkPinAndInfo={landmarks.some(
          (l) => hasValidCoords(l) && (l.landmarkName || l.institutionName) && (l.info?.description || l.description),
        )}
        hasContentItems={allContent.length > 0}
        hasLinkedLandmarkContent={landmarks.some((l) => Array.isArray(l.contentIds) && l.contentIds.length > 0)}
        hasPoiWithImageAndContent={pois.some(
          (p) => Boolean(p.imageUrl || p.markerImageUrl) && Array.isArray(p.contentIds) && p.contentIds.length > 0,
        )}
        hasFloorPlanOrPlacedPois={pois.some((p) => Boolean(p.floorPlanPosition)) || hasPublishedPoi}
        hasPublishedPoi={hasPublishedPoi}
      />
      {pageError && (
        <div role="alert" style={{ color: "#fbbf24", marginBottom: 16 }}>
          {pageError}
        </div>
      )}
      {pageNotice && (
        <div role="status" style={{ color: "#4ade80", marginBottom: 16 }}>
          {pageNotice}
        </div>
      )}

      {/* PROMINENT LANDMARK PUBLISH / UNPUBLISH CONTROL */}
      {targetLandmark && (
        <section
          aria-label="Landmark publish status"
          style={{
            marginBottom: 22,
            padding: "18px 22px",
            borderRadius: 14,
            background:
              currentEffectiveStatus === "Published"
                ? "rgba(74, 222, 128, 0.07)"
                : "rgba(251, 191, 36, 0.07)",
            border:
              currentEffectiveStatus === "Published"
                ? "1px solid rgba(74, 222, 128, 0.35)"
                : "1px solid rgba(251, 191, 36, 0.35)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a8a29e" }}>
                Landmark Publish Status
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: currentEffectiveStatus === "Published" ? "rgba(74,222,128,0.18)" : "rgba(251,191,36,0.18)",
                  color: currentEffectiveStatus === "Published" ? "#4ade80" : "#fbbf24",
                  border: `1px solid ${currentEffectiveStatus === "Published" ? "#4ade80" : "#fbbf24"}`,
                }}
              >
                {currentEffectiveStatus === "Published" ? "PUBLISHED (LIVE)" : "UNPUBLISHED (HIDDEN)"}
              </span>
            </div>

            <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>
              {targetLandmark.landmarkName || targetLandmark.institutionName || "Selected Landmark"}
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
              <span style={{ color: readiness.hasInfo ? "#4ade80" : "#f87171" }}>
                {readiness.hasInfo ? "✓ Landmark Info & Pin" : "✕ Missing: Landmark Name, Description & Pin"}
              </span>
              <span style={{ color: readiness.hasLandmarkInformation ? "#4ade80" : "#f87171" }}>
                {readiness.hasLandmarkInformation ? "✓ Landmark Information" : "✕ Landmark Area Missing: Information"}
              </span>
              <span style={{ color: readiness.hasLandmarkQuiz ? "#4ade80" : "#f87171" }}>
                {readiness.hasLandmarkQuiz ? "✓ Landmark Quiz" : "✕ Landmark Area Missing: Quiz"}
              </span>
              <span style={{ color: readiness.hasLandmarkFunFact ? "#4ade80" : "#f87171" }}>
                {readiness.hasLandmarkFunFact ? "✓ Landmark Fun Fact" : "✕ Landmark Area Missing: Fun Fact"}
              </span>
              <span style={{ color: readiness.hasLandmarkVR ? "#4ade80" : "#f87171" }}>
                {readiness.hasLandmarkVR ? "✓ Landmark VR Model" : "✕ Landmark Area Missing: VR Model"}
              </span>
              <span style={{ color: readiness.hasCompletePoi ? "#4ade80" : "#f87171" }}>
                {readiness.hasCompletePoi ? "✓ POI Area (Published POI with Info, Quiz & Fun Fact)" : "✕ POI Area Missing: 1 Published POI with Info, Quiz & Fun Fact"}
              </span>
            </div>

            {!readiness.canPublish && (
              <small style={{ color: "#fbbf24", fontSize: 12.5 }}>
                Publishing requires complete landmark info, Landmark-area Information + Quiz + Fun Fact + published VR model, and at least 1 published POI with POI-area Information + Quiz + Fun Fact. Missing:{" "}
                {readiness.missing.join("; ")}.
              </small>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <select
              aria-label="Landmark publish status"
              className={commonStyles.formControl}
              value={currentEffectiveStatus}
              disabled={!selectedLandmarkId || updatingStatus || saving}
              onChange={(e) => applyLandmarkPublishStatus(e.target.value)}
              style={{ minWidth: 210, fontWeight: 600 }}
            >
              <option value="Unpublished">Unpublished (Hide)</option>
              <option value="Published" disabled={!readiness.canPublish}>
                Published {readiness.canPublish ? "" : "(Incomplete)"}
              </option>
            </select>

            {currentEffectiveStatus === "Published" ? (
              <button
                type="button"
                className={commonStyles.btnOutline}
                disabled={!selectedLandmarkId || updatingStatus || saving}
                onClick={() => applyLandmarkPublishStatus("Unpublished")}
              >
                {updatingStatus ? "Updating..." : "Unpublish / Hide"}
              </button>
            ) : (
              <button
                type="button"
                className={commonStyles.btnPrimary}
                disabled={!selectedLandmarkId || updatingStatus || saving || !readiness.canPublish}
                onClick={() => applyLandmarkPublishStatus("Published")}
                title={
                  readiness.canPublish
                    ? "Publish this landmark to Firestore"
                    : `Missing: ${readiness.missing.join("; ")}`
                }
              >
                {updatingStatus ? "Publishing..." : "Publish Landmark"}
              </button>
            )}
          </div>
        </section>
      )}

      <p style={{ color: "#999", margin: "0 0 20px", fontSize: 14 }}>
        Admin-created map pins are associated with your institution. Select a landmark below to edit its details, assign content, manage publish status, or adjust its pin.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
          gap: 24,
          alignItems: "start",
        }}
      >
        <form
          onSubmit={saveLandmark}
          className={commonStyles.contentCard}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: 22,
            borderRadius: 14,
            border: "1px solid #39352c",
          }}
        >
          <h2 style={{ color: "#f3d16f", fontSize: 19, margin: 0 }}>Configure landmark</h2>
          <select
            className={commonStyles.formControl}
            value={selectedLandmarkId}
            onChange={(e) => {
              const landmark = landmarks.find((item) => item.id === e.target.value);
              if (landmark) selectLandmark(landmark);
              else {
                setSelectedLandmarkId("");
                setDraftCoords(null);
                setFormStatus("Unpublished");
              }
            }}
            required
          >
            <option value="">Select admin map pin</option>
            {landmarks.map((landmark) => (
              <option key={landmark.id} value={landmark.id}>
                {landmark.landmarkName || landmark.institutionName} (
                {landmark.status === "Published" ? "Published" : "Unpublished"})
              </option>
            ))}
          </select>

          <div>
            <label htmlFor="landmark-status-select" style={{ color: "#fff", display: "block", marginBottom: 6 }}>
              Status
            </label>
            <select
              id="landmark-status-select"
              className={commonStyles.formControl}
              value={formStatus}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "Published" && !readiness.canPublish) {
                  setPageError(
                    `Cannot set status to Published yet. Missing: ${readiness.missing.join("; ")}.`,
                  );
                  return;
                }
                setPageError("");
                setFormStatus(next);
              }}
            >
              <option value="Unpublished">Unpublished (Hidden)</option>
              <option value="Published" disabled={!readiness.canPublish}>
                Published {!readiness.canPublish ? `(${readiness.missing.join("; ")})` : ""}
              </option>
            </select>
            <small style={{ display: "block", color: "#888", marginTop: 4 }}>
              Requires Landmark-area Information, Quiz, Fun Fact, and published VR model, plus at least 1 published POI with POI-area Information, Quiz, and Fun Fact.
            </small>
          </div>

          <input
            className={commonStyles.formControl}
            placeholder="Landmark name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            required
          />
          <textarea
            className={commonStyles.formControl}
            placeholder="Landmark information"
            rows={3}
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            required
          />

          <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <label htmlFor="landmark-image" style={{ color: "#fff", display: "block", marginBottom: 6 }}>
              Landmark picture
            </label>
            <input
              id="landmark-image"
              key={selectedLandmarkId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                  setPageError("Choose a PNG, JPG, or WEBP landmark picture.");
                  event.target.value = "";
                  return;
                }
                if (file.size > 10 * 1024 * 1024) {
                  setPageError("Landmark pictures must be 10 MB or smaller.");
                  event.target.value = "";
                  return;
                }
                setImageFile(file);
                setPageError("");
              }}
              style={{ color: "#ccc" }}
            />
            <small style={{ display: "block", color: "#888", marginTop: 6 }}>
              PNG, JPG, or WEBP, max 10 MB. Uploads when you click Save Landmark.
            </small>
            {imageFile && (
              <small style={{ display: "block", color: "#4ade80", marginTop: 4 }}>
                Selected: {imageFile.name}
              </small>
            )}
            {!imageFile && form.imageFileName && (
              <small style={{ display: "block", color: "#888", marginTop: 4 }}>
                Current picture: {form.imageFileName}
              </small>
            )}
            {(imagePreview || form.imageUrl) && (
              <img
                src={imagePreview || form.imageUrl}
                alt="Landmark picture preview"
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: 150,
                  objectFit: "contain",
                  marginTop: 10,
                  borderRadius: 6,
                  background: "#111",
                }}
              />
            )}
          </div>

          <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <label style={{ color: "#fff", display: "block", marginBottom: 4 }}>Assign Existing Landmark Content (Area: Landmark)</label>
            <small style={{ display: "block", color: "#888", marginBottom: 8 }}>
              Must include Landmark-area Information, Quiz, Fun Fact, and VR model (up to 1 Information, 1 Quiz, and 1 VR model per Landmark; Fun Facts are unlimited).
            </small>
            {availableContent.length === 0 ? (
              <small style={{ color: "#888" }}>No Landmark-area content found.</small>
            ) : (
              availableContent.map((item) => {
                const isSelected = selectedContentIds.includes(item.id);
                const limitError = isSelected
                  ? ""
                  : getContentAssignmentLimitError("Landmark", [...selectedContentIds, item.id], availableContent);
                return (
                  <div key={item.id} style={{ padding: "4px 0" }}>
                    <label style={{ display: "flex", gap: 8, color: "#ccc", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={Boolean(limitError)}
                        onChange={() => {
                          const nextIds = selectedContentIds.includes(item.id)
                            ? selectedContentIds.filter((id) => id !== item.id)
                            : [...selectedContentIds, item.id];
                          setSelectedContentIds(nextIds);
                          const nextCheck = evaluateLandmarkReadiness(selectedLandmark, {
                            contents: allContent,
                            pois,
                            overrideLandmarkContentIds: nextIds,
                            overrideName: form.name,
                            overrideDescription: form.description,
                            overrideCoords: draftCoords,
                          });
                          if (!nextCheck.canPublish && formStatus === "Published") {
                            setFormStatus("Unpublished");
                          }
                        }}
                      />
                      {item.title} ({item.type} · Landmark)
                    </label>
                    {limitError && (
                      <small style={{ display: "block", color: "#fbbf24", marginLeft: 22 }}>{limitError}</small>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <label style={{ color: "#fff", display: "block", marginBottom: 6 }}>
              Pin Location (drag pin or click map anytime)
            </label>
            <MapContainer
              key={selectedLandmarkId ? `pin-${selectedLandmarkId}` : "pin-unselected"}
              center={activePinCoords}
              zoom={15}
              maxBounds={CEBU_BOUNDS}
              style={{ height: 220, width: "100%", borderRadius: 8 }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap"
              />
              <PinPlacementEvents
                enabled={Boolean(selectedLandmarkId)}
                onPickCoords={(coords) => setDraftCoords(coords)}
              />
              {selectedLandmarkId && (
                <Marker
                  position={activePinCoords}
                  icon={landmarkPinIcon}
                  draggable={true}
                  eventHandlers={{
                    dragend: (event) => {
                      const latlng = event.target.getLatLng();
                      setDraftCoords({
                        lat: Number(latlng.lat.toFixed(6)),
                        lng: Number(latlng.lng.toFixed(6)),
                      });
                    },
                  }}
                />
              )}
            </MapContainer>
            {selectedLandmarkId && draftCoords && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <small style={{ color: "#aaa" }}>
                  {Number(draftCoords.lat).toFixed(6)}, {Number(draftCoords.lng).toFixed(6)}
                </small>
                <button
                  type="button"
                  className={commonStyles.btnOutline}
                  disabled={saving || savingPinLocation}
                  onClick={handleSavePinLocation}
                >
                  {savingPinLocation ? "Saving pin..." : "Save Pin Position"}
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              paddingTop: 6,
            }}
          >
            <small style={{ color: "#888" }}>
              Saves landmark status, info, image, and content links.
            </small>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selectedLandmarkId && (
                <button
                  type="button"
                  className={commonStyles.btnOutline}
                  disabled={saving || savingPinLocation || updatingStatus}
                  onClick={() => selectLandmark(selectedLandmark)}
                >
                  Reload Landmark
                </button>
              )}
              <button
                type="submit"
                className={commonStyles.btnPrimary}
                disabled={saving || savingPinLocation || updatingStatus || !selectedLandmarkId}
              >
                {saving ? "Saving..." : "Save Landmark"}
              </button>
            </div>
          </div>
        </form>

        <div
          className={commonStyles.contentCard}
          style={{ padding: 20, borderRadius: 14, border: "1px solid #39352c" }}
        >
          <h2 style={{ color: "#f3d16f", fontSize: 19, marginTop: 0, marginBottom: 6 }}>
            Connected Summary
          </h2>
          <p style={{ color: "#999", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
            See which POIs and Landmark-area content items are currently linked to{" "}
            <strong style={{ color: "#fff" }}>
              {targetLandmark?.landmarkName || targetLandmark?.institutionName || "your landmark"}
            </strong>
            .
          </p>

          {!targetLandmark ? (
            <p style={{ color: "#888", fontSize: 13 }}>No landmark available yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                <div style={{ padding: 12, borderRadius: 10, background: "#141210", border: "1px solid #2e2a24" }}>
                  <div style={{ fontSize: 11, color: "#a8a29e" }}>Connected POIs</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#f3d16f", marginTop: 4 }}>
                    {landmarkPois.length}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: "#141210", border: "1px solid #2e2a24" }}>
                  <div style={{ fontSize: 11, color: "#a8a29e" }}>Assigned Content</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginTop: 4 }}>
                    {linkedContentItems.length}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: "#141210", border: "1px solid #2e2a24" }}>
                  <div style={{ fontSize: 11, color: "#a8a29e" }}>Published Items</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#4ade80", marginTop: 4 }}>
                    {publishedContentCount}
                  </div>
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 10, background: "#141210", border: "1px solid #2e2a24" }}>
                <h3 style={{ color: "#fff", fontSize: 14, margin: "0 0 8px" }}>
                  POIs under this landmark ({landmarkPois.length})
                </h3>
                {landmarkPois.length === 0 ? (
                  <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
                    No POIs linked to this landmark yet. Add at least 1 published POI with POI-area Information, Quiz, and Fun Fact in <strong>POI Management</strong>.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#d6d3d1", fontSize: 13, lineHeight: 1.6 }}>
                    {landmarkPois.map((poi) => {
                      const poiComplete = isPoiContentComplete(poi, allContent);
                      return (
                        <li key={poi.id}>
                          <strong style={{ color: "#fff" }}>{poi.name || "Unnamed POI"}</strong>
                          <span style={{ color: isPoiPublished(poi) ? "#4ade80" : "#fbbf24", fontSize: 12, marginLeft: 6 }}>
                            · {isPoiPublished(poi) ? "Published" : "Unpublished"}
                          </span>
                          <span style={{ color: poiComplete ? "#4ade80" : "#fbbf24", fontSize: 12, marginLeft: 6 }}>
                            · {poiComplete ? "POI Content Complete" : "Needs POI Info, Quiz & Fun Fact"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div style={{ padding: 14, borderRadius: 10, background: "#141210", border: "1px solid #2e2a24" }}>
                <h3 style={{ color: "#fff", fontSize: 14, margin: "0 0 8px" }}>
                  Assigned Landmark Content ({linkedContentItems.length})
                </h3>
                {linkedContentItems.length === 0 ? (
                  <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
                    No landmark content assigned yet. Check items under <strong>Assign Existing Landmark Content</strong> and save.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#d6d3d1", fontSize: 13, lineHeight: 1.65 }}>
                    {linkedContentItems.map((item) => {
                      const isPub = item.status === "Published";
                      return (
                        <li key={item.id}>
                          <strong style={{ color: "#fff" }}>{item.title}</strong>{" "}
                          <span style={{ color: "#a8a29e" }}>({item.type} · {getContentScope(item)})</span>{" "}
                          <span
                            style={{
                              color: isPub ? "#4ade80" : "#fbbf24",
                              fontSize: 12,
                              marginLeft: 4,
                            }}
                          >
                            · {isPub ? "Published" : item.status || "Unpublished"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 18,
          background: "#1a1714",
          borderRadius: 12,
          border: "1px solid #39352c",
        }}
      >
        <h3 style={{ color: "#f3d16f", marginTop: 0, marginBottom: 12 }}>Institution Landmarks</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {landmarks.map((landmark) => {
            const isSelected = selectedLandmarkId === landmark.id;
            const isPub = landmark.status === "Published";
            return (
              <div
                key={landmark.id}
                onClick={() => selectLandmark(landmark)}
                style={{
                  cursor: "pointer",
                  padding: 16,
                  borderRadius: 12,
                  border: isSelected ? "2px solid #d4af37" : "1px solid #39352c",
                  background: isSelected ? "rgba(212, 175, 55, 0.1)" : "#141210",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <h4 style={{ color: "#fff", margin: 0, fontSize: 16 }}>
                    {landmark.landmarkName || landmark.institutionName}
                  </h4>
                  <span
                    style={{
                      color: isPub ? "#4ade80" : "#fbbf24",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isPub ? "Published" : "Unpublished"}
                  </span>
                </div>
                {(landmark.info?.description || landmark.description) && (
                  <p style={{ color: "#a8a29e", fontSize: 13, margin: "0 0 10px", lineHeight: 1.45 }}>
                    {landmark.info?.description || landmark.description}
                  </p>
                )}
                <div style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
                  {landmark.contentIds?.length || 0} content items linked
                </div>
                {isSelected && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10 }}>
                    <LandmarkDiscussion
                      institutionId={institutionId}
                      landmarkId={landmark.id}
                      title={`Discussion: ${landmark.landmarkName || landmark.institutionName}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {landmarks.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#888", padding: 32 }}>
              No landmarks created yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandmarkManagement;