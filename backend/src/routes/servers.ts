import { Router } from 'express';
import { z } from 'zod';
import { ChannelType } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler, AppError } from '../utils/errors';
import {
  Permissions,
  DEFAULT_PERMISSIONS,
  checkMemberPermission,
} from '../utils/permissions';

const router = Router();

// All server routes require authentication
router.use(authenticate);

// ─── Validation Schemas ─────────────────────────────────────────────────────────

const createServerSchema = z.object({
  name: z
    .string()
    .min(1, 'Server name is required')
    .max(100, 'Server name must be at most 100 characters'),
  icon: z.string().optional().nullable(),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  banner: z.string().optional().nullable(),
});

const joinServerSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

const createInviteSchema = z.object({
  maxUses: z.number().int().min(0).optional().default(0),
  expiresAt: z.string().datetime().optional().nullable(),
});

const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100),
  color: z.string().optional().nullable(),
  permissions: z.number().optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional().nullable(),
  permissions: z.number().optional(),
  position: z.number().int().min(0).optional(),
});

const banUserSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  reason: z.string().max(512).optional().nullable(),
});

const kickUserSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

// ─── Helpers ────────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ─── GET / ──────────────────────────────────────────────────────────────────────

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const memberships = await prisma.serverMember.findMany({
      where: { userId },
      include: {
        server: {
          include: {
            channels: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                name: true,
                type: true,
                topic: true,
                position: true,
                isPrivate: true,
              },
            },
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const servers = memberships.map((m) => ({
      ...m.server,
      memberCount: m.server._count.members,
      _count: undefined,
      joinedAt: m.joinedAt,
      nickname: m.nickname,
    }));

    res.json(servers);
  })
);

// ─── POST / ─────────────────────────────────────────────────────────────────────

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const parsed = createServerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const { name, icon } = parsed.data;

    // Create server with default channels and role in a transaction
    const server = await prisma.$transaction(async (tx) => {
      // Create the server
      const newServer = await tx.server.create({
        data: {
          name,
          icon: icon || null,
          ownerId: userId,
        },
      });

      // Create default @everyone role
      await tx.role.create({
        data: {
          name: '@everyone',
          serverId: newServer.id,
          permissions: DEFAULT_PERMISSIONS,
          position: 0,
          isDefault: true,
          color: '#99AAB5',
        },
      });

      // Create default "general" text channel
      await tx.channel.create({
        data: {
          name: 'general',
          type: ChannelType.TEXT,
          serverId: newServer.id,
          position: 0,
          topic: 'General discussion',
        },
      });

      // Create default "General" voice channel
      await tx.channel.create({
        data: {
          name: 'General',
          type: ChannelType.VOICE,
          serverId: newServer.id,
          position: 1,
        },
      });

      // Add creator as a member
      await tx.serverMember.create({
        data: {
          userId,
          serverId: newServer.id,
        },
      });

      // Return the full server with relations
      return tx.server.findUnique({
        where: { id: newServer.id },
        include: {
          channels: { orderBy: { position: 'asc' } },
          roles: { orderBy: { position: 'asc' } },
          _count: { select: { members: true } },
        },
      });
    });

    res.status(201).json({
      ...server,
      memberCount: server!._count.members,
      _count: undefined,
    });
  })
);

// ─── GET /:id ───────────────────────────────────────────────────────────────────

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const serverId = req.params.id;

    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        channels: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            type: true,
            topic: true,
            position: true,
            slowmode: true,
            isPrivate: true,
            createdAt: true,
          },
        },
        roles: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            color: true,
            permissions: true,
            position: true,
            isDefault: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!server) {
      throw new AppError('Server not found', 404);
    }

    // Serialize BigInt permissions to string for JSON compatibility
    const serializedRoles = server.roles.map((role) => ({
      ...role,
      permissions: role.permissions.toString(),
    }));

    res.json({
      ...server,
      roles: serializedRoles,
      memberCount: server._count.members,
      _count: undefined,
    });
  })
);

// ─── PATCH /:id ─────────────────────────────────────────────────────────────────

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;

    const parsed = updateServerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    // Check permissions: must be owner or have MANAGE_SERVER
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    if (server.ownerId !== userId) {
      const hasPermission = await checkMemberPermission(userId, serverId, Permissions.MANAGE_SERVER);
      if (!hasPermission) {
        throw new AppError('You do not have permission to update this server', 403);
      }
    }

    const updatedServer = await prisma.server.update({
      where: { id: serverId },
      data: parsed.data,
      include: {
        channels: { orderBy: { position: 'asc' } },
        _count: { select: { members: true } },
      },
    });

    res.json({
      ...updatedServer,
      memberCount: updatedServer._count.members,
      _count: undefined,
    });
  })
);

