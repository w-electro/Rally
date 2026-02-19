import { useEffect } from 'react';
import {
  Minus,
  Square,
  X,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { cn } from '@/lib/utils';
import { ServerList } from './ServerList';
import { ChannelSidebar } from './ChannelSidebar';
import { DmSidebar } from './DmSidebar';
import { MemberList } from './MemberList';
import { VoiceBar } from './VoiceBar';

// Placeholder components for views not yet created
function ChatArea() {
  const activeChannel = useServerStore((s) => s.activeChannel);
  return (
    <div className="flex-1 flex flex-col bg-[#0D1117]">
      <div className="h-12 border-b border-white/10 flex items-center px-4">
        <span className="text-white/60 mr-2">#</span>
        <span className="text-white font-semibold">{activeChannel?.name ?? 'Select a channel'}</span>
        {activeChannel?.topic && (
          <>
            <div className="w-px h-5 bg-white/10 mx-3" />
            <span className="text-white/40 text-sm truncate">{activeChannel.topic}</span>
          </>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
        {activeChannel ? 'Messages will appear here' : 'Select a channel to start chatting'}
      </div>
    </div>
  );
}

function FeedView() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#0D1117] text-white/30 text-sm">
      Feed view coming soon
    </div>
  );
}

function PulseView() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#0D1117] text-white/30 text-sm">
      Pulse view coming soon
    </div>
  );
}

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

export function AppLayout() {
  const view = useUIStore((s) => s.view);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const activeServer = useServerStore((s) => s.activeServer);
  const activeChannel = useServerStore((s) => s.activeChannel);
  const voiceChannelId = useVoiceStore((s) => s.channelId);
  const loadServers = useServerStore((s) => s.loadServers);
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    loadUser();
    loadServers();
  }, [loadUser, loadServers]);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  const renderMainContent = () => {
    if (view === 'pulse') {
      return <PulseView />;
    }

    if (view === 'dms') {
      return <ChatArea />;
    }

    if (view === 'servers' && activeServer && activeChannel) {
      if (activeChannel.type === 'FEED') {
        return <FeedView />;
      }
      return <ChatArea />;
    }

    return (
      <div className="flex-1 flex items-center justify-center bg-[#0D1117]">
        <div className="text-center">
          <img src="/icon.png" alt="Rally" className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-white/30 text-sm">Select a server and channel to get started</p>
        </div>
      </div>
    );
  };

  const renderSidebar = () => {
    if (view === 'dms') {
      return <DmSidebar />;
    }
    if (view === 'servers' && activeServer) {
      return <ChannelSidebar />;
    }
    return null;
  };

  const showRightPanel = view === 'servers' && activeServer && rightPanel !== 'none';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#000000]">
      {/* Custom Titlebar */}
      <div
        className={cn(
          'h-8 flex items-center justify-between px-3 bg-[#0A0E27] border-b border-white/5 select-none shrink-0',
          isElectron && 'app-drag'
        )}
      >
        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="Rally" className="w-4 h-4" />
          <span className="text-xs font-bold text-[#00D9FF] tracking-wider">RALLY</span>
        </div>

        {isElectron && (
          <div className="flex items-center gap-0.5 app-no-drag">
            <button
              onClick={handleMinimize}
              className="w-8 h-7 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
              aria-label="Minimize"
            >
              <Minus className="w-3.5 h-3.5 text-white/60" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-8 h-7 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
              aria-label="Maximize"
            >
              <Square className="w-3 h-3 text-white/60" />
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-7 flex items-center justify-center hover:bg-red-500/80 rounded transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Server List (narrow sidebar) */}
        <div className="w-[72px] shrink-0 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <ServerList />
          </div>
          {/* Voice connection status bar */}
          {voiceChannelId && <VoiceBar />}
        </div>

        {/* Channel / DM Sidebar */}
        {renderSidebar() && (
          <div className="w-60 shrink-0 flex flex-col overflow-hidden">
            {renderSidebar()}
          </div>
        )}

        {/* Center: main content */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          {renderMainContent()}
        </div>

        {/* Right Panel (toggleable) */}
        {showRightPanel && (
          <div className="w-60 shrink-0 overflow-hidden">
            {rightPanel === 'members' && <MemberList />}
            {rightPanel === 'ai' && (
              <div className="h-full bg-[#0D1117] flex items-center justify-center text-white/30 text-sm">
                AI Panel coming soon
              </div>
            )}
            {rightPanel === 'trending' && (
              <div className="h-full bg-[#0D1117] flex items-center justify-center text-white/30 text-sm">
                Trending Panel coming soon
              </div>
            )}
            {rightPanel === 'points' && (
              <div className="h-full bg-[#0D1117] flex items-center justify-center text-white/30 text-sm">
                Points Panel coming soon
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
