import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { deleteStorageFile, uploadStorageFile } from "../../lib/storageUpload";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import commonStyles from "../../components/common/Common.module.css";
import { getContentScope } from "../../lib/contentScope";
import { buildGeneratedExperiences } from "../../lib/generatedExperiences";
import { writeAuditLog } from "../../lib/auditLog";
import { syncGeneratedInstitutionTour } from "../../lib/generatedTours";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";

L.Marker.prototype.options.icon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] });

const LandmarkManagement = () => {
  const [institutionId, setInstitutionId] = useState(null);
  const [landmarks, setLandmarks] = useState([]);
  const [pois, setPois] = useState([]);
  const [allContent, setAllContent] = useState([]);
  const [availableContent, setAvailableContent] = useState([]);
  const [selectedContentIds, setSelectedContentIds] = useState([]);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState("");
  const [form, setForm] = useState({ name: "", description: "", imageUrl: "", imageStoragePath: "", imageFileName: "", imageFileType: "" });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  const loadData = async (id) => {
    setLoading(true);
    try {
      const landmarkSnap = await getDocs(query(collection(db, "landmarks"), where("institutionId", "==", id)));
      const poiSnap = await getDocs(query(collection(db, "pois"), where("institutionId", "==", id)));
      const contentSnap = await getDocs(query(collection(db, "content"), where("institutionId", "==", id)));
      const landmarkItems = landmarkSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
      const poiItems = poiSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
      const contentItems = contentSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
      setLandmarks(landmarkItems);
      setPois(poiItems);
      setAllContent(contentItems);
      setAvailableContent(contentItems.filter((item) => getContentScope(item) === "Landmark"));
      setPageError("");
    } catch (error) {
      console.error("Unable to load landmark management data:", error);
      setPageError(
        getFirebaseErrorMessage(error, "Unable to load landmark data. Check your connection and try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => onAuthStateChanged(getAuth(), async (user) => {
    if (!user) { setLoading(false); return; }
    try {
      const profile = await getDoc(doc(db, "users", user.uid));
      if (profile.exists() && profile.data().institutionId) {
        const id = profile.data().institutionId;
        setInstitutionId(id);
        await loadData(id);
      } else {
        setPageError("Your account is not linked to an institution. Contact an administrator.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Unable to initialize landmark management:", error);
      setPageError(
        getFirebaseErrorMessage(error, "Unable to load landmark management. Refresh and try again."),
      );
      setLoading(false);
    }
  }, (error) => {
    console.error("Unable to check the signed-in user for landmark management:", error);
    setPageError(getFirebaseErrorMessage(error, "Unable to verify your sign-in."));
    setLoading(false);
  }), []);

  const updateField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const selectLandmark = (landmark) => {
    setSelectedLandmarkId(landmark.id);
    setForm({
      name: landmark.landmarkName || landmark.institutionName || "",
      description: landmark.info?.description ?? landmark.description ?? "",
      imageUrl: landmark.imageUrl || "",
      imageStoragePath: landmark.imageStoragePath || "",
      imageFileName: landmark.imageFileName || "",
      imageFileType: landmark.imageFileType || "",
    });
    setImageFile(null);
    setSelectedContentIds(
      (landmark.contentIds || []).filter((contentId) =>
        availableContent.some((item) => item.id === contentId),
      ),
    );
  };

  const saveLandmark = async (event) => {
    event.preventDefault();
    if (!institutionId || !selectedLandmarkId) {
      setPageError("Select a landmark before saving.");
      return;
    }
    const name = form.name.trim();
    const description = form.description.trim();
    if (!name || !description) {
      setPageError("Enter both a landmark name and description.");
      return;
    }
    setSaving(true);
    setPageError("");
    let uploadedImage = null;
    try {
      uploadedImage = imageFile
        ? await uploadStorageFile(imageFile, `markers/${institutionId}`)
        : null;
      await updateDoc(doc(db, "landmarks", selectedLandmarkId), {
        landmarkName: name,
        description,
        info: { description },
        imageUrl: uploadedImage?.url || form.imageUrl,
        imageStoragePath: uploadedImage?.storagePath || form.imageStoragePath,
        imageFileName: uploadedImage?.fileName || form.imageFileName,
        imageFileType: uploadedImage?.fileType || form.imageFileType,
        contentIds: selectedContentIds.filter((contentId) =>
          availableContent.some((item) => item.id === contentId),
        ),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Unable to save landmark:", error);
      if (uploadedImage) {
        try {
          await deleteStorageFile(uploadedImage.storagePath);
        } catch (cleanupError) {
          console.error("Unable to clean up the uploaded image after the landmark save failed:", cleanupError);
        }
      }
      setPageError(
        getFirebaseErrorMessage(error, "Unable to save the landmark. Check your connection and try again."),
      );
      setSaving(false);
      return;
    }

    const warnings = [];
    try {
      await syncGeneratedInstitutionTour(institutionId);
    } catch (tourError) {
      console.error("Landmark saved, but its generated tour could not be refreshed:", tourError);
      warnings.push("The landmark was saved, but its generated tour could not be refreshed.");
    }
    try {
      await writeAuditLog({
        actorId: getAuth().currentUser?.uid,
        actorRole: "institution",
        action: "landmark.updated",
        entityType: "landmark",
        entityId: selectedLandmarkId,
        metadata: {
          institutionId,
          name,
          ...(uploadedImage ? { imageFileName: uploadedImage.fileName } : {}),
        },
        throwOnFailure: true,
      });
    } catch (error) {
      console.error("Landmark saved, but its audit record could not be written:", error);
      warnings.push("Its activity record could not be written.");
    }
    try {
      setForm({
        ...form,
        name,
        description,
        ...(uploadedImage ? {
          imageUrl: uploadedImage.url,
          imageStoragePath: uploadedImage.storagePath,
          imageFileName: uploadedImage.fileName,
          imageFileType: uploadedImage.fileType,
        } : {}),
      });
      setImageFile(null);
      await loadData(institutionId);
    } finally {
      setSaving(false);
    }
    if (warnings.length) setPageError(warnings.join(" "));
  };

  const generatedExperiences = buildGeneratedExperiences(landmarks, pois, allContent);

  if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading landmarks...</div>;

  return <div style={{ padding: 20, color: "#ccc" }}>
    <h2 style={{ color: "#d4af37" }}>Landmarks</h2>
    {pageError && <div role="alert" style={{ color: "#fbbf24", marginBottom: 16 }}>{pageError}</div>}
    <p>Admin-created map pins are the landmarks and are associated with your institution. Give each pin its own landmark name; POIs such as artworks are added separately and linked to that pin.</p>
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
        <input className={commonStyles.formControl} placeholder="Landmark name" value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
        <textarea className={commonStyles.formControl} placeholder="Landmark information" value={form.description} onChange={(e) => updateField("description", e.target.value)} required />
        <div>
          <label htmlFor="landmark-image" style={{ color: "#fff", display: "block", marginBottom: 8 }}>Landmark picture</label>
          <input
            id="landmark-image"
            key={selectedLandmarkId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                setPageError("Choose a PNG, JPG, or WEBP landmark picture.");
                event.target.value = "";
                return;
              }
              if (file.size > 10 * 1024 * 1024) {
                setPageError("Landmark pictures must be 10 MB or smaller.");
                event.target.value = "";
                return;
              }
              setImageFile(file);
              setPageError("");
            }}
            style={{ color: "#ccc" }}
          />
          <small style={{ display: "block", color: "#888", marginTop: 6 }}>PNG, JPG, or WEBP. Maximum 10 MB. The picture uploads when you save.</small>
          {imageFile && <small style={{ display: "block", color: "#4ade80", marginTop: 6 }}>Selected: {imageFile.name}</small>}
          {!imageFile && form.imageFileName && <small style={{ display: "block", color: "#888", marginTop: 6 }}>Current picture: {form.imageFileName}</small>}
          {(imagePreview || form.imageUrl) && (
            <img
              src={imagePreview || form.imageUrl}
              alt="Landmark picture preview"
              style={{ display: "block", width: "100%", maxHeight: 180, objectFit: "contain", marginTop: 10, borderRadius: 4, background: "#111" }}
            />
          )}
        </div>
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
          {landmarks.map((landmark) => (
            <Marker key={landmark.id} position={[landmark.lat, landmark.lng]}>
              <Popup>
                <div style={{ color: "#111827", minWidth: 220, textAlign: "center" }}>
                  <strong style={{ fontSize: "1rem" }}>{landmark.landmarkName || landmark.institutionName}</strong>
                  {landmark.imageUrl && (
                    <img
                      src={landmark.imageUrl}
                      alt={landmark.landmarkName || landmark.institutionName || "Landmark"}
                      style={{ width: "100%", maxHeight: "140px", objectFit: "cover", borderRadius: "4px", marginTop: "8px" }}
                    />
                  )}
                  {(landmark.info?.description || landmark.description) && (
                    <p style={{ margin: "8px 0", color: "#4b5563", fontSize: "0.9rem", lineHeight: 1.4 }}>
                      {landmark.info?.description || landmark.description}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        <div style={{ marginTop: 12 }}>
          <h3 style={{ color: "#fff" }}>Generated experience preview</h3>
          {generatedExperiences.map((experience) => (
            <div key={experience.id} style={{ padding: 10, borderBottom: "1px solid #333" }}>
              <strong>{experience.title}</strong>
              <span style={{ color: "#888" }}> ({experience.poiCount} POIs, {experience.contentItems.length} published items)</span>
              {experience.contentItems.length > 0 ? (
                <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "#aaa" }}>
                  {experience.contentItems.map((item) => <li key={item.id}>{item.title}</li>)}
                </ul>
              ) : <div style={{ color: "#888", marginTop: 6 }}>No published content is linked yet.</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>;
};

export default LandmarkManagement;