// ─── DELETE /:id ────────────────────────────────────────────────────────────────

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    if (server.ownerId !== userId) {
      throw new AppError('Only the server owner can delete the server', 403);
    }

    await prisma.server.delete({ where: { id: serverId } });

    res.json({ message: 'Server deleted successfully' });
  })
);

// ─── GET /:id/members ───────────────────────────────────────────────────────────

router.get(
  '/:id/members',
  asyncHandler(async (req, res) => {
    const serverId = req.params.id;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    const members = await prisma.serverMember.findMany({
      where: { serverId },
      include: {
        user: {
          select: {
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
          },
        },
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                color: true,
                position: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const formatted = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      serverId: m.serverId,
      nickname: m.nickname,
      joinedAt: m.joinedAt,
      user: m.user,
      roles: m.roles.map((r) => r.role),
    }));

    res.json(formatted);
  })
);

// ─── POST /:id/join ─────────────────────────────────────────────────────────────

router.post(
  '/:id/join',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;

    const parsed = joinServerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const { inviteCode } = parsed.data;

    // Find and validate the invite
    const invite = await prisma.invite.findUnique({
      where: { code: inviteCode },
      include: { server: true },
    });

    if (!invite) {
      throw new AppError('Invalid invite code', 404);
    }

    if (invite.serverId !== serverId) {
      throw new AppError('Invite code does not belong to this server', 400);
    }

    // Check expiration
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new AppError('This invite has expired', 410);
    }

    // Check max uses (0 means unlimited)
    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
      throw new AppError('This invite has reached its maximum uses', 410);
    }

    // Check if user is banned
    const ban = await prisma.serverBan.findUnique({
      where: { serverId_userId: { serverId, userId } },
    });
    if (ban) {
      throw new AppError('You are banned from this server', 403);
    }

    // Check if already a member
    const existingMember = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (existingMember) {
      throw new AppError('You are already a member of this server', 400);
    }

    // Join the server and increment invite uses in a transaction
    const [member] = await prisma.$transaction([
      prisma.serverMember.create({
        data: { userId, serverId },
        include: {
          server: {
            include: {
              channels: { orderBy: { position: 'asc' } },
              _count: { select: { members: true } },
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              discriminator: true,
              avatar: true,
              status: true,
            },
          },
        },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      }),
    ]);

    res.status(201).json({
      server: {
        ...member.server,
        memberCount: member.server._count.members,
        _count: undefined,
      },
      member: {
        id: member.id,
        userId: member.userId,
        joinedAt: member.joinedAt,
        user: member.user,
      },
    });
  })
);

// ─── POST /:id/leave ────────────────────────────────────────────────────────────

router.post(
  '/:id/leave',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    if (server.ownerId === userId) {
      throw new AppError(
        'Server owner cannot leave. Transfer ownership or delete the server instead.',
        400
      );
    }

    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) {
      throw new AppError('You are not a member of this server', 400);
    }

    await prisma.serverMember.delete({
      where: { userId_serverId: { userId, serverId } },
    });

    res.json({ message: 'Left server successfully' });
  })
);

// ─── GET /:id/invites ───────────────────────────────────────────────────────────

router.get(
  '/:id/invites',
  asyncHandler(async (req, res) => {
    const serverId = req.params.id;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    const invites = await prisma.invite.findMany({
      where: { serverId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invites);
  })
);

// ─── POST /:id/invites ─────────────────────────────────────────────────────────

router.post(
  '/:id/invites',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;

    const parsed = createInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    // Check membership
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) {
      throw new AppError('You are not a member of this server', 403);
    }

    const { maxUses, expiresAt } = parsed.data;

    // Generate a unique invite code
    let code: string;
    let attempts = 0;
    do {
      code = generateInviteCode();
      const existing = await prisma.invite.findUnique({ where: { code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 50);

    if (attempts >= 50) {
      throw new AppError('Failed to generate a unique invite code. Please try again.', 500);
    }

    const invite = await prisma.invite.create({
      data: {
        code: code!,
        serverId,
        creatorId: userId,
        maxUses: maxUses || 0,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            avatar: true,
          },
        },
      },
    });

    res.status(201).json(invite);
  })
);

// ─── GET /:id/roles ─────────────────────────────────────────────────────────────

