import { create } from 'zustand';
import type { Server, Channel, ServerMember } from '../lib/types';
import api from '../lib/api';

interface ServerState {
  servers: Server[];
  activeServer: Server | null;
  activeChannel: Channel | null;
  members: ServerMember[];
  isLoading: boolean;

  loadServers: () => Promise<void>;
  setActiveServer: (server: Server | null) => Promise<void>;
  setActiveChannel: (channel: Channel | null) => void;
  createServer: (data: { name: string; description?: string; isPublic?: boolean }) => Promise<Server>;
  joinServer: (serverId: string) => Promise<void>;
  leaveServer: (serverId: string) => Promise<void>;
  loadMembers: (serverId: string) => Promise<void>;
  updateServerLocal: (serverId: string, data: Partial<Server>) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: string) => void;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  activeServer: null,
  activeChannel: null,
  members: [],
  isLoading: false,

  loadServers: async () => {
    set({ isLoading: true });
    try {
      const data = await api.getServers();
      const servers = Array.isArray(data) ? data : (data as any)?.servers ?? [];
      set({ servers, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setActiveServer: async (server) => {
    if (!server) {
      set({ activeServer: null, activeChannel: null, members: [] });
      return;
    }

    set({ isLoading: true });
    try {
      const fullServer = await api.getServer(server.id);
      const firstTextChannel = fullServer.channels?.find(
        (c: Channel) => c.type === 'TEXT' || c.type === 'FEED'
      );
      set({
        activeServer: fullServer,
        activeChannel: firstTextChannel || null,
        isLoading: false,
      });
      get().loadMembers(server.id);
    } catch {
      set({ isLoading: false });
    }
  },

  setActiveChannel: (channel) => set({ activeChannel: channel }),

  createServer: async (data) => {
    const server = await api.createServer(data);
    set((s) => ({ servers: [...s.servers, server] }));
    return server;
  },

  joinServer: async (serverId) => {
    await api.joinServer(serverId);
    await get().loadServers();
  },

  leaveServer: async (serverId) => {
    await api.leaveServer(serverId);
    set((s) => ({
      servers: s.servers.filter((sv) => sv.id !== serverId),
      activeServer: s.activeServer?.id === serverId ? null : s.activeServer,
      activeChannel: s.activeServer?.id === serverId ? null : s.activeChannel,
    }));
  },

  loadMembers: async (serverId) => {
    try {
      const data = await api.getServerMembers(serverId);
      const members = Array.isArray(data) ? data : (data as any)?.members ?? [];
      set({ members });
    } catch {}
  },

  updateServerLocal: (serverId, data) => {
    set((s) => ({
      servers: s.servers.map((sv) => (sv.id === serverId ? { ...sv, ...data } : sv)),
      activeServer: s.activeServer?.id === serverId ? { ...s.activeServer, ...data } : s.activeServer,
    }));
  },

  addChannel: (channel) => {
    set((s) => {
      if (!s.activeServer) return s;
      const channels = [...(s.activeServer.channels || []), channel];
      return { activeServer: { ...s.activeServer, channels } };
    });
  },

  removeChannel: (channelId) => {
    set((s) => {
      if (!s.activeServer) return s;
      const channels = (s.activeServer.channels || []).filter((c) => c.id !== channelId);
      return {
        activeServer: { ...s.activeServer, channels },
        activeChannel: s.activeChannel?.id === channelId ? null : s.activeChannel,
      };
    });
  },
}));
