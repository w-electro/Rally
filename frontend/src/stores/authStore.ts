import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../lib/types';
import api from '../lib/api';
import { clearServerCaches } from './serverStore';
import { clearDmChatCaches } from '../components/chat/DmChatView';
import { clearDmSidebarCaches } from '../components/app/DmSidebar';

// ---------------------------------------------------------------------------
// Saved accounts — persisted separately so they survive logout
// ---------------------------------------------------------------------------

export interface SavedAccount {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  refreshToken: string;
  lastUsed: number; // timestamp
}

const SAVED_ACCOUNTS_KEY = 'rally-saved-accounts';

export function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (!raw) return [];
    const accounts: SavedAccount[] = JSON.parse(raw);
    // Sort by last used (most recent first)
    return accounts.sort((a, b) => b.lastUsed - a.lastUsed);
  } catch {
    return [];
  }
}

function saveAccount(user: any, email: string, refreshToken: string) {
  const accounts = getSavedAccounts();
  const existing = accounts.findIndex((a) => a.id === user.id);
  const entry: SavedAccount = {
    id: user.id,
    email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    refreshToken,
    lastUsed: Date.now(),
  };
  if (existing >= 0) {
    accounts[existing] = entry;
  } else {
    accounts.unshift(entry);
  }
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function updateSavedAccountToken(userId: string, refreshToken: string) {
  const accounts = getSavedAccounts();
  const idx = accounts.findIndex((a) => a.id === userId);
  if (idx >= 0) {
    accounts[idx].refreshToken = refreshToken;
    accounts[idx].lastUsed = Date.now();
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  }
}

export function removeSavedAccount(userId: string) {
  const accounts = getSavedAccounts().filter((a) => a.id !== userId);
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

/** After a token rotation, update any saved account that had the old token */
function syncSavedAccountToken(oldToken: string, newToken: string) {
  try {
    const accounts = getSavedAccounts();
    const updated = accounts.map((a) =>
      a.refreshToken === oldToken ? { ...a, refreshToken: newToken, lastUsed: Date.now() } : a
    );
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
  } catch {}
}

// ---------------------------------------------------------------------------
// Auth store
// ---------------------------------------------------------------------------

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  loginWithRefreshToken: (account: SavedAccount) => Promise<void>;
  register: (data: { email: string; username: string; displayName: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.login({ email, password });
          api.setToken(data.accessToken);
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          saveAccount(data.user, email, data.refreshToken);
          set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },

      loginWithRefreshToken: async (account) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${api.getApiBase()}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: account.refreshToken }),
          });
          if (!res.ok) throw new Error('Session expired. Please enter your password.');
          const data = await res.json();
          api.setToken(data.accessToken);
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          updateSavedAccountToken(account.id, data.refreshToken);
          // Fetch full user profile
          const meData = await api.getMe();
          const user = (meData as any).user ?? meData;
          saveAccount(user, account.email, data.refreshToken);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },

      register: async (formData) => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.register(formData);
          api.setToken(data.accessToken);
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          saveAccount(data.user, formData.email, data.refreshToken);
          set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          await api.logout();
        } catch {}
        api.setToken(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        // Clear all module-level caches to prevent data leaking between accounts
        clearServerCaches();
        clearDmChatCaches();
        clearDmSidebarCaches();
        set({ user: null, isAuthenticated: false, isHydrated: false });
      },

      loadUser: async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          // No access token — try the most recent saved account's refresh token
          const accounts = getSavedAccounts();
          if (accounts.length > 0) {
            try {
              await get().loginWithRefreshToken(accounts[0]);
              set({ isHydrated: true });
              return;
            } catch {
              // Refresh failed — fall through to unauthenticated
            }
          }
          set({ user: null, isAuthenticated: false, isLoading: false, isHydrated: true });
          return;
        }

        api.setToken(token);
        const hasPersistedUser = !!get().user;
        if (!hasPersistedUser) set({ isLoading: true });
        try {
          const data = await api.getMe();
          const user = (data as any).user ?? data;
          set({ user, isAuthenticated: true, isLoading: false, isHydrated: true });
        } catch {
          // Access token invalid — try refresh
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const res = await fetch(`${api.getApiBase()}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
              });
              if (res.ok) {
                const data = await res.json();
                api.setToken(data.accessToken);
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                // Sync new refresh token to saved accounts
                syncSavedAccountToken(refreshToken, data.refreshToken);
                const meData = await api.getMe();
                const user = (meData as any).user ?? meData;
                set({ user, isAuthenticated: true, isLoading: false, isHydrated: true });
                return;
              }
            } catch {}
          }
          api.setToken(null);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          set({ user: null, isAuthenticated: false, isLoading: false, isHydrated: true });
        }
      },

      clearError: () => set({ error: null }),
      updateUser: (data) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...data } });
      },
    }),
    {
      name: 'rally-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    }
  )
);
