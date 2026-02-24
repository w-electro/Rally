import { useEffect, useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useVoiceStore } from '@/stores/voiceStore';

/**
 * Global keyboard shortcuts.
 *
 * Ctrl+K       — Open quick switcher
 * Alt+Up/Down  — Navigate channels
 * Ctrl+Shift+M — Toggle voice mute
 * Escape       — Close modal / focus chat input
 * Ctrl+/       — Show shortcuts help (TODO overlay)
 */
export function useKeyboardShortcuts() {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept when typing in inputs/textareas (except Escape)
    const tag = (e.target as HTMLElement)?.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

    // Ctrl+K / Cmd+K — Quick Switcher
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const { activeModal, openModal, closeModal } = useUIStore.getState();
      if (activeModal === 'quickSwitcher' as any) {
        closeModal();
      } else {
        openModal('quickSwitcher' as any);
      }
      return;
    }

    // Ctrl+Shift+M — Toggle mute
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      const { channelId, toggleMute } = useVoiceStore.getState();
      if (channelId) toggleMute();
      return;
    }

    // Escape — Close modal or focus chat input
    if (e.key === 'Escape') {
      const { activeModal, closeModal } = useUIStore.getState();
      if (activeModal) {
        closeModal();
        return;
      }
      // Focus the chat input if exists
      const chatInput = document.querySelector<HTMLTextAreaElement>('[data-chat-input]');
      if (chatInput) {
        chatInput.focus();
      }
      return;
    }

    // The rest only fire when NOT in an input
    if (isInput) return;

    // Alt+Up / Alt+Down — Navigate channels
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const { activeServer, activeChannel, setActiveChannel } = useServerStore.getState();
      if (!activeServer?.channels?.length) return;

      const channels = activeServer.channels;
      const currentIdx = channels.findIndex((c) => c.id === activeChannel?.id);
      let nextIdx: number;

      if (e.key === 'ArrowUp') {
        nextIdx = currentIdx <= 0 ? channels.length - 1 : currentIdx - 1;
      } else {
        nextIdx = currentIdx >= channels.length - 1 ? 0 : currentIdx + 1;
      }

      setActiveChannel(channels[nextIdx]);
      return;
    }

    // Ctrl+/ — Shortcuts help (future overlay)
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      // TODO: open shortcuts overlay
      return;
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
