import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDocs, getDoc, query, serverTimestamp, setDoc, updateDoc, where, deleteField } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { QRCodeCanvas } from "qrcode.react";
import commonStyles from "../../components/common/Common.module.css";
import { db, storage } from "../../lib/firebase";
import { writeAuditLog } from "../../lib/auditLog";
import { isInstitutionActive } from "../../lib/institutionStatus";

const FloorPlan = ({ adminMode = false }) => {
  const [institutionId, setInstitutionId] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [institutionName, setInstitutionName] = useState("");
  const [floorPlan, setFloorPlan] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null);
  const [pois, setPois] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [qrMessage, setQrMessage] = useState("");
  const [poiSearch, setPoiSearch] = useState("");
  const [selectedPoiId, setSelectedPoiId] = useState("");
  const [placementMode, setPlacementMode] = useState(false);
  const [savingMarker, setSavingMarker] = useState(false);
  const fileInputRef = useRef(null);

  const loadInstitutionFloorPlan = async (id) => {
    if (!id) {
      setInstitutionName("");
      setFloorPlan(null);
      setPois([]);
      setLandmarks([]);
      setMessage("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const [institutionSnapshot, floorPlanSnapshot, poiSnapshot, landmarkSnapshot] = await Promise.all([
        getDoc(doc(db, "institutions", id)),
        getDoc(doc(db, "floorPlans", id)),
        getDocs(query(collection(db, "pois"), where("institutionId", "==", id))),
        getDocs(query(collection(db, "markers"), where("institutionId", "==", id))),
      ]);
      if (!institutionSnapshot.exists()) {
        setInstitutionName("");
        setFloorPlan(null);
        setPois([]);
        setLandmarks([]);
        setMessage("This institution no longer exists.");
        return;
      }

      const institution = institutionSnapshot.data();
      setInstitutionName(institution.name || id);
      setFloorPlan(floorPlanSnapshot.exists()
        ? { id: floorPlanSnapshot.id, ...floorPlanSnapshot.data() }
        : null);
      setPois(poiSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLandmarks(landmarkSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setMessage(isInstitutionActive(institution)
        ? ""
        : "This institution is inactive. Its saved floor plan is shown for administrative review.");
    } catch (error) {
      console.error("Unable to load institution floor plan:", error);
      setMessage("Unable to load this institution's floor plan.");
      setFloorPlan(null);
      setPois([]);
      setLandmarks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => onAuthStateChanged(getAuth(), async (user) => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      if (adminMode) {
        const institutionSnapshot = await getDocs(collection(db, "institutions"));
        setInstitutions(institutionSnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })));
        setInstitutionId("");
        setInstitutionName("");
        setFloorPlan(null);
        setPois([]);
        setLandmarks([]);
        setLoading(false);
        return;
      }

      const profile = await getDoc(doc(db, "users", user.uid));
      const id = profile.exists() ? profile.data().institutionId : null;
      setInstitutionId(id || "");
      await loadInstitutionFloorPlan(id);
    } catch (error) {
      console.error("Unable to initialize floor plan:", error);
      setMessage("Unable to load floor plan data.");
      setLoading(false);
    }
  }), [adminMode]);

  const handleInstitutionChange = async (event) => {
    const id = event.target.value;
    setInstitutionId(id);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setSelectedPoiId("");
    setQrMessage("");
    await loadInstitutionFloorPlan(id);
  };

  const getQrCanvas = (landmarkId) => document.getElementById(`admin-landmark-qr-${landmarkId}`);

  const downloadLandmarkQr = (landmark) => {
    const canvas = getQrCanvas(landmark.id);
    if (!canvas) {
      setQrMessage("The QR image is not ready yet.");
      return;
    }
    const link = document.createElement("a");
    link.download = `${(landmark.landmarkName || landmark.institutionName || "landmark").replace(/[^a-z0-9-_]/gi, "-")}-poi-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setQrMessage("");
  };

  const copyLandmarkQr = async (landmark) => {
    const canvas = getQrCanvas(landmark.id);
    if (!canvas) {
      setQrMessage("The QR image is not ready yet.");
      return;
    }
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      setQrMessage("Copying QR images is not supported by this browser. Use Download QR instead.");
      return;
    }
    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((imageBlob) => imageBlob
          ? resolve(imageBlob)
          : reject(new Error("Unable to create the QR image.")), "image/png");
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setQrMessage("QR image copied to clipboard.");
    } catch (error) {
      console.error("Unable to copy landmark QR image:", error);
      setQrMessage("Unable to copy the QR image. Check clipboard permissions or use Download QR.");
    }
  };

  const printLandmarkQr = (landmark, qrCode) => {
    const canvas = getQrCanvas(landmark.id);
    if (!canvas) {
      setQrMessage("The QR image is not ready yet.");
      return;
    }
    const printWindow = window.open("", "_blank", "width=500,height=600");
    if (!printWindow) {
      setQrMessage("Allow pop-ups to print this QR code.");
      return;
    }
    const title = landmark.landmarkName || landmark.institutionName || "Landmark";
    printWindow.document.write(`<html><head><title>${title} POI QR Code</title></head><body style="font-family:sans-serif;text-align:center;padding:32px"><h1>${title}</h1><img src="${canvas.toDataURL("image/png")}" alt="QR code for ${title}" /><p>${qrCode}</p><script>window.onload=()=>{window.print();window.close();};</script></body></html>`);
    printWindow.document.close();
    setQrMessage("");
  };

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
    let uploadStage = "uploading the file to Firebase Storage";
    try {
      const storagePath = `floor-plans/${institutionId}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "-")}`;
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      uploadStage = "saving floor-plan metadata in Firestore";
      const floorPlanData = {
        institutionId,
        name: file.name,
        fileType: file.type,
        storagePath,
        url,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "floorPlans", institutionId), floorPlanData, { merge: true });
      await writeAuditLog({
        actorId: getAuth().currentUser?.uid,
        actorRole: "institution",
        action: "floorPlan.uploaded",
        entityType: "floorPlan",
        entityId: institutionId,
        metadata: { institutionId, fileName: file.name, fileType: file.type },
      });
      setFloorPlan({ ...floorPlanData, id: institutionId });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      resetViewer();
      setMessage("Floor plan uploaded successfully.");
    } catch (error) {
      console.error(`Unable to complete floor-plan upload while ${uploadStage}:`, error);
      const code = error?.code || "unknown";
      const details = error?.message || "No additional details were provided by Firebase.";
      if (code === "storage/unauthorized") {
        setMessage(`Firebase Storage denied the upload to floor-plans/${institutionId}/. Check the Storage rules for this path and account. (${code})`);
      } else if (code === "storage/cors-unsupported-method" || code === "storage/cors-unsupported-origin") {
        setMessage(`Firebase Storage blocked this browser request because of its CORS configuration. Check the bucket CORS settings for this site's origin and upload method. (${code})`);
      } else if (code === "firestore/permission-denied") {
        setMessage(`The file reached Firebase Storage, but Firestore denied saving its floor-plan record. Check the Firestore rules. (${code})`);
      } else {
        setMessage(`Floor-plan upload failed while ${uploadStage} (${code}): ${details}`);
      }
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
      await writeAuditLog({
        actorId: getAuth().currentUser?.uid,
        actorRole: "institution",
        action: "floorPlan.poi_placed",
        entityType: "poi",
        entityId: selectedPoiId,
        metadata: { institutionId, name: pois.find((poi) => poi.id === selectedPoiId)?.name || "" },
      });
      setPlacementMode(false);
    } catch (error) {
      console.error("Unable to place POI on floor plan:", error);
      setMessage("Unable to save the POI location.");
    } finally {
      setSavingMarker(false);
    }
  };

  const removeSelectedPoiPin = async () => {
    if (!selectedPoiId) return;
    setSavingMarker(true);
    setMessage("");
    try {
      await updateDoc(doc(db, "pois", selectedPoiId), {
        floorPlanPosition: deleteField(),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actorId: getAuth().currentUser?.uid,
        actorRole: "institution",
        action: "floorPlan.poi_pin_removed",
        entityType: "poi",
        entityId: selectedPoiId,
        metadata: { institutionId, name: pois.find((poi) => poi.id === selectedPoiId)?.name || "" },
      });
      setPois((current) => current.map((poi) => {
        if (poi.id !== selectedPoiId) return poi;
        const updatedPoi = { ...poi };
        delete updatedPoi.floorPlanPosition;
        return updatedPoi;
      }));
      setPlacementMode(false);
      setMessage("Pin removed successfully.");
    } catch (error) {
      console.error("Unable to remove POI pin:", error);
      setMessage("Unable to remove the POI pin.");
    } finally {
      setSavingMarker(false);
    }
  };

  const handlePointerMove = (event) => {
    if (!dragStart) return;
    setOffset({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
  };

  if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading floor plan...</div>;

  const unplacedPois = pois.filter((poi) => !poi.floorPlanPosition);
  const matchingUnplacedPois = unplacedPois.filter((poi) => poi.name?.toLowerCase().includes(poiSearch.trim().toLowerCase()));

  if (adminMode) {
    const selectedInstitution = institutions.find((institution) => institution.id === institutionId);
    const placedPois = pois.filter((poi) => poi.floorPlanPosition);
    const landmarkPoiGroups = landmarks.map((landmark) => {
      const landmarkPois = pois.filter((poi) => poi.landmarkId === landmark.id);
      return {
        landmark,
        pois: landmarkPois,
        qrCode: landmark.poiQrCode || landmarkPois.find((poi) => poi.qrCode)?.qrCode || "",
      };
    });
    const knownPoiIds = new Set(landmarkPoiGroups.flatMap((group) => group.pois.map((poi) => poi.id)));
    const orphanPois = pois.filter((poi) => !knownPoiIds.has(poi.id));
    return (
      <div style={{ padding: 20, color: "#ccc" }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ color: "#d4af37", marginBottom: 6 }}>Floor Plans &amp; POIs</h2>
          <p style={{ margin: "0 0 12px", color: "#999" }}>Select an institution to inspect its floor plan and POIs. This admin view is read-only.</p>
          <label htmlFor="admin-floor-plan-institution" style={{ color: "#ddd" }}>
            Institution
            <select
              id="admin-floor-plan-institution"
              value={institutionId || ""}
              onChange={handleInstitutionChange}
              style={{ display: "block", marginTop: 6, minWidth: 280, padding: 8 }}
            >
              <option value="">Select an institution</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name || institution.id}{isInstitutionActive(institution) ? "" : " (Inactive)"}
                </option>
              ))}
            </select>
          </label>
          {selectedInstitution && <p style={{ margin: "10px 0 0", color: "#aaa" }}>Viewing: {institutionName}</p>}
          {message && <p role="status" style={{ marginTop: 10, color: "#fbbf24" }}>{message}</p>}
        </div>
        {!institutionId ? (
          <section className={commonStyles.contentCard} style={{ padding: 20, color: "#999" }}>
            Choose an institution to view its floor plan.
          </section>
        ) : !floorPlan ? (
          <section className={commonStyles.contentCard} style={{ padding: 20, color: "#999" }}>
            No floor plan has been uploaded for this institution.
          </section>
        ) : (
          <section className={commonStyles.contentCard} style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "stretch", gap: 12, minHeight: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ color: "#fff", margin: 0 }}>{floorPlan.name || "Floor plan"}</h3>
              <span style={{ color: "#999" }}>{placedPois.length} of {pois.length} POIs placed · Read-only</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 300px)", gap: 16, alignItems: "start" }}>
              {floorPlan.fileType === "application/pdf" ? (
                <iframe title={`${institutionName} floor plan`} src={floorPlan.url} style={{ display: "block", width: "100%", height: "min(70vh, 700px)", border: "1px solid #444", background: "#fff" }} />
              ) : (
                <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", width: "100%", minHeight: 300, maxHeight: "70vh", overflow: "auto", background: "#111", border: "1px solid #444" }}>
                  <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
                    <img src={floorPlan.url} alt={`${institutionName} floor plan`} style={{ display: "block", maxWidth: "100%", maxHeight: "70vh", height: "auto", objectFit: "contain" }} />
                    {placedPois.map((poi, index) => (
                      <button
                        key={poi.id}
                        type="button"
                        title={poi.name}
                        aria-label={`Show POI ${poi.name}`}
                        onClick={() => setSelectedPoiId(poi.id)}
                        style={{
                          position: "absolute",
                          left: `${poi.floorPlanPosition.x}%`,
                          top: `${poi.floorPlanPosition.y}%`,
                          transform: "translate(-50%, -50%)",
                          width: 34,
                          height: 34,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: "50%",
                          border: "2px solid #fff",
                          background: poi.id === selectedPoiId ? "#ef4444" : "#d4af37",
                          color: "#111",
                          cursor: "pointer",
                          boxShadow: "0 2px 7px #0008",
                          fontWeight: 700,
                        }}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <aside aria-label="Points of interest and QR codes" style={{ maxHeight: "min(70vh, 700px)", overflowY: "auto", padding: 12, border: "1px solid #333", borderRadius: 8, background: "#171717" }}>
                <h4 style={{ color: "#fff", margin: "0 0 10px" }}>Landmarks &amp; POIs ({pois.length})</h4>
                {landmarkPoiGroups.length === 0 && pois.length === 0 ? (
                  <p style={{ color: "#888", margin: 0 }}>No landmarks or POIs for this institution.</p>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {landmarkPoiGroups.map(({ landmark, pois: landmarkPois, qrCode }) => {
                      const qrId = `admin-landmark-qr-${landmark.id}`;
                      return (
                        <section key={landmark.id} style={{ padding: 10, border: "1px solid #333", borderRadius: 6, background: "#202020" }}>
                          <strong style={{ color: "#d4af37" }}>{landmark.landmarkName || landmark.institutionName || "Unnamed landmark"}</strong>
                          <p style={{ color: "#888", fontSize: 12, margin: "3px 0 8px" }}>Shared landmark POI QR</p>
                          {qrCode ? (
                            <>
                              <div style={{ display: "flex", justifyContent: "center", padding: 10, background: "#fff", width: "fit-content", borderRadius: 4 }}>
                                <QRCodeCanvas id={qrId} value={qrCode} size={132} includeMargin />
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                                <button type="button" className={commonStyles.btnOutline} style={{ padding: "6px 9px", fontSize: 12 }} onClick={() => downloadLandmarkQr(landmark)}>Download QR</button>
                                <button type="button" className={commonStyles.btnOutline} style={{ padding: "6px 9px", fontSize: 12 }} onClick={() => copyLandmarkQr(landmark)}>Copy image</button>
                                <button type="button" className={commonStyles.btnOutline} style={{ padding: "6px 9px", fontSize: 12 }} onClick={() => printLandmarkQr(landmark, qrCode)}>Print QR</button>
                              </div>
                            </>
                          ) : (
                            <p style={{ color: "#888", fontSize: 12, margin: 0 }}>No shared QR has been generated for this landmark.</p>
                          )}
                          {landmarkPois.length === 0 ? (
                            <p style={{ color: "#888", fontSize: 12, margin: "10px 0 0" }}>No POIs under this landmark.</p>
                          ) : (
                            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                              {landmarkPois.map((poi) => {
                                const poiNumber = placedPois.findIndex((placedPoi) => placedPoi.id === poi.id) + 1;
                                return (
                                  <button
                                    key={poi.id}
                                    type="button"
                                    onClick={() => setSelectedPoiId(poi.id)}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: 8,
                                      width: "100%",
                                      padding: "8px 10px",
                                      textAlign: "left",
                                      color: "#eee",
                                      background: poi.id === selectedPoiId ? "rgba(212,175,55,0.18)" : "#292929",
                                      border: `1px solid ${poi.id === selectedPoiId ? "#d4af37" : "#3a3a3a"}`,
                                      borderRadius: 6,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ color: "#d4af37", minWidth: 18 }}>{poiNumber || "–"}</span>
                                      <span>{poi.name || "Unnamed POI"}</span>
                                    </span>
                                    <small style={{ color: "#999", whiteSpace: "nowrap" }}>{poiNumber ? "On map" : "Not placed"}</small>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      );
                    })}
                    {orphanPois.length > 0 && (
                      <section style={{ padding: 10, border: "1px solid #704b27", borderRadius: 6, background: "#241d16" }}>
                        <strong style={{ color: "#fbbf24" }}>POIs without a landmark</strong>
                        {orphanPois.map((poi) => (
                          <button key={poi.id} type="button" onClick={() => setSelectedPoiId(poi.id)} style={{ display: "block", width: "100%", marginTop: 6, padding: 8, textAlign: "left", color: "#eee", background: "#292929", border: "1px solid #3a3a3a", borderRadius: 6, cursor: "pointer" }}>
                            {poi.name || "Unnamed POI"} · {poi.floorPlanPosition ? "On map" : "Not placed"}
                          </button>
                        ))}
                      </section>
                    )}
                  </div>
                )}
              </aside>
            </div>
            {qrMessage && <p role="status" style={{ margin: 0, color: "#fbbf24" }}>{qrMessage}</p>}
            {selectedPoiId && pois.some((poi) => poi.id === selectedPoiId) && (
              <p role="status" style={{ margin: 0, color: "#ddd" }}>
                Selected: {pois.find((poi) => poi.id === selectedPoiId)?.name || "Unnamed POI"}
                {!pois.find((poi) => poi.id === selectedPoiId)?.floorPlanPosition && " (not placed on the floor plan)"}
              </p>
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 20, color: "#ccc" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: "#d4af37", marginBottom: 6 }}>Interactive Floor Plan</h2>
        <p style={{ margin: 0, color: "#999" }}>Upload a floor plan, then place your existing POIs on it for visitors to tap.</p>
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

        <section className={commonStyles.contentCard} style={{ padding: 16, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <div><h3 style={{ color: "#fff", marginBottom: 2 }}>{floorPlan?.name || "No floor plan uploaded"}</h3><small style={{ color: "#888" }}>{floorPlan ? "Interactive preview" : "Upload a file to begin"}</small></div>
            {floorPlan && floorPlan.fileType !== "application/pdf" && <div style={{ display: "flex", gap: 6 }}><button type="button" className={commonStyles.btnOutline} onClick={() => setScale((value) => Math.min(value + 0.25, 4))}>Zoom in</button><button type="button" className={commonStyles.btnOutline} onClick={() => setScale((value) => Math.max(value - 0.25, 0.5))}>Zoom out</button><button type="button" className={commonStyles.btnOutline} onClick={resetViewer}>Reset</button></div>}
          </div>
          {floorPlan ? floorPlan.fileType === "application/pdf" ? <iframe title="Uploaded floor plan" src={floorPlan.url} style={{ width: "100%", height: 600, border: "1px solid #444", background: "#fff" }} /> : <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <select value={selectedPoiId} onChange={(event) => setSelectedPoiId(event.target.value)} style={{ minWidth: 220, padding: 8 }}>
                <option value="">Select a POI to place or move</option>
                {pois.map((poi) => <option key={poi.id} value={poi.id}>{poi.name}</option>)}
              </select>
              <button type="button" className={commonStyles.btnPrimary} disabled={!selectedPoiId || savingMarker} onClick={() => setPlacementMode((current) => !current)}>
                  {placementMode ? "Click the floorplan..." : pois.some((poi) => poi.id === selectedPoiId && poi.floorPlanPosition) ? "Move POI pin" : "Place POI pin"}
              </button>
                <button type="button" className={commonStyles.btnOutline} disabled={!selectedPoiId || savingMarker || !pois.some((poi) => poi.id === selectedPoiId && poi.floorPlanPosition)} onClick={removeSelectedPoiPin}>
                  Remove pin
                </button>
              {pois.length === 0 && <small style={{ color: "#888" }}>Create POIs first, then place them here.</small>}
            </div>
            <section aria-label="Unplaced points of interest" style={{ marginBottom: 12, padding: 12, border: "1px solid #444", background: "#171717" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <strong style={{ color: "#fff" }}>Unplaced POIs <span style={{ color: "#d4af37" }}>({unplacedPois.length})</span></strong>
                <input type="search" aria-label="Search unplaced POIs" placeholder="Search unplaced POIs" value={poiSearch} onChange={(event) => setPoiSearch(event.target.value)} style={{ minWidth: 220, padding: 8 }} />
              </div>
              {matchingUnplacedPois.length === 0 ? <small style={{ color: "#888" }}>{unplacedPois.length ? "No unplaced POIs match this search." : "All POIs have been placed."}</small> : <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {matchingUnplacedPois.map((poi) => <button key={poi.id} type="button" className={commonStyles.btnOutline} onClick={() => { setSelectedPoiId(poi.id); setPlacementMode(true); }}>{poi.name || "Unnamed POI"} · Place</button>)}
              </div>}
            </section>
            <div onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => setDragStart(null)} onPointerCancel={() => setDragStart(null)} style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: 600, overflow: "hidden", background: "#f5f5f5", border: placementMode ? "2px solid #d4af37" : "1px solid #444", cursor: placementMode ? "crosshair" : dragStart ? "grabbing" : "grab", touchAction: "none" }}>
              <div onClick={placeSelectedPoi} style={{ position: "relative", display: "inline-block", height: "100%", maxWidth: "100%", transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "top left" }}>
                <img src={floorPlan.url} alt={floorPlan.name} draggable="false" style={{ display: "block", width: "auto", height: "100%", maxWidth: "100%", maxHeight: "100%", userSelect: "none" }} />
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
