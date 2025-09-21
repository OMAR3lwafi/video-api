import { redis } from '@/config/redis.config';

export async function publishJobUpdate(jobId: string, payload: unknown) {
  await redis.publish(`job:${jobId}:update`, JSON.stringify(payload));
}
