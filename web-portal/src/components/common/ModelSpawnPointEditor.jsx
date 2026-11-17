import React, { useEffect, useRef, useState } from "react";
import "@google/model-viewer";
import commonStyles from "./Common.module.css";
import { createDefaultModelSpawnPoint } from "../../lib/modelSpawnPoint";

const axes = ["x", "y", "z"];

const ModelSpawnPointEditor = ({ enabled, onEnabledChange, value, onChange, modelUrl }) => {
  const spawnPoint = value || createDefaultModelSpawnPoint();
  const modelViewerRef = useRef(null);
  const [placementArmed, setPlacementArmed] = useState(false);
  const [placementMessage, setPlacementMessage] = useState("");

  useEffect(() => {
    modelViewerRef.current?.toggleAttribute("camera-controls", !placementArmed);
  }, [placementArmed]);

  const updateAxis = (vector, axis, axisValue) => {
    onChange({
      ...spawnPoint,
      [vector]: { ...spawnPoint[vector], [axis]: axisValue },
    });
  };

  const placeSpawnPoint = (event) => {
    const modelViewer = modelViewerRef.current;
    if (!modelViewer) return false;

    const hit = modelViewer.positionAndNormalFromPoint(
      event.clientX,
      event.clientY,
    );
    if (!hit) {
      setPlacementMessage("No surface hit there. Keep placement mode on and click a visible part of the model.");
      return false;
    }

    const parseVector = (vector) => {
      const [x, y, z] = String(vector).trim().split(/\s+/).map(Number.parseFloat);
      return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
    };
    const position = parseVector(hit.position);
    const surfaceNormal = parseVector(hit.normal);
    if (!position || !surfaceNormal) {
      setPlacementMessage("Could not read the selected model position. Try another spot.");
      return false;
    }

    onChange({ ...spawnPoint, position, surfaceNormal });
    setPlacementMessage("Spawn point placed. Drag the marker again or edit the coordinates below.");
    return true;
  };

  const handleViewerClick = (event) => {
    if (!placementArmed) return;
    event.preventDefault();
    setPlacementArmed(!placeSpawnPoint(event));
  };

  const formatVector = (vector = {}) => (
    axes.map((axis) => `${Number.isFinite(Number(vector[axis])) ? Number(vector[axis]) : 0}m`).join(" ")
  );
  const spawnPosition = formatVector(spawnPoint.position);
  const spawnNormal = formatVector(spawnPoint.surfaceNormal);

  useEffect(() => {
    const modelViewer = modelViewerRef.current;
    if (typeof modelViewer?.updateHotspot !== "function") return;
    modelViewer.updateHotspot({
      name: "hotspot-spawn",
      position: spawnPosition,
      normal: spawnNormal,
    });
  }, [spawnPosition, spawnNormal]);

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
        <div style={{ marginTop: "0.9rem", border: "1px solid #444", borderRadius: 8, padding: "0.75rem", background: "#151515" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <div>
              <strong style={{ display: "block", fontSize: "0.9rem" }}>Place the phone spawn</strong>
              <small style={{ color: "#aaa" }}>
                {placementArmed
                  ? "Click or tap a visible part of the model. Camera movement is paused while placing."
                  : "Choose Place spawn, then click or tap the desired spot on the model."}
              </small>
            </div>
            <button
              type="button"
              aria-pressed={placementArmed}
              onClick={() => {
                const armed = !placementArmed;
                setPlacementArmed(armed);
                setPlacementMessage(armed ? "Placement mode on. Click or tap the model where the player should spawn." : "");
              }}
              style={{
                flexShrink: 0,
                padding: "0.55rem 0.75rem",
                border: "1px solid #d4af37",
                borderRadius: 6,
                color: "#111",
                background: "#d4af37",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {placementArmed ? "Cancel placement" : "Place spawn"}
            </button>
          </div>
          <model-viewer
            ref={modelViewerRef}
            src={modelUrl}
            alt="Model preview"
            camera-orbit="0deg 65deg 70%"
            interaction-prompt="none"
            onClick={handleViewerClick}
            style={{
              display: "block",
              width: "100%",
              height: "clamp(420px, 55vh, 560px)",
              background: "#111",
              borderRadius: 6,
              cursor: placementArmed ? "crosshair" : "grab",
            }}
          >
            <button
              slot="hotspot-spawn"
              type="button"
              aria-label="Current spawn point; click to reposition it"
              title="Spawn point"
              data-position={spawnPosition}
              data-normal={spawnNormal}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setPlacementArmed(true);
                setPlacementMessage("Placement mode on. Click or tap the model where the player should spawn.");
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
                cursor: "pointer",
                boxShadow: "0 0 0 2px #fff, 0 2px 8px #000",
              }}
            >
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "#111" }} />
            </button>
          </model-viewer>
          <small role="status" style={{ display: "block", minHeight: "1.1rem", marginTop: "0.45rem", color: placementMessage ? "#d4af37" : "#999" }}>
            {placementMessage || "The marker shows the saved spawn location. Click it or Place spawn to choose a new spot."}
          </small>
        </div>
      )}
    </fieldset>
  );
};

export default ModelSpawnPointEditor;