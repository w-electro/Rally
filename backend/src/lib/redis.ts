import { config } from '../config';

// In-memory fallback store when Redis is not available
const memStore = new Map<string, any>();
let redisClient: any = null;
let redisAvailable = false;

// Try to connect to Redis; if it fails, silently fall back to in-memory
async function tryConnectRedis() {
  try {
    const Redis = (await import('ioredis')).default;
    const client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1,
      retryStrategy() { return null; }, // don't retry - fail fast
      lazyConnect: true,
    });

    // Must add error listener BEFORE connect() to avoid unhandled error event
    client.on('error', () => { redisAvailable = false; });

    await client.connect();
    redisClient = client;
    redisAvailable = true;
    console.log('✓ Connected to Redis');
  } catch {
    console.log('ℹ Redis not available — using in-memory fallback (channel points will reset on restart)');
  }
}

tryConnectRedis();

// Export raw client (may be null - only use via helper functions below)
export { redisClient as redis };

export const pointsKey = (userId: string, serverId: string) => `points:${serverId}:${userId}`;
export const presenceKey = (userId: string) => `presence:${userId}`;
export const streamViewersKey = (streamId: string) => `stream:viewers:${streamId}`;
export const trendingKey = () => `pulse:trending`;

export async function getPoints(userId: string, serverId: string): Promise<number> {
  const key = pointsKey(userId, serverId);
  if (redisAvailable && redisClient) {
    try {
      const val = await redisClient.get(key);
      return val ? parseInt(val, 10) : 0;
    } catch { /* fall through */ }
  }
  return parseInt(memStore.get(key) ?? '0', 10);
}

export async function addPoints(userId: string, serverId: string, amount: number): Promise<number> {
  const key = pointsKey(userId, serverId);
  if (redisAvailable && redisClient) {
    try { return await redisClient.incrby(key, amount); } catch { /* fall through */ }
  }
  const current = parseInt(memStore.get(key) ?? '0', 10) + amount;
  memStore.set(key, String(current));
  return current;
}

export async function deductPoints(userId: string, serverId: string, amount: number): Promise<number> {
  const key = pointsKey(userId, serverId);
  if (redisAvailable && redisClient) {
    try { return await redisClient.decrby(key, amount); } catch { /* fall through */ }
  }
  const current = parseInt(memStore.get(key) ?? '0', 10) - amount;
  memStore.set(key, String(current));
  return current;
}

export async function setPresence(userId: string, status: string, meta?: Record<string, string>): Promise<void> {
  const data = { status, updatedAt: String(Date.now()), ...meta };
  if (redisAvailable && redisClient) {
    try {
      const key = presenceKey(userId);
      await redisClient.hset(key, ...Object.entries(data).flat());
      await redisClient.expire(key, 300);
      return;
    } catch { /* fall through */ }
  }
  memStore.set(presenceKey(userId), data);
}

export async function getPresence(userId: string): Promise<Record<string, string> | null> {
  if (redisAvailable && redisClient) {
    try {
      const data = await redisClient.hgetall(presenceKey(userId));
      return Object.keys(data).length > 0 ? data : null;
    } catch { /* fall through */ }
  }
  return memStore.get(presenceKey(userId)) ?? null;
}

export default { get: async (k: string) => memStore.get(k) ?? null };
