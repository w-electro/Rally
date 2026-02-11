import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useSocket() {
  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!token || !isAuthenticated) return;

    // Socket connection will be initialized here
    // For now, this is a placeholder that doesn't connect
    return () => {
      // Cleanup socket connection
    };
  }, [token, isAuthenticated]);

  return null;
}
