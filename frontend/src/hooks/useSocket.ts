import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';

let globalSocket: Socket | null = null;

export function getSocket(): Socket | null {
  return globalSocket;
}

export function useSocket() {
  const { token, isAuthenticated } = useAuthStore();
  const addMessage = useMessageStore((s) => s.addMessage);
  const updateMessage = useMessageStore((s) => s.updateMessage);
  const deleteMessage = useMessageStore((s) => s.deleteMessage);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (!token || !isAuthenticated) return;
    if (socketRef.current?.connected) return;

    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      socket.emit('authenticate', { token }, (res: { success: boolean; error?: string }) => {
        if (!res.success) {
          console.error('Socket auth failed:', res.error);
        }
      });
    });

    socket.on('message:new', (message) => {
      addMessage(message.channelId, message);
    });

    socket.on('message:updated', (message) => {
      updateMessage(message.channelId, message);
    });

    socket.on('message:deleted', ({ messageId, channelId }) => {
      deleteMessage(channelId, messageId);
    });

    socketRef.current = socket;
    globalSocket = socket;

    return socket;
  }, [token, isAuthenticated, addMessage, updateMessage, deleteMessage]);

  useEffect(() => {
    const socket = connect();
    return () => {
      if (socket) {
        socket.disconnect();
        globalSocket = null;
        socketRef.current = null;
      }
    };
  }, [connect]);

  return socketRef.current;
}
