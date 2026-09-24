import React, { useEffect, useState } from "react";
import { collection, getDocs, getDoc, query, where, doc } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { db } from "../lib/firebase";

const PublicFloorPlan = () => {
  const { institutionId } = useParams();
  const [floorPlan, setFloorPlan] = useState(null);
  const [pois, setPois] = useState([]);
  const [content, setContent] = useState([]);
  const [selectedPoiId, setSelectedPoiId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadMap = async () => {
      if (!institutionId) {
        setError("This map link is missing an institution.");
        setLoading(false);
        return;
      }
      try {
        const [floorPlanSnapshot, poiSnapshot, contentSnapshot] = await Promise.all([
          getDoc(doc(db, "floorPlans", institutionId)),
          getDocs(query(collection(db, "pois"), where("institutionId", "==", institutionId))),
          getDocs(query(collection(db, "content"), where("institutionId", "==", institutionId))),
        ]);
        setFloorPlan(floorPlanSnapshot.exists() ? floorPlanSnapshot.data() : null);
        setPois(poiSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setContent(contentSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      } catch (loadError) {
        console.error("Unable to load public floor plan:", loadError);
        setError("Unable to load this floor plan.");
      } finally {
        setLoading(false);
      }
    };
    loadMap();
  }, [institutionId]);

  if (loading) return <main style={styles.page}><p>Loading floor plan...</p></main>;
  if (error || !floorPlan) return <main style={styles.page}><p>{error || "No floor plan has been published yet."}</p></main>;

  const selectedPoi = pois.find((poi) => poi.id === selectedPoiId);
  const selectedContent = (selectedPoi?.contentIds || [])
    .map((contentId) => content.find((item) => item.id === contentId))
    .filter(Boolean);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>ScenARy institution map</p>
          <h1>{floorPlan.name || "Floor plan"}</h1>
          <p style={styles.helper}>Tap a pin to explore this location.</p>
        </div>
        {selectedPoi && <button type="button" onClick={() => setSelectedPoiId("")} style={styles.closeButton}>Close details</button>}
      </header>

      <section style={styles.viewer}>
        {floorPlan.fileType === "application/pdf" ? (
          <iframe title="Institution floor plan" src={floorPlan.url} style={styles.pdf} />
        ) : (
          <div style={styles.imageBoard}>
            <img src={floorPlan.url} alt={floorPlan.name || "Institution floor plan"} style={styles.image} />
            {pois.filter((poi) => poi.floorPlanPosition).map((poi) => (
              <button
                key={poi.id}
                type="button"
                title={poi.name}
                aria-label={`Open ${poi.name}`}
                onClick={() => setSelectedPoiId(poi.id)}
                style={{
                  ...styles.pin,
                  left: `${poi.floorPlanPosition.x}%`,
                  top: `${poi.floorPlanPosition.y}%`,
                  background: poi.id === selectedPoiId ? "#ef4444" : "#d4af37",
                }}
              >
                •
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedPoi && (
        <aside style={styles.details}>
          <p style={styles.eyebrow}>Point of interest</p>
          <h2>{selectedPoi.name}</h2>
          {selectedContent.length === 0 ? <p style={styles.helper}>No additional information is available yet.</p> : selectedContent.map((item) => (
            <article key={item.id} style={styles.contentItem}>
              <strong>{item.title}</strong>
              <p>{item.data?.description || item.data?.fact || item.data?.customData?.description || "Explore this point of interest."}</p>
            </article>
          ))}
        </aside>
      )}
    </main>
  );
};

const styles = {
  page: { minHeight: "100vh", padding: "28px", background: "#111827", color: "#f9fafb", fontFamily: "var(--font-body, sans-serif)" },
  header: { maxWidth: 1180, margin: "0 auto 20px", display: "flex", justifyContent: "space-between", gap: 20, alignItems: "start", flexWrap: "wrap" },
  eyebrow: { margin: "0 0 6px", color: "#d4af37", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 12 },
  helper: { margin: "6px 0 0", color: "#a7b0c0" },
  closeButton: { border: "1px solid #d4af37", color: "#f9fafb", background: "transparent", padding: "9px 14px", cursor: "pointer" },
  viewer: { maxWidth: 1180, margin: "0 auto", overflow: "auto", background: "#f5f5f5", border: "1px solid #374151", minHeight: 420 },
  imageBoard: { position: "relative", display: "inline-block", width: "fit-content", maxWidth: "100%" },
  image: { display: "block", maxWidth: "100%", height: "auto" },
  pin: { position: "absolute", transform: "translate(-50%, -50%)", width: 36, height: 36, borderRadius: "50%", border: "2px solid #fff", color: "#111", cursor: "pointer", boxShadow: "0 2px 8px #0008", fontSize: 22, fontWeight: 700, lineHeight: 1 },
  pdf: { width: "100%", height: "70vh", border: 0, background: "#fff" },
  details: { maxWidth: 1180, margin: "20px auto 0", padding: 22, background: "#1f2937", border: "1px solid #374151" },
  contentItem: { borderTop: "1px solid #374151", paddingTop: 12, marginTop: 12 },
};

export default PublicFloorPlan;
