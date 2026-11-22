import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./Layout.module.css";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface SidebarProps {
  role?: "admin" | "superadmin" | "institution" | "3d-modeler";
}

const Sidebar: React.FC<SidebarProps> = ({ role: initialRole }) => {
  const { currentUser, logout } = useAuth();
  const [role, setRole] = useState<"admin" | "superadmin" | "institution" | "3d-modeler">(
    initialRole || "admin",
  );
  const [displayName, setDisplayName] = useState("Loading...");

  // Fetch user info from Firestore if logged in
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!currentUser) return;

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();
          const userRole = String(data.role || "").toLowerCase();
          setRole(
            userRole === "superadmin"
              ? "superadmin"
              : userRole === "admin"
                ? "admin"
                : userRole === "3d-modeler"
                  ? "3d-modeler"
                  : "institution",
          );

          setDisplayName(data.name || "User");
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
        setDisplayName(currentUser.email || "User");
      }
    };

    fetchUserInfo();
  }, [currentUser]);

  const adminLinks = [
    { path: "/admin/dashboard", icon: "fa-chart-line", label: "Dashboard" },
    { path: "/admin/map", icon: "fa-map-location-dot", label: "Map System" },
    { path: "/admin/floor-plan", icon: "fa-map", label: "Floor Plan" },
    { path: "/admin/pois", icon: "fa-location-dot", label: "POI Management" },
    { path: "/admin/users", icon: "fa-users", label: "User Management" },
    { path: "/admin/content", icon: "fa-layer-group", label: "View Content" },
    { path: "/admin/activity-logs", icon: "fa-list-check", label: "Activity Logs" },
    { path: "/admin/settings", icon: "fa-cog", label: "Settings" },
  ];

  const institutionLinks = [
    { path: "/institution/dashboard", icon: "fa-home", label: "Dashboard" },
    {
      path: "/institution/content",
      icon: "fa-folder-open",
      label: "Content Management",
    },
    { path: "/institution/landmarks", icon: "fa-landmark", label: "Landmarks" },
    { path: "/institution/pois", icon: "fa-location-dot", label: "POIs" },
    { path: "/institution/floor-plan", icon: "fa-map", label: "Floor Plan" },
    {
      path: "/institution/analytics",
      icon: "fa-chart-bar",
      label: "Analytics",
    },
    { path: "/institution/profile", icon: "fa-user", label: "Profile" },
  ];

  const modelerLinks = [
    { path: "/3d-modeler", icon: "fa-cube", label: "Model Workspace" },
  ];
  const links = role === "3d-modeler"
    ? modelerLinks
    : role !== "institution" ? adminLinks : institutionLinks;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.userProfileCompact}>
        <div className={styles.userAvatarSmall}>
          <i className="fa-solid fa-user"></i>
        </div>
        <div className={styles.userInfoCompact}>
          <h4>{displayName}</h4>
          <span
            style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}
          >
            {role === "superadmin"
              ? "Super Admin"
              : role === "admin"
                ? "Admin"
                : role === "3d-modeler"
                  ? "3D Modeler"
                  : "Curator"}
          </span>
        </div>
        <button className={styles.btnLogout} title="Logout" onClick={logout}>
          <i className="fa-solid fa-sign-out-alt"></i>
        </button>
      </div>

      <nav className={styles.sidebarNav}>
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
            }
          >
            <i className={`fa-solid ${link.icon}`}></i>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
