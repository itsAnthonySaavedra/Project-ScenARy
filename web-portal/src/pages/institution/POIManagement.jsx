import React, { useEffect, useState } from "react";
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import commonStyles from "../../components/common/Common.module.css";
import { db } from "../../lib/firebase";

const MapPicker = ({ latitude, longitude, onPick }) => {
  useMapEvents({ click: ({ latlng }) => onPick(latlng) });
  return latitude && longitude ? <Marker position={[Number(latitude), Number(longitude)]} /> : null;
};

const POIManagement = () => {
  const [institutionId, setInstitutionId] = useState(null);
  const [landmarks, setLandmarks] = useState([]);
  const [pois, setPois] = useState([]);
  const [availableContent, setAvailableContent] = useState([]);
  const [selectedContentIds, setSelectedContentIds] = useState([]);
  const [selectedPoiId, setSelectedPoiId] = useState(null);
  const [form, setForm] = useState({ landmarkId: "", name: "", latitude: "", longitude: "" });
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
        .filter((item) => ["Information", "3D Model", "Audio"].includes(item.type)),
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

  const resetForm = () => {
    setSelectedPoiId(null);
    setSelectedContentIds([]);
    setForm({ landmarkId: "", name: "", latitude: "", longitude: "" });
  };

  const editPoi = (poi) => {
    setSelectedPoiId(poi.id);
    setSelectedContentIds(poi.contentIds || []);
    setForm({
      landmarkId: poi.landmarkId,
      name: poi.name || "",
      latitude: String(poi.latitude ?? ""),
      longitude: String(poi.longitude ?? ""),
    });
  };

  const removePoi = async (poi) => {
    if (!window.confirm(`Remove ${poi.name}?`)) return;
    await deleteDoc(doc(db, "pois", poi.id));
    if (selectedPoiId === poi.id) resetForm();
    await loadData(institutionId);
  };

  const savePoi = async (event) => {
    event.preventDefault();
    if (!institutionId || !form.landmarkId) return;
    setSaving(true);
    try {
      const poiData = {
        landmarkId: form.landmarkId,
        name: form.name.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        contentIds: selectedContentIds,
      };
      if (selectedPoiId) {
        await updateDoc(doc(db, "pois", selectedPoiId), poiData);
      } else {
        await addDoc(collection(db, "pois"), {
          ...poiData,
          institutionId,
          createdAt: serverTimestamp(),
        });
      }
      resetForm();
      await loadData(institutionId);
    } catch (error) {
      alert("Unable to save POI.");
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading POIs...</div>;

  return <div style={{ padding: 20, color: "#ccc" }}>
    <h2 style={{ color: "#d4af37" }}>Points of Interest</h2>
    <p>POIs are separate child objects. Select the landmark first, then add the artwork or exhibit inside it.</p>
    {landmarks.length === 0 ? <div style={{ color: "#fbbf24" }}>Create a landmark before adding a POI.</div> : <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 20 }}>
      <form onSubmit={savePoi} className={commonStyles.contentCard} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20 }}>
        <h3 style={{ color: "#fff" }}>{selectedPoiId ? "Edit POI" : "Add POI"}</h3>
        <select className={commonStyles.formControl} value={form.landmarkId} onChange={(e) => updateField("landmarkId", e.target.value)} required><option value="">Select parent landmark</option>{landmarks.map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.landmarkName || landmark.institutionName}</option>)}</select>
        <input className={commonStyles.formControl} placeholder="POI name, e.g. Painting A" value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
        <MapContainer center={[10.3157, 123.8854]} zoom={17} style={{ height: 240, width: "100%" }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" /><MapPicker latitude={form.latitude} longitude={form.longitude} onPick={({ lat, lng }) => setForm((current) => ({ ...current, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))} /></MapContainer>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input className={commonStyles.formControl} type="number" step="any" placeholder="Latitude" value={form.latitude} onChange={(e) => updateField("latitude", e.target.value)} required /><input className={commonStyles.formControl} type="number" step="any" placeholder="Longitude" value={form.longitude} onChange={(e) => updateField("longitude", e.target.value)} required /></div>
        <div>
          <label style={{ color: "#fff", display: "block", marginBottom: 8 }}>
            Assign Existing Content
          </label>
          {availableContent.length === 0 ? (
            <small style={{ color: "#888" }}>No reusable POI content found.</small>
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
        <button className={commonStyles.btnPrimary} disabled={saving}>{saving ? "Saving..." : selectedPoiId ? "Save POI Changes" : "Save POI"}</button>
        {selectedPoiId && <button type="button" className={commonStyles.btnCancel} onClick={resetForm}>Cancel Edit</button>}
      </form>
      <div>{pois.map((poi) => <div key={poi.id} style={{ padding: 12, borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", gap: 12 }}><span><strong>{poi.name}</strong><span style={{ color: "#888" }}> · {landmarks.find((landmark) => landmark.id === poi.landmarkId)?.landmarkName || "Unknown landmark"}</span></span><span style={{ display: "flex", gap: 8 }}><button type="button" className={commonStyles.btnOutline} onClick={() => editPoi(poi)}>Edit / Move</button><button type="button" className={commonStyles.btnCancel} onClick={() => removePoi(poi)}>Remove</button></span></div>)}</div>
    </div>}
  </div>;
};

export default POIManagement;
