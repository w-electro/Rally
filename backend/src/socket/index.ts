import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
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

// ==================== Zod Schemas ====================

const uuidSchema = z.string().uuid();
const channelIdSchema = z.object({ channelId: uuidSchema });

const messageSendSchema = z.object({
  channelId: uuidSchema,
  content: z.string().min(1).max(4000),
  replyToId: uuidSchema.optional(),
  attachments: z.array(z.any()).optional(),
});

const messageEditSchema = z.object({
  messageId: uuidSchema,
  content: z.string().min(1).max(4000),
});

const messageIdSchema = z.object({ messageId: uuidSchema });

const reactionSchema = z.object({
  messageId: uuidSchema,
  emoji: z.string().min(1).max(32),
});

const dmSendSchema = z.object({
  conversationId: uuidSchema,
  receiverId: uuidSchema,
  content: z.string().min(1).max(4000),
  isEncrypted: z.boolean().optional(),
  encryptedData: z.string().optional(),
});

const voiceSignalSchema = z.object({
  targetUserId: uuidSchema,
  signal: z.any(),
});

const voiceMuteSchema = z.object({
  channelId: uuidSchema,
  isMuted: z.boolean(),
});

const voiceDeafenSchema = z.object({
  channelId: uuidSchema,
  isDeafened: z.boolean(),
});

const streamStartSchema = z.object({
  channelId: uuidSchema,
  title: z.string().min(1).max(200),
});

const presenceUpdateSchema = z.object({
  status: z.enum(['ONLINE', 'IDLE', 'DND', 'INVISIBLE']),
  customStatus: z.string().max(128).optional(),
  currentGame: z.string().max(128).optional(),
});

const webrtcOfferSchema = z.object({
  targetUserId: uuidSchema,
  offer: z.any(),
});

const webrtcAnswerSchema = z.object({
  targetUserId: uuidSchema,
  answer: z.any(),
});

const webrtcCandidateSchema = z.object({
  targetUserId: uuidSchema,
  candidate: z.any(),
});

// ==================== Authorization Helpers ====================

/** Check that user is a member of the server that owns this channel. */
async function requireChannelMember(userId: string, channelId: string): Promise<boolean> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { serverId: true },
  });
  if (!channel) return false;
  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId, serverId: channel.serverId } },
  });
  return !!member;
}

/** Check that user is a participant in a DM conversation. */
async function requireDmMember(userId: string, conversationId: string): Promise<boolean> {
  const membership = await prisma.dmConversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return !!membership;
}

