import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../utils/errors';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(64, 'Display name must be 64 characters or fewer')
    .trim()
    .optional(),
  avatarUrl: z.string().url('Invalid avatar URL').nullish(),
  bannerUrl: z.string().url('Invalid banner URL').nullish(),
  bio: z.string().max(500, 'Bio must be 500 characters or fewer').nullish(),
  customStatus: z
    .string()
    .max(128, 'Custom status must be 128 characters or fewer')
    .nullish(),
  gamingStats: z.record(z.unknown()).nullish(),
  linkedAccounts: z.record(z.string()).nullish(),
});

const updatePrivacySchema = z.object({
  dmPrivacy: z.enum(['EVERYONE', 'FRIENDS', 'NONE']).optional(),
  profilePrivacy: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional(),
});

const createDmSchema = z.object({
  targetUserId: z.string().uuid('Invalid target user ID'),
});

const sendDmSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(4000),
  isEncrypted: z.boolean().optional(),
  encryptedData: z.string().optional(),
  attachments: z
    .array(
      z.object({
        url: z.string().url(),
        name: z.string(),
        size: z.number(),
        type: z.string(),
      }),
    )
    .optional(),
});

const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ---------------------------------------------------------------------------
// GET /profile/:userId — Get user public profile
// ---------------------------------------------------------------------------

router.get(
  '/profile/:userId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bannerUrl: true,
          bio: true,
          status: true,
          customStatus: true,
          currentGame: true,
          isStreaming: true,
          isVerified: true,
          gamingStats: true,
          linkedAccounts: true,
          profilePrivacy: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Respect privacy settings
      const requesterId = req.user!.userId;
      if (user.profilePrivacy === 'PRIVATE' && requesterId !== userId) {
        return res.json({
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            status: user.status,
            isVerified: user.isVerified,
            profilePrivacy: user.profilePrivacy,
          },
        });
      }

      if (user.profilePrivacy === 'FRIENDS' && requesterId !== userId) {
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userAId: requesterId, userBId: userId },
              { userAId: userId, userBId: requesterId },
            ],
          },
        });

        if (!friendship) {
          return res.json({
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              status: user.status,
              isVerified: user.isVerified,
              profilePrivacy: user.profilePrivacy,
            },
          });
        }
      }

      // Return full public profile (never expose passwordHash)
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /profile — Update own profile
// ---------------------------------------------------------------------------

router.patch(
  '/profile',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        throw new BadRequestError(message);
      }

      const data = parsed.data;
      const userId = req.user!.userId;

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.displayName !== undefined && {
            displayName: data.displayName,
          }),
          ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
          ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl }),
          ...(data.bio !== undefined && { bio: data.bio }),
          ...(data.customStatus !== undefined && {
            customStatus: data.customStatus,
          }),
          ...(data.gamingStats !== undefined && {
            gamingStats: data.gamingStats ?? undefined,
          }),
          ...(data.linkedAccounts !== undefined && {
            linkedAccounts: data.linkedAccounts ?? undefined,
          }),
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bannerUrl: true,
          bio: true,
          customStatus: true,
          gamingStats: true,
          linkedAccounts: true,
          updatedAt: true,
        },
      });

      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /privacy — Update privacy settings
// ---------------------------------------------------------------------------

router.patch(
  '/privacy',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updatePrivacySchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        throw new BadRequestError(message);
      }

      const data = parsed.data;
      if (!data.dmPrivacy && !data.profilePrivacy) {
        throw new BadRequestError(
          'At least one privacy setting must be provided',
        );
      }

      const userId = req.user!.userId;

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.dmPrivacy !== undefined && { dmPrivacy: data.dmPrivacy }),
          ...(data.profilePrivacy !== undefined && {
            profilePrivacy: data.profilePrivacy,
          }),
        },
        select: {
          id: true,
          dmPrivacy: true,
          profilePrivacy: true,
          updatedAt: true,
        },
      });

      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /friends/request/:targetId — Send friend request
// ---------------------------------------------------------------------------

