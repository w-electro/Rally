import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronRight,
  Hash,
  Volume2,
  Camera,
  Theater,
  Megaphone,
  Plus,
  Settings,
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  UserPlus,
} from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';
import { cn, getInitials, getStatusColor } from '@/lib/utils';
import type { Channel, Story } from '@/lib/types';

function getChannelIconComponent(type: string) {
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

function StoryBar({ serverId }: { serverId: string }) {
  const [stories, setStories] = useState<Story[]>([]);
  const openModal = useUIStore((s) => s.openModal);

  useEffect(() => {
    api.getStories(serverId)
      .then((data: any) => setStories(Array.isArray(data) ? data : data?.storyGroups ?? data?.stories ?? []))
      .catch(() => {});
  }, [serverId]);

  if (stories.length === 0) return null;

  // Group stories by author
  const authorMap = new Map<string, Story[]>();
  stories.forEach((story) => {
    const existing = authorMap.get(story.authorId) || [];
    existing.push(story);
    authorMap.set(story.authorId, existing);
  });

  const authors = Array.from(authorMap.entries());

  return (
    <div className="px-2 py-2 border-b border-white/5">
      <div className="flex gap-3 overflow-x-auto scrollbar-none py-1">
        {authors.map(([authorId, authorStories]) => {
          const firstStory = authorStories[0];
          return (
            <button
              key={authorId}
              onClick={() => openModal('storyViewer', { stories: authorStories })}
              className="flex flex-col items-center gap-1 shrink-0"
            >
              <div className="w-10 h-10 rounded-full ring-2 ring-[#00D9FF] p-0.5">
                <div className="w-full h-full rounded-full overflow-hidden bg-[#1A1F36]">
                  {firstStory.author.avatarUrl ? (
                    <img
                      src={firstStory.author.avatarUrl}
                      alt={firstStory.author.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-white/70">
                      {getInitials(firstStory.author.displayName)}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-white/50 truncate max-w-[48px]">
                {firstStory.author.displayName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChannelItem({
  channel,
  isActive,
  onClick,
  voiceParticipants,
}: {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
  voiceParticipants?: { displayName: string; avatarUrl?: string }[];
}) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const Icon = getChannelIconComponent(channel.type);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  return (
    <div>
      <button
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-150 group',
          isActive
            ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(0,217,255,0.2)]'
            : 'text-white/40 hover:text-white/70 hover:bg-white/5'
        )}
      >
        <Icon
          className={cn(
            'w-4 h-4 shrink-0 transition-colors',
            isActive ? 'text-[#00D9FF]' : 'text-white/30 group-hover:text-white/50'
          )}
        />
        <span className="truncate flex-1 text-left">{channel.name}</span>
      </button>

      {/* Voice channel participants */}
      {channel.type === 'VOICE' && voiceParticipants && voiceParticipants.length > 0 && (
        <div className="ml-8 mt-0.5 space-y-0.5">
          {voiceParticipants.map((p, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <div className="w-5 h-5 rounded-full bg-[#1A1F36] overflow-hidden shrink-0">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] text-white/50">
                    {getInitials(p.displayName)}
                  </div>
                )}
              </div>
              <span className="text-xs text-white/40 truncate">{p.displayName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#1A1F36] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className="w-full text-left px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white">
            {t('channel.editChannel')}
          </button>
          <button className="w-full text-left px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white">
            {t('channel.muteChannel')}
          </button>
          <button className="w-full text-left px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white">
            {t('channel.notificationSettings')}
          </button>
          <div className="h-px bg-white/10 my-1" />
          <button className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10">
            {t('channel.deleteChannel')}
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryGroup({
  name,
  channels,
  activeChannelId,
  onChannelClick,
}: {
  name: string;
  channels: Channel[];
  activeChannelId: string | null;
  onChannelClick: (channel: Channel) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const openModal = useUIStore((s) => s.openModal);
  const voiceParticipants = useVoiceStore((s) => s.participants);
  const voiceChannelId = useVoiceStore((s) => s.channelId);

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-0.5 px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors group"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span className="flex-1 text-left truncate">{name}</span>
        <Plus
          className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            openModal('createChannel');
          }}
        />
      </button>

      {isExpanded && (
        <div className="space-y-0.5 px-1">
          {channels.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isActive={activeChannelId === channel.id}
              onClick={() => onChannelClick(channel)}
              voiceParticipants={
                channel.type === 'VOICE' && voiceChannelId === channel.id
                  ? voiceParticipants.map((p) => ({
                      displayName: p.displayName,
                      avatarUrl: p.avatarUrl,
                    }))
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ChannelSidebar() {
  const { t } = useTranslation();
  const activeServer = useServerStore((s) => s.activeServer);
  const activeChannel = useServerStore((s) => s.activeChannel);
  const setActiveChannel = useServerStore((s) => s.setActiveChannel);
  const user = useAuthStore((s) => s.user);
  const openModal = useUIStore((s) => s.openModal);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const voiceChannelId = useVoiceStore((s) => s.channelId);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);
  const { joinVoice, leaveVoice } = useSocket();
  const [showServerMenu, setShowServerMenu] = useState(false);

  const handleChannelClick = useCallback((channel: Channel) => {
    setActiveChannel(channel);
  }, [setActiveChannel]);

  if (!activeServer) return null;

  const channels = activeServer.channels || [];

  // Group channels by category
  const categories = channels.filter((c) => c.type === 'CATEGORY');
  const uncategorized = channels.filter(
    (c) => c.type !== 'CATEGORY' && !c.parentId
  );

  // Build category groups
  const categoryGroups = categories.map((cat) => ({
    name: cat.name,
    channels: channels
      .filter((c) => c.parentId === cat.id && c.type !== 'CATEGORY')
      .sort((a, b) => a.position - b.position),
  }));

  return (
    <div className="h-full flex flex-col bg-[#0D1117]">
      {/* Server Name Header */}
      <div className="relative">
        <button
          onClick={() => setShowServerMenu(!showServerMenu)}
          className="w-full h-12 flex items-center justify-between px-4 border-b border-white/5 hover:bg-white/5 transition-colors"
        >
          <span className="text-white font-semibold text-sm truncate">
            {activeServer.name}
          </span>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-white/40 transition-transform',
              showServerMenu && 'rotate-180'
            )}
          />
        </button>

        {/* Server dropdown menu */}
        {showServerMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowServerMenu(false)}
            />
            <div className="absolute top-full left-2 right-2 z-50 mt-1 bg-[#1A1F36] border border-white/10 rounded-lg shadow-xl py-1">
              <button
                onClick={() => {
                  setShowServerMenu(false);
                  openModal('invite');
                }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {t('server.invitePeople')}
              </button>
              <button
                onClick={() => {
                  setShowServerMenu(false);
                  openModal('serverSettings');
                }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                {t('server.serverSettings')}
              </button>
              <button
                onClick={() => {
                  setShowServerMenu(false);
                  openModal('createChannel');
                }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('channel.createChannel')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Story Bar */}
      <StoryBar serverId={activeServer.id} />

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 py-2 px-1">
        {/* Uncategorized channels */}
        {uncategorized.length > 0 && (
          <div className="space-y-0.5 px-1 mb-2">
            {uncategorized
              .sort((a, b) => a.position - b.position)
              .map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={activeChannel?.id === channel.id}
                  onClick={() => handleChannelClick(channel)}
                />
              ))}
          </div>
        )}

        {/* Category groups */}
        {categoryGroups.map((group) => (
          <CategoryGroup
            key={group.name}
            name={group.name}
            channels={group.channels}
            activeChannelId={activeChannel?.id ?? null}
            onChannelClick={handleChannelClick}
          />
        ))}
      </div>

      {/* User Panel (bottom) */}
      <div className="h-[52px] border-t border-white/5 flex items-center px-2 gap-1 bg-[#080B18] shrink-0">
        {/* Avatar with status */}
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1A1F36]">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-white/70">
                {user ? getInitials(user.displayName) : '?'}
              </div>
            )}
          </div>
          <div
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#080B18]"
            style={{ backgroundColor: getStatusColor(user?.status ?? 'OFFLINE') }}
          />
        </div>

        {/* Username and status */}
        <div className="flex-1 min-w-0 ml-1">
          <p className="text-sm text-white font-medium truncate leading-tight">
            {user?.displayName ?? 'User'}
          </p>
          <p className="text-[10px] text-white/30 truncate leading-tight">
            {user?.customStatus || user?.status?.toLowerCase() || 'offline'}
          </p>
        </div>

        {/* Mute / Deafen / Settings buttons */}
        <button
          onClick={toggleMute}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-md transition-colors',
            isMuted
              ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
              : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          )}
          aria-label={isMuted ? t('voice.unmute') : t('voice.mute')}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <button
          onClick={toggleDeafen}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-md transition-colors',
            isDeafened
              ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
              : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          )}
          aria-label={isDeafened ? t('voice.undeafen') : t('voice.deafen')}
        >
          {isDeafened ? (
            <HeadphoneOff className="w-4 h-4" />
          ) : (
            <Headphones className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={() => openModal('invite')}
          className="w-8 h-8 flex items-center justify-center rounded-md text-white/40 hover:text-rally-green hover:bg-rally-green/10 transition-colors"
          aria-label={t('server.invitePeople')}
        >
          <UserPlus className="w-4 h-4" />
        </button>

        <button
          onClick={() => openModal('serverSettings')}
          className="w-8 h-8 flex items-center justify-center rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
