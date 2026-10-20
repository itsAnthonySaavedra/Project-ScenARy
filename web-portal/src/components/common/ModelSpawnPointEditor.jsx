import React from "react";
import "@google/model-viewer";
import commonStyles from "./Common.module.css";
import { createDefaultModelSpawnPoint } from "../../lib/modelSpawnPoint";

const axes = ["x", "y", "z"];

const ModelSpawnPointEditor = ({ enabled, onEnabledChange, value, onChange, modelUrl }) => {
  const spawnPoint = value || createDefaultModelSpawnPoint();
  const updateAxis = (vector, axis, axisValue) => {
    onChange({
      ...spawnPoint,
      [vector]: { ...spawnPoint[vector], [axis]: axisValue },
    });
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
          <p style={{ color: "#ddd", margin: "0 0 0.5rem", fontSize: "0.85rem" }}>Adjust the spawn transform using the coordinates above.</p>
          <model-viewer
            src={modelUrl}
            alt="Model preview"
            camera-controls
            interaction-prompt="none"
            style={{ width: "100%", height: "300px", background: "#111" }}
          />
        </div>
      )}
    </fieldset>
  );
};

export default ModelSpawnPointEditor;