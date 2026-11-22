import { useId, useState } from "react";
import Modal from "./Modal";
import styles from "./Common.module.css";
import { getFirebaseErrorMessage } from "../../lib/firebaseErrorMessage.js";
import { readTourPackage } from "../../lib/tourPackage.js";
import { inspectTourTarget, saveTourDraft } from "../../lib/tourPackageStore.js";

export default function TourPackageUpload({
  institutions,
  onClose,
  onSaved,
  allowedInstitutionId = null,
  modelerUid = null,
}) {
  const fileId = useId();
  const titleId = useId();
  const [tour, setTour] = useState(null);
  const [target, setTarget] = useState(null);
  const [title, setTitle] = useState("");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setChecking(true);
    setError("");
    setTour(null);
    setTarget(null);
    try {
      const parsed = await readTourPackage(file);
      const destination = await inspectTourTarget(parsed.manifest, { includeDrafts: true });
      if (allowedInstitutionId && destination.institutionId !== allowedInstitutionId) {
        throw new Error("This 3D Modeler account can only upload tours for its assigned institution.");
      }
      setTour(parsed);
      setTarget(destination);
      setTitle(`${destination.landmark.landmarkName || destination.landmark.institutionName || "Landmark"} virtual tour`);
    } catch (failure) {
      setError(getFirebaseErrorMessage(failure, failure.message || "Unable to check the tour ZIP."));
    } finally {
      setChecking(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!tour || !target || !title.trim() || checking || saving) return;
    setSaving(true);
    setError("");
    setProgress(0);
    try {
      const saved = await saveTourDraft(tour, target, title, setProgress, {
        modelerUid,
        allowedInstitutionId,
      });
      onSaved(saved);
    } catch (failure) {
      setError(getFirebaseErrorMessage(failure, failure.message || "Unable to save the tour. Check Firebase access and retry."));
    } finally {
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };
  const institutionName = target && (institutions.find((item) => item.id === target.institutionId)?.name ||
    target.landmark.institutionName || target.institutionId);
  return (
    <Modal isOpen onClose={close} title="Upload interactive tour"
      actions={<button type="button" className={styles.btnCancel} onClick={close} disabled={saving}>Cancel</button>}>
      <form onSubmit={submit}>
        <div className={styles.formGroup}>
          <label htmlFor={fileId}>Unity tour ZIP</label>
          <input id={fileId} type="file" accept=".zip,application/zip" onChange={chooseFile} disabled={checking || saving} />
          {checking && <p role="status">Checking the ZIP, landmark, and linked POIs…</p>}
          {tour && <small>{tour.name}</small>}
        </div>
        {target && (
          <>
            <div className={styles.formGroup}>
              <label htmlFor={titleId}>Tour title</label>
              <input id={titleId} className={styles.formControl} value={title} onChange={(event) => setTitle(event.target.value)}
                required disabled={saving} />
            </div>
            <p><strong>{target.landmark.landmarkName || target.landmark.institutionName || "Landmark"}</strong> · {institutionName}</p>
            <ul>
              {target.stops.map((stop) => <li key={stop.anchor}>{stop.anchor} → {stop.name}</li>)}
            </ul>
            <p>The 3D Modeler technical approval is recorded on submission. The Curator verifies and publishes the AR/VR pair.</p>
          </>
        )}
        {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}
        {saving && <div role="status">
          <p>{progress >= 100 ? "Saving the model and trigger links…" : `Uploading model… ${Math.floor(progress)}%`}</p>
          <progress value={progress} max="100" aria-label="Tour upload progress" />
        </div>}
        <button type="submit" className={styles.btnPrimary} disabled={!target || !title.trim() || checking || saving}>
          Upload for review
        </button>
      </form>
    </Modal>
  );
}
