import { useEffect } from 'react';
import {
  Minus,
  Square,
  X,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { TopNav } from './TopNav';
import { Dashboard } from './Dashboard';
import { ChannelSidebar } from './ChannelSidebar';
import { DmSidebar } from './DmSidebar';
import { MemberList } from './MemberList';
import { VoiceBar } from './VoiceBar';
import { ChatArea } from '@/components/chat/ChatArea';
import { DmChatView } from '@/components/chat/DmChatView';
import { FeedView } from '@/components/feed/FeedView';
import { PulseView } from '@/components/pulse/PulseView';
import { VoiceChannel } from '@/components/voice/VoiceChannel';
import { AiAssistant } from '@/components/ai/AiAssistant';
import { PointsPanel } from '@/components/stream/PointsPanel';
import { CreateServerModal } from './CreateServerModal';
import { InviteDialog } from './InviteDialog';
import { JoinServerDialog } from './JoinServerDialog';
import { UserProfilePopup } from './UserProfilePopup';

// electronAPI type is declared in ScreenSharePicker.tsx

export function AppLayout() {
  const view = useUIStore((s) => s.view);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const activeModal = useUIStore((s) => s.activeModal);
  const activeDmConversationId = useUIStore((s) => s.activeDmConversationId);
  const activeServer = useServerStore((s) => s.activeServer);
  const activeChannel = useServerStore((s) => s.activeChannel);
  const voiceChannelId = useVoiceStore((s) => s.channelId);
  const loadServers = useServerStore((s) => s.loadServers);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  const renderMainContent = () => {
    if (view === 'pulse') {
      return <PulseView />;
    }

    if (view === 'dms') {
      if (activeDmConversationId) {
        return <DmChatView conversationId={activeDmConversationId} />;
      }
      return (
        <div className="flex-1 flex items-center justify-center bg-[#0D1117]">
          <div className="text-center">
            <img src="./icon.png" alt="Rally" className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-white/30 text-sm">Select a conversation to start chatting</p>
          </div>
        </div>
      );
    }

    if (view === 'servers' && activeServer && activeChannel) {
      if (activeChannel.type === 'VOICE') {
        return <VoiceChannel />;
      }
      if (activeChannel.type === 'FEED') {
        return <FeedView channelId={activeChannel.id} channelName={activeChannel.name} />;
      }
      if (activeChannel.type === 'ANNOUNCEMENT') {
        return <PulseView />;
      }
      return <ChatArea channel={activeChannel} />;
    }

    return <Dashboard />;
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
        className="h-8 flex items-center justify-between px-3 bg-[#0A0E27] border-b border-white/5 select-none shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <img src="./icon.png" alt="Rally" className="w-4 h-4" />
          <span className="text-xs font-bold text-[#00D9FF] tracking-wider">RALLY</span>
        </div>

        {isElectron && (
          <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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

      {/* Top Nav */}
      <TopNav />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
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
            {rightPanel === 'ai' && <AiAssistant />}
            {rightPanel === 'trending' && (
              <div className="h-full bg-[#0D1117] flex items-center justify-center text-white/30 text-sm">
                Trending Panel coming soon
              </div>
            )}
            {rightPanel === 'points' && <PointsPanel />}
          </div>
        )}
      </div>

      {/* Voice Bar — full-width bottom bar */}
      {voiceChannelId && <VoiceBar />}

      {/* Modals */}
      {activeModal === 'createServer' && <CreateServerModal />}
      {activeModal === 'invite' && <InviteDialog />}
      {activeModal === 'joinServer' && <JoinServerDialog />}
      <UserProfilePopup />
    </div>
  );
}
