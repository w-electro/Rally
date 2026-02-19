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

const createSessionSchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(128, 'Title must be 128 characters or fewer')
    .trim(),
  game: z
    .string()
    .min(1, 'Game name is required')
    .max(128, 'Game name must be 128 characters or fewer')
    .trim(),
  scheduledAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: 'Scheduled time must be in the future',
  }),
  maxPlayers: z.number().int().min(2).max(1000).optional(),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional(),
});

const updateSessionSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(128, 'Title must be 128 characters or fewer')
    .trim()
    .optional(),
  game: z
    .string()
    .min(1, 'Game name is required')
    .max(128, 'Game name must be 128 characters or fewer')
    .trim()
    .optional(),
  scheduledAt: z.coerce
    .date()
    .refine((d) => d.getTime() > Date.now(), {
      message: 'Scheduled time must be in the future',
    })
    .optional(),
  maxPlayers: z.number().int().min(2).max(1000).nullish(),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or fewer')
    .nullish(),
});

const joinSessionSchema = z.object({
  status: z.enum(['INTERESTED', 'CONFIRMED']),
});

const rallySchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),
  message: z
    .string()
    .min(1, 'Rally message is required')
    .max(500, 'Rally message must be 500 characters or fewer')
    .trim(),
});

// ---------------------------------------------------------------------------
// Helper: verify the current user is a member of the server
// ---------------------------------------------------------------------------

async function requireServerMembership(userId: string, serverId: string) {
  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
  });
  if (!member) {
    throw new ForbiddenError('You are not a member of this server');
  }
  return member;
}

// ---------------------------------------------------------------------------
// POST /sessions — Create a game session
// ---------------------------------------------------------------------------

router.post(
  '/sessions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        throw new BadRequestError(message);
      }

      const userId = req.user!.userId;
      const { serverId, title, game, scheduledAt, maxPlayers, description } =
        parsed.data;

      // Verify the user belongs to the server
      await requireServerMembership(userId, serverId);

      // Verify the server exists
      const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { id: true },
      });
      if (!server) {
        throw new NotFoundError('Server not found');
      }

      const session = await prisma.gameSession.create({
        data: {
          serverId,
          title,
          game,
          scheduledAt,
          maxPlayers: maxPlayers ?? null,
          description: description ?? null,
        },
        include: {
          server: {
            select: { id: true, name: true, iconUrl: true },
          },
        },
      });

      // Automatically add the creator as a CONFIRMED member
      await prisma.gameSessionMember.create({
        data: {
          sessionId: session.id,
          userId,
          status: 'CONFIRMED',
        },
      });

      res.status(201).json({ session });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /server/:serverId/sessions — Get upcoming game sessions for a server
// ---------------------------------------------------------------------------

