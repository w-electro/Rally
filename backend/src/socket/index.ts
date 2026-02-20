import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthPayload } from '../middleware/auth';
import prisma from '../lib/prisma';
import { redis, setPresence, getPresence } from '../lib/redis';

interface SocketWithAuth extends Socket {
  userId?: string;
  username?: string;
}

// Track connected users: socketId -> userId
const connectedUsers = new Map<string, string>();
// Track which rooms (channels) users are in
const userChannels = new Map<string, Set<string>>();
// Track voice channel participants: channelId -> Set<userId>
const voiceChannels = new Map<string, Set<string>>();

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.nodeEnv === 'production' ? config.corsOrigin : true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use((socket: SocketWithAuth, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, config.jwt.secret) as AuthPayload;
      socket.userId = payload.userId;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: SocketWithAuth) => {
    const userId = socket.userId!;
    const username = socket.username!;

    console.log(`User connected: ${username} (${userId})`);
    connectedUsers.set(socket.id, userId);
    userChannels.set(socket.id, new Set());

    // Set online presence
    await setPresence(userId, 'ONLINE');
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ONLINE' },
    });

    // Join user's server rooms for broadcasts
    const memberships = await prisma.serverMember.findMany({
      where: { userId },
      select: { serverId: true },
    });
    for (const m of memberships) {
      socket.join(`server:${m.serverId}`);
    }

    // Broadcast online status to friends
    broadcastPresence(io, userId, 'ONLINE');

    // ==================== CHANNEL EVENTS ====================

    socket.on('channel:join', async (channelId: string) => {
      socket.join(`channel:${channelId}`);
      userChannels.get(socket.id)?.add(channelId);

      // Send typing indicators, etc.
      socket.to(`channel:${channelId}`).emit('channel:user_joined', {
        channelId,
        userId,
        username,
      });
    });

    socket.on('channel:leave', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
      userChannels.get(socket.id)?.delete(channelId);
    });

    // ==================== MESSAGING ====================

    socket.on('message:send', async (data: {
      channelId: string;
      content: string;
      replyToId?: string;
      attachments?: any[];
    }) => {
      try {
        const message = await prisma.message.create({
          data: {
            channelId: data.channelId,
            authorId: userId,
            content: data.content,
            replyToId: data.replyToId,
            attachments: data.attachments ? JSON.parse(JSON.stringify(data.attachments)) : undefined,
          },
          include: {
            author: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
            replyTo: {
              select: {
                id: true,
                content: true,
                author: { select: { id: true, username: true, displayName: true } },
              },
            },
          },
        });

        io.to(`channel:${data.channelId}`).emit('message:new', message);

        // Check for mentions and create notifications
        const mentionRegex = /@(\w+)/g;
        let match;
        while ((match = mentionRegex.exec(data.content)) !== null) {
          const mentionedUser = await prisma.user.findUnique({
            where: { username: match[1] },
          });
          if (mentionedUser && mentionedUser.id !== userId) {
            await prisma.notification.create({
              data: {
                userId: mentionedUser.id,
                type: 'MENTION',
                title: `${username} mentioned you`,
                body: data.content.substring(0, 100),
                data: { channelId: data.channelId, messageId: message.id },
              },
            });
            io.to(`user:${mentionedUser.id}`).emit('notification:new', {
              type: 'MENTION',
              from: username,
              channelId: data.channelId,
            });
          }
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('message:edit', async (data: { messageId: string; content: string }) => {
      try {
        const message = await prisma.message.findUnique({ where: { id: data.messageId } });
        if (!message || message.authorId !== userId) return;

        const updated = await prisma.message.update({
          where: { id: data.messageId },
          data: { content: data.content, isEdited: true },
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        });

        io.to(`channel:${message.channelId}`).emit('message:updated', updated);
      } catch (err) {
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    socket.on('message:delete', async (data: { messageId: string }) => {
      try {
        const message = await prisma.message.findUnique({ where: { id: data.messageId } });
        if (!message || message.authorId !== userId) return;

        await prisma.message.delete({ where: { id: data.messageId } });

        io.to(`channel:${message.channelId}`).emit('message:deleted', {
          messageId: data.messageId,
          channelId: message.channelId,
        });
      } catch (err) {
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    socket.on('message:reaction', async (data: { messageId: string; emoji: string }) => {
      try {
        const message = await prisma.message.findUnique({ where: { id: data.messageId } });
        if (!message) return;

        const reactions = (message.reactions as Record<string, string[]>) || {};
        if (!reactions[data.emoji]) reactions[data.emoji] = [];

        const idx = reactions[data.emoji].indexOf(userId);
        if (idx >= 0) {
          reactions[data.emoji].splice(idx, 1);
          if (reactions[data.emoji].length === 0) delete reactions[data.emoji];
        } else {
          reactions[data.emoji].push(userId);
        }

        await prisma.message.update({
          where: { id: data.messageId },
          data: { reactions },
        });

        io.to(`channel:${message.channelId}`).emit('message:reaction_updated', {
          messageId: data.messageId,
          reactions,
        });
      } catch (err) {
        socket.emit('error', { message: 'Failed to update reaction' });
      }
    });

    // ==================== TYPING INDICATORS ====================

    socket.on('typing:start', (channelId: string) => {
      socket.to(`channel:${channelId}`).emit('typing:started', { channelId, userId, username });
    });

    socket.on('typing:stop', (channelId: string) => {
      socket.to(`channel:${channelId}`).emit('typing:stopped', { channelId, userId });
    });

    // ==================== DIRECT MESSAGES ====================

    socket.on('dm:send', async (data: {
      conversationId: string;
      receiverId: string;
      content: string;
      isEncrypted?: boolean;
      encryptedData?: string;
    }) => {
      try {
        const dm = await prisma.directMessage.create({
          data: {
            conversationId: data.conversationId,
            senderId: userId,
            receiverId: data.receiverId,
            content: data.content,
            isEncrypted: data.isEncrypted || false,
            encryptedData: data.encryptedData,
          },
          include: {
            sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        });

        io.to(`dm:${data.conversationId}`).emit('dm:new', dm);

        // Send notification to receiver
        await prisma.notification.create({
          data: {
            userId: data.receiverId,
            type: 'MESSAGE',
            title: `New message from ${username}`,
            body: data.isEncrypted ? 'Encrypted message' : data.content.substring(0, 100),
            data: { conversationId: data.conversationId },
          },
        });
        io.to(`user:${data.receiverId}`).emit('notification:new', {
          type: 'DM',
          from: username,
          conversationId: data.conversationId,
        });
      } catch (err) {
        socket.emit('error', { message: 'Failed to send DM' });
      }
    });

    socket.on('dm:join', (conversationId: string) => {
      socket.join(`dm:${conversationId}`);
    });

    socket.on('dm:leave', (conversationId: string) => {
      socket.leave(`dm:${conversationId}`);
    });

    // ==================== VOICE CHANNELS ====================

    socket.on('voice:join', async (channelId: string) => {
      if (!voiceChannels.has(channelId)) {
        voiceChannels.set(channelId, new Set());
      }

      // Get existing participants BEFORE adding new user
      const existingParticipants = Array.from(voiceChannels.get(channelId)!);

      voiceChannels.get(channelId)!.add(userId);
      socket.join(`voice:${channelId}`);

      // Tell the NEW user about all existing participants
      socket.emit('voice:participants', {
        channelId,
        participants: existingParticipants,
      });

      // Tell EXISTING users about the new user
      socket.to(`voice:${channelId}`).emit('voice:user_joined', {
        channelId,
        userId,
        username,
      });

      // Update presence
      await setPresence(userId, 'ONLINE', { voiceChannel: channelId });
    });

    socket.on('voice:leave', async (channelId: string) => {
      voiceChannels.get(channelId)?.delete(userId);
      socket.leave(`voice:${channelId}`);

      if (voiceChannels.get(channelId)?.size === 0) {
        voiceChannels.delete(channelId);
      }

      io.to(`voice:${channelId}`).emit('voice:user_left', { channelId, userId });
      await setPresence(userId, 'ONLINE');
    });

    socket.on('voice:signal', (data: { targetUserId: string; signal: any }) => {
      // Forward WebRTC signaling to target peer
      const targetSocketId = findSocketByUserId(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('voice:signal', {
          fromUserId: userId,
          signal: data.signal,
        });
      }
    });

    socket.on('voice:mute', (data: { channelId: string; isMuted: boolean }) => {
      io.to(`voice:${data.channelId}`).emit('voice:mute_changed', {
        userId,
        isMuted: data.isMuted,
      });
    });

    socket.on('voice:deafen', (data: { channelId: string; isDeafened: boolean }) => {
      io.to(`voice:${data.channelId}`).emit('voice:deafen_changed', {
        userId,
        isDeafened: data.isDeafened,
      });
    });

    // ==================== WEBRTC SIGNALING ====================

    socket.on('webrtc:offer', (data: { targetUserId: string; offer: any }) => {
      const targetSocketId = findSocketByUserId(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:offer', {
          fromUserId: userId,
          offer: data.offer,
        });
      }
    });

    socket.on('webrtc:answer', (data: { targetUserId: string; answer: any }) => {
      const targetSocketId = findSocketByUserId(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:answer', {
          fromUserId: userId,
          answer: data.answer,
        });
      }
    });

    socket.on('webrtc:ice_candidate', (data: { targetUserId: string; candidate: any }) => {
      const targetSocketId = findSocketByUserId(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:ice_candidate', {
          fromUserId: userId,
          candidate: data.candidate,
        });
      }
    });

    // ==================== SCREEN SHARING ====================

    socket.on('screen:start', (data: { channelId: string }) => {
      socket.to(`voice:${data.channelId}`).emit('screen:start', {
        userId,
        username,
      });
    });

    socket.on('screen:stop', (data: { channelId: string }) => {
      socket.to(`voice:${data.channelId}`).emit('screen:stop', {
        userId,
      });
    });

    // ==================== STREAMING ====================

    socket.on('stream:start', async (data: { channelId: string; title: string }) => {
      io.to(`voice:${data.channelId}`).emit('stream:started', {
        userId,
        username,
        channelId: data.channelId,
        title: data.title,
      });

      await setPresence(userId, 'STREAMING', { streamChannel: data.channelId });
      await prisma.user.update({
        where: { id: userId },
        data: { isStreaming: true, status: 'STREAMING' },
      });
    });

    socket.on('stream:stop', async (data: { channelId: string }) => {
      io.to(`voice:${data.channelId}`).emit('stream:stopped', { userId });
      await setPresence(userId, 'ONLINE');
      await prisma.user.update({
        where: { id: userId },
        data: { isStreaming: false, status: 'ONLINE' },
      });
    });

    socket.on('stream:signal', (data: { targetUserId: string; signal: any }) => {
      const targetSocketId = findSocketByUserId(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('stream:signal', {
          fromUserId: userId,
          signal: data.signal,
        });
      }
    });

    // ==================== PRESENCE ====================

    socket.on('presence:update', async (data: { status: string; customStatus?: string; currentGame?: string }) => {
      await setPresence(userId, data.status, {
        customStatus: data.customStatus || '',
        currentGame: data.currentGame || '',
      });
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: data.status as any,
          customStatus: data.customStatus,
          currentGame: data.currentGame,
        },
      });
      broadcastPresence(io, userId, data.status, data.customStatus, data.currentGame);
    });

    socket.on('presence:heartbeat', async () => {
      await setPresence(userId, 'ONLINE');
    });

    // Join personal room for DM notifications
    socket.join(`user:${userId}`);

    // ==================== DISCONNECT ====================

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${username} (${userId})`);
      connectedUsers.delete(socket.id);

      // Leave all voice channels
      for (const [channelId, participants] of voiceChannels.entries()) {
        if (participants.has(userId)) {
          participants.delete(userId);
          io.to(`voice:${channelId}`).emit('voice:user_left', { channelId, userId });
          if (participants.size === 0) voiceChannels.delete(channelId);
        }
      }

      userChannels.delete(socket.id);

      // Check if user has other active connections
      const hasOtherConnections = Array.from(connectedUsers.values()).includes(userId);
      if (!hasOtherConnections) {
        await setPresence(userId, 'OFFLINE');
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'OFFLINE', isStreaming: false },
        });
        broadcastPresence(io, userId, 'OFFLINE');
      }
    });
  });

  return io;
}

// Helper: find socket ID by user ID
function findSocketByUserId(userId: string): string | undefined {
  for (const [socketId, uid] of connectedUsers.entries()) {
    if (uid === userId) return socketId;
  }
  return undefined;
}

// Helper: broadcast presence to friends/server members
async function broadcastPresence(
  io: Server,
  userId: string,
  status: string,
  customStatus?: string,
  currentGame?: string,
) {
  const memberships = await prisma.serverMember.findMany({
    where: { userId },
    select: { serverId: true },
  });

  for (const m of memberships) {
    io.to(`server:${m.serverId}`).emit('presence:updated', {
      userId,
      status,
      customStatus,
      currentGame,
    });
  }
}

export { voiceChannels, connectedUsers };
