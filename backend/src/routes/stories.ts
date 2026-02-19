import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

const router = Router();

// Protect all routes
router.use(authenticate);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createStorySchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'TEXT']),
  caption: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// GET /server/:serverId  -  Active (non-expired) stories for a server
// ---------------------------------------------------------------------------

router.get(
  '/server/:serverId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serverId } = req.params;

      const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { id: true },
      });

      if (!server) {
        throw new NotFoundError('Server not found');
      }

      // Verify the user is a member
      const member = await prisma.serverMember.findUnique({
        where: {
          userId_serverId: {
            userId: req.user!.userId,
            serverId,
          },
        },
      });

      if (!member) {
        throw new ForbiddenError('You must be a server member to view stories');
      }

      const now = new Date();

      const stories = await prisma.story.findMany({
        where: {
          serverId,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          views: {
            where: { userId: req.user!.userId },
            select: { id: true },
          },
        },
      });

      // Group stories by author for a client-friendly structure
      const authorMap = new Map<
        string,
        {
          author: (typeof stories)[number]['author'];
          stories: Array<{
            id: string;
            mediaUrl: string;
            mediaType: string;
            caption: string | null;
            viewCount: number;
            viewedByMe: boolean;
            createdAt: Date;
            expiresAt: Date;
          }>;
        }
      >();

      for (const story of stories) {
        const entry = authorMap.get(story.authorId) ?? {
          author: story.author,
          stories: [],
        };

        entry.stories.push({
          id: story.id,
          mediaUrl: story.mediaUrl,
          mediaType: story.mediaType,
          caption: story.caption,
          viewCount: story.viewCount,
          viewedByMe: story.views.length > 0,
          createdAt: story.createdAt,
          expiresAt: story.expiresAt,
        });

        authorMap.set(story.authorId, entry);
      }

      res.json({ storyGroups: Array.from(authorMap.values()) });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /server/:serverId  -  Create a story (expires in 24h)
// ---------------------------------------------------------------------------

router.post(
  '/server/:serverId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serverId } = req.params;
      const data = createStorySchema.parse(req.body);

      const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { id: true },
      });

      if (!server) {
        throw new NotFoundError('Server not found');
      }

      // Verify the user is a member
      const member = await prisma.serverMember.findUnique({
        where: {
          userId_serverId: {
            userId: req.user!.userId,
            serverId,
          },
        },
      });

      if (!member) {
        throw new ForbiddenError('You must be a server member to create stories');
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const story = await prisma.story.create({
        data: {
          serverId,
          authorId: req.user!.userId,
          mediaUrl: data.mediaUrl,
          mediaType: data.mediaType,
          caption: data.caption ?? null,
          expiresAt,
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      res.status(201).json({ story });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:storyId/view  -  Mark story as viewed
// ---------------------------------------------------------------------------

router.post(
  '/:storyId/view',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { storyId } = req.params;
      const userId = req.user!.userId;

      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: { id: true, expiresAt: true },
      });

      if (!story) {
        throw new NotFoundError('Story not found');
      }

      if (story.expiresAt <= new Date()) {
        throw new BadRequestError('Story has expired');
      }

      // Upsert to avoid duplicate view errors - only count if new
      const existingView = await prisma.storyView.findUnique({
        where: { storyId_userId: { storyId, userId } },
      });

      if (!existingView) {
        await prisma.$transaction([
          prisma.storyView.create({ data: { storyId, userId } }),
          prisma.story.update({
            where: { id: storyId },
            data: { viewCount: { increment: 1 } },
          }),
        ]);
      }

      res.json({ viewed: true });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:storyId  -  Delete own story
// ---------------------------------------------------------------------------

router.delete(
  '/:storyId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { storyId } = req.params;

      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: { id: true, authorId: true },
      });

      if (!story) {
        throw new NotFoundError('Story not found');
      }

      if (story.authorId !== req.user!.userId) {
        throw new ForbiddenError('You can only delete your own stories');
      }

      await prisma.story.delete({ where: { id: storyId } });

      res.json({ message: 'Story deleted' });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:storyId/views  -  View count and viewers list
// ---------------------------------------------------------------------------

router.get(
  '/:storyId/views',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { storyId } = req.params;

      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: { id: true, authorId: true, viewCount: true },
      });

      if (!story) {
        throw new NotFoundError('Story not found');
      }

      // Only the author can see who viewed their story
      if (story.authorId !== req.user!.userId) {
        throw new ForbiddenError('Only the story author can view the viewers list');
      }

      const views = await prisma.storyView.findMany({
        where: { storyId },
        orderBy: { viewedAt: 'desc' },
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

      res.json({
        viewCount: story.viewCount,
        viewers: views.map((v) => ({
          user: v.user,
          viewedAt: v.viewedAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
