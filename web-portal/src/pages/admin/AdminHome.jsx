import React from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";

const actions = [
  { to: "/admin/content", icon: "fa-layer-group", title: "Browse content", description: "Read-only access to drafts and published content." },
  { to: "/admin/users", icon: "fa-users", title: "Manage users", description: "Create and maintain Admin, 3D-modeler, and Curator accounts." },
  { to: "/admin/map", icon: "fa-map-location-dot", title: "Map system", description: "Manage platform map settings." },
  { to: "/admin/activity-logs", icon: "fa-list-check", title: "Activity logs", description: "Review recorded system activity." },
];

const AdminHome = () => (
  <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, color: "#ddd" }}>
    <PageHeader
      eyebrow="Operations"
      title="Dashboard"
      description="Manage accounts and platform configuration, browse content without editing it, and review activity."
    />
    <section aria-label="Admin actions" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 22 }}>
      {actions.map((action) => (
        <Link key={action.to} to={action.to} style={{ display: "block", padding: 20, borderRadius: 12, color: "#eee", textDecoration: "none", background: "#171717", border: "1px solid #34312a" }}>
          <i className={`fa-solid ${action.icon}`} aria-hidden="true" style={{ color: "#d4af37", fontSize: 22 }} />
          <h2 style={{ margin: "14px 0 6px", fontSize: 18 }}>{action.title}</h2>
          <p style={{ margin: 0, color: "#aaa", lineHeight: 1.5 }}>{action.description}</p>
        </Link>
      ))}
    </section>
  </div>
);

export default AdminHome;