router.get(
  '/server/:serverId/sessions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { serverId } = req.params;

      // Verify membership
      await requireServerMembership(userId, serverId);

      const sessions = await prisma.gameSession.findMany({
        where: {
          serverId,
          scheduledAt: { gte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: { members: true },
          },
        },
      });

      res.json({ sessions });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /sessions/:sessionId — Get session details with members
// ---------------------------------------------------------------------------

router.get(
  '/sessions/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { sessionId } = req.params;

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          server: {
            select: { id: true, name: true, iconUrl: true },
          },
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

      if (!session) {
        throw new NotFoundError('Game session not found');
      }

      // Verify the user is a member of the server this session belongs to
      await requireServerMembership(userId, session.serverId);

      res.json({ session });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /sessions/:sessionId — Update session
// ---------------------------------------------------------------------------

router.patch(
  '/sessions/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        throw new BadRequestError(message);
      }

      const userId = req.user!.userId;
      const { sessionId } = req.params;
      const data = parsed.data;

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          members: {
            where: { userId, status: 'CONFIRMED' },
          },
        },
      });

      if (!session) {
        throw new NotFoundError('Game session not found');
      }

      // Only the creator (first CONFIRMED member) or a server admin can update
      // We check the creator by looking at the first confirmed member chronologically
      const creatorMember = await prisma.gameSessionMember.findFirst({
        where: { sessionId, status: 'CONFIRMED' },
        orderBy: { id: 'asc' },
      });

      if (!creatorMember || creatorMember.userId !== userId) {
        // Also allow the server owner
        const server = await prisma.server.findUnique({
          where: { id: session.serverId },
          select: { ownerId: true },
        });
        if (!server || server.ownerId !== userId) {
          throw new ForbiddenError(
            'Only the session creator or server owner can update this session',
          );
        }
      }

      const updated = await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.game !== undefined && { game: data.game }),
          ...(data.scheduledAt !== undefined && {
            scheduledAt: data.scheduledAt,
          }),
          ...(data.maxPlayers !== undefined && {
            maxPlayers: data.maxPlayers ?? null,
          }),
          ...(data.description !== undefined && {
            description: data.description ?? null,
          }),
        },
        include: {
          server: {
            select: { id: true, name: true, iconUrl: true },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      res.json({ session: updated });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /sessions/:sessionId — Delete session (creator only)
// ---------------------------------------------------------------------------

router.delete(
  '/sessions/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { sessionId } = req.params;

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new NotFoundError('Game session not found');
      }

      // Only the creator (first CONFIRMED member) can delete
      const creatorMember = await prisma.gameSessionMember.findFirst({
        where: { sessionId, status: 'CONFIRMED' },
        orderBy: { id: 'asc' },
      });

      if (!creatorMember || creatorMember.userId !== userId) {
        // Also allow the server owner
        const server = await prisma.server.findUnique({
          where: { id: session.serverId },
          select: { ownerId: true },
        });
        if (!server || server.ownerId !== userId) {
          throw new ForbiddenError(
            'Only the session creator or server owner can delete this session',
          );
        }
      }

      await prisma.gameSession.delete({
        where: { id: sessionId },
      });

      res.json({ message: 'Game session deleted successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /sessions/:sessionId/join — Join a session
// ---------------------------------------------------------------------------

router.post(
  '/sessions/:sessionId/join',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = joinSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        throw new BadRequestError(message);
      }

      const userId = req.user!.userId;
      const { sessionId } = req.params;
      const { status } = parsed.data;

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          _count: { select: { members: true } },
        },
      });

      if (!session) {
        throw new NotFoundError('Game session not found');
      }

      // Verify the user belongs to the server
      await requireServerMembership(userId, session.serverId);

      // Check max players (only count CONFIRMED members)
      if (session.maxPlayers && status === 'CONFIRMED') {
        const confirmedCount = await prisma.gameSessionMember.count({
          where: { sessionId, status: 'CONFIRMED' },
        });
        if (confirmedCount >= session.maxPlayers) {
          throw new BadRequestError('This session is full');
        }
      }

      // Check if already joined
      const existingMember = await prisma.gameSessionMember.findUnique({
        where: { sessionId_userId: { sessionId, userId } },
      });

      if (existingMember) {
        // Update status if different
        if (existingMember.status === status) {
          throw new ConflictError('You have already joined this session');
        }
        const updated = await prisma.gameSessionMember.update({
          where: { id: existingMember.id },
          data: { status },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        });
        return res.json({ member: updated });
      }

      const member = await prisma.gameSessionMember.create({
        data: { sessionId, userId, status },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      res.status(201).json({ member });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /sessions/:sessionId/leave — Leave a session
// ---------------------------------------------------------------------------

router.post(
  '/sessions/:sessionId/leave',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { sessionId } = req.params;

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        select: { id: true },
      });

      if (!session) {
        throw new NotFoundError('Game session not found');
      }

      const member = await prisma.gameSessionMember.findUnique({
        where: { sessionId_userId: { sessionId, userId } },
      });

      if (!member) {
        throw new NotFoundError('You are not a member of this session');
      }

      await prisma.gameSessionMember.delete({
        where: { id: member.id },
      });

      res.json({ message: 'Left game session successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /rally — Quick rally call (notify all server members)
// ---------------------------------------------------------------------------

router.post(
  '/rally',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = rallySchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        throw new BadRequestError(message);
      }

      const userId = req.user!.userId;
      const { serverId, message: rallyMessage } = parsed.data;

      // Verify membership
      await requireServerMembership(userId, serverId);

      // Get server details and all members (excluding the caller)
      const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { id: true, name: true },
      });

      if (!server) {
        throw new NotFoundError('Server not found');
      }

      const members = await prisma.serverMember.findMany({
        where: {
          serverId,
          NOT: { userId },
        },
        select: { userId: true },
      });

      // Get the caller's display name
      const caller = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, username: true },
      });

      if (members.length > 0) {
        const notifications = members.map((m) => ({
          userId: m.userId,
          type: 'RALLY_CALL' as const,
          title: `Rally in ${server.name}!`,
          body: `${caller?.displayName ?? caller?.username ?? 'Someone'}: ${rallyMessage}`,
          data: {
            serverId,
            callerId: userId,
            message: rallyMessage,
          },
        }));

        await prisma.notification.createMany({ data: notifications });
      }

      res.json({
        success: true,
        notified: members.length,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
