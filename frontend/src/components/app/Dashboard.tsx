import { useState } from 'react';
import { Plus, UserPlus, Users, MessageSquare, Zap, Pin } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { useUIStore } from '@/stores/uiStore';
import { cn, getInitials } from '@/lib/utils';
import { useServerPrefs } from '@/hooks/useServerPrefs';
import { ServerContextMenu } from '@/components/app/ServerContextMenu';
import type { Server } from '@/lib/types';

function ServerCard({
  server,
  isPinned,
  onContextMenu,
}: {
  server: Server;
  isPinned: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { setActiveServer } = useServerStore();
  const { setView } = useUIStore();

  const handleClick = () => {
    setActiveServer(server);
    setView('servers');
  };

  return (
    <button
      onClick={handleClick}
      onContextMenu={onContextMenu}
      className={cn(
        'group relative flex flex-col items-center gap-3 rounded-xl border border-white/5 bg-[#0D1117] p-4',
        'transition-all duration-200 hover:border-rally-cyan/30 hover:shadow-[0_0_20px_rgba(0,217,255,0.08)]',
        'cursor-pointer text-left'
      )}
    >
      {/* Pin Badge */}
      {isPinned && (
        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#00D9FF]/20">
          <Pin className="h-3 w-3 text-[#00D9FF]" />
        </div>
      )}

      {/* Server Icon */}
      {server.iconUrl ? (
        <img
          src={server.iconUrl}
          alt={server.name}
          className="h-14 w-14 rounded-2xl object-cover"
        />
      ) : (
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl',
            'bg-gradient-to-br from-rally-cyan/20 to-rally-purple/20',
            'text-lg font-bold text-rally-cyan font-display',
            'transition-colors duration-200 group-hover:from-rally-cyan/30 group-hover:to-rally-purple/30'
          )}
        >
          {getInitials(server.name)}
        </div>
      )}

      {/* Server Name */}
      <span className="w-full truncate text-center text-sm font-medium text-white/90 font-body">
        {server.name}
      </span>

      {/* Member Count */}
      <div className="flex items-center gap-1 text-xs text-white/40">
        <Users className="h-3 w-3" />
        <span>{server.memberCount ?? 0} members</span>
      </div>
    </button>
  );
}

export function Dashboard() {
  const { user } = useAuthStore();
  const { servers } = useServerStore();
  const { openModal } = useUIStore();
  const { sortServers, togglePin, toggleHide, isPinned } = useServerPrefs();
  const [contextMenu, setContextMenu] = useState<{ serverId: string; x: number; y: number } | null>(null);

  return (
    <div className="flex-1 overflow-y-auto bg-[#080B18] p-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-rally-cyan">
          Welcome back, {user?.displayName ?? 'Rallier'}
        </h1>
        <p className="mt-1 font-body text-sm text-white/50">
          Here's your Rally hub
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={() => openModal('createServer')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2.5',
            'bg-rally-cyan/10 text-rally-cyan border border-rally-cyan/20',
            'transition-all duration-200 hover:bg-rally-cyan/20 hover:shadow-[0_0_16px_rgba(0,217,255,0.12)]',
            'font-body text-sm font-medium'
          )}
        >
          <Plus className="h-4 w-4" />
          Create Server
        </button>

        <button
          onClick={() => openModal('joinServer')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2.5',
            'bg-rally-green/10 text-rally-green border border-rally-green/20',
            'transition-all duration-200 hover:bg-rally-green/20 hover:shadow-[0_0_16px_rgba(57,255,20,0.12)]',
            'font-body text-sm font-medium'
          )}
        >
          <UserPlus className="h-4 w-4" />
          Join Server
        </button>
      </div>

      {/* Server Grid or Empty State */}
      {servers.length > 0 ? (
        <>
          <h2 className="mb-4 font-display text-lg font-semibold text-white/80">
            Your Servers
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {sortServers(servers).map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                isPinned={isPinned(server.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ serverId: server.id, x: e.clientX, y: e.clientY });
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
            <MessageSquare className="h-10 w-10 text-white/20" />
          </div>
          <h3 className="font-display text-xl font-semibold text-white/60">
            No servers yet
          </h3>
          <p className="mt-2 max-w-sm font-body text-sm text-white/30">
            Create your own server or join an existing one to start chatting with your community.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => openModal('createServer')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2.5',
                'bg-rally-cyan/10 text-rally-cyan border border-rally-cyan/20',
                'transition-all duration-200 hover:bg-rally-cyan/20',
                'font-body text-sm font-medium'
              )}
            >
              <Plus className="h-4 w-4" />
              Create Server
            </button>
            <button
              onClick={() => openModal('joinServer')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2.5',
                'bg-rally-green/10 text-rally-green border border-rally-green/20',
                'transition-all duration-200 hover:bg-rally-green/20',
                'font-body text-sm font-medium'
              )}
            >
              <UserPlus className="h-4 w-4" />
              Join Server
            </button>
          </div>
        </div>
      )}

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
