import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { getPoints, addPoints, deductPoints, redis } from '../lib/redis';
import { authenticate } from '../middleware/auth';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const earnSchema = z.object({
  type: z.enum(['EARN_WATCH', 'EARN_CHAT', 'EARN_BONUS'], {
    required_error: 'Type is required',
    invalid_type_error: 'Type must be EARN_WATCH, EARN_CHAT, or EARN_BONUS',
  }),
  amount: z
    .number()
    .int('Amount must be a whole number')
    .min(1, 'Amount must be at least 1')
    .max(10000, 'Amount must be 10,000 or fewer'),
});

const createRewardSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or fewer')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or fewer')
    .trim()
    .optional(),
  cost: z
    .number()
    .int('Cost must be a whole number')
    .min(1, 'Cost must be at least 1'),
  iconUrl: z.string().url('Invalid icon URL').optional(),
  maxPerStream: z
    .number()
    .int()
    .min(1)
    .optional()
    .nullable()
    .default(null),
  cooldownSec: z
    .number()
    .int()
    .min(0)
    .optional()
    .nullable()
    .default(null),
});

const updateRewardSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or fewer')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or fewer')
    .trim()
    .optional()
    .nullable(),
  cost: z
    .number()
    .int('Cost must be a whole number')
    .min(1, 'Cost must be at least 1')
    .optional(),
  iconUrl: z.string().url('Invalid icon URL').optional().nullable(),
  isEnabled: z.boolean().optional(),
  maxPerStream: z.number().int().min(1).optional().nullable(),
  cooldownSec: z.number().int().min(0).optional().nullable(),
});

const paginationSchema = z.object({
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
 * Verify the authenticated user is the server owner (admin).
 * Throws ForbiddenError if they are not.
 */
async function requireServerAdmin(userId: string, serverId: string): Promise<void> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { ownerId: true },
  });

  if (!server) {
    throw new NotFoundError('Server not found');
  }

  if (server.ownerId !== userId) {
    throw new ForbiddenError('Only the server owner can manage rewards');
  }
}

/**
 * Ensure a ChannelPointBalance row exists in the database for the given
 * user/server pair and return it. This is the authoritative fallback when
 * Redis is cold.
 */
async function ensureBalance(userId: string, serverId: string) {
  return prisma.channelPointBalance.upsert({
    where: { userId_serverId: { userId, serverId } },
    create: { userId, serverId, balance: 0, totalEarned: 0 },
    update: {},
  });
}

// ---------------------------------------------------------------------------
// All routes require authentication
// ---------------------------------------------------------------------------

router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /:serverId/balance - Get user's point balance
// ---------------------------------------------------------------------------

