import React, { useCallback, useEffect, useRef, useState } from "react";
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, deleteField } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { QRCodeCanvas } from "qrcode.react";
import commonStyles from "../../components/common/Common.module.css";
import { db } from "../../lib/firebase";
import { getContentScope } from "../../lib/contentScope";
import { normalizeContentType } from "../../lib/contentTypes";
import { writeAuditLog } from "../../lib/auditLog";
import { deleteStorageFile, uploadStorageFile } from "../../lib/storageUpload";
import { createPoiCatalog, downloadPoiCatalog } from "../../lib/poiCatalog";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";

const POIManagement = ({ adminMode = false }) => {
  const [institutionId, setInstitutionId] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [pois, setPois] = useState([]);
  const [contents, setContents] = useState([]);
  const [selectedContentIds, setSelectedContentIds] = useState([]);
  const [selectedPoiId, setSelectedPoiId] = useState(null);
  const [form, setForm] = useState({ institutionId: "", landmarkId: "", name: "", qrCode: "", imageUrl: "", imageStoragePath: "", markerImageUrl: "", markerStoragePath: "", markerFileName: "", markerWidthMeters: "" });
  const availableContent = contents.filter((item) =>
    getContentScope(item) === "POI" &&
    (adminMode || ["Information", "Fun Fact", "Quiz"].includes(normalizeContentType(item.type))),
  );
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [markerImageFile, setMarkerImageFile] = useState(null);
  const [markerImagePreviewUrl, setMarkerImagePreviewUrl] = useState("");
  const [removeMarkerImage, setRemoveMarkerImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [poiLoadError, setPoiLoadError] = useState("");
  const [poiExportError, setPoiExportError] = useState("");
  const poiLoadVersion = useRef(0);
  const qrCanvasRef = useRef(null);
  const imageInputRef = useRef(null);
  const markerImageInputRef = useRef(null);
  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);
  useEffect(() => {
    if (!markerImageFile) {
      setMarkerImagePreviewUrl("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(markerImageFile);
    setMarkerImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [markerImageFile]);

  const loadData = useCallback(async (id) => {
    const version = ++poiLoadVersion.current;
    setPoiLoadError("");
    setPoiExportError("");
    setLoading(true);
    if (!id) {
      setLandmarks([]);
      setPois([]);
      setContents([]);
      setLoading(false);
      return;
    }
    try {
      const [landmarkSnap, poiSnap, contentSnap] = await Promise.all([
        getDocs(query(collection(db, "landmarks"), where("institutionId", "==", id))),
        getDocs(query(collection(db, "pois"), where("institutionId", "==", id))),
        getDocs(query(collection(db, "content"), where("institutionId", "==", id))),
      ]);
      if (version !== poiLoadVersion.current) return;
      setLandmarks(landmarkSnap.docs.map((item) => ({ ...item.data(), id: item.id })));
      setPois(poiSnap.docs.map((item) => ({ ...item.data(), id: item.id })));
      setContents(contentSnap.docs.map((item) => ({ ...item.data(), id: item.id })));
      setFormError("");
    } catch (error) {
      if (version !== poiLoadVersion.current) return;
      console.error("Unable to load POI management data:", error);
      setPoiLoadError(
        getFirebaseErrorMessage(error, "Unable to load POI data. Check your connection and try again."),
      );
    } finally {
      if (version === poiLoadVersion.current) setLoading(false);
    }
  }, []);

  const exportPoiList = (catalog) => {
    if (poiLoadError || !catalog?.pois.length) return;
    setPoiExportError("");
    try {
      downloadPoiCatalog(catalog);
    } catch (error) {
      console.error("Unable to start POI export:", error);
      setPoiExportError("Couldn't start the POI download. Check browser downloads and try Export POIs for Unity again.");
    }
  };

  useEffect(() => onAuthStateChanged(getAuth(), async (user) => {
    if (!user) {
      setInstitutionId(null);
      await loadData(null);
      return;
    }
    try {
      if (adminMode) {
        const institutionSnap = await getDocs(collection(db, "institutions"));
        if (getAuth().currentUser?.uid !== user.uid) return;
        setInstitutions(institutionSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoading(false);
        return;
      }
      const profile = await getDoc(doc(db, "users", user.uid));
      if (getAuth().currentUser?.uid !== user.uid) return;
      if (profile.exists() && profile.data().institutionId) {
        const id = profile.data().institutionId;
        setInstitutionId(id);
        await loadData(id);
      } else {
        setFormError("Your account is not linked to an institution. Contact an administrator.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Unable to initialize POI management:", error);
      setFormError(
        getFirebaseErrorMessage(error, "Unable to load POI management. Refresh and try again."),
      );
      setLoading(false);
    }
  }, (error) => {
    console.error("Unable to check the signed-in user for POI management:", error);
    setFormError(getFirebaseErrorMessage(error, "Unable to verify your sign-in."));
    setLoading(false);
  }), [adminMode, loadData]);

  const updateField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const resetForm = () => {
    setSelectedPoiId(null);
    setSelectedContentIds([]);
    setForm({ institutionId: adminMode ? institutionId || "" : "", landmarkId: "", name: "", qrCode: "", imageUrl: "", imageStoragePath: "", markerImageUrl: "", markerStoragePath: "", markerFileName: "", markerWidthMeters: "" });
    setImageFile(null);
    setRemoveImage(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setMarkerImageFile(null);
    setRemoveMarkerImage(false);
    if (markerImageInputRef.current) markerImageInputRef.current.value = "";
    setFormError("");
  };

  const selectInstitution = async (id) => {
    setInstitutionId(id);
    setSelectedPoiId(null);
    setSelectedContentIds([]);
    setForm({ institutionId: id, landmarkId: "", name: "", qrCode: "", imageUrl: "", imageStoragePath: "", markerImageUrl: "", markerStoragePath: "", markerFileName: "", markerWidthMeters: "" });
    setImageFile(null);
    setRemoveImage(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setMarkerImageFile(null);
    setRemoveMarkerImage(false);
    if (markerImageInputRef.current) markerImageInputRef.current.value = "";
    setFormError("");
    setLandmarks([]);
    setPois([]);
    setContents([]);
    await loadData(id);
  };

  const generateLandmarkPoiQr = async (landmarkId = form.landmarkId) => {
    if (!landmarkId) {
      setFormError("Select a landmark before generating the shared POI QR.");
      return;
    }
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const generatedQrCode = `SCENARY|POI_GROUP|${id}`;
    try {
      await updateDoc(doc(db, "landmarks", landmarkId), { poiQrCode: generatedQrCode });
      setForm((current) => ({ ...current, qrCode: generatedQrCode }));
      setFormError("");
      await loadData(institutionId);
      try {
        await writeAuditLog({
          actorId: getAuth().currentUser?.uid,
          actorRole: adminMode ? "admin" : "institution",
          action: "landmark.poi_qr_generated",
          entityType: "landmark",
          entityId: landmarkId,
          metadata: { institutionId, landmarkId },
          throwOnFailure: true,
        });
      } catch (auditError) {
        console.error("POI QR was saved, but its audit record could not be written:", auditError);
        setFormError("The shared QR was saved, but its activity record could not be written.");
      }
    } catch (error) {
      console.error("Unable to save the landmark POI QR:", error);
      setFormError(
        getFirebaseErrorMessage(error, "Unable to save the landmark POI QR."),
      );
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
      imageUrl: poi.imageUrl || "",
      imageStoragePath: poi.imageStoragePath || "",
      markerImageUrl: poi.markerImageUrl || "",
      markerStoragePath: poi.markerStoragePath || "",
      markerFileName: poi.markerFileName || "",
      markerWidthMeters: poi.markerWidthMeters == null ? "" : String(poi.markerWidthMeters),
    });
    setImageFile(null);
    setRemoveImage(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setMarkerImageFile(null);
    setRemoveMarkerImage(false);
    if (markerImageInputRef.current) markerImageInputRef.current.value = "";
    setFormError("");
  };

  const removePoi = async (poi) => {
    if (!window.confirm(`Remove ${poi.name}?`)) return;
    try {
      await deleteDoc(doc(db, "pois", poi.id));
    } catch (error) {
      console.error("Unable to remove POI:", error);
      setFormError(
        getFirebaseErrorMessage(error, "Unable to remove the POI. Please try again."),
      );
      return;
    }
    const warnings = [];
    if (poi.imageStoragePath) {
      try {
        await deleteStorageFile(poi.imageStoragePath);
      } catch (error) {
        console.error("POI was removed but its image could not be deleted:", error);
        warnings.push("Its location image could not be deleted from storage.");
      }
    }
    if (poi.markerStoragePath) {
      try {
        await deleteStorageFile(poi.markerStoragePath);
      } catch (error) {
        console.error("POI was removed but its plaque image could not be deleted:", error);
        warnings.push("Its plaque image could not be deleted from storage.");
      }
    }
    try {
      await writeAuditLog({
        actorId: getAuth().currentUser?.uid,
        actorRole: adminMode ? "admin" : "institution",
        action: "poi.deleted",
        entityType: "poi",
        entityId: poi.id,
        metadata: { institutionId: poi.institutionId || institutionId, name: poi.name || "" },
        throwOnFailure: true,
      });
    } catch (error) {
      console.error("POI was removed, but its audit record could not be written:", error);
      warnings.push("Its activity record could not be written.");
    }
    if (selectedPoiId === poi.id) resetForm();
    await loadData(institutionId);
    if (warnings.length) {
      setFormError(`POI removed. ${warnings.join(" ")}`);
    }
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
    const hasMarkerWidth = form.markerWidthMeters.trim() !== "";
    const markerWidthMeters = hasMarkerWidth ? Number(form.markerWidthMeters) : null;
    const hasMarkerImage = Boolean(markerImageFile || (form.markerImageUrl && !removeMarkerImage));
    if ((hasMarkerWidth || hasMarkerImage) && (!hasMarkerImage || !Number.isFinite(markerWidthMeters) || markerWidthMeters <= 0)) {
      setFormError("A plaque image and a real width greater than 0 metres are both required.");
      return;
    }
    setSaving(true);
    setFormError("");
    let uploadedImage = null;
    let uploadedMarkerImage = null;
    let poiSaved = false;
    try {
      if (imageFile) uploadedImage = await uploadStorageFile(imageFile, `poi-images/${ownerId}`);
      if (markerImageFile) uploadedMarkerImage = await uploadStorageFile(markerImageFile, `markers/${ownerId}`);
      const poiData = {
        institutionId: ownerId,
        landmarkId: form.landmarkId,
        name: form.name.trim(),
        qrCode: sharedLandmarkQr,
        contentIds: adminMode
          ? selectedContentIds
          : selectedContentIds.filter((contentId) =>
            availableContent.some((item) => item.id === contentId) ||
            (pois.find((poi) => poi.id === selectedPoiId)?.contentIds || []).includes(contentId),
          ),
        updatedAt: serverTimestamp(),
      };
      const imageFields = uploadedImage
        ? {
          imageUrl: uploadedImage.url,
          imageStoragePath: uploadedImage.storagePath,
          imageFileName: uploadedImage.fileName,
          imageFileType: uploadedImage.fileType,
        }
        : {};
      const markerImageFields = uploadedMarkerImage
        ? {
          markerImageUrl: uploadedMarkerImage.url,
          markerStoragePath: uploadedMarkerImage.storagePath,
          markerFileName: uploadedMarkerImage.fileName,
          markerFileType: uploadedMarkerImage.fileType,
        }
        : {};
      let savedPoiId = selectedPoiId;
      if (selectedPoiId) {
        await updateDoc(doc(db, "pois", selectedPoiId), {
          ...poiData,
          ...imageFields,
          ...markerImageFields,
          ...(markerWidthMeters !== null ? { markerWidthMeters } : {}),
          ...(removeImage ? {
            imageUrl: deleteField(),
            imageStoragePath: deleteField(),
            imageFileName: deleteField(),
            imageFileType: deleteField(),
          } : {}),
          ...(removeMarkerImage ? {
            markerImageUrl: deleteField(),
            markerStoragePath: deleteField(),
            markerFileName: deleteField(),
            markerFileType: deleteField(),
            markerWidthMeters: deleteField(),
          } : {}),
        });
      } else {
        const createdPoi = await addDoc(collection(db, "pois"), {
          ...poiData,
          ...imageFields,
          ...markerImageFields,
          ...(markerWidthMeters !== null ? { markerWidthMeters } : {}),
          createdAt: serverTimestamp(),
        });
        savedPoiId = createdPoi.id;
      }
      poiSaved = true;
      const warnings = [];
      if (form.imageStoragePath && (uploadedImage || removeImage)) {
        try {
          await deleteStorageFile(form.imageStoragePath);
        } catch (error) {
          console.error("POI image was updated but the previous image could not be deleted:", error);
          warnings.push("The previous location image could not be deleted from storage.");
        }
      }
      if (form.markerStoragePath && (uploadedMarkerImage || removeMarkerImage)) {
        try {
          await deleteStorageFile(form.markerStoragePath);
        } catch (error) {
          console.error("POI plaque image was updated but the previous image could not be deleted:", error);
          warnings.push("The previous plaque image could not be deleted from storage.");
        }
      }
      try {
        await writeAuditLog({
          actorId: getAuth().currentUser?.uid,
          actorRole: adminMode ? "admin" : "institution",
          action: selectedPoiId ? "poi.updated" : "poi.created",
          entityType: "poi",
          entityId: savedPoiId,
          metadata: { institutionId: ownerId, landmarkId: form.landmarkId, name: form.name.trim() },
          throwOnFailure: true,
        });
      } catch (auditError) {
        console.error("POI was saved, but its audit record could not be written:", auditError);
        warnings.push("The activity record could not be written.");
      }
      resetForm();
      await loadData(institutionId);
      if (warnings.length) setFormError(`POI saved. ${warnings.join(" ")}`);
    } catch (error) {
      console.error("Unable to save POI:", error);
      if (uploadedImage && !poiSaved) {
        try {
          await deleteStorageFile(uploadedImage.storagePath);
        } catch (cleanupError) {
          console.error("Unable to clean up the uploaded POI image after save failed:", cleanupError);
        }
      }
      if (uploadedMarkerImage && !poiSaved) {
        try {
          await deleteStorageFile(uploadedMarkerImage.storagePath);
        } catch (cleanupError) {
          console.error("Unable to clean up the uploaded plaque image after POI save failed:", cleanupError);
        }
      }
      setFormError(
        getFirebaseErrorMessage(error, "Unable to save the POI. Check your connection and try again."),
      );
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading POIs...</div>;

  return <div style={{ padding: 20, color: "#ccc" }}>
    <h2 style={{ color: "#d4af37" }}>{adminMode ? "POI Administration" : "Points of Interest"}</h2>
    {formError && <div role="alert" style={{ color: "#fbbf24", margin: "0 0 16px" }}>{formError}</div>}
    {poiLoadError && <div role="alert" style={{ color: "#fbbf24", marginBottom: 16 }}>
      {poiLoadError}{" "}
      <button type="button" className={commonStyles.btnOutline} onClick={() => loadData(institutionId)}>Retry loading POIs</button>
    </div>}
    {poiExportError && <div role="alert" style={{ color: "#fbbf24", marginBottom: 16 }}>{poiExportError}</div>}
    <p>POIs are child objects identified by their own QR codes. Landmark QR codes are managed from the landmark pin.</p>
    {adminMode && <div style={{ maxWidth: 420, marginBottom: 20 }}>
      <label htmlFor="poi-institution-select" style={{ display: "block", color: "#fff", marginBottom: 8 }}>Select institution</label>
      <select id="poi-institution-select" className={commonStyles.formControl} value={institutionId || ""} onChange={(event) => selectInstitution(event.target.value)}>
        <option value="">Choose an institution</option>
        {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name || institution.id}</option>)}
      </select>
    </div>}
    {adminMode && !institutionId ? <div style={{ color: "#888" }}>Choose an institution to view and manage its POIs.</div> : landmarks.length === 0 ? (!poiLoadError && <div style={{ color: "#fbbf24" }}>Create a landmark before adding a POI.</div>) : <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 20 }}>
      <form onSubmit={savePoi} className={commonStyles.contentCard} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20 }}>
        <h3 style={{ color: "#fff" }}>{selectedPoiId ? "Edit POI" : "Add POI"}</h3>
        <select className={commonStyles.formControl} value={form.landmarkId} onChange={(e) => {
          const selectedLandmark = landmarks.find((landmark) => landmark.id === e.target.value);
          updateField("landmarkId", e.target.value);
          updateField("qrCode", selectedLandmark?.poiQrCode || "");
        }} required><option value="">Select parent landmark</option>{landmarks.filter((landmark) => !adminMode || landmark.institutionId === form.institutionId).map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.landmarkName || landmark.institutionName}</option>)}</select>
        <input className={commonStyles.formControl} placeholder="POI name, e.g. Painting A" value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
        <label htmlFor="poi-image" style={{ color: "#fff" }}>POI location image (optional)</label>
        <input
          ref={imageInputRef}
          id="poi-image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const selected = event.target.files?.[0] || null;
            if (selected && !["image/png", "image/jpeg", "image/webp"].includes(selected.type)) {
              setImageFile(null);
              setFormError("Choose a PNG, JPG, or WEBP image.");
              event.target.value = "";
              return;
            }
            if (selected && selected.size > 10 * 1024 * 1024) {
              setImageFile(null);
              setFormError("POI images must be 10 MB or smaller.");
              event.target.value = "";
              return;
            }
            setImageFile(selected);
            setRemoveImage(false);
            setFormError("");
          }}
          style={{ color: "#ccc" }}
        />
        <small style={{ color: "#888" }}>Upload a photo to help visitors recognize where to scan the POI. PNG, JPG, or WEBP, maximum 10 MB.</small>
        {(imagePreviewUrl || (form.imageUrl && !removeImage)) && (
          <div>
            <img src={imagePreviewUrl || form.imageUrl} alt={`Preview of ${form.name || "POI location"}`} style={{ display: "block", maxWidth: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 6 }} />
            <button type="button" className={commonStyles.btnCancel} onClick={() => {
              setImageFile(null);
              setRemoveImage(true);
              if (imageInputRef.current) imageInputRef.current.value = "";
            }}>Remove image</button>
          </div>
        )}
        <label htmlFor="poi-marker-image" style={{ color: "#fff" }}>Plaque image for AR tracking (optional)</label>
        <input
          ref={markerImageInputRef}
          id="poi-marker-image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const selected = event.target.files?.[0] || null;
            if (selected && !["image/png", "image/jpeg", "image/webp"].includes(selected.type)) {
              setMarkerImageFile(null);
              setFormError("Choose a PNG, JPG, or WEBP plaque image.");
              event.target.value = "";
              return;
            }
            if (selected && selected.size > 10 * 1024 * 1024) {
              setMarkerImageFile(null);
              setFormError("Plaque images must be 10 MB or smaller.");
              event.target.value = "";
              return;
            }
            setMarkerImageFile(selected);
            setRemoveMarkerImage(false);
            setFormError("");
          }}
          style={{ color: "#ccc" }}
        />
        <small style={{ color: "#888" }}>Choose a straight-on, tightly cropped plaque photo. PNG, JPG, or WEBP, maximum 10 MB.</small>
        <label htmlFor="poi-marker-width" style={{ color: "#fff" }}>Plaque real width (metres)</label>
        <input
          id="poi-marker-width"
          className={commonStyles.formControl}
          type="number"
          min="0.001"
          step="0.001"
          placeholder="e.g. 0.30"
          value={form.markerWidthMeters}
          onChange={(event) => updateField("markerWidthMeters", event.target.value)}
        />
        <small style={{ color: "#888" }}>For example, enter 0.30 for a plaque that is 30 cm wide. An image and width are saved together.</small>
        {(markerImagePreviewUrl || (form.markerImageUrl && !removeMarkerImage)) && (
          <div>
            <img src={markerImagePreviewUrl || form.markerImageUrl} alt={`AR plaque preview for ${form.name || "POI"}`} style={{ display: "block", maxWidth: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 6, background: "#111" }} />
            {!markerImageFile && form.markerFileName && <small style={{ display: "block", color: "#888", marginTop: 6 }}>Current plaque image: {form.markerFileName}</small>}
            <button type="button" className={commonStyles.btnCancel} onClick={() => {
              setMarkerImageFile(null);
              setRemoveMarkerImage(true);
              updateField("markerWidthMeters", "");
              if (markerImageInputRef.current) markerImageInputRef.current.value = "";
            }}>Remove plaque image</button>
          </div>
        )}
        <label style={{ color: "#fff" }}>Shared Landmark POI QR</label>
        <small style={{ color: "#888" }}>Each landmark can have one POI QR that can include many POIs or sub-modules under it.</small>
        <button type="button" className={commonStyles.btnOutline} onClick={generateQrCode}>Generate Shared Landmark QR</button>
        {form.qrCode.trim() && <div style={{ background: "#fff", padding: 12, width: "fit-content" }}><QRCodeCanvas ref={qrCanvasRef} value={form.qrCode.trim()} size={140} includeMargin /></div>}
        <div>
          <label style={{ color: "#fff", display: "block", marginBottom: 8 }}>
            Assign Existing Content
          </label>
          {!adminMode && (
            <small style={{ display: "block", color: "#888", marginBottom: 6 }}>
              Institutions can attach Information, Fun Facts, and Quizzes to POIs. VR models remain restricted.
            </small>
          )}
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
        const catalog = createPoiCatalog(institutionId, landmark, landmarkPois, contents);
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
          <div style={{ marginBottom: 12 }}>
            <button type="button" className={commonStyles.btnOutline} disabled={!!poiLoadError || !catalog?.pois.length}
              onClick={() => exportPoiList(catalog)}>
              Export POIs for Unity
            </button>
            {!poiLoadError && !catalog?.pois.length && <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
              Link a POI to published Information, Fun Fact, or Quiz content to export it.
            </div>}
          </div>
          {landmarkPois.length === 0 ? (
            <div style={{ color: "#888", paddingTop: 8 }}>No POIs added under this landmark yet.</div>
          ) : (
            <div>
              {landmarkPois.map((poi, index) => {
                const poiContent = (Array.isArray(poi.contentIds) ? poi.contentIds : [])
                  .map((contentId) => availableContent.find((content) => content.id === contentId))
                  .filter(Boolean);
                return <div key={poi.id} style={{ paddingTop: index === 0 ? 0 : 12, marginTop: index === 0 ? 0 : 12, borderTop: index === 0 ? "none" : "1px solid #333" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong>{poi.name}</strong>
                      {poi.markerImageUrl && Number.isFinite(poi.markerWidthMeters) && <div style={{ color: "#4ade80", fontSize: 12, marginTop: 4 }}>AR plaque configured ({poi.markerWidthMeters} m wide)</div>}
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
