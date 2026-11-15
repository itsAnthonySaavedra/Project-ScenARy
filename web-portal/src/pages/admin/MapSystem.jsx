import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { deleteStorageFile, uploadStorageFile } from "../../lib/storageUpload";
import { buildGeneratedExperiences } from "../../lib/generatedExperiences";
import { syncGeneratedInstitutionTour } from "../../lib/generatedTours";
import { isInstitutionActive } from "../../lib/institutionStatus";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const mapPinIcon = L.divIcon({
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

const cebuBounds = [
  [9.3826, 123.2324],
  [11.35, 124.1],
];

const MapSystem = () => {
  const [markers, setMarkers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempCoords, setTempCoords] = useState(null);
  const [landmarkName, setLandmarkName] = useState("");
  const [description, setDescription] = useState("");
  const [markerImage, setMarkerImage] = useState(null);
  const [markerImagePreview, setMarkerImagePreview] = useState("");
  const [savingMarker, setSavingMarker] = useState(false);
  const [markerFormError, setMarkerFormError] = useState("");
  const [landmarkNameDrafts, setLandmarkNameDrafts] = useState({});
  const [mapLoadErrors, setMapLoadErrors] = useState({ institutions: "", landmarks: "" });

  const [activeExperiences, setActiveExperiences] = useState({});
  const [loadingExperiences, setLoadingExperiences] = useState({});
  const [experienceErrors, setExperienceErrors] = useState({});
  const activeInstitutionIds = new Set(
    institutions.filter(isInstitutionActive).map((institution) => institution.id),
  );
  const activeMarkers = markers.filter((marker) => activeInstitutionIds.has(marker.institutionId));

  useEffect(() => {
    if (!markerImage) {
      setMarkerImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(markerImage);
    setMarkerImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [markerImage]);

  useEffect(() => {
    const unsubInst = onSnapshot(
      collection(db, "institutions"),
      (snapshot) => {
        setInstitutions(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
        setMapLoadErrors((current) => ({ ...current, institutions: "" }));
      },
      (error) => {
        console.error("Unable to load institutions for the map:", error);
        setMapLoadErrors((current) => ({
          ...current,
          institutions: getFirebaseErrorMessage(
            error,
            "Unable to load institutions. Map pins may be unavailable.",
          ),
        }));
      },
    );

    const unsubMarkers = onSnapshot(
      collection(db, "landmarks"),
      (snapshot) => {
        setMarkers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setMapLoadErrors((current) => ({ ...current, landmarks: "" }));
      },
      (error) => {
        console.error("Unable to load landmarks for the map:", error);
        setMapLoadErrors((current) => ({
          ...current,
          landmarks: getFirebaseErrorMessage(
            error,
            "Unable to load landmarks. Map pins may be unavailable.",
          ),
        }));
      },
    );

    return () => {
      unsubInst();
      unsubMarkers();
    };
  }, []);

  const handleMarkerClick = async (institutionId) => {
    if (Object.hasOwn(activeExperiences, institutionId)) return;

    setLoadingExperiences((prev) => ({ ...prev, [institutionId]: true }));
    try {
      const [poiSnap, contentSnap] = await Promise.all([
        getDocs(query(collection(db, "pois"), where("institutionId", "==", institutionId.trim()))),
        getDocs(query(collection(db, "content"), where("institutionId", "==", institutionId.trim()))),
      ]);
      const institutionLandmarks = markers.filter(
        (marker) => marker.institutionId === institutionId,
      );
      const experiences = buildGeneratedExperiences(
        institutionLandmarks,
        poiSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
        contentSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
      );
      setActiveExperiences((prev) => ({ ...prev, [institutionId]: experiences }));
      setExperienceErrors((prev) => ({ ...prev, [institutionId]: "" }));
    } catch (err) {
      console.error("Error generating landmark experiences:", err);
      setExperienceErrors((prev) => ({
        ...prev,
        [institutionId]: getFirebaseErrorMessage(
          err,
          "Unable to load available experiences for this institution.",
        ),
      }));
    } finally {
      setLoadingExperiences((prev) => ({ ...prev, [institutionId]: false }));
    }
  };

  const confirmAddMarker = async (instId, instName) => {
    if (!tempCoords || !landmarkName.trim()) {
      setMarkerFormError("Choose a map location and enter a landmark name.");
      return;
    }
    const trimmedLandmarkName = landmarkName.trim();
    const trimmedDescription = description.trim();
    setSavingMarker(true);
    setMarkerFormError("");
    let uploadedImage = null;
    let landmarkSaved = false;
    try {
      uploadedImage = markerImage
        ? await uploadStorageFile(markerImage, `markers/${instId}`)
        : null;
      await addDoc(collection(db, "landmarks"), {
        lat: parseFloat(tempCoords.lat),
        lng: parseFloat(tempCoords.lng),
        createdAt: serverTimestamp(),
        institutionId: instId,
        institutionName: instName,
        landmarkName: trimmedLandmarkName,
        description: trimmedDescription,
        info: { description: trimmedDescription },
        ...(uploadedImage ? { imageUrl: uploadedImage.url, imageStoragePath: uploadedImage.storagePath, imageFileName: uploadedImage.fileName, imageFileType: uploadedImage.fileType } : {}),
      });
      landmarkSaved = true;
      try {
        await syncGeneratedInstitutionTour(instId);
      } catch (tourError) {
        console.error("Landmark saved, but its generated tour could not be refreshed:", tourError);
        alert("The landmark was saved, but its generated tour could not be refreshed.");
      }
      setIsModalOpen(false);
      setTempCoords(null);
      setLandmarkName("");
      setDescription("");
      setMarkerImage(null);
      setMarkerFormError("");
    } catch (err) {
      console.error("Error saving marker:", err);
      if (uploadedImage && !landmarkSaved) {
        try {
          await deleteStorageFile(uploadedImage.storagePath);
        } catch (cleanupError) {
          console.error("Unable to clean up the uploaded landmark image after save failed:", cleanupError);
        }
      }
      setMarkerFormError(
        getFirebaseErrorMessage(err, "Unable to save the landmark. Check your connection and permissions."),
      );
    } finally {
      setSavingMarker(false);
    }
  };

  const removeMarker = async (docId) => {
    try {
      const institutionId = markers.find((marker) => marker.id === docId)?.institutionId;
      await deleteDoc(doc(db, "landmarks", docId));
      if (institutionId) {
        try {
          await syncGeneratedInstitutionTour(institutionId);
        } catch (tourError) {
          console.error("Landmark deleted, but its generated tour could not be refreshed:", tourError);
          alert("The landmark was deleted, but its generated tour could not be refreshed.");
        }
      }
    } catch (err) {
      console.error("Unable to delete landmark:", err);
      alert(getFirebaseErrorMessage(err, "Unable to delete the landmark. Please try again."));
    }
  };

  const updateLandmarkName = async (markerId, value) => {
    const trimmedName = value.trim();
    if (!trimmedName) return;
    try {
      await updateDoc(doc(db, "landmarks", markerId), {
        landmarkName: trimmedName,
        updatedAt: serverTimestamp(),
      });
      const institutionId = markers.find((marker) => marker.id === markerId)?.institutionId;
      if (institutionId) {
        try {
          await syncGeneratedInstitutionTour(institutionId);
        } catch (tourError) {
          console.error("Landmark name updated, but its generated tour could not be refreshed:", tourError);
          alert("The landmark name was updated, but its generated tour could not be refreshed.");
        }
      }
    } catch (err) {
      console.error("Error updating landmark name:", err);
      alert(getFirebaseErrorMessage(err, "Unable to update the landmark name. Please try again."));
    }
  };

  function MapEvents() {
    useMapEvents({
      click: (e) => {
        setTempCoords(e.latlng);
        setMarkerFormError("");
        setIsModalOpen(true);
      },
    });
    return null;
  }

  return (
    <div
      className="chart-card full-width"
      style={{ position: "relative", height: "750px", overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "1rem",
        }}
      >
        <h3 style={{ color: "#d4af37", margin: 0 }}>Cebu Pin Management</h3>
        <small style={{ color: "#855e2e" }}>Locked to Cebu Province</small>
      </div>
      {Object.entries(mapLoadErrors).filter(([, error]) => error).map(([source, error]) => (
        <div key={source} role="alert" style={{ color: "#fca5a5", padding: "0 1rem 1rem" }}>
          {error}
        </div>
      ))}

      <MapContainer
        center={[10.3157, 123.8854]}
        zoom={12}
        minZoom={9}
        maxBounds={cebuBounds}
        maxBoundsViscosity={1.0}
        style={{ height: "600px", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        <MapEvents />

        {activeMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={mapPinIcon}
            eventHandlers={{
              click: () => handleMarkerClick(marker.institutionId),
            }} // NEW EVENT HANDLER
          >
            <Popup>
              <div
                style={{
                  color: "#000",
                  textAlign: "center",
                  minWidth: "180px",
                }}
              >
                <strong style={{ fontSize: "1.05rem" }}>
                  {marker.landmarkName || marker.institutionName}
                </strong>
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  <input
                    aria-label="Landmark name"
                    value={landmarkNameDrafts[marker.id] ?? marker.landmarkName ?? marker.institutionName ?? ""}
                    onChange={(event) => setLandmarkNameDrafts((current) => ({ ...current, [marker.id]: event.target.value }))}
                    style={{ minWidth: 0, flex: 1 }}
                  />
                  <button
                    type="button"
                    disabled={!(landmarkNameDrafts[marker.id] ?? marker.landmarkName ?? marker.institutionName ?? "").trim()}
                    onClick={() => updateLandmarkName(marker.id, landmarkNameDrafts[marker.id] ?? marker.landmarkName ?? marker.institutionName ?? "")}
                  >
                    Save
                  </button>
                </div>
                {marker.description && (
                  <p
                    style={{
                      margin: "8px 0",
                      color: "#4b5563",
                      fontSize: "0.9rem",
                      fontStyle: "italic",
                    }}
                  >
                    "{marker.description}"
                  </p>
                )}
                {marker.imageUrl && (
                  <img src={marker.imageUrl} alt={marker.landmarkName || "Marker"} style={{ width: "100%", maxHeight: "140px", objectFit: "cover", borderRadius: "4px" }} />
                )}

                <hr
                  style={{ border: "0.5px solid #e5e7eb", margin: "8px 0" }}
                />

                {/* NEW: Display available tours inside the pin popup */}
                <div style={{ textAlign: "left", marginBottom: "10px" }}>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      color: "#855e2e",
                    }}
                  >
                    Available Experiences:
                  </span>
                  {loadingExperiences[marker.institutionId] ? (
                    <div style={{ fontSize: "0.8rem" }}>Loading experiences...</div>
                  ) : experienceErrors[marker.institutionId] ? (
                    <div role="alert" style={{ fontSize: "0.8rem", color: "#b91c1c" }}>
                      {experienceErrors[marker.institutionId]}
                    </div>
                  ) : activeExperiences[marker.institutionId]?.length > 0 ? (
                    activeExperiences[marker.institutionId].map((experience) => (
                      <div
                        key={experience.id}
                        style={{
                          fontSize: "0.85rem",
                          padding: "4px 0",
                          borderBottom: "1px dashed #eee",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>📍 {experience.title}</span>
                        <span style={{ color: "#C19A4B" }}>
                          {experience.poiCount} POIs · {experience.contentItems.length} items
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: "0.8rem", color: "#888" }}>
                      No landmarks configured yet.
                    </div>
                  )}
                </div>

                <button
                  onClick={() => removeMarker(marker.id)}
                  style={{
                    cursor: "pointer",
                    backgroundColor: "#ef4444",
                    color: "white",
                    border: "none",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    width: "100%",
                  }}
                >
                  Delete Pin
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* INSTITUTION SELECTION MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "#1a1a1a",
              padding: "2rem",
              borderRadius: "8px",
              border: "1px solid #d4af37",
              width: "320px",
              textAlign: "center",
            }}
          >
            <h4 style={{ color: "#d4af37", marginTop: 0 }}>
              Create Landmark
            </h4>
            {markerFormError && (
              <div role="alert" style={{ color: "#fca5a5", marginBottom: "1rem" }}>
                {markerFormError}
              </div>
            )}
            <p
              style={{
                fontSize: "0.85rem",
                color: "#a8a29e",
                marginBottom: "1rem",
              }}
            >
              Select the organization and add a description for this location.
            </p>

            <div style={{ marginBottom: "1.2rem", textAlign: "left" }}>
              <label style={{ color: "#d4af37", fontSize: "0.8rem", display: "block", marginBottom: "4px" }}>
                Landmark name:
              </label>
              <input
                value={landmarkName}
                onChange={(e) => setLandmarkName(e.target.value)}
                placeholder="e.g. Main Gallery"
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#262626",
                  color: "white",
                  border: "1px solid #404040",
                  borderRadius: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "1.2rem", textAlign: "left" }}>
              <label
                style={{
                  color: "#d4af37",
                  fontSize: "0.8rem",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Description (Optional):
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Type details about this marker..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#262626",
                  color: "white",
                  border: "1px solid #404040",
                  borderRadius: "4px",
                  resize: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "1.2rem", textAlign: "left" }}>
              <label style={{ color: "#d4af37", fontSize: "0.8rem", display: "block", marginBottom: "4px" }}>
                Marker picture (optional):
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const selected = e.target.files?.[0] || null;
                  if (selected && !["image/png", "image/jpeg", "image/webp"].includes(selected.type)) {
                    setMarkerFormError("Choose a PNG, JPG, or WEBP landmark picture.");
                    e.target.value = "";
                    return;
                  }
                  if (selected && selected.size > 10 * 1024 * 1024) {
                    setMarkerFormError("Landmark pictures must be 10 MB or smaller.");
                    e.target.value = "";
                    return;
                  }
                  setMarkerImage(selected);
                  setMarkerFormError("");
                }}
                style={{ color: "#ccc", width: "100%" }}
              />
              <small style={{ color: "#888" }}>PNG, JPG, or WEBP, maximum 10 MB.</small>
              {markerImage && (
                <div>
                  <small style={{ color: "#4ade80", display: "block", marginTop: 6 }}>Selected: {markerImage.name}</small>
                  <img
                    src={markerImagePreview}
                    alt="Marker picture preview"
                    style={{ display: "block", width: "100%", maxHeight: 180, objectFit: "contain", marginTop: 8, borderRadius: 4, background: "#111" }}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
                maxHeight: "200px",
                overflowY: "auto",
                paddingRight: "5px",
              }}
            >
              {institutions.filter(isInstitutionActive).map((inst) => (
                <button
                  key={inst.id}
                  disabled={savingMarker || !landmarkName.trim()}
                  onClick={() => confirmAddMarker(inst.id, inst.name)}
                  style={{
                    padding: "12px",
                    backgroundColor: "#262626",
                    color: "white",
                    border: "1px solid #404040",
                    cursor: "pointer",
                    borderRadius: "4px",
                    textAlign: "left",
                  }}
                >
                  {savingMarker ? "Saving marker..." : inst.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setIsModalOpen(false);
                setTempCoords(null);
                setLandmarkName("");
                setDescription("");
                setMarkerImage(null);
                setMarkerFormError("");
              }}
              style={{
                marginTop: "1.5rem",
                background: "none",
                border: "none",
                color: "#737373",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapSystem;
