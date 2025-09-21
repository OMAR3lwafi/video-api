import { Request, Response } from 'express';
import { HealthService } from '../services/health.service';
import { DatabaseService } from '../services/database.service';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { getS3Service } from '@/utils/s3-factory';
import { checkFfmpeg } from '@/utils/ffmpeg-check';

class HealthController {
  /**
   * Basic health check - returns 200 if server is running
   */
  async basicHealthCheck(req: Request, res: Response): Promise<void> {
    sendSuccess(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: HealthService.getUptime(),
    });
  }

  /**
   * Detailed health check - checks all services
   */
  async detailedHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const dbHealth = await DatabaseService.healthCheck();
      const s3Health = await getS3Service().healthCheck();
      const ffmpegHealth = await checkFfmpeg();

      const healthResult = {
        ok: dbHealth.status === 'healthy' && s3Health.status === 'healthy' && ffmpegHealth.status === 'healthy',
        timestamp: new Date().toISOString(),
        version: HealthService.getAppVersion(),
        uptime: HealthService.getUptime(),
        services: {
          database: dbHealth,
          s3: s3Health,
          ffmpeg: ffmpegHealth,
        },
      };
      
      if (healthResult.ok) {
        sendSuccess(res, healthResult, 'All services healthy');
      } else {
        res.status(503).json({
          success: false,
          data: healthResult,
          message: 'Some services are unhealthy',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      sendError(
        res,
        'HealthCheckError',
        'Failed to perform health check',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Readiness check - for Kubernetes readiness probe
   */
  async readinessCheck(req: Request, res: Response): Promise<void> {
    try {
      // Check if database is connected and responsive
      const dbHealth = await DatabaseService.healthCheck();
      
      if (dbHealth.status === 'healthy') {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          reason: 'Database not healthy',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        reason: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Liveness check - for Kubernetes liveness probe
   */
  async livenessCheck(req: Request, res: Response): Promise<void> {
    // Simple check - if we can respond, we're alive
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: HealthService.getUptime(),
    });
  }
}

export const healthController = new HealthController();
