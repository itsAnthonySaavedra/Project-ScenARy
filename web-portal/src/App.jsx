import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
/* Auth Context */
import { AuthProvider, useAuth } from "./context/AuthContext";

/* Layouts */
/* Layouts */
import Layout from "./components/layout/Layout";

/* Public Pages */
import Landing from "./pages/Landing";
import CollabPage from "./pages/CollabPage";

/* Auth */
import Login from "./pages/auth/Login";

/* Admin Pages */
import AdminDashboard from "./pages/admin/Dashboard";
import UserManagement from "./pages/admin/UserManagement";
import InstitutionManagement from "./pages/admin/InstitutionManagement";
import ContentManagement from "./pages/admin/ContentManagement";
import AdminAnalytics from "./pages/admin/Analytics";
import Settings from "./pages/CommonSettings";
import MapSystem from "./pages/admin/MapSystem";

/* Institute Pages */
import InstituteDashboard from "./pages/institution/Dashboard";
import InstituteTours from "./pages/institution/MyTours";
import InstituteAnalytics from "./pages/institution/Analytics";
import LandmarkManagement from "./pages/institution/LandmarkManagement";
import POIManagement from "./pages/institution/POIManagement";
import InstituteContentManagement from "./pages/institution/ContentManagement";

function ProtectedRoute({ role, children }) {
  const { currentUser, currentRole } = useAuth();

  if (!currentUser) {
    return <Navigate to={`/login?type=${role}`} replace />;
  }

  const hasExpectedRole =
    role === "admin"
      ? currentRole === "admin"
      : currentRole === "institution";

  if (!hasExpectedRole) {
    return (
      <Navigate
        to={currentRole === "admin" ? "/admin/dashboard" : "/institution/dashboard"}
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
      <Route path="/collab" element={<CollabPage />} />

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
        <Route path="pois" element={<POIManagement adminMode />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="institutions" element={<InstitutionManagement />} />
        <Route path="content" element={<ContentManagement />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="settings" element={<Settings />} />
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
        <Route path="tours" element={<InstituteTours />} />
        <Route path="content" element={<InstituteContentManagement />} />
        <Route path="landmarks" element={<LandmarkManagement />} />
        <Route path="pois" element={<POIManagement />} />
        <Route path="analytics" element={<InstituteAnalytics />} />
        <Route path="profile" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
