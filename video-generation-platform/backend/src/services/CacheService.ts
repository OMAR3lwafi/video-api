import Redis, { Redis as RedisClient } from 'ioredis';
import { createHash } from 'crypto';
import { promisify } from 'util';
import zlib from 'zlib';
import { logger } from '../utils/logger';
import { MetricsCollector } from '../utils/MetricsCollector';

// Promisify zlib functions
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  useMemoryCache?: boolean;
  namespace?: string;
  tags?: string[];
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  avgResponseTime: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  compressed: boolean;
  tags?: string[];
}

type CacheKey = string | number;
type CacheValue = any;

export class CacheService {
  private redis: RedisClient;
  private memoryCache: Map<string, CacheEntry<any>>;
  private metrics: CacheMetrics;
  private metricsCollector: MetricsCollector;
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly MEMORY_CACHE_MAX_SIZE = 1000;
  private readonly COMPRESSION_THRESHOLD = 1024; // 1KB
  private readonly DEFAULT_NAMESPACE = 'vgp'; // Video Generation Platform

  // Cache TTL configurations for different data types
  private readonly TTL_CONFIGS = {
    // User data
    user_profile: 1800, // 30 minutes
    user_session: 3600, // 1 hour
    user_preferences: 7200, // 2 hours

    // Video processing
    video_metadata: 3600, // 1 hour
    video_processing_status: 300, // 5 minutes
    video_templates: 7200, // 2 hours
    video_thumbnails: 86400, // 24 hours

    // API responses
    api_response: 600, // 10 minutes
    api_heavy_query: 1800, // 30 minutes
    api_real_time: 60, // 1 minute

    // Database queries
    db_frequent_query: 900, // 15 minutes
    db_complex_query: 1800, // 30 minutes
    db_static_data: 86400, // 24 hours

    // System data
    system_config: 3600, // 1 hour
    system_metrics: 300, // 5 minutes
    system_health: 60, // 1 minute

    // File operations
    file_metadata: 1800, // 30 minutes
    file_upload_status: 600, // 10 minutes
    file_processing: 300, // 5 minutes
  };