router.post(
  '/friends/request/:targetId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.user!.userId;
      const { targetId } = req.params;

      if (requesterId === targetId) {
        throw new BadRequestError('You cannot send a friend request to yourself');
      }

      // Check target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!targetUser) {
        throw new NotFoundError('User not found');
      }

      // Check if already friends
      const existingFriendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userAId: requesterId, userBId: targetId },
            { userAId: targetId, userBId: requesterId },
          ],
        },
      });
      if (existingFriendship) {
        throw new ConflictError('You are already friends with this user');
      }

      // Check if a pending request already exists (in either direction)
      const existingRequest = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { requesterId, targetId, status: 'PENDING' },
            { requesterId: targetId, targetId: requesterId, status: 'PENDING' },
          ],
        },
      });
      if (existingRequest) {
        throw new ConflictError('A pending friend request already exists');
      }

      const friendRequest = await prisma.friendRequest.create({
        data: { requesterId, targetId },
        include: {
          requester: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          target: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Create notification for the target user
      await prisma.notification.create({
        data: {
          userId: targetId,
          type: 'FRIEND_REQUEST',
          title: 'New Friend Request',
          body: `${friendRequest.requester.displayName} sent you a friend request`,
          data: { requestId: friendRequest.id, requesterId },
        },
      });

      res.status(201).json({ friendRequest });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /friends/accept/:requestId — Accept friend request
// ---------------------------------------------------------------------------

router.post(
  '/friends/accept/:requestId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;

      const friendRequest = await prisma.friendRequest.findUnique({
        where: { id: requestId },
      });

      if (!friendRequest) {
        throw new NotFoundError('Friend request not found');
      }

      if (friendRequest.targetId !== userId) {
        throw new ForbiddenError('You can only accept requests sent to you');
      }

      if (friendRequest.status !== 'PENDING') {
        throw new BadRequestError('This request has already been processed');
      }

      // Use a transaction: update request + create friendship
      const [updatedRequest, friendship] = await prisma.$transaction([
        prisma.friendRequest.update({
          where: { id: requestId },
          data: { status: 'ACCEPTED' },
        }),
        prisma.friendship.create({
          data: {
            userAId: friendRequest.requesterId,
            userBId: friendRequest.targetId,
          },
        }),
      ]);

      // Notify the requester
      await prisma.notification.create({
        data: {
          userId: friendRequest.requesterId,
          type: 'FRIEND_REQUEST',
          title: 'Friend Request Accepted',
          body: 'Your friend request has been accepted',
          data: { friendshipId: friendship.id, userId },
        },
      });

      res.json({ friendship });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /friends/decline/:requestId — Decline friend request
// ---------------------------------------------------------------------------

router.post(
  '/friends/decline/:requestId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;

      const friendRequest = await prisma.friendRequest.findUnique({
        where: { id: requestId },
      });

      if (!friendRequest) {
        throw new NotFoundError('Friend request not found');
      }

      if (friendRequest.targetId !== userId) {
        throw new ForbiddenError('You can only decline requests sent to you');
      }

      if (friendRequest.status !== 'PENDING') {
        throw new BadRequestError('This request has already been processed');
      }

      await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'DECLINED' },
      });

      res.json({ message: 'Friend request declined' });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /friends — Get friend list (with user info)
// ---------------------------------------------------------------------------

router.get(
  '/friends',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        include: {
          userA: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              status: true,
              customStatus: true,
              currentGame: true,
              isStreaming: true,
            },
          },
          userB: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              status: true,
              customStatus: true,
              currentGame: true,
              isStreaming: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Map to return the friend (the other user), not the current user
      const friends = friendships.map((f) => ({
        friendshipId: f.id,
        createdAt: f.createdAt,
        user: f.userAId === userId ? f.userB : f.userA,
      }));

      res.json({ friends });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /friends/requests — Get pending friend requests (sent and received)
// ---------------------------------------------------------------------------

router.get(
  '/friends/requests',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      const [received, sent] = await Promise.all([
        prisma.friendRequest.findMany({
          where: { targetId: userId, status: 'PENDING' },
          include: {
            requester: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.friendRequest.findMany({
          where: { requesterId: userId, status: 'PENDING' },
          include: {
            target: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      res.json({ received, sent });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /friends/:friendshipId — Remove friend
// ---------------------------------------------------------------------------

router.delete(
  '/friends/:friendshipId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { friendshipId } = req.params;

      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });

      if (!friendship) {
        throw new NotFoundError('Friendship not found');
      }

      if (friendship.userAId !== userId && friendship.userBId !== userId) {
        throw new ForbiddenError('You are not part of this friendship');
      }

      await prisma.friendship.delete({
        where: { id: friendshipId },
      });

      res.json({ message: 'Friend removed successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /dms — Get DM conversations list (with last message and member info)
// ---------------------------------------------------------------------------

router.get(
  '/dms',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      const memberships = await prisma.dmConversationMember.findMany({
        where: { userId },
        include: {
          conversation: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      avatarUrl: true,
                      status: true,
                    },
                  },
                },
              },
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                  id: true,
                  content: true,
                  senderId: true,
                  isEncrypted: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      const conversations = memberships
        .map((m) => ({
          id: m.conversation.id,
          isGroup: m.conversation.isGroup,
          name: m.conversation.name,
          createdAt: m.conversation.createdAt,
          members: m.conversation.members.map((cm) => cm.user),
          lastMessage: m.conversation.messages[0] ?? null,
        }))
        .sort((a, b) => {
          const aTime = a.lastMessage?.createdAt ?? a.createdAt;
          const bTime = b.lastMessage?.createdAt ?? b.createdAt;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

      res.json({ conversations });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /dms — Create or get DM conversation (targetUserId)
// ---------------------------------------------------------------------------

router.post(
  '/dms',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createDmSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        throw new BadRequestError(message);
      }

      const userId = req.user!.userId;
      const { targetUserId } = parsed.data;

      if (userId === targetUserId) {
        throw new BadRequestError('You cannot create a DM with yourself');
      }

      // Check target exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, dmPrivacy: true },
      });
      if (!targetUser) {
        throw new NotFoundError('User not found');
      }

      // Respect DM privacy settings
      if (targetUser.dmPrivacy === 'NONE') {
        throw new ForbiddenError('This user has disabled direct messages');
      }
      if (targetUser.dmPrivacy === 'FRIENDS') {
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userAId: userId, userBId: targetUserId },
              { userAId: targetUserId, userBId: userId },
            ],
          },
        });
        if (!friendship) {
          throw new ForbiddenError(
            'This user only accepts DMs from friends',
          );
        }
      }

      // Look for an existing 1-on-1 conversation between the two users
      const existingConversation = await prisma.dmConversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: targetUserId } } },
          ],
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (existingConversation) {
        return res.json({
          conversation: {
            id: existingConversation.id,
            isGroup: existingConversation.isGroup,
            name: existingConversation.name,
            createdAt: existingConversation.createdAt,
            members: existingConversation.members.map((m) => m.user),
          },
        });
      }

      // Create a new conversation
      const conversation = await prisma.dmConversation.create({
        data: {
          isGroup: false,
          members: {
            create: [{ userId }, { userId: targetUserId }],
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      res.status(201).json({
        conversation: {
          id: conversation.id,
          isGroup: conversation.isGroup,
          name: conversation.name,
          createdAt: conversation.createdAt,
          members: conversation.members.map((m) => m.user),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /dms/:conversationId/messages — Get DM messages (paginated)
// ---------------------------------------------------------------------------

router.get(
  '/dms/:conversationId/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;

      const parsed = paginationSchema.safeParse(req.query);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        throw new BadRequestError(message);
      }
      const { cursor, limit } = parsed.data;

      // Verify the user is a member of this conversation
      const membership = await prisma.dmConversationMember.findUnique({
        where: {
          conversationId_userId: { conversationId, userId },
        },
      });
      if (!membership) {
        throw new ForbiddenError('You are not a member of this conversation');
      }

      const messages = await prisma.directMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // fetch one extra to determine if there are more
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      const hasMore = messages.length > limit;
      const results = hasMore ? messages.slice(0, limit) : messages;
      const nextCursor = hasMore ? results[results.length - 1].id : null;

      res.json({ messages: results, nextCursor });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /dms/:conversationId/messages — Send DM
// ---------------------------------------------------------------------------

router.post(
  '/dms/:conversationId/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;

      const parsed = sendDmSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        throw new BadRequestError(message);
      }
      const { content, isEncrypted, encryptedData, attachments } = parsed.data;

      // Verify the user is a member of this conversation
      const membership = await prisma.dmConversationMember.findUnique({
        where: {
          conversationId_userId: { conversationId, userId },
        },
      });
      if (!membership) {
        throw new ForbiddenError('You are not a member of this conversation');
      }

      // Determine receiver(s) — for 1-on-1 DMs, the other member
      const otherMembers = await prisma.dmConversationMember.findMany({
        where: { conversationId, NOT: { userId } },
        select: { userId: true },
      });

      if (otherMembers.length === 0) {
        throw new BadRequestError('No other members in conversation');
      }

      // For 1-on-1 conversations, set receiverId to the other user
      const receiverId = otherMembers[0].userId;

      const directMessage = await prisma.directMessage.create({
        data: {
          conversationId,
          senderId: userId,
          receiverId,
          content,
          isEncrypted: isEncrypted ?? false,
          encryptedData: encryptedData ?? null,
          attachments: attachments ?? undefined,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Create notifications for all other members in the conversation
      const notifications = otherMembers.map((m) => ({
        userId: m.userId,
        type: 'MESSAGE' as const,
        title: 'New Direct Message',
        body: isEncrypted
          ? 'Sent an encrypted message'
          : content.length > 100
            ? content.slice(0, 100) + '...'
            : content,
        data: {
          conversationId,
          messageId: directMessage.id,
          senderId: userId,
        },
      }));

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }

      res.status(201).json({ message: directMessage });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /notifications — Get notifications (paginated, unread first)
// ---------------------------------------------------------------------------

router.get(
  '/notifications',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      const parsed = paginationSchema.safeParse(req.query);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        throw new BadRequestError(message);
      }
      const { cursor, limit } = parsed.data;

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      const hasMore = notifications.length > limit;
      const results = hasMore ? notifications.slice(0, limit) : notifications;
      const nextCursor = hasMore ? results[results.length - 1].id : null;

      // Also return unread count for convenience
      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });

      res.json({ notifications: results, unreadCount, nextCursor });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /notifications/:id/read — Mark notification as read
// ---------------------------------------------------------------------------

router.patch(
  '/notifications/:id/read',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        throw new NotFoundError('Notification not found');
      }

      if (notification.userId !== userId) {
        throw new ForbiddenError('You can only update your own notifications');
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      res.json({ notification: updated });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /notifications/read-all — Mark all notifications as read
// ---------------------------------------------------------------------------

router.post(
  '/notifications/read-all',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      const result = await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      res.json({ updated: result.count });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
