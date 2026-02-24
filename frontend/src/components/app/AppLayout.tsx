import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '@/stores/uiStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
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
import { ToastContainer } from '@/components/ui/Toast';
import { QuickSwitcher } from './QuickSwitcher';

// electronAPI type is declared in ScreenSharePicker.tsx

/** Modals extracted so their open/close state doesn't re-render the main layout */
function ModalHost() {
  const activeModal = useUIStore((s) => s.activeModal);
  return (
    <>
      {activeModal === 'createServer' && <CreateServerModal />}
      {activeModal === 'createChannel' && <CreateChannelModal />}
      {activeModal === 'invite' && <InviteDialog />}
      {activeModal === 'joinServer' && <JoinServerDialog />}
      {activeModal === 'serverSettings' && <ServerSettingsModal />}
      {activeModal === 'userSettings' && <UserSettings onClose={() => useUIStore.getState().closeModal()} />}
      {(activeModal as string) === 'quickSwitcher' && <QuickSwitcher />}
    </>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const view = useUIStore((s) => s.view);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const activeDmConversationId = useUIStore((s) => s.activeDmConversationId);
  const activeServer = useServerStore((s) => s.activeServer);
  const activeChannel = useServerStore((s) => s.activeChannel);
  const isServerLoading = useServerStore((s) => s.isLoading);
  const voiceChannelId = useVoiceStore((s) => s.channelId);
  const loadServers = useServerStore((s) => s.loadServers);

  useKeyboardShortcuts();

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const mainContent = useMemo(() => {
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
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-rally-cyan/10 border border-rally-cyan/20">
              <img src="./icon.png" alt="Rally" className="w-10 h-10 opacity-50" />
            </div>
            <p className="text-white/50 text-sm font-body font-medium">{t('chat.selectConversation')}</p>
          </div>
        </div>
      );
    }

    if (view === 'servers' && activeServer) {
      // While loading channels for a server switch, show a minimal loading state
      // instead of flashing the Dashboard
      if (!activeChannel) {
        if (isServerLoading) {
          return (
            <div className="flex-1 flex items-center justify-center bg-[#0D1117]">
              <img src="./icon.png" alt="Rally" className="w-10 h-10 animate-pulse opacity-30" />
            </div>
          );
        }
        return <Dashboard />;
      }
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
  }, [view, activeServer?.id, activeChannel?.id, activeDmConversationId, isServerLoading, t]);

  const showRightPanel = view === 'servers' && activeServer && rightPanel !== 'none';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#000000]">
      {/* Top Nav (includes window controls) */}
      <nav aria-label="Main navigation">
        <TopNav />
      </nav>

      {/* Channel Bar (horizontal, for server views) */}
      {view === 'servers' && activeServer && (
        <nav aria-label="Channel navigation">
          <ChannelBar />
        </nav>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* DM Sidebar (only for DM view) */}
        {view === 'dms' && (
          <aside aria-label="Direct messages" className="w-60 shrink-0 flex flex-col overflow-hidden">
            <DmSidebar />
          </aside>
        )}

        {/* Center: main content */}
        <main className="flex-1 flex overflow-hidden min-w-0">
          {mainContent}
        </main>

        {/* Right Panel (toggleable, animated slide) */}
        <AnimatePresence mode="wait">
          {showRightPanel && (
            <motion.div
              key={rightPanel}
              className="w-60 shrink-0 overflow-hidden"
              initial={{ x: 16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 16, opacity: 0 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            >
              {rightPanel === 'members' && <MemberList />}
              {rightPanel === 'ai' && <AiAssistant />}
              {rightPanel === 'trending' && (
                <div className="h-full bg-[#0D1117] flex items-center justify-center text-white/30 text-sm">
                  {t('settings.trendingComingSoon')}
                </div>
              )}
              {rightPanel === 'points' && <PointsPanel />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Voice Bar — full-width bottom bar */}
      {voiceChannelId && <VoiceBar />}

      {/* Modals (isolated to prevent re-renders of main layout) */}
      <ModalHost />
      <UserProfilePopup />
      <ToastContainer />
    </div>
  );
}
