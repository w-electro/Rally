// Permission bit flags (similar to Discord's system)
export const Permissions = {
  ADMINISTRATOR:       1n << 0n,
  MANAGE_SERVER:       1n << 1n,
  MANAGE_CHANNELS:     1n << 2n,
  MANAGE_ROLES:        1n << 3n,
  MANAGE_MEMBERS:      1n << 4n,
  KICK_MEMBERS:        1n << 5n,
  BAN_MEMBERS:         1n << 6n,
  CREATE_INVITE:       1n << 7n,
  SEND_MESSAGES:       1n << 8n,
  EMBED_LINKS:         1n << 9n,
  ATTACH_FILES:        1n << 10n,
  READ_MESSAGES:       1n << 11n,
  MANAGE_MESSAGES:     1n << 12n,
  MENTION_EVERYONE:    1n << 13n,
  USE_REACTIONS:       1n << 14n,
  CONNECT_VOICE:       1n << 15n,
  SPEAK:               1n << 16n,
  MUTE_MEMBERS:        1n << 17n,
  DEAFEN_MEMBERS:      1n << 18n,
  MOVE_MEMBERS:        1n << 19n,
  USE_VOICE_ACTIVITY:  1n << 20n,
  STREAM:              1n << 21n,
  MANAGE_FEED:         1n << 22n,
  POST_FEED:           1n << 23n,
  MANAGE_STORIES:      1n << 24n,
  MANAGE_POINTS:       1n << 25n,
  MANAGE_COMMERCE:     1n << 26n,
  MANAGE_AI:           1n << 27n,
  VIEW_ANALYTICS:      1n << 28n,
} as const;

// Default permission sets
export const DEFAULT_PERMISSIONS =
  Permissions.SEND_MESSAGES |
  Permissions.READ_MESSAGES |
  Permissions.EMBED_LINKS |
  Permissions.ATTACH_FILES |
  Permissions.USE_REACTIONS |
  Permissions.CONNECT_VOICE |
  Permissions.SPEAK |
  Permissions.USE_VOICE_ACTIVITY |
  Permissions.POST_FEED |
  Permissions.CREATE_INVITE;

export const ADMIN_PERMISSIONS = Object.values(Permissions).reduce((a, b) => a | b, 0n);

export function hasPermission(userPermissions: bigint, permission: bigint): boolean {
  if ((userPermissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) return true;
  return (userPermissions & permission) === permission;
}

export function computePermissions(rolePermissions: bigint[]): bigint {
  return rolePermissions.reduce((acc, p) => acc | p, 0n);
}
