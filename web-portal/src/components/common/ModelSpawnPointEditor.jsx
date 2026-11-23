import React, { useEffect, useId, useRef, useState } from "react";
import commonStyles from "./Common.module.css";
import { createDefaultModelSpawnPoint } from "../../lib/modelSpawnPoint";
import { MAX_TOUR_STOPS } from "../../lib/tourPackage.js";
import LandmarkModelPreview from "./LandmarkModelPreview";

const axes = ["x", "y", "z"];
const formatVector = (vector = {}) => axes.map((axis) => `${Number(vector[axis]) || 0}m`).join(" ");
const readVector = (vector) => axes.every((axis) => Number.isFinite(vector?.[axis]))
  ? { x: vector.x, y: vector.y, z: vector.z }
  : null;

const ModelSpawnPointEditor = ({
  enabled, onEnabledChange, value, onChange, modelUrl, poiOptions = [], stops = [], onStopsChange, disabled = false,
}) => {
  const spawnPoint = value || createDefaultModelSpawnPoint();
  const modelViewerRef = useRef(null);
  const poiFieldId = useId();
  const [placement, setPlacement] = useState(null);
  const [placementMessage, setPlacementMessage] = useState("");
  const [modelLoad, setModelLoad] = useState(null);
  const [poiId, setPoiId] = useState("");
  const allowStops = Boolean(onStopsChange && modelUrl);
  const selectedPoi = poiOptions.find((poi) => poi.id === poiId);
  const modelStatus = modelLoad?.url === modelUrl ? modelLoad.status : "loading";
  const placementActive = Boolean(!disabled && placement && placement.url === modelUrl &&
    (placement.kind === "spawn" ? enabled : allowStops && selectedPoi));

  const updateAxis = (vector, axis, axisValue) => {
    onChange({
      ...spawnPoint,
      ...(vector === "position" ? { positionChosen: true } : {}),
      [vector]: { ...spawnPoint[vector], [axis]: axisValue },
    });
  };

  const handleViewerClick = (event) => {
    if (!placementActive || modelStatus !== "ready") return;
    event.preventDefault();
    const hit = modelViewerRef.current?.positionAndNormalFromPoint(event.clientX, event.clientY);
    const position = readVector(hit?.position);
    const surfaceNormal = readVector(hit?.normal);
    if (!position || !surfaceNormal) {
      setPlacementMessage("No model surface found there. Click a visible part of the GLB.");
      return;
    }
    if (placement.kind === "spawn") {
      onChange({ ...spawnPoint, positionChosen: true, coordinateSpace: "gltf", position, surfaceNormal });
      setPlacementMessage("Player spawn placed.");
    } else if (stops.length < MAX_TOUR_STOPS) {
      onStopsChange([...stops, { id: crypto.randomUUID(), poiId, position, surfaceNormal }]);
      setPlacementMessage(`${selectedPoi.name} stop placed.`);
    }
    setPlacement(null);
  };

  const startPlacement = (kind) => {
    setPlacement({ kind, url: modelUrl });
    setPlacementMessage(kind === "spawn"
      ? "Click the ground where the player should start."
      : "Click where visitors should approach this stop.");
  };
  const cancelPlacement = () => {
    setPlacement(null);
    setPlacementMessage("");
  };
  const spawnPosition = formatVector(spawnPoint.position);
  const spawnNormal = formatVector(spawnPoint.surfaceNormal);

  useEffect(() => {
    const modelViewer = modelViewerRef.current;
    if (!enabled || modelStatus !== "ready" || typeof modelViewer?.updateHotspot !== "function") return;
    modelViewer.updateHotspot({
      name: "hotspot-spawn",
      position: spawnPosition,
      normal: spawnNormal,
    });
  }, [enabled, modelStatus, spawnPosition, spawnNormal]);

  return (
    <fieldset style={{ minWidth: 0, border: "1px solid #444", padding: "0.9rem", margin: "1rem 0 0", color: "#ddd" }}>
      <legend style={{ padding: "0 0.35rem", color: "#d4af37" }}>{allowStops ? "Tour stops and player spawn" : "Phone spawn transform"}</legend>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input type="checkbox" checked={enabled} disabled={disabled} onChange={(event) => {
          cancelPlacement();
          onEnabledChange(event.target.checked);
        }} />
        Set a spawn point for this model
      </label>
      {enabled && <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem", marginTop: 10 }}>
        {[{ key: "position", title: "Position (m)", axes, step: "0.01" }, { key: "rotation", title: "Yaw (deg)", axes: ["y"], step: "1" }].map(({ key, title, axes: vectorAxes, step }) => (
          <div key={key}>
            <strong style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem" }}>{title}</strong>
            {vectorAxes.map((axis) => (
              <label key={axis} style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.35rem", fontSize: "0.8rem" }}>
                <span style={{ width: 12, textTransform: "uppercase" }}>{axis}</span>
                <input
                  type="number"
                  step={step}
                  value={spawnPoint[key]?.[axis] ?? 0}
                  disabled={disabled}
                  aria-label={`${title} ${axis.toUpperCase()}`}
                  className={commonStyles.formControl}
                  onChange={(event) => updateAxis(key, axis, event.target.value)}
                />
              </label>
            ))}
          </div>
        ))}
      </div>}
      {(enabled || allowStops) && modelUrl && (
        <div style={{ marginTop: "0.9rem", border: "1px solid #444", borderRadius: 8, padding: "0.75rem", background: "#151515" }}>
          {allowStops && <div className={commonStyles.formGroup}>
            <label htmlFor={poiFieldId}>POI for the next stop</label>
            <select id={poiFieldId} className={commonStyles.formControl} value={selectedPoi?.id || ""} disabled={disabled}
              onChange={(event) => { cancelPlacement(); setPoiId(event.target.value); }}>
              <option value="">Choose a POI</option>
              {poiOptions.map((poi) => <option key={poi.id} value={poi.id}>{poi.name}</option>)}
            </select>
            {!poiOptions.length && <small>Ask the Curator to attach complete AR content to a POI at this landmark.</small>}
            {selectedPoi && <small>{selectedPoi.contentTypes.join(", ")}</small>}
          </div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {allowStops && <button type="button" className={commonStyles.btnPrimary}
              disabled={disabled || modelStatus !== "ready" || !selectedPoi || stops.length >= MAX_TOUR_STOPS}
              onClick={() => startPlacement("stop")}>Add VR stop</button>}
            {enabled && <button type="button" className={commonStyles.btnOutline}
              disabled={disabled || modelStatus !== "ready"}
              onClick={() => startPlacement("spawn")}>Place spawn</button>}
            {placementActive && <button type="button" className={commonStyles.btnOutline}
              onClick={cancelPlacement}>Cancel placement</button>}
          </div>
          <LandmarkModelPreview
            key={modelUrl}
            viewerRef={modelViewerRef}
            src={modelUrl}
            alt="Landmark model preview"
            placementActive={placementActive}
            onLoad={() => setModelLoad({ url: modelUrl, status: "ready" })}
            onError={() => setModelLoad({ url: modelUrl, status: "error" })}
            onClick={handleViewerClick}
          >
            {enabled && <button
              slot="hotspot-spawn"
              type="button"
              aria-label="Current spawn point; click to reposition it"
              title="Spawn point"
              disabled={disabled || placementActive}
              data-position={spawnPosition}
              data-normal={spawnNormal}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (!disabled) startPlacement("spawn");
              }}
              style={{
                display: "grid",
                placeItems: "center",
                width: 28,
                height: 28,
                padding: 0,
                border: "2px solid #111",
                borderRadius: "50%",
                background: "#d4af37",
                pointerEvents: placementActive ? "none" : "auto",
                cursor: "pointer",
                boxShadow: "0 0 0 2px #fff, 0 2px 8px #000",
              }}
            >
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "#111" }} />
            </button>}
            {stops.map((stop, index) => (
              <span key={stop.id}
                slot={`hotspot-stop-${stop.id}`}
                data-position={formatVector(stop.position)}
                data-normal={formatVector(stop.surfaceNormal)}
                style={{ pointerEvents: "none", borderRadius: "50%", padding: "4px 9px", background: "#d4af37", color: "#111", fontWeight: 700 }}>
                {index + 1}
              </span>
            ))}
          </LandmarkModelPreview>
          <small role="status" style={{ display: "block", minHeight: "1.1rem", marginTop: "0.45rem", color: "#d4af37" }}>
            {modelStatus === "error" ? "This GLB could not be previewed. Check the export and choose the file again."
              : modelStatus === "loading" ? "Loading model preview…"
                : placementMessage || "Drag to orbit and zoom in before placing a stop."}
          </small>
          {stops.length > 0 && <ol>
            {stops.map((stop) => {
              const poi = poiOptions.find((option) => option.id === stop.poiId);
              return <li key={stop.id} style={{ marginBottom: 6 }}>
                {poi?.name || "POI no longer available"}{" "}
                <button type="button" className={commonStyles.btnOutline}
                  disabled={disabled}
                  aria-label={`Remove stop for ${poi?.name || "unavailable POI"}`}
                  onClick={() => onStopsChange(stops.filter((item) => item.id !== stop.id))}>Remove</button>
              </li>;
            })}
          </ol>}
        </div>
      )}
    </fieldset>
  );
};

export default ModelSpawnPointEditor;
