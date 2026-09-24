import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDocs, getDoc, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import commonStyles from "../../components/common/Common.module.css";
import { db, storage } from "../../lib/firebase";

const FloorPlan = () => {
  const [institutionId, setInstitutionId] = useState(null);
  const [floorPlan, setFloorPlan] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null);
  const [pois, setPois] = useState([]);
  const [selectedPoiId, setSelectedPoiId] = useState("");
  const [placementMode, setPlacementMode] = useState(false);
  const [savingMarker, setSavingMarker] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => onAuthStateChanged(getAuth(), async (user) => {
    if (!user) {
      setLoading(false);
      return;
    }
    const profile = await getDoc(doc(db, "users", user.uid));
    const id = profile.exists() ? profile.data().institutionId : null;
    if (!id) {
      setLoading(false);
      return;
    }
    setInstitutionId(id);
    const [floorPlanSnapshot, poiSnapshot] = await Promise.all([
      getDoc(doc(db, "floorPlans", id)),
      getDocs(query(collection(db, "pois"), where("institutionId", "==", id))),
    ]);
    setFloorPlan(floorPlanSnapshot.exists() ? { id: floorPlanSnapshot.id, ...floorPlanSnapshot.data() } : null);
    setPois(poiSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setLoading(false);
  }), []);

  const resetViewer = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const validType = ["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(selected.type);
    if (!validType) {
      setMessage("Upload a PNG, JPG, WEBP, or PDF floor plan.");
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      setMessage("The floor plan must be 15 MB or smaller.");
      return;
    }
    setFile(selected);
    setMessage("");
  };

  const uploadFloorPlan = async (event) => {
    event.preventDefault();
    if (!institutionId || !file) return;
    setUploading(true);
    setMessage("");
    try {
      const storagePath = `floor-plans/${institutionId}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "-")}`;
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      const floorPlanData = {
        institutionId,
        name: file.name,
        fileType: file.type,
        storagePath,
        url,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "floorPlans", institutionId), floorPlanData, { merge: true });
      setFloorPlan({ ...floorPlanData, id: institutionId });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      resetViewer();
      setMessage("Floor plan uploaded successfully.");
    } catch (error) {
      console.error("Unable to upload floor plan:", error);
      setMessage("Unable to upload the floor plan. Check Firebase Storage permissions.");
    } finally {
      setUploading(false);
    }
  };

  const handlePointerDown = (event) => {
    if (placementMode) return;
    if (floorPlan?.fileType === "application/pdf") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({ x: event.clientX - offset.x, y: event.clientY - offset.y });
  };

  const placeSelectedPoi = async (event) => {
    if (!placementMode || !selectedPoiId || !floorPlan || floorPlan.fileType === "application/pdf") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
    setSavingMarker(true);
    try {
      const position = { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
      await updateDoc(doc(db, "pois", selectedPoiId), { floorPlanPosition: position, updatedAt: serverTimestamp() });
      setPois((current) => current.map((poi) => poi.id === selectedPoiId ? { ...poi, floorPlanPosition: position } : poi));
      setPlacementMode(false);
    } catch (error) {
      console.error("Unable to place POI on floor plan:", error);
      setMessage("Unable to save the POI location.");
    } finally {
      setSavingMarker(false);
    }
  };

  const handlePointerMove = (event) => {
    if (!dragStart) return;
    setOffset({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
  };

  if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading floor plan...</div>;

  return (
    <div style={{ padding: 20, color: "#ccc" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: "#d4af37", marginBottom: 6 }}>Interactive Floor Plan</h2>
        <p style={{ margin: 0, color: "#999" }}>Upload a floor plan, then place your existing POIs on it for visitors to tap.</p>
        {institutionId && <a href={`/institution-map/${institutionId}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, color: "#d4af37" }}>Open public map</a>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 20, alignItems: "start" }}>
        <form onSubmit={uploadFloorPlan} className={commonStyles.contentCard} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
          <h3 style={{ color: "#fff" }}>Floor plan file</h3>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={handleFileChange} style={{ color: "#ccc" }} />
          <small style={{ color: "#888" }}>PNG, JPG, WEBP, or PDF. Maximum 15 MB. Uploading replaces the current floor plan.</small>
          {file && <div style={{ color: "#d4af37" }}>Selected: {file.name}</div>}
          {message && <div role="status" style={{ color: message.includes("successfully") ? "#86efac" : "#fbbf24" }}>{message}</div>}
          <button className={commonStyles.btnPrimary} disabled={!file || uploading}>{uploading ? "Uploading..." : "Upload Floor Plan"}</button>
        </form>

        <section className={commonStyles.contentCard} style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <div><h3 style={{ color: "#fff", marginBottom: 2 }}>{floorPlan?.name || "No floor plan uploaded"}</h3><small style={{ color: "#888" }}>{floorPlan ? "Interactive preview" : "Upload a file to begin"}</small></div>
            {floorPlan && floorPlan.fileType !== "application/pdf" && <div style={{ display: "flex", gap: 6 }}><button type="button" className={commonStyles.btnOutline} onClick={() => setScale((value) => Math.min(value + 0.25, 4))}>Zoom in</button><button type="button" className={commonStyles.btnOutline} onClick={() => setScale((value) => Math.max(value - 0.25, 0.5))}>Zoom out</button><button type="button" className={commonStyles.btnOutline} onClick={resetViewer}>Reset</button></div>}
          </div>
          {floorPlan ? floorPlan.fileType === "application/pdf" ? <iframe title="Uploaded floor plan" src={floorPlan.url} style={{ width: "100%", height: 600, border: "1px solid #444", background: "#fff" }} /> : <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <select value={selectedPoiId} onChange={(event) => setSelectedPoiId(event.target.value)} style={{ minWidth: 220, padding: 8 }}>
                <option value="">Select a POI to place</option>
                {pois.map((poi) => <option key={poi.id} value={poi.id}>{poi.name}</option>)}
              </select>
              <button type="button" className={commonStyles.btnPrimary} disabled={!selectedPoiId || savingMarker} onClick={() => setPlacementMode((current) => !current)}>
                {placementMode ? "Click the floorplan..." : "Place POI pin"}
              </button>
              {pois.length === 0 && <small style={{ color: "#888" }}>Create POIs first, then place them here.</small>}
            </div>
            <div onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => setDragStart(null)} onPointerCancel={() => setDragStart(null)} style={{ height: 600, overflow: "hidden", background: "#f5f5f5", border: placementMode ? "2px solid #d4af37" : "1px solid #444", cursor: placementMode ? "crosshair" : dragStart ? "grabbing" : "grab", touchAction: "none" }}>
              <div onClick={placeSelectedPoi} style={{ position: "relative", display: "inline-block", transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "top left" }}>
                <img src={floorPlan.url} alt={floorPlan.name} draggable="false" style={{ display: "block", maxWidth: "none", userSelect: "none" }} />
                {pois.filter((poi) => poi.floorPlanPosition).map((poi) => <button key={poi.id} type="button" title={poi.name} onClick={(event) => { event.stopPropagation(); setSelectedPoiId(poi.id); }} style={{ position: "absolute", left: `${poi.floorPlanPosition.x}%`, top: `${poi.floorPlanPosition.y}%`, transform: "translate(-50%, -50%)", width: 34, height: 34, borderRadius: "50%", border: "2px solid #fff", background: poi.id === selectedPoiId ? "#ef4444" : "#d4af37", color: "#111", cursor: "pointer", boxShadow: "0 2px 7px #0008", fontWeight: 700 }}>•</button>)}
              </div>
            </div>
          </> : <div style={{ height: 600, display: "grid", placeItems: "center", border: "1px dashed #555", color: "#888" }}>Your floor plan preview will appear here.</div>}
        </section>
      </div>
    </div>
  );
};

export default FloorPlan;
