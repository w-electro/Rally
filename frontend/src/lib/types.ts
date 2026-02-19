// ==================== User Types ====================
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  status: UserStatus;
  customStatus?: string;
  currentGame?: string;
  isStreaming: boolean;
  isVerified: boolean;
  gamingStats?: GamingStats;
  linkedAccounts?: Record<string, string>;
  createdAt: string;
}

export type UserStatus = 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE' | 'IN_GAME' | 'STREAMING';

export interface GamingStats {
  gamesPlayed: string[];
  achievements: Achievement[];
  hours: Record<string, number>;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  earnedAt: string;
}

// ==================== Server Types ====================
export interface Server {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  bannerUrl?: string;
  ownerId: string;
  isPublic: boolean;
  memberCount?: number;
  channels?: Channel[];
  roles?: Role[];
  createdAt: string;
}

export interface ServerMember {
  id: string;
  userId: string;
  serverId: string;
  nickname?: string;
  user: User;
  roles: { role: Role }[];
  joinedAt: string;
}

export interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: string;
  isDefault: boolean;
}

// ==================== Channel Types ====================
export interface Channel {
  id: string;
  serverId: string;
  name: string;
  topic?: string;
  type: ChannelType;
  position: number;
  parentId?: string;
  children?: Channel[];
}

export type ChannelType = 'TEXT' | 'VOICE' | 'FEED' | 'STAGE' | 'CATEGORY' | 'ANNOUNCEMENT';

// ==================== Message Types ====================
export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  type: MessageType;
  isPinned: boolean;
  isEdited: boolean;
  replyToId?: string;
  repostOf?: string;
  embeds?: any[];
  attachments?: Attachment[];
  reactions?: Record<string, string[]>;
  author: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  replyTo?: {
    id: string;
    content: string;
    author: Pick<User, 'id' | 'username' | 'displayName'>;
  };
  createdAt: string;
  updatedAt: string;
}

export type MessageType = 'DEFAULT' | 'SYSTEM' | 'JOIN' | 'LEAVE' | 'PIN' | 'BOOST';

export interface Attachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

// ==================== DM Types ====================
export interface DmConversation {
  id: string;
  isGroup: boolean;
  name?: string;
  members: { user: User }[];
  lastMessage?: DirectMessage;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  isEncrypted: boolean;
  isRead: boolean;
  sender: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  createdAt: string;
}

// ==================== Feed Types ====================
export interface FeedPost {
  id: string;
  channelId: string;
  authorId: string;
  caption?: string;
  mediaUrls: MediaItem[];
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  isHighlight: boolean;
  isLiked?: boolean;
  author: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  createdAt: string;
}

export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  thumbnail?: string;
}

export interface FeedComment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  replyToId?: string;
  author: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  replies?: FeedComment[];
  createdAt: string;
}

// ==================== Story Types ====================
export interface Story {
  id: string;
  serverId: string;
  authorId: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'TEXT';
  caption?: string;
  viewCount: number;
  author: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  expiresAt: string;
  createdAt: string;
}

// ==================== Pulse Types ====================
export interface PulsePost {
  id: string;
  authorId: string;
  content: string;
  mediaUrls?: MediaItem[];
  hashtags: string[];
  likeCount: number;
  repostCount: number;
  replyCount: number;
  viewCount: number;
  viralScore: number;
  replyToId?: string;
  isRepost: boolean;
  isLiked?: boolean;
  isReposted?: boolean;
  author: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  replyTo?: PulsePost;
  createdAt: string;
}

export interface TrendingHashtag {
  id: string;
  tag: string;
  postCount: number;
  score: number;
}

// ==================== Streaming Types ====================
export interface StreamSession {
  id: string;
  streamerId: string;
  serverId: string;
  channelId: string;
  title?: string;
  category?: string;
  isLive: boolean;
  viewerCount: number;
  peakViewers: number;
  streamer: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  startedAt: string;
  endedAt?: string;
}

// ==================== Points Types ====================
export interface PointBalance {
  balance: number;
  totalEarned: number;
}

export interface PointReward {
  id: string;
  serverId: string;
  title: string;
  description?: string;
  cost: number;
  iconUrl?: string;
  isEnabled: boolean;
  maxPerStream?: number;
  cooldownSec?: number;
}

export interface PointTransaction {
  id: string;
  userId: string;
  serverId: string;
  amount: number;
  type: string;
  reason?: string;
  createdAt: string;
}

// ==================== Commerce Types ====================
export interface Product {
  id: string;
  serverId: string;
  sellerId: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  type: string;
  imageUrl?: string;
  isActive: boolean;
  seller: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  createdAt: string;
}

export interface Purchase {
  id: string;
  productId: string;
  buyerId: string;
  amount: number;
  currency: string;
  status: string;
  product: Product;
  createdAt: string;
}

// ==================== Gaming Types ====================
export interface GameSession {
  id: string;
  serverId: string;
  title: string;
  game: string;
  scheduledAt: string;
  maxPlayers?: number;
  description?: string;
  members: GameSessionMember[];
  createdAt: string;
}

export interface GameSessionMember {
  id: string;
  userId: string;
  status: 'INTERESTED' | 'CONFIRMED' | 'DECLINED';
  user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
}

// ==================== Notification Types ====================
export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

// ==================== Voice State ====================
export interface VoiceState {
  channelId: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
}

export interface VoiceParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isStreaming: boolean;
}
