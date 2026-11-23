import {
  arrayUnion, collection, doc, getDocFromServer, getDocsFromServer, query,
  runTransaction, serverTimestamp, where, deleteField,
} from "firebase/firestore";
import { db } from "./firebase";
import { isModelContentType, MODEL_CONTENT_TYPE } from "./contentTypes.js";
import { buildModelEditPatch } from "./contentData.js";
import { deleteStorageFile, uploadStorageFile } from "./storageUpload.js";
import {
  isTourDocumentId, readTourManifest, resolveTourLandmarkId, validateTourRecords,
} from "./tourPackage.js";

const record = (snapshot) => snapshot?.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
const serverRead = (ref) => getDocFromServer(ref);
export const isTourPackage = (item) => item?.data?.tourPackageVersion === 2;
const modelLandmarkId = (item) => item.data?.landmarkId || item.data?.customData?.landmarkId;
const modelAlreadyAssigned = (message = "This landmark already has a VR model assigned.") => Object.assign(new Error(message), {
  code: "model-already-assigned",
});

async function recoverModelDraft(error, contentRef, uploaded) {
  try {
    // A rules or assignment rejection cannot have committed the save. On an ambiguous
    // failure, check the unique draft ID before removing its file.
    if (!["permission-denied", "firestore/permission-denied", "model-already-assigned"].includes(error?.code)) {
      const saved = record(await serverRead(contentRef));
      if (saved && (!uploaded || saved.data?.modelStoragePath === uploaded.storagePath)) return true;
    }
    if (uploaded) await deleteStorageFile(uploaded.storagePath);
  } catch (cleanupError) {
    console.warn("Unable to verify or clean up the incomplete model submission:", cleanupError);
  }
  return false;
}

