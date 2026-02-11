import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Server, Channel, ServerMember } from '@/lib/types';

interface ServerWithChannels extends Server {
  channels: Channel[];
}

interface ServerState {
  servers: ServerWithChannels[];
  activeServerId: string | null;
  activeChannelId: string | null;
  members: ServerMember[];
  isLoading: boolean;

  fetchServers: () => Promise<void>;
  fetchMembers: (serverId: string) => Promise<void>;
  setActiveServer: (serverId: string | null) => void;
  setActiveChannel: (channelId: string | null) => void;
  createServer: (name: string) => Promise<ServerWithChannels>;

  getActiveServer: () => ServerWithChannels | undefined;
  getActiveChannel: () => Channel | undefined;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  activeServerId: null,
  activeChannelId: null,
  members: [],
  isLoading: false,

  fetchServers: async () => {
    set({ isLoading: true });
    try {
      const servers = await api.get<ServerWithChannels[]>('/servers');
      set({ servers, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchMembers: async (serverId: string) => {
    try {
      const members = await api.get<ServerMember[]>(`/servers/${serverId}/members`);
      set({ members });
    } catch {
      // ignore
    }
  },

  setActiveServer: (serverId) => {
    set({ activeServerId: serverId, activeChannelId: null, members: [] });
    if (serverId) {
      const server = get().servers.find((s) => s.id === serverId);
      const firstTextChannel = server?.channels.find((c) => c.type === 'text' || c.type === 'TEXT');
      if (firstTextChannel) {
        set({ activeChannelId: firstTextChannel.id });
      }
      get().fetchMembers(serverId);
    }
  },

  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  createServer: async (name: string) => {
    const server = await api.post<ServerWithChannels>('/servers', { name });
    set((state) => ({ servers: [...state.servers, server] }));
    return server;
  },

  getActiveServer: () => {
    const { servers, activeServerId } = get();
    return servers.find((s) => s.id === activeServerId);
  },

  getActiveChannel: () => {
    const server = get().getActiveServer();
    const { activeChannelId } = get();
    return server?.channels.find((c) => c.id === activeChannelId);
  },
}));
