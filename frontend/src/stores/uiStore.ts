import { create } from 'zustand';

type View = 'servers' | 'dms' | 'pulse' | 'settings';
type RightPanel = 'members' | 'ai' | 'trending' | 'points' | 'none';
type Modal = 'createServer' | 'serverSettings' | 'createChannel' | 'userSettings' | 'userProfile' | 'gameSession' | 'storyViewer' | 'commerce' | 'invite' | 'joinServer' | null;

interface UIState {
  view: View;
  rightPanel: RightPanel;
  activeModal: Modal;
  modalData: any;
  isSidebarCollapsed: boolean;
  showSplash: boolean;
  theme: 'dark';
  activeDmConversationId: string | null;
  unreadCounts: Record<string, number>;
  mentionCounts: Record<string, number>;

  setView: (view: View) => void;
  setRightPanel: (panel: RightPanel) => void;
  openModal: (modal: Modal, data?: any) => void;
  closeModal: () => void;
  toggleSidebar: () => void;
  hideSplash: () => void;
  setActiveDmConversation: (id: string | null) => void;
  incrementUnread: (channelId: string, hasMention?: boolean) => void;
  markRead: (channelId: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  view: 'servers',
  rightPanel: 'members',
  activeModal: null,
  modalData: null,
  isSidebarCollapsed: false,
  showSplash: true,
  theme: 'dark',
  activeDmConversationId: null,
  unreadCounts: {},
  mentionCounts: {},

  setView: (view) => set({ view }),
  setRightPanel: (rightPanel) => set({ rightPanel }),
  openModal: (activeModal, modalData = null) => set({ activeModal, modalData }),
  closeModal: () => set({ activeModal: null, modalData: null }),
  toggleSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
  hideSplash: () => set({ showSplash: false }),
  setActiveDmConversation: (activeDmConversationId) => set({ activeDmConversationId }),
  incrementUnread: (channelId, hasMention) =>
    set((s) => ({
      unreadCounts: { ...s.unreadCounts, [channelId]: (s.unreadCounts[channelId] ?? 0) + 1 },
      mentionCounts: hasMention
        ? { ...s.mentionCounts, [channelId]: (s.mentionCounts[channelId] ?? 0) + 1 }
        : s.mentionCounts,
    })),
  markRead: (channelId) =>
    set((s) => {
      const { [channelId]: _u, ...restUnread } = s.unreadCounts;
      const { [channelId]: _m, ...restMention } = s.mentionCounts;
      return { unreadCounts: restUnread, mentionCounts: restMention };
    }),
}));
