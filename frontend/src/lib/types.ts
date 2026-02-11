export interface User {
  id: string;
  username: string;
  discriminator: string;
  email?: string;
  avatar?: string;
  banner?: string;
  aboutMe?: string;
  customStatus?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Server {
  id: string;
  name: string;
  icon?: string;
  banner?: string;
  description?: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice';
  topic?: string;
  position: number;
  isPrivate: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  author: User;
  content: string;
  type: 'default' | 'system' | 'join' | 'leave' | 'pin';
  attachments: Attachment[];
  reactions: Reaction[];
  replyTo?: {
    id: string;
    author: User;
    content: string;
  };
  editedAt?: string;
  isPinned: boolean;
  createdAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  me: boolean;
}

export interface ServerMember {
  id: string;
  userId: string;
  user: User;
  serverId: string;
  nickname?: string;
  roles: Role[];
  joinedAt: string;
}

export interface Friend {
  id: string;
  user: User;
  status: 'accepted' | 'pending_incoming' | 'pending_outgoing' | 'blocked';
  createdAt: string;
}

export interface Role {
  id: string;
  serverId: string;
  name: string;
  color: string;
  position: number;
  permissions: string[];
  isDefault: boolean;
}

export interface VoiceParticipant {
  userId: string;
  user: User;
  channelId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  stream?: MediaStream;
}

export interface Invite {
  id: string;
  code: string;
  serverId: string;
  server: Server;
  creatorId: string;
  creator: User;
  maxUses?: number;
  uses: number;
  expiresAt?: string;
  createdAt: string;
}
