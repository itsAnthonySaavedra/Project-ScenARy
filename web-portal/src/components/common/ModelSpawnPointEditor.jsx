import React, { useRef, useState } from "react";
import "@google/model-viewer";
import commonStyles from "./Common.module.css";
import { createDefaultModelSpawnPoint } from "../../lib/modelSpawnPoint";

const axes = ["x", "y", "z"];

const formatVector = (vector) => `${vector.x}m ${vector.y}m ${vector.z}m`;

const roundCoordinate = (value) => Number(value.toFixed(3));

const ModelSpawnPointEditor = ({ enabled, onEnabledChange, value, onChange, modelUrl }) => {
  const spawnPoint = value || createDefaultModelSpawnPoint();
  const viewerRef = useRef(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [placementMessage, setPlacementMessage] = useState("");
  const updateAxis = (vector, axis, axisValue) => {
    onChange({
      ...spawnPoint,
      [vector]: { ...spawnPoint[vector], [axis]: axisValue },
    });
  };
  const updateSpawnPointFromPoint = (clientX, clientY, announce = true) => {
    const viewer = viewerRef.current;
    if (!viewer) return false;
    const hit = viewer.positionAndNormalFromPoint(clientX, clientY);
    if (!hit) {
      if (announce) setPlacementMessage("No model surface hit. Click directly on a visible part of the model.");
      return false;
    }
    const position = {
      x: roundCoordinate(hit.position.x),
      y: roundCoordinate(hit.position.y),
      z: roundCoordinate(hit.position.z),
    };
    onChange({
      ...spawnPoint,
      position,
      surfaceNormal: {
        x: roundCoordinate(hit.normal.x),
        y: roundCoordinate(hit.normal.y),
        z: roundCoordinate(hit.normal.z),
      },
    });
    if (announce) setPlacementMessage(`Placed at X ${position.x}, Y ${position.y}, Z ${position.z} m. Save the content to keep it.`);
    return true;
  };
  const placeSpawnPoint = (event) => {
    if (!enabled || event.target.closest?.('[slot^="hotspot-"]')) return;
    if (updateSpawnPointFromPoint(event.clientX, event.clientY)) setIsPlacing(false);
  };

  return (
    <fieldset style={{ border: "1px solid #444", padding: "0.9rem", margin: "1rem 0 0", color: "#ddd" }}>
      <legend style={{ padding: "0 0.35rem", color: "#d4af37" }}>Phone spawn transform</legend>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />
        Set a spawn point for this model
      </label>
      <small style={{ display: "block", color: "#999", margin: "0.5rem 0 0.75rem" }}>
        GLB-local coordinates in meters (Y up), with yaw in degrees. The portal saves this transform; phone placement must apply it relative to the same model anchor.
      </small>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem", opacity: enabled ? 1 : 0.5 }}>
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
                  disabled={!enabled}
                  aria-label={`${title} ${axis.toUpperCase()}`}
                  className={commonStyles.formControl}
                  onChange={(event) => updateAxis(key, axis, event.target.value)}
                />
              </label>
            ))}
          </div>
        ))}
      </div>
      {enabled && modelUrl && (
        <div style={{ marginTop: "0.9rem" }}>
          <p style={{ color: "#ddd", margin: "0 0 0.5rem", fontSize: "0.85rem" }}>Click a model surface to place the pin. To move the existing pin, select it first, then click its new location.</p>
          <model-viewer
            ref={viewerRef}
            src={modelUrl}
            alt="Model preview for placing the spawn point"
            camera-controls={!isPlacing}
            interaction-prompt="none"
            onClick={placeSpawnPoint}
            style={{ width: "100%", height: "300px", background: "#111", cursor: "crosshair" }}
          >
            <button
              type="button"
              slot="hotspot-spawn-editor"
              key={`${formatVector(spawnPoint.position)}|${formatVector(spawnPoint.surfaceNormal || { x: 0, y: 1, z: 0 })}`}
              data-position={formatVector(spawnPoint.position)}
              data-normal={formatVector(spawnPoint.surfaceNormal || { x: 0, y: 1, z: 0 })}
              onClick={(event) => {
                event.stopPropagation();
                setIsPlacing(true);
                setPlacementMessage("Spawn pin selected. Click a model surface to move it.");
              }}
              aria-label="Spawn location"
              aria-pressed={isPlacing}
              style={{ display: "grid", placeItems: "center", border: "2px solid #fff", borderRadius: "50%", width: 22, height: 22, padding: 0, background: isPlacing ? "#ef4444" : "#d4af37", color: "#111", cursor: "pointer", boxShadow: isPlacing ? "0 0 0 4px #ef444488" : "0 0 0 2px #111" }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#111" }} />
            </button>
          </model-viewer>
          {placementMessage && <p role="status" style={{ color: placementMessage.startsWith("Click") ? "#fbbf24" : "#86efac", margin: "0.45rem 0 0", fontSize: "0.85rem" }}>{placementMessage}</p>}
        </div>
      )}
    </fieldset>
  );
};

export default ModelSpawnPointEditor;