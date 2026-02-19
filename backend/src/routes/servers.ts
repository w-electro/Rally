import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireServerMember } from '../middleware/auth';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import {
  DEFAULT_PERMISSIONS,
  ADMIN_PERMISSIONS,
  Permissions,
  hasPermission,
  computePermissions,
} from '../utils/permissions';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/** Wrap async route handlers so thrown errors reach the Express error handler. */
function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Serialize a role object, converting BigInt permissions to a string. */
function serializeRole<T extends { permissions: bigint }>(role: T): Omit<T, 'permissions'> & { permissions: string } {
  return { ...role, permissions: role.permissions.toString() };
}

/** Serialize a server object that includes roles, converting BigInt permissions to strings. */
function serializeServerWithRoles(server: any): any {
  if (!server || !server.roles) return server;
  return { ...server, roles: server.roles.map(serializeRole) };
}

/** Resolve the authenticated member's computed permissions for a server. */
async function getMemberPermissions(userId: string, serverId: string): Promise<bigint> {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) throw new NotFoundError('Server not found');

  // Owner always has full admin
  if (server.ownerId === userId) return ADMIN_PERMISSIONS;

  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
    include: { roles: { include: { role: true } } },
  });

  if (!member) throw new ForbiddenError('Not a member of this server');

  // Include the @everyone default role
  const defaultRole = await prisma.role.findFirst({
    where: { serverId, isDefault: true },
  });

  const perms: bigint[] = member.roles.map((mr) => mr.role.permissions);
  if (defaultRole) perms.push(defaultRole.permissions);

  return computePermissions(perms);
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1024).optional(),
  isPublic: z.boolean().optional().default(false),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1024).nullable().optional(),
  iconUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  isPublic: z.boolean().optional(),
});

const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['TEXT', 'VOICE', 'FEED', 'STAGE', 'CATEGORY', 'ANNOUNCEMENT']),
  parentId: z.string().uuid().nullable().optional(),
});

const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  topic: z.string().max(1024).nullable().optional(),
  position: z.number().int().min(0).optional(),
  isNsfw: z.boolean().optional(),
  slowMode: z.number().int().min(0).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  permissions: z.union([z.string(), z.number()]).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  permissions: z.union([z.string(), z.number()]).optional(),
  position: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// All routes require authentication
// ---------------------------------------------------------------------------

router.use(authenticate);

// ===========================================================================
// POST / - Create a new server
// ===========================================================================

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const data = createServerSchema.parse(req.body);

    const server = await prisma.$transaction(async (tx) => {
      // 1. Create the server
      const newServer = await tx.server.create({
        data: {
          name: data.name,
          description: data.description,
          isPublic: data.isPublic,
          ownerId: userId,
        },
      });

      // 2. Create the @everyone default role with default permissions
      await tx.role.create({
        data: {
          serverId: newServer.id,
          name: '@everyone',
          permissions: DEFAULT_PERMISSIONS,
          isDefault: true,
          position: 0,
        },
      });

      // 3. Create the General text channel
      await tx.channel.create({
        data: {
          serverId: newServer.id,
          name: 'General',
          type: 'TEXT',
          position: 0,
        },
      });

      // 4. Add the owner as a member
      await tx.serverMember.create({
        data: {
          userId,
          serverId: newServer.id,
        },
      });

      return newServer;
    });

    const fullServer = await prisma.server.findUnique({
      where: { id: server.id },
      include: {
        channels: true,
        roles: true,
        _count: { select: { members: true } },
      },
    });

    res.status(201).json(fullServer ? serializeServerWithRoles(fullServer) : fullServer);
  }),
);

// ===========================================================================
// GET / - List the authenticated user's servers
// ===========================================================================

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const memberships = await prisma.serverMember.findMany({
      where: { userId },
      include: {
        server: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const servers = memberships.map((m) => ({
      ...m.server,
      joinedAt: m.joinedAt,
      nickname: m.nickname,
    }));

    res.json(servers);
  }),
);

// ===========================================================================
// GET /:serverId - Get server details with channels and member count
// ===========================================================================

