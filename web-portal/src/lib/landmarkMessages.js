import { getDocFromServer, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteStorageFile, uploadStorageFile } from "./storageUpload";

export const DISCUSSION_PAGE_SIZE = 50;
export const MAX_DISCUSSION_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const DISCUSSION_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export function discussionAttachmentError(file) {
  if (!file) return "";
  if (!file.size) return "Choose a file with content.";
  if (file.size > MAX_DISCUSSION_ATTACHMENT_BYTES) return "Attachments must be 10 MB or smaller.";
  return DISCUSSION_ATTACHMENT_TYPES.includes(file.type) ? "" : "Choose a PNG, JPG, WebP, or PDF file.";
}

export function discussionAttachmentUrl(raw) {
  if (typeof raw !== "string") return "";
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

export async function sendLandmarkMessage(attempt, { sender, folder, onProgress }) {
  const { ref, file, text } = attempt;
  if (file && !attempt.attachment) {
    const namedFile = new File([file], `${ref.id}-${file.name}`, { type: file.type });
    const uploaded = await uploadStorageFile(namedFile, folder, onProgress);
    attempt.attachment = {
      name: file.name,
      url: uploaded.url,
      storagePath: uploaded.storagePath,
      fileType: uploaded.fileType,
    };
  }

  const hasAttemptedWrite = attempt.hasAttemptedWrite;
  attempt.hasAttemptedWrite = true;
  try {
    await setDoc(ref, {
      text,
      attachment: attempt.attachment ?? null,
      senderId: sender.id,
      senderName: sender.name,
      senderRole: sender.role,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    try {
      const rejected = ["permission-denied", "firestore/permission-denied"].includes(error?.code);
      if (hasAttemptedWrite || !rejected) {
        const saved = await getDocFromServer(ref);
        if (saved.exists()) return;
      }
      if (attempt.attachment) {
        await deleteStorageFile(attempt.attachment.storagePath);
        attempt.attachment = null;
      }
      attempt.hasAttemptedWrite = false;
    } catch (recoveryError) {
      // Keep the attachment when delivery cannot be confirmed. The next
      // attempt reuses the same message ID and uploaded file.
      console.warn("Unable to confirm or clean up the discussion submission:", recoveryError);
    }
    throw error;
  }
}
