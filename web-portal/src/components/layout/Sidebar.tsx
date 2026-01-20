import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./Layout.module.css";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface SidebarProps {
  role?: "admin" | "institute" | "super admin";
}

const Sidebar: React.FC<SidebarProps> = ({ role: initialRole }) => {
  const { currentUser, logout } = useAuth();
  const [role, setRole] = useState<"admin" | "super admin" | "institute">(
    (initialRole?.toLowerCase() as any) || "admin",
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
          const userRole = (data.role as string).toLowerCase() as
            | "admin"
            | "super admin"
            | "institute";
          setRole(userRole);

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
    { path: "/admin/users", icon: "fa-users", label: "User Management" },
    {
      path: "/admin/institutions",
      icon: "fa-university",
      label: "Institutions",
    },
    { path: "/admin/content", icon: "fa-layer-group", label: "Content" },
    { path: "/admin/analytics", icon: "fa-chart-pie", label: "Analytics" },
    { path: "/admin/settings", icon: "fa-cog", label: "Settings" },
  ];

  const instituteLinks = [
    { path: "/institute/dashboard", icon: "fa-home", label: "Dashboard" },
    { path: "/institute/tours", icon: "fa-vr-cardboard", label: "My Tours" },
    { path: "/institute/analytics", icon: "fa-chart-bar", label: "Analytics" },
    { path: "/institute/profile", icon: "fa-user", label: "Profile" },
  ];

  // Super Admin gets same links as admin
  const links =
    role === "admin" || role === "super admin" ? adminLinks : instituteLinks;

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
            {role === "super admin"
              ? "Super Admin"
              : role === "admin"
                ? "Admin"
                : "Content Creator"}
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
