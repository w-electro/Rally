import { Router } from 'express';
import { z } from 'zod';
import { ChannelType, FriendStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler, AppError } from '../utils/errors';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ─── Validation Schemas ─────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .optional(),
  avatar: z.string().optional().nullable(),
  banner: z.string().optional().nullable(),
  about: z.string().max(2000).optional().nullable(),
  status: z.enum(['online', 'idle', 'dnd', 'invisible', 'offline']).optional(),
  customStatus: z.string().max(128).optional().nullable(),
});

const friendActionSchema = z.object({
  status: z.enum(['ACCEPTED', 'BLOCKED']),
});

const createDmSchema = z.object({
  recipientId: z.string().uuid('Invalid recipient ID'),
});

// ─── Fields to exclude from public user responses ───────────────────────────────

const publicUserSelect = {
  id: true,
  username: true,
  discriminator: true,
  avatar: true,
  banner: true,
  about: true,
  status: true,
  customStatus: true,
  isAnonymous: true,
  createdAt: true,
};

const privateUserSelect = {
  ...publicUserSelect,
  email: true,
  updatedAt: true,
};

// ─── GET /@me ───────────────────────────────────────────────────────────────────

router.get(
  '/@me',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: privateUserSelect,
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json(user);
  })
);

// ─── PATCH /@me ─────────────────────────────────────────────────────────────────

router.patch(
  '/@me',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const updates = parsed.data;

    // If updating username, check for uniqueness
    if (updates.username) {
      const existing = await prisma.user.findFirst({
        where: {
          username: updates.username,
          id: { not: userId },
        },
      });
      if (existing) {
        throw new AppError('Username is already taken', 409);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: privateUserSelect,
    });

    res.json(updatedUser);
  })
);

// ─── GET /@me/friends ───────────────────────────────────────────────────────────

router.get(
  '/@me/friends',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    // Get all friend relationships where the current user is involved
    const friends = await prisma.friend.findMany({
      where: {
        OR: [
          { userId },
          { friendId: userId },
        ],
      },
      include: {
        user: { select: publicUserSelect },
        friend: { select: publicUserSelect },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format the response to show the "other" user in each relationship
    const formatted = friends.map((f) => {
      const isInitiator = f.userId === userId;
      const otherUser = isInitiator ? f.friend : f.user;
      return {
        id: f.id,
        status: f.status,
        user: otherUser,
        isInitiator,
        createdAt: f.createdAt,
      };
    });

    res.json(formatted);
  })
);

// ─── GET /@me/dms ───────────────────────────────────────────────────────────────

router.get(
  '/@me/dms',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    // Get all DM and GROUP_DM channels the user is a member of
    const channelMembers = await prisma.channelMember.findMany({
      where: { userId },
      include: {
        channel: {
          include: {
            members: {
              include: {
                user: { select: publicUserSelect },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                content: true,
                createdAt: true,
                authorId: true,
              },
            },
          },
        },
      },
    });

    // Filter to only DM/GROUP_DM channels
    const dmChannels = channelMembers
      .filter(
        (cm) =>
          cm.channel.type === ChannelType.DM ||
          cm.channel.type === ChannelType.GROUP_DM
      )
      .map((cm) => ({
        ...cm.channel,
        members: cm.channel.members.map((m) => m.user),
        lastMessage: cm.channel.messages[0] || null,
        messages: undefined,
      }));

    res.json(dmChannels);
  })
);

// ─── POST /@me/dms ──────────────────────────────────────────────────────────────

router.post(
  '/@me/dms',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const parsed = createDmSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const { recipientId } = parsed.data;

    if (recipientId === userId) {
      throw new AppError('You cannot create a DM with yourself', 400);
    }

    // Check if recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
    });
    if (!recipient) {
      throw new AppError('User not found', 404);
    }

    // Check if a DM channel already exists between these two users
    const existingDm = await prisma.channel.findFirst({
      where: {
        type: ChannelType.DM,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: recipientId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: { select: publicUserSelect },
          },
        },
      },
    });

    if (existingDm) {
      res.json({
        ...existingDm,
        members: existingDm.members.map((m) => m.user),
      });
      return;
    }

    // Create a new DM channel
    const dmChannel = await prisma.channel.create({
      data: {
        name: '', // DM channels don't have a displayed name
        type: ChannelType.DM,
        members: {
          create: [
            { userId },
            { userId: recipientId },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: { select: publicUserSelect },
          },
        },
      },
    });

    res.status(201).json({
      ...dmChannel,
      members: dmChannel.members.map((m) => m.user),
    });
  })
);

