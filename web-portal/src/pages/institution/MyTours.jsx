import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  getDoc,
  addDoc,
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Tab control state inside the Manage Modal
  const [activeTab, setActiveTab] = useState("Information");

  const [newTour, setNewTour] = useState({
    title: "",
    description: "",
    duration: "",
    status: "LIVE",
    imageUrl: "",
  });

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
    setActiveTab("Information"); // Reset back to default tab upon view
    setIsManageModalOpen(true);
  };

  const handleCreateTour = async (e) => {
    e.preventDefault();
    if (!userInstitutionId) return;

    if (tours.length >= 1) {
      alert("You have reached the maximum limit of 1 tour per institution.");
      setIsCreateModalOpen(false);
      return;
    }

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "tours"), {
        ...newTour,
        duration: parseInt(newTour.duration),
        institutionId: userInstitutionId.trim(),
        moduleIds: [],
        createdAt: new Date(),
      });

      setTours([...tours, { id: docRef.id, ...newTour, moduleIds: [] }]);
      setIsCreateModalOpen(false);
      setNewTour({
        title: "",
        description: "",
        duration: "",
        status: "LIVE",
        imageUrl: "",
      });
    } catch (err) {
      console.error("Error creating tour:", err);
    } finally {
      setLoading(false);
    }
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

  const isCreateDisabled = !userInstitutionId || tours.length >= 1;

  // Filter content arrays dynamically for the active tab view mapping
  const filteredTabItems = availableContent.filter(
    (item) => item.type === activeTab,
  );

  return (
    <div style={{ padding: "20px" }}>
      {/* DEBUG HEADER */}
      <div
        style={{
          background: userInstitutionId ? "#C19A4B" : "#dc2626",
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
          onClick={() => setIsCreateModalOpen(true)}
          disabled={isCreateDisabled}
          style={{ opacity: isCreateDisabled ? 0.5 : 1 }}
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

          {userInstitutionId && tours.length < 1 && (
            <div
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                border: "1px dashed #333",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "350px",
                color: "#666",
                cursor: "pointer",
              }}
            >
              <h3>+ Create New Experience</h3>
            </div>
          )}
        </div>
      )}

      {/* CREATE TOUR MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Tour"
      >
        <form
          onSubmit={handleCreateTour}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <input
            type="text"
            placeholder="Tour Title"
            required
            style={{
              padding: "10px",
              borderRadius: "4px",
              background: "#1a1a1a",
              border: "1px solid #333",
              color: "#fff",
            }}
            value={newTour.title}
            onChange={(e) => setNewTour({ ...newTour, title: e.target.value })}
          />
          <textarea
            placeholder="Description"
            required
            style={{
              padding: "10px",
              borderRadius: "4px",
              background: "#1a1a1a",
              border: "1px solid #333",
              color: "#fff",
              minHeight: "100px",
            }}
            value={newTour.description}
            onChange={(e) =>
              setNewTour({ ...newTour, description: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Duration (mins)"
            required
            style={{
              padding: "10px",
              borderRadius: "4px",
              background: "#1a1a1a",
              border: "1px solid #333",
              color: "#fff",
            }}
            value={newTour.duration}
            onChange={(e) =>
              setNewTour({ ...newTour, duration: e.target.value })
            }
          />
          <input
            type="text"
            placeholder="Image URL (optional)"
            style={{
              padding: "10px",
              borderRadius: "4px",
              background: "#1a1a1a",
              border: "1px solid #333",
              color: "#fff",
            }}
            value={newTour.imageUrl}
            onChange={(e) =>
              setNewTour({ ...newTour, imageUrl: e.target.value })
            }
          />
          <button type="submit" className={commonStyles.btnPrimary}>
            Save Tour
          </button>
        </form>
      </Modal>

      {/* MANAGE MODAL (WITH INTERACTIVE TABS Layout) */}
      <Modal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        title={`Manage Modules: ${selectedTour?.title}`}
      >
        <div style={{ color: "#ccc", minHeight: "350px" }}>
          {/* TAB BAR WRAPPER */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #222",
              marginBottom: "1.5rem",
              gap: "5px",
            }}
          >
            {["Information", "Quiz", "Fun Fact"].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "10px 16px",
                    background: isActive
                      ? "rgba(193, 154, 75, 0.15)"
                      : "transparent",
                    color: isActive ? "#C19A4B" : "#888",
                    border: "none",
                    borderBottom: isActive
                      ? "2px solid #C19A4B"
                      : "2px solid transparent",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: isActive ? "600" : "400",
                    transition: "all 0.2s ease",
                    outline: "none",
                  }}
                >
                  {tab === "Information"
                    ? "ℹ️ Information"
                    : tab === "Quiz"
                      ? "❓ Quizzes"
                      : "💡 Fun Facts"}
                </button>
              );
            })}
          </div>

          {/* ACTIVE TAB ELEMENT VIEW */}
          <div
            style={{
              maxHeight: "45vh",
              overflowY: "auto",
              paddingRight: "5px",
            }}
          >
            {filteredTabItems.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#555",
                  padding: "3rem 1rem",
                  fontSize: "0.9rem",
                }}
              >
                No published <strong>{activeTab}</strong> component models
                found.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {filteredTabItems.map((item) => (
                  <label
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      background: "rgba(255,255,255,0.03)",
                      padding: "12px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.02)",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.06)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.03)")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selectedTour?.moduleIds?.includes(item.id)}
                      onChange={() => toggleModule(item.id)}
                      style={{
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                      }}
                    />
                    <span style={{ color: "#fff", fontSize: "0.95rem" }}>
                      {item.title}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyTours;
