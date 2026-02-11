// ─── Socket.io Server – Real-time Messaging & Presence ──────────────────────────
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../services/token';
import {
  joinVoiceChannel,
  leaveVoiceChannel,
  leaveAllVoiceChannels,
  getVoiceChannelUsers,
  updateVoiceState,
  getUserCurrentChannel,
} from './voiceState';
import { registerSignalingHandlers } from '../webrtc/signaling';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

interface MessageSendPayload {
  channelId: string;
  content: string;
  replyToId?: string;
  attachments?: unknown[];
}

interface MessageEditPayload {
  messageId: string;
  channelId: string;
  content: string;
}

interface MessageDeletePayload {
  messageId: string;
  channelId: string;
}

interface TypingPayload {
  channelId: string;
}

interface VoiceJoinPayload {
  channelId: string;
  muted?: boolean;
  deafened?: boolean;
}

interface VoiceLeavePayload {
  channelId: string;
}

interface VoiceStateUpdatePayload {
  channelId: string;
  muted?: boolean;
  deafened?: boolean;
  video?: boolean;
  screenShare?: boolean;
}

interface PresenceUpdatePayload {
  status: 'online' | 'idle' | 'dnd' | 'invisible';
  customStatus?: string;
}

interface ChannelJoinPayload {
  channelId: string;
}

interface ChannelLeavePayload {
  channelId: string;
}

interface ServerJoinPayload {
  serverId: string;
}

interface FriendRequestPayload {
  targetUserId: string;
}

interface ReactionPayload {
  messageId: string;
  channelId: string;
  emoji: string;
}

// ─── State Maps ─────────────────────────────────────────────────────────────────

/** userId -> socketId */
const onlineUsers = new Map<string, string>();

/** Typing throttle tracker: `${channelId}:${userId}` -> last broadcast timestamp */
const typingThrottles = new Map<string, number>();

const TYPING_THROTTLE_MS = 3000;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function channelRoom(channelId: string): string {
  return `channel:${channelId}`;
}

function serverRoom(serverId: string): string {
  return `server:${serverId}`;
}

/**
 * Get the socket IDs for a list of user IDs (only if they are online).
 */
function getSocketIdsForUsers(userIds: string[]): string[] {
  const socketIds: string[] = [];
  for (const uid of userIds) {
    const sid = onlineUsers.get(uid);
    if (sid) socketIds.push(sid);
  }
  return socketIds;
}

/**
 * Broadcast an event to specific users (by userId), only to those who are online.
 */
function emitToUsers(io: Server, userIds: string[], event: string, data: unknown): void {
  for (const uid of userIds) {
    const sid = onlineUsers.get(uid);
    if (sid) {
      io.to(sid).emit(event, data);
    }
  }
}

/**
 * Get user IDs of friends and server-mates who should see presence updates.
 */
async function getPresenceRecipients(userId: string): Promise<string[]> {
  const recipientSet = new Set<string>();

  // Accepted friends (both directions)
  const friends = await prisma.friend.findMany({
    where: {
      OR: [
        { userId, status: 'ACCEPTED' },
        { friendId: userId, status: 'ACCEPTED' },
      ],
    },
    select: { userId: true, friendId: true },
  });

  for (const f of friends) {
    const friendUserId = f.userId === userId ? f.friendId : f.userId;
    recipientSet.add(friendUserId);
  }

  // Server members
  const memberships = await prisma.serverMember.findMany({
    where: { userId },
    select: { serverId: true },
  });

  if (memberships.length > 0) {
    const serverIds = memberships.map((m) => m.serverId);
    const serverMembers = await prisma.serverMember.findMany({
      where: {
        serverId: { in: serverIds },
        userId: { not: userId },
      },
      select: { userId: true },
    });
    for (const sm of serverMembers) {
      recipientSet.add(sm.userId);
    }
  }

  return Array.from(recipientSet);
}

// ─── Initialization ─────────────────────────────────────────────────────────────

