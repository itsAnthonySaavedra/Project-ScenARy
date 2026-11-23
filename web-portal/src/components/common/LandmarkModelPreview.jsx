import { useRef, useState } from "react";
import "@google/model-viewer";
import styles from "./LandmarkModelPreview.module.css";

const defaultOrbit = "30deg 69deg 76%";
const defaultExposure = 0.75;

function hasMostlyWhiteMaterials(scene) {
  if (scene?.images?.length || scene?.extensionsUsed?.includes("KHR_materials_pbrSpecularGlossiness")) {
    return false;
  }
  const materials = scene?.materials ?? [];
  const white = materials.filter((material) => {
    const color = material.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1];
    return color[0] >= 0.95 && color[1] >= 0.95 && color[2] >= 0.95;
  });
  return materials.length >= 3 && white.length > materials.length / 2;
}

export default function LandmarkModelPreview({
  src, alt, viewerRef, onLoad, onError, onClick, placementActive = false, children,
}) {
  const internalRef = useRef(null);
  const ref = viewerRef ?? internalRef;
  const [loaded, setLoaded] = useState(false);
  const [materialNotice, setMaterialNotice] = useState(false);
  const [exposure, setExposure] = useState(defaultExposure);
  const canOrbit = loaded && !placementActive;

  const zoom = (scale) => {
    const viewer = ref.current;
    if (!viewer) return;
    const { theta, phi, radius } = viewer.getCameraOrbit();
    viewer.cameraOrbit = `${theta}rad ${phi}rad ${radius * scale}m`;
    viewer.jumpCameraToGoal();
  };

  const reset = () => {
    const viewer = ref.current;
    if (!viewer) return;
    viewer.cameraOrbit = defaultOrbit;
    viewer.cameraTarget = "auto auto auto";
    viewer.fieldOfView = "auto";
    // Orbit gestures change the live camera while leaving these properties unchanged.
    viewer.requestUpdate("cameraOrbit");
    viewer.requestUpdate("cameraTarget");
    viewer.requestUpdate("fieldOfView");
    viewer.jumpCameraToGoal();
    setExposure(defaultExposure);
  };

  return (
    <div className={styles.preview}>
      {materialNotice && (
        <p className={styles.materialNotice}>
          This GLB has mostly white materials and no image textures. If it looks different in Blender, check that the
          intended base colors or baked textures are included in the export.
        </p>
      )}
      <model-viewer
        ref={ref}
        src={src}
        alt={alt}
        camera-controls={placementActive ? undefined : ""}
        camera-orbit={defaultOrbit}
        environment-image="neutral"
        tone-mapping="neutral"
        exposure={exposure}
        shadow-intensity="0.65"
        shadow-softness="0.8"
        interaction-prompt="none"
        className={styles.viewer}
        style={{ cursor: placementActive ? "crosshair" : "grab" }}
        onload={(event) => {
          setLoaded(true);
          setMaterialNotice(hasMostlyWhiteMaterials(event.currentTarget.originalGltfJson));
          onLoad?.(event);
        }}
        onerror={(event) => {
          setLoaded(false);
          setMaterialNotice(false);
          onError?.(event);
        }}
        onClick={onClick}
      >
        {children}
      </model-viewer>
      <div role="group" aria-label="Model preview controls" className={styles.controls}>
        <button type="button" disabled={!canOrbit} onClick={() => zoom(0.8)}>Zoom in</button>
        <button type="button" disabled={!canOrbit} onClick={() => zoom(1.25)}>Zoom out</button>
        <button type="button" disabled={!canOrbit} onClick={reset}>Reset view</button>
        <label className={styles.exposure}>
          Preview exposure
          <input type="range" aria-label="Preview exposure" min="0.35" max="1.5" step="0.05"
            value={exposure} disabled={!loaded} onChange={(event) => setExposure(Number(event.target.value))} />
        </label>
      </div>
    </div>
  );
}
