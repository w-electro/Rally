import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function generateCode(): string {
  return crypto.randomBytes(4).toString('hex'); // 8 hex chars
}

// POST /servers/:serverId/invites — Create invite
router.post(
  '/servers/:serverId/invites',
  authenticate,
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) throw new ForbiddenError('You are not a member of this server');

    const expiresAt = req.body.expiresAt
      ? new Date(req.body.expiresAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default

    const invite = await prisma.serverInvite.create({
      data: {
        code: generateCode(),
        serverId,
        creatorId: userId,
        expiresAt,
        maxUses: req.body.maxUses ?? null,
      },
    });

    res.status(201).json(invite);
  }),
);

// GET /invites/:code — Resolve invite (public, no auth)
router.get(
  '/invites/:code',
  asyncHandler(async (req, res) => {
    const invite = await prisma.serverInvite.findUnique({
      where: { code: req.params.code },
      include: {
        server: {
          select: { id: true, name: true, iconUrl: true, description: true },
        },
        creator: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    if (!invite) throw new NotFoundError('Invalid invite code');
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestError('This invite has expired');
    }
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      throw new BadRequestError('This invite has reached its max uses');
    }

    const memberCount = await prisma.serverMember.count({ where: { serverId: invite.serverId } });

    res.json({
      code: invite.code,
      server: { ...invite.server, memberCount },
      creator: invite.creator,
      expiresAt: invite.expiresAt,
    });
  }),
);

// POST /invites/:code/join — Redeem invite
router.post(
  '/invites/:code/join',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const invite = await prisma.serverInvite.findUnique({
      where: { code: req.params.code },
    });

    if (!invite) throw new NotFoundError('Invalid invite code');
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestError('This invite has expired');
    }
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      throw new BadRequestError('This invite has reached its max uses');
    }

    const existing = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId: invite.serverId } },
    });
    if (existing) throw new BadRequestError('You are already a member of this server');

    const [member] = await prisma.$transaction([
      prisma.serverMember.create({
        data: { userId, serverId: invite.serverId },
        include: {
          server: { select: { id: true, name: true, iconUrl: true } },
        },
      }),
      prisma.serverInvite.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      }),
    ]);

    res.json(member);
  }),
);

export default router;
