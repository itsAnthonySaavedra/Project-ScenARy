import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { writeAuditLog } from "../../lib/auditLog";
import { useAuth } from "../../context/AuthContext";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage";
import {
  DISCUSSION_ATTACHMENT_TYPES,
  DISCUSSION_PAGE_SIZE,
  discussionAttachmentError,
  discussionAttachmentUrl,
  sendLandmarkMessage,
} from "../../lib/landmarkMessages";
import styles from "./LandmarkDiscussion.module.css";

const formatMessageTime = (message) => {
  if (message.pending) return "Sending";
  const date = message.createdAt?.toDate?.();
  return date instanceof Date ? date.toLocaleString() : "Just now";
};

const roleLabels = new Map([
  ["3d-modeler", "3D Modeler"],
  ["curator", "Curator"],
  ["institution", "Curator"],
]);

const DiscussionTimeline = memo(function DiscussionTimeline({ thread, timelineRef, onScroll }) {
  return (
    <div
      className={styles.timeline}
      ref={timelineRef}
      role="log"
      aria-label="Discussion messages"
      tabIndex={thread.messages.length ? 0 : undefined}
      onScroll={onScroll}
    >
      {thread.messages.length === 0 && !thread.error && (
        <p className={styles.muted}>{thread.loading ? "Loading messages…" : "No messages yet."}</p>
      )}
      {thread.messages.map((message) => {
        const url = discussionAttachmentUrl(message.attachment?.url);
        return (
          <article className={styles.message} key={message.id}>
            <div className={styles.messageHeader}>
              <span><strong>{message.senderName || "User"}</strong> <span className={styles.role}>{roleLabels.get(message.senderRole) || "Member"}</span></span>
              <small>{formatMessageTime(message)}</small>
            </div>
            {message.text && <p>{message.text}</p>}
            {url && <a href={url} target="_blank" rel="noopener noreferrer">
              {message.attachment.name || "Open attachment"}
            </a>}
          </article>
        );
      })}
    </div>
  );
});

