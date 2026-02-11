/**
 * Rally Permission System
 *
 * Permissions are stored as a BigInt bitmask. Each permission is a single bit.
 * A member's effective permissions are computed by combining all their role
 * permissions and then applying any channel-level overrides.
 *
 * The server owner always has all permissions regardless of roles.
 */

// ─── Permission Flag Definitions ────────────────────────────────────────────────

/** Full administrator access - bypasses all permission checks */
export const ADMINISTRATOR        = 1n << 0n;

/** Manage server settings (name, icon, region, etc.) */
export const MANAGE_SERVER        = 1n << 1n;

/** Create, edit, delete, and reorder channels */
export const MANAGE_CHANNELS      = 1n << 2n;

/** Create, edit, delete, and reorder roles below the user's highest role */
export const MANAGE_ROLES         = 1n << 3n;

/** Kick members from the server */
export const KICK_MEMBERS         = 1n << 4n;

/** Ban members from the server */
export const BAN_MEMBERS          = 1n << 5n;

/** Send messages in text channels */
export const SEND_MESSAGES        = 1n << 6n;

/** Delete or pin messages from other members */
export const MANAGE_MESSAGES      = 1n << 7n;

/** Upload files and media attachments */
export const ATTACH_FILES         = 1n << 8n;

/** Read message history in channels */
export const READ_MESSAGE_HISTORY = 1n << 9n;

/** Mention @everyone, @here, and all roles */
export const MENTION_EVERYONE     = 1n << 10n;

/** Add reactions to messages */
export const ADD_REACTIONS        = 1n << 11n;

/** Connect to voice channels */
export const CONNECT_VOICE        = 1n << 12n;

/** Speak in voice channels */
export const SPEAK                = 1n << 13n;

/** Share video in voice channels */
export const VIDEO                = 1n << 14n;

/** Mute other members in voice channels */
export const MUTE_MEMBERS         = 1n << 15n;

/** Deafen other members in voice channels */
export const DEAFEN_MEMBERS       = 1n << 16n;

/** Move members between voice channels */
export const MOVE_MEMBERS         = 1n << 17n;

/** Use voice activity detection (vs push-to-talk requirement) */
export const USE_VOICE_ACTIVITY   = 1n << 18n;

/** Manage server emoji (create, rename, delete) */
export const MANAGE_EMOJIS        = 1n << 19n;

/** View audit log */
export const VIEW_AUDIT_LOG       = 1n << 20n;

/** Manage webhooks */
export const MANAGE_WEBHOOKS      = 1n << 21n;

/** Create and manage server invites */
export const CREATE_INVITES       = 1n << 22n;

/** Change own nickname */
export const CHANGE_NICKNAME      = 1n << 23n;

/** Change other members' nicknames */
export const MANAGE_NICKNAMES     = 1n << 24n;

/** Share screen in voice channels */
export const SHARE_SCREEN         = 1n << 25n;

/** Embed links (auto-preview URLs) */
export const EMBED_LINKS          = 1n << 26n;

/** Use external emoji from other servers */
export const USE_EXTERNAL_EMOJIS  = 1n << 27n;

/** View channels (required to see a channel at all) */
export const VIEW_CHANNEL         = 1n << 28n;

// ─── Preset Permission Sets ─────────────────────────────────────────────────────

/** All permissions combined */
export const ALL_PERMISSIONS =
  ADMINISTRATOR |
  MANAGE_SERVER |
  MANAGE_CHANNELS |
  MANAGE_ROLES |
  KICK_MEMBERS |
  BAN_MEMBERS |
  SEND_MESSAGES |
  MANAGE_MESSAGES |
  ATTACH_FILES |
  READ_MESSAGE_HISTORY |
  MENTION_EVERYONE |
  ADD_REACTIONS |
  CONNECT_VOICE |
  SPEAK |
  VIDEO |
  MUTE_MEMBERS |
  DEAFEN_MEMBERS |
  MOVE_MEMBERS |
  USE_VOICE_ACTIVITY |
  MANAGE_EMOJIS |
  VIEW_AUDIT_LOG |
  MANAGE_WEBHOOKS |
  CREATE_INVITES |
  CHANGE_NICKNAME |
  MANAGE_NICKNAMES |
  SHARE_SCREEN |
  EMBED_LINKS |
  USE_EXTERNAL_EMOJIS |
  VIEW_CHANNEL;

