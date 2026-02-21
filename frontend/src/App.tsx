import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useSocket } from './hooks/useSocket';
import { AppLayout } from './components/app/AppLayout';
import { UpdateNotification } from './components/app/UpdateNotification';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LandingPage } from './pages/LandingPage';

function SocketProvider({ children }: { children: React.ReactNode }) {
  useSocket();
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isHydrated } = useAuthStore();

  // Wait for initial auth check to complete before making routing decisions
  if (!isHydrated || isLoading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <img src="./icon.png" alt="Rally" className="w-16 h-16 mx-auto animate-pulse" />
          <p className="mt-4 text-rally-text-muted font-display">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { loadUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <HashRouter>
      <SocketProvider>
        <Routes>
          <Route path="/" element={isAuthenticated ? <Navigate to="/app" replace /> : <LandingPage />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/app" replace /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/app" replace /> : <RegisterPage />} />
          <Route
            path="/app/*"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SocketProvider>
      <UpdateNotification />
    </HashRouter>
  );
}
