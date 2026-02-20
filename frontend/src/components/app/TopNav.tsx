import { useRef, useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Compass,
  Plus,
  UserPlus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { cn, getInitials } from '@/lib/utils';
import type { Server } from '@/lib/types';

function ServerTab({
  server,
  isActive,
  onClick,
}: {
  server: Server;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 px-3 h-full shrink-0 transition-colors duration-150',
        isActive
          ? 'bg-white/10 text-white'
          : 'text-white/50 hover:text-white/80 hover:bg-white/5'
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
    </button>
  );
}

export function TopNav() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const openModal = useUIStore((s) => s.openModal);
  const servers = useServerStore((s) => s.servers);
  const activeServer = useServerStore((s) => s.activeServer);
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  const isHomeActive = view === 'servers' && !activeServer;
  const isDmActive = view === 'dms';

  return (
    <div className="h-11 bg-[#0A0E27] border-b border-white/5 flex items-center select-none">
      {/* Left: Home button */}
      <button
        onClick={handleHomeClick}
        className={cn(
          'flex items-center gap-2 px-4 h-full shrink-0 transition-colors duration-150',
          isHomeActive
            ? 'bg-[#00D9FF]/15 text-[#00D9FF]'
            : 'text-white/50 hover:text-white/80 hover:bg-white/5'
        )}
      >
        <img src="./icon.png" alt="Rally" className="w-5 h-5" />
        <span className="text-xs font-bold tracking-wider">HOME</span>
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-white/10 shrink-0" />

      {/* Server tabs area */}
      <div className="flex-1 flex items-center h-full min-w-0 relative">
        {/* Left scroll arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
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
          {servers
            .filter((server) => server.name !== 'Rally HQ')
            .map((server) => (
              <ServerTab
                key={server.id}
                server={server}
                isActive={activeServer?.id === server.id && view === 'servers'}
                onClick={() => handleServerClick(server)}
              />
            ))}
        </div>

        {/* Right scroll arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 z-10 w-7 h-full flex items-center justify-center bg-gradient-to-l from-[#0A0E27] via-[#0A0E27]/90 to-transparent"
          >
            <ChevronRight className="w-4 h-4 text-white/60 hover:text-white" />
          </button>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center h-full shrink-0">
        {/* Create Server */}
        <button
          onClick={() => openModal('createServer')}
          className="w-9 h-full flex items-center justify-center text-white/40 hover:text-[#39FF14] hover:bg-white/5 transition-colors duration-150"
          title="Create Server"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Join Server */}
        <button
          onClick={() => openModal('joinServer')}
          className="w-9 h-full flex items-center justify-center text-white/40 hover:text-[#39FF14] hover:bg-white/5 transition-colors duration-150"
          title="Join Server"
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
          title="Direct Messages"
        >
          <MessageCircle className="w-4 h-4" />
        </button>

        {/* Explore */}
        <button
          className="w-9 h-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors duration-150"
          title="Explore Servers"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
