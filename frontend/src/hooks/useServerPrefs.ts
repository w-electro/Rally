import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'rally:server-prefs';

interface ServerPrefs {
  order: string[];
  pinned: string[];
  hidden: string[];
}

const DEFAULT_PREFS: ServerPrefs = {
  order: [],
  pinned: [],
  hidden: [],
};

function loadPrefs(): ServerPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      order: Array.isArray(parsed.order) ? parsed.order : [],
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs: ServerPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function useServerPrefs() {
  const [prefs, setPrefs] = useState<ServerPrefs>(loadPrefs);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const togglePin = useCallback((serverId: string) => {
    setPrefs((prev) => {
      const isPinned = prev.pinned.includes(serverId);
      return {
        ...prev,
        pinned: isPinned
          ? prev.pinned.filter((id) => id !== serverId)
          : [...prev.pinned, serverId],
      };
    });
  }, []);

  const toggleHide = useCallback((serverId: string) => {
    setPrefs((prev) => {
      const isHidden = prev.hidden.includes(serverId);
      return {
        ...prev,
        hidden: isHidden
          ? prev.hidden.filter((id) => id !== serverId)
          : [...prev.hidden, serverId],
      };
    });
  }, []);

  const reorder = useCallback((serverIds: string[]) => {
    setPrefs((prev) => ({
      ...prev,
      order: serverIds,
    }));
  }, []);

  const unhide = useCallback((serverId: string) => {
    setPrefs((prev) => ({
      ...prev,
      hidden: prev.hidden.filter((id) => id !== serverId),
    }));
  }, []);

  const isPinned = useCallback(
    (serverId: string): boolean => {
      return prefs.pinned.includes(serverId);
    },
    [prefs],
  );

  const isHidden = useCallback(
    (serverId: string): boolean => {
      return prefs.hidden.includes(serverId);
    },
    [prefs],
  );

  const sortServers = useCallback(
    <T extends { id: string; name: string }>(servers: T[]): T[] => {
      const visible = servers.filter((s) => !prefs.hidden.includes(s.id));

      const orderMap = new Map<string, number>();
      prefs.order.forEach((id, index) => {
        orderMap.set(id, index);
      });

      return [...visible].sort((a, b) => {
        const aPinned = prefs.pinned.includes(a.id);
        const bPinned = prefs.pinned.includes(b.id);

        // Pinned servers come first
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        // Then sort by order array index
        const aOrder = orderMap.get(a.id);
        const bOrder = orderMap.get(b.id);

        if (aOrder !== undefined && bOrder !== undefined) {
          return aOrder - bOrder;
        }
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;

        // Finally, alphabetical by name
        return a.name.localeCompare(b.name);
      });
    },
    [prefs],
  );

  const getHiddenServers = useCallback(
    <T extends { id: string }>(servers: T[]): T[] => {
      return servers.filter((s) => prefs.hidden.includes(s.id));
    },
    [prefs],
  );

  return {
    prefs,
    togglePin,
    toggleHide,
    reorder,
    unhide,
    isPinned,
    isHidden,
    sortServers,
    getHiddenServers,
  };
}
