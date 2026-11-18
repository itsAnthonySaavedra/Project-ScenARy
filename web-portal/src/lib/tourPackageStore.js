import {
  collection, doc, getDocFromServer, getDocsFromServer, query,
  runTransaction, serverTimestamp, where, deleteField,
} from "firebase/firestore";
import { db } from "./firebase";
import { isModelContentType, MODEL_CONTENT_TYPE } from "./contentTypes.js";
import { buildModelEditPatch } from "./contentData.js";
import { deleteStorageFile, uploadStorageFile } from "./storageUpload.js";
import {
  isTourDocumentId, readTourManifest, resolveTourLandmarkId, validateTourRecords,
} from "./tourPackage.js";

const record = (snapshot) => snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
const serverRead = (ref) => getDocFromServer(ref);
export const isTourPackage = (item) => item?.data?.tourPackageVersion === 2;
const modelLandmarkId = (item) => item.data?.landmarkId || item.data?.customData?.landmarkId;

async function readTourReferences(manifest, read) {
  const poiIds = [...new Set(manifest.exhibits.map(({ poiId }) => poiId))];
  const pois = (await Promise.all(poiIds.map((id) => read(doc(db, "pois", id))))).map(record).filter(Boolean);
  const landmarkId = resolveTourLandmarkId(manifest, pois);
  const contentIds = [...new Set(pois.flatMap((poi) =>
    Array.isArray(poi.contentIds) ? poi.contentIds.filter(isTourDocumentId) : []))];
  const [landmarkSnap, ...contentSnaps] = await Promise.all([
    read(doc(db, "landmarks", landmarkId)),
    ...contentIds.map((id) => read(doc(db, "content", id))),
  ]);
  return validateTourRecords(manifest, record(landmarkSnap), pois, contentSnaps.map(record).filter(Boolean));
}

async function assertDraftSlot(landmark, read) {
  if (!isTourDocumentId(landmark.vrDraftContentId)) return;
  const draft = record(await read(doc(db, "content", landmark.vrDraftContentId)));
  if (draft && isTourPackage(draft) && modelLandmarkId(draft) === landmark.id &&
    !["Archived", "Published", "Rejected"].includes(draft.status)) {
    throw new Error("A ZIP is already awaiting review for this landmark. Complete its review or remove that draft before uploading another.");
  }
  return draft?.status === "Rejected" && isTourPackage(draft) && modelLandmarkId(draft) === landmark.id ? draft.id : null;
}

export async function inspectTourTarget(manifest) {
  const target = await readTourReferences(manifest, serverRead);
  await assertDraftSlot(target.landmark, serverRead);
  return target;
}

