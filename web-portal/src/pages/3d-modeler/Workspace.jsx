import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { deleteStorageFile, uploadStorageFile } from "../../lib/storageUpload";
import { MODEL_CONTENT_TYPE, normalizeContentType } from "../../lib/contentTypes";
import { hasReadyLandmarkARContent, isContentReady } from "../../lib/contentQuality";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";
import { createDefaultModelSpawnPoint, normalizeModelSpawnPoint, serializeModelSpawnPoint } from "../../lib/modelSpawnPoint";
import { createPoiCatalog } from "../../lib/poiCatalog.js";
import { createPlacedTour, inspectTourModel } from "../../lib/tourPackage.js";
import { saveTourDraft } from "../../lib/tourPackageStore.js";
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
      .flatMap((poi) => (Array.isArray(poi.contentIds) ? poi.contentIds : [])),
  ]);
  return hasReadyLandmarkARContent(
    { ...landmark, contentIds: [...contentIds] },
    contentItems,
  );
};

const getAssignedInstitutionIds = (profileData) => {
  if (!profileData) return [];
  const list = Array.isArray(profileData.institutionIds)
    ? profileData.institutionIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const single = profileData.institutionId ? [String(profileData.institutionId).trim()] : [];
  return [...new Set([...list, ...single])];
};

