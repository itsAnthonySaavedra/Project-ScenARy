import React, { useEffect, useMemo, useState } from "react";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { writeAuditLog } from "../../lib/auditLog";
import { deleteStorageFile, inspectGlbTextures, MAX_GLB_FILE_SIZE_BYTES, uploadStorageFile } from "../../lib/storageUpload";
import { MODEL_CONTENT_TYPE, normalizeContentType } from "../../lib/contentTypes";
import { hasReadyLandmarkARContent, isContentReady } from "../../lib/contentQuality";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";
import { createDefaultModelSpawnPoint, serializeModelSpawnPoint } from "../../lib/modelSpawnPoint";
import ModelSpawnPointEditor from "../../components/common/ModelSpawnPointEditor";
import ContentPreview from "../../components/common/ContentPreview";
import LandmarkDiscussion from "../../components/common/LandmarkDiscussion";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import TourPackageUpload from "../../components/common/TourPackageUpload";

const hasReadyARForLandmark = (landmark, pois, contentItems) => {
  if (!landmark) return false;
  const contentIds = new Set([
    ...(Array.isArray(landmark.contentIds) ? landmark.contentIds : []),
    ...pois
      .filter((poi) => poi.landmarkId === landmark.id)
      .flatMap((poi) => Array.isArray(poi.contentIds) ? poi.contentIds : []),
  ]);
  return hasReadyLandmarkARContent(
    { ...landmark, contentIds: [...contentIds] },
    contentItems,
  );
};

