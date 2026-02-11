import { useNavigate } from 'react-router-dom';
import { Hash, Volume2, ChevronDown, Plus, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import Avatar from '@/components/ui/Avatar';

export default function ChannelSidebar() {
  const {
    activeServerId,
    activeChannelId,
    setActiveChannel,
    getActiveServer,
  } = useServerStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const server = getActiveServer();

  const textChannels = server?.channels.filter(
    (c) => c.type === 'text' || c.type === 'TEXT'
  ) || [];
  const voiceChannels = server?.channels.filter(
    (c) => c.type === 'voice' || c.type === 'VOICE'
  ) || [];

  const handleChannelClick = (channelId: string) => {
    setActiveChannel(channelId);
    navigate(`/channels/${activeServerId}/${channelId}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!server) return null;

  return (
    <div className="w-60 bg-rally-darkerBg flex flex-col flex-shrink-0">
      {/* Server header */}
      <button className="h-12 px-4 flex items-center justify-between border-b border-primary hover:bg-rally-cardBg/30 transition-colors">
        <span className="font-semibold text-white truncate">{server.name}</span>
        <ChevronDown size={16} className="text-rally-muted flex-shrink-0" />
      </button>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {/* Text Channels */}
        {textChannels.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1 mb-1 group">
              <span className="text-xs font-semibold text-rally-dimmed uppercase tracking-wide">
                Text Channels
              </span>
              <Plus
                size={14}
                className="text-rally-dimmed opacity-0 group-hover:opacity-100 cursor-pointer hover:text-rally-muted transition-all"
              />
            </div>
            {textChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => handleChannelClick(channel.id)}
                className={cn(
                  'channel-item w-full text-left',
                  activeChannelId === channel.id
                    ? 'active text-white'
                    : 'text-rally-dimmed hover:text-rally-muted'
                )}
              >
                <Hash size={18} className="flex-shrink-0 opacity-60" />
                <span className="truncate text-sm">{channel.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Voice Channels */}
        {voiceChannels.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1 mb-1 group">
              <span className="text-xs font-semibold text-rally-dimmed uppercase tracking-wide">
                Voice Channels
              </span>
              <Plus
                size={14}
                className="text-rally-dimmed opacity-0 group-hover:opacity-100 cursor-pointer hover:text-rally-muted transition-all"
              />
            </div>
            {voiceChannels.map((channel) => (
              <button
                key={channel.id}
                className={cn(
                  'channel-item w-full text-left',
                  'text-rally-dimmed hover:text-rally-muted'
                )}
              >
                <Volume2 size={18} className="flex-shrink-0 opacity-60" />
                <span className="truncate text-sm">{channel.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User panel at bottom */}
      <div className="h-[52px] bg-rally-darkBg/50 flex items-center px-2 gap-2 border-t border-primary">
        <Avatar user={user as any} size="sm" showStatus />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {user?.username}
          </p>
          <p className="text-[10px] text-rally-dimmed">
            #{user?.discriminator}
          </p>
        </div>
        <div className="flex gap-1">
          <button className="p-1.5 rounded hover:bg-rally-cardBg/50 text-rally-muted hover:text-white transition-colors">
            <Settings size={16} />
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded hover:bg-rally-cardBg/50 text-rally-muted hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
