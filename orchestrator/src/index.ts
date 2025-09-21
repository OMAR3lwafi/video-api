import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { MasterOrchestrator } from './core/MasterOrchestrator.js';
import { Logger } from './utils/Logger.js';
import { ConfigurationManager } from './services/ConfigurationManager.js';
import {
  VideoJobRequest,
  OrchestrationResult,
  SystemHealthReport,
  SystemAnalyticsReport,
  OrchestratorError
} from './types/index.js';

class OrchestratorServer {
  private app: express.Application;
  private server: any;
  private masterOrchestrator: MasterOrchestrator;
  private logger: Logger;
  private configManager: ConfigurationManager;
  private isShuttingDown: boolean = false;

  constructor() {
    this.app = express();
    this.logger = new Logger('OrchestratorServer');
    this.configManager = ConfigurationManager.getInstance();
    this.masterOrchestrator = new MasterOrchestrator();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  /**
   * Initialize and start the orchestrator server
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting Orchestrator Server...');

      // Load configuration
      await this.configManager.loadConfiguration();

      // Initialize master orchestrator
      await this.masterOrchestrator.initialize();

      // Start HTTP server
      const port = process.env.PORT || 9000;
      this.server = createServer(this.app);

      this.server.listen(port, () => {
        this.logger.info(`Orchestrator Server listening on port ${port}`);
        this.logger.info('Server started successfully');
      });

      // Handle server errors
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          this.logger.error(`Port ${port} is already in use`);
        } else {
          this.logger.error('Server error:', error);
        }
        process.exit(1);
      });

    } catch (error) {
      this.logger.error('Failed to start Orchestrator Server:', error);
      process.exit(1);
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
      credentials: true
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      const correlationId = req.headers['x-correlation-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.http(req.method, req.path, res.statusCode, duration, {
          correlationId,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });

      req.correlationId = correlationId;
      res.setHeader('X-Correlation-ID', correlationId);
      next();
    });

    // Rate limiting (basic implementation)
    const requestCounts = new Map<string, { count: number; resetTime: number }>();
    this.app.use((req, res, next) => {
      const ip = req.ip;
      const now = Date.now();
      const windowMs = 60000; // 1 minute
      const maxRequests = 100; // 100 requests per minute

      if (!requestCounts.has(ip)) {
        requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
        next();
        return;
      }

      const data = requestCounts.get(ip)!;
      if (now > data.resetTime) {
        data.count = 1;
        data.resetTime = now + windowMs;
        next();
      } else if (data.count >= maxRequests) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((data.resetTime - now) / 1000)
        });
      } else {
        data.count++;
        next();
      }
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const healthReport = await this.masterOrchestrator.getSystemHealth();
        res.status(200).json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          uptime: process.uptime(),
          health: healthReport
        });
      } catch (error) {
        this.logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'error',
          message: 'Health check failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Readiness check endpoint
    this.app.get('/ready', async (req, res) => {
      try {
        const isReady = await this.checkReadiness();
        if (isReady) {
          res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(503).json({
            status: 'not_ready',
            message: 'Service is not ready to accept requests',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        this.logger.error('Readiness check failed:', error);
        res.status(503).json({
          status: 'error',
          message: 'Readiness check failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Main video orchestration endpoint
    this.app.post('/api/v1/orchestrate', async (req, res) => {
      const timer = this.logger.timer();
      const correlationId = req.correlationId;

      try {
        // Validate request
        const jobRequest = this.validateVideoJobRequest(req.body);

        this.logger.job(jobRequest.id, 'received', undefined, { correlationId });

        // Orchestrate video job
        const result: OrchestrationResult = await this.masterOrchestrator.orchestrateVideoJob(jobRequest);

        const duration = timer.end('video_orchestration');
        this.logger.job(jobRequest.id, result.status, duration, { correlationId });

        res.status(200).json(result);

      } catch (error) {
        const duration = timer.end('video_orchestration_failed');

        if (error instanceof OrchestratorError) {
          this.logger.error(`Orchestration failed: ${error.message}`, error, { correlationId });
          res.status(400).json({
            error: error.code,
            message: error.message,
            details: error.details
          });
        } else {
          this.logger.error('Unexpected orchestration error:', error, { correlationId });
          res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred'
          });
        }
      }
    });

    // Job status endpoint
    this.app.get('/api/v1/jobs/:jobId/status', async (req, res) => {
      try {
        const { jobId } = req.params;
        const status = await this.masterOrchestrator.getJobStatus(jobId);

        if (!status) {
          res.status(404).json({
            error: 'JOB_NOT_FOUND',
            message: 'Job not found'
          });
          return;
        }

        res.status(200).json(status);

      } catch (error) {
        this.logger.error('Failed to get job status:', error, { correlationId: req.correlationId });
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get job status'
        });
      }
    });

    // System analytics endpoint
    this.app.get('/api/v1/analytics', async (req, res) => {
      try {
        const analytics: SystemAnalyticsReport = await this.masterOrchestrator.getSystemAnalytics();
        res.status(200).json(analytics);

      } catch (error) {
        this.logger.error('Failed to get system analytics:', error, { correlationId: req.correlationId });
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get system analytics'
        });
      }
    });

    // Resource utilization endpoint
    this.app.get('/api/v1/resources', async (req, res) => {
      try {
        const resources = await this.masterOrchestrator.getResourceUtilization();
        res.status(200).json(resources);

      } catch (error) {
        this.logger.error('Failed to get resource utilization:', error, { correlationId: req.correlationId });
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get resource utilization'
        });
      }
    });

    // Configuration endpoints
    this.app.get('/api/v1/config', async (req, res) => {
      try {
        const config = this.configManager.getConfig();
        res.status(200).json(config);

      } catch (error) {
        this.logger.error('Failed to get configuration:', error, { correlationId: req.correlationId });
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get configuration'
        });
      }
    });

    this.app.put('/api/v1/config', async (req, res) => {
      try {
        this.configManager.updateConfig(req.body);
        res.status(200).json({
          message: 'Configuration updated successfully'
        });

      } catch (error) {
        this.logger.error('Failed to update configuration:', error, { correlationId: req.correlationId });
        res.status(400).json({
          error: 'CONFIG_UPDATE_FAILED',
          message: 'Failed to update configuration'
        });
      }
    });

    // Service registry endpoints
    this.app.get('/api/v1/services', async (req, res) => {
      try {
        const services = await this.masterOrchestrator.getRegisteredServices();
        res.status(200).json(services);

      } catch (error) {
        this.logger.error('Failed to get services:', error, { correlationId: req.correlationId });
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get services'
        });
      }
    });

    // Workflow management endpoints
    this.app.get('/api/v1/workflows', async (req, res) => {
      try {
        const workflows = await this.masterOrchestrator.getActiveWorkflows();
        res.status(200).json(workflows);

      } catch (error) {
        this.logger.error('Failed to get workflows:', error, { correlationId: req.correlationId });
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get workflows'
        });
      }
    });

    this.app.get('/api/v1/workflows/:workflowId', async (req, res) => {
      try {
        const { workflowId } = req.params;
        const workflow = await this.masterOrchestrator.getWorkflowStatus(workflowId);

        if (!workflow) {
          res.status(404).json({
            error: 'WORKFLOW_NOT_FOUND',
            message: 'Workflow not found'
          });
          return;
        }

        res.status(200).json(workflow);

      } catch (error) {
        this.logger.error('Failed to get workflow:', error, { correlationId: req.correlationId });
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get workflow'
        });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Endpoint not found',
        path: req.originalUrl
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled error in request:', error, { correlationId: req.correlationId });

      if (res.headersSent) {
        return next(error);
      }

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        correlationId: req.correlationId
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.fatal('Uncaught Exception:', error);
      this.gracefulShutdown('SIGTERM');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.fatal('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('SIGTERM');
    });
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    // Graceful shutdown signals
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    // Handle Docker stop signals
    process.on('SIGQUIT', () => this.gracefulShutdown('SIGQUIT'));
  }

  /**
   * Perform graceful shutdown
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    this.logger.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      // Set shutdown timeout
      const shutdownTimeout = setTimeout(() => {
        this.logger.error('Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds

      // Stop accepting new requests
      if (this.server) {
        this.server.close((err: any) => {
          if (err) {
            this.logger.error('Error closing server:', err);
          }
        });
      }

      // Shutdown master orchestrator
      await this.masterOrchestrator.shutdown();

      // Close logger
      await this.logger.close();

      clearTimeout(shutdownTimeout);
      this.logger.info('Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Validate video job request
   */
  private validateVideoJobRequest(body: any): VideoJobRequest {
    if (!body) {
      throw new OrchestratorError('Request body is required', 'INVALID_REQUEST');
    }

    if (!body.id) {
      throw new OrchestratorError('Job ID is required', 'INVALID_REQUEST');
    }

    if (!body.output_format || !['mp4', 'mov', 'avi'].includes(body.output_format)) {
      throw new OrchestratorError('Valid output_format is required (mp4, mov, avi)', 'INVALID_REQUEST');
    }

    if (!body.width || !body.height || body.width <= 0 || body.height <= 0) {
      throw new OrchestratorError('Valid width and height are required', 'INVALID_REQUEST');
    }

    if (!Array.isArray(body.elements) || body.elements.length === 0) {
      throw new OrchestratorError('At least one element is required', 'INVALID_REQUEST');
    }

    // Validate elements
    for (const element of body.elements) {
      if (!element.id || !element.type || !element.source) {
        throw new OrchestratorError('Each element must have id, type, and source', 'INVALID_REQUEST');
      }

      if (!['video', 'image'].includes(element.type)) {
        throw new OrchestratorError('Element type must be video or image', 'INVALID_REQUEST');
      }
    }

    return body as VideoJobRequest;
  }

  /**
   * Check if service is ready
   */
  private async checkReadiness(): Promise<boolean> {
    try {
      // Check if master orchestrator is initialized
      if (!this.masterOrchestrator.isInitialized) {
        return false;
      }

      // Check system health
      const health = await this.masterOrchestrator.getSystemHealth();
      return health.overall === 'healthy' || health.overall === 'degraded';

    } catch (error) {
      this.logger.error('Readiness check error:', error);
      return false;
    }
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

// Start the server
async function main(): Promise<void> {
  const server = new OrchestratorServer();
  await server.start();
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { OrchestratorServer };
export default main;
