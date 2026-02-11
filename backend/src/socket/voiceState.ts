// ─── Voice State Management ─────────────────────────────────────────────────────
// Tracks which users are in which voice channels and their mute/deafen/video state.

export interface VoiceState {
  userId: string;
  channelId: string;
  muted: boolean;
  deafened: boolean;
  video: boolean;
  screenShare: boolean;
  joinedAt: Date;
}

// Key: `${channelId}:${userId}` -> VoiceState
const voiceStates = new Map<string, VoiceState>();

// Key: channelId -> Set of userIds currently in the channel
const voiceChannelMembers = new Map<string, Set<string>>();

function stateKey(channelId: string, userId: string): string {
  return `${channelId}:${userId}`;
}

/**
 * Add a user to a voice channel. If the user is already in another voice channel,
 * they are removed from the old one first.
 */
export function joinVoiceChannel(
  channelId: string,
  userId: string,
  options?: Partial<Pick<VoiceState, 'muted' | 'deafened' | 'video' | 'screenShare'>>
): VoiceState {
  // Remove from any existing voice channel first
  const existingChannel = getUserCurrentChannel(userId);
  if (existingChannel) {
    leaveVoiceChannel(existingChannel, userId);
  }

  const state: VoiceState = {
    userId,
    channelId,
    muted: options?.muted ?? false,
    deafened: options?.deafened ?? false,
    video: options?.video ?? false,
    screenShare: options?.screenShare ?? false,
    joinedAt: new Date(),
  };

  voiceStates.set(stateKey(channelId, userId), state);

  if (!voiceChannelMembers.has(channelId)) {
    voiceChannelMembers.set(channelId, new Set());
  }
  voiceChannelMembers.get(channelId)!.add(userId);

  return state;
}

/**
 * Remove a user from a voice channel. Returns the removed state or null if not found.
 */
export function leaveVoiceChannel(channelId: string, userId: string): VoiceState | null {
  const key = stateKey(channelId, userId);
  const state = voiceStates.get(key) ?? null;

  voiceStates.delete(key);

  const members = voiceChannelMembers.get(channelId);
  if (members) {
    members.delete(userId);
    if (members.size === 0) {
      voiceChannelMembers.delete(channelId);
    }
  }

  return state;
}

/**
 * Remove a user from whatever voice channel they are currently in.
 * Returns the channel ID they left, or null.
 */
export function leaveAllVoiceChannels(userId: string): { channelId: string; state: VoiceState } | null {
  const channelId = getUserCurrentChannel(userId);
  if (!channelId) return null;

  const state = leaveVoiceChannel(channelId, userId);
  if (!state) return null;

  return { channelId, state };
}

/**
 * Get all users currently in a voice channel with their voice states.
 */
export function getVoiceChannelUsers(channelId: string): VoiceState[] {
  const members = voiceChannelMembers.get(channelId);
  if (!members) return [];

  const states: VoiceState[] = [];
  for (const userId of members) {
    const state = voiceStates.get(stateKey(channelId, userId));
    if (state) {
      states.push(state);
    }
  }

  return states;
}

/**
 * Get the voice state of a specific user in a specific channel.
 */
export function getUserVoiceState(channelId: string, userId: string): VoiceState | null {
  return voiceStates.get(stateKey(channelId, userId)) ?? null;
}

/**
 * Find which voice channel a user is currently in, if any.
 */
export function getUserCurrentChannel(userId: string): string | null {
  for (const [channelId, members] of voiceChannelMembers) {
    if (members.has(userId)) {
      return channelId;
    }
  }
  return null;
}

/**
 * Update a user's voice state (mute, deafen, video, screen share).
 * Returns the updated state or null if the user is not in the channel.
 */
export function updateVoiceState(
  channelId: string,
  userId: string,
  updates: Partial<Pick<VoiceState, 'muted' | 'deafened' | 'video' | 'screenShare'>>
): VoiceState | null {
  const key = stateKey(channelId, userId);
  const state = voiceStates.get(key);

  if (!state) return null;

  const updated: VoiceState = {
    ...state,
    ...updates,
  };

  voiceStates.set(key, updated);
  return updated;
}

/**
 * Get user IDs of everyone in a voice channel.
 */
export function getVoiceChannelUserIds(channelId: string): string[] {
  const members = voiceChannelMembers.get(channelId);
  if (!members) return [];
  return Array.from(members);
}

/**
 * Check if a voice channel has any users.
 */
export function isVoiceChannelEmpty(channelId: string): boolean {
  const members = voiceChannelMembers.get(channelId);
  return !members || members.size === 0;
}

/**
 * Get count of users in a voice channel.
 */
export function getVoiceChannelUserCount(channelId: string): number {
  const members = voiceChannelMembers.get(channelId);
  return members ? members.size : 0;
}
