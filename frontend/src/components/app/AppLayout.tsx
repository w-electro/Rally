import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { TopNav } from './TopNav';
import { Dashboard } from './Dashboard';
import { ChannelBar } from './ChannelBar';
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
import { CreateChannelModal } from './CreateChannelModal';
import { InviteDialog } from './InviteDialog';
import { JoinServerDialog } from './JoinServerDialog';
import { ServerSettingsModal } from './ServerSettingsModal';
import { UserSettings } from '@/components/settings/UserSettings';
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

  const showRightPanel = view === 'servers' && activeServer && rightPanel !== 'none';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#000000]">
      {/* Top Nav (includes window controls) */}
      <TopNav />

      {/* Channel Bar (horizontal, for server views) */}
      {view === 'servers' && activeServer && <ChannelBar />}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* DM Sidebar (only for DM view) */}
        {view === 'dms' && (
          <div className="w-60 shrink-0 flex flex-col overflow-hidden">
            <DmSidebar />
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
      {activeModal === 'createChannel' && <CreateChannelModal />}
      {activeModal === 'invite' && <InviteDialog />}
      {activeModal === 'joinServer' && <JoinServerDialog />}
      {activeModal === 'serverSettings' && <ServerSettingsModal />}
      {activeModal === 'userSettings' && <UserSettings onClose={() => useUIStore.getState().closeModal()} />}
      <UserProfilePopup />
    </div>
  );
}
