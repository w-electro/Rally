import { create } from 'zustand';
import type { Message } from '../lib/types';

interface MessageState {
  messages: Record<string, Message[]>; // channelId -> messages
  isLoading: boolean;
  hasMore: Record<string, boolean>;

  addMessage: (channelId: string, message: Message) => void;
  setMessages: (channelId: string, messages: Message[]) => void;
  prependMessages: (channelId: string, messages: Message[]) => void;
  updateMessage: (channelId: string, message: Message) => void;
  deleteMessage: (channelId: string, messageId: string) => void;
  updateReactions: (channelId: string, messageId: string, reactions: Record<string, string[]>) => void;
  setLoading: (loading: boolean) => void;
  setHasMore: (channelId: string, hasMore: boolean) => void;
  clearChannel: (channelId: string) => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: {},
  isLoading: false,
  hasMore: {},

  addMessage: (channelId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: [...(s.messages[channelId] || []), message],
      },
    })),

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

  setLoading: (isLoading) => set({ isLoading }),
  setHasMore: (channelId, hasMore) =>
    set((s) => ({ hasMore: { ...s.hasMore, [channelId]: hasMore } })),
  clearChannel: (channelId) =>
    set((s) => {
      const messages = { ...s.messages };
      delete messages[channelId];
      return { messages };
    }),
}));
