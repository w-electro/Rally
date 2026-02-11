import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';

export default function App() {
  const { isAuthenticated, isLoading, fetchCurrentUser, token } = useAuthStore();

  useSocket();

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, [token, fetchCurrentUser]);

  if (isLoading && token) {
    return (
      <div className="flex items-center justify-center h-screen bg-rally-darkBg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rally-cyan border-t-transparent rounded-full animate-spin" />
          <p className="text-rally-muted">Loading Rally...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/*" element={isAuthenticated ? <div>App Layout</div> : <Navigate to="/login" />} />
      <Route path="/login" element={!isAuthenticated ? <div>Login Page</div> : <Navigate to="/" />} />
      <Route path="/register" element={!isAuthenticated ? <div>Register Page</div> : <Navigate to="/" />} />
    </Routes>
  );
}