function LandmarkDiscussionThread({ institutionId, landmarkId, landmarkName, suspended, currentRole, currentUser }) {
  const headingId = useId();
  const regionId = useId();
  const inputId = useId();
  const attachmentHintId = useId();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(DISCUSSION_PAGE_SIZE);
  const [reload, setReload] = useState(0);
  const [thread, setThread] = useState({ messages: [], hasEarlier: false, loading: true, error: "", cached: false });
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(null);
  const [sendError, setSendError] = useState("");
  const sendingRef = useRef(false);
  const senderNameRef = useRef("");
  const attemptRef = useRef(null);
  const timelineRef = useRef(null);
  const followLatest = useRef(true);
  const previousScroll = useRef(null);
  const messageCollection = useMemo(
    () => collection(db, "institutions", institutionId, "landmarkChannels", landmarkId, "messages"),
    [institutionId, landmarkId],
  );
  const visible = open && !suspended;
  const handleTimelineScroll = useCallback((event) => {
    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
    followLatest.current = scrollHeight - scrollTop - clientHeight < 48;
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const recent = query(messageCollection, orderBy("createdAt", "desc"), limit(count + 1));
    return onSnapshot(recent, { includeMetadataChanges: true }, (snapshot) => {
      setThread({
        messages: snapshot.docs.slice(0, count).reverse().map((item) => ({
          ...item.data(),
          id: item.id,
          pending: item.metadata.hasPendingWrites,
        })),
        hasEarlier: snapshot.size > count,
        loading: snapshot.empty && snapshot.metadata.fromCache,
        error: "",
        cached: snapshot.metadata.fromCache,
      });
    }, (error) => {
      console.error("Unable to load landmark discussion:", error);
      setThread((previous) => ({
        ...previous,
        loading: false,
        error: getFirebaseErrorMessage(error, "Unable to load this discussion."),
      }));
    });
  }, [visible, messageCollection, count, reload]);

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const previous = previousScroll.current;
    if (previous && (thread.messages.length > previous.count || !thread.cached)) {
      timeline.scrollTop = previous.top + timeline.scrollHeight - previous.height;
      previousScroll.current = null;
    } else if (followLatest.current) {
      timeline.scrollTop = timeline.scrollHeight;
    }
  }, [visible, thread.messages, thread.cached]);

  const refresh = () => {
    setThread((previous) => ({ ...previous, loading: true, error: "" }));
    setReload((value) => value + 1);
  };

  const loadEarlier = () => {
    const timeline = timelineRef.current;
    if (timeline) previousScroll.current = {
      top: timeline.scrollTop,
      height: timeline.scrollHeight,
      count: thread.messages.length,
    };
    followLatest.current = false;
    setThread((previous) => ({ ...previous, loading: true }));
    setCount((value) => value + DISCUSSION_PAGE_SIZE);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const messageText = text.trim();
    if (!visible || sendingRef.current || (!messageText && !file)) return;
    if (!navigator.onLine) {
      setSendError("You’re offline. Reconnect and try again. Your draft is still here.");
      return;
    }
    const selectedError = discussionAttachmentError(file);
    if (selectedError) {
      setSendError(selectedError);
      return;
    }
    sendingRef.current = true;
    followLatest.current = true;
    setSending(true);
    setSendError("");
    setUploadPercent(null);

    let attempt = attemptRef.current;
    if (attempt?.text !== messageText || attempt?.file !== file) {
      attempt = { ref: doc(messageCollection), text: messageText, file };
      attemptRef.current = attempt;
    }

    const role = currentRole === "institution" ? "curator" : currentRole;
    try {
      if (!senderNameRef.current) {
        const fallback = currentUser.displayName || currentUser.email?.split("@")[0] || "User";
        try {
          const profile = await getDoc(doc(db, "users", currentUser.uid));
          senderNameRef.current = profile.data()?.name || fallback;
        } catch {
          // A missing profile must not prevent an authenticated user from sending.
          senderNameRef.current = fallback;
        }
      }
      const name = senderNameRef.current;
      await sendLandmarkMessage(attempt, {
        sender: { id: currentUser.uid, name, role },
        folder: `collaboration-files/${institutionId}/${landmarkId}`,
        onProgress: setUploadPercent,
      });
      attemptRef.current = null;
      setText("");
      setFile(null);
      void writeAuditLog({
        actorId: currentUser.uid,
        actorName: name,
        actorRole: role,
        action: "collaboration.message.created",
        entityType: "landmark-channel",
        entityId: landmarkId,
        metadata: { institutionId, attachmentName: file?.name || null },
      });
    } catch (error) {
      console.error("Unable to send landmark discussion message:", error);
      setSendError(getFirebaseErrorMessage(error, "Unable to send your message. Your draft is still here. Try again."));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <section className={styles.discussion} aria-labelledby={headingId}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h3 id={headingId}>Modeler–Curator discussion</h3>
          {landmarkName && <p>{landmarkName}</p>}
        </div>
        <button
          type="button"
          className={styles.secondary}
          aria-expanded={visible}
          aria-controls={regionId}
          disabled={suspended}
          onClick={() => {
            if (!open) {
              followLatest.current = true;
              previousScroll.current = null;
            }
            setOpen(!open);
          }}
        >
          {open ? "Close chat" : "Open chat"}
        </button>
      </div>
      <div id={regionId} hidden={!visible}>
        {visible && (
          <>
            {thread.error && <div className={styles.status}>
              <p role="alert">{thread.error}</p>
              <button type="button" className={styles.secondary} onClick={refresh}>Retry loading</button>
            </div>}
            {thread.cached && !thread.error && <p role="status" className={styles.muted}>Checking for the latest messages.</p>}
            {thread.hasEarlier && <button type="button" className={styles.earlier} onClick={loadEarlier}
              disabled={thread.loading || Boolean(thread.error)}>Load earlier messages</button>}
            <DiscussionTimeline thread={thread} timelineRef={timelineRef} onScroll={handleTimelineScroll} />
            <form className={styles.composer} onSubmit={handleSend}>
              <label htmlFor={inputId}>Message</label>
              <textarea
                id={inputId}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                disabled={sending}
                placeholder="Write a message…"
              />
              {sendError && <p role="alert" className={styles.error}>{sendError}</p>}
              {file && <div className={styles.file}>
                <span>{file.name}</span>
                <button type="button" className={styles.secondary} onClick={() => { setFile(null); setSendError(""); }}
                  disabled={sending}>Remove</button>
              </div>}
              <div className={styles.actions}>
                <label className={styles.attach}>
                  Attach file
                  <input
                    type="file"
                    aria-label="Attach a file"
                    aria-describedby={attachmentHintId}
                    accept={DISCUSSION_ATTACHMENT_TYPES.join(",")}
                    disabled={sending}
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0];
                      event.target.value = "";
                      if (!nextFile) return;
                      const error = discussionAttachmentError(nextFile);
                      setSendError(error);
                      if (!error) setFile(nextFile);
                    }}
                  />
                </label>
                <button type="submit" className={styles.primary} disabled={sending || (!file && !text.trim())}>
                  {sending ? "Sending…" : "Send message"}
                </button>
              </div>
              <small id={attachmentHintId} className={styles.muted}>PNG, JPG, WebP, or PDF. Up to 10 MB.</small>
              {sending && <p role="status" className={styles.muted}>
                {file && uploadPercent !== null && uploadPercent < 100
                  ? `Uploading attachment. ${Math.floor(uploadPercent)}%.`
                  : "Waiting for the send to finish."}
              </p>}
            </form>
          </>
        )}
      </div>
    </section>
  );
}

export default function LandmarkDiscussion({ institutionId, landmarkId, landmarkName, suspended = false }) {
  const { currentRole, currentUser } = useAuth();
  if (!institutionId || !landmarkId || !currentUser ||
    !["institution", "3d-modeler"].includes(currentRole)) return null;

  return <LandmarkDiscussionThread
    key={`${currentUser.uid}/${currentRole}/${institutionId}/${landmarkId}`}
    {...{ institutionId, landmarkId, landmarkName, suspended, currentRole, currentUser }}
  />;
}