  constructor() {
    this.initializeRedis();
    this.memoryCache = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      avgResponseTime: 0,
    };
    this.metricsCollector = new MetricsCollector();
    this.startMemoryCleanup();
    this.startMetricsReporting();
  }

  private initializeRedis(): void {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      // Parse Redis URL to extract connection parameters
      const url = new URL(redisUrl);
      const host = url.hostname || 'localhost';
      const port = parseInt(url.port) || 6379;
      const password = url.password || undefined;

      const redisConfig: any = {
        host,
        port,
        db: 0,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        commandTimeout: 5000,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        compression: 'gzip',
      };

      // Only add password if it exists and is not empty
      if (password && password.length > 0) {
        redisConfig.password = password;
      }

      this.redis = new Redis(redisConfig);

      this.redis.on('connect', () => {
        logger.info('Redis cache connected successfully');
      });

      this.redis.on('error', (error) => {
        logger.error('Redis cache connection error:', error);
        this.metrics.errors++;
      });

      this.redis.on('ready', () => {
        logger.info('Redis cache ready');
      });

    } catch (error) {
      logger.error('Failed to initialize Redis cache:', error);
      throw error;
    }
  }

  /**
   * Get value from cache with multi-layer strategy
   */
  async get<T>(key: CacheKey, options?: CacheOptions): Promise<T | null> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key, options?.namespace);

    try {
      // Layer 1: Memory cache (fastest)
      if (options?.useMemoryCache !== false) {
        const memoryResult = this.getFromMemory<T>(fullKey);
        if (memoryResult !== null) {
          this.recordMetric('hit', startTime);
          return memoryResult;
        }
      }

      // Layer 2: Redis cache
      const redisResult = await this.getFromRedis<T>(fullKey);
      if (redisResult !== null) {
        // Store in memory cache for faster future access
        if (options?.useMemoryCache !== false) {
          this.setInMemory(fullKey, redisResult, options?.ttl || this.DEFAULT_TTL);
        }
        this.recordMetric('hit', startTime);
        return redisResult;
      }

      this.recordMetric('miss', startTime);
      return null;

    } catch (error) {
      logger.error(`Cache get error for key ${fullKey}:`, error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Set value in cache with multi-layer strategy
   */
  async set<T>(
    key: CacheKey,
    value: T,
    options?: CacheOptions
  ): Promise<boolean> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key, options?.namespace);
    const ttl = this.getTTL(key, options?.ttl);

    try {
      // Set in Redis
      const redisSuccess = await this.setInRedis(fullKey, value, ttl, {
        compress: options?.compress,
        tags: options?.tags,
      });

      // Set in memory cache
      if (options?.useMemoryCache !== false && redisSuccess) {
        this.setInMemory(fullKey, value, ttl, options?.tags);
      }

      this.recordMetric('set', startTime);
      return redisSuccess;

    } catch (error) {
      logger.error(`Cache set error for key ${fullKey}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Delete from cache
   */
  async delete(key: CacheKey, options?: CacheOptions): Promise<boolean> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key, options?.namespace);

    try {
      // Delete from memory cache
      this.memoryCache.delete(fullKey);

      // Delete from Redis
      const result = await this.redis.del(fullKey);

      this.recordMetric('delete', startTime);
      return result > 0;

    } catch (error) {
      logger.error(`Cache delete error for key ${fullKey}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: CacheKey[], options?: CacheOptions): Promise<(T | null)[]> {
    const fullKeys = keys.map(key => this.buildKey(key, options?.namespace));
    const results: (T | null)[] = new Array(keys.length).fill(null);
    const redisKeys: string[] = [];
    const redisIndexes: number[] = [];

    try {
      // Check memory cache first
      if (options?.useMemoryCache !== false) {
        fullKeys.forEach((fullKey, index) => {
          const memoryResult = this.getFromMemory<T>(fullKey);
          if (memoryResult !== null) {
            results[index] = memoryResult;
          } else {
            redisKeys.push(fullKey);
            redisIndexes.push(index);
          }
        });
      } else {
        redisKeys.push(...fullKeys);
        redisIndexes.push(...Array.from({ length: keys.length }, (_, i) => i));
      }

      // Get remaining keys from Redis
      if (redisKeys.length > 0) {
        const redisValues = await this.redis.mget(...redisKeys);

        for (let i = 0; i < redisValues.length; i++) {
          const value = redisValues[i];
          const originalIndex = redisIndexes[i];

          if (value) {
            const parsed = await this.deserializeValue<T>(value);
            results[originalIndex] = parsed;

            // Cache in memory
            if (options?.useMemoryCache !== false) {
              this.setInMemory(redisKeys[i], parsed, this.DEFAULT_TTL);
            }
          }
        }
      }

      return results;

    } catch (error) {
      logger.error('Cache mget error:', error);
      this.metrics.errors++;
      return results;
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset<T>(
    keyValuePairs: Array<{ key: CacheKey; value: T; options?: CacheOptions }>,
    globalOptions?: CacheOptions
  ): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();

      for (const pair of keyValuePairs) {
        const options = { ...globalOptions, ...pair.options };
        const fullKey = this.buildKey(pair.key, options.namespace);
        const ttl = this.getTTL(pair.key, options.ttl);
        const serialized = await this.serializeValue(pair.value, {
          compress: options.compress,
          tags: options.tags,
        });

        pipeline.setex(fullKey, ttl, serialized);

        // Set in memory cache
        if (options.useMemoryCache !== false) {
          this.setInMemory(fullKey, pair.value, ttl, options.tags);
        }
      }

      const results = await pipeline.exec();
      const success = results?.every(result => result[0] === null) || false;

      this.metrics.sets += keyValuePairs.length;
      return success;

    } catch (error) {
      logger.error('Cache mset error:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Invalidate cache by pattern or tags
   */
  async invalidate(pattern?: string, tags?: string[]): Promise<number> {
    try {
      let deletedCount = 0;

      // Handle tag-based invalidation
      if (tags && tags.length > 0) {
        const tagKeys = tags.map(tag => `${this.DEFAULT_NAMESPACE}:tags:${tag}`);
        const taggedKeys = await Promise.all(
          tagKeys.map(tagKey => this.redis.smembers(tagKey))
        );

        const allTaggedKeys = taggedKeys.flat();
        if (allTaggedKeys.length > 0) {
          deletedCount += await this.redis.del(...allTaggedKeys);
          // Clean up tag references
          await this.redis.del(...tagKeys);
        }
      }

      // Handle pattern-based invalidation
      if (pattern) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          deletedCount += await this.redis.del(...keys);
        }
      }

      // Clear relevant memory cache entries
      if (pattern || tags) {
        this.clearMemoryCache(pattern, tags);
      }

      this.metrics.deletes += deletedCount;
      return deletedCount;

    } catch (error) {
      logger.error('Cache invalidation error:', error);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(warmUpData: Array<{
    key: CacheKey;
    value: any;
    options?: CacheOptions;
  }>): Promise<void> {
    logger.info(`Warming up cache with ${warmUpData.length} entries`);

    try {
      await this.mset(warmUpData);
      logger.info('Cache warm-up completed successfully');
    } catch (error) {
      logger.error('Cache warm-up failed:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheMetrics & {
    memorySize: number;
    redisConnected: boolean;
  } {
    return {
      ...this.metrics,
      memorySize: this.memoryCache.size,
      redisConnected: this.redis.status === 'ready',
    };
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      this.memoryCache.clear();
      logger.info('Cache cleared successfully');
      return true;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }

  // Private methods

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl * 1000) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setInMemory<T>(key: string, value: T, ttl: number, tags?: string[]): void {
    // Don't store if memory cache is full
    if (this.memoryCache.size >= this.MEMORY_CACHE_MAX_SIZE) {
      // Remove oldest entries
      const entries = Array.from(this.memoryCache.entries());
      entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
      const toRemove = Math.floor(this.MEMORY_CACHE_MAX_SIZE * 0.2); // Remove 20%

      for (let i = 0; i < toRemove; i++) {
        this.memoryCache.delete(entries[i][0]);
      }
    }

    this.memoryCache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl,
      compressed: false,
      tags,
    });
  }

  private async getFromRedis<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      return await this.deserializeValue<T>(value);
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  private async setInRedis<T>(
    key: string,
    value: T,
    ttl: number,
    options: { compress?: boolean; tags?: string[] } = {}
  ): Promise<boolean> {
    try {
      const serialized = await this.serializeValue(value, options);
      const result = await this.redis.setex(key, ttl, serialized);

      // Handle tags
      if (options.tags && options.tags.length > 0) {
        const pipeline = this.redis.pipeline();
        for (const tag of options.tags) {
          const tagKey = `${this.DEFAULT_NAMESPACE}:tags:${tag}`;
          pipeline.sadd(tagKey, key);
          pipeline.expire(tagKey, ttl);
        }
        await pipeline.exec();
      }

      return result === 'OK';
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error);
      return false;
    }
  }

  private async serializeValue<T>(
    value: T,
    options: { compress?: boolean; tags?: string[] } = {}
  ): Promise<string> {
    let serialized = JSON.stringify(value);
    let compressed = false;

    // Compress if needed
    if (options.compress || serialized.length > this.COMPRESSION_THRESHOLD) {
      try {
        const buffer = await gzip(Buffer.from(serialized));
        serialized = buffer.toString('base64');
        compressed = true;
      } catch (error) {
        logger.warn('Compression failed, using uncompressed value:', error);
      }
    }

    return JSON.stringify({
      data: serialized,
      compressed,
      tags: options.tags,
      timestamp: Date.now(),
    });
  }

  private async deserializeValue<T>(value: string): Promise<T> {
    try {
      const parsed = JSON.parse(value);
      let data = parsed.data;

      if (parsed.compressed) {
        const buffer = Buffer.from(data, 'base64');
        const decompressed = await gunzip(buffer);
        data = decompressed.toString();
      }

      return JSON.parse(data);
    } catch (error) {
      logger.error('Deserialization error:', error);
      throw error;
    }
  }

  private buildKey(key: CacheKey, namespace?: string): string {
    const ns = namespace || this.DEFAULT_NAMESPACE;
    const keyStr = typeof key === 'string' ? key : String(key);
    return `${ns}:${keyStr}`;
  }

  private getTTL(key: CacheKey, customTTL?: number): number {
    if (customTTL) return customTTL;

    const keyStr = String(key);
    for (const [pattern, ttl] of Object.entries(this.TTL_CONFIGS)) {
      if (keyStr.includes(pattern)) {
        return ttl;
      }
    }

    return this.DEFAULT_TTL;
  }

  private clearMemoryCache(pattern?: string, tags?: string[]): void {
    if (!pattern && !tags) {
      this.memoryCache.clear();
      return;
    }

    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      let shouldDelete = false;

      if (pattern && key.match(pattern)) {
        shouldDelete = true;
      }

      if (tags && entry.tags) {
        const hasMatchingTag = tags.some(tag => entry.tags?.includes(tag));
        if (hasMatchingTag) {
          shouldDelete = true;
        }
      }

      if (shouldDelete) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.memoryCache.delete(key));
  }

  private recordMetric(type: 'hit' | 'miss' | 'set' | 'delete', startTime: number): void {
    const responseTime = Date.now() - startTime;

    this.metrics[type === 'hit' ? 'hits' : type === 'miss' ? 'misses' : type === 'set' ? 'sets' : 'deletes']++;

    // Update average response time
    const totalOps = this.metrics.hits + this.metrics.misses + this.metrics.sets + this.metrics.deletes;
    this.metrics.avgResponseTime = ((this.metrics.avgResponseTime * (totalOps - 1)) + responseTime) / totalOps;

    // Report to metrics collector
    this.metricsCollector.recordCacheOperation(type, responseTime);
  }

  private startMemoryCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const [key, entry] of this.memoryCache.entries()) {
        if (now > entry.timestamp + entry.ttl * 1000) {
          expiredKeys.push(key);
        }
      }

      expiredKeys.forEach(key => this.memoryCache.delete(key));

      if (expiredKeys.length > 0) {
        logger.debug(`Cleaned up ${expiredKeys.length} expired memory cache entries`);
      }
    }, 300000); // Clean up every 5 minutes
  }

  private startMetricsReporting(): void {
    setInterval(() => {
      const stats = this.getStats();
      logger.debug('Cache metrics:', stats);

      // Reset metrics periodically
      if (stats.hits + stats.misses > 10000) {
        this.metrics = {
          hits: 0,
          misses: 0,
          sets: 0,
          deletes: 0,
          errors: 0,
          avgResponseTime: 0,
        };
      }
    }, 60000); // Report every minute
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const startTime = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - startTime;

      const info = await this.redis.info('memory');
      const memoryInfo = info.split('\n').reduce((acc: any, line: string) => {
        const [key, value] = line.split(':');
        if (key && value) {
          acc[key] = value.trim();
        }
        return acc;
      }, {});

      return {
        status: 'healthy',
        details: {
          redisConnected: this.redis.status === 'ready',
          responseTime,
          memoryUsed: memoryInfo.used_memory_human,
          memoryCacheSize: this.memoryCache.size,
          metrics: this.metrics,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          redisConnected: false,
        },
      };
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();
export default cacheService;
