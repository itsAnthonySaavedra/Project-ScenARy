import React, { useState } from "react";
import { isModelContentType } from "../../lib/contentTypes";
import LandmarkModelPreview from "./LandmarkModelPreview";

const previewPanelStyle = {
  background: "#0a0a0a",
  borderRadius: "4px",
  padding: "1rem",
  marginBottom: "1rem",
};

const ContentPreview = ({ content, poiNames = {} }) => {
  const [modelStates, setModelStates] = useState({});
  const [placedStops, setPlacedStops] = useState({});

  if (!content) return null;

  const data = content.data || {};
  const modelUrl = data.modelUrl || data.modelPath;
  const facts = Array.isArray(data.facts) && data.facts.length
    ? data.facts
    : data.fact ? [data.fact] : [];
  const modelState = modelStates[modelUrl] || "loading";
  const updateModelState = (state) => setModelStates((current) => ({ ...current, [modelUrl]: state }));
  const exhibits = data.tourPackageVersion === 2 && Array.isArray(data.exhibits) ? data.exhibits : [];
  const readPlacedStops = (viewer) => {
    updateModelState("loaded");
    if (!exhibits.length) return;
    const gltf = viewer.originalGltfJson;
    const roots = gltf?.scenes?.[gltf.scene]?.nodes ?? [];
    const nodes = new Map(roots.map((index) => gltf.nodes[index]).filter(Boolean)
      .map((node) => [node.name, node]));
    const pins = exhibits.flatMap(({ anchor, poiId }, index) => {
      const node = nodes.get(anchor);
      if (!anchor.startsWith("ScenARy_Stop_") || node?.mesh != null || node?.translation?.length !== 3) return [];
      return [{ anchor, poiId, number: index + 1, position: node.translation.map((value) => `${value}m`).join(" ") }];
    });
    setPlacedStops((current) => ({ ...current, [modelUrl]: pins }));
  };

  return (
    <div style={{ color: "#ccc" }}>
      {content.type === "Information" && (
        <div style={previewPanelStyle}>
          {data.imageUrl && (
            <img
              src={data.imageUrl}
              alt=""
              style={{ width: "100%", maxHeight: "240px", objectFit: "contain" }}
            />
          )}
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {data.description || "No description provided."}
          </p>
        </div>
      )}

      {content.type === "Fun Fact" && (
        <div style={previewPanelStyle}>
          {facts.length ? (
            <ol>
              {facts.map((fact, index) => (
                <li key={index} style={{ marginBottom: "0.75rem", whiteSpace: "pre-wrap" }}>
                  {fact}
                </li>
              ))}
            </ol>
          ) : "No fun facts provided."}
        </div>
      )}

      {isModelContentType(content.type) && (
        modelUrl ? (
          <div>
            <LandmarkModelPreview
              key={modelUrl}
              src={modelUrl}
              alt={content.title || "VR model"}
              onLoad={(event) => readPlacedStops(event.currentTarget)}
              onError={() => updateModelState("error")}
            >
              {(placedStops[modelUrl] ?? []).map(({ anchor, poiId, number, position }) => (
                <span key={anchor} slot={`hotspot-review-${number}`} data-position={position}
                  title={poiNames[poiId] || poiId}
                  style={{ borderRadius: "50%", padding: "4px 9px", background: "#d4af37", color: "#111", fontWeight: 700 }}>
                  {number}
                </span>
              ))}
            </LandmarkModelPreview>
            {modelState === "loading" && (
              <p style={{ ...previewPanelStyle, color: "#fbbf24" }}>
                Loading VR model (uploading can take a while)...
              </p>
            )}
            {modelState === "error" && (
              <p style={{ ...previewPanelStyle, color: "#f87171" }}>
                The model could not be rendered. Open the model URL directly to check Storage access, then check the browser console for the model-loading error.
              </p>
            )}
            {exhibits.length > 0 && (
              <details style={previewPanelStyle}>
                <summary>{exhibits.length} VR stops</summary>
                <ol>
                  {exhibits.map(({ anchor, poiId }) => <li key={anchor}>{poiNames[poiId] || poiId}</li>)}
                </ol>
              </details>
            )}
          </div>
        ) : (
          <div style={previewPanelStyle}>No model URL provided.</div>
        )
      )}

      {content.type === "Quiz" && (
        <div style={previewPanelStyle}>
          <p>
            Question order: {data.shuffleQuestions ? "shuffled" : "fixed"}; multiple-choice answers: {data.shuffleAnswers ? "shuffled" : "fixed"}.
          </p>
          {data.quizzes?.length ? (
            <ol>
              {data.quizzes.map((quiz, index) => (
                <li key={quiz.id || index} style={{ marginBottom: "0.75rem" }}>
                  {quiz.question || "Unfinished question"}{" "}
                  {quiz.questionType === "multiple-choice" && quiz.options?.length
                    ? `[${quiz.options.join(" / ")}] `
                    : ""}
                  (Correct: {quiz.correctAnswer || "No answer"})
                </li>
              ))}
            </ol>
          ) : (
            "No quiz questions provided."
          )}
        </div>
      )}

      <details>
        <summary>View raw content data</summary>
        <pre style={{ ...previewPanelStyle, overflow: "auto", fontSize: "0.8rem", color: "#4ade80" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default ContentPreview;