router.get(
  '/:id/roles',
  asyncHandler(async (req, res) => {
    const serverId = req.params.id;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    const roles = await prisma.role.findMany({
      where: { serverId },
      orderBy: { position: 'asc' },
    });

    // Serialize BigInt permissions to string
    const serialized = roles.map((role) => ({
      ...role,
      permissions: role.permissions.toString(),
    }));

    res.json(serialized);
  })
);

// ─── POST /:id/roles ────────────────────────────────────────────────────────────

router.post(
  '/:id/roles',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;

    const parsed = createRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    // Check permissions: must be owner or have MANAGE_ROLES
    if (server.ownerId !== userId) {
      const hasPermission = await checkMemberPermission(userId, serverId, Permissions.MANAGE_ROLES);
      if (!hasPermission) {
        throw new AppError('You do not have permission to create roles', 403);
      }
    }

    const { name, color, permissions } = parsed.data;

    // Get the highest position for ordering
    const highestRole = await prisma.role.findFirst({
      where: { serverId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const role = await prisma.role.create({
      data: {
        name,
        color: color || null,
        permissions: permissions ? BigInt(permissions) : BigInt(0),
        serverId,
        position: (highestRole?.position ?? 0) + 1,
      },
    });

    res.status(201).json({
      ...role,
      permissions: role.permissions.toString(),
    });
  })
);

// ─── PATCH /:id/roles/:roleId ───────────────────────────────────────────────────

router.patch(
  '/:id/roles/:roleId',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;
    const roleId = req.params.roleId;

    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    // Check permissions
    if (server.ownerId !== userId) {
      const hasPermission = await checkMemberPermission(userId, serverId, Permissions.MANAGE_ROLES);
      if (!hasPermission) {
        throw new AppError('You do not have permission to update roles', 403);
      }
    }

    const existingRole = await prisma.role.findFirst({
      where: { id: roleId, serverId },
    });
    if (!existingRole) {
      throw new AppError('Role not found', 404);
    }

    const { name, color, permissions, position } = parsed.data;

    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(permissions !== undefined && { permissions: BigInt(permissions) }),
        ...(position !== undefined && { position }),
      },
    });

    res.json({
      ...updatedRole,
      permissions: updatedRole.permissions.toString(),
    });
  })
);

// ─── DELETE /:id/roles/:roleId ──────────────────────────────────────────────────

router.delete(
  '/:id/roles/:roleId',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;
    const roleId = req.params.roleId;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    // Check permissions
    if (server.ownerId !== userId) {
      const hasPermission = await checkMemberPermission(userId, serverId, Permissions.MANAGE_ROLES);
      if (!hasPermission) {
        throw new AppError('You do not have permission to delete roles', 403);
      }
    }

    const role = await prisma.role.findFirst({
      where: { id: roleId, serverId },
    });
    if (!role) {
      throw new AppError('Role not found', 404);
    }

    if (role.isDefault) {
      throw new AppError('Cannot delete the default @everyone role', 400);
    }

    await prisma.role.delete({ where: { id: roleId } });

    res.json({ message: 'Role deleted successfully' });
  })
);

// ─── POST /:id/members/:memberId/roles/:roleId ─────────────────────────────────

router.post(
  '/:id/members/:memberId/roles/:roleId',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;
    const memberId = req.params.memberId;
    const roleId = req.params.roleId;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    // Check permissions
    if (server.ownerId !== userId) {
      const hasPermission = await checkMemberPermission(userId, serverId, Permissions.MANAGE_ROLES);
      if (!hasPermission) {
        throw new AppError('You do not have permission to assign roles', 403);
      }
    }

    // Verify the member exists
    const member = await prisma.serverMember.findFirst({
      where: { id: memberId, serverId },
    });
    if (!member) {
      throw new AppError('Member not found in this server', 404);
    }

    // Verify the role exists and belongs to this server
    const role = await prisma.role.findFirst({
      where: { id: roleId, serverId },
    });
    if (!role) {
      throw new AppError('Role not found in this server', 404);
    }

    if (role.isDefault) {
      throw new AppError('Cannot explicitly assign the default @everyone role', 400);
    }

    // Check if the role is already assigned
    const existingAssignment = await prisma.serverMemberRole.findUnique({
      where: { serverMemberId_roleId: { serverMemberId: memberId, roleId } },
    });
    if (existingAssignment) {
      throw new AppError('This role is already assigned to the member', 400);
    }

    const assignment = await prisma.serverMemberRole.create({
      data: {
        serverMemberId: memberId,
        roleId,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            color: true,
            position: true,
          },
        },
      },
    });

    res.status(201).json({
      id: assignment.id,
      memberId: assignment.serverMemberId,
      role: assignment.role,
    });
  })
);