export function initializeSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;

    // ── Authenticate ──────────────────────────────────────────────────────────

    socket.on('authenticate', async (data: { token: string }, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        const token = data?.token || (socket.handshake.auth?.token as string);
        if (!token) {
          callback?.({ success: false, error: 'No token provided' });
          return;
        }

        const decoded = verifyAccessToken(token) as { userId: string; username?: string };
        if (!decoded || !decoded.userId) {
          callback?.({ success: false, error: 'Invalid token' });
          return;
        }

        socket.userId = decoded.userId;
        socket.username = decoded.username;

        // Store in online users map
        onlineUsers.set(decoded.userId, socket.id);

        // Join user to their server rooms and DM channel rooms
        await joinUserRooms(socket);

        // Update user status to online in DB
        await prisma.user.update({
          where: { id: decoded.userId },
          data: { status: 'online' },
        });

        // Broadcast online presence to friends and server members
        const recipients = await getPresenceRecipients(decoded.userId);
        emitToUsers(io, recipients, 'presence:update', {
          userId: decoded.userId,
          status: 'online',
        });

        callback?.({ success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        callback?.({ success: false, error: message });
      }
    });

    // ── Message: Send ─────────────────────────────────────────────────────────

    socket.on('message:send', async (data: MessageSendPayload, callback?: (res: { success: boolean; message?: unknown; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        const { channelId, content, replyToId, attachments } = data;

        if (!channelId || !content || content.trim().length === 0) {
          callback?.({ success: false, error: 'Channel ID and content are required' });
          return;
        }

        // Create message in DB
        const message = await prisma.message.create({
          data: {
            content: content.trim(),
            authorId: socket.userId,
            channelId,
            replyToId: replyToId || null,
            attachments: attachments ? JSON.stringify(attachments) : '[]',
          },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                avatar: true,
                status: true,
              },
            },
            replyTo: {
              select: {
                id: true,
                content: true,
                authorId: true,
                author: {
                  select: {
                    id: true,
                    username: true,
                    discriminator: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        });

        // Broadcast to the channel room
        io.to(channelRoom(channelId)).emit('message:new', {
          ...message,
          channelId,
        });

        callback?.({ success: true, message });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        callback?.({ success: false, error: errorMessage });
      }
    });

    // ── Message: Edit ─────────────────────────────────────────────────────────

    socket.on('message:edit', async (data: MessageEditPayload, callback?: (res: { success: boolean; message?: unknown; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        const { messageId, channelId, content } = data;

        if (!messageId || !channelId || !content || content.trim().length === 0) {
          callback?.({ success: false, error: 'Message ID, channel ID, and content are required' });
          return;
        }

        // Verify the message belongs to the user
        const existing = await prisma.message.findUnique({
          where: { id: messageId },
          select: { authorId: true },
        });

        if (!existing) {
          callback?.({ success: false, error: 'Message not found' });
          return;
        }

        if (existing.authorId !== socket.userId) {
          callback?.({ success: false, error: 'You can only edit your own messages' });
          return;
        }

        const message = await prisma.message.update({
          where: { id: messageId },
          data: {
            content: content.trim(),
            edited: true,
          },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                avatar: true,
                status: true,
              },
            },
          },
        });

        io.to(channelRoom(channelId)).emit('message:updated', {
          ...message,
          channelId,
        });

        callback?.({ success: true, message });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to edit message';
        callback?.({ success: false, error: errorMessage });
      }
    });

    // ── Message: Delete ───────────────────────────────────────────────────────

    socket.on('message:delete', async (data: MessageDeletePayload, callback?: (res: { success: boolean; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        const { messageId, channelId } = data;

        if (!messageId || !channelId) {
          callback?.({ success: false, error: 'Message ID and channel ID are required' });
          return;
        }

        // Verify the message belongs to the user (or user is server owner/admin – simplified here to author check)
        const existing = await prisma.message.findUnique({
          where: { id: messageId },
          select: { authorId: true, channelId: true, channel: { select: { serverId: true } } },
        });

        if (!existing) {
          callback?.({ success: false, error: 'Message not found' });
          return;
        }

        // Allow deletion if user is the author or the server owner
        let canDelete = existing.authorId === socket.userId;

        if (!canDelete && existing.channel.serverId) {
          const server = await prisma.server.findUnique({
            where: { id: existing.channel.serverId },
            select: { ownerId: true },
          });
          canDelete = server?.ownerId === socket.userId;
        }

        if (!canDelete) {
          callback?.({ success: false, error: 'You do not have permission to delete this message' });
          return;
        }

        await prisma.message.delete({
          where: { id: messageId },
        });

        io.to(channelRoom(channelId)).emit('message:deleted', {
          messageId,
          channelId,
        });

        callback?.({ success: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete message';
        callback?.({ success: false, error: errorMessage });
      }
    });

    // ── Typing: Start ─────────────────────────────────────────────────────────

    socket.on('typing:start', (data: TypingPayload) => {
      if (!socket.userId) return;

      const { channelId } = data;
      if (!channelId) return;

      // Throttle typing broadcasts per user per channel
      const throttleKey = `${channelId}:${socket.userId}`;
      const now = Date.now();
      const lastBroadcast = typingThrottles.get(throttleKey);

      if (lastBroadcast && now - lastBroadcast < TYPING_THROTTLE_MS) {
        return;
      }

      typingThrottles.set(throttleKey, now);

      socket.to(channelRoom(channelId)).emit('typing:start', {
        channelId,
        userId: socket.userId,
        username: socket.username,
      });
    });

    // ── Typing: Stop ──────────────────────────────────────────────────────────

    socket.on('typing:stop', (data: TypingPayload) => {
      if (!socket.userId) return;

      const { channelId } = data;
      if (!channelId) return;

      // Clear throttle entry
      typingThrottles.delete(`${channelId}:${socket.userId}`);

      socket.to(channelRoom(channelId)).emit('typing:stop', {
        channelId,
        userId: socket.userId,
      });
    });

    // ── Voice: Join ───────────────────────────────────────────────────────────

    socket.on('voice:join', async (data: VoiceJoinPayload, callback?: (res: { success: boolean; users?: unknown[]; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        const { channelId, muted, deafened } = data;

        if (!channelId) {
          callback?.({ success: false, error: 'Channel ID is required' });
          return;
        }

        // Add user to voice state tracking
        const voiceState = joinVoiceChannel(channelId, socket.userId, {
          muted: muted ?? false,
          deafened: deafened ?? false,
        });

        // Join the socket room for the voice channel
        socket.join(channelRoom(channelId));

        // Get all current users in the voice channel
        const channelUsers = getVoiceChannelUsers(channelId);

        // Notify others in the voice channel
        socket.to(channelRoom(channelId)).emit('voice:userJoined', {
          channelId,
          userId: socket.userId,
          username: socket.username,
          voiceState,
        });

        callback?.({ success: true, users: channelUsers });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to join voice channel';
        callback?.({ success: false, error: errorMessage });
      }
    });

    // ── Voice: Leave ──────────────────────────────────────────────────────────

    socket.on('voice:leave', (data: VoiceLeavePayload, callback?: (res: { success: boolean; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      const { channelId } = data;
      if (!channelId) {
        callback?.({ success: false, error: 'Channel ID is required' });
        return;
      }

      const removed = leaveVoiceChannel(channelId, socket.userId);
      if (!removed) {
        callback?.({ success: false, error: 'Not in that voice channel' });
        return;
      }

      // Notify others in the voice channel
      io.to(channelRoom(channelId)).emit('voice:userLeft', {
        channelId,
        userId: socket.userId,
      });

      // Leave the socket room
      socket.leave(channelRoom(channelId));

      callback?.({ success: true });
    });

    // ── Voice: State Update (mute/deafen/video/screenshare) ───────────────────

    socket.on('voice:stateUpdate', (data: VoiceStateUpdatePayload, callback?: (res: { success: boolean; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      const { channelId, ...updates } = data;
      if (!channelId) {
        callback?.({ success: false, error: 'Channel ID is required' });
        return;
      }

      const updated = updateVoiceState(channelId, socket.userId, updates);
      if (!updated) {
        callback?.({ success: false, error: 'Not in that voice channel' });
        return;
      }

      // Broadcast updated state to the voice channel
      io.to(channelRoom(channelId)).emit('voice:stateUpdated', {
        channelId,
        userId: socket.userId,
        voiceState: updated,
      });

      callback?.({ success: true });
    });

    // ── Presence: Update ──────────────────────────────────────────────────────

    socket.on('presence:update', async (data: PresenceUpdatePayload, callback?: (res: { success: boolean; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        const { status, customStatus } = data;

        const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
        if (!validStatuses.includes(status)) {
          callback?.({ success: false, error: 'Invalid status' });
          return;
        }

        // Update in DB
        await prisma.user.update({
          where: { id: socket.userId },
          data: {
            status,
            customStatus: customStatus !== undefined ? customStatus : undefined,
          },
        });

        // Broadcast to friends and server members
        const recipients = await getPresenceRecipients(socket.userId);

        // For "invisible", broadcast as "offline" to others
        const broadcastStatus = status === 'invisible' ? 'offline' : status;

        emitToUsers(io, recipients, 'presence:update', {
          userId: socket.userId,
          status: broadcastStatus,
          customStatus: customStatus ?? null,
        });

        callback?.({ success: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update presence';
        callback?.({ success: false, error: errorMessage });
      }
    });

    // ── Channel: Join ─────────────────────────────────────────────────────────

    socket.on('channel:join', (data: ChannelJoinPayload, callback?: (res: { success: boolean; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      const { channelId } = data;
      if (!channelId) {
        callback?.({ success: false, error: 'Channel ID is required' });
        return;
      }

      socket.join(channelRoom(channelId));
      callback?.({ success: true });
    });

    // ── Channel: Leave ────────────────────────────────────────────────────────

    socket.on('channel:leave', (data: ChannelLeavePayload, callback?: (res: { success: boolean; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      const { channelId } = data;
      if (!channelId) {
        callback?.({ success: false, error: 'Channel ID is required' });
        return;
      }

      socket.leave(channelRoom(channelId));
      callback?.({ success: true });
    });

    // ── Server: Join ──────────────────────────────────────────────────────────

    socket.on('server:join', async (data: ServerJoinPayload, callback?: (res: { success: boolean; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        const { serverId } = data;
        if (!serverId) {
          callback?.({ success: false, error: 'Server ID is required' });
          return;
        }

        // Join the server-level room
        socket.join(serverRoom(serverId));

        // Join all channel rooms for this server
        const channels = await prisma.channel.findMany({
          where: { serverId },
          select: { id: true },
        });

        for (const channel of channels) {
          socket.join(channelRoom(channel.id));
        }

        callback?.({ success: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to join server rooms';
        callback?.({ success: false, error: errorMessage });
      }
    });

    // ── Friend: Request ───────────────────────────────────────────────────────

    socket.on('friend:request', async (data: FriendRequestPayload, callback?: (res: { success: boolean; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        const { targetUserId } = data;
        if (!targetUserId) {
          callback?.({ success: false, error: 'Target user ID is required' });
          return;
        }

        if (targetUserId === socket.userId) {
          callback?.({ success: false, error: 'Cannot send a friend request to yourself' });
          return;
        }

        // Check if target user exists
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, username: true, discriminator: true },
        });

        if (!targetUser) {
          callback?.({ success: false, error: 'User not found' });
          return;
        }

        // Check for existing friend record
        const existingFriend = await prisma.friend.findFirst({
          where: {
            OR: [
              { userId: socket.userId, friendId: targetUserId },
              { userId: targetUserId, friendId: socket.userId },
            ],
          },
        });

        if (existingFriend) {
          if (existingFriend.status === 'ACCEPTED') {
            callback?.({ success: false, error: 'Already friends' });
            return;
          }
          if (existingFriend.status === 'BLOCKED') {
            callback?.({ success: false, error: 'Unable to send friend request' });
            return;
          }
          if (existingFriend.status === 'PENDING') {
            callback?.({ success: false, error: 'Friend request already pending' });
            return;
          }
        }

        // Create friend request
        await prisma.friend.create({
          data: {
            userId: socket.userId,
            friendId: targetUserId,
            status: 'PENDING',
          },
        });

        // Get sender info for the notification
        const sender = await prisma.user.findUnique({
          where: { id: socket.userId },
          select: { id: true, username: true, discriminator: true, avatar: true },
        });

        // Send real-time notification to target user if online
        emitToUsers(io, [targetUserId], 'friend:requestReceived', {
          from: sender,
        });

        callback?.({ success: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send friend request';
        callback?.({ success: false, error: errorMessage });
      }
    });

    // ── Reaction: Add ─────────────────────────────────────────────────────────

    socket.on('reaction:add', async (data: ReactionPayload, callback?: (res: { success: boolean; reaction?: unknown; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        const { messageId, channelId, emoji } = data;

        if (!messageId || !channelId || !emoji) {
          callback?.({ success: false, error: 'Message ID, channel ID, and emoji are required' });
          return;
        }

        // Verify message exists
        const message = await prisma.message.findUnique({
          where: { id: messageId },
          select: { id: true },
        });

        if (!message) {
          callback?.({ success: false, error: 'Message not found' });
          return;
        }

        // Create reaction (upsert to avoid duplicates)
        const reaction = await prisma.reaction.create({
          data: {
            messageId,
            userId: socket.userId,
            emoji,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                avatar: true,
              },
            },
          },
        });

        io.to(channelRoom(channelId)).emit('reaction:added', {
          messageId,
          channelId,
          reaction,
        });

        callback?.({ success: true, reaction });
      } catch (err: unknown) {
        // Handle unique constraint violation (user already reacted with this emoji)
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
          callback?.({ success: false, error: 'You have already reacted with this emoji' });
          return;
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to add reaction';
        callback?.({ success: false, error: errorMessage });
      }
    });

    // ── Reaction: Remove ──────────────────────────────────────────────────────

    socket.on('reaction:remove', async (data: ReactionPayload, callback?: (res: { success: boolean; error?: string }) => void) => {
      if (!socket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      try {
        const { messageId, channelId, emoji } = data;

        if (!messageId || !channelId || !emoji) {
          callback?.({ success: false, error: 'Message ID, channel ID, and emoji are required' });
          return;
        }

        // Delete the reaction
        await prisma.reaction.deleteMany({
          where: {
            messageId,
            userId: socket.userId,
            emoji,
          },
        });

        io.to(channelRoom(channelId)).emit('reaction:removed', {
          messageId,
          channelId,
          emoji,
          userId: socket.userId,
        });

        callback?.({ success: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to remove reaction';
        callback?.({ success: false, error: errorMessage });
      }
    });

    // ── WebRTC Signaling ──────────────────────────────────────────────────────

    registerSignalingHandlers(socket, io);

    // ── Disconnect ────────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      if (!socket.userId) return;

      const userId = socket.userId;

      // Remove from online users
      onlineUsers.delete(userId);

      // Leave any voice channel
      const voiceResult = leaveAllVoiceChannels(userId);
      if (voiceResult) {
        io.to(channelRoom(voiceResult.channelId)).emit('voice:userLeft', {
          channelId: voiceResult.channelId,
          userId,
        });
      }

      // Update status to offline in DB
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'offline' },
        });

        // Broadcast offline status
        const recipients = await getPresenceRecipients(userId);
        emitToUsers(io, recipients, 'presence:update', {
          userId,
          status: 'offline',
        });
      } catch {
        // User may have been deleted; ignore errors on disconnect cleanup
      }

      // Clean up typing throttle entries for this user
      for (const [key] of typingThrottles) {
        if (key.endsWith(`:${userId}`)) {
          typingThrottles.delete(key);
        }
      }
    });
  });

  return io;
}

/**
 * Join the socket to all server rooms and DM channel rooms the user belongs to.
 */
async function joinUserRooms(socket: AuthenticatedSocket): Promise<void> {
  if (!socket.userId) return;

  // Join server rooms + their channel rooms
  const memberships = await prisma.serverMember.findMany({
    where: { userId: socket.userId },
    select: {
      serverId: true,
      server: {
        select: {
          channels: {
            select: { id: true },
          },
        },
      },
    },
  });

  for (const membership of memberships) {
    socket.join(serverRoom(membership.serverId));
    for (const channel of membership.server.channels) {
      socket.join(channelRoom(channel.id));
    }
  }

  // Join DM / GROUP_DM channel rooms
  const dmMemberships = await prisma.channelMember.findMany({
    where: { userId: socket.userId },
    select: {
      channel: {
        select: {
          id: true,
          type: true,
        },
      },
    },
  });

  for (const dm of dmMemberships) {
    if (dm.channel.type === 'DM' || dm.channel.type === 'GROUP_DM') {
      socket.join(channelRoom(dm.channel.id));
    }
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────────

export { onlineUsers };
export default initializeSocket;
