import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export const isInstitutionActive = (institution) => institution?.isActive !== false;

export const setInstitutionActive = async (institutionId, isActive) => {
  if (!institutionId) throw new Error("An institution ID is required.");
  await updateDoc(doc(db, "institutions", institutionId), {
    isActive,
    statusUpdatedAt: serverTimestamp(),
  });
};
