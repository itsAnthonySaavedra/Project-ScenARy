import React, { useCallback, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../../lib/firebase";
import { deleteStorageFile, uploadStorageFile } from "../../lib/storageUpload";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import commonStyles from "../../components/common/Common.module.css";
import PageHeader from "../../components/common/PageHeader";
import SetupFlowBanner from "../../components/common/SetupFlowBanner";
import LandmarkDiscussion from "../../components/common/LandmarkDiscussion";
import { getContentScope } from "../../lib/contentScope";
import { getContentAssignmentLimitError } from "../../lib/contentTypes";
import { writeAuditLog } from "../../lib/auditLog";
import { syncGeneratedInstitutionTour } from "../../lib/generatedTours";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";

L.Marker.prototype.options.icon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
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
      setDraftCoords(
        hasValidCoords(landmark)
          ? { lat: landmark.lat, lng: landmark.lng }
          : { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] },
      );
      setPageNotice("");
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
    const assignmentLimitError = getContentAssignmentLimitError(
      "Landmark",
      selectedContentIds,
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
      await updateDoc(doc(db, "landmarks", selectedLandmarkId), {
        landmarkName: name,
        description,
        info: { description },
        ...coordUpdates,
        imageUrl: uploadedImage?.url || form.imageUrl,
        imageStoragePath: uploadedImage?.storagePath || form.imageStoragePath,
        imageFileName: uploadedImage?.fileName || form.imageFileName,
        imageFileType: uploadedImage?.fileType || form.imageFileType,
        contentIds: selectedContentIds.filter((contentId) =>
          availableContent.some((item) => item.id === contentId),
        ),
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

  const selectedLandmark = landmarks.find((item) => item.id === selectedLandmarkId);
  const activePinCoords =
    draftCoords && Number.isFinite(Number(draftCoords.lat)) && Number.isFinite(Number(draftCoords.lng))
      ? [Number(draftCoords.lat), Number(draftCoords.lng)]
      : hasValidCoords(selectedLandmark)
        ? [selectedLandmark.lat, selectedLandmark.lng]
        : DEFAULT_CENTER;

  const targetLandmark = selectedLandmark || landmarks[0];
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

  if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading landmarks...</div>;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 24px", color: "#ccc" }}>
      <PageHeader
        eyebrow="Experience design"
        title="Landmarks"
        description="Curate landmark details, imagery, AR content, and pin positions for your institution."
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
        hasFloorPlanOrPlacedPois={pois.some((p) => Boolean(p.floorPlanPosition))}
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
      <p style={{ color: "#999", margin: "0 0 20px", fontSize: 14 }}>
        Admin-created map pins are associated with your institution. Select a landmark below to edit its details, assign content, or adjust its pin.
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
              }
            }}
            required
          >
            <option value="">Select admin map pin</option>
            {landmarks.map((landmark) => (
              <option key={landmark.id} value={landmark.id}>
                {landmark.landmarkName || landmark.institutionName}
              </option>
            ))}
          </select>
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
            <label style={{ color: "#fff", display: "block", marginBottom: 4 }}>Assign Existing Content</label>
            <small style={{ display: "block", color: "#888", marginBottom: 8 }}>
              Up to 1 Information, 1 Quiz, and 1 VR model per Landmark. Fun Facts are unlimited.
            </small>
            {availableContent.length === 0 ? (
              <small style={{ color: "#888" }}>No reusable landmark content found.</small>
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
                        onChange={() =>
                          setSelectedContentIds((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id],
                          )
                        }
                      />
                      {item.title} ({item.type})
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
              Saves landmark info, image, and content links.
            </small>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selectedLandmarkId && (
                <button
                  type="button"
                  className={commonStyles.btnOutline}
                  disabled={saving || savingPinLocation}
                  onClick={() => selectLandmark(selectedLandmark)}
                >
                  Reload Landmark
                </button>
              )}
              <button
                type="submit"
                className={commonStyles.btnPrimary}
                disabled={saving || savingPinLocation || !selectedLandmarkId}
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
            See which POIs and content items are currently linked to{" "}
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
                  <div style={{ fontSize: 11, color: "#a8a29e" }}>Published</div>
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
                    No POIs linked to this landmark yet. Add them in <strong>POI Management</strong>.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#d6d3d1", fontSize: 13, lineHeight: 1.6 }}>
                    {landmarkPois.map((poi) => (
                      <li key={poi.id}>
                        <strong style={{ color: "#fff" }}>{poi.name || "Unnamed POI"}</strong>
                        {Array.isArray(poi.contentIds) && poi.contentIds.length > 0 && (
                          <span style={{ color: "#a8a29e" }}>
                            {" "}
                            · {poi.contentIds.length} POI item{poi.contentIds.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ padding: 14, borderRadius: 10, background: "#141210", border: "1px solid #2e2a24" }}>
                <h3 style={{ color: "#fff", fontSize: 14, margin: "0 0 8px" }}>
                  Assigned Landmark Content ({linkedContentItems.length})
                </h3>
                {linkedContentItems.length === 0 ? (
                  <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
                    No landmark content assigned yet. Check items under <strong>Assign Existing Content</strong> and save.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#d6d3d1", fontSize: 13, lineHeight: 1.65 }}>
                    {linkedContentItems.map((item) => {
                      const isPub = item.status === "Published";
                      return (
                        <li key={item.id}>
                          <strong style={{ color: "#fff" }}>{item.title}</strong>{" "}
                          <span style={{ color: "#a8a29e" }}>({item.type})</span>{" "}
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
                  <span style={{ color: "#d4af37", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {isSelected ? "● Selected" : "○ Select"}
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