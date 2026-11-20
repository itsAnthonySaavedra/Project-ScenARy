import React, { useCallback, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../../lib/firebase";
import { deleteStorageFile, uploadStorageFile } from "../../lib/storageUpload";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import commonStyles from "../../components/common/Common.module.css";
import PageHeader from "../../components/common/PageHeader";
import LandmarkDiscussion from "../../components/common/LandmarkDiscussion";
import { getContentScope } from "../../lib/contentScope";
import { getContentAssignmentLimitError } from "../../lib/contentTypes";
import { buildGeneratedExperiences } from "../../lib/generatedExperiences";
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

  const generatedExperiences = buildGeneratedExperiences(landmarks, pois, allContent);
  const selectedLandmark = landmarks.find((item) => item.id === selectedLandmarkId);
  const activePinCoords =
    draftCoords && Number.isFinite(Number(draftCoords.lat)) && Number.isFinite(Number(draftCoords.lng))
      ? [Number(draftCoords.lat), Number(draftCoords.lng)]
      : hasValidCoords(selectedLandmark)
        ? [selectedLandmark.lat, selectedLandmark.lng]
        : DEFAULT_CENTER;
  const overviewCenter = hasValidCoords(landmarks[0]) ? [landmarks[0].lat, landmarks[0].lng] : DEFAULT_CENTER;

  if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading landmarks...</div>;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px", color: "#ccc" }}>
      <PageHeader
        eyebrow="Experience design"
        title="Landmarks"
        description="Curate landmark details, imagery, AR content, and pin positions for your institution."
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
      <p style={{ color: "#999", margin: "0 0 24px", fontSize: 14 }}>
        Admin-created map pins are associated with your institution. You can reposition any of your institution&apos;s pins as often as needed by dragging or clicking the pin map.
      </p>
      <div
        className={commonStyles.contentCard}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 30,
          alignItems: "start",
          padding: "24px",
          borderRadius: 14,
          border: "1px solid #39352c",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <form
          onSubmit={saveLandmark}
          className={commonStyles.contentCard}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "22px",
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
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            required
          />
          <div>
            <label htmlFor="landmark-image" style={{ color: "#fff", display: "block", marginBottom: 8 }}>
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
              PNG, JPG, or WEBP. Maximum 10 MB. The picture uploads when you save.
            </small>
            {imageFile && (
              <small style={{ display: "block", color: "#4ade80", marginTop: 6 }}>
                Selected: {imageFile.name}
              </small>
            )}
            {!imageFile && form.imageFileName && (
              <small style={{ display: "block", color: "#888", marginTop: 6 }}>
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
                  maxHeight: 180,
                  objectFit: "contain",
                  marginTop: 10,
                  borderRadius: 4,
                  background: "#111",
                }}
              />
            )}
          </div>
          <div>
            <label style={{ color: "#fff", display: "block", marginBottom: 8 }}>Assign Existing Content</label>
            <small style={{ display: "block", color: "#888", marginBottom: 6 }}>
              Assign at most one Information item, one Quiz, and one VR model per Landmark. Fun Facts are unlimited.
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
                  <div key={item.id} style={{ padding: "6px 0" }}>
                    <label style={{ display: "flex", gap: 8, color: "#ccc" }}>
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

          <div>
            <label style={{ color: "#fff", display: "block", marginBottom: 6 }}>
              Pin Location (drag pin or click map to adjust anytime)
            </label>
            <MapContainer
              key={selectedLandmarkId ? `pin-${selectedLandmarkId}` : "pin-unselected"}
              center={activePinCoords}
              zoom={15}
              maxBounds={CEBU_BOUNDS}
              style={{ height: 260, width: "100%" }}
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
                  Coordinates: {Number(draftCoords.lat).toFixed(6)}, {Number(draftCoords.lng).toFixed(6)}
                </small>
                <button
                  type="button"
                  className={commonStyles.btnPrimary}
                  disabled={saving || savingPinLocation}
                  onClick={handleSavePinLocation}
                >
                  {savingPinLocation ? "Saving pin..." : "Save Pin Position"}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <small style={{ color: "#888" }}>
              Your institution can update this marker&apos;s coordinates whenever needed.
            </small>
            {selectedLandmarkId && (
              <button
                type="button"
                className={commonStyles.btnPrimary}
                disabled={saving}
                onClick={() => selectLandmark(selectedLandmark)}
              >
                {saving ? "Saving..." : "Reload Landmark"}
              </button>
            )}
          </div>
        </form>

        <div
          className={commonStyles.contentCard}
          style={{ padding: 16, borderRadius: 14, border: "1px solid #39352c" }}
        >
          <MapContainer center={overviewCenter} zoom={15} style={{ height: 420, width: "100%" }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
            />
            {landmarks.filter(hasValidCoords).map((landmark) => (
              <Marker key={landmark.id} position={[landmark.lat, landmark.lng]}>
                <Popup>
                  <div style={{ color: "#111827", minWidth: 220, textAlign: "center" }}>
                    <strong style={{ fontSize: "1rem" }}>
                      {landmark.landmarkName || landmark.institutionName}
                    </strong>
                    {landmark.imageUrl && (
                      <img
                        src={landmark.imageUrl}
                        alt={landmark.landmarkName || landmark.institutionName || "Landmark"}
                        style={{
                          width: "100%",
                          maxHeight: "140px",
                          objectFit: "cover",
                          borderRadius: "4px",
                          marginTop: "8px",
                        }}
                      />
                    )}
                    {(landmark.info?.description || landmark.description) && (
                      <p style={{ margin: "8px 0", color: "#4b5563", fontSize: "0.9rem", lineHeight: 1.4 }}>
                        {landmark.info?.description || landmark.description}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          <div style={{ marginTop: 18 }}>
            <h2 style={{ color: "#f3d16f", fontSize: 19 }}>Experience preview</h2>
            {generatedExperiences.map((experience) => (
              <div key={experience.id} style={{ padding: 10, borderBottom: "1px solid #333" }}>
                <strong>{experience.title}</strong>
                <span style={{ color: "#888" }}>
                  {" "}
                  ({experience.poiCount} POIs, {experience.contentItems.length} published items)
                </span>
                {experience.contentItems.length > 0 ? (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "#aaa" }}>
                    {experience.contentItems.map((item) => (
                      <li key={item.id}>{item.title}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ color: "#888", marginTop: 6 }}>
                    The AR and VR items will appear together after both are ready and approved.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "#1a1714",
            borderRadius: 12,
            border: "1px solid #39352c",
          }}
        >
          <h3 style={{ color: "#f3d16f", marginTop: 0, marginBottom: 12 }}>Landmarks</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {landmarks.map((landmark) => (
              <div
                key={landmark.id}
                onClick={() => selectLandmark(landmark)}
                style={{
                  cursor: "pointer",
                  padding: 16,
                  borderRadius: 12,
                  border: selectedLandmarkId === landmark.id ? "2px solid #d4af37" : "1px solid #39352c",
                  background: selectedLandmarkId === landmark.id ? "rgba(212, 175, 55, 0.1)" : "transparent",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (selectedLandmarkId !== landmark.id) {
                    e.currentTarget.style.borderColor = "#d4af37";
                    e.currentTarget.style.background = "rgba(212, 175, 55, 0.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedLandmarkId !== landmark.id) {
                    e.currentTarget.style.borderColor = "#39352c";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <h4 style={{ color: "#fff", margin: 0, fontSize: 16 }}>
                    {landmark.landmarkName || landmark.institutionName}
                  </h4>
                  <span style={{ color: "#d4af37", fontSize: 12, fontWeight: 600 }}>
                    {selectedLandmarkId === landmark.id ? "● Selected" : "○ Click to select"}
                  </span>
                </div>
                {landmark.info?.description && (
                  <p style={{ color: "#a8a29e", fontSize: 13, margin: 0, marginBottom: 12, lineHeight: 1.5 }}>
                    {landmark.info.description}
                  </p>
                )}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ color: "#888", fontSize: 12 }}>
                    {landmark.contentIds?.length || 0} content items
                  </span>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <LandmarkDiscussion
                    institutionId={institutionId}
                    landmarkId={landmark.id}
                    title={`Discussion: ${landmark.landmarkName || landmark.institutionName}`}
                  />
                </div>
              </div>
            ))}
            {landmarks.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#888", padding: 32 }}>
                No landmarks created yet. Create one to begin building your virtual tour.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandmarkManagement;