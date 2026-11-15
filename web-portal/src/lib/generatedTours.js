import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const getTimestampMillis = (value) => {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
};

export const syncGeneratedInstitutionTour = async (institutionId, adminId) => {
  if (!institutionId) throw new Error("An institution ID is required to generate a tour.");

  const institutionRef = doc(db, "institutions", institutionId);
  const [landmarkSnapshot, floorPlanSnapshot] = await Promise.all([
    getDocs(query(collection(db, "landmarks"), where("institutionId", "==", institutionId))),
    getDoc(doc(db, "floorPlans", institutionId)),
  ]);
  const landmarks = landmarkSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const coverLandmark = [...landmarks]
    .filter((landmark) => landmark.imageUrl)
    .sort(
      (left, right) =>
        getTimestampMillis(right.updatedAt || right.createdAt) -
        getTimestampMillis(left.updatedAt || left.createdAt),
    )[0];
  const mostRecentlyUpdatedLandmark = [...landmarks].sort(
    (left, right) =>
      getTimestampMillis(right.updatedAt || right.createdAt) -
      getTimestampMillis(left.updatedAt || left.createdAt),
  )[0];
  const newTourRef = doc(collection(db, "tours"));

  const tourId = await runTransaction(db, async (transaction) => {
    const institutionSnapshot = await transaction.get(institutionRef);
    if (!institutionSnapshot.exists()) {
      throw new Error(`Institution ${institutionId} does not exist.`);
    }

    const institution = institutionSnapshot.data();
    const candidateIds = [
      institution.generatedTourId,
      `generated_${institutionId}`,
    ].filter((id, index, ids) => id && ids.indexOf(id) === index);
    let tourRef = null;
    let existingTour = {};

    for (const candidateId of candidateIds) {
      const candidateRef = doc(db, "tours", candidateId);
      const candidateSnapshot = await transaction.get(candidateRef);
      if (candidateSnapshot.exists() && candidateSnapshot.data().isGenerated) {
        tourRef = candidateRef;
        existingTour = candidateSnapshot.data();
        break;
      }
    }

    if (!tourRef) tourRef = newTourRef;

    transaction.set(tourRef, {
      institutionId,
      adminId: adminId || existingTour.adminId || "",
      title: `${institution.name || "Institution"} Tour`,
      description: landmarks.length
        ? `Generated from ${landmarks.length} institution landmark${landmarks.length === 1 ? "" : "s"}.`
        : "Generated tour. Add landmarks to populate this experience.",
      duration: 30,
      status: "Published",
      imageUrl: coverLandmark?.imageUrl || "",
      floorPlan: floorPlanSnapshot.exists() ? floorPlanSnapshot.data().url || "" : "",
      landmarkIds: landmarks.map((landmark) => landmark.id),
      landmarkCount: landmarks.length,
      moduleIds: existingTour.moduleIds || [],
      sourceUpdatedAt:
        mostRecentlyUpdatedLandmark?.updatedAt ||
        mostRecentlyUpdatedLandmark?.createdAt ||
        null,
      isGenerated: true,
      createdAt: existingTour.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(institutionRef, { generatedTourId: tourRef.id });

    return tourRef.id;
  });

  return tourId;
};
