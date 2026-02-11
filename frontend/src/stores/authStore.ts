import { create } from 'zustand';
import { SERVER_URL } from '@/lib/api';

interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email: string | null;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  about: string | null;
  customStatus: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  fetchCurrentUser: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('rally_token'),
  user: null,
  isAuthenticated: false,
  isLoading: false,

  setToken: (token) => {
    if (token) {
      localStorage.setItem('rally_token', token);
    } else {
      localStorage.removeItem('rally_token');
    }
    set({ token, isAuthenticated: !!token });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  fetchCurrentUser: async () => {
    const { token } = get();
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    set({ isLoading: true });
    try {
      const res = await fetch(`${SERVER_URL}/api/users/@me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        localStorage.removeItem('rally_token');
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('rally_token');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