const ModelerWorkspace = () => {
  const { currentUser } = useAuth();
  const [assignedInstitutions, setAssignedInstitutions] = useState([]);
  const [institutionId, setInstitutionId] = useState("");
  const [contents, setContents] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [pois, setPois] = useState([]);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [hasEmbeddedSpawn, setHasEmbeddedSpawn] = useState(false);
  const [stops, setStops] = useState([]);
  const fileInputRef = useRef(null);
  const [modelUrl, setModelUrl] = useState("");
  const [spawnPoint, setSpawnPoint] = useState(createDefaultModelSpawnPoint);
  const [spawnPointEnabled, setSpawnPointEnabled] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [checkingModel, setCheckingModel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewContent, setPreviewContent] = useState(null);
  const [approvingModelId, setApprovingModelId] = useState("");
  const [isTourUploadOpen, setIsTourUploadOpen] = useState(false);

  useEffect(() => () => {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
  }, [filePreviewUrl]);

  // Load assigned institutions for the developer
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return undefined;
    }
    let disposed = false;

    const loadProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const profile = await getDoc(doc(db, "users", currentUser.uid));
        if (disposed) return;
        const ids = getAssignedInstitutionIds(profile.data());
        if (!profile.exists() || ids.length === 0) {
          setError("Your 3D Modeler account must be assigned to at least one institution.");
          setAssignedInstitutions([]);
          setInstitutionId("");
          setLoading(false);
          return;
        }

        const institutionDocs = await Promise.all(
          ids.map(async (id) => {
            const snap = await getDoc(doc(db, "institutions", id));
            return {
              id,
              name: snap.exists() ? snap.data()?.name || "Assigned institution" : "Assigned institution",
            };
          }),
        );
        if (disposed) return;

        setAssignedInstitutions(institutionDocs);
        setInstitutionId((prev) => (ids.includes(prev) ? prev : ids[0]));
        setLoading(false);
      } catch (profileError) {
        if (disposed) return;
        console.error("Unable to load 3D Modeler workspace profile:", profileError);
        setError(getFirebaseErrorMessage(profileError, "Unable to load your 3D Modeler workspace."));
        setLoading(false);
      }
    };

    loadProfile();
    return () => {
      disposed = true;
    };
  }, [currentUser]);

  // Subscribe to selected institution's data
  useEffect(() => {
    if (!institutionId) {
      setContents([]);
      setLandmarks([]);
      setPois([]);
      setSelectedLandmarkId("");
      return undefined;
    }

    setSelectedLandmarkId("");
    setError("");

    const stopContents = onSnapshot(
      query(collection(db, "content"), where("institutionId", "==", institutionId)),
      (snapshot) => {
        setContents(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
            type: normalizeContentType(item.data().type),
          })),
        );
      },
      (snapshotError) => {
        console.error("Unable to load 3D Modeler content:", snapshotError);
        setError(getFirebaseErrorMessage(snapshotError, "Unable to load content for this institution."));
      },
    );

    const stopLandmarks = onSnapshot(
      query(collection(db, "landmarks"), where("institutionId", "==", institutionId)),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        setLandmarks(rows);
        setSelectedLandmarkId((selected) =>
          rows.some((r) => r.id === selected) ? selected : rows[0]?.id || "",
        );
      },
      (snapshotError) => {
        console.error("Unable to load 3D Modeler landmarks:", snapshotError);
        setError(getFirebaseErrorMessage(snapshotError, "Unable to load landmarks."));
      },
    );

    const stopPois = onSnapshot(
      query(collection(db, "pois"), where("institutionId", "==", institutionId)),
      (snapshot) => setPois(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (snapshotError) => {
        console.error("Unable to load 3D Modeler POIs:", snapshotError);
        setError(getFirebaseErrorMessage(snapshotError, "Unable to load POIs."));
      },
    );

    return () => {
      stopContents();
      stopLandmarks();
      stopPois();
    };
  }, [institutionId]);

  const activeInstitutionName =
    assignedInstitutions.find((inst) => inst.id === institutionId)?.name || "Assigned institution";

  const selectedLandmark = landmarks.find((item) => item.id === selectedLandmarkId && item.institutionId === institutionId);
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
  const selectedLandmarkHasModel =
    contents.some(
      (item) =>
        linkedContent.includes(item.id) &&
        normalizeContentType(item.type) === MODEL_CONTENT_TYPE,
    ) || Boolean(selectedLandmark?.vrDraftContentId || selectedLandmark?.vrPublishedContentId);
  const hasAR = hasReadyARForLandmark(selectedLandmark, pois, contents);
  const poiOptions = useMemo(
    () => createPoiCatalog(institutionId, selectedLandmark, pois, contents, { includeDrafts: true })?.pois || [],
    [institutionId, selectedLandmark, pois, contents],
  );
  const hasUnavailableStop = stops.some((stop) => !poiOptions.some((poi) => poi.id === stop.poiId));
  const needsTourSpawn = Boolean(file && (spawnPointEnabled ? !spawnPoint.positionChosen : !hasEmbeddedSpawn));

  const chooseModel = async (event) => {
    const input = event.currentTarget;
    const selected = input.files?.[0];
    setFormError("");
    setFile(null);
    setFilePreviewUrl("");
    setHasEmbeddedSpawn(false);
    setStops([]);
    setSpawnPoint(createDefaultModelSpawnPoint());
    setSpawnPointEnabled(false);
    if (!selected) return;
    setCheckingModel(true);
    try {
      const model = await inspectTourModel(selected);
      setFile(selected);
      setFilePreviewUrl(URL.createObjectURL(selected));
      setHasEmbeddedSpawn(model.hasSpawn);
    } catch (error) {
      input.value = "";
      setFormError(error.message || "This GLB could not be opened. Export it again and retry.");
    } finally {
      setCheckingModel(false);
    }
  };

  const resetModel = () => {
    setTitle("");
    setFile(null);
    setFilePreviewUrl("");
    setHasEmbeddedSpawn(false);
    setModelUrl("");
    setStops([]);
    setSpawnPoint(createDefaultModelSpawnPoint());
    setSpawnPointEnabled(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const reportSavedTour = async (saved) => {
    try {
      await writeAuditLog({
        actorId: currentUser?.uid || null,
        actorRole: "3d-modeler",
        action: "content.model-uploaded",
        entityType: "content",
        entityId: saved.id,
        metadata: {
          institutionId: saved.institutionId,
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
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (checkingModel || saving) return;
    setFormError("");
    setNotice("");
    if (!institutionId || !currentUser || !selectedLandmark) {
      setFormError("Choose an institution and landmark before uploading a model.");
      return;
    }
    if (!hasAR) {
      setFormError("Ask the Curator to add complete AR content to this landmark before submitting.");
      return;
    }
    if (!stops.length && selectedLandmarkHasModel) {
      setFormError("This landmark already has a VR model assigned.");
      return;
    }
    if (hasUnavailableStop) {
      setFormError("Remove stops linked to unavailable POIs before submitting.");
      return;
    }
    if (stops.length && needsTourSpawn) {
      setFormError("Place a player spawn before submitting the interactive tour.");
      return;
    }
    if (!file && !modelUrl.trim()) {
      setFormError("Upload a GLB model or provide a model URL.");
      return;
    }
    setUploadProgress(null);
    setSaving(true);
    let uploaded = null;
    try {
      if (stops.length) {
        const tour = await createPlacedTour(file, selectedLandmark.id, stops,
          spawnPointEnabled ? normalizeModelSpawnPoint(spawnPoint) : null);
        const tourTitle = title.trim() || `${selectedLandmark.landmarkName || selectedLandmark.institutionName || "Landmark"} virtual tour`;
        const saved = await saveTourDraft(tour, { landmark: selectedLandmark, institutionId }, tourTitle, setUploadProgress, {
          modelerUid: currentUser.uid,
          allowedInstitutionId: institutionId,
        });
        await reportSavedTour(saved);
        resetModel();
        return;
      }
      if (file) {
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
        title:
          title.trim() ||
          `${selectedLandmark.landmarkName || selectedLandmark.institutionName || "Landmark"} VR model`,
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
          actorRole: "3d-modeler",
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
      resetModel();
    } catch (uploadError) {
      console.error("Unable to upload 3D Modeler VR model:", uploadError);
      setFormError(getFirebaseErrorMessage(uploadError, uploadError.message || "Unable to upload the VR model."));
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const handleApproveExistingModel = async (item) => {
    const targetLandmark = landmarks.find((landmark) => landmark.id === item.targetId);
    if (
      !currentUser ||
      !hasReadyARForLandmark(targetLandmark, pois, contents) ||
      !isContentReady(item)
    ) {
      setError("Complete AR content and model details are required before 3D Modeler approval.");
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
          actorRole: "3d-modeler",
          action: "content.developer-approved",
          entityType: "content",
          entityId: item.id,
          metadata: { institutionId, title: item.title },
          throwOnFailure: true,
        });
        setNotice("3D Modeler review recorded. The model is ready for Curator verification.");
      } catch (auditError) {
        console.error("3D Modeler approval was saved, but its audit record could not be written:", auditError);
        setNotice("3D Modeler review was saved, but its activity record could not be written.");
      }
    } catch (approvalError) {
      console.error("Unable to record 3D Modeler model approval:", approvalError);
      setError(getFirebaseErrorMessage(approvalError, "Unable to approve this model."));
    } finally {
      setApprovingModelId("");
    }
  };

  if (loading) return <div style={{ padding: 24, color: "#ddd" }}>Loading model workspace...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px", color: "#ddd" }}>
      <PageHeader
        eyebrow="3D Modeler"
        title="Model Workspace"
        description={`Active institution: ${activeInstitutionName}. Switch institutions to review AR drafts, upload VR models, and coordinate with Curators.`}
      />

      {assignedInstitutions.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label htmlFor="modeler-institution-select" style={{ color: "#f3d16f", fontWeight: 600 }}>
            Institution ({assignedInstitutions.length} assigned):
          </label>
          <select
            id="modeler-institution-select"
            value={institutionId}
            disabled={saving}
            onChange={(event) => {
              setInstitutionId(event.target.value);
              setStops([]);
              setFormError("");
              setNotice("");
            }}
            style={{ padding: "8px 12px", borderRadius: 8, background: "#151515", color: "#eee", border: "1px solid #45413a" }}
          >
            {assignedInstitutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <div role="alert" style={{ marginTop: 16, color: "#fecaca" }}>{error}</div>}
      {notice && <div role="status" style={{ marginTop: 16, color: "#86efac" }}>{notice}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))", gap: 20, marginTop: 20 }}>
        <section style={{ padding: 20, borderRadius: 14, background: "#151515", border: "1px solid #34312a" }}>
          <h2 style={{ marginTop: 0, color: "#f3d16f" }}>Prepare VR tour</h2>
          <p style={{ color: "#aaa", fontSize: 14 }}>
            {hasAR
              ? "Complete AR references are available for this landmark."
              : "Ask the Curator to add complete AR content to this landmark before submitting a VR model."}
          </p>
          <form onSubmit={handleUpload} style={{ display: "grid", gap: 12 }}>
            <label>
              Landmark
              <select
                value={selectedLandmarkId}
                onChange={(event) => {
                  setSelectedLandmarkId(event.target.value);
                  setStops([]);
                  setFormError("");
                }}
                disabled={saving}
                required
                style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }}
              >
                <option value="">Select landmark</option>
                {landmarks.map((landmark) => (
                  <option key={landmark.id} value={landmark.id}>
                    {landmark.landmarkName || landmark.institutionName || landmark.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model title (optional)
              <input
                value={title}
                disabled={saving}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Landmark VR model"
                style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }}
              />
            </label>
            <label>
              Upload GLB
              <input
                ref={fileInputRef}
                type="file"
                accept=".glb,model/gltf-binary"
                disabled={saving || checkingModel}
                onChange={chooseModel}
                style={{ display: "block", marginTop: 6 }}
              />
            </label>
            {checkingModel && <p role="status">Checking the GLB…</p>}
            <label>
              Or use an existing model URL
              <input
                value={modelUrl}
                disabled={saving || Boolean(file)}
                onChange={(event) => setModelUrl(event.target.value)}
                placeholder="https://.../model.glb"
                style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }}
              />
            </label>
            <ModelSpawnPointEditor
              key={`${institutionId}/${selectedLandmarkId}/${filePreviewUrl}`}
              enabled={spawnPointEnabled}
              onEnabledChange={setSpawnPointEnabled}
              value={spawnPoint}
              onChange={setSpawnPoint}
              modelUrl={filePreviewUrl || modelUrl.trim()}
              poiOptions={poiOptions}
              stops={stops}
              onStopsChange={file && selectedLandmark ? setStops : undefined}
              disabled={saving}
            />
            {needsTourSpawn && <p>
              Use <strong>Set a spawn point</strong> and <strong>Place spawn</strong> to mark where visitors start before submitting an interactive tour.
            </p>}
            {formError && <p role="alert" style={{ color: "#fecaca" }}>{formError}</p>}
            {saving && (
              <div role="status">
                <p>{uploadProgress === null ? "Checking the model and linked POIs…"
                  : uploadProgress >= 100 ? "Saving for Curator review…"
                    : `Uploading model… ${Math.floor(uploadProgress)}%`}</p>
                <progress max="100" value={uploadProgress ?? undefined} aria-label="Model upload progress" style={{ width: "100%" }} />
              </div>
            )}
            <button
              type="submit"
              disabled={saving || checkingModel || !hasAR || hasUnavailableStop || (!file && !modelUrl.trim()) ||
                (!stops.length && selectedLandmarkHasModel)}
              style={{
                border: 0,
                borderRadius: 8,
                padding: "11px 16px",
                background: "#d4af37",
                color: "#16130b",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {saving
                ? "Uploading..."
                : stops.length ? "Submit interactive tour for review"
                  : selectedLandmarkHasModel ? "Add VR stops to submit a new interactive tour"
                    : "Submit model without stops"}
            </button>
          </form>

          <hr style={{ border: 0, borderTop: "1px solid #34312a", margin: "18px 0" }} />

          <div>
            <button
              type="button"
              onClick={() => setIsTourUploadOpen(true)}
              disabled={!institutionId || saving}
              style={{
                width: "100%",
                border: "1px solid #645326",
                background: "transparent",
                color: "#f3d16f",
                borderColor: selectedLandmarkHasModel ? "#645326" : "#34312a",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: institutionId && !saving ? "pointer" : "not-allowed",
              }}
            >
              Import Unity tour ZIP
            </button>
          </div>
        </section>

        <section style={{ padding: 20, borderRadius: 14, background: "#151515", border: "1px solid #34312a" }}>
          <h2 style={{ marginTop: 0, color: "#f3d16f" }}>AR references and drafts</h2>
          <p style={{ color: "#aaa", fontSize: 14 }}>Draft content is visible here so you can use it as modelling reference.</p>
          {arContent.length === 0 ? (
            <p style={{ color: "#888" }}>No AR content is available yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {arContent.map((item) => (
                <article
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderRadius: 9,
                    background: "#1d1d1d",
                  }}
                >
                  <div>
                    <strong style={{ color: "#eee" }}>{item.title || "Untitled AR content"}</strong>
                    <div style={{ color: "#999", fontSize: 12 }}>
                      {item.type} · {item.status || "Draft"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewContent(item)}
                    style={{
                      border: "1px solid #645326",
                      background: "transparent",
                      color: "#f3d16f",
                      borderRadius: 7,
                      padding: "8px 12px",
                    }}
                  >
                    Preview
                  </button>
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
              <article
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 9,
                  background: "#1d1d1d",
                }}
              >
                <div>
                  <strong style={{ color: "#eee" }}>{item.title || "Untitled VR model"}</strong>
                  <div style={{ color: "#999", fontSize: 12 }}>
                    {item.status || "Draft"} · {item.developerApproved ? "3D Modeler approved" : "3D Modeler review required"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPreviewContent(item)}
                    style={{
                      border: "1px solid #645326",
                      background: "transparent",
                      color: "#f3d16f",
                      borderRadius: 7,
                      padding: "8px 12px",
                    }}
                  >
                    Preview
                  </button>
                  {!item.developerApproved && item.status !== "Published" && (
                    <button
                      type="button"
                      onClick={() => handleApproveExistingModel(item)}
                      disabled={approvingModelId === item.id}
                      style={{
                        border: 0,
                        background: "#d4af37",
                        color: "#16130b",
                        borderRadius: 7,
                        padding: "8px 12px",
                        fontWeight: 700,
                      }}
                    >
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
        <LandmarkDiscussion institutionId={institutionId} landmarkId={selectedLandmark.id} />
      )}

      {isTourUploadOpen && (
        <TourPackageUpload
          institutions={assignedInstitutions}
          allowedInstitutionId={institutionId}
          modelerUid={currentUser?.uid || null}
          onClose={() => setIsTourUploadOpen(false)}
          onSaved={async (saved) => {
            setIsTourUploadOpen(false);
            await reportSavedTour(saved);
          }}
        />
      )}

      <Modal
        isOpen={Boolean(previewContent)}
        onClose={() => setPreviewContent(null)}
        title={previewContent?.title || "AR content preview"}
        size="wide"
      >
        {previewContent && (
          <>
            <p style={{ color: "#aaa" }}>
              {previewContent.status || "Draft"} · {isContentReady(previewContent) ? "Ready" : "Needs attention"}
            </p>
            <ContentPreview content={previewContent} />
            {previewContent.targetId && (
              <LandmarkDiscussion institutionId={institutionId} landmarkId={previewContent.targetId} />
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default ModelerWorkspace;
