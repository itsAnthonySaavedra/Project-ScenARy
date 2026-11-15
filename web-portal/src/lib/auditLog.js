import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const writeAuditLog = async ({
  actorId = null,
  actorName = null,
  actorRole = null,
  action,
  entityType,
  entityId = null,
  metadata = {},
  throwOnFailure = false,
}) => {
  try {
    let resolvedActorName = actorName;
    if (!resolvedActorName && actorId) {
      try {
        const actorSnapshot = await getDoc(doc(db, "users", actorId));
        const profile = actorSnapshot.exists() ? actorSnapshot.data() : {};
        resolvedActorName = profile.username || profile.name || profile.displayName || profile.email?.split("@")[0] || null;
      } catch {
        resolvedActorName = null;
      }
    }
    await addDoc(collection(db, "auditLogs"), {
      actorId,
      actorName: resolvedActorName,
      actorRole,
      action,
      entityType,
      entityId,
      institutionId: metadata.institutionId || (entityType === "institution" ? entityId : null),
      metadata,
      source: "web-portal",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Keep audit failures non-blocking unless a caller needs to report a follow-up failure.
    console.error("Audit log write failed:", error);
    if (throwOnFailure) throw error;
  }
};