const DeveloperWorkspace = () => {
  const { currentUser } = useAuth();
  const [institutionId, setInstitutionId] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [contents, setContents] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [pois, setPois] = useState([]);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [modelUrl, setModelUrl] = useState("");
  const [spawnPoint, setSpawnPoint] = useState(createDefaultModelSpawnPoint);
  const [spawnPointEnabled, setSpawnPointEnabled] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewContent, setPreviewContent] = useState(null);
  const [approvingModelId, setApprovingModelId] = useState("");
  const [isTourUploadOpen, setIsTourUploadOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return undefined;
    }
    let stopContents = () => {};
    let stopLandmarks = () => {};
    let stopPois = () => {};
    let disposed = false;
    const loadProfile = async () => {
      try {
        const profile = await getDoc(doc(db, "users", currentUser.uid));
        const assignedInstitutionId = profile.data()?.institutionId;
        if (!profile.exists() || !assignedInstitutionId) {
          setError("Your Developer account must be assigned to an institution.");
          setLoading(false);
          return;
        }
        const id = String(assignedInstitutionId);
        const institution = await getDoc(doc(db, "institutions", id));
        if (disposed) return;
        setInstitutionId(id);
        setInstitutionName(institution.exists() ? institution.data().name || "Assigned institution" : "Assigned institution");
        stopContents = onSnapshot(
          query(collection(db, "content"), where("institutionId", "==", id)),
          (snapshot) => {
            setContents(snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
              type: normalizeContentType(item.data().type),
            })));
            setError("");
            setLoading(false);
          },
          (snapshotError) => {
            console.error("Unable to load Developer content:", snapshotError);
            setError(getFirebaseErrorMessage(snapshotError, "Unable to load content for this institution."));
            setLoading(false);
          },
        );
        stopLandmarks = onSnapshot(
          query(collection(db, "landmarks"), where("institutionId", "==", id)),
          (snapshot) => {
            const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
            setLandmarks(rows);
            setSelectedLandmarkId((selected) => selected || rows[0]?.id || "");
          },
          (snapshotError) => {
            console.error("Unable to load Developer landmarks:", snapshotError);
            setError(getFirebaseErrorMessage(snapshotError, "Unable to load landmarks."));
          },
        );
        stopPois = onSnapshot(
          query(collection(db, "pois"), where("institutionId", "==", id)),
          (snapshot) => setPois(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
          (snapshotError) => {
            console.error("Unable to load Developer POIs:", snapshotError);
            setError(getFirebaseErrorMessage(snapshotError, "Unable to load POIs."));
          },
        );
      } catch (profileError) {
        console.error("Unable to load Developer workspace profile:", profileError);
        setError(getFirebaseErrorMessage(profileError, "Unable to load your Developer workspace."));
        setLoading(false);
      }
    };
    loadProfile();
    return () => {
      disposed = true;
      stopContents();
      stopLandmarks();
      stopPois();
    };
  }, [currentUser]);

  const selectedLandmark = landmarks.find((item) => item.id === selectedLandmarkId);
  const arContent = useMemo(
    () => contents.filter((item) => normalizeContentType(item.type) !== MODEL_CONTENT_TYPE),
    [contents],
  );
  const linkedContent = Array.isArray(selectedLandmark?.contentIds)
    ? selectedLandmark.contentIds
    : [];
  const vrModels = contents.filter(
    (item) => normalizeContentType(item.type) === MODEL_CONTENT_TYPE,
  );
  const selectedLandmarkHasModel = contents.some(
    (item) =>
      linkedContent.includes(item.id) &&
      normalizeContentType(item.type) === MODEL_CONTENT_TYPE,
  ) || Boolean(selectedLandmark?.vrDraftContentId || selectedLandmark?.vrPublishedContentId);
  const hasAR = hasReadyARForLandmark(selectedLandmark, pois, contents);

  const handleUpload = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!institutionId || !currentUser || !selectedLandmark) {
      setError("Choose a landmark before uploading a model.");
      return;
    }
    if (!hasAR) {
      setError("Add complete AR content to this landmark before uploading its paired VR model.");
      return;
    }
    if (selectedLandmarkHasModel) {
      setError("This landmark already has a VR model assigned.");
      return;
    }
    if (!file && !modelUrl.trim()) {
      setError("Upload a GLB model or provide a model URL.");
      return;
    }
    if (file && file.size > MAX_GLB_FILE_SIZE_BYTES) {
      setError("VR models must be 1 GB or smaller.");
      return;
    }
    setSaving(true);
    let uploaded = null;
    try {
      if (file) {
        const textureInfo = await inspectGlbTextures(file);
        if (textureInfo.externalImageUris.length) {
          throw new Error("This GLB references external textures. Export it with textures embedded.");
        }
        uploaded = await uploadStorageFile(
          file,
          `content-models/${institutionId}`,
          setUploadProgress,
        );
      }
      const finalModelUrl = uploaded?.url || modelUrl.trim();
      const contentRef = doc(collection(db, "content"));
      const landmarkRef = doc(db, "landmarks", selectedLandmark.id);
      const batch = writeBatch(db);
      batch.set(contentRef, {
        title: title.trim() || `${selectedLandmark.landmarkName || selectedLandmark.institutionName || "Landmark"} VR model`,
        type: MODEL_CONTENT_TYPE,
        scope: "Landmark",
        institutionId,
        targetId: selectedLandmark.id,
        targetName: selectedLandmark.landmarkName || selectedLandmark.institutionName || "",
        status: "Awaiting Curator Approval",
        developerApproved: true,
        developerApprovedAt: serverTimestamp(),
        developerApprovedBy: currentUser.uid,
        curatorApproved: false,
        data: {
          modelUrl: finalModelUrl,
          ...(uploaded
            ? {
                modelFileName: uploaded.fileName,
                modelFileType: uploaded.fileType,
                modelStoragePath: uploaded.storagePath,
              }
            : {}),
          ...(spawnPointEnabled ? serializeModelSpawnPoint(spawnPoint) : {}),
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(landmarkRef, {
        contentIds: arrayUnion(contentRef.id),
        updatedAt: serverTimestamp(),
      });
      try {
        await batch.commit();
      } catch (saveError) {
        if (uploaded) {
          try {
            await deleteStorageFile(uploaded.storagePath);
          } catch (cleanupError) {
            console.error("Failed to clean up an unlinked model upload:", cleanupError);
          }
        }
        throw saveError;
      }
      let auditWarning = false;
      try {
        await writeAuditLog({
          actorId: currentUser.uid,
          actorRole: "developer",
          action: "content.model-uploaded",
          entityType: "content",
          entityId: contentRef.id,
          metadata: {
            title: title.trim() || `${selectedLandmark.landmarkName || "Landmark"} VR model`,
            institutionId,
            landmarkId: selectedLandmark.id,
            fileName: uploaded?.fileName || null,
          },
          throwOnFailure: true,
        });
      } catch (auditError) {
        console.error("Model was uploaded, but its audit record could not be written:", auditError);
        setNotice("Model uploaded; its activity record could not be saved.");
        auditWarning = true;
      }
      if (!auditWarning) setNotice("Model uploaded and sent to the Curator for verification.");
      setTitle("");
      setFile(null);
      setModelUrl("");
      setSpawnPoint(createDefaultModelSpawnPoint());
      setSpawnPointEnabled(false);
    } catch (uploadError) {
      console.error("Unable to upload Developer VR model:", uploadError);
      setError(getFirebaseErrorMessage(uploadError, uploadError.message || "Unable to upload the VR model."));
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const handleApproveExistingModel = async (item) => {
    const targetLandmark = landmarks.find((landmark) => landmark.id === item.targetId);
    if (
      !currentUser ||
      !hasReadyARForLandmark(targetLandmark, pois, contents) ||
      !isContentReady(item)
    ) {
      setError("Complete AR content and model details are required before Developer approval.");
      return;
    }
    setApprovingModelId(item.id);
    setError("");
    setNotice("");
    try {
      await updateDoc(doc(db, "content", item.id), {
        developerApproved: true,
        developerApprovedAt: serverTimestamp(),
        developerApprovedBy: currentUser.uid,
        curatorApproved: false,
        curatorApprovedAt: null,
        curatorApprovedBy: null,
        status: "Awaiting Curator Approval",
        updatedAt: serverTimestamp(),
      });
      try {
        await writeAuditLog({
          actorId: currentUser.uid,
          actorRole: "developer",
          action: "content.developer-approved",
          entityType: "content",
          entityId: item.id,
          metadata: { institutionId, title: item.title },
          throwOnFailure: true,
        });
        setNotice("Developer review recorded. The model is ready for Curator verification.");
      } catch (auditError) {
        console.error("Developer approval was saved, but its audit record could not be written:", auditError);
        setNotice("Developer review was saved, but its activity record could not be written.");
      }
    } catch (approvalError) {
      console.error("Unable to record Developer model approval:", approvalError);
      setError(getFirebaseErrorMessage(approvalError, "Unable to approve this model."));
    } finally {
      setApprovingModelId("");
    }
  };

  if (loading) return <div style={{ padding: 24, color: "#ddd" }}>Loading model workspace...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px", color: "#ddd" }}>
      <PageHeader
        eyebrow="Developer / 3D modeller"
        title="Model Workspace"
        description={`Assigned institution: ${institutionName}. Review AR drafts, upload the landmark VR model, and coordinate with the Curator.`}
      />

      {error && <div role="alert" style={{ marginTop: 16, color: "#fecaca" }}>{error}</div>}
      {notice && <div role="status" style={{ marginTop: 16, color: "#86efac" }}>{notice}</div>}
      <button
        type="button"
        onClick={() => setIsTourUploadOpen(true)}
        disabled={!institutionId}
        style={{ marginTop: 16, border: "1px solid #645326", background: "transparent", color: "#f3d16f", borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}
      >
        Upload interactive tour ZIP
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, .8fr) minmax(0, 1.2fr)", gap: 20, marginTop: 20 }}>
        <section style={{ padding: 20, borderRadius: 14, background: "#151515", border: "1px solid #34312a" }}>
          <h2 style={{ marginTop: 0, color: "#f3d16f" }}>Upload VR model</h2>
          <p style={{ color: "#aaa", fontSize: 14 }}>
            {hasAR ? "Complete AR references are available for this landmark." : "Add a complete AR item to this landmark before creating the paired VR model."}
          </p>
          <form onSubmit={handleUpload} style={{ display: "grid", gap: 12 }}>
            <label>
              Landmark
              <select value={selectedLandmarkId} onChange={(event) => setSelectedLandmarkId(event.target.value)} required style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }}>
                <option value="">Select landmark</option>
                {landmarks.map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.landmarkName || landmark.institutionName || landmark.id}</option>)}
              </select>
            </label>
            <label>
              Model title (optional)
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Landmark VR model" style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }} />
            </label>
            <label>
              Upload GLB
              <input type="file" accept=".glb,model/gltf-binary" onChange={(event) => setFile(event.target.files?.[0] || null)} style={{ display: "block", marginTop: 6 }} />
            </label>
            <label>
              Or use an existing model URL
              <input value={modelUrl} onChange={(event) => setModelUrl(event.target.value)} placeholder="https://.../model.glb" style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }} />
            </label>
            <ModelSpawnPointEditor enabled={spawnPointEnabled} onEnabledChange={setSpawnPointEnabled} value={spawnPoint} onChange={setSpawnPoint} modelUrl={modelUrl} />
            {saving && <progress max="100" value={uploadProgress} aria-label="Model upload progress" style={{ width: "100%" }} />}
            <button type="submit" disabled={saving || !hasAR || selectedLandmarkHasModel} style={{ border: 0, borderRadius: 8, padding: "11px 16px", background: "#d4af37", color: "#16130b", fontWeight: 700, cursor: "pointer" }}>
              {saving ? "Uploading..." : selectedLandmarkHasModel ? "Model already assigned" : "Submit for Curator verification"}
            </button>
          </form>
        </section>

        <section style={{ padding: 20, borderRadius: 14, background: "#151515", border: "1px solid #34312a" }}>
          <h2 style={{ marginTop: 0, color: "#f3d16f" }}>AR references and drafts</h2>
          <p style={{ color: "#aaa", fontSize: 14 }}>Draft content is visible here so you can use it as modelling reference.</p>
          {arContent.length === 0 ? <p style={{ color: "#888" }}>No AR content is available yet.</p> : (
            <div style={{ display: "grid", gap: 10 }}>
              {arContent.map((item) => (
                <article key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 12, borderRadius: 9, background: "#1d1d1d" }}>
                  <div>
                    <strong style={{ color: "#eee" }}>{item.title || "Untitled AR content"}</strong>
                    <div style={{ color: "#999", fontSize: 12 }}>{item.type} · {item.status || "Draft"}</div>
                  </div>
                  <button type="button" onClick={() => setPreviewContent(item)} style={{ border: "1px solid #645326", background: "transparent", color: "#f3d16f", borderRadius: 7, padding: "8px 12px" }}>Preview</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {vrModels.length > 0 && (
        <section style={{ marginTop: 22, padding: 20, borderRadius: 14, background: "#151515", border: "1px solid #34312a" }}>
          <h2 style={{ marginTop: 0, color: "#f3d16f" }}>VR model review</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {vrModels.map((item) => (
              <article key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 12, borderRadius: 9, background: "#1d1d1d" }}>
                <div>
                  <strong style={{ color: "#eee" }}>{item.title || "Untitled VR model"}</strong>
                  <div style={{ color: "#999", fontSize: 12 }}>{item.status || "Draft"} · {item.developerApproved ? "Developer approved" : "Developer review required"}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setPreviewContent(item)} style={{ border: "1px solid #645326", background: "transparent", color: "#f3d16f", borderRadius: 7, padding: "8px 12px" }}>Preview</button>
                  {!item.developerApproved && item.status !== "Published" && (
                    <button type="button" onClick={() => handleApproveExistingModel(item)} disabled={approvingModelId === item.id} style={{ border: 0, background: "#d4af37", color: "#16130b", borderRadius: 7, padding: "8px 12px", fontWeight: 700 }}>
                      {approvingModelId === item.id ? "Saving..." : "Approve technical review"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {selectedLandmark && (
        <LandmarkDiscussion
          institutionId={institutionId}
          landmarkId={selectedLandmark.id}
        />
      )}

      {isTourUploadOpen && (
        <TourPackageUpload
          institutions={[{ id: institutionId, name: institutionName }]}
          allowedInstitutionId={institutionId}
          developerUid={currentUser?.uid || null}
          onClose={() => setIsTourUploadOpen(false)}
          onSaved={async (saved) => {
            setIsTourUploadOpen(false);
            try {
              await writeAuditLog({
                actorId: currentUser?.uid || null,
                actorRole: "developer",
                action: "content.model-uploaded",
                entityType: "content",
                entityId: saved.id,
                metadata: {
                  institutionId,
                  landmarkId: saved.landmarkId,
                  fileName: saved.fileName,
                  tourPackage: true,
                },
                throwOnFailure: true,
              });
              setNotice("Interactive tour submitted for Curator verification.");
            } catch (auditError) {
              console.error("Interactive tour was uploaded, but its audit record could not be written:", auditError);
              setNotice("Interactive tour uploaded; its activity record could not be saved.");
            }
          }}
        />
      )}

      <Modal isOpen={Boolean(previewContent)} onClose={() => setPreviewContent(null)} title={previewContent?.title || "AR content preview"} size="wide">
        {previewContent && (
          <>
            <p style={{ color: "#aaa" }}>{previewContent.status || "Draft"} · {isContentReady(previewContent) ? "Ready" : "Needs attention"}</p>
            <ContentPreview content={previewContent} />
            {previewContent.targetId && (
              <LandmarkDiscussion
                institutionId={institutionId}
                landmarkId={previewContent.targetId}
              />
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default DeveloperWorkspace;
