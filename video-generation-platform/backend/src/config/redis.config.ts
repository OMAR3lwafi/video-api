import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL;

export const redis = redisUrl
  ? new Redis(redisUrl)
  : new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: 0,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

redis.on('error', (err) => {
  console.error('Redis Client Error', err);
});
