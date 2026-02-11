import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';
import LandingPage from '@/pages/LandingPage';
import DownloadPage from '@/pages/DownloadPage';

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
      {/* Public pages - always accessible */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/download" element={<DownloadPage />} />

      {/* Auth pages */}
      <Route
        path="/login"
        element={
          !isAuthenticated ? (
            <div className="app-layout flex items-center justify-center bg-rally-darkBg">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-4">Login</h1>
                <p className="text-rally-muted">Login page coming soon</p>
              </div>
            </div>
          ) : (
            <Navigate to="/channels/@me" />
          )
        }
      />
      <Route
        path="/register"
        element={
          !isAuthenticated ? (
            <div className="app-layout flex items-center justify-center bg-rally-darkBg">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-4">Register</h1>
                <p className="text-rally-muted">Registration page coming soon</p>
              </div>
            </div>
          ) : (
            <Navigate to="/channels/@me" />
          )
        }
      />

      {/* App routes - require auth */}
      <Route
        path="/channels/*"
        element={
          isAuthenticated ? (
            <div className="app-layout bg-rally-darkBg">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-rally-cyan border-t-transparent rounded-full animate-spin" />
                    <p className="text-rally-muted">Loading Rally...</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-rally-muted">App Layout - Coming Soon</p>
                </div>
              )}
            </div>
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
