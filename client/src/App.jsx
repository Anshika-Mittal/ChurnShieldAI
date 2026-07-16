import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Pages
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import OTPVerification from "./pages/OTPVerification";
import Dashboard from "./pages/Dashboard";
import SinglePrediction from "./pages/SinglePrediction";
import BatchPrediction from "./pages/BatchPrediction";
import History from "./pages/History";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

// Layout
import Layout from "./components/Layout";

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  
  if (!token) {
    return <Navigate to="/signin" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

// Public Redirect Wrapper (Redirects logged in users to dashboard)
const PublicRoute = ({ children }) => {
  const { token, loading } = useAuth();
  
  if (loading) return null;
  if (token) return <Navigate to="/dashboard" replace />;
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/signin" element={<PublicRoute><SignIn /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
      <Route path="/verify-otp" element={<PublicRoute><OTPVerification /></PublicRoute>} />

      {/* Protected Dashboard Pages */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/predict-single" element={<ProtectedRoute><SinglePrediction /></ProtectedRoute>} />
      <Route path="/predict-batch" element={<ProtectedRoute><BatchPrediction /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      {/* Fallback Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
