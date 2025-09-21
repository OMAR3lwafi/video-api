import { Request, Response, NextFunction } from 'express';
import compressionModule from 'compression';
import { logger } from '../utils/logger';
import { MetricsCollector } from '../utils/MetricsCollector';
import cacheService from '../services/CacheService';
import { performance as perf } from 'perf_hooks';
import { promisify } from 'util';
import zlib from 'zlib';

// Promisify compression functions
const gzip = promisify(zlib.gzip);
const brotli = promisify(zlib.brotliCompress);

interface PerformanceMetrics {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  contentLength: number;
  compressionRatio?: number;
  cacheHit?: boolean;
  dbQueryCount?: number;
  dbQueryTime?: number;
}

interface CompressionOptions {
  threshold: number;
  level: number;
  chunkSize: number;
  windowBits: number;
  memLevel: number;
  strategy: number;
}

export class PerformanceMiddleware {
  private metricsCollector: MetricsCollector;
  private compressionOptions: CompressionOptions;
  private readonly COMPRESSION_THRESHOLD = 1024; // 1KB
  private readonly SLOW_REQUEST_THRESHOLD = 1000; // 1 second
  private readonly MEMORY_THRESHOLD = 500 * 1024 * 1024; // 500MB

  // Cache configurations for different endpoint types
  private readonly CACHE_CONFIGS = {
    '/api/v1/health': { ttl: 60, public: true },
    '/api/v1/video/templates': { ttl: 3600, public: true, tags: ['templates'] },
    '/api/v1/video/metadata': { ttl: 1800, public: false, tags: ['metadata'] },
    '/api/v1/user/profile': { ttl: 900, public: false, tags: ['user'] },
    '/api/v1/system/stats': { ttl: 300, public: true, tags: ['stats'] },
  };

  constructor() {
    this.metricsCollector = new MetricsCollector();
    this.compressionOptions = {
      threshold: this.COMPRESSION_THRESHOLD,
      level: zlib.constants.Z_DEFAULT_COMPRESSION,
      chunkSize: 16 * 1024,
      windowBits: zlib.constants.Z_DEFAULT_WINDOWBITS,
      memLevel: 8,
      strategy: zlib.constants.Z_DEFAULT_STRATEGY,
    };
  }

  /**
   * Main performance middleware
   */
  performanceMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = perf.now();
      const startCpuUsage = process.cpuUsage();
      const startMemoryUsage = process.memoryUsage();
      const requestId = this.generateRequestId();

      // Add request ID to request object
      req.requestId = requestId;
      req.startTime = startTime;

      // Set response headers for performance
      this.setPerformanceHeaders(res);

      // Track database queries
      req.dbQueries = [];
      req.dbQueryStartTime = 0;

      // Override res.end to capture metrics
      const originalEnd = res.end;
      const self = this;
      res.end = function(chunk?: any, encodingOrCb?: BufferEncoding | (() => void), cb?: () => void): any {
        const endTime = perf.now();
        const responseTime = endTime - startTime;
        const endCpuUsage = process.cpuUsage(startCpuUsage);
        const endMemoryUsage = process.memoryUsage();

        // Calculate metrics
        const metrics: PerformanceMetrics = {
          requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime,
          memoryUsage: endMemoryUsage,
          cpuUsage: endCpuUsage,
          contentLength: parseInt(res.get('content-length') || '0', 10),
          dbQueryCount: req.dbQueries?.length || 0,
          dbQueryTime: req.dbQueryTotalTime || 0,
        };

        // Log and collect metrics
        self.collectMetrics(metrics);

        // Check for performance issues
        self.checkPerformanceThresholds(metrics, req);

        // Handle different function signatures
        if (typeof encodingOrCb === 'function') {
          return originalEnd.call(this, chunk, encodingOrCb);
        } else {
          return originalEnd.call(this, chunk, encodingOrCb, cb);
        }
      };

