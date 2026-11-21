import React, { useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "scenary_institution_setup_dismissed_v1";

export default function SetupFlowBanner({
  hasLandmarkPinAndInfo = false,
  hasContentItems = false,
  hasLinkedLandmarkContent = false,
  hasPoiWithImageAndContent = false,
  hasFloorPlanOrPlacedPois = false,
}) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [showPinGuide, setShowPinGuide] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Ignore storage restrictions
    }
  };

  const handleReopen = () => {
    setDismissed(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage restrictions
    }
  };

  if (dismissed) {
    return (
      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={handleReopen}
          style={{
            background: "rgba(212, 175, 55, 0.1)",
            border: "1px solid rgba(212, 175, 55, 0.35)",
            color: "#f3d16f",
            borderRadius: 6,
            padding: "0.35rem 0.75rem",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          Show setup guide
        </button>
      </div>
    );
  }

  const steps = [
    {
      num: "1",
      title: "Check landmark pin & details",
      detail: "Confirm the map pin position and fix any wrong name, description, or picture.",
      done: hasLandmarkPinAndInfo,
      to: "/institution/landmarks",
      cta: "Open Landmarks",
    },
    {
      num: "2",
      title: "Create & set content status",
      detail: "Create Information, Fun Fact, or Quiz items; publish them or keep unpublished.",
      done: hasContentItems,
      to: "/institution/content",
      cta: "Open Content",
    },
    {
      num: "3",
      title: "Link landmark content",
      detail: "Assign landmark-scoped content items to your landmark.",
      done: hasLinkedLandmarkContent,
      to: "/institution/landmarks",
      cta: "Link on Landmark",
    },
    {
      num: "4",
      title: "Add POIs, AR photos & link content",
      detail: "Generate shared POI QR if needed, upload POI/AR photos, and link POI content.",
      done: hasPoiWithImageAndContent,
      to: "/institution/pois",
      cta: "Open POIs",
    },
    {
      num: "5",
      title: "Upload floor plan & place POI pins",
      detail: "Upload a PNG/JPG/WEBP floor plan, pick a POI, and click the map to drop its pin.",
      done: hasFloorPlanOrPlacedPois,
      to: "/institution/floor-plan",
      cta: "Open Floor Plan",
    },
    {
      num: "6",
      title: "VR / 3D model (Later)",
      detail: "Optional for initial setup—coordinate with your 3D modeller and review later.",
      done: false,
      optional: true,
      to: "/institution/content",
      cta: "View later",
    },
  ];

  return (
    <section
      aria-label="Recommended institution setup flow"
      style={{
        marginBottom: "1.5rem",
        padding: "1rem 1.25rem",
        borderRadius: 12,
        background: "rgba(212, 175, 55, 0.06)",
        border: "1px solid rgba(212, 175, 55, 0.28)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <strong style={{ color: "#f3d16f", fontSize: "1rem" }}>
            Recommended Setup Flow
          </strong>
          <p style={{ margin: "0.2rem 0 0", color: "#a8a29e", fontSize: "0.85rem" }}>
            Follow these steps or jump between pages as your data is ready.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShowPinGuide((prev) => !prev)}
            style={{
              background: "rgba(212, 175, 55, 0.12)",
              border: "1px solid rgba(212, 175, 55, 0.4)",
              color: "#f3d16f",
              borderRadius: 6,
              padding: "0.35rem 0.7rem",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            {showPinGuide ? "Hide POI pin guide" : "POI pin guide"}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#ccc",
              borderRadius: 6,
              padding: "0.35rem 0.7rem",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            Hide guide
          </button>
        </div>
      </div>

      {showPinGuide && (
        <div
          style={{
            marginBottom: "0.85rem",
            padding: "0.85rem 1rem",
            borderRadius: 8,
            background: "#161412",
            border: "1px solid rgba(212, 175, 55, 0.25)",
            color: "#d6d3d1",
            fontSize: "0.82rem",
          }}
        >
          <strong style={{ color: "#f3d16f", display: "block", marginBottom: 6 }}>
            How to Place POI Pins on the Floor Plan
          </strong>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.55 }}>
            <li>Upload a <strong>PNG, JPG, or WEBP</strong> floor plan first (PDFs are preview-only).</li>
            <li>Select a POI from the dropdown or click <strong>· Place</strong> under <strong>Unplaced POIs</strong>.</li>
            <li>Click the exact spot on the floor plan image while placement mode is active.</li>
            <li>To adjust later, select the POI or click its pin and use <strong>Move POI pin</strong> or <strong>Remove pin</strong>.</li>
          </ol>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {steps.map((step) => (
          <div
            key={step.num}
            style={{
              padding: "0.85rem",
              borderRadius: 8,
              background: "#161412",
              border: `1px solid ${step.done ? "rgba(74, 222, 128, 0.35)" : "rgba(255,255,255,0.08)"}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "0.6rem",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ color: "#d4af37", fontWeight: 700, fontSize: "0.85rem" }}>
                  Step {step.num}
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: step.done ? "#4ade80" : step.optional ? "#a8a29e" : "#fbbf24",
                  }}
                >
                  {step.done ? "Completed" : step.optional ? "Later" : "Pending"}
                </span>
              </div>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: "0.9rem", marginBottom: 4 }}>
                {step.title}
              </div>
              <p style={{ margin: 0, color: "#a8a29e", fontSize: "0.8rem", lineHeight: 1.4 }}>
                {step.detail}
              </p>
            </div>
            <Link
              to={step.to}
              style={{
                color: "#f3d16f",
                fontSize: "0.8rem",
                textDecoration: "underline",
                alignSelf: "flex-start",
              }}
            >
              {step.cta} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}