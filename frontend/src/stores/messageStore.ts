import { create } from 'zustand';
import type { Message } from '../lib/types';

interface MessageState {
  messages: Record<string, Message[]>; // channelId -> messages
  loadingChannels: Record<string, boolean>;
  hasMore: Record<string, boolean>;

  addMessage: (channelId: string, message: Message) => void;
  setMessages: (channelId: string, messages: Message[]) => void;
  prependMessages: (channelId: string, messages: Message[]) => void;
  updateMessage: (channelId: string, message: Message) => void;
  deleteMessage: (channelId: string, messageId: string) => void;
  updateReactions: (channelId: string, messageId: string, reactions: Record<string, string[]>) => void;
  setLoading: (channelId: string, loading: boolean) => void;
  setHasMore: (channelId: string, hasMore: boolean) => void;
  clearChannel: (channelId: string) => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: {},
  loadingChannels: {},
  hasMore: {},

  addMessage: (channelId, message) =>
    set((s) => {
      const existing = s.messages[channelId] || [];
      // If this is a server-confirmed message, replace any matching optimistic temp message
      if (!message.id.startsWith('temp-')) {
        const tempIdx = existing.findIndex(
          (m) => m.id.startsWith('temp-') && m.authorId === message.authorId && m.content === message.content
        );
        if (tempIdx >= 0) {
          const updated = [...existing];
          updated[tempIdx] = message;
          return { messages: { ...s.messages, [channelId]: updated } };
        }
      }
      // Avoid exact duplicate IDs
      if (existing.some((m) => m.id === message.id)) return s;
      return { messages: { ...s.messages, [channelId]: [...existing, message] } };
    }),

  setMessages: (channelId, messages) =>
    set((s) => ({
      messages: { ...s.messages, [channelId]: messages },
    })),

  prependMessages: (channelId, messages) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: [...messages, ...(s.messages[channelId] || [])],
      },
    })),

  updateMessage: (channelId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] || []).map((m) =>
          m.id === message.id ? message : m
        ),
      },
    })),

  deleteMessage: (channelId, messageId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] || []).filter((m) => m.id !== messageId),
      },
    })),

  updateReactions: (channelId, messageId, reactions) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      },
    })),

  setLoading: (channelId, loading) =>
    set((s) => ({ loadingChannels: { ...s.loadingChannels, [channelId]: loading } })),
  setHasMore: (channelId, hasMore) =>
    set((s) => ({ hasMore: { ...s.hasMore, [channelId]: hasMore } })),
  clearChannel: (channelId) =>
    set((s) => {
      const messages = { ...s.messages };
      delete messages[channelId];
      return { messages };
    }),
}));
