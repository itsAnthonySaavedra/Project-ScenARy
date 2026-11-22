import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
/* Auth Context */
import { AuthProvider, useAuth } from "./context/AuthContext";
import ErrorBoundary from "./components/common/ErrorBoundary";

/* Layouts */
/* Layouts */
import Layout from "./components/layout/Layout";

/* Public Pages */
import Landing from "./pages/Landing";
import CollabPage from "./pages/CollabPage";
import PublicFloorPlan from "./pages/PublicFloorPlan";
import PrivacyPolicy, { TermsAndConditions } from "./pages/PrivacyPolicy";

/* Auth */
import Login from "./pages/auth/Login";
import PasswordChange from "./pages/auth/PasswordChange";

/* Admin Pages */
import AdminDashboard from "./pages/admin/AdminHome";
import UserManagement from "./pages/admin/UserManagement";
import ActivityLogs from "./pages/admin/ActivityLogs";
import AdminContentView from "./pages/admin/ContentView";
import Settings from "./pages/CommonSettings";
import MapSystem from "./pages/admin/MapSystem";
import FloorPlan from "./pages/institution/FloorPlan";

/* Institute Pages */
import InstituteDashboard from "./pages/institution/Dashboard";
import InstituteAnalytics from "./pages/institution/Analytics";
import LandmarkManagement from "./pages/institution/LandmarkManagement";
import POIManagement from "./pages/institution/POIManagement";
import InstituteContentManagement from "./pages/institution/ContentManagement";
import ModelerWorkspace from "./pages/3d-modeler/Workspace";

function ProtectedRoute({ role, children }) {
  const { currentUser, currentRole, mustChangePassword } = useAuth();

  if (!currentUser) {
    return <Navigate to={`/login?type=${role}`} replace />;
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  const hasExpectedRole = role === "admin"
    ? currentRole === "admin" || currentRole === "superadmin"
    : currentRole === role;

  if (!hasExpectedRole) {
    return (
      <Navigate
        to={
          currentRole === "admin" || currentRole === "superadmin"
            ? "/admin/dashboard"
            : currentRole === "3d-modeler"
              ? "/3d-modeler"
              : "/institution/dashboard"
        }
        replace
      />
    );
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<PasswordChange />} />
      <Route path="/collab" element={<CollabPage />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/institution-map/:institutionId" element={<PublicFloorPlan />} />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="map" element={<MapSystem />} />
        <Route path="floor-plan" element={<FloorPlan adminMode />} />
        <Route path="pois" element={<POIManagement adminMode />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="content" element={<AdminContentView />} />
        <Route path="tours" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="settings" element={<Settings adminMode />} />
      </Route>

      <Route
        path="/3d-modeler"
        element={
          <ProtectedRoute role="3d-modeler">
            <Layout role="3d-modeler" />
          </ProtectedRoute>
        }
      >
        <Route index element={<ModelerWorkspace />} />
      </Route>

      {/* Institute Routes */}
      <Route
        path="/institution"
        element={
          <ProtectedRoute role="institution">
            <Layout role="institution" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<InstituteDashboard />} />
        <Route path="tours" element={<Navigate to="/institution/dashboard" replace />} />
        <Route path="content" element={<InstituteContentManagement />} />
        <Route path="landmarks" element={<LandmarkManagement />} />
        <Route path="pois" element={<POIManagement />} />
        <Route path="floor-plan" element={<FloorPlan />} />
        <Route path="analytics" element={<InstituteAnalytics />} />
        <Route path="profile" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
