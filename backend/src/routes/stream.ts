import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const startStreamSchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),
  channelId: z.string().uuid('Invalid channel ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer').optional(),
  category: z.string().max(100, 'Category must be 100 characters or fewer').optional(),
});

const updateStreamSchema = z.object({
  title: z.string().min(1).max(200, 'Title must be 200 characters or fewer').optional(),
  category: z.string().max(100, 'Category must be 100 characters or fewer').optional(),
});

const raidSchema = z.object({
  targetChannelId: z.string().uuid('Invalid target channel ID'),
});

// ---------------------------------------------------------------------------
// POST /start - Start a stream session
// ---------------------------------------------------------------------------

router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = startStreamSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { serverId, channelId, title, category } = parsed.data;
    const userId = req.user!.userId;

    // Verify the server exists
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new NotFoundError('Server not found');
    }

    // Verify the channel exists and belongs to the server
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, serverId },
    });
    if (!channel) {
      throw new NotFoundError('Channel not found in this server');
    }

    // Verify the user is a member of the server
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) {
      throw new ForbiddenError('You are not a member of this server');
    }

    // Check if the user already has an active stream
    const existingStream = await prisma.streamSession.findFirst({
      where: { streamerId: userId, isLive: true },
    });
    if (existingStream) {
      throw new BadRequestError('You already have an active stream session');
    }

    // Create the stream session
    const session = await prisma.streamSession.create({
      data: {
        streamerId: userId,
        serverId,
        channelId,
        title: title || null,
        category: category || null,
        isLive: true,
      },
      include: {
        streamer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        server: {
          select: { id: true, name: true, iconUrl: true },
        },
        channel: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    // Update user streaming status
    await prisma.user.update({
      where: { id: userId },
      data: { isStreaming: true, status: 'STREAMING' },
    });

    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:sessionId/end - End a stream session
// ---------------------------------------------------------------------------

router.post('/:sessionId/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    const session = await prisma.streamSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Stream session not found');
    }

    if (session.streamerId !== userId) {
      throw new ForbiddenError('Only the streamer can end this session');
    }

    if (!session.isLive) {
      throw new BadRequestError('Stream session is already ended');
    }

    const updatedSession = await prisma.streamSession.update({
      where: { id: sessionId },
      data: {
        isLive: false,
        endedAt: new Date(),
      },
      include: {
        streamer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        server: {
          select: { id: true, name: true, iconUrl: true },
        },
        channel: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    // Update user streaming status
    await prisma.user.update({
      where: { id: userId },
      data: { isStreaming: false, status: 'ONLINE' },
    });

    res.json({ session: updatedSession });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /live - Get all live streams
// ---------------------------------------------------------------------------

router.get('/live', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const liveStreams = await prisma.streamSession.findMany({
      where: { isLive: true },
      include: {
        streamer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        server: {
          select: { id: true, name: true, iconUrl: true },
        },
        channel: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { viewerCount: 'desc' },
    });

    res.json({ streams: liveStreams });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:sessionId - Get stream session details
// ---------------------------------------------------------------------------

router.get('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.streamSession.findUnique({
      where: { id: sessionId },
      include: {
        streamer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        server: {
          select: { id: true, name: true, iconUrl: true },
        },
        channel: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundError('Stream session not found');
    }

    res.json({ session });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /:sessionId - Update stream metadata
// ---------------------------------------------------------------------------

router.patch('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    const parsed = updateStreamSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { title, category } = parsed.data;

    if (title === undefined && category === undefined) {
      throw new BadRequestError('At least one field (title or category) must be provided');
    }

    const session = await prisma.streamSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Stream session not found');
    }

    if (session.streamerId !== userId) {
      throw new ForbiddenError('Only the streamer can update this session');
    }

    if (!session.isLive) {
      throw new BadRequestError('Cannot update an ended stream session');
    }

    const updateData: Record<string, string> = {};
    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;

    const updatedSession = await prisma.streamSession.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        streamer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        server: {
          select: { id: true, name: true, iconUrl: true },
        },
        channel: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    res.json({ session: updatedSession });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:sessionId/raid - Raid another channel
// ---------------------------------------------------------------------------

router.post('/:sessionId/raid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    const parsed = raidSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { targetChannelId } = parsed.data;

    // Verify the session exists and belongs to the user
    const session = await prisma.streamSession.findUnique({
      where: { id: sessionId },
      include: {
        streamer: {
          select: { id: true, username: true, displayName: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundError('Stream session not found');
    }

    if (session.streamerId !== userId) {
      throw new ForbiddenError('Only the streamer can initiate a raid');
    }

    if (!session.isLive) {
      throw new BadRequestError('Cannot raid from an ended stream session');
    }

    // Verify the target channel exists
    const targetChannel = await prisma.channel.findUnique({
      where: { id: targetChannelId },
      include: {
        server: {
          select: { id: true, name: true, iconUrl: true },
        },
      },
    });

    if (!targetChannel) {
      throw new NotFoundError('Target channel not found');
    }

    // Check if there is an active stream on the target channel
    const targetStream = await prisma.streamSession.findFirst({
      where: { channelId: targetChannelId, isLive: true },
      include: {
        streamer: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    res.json({
      success: true,
      raid: {
        fromSession: sessionId,
        fromStreamer: session.streamer,
        viewerCount: session.viewerCount,
        targetChannel: {
          id: targetChannel.id,
          name: targetChannel.name,
          server: targetChannel.server,
        },
        targetStream: targetStream
          ? {
              sessionId: targetStream.id,
              streamer: targetStream.streamer,
              title: targetStream.title,
              category: targetStream.category,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /server/:serverId/history - Get stream history for a server
// ---------------------------------------------------------------------------

router.get('/server/:serverId/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Verify the server exists
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new NotFoundError('Server not found');
    }

    // Verify the user is a member of the server
    const member = await prisma.serverMember.findUnique({
      where: {
        userId_serverId: { userId: req.user!.userId, serverId },
      },
    });
    if (!member) {
      throw new ForbiddenError('You are not a member of this server');
    }

    const [sessions, total] = await Promise.all([
      prisma.streamSession.findMany({
        where: { serverId },
        include: {
          streamer: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          channel: {
            select: { id: true, name: true, type: true },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.streamSession.count({ where: { serverId } }),
    ]);

    res.json({
      sessions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