/** Default permissions for the @everyone role */
export const DEFAULT_PERMISSIONS =
  VIEW_CHANNEL |
  SEND_MESSAGES |
  READ_MESSAGE_HISTORY |
  ADD_REACTIONS |
  ATTACH_FILES |
  EMBED_LINKS |
  CONNECT_VOICE |
  SPEAK |
  VIDEO |
  USE_VOICE_ACTIVITY |
  CHANGE_NICKNAME |
  CREATE_INVITES;

// ─── Permission Checking Functions ──────────────────────────────────────────────

/**
 * Check whether a permission bitmask includes a specific permission.
 *
 * @param userPermissions - The combined permission bitmask for the user.
 * @param requiredPermission - The permission flag to check for.
 * @returns true if the user has the permission (or is an administrator).
 */
export function hasPermission(userPermissions: bigint, requiredPermission: bigint): boolean {
  // Administrators bypass all checks
  if ((userPermissions & ADMINISTRATOR) === ADMINISTRATOR) {
    return true;
  }
  return (userPermissions & requiredPermission) === requiredPermission;
}

/**
 * Check whether a permission bitmask includes ALL of the given permissions.
 *
 * @param userPermissions - The combined permission bitmask for the user.
 * @param requiredPermissions - Array of permission flags that are all required.
 * @returns true if the user has every listed permission (or is an administrator).
 */
export function hasAllPermissions(userPermissions: bigint, requiredPermissions: bigint[]): boolean {
  if ((userPermissions & ADMINISTRATOR) === ADMINISTRATOR) {
    return true;
  }
  return requiredPermissions.every(
    (perm) => (userPermissions & perm) === perm
  );
}

/**
 * Check whether a permission bitmask includes ANY of the given permissions.
 *
 * @param userPermissions - The combined permission bitmask for the user.
 * @param requiredPermissions - Array of permission flags where at least one is required.
 * @returns true if the user has at least one listed permission (or is an administrator).
 */
export function hasAnyPermission(userPermissions: bigint, requiredPermissions: bigint[]): boolean {
  if ((userPermissions & ADMINISTRATOR) === ADMINISTRATOR) {
    return true;
  }
  return requiredPermissions.some(
    (perm) => (userPermissions & perm) === perm
  );
}

// ─── Role / Member Permission Computation ───────────────────────────────────────

interface RolePermissionData {
  permissions: bigint;
}

interface ChannelOverride {
  roleId: string;
  allow: bigint;
  deny: bigint;
}

/**
 * Compute the effective permissions for a server member.
 *
 * Algorithm:
 * 1. If the member is the server owner, return ALL_PERMISSIONS.
 * 2. Start with the @everyone role's permissions.
 * 3. OR in the permissions from every additional role the member has.
 * 4. If the result includes ADMINISTRATOR, return ALL_PERMISSIONS.
 * 5. Return the computed permission bitmask.
 *
 * @param isOwner - Whether this member owns the server.
 * @param everyonePermissions - The base @everyone role permission bitmask.
 * @param memberRoles - Array of role permission data for the member's assigned roles.
 * @returns The effective permission bitmask.
 */
export function computeServerPermissions(
  isOwner: boolean,
  everyonePermissions: bigint,
  memberRoles: RolePermissionData[]
): bigint {
  // Server owner always has full permissions
  if (isOwner) {
    return ALL_PERMISSIONS;
  }

  // Start with @everyone permissions
  let permissions = everyonePermissions;

  // OR in each role's permissions
  for (const role of memberRoles) {
    permissions |= role.permissions;
  }

  // Administrators get everything
  if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) {
    return ALL_PERMISSIONS;
  }

  return permissions;
}

/**
 * Compute the effective permissions for a member within a specific channel,
 * taking into account channel-level permission overrides.
 *
 * Algorithm:
 * 1. Start with the member's server-level permissions.
 * 2. If the member is an admin (server-level), return ALL_PERMISSIONS.
 * 3. Apply channel overrides:
 *    a. First apply the @everyone override (deny then allow).
 *    b. Then apply all role-specific overrides the member has.
 * 4. Return the resulting permission bitmask.
 *
 * @param serverPermissions - The member's computed server-level permissions.
 * @param everyoneRoleId - The ID of the @everyone role.
 * @param memberRoleIds - Array of role IDs the member has.
 * @param channelOverrides - Array of channel permission overrides for the channel.
 * @returns The effective channel-level permission bitmask.
 */
