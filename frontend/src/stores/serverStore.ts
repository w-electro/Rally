import { create } from 'zustand';
import type { Server, Channel, ServerMember } from '../lib/types';
import api from '../lib/api';

// Per-server caches for instant switching
const _memberCache = new Map<string, ServerMember[]>();
const _serverCache = new Map<string, Server>();

// Persist server list to localStorage for instant display on launch
let _cachedServerList: Server[] = [];
try {
  const raw = localStorage.getItem('rally-servers');
  if (raw) _cachedServerList = JSON.parse(raw);
} catch {}

// Persist last active server ID
const _lastServerId = localStorage.getItem('rally-active-server') ?? null;

// Per-server last-active-channel map (serverId -> channelId)
let _activeChannels = new Map<string, string>();
try {
  const raw = localStorage.getItem('rally-active-channels');
  if (raw) _activeChannels = new Map(JSON.parse(raw));
} catch {}

function _persistActiveChannels() {
  try {
    localStorage.setItem('rally-active-channels', JSON.stringify([..._activeChannels]));
  } catch {}
}

// Generation counter to cancel stale async operations
let _switchGen = 0;

/** Clear all module-level caches — call on logout */
export function clearServerCaches() {
  _memberCache.clear();
  _serverCache.clear();
  _cachedServerList = [];
  _activeChannels.clear();
  _switchGen = 0;
  localStorage.removeItem('rally-servers');
  localStorage.removeItem('rally-active-server');
  localStorage.removeItem('rally-active-channels');
}

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
  servers: _cachedServerList,
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
      // Persist for instant display on next launch
      try { localStorage.setItem('rally-servers', JSON.stringify(servers)); } catch {}
      // Auto-restore last active server if none is set yet
      if (!get().activeServer && _lastServerId) {
        const lastServer = servers.find((s: Server) => s.id === _lastServerId);
        if (lastServer) {
          get().setActiveServer(lastServer);
        }
      }
    } catch (err) {
      console.error('Failed to load servers:', err);
      set({ isLoading: false });
    }
  },

  setActiveServer: async (server) => {
    const gen = ++_switchGen;

    if (!server) {
      set({ activeServer: null, activeChannel: null, members: [] });
      localStorage.removeItem('rally-active-server');
      return;
    }

    // INSTANT: use cached full server if available, otherwise use the list item
    const cached = _serverCache.get(server.id);
    const immediate = cached ?? server;

    // Restore per-server last-active channel
    const savedChannelId = _activeChannels.get(server.id);
    let initialChannel: Channel | null = null;
    if (savedChannelId && immediate.channels) {
      initialChannel = immediate.channels.find((c: Channel) => c.id === savedChannelId) ?? null;
    }
    if (!initialChannel) {
      initialChannel = immediate.channels?.find(
        (c: Channel) => c.type === 'TEXT' || c.type === 'FEED'
      ) ?? null;
    }

    const cachedMembers = _memberCache.get(server.id) ?? [];
    set({
      activeServer: immediate,
      activeChannel: initialChannel,
      members: cachedMembers,
      isLoading: !cached,
    });

    // Persist active IDs
    localStorage.setItem('rally-active-server', server.id);
    if (initialChannel) {
      _activeChannels.set(server.id, initialChannel.id);
      _persistActiveChannels();
    }

    // Background refresh: fetch full server data (cancel if user switched away)
    try {
      const fullServer = await api.getServer(server.id);
      if (gen !== _switchGen) return; // stale — user already switched
      _serverCache.set(server.id, fullServer);
      const current = get();
      const channelChanged = current.activeChannel?.id !== initialChannel?.id;
      if (current.activeServer?.id === server.id) {
        set({
          activeServer: fullServer,
          // Only override channel if user hasn't navigated away
          activeChannel: channelChanged
            ? current.activeChannel
            : (initialChannel ?? fullServer.channels?.find(
                (c: Channel) => c.type === 'TEXT' || c.type === 'FEED'
              ) ?? null),
          isLoading: false,
        });
      }
    } catch {
      if (gen === _switchGen) set({ isLoading: false });
    }

    // Load members (also cancelled if stale)
    if (gen === _switchGen) get().loadMembers(server.id);
  },

  setActiveChannel: (channel) => {
    set({ activeChannel: channel });
    const serverId = get().activeServer?.id;
    if (channel && serverId) {
      _activeChannels.set(serverId, channel.id);
      _persistActiveChannels();
    }
  },

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
      _memberCache.set(serverId, members);
      // Only update if this server is still active
      if (get().activeServer?.id === serverId) {
        set({ members });
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
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
