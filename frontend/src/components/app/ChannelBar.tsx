import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, Volume2, Camera, Megaphone, Theater, Settings, ChevronLeft, ChevronRight, UserPlus, Plus, Pencil, Trash2 } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { useUIStore } from '@/stores/uiStore';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';
import { VoiceChannelPreview } from '@/components/voice/VoiceChannelPreview';
import api from '@/lib/api';
import type { Channel } from '@/lib/types';

function getChannelIcon(type: string) {
  switch (type) {
    case 'TEXT':
      return Hash;
    case 'VOICE':
      return Volume2;
    case 'FEED':
      return Camera;
    case 'STAGE':
      return Theater;
    case 'ANNOUNCEMENT':
      return Megaphone;
    default:
      return Hash;
  }
}

export function ChannelBar() {
  const { t } = useTranslation();
  const activeServer = useServerStore((s) => s.activeServer);
  const activeChannel = useServerStore((s) => s.activeChannel);
  const setActiveChannel = useServerStore((s) => s.setActiveChannel);
  const voiceChannelId = useVoiceStore((s) => s.channelId);
  const participants = useVoiceStore((s) => s.participants);
  const openModal = useUIStore((s) => s.openModal);
  const { joinVoice } = useSocket();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [hoveredVoiceChannel, setHoveredVoiceChannel] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Right-click context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; channel: Channel } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll);
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      observer.disconnect();
    };
  }, [checkScroll, activeServer]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -200 : 200;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }, []);

  const handleChannelClick = useCallback((channel: Channel) => {
    setActiveChannel(channel);
  }, [setActiveChannel]);

  const handleVoiceHoverEnter = useCallback((channelId: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredVoiceChannel(channelId);
    }, 300);
  }, []);

  const handleVoiceHoverLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setHoveredVoiceChannel(null);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Focus rename input when renaming starts
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  const handleContextMenu = useCallback((e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, channel });
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renaming || !activeServer) return;
    const newName = renaming.name.trim();
    if (!newName) { setRenaming(null); return; }
    try {
      await api.updateChannel(activeServer.id, renaming.id, { name: newName });
      // Update local state
      const updatedChannels = (activeServer.channels || []).map((c) =>
        c.id === renaming.id ? { ...c, name: newName } : c
      );
      useServerStore.getState().updateServerLocal(activeServer.id, { channels: updatedChannels } as any);
    } catch {}
    setRenaming(null);
  }, [renaming, activeServer]);

  const handleDeleteChannel = useCallback(async (channel: Channel) => {
    if (!activeServer) return;
    if (!confirm(t('channel.deleteConfirm', { name: channel.name }))) return;
    try {
      await api.deleteChannel(activeServer.id, channel.id);
      useServerStore.getState().removeChannel(channel.id);
    } catch {}
  }, [activeServer]);

  if (!activeServer) return null;

  const channels = (activeServer.channels || [])
    .filter((c) => c.type !== 'CATEGORY')
    .sort((a, b) => a.position - b.position);

  return (
    <div className="h-9 bg-[#0D1117] border-b border-white/5 flex items-center shrink-0">
      {/* Left scroll arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="shrink-0 w-6 h-full flex items-center justify-center text-white/40 hover:text-white/70 bg-gradient-to-r from-[#0D1117] to-transparent z-10"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Scrollable channel tabs */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-0.5 overflow-x-auto scrollbar-none px-1"
      >
        {channels.map((channel) => {
          const Icon = getChannelIcon(channel.type);
          const isActive = activeChannel?.id === channel.id;
          const isVoiceActive = channel.type === 'VOICE' && voiceChannelId === channel.id;
          const isVoice = channel.type === 'VOICE';
          const isRenaming = renaming?.id === channel.id;

          const button = (
            <button
              onClick={() => handleChannelClick(channel)}
              onContextMenu={(e) => handleContextMenu(e, channel)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 h-9 shrink-0 text-sm transition-colors whitespace-nowrap',
                isActive
                  ? 'text-white'
                  : isVoiceActive
                    ? 'text-[#39FF14]/70 hover:text-[#39FF14]'
                    : 'text-white/40 hover:text-white/70'
              )}
            >
              <Icon
                className={cn(
                  'w-3.5 h-3.5 shrink-0',
                  isActive
                    ? 'text-[#00D9FF]'
                    : isVoiceActive
                      ? 'text-[#39FF14]/70'
                      : 'text-white/30'
                )}
              />
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  value={renaming.name}
                  onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium bg-transparent border-b border-[#00D9FF] outline-none text-white w-24"
                />
              ) : (
                <span className="text-xs font-medium">{channel.name}</span>
              )}

              {/* Voice participant count badge */}
              {isVoiceActive && participants.length > 0 && (
                <span className="text-xs font-medium text-[#39FF14]">
                  ({participants.length})
                </span>
              )}

              {/* Active underline */}
              {isActive && (
                <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-[#00D9FF] rounded-full" />
              )}
            </button>
          );

          if (isVoice) {
            return (
              <div
                key={channel.id}
                className="relative shrink-0"
                onMouseEnter={() => handleVoiceHoverEnter(channel.id)}
                onMouseLeave={handleVoiceHoverLeave}
              >
                {button}
                {hoveredVoiceChannel === channel.id && (
                  <VoiceChannelPreview channelId={channel.id} />
                )}
              </div>
            );
          }

          return (
            <div key={channel.id} className="shrink-0">
              {button}
            </div>
          );
        })}
      </div>

      {/* Right scroll arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="shrink-0 w-6 h-full flex items-center justify-center text-white/40 hover:text-white/70 bg-gradient-to-l from-[#0D1117] to-transparent z-10"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Settings gear with dropdown */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowSettingsMenu(!showSettingsMenu)}
          className={cn(
            'w-9 h-9 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors border-l border-white/5',
            showSettingsMenu && 'text-white/60'
          )}
        >
          <Settings className="w-4 h-4" />
        </button>

        {showSettingsMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowSettingsMenu(false)}
            />
            <div className="absolute top-full right-0 z-50 mt-1 bg-[#1A1F36] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]">
              <button
                onClick={() => {
                  setShowSettingsMenu(false);
                  openModal('invite');
                }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {t('server.invitePeople')}
              </button>
              <button
                onClick={() => {
                  setShowSettingsMenu(false);
                  openModal('createChannel');
                }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('channel.createChannel')}
              </button>
              <div className="h-px bg-white/10 mx-2 my-1" />
              <button
                onClick={() => {
                  setShowSettingsMenu(false);
                  openModal('serverSettings');
                }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                {t('server.serverSettings')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Channel right-click context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
          <div
            className="fixed z-[101] bg-[#1A1F36] border border-white/10 rounded-lg shadow-xl py-1 min-w-[150px]"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
          >
            <button
              onClick={() => {
                setRenaming({ id: ctxMenu.channel.id, name: ctxMenu.channel.name });
                setCtxMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              {t('channel.editChannel')}
            </button>
            <button
              onClick={() => {
                handleDeleteChannel(ctxMenu.channel);
                setCtxMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-sm text-[#FF006E] hover:bg-[#FF006E]/10 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t('channel.deleteChannel')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
