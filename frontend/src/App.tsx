import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';
import LandingPage from '@/pages/LandingPage';
import DownloadPage from '@/pages/DownloadPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import AppLayout from '@/components/app/AppLayout';

export default function App() {
  const { isAuthenticated, isLoading, fetchCurrentUser, token } = useAuthStore();

  useSocket();

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, [token, fetchCurrentUser]);

  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/download" element={<DownloadPage />} />

      {/* Auth pages */}
      <Route
        path="/login"
        element={
          !isAuthenticated ? <LoginPage /> : <Navigate to="/channels/@me" />
        }
      />
      <Route
        path="/register"
        element={
          !isAuthenticated ? <RegisterPage /> : <Navigate to="/channels/@me" />
        }
      />

      {/* App routes - require auth */}
      <Route
        path="/channels/*"
        element={
          isAuthenticated ? (
            isLoading ? (
              <div className="app-layout flex items-center justify-center bg-rally-darkBg">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-rally-cyan border-t-transparent rounded-full animate-spin" />
                  <p className="text-rally-muted">Loading Rally...</p>
                </div>
              </div>
            ) : (
              <AppLayout />
            )
          ) : (
            <Navigate to="/login" />
          )
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
