import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useMessageStore } from '../stores/messageStore';
import { useVoiceStore } from '../stores/voiceStore';
import type { Message } from '../lib/types';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function useSocket() {
  const { isAuthenticated } = useAuthStore();
  const { addMessage, updateMessage, deleteMessage, updateReactions } = useMessageStore();
  const { addParticipant, removeParticipant, updateParticipant } = useVoiceStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('message:new', (message: Message) => {
      addMessage(message.channelId, message);
    });

    socket.on('message:updated', (message: Message) => {
      updateMessage(message.channelId, message);
    });

    socket.on('message:deleted', (data: { messageId: string; channelId: string }) => {
      deleteMessage(data.channelId, data.messageId);
    });

    socket.on('message:reaction_updated', (data: { messageId: string; reactions: Record<string, string[]> }) => {
      // We need channelId but it's not in the event; handle at component level
    });

    socket.on('voice:user_joined', (data: any) => {
      addParticipant({
        userId: data.userId,
        username: data.username,
        displayName: data.username,
        isMuted: false,
        isDeafened: false,
        isSpeaking: false,
        isStreaming: false,
      });
    });

    socket.on('voice:user_left', (data: { userId: string }) => {
      removeParticipant(data.userId);
    });

    socket.on('voice:mute_changed', (data: { userId: string; isMuted: boolean }) => {
      updateParticipant(data.userId, { isMuted: data.isMuted });
    });

    socket.on('voice:deafen_changed', (data: { userId: string; isDeafened: boolean }) => {
      updateParticipant(data.userId, { isDeafened: data.isDeafened });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      socket?.disconnect();
      socket = null;
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  const sendMessage = useCallback((channelId: string, content: string, replyToId?: string) => {
    socketRef.current?.emit('message:send', { channelId, content, replyToId });
  }, []);

  const editMessage = useCallback((messageId: string, content: string) => {
    socketRef.current?.emit('message:edit', { messageId, content });
  }, []);

  const deleteMsg = useCallback((messageId: string) => {
    socketRef.current?.emit('message:delete', { messageId });
  }, []);

  const addReaction = useCallback((messageId: string, emoji: string) => {
    socketRef.current?.emit('message:reaction', { messageId, emoji });
  }, []);

  const startTyping = useCallback((channelId: string) => {
    socketRef.current?.emit('typing:start', channelId);
  }, []);

  const stopTyping = useCallback((channelId: string) => {
    socketRef.current?.emit('typing:stop', channelId);
  }, []);

  const joinChannel = useCallback((channelId: string) => {
    socketRef.current?.emit('channel:join', channelId);
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    socketRef.current?.emit('channel:leave', channelId);
  }, []);

  const joinVoice = useCallback((channelId: string) => {
    socketRef.current?.emit('voice:join', channelId);
  }, []);

  const leaveVoice = useCallback((channelId: string) => {
    socketRef.current?.emit('voice:leave', channelId);
  }, []);

  const sendDm = useCallback((conversationId: string, receiverId: string, content: string) => {
    socketRef.current?.emit('dm:send', { conversationId, receiverId, content });
  }, []);

  const updatePresence = useCallback((status: string, customStatus?: string) => {
    socketRef.current?.emit('presence:update', { status, customStatus });
  }, []);

  return {
    socket: socketRef.current,
    sendMessage,
    editMessage,
    deleteMessage: deleteMsg,
    addReaction,
    startTyping,
    stopTyping,
    joinChannel,
    leaveChannel,
    joinVoice,
    leaveVoice,
    sendDm,
    updatePresence,
  };
}
