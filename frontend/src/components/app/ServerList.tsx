import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Compass,
  MessageCircle,
  UserPlus,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { cn, getInitials } from '@/lib/utils';
import type { Server } from '@/lib/types';

function ServerIcon({
  server,
  isActive,
  onClick,
}: {
  server: Server;
  isActive: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const unreadCounts = useUIStore((s) => s.unreadCounts);
  const hasUnread = server.channels?.some((ch) => (unreadCounts[ch.id] ?? 0) > 0) ?? false;

  return (
    <div className="relative flex items-center justify-center w-full mb-2 group">
      {/* Active / Hover indicator bar */}
      <div
        className={cn(
          'absolute left-0 w-1 rounded-r-full bg-[#00D9FF] transition-all duration-200',
          isActive
            ? 'h-10'
            : isHovered
              ? 'h-5'
              : 'h-0'
        )}
      />

      {/* Unread indicator dot */}
      {!isActive && hasUnread && (
        <div className="absolute left-0 w-1 h-2 rounded-r-full bg-white" />
      )}

      {/* Server icon button */}
      <button
        onClick={onClick}
        onMouseEnter={() => {
          setIsHovered(true);
          setShowTooltip(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setShowTooltip(false);
        }}
        className={cn(
          'w-12 h-12 flex items-center justify-center transition-all duration-200 overflow-hidden',
          isActive || isHovered
            ? 'rounded-2xl'
            : 'rounded-[24px]',
          isActive
            ? 'bg-[#00D9FF]/20 ring-1 ring-[#00D9FF]/40'
            : 'bg-[#1A1F36] hover:bg-[#00D9FF]/10',
          isHovered && !isActive && 'scale-105 shadow-[0_0_15px_rgba(0,217,255,0.15)]'
        )}
      >
        {server.iconUrl ? (
          <img
            src={server.iconUrl}
            alt={server.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className={cn(
              'text-sm font-bold transition-colors',
              isActive ? 'text-[#00D9FF]' : 'text-white/70'
            )}
          >
            {getInitials(server.name)}
          </span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-full ml-3 z-50 pointer-events-none">
          <div className="bg-[#1A1F36] text-white text-sm font-medium px-3 py-2 rounded-md shadow-xl border border-white/10 whitespace-nowrap">
            {server.name}
          </div>
        </div>
      )}
    </div>
  );
}

export function ServerList() {
  const { t } = useTranslation();
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const openModal = useUIStore((s) => s.openModal);
  const servers = useServerStore((s) => s.servers);
  const activeServer = useServerStore((s) => s.activeServer);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const handleServerClick = (server: Server) => {
    setView('servers');
    setActiveServer(server);
  };

  const handleHomeClick = () => {
    setView('pulse');
    setActiveServer(null);
  };

  const handleDmClick = () => {
    setView('dms');
    setActiveServer(null);
  };

  return (
    <div className="h-full w-[72px] bg-[#0A0E27] flex flex-col items-center py-3 overflow-y-auto overflow-x-hidden scrollbar-none">
      {/* Rally Logo / Home */}
      <div className="relative mb-2">
        <button
          onClick={handleHomeClick}
          onMouseEnter={() => setHoveredAction('home')}
          onMouseLeave={() => setHoveredAction(null)}
          className={cn(
            'w-12 h-12 flex items-center justify-center rounded-[24px] transition-all duration-200 overflow-hidden',
            view === 'pulse'
              ? 'rounded-2xl bg-[#00D9FF]/20 ring-1 ring-[#00D9FF]/40'
              : 'bg-[#1A1F36] hover:rounded-2xl hover:bg-[#00D9FF]/10'
          )}
        >
          <img src="./icon.png" alt="Rally" className="w-7 h-7" />
        </button>
        {hoveredAction === 'home' && (
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className="bg-[#1A1F36] text-white text-sm font-medium px-3 py-2 rounded-md shadow-xl border border-white/10 whitespace-nowrap">
              {t('tooltips.home')}
            </div>
          </div>
        )}
      </div>

      {/* DM Button */}
      <div className="relative mb-2">
        <button
          onClick={handleDmClick}
          onMouseEnter={() => setHoveredAction('dms')}
          onMouseLeave={() => setHoveredAction(null)}
          className={cn(
            'w-12 h-12 flex items-center justify-center rounded-[24px] transition-all duration-200',
            view === 'dms'
              ? 'rounded-2xl bg-[#00D9FF]/20 ring-1 ring-[#00D9FF]/40'
              : 'bg-[#1A1F36] hover:rounded-2xl hover:bg-[#00D9FF]/10'
          )}
        >
          <MessageCircle
            className={cn(
              'w-5 h-5 transition-colors',
              view === 'dms' ? 'text-[#00D9FF]' : 'text-white/70'
            )}
          />
        </button>
        {hoveredAction === 'dms' && (
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className="bg-[#1A1F36] text-white text-sm font-medium px-3 py-2 rounded-md shadow-xl border border-white/10 whitespace-nowrap">
              {t('tooltips.directMessages')}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-white/10 my-1 shrink-0" />

      {/* Server Icons */}
      <div className="flex-1 w-full flex flex-col items-center py-2 overflow-y-auto scrollbar-none">
        {servers.map((server) => (
          <ServerIcon
            key={server.id}
            server={server}
            isActive={activeServer?.id === server.id && view === 'servers'}
            onClick={() => handleServerClick(server)}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-white/10 my-1 shrink-0" />

      {/* Add Server Button */}
      <div className="relative mt-1">
        <button
          onClick={() => openModal('createServer')}
          onMouseEnter={() => setHoveredAction('create')}
          onMouseLeave={() => setHoveredAction(null)}
          className="w-12 h-12 flex items-center justify-center rounded-[24px] bg-[#1A1F36] hover:rounded-2xl hover:bg-[#39FF14]/10 transition-all duration-200 group"
        >
          <Plus className="w-5 h-5 text-[#39FF14] group-hover:text-[#39FF14]" />
        </button>
        {hoveredAction === 'create' && (
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className="bg-[#1A1F36] text-white text-sm font-medium px-3 py-2 rounded-md shadow-xl border border-white/10 whitespace-nowrap">
              {t('tooltips.createServer')}
            </div>
          </div>
        )}
      </div>

      {/* Join Server Button */}
      <div className="relative mt-2">
        <button
          onClick={() => openModal('joinServer')}
          onMouseEnter={() => setHoveredAction('join')}
          onMouseLeave={() => setHoveredAction(null)}
          className="w-12 h-12 flex items-center justify-center rounded-[24px] bg-[#1A1F36] hover:rounded-2xl hover:bg-[#39FF14]/10 transition-all duration-200 group"
        >
          <UserPlus className="w-5 h-5 text-[#39FF14] group-hover:text-[#39FF14]" />
        </button>
        {hoveredAction === 'join' && (
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className="bg-[#1A1F36] text-white text-sm font-medium px-3 py-2 rounded-md shadow-xl border border-white/10 whitespace-nowrap">
              {t('tooltips.joinServer')}
            </div>
          </div>
        )}
      </div>

      {/* Explore Button */}
      <div className="relative mt-2">
        <button
          onMouseEnter={() => setHoveredAction('explore')}
          onMouseLeave={() => setHoveredAction(null)}
          className="w-12 h-12 flex items-center justify-center rounded-[24px] bg-[#1A1F36] hover:rounded-2xl hover:bg-[#39FF14]/10 transition-all duration-200 group"
        >
          <Compass className="w-5 h-5 text-[#39FF14] group-hover:text-[#39FF14]" />
        </button>
        {hoveredAction === 'explore' && (
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className="bg-[#1A1F36] text-white text-sm font-medium px-3 py-2 rounded-md shadow-xl border border-white/10 whitespace-nowrap">
              {t('tooltips.exploreServers')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