      next();
    };
  }

  /**
   * Compression middleware with dynamic algorithm selection
   */
  compressionMiddleware() {
    return compressionModule({
      filter: this.shouldCompress.bind(this),
      threshold: this.COMPRESSION_THRESHOLD,
      level: this.compressionOptions.level,
      chunkSize: this.compressionOptions.chunkSize,
      windowBits: this.compressionOptions.windowBits,
      memLevel: this.compressionOptions.memLevel,
      strategy: this.compressionOptions.strategy,
    });
  }

  /**
   * Advanced compression middleware with Brotli support
   */
  advancedCompressionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      const originalJson = res.json;
      const self = this;

      res.send = function(this: Response, body: any): Response {
        try {
          if (body && (typeof body === 'string' || Buffer.isBuffer(body))) {
            const compressed = self.performAdvancedCompression(req, res, body);
            return originalSend.call(this, compressed);
          }
        } catch (error) {
          logger.warn('Advanced compression (send) failed:', error);
        }
        return originalSend.call(this, body);
      } as any;

      res.json = function(this: Response, obj: any): Response {
        try {
          const jsonStr = JSON.stringify(obj);
          const compressed = self.performAdvancedCompression(req, res, jsonStr);
          res.set('Content-Type', 'application/json');
          return originalSend.call(res, compressed);
        } catch (error) {
          logger.warn('Advanced compression (json) failed:', error);
          return originalJson.call(this, obj);
        }
      } as any;

      next();
    };
  }

  /**
   * Caching middleware
   */
  cachingMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = this.generateCacheKey(req);
      const cacheConfig = this.getCacheConfig(req.path);

      if (!cacheConfig) {
        return next();
      }

      try {
        // Try to get from cache
        const cachedResponse = await cacheService.get(cacheKey, {
          namespace: 'api_response',
          ttl: cacheConfig.ttl,
        });

        if (cachedResponse) {
          // Set cache headers
          this.setCacheHeaders(res, cacheConfig, true);

          // Mark as cache hit
          req.cacheHit = true;

          return res.status(cachedResponse.statusCode)
            .set(cachedResponse.headers)
            .send(cachedResponse.body);
        }

        // Override response methods to cache the response
        const originalSend = res.send;
        const originalJson = res.json;

        const cacheResponse = (body: any) => {
          if (res.statusCode === 200 && body) {
            const responseData = {
              statusCode: res.statusCode,
              headers: this.getResponseHeaders(res),
              body,
              timestamp: Date.now(),
            };

            // Cache asynchronously to avoid blocking response
            cacheService.set(cacheKey, responseData, {
              namespace: 'api_response',
              ttl: cacheConfig.ttl,
              tags: cacheConfig.tags,
            }).catch(error => {
              logger.warn('Failed to cache response:', error);
            });
          }
        };

        res.send = function(body: any) {
          cacheResponse(body);
          return originalSend.call(this, body);
        };

        res.json = function(obj: any) {
          cacheResponse(obj);
          return originalJson.call(this, obj);
        };

        // Set cache headers
        this.setCacheHeaders(res, cacheConfig, false);

      } catch (error) {
        logger.warn('Cache middleware error:', error);
      }

      next();
    };
  }

  /**
   * Database query optimization middleware
   */
  dbOptimizationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Initialize database query tracking
      req.dbQueries = [];
      req.dbQueryStartTime = 0;
      req.dbQueryTotalTime = 0;

      // Wrap database query methods to track performance
      req.trackDbQuery = (query: string, params?: any) => {
        const queryStart = perf.now();

        return {
          end: () => {
            const queryTime = perf.now() - queryStart;
            req.dbQueries.push({
              query,
              params,
              executionTime: queryTime,
              timestamp: Date.now(),
            });
            req.dbQueryTotalTime += queryTime;

            // Log slow queries
            if (queryTime > 100) { // 100ms threshold
              logger.warn('Slow database query detected:', {
                query,
                executionTime: queryTime,
                requestId: req.requestId,
              });
            }
          }
        };
      };

      next();
    };
  }

  /**
   * Memory monitoring middleware
   */
  memoryMonitoringMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const memoryUsage = process.memoryUsage();

      // Check memory usage
      if (memoryUsage.heapUsed > this.MEMORY_THRESHOLD) {
        logger.warn('High memory usage detected:', {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          requestId: req.requestId,
        });

        // Trigger garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Set warning header
        res.set('X-Memory-Warning', 'High memory usage detected');
      }

      // Add memory info to response headers in development
      if (process.env.NODE_ENV === 'development') {
        res.set('X-Memory-Heap-Used', Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB');
        res.set('X-Memory-Heap-Total', Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB');
      }

      next();
    };
  }

  /**
   * Response optimization middleware
   */
  responseOptimizationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Optimize JSON responses
      const originalJson = res.json;
      const self = this;
      res.json = function(obj: any) {
        // Remove undefined values and optimize object
        const optimized = self.optimizeObject(obj);
        return originalJson.call(this, optimized);
      };

      // Add streaming support for large responses
      res.streamJson = function(obj: any) {
        res.set('Content-Type', 'application/json');
        res.write('[');

        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            if (index > 0) res.write(',');
            res.write(JSON.stringify(item));
          });
        } else {
          res.write(JSON.stringify(obj));
        }

        res.write(']');
        res.end();
      };

      next();
    };
  }

  // Private methods

  private shouldCompress(req: Request, res: Response): boolean {
    // Don't compress if already compressed
    if (res.get('Content-Encoding')) {
      return false;
    }

    // Don't compress small responses
    const contentLength = parseInt(res.get('content-length') || '0', 10);
    if (contentLength > 0 && contentLength < this.COMPRESSION_THRESHOLD) {
      return false;
    }

    // Don't compress binary content
    const contentType = res.get('content-type') || '';
    if (contentType.includes('image/') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        contentType.includes('application/octet-stream')) {
      return false;
    }

    return compressionModule.filter(req, res);
  }

  private performAdvancedCompression(
    req: Request,
    res: Response,
    body: string | Buffer
  ): string | Buffer {
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const bodySize = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body);

    // Skip compression for small content
    if (bodySize < this.COMPRESSION_THRESHOLD) {
      return body;
    }

    try {
      const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

      // Use Brotli if supported and for larger content
      if (acceptEncoding.includes('br') && bodySize > 10240) { // 10KB threshold
        const compressed = zlib.brotliCompressSync(bodyBuffer, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: bodySize,
          }
        } as any);
        res.set('Content-Encoding', 'br');
        res.set('Content-Length', compressed.length.toString());
        return compressed;
      }

      // Fallback to gzip
      if (acceptEncoding.includes('gzip')) {
        const compressed = zlib.gzipSync(bodyBuffer, {
          level: this.compressionOptions.level,
          windowBits: this.compressionOptions.windowBits,
        } as any);
        res.set('Content-Encoding', 'gzip');
        res.set('Content-Length', compressed.length.toString());
        return compressed;
      }

      return body;
    } catch (error) {
      logger.warn('Advanced compression failed:', error);
      return body;
    }
  }

  private generateCacheKey(req: Request): string {
    const url = req.originalUrl || req.url;
    const method = req.method;
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';

    // Include relevant headers and parameters in cache key
    const keyParts = [method, url, userAgent.split('/')[0], acceptLanguage.split(',')[0]];

    return keyParts.filter(Boolean).join(':');
  }

  private getCacheConfig(path: string): { ttl: number; public: boolean; tags?: string[] } | null {
    for (const [pattern, config] of Object.entries(this.CACHE_CONFIGS)) {
      if (path.startsWith(pattern) || path.match(pattern)) {
        return config;
      }
    }
    return null;
  }

  private setCacheHeaders(
    res: Response,
    config: { ttl: number; public: boolean },
    isFromCache: boolean
  ): void {
    const maxAge = config.ttl;
    const cacheControl = config.public ? 'public' : 'private';

    res.set({
      'Cache-Control': `${cacheControl}, max-age=${maxAge}`,
      'ETag': `"${Date.now()}"`,
      'X-Cache': isFromCache ? 'HIT' : 'MISS',
      'X-Cache-TTL': maxAge.toString(),
    });

    if (isFromCache) {
      res.set('X-Cache-Hit-Time', Date.now().toString());
    }
  }

  private getResponseHeaders(res: Response): Record<string, string> {
    const headers: Record<string, string> = {};

    // Get important headers to cache
    const importantHeaders = [
      'content-type',
      'content-length',
      'etag',
      'last-modified',
      'expires',
    ];

    importantHeaders.forEach(header => {
      const value = res.get(header);
      if (value) {
        headers[header] = value;
      }
    });

    return headers;
  }

  private setPerformanceHeaders(res: Response): void {
    res.set({
      'X-DNS-Prefetch-Control': 'on',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Powered-By': 'Video Generation Platform',
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private collectMetrics(metrics: PerformanceMetrics): void {
    // Send metrics to collector
    this.metricsCollector.recordApiRequest({
      method: metrics.method,
      path: metrics.path,
      statusCode: metrics.statusCode,
      responseTime: metrics.responseTime,
      memoryUsage: metrics.memoryUsage.heapUsed,
      dbQueryCount: metrics.dbQueryCount,
      dbQueryTime: metrics.dbQueryTime,
    });

    // Log performance metrics
    logger.info('Request completed', {
      requestId: metrics.requestId,
      method: metrics.method,
      path: metrics.path,
      statusCode: metrics.statusCode,
      responseTime: `${metrics.responseTime.toFixed(2)}ms`,
      memoryUsed: `${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`,
      dbQueries: metrics.dbQueryCount,
      dbQueryTime: metrics.dbQueryTime ? `${metrics.dbQueryTime.toFixed(2)}ms` : undefined,
    });
  }

  private checkPerformanceThresholds(metrics: PerformanceMetrics, req: Request): void {
    // Check for slow requests
    if (metrics.responseTime > this.SLOW_REQUEST_THRESHOLD) {
      logger.warn('Slow request detected', {
        requestId: metrics.requestId,
        path: metrics.path,
        responseTime: metrics.responseTime,
        dbQueryTime: metrics.dbQueryTime,
        dbQueryCount: metrics.dbQueryCount,
      });
    }

    // Check for high memory usage
    if (metrics.memoryUsage.heapUsed > this.MEMORY_THRESHOLD) {
      logger.warn('High memory usage on request', {
        requestId: metrics.requestId,
        heapUsed: metrics.memoryUsage.heapUsed,
        path: metrics.path,
      });
    }

    // Check for excessive database queries
    if (metrics.dbQueryCount && metrics.dbQueryCount > 10) {
      logger.warn('High database query count', {
        requestId: metrics.requestId,
        queryCount: metrics.dbQueryCount,
        totalTime: metrics.dbQueryTime,
        path: metrics.path,
      });
    }
  }

  private optimizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.optimizeObject(item));
    }

    if (typeof obj === 'object') {
      const optimized: any = {};

      for (const [key, value] of Object.entries(obj)) {
        // Skip undefined values
        if (value === undefined) {
          continue;
        }

        // Recursively optimize nested objects
        optimized[key] = this.optimizeObject(value);
      }

      return optimized;
    }

    return obj;
  }
}

// Export singleton instance and individual middlewares
export const performanceMiddleware = new PerformanceMiddleware();

export const performance = performanceMiddleware.performanceMiddleware();
export const compression = performanceMiddleware.compressionMiddleware();
export const advancedCompression = performanceMiddleware.advancedCompressionMiddleware();
export const caching = performanceMiddleware.cachingMiddleware();
export const dbOptimization = performanceMiddleware.dbOptimizationMiddleware();
export const memoryMonitoring = performanceMiddleware.memoryMonitoringMiddleware();
export const responseOptimization = performanceMiddleware.responseOptimizationMiddleware();

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
      dbQueries?: Array<{
        query: string;
        params?: any;
        executionTime: number;
        timestamp: number;
      }>;
      dbQueryStartTime?: number;
      dbQueryTotalTime?: number;
      cacheHit?: boolean;
      trackDbQuery?: (query: string, params?: any) => { end: () => void };
    }

    interface Response {
      streamJson?: (obj: any) => void;
    }
  }
}
