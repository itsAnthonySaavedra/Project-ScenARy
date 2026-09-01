import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { QRCodeCanvas } from "qrcode.react";
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

  const selectedLandmark = landmarks.find((item) => item.id === selectedLandmarkId) || null;

  const downloadQrCode = (landmark = selectedLandmark) => {
    if (!landmark) return;
    const canvas = document.getElementById(`institution-landmark-qr-${landmark.id}`);
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${(landmark.landmarkName || landmark.institutionName || "landmark").replace(/[^a-z0-9-_]/gi, "-")}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const printQrCode = (landmark = selectedLandmark) => {
    if (!landmark) return;
    const canvas = document.getElementById(`institution-landmark-qr-${landmark.id}`);
    if (!canvas) return;
    const printWindow = window.open("", "_blank", "width=500,height=600");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>${landmark.landmarkName || landmark.institutionName} QR Code</title></head><body style="font-family:sans-serif;text-align:center;padding:32px"><h1>${landmark.landmarkName || landmark.institutionName}</h1><img src="${canvas.toDataURL("image/png")}" alt="Landmark QR code" /><p>${landmark.qrCode || ""}</p><script>window.onload=()=>{window.print();window.close();};</script></body></html>`);
    printWindow.document.close();
  };

  const generateLandmarkQr = async (landmark = selectedLandmark) => {
    if (!landmark) return;
    const qrCode = `SCENARY|LANDMARK|${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
    await updateDoc(doc(db, "markers", landmark.id), { qrCode });
    await loadData(institutionId);
  };

  const selectLandmark = (landmark) => {
    setSelectedLandmarkId(landmark.id);
    setForm({
      name: landmark.landmarkName || landmark.institutionName || "",
      description: landmark.info?.description ?? landmark.description ?? "",
    });
    setSelectedContentIds(landmark.contentIds || []);
  };

  const saveLandmark = async (event) => {
    event.preventDefault();
    if (!institutionId || !selectedLandmarkId) return;
    const name = form.name.trim();
    const description = form.description.trim();
    setSaving(true);
    try {
      await updateDoc(doc(db, "markers", selectedLandmarkId), {
        landmarkName: name,
        institutionName: name || undefined,
        description,
        info: { description },
        contentIds: selectedContentIds,
        updatedAt: serverTimestamp(),
      });
      setForm({ ...form, name, description });
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

        {selectedLandmark && (
          <div style={{ marginTop: 12, padding: 12, border: "1px solid #3a3a3a", borderRadius: 8, background: "#111827", display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong style={{ color: "#d4af37" }}>Main Landmark QR</strong>
              {!selectedLandmark.qrCode && (
                <button type="button" onClick={generateLandmarkQr} className={commonStyles.btnSecondary} style={{ padding: "6px 10px", fontSize: 12 }}>
                  Generate QR
                </button>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "center", background: "#fff", padding: 12, borderRadius: 8 }}>
              <QRCodeCanvas id={`institution-landmark-qr-${selectedLandmark.id}`} value={selectedLandmark.qrCode || `SCENARY|LANDMARK|${selectedLandmark.id}`} size={150} includeMargin />
            </div>
            {selectedLandmark.qrCode && <div style={{ color: "#bbb", fontSize: 12, wordBreak: "break-all" }}>{selectedLandmark.qrCode}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={downloadQrCode} className={commonStyles.btnPrimary} style={{ flex: 1, minWidth: 120 }}>
                Download QR
              </button>
              <button type="button" onClick={printQrCode} className={commonStyles.btnSecondary} style={{ flex: 1, minWidth: 120 }}>
                Print QR
              </button>
            </div>
          </div>
        )}

        <button className={commonStyles.btnPrimary} disabled={saving || !selectedLandmarkId}>{saving ? "Saving..." : "Save Landmark Details"}</button>
      </form>
      <div>
        <MapContainer center={[10.3157, 123.8854]} zoom={15} style={{ height: 420, width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          {landmarks.map((landmark) => (
            <Marker key={landmark.id} position={[landmark.lat, landmark.lng]}>
              <Popup>
                <div style={{ color: "#111827", minWidth: 220, textAlign: "center" }}>
                  <strong style={{ fontSize: "1rem" }}>{landmark.landmarkName || landmark.institutionName}</strong>
                  {(landmark.info?.description || landmark.description) && (
                    <p style={{ margin: "8px 0", color: "#4b5563", fontSize: "0.9rem", lineHeight: 1.4 }}>
                      {landmark.info?.description || landmark.description}
                    </p>
                  )}
                  <div style={{ display: "flex", justifyContent: "center", background: "#fff", padding: 8, borderRadius: 8, margin: "10px 0" }}>
                    <QRCodeCanvas id={`institution-landmark-qr-${landmark.id}`} value={landmark.qrCode || `SCENARY|LANDMARK|${landmark.id}`} size={120} includeMargin />
                  </div>
                  {!landmark.qrCode && (
                    <button type="button" onClick={() => generateLandmarkQr(landmark)} style={{ width: "100%", marginBottom: 6, backgroundColor: "#d4af37", color: "#1c1917", border: "none", borderRadius: 4, padding: "6px 10px", cursor: "pointer" }}>
                      Generate QR
                    </button>
                  )}
                  <button type="button" onClick={() => downloadQrCode(landmark)} style={{ width: "100%", marginBottom: 6, backgroundColor: "#d4af37", color: "#1c1917", border: "none", borderRadius: 4, padding: "6px 10px", cursor: "pointer" }}>
                    Download QR
                  </button>
                  <button type="button" onClick={() => printQrCode(landmark)} style={{ width: "100%", backgroundColor: "#1f2937", color: "#fff", border: "1px solid #d4af37", borderRadius: 4, padding: "6px 10px", cursor: "pointer" }}>
                    Print QR
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        <div style={{ marginTop: 12 }}>{landmarks.map((landmark) => <div key={landmark.id} style={{ padding: 10, borderBottom: "1px solid #333" }}><strong>{landmark.landmarkName || landmark.institutionName}</strong> <span style={{ color: "#888" }}>({pois.filter((poi) => poi.landmarkId === landmark.id).length} POIs)</span></div>)}</div>
      </div>
    </div>
  </div>;
};

export default LandmarkManagement;
