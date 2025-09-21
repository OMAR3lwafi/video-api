import express from 'express';
import { config } from './config';
import { logger, requestLogger, errorLogger, correlationIdMiddleware } from './config/monitoring';
import { register } from 'prom-client';

// Core middleware imports
import { corsMiddleware } from './middlewares/corsMiddleware';
import { securityMiddleware } from './middlewares/security';
import { compressionMiddleware } from './middlewares/compression';
import { rateLimiterMiddleware } from './middlewares/rateLimiter';
import { errorHandlerMiddleware } from './middlewares/errorHandler';

// Performance optimization middleware imports
import {
  performance,
  compression as advancedCompression,
  caching,
  dbOptimization,
  memoryMonitoring,
  responseOptimization,
} from './middlewares/performance';

// Service imports
import cacheService from './services/CacheService';
import { databaseService } from './services/DatabaseOptimization';
import { cdnService } from './services/CDNService';
import { metricsCollector } from './utils/MetricsCollector';

// Route imports
import routes from './routes';

const app = express();

// Trust proxy for accurate client IPs (important for rate limiting and performance monitoring)
app.set('trust proxy', 1);

// Initialize services
const initializeServices = async () => {
  try {
    // Initialize database optimization
    logger.info('Initializing database optimization service...');

    // Initialize cache service (already initialized in constructor)
    logger.info('Cache service initialized');

    // Initialize CDN service (already initialized in constructor)
    logger.info('CDN service initialized');

    // Initialize metrics collector (already initialized in constructor)
    logger.info('Metrics collector initialized');

    // Warm up cache with frequently accessed data
    await cacheService.warmUp([
      {
        key: 'system_config',
        value: {
          version: '1.0.0',
          features: ['video_processing', 'real_time_updates', 'cdn_delivery'],
          limits: {
            maxVideoLength: 600, // 10 minutes
            maxFileSize: 100 * 1024 * 1024, // 100MB
            maxConcurrentJobs: 5,
          },
        },
        options: { ttl: 3600, namespace: 'system' },
      },
    ]);

    logger.info('Services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
  }
};

// Initialize services on startup
initializeServices();

// Performance monitoring middleware (must be first for accurate metrics)
app.use(performance);

// Memory monitoring middleware (early for resource tracking)
app.use(memoryMonitoring);

// Database optimization middleware (for query tracking)
app.use(dbOptimization);

// Basic middleware stack with size limits
app.use(
  express.json({
    limit: '50mb',
    // Performance optimizations for JSON parsing
    strict: true,
    type: ['application/json', 'application/csp-report'],
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '50mb',
    // Performance optimizations for URL encoding
    parameterLimit: 100,
    type: 'application/x-www-form-urlencoded',
  })
);

// Monitoring and Logging
app.use(correlationIdMiddleware);
app.use(requestLogger);

// Security middleware (should be early in the stack)
app.use(securityMiddleware);

// CORS middleware
app.use(corsMiddleware);

// Advanced compression middleware (replaces basic compression)
app.use(advancedCompression);

// Caching middleware (after compression, before routes)
app.use(caching);

// Response optimization middleware
app.use(responseOptimization);

// Rate limiting middleware
app.use(rateLimiterMiddleware);

// API routes
app.use('/api/v1', routes);

// Performance metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);

    // Add custom performance metrics
    const customMetrics = await metricsCollector.getPrometheusMetrics();
    const defaultMetrics = await register.metrics();

    res.end(defaultMetrics + '\n' + customMetrics);
  } catch (error) {
    logger.error('Error serving metrics:', error);
    res.status(500).send('Error serving metrics');
  }
});

// Cache management endpoints
app.get('/admin/cache/stats', async (req, res) => {
  try {
    const stats = cacheService.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
    });
  }
});

app.post('/admin/cache/clear', async (req, res) => {
  try {
    const { pattern, tags } = req.body;
    const cleared = await cacheService.invalidate(pattern, tags);

    res.json({
      success: true,
      data: { cleared },
      message: `Cleared ${cleared} cache entries`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    });
  }
});

// Database optimization endpoints
app.get('/admin/db/stats', async (req, res) => {
  try {
    const stats = databaseService.getMetrics();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting database stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get database statistics',
    });
  }
});

