import React from "react";
import "@google/model-viewer";

const previewPanelStyle = {
  background: "#0a0a0a",
  borderRadius: "4px",
  padding: "1rem",
  marginBottom: "1rem",
};

const ContentPreview = ({ content }) => {
  if (!content) return null;

  const data = content.data || {};
  const modelUrl = data.modelUrl || data.modelPath;

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

      {content.type === "3D Model" && (
        modelUrl ? (
          <model-viewer
            src={modelUrl}
            alt={content.title || "3D model"}
            auto-rotate
            camera-controls
            style={{ width: "100%", height: "300px", backgroundColor: "#111", marginBottom: "1rem" }}
          ></model-viewer>
        ) : (
          <div style={previewPanelStyle}>No model URL provided.</div>
        )
      )}

      {content.type === "Audio" && (
        <div style={previewPanelStyle}>
          {data.audioUrl ? (
            <audio controls src={data.audioUrl} style={{ width: "100%" }}>
              Your browser does not support audio playback.
            </audio>
          ) : (
            "No audio URL provided."
          )}
          <p>Sequence: {data.sequence || "Not set"}</p>
        </div>
      )}

      {content.type === "Quiz" && (
        <div style={previewPanelStyle}>
          {data.quizzes?.length ? (
            <ol>
              {data.quizzes.map((quiz, index) => (
                <li key={quiz.id || index} style={{ marginBottom: "0.75rem" }}>
                  {quiz.question || "Unfinished question"} ({quiz.correctAnswer || "No answer"})
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