router.get('/:serverId/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    // Try Redis first for sub-millisecond response
    let balance = await getPoints(userId, serverId);

    if (balance === 0) {
      // Fallback to DB (Redis may be cold)
      const dbBalance = await ensureBalance(userId, serverId);
      balance = dbBalance.balance;

      // Hydrate Redis cache if DB has a non-zero balance
      if (balance > 0) {
        await addPoints(userId, serverId, balance);
      }
    }

    // Fetch totalEarned from DB (always authoritative)
    const record = await ensureBalance(userId, serverId);

    res.json({
      userId,
      serverId,
      balance,
      totalEarned: record.totalEarned,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:serverId/leaderboard - Top 50 point holders
// ---------------------------------------------------------------------------

router.get('/:serverId/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;

    const leaderboard = await prisma.channelPointBalance.findMany({
      where: { serverId },
      orderBy: { balance: 'desc' },
      take: 50,
      select: {
        userId: true,
        balance: true,
        totalEarned: true,
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

    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:serverId/earn - Earn points
// ---------------------------------------------------------------------------

router.post('/:serverId/earn', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    // Verify server membership
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) throw new ForbiddenError('You are not a member of this server');

    // Rate limit: max 10 earn requests per minute per user per server
    const rateLimitKey = `points:earn:${userId}:${serverId}`;
    const count = await redis.incr(rateLimitKey);
    if (count === 1) await redis.expire(rateLimitKey, 60);
    if (count > 10) throw new BadRequestError('Too many earn requests. Try again in a minute.');

    const parsed = earnSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { type, amount } = parsed.data;

    // Update Redis (fast path)
    const newBalance = await addPoints(userId, serverId, amount);

    // Persist to DB
    await prisma.channelPointBalance.upsert({
      where: { userId_serverId: { userId, serverId } },
      create: { userId, serverId, balance: amount, totalEarned: amount },
      update: {
        balance: { increment: amount },
        totalEarned: { increment: amount },
      },
    });

    // Create transaction record
    const transaction = await prisma.pointTransaction.create({
      data: {
        userId,
        serverId,
        amount,
        type,
        reason: `Earned via ${type}`,
      },
    });

    res.status(201).json({
      balance: newBalance,
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        type: transaction.type,
        reason: transaction.reason,
        createdAt: transaction.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:serverId/rewards - List available rewards
// ---------------------------------------------------------------------------

router.get('/:serverId/rewards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;

    const rewards = await prisma.pointReward.findMany({
      where: { serverId, isEnabled: true },
      orderBy: { cost: 'asc' },
    });

    res.json({ rewards });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:serverId/rewards - Create a reward (admin only)
// ---------------------------------------------------------------------------

router.post('/:serverId/rewards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    await requireServerAdmin(userId, serverId);

    const parsed = createRewardSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { title, description, cost, iconUrl, maxPerStream, cooldownSec } = parsed.data;

    const reward = await prisma.pointReward.create({
      data: {
        serverId,
        title,
        description,
        cost,
        iconUrl,
        maxPerStream,
        cooldownSec,
      },
    });

    res.status(201).json({ reward });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /:serverId/rewards/:rewardId - Update a reward (admin only)
// ---------------------------------------------------------------------------

router.patch('/:serverId/rewards/:rewardId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId, rewardId } = req.params;
    const userId = req.user!.userId;

    await requireServerAdmin(userId, serverId);

    const existing = await prisma.pointReward.findUnique({ where: { id: rewardId } });
    if (!existing || existing.serverId !== serverId) {
      throw new NotFoundError('Reward not found');
    }

    const parsed = updateRewardSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const reward = await prisma.pointReward.update({
      where: { id: rewardId },
      data: parsed.data,
    });

    res.json({ reward });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:serverId/rewards/:rewardId - Delete a reward (admin only)
// ---------------------------------------------------------------------------

router.delete('/:serverId/rewards/:rewardId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId, rewardId } = req.params;
    const userId = req.user!.userId;

    await requireServerAdmin(userId, serverId);

    const existing = await prisma.pointReward.findUnique({ where: { id: rewardId } });
    if (!existing || existing.serverId !== serverId) {
      throw new NotFoundError('Reward not found');
    }

    await prisma.pointReward.delete({ where: { id: rewardId } });

    res.json({ message: 'Reward deleted' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:serverId/rewards/:rewardId/redeem - Redeem a reward
// ---------------------------------------------------------------------------

router.post('/:serverId/rewards/:rewardId/redeem', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId, rewardId } = req.params;
    const userId = req.user!.userId;

    // Fetch the reward
    const reward = await prisma.pointReward.findUnique({ where: { id: rewardId } });
    if (!reward || reward.serverId !== serverId || !reward.isEnabled) {
      throw new NotFoundError('Reward not found or is disabled');
    }

    // Check maxPerStream limit
    if (reward.maxPerStream !== null) {
      const redemptionCount = await prisma.rewardRedemption.count({
        where: {
          rewardId,
          userId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // within last 24h as stream proxy
        },
      });

      if (redemptionCount >= reward.maxPerStream) {
        throw new BadRequestError('Maximum redemptions per stream reached');
      }
    }

    // Check cooldown
    if (reward.cooldownSec !== null && reward.cooldownSec > 0) {
      const lastRedemption = await prisma.rewardRedemption.findFirst({
        where: { rewardId, userId },
        orderBy: { createdAt: 'desc' },
      });

      if (lastRedemption) {
        const cooldownEnd = new Date(
          lastRedemption.createdAt.getTime() + reward.cooldownSec * 1000,
        );
        if (new Date() < cooldownEnd) {
          const remainingSec = Math.ceil(
            (cooldownEnd.getTime() - Date.now()) / 1000,
          );
          throw new BadRequestError(
            `Reward is on cooldown. Try again in ${remainingSec} seconds`,
          );
        }
      }
    }

    // Check balance - try Redis first, fallback to DB
    let balance = await getPoints(userId, serverId);
    if (balance === 0) {
      const dbBalance = await ensureBalance(userId, serverId);
      balance = dbBalance.balance;
    }

    if (balance < reward.cost) {
      throw new BadRequestError(
        `Insufficient points. You have ${balance} but need ${reward.cost}`,
      );
    }

    // Deduct points from Redis
    const newBalance = await deductPoints(userId, serverId, reward.cost);

    // Deduct points from DB
    await prisma.channelPointBalance.update({
      where: { userId_serverId: { userId, serverId } },
      data: { balance: { decrement: reward.cost } },
    });

    // Create point transaction
    await prisma.pointTransaction.create({
      data: {
        userId,
        serverId,
        amount: -reward.cost,
        type: 'REDEEM',
        reason: `Redeemed: ${reward.title}`,
      },
    });

    // Create redemption record
    const redemption = await prisma.rewardRedemption.create({
      data: {
        rewardId,
        userId,
        message: req.body.message || null,
      },
      include: {
        reward: {
          select: {
            id: true,
            title: true,
            cost: true,
            iconUrl: true,
          },
        },
      },
    });

    res.status(201).json({
      redemption,
      balance: newBalance,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:serverId/transactions - User's point transaction history
// ---------------------------------------------------------------------------

router.get('/:serverId/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { cursor, limit } = parsed.data;

    const transactions = await prisma.pointTransaction.findMany({
      where: { userId, serverId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const nextCursor =
      transactions.length === limit
        ? transactions[transactions.length - 1].id
        : null;

    res.json({ transactions, nextCursor });
  } catch (err) {
    next(err);
  }
});

export default router;