export function computeChannelPermissions(
  serverPermissions: bigint,
  everyoneRoleId: string,
  memberRoleIds: string[],
  channelOverrides: ChannelOverride[]
): bigint {
  // Administrators bypass channel-level overrides
  if ((serverPermissions & ADMINISTRATOR) === ADMINISTRATOR) {
    return ALL_PERMISSIONS;
  }

  let permissions = serverPermissions;

  // Apply @everyone channel overrides first
  const everyoneOverride = channelOverrides.find(
    (o) => o.roleId === everyoneRoleId
  );
  if (everyoneOverride) {
    permissions &= ~everyoneOverride.deny;
    permissions |= everyoneOverride.allow;
  }

  // Collect allow/deny from all the member's role overrides
  let roleAllow = 0n;
  let roleDeny = 0n;

  for (const override of channelOverrides) {
    if (memberRoleIds.includes(override.roleId) && override.roleId !== everyoneRoleId) {
      roleAllow |= override.allow;
      roleDeny |= override.deny;
    }
  }

  permissions &= ~roleDeny;
  permissions |= roleAllow;

  return permissions;
}

/**
 * Get a human-readable list of permission names from a bitmask.
 * Useful for debugging and display purposes.
 */
export function getPermissionNames(permissions: bigint): string[] {
  const names: string[] = [];
  const permMap: [bigint, string][] = [
    [ADMINISTRATOR, "ADMINISTRATOR"],
    [MANAGE_SERVER, "MANAGE_SERVER"],
    [MANAGE_CHANNELS, "MANAGE_CHANNELS"],
    [MANAGE_ROLES, "MANAGE_ROLES"],
    [KICK_MEMBERS, "KICK_MEMBERS"],
    [BAN_MEMBERS, "BAN_MEMBERS"],
    [SEND_MESSAGES, "SEND_MESSAGES"],
    [MANAGE_MESSAGES, "MANAGE_MESSAGES"],
    [ATTACH_FILES, "ATTACH_FILES"],
    [READ_MESSAGE_HISTORY, "READ_MESSAGE_HISTORY"],
    [MENTION_EVERYONE, "MENTION_EVERYONE"],
    [ADD_REACTIONS, "ADD_REACTIONS"],
    [CONNECT_VOICE, "CONNECT_VOICE"],
    [SPEAK, "SPEAK"],
    [VIDEO, "VIDEO"],
    [MUTE_MEMBERS, "MUTE_MEMBERS"],
    [DEAFEN_MEMBERS, "DEAFEN_MEMBERS"],
    [MOVE_MEMBERS, "MOVE_MEMBERS"],
    [USE_VOICE_ACTIVITY, "USE_VOICE_ACTIVITY"],
    [MANAGE_EMOJIS, "MANAGE_EMOJIS"],
    [VIEW_AUDIT_LOG, "VIEW_AUDIT_LOG"],
    [MANAGE_WEBHOOKS, "MANAGE_WEBHOOKS"],
    [CREATE_INVITES, "CREATE_INVITES"],
    [CHANGE_NICKNAME, "CHANGE_NICKNAME"],
    [MANAGE_NICKNAMES, "MANAGE_NICKNAMES"],
    [SHARE_SCREEN, "SHARE_SCREEN"],
    [EMBED_LINKS, "EMBED_LINKS"],
    [USE_EXTERNAL_EMOJIS, "USE_EXTERNAL_EMOJIS"],
    [VIEW_CHANNEL, "VIEW_CHANNEL"],
  ];

  for (const [flag, name] of permMap) {
    if ((permissions & flag) === flag) {
      names.push(name);
    }
  }

  return names;
}

export default {
  // Permission flags
  ADMINISTRATOR,
  MANAGE_SERVER,
  MANAGE_CHANNELS,
  MANAGE_ROLES,
  KICK_MEMBERS,
  BAN_MEMBERS,
  SEND_MESSAGES,
  MANAGE_MESSAGES,
  ATTACH_FILES,
  READ_MESSAGE_HISTORY,
  MENTION_EVERYONE,
  ADD_REACTIONS,
  CONNECT_VOICE,
  SPEAK,
  VIDEO,
  MUTE_MEMBERS,
  DEAFEN_MEMBERS,
  MOVE_MEMBERS,
  USE_VOICE_ACTIVITY,
  MANAGE_EMOJIS,
  VIEW_AUDIT_LOG,
  MANAGE_WEBHOOKS,
  CREATE_INVITES,
  CHANGE_NICKNAME,
  MANAGE_NICKNAMES,
  SHARE_SCREEN,
  EMBED_LINKS,
  USE_EXTERNAL_EMOJIS,
  VIEW_CHANNEL,
  // Presets
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  // Functions
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  computeServerPermissions,
  computeChannelPermissions,
  getPermissionNames,
};