// ─── DELETE /:id/members/:memberId/roles/:roleId ────────────────────────────────

router.delete(
  '/:id/members/:memberId/roles/:roleId',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;
    const memberId = req.params.memberId;
    const roleId = req.params.roleId;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    // Check permissions
    if (server.ownerId !== userId) {
      const hasPermission = await checkMemberPermission(userId, serverId, Permissions.MANAGE_ROLES);
      if (!hasPermission) {
        throw new AppError('You do not have permission to remove roles', 403);
      }
    }

    // Find the role assignment
    const assignment = await prisma.serverMemberRole.findUnique({
      where: { serverMemberId_roleId: { serverMemberId: memberId, roleId } },
    });
    if (!assignment) {
      throw new AppError('This role is not assigned to the member', 404);
    }

    await prisma.serverMemberRole.delete({
      where: { id: assignment.id },
    });

    res.json({ message: 'Role removed from member successfully' });
  })
);

// ─── POST /:id/bans ────────────────────────────────────────────────────────────

router.post(
  '/:id/bans',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;

    const parsed = banUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const { userId: targetUserId, reason } = parsed.data;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    // Check permissions
    if (server.ownerId !== userId) {
      const hasPermission = await checkMemberPermission(userId, serverId, Permissions.BAN_MEMBERS);
      if (!hasPermission) {
        throw new AppError('You do not have permission to ban members', 403);
      }
    }

    // Cannot ban the server owner
    if (targetUserId === server.ownerId) {
      throw new AppError('Cannot ban the server owner', 400);
    }

    // Cannot ban yourself
    if (targetUserId === userId) {
      throw new AppError('You cannot ban yourself', 400);
    }

    // Check if user is already banned
    const existingBan = await prisma.serverBan.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });
    if (existingBan) {
      throw new AppError('User is already banned from this server', 400);
    }

    // Remove from members and create ban in a transaction
    const ban = await prisma.$transaction(async (tx) => {
      // Remove from server members (if they are a member)
      await tx.serverMember.deleteMany({
        where: { userId: targetUserId, serverId },
      });

      // Create the ban
      return tx.serverBan.create({
        data: {
          serverId,
          userId: targetUserId,
          bannedById: userId,
          reason: reason || null,
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
    });

    res.status(201).json(ban);
  })
);

// ─── DELETE /:id/bans/:userId ───────────────────────────────────────────────────

router.delete(
  '/:id/bans/:userId',
  asyncHandler(async (req, res) => {
    const requesterId = req.user!.id;
    const serverId = req.params.id;
    const targetUserId = req.params.userId;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    // Check permissions
    if (server.ownerId !== requesterId) {
      const hasPermission = await checkMemberPermission(requesterId, serverId, Permissions.BAN_MEMBERS);
      if (!hasPermission) {
        throw new AppError('You do not have permission to unban members', 403);
      }
    }

    const ban = await prisma.serverBan.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });
    if (!ban) {
      throw new AppError('Ban not found', 404);
    }

    await prisma.serverBan.delete({
      where: { id: ban.id },
    });

    res.json({ message: 'User unbanned successfully' });
  })
);

// ─── POST /:id/kick ────────────────────────────────────────────────────────────

router.post(
  '/:id/kick',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const serverId = req.params.id;

    const parsed = kickUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const { userId: targetUserId } = parsed.data;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError('Server not found', 404);
    }

    // Check permissions
    if (server.ownerId !== userId) {
      const hasPermission = await checkMemberPermission(userId, serverId, Permissions.KICK_MEMBERS);
      if (!hasPermission) {
        throw new AppError('You do not have permission to kick members', 403);
      }
    }

    // Cannot kick the server owner
    if (targetUserId === server.ownerId) {
      throw new AppError('Cannot kick the server owner', 400);
    }

    // Cannot kick yourself
    if (targetUserId === userId) {
      throw new AppError('You cannot kick yourself', 400);
    }

    // Check if user is a member
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: targetUserId, serverId } },
    });
    if (!member) {
      throw new AppError('User is not a member of this server', 404);
    }

    await prisma.serverMember.delete({
      where: { userId_serverId: { userId: targetUserId, serverId } },
    });

    res.json({ message: 'User kicked successfully' });
  })
);

export default router;