// ==================== Socket Server ====================

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

    socket.on('channel:join', async (rawChannelId: unknown) => {
      try {
        const channelId = uuidSchema.parse(rawChannelId);
        if (!(await requireChannelMember(userId, channelId))) {
          return socket.emit('error', { message: 'Not a member of this channel\'s server' });
        }
        socket.join(`channel:${channelId}`);
        userChannels.get(socket.id)?.add(channelId);
        socket.to(`channel:${channelId}`).emit('channel:user_joined', { channelId, userId, username });
      } catch (err) {
        socket.emit('error', { message: 'Invalid channel:join data' });
      }
    });

    socket.on('channel:leave', (rawChannelId: unknown) => {
      try {
        const channelId = uuidSchema.parse(rawChannelId);
        socket.leave(`channel:${channelId}`);
        userChannels.get(socket.id)?.delete(channelId);
      } catch (err) {
        socket.emit('error', { message: 'Invalid channel:leave data' });
      }
    });

    // ==================== MESSAGING ====================

    socket.on('message:send', async (rawData: unknown) => {
      try {
        const data = messageSendSchema.parse(rawData);
        if (!(await requireChannelMember(userId, data.channelId))) {
          return socket.emit('error', { message: 'Not authorized to send messages in this channel' });
        }

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
        console.error('message:send error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('message:edit', async (rawData: unknown) => {
      try {
        const data = messageEditSchema.parse(rawData);
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

    socket.on('message:delete', async (rawData: unknown) => {
      try {
        const data = messageIdSchema.parse(rawData);
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

    socket.on('message:reaction', async (rawData: unknown) => {
      try {
        const data = reactionSchema.parse(rawData);
        // Use a transaction to prevent race conditions
        const updated = await prisma.$transaction(async (tx) => {
          const message = await tx.message.findUnique({ where: { id: data.messageId } });
          if (!message) return null;

          const reactions = (message.reactions as Record<string, string[]>) || {};
          if (!reactions[data.emoji]) reactions[data.emoji] = [];

          const idx = reactions[data.emoji].indexOf(userId);
          if (idx >= 0) {
            reactions[data.emoji].splice(idx, 1);
            if (reactions[data.emoji].length === 0) delete reactions[data.emoji];
          } else {
            reactions[data.emoji].push(userId);
          }

          return tx.message.update({
            where: { id: data.messageId },
            data: { reactions },
          });
        });

        if (updated) {
          io.to(`channel:${updated.channelId}`).emit('message:reaction_updated', {
            messageId: data.messageId,
            channelId: updated.channelId,
            reactions: updated.reactions,
          });
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to update reaction' });
      }
    });

    socket.on('message:pin', async (rawData: unknown) => {
      try {
        const data = messageIdSchema.parse(rawData);
        const message = await prisma.message.findUnique({ where: { id: data.messageId } });
        if (!message) return;

        // Authorization: must be member of the channel's server
        if (!(await requireChannelMember(userId, message.channelId))) {
          return socket.emit('error', { message: 'Not authorized to pin messages' });
        }

        const updated = await prisma.message.update({
          where: { id: data.messageId },
          data: { isPinned: !message.isPinned },
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        });

        io.to(`channel:${message.channelId}`).emit('message:updated', updated);
      } catch (err) {
        socket.emit('error', { message: 'Failed to pin message' });
      }
    });

    // ==================== TYPING INDICATORS ====================

    socket.on('typing:start', (rawChannelId: unknown) => {
      try {
        const channelId = uuidSchema.parse(rawChannelId);
        socket.to(`channel:${channelId}`).emit('typing:started', { channelId, userId, username });
      } catch (err) {
        socket.emit('error', { message: 'Invalid typing:start data' });
      }
    });

    socket.on('typing:stop', (rawChannelId: unknown) => {
      try {
        const channelId = uuidSchema.parse(rawChannelId);
        socket.to(`channel:${channelId}`).emit('typing:stopped', { channelId, userId });
      } catch (err) {
        socket.emit('error', { message: 'Invalid typing:stop data' });
      }
    });

    // ==================== DIRECT MESSAGES ====================

    socket.on('dm:send', async (rawData: unknown) => {
      try {
        const data = dmSendSchema.parse(rawData);
        if (!(await requireDmMember(userId, data.conversationId))) {
          return socket.emit('error', { message: 'Not a member of this conversation' });
        }

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

    socket.on('dm:join', async (rawConversationId: unknown) => {
      try {
        const conversationId = uuidSchema.parse(rawConversationId);
        if (!(await requireDmMember(userId, conversationId))) {
          return socket.emit('error', { message: 'Not a member of this conversation' });
        }
        socket.join(`dm:${conversationId}`);
      } catch (err) {
        socket.emit('error', { message: 'Invalid dm:join data' });
      }
    });

    socket.on('dm:leave', (rawConversationId: unknown) => {
      try {
        const conversationId = uuidSchema.parse(rawConversationId);
        socket.leave(`dm:${conversationId}`);
      } catch (err) {
        socket.emit('error', { message: 'Invalid dm:leave data' });
      }
    });

    // ==================== VOICE CHANNELS ====================

    socket.on('voice:join', async (rawChannelId: unknown) => {
      try {
        const channelId = uuidSchema.parse(rawChannelId);
        if (!(await requireChannelMember(userId, channelId))) {
          return socket.emit('error', { message: 'Not authorized to join this voice channel' });
        }

        if (!voiceChannels.has(channelId)) {
          voiceChannels.set(channelId, new Set());
        }

        const existingParticipantIds = Array.from(voiceChannels.get(channelId)!);
        voiceChannels.get(channelId)!.add(userId);
        socket.join(`voice:${channelId}`);

        const existingUsers = existingParticipantIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: existingParticipantIds } },
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            })
          : [];

        socket.emit('voice:participants', {
          channelId,
          participants: existingUsers.map((u) => ({
            userId: u.id,
            username: u.username,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
          })),
        });

        const joiningUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        });
        socket.to(`voice:${channelId}`).emit('voice:user_joined', {
          channelId,
          userId,
          username: joiningUser?.username ?? username,
          displayName: joiningUser?.displayName ?? username,
          avatarUrl: joiningUser?.avatarUrl ?? null,
        });

        await setPresence(userId, 'ONLINE', { voiceChannel: channelId });
      } catch (err) {
        socket.emit('error', { message: 'Failed to join voice channel' });
      }
    });

    socket.on('voice:leave', async (rawChannelId: unknown) => {
      try {
        const channelId = uuidSchema.parse(rawChannelId);
        voiceChannels.get(channelId)?.delete(userId);
        socket.leave(`voice:${channelId}`);

        if (voiceChannels.get(channelId)?.size === 0) {
          voiceChannels.delete(channelId);
        }

        io.to(`voice:${channelId}`).emit('voice:user_left', { channelId, userId });
        await setPresence(userId, 'ONLINE');
      } catch (err) {
        socket.emit('error', { message: 'Failed to leave voice channel' });
      }
    });

    socket.on('voice:signal', (rawData: unknown) => {
      try {
        const data = voiceSignalSchema.parse(rawData);
        io.to(`user:${data.targetUserId}`).emit('voice:signal', {
          fromUserId: userId,
          signal: data.signal,
        });
      } catch (err) {
        socket.emit('error', { message: 'Invalid voice:signal data' });
      }
    });

    socket.on('voice:mute', (rawData: unknown) => {
      try {
        const data = voiceMuteSchema.parse(rawData);
        io.to(`voice:${data.channelId}`).emit('voice:mute_changed', {
          userId,
          isMuted: data.isMuted,
        });
      } catch (err) {
        socket.emit('error', { message: 'Invalid voice:mute data' });
      }
    });

    socket.on('voice:deafen', (rawData: unknown) => {
      try {
        const data = voiceDeafenSchema.parse(rawData);
        io.to(`voice:${data.channelId}`).emit('voice:deafen_changed', {
          userId,
          isDeafened: data.isDeafened,
        });
      } catch (err) {
        socket.emit('error', { message: 'Invalid voice:deafen data' });
      }
    });

    // ==================== WEBRTC SIGNALING ====================

    socket.on('webrtc:offer', (rawData: unknown) => {
      try {
        const data = webrtcOfferSchema.parse(rawData);
        io.to(`user:${data.targetUserId}`).emit('webrtc:offer', {
          fromUserId: userId,
          offer: data.offer,
        });
      } catch (err) {
        socket.emit('error', { message: 'Invalid webrtc:offer data' });
      }
    });

    socket.on('webrtc:answer', (rawData: unknown) => {
      try {
        const data = webrtcAnswerSchema.parse(rawData);
        io.to(`user:${data.targetUserId}`).emit('webrtc:answer', {
          fromUserId: userId,
          answer: data.answer,
        });
      } catch (err) {
        socket.emit('error', { message: 'Invalid webrtc:answer data' });
      }
    });

    socket.on('webrtc:ice_candidate', (rawData: unknown) => {
      try {
        const data = webrtcCandidateSchema.parse(rawData);
        io.to(`user:${data.targetUserId}`).emit('webrtc:ice_candidate', {
          fromUserId: userId,
          candidate: data.candidate,
        });
      } catch (err) {
        socket.emit('error', { message: 'Invalid webrtc:ice_candidate data' });
      }
    });

    // ==================== SCREEN SHARING ====================

    socket.on('screen:start', (rawData: unknown) => {
      try {
        const data = channelIdSchema.parse(rawData);
        socket.to(`voice:${data.channelId}`).emit('screen:start', { userId, username });
      } catch (err) {
        socket.emit('error', { message: 'Invalid screen:start data' });
      }
    });

    socket.on('screen:stop', (rawData: unknown) => {
      try {
        const data = channelIdSchema.parse(rawData);
        socket.to(`voice:${data.channelId}`).emit('screen:stop', { userId });
      } catch (err) {
        socket.emit('error', { message: 'Invalid screen:stop data' });
      }
    });

    // ==================== STREAMING ====================

    socket.on('stream:start', async (rawData: unknown) => {
      try {
        const data = streamStartSchema.parse(rawData);
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
      } catch (err) {
        socket.emit('error', { message: 'Failed to start stream' });
      }
    });

    socket.on('stream:stop', async (rawData: unknown) => {
      try {
        const data = channelIdSchema.parse(rawData);
        io.to(`voice:${data.channelId}`).emit('stream:stopped', { userId });
        await setPresence(userId, 'ONLINE');
        await prisma.user.update({
          where: { id: userId },
          data: { isStreaming: false, status: 'ONLINE' },
        });
      } catch (err) {
        socket.emit('error', { message: 'Failed to stop stream' });
      }
    });

    socket.on('stream:signal', (rawData: unknown) => {
      try {
        const data = voiceSignalSchema.parse(rawData);
        const targetSocketId = findSocketByUserId(data.targetUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('stream:signal', {
            fromUserId: userId,
            signal: data.signal,
          });
        }
      } catch (err) {
        socket.emit('error', { message: 'Invalid stream:signal data' });
      }
    });

    // ==================== PRESENCE ====================

    socket.on('presence:update', async (rawData: unknown) => {
      try {
        const data = presenceUpdateSchema.parse(rawData);
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
      } catch (err) {
        socket.emit('error', { message: 'Invalid presence:update data' });
      }
    });

    socket.on('presence:heartbeat', async () => {
      try {
        await setPresence(userId, 'ONLINE');
      } catch (err) {
        // Heartbeat failures are non-critical
      }
    });

    // Join personal room for DM notifications
    socket.join(`user:${userId}`);

    // ==================== DISCONNECT ====================

    socket.on('disconnect', async () => {
      try {
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
      } catch (err) {
        console.error('disconnect handler error:', err);
      }
    });
  });

  return io;
}

// Helper: find socket ID by user ID (returns most recent connection)
function findSocketByUserId(userId: string): string | undefined {
  let found: string | undefined;
  for (const [socketId, uid] of connectedUsers.entries()) {
    if (uid === userId) found = socketId;
  }
  return found;
}

// Helper: find ALL socket IDs for a user (for multi-connection support)
function findAllSocketsByUserId(userId: string): string[] {
  const sockets: string[] = [];
  for (const [socketId, uid] of connectedUsers.entries()) {
    if (uid === userId) sockets.push(socketId);
  }
  return sockets;
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
