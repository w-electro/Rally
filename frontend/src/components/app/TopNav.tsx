import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageCircle,
  Compass,
  Plus,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Settings,
  Minus,
  Square,
  X,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { cn, getInitials } from '@/lib/utils';
import { useServerPrefs } from '@/hooks/useServerPrefs';
import { ServerContextMenu } from '@/components/app/ServerContextMenu';
import type { Server } from '@/lib/types';

function ServerTab({
  server,
  isActive,
  onClick,
  isPinned,
  onContextMenu,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
}: {
  server: Server;
  isActive: boolean;
  onClick: () => void;
  isPinned: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      className={cn(
        'relative flex items-center gap-2 px-3 h-full shrink-0 transition-colors duration-150',
        isActive
          ? 'bg-white/10 text-white'
          : 'text-white/50 hover:text-white/80 hover:bg-white/5',
        isDragOver && 'border-l-2 border-[#00D9FF]'
      )}
    >
      {/* Server icon */}
      <div
        className={cn(
          'w-6 h-6 rounded-md flex items-center justify-center overflow-hidden text-[10px] font-bold shrink-0',
          isActive ? 'bg-[#00D9FF]/20 text-[#00D9FF]' : 'bg-white/10 text-white/60'
        )}
      >
        {server.iconUrl ? (
          <img src={server.iconUrl} alt={server.name} className="w-full h-full object-cover" />
        ) : (
          getInitials(server.name)
        )}
      </div>

      {/* Server name */}
      <span className="text-xs font-semibold whitespace-nowrap max-w-[80px] truncate">
        {server.name}
      </span>

      {/* Active cyan underline */}
      {isActive && (
        <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-[#00D9FF] rounded-full" />
      )}

      {/* Pinned indicator */}
      {isPinned && (
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#00D9FF]" />
      )}
    </button>
  );
}

export function TopNav() {
  const { t } = useTranslation();
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const openModal = useUIStore((s) => s.openModal);
  const servers = useServerStore((s) => s.servers);
  const activeServer = useServerStore((s) => s.activeServer);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const user = useAuthStore((s) => s.user);

  const { sortServers, getHiddenServers, togglePin, toggleHide, isPinned, reorder } =
    useServerPrefs();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    serverId: string;
    x: number;
    y: number;
  } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showHiddenDropdown, setShowHiddenDropdown] = useState(false);

  const nonHqServers = servers.filter((s) => s.name !== 'Rally HQ');
  const visibleServers = sortServers(nonHqServers);
  const hiddenServers = getHiddenServers(nonHqServers);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      observer.disconnect();
    };
  }, [checkScroll, servers]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -200 : 200;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const handleHomeClick = () => {
    setView('servers');
    setActiveServer(null);
  };

  const handleServerClick = (server: Server) => {
    setView('servers');
    setActiveServer(server);
  };

  const handleDmClick = () => {
    setView('dms');
    setActiveServer(null);
  };

  // Drag-to-reorder handlers
  const handleDragStart = (e: React.DragEvent, serverId: string) => {
    e.dataTransfer.setData('text/plain', serverId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, serverId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(serverId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId === targetId) return;
    const ids = visibleServers.map((s) => s.id);
    const fromIdx = ids.indexOf(sourceId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, sourceId);
    reorder(ids);
    setDragOverId(null);
  };

  const handleDragEnd = () => setDragOverId(null);

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent, serverId: string) => {
    e.preventDefault();
    setContextMenu({ serverId, x: e.clientX, y: e.clientY });
  };

  const isHomeActive = view === 'servers' && !activeServer;
  const isDmActive = view === 'dms';

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  return (
    <div
      className="h-11 bg-[#0A0E27] border-b border-white/5 flex items-center select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Home button */}
      <button
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onClick={handleHomeClick}
        className={cn(
          'flex items-center gap-2 px-4 h-full shrink-0 transition-colors duration-150',
          isHomeActive
            ? 'bg-[#00D9FF]/15 text-[#00D9FF]'
            : 'text-white/50 hover:text-white/80 hover:bg-white/5'
        )}
      >
        <img src="./icon.png" alt="Rally" className="w-5 h-5" />
        <span className="text-xs font-bold tracking-wider">{t('nav.home')}</span>
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-white/10 shrink-0" />

      {/* Server tabs area */}
      <div className="flex-1 flex items-center h-full min-w-0 relative">
        {/* Left scroll arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="absolute left-0 z-10 w-7 h-full flex items-center justify-center bg-gradient-to-r from-[#0A0E27] via-[#0A0E27]/90 to-transparent"
          >
            <ChevronLeft className="w-4 h-4 text-white/60 hover:text-white" />
          </button>
        )}

        {/* Scrollable server tabs */}
        <div
          ref={scrollRef}
          className="flex items-center h-full overflow-x-auto scrollbar-none"
        >
          {visibleServers.map((server) => (
            <ServerTab
              key={server.id}
              server={server}
              isActive={activeServer?.id === server.id && view === 'servers'}
              onClick={() => handleServerClick(server)}
              isPinned={isPinned(server.id)}
              onContextMenu={(e) => handleContextMenu(e, server.id)}
              draggable
              onDragStart={(e) => handleDragStart(e, server.id)}
              onDragOver={(e) => handleDragOver(e, server.id)}
              onDrop={(e) => handleDrop(e, server.id)}
              onDragEnd={handleDragEnd}
              isDragOver={dragOverId === server.id}
            />
          ))}
        </div>

        {/* Right scroll arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="absolute right-0 z-10 w-7 h-full flex items-center justify-center bg-gradient-to-l from-[#0A0E27] via-[#0A0E27]/90 to-transparent"
          >
            <ChevronRight className="w-4 h-4 text-white/60 hover:text-white" />
          </button>
        )}
      </div>

      {/* Hidden servers overflow */}
      {hiddenServers.length > 0 && (
        <div className="relative shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => setShowHiddenDropdown((prev) => !prev)}
            className="w-9 h-full flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            title={t('server.hiddenServers')}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showHiddenDropdown && (
            <div className="absolute top-full right-0 mt-1 z-50 w-48 rounded-lg border border-white/10 bg-[#0A0E27] py-1 shadow-xl">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase text-white/30">
                {t('server.hiddenServers')}
              </p>
              {hiddenServers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    toggleHide(s.id);
                    setShowHiddenDropdown(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="truncate">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center h-full shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Create Server */}
        <button
          onClick={() => openModal('createServer')}
          className="w-9 h-full flex items-center justify-center text-white/40 hover:text-[#39FF14] hover:bg-white/5 transition-colors duration-150"
          title={t('nav.createServer')}
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Join Server */}
        <button
          onClick={() => openModal('joinServer')}
          className="w-9 h-full flex items-center justify-center text-white/40 hover:text-[#39FF14] hover:bg-white/5 transition-colors duration-150"
          title={t('nav.joinServer')}
        >
          <UserPlus className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-white/10 shrink-0" />

        {/* DMs */}
        <button
          onClick={handleDmClick}
          className={cn(
            'w-9 h-full flex items-center justify-center transition-colors duration-150',
            isDmActive
              ? 'bg-[#00D9FF]/15 text-[#00D9FF]'
              : 'text-white/40 hover:text-white/80 hover:bg-white/5'
          )}
          title={t('nav.directMessages')}
        >
          <MessageCircle className="w-4 h-4" />
        </button>

        {/* Explore */}
        <button
          className="w-9 h-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors duration-150"
          title={t('nav.exploreServers')}
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-white/10 shrink-0" />

        {/* User Settings */}
        <button
          onClick={() => openModal('userSettings')}
          className="w-9 h-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors duration-150"
          title={t('nav.userSettings')}
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Avatar */}
        <button
          onClick={() => openModal('userSettings')}
          className="h-full px-2 flex items-center justify-center hover:bg-white/5 transition-colors duration-150"
          title={user?.displayName || 'Profile'}
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-rally-cyan/40 to-rally-purple/40 flex items-center justify-center text-[10px] font-bold text-white/70">
              {user?.displayName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </button>
      </div>

      {/* Window Controls */}
      {isElectron && (
        <div className="flex items-center h-full shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="w-px h-5 bg-white/10 shrink-0" />
          <button
            onClick={() => window.electronAPI?.minimize()}
            className="w-10 h-full flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label={t('nav.minimize')}
          >
            <Minus className="w-3.5 h-3.5 text-white/50" />
          </button>
          <button
            onClick={() => window.electronAPI?.maximize()}
            className="w-10 h-full flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label={t('nav.maximize')}
          >
            <Square className="w-3 h-3 text-white/50" />
          </button>
          <button
            onClick={() => window.electronAPI?.close()}
            className="w-10 h-full flex items-center justify-center hover:bg-red-500/80 transition-colors"
            aria-label={t('nav.close')}
          >
            <X className="w-3.5 h-3.5 text-white/50" />
          </button>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ServerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isPinned={isPinned(contextMenu.serverId)}
          onPin={() => togglePin(contextMenu.serverId)}
          onHide={() => toggleHide(contextMenu.serverId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
