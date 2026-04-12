import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../../lib/firebase";
import commonStyles from "../../components/common/Common.module.css";
import Modal from "../../components/common/Modal";

const MyTours = () => {
  const [tours, setTours] = useState([]);
  const [availableContent, setAvailableContent] = useState([]);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState(null);

  // App State
  const [loading, setLoading] = useState(true);
  const [userInstitutionId, setUserInstitutionId] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // 1. Listen for User Login & Fetch Profile
  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserInstitutionId(userData.institutionId); // Might be null based on DB!
          } else {
            console.warn(
              "User logged in, but no profile found in 'users' collection.",
            );
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        // User logged out
        setUserInstitutionId(null);
      }
      setIsAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch Data (Only runs if we have an ID)
  useEffect(() => {
    if (isAuthChecking) return; // Don't fetch while auth is figuring itself out

    if (userInstitutionId) {
      fetchTours(userInstitutionId);
      fetchAvailableContent(userInstitutionId);
    } else {
      // If null (no institution or logged out), clear the screen
      setTours([]);
      setAvailableContent([]);
      setLoading(false);
    }
  }, [userInstitutionId, isAuthChecking]);

  const fetchTours = async (instId) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "tours"),
        where("institutionId", "==", instId.trim()),
      );
      const snap = await getDocs(q);

      console.log("Tours found for this ID:", snap.size);
      setTours(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching tours:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableContent = async (instId) => {
    try {
      const q = query(
        collection(db, "content"),
        where("institutionId", "==", instId.trim()),
        where("status", "==", "Published"),
      );
      const snap = await getDocs(q);
      setAvailableContent(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching content:", err);
    }
  };

  const handleManage = (tour) => {
    setSelectedTour(tour);
    setIsManageModalOpen(true);
  };

  const toggleModule = async (moduleId) => {
    if (!selectedTour || loading) return;
    setLoading(true);
    const currentModules = selectedTour.moduleIds || [];
    const newModules = currentModules.includes(moduleId)
      ? currentModules.filter((id) => id !== moduleId)
      : [...currentModules, moduleId];

    try {
      const tourRef = doc(db, "tours", selectedTour.id);
      await updateDoc(tourRef, { moduleIds: newModules });
      setSelectedTour({ ...selectedTour, moduleIds: newModules });
      setTours(
        tours.map((t) =>
          t.id === selectedTour.id ? { ...t, moduleIds: newModules } : t,
        ),
      );
    } catch (err) {
      console.error("Error updating tour modules:", err);
    } finally {
      setLoading(false);
    }
  };

  if (isAuthChecking) {
    return (
      <div style={{ padding: "20px", color: "#fff" }}>Loading user data...</div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      {/* DEBUG HEADER */}
      <div
        style={{
          background: userInstitutionId ? "#C19A4B" : "#dc2626", // Red if null
          color: "#000",
          padding: "10px",
          marginBottom: "20px",
          borderRadius: "4px",
        }}
      >
        Current Tours in State: {tours.length} | ID:{" "}
        {userInstitutionId || "NONE (Null in DB)"}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "2rem",
        }}
      >
        <button
          className={commonStyles.btnPrimary}
          disabled={!userInstitutionId} // Prevent creating a tour if they have no institution
          style={{ opacity: userInstitutionId ? 1 : 0.5 }}
        >
          <i className="fa-solid fa-plus"></i> Create New Tour
        </button>
      </div>

      {loading ? (
        <div style={{ color: "#C19A4B" }}>Loading tours...</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "1.5rem",
          }}
        >
          {tours.map((tour) => (
            <div
              key={tour.id}
              className={commonStyles.contentCard}
              style={{ height: "auto", flexDirection: "column" }}
            >
              <div
                style={{
                  height: "200px",
                  width: "100%",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <img
                  src={tour.imageUrl || "/assets/images/placeholder.png"}
                  alt="Tour"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <span
                  style={{
                    position: "absolute",
                    top: "1rem",
                    right: "1rem",
                    background: "#4ade80",
                    color: "#000",
                    padding: "0.2rem 0.8rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                  }}
                >
                  {tour.status}
                </span>
              </div>
              <div style={{ padding: "1.5rem" }}>
                <h3 style={{ marginBottom: "0.5rem", color: "#fff" }}>
                  {tour.title}
                </h3>
                <p
                  style={{
                    color: "#a8a29e",
                    fontSize: "0.9rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  {tour.description}
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ color: "#d4af37", fontSize: "0.9rem" }}>
                    <i className="fa-solid fa-clock"></i> {tour.duration} mins
                  </div>
                  <button
                    className={commonStyles.btnOutline}
                    onClick={() => handleManage(tour)}
                  >
                    Manage
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Placeholder for new experiences */}
          {userInstitutionId && (
            <div
              style={{
                border: "1px dashed #333",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "350px",
                color: "#666",
              }}
            >
              <h3>+ Create New Experience</h3>
            </div>
          )}
        </div>
      )}

      {/* MANAGE MODAL */}
      <Modal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        title={`Manage: ${selectedTour?.title}`}
      >
        <div style={{ color: "#ccc" }}>
          <h4 style={{ color: "#C19A4B", marginBottom: "1rem" }}>
            Attached Modules
          </h4>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {availableContent.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "rgba(255,255,255,0.05)",
                  padding: "10px",
                  borderRadius: "6px",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTour?.moduleIds?.includes(item.id)}
                  onChange={() => toggleModule(item.id)}
                />
                <div>
                  <div style={{ color: "#fff" }}>{item.title}</div>
                  <div style={{ fontSize: "0.7rem", color: "#888" }}>
                    {item.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyTours;
