import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

// Channel Points helpers - sub-millisecond operations via Redis
export const pointsKey = (userId: string, serverId: string) =>
  `points:${serverId}:${userId}`;

export const presenceKey = (userId: string) => `presence:${userId}`;

export const streamViewersKey = (streamId: string) => `stream:viewers:${streamId}`;

export const trendingKey = () => `pulse:trending`;

export async function getPoints(userId: string, serverId: string): Promise<number> {
  const val = await redis.get(pointsKey(userId, serverId));
  return val ? parseInt(val, 10) : 0;
}

export async function addPoints(userId: string, serverId: string, amount: number): Promise<number> {
  return redis.incrby(pointsKey(userId, serverId), amount);
}

export async function deductPoints(userId: string, serverId: string, amount: number): Promise<number> {
  return redis.decrby(pointsKey(userId, serverId), amount);
}

export async function setPresence(userId: string, status: string, meta?: Record<string, string>): Promise<void> {
  const key = presenceKey(userId);
  await redis.hset(key, 'status', status, 'updatedAt', Date.now().toString());
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      await redis.hset(key, k, v);
    }
  }
  await redis.expire(key, 300); // 5 min TTL, refreshed by heartbeat
}

export async function getPresence(userId: string): Promise<Record<string, string> | null> {
  const data = await redis.hgetall(presenceKey(userId));
  return Object.keys(data).length > 0 ? data : null;
}

export default redis;
