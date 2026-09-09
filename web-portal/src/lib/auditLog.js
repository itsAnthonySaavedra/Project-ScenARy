import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const writeAuditLog = async ({
  actorId = null,
  actorRole = null,
  action,
  entityType,
  entityId = null,
  metadata = {},
}) => {
  try {
    await addDoc(collection(db, "auditLogs"), {
      actorId,
      actorRole,
      action,
      entityType,
      entityId,
      metadata,
      source: "web-portal",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Audit logging must not interrupt the operation being recorded.
    console.error("Audit log write failed:", error);
  }
};
