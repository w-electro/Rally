import { useNavigate } from 'react-router-dom';
import { Users, Plus, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import Avatar from '@/components/ui/Avatar';

export default function DmSidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-60 bg-rally-darkerBg flex flex-col flex-shrink-0">
      {/* Search */}
      <div className="h-12 flex items-center px-3 border-b border-primary">
        <button className="w-full bg-rally-darkBg rounded px-2 py-1 text-sm text-rally-dimmed text-left">
          Find or start a conversation
        </button>
      </div>

      {/* DM list */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        {/* Friends link */}
        <button
          onClick={() => navigate('/channels/@me')}
          className={cn(
            'channel-item w-full text-left text-rally-muted hover:text-white mb-2'
          )}
        >
          <Users size={18} className="flex-shrink-0" />
          <span className="text-sm font-medium">Friends</span>
        </button>

        <div className="flex items-center justify-between px-1 mt-4 mb-2 group">
          <span className="text-xs font-semibold text-rally-dimmed uppercase tracking-wide">
            Direct Messages
          </span>
          <Plus
            size={14}
            className="text-rally-dimmed opacity-0 group-hover:opacity-100 cursor-pointer hover:text-rally-muted transition-all"
          />
        </div>

        {/* Placeholder for DM list */}
        <div className="text-center py-4">
          <p className="text-xs text-rally-dimmed">No conversations yet</p>
        </div>
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