// ─── POST /:id/friend ──────────────────────────────────────────────────────────

router.post(
  '/:id/friend',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const targetId = req.params.id;

    if (targetId === userId) {
      throw new AppError('You cannot send a friend request to yourself', 400);
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    // Check if a friend relationship already exists (in either direction)
    const existingFriend = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId, friendId: targetId },
          { userId: targetId, friendId: userId },
        ],
      },
    });

    if (existingFriend) {
      if (existingFriend.status === FriendStatus.BLOCKED) {
        throw new AppError('Unable to send friend request', 400);
      }
      if (existingFriend.status === FriendStatus.ACCEPTED) {
        throw new AppError('You are already friends with this user', 400);
      }
      if (existingFriend.status === FriendStatus.PENDING) {
        // If the other user already sent us a request, auto-accept
        if (existingFriend.userId === targetId && existingFriend.friendId === userId) {
          const accepted = await prisma.friend.update({
            where: { id: existingFriend.id },
            data: { status: FriendStatus.ACCEPTED },
            include: {
              user: { select: publicUserSelect },
              friend: { select: publicUserSelect },
            },
          });
          res.json({
            id: accepted.id,
            status: accepted.status,
            user: accepted.user.id === userId ? accepted.friend : accepted.user,
            message: 'Friend request accepted',
          });
          return;
        }
        throw new AppError('Friend request already sent', 400);
      }
    }

    // Create new friend request
    const friendRequest = await prisma.friend.create({
      data: {
        userId,
        friendId: targetId,
        status: FriendStatus.PENDING,
      },
      include: {
        friend: { select: publicUserSelect },
      },
    });

    res.status(201).json({
      id: friendRequest.id,
      status: friendRequest.status,
      user: friendRequest.friend,
      message: 'Friend request sent',
    });
  })
);

// ─── PATCH /friends/:id ─────────────────────────────────────────────────────────

router.patch(
  '/friends/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const friendRecordId = req.params.id;

    const parsed = friendActionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const { status } = parsed.data;

    // Find the friend record
    const friendRecord = await prisma.friend.findUnique({
      where: { id: friendRecordId },
    });

    if (!friendRecord) {
      throw new AppError('Friend request not found', 404);
    }

    // Only the recipient can accept/block a pending request
    if (status === 'ACCEPTED' && friendRecord.friendId !== userId) {
      throw new AppError('Only the recipient can accept a friend request', 403);
    }

    // Either party can block
    if (
      status === 'BLOCKED' &&
      friendRecord.userId !== userId &&
      friendRecord.friendId !== userId
    ) {
      throw new AppError('You are not part of this friend relationship', 403);
    }

    const updated = await prisma.friend.update({
      where: { id: friendRecordId },
      data: { status: status as FriendStatus },
      include: {
        user: { select: publicUserSelect },
        friend: { select: publicUserSelect },
      },
    });

    const otherUser = updated.userId === userId ? updated.friend : updated.user;

    res.json({
      id: updated.id,
      status: updated.status,
      user: otherUser,
    });
  })
);

// ─── DELETE /friends/:id ────────────────────────────────────────────────────────

router.delete(
  '/friends/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const friendRecordId = req.params.id;

    // Find the friend record
    const friendRecord = await prisma.friend.findUnique({
      where: { id: friendRecordId },
    });

    if (!friendRecord) {
      throw new AppError('Friend request not found', 404);
    }

    // Only participants can remove the friendship
    if (friendRecord.userId !== userId && friendRecord.friendId !== userId) {
      throw new AppError('You are not part of this friend relationship', 403);
    }

    await prisma.friend.delete({
      where: { id: friendRecordId },
    });

    res.json({ message: 'Friend removed successfully' });
  })
);

// ─── GET /:id ───────────────────────────────────────────────────────────────────

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: publicUserSelect,
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json(user);
  })
);

export default router;
