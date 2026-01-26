import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
/* Auth Context */
import { AuthProvider } from "./context/AuthContext";

/* Layouts */
/* Layouts */
import Layout from "./components/layout/Layout";

/* Public Pages */
import Landing from "./pages/Landing";

/* Auth */
import Login from "./pages/auth/Login";

/* Admin Pages */
import AdminDashboard from "./pages/admin/Dashboard";
import UserManagement from "./pages/admin/UserManagement";
import InstitutionManagement from "./pages/admin/InstitutionManagement";
import ContentManagement from "./pages/admin/ContentManagement";
import AdminAnalytics from "./pages/admin/Analytics";
import Settings from "./pages/CommonSettings";

/* Institute Pages */
import InstituteDashboard from "./pages/institution/Dashboard";
import InstituteTours from "./pages/institution/MyTours";
import InstituteAnalytics from "./pages/institution/Analytics";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<Layout role="admin" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="institutions" element={<InstitutionManagement />} />
        <Route path="content" element={<ContentManagement />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Institute Routes */}
      <Route path="/institution" element={<Layout role="institution" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<InstituteDashboard />} />
        <Route path="tours" element={<InstituteTours />} />
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
