import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useMessageStore } from '../stores/messageStore';
import { useVoiceStore } from '../stores/voiceStore';
import { VoicePeerManager } from '../lib/voicePeerManager';
import type { Message } from '../lib/types';

let socket: Socket | null = null;
let peerManager: VoicePeerManager | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function getPeerManager(): VoicePeerManager | null {
  return peerManager;
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

    const serverUrl = localStorage.getItem('rally-server-url')
      || import.meta.env.VITE_API_URL
      || window.location.origin;
    socket = io(serverUrl, {
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
      if (peerManager) {
        peerManager.removePeer(data.userId);
      }
      useVoiceStore.getState().removeRemoteStream(data.userId);
      removeParticipant(data.userId);
    });

    socket.on('voice:participants', (data: { participants: string[] }) => {
      if (peerManager) {
        peerManager.connectToParticipants(data.participants);
      }
    });

    socket.on('voice:mute_changed', (data: { userId: string; isMuted: boolean }) => {
      updateParticipant(data.userId, { isMuted: data.isMuted });
    });

    socket.on('voice:deafen_changed', (data: { userId: string; isDeafened: boolean }) => {
      updateParticipant(data.userId, { isDeafened: data.isDeafened });
    });

    socket.on('screen:start', (data: { userId: string; username: string }) => {
      useVoiceStore.getState().setScreenShareUser(data.userId);
    });

    socket.on('screen:stop', (data: { userId: string }) => {
      useVoiceStore.getState().clearRemoteScreenShare();
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      // Clean up voice peer manager on disconnect
      if (peerManager) {
        peerManager.stop();
        peerManager = null;
      }
    });

    return () => {
      if (peerManager) {
        peerManager.stop();
        peerManager = null;
      }
      socket?.disconnect();
      socket = null;
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  // Wire mute/deafen changes to peer manager
  useEffect(() => {
    let prevMuted = useVoiceStore.getState().isMuted;
    let prevDeafened = useVoiceStore.getState().isDeafened;

    const unsubscribe = useVoiceStore.subscribe((state) => {
      if (state.isMuted !== prevMuted && peerManager) {
        peerManager.setMuted(state.isMuted);
      }
      if (state.isDeafened !== prevDeafened && peerManager) {
        peerManager.setDeafened(state.isDeafened);
      }
      prevMuted = state.isMuted;
      prevDeafened = state.isDeafened;
    });
    return unsubscribe;
  }, []);

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

  const joinVoice = useCallback(async (channelId: string) => {
    const voiceState = useVoiceStore.getState();

    // If already in a voice channel, leave it first
    if (voiceState.channelId) {
      if (peerManager) {
        peerManager.stop();
        peerManager = null;
      }
      socketRef.current?.emit('voice:leave', voiceState.channelId);
      voiceState.leaveChannel();
    }

    // Create a new VoicePeerManager with callbacks
    peerManager = new VoicePeerManager({
      onSpeakingChange: (speaking: boolean) => {
        useVoiceStore.getState().setSpeaking(speaking);
      },
      onRemoteStream: (userId: string, stream: MediaStream) => {
        useVoiceStore.getState().setRemoteStream(userId, stream);
      },
      onPeerDisconnect: (userId: string) => {
        useVoiceStore.getState().removeRemoteStream(userId);
      },
      onScreenStream: (userId: string, stream: MediaStream) => {
        useVoiceStore.getState().setRemoteScreenShare(userId, stream);
      },
    });

    // Start microphone capture and VAD
    try {
      await peerManager.start();
    } catch (err) {
      console.error('[useSocket] Failed to start voice peer manager:', err);
      peerManager = null;
      return;
    }

    // Tell the server we're joining voice
    socketRef.current?.emit('voice:join', channelId);

    // Update the store (pass local user ID for mute/deafen sync)
    const currentUser = useAuthStore.getState().user;
    useVoiceStore.getState().joinChannel(channelId, currentUser?.id);

    // Add the local user as a participant so the stage shows them
    if (currentUser) {
      useVoiceStore.getState().addParticipant({
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        avatarUrl: currentUser.avatarUrl,
        isMuted: false,
        isDeafened: false,
        isSpeaking: false,
        isStreaming: false,
      });
    }
  }, []);

  const leaveVoice = useCallback(() => {
    const voiceState = useVoiceStore.getState();

    if (peerManager) {
      peerManager.stop();
      peerManager = null;
    }

    if (voiceState.channelId) {
      socketRef.current?.emit('voice:leave', voiceState.channelId);
    }

    voiceState.leaveChannel();
  }, []);

  const startScreenShare = useCallback(async (sourceId: string, withAudio: boolean) => {
    if (!peerManager) return;
    try {
      const stream = await peerManager.startScreenShare(sourceId, withAudio);
      useVoiceStore.getState().startScreenShare(stream);
      const voiceState = useVoiceStore.getState();
      socketRef.current?.emit('screen:start', { channelId: voiceState.channelId });
    } catch (err) {
      console.error('[useSocket] Failed to start screen share:', err);
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (peerManager) {
      peerManager.stopScreenShare();
    }
    useVoiceStore.getState().stopScreenShare();
    const voiceState = useVoiceStore.getState();
    if (voiceState.channelId) {
      socketRef.current?.emit('screen:stop', { channelId: voiceState.channelId });
    }
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
    startScreenShare,
    stopScreenShare,
    sendDm,
    updatePresence,
  };
}
