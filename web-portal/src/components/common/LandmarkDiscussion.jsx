import React, { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { deleteStorageFile, uploadStorageFile } from "../../lib/storageUpload";
import { writeAuditLog } from "../../lib/auditLog";
import { useAuth } from "../../context/AuthContext";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";

const formatMessageTime = (value) => {
  const date = value?.toDate?.();
  return date instanceof Date ? date.toLocaleString() : "Just now";
};

const LandmarkDiscussion = ({ institutionId, landmarkId }) => {
  const { currentRole, currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!institutionId || !landmarkId) return undefined;
    const messageQuery = query(
      collection(db, "institutions", institutionId, "landmarkChannels", landmarkId, "messages"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(
      messageQuery,
      (snapshot) => {
        setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setError("");
      },
      (snapshotError) => {
        console.error("Unable to load landmark discussion:", snapshotError);
        setError(getFirebaseErrorMessage(snapshotError, "Unable to load this discussion."));
      },
    );
  }, [institutionId, landmarkId]);

  const handleSend = async (event) => {
    event.preventDefault();
    const messageText = text.trim();
    if (!messageText && !file) {
      setError("Enter a message or attach a reference file.");
      return;
    }
    if (!institutionId || !landmarkId || !currentUser || !currentRole) {
      setError("Your account is not ready to send messages.");
      return;
    }
    setLoading(true);
    setError("");
    let uploadedFile = null;
    try {
      if (file) {
        uploadedFile = await uploadStorageFile(
          file,
          `collaboration-files/${institutionId}/${landmarkId}`,
        );
      }
      const profile = await getDoc(doc(db, "users", currentUser.uid));
      const senderName = profile.exists()
        ? profile.data().name || currentUser.email || "User"
        : currentUser.email || "User";
      await addDoc(
        collection(db, "institutions", institutionId, "landmarkChannels", landmarkId, "messages"),
        {
          text: messageText,
          attachment: uploadedFile
            ? {
                name: uploadedFile.fileName,
                url: uploadedFile.url,
                storagePath: uploadedFile.storagePath,
                fileType: uploadedFile.fileType,
              }
            : null,
          senderId: currentUser.uid,
          senderName,
          senderRole: currentRole === "institution" ? "curator" : currentRole,
          createdAt: serverTimestamp(),
        },
      );
      setText("");
      setFile(null);
      try {
        await writeAuditLog({
          actorId: currentUser.uid,
          actorName: senderName,
          actorRole: currentRole === "institution" ? "curator" : currentRole,
          action: "collaboration.message.created",
          entityType: "landmark-channel",
          entityId: landmarkId,
          metadata: {
            institutionId,
            attachmentName: uploadedFile?.fileName || null,
          },
          throwOnFailure: true,
        });
      } catch (auditError) {
        console.error("Message was sent, but its audit record could not be written:", auditError);
        setError("Your message was sent, but its activity record could not be saved.");
      }
    } catch (sendError) {
      if (uploadedFile?.storagePath) {
        try {
          await deleteStorageFile(uploadedFile.storagePath);
        } catch (cleanupError) {
          console.error("Unable to clean up an unlinked collaboration attachment:", cleanupError);
        }
      }
      console.error("Unable to send landmark discussion message:", sendError);
      setError(getFirebaseErrorMessage(sendError, "Unable to send your message. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (!["institution", "3d-modeler"].includes(currentRole || "")) return null;

  return (
    <section style={{ marginTop: 24, padding: 18, border: "1px solid #3b3528", borderRadius: 12, background: "#11100d" }}>
      <h3 style={{ margin: "0 0 6px", color: "#f5d477" }}>3D Modeler / Curator discussion</h3>
      <p style={{ margin: "0 0 14px", color: "#aaa", fontSize: 13 }}>
        Share model references, feedback, and contract documents for this landmark.
      </p>
      {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}
      <div style={{ display: "grid", gap: 10, maxHeight: 260, overflowY: "auto", marginBottom: 14 }}>
        {messages.length === 0 ? (
          <p style={{ color: "#888" }}>No discussion yet. Send the first reference or note.</p>
        ) : messages.map((message) => (
          <article key={message.id} style={{ padding: 12, borderRadius: 8, background: "#1b1915" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <strong style={{ color: "#eee" }}>{message.senderName || "User"} · {message.senderRole || "member"}</strong>
              <small style={{ color: "#888" }}>{formatMessageTime(message.createdAt)}</small>
            </div>
            {message.text && <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{message.text}</p>}
            {message.attachment?.url && (
              <a href={message.attachment.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, color: "#f5d477" }}>
                <i className="fa-solid fa-paperclip" aria-hidden="true" /> {message.attachment.name || "Open attachment"}
              </a>
            )}
          </article>
        ))}
      </div>
      <form onSubmit={handleSend} style={{ display: "grid", gap: 10 }}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a note or request..."
          rows={3}
          disabled={loading}
          style={{ width: "100%", resize: "vertical", background: "#090909", color: "#eee", border: "1px solid #45413a", borderRadius: 8, padding: 10 }}
        />
        <label style={{ color: "#bbb", fontSize: 13 }}>
          Reference or contract file (image or PDF, up to 10 MB)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            disabled={loading}
            onChange={(event) => {
              const nextFile = event.target.files?.[0] || null;
              if (nextFile && nextFile.size > 10 * 1024 * 1024) {
                setError("Attachments must be 10 MB or smaller.");
                event.target.value = "";
                setFile(null);
                return;
              }
              if (nextFile && !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(nextFile.type)) {
                setError("Choose a PNG, JPG, WEBP, or PDF attachment.");
                event.target.value = "";
                setFile(null);
                return;
              }
              setError("");
              setFile(nextFile);
            }}
            style={{ display: "block", marginTop: 6 }}
          />
        </label>
        {file && <small style={{ color: "#aaa" }}>Selected: {file.name}</small>}
        <button type="submit" disabled={loading} style={{ justifySelf: "start", border: 0, borderRadius: 8, padding: "10px 16px", background: "#d4af37", color: "#16130b", fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Sending..." : "Send message"}
        </button>
      </form>
    </section>
  );
};

export default LandmarkDiscussion;
