import React, { useEffect, useRef, useState } from "react";
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { QRCodeCanvas } from "qrcode.react";
import commonStyles from "../../components/common/Common.module.css";
import { db } from "../../lib/firebase";

const POI_ALLOWED_CONTENT_TYPES = ["Information", "3D Model", "Quiz", "Audio"];

const POIManagement = ({ adminMode = false }) => {
  const [institutionId, setInstitutionId] = useState(null);
  const [landmarks, setLandmarks] = useState([]);
  const [pois, setPois] = useState([]);
  const [availableContent, setAvailableContent] = useState([]);
  const [selectedContentIds, setSelectedContentIds] = useState([]);
  const [selectedPoiId, setSelectedPoiId] = useState(null);
  const [form, setForm] = useState({ institutionId: "", landmarkId: "", name: "", qrCode: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const qrCanvasRef = useRef(null);
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
        .filter((item) => POI_ALLOWED_CONTENT_TYPES.includes(item.type)),
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
    setForm({ institutionId: "", landmarkId: "", name: "", qrCode: "" });
    setFormError("");
  };

  const generateLandmarkPoiQr = async (landmarkId = form.landmarkId) => {
    if (!landmarkId) {
      setFormError("Select a landmark before generating the shared POI QR.");
      return;
    }
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const generatedQrCode = `SCENARY|POI_GROUP|${id}`;
    try {
      await updateDoc(doc(db, "markers", landmarkId), { poiQrCode: generatedQrCode });
      setForm((current) => ({ ...current, qrCode: generatedQrCode }));
      setFormError("");
      await loadData(institutionId);
    } catch {
      setFormError("Unable to save the landmark POI QR.");
    }
  };

  const generateQrCode = () => generateLandmarkPoiQr();

  const downloadQrCode = (canvasId, fileName) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${fileName.replace(/[^a-z0-9-_]/gi, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const printQrCode = (canvasId, title, qrCode) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const printWindow = window.open("", "_blank", "width=500,height=600");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>${title} QR Code</title></head><body style="font-family:sans-serif;text-align:center;padding:32px"><h1>${title}</h1><img src="${canvas.toDataURL("image/png")}" alt="QR code for ${title}" /><p>${qrCode}</p><script>window.onload=()=>{window.print();window.close();};</script></body></html>`);
    printWindow.document.close();
  };

  const editPoi = (poi) => {
    setSelectedPoiId(poi.id);
    setSelectedContentIds(poi.contentIds || []);
    const landmark = landmarks.find((item) => item.id === poi.landmarkId);
    setForm({
      institutionId: poi.institutionId || "",
      landmarkId: poi.landmarkId,
      name: poi.name || "",
      qrCode: poi.qrCode || landmark?.poiQrCode || "",
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
    const sharedLandmarkQr = landmarks.find((landmark) => landmark.id === form.landmarkId)?.poiQrCode || form.qrCode.trim();
    if (!ownerId || !form.landmarkId || !form.name.trim()) {
      setFormError("Select a landmark and enter a POI name.");
      return;
    }
    if (!sharedLandmarkQr) {
      setFormError("Generate the shared landmark POI QR before saving POIs.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const poiData = {
        institutionId: ownerId,
        landmarkId: form.landmarkId,
        name: form.name.trim(),
        qrCode: sharedLandmarkQr,
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
    <p>POIs are child objects identified by their own QR codes. Landmark QR codes are managed from the landmark pin.</p>
    {landmarks.length === 0 ? <div style={{ color: "#fbbf24" }}>Create a landmark before adding a POI.</div> : <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 20 }}>
      <form onSubmit={savePoi} className={commonStyles.contentCard} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20 }}>
        <h3 style={{ color: "#fff" }}>{selectedPoiId ? "Edit POI" : "Add POI"}</h3>
        {adminMode && <select className={commonStyles.formControl} value={form.institutionId} onChange={(e) => { updateField("institutionId", e.target.value); updateField("landmarkId", ""); }} required><option value="">Select institution</option>{[...new Map(landmarks.map((landmark) => [landmark.institutionId, landmark.institutionName])).entries()].map(([id, name]) => <option key={id} value={id}>{name || id}</option>)}</select>}
        <select className={commonStyles.formControl} value={form.landmarkId} onChange={(e) => {
          const selectedLandmark = landmarks.find((landmark) => landmark.id === e.target.value);
          updateField("landmarkId", e.target.value);
          updateField("qrCode", selectedLandmark?.poiQrCode || "");
        }} required><option value="">Select parent landmark</option>{landmarks.filter((landmark) => !adminMode || landmark.institutionId === form.institutionId).map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.landmarkName || landmark.institutionName}</option>)}</select>
        <input className={commonStyles.formControl} placeholder="POI name, e.g. Painting A" value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
        <label style={{ color: "#fff" }}>Shared Landmark POI QR</label>
        <small style={{ color: "#888" }}>Each landmark can have one POI QR that can include many POIs or sub-modules under it.</small>
        <button type="button" className={commonStyles.btnOutline} onClick={generateQrCode}>Generate Shared Landmark QR</button>
        {formError && <div role="alert" style={{ color: "#fbbf24" }}>{formError}</div>}
        {form.qrCode.trim() && <div style={{ background: "#fff", padding: 12, width: "fit-content" }}><QRCodeCanvas ref={qrCanvasRef} value={form.qrCode.trim()} size={140} includeMargin /></div>}
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
      <div>{landmarks.filter((landmark) => !adminMode || landmark.institutionId === form.institutionId || !form.institutionId).map((landmark) => {
        const landmarkPois = pois.filter((poi) => poi.landmarkId === landmark.id);
        const sharedQr = landmark.poiQrCode || landmarkPois[0]?.qrCode || "";
        return <div key={landmark.id} style={{ padding: 16, border: "1px solid #333", borderRadius: 10, marginBottom: 16, background: "#111827" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div>
              <strong style={{ color: "#d4af37" }}>{landmark.landmarkName || landmark.institutionName}</strong>
              <div style={{ color: "#888", fontSize: 12 }}>Shared POI QR for this landmark</div>
            </div>
            {sharedQr ? <QRCodeCanvas id={`landmark-poi-qr-${landmark.id}`} value={sharedQr} size={72} includeMargin /> : null}
          </div>
          {sharedQr ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button type="button" className={commonStyles.btnOutline} onClick={() => downloadQrCode(`landmark-poi-qr-${landmark.id}`, `${(landmark.landmarkName || landmark.institutionName || "landmark").replace(/[^a-z0-9-_]/gi, "-")}-poi-qr`)}>Download Shared QR</button>
              <button type="button" className={commonStyles.btnOutline} onClick={() => printQrCode(`landmark-poi-qr-${landmark.id}`, `${landmark.landmarkName || landmark.institutionName || "Landmark"} POI QR`, sharedQr)}>Print Shared QR</button>
            </div>
          ) : (
            <button type="button" className={commonStyles.btnOutline} onClick={() => generateLandmarkPoiQr(landmark.id)} style={{ marginBottom: 12 }}>Generate Shared Landmark POI QR</button>
          )}
          {landmarkPois.length === 0 ? (
            <div style={{ color: "#888", paddingTop: 8 }}>No POIs added under this landmark yet.</div>
          ) : (
            <div>
              {landmarkPois.map((poi, index) => {
                const poiContent = (poi.contentIds || [])
                  .map((contentId) => availableContent.find((content) => content.id === contentId))
                  .filter(Boolean);
                return <div key={poi.id} style={{ paddingTop: index === 0 ? 0 : 12, marginTop: index === 0 ? 0 : 12, borderTop: index === 0 ? "none" : "1px solid #333" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong>{poi.name}</strong>
                      {poiContent.length > 0 && <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>{poiContent.map((content) => `${content.title} (${content.type})`).join(" • ")}</div>}
                      {!poiContent.length && <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>No content assigned</div>}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button type="button" className={commonStyles.btnOutline} onClick={() => editPoi(poi)}>Edit POI</button>
                      <button type="button" className={commonStyles.btnCancel} onClick={() => removePoi(poi)}>Remove</button>
                    </div>
                  </div>
                </div>;
              })}
            </div>
          )}
        </div>;
      })}</div>
    </div>}
  </div>;
};

export default POIManagement;