router.get(
  '/:serverId',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId } = req.params;

    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        channels: {
          orderBy: { position: 'asc' },
        },
        roles: {
          orderBy: { position: 'desc' },
        },
        _count: { select: { members: true } },
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!server) throw new NotFoundError('Server not found');

    res.json(serializeServerWithRoles(server));
  }),
);

// ===========================================================================
// PATCH /:serverId - Update server settings
// ===========================================================================

router.patch(
  '/:serverId',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId } = req.params;
    const userId = req.user!.userId;
    const data = updateServerSchema.parse(req.body);

    const perms = await getMemberPermissions(userId, serverId);
    if (!hasPermission(perms, Permissions.MANAGE_SERVER)) {
      throw new ForbiddenError('You do not have permission to manage this server');
    }

    const server = await prisma.server.update({
      where: { id: serverId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl }),
        ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    res.json(server);
  }),
);

// ===========================================================================
// DELETE /:serverId - Delete server (owner only)
// ===========================================================================

router.delete(
  '/:serverId',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) throw new NotFoundError('Server not found');

    if (server.ownerId !== userId) {
      throw new ForbiddenError('Only the server owner can delete the server');
    }

    await prisma.server.delete({ where: { id: serverId } });

    res.json({ message: 'Server deleted' });
  }),
);

// ===========================================================================
// POST /:serverId/join - Join a public server
// ===========================================================================

router.post(
  '/:serverId/join',
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) throw new NotFoundError('Server not found');

    if (!server.isPublic) {
      throw new ForbiddenError('This server is not public. You need an invite to join.');
    }

    const existingMember = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });

    if (existingMember) {
      throw new BadRequestError('You are already a member of this server');
    }

    const member = await prisma.serverMember.create({
      data: { userId, serverId },
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

    res.status(201).json(member);
  }),
);

// ===========================================================================
// POST /:serverId/leave - Leave a server
// ===========================================================================

router.post(
  '/:serverId/leave',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) throw new NotFoundError('Server not found');

    if (server.ownerId === userId) {
      throw new BadRequestError(
        'The server owner cannot leave. Transfer ownership or delete the server instead.',
      );
    }

    await prisma.serverMember.delete({
      where: { userId_serverId: { userId, serverId } },
    });

    res.json({ message: 'You have left the server' });
  }),
);

// ===========================================================================
// GET /:serverId/members - Get server members
// ===========================================================================

router.get(
  '/:serverId/members',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string | undefined;

    const members = await prisma.serverMember.findMany({
      where: { serverId },
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            customStatus: true,
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

    const hasMore = members.length > limit;
    const results = hasMore ? members.slice(0, limit) : members;
    const nextCursor = hasMore ? results[results.length - 1].id : undefined;

    res.json({
      members: results,
      nextCursor,
    });
  }),
);

// ===========================================================================
// POST /:serverId/channels - Create a channel
// ===========================================================================

router.post(
  '/:serverId/channels',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId } = req.params;
    const userId = req.user!.userId;
    const data = createChannelSchema.parse(req.body);

    const perms = await getMemberPermissions(userId, serverId);
    if (!hasPermission(perms, Permissions.MANAGE_CHANNELS)) {
      throw new ForbiddenError('You do not have permission to manage channels');
    }

    // If parentId is provided, validate it exists and is a CATEGORY channel
    if (data.parentId) {
      const parent = await prisma.channel.findUnique({
        where: { id: data.parentId },
      });

      if (!parent || parent.serverId !== serverId) {
        throw new BadRequestError('Invalid parent channel');
      }

      if (parent.type !== 'CATEGORY') {
        throw new BadRequestError('Parent channel must be a category');
      }
    }

    // Determine position: append after last channel (or last in category)
    const lastChannel = await prisma.channel.findFirst({
      where: {
        serverId,
        parentId: data.parentId ?? null,
      },
      orderBy: { position: 'desc' },
    });

    const channel = await prisma.channel.create({
      data: {
        serverId,
        name: data.name,
        type: data.type,
        parentId: data.parentId ?? null,
        position: lastChannel ? lastChannel.position + 1 : 0,
      },
    });

    res.status(201).json(channel);
  }),
);

// ===========================================================================
// PATCH /:serverId/channels/:channelId - Update a channel
// ===========================================================================

