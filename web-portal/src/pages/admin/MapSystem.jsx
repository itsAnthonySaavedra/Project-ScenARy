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
  doc,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Standard Icon Fix
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

const cebuBounds = [
  [9.3826, 123.2324],
  [11.35, 124.1],
];

const MapSystem = () => {
  const [markers, setMarkers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempCoords, setTempCoords] = useState(null);
  const [description, setDescription] = useState("");

  // NEW: Track the active tours for the currently clicked marker
  const [activeTours, setActiveTours] = useState({});
  const [loadingTours, setLoadingTours] = useState({});

  useEffect(() => {
    const unsubInst = onSnapshot(collection(db, "institutions"), (snapshot) => {
      setInstitutions(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    });

    const unsubMarkers = onSnapshot(collection(db, "markers"), (snapshot) => {
      setMarkers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubInst();
      unsubMarkers();
    };
  }, []);

  // NEW: Fetch tours whenever a user opens a marker popup
  const handleMarkerClick = async (institutionId) => {
    if (activeTours[institutionId]) return; // Already fetched

    setLoadingTours((prev) => ({ ...prev, [institutionId]: true }));
    try {
      const q = query(
        collection(db, "tours"),
        where("institutionId", "==", institutionId.trim()),
      );
      const snap = await getDocs(q);
      const toursList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setActiveTours((prev) => ({ ...prev, [institutionId]: toursList }));
    } catch (err) {
      console.error("Error fetching tours for marker:", err);
    } finally {
      setLoadingTours((prev) => ({ ...prev, [institutionId]: false }));
    }
  };

  const confirmAddMarker = async (instId, instName) => {
    if (!tempCoords) return;
    const trimmedDescription = description.trim();
    try {
      await addDoc(collection(db, "markers"), {
        lat: parseFloat(tempCoords.lat),
        lng: parseFloat(tempCoords.lng),
        createdAt: serverTimestamp(),
        institutionId: instId,
        institutionName: instName,
        landmarkName: instName,
        description: trimmedDescription,
        info: { description: trimmedDescription },
      });
      setIsModalOpen(false);
      setTempCoords(null);
      setDescription("");
    } catch (err) {
      console.error("Error saving marker:", err);
    }
  };

  const removeMarker = async (docId) => {
    try {
      await deleteDoc(doc(db, "markers", docId));
    } catch (err) {
      console.error(err);
    }
  };

  function MapEvents() {
    useMapEvents({
      click: (e) => {
        setTempCoords(e.latlng);
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

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
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
                  {loadingTours[marker.institutionId] ? (
                    <div style={{ fontSize: "0.8rem" }}>Loading tours...</div>
                  ) : activeTours[marker.institutionId]?.length > 0 ? (
                    activeTours[marker.institutionId].map((tour) => (
                      <div
                        key={tour.id}
                        style={{
                          fontSize: "0.85rem",
                          padding: "4px 0",
                          borderBottom: "1px dashed #eee",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>📍 {tour.title}</span>
                        <span style={{ color: "#C19A4B" }}>
                          {tour.duration}m
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: "0.8rem", color: "#888" }}>
                      No tours available yet.
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
              Assign Institution
            </h4>
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
              {institutions.map((inst) => (
                <button
                  key={inst.id}
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
                  {inst.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setIsModalOpen(false);
                setTempCoords(null);
                setDescription("");
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