export async function saveTourDraft(tour, expected, title, onProgress) {
  const target = await inspectTourTarget(tour.manifest);
  if (target.landmark.id !== expected.landmark.id || target.institutionId !== expected.institutionId) {
    throw new Error("The ZIP destination changed. Select the file again to review its landmark.");
  }

  const contentRef = doc(collection(db, "content"));
  const landmarkRef = doc(db, "landmarks", target.landmark.id);
  const fileName = tour.name.replace(/\.zip$/i, "") + ".glb";
  const result = { id: contentRef.id, institutionId: target.institutionId, landmarkId: target.landmark.id, fileName };
  const file = new File([tour.model], `${contentRef.id}-${fileName}`, { type: "model/gltf-binary" });
  let uploaded;
  try {
    uploaded = await uploadStorageFile(file, `content-models/${target.institutionId}`, onProgress);
    await runTransaction(db, async (transaction) => {
      const read = (ref) => transaction.get(ref);
      const current = await readTourReferences(target.manifest, read);
      if (current.institutionId !== target.institutionId) throw new Error("The landmark changed institution during upload.");
      const rejected = await assertDraftSlot(current.landmark, read);
      transaction.set(contentRef, {
        title: title.trim(),
        type: MODEL_CONTENT_TYPE,
        scope: "Landmark",
        institutionId: target.institutionId,
        status: "Awaiting Content",
        institutionApproved: false,
        adminApproved: false,
        needsAttention: false,
        data: {
          tourPackageVersion: 2,
          landmarkId: current.landmark.id,
          exhibits: current.manifest.exhibits,
          modelUrl: uploaded.url,
          modelStoragePath: uploaded.storagePath,
          modelFileName: fileName,
          modelFileType: uploaded.fileType,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.update(landmarkRef, { vrDraftContentId: contentRef.id });
      if (rejected) transaction.update(doc(db, "content", rejected), { status: "Archived", updatedAt: serverTimestamp() });
    });
  } catch (error) {
    if (uploaded) {
      try {
        const saved = record(await serverRead(contentRef));
        if (saved?.data?.modelStoragePath === uploaded.storagePath) return result;
        await deleteStorageFile(uploaded.storagePath);
      } catch (cleanupError) {
        console.warn("Unable to verify the incomplete upload for cleanup:", cleanupError);
      }
    }
    throw error;
  }
  return result;
}

export async function editTourMetadata(item, title, model, status) {
  const ref = doc(db, "content", item.id);
  await runTransaction(db, async (transaction) => {
    const current = record(await transaction.get(ref));
    const changingStatus = status !== item.status;
    if (!isTourPackage(current) || current.data.modelUrl !== model.modelUrl ||
      (changingStatus && (current.status !== item.status || !["Rejected", "Archived"].includes(status)))) {
      throw new Error("This tour changed while it was being edited. Refresh Content Management and try again.");
    }
    transaction.update(ref, {
      title,
      ...buildModelEditPatch(model, current.data, deleteField()),
      ...(changingStatus ? { status } : {}),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function approveTourForInstitution(item, uid) {
  const draftRef = doc(db, "content", item.id);
  await runTransaction(db, async (transaction) => {
    const read = (ref) => transaction.get(ref);
    const draft = record(await read(draftRef));
    if (!isTourPackage(draft) || draft.status !== "Awaiting Content" || draft.institutionId !== item.institutionId) {
      throw new Error("This tour changed while you were reviewing it. Refresh Content Management and try again.");
    }
    const manifest = readTourManifest({ version: 2, landmarkId: draft.data.landmarkId, exhibits: draft.data.exhibits });
    const target = await readTourReferences(manifest, read);
    if (target.institutionId !== draft.institutionId || target.landmark.vrDraftContentId !== draft.id) {
      throw new Error("This draft no longer matches the landmark awaiting review.");
    }
    transaction.update(draftRef, {
      institutionApproved: true,
      institutionApprovedAt: serverTimestamp(),
      institutionApprovedBy: uid,
      adminApproved: false,
      status: "Awaiting Admin Approval",
      updatedAt: serverTimestamp(),
    });
  });
}

export async function publishTourDraft(item, adminUid) {
  const existing = await getDocsFromServer(query(collection(db, "content"), where("institutionId", "==", item.institutionId)));
  const scopedPublications = existing.docs.map(record).filter((candidate) =>
    candidate.id !== item.id && isModelContentType(candidate.type) && candidate.status === "Published" &&
    modelLandmarkId(candidate) === modelLandmarkId(item));
  const draftRef = doc(db, "content", item.id);

  await runTransaction(db, async (transaction) => {
    const read = (ref) => transaction.get(ref);
    const draft = record(await read(draftRef));
    if (!isTourPackage(draft) || draft.status !== "Awaiting Admin Approval" ||
      draft.institutionApproved !== true || draft.institutionId !== item.institutionId ||
      modelLandmarkId(draft) !== modelLandmarkId(item)) {
      throw new Error("This tour changed or still needs institution approval. Refresh Content Management and try again.");
    }
    const manifest = readTourManifest({ version: 2, landmarkId: draft.data.landmarkId, exhibits: draft.data.exhibits });
    const target = await readTourReferences(manifest, read);
    if (target.institutionId !== draft.institutionId || target.landmark.vrDraftContentId !== draft.id) {
      throw new Error("This draft no longer matches the landmark awaiting review.");
    }

    const previousIds = new Set(scopedPublications.map(({ id }) => id));
    if (isTourDocumentId(target.landmark.vrPublishedContentId)) previousIds.add(target.landmark.vrPublishedContentId);
    previousIds.delete(draft.id);
    const previous = await Promise.all([...previousIds].map((id) => read(doc(db, "content", id))));
    for (const snapshot of previous) {
      const published = record(snapshot);
      if (published && isModelContentType(published.type) && published.status === "Published" &&
        published.institutionId === target.institutionId && modelLandmarkId(published) === target.landmark.id) {
        transaction.update(snapshot.ref, { status: "Archived", updatedAt: serverTimestamp() });
      }
    }
    transaction.update(draftRef, {
      adminApproved: true,
      adminApprovedAt: serverTimestamp(),
      adminApprovedBy: adminUid,
      status: "Published",
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, "landmarks", target.landmark.id), {
      vrPublishedContentId: draft.id,
      vrDraftContentId: deleteField(),
    });
  });
}