router.patch(
  '/:serverId/channels/:channelId',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId, channelId } = req.params;
    const userId = req.user!.userId;
    const data = updateChannelSchema.parse(req.body);

    const perms = await getMemberPermissions(userId, serverId);
    if (!hasPermission(perms, Permissions.MANAGE_CHANNELS)) {
      throw new ForbiddenError('You do not have permission to manage channels');
    }

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.serverId !== serverId) {
      throw new NotFoundError('Channel not found');
    }

    // If updating parentId, validate the parent
    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === channelId) {
        throw new BadRequestError('A channel cannot be its own parent');
      }

      const parent = await prisma.channel.findUnique({
        where: { id: data.parentId },
      });

      if (!parent || parent.serverId !== serverId) {
        throw new BadRequestError('Invalid parent channel');
      }

      if (parent.type !== 'CATEGORY') {
        throw new BadRequestError('Parent channel must be a category');
      }
    }

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.topic !== undefined && { topic: data.topic }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.isNsfw !== undefined && { isNsfw: data.isNsfw }),
        ...(data.slowMode !== undefined && { slowMode: data.slowMode }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
      },
    });

    res.json(updated);
  }),
);

// ===========================================================================
// DELETE /:serverId/channels/:channelId - Delete a channel
// ===========================================================================

router.delete(
  '/:serverId/channels/:channelId',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId, channelId } = req.params;
    const userId = req.user!.userId;

    const perms = await getMemberPermissions(userId, serverId);
    if (!hasPermission(perms, Permissions.MANAGE_CHANNELS)) {
      throw new ForbiddenError('You do not have permission to manage channels');
    }

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.serverId !== serverId) {
      throw new NotFoundError('Channel not found');
    }

    // Prevent deleting the last text channel
    if (channel.type === 'TEXT') {
      const textChannelCount = await prisma.channel.count({
        where: { serverId, type: 'TEXT' },
      });

      if (textChannelCount <= 1) {
        throw new BadRequestError('Cannot delete the last text channel in a server');
      }
    }

    await prisma.channel.delete({ where: { id: channelId } });

    res.json({ message: 'Channel deleted' });
  }),
);

// ===========================================================================
// GET /channels/:channelId/messages - Get channel messages (paginated)
// ===========================================================================

router.get(
  '/channels/:channelId/messages',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundError('Channel not found');

    const messages = await prisma.message.findMany({
      where: { channelId },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            author: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
    });

    // Return in chronological order (oldest first)
    res.json(messages.reverse());
  }),
);

// ===========================================================================
// GET /:serverId/roles - Get server roles
// ===========================================================================

router.get(
  '/:serverId/roles',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId } = req.params;

    const roles = await prisma.role.findMany({
      where: { serverId },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { position: 'desc' },
    });

    // Serialize BigInt permissions to string for JSON response
    const serialized = roles.map((role) => ({
      ...role,
      permissions: role.permissions.toString(),
    }));

    res.json(serialized);
  }),
);

// ===========================================================================
// POST /:serverId/roles - Create a role
// ===========================================================================

router.post(
  '/:serverId/roles',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId } = req.params;
    const userId = req.user!.userId;
    const data = createRoleSchema.parse(req.body);

    const perms = await getMemberPermissions(userId, serverId);
    if (!hasPermission(perms, Permissions.MANAGE_ROLES)) {
      throw new ForbiddenError('You do not have permission to manage roles');
    }

    // Determine position: place above default role
    const highestRole = await prisma.role.findFirst({
      where: { serverId, isDefault: false },
      orderBy: { position: 'desc' },
    });

    const permissionsBigint = data.permissions ? BigInt(data.permissions) : 0n;

    const role = await prisma.role.create({
      data: {
        serverId,
        name: data.name,
        color: data.color ?? '#99AAB5',
        permissions: permissionsBigint,
        position: highestRole ? highestRole.position + 1 : 1,
      },
    });

    res.status(201).json({
      ...role,
      permissions: role.permissions.toString(),
    });
  }),
);

// ===========================================================================
// PATCH /:serverId/roles/:roleId - Update a role
// ===========================================================================

