import { create } from 'zustand';

type View = 'servers' | 'dms' | 'pulse' | 'settings';
type RightPanel = 'members' | 'ai' | 'trending' | 'points' | 'none';
type Modal = 'createServer' | 'serverSettings' | 'createChannel' | 'userProfile' | 'gameSession' | 'storyViewer' | 'commerce' | 'invite' | 'joinServer' | null;

interface UIState {
  view: View;
  rightPanel: RightPanel;
  activeModal: Modal;
  modalData: any;
  isSidebarCollapsed: boolean;
  showSplash: boolean;
  theme: 'dark';

  setView: (view: View) => void;
  setRightPanel: (panel: RightPanel) => void;
  openModal: (modal: Modal, data?: any) => void;
  closeModal: () => void;
  toggleSidebar: () => void;
  hideSplash: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  view: 'servers',
  rightPanel: 'members',
  activeModal: null,
  modalData: null,
  isSidebarCollapsed: false,
  showSplash: true,
  theme: 'dark',

  setView: (view) => set({ view }),
  setRightPanel: (rightPanel) => set({ rightPanel }),
  openModal: (activeModal, modalData = null) => set({ activeModal, modalData }),
  closeModal: () => set({ activeModal: null, modalData: null }),
  toggleSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
  hideSplash: () => set({ showSplash: false }),
}));