export async function savePlainModelDraft({
  landmarkId, institutionId, file, modelUrl, title, spawn, modelerUid, onProgress,
}) {
  const landmarkRef = doc(db, "landmarks", landmarkId);
  const contentRef = doc(collection(db, "content"));
  const checkDestination = async (read) => {
    const landmark = record(await read(landmarkRef));
    if (landmark?.institutionId !== institutionId) {
      throw new Error("The landmark is no longer assigned to this institution.");
    }
    const linked = Array.isArray(landmark.contentIds) ? landmark.contentIds.filter(isTourDocumentId) : [];
    // The SDK can retry the transaction. The same draft ID already linked
    // by this operation means its first attempt finished.
    if (linked.includes(contentRef.id)) return null;
    if (landmark.vrDraftContentId || landmark.vrPublishedContentId) {
      throw modelAlreadyAssigned();
    }
    const items = await Promise.all([...new Set(linked)].map((id) => read(doc(db, "content", id))));
    if (items.some((snapshot) => isModelContentType(record(snapshot)?.type))) {
      throw modelAlreadyAssigned();
    }
    return landmark;
  };

  let existingUrl;
  if (!file) {
    try {
      const url = new URL(modelUrl);
      if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) existingUrl = url.href;
    } catch {
      // The same input error covers malformed and unsupported URLs.
    }
    if (!existingUrl) throw new Error("Enter a direct HTTP or HTTPS link to the GLB, or upload the file.");
  }
  await checkDestination(serverRead);
  let uploaded;
  try {
    if (file) {
      const namedFile = new File([file], `${contentRef.id}-${file.name}`, { type: "model/gltf-binary" });
      uploaded = await uploadStorageFile(namedFile, `content-models/${institutionId}`, onProgress);
    }
    await runTransaction(db, async (transaction) => {
      const landmark = await checkDestination((ref) => transaction.get(ref));
      if (!landmark) return;
      transaction.set(contentRef, {
        title,
        type: MODEL_CONTENT_TYPE,
        scope: "Landmark",
        institutionId,
        targetId: landmarkId,
        targetName: landmark.landmarkName || landmark.institutionName || "",
        status: "Awaiting Curator Approval",
        developerApproved: true,
        developerApprovedAt: serverTimestamp(),
        developerApprovedBy: modelerUid,
        curatorApproved: false,
        data: {
          landmarkId,
          modelUrl: uploaded?.url || existingUrl,
          ...(uploaded ? {
            modelFileName: file.name,
            modelFileType: uploaded.fileType,
            modelStoragePath: uploaded.storagePath,
          } : {}),
          ...spawn,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.update(landmarkRef, { contentIds: arrayUnion(contentRef.id), updatedAt: serverTimestamp() });
    });
  } catch (error) {
    if ((!uploaded && file) || !(await recoverModelDraft(error, contentRef, uploaded))) throw error;
  }
  return { id: contentRef.id, institutionId, landmarkId, fileName: file?.name || null };
}

async function readTourReferences(manifest, read, { includeDrafts = false } = {}) {
  const poiIds = [...new Set(manifest.exhibits.map(({ poiId }) => poiId))];
  const pois = (await Promise.all(poiIds.map((id) => read(doc(db, "pois", id))))).map(record).filter(Boolean);
  const landmarkId = resolveTourLandmarkId(manifest, pois);
  const landmarkSnapshot = await read(doc(db, "landmarks", landmarkId));
  const landmark = record(landmarkSnapshot);
  const contentIds = [...new Set([
    ...(Array.isArray(landmark?.contentIds)
      ? landmark.contentIds.filter(isTourDocumentId)
      : []),
    ...pois.flatMap((poi) =>
      Array.isArray(poi.contentIds) ? poi.contentIds.filter(isTourDocumentId) : []),
  ])];
  const contentItems = (await Promise.all(
    contentIds.map((id) => read(doc(db, "content", id))),
  )).map(record).filter(Boolean);
  return {
    ...validateTourRecords(manifest, landmark, pois, contentItems, { includeDrafts }),
    pois,
    contentItems,
  };
}

async function assertDraftSlot(landmark, read, contentItems = []) {
  if (contentItems.some((item) => isModelContentType(item.type) && !isTourPackage(item) &&
    item.status === "Awaiting Curator Approval" && modelLandmarkId(item) === landmark.id &&
    item.institutionId === landmark.institutionId &&
    Array.isArray(landmark.contentIds) && landmark.contentIds.includes(item.id))) {
    throw modelAlreadyAssigned("A GLB for this landmark is already awaiting Curator review.");
  }
  if (!isTourDocumentId(landmark.vrDraftContentId)) return;
  const draft = record(await read(doc(db, "content", landmark.vrDraftContentId)));
  if (draft && isTourPackage(draft) && modelLandmarkId(draft) === landmark.id &&
    !["Archived", "Published", "Rejected"].includes(draft.status)) {
    throw modelAlreadyAssigned("An interactive tour is already awaiting review for this landmark.");
  }
  return draft?.status === "Rejected" && isTourPackage(draft) && modelLandmarkId(draft) === landmark.id ? draft.id : null;
}

export async function inspectTourTarget(manifest, options) {
  const target = await readTourReferences(manifest, serverRead, options);
  await assertDraftSlot(target.landmark, serverRead, target.contentItems);
  return target;
}

export async function saveTourDraft(
  tour,
  expected,
  title,
  onProgress,
  { modelerUid = null, allowedInstitutionId = null } = {},
) {
  const target = await inspectTourTarget(tour.manifest, { includeDrafts: true });
  if (target.landmark.id !== expected.landmark.id || target.institutionId !== expected.institutionId) {
    throw new Error("The tour destination changed. Choose the landmark again before submitting.");
  }
  if (allowedInstitutionId && target.institutionId !== allowedInstitutionId) {
    throw new Error("This 3D Modeler account can only upload tours for its assigned institution.");
  }

  const contentRef = doc(collection(db, "content"));
  const landmarkRef = doc(db, "landmarks", target.landmark.id);
  const fileName = tour.name.replace(/\.(zip|glb)$/i, "") + ".glb";
  const result = { id: contentRef.id, institutionId: target.institutionId, landmarkId: target.landmark.id, fileName };
  const file = new File([tour.model], `${contentRef.id}-${fileName}`, { type: "model/gltf-binary" });
  let uploaded;
  try {
    uploaded = await uploadStorageFile(file, `content-models/${target.institutionId}`, onProgress);
    await runTransaction(db, async (transaction) => {
      const read = (ref) => transaction.get(ref);
      const current = await readTourReferences(target.manifest, read, { includeDrafts: true });
      if (current.institutionId !== target.institutionId) throw new Error("The landmark changed institution during upload.");
      if (current.landmark.vrDraftContentId === contentRef.id) return;
      const rejected = await assertDraftSlot(current.landmark, read, current.contentItems);
      transaction.set(contentRef, {
        title: title.trim(),
        type: MODEL_CONTENT_TYPE,
        scope: "Landmark",
        institutionId: target.institutionId,
        targetId: current.landmark.id,
        targetName: current.landmark.landmarkName || current.landmark.institutionName || "",
        status: "Awaiting Curator Approval",
        developerApproved: true,
        developerApprovedAt: serverTimestamp(),
        developerApprovedBy: modelerUid,
        curatorApproved: false,
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
    if (uploaded && await recoverModelDraft(error, contentRef, uploaded)) return result;
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
    if (!isTourPackage(draft) || draft.status !== "Awaiting Curator Approval" ||
      draft.developerApproved !== true || draft.institutionId !== item.institutionId) {
      throw new Error("This tour changed while you were reviewing it. Refresh Content Management and try again.");
    }
    const manifest = readTourManifest({ version: 2, landmarkId: draft.data.landmarkId, exhibits: draft.data.exhibits });
    const target = await readTourReferences(manifest, read, { includeDrafts: true });
    if (target.institutionId !== draft.institutionId || target.landmark.vrDraftContentId !== draft.id) {
      throw new Error("This draft no longer matches the landmark awaiting review.");
    }
    const previousId = target.landmark.vrPublishedContentId;
    const previousSnapshot = isTourDocumentId(previousId) && previousId !== draft.id
      ? await read(doc(db, "content", previousId))
      : null;
    const previousModels = [record(previousSnapshot), ...target.contentItems].filter((model) =>
      model && model.id !== draft.id && isModelContentType(model.type) && model.status === "Published" &&
      model.institutionId === target.institutionId && modelLandmarkId(model) === target.landmark.id);
    const archivedIds = new Set(previousModels.map(({ id }) => id));
    const poisToRelease = target.pois.filter((poi) => poi.status !== "Published" || poi.isPublished !== true);
    if (target.pairedARContentIds.length + poisToRelease.length + archivedIds.size + 2 > 500) {
      throw new Error("This tour has too many linked records to publish together.");
    }
    for (const id of archivedIds) {
      transaction.update(doc(db, "content", id), {
        status: "Archived",
        updatedAt: serverTimestamp(),
      });
    }
    target.pairedARContentIds.forEach((contentId) => {
      transaction.update(doc(db, "content", contentId), {
        status: "Published",
        releasedWithModelId: draft.id,
        updatedAt: serverTimestamp(),
      });
    });
    poisToRelease.forEach((poi) => {
      transaction.update(doc(db, "pois", poi.id), {
        status: "Published",
        isPublished: true,
        updatedAt: serverTimestamp(),
      });
    });
    transaction.update(draftRef, {
      curatorApproved: true,
      curatorApprovedAt: serverTimestamp(),
      curatorApprovedBy: uid,
      institutionApproved: true,
      institutionApprovedAt: serverTimestamp(),
      institutionApprovedBy: uid,
      status: "Published",
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, "landmarks", target.landmark.id), {
      vrPublishedContentId: draft.id,
      vrDraftContentId: deleteField(),
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
