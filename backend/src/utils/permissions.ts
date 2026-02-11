import prisma from '../lib/prisma';

/**
 * Permission bit flags.
 * Each permission is a power of 2 so they can be combined with bitwise OR.
 */
export const Permissions = {
  ADMINISTRATOR:       BigInt(1) << BigInt(0),   // 0x01
  MANAGE_SERVER:       BigInt(1) << BigInt(1),   // 0x02
  MANAGE_CHANNELS:     BigInt(1) << BigInt(2),   // 0x04
  MANAGE_ROLES:        BigInt(1) << BigInt(3),   // 0x08
  MANAGE_MESSAGES:     BigInt(1) << BigInt(4),   // 0x10
  KICK_MEMBERS:        BigInt(1) << BigInt(5),   // 0x20
  SEND_MESSAGES:       BigInt(1) << BigInt(6),   // 0x40
  READ_MESSAGES:       BigInt(1) << BigInt(7),   // 0x80
  EMBED_LINKS:         BigInt(1) << BigInt(8),   // 0x100
  ATTACH_FILES:        BigInt(1) << BigInt(9),   // 0x200
  MANAGE_EMOJIS:       BigInt(1) << BigInt(10),  // 0x400
  CONNECT_VOICE:       BigInt(1) << BigInt(11),  // 0x800
  SPEAK:               BigInt(1) << BigInt(12),  // 0x1000
  MUTE_MEMBERS:        BigInt(1) << BigInt(13),  // 0x2000
  DEAFEN_MEMBERS:      BigInt(1) << BigInt(14),  // 0x4000
  MOVE_MEMBERS:        BigInt(1) << BigInt(15),  // 0x8000
  BAN_MEMBERS:         BigInt(1) << BigInt(16),  // 0x10000
  CREATE_INVITE:       BigInt(1) << BigInt(17),  // 0x20000
  CHANGE_NICKNAME:     BigInt(1) << BigInt(18),  // 0x40000
  MANAGE_NICKNAMES:    BigInt(1) << BigInt(19),  // 0x80000
  MANAGE_WEBHOOKS:     BigInt(1) << BigInt(20),  // 0x100000
  VIEW_AUDIT_LOG:      BigInt(1) << BigInt(21),  // 0x200000
  PIN_MESSAGES:        BigInt(1) << BigInt(22),  // 0x400000
  MENTION_EVERYONE:    BigInt(1) << BigInt(23),  // 0x800000
} as const;

/**
 * Default permissions given to the @everyone role.
 */
export const DEFAULT_PERMISSIONS =
  Permissions.SEND_MESSAGES |
  Permissions.READ_MESSAGES |
  Permissions.CONNECT_VOICE |
  Permissions.SPEAK |
  Permissions.EMBED_LINKS |
  Permissions.ATTACH_FILES |
  Permissions.CREATE_INVITE |
  Permissions.CHANGE_NICKNAME;

/**
 * Check if a combined permission value includes a specific permission.
 */
export function hasPermission(permissions: bigint, permission: bigint): boolean {
  // Administrator bypasses all checks
  if ((permissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) {
    return true;
  }
  return (permissions & permission) === permission;
}

/**
 * Compute the combined permissions for a member across all their roles.
 */
export function computePermissions(rolePermissions: bigint[]): bigint {
  let combined = BigInt(0);
  for (const perms of rolePermissions) {
    combined |= perms;
  }
  return combined;
}

/**
 * Get the combined permissions for a specific user in a specific server.
 * Returns the bitwise OR of all permissions from all roles the member has.
 * Returns BigInt(0) if the user is not a member of the server.
 *
 * Server owners always have ADMINISTRATOR permission.
 */
export async function getMemberPermissions(userId: string, serverId: string): Promise<bigint> {
  // Check if the user is the server owner
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { ownerId: true },
  });

  if (!server) {
    return BigInt(0);
  }

  // Server owner has all permissions
  if (server.ownerId === userId) {
    return Object.values(Permissions).reduce((acc, perm) => acc | perm, BigInt(0));
  }

  // Get the member's entry
  const member = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: { userId, serverId },
    },
    include: {
      roles: {
        include: {
          role: { select: { permissions: true } },
        },
      },
    },
  });

  if (!member) {
    return BigInt(0);
  }

  // Get the @everyone role for this server (all members implicitly have it)
  const defaultRole = await prisma.role.findFirst({
    where: { serverId, isDefault: true },
    select: { permissions: true },
  });

  const rolePermissions: bigint[] = [];

  if (defaultRole) {
    rolePermissions.push(defaultRole.permissions);
  }

  for (const memberRole of member.roles) {
    rolePermissions.push(memberRole.role.permissions);
  }

  return computePermissions(rolePermissions);
}

/**
 * Check if a user has a specific permission in a server.
 */
export async function checkMemberPermission(
  userId: string,
  serverId: string,
  permission: bigint
): Promise<boolean> {
  const perms = await getMemberPermissions(userId, serverId);
  return hasPermission(perms, permission);
}

export default {
  Permissions,
  DEFAULT_PERMISSIONS,
  hasPermission,
  computePermissions,
  getMemberPermissions,
  checkMemberPermission,
};
