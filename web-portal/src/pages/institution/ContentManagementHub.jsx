import React from "react";
import { useNavigate } from "react-router-dom";
import commonStyles from "../../components/common/Common.module.css";

const ContentManagementHub = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "20px", color: "#ccc" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ color: "#d4af37", marginBottom: "0.5rem" }}>
          Content Management
        </h2>
        <p style={{ margin: 0, color: "#999" }}>
          Manage landmark content and the points of interest inside each landmark.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
          maxWidth: "900px",
        }}
      >
        <section
          className={commonStyles.contentCard}
          style={{ display: "block", padding: "1.5rem" }}
        >
          <div style={{ color: "#d4af37", fontSize: "2rem", marginBottom: "1rem" }}>
            <i className="fa-solid fa-landmark" />
          </div>
          <h3 style={{ color: "#fff" }}>Landmark Content</h3>
          <p style={{ color: "#999", minHeight: "48px" }}>
            Configure the landmarks created by the administrator, including information,
            3D model, quiz, and custom data.
          </p>
          <button
            className={commonStyles.btnPrimary}
            onClick={() => navigate("/institution/landmarks")}
          >
            Manage Landmarks
          </button>
        </section>

        <section
          className={commonStyles.contentCard}
          style={{ display: "block", padding: "1.5rem" }}
        >
          <div style={{ color: "#d4af37", fontSize: "2rem", marginBottom: "1rem" }}>
            <i className="fa-solid fa-map" />
          </div>
          <h3 style={{ color: "#fff" }}>Floor Plan</h3>
          <p style={{ color: "#999", minHeight: "48px" }}>
            Upload and preview the institution floor plan for future room and POI interactions.
          </p>
          <button
            className={commonStyles.btnPrimary}
            onClick={() => navigate("/institution/floor-plan")}
          >
            Open Floor Plan
          </button>
        </section>

        <section
          className={commonStyles.contentCard}
          style={{ display: "block", padding: "1.5rem" }}
        >
          <div style={{ color: "#d4af37", fontSize: "2rem", marginBottom: "1rem" }}>
            <i className="fa-solid fa-location-dot" />
          </div>
          <h3 style={{ color: "#fff" }}>POI Content</h3>
          <p style={{ color: "#999", minHeight: "48px" }}>
            Add artworks, exhibits, or other points of interest under an existing
            administrator-created landmark.
          </p>
          <button
            className={commonStyles.btnPrimary}
            onClick={() => navigate("/institution/pois")}
          >
            Manage POIs
          </button>
        </section>
      </div>
    </div>
  );
};

export default ContentManagementHub;
