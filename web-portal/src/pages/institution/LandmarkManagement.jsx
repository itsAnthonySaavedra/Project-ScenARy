import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import commonStyles from "../../components/common/Common.module.css";

L.Marker.prototype.options.icon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] });

const LandmarkManagement = () => {
  const [institutionId, setInstitutionId] = useState(null);
  const [landmarks, setLandmarks] = useState([]);
  const [pois, setPois] = useState([]);
  const [availableContent, setAvailableContent] = useState([]);
  const [selectedContentIds, setSelectedContentIds] = useState([]);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState("");
  const [form, setForm] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async (id) => {
    const landmarkSnap = await getDocs(query(collection(db, "markers"), where("institutionId", "==", id)));
    const poiSnap = await getDocs(query(collection(db, "pois"), where("institutionId", "==", id)));
    const contentSnap = await getDocs(query(collection(db, "content"), where("institutionId", "==", id)));
    setLandmarks(landmarkSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
    setPois(poiSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
    setAvailableContent(
      contentSnap.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => ["Information", "3D Model", "Quiz"].includes(item.type)),
    );
    setLoading(false);
  };

  useEffect(() => onAuthStateChanged(getAuth(), async (user) => {
    if (!user) { setLoading(false); return; }
    const profile = await getDoc(doc(db, "users", user.uid));
    if (profile.exists()) {
      const id = profile.data().institutionId;
      setInstitutionId(id);
      await loadData(id);
    } else setLoading(false);
  }), []);

  const updateField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const selectLandmark = (landmark) => {
    setSelectedLandmarkId(landmark.id);
    setForm({
      name: landmark.landmarkName || landmark.institutionName || "",
      description: landmark.info?.description || landmark.description || "",
    });
    setSelectedContentIds(landmark.contentIds || []);
  };

  const saveLandmark = async (event) => {
    event.preventDefault();
    if (!institutionId || !selectedLandmarkId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "markers", selectedLandmarkId), {
        landmarkName: form.name.trim(),
        info: { description: form.description.trim() },
        contentIds: selectedContentIds,
      });
      setForm({ ...form, name: form.name.trim(), description: form.description.trim() });
      await loadData(institutionId);
    } catch {
      alert("Unable to save landmark details.");
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading landmarks...</div>;

  return <div style={{ padding: 20, color: "#ccc" }}>
    <h2 style={{ color: "#d4af37" }}>Landmarks</h2>
    <p>Admin-created map pins are the landmarks. Select a pin to configure its information; POIs such as artworks are added separately and linked to that pin.</p>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: "20px" }}>
      <form onSubmit={saveLandmark} className={commonStyles.contentCard} style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "20px" }}>
        <h3 style={{ color: "#fff" }}>Configure Landmark</h3>
        <select className={commonStyles.formControl} value={selectedLandmarkId} onChange={(e) => {
          const landmark = landmarks.find((item) => item.id === e.target.value);
          if (landmark) selectLandmark(landmark);
          else setSelectedLandmarkId("");
        }} required>
          <option value="">Select admin map pin</option>
          {landmarks.map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.landmarkName || landmark.institutionName}</option>)}
        </select>
        <input className={commonStyles.formControl} placeholder="Museum name" value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
        <textarea className={commonStyles.formControl} placeholder="Landmark information" value={form.description} onChange={(e) => updateField("description", e.target.value)} required />
        <div>
          <label style={{ color: "#fff", display: "block", marginBottom: 8 }}>
            Assign Existing Content
          </label>
          {availableContent.length === 0 ? (
            <small style={{ color: "#888" }}>No reusable landmark content found.</small>
          ) : availableContent.map((item) => (
            <label key={item.id} style={{ display: "flex", gap: 8, padding: "6px 0", color: "#ccc" }}>
              <input
                type="checkbox"
                checked={selectedContentIds.includes(item.id)}
                onChange={() => setSelectedContentIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
              />
              {item.title} ({item.type})
            </label>
          ))}
        </div>
        <MapContainer center={[10.3157, 123.8854]} zoom={15} style={{ height: 240, width: "100%" }} dragging={false} doubleClickZoom={false} scrollWheelZoom={false} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          {selectedLandmarkId && (() => {
            const landmark = landmarks.find((item) => item.id === selectedLandmarkId);
            return landmark ? <Marker position={[landmark.lat, landmark.lng]} /> : null;
          })()}
        </MapContainer>
        <small style={{ color: "#888" }}>Location is controlled by the administrator and cannot be moved here.</small>
        <button className={commonStyles.btnPrimary} disabled={saving || !selectedLandmarkId}>{saving ? "Saving..." : "Save Landmark Details"}</button>
      </form>
      <div>
        <MapContainer center={[10.3157, 123.8854]} zoom={15} style={{ height: 420, width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          {landmarks.map((landmark) => <Marker key={landmark.id} position={[landmark.lat, landmark.lng]}><Popup><strong>{landmark.landmarkName || landmark.institutionName}</strong><br />Landmark</Popup></Marker>)}
          {pois.filter((poi) => Number.isFinite(poi.latitude) && Number.isFinite(poi.longitude)).map((poi) => <Marker key={poi.id} position={[poi.latitude, poi.longitude]}><Popup><strong>{poi.name}</strong><br />POI of {landmarks.find((item) => item.id === poi.landmarkId)?.landmarkName || "unknown landmark"}<br />QR: {poi.qrCode || "Legacy GPS POI"}</Popup></Marker>)}
        </MapContainer>
        <div style={{ marginTop: 12 }}>{landmarks.map((landmark) => <div key={landmark.id} style={{ padding: 10, borderBottom: "1px solid #333" }}><strong>{landmark.landmarkName || landmark.institutionName}</strong> <span style={{ color: "#888" }}>({pois.filter((poi) => poi.landmarkId === landmark.id).length} POIs)</span></div>)}</div>
      </div>
    </div>
  </div>;
};

export default LandmarkManagement;