router.patch(
  '/:serverId/roles/:roleId',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId, roleId } = req.params;
    const userId = req.user!.userId;
    const data = updateRoleSchema.parse(req.body);

    const perms = await getMemberPermissions(userId, serverId);
    if (!hasPermission(perms, Permissions.MANAGE_ROLES)) {
      throw new ForbiddenError('You do not have permission to manage roles');
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.serverId !== serverId) {
      throw new NotFoundError('Role not found');
    }

    // Prevent renaming the default @everyone role
    if (role.isDefault && data.name !== undefined && data.name !== '@everyone') {
      throw new BadRequestError('Cannot rename the default @everyone role');
    }

    const updated = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.permissions !== undefined && { permissions: BigInt(data.permissions) }),
        ...(data.position !== undefined && { position: data.position }),
      },
    });

    res.json({
      ...updated,
      permissions: updated.permissions.toString(),
    });
  }),
);

// ===========================================================================
// DELETE /:serverId/roles/:roleId - Delete a role
// ===========================================================================

router.delete(
  '/:serverId/roles/:roleId',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId, roleId } = req.params;
    const userId = req.user!.userId;

    const perms = await getMemberPermissions(userId, serverId);
    if (!hasPermission(perms, Permissions.MANAGE_ROLES)) {
      throw new ForbiddenError('You do not have permission to manage roles');
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.serverId !== serverId) {
      throw new NotFoundError('Role not found');
    }

    if (role.isDefault) {
      throw new BadRequestError('Cannot delete the default @everyone role');
    }

    await prisma.role.delete({ where: { id: roleId } });

    res.json({ message: 'Role deleted' });
  }),
);

// ===========================================================================
// POST /:serverId/members/:memberId/roles - Assign a role to a member
// ===========================================================================

router.post(
  '/:serverId/members/:memberId/roles',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId, memberId } = req.params;
    const userId = req.user!.userId;
    const { roleId } = req.body;

    if (!roleId || typeof roleId !== 'string') {
      throw new BadRequestError('roleId is required');
    }

    const perms = await getMemberPermissions(userId, serverId);
    if (!hasPermission(perms, Permissions.MANAGE_ROLES)) {
      throw new ForbiddenError('You do not have permission to manage roles');
    }

    // Validate the target member exists in this server
    const member = await prisma.serverMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.serverId !== serverId) {
      throw new NotFoundError('Member not found in this server');
    }

    // Validate the role exists in this server
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.serverId !== serverId) {
      throw new NotFoundError('Role not found in this server');
    }

    if (role.isDefault) {
      throw new BadRequestError('Cannot explicitly assign the default @everyone role');
    }

    // Check if already assigned
    const existing = await prisma.memberRole.findUnique({
      where: { memberId_roleId: { memberId, roleId } },
    });

    if (existing) {
      throw new BadRequestError('Member already has this role');
    }

    const memberRole = await prisma.memberRole.create({
      data: { memberId, roleId },
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

    res.status(201).json(memberRole);
  }),
);

// ===========================================================================
// DELETE /:serverId/members/:memberId/roles/:roleId - Remove role from member
// ===========================================================================

router.delete(
  '/:serverId/members/:memberId/roles/:roleId',
  requireServerMember,
  asyncHandler(async (req: Request, res: Response) => {
    const { serverId, memberId, roleId } = req.params;
    const userId = req.user!.userId;

    const perms = await getMemberPermissions(userId, serverId);
    if (!hasPermission(perms, Permissions.MANAGE_ROLES)) {
      throw new ForbiddenError('You do not have permission to manage roles');
    }

    // Validate the member belongs to this server
    const member = await prisma.serverMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.serverId !== serverId) {
      throw new NotFoundError('Member not found in this server');
    }

    // Validate the role belongs to this server
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.serverId !== serverId) {
      throw new NotFoundError('Role not found in this server');
    }

    const memberRole = await prisma.memberRole.findUnique({
      where: { memberId_roleId: { memberId, roleId } },
    });

    if (!memberRole) {
      throw new BadRequestError('Member does not have this role');
    }

    await prisma.memberRole.delete({
      where: { id: memberRole.id },
    });

    res.json({ message: 'Role removed from member' });
  }),
);

export default router;
