import { useState, useRef, useEffect, useCallback } from 'react';
import { Hash, Volume2, Camera, Megaphone, Theater, Settings, ChevronLeft, ChevronRight, UserPlus, Plus } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { useUIStore } from '@/stores/uiStore';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';
import { VoiceChannelPreview } from '@/components/voice/VoiceChannelPreview';
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

          const button = (
            <button
              onClick={() => handleChannelClick(channel)}
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
              <span className="text-xs font-medium">{channel.name}</span>

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
                Invite People
              </button>
              <button
                onClick={() => {
                  setShowSettingsMenu(false);
                  openModal('createChannel');
                }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Channel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
