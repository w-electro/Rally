import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { redis } from '../lib/redis';
import { authenticate } from '../middleware/auth';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createPostSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(500, 'Content must be 500 characters or fewer')
    .trim(),
  mediaUrls: z
    .array(z.string().url('Invalid media URL'))
    .max(4, 'Maximum 4 media items allowed')
    .optional()
    .default([]),
  hashtags: z
    .array(
      z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-zA-Z0-9_]+$/, 'Hashtags may only contain letters, numbers, and underscores')
        .transform((v) => v.toLowerCase()),
    )
    .max(10, 'Maximum 10 hashtags allowed')
    .optional()
    .default([]),
});

const replySchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(500, 'Content must be 500 characters or fewer')
    .trim(),
  mediaUrls: z
    .array(z.string().url('Invalid media URL'))
    .max(4, 'Maximum 4 media items allowed')
    .optional()
    .default([]),
});

const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(50))
    .optional()
    .default('20'),
  sort: z.enum(['viral', 'recent']).optional().default('viral'),
});

const searchSchema = z.object({
  q: z
    .string()
    .min(1, 'Search query is required')
    .max(50)
    .transform((v) => v.toLowerCase().replace(/^#/, '')),
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(50))
    .optional()
    .default('20'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the viral score for a pulse post.
 * Formula: (likeCount * 1.0 + repostCount * 2.0 + replyCount * 0.5) / (hoursAge + 2)^1.5
 */
function calculateViralScore(
  likeCount: number,
  repostCount: number,
  replyCount: number,
  createdAt: Date,
): number {
  const hoursAge = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const numerator = likeCount * 1.0 + repostCount * 2.0 + replyCount * 0.5;
  const denominator = Math.pow(hoursAge + 2, 1.5);
  return numerator / denominator;
}

/** Standard author select fields returned with every post. */
const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  isVerified: true,
};

/** Standard fields returned for a pulse post. */
const postSelect = {
  id: true,
  authorId: true,
  content: true,
  mediaUrls: true,
  hashtags: true,
  likeCount: true,
  repostCount: true,
  replyCount: true,
  viewCount: true,
  viralScore: true,
  replyToId: true,
  isRepost: true,
  originalId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: authorSelect },
};

/**
 * Update the TrendingHashtag table for every hashtag on a newly created post.
 * Upserts each tag, increments postCount, and recalculates score as
 * postCount / (hoursSinceLastUpdate + 2)^1.5  (same gravity curve as viral).
 */
async function updateTrendingHashtags(hashtags: string[]): Promise<void> {
  for (const tag of hashtags) {
    const existing = await prisma.trendingHashtag.findUnique({ where: { tag } });

    if (existing) {
      const newPostCount = existing.postCount + 1;
      const hoursAge =
        (Date.now() - existing.updatedAt.getTime()) / (1000 * 60 * 60);
      const score = newPostCount / Math.pow(hoursAge + 2, 1.5);

      await prisma.trendingHashtag.update({
        where: { tag },
        data: { postCount: newPostCount, score },
      });
    } else {
      // New tag: score starts at postCount(1) / (0 + 2)^1.5
      const score = 1 / Math.pow(2, 1.5);
      await prisma.trendingHashtag.create({
        data: { tag, postCount: 1, score },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// All routes require authentication
// ---------------------------------------------------------------------------

router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /feed - Global pulse feed (paginated)
// ---------------------------------------------------------------------------

router.get('/feed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { cursor, limit, sort } = parsed.data;

    const orderBy =
      sort === 'viral'
        ? [{ viralScore: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }];

    const posts = await prisma.pulsePost.findMany({
      where: {
        replyToId: null, // top-level posts only
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy,
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: postSelect,
    });

    const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;

    res.json({ posts, nextCursor });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /trending - Trending hashtags
// ---------------------------------------------------------------------------

router.get('/trending', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const hashtags = await prisma.trendingHashtag.findMany({
      orderBy: { score: 'desc' },
      take: 30,
    });

    res.json({ hashtags });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /search?q=hashtag - Search posts by hashtag
// ---------------------------------------------------------------------------

router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { q, cursor, limit } = parsed.data;

    const posts = await prisma.pulsePost.findMany({
      where: {
        hashtags: { has: q },
        ...(cursor ? {} : {}),
      },
      orderBy: [{ viralScore: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: postSelect,
    });

    const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;

    res.json({ posts, nextCursor });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST / - Create a pulse post
// ---------------------------------------------------------------------------

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { content, mediaUrls, hashtags } = parsed.data;
    const userId = req.user!.userId;

    const post = await prisma.pulsePost.create({
      data: {
        authorId: userId,
        content,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        hashtags,
        viralScore: 0,
      },
      select: postSelect,
    });

    // Update trending hashtags asynchronously (fire-and-forget in background)
    if (hashtags.length > 0) {
      updateTrendingHashtags(hashtags).catch((err) =>
        console.error('Failed to update trending hashtags:', err),
      );
    }

    res.status(201).json({ post });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:postId - Get single pulse post with replies
// ---------------------------------------------------------------------------

router.get('/:postId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postId } = req.params;

    const post = await prisma.pulsePost.findUnique({
      where: { id: postId },
      select: {
        ...postSelect,
        replies: {
          orderBy: { createdAt: 'asc' },
          select: postSelect,
        },
      },
    });

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    // Increment view count in the background
    prisma.pulsePost
      .update({ where: { id: postId }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    res.json({ post });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:postId - Delete own pulse post
// ---------------------------------------------------------------------------

router.delete('/:postId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postId } = req.params;
    const userId = req.user!.userId;

    const post = await prisma.pulsePost.findUnique({ where: { id: postId } });

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenError('You can only delete your own posts');
    }

    await prisma.pulsePost.delete({ where: { id: postId } });

    res.json({ message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:postId/like - Toggle like on a post
// ---------------------------------------------------------------------------

router.post('/:postId/like', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postId } = req.params;
    const userId = req.user!.userId;

    const post = await prisma.pulsePost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const existingLike = await prisma.pulseLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    let liked: boolean;

    if (existingLike) {
      // Unlike
      await prisma.pulseLike.delete({
        where: { id: existingLike.id },
      });

      const updatedPost = await prisma.pulsePost.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });

      const viralScore = calculateViralScore(
        updatedPost.likeCount,
        updatedPost.repostCount,
        updatedPost.replyCount,
        updatedPost.createdAt,
      );

      await prisma.pulsePost.update({
        where: { id: postId },
        data: { viralScore },
      });

      liked = false;
    } else {
      // Like
      await prisma.pulseLike.create({
        data: { postId, userId },
      });

      const updatedPost = await prisma.pulsePost.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      });

      const viralScore = calculateViralScore(
        updatedPost.likeCount,
        updatedPost.repostCount,
        updatedPost.replyCount,
        updatedPost.createdAt,
      );

      await prisma.pulsePost.update({
        where: { id: postId },
        data: { viralScore },
      });

      liked = true;
    }

    const finalPost = await prisma.pulsePost.findUnique({
      where: { id: postId },
      select: { likeCount: true, viralScore: true },
    });

    res.json({ liked, likeCount: finalPost!.likeCount, viralScore: finalPost!.viralScore });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:postId/repost - Toggle repost on a post
// ---------------------------------------------------------------------------

router.post('/:postId/repost', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postId } = req.params;
    const userId = req.user!.userId;

    const post = await prisma.pulsePost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const existingRepost = await prisma.pulseRepost.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    let reposted: boolean;

    if (existingRepost) {
      // Un-repost
      await prisma.pulseRepost.delete({
        where: { id: existingRepost.id },
      });

      const updatedPost = await prisma.pulsePost.update({
        where: { id: postId },
        data: { repostCount: { decrement: 1 } },
      });

      const viralScore = calculateViralScore(
        updatedPost.likeCount,
        updatedPost.repostCount,
        updatedPost.replyCount,
        updatedPost.createdAt,
      );

      await prisma.pulsePost.update({
        where: { id: postId },
        data: { viralScore },
      });

      reposted = false;
    } else {
      // Repost
      await prisma.pulseRepost.create({
        data: { postId, userId },
      });

      const updatedPost = await prisma.pulsePost.update({
        where: { id: postId },
        data: { repostCount: { increment: 1 } },
      });

      const viralScore = calculateViralScore(
        updatedPost.likeCount,
        updatedPost.repostCount,
        updatedPost.replyCount,
        updatedPost.createdAt,
      );

      await prisma.pulsePost.update({
        where: { id: postId },
        data: { viralScore },
      });

      reposted = true;
    }

    const finalPost = await prisma.pulsePost.findUnique({
      where: { id: postId },
      select: { repostCount: true, viralScore: true },
    });

    res.json({
      reposted,
      repostCount: finalPost!.repostCount,
      viralScore: finalPost!.viralScore,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:postId/reply - Reply to a post
// ---------------------------------------------------------------------------

router.post('/:postId/reply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postId } = req.params;
    const userId = req.user!.userId;

    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const parentPost = await prisma.pulsePost.findUnique({ where: { id: postId } });
    if (!parentPost) {
      throw new NotFoundError('Post not found');
    }

    const { content, mediaUrls } = parsed.data;

    // Create the reply post with replyToId pointing to the parent
    const reply = await prisma.pulsePost.create({
      data: {
        authorId: userId,
        content,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        hashtags: [],
        replyToId: postId,
        viralScore: 0,
      },
      select: postSelect,
    });

    // Increment parent's reply count and recalculate viral score
    const updatedParent = await prisma.pulsePost.update({
      where: { id: postId },
      data: { replyCount: { increment: 1 } },
    });

    const viralScore = calculateViralScore(
      updatedParent.likeCount,
      updatedParent.repostCount,
      updatedParent.replyCount,
      updatedParent.createdAt,
    );

    await prisma.pulsePost.update({
      where: { id: postId },
      data: { viralScore },
    });

    res.status(201).json({ reply });
  } catch (err) {
    next(err);
  }
});

export default router;
