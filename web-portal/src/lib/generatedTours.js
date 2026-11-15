import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const generatedTourId = (institutionId) => `generated_${institutionId}`;

const getTimestampMillis = (value) => {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
};

export const syncGeneratedInstitutionTour = async (institutionId, adminId) => {
  if (!institutionId) throw new Error("An institution ID is required to generate a tour.");

  const institutionRef = doc(db, "institutions", institutionId);
  const tourRef = doc(db, "tours", generatedTourId(institutionId));
  const [institutionSnapshot, tourSnapshot, landmarkSnapshot, floorPlanSnapshot] =
    await Promise.all([
      getDoc(institutionRef),
      getDoc(tourRef),
      getDocs(query(collection(db, "landmarks"), where("institutionId", "==", institutionId))),
      getDoc(doc(db, "floorPlans", institutionId)),
    ]);

  if (!institutionSnapshot.exists()) {
    throw new Error(`Institution ${institutionId} does not exist.`);
  }

  const institution = institutionSnapshot.data();
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
  const existingTour = tourSnapshot.exists() ? tourSnapshot.data() : {};

  await setDoc(tourRef, {
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

  return tourRef.id;
};