app.post('/admin/db/analyze', async (req, res) => {
  try {
    const analysis = await databaseService.performAnalysis();
    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error performing database analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze database performance',
    });
  }
});

app.post('/admin/db/optimize', async (req, res) => {
  try {
    const createdIndexes = await databaseService.createRecommendedIndexes();
    res.json({
      success: true,
      data: { createdIndexes },
      message: `Created ${createdIndexes.length} performance indexes`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error optimizing database:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize database',
    });
  }
});

// CDN service endpoints
app.get('/admin/cdn/stats', async (req, res) => {
  try {
    const health = await cdnService.healthCheck();
    const metrics = cdnService.getMetrics();

    res.json({
      success: true,
      data: {
        health: health.status,
        zones: health.zones,
        metrics,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting CDN stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get CDN statistics',
    });
  }
});

// System performance health check
app.get('/health/performance', async (req, res) => {
  try {
    const [cacheHealth, dbHealth, cdnHealth] = await Promise.all([
      cacheService.healthCheck(),
      databaseService.healthCheck(),
      cdnService.healthCheck(),
    ]);

    const overallStatus =
      cacheHealth.status === 'healthy' &&
      dbHealth.status === 'healthy' &&
      cdnHealth.status === 'healthy'
        ? 'healthy'
        : 'degraded';

    res.status(overallStatus === 'healthy' ? 200 : 503).json({
      status: overallStatus,
      services: {
        cache: cacheHealth,
        database: dbHealth,
        cdn: cdnHealth,
      },
      performance: metricsCollector.getStats(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Performance health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Performance health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Root endpoint with enhanced system information
app.get('/', async (req, res) => {
  try {
    const systemStats = metricsCollector.getStats();
    const cacheStats = cacheService.getStats();

    res.json({
      message: 'Dynamic Video Content Generation Platform API',
      version: '1.0.0',
      status: 'active',
      performance: {
        uptime: systemStats.uptime,
        totalRequests: systemStats.totalRequests,
        averageResponseTime: `${systemStats.averageResponseTime.toFixed(2)}ms`,
        cacheHitRate:
          cacheStats.memorySize > 0
            ? `${((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100 || 0).toFixed(1)}%`
            : 'N/A',
        memoryUsage: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`,
      },
      features: [
        'Multi-layer caching (Redis + Memory)',
        'Database connection pooling',
        'Advanced compression (Brotli + Gzip)',
        'CDN integration with optimization',
        'Real-time performance monitoring',
        'Automatic query optimization',
        'Progressive media delivery',
        'Edge caching with invalidation',
      ],
      endpoints: {
        health: '/health',
        api: '/api/v1',
        metrics: '/metrics',
        performanceHealth: '/health/performance',
        admin: {
          cache: '/admin/cache/*',
          database: '/admin/db/*',
          cdn: '/admin/cdn/*',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error generating root response:', error);
    res.status(500).json({
      message: 'Dynamic Video Content Generation Platform API',
      version: '1.0.0',
      status: 'error',
      error: 'Failed to get system information',
      timestamp: new Date().toISOString(),
    });
  }
});

// 404 handler for unknown routes
app.use('*', (req, res) => {
  // Record 404 metric
  metricsCollector.recordError('route_not_found', 'low', {
    path: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    suggestions: [
      'Check the API documentation for valid endpoints',
      'Ensure you are using the correct HTTP method',
      'Verify the API version in your request path',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Error logging and handling
app.use(errorLogger);

// Enhanced error handler with performance tracking
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Record error metrics
  metricsCollector.recordError(err.name || 'unknown_error', err.status >= 500 ? 'high' : 'medium', {
    message: err.message,
    stack: err.stack?.substring(0, 500), // Truncate stack trace
    path: req.path,
    method: req.method,
    statusCode: err.status || 500,
  });

  // Use original error handler
  errorHandlerMiddleware(err, req, res, next);
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');

  try {
    // Flush metrics
    await metricsCollector.flush();

    // Close database connections
    await databaseService.close();

    // Cleanup CDN service
    cdnService.destroy();

    // Clear cache
    await cacheService.clear();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');

  try {
    // Flush metrics
    await metricsCollector.flush();

    // Close database connections
    await databaseService.close();

    // Cleanup CDN service
    cdnService.destroy();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

export default app;
