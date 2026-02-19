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

const createPostSchema = z.object({
  caption: z.string().max(2200).optional(),
  mediaUrls: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(['image', 'video']),
        thumbnail: z.string().url().optional(),
      }),
    )
    .min(1, 'At least one media item is required'),
  hashtags: z.array(z.string().max(100)).max(30).optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  replyToId: z.string().uuid().optional(),
});

const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? parseInt(v, 10) : 20;
      return Math.min(Math.max(n, 1), 50);
    }),
});

// ---------------------------------------------------------------------------
// GET /:channelId/posts  -  Paginated feed posts for a channel
// ---------------------------------------------------------------------------

router.get(
  '/:channelId/posts',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channelId } = req.params;
      const { cursor, limit } = paginationSchema.parse(req.query);

      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { id: true, type: true },
      });

      if (!channel) {
        throw new NotFoundError('Channel not found');
      }

      const posts = await prisma.feedPost.findMany({
        where: { channelId },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // fetch one extra to determine hasMore
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          likes: {
            where: { userId: req.user!.userId },
            select: { id: true },
          },
        },
      });

      const hasMore = posts.length > limit;
      if (hasMore) posts.pop();

      const formatted = posts.map((post) => ({
        id: post.id,
        channelId: post.channelId,
        caption: post.caption,
        mediaUrls: post.mediaUrls,
        hashtags: post.hashtags,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        isHighlight: post.isHighlight,
        likedByMe: post.likes.length > 0,
        author: post.author,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      }));

      res.json({
        posts: formatted,
        nextCursor: hasMore ? posts[posts.length - 1].id : null,
        hasMore,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:channelId/posts  -  Create a feed post
// ---------------------------------------------------------------------------

router.post(
  '/:channelId/posts',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channelId } = req.params;
      const data = createPostSchema.parse(req.body);

      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { id: true, type: true, serverId: true },
      });

      if (!channel) {
        throw new NotFoundError('Channel not found');
      }

      if (channel.type !== 'FEED') {
        throw new BadRequestError('Posts can only be created in FEED channels');
      }

      // Verify the user is a member of the server
      const member = await prisma.serverMember.findUnique({
        where: {
          userId_serverId: {
            userId: req.user!.userId,
            serverId: channel.serverId,
          },
        },
      });

      if (!member) {
        throw new ForbiddenError('You must be a server member to post');
      }

      const post = await prisma.feedPost.create({
        data: {
          channelId,
          authorId: req.user!.userId,
          caption: data.caption ?? null,
          mediaUrls: data.mediaUrls,
          hashtags: data.hashtags ?? [],
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

      res.status(201).json({ post });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /posts/:postId  -  Single post with comments
// ---------------------------------------------------------------------------

router.get(
  '/posts/:postId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;

      const post = await prisma.feedPost.findUnique({
        where: { id: postId },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          likes: {
            where: { userId: req.user!.userId },
            select: { id: true },
          },
          comments: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              replyTo: {
                select: {
                  id: true,
                  authorId: true,
                  content: true,
                  author: {
                    select: {
                      id: true,
                      username: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!post) {
        throw new NotFoundError('Post not found');
      }

      res.json({
        post: {
          id: post.id,
          channelId: post.channelId,
          caption: post.caption,
          mediaUrls: post.mediaUrls,
          hashtags: post.hashtags,
          likeCount: post.likeCount,
          commentCount: post.commentCount,
          isHighlight: post.isHighlight,
          likedByMe: post.likes.length > 0,
          author: post.author,
          comments: post.comments,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /posts/:postId  -  Delete own post
// ---------------------------------------------------------------------------

router.delete(
  '/posts/:postId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;

      const post = await prisma.feedPost.findUnique({
        where: { id: postId },
        select: { id: true, authorId: true },
      });

      if (!post) {
        throw new NotFoundError('Post not found');
      }

      if (post.authorId !== req.user!.userId) {
        throw new ForbiddenError('You can only delete your own posts');
      }

      await prisma.feedPost.delete({ where: { id: postId } });

      res.json({ message: 'Post deleted' });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /posts/:postId/like  -  Like / unlike toggle
// ---------------------------------------------------------------------------

router.post(
  '/posts/:postId/like',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const userId = req.user!.userId;

      const post = await prisma.feedPost.findUnique({
        where: { id: postId },
        select: { id: true },
      });

      if (!post) {
        throw new NotFoundError('Post not found');
      }

      const existingLike = await prisma.feedLike.findUnique({
        where: { postId_userId: { postId, userId } },
      });

      if (existingLike) {
        // Unlike
        await prisma.$transaction([
          prisma.feedLike.delete({ where: { id: existingLike.id } }),
          prisma.feedPost.update({
            where: { id: postId },
            data: { likeCount: { decrement: 1 } },
          }),
        ]);

        res.json({ liked: false });
      } else {
        // Like
        await prisma.$transaction([
          prisma.feedLike.create({ data: { postId, userId } }),
          prisma.feedPost.update({
            where: { id: postId },
            data: { likeCount: { increment: 1 } },
          }),
        ]);

        res.json({ liked: true });
      }
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /posts/:postId/comments  -  Add comment
// ---------------------------------------------------------------------------

router.post(
  '/posts/:postId/comments',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const data = createCommentSchema.parse(req.body);

      const post = await prisma.feedPost.findUnique({
        where: { id: postId },
        select: { id: true },
      });

      if (!post) {
        throw new NotFoundError('Post not found');
      }

      // Validate replyToId if provided
      if (data.replyToId) {
        const parentComment = await prisma.feedComment.findUnique({
          where: { id: data.replyToId },
          select: { id: true, postId: true },
        });

        if (!parentComment) {
          throw new NotFoundError('Parent comment not found');
        }

        if (parentComment.postId !== postId) {
          throw new BadRequestError('Parent comment does not belong to this post');
        }
      }

      const [comment] = await prisma.$transaction([
        prisma.feedComment.create({
          data: {
            postId,
            authorId: req.user!.userId,
            content: data.content,
            replyToId: data.replyToId ?? null,
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
        }),
        prisma.feedPost.update({
          where: { id: postId },
          data: { commentCount: { increment: 1 } },
        }),
      ]);

      res.status(201).json({ comment });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /posts/:postId/comments/:commentId  -  Delete own comment
// ---------------------------------------------------------------------------

router.delete(
  '/posts/:postId/comments/:commentId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId, commentId } = req.params;

      const comment = await prisma.feedComment.findUnique({
        where: { id: commentId },
        select: { id: true, postId: true, authorId: true },
      });

      if (!comment) {
        throw new NotFoundError('Comment not found');
      }

      if (comment.postId !== postId) {
        throw new BadRequestError('Comment does not belong to this post');
      }

      if (comment.authorId !== req.user!.userId) {
        throw new ForbiddenError('You can only delete your own comments');
      }

      await prisma.$transaction([
        prisma.feedComment.delete({ where: { id: commentId } }),
        prisma.feedPost.update({
          where: { id: postId },
          data: { commentCount: { decrement: 1 } },
        }),
      ]);

      res.json({ message: 'Comment deleted' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
