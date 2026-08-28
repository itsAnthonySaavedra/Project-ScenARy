import React, { useEffect, useState } from "react";
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import commonStyles from "../../components/common/Common.module.css";
import { db } from "../../lib/firebase";

const earthRadiusMeters = 6371000;
const toCoordinate = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const distanceBetween = (first, second) => {
  const latitudeDelta = (second.latitude - first.latitude) * Math.PI / 180;
  const longitudeDelta = (second.longitude - first.longitude) * Math.PI / 180;
  const latitude = (first.latitude + second.latitude) * Math.PI / 360;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
};

const POIManagement = ({ adminMode = false }) => {
  const [institutionId, setInstitutionId] = useState(null);
  const [landmarks, setLandmarks] = useState([]);
  const [pois, setPois] = useState([]);
  const [availableContent, setAvailableContent] = useState([]);
  const [selectedContentIds, setSelectedContentIds] = useState([]);
  const [selectedPoiId, setSelectedPoiId] = useState(null);
  const [form, setForm] = useState({ institutionId: "", landmarkId: "", name: "", latitude: "", longitude: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const loadData = async (id) => {
    const [landmarkSnap, poiSnap, contentSnap] = await Promise.all(adminMode ? [
      getDocs(collection(db, "markers")), getDocs(collection(db, "pois")), getDocs(collection(db, "content")),
    ] : [
      getDocs(query(collection(db, "markers"), where("institutionId", "==", id))),
      getDocs(query(collection(db, "pois"), where("institutionId", "==", id))),
      getDocs(query(collection(db, "content"), where("institutionId", "==", id))),
    ]);
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
    setForm({ institutionId: "", landmarkId: "", name: "", latitude: "", longitude: "" });
    setFormError("");
  };

  const editPoi = (poi) => {
    setSelectedPoiId(poi.id);
    setSelectedContentIds(poi.contentIds || []);
    setForm({
      institutionId: poi.institutionId || "",
      landmarkId: poi.landmarkId,
      name: poi.name || "",
      latitude: poi.latitude ?? "",
      longitude: poi.longitude ?? "",
    });
    setFormError("");
  };

  const removePoi = async (poi) => {
    if (!window.confirm(`Remove ${poi.name}?`)) return;
    await deleteDoc(doc(db, "pois", poi.id));
    if (selectedPoiId === poi.id) resetForm();
    await loadData(institutionId);
  };

  const savePoi = async (event) => {
    event.preventDefault();
    const ownerId = adminMode ? form.institutionId : institutionId;
    const latitude = toCoordinate(form.latitude);
    const longitude = toCoordinate(form.longitude);
    if (!ownerId || !form.landmarkId || !form.name.trim() || latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setFormError("Select a landmark and enter valid decimal latitude and longitude values.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const poiData = {
        institutionId: ownerId,
        landmarkId: form.landmarkId,
        name: form.name.trim(),
        latitude,
        longitude,
        contentIds: selectedContentIds,
        updatedAt: serverTimestamp(),
      };
      if (selectedPoiId) {
        await updateDoc(doc(db, "pois", selectedPoiId), poiData);
      } else {
        await addDoc(collection(db, "pois"), {
          ...poiData,
          createdAt: serverTimestamp(),
        });
      }
      resetForm();
      await loadData(institutionId);
    } catch {
      alert("Unable to save POI.");
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading POIs...</div>;

  return <div style={{ padding: 20, color: "#ccc" }}>
    <h2 style={{ color: "#d4af37" }}>{adminMode ? "POI Administration" : "Points of Interest"}</h2>
    <p>POIs are child objects with precise coordinates. Landmark QR codes are managed from the landmark pin.</p>
    {landmarks.length === 0 ? <div style={{ color: "#fbbf24" }}>Create a landmark before adding a POI.</div> : <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 20 }}>
      <form onSubmit={savePoi} className={commonStyles.contentCard} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20 }}>
        <h3 style={{ color: "#fff" }}>{selectedPoiId ? "Edit POI" : "Add POI"}</h3>
        {adminMode && <select className={commonStyles.formControl} value={form.institutionId} onChange={(e) => { updateField("institutionId", e.target.value); updateField("landmarkId", ""); }} required><option value="">Select institution</option>{[...new Map(landmarks.map((landmark) => [landmark.institutionId, landmark.institutionName])).entries()].map(([id, name]) => <option key={id} value={id}>{name || id}</option>)}</select>}
        <select className={commonStyles.formControl} value={form.landmarkId} onChange={(e) => updateField("landmarkId", e.target.value)} required><option value="">Select parent landmark</option>{landmarks.filter((landmark) => !adminMode || landmark.institutionId === form.institutionId).map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.landmarkName || landmark.institutionName}</option>)}</select>
        <input className={commonStyles.formControl} placeholder="POI name, e.g. Painting A" value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
        <label style={{ color: "#fff" }}>POI coordinates</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input className={commonStyles.formControl} type="number" step="0.000001" min="-90" max="90" placeholder="Latitude" value={form.latitude} onChange={(e) => updateField("latitude", e.target.value)} required /><input className={commonStyles.formControl} type="number" step="0.000001" min="-180" max="180" placeholder="Longitude" value={form.longitude} onChange={(e) => updateField("longitude", e.target.value)} required /></div>
        <button type="button" className={commonStyles.btnOutline} onClick={() => navigator.geolocation?.getCurrentPosition(({ coords }) => setForm((current) => ({ ...current, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })), () => setFormError("Location permission was unavailable. Enter coordinates manually."))}>Use Current GPS Location</button>
        <small style={{ color: "#888" }}>GPS is available when the browser and device grant location permission. Manual decimal entry gives you control over precision.</small>
        {formError && <div role="alert" style={{ color: "#fbbf24" }}>{formError}</div>}
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
      <div>{pois.map((poi) => { const coordinate = { latitude: toCoordinate(poi.latitude), longitude: toCoordinate(poi.longitude) }; const neighbors = pois.filter((other) => other.id !== poi.id && other.institutionId === poi.institutionId && coordinate.latitude !== null && coordinate.longitude !== null && toCoordinate(other.latitude) !== null && toCoordinate(other.longitude) !== null).map((other) => ({ name: other.name, distance: distanceBetween(coordinate, { latitude: toCoordinate(other.latitude), longitude: toCoordinate(other.longitude) }) })).sort((a, b) => a.distance - b.distance).slice(0, 2); const landmark = landmarks.find((item) => item.id === poi.landmarkId); const landmarkLabel = landmark?.landmarkName || landmark?.institutionName || "Unknown landmark"; return <div key={poi.id} style={{ padding: 12, borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><span><strong>{poi.name}</strong><span style={{ color: "#888" }}> · {landmarkLabel}</span><small style={{ display: "block", color: "#888" }}>{coordinate.latitude === null ? "No coordinates" : `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`}{neighbors.length > 0 && ` · Nearest: ${neighbors[0].name} (${neighbors[0].distance}m)`}</small></span><span style={{ display: "flex", gap: 8, alignItems: "center" }}><button type="button" className={commonStyles.btnOutline} onClick={() => editPoi(poi)}>Edit Coordinates</button><button type="button" className={commonStyles.btnCancel} onClick={() => removePoi(poi)}>Remove</button></span></div>; })}</div>
    </div>}
  </div>;
};

export default POIManagement;
