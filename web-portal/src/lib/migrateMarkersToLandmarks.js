import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

const BATCH_SIZE = 450;

export const migrateMarkersToLandmarks = async () => {
  const [markersSnapshot, landmarksSnapshot] = await Promise.all([
    getDocs(collection(db, "markers")),
    getDocs(collection(db, "landmarks")),
  ]);
  const existingLandmarkIds = new Set(landmarksSnapshot.docs.map((item) => item.id));
  const documentsToCopy = markersSnapshot.docs.filter(
    (item) => !existingLandmarkIds.has(item.id),
  );

  for (let index = 0; index < documentsToCopy.length; index += BATCH_SIZE) {
    const batch = writeBatch(db);
    const currentBatch = documentsToCopy.slice(index, index + BATCH_SIZE);

    currentBatch.forEach((item) => {
      batch.set(doc(db, "landmarks", item.id), item.data());
    });

    await batch.commit();
  }

  return {
    copied: documentsToCopy.length,
    skipped: markersSnapshot.size - documentsToCopy.length,
    total: markersSnapshot.size,
  };
};
