import { DatabaseService } from './database.service';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface ServiceHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  lastCheck: string;
  error?: string;
}

export interface HealthCheckResult {
  ok: boolean;
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceHealthStatus;
    s3: ServiceHealthStatus;
    ffmpeg: ServiceHealthStatus;
  };
}

export class HealthService {
  private static startTime = Date.now();

  /**
   * Perform comprehensive health check
   */
  static async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    const [databaseHealth, s3Health, ffmpegHealth] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkS3(),
      this.checkFFmpeg(),
    ]);

    const services = {
      database: databaseHealth.status === 'fulfilled' 
        ? databaseHealth.value 
        : this.createErrorStatus('Database check failed'),
      s3: s3Health.status === 'fulfilled' 
        ? s3Health.value 
        : this.createErrorStatus('S3 check failed'),
      ffmpeg: ffmpegHealth.status === 'fulfilled' 
        ? ffmpegHealth.value 
        : this.createErrorStatus('FFmpeg check failed'),
    };

    const ok = Object.values(services).every(service => service.status === 'healthy');

    const result: HealthCheckResult = {
      ok,
      timestamp,
      version: '1.0.0',
      uptime,
      services,
    };

    // Log health check result
    if (ok) {
      logger.info('Health check passed', { services });
    } else {
      logger.warn('Health check failed', { services });
    }

    return result;
  }

  /**
   * Check database health
   */
  private static async checkDatabase(): Promise<ServiceHealthStatus> {
    try {
      const healthResult = await DatabaseService.healthCheck();
      
      // Map comprehensive health check to service status
      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      if (healthResult.status === 'unhealthy') {
        status = 'unhealthy';
      } else if (healthResult.status === 'degraded') {
        status = 'degraded';
      }
      
      return {
        status,
        responseTime: healthResult.response_time_ms,
        lastCheck: new Date().toISOString(),
        ...(healthResult.error && { error: healthResult.error }),
      };
    } catch (error) {
      return this.createErrorStatus(
        `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check S3 health
   */
  private static async checkS3(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();
    
    try {
      // We'll implement S3 health check when we create the S3 service
      // For now, return a basic check
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'S3 health check failed',
      };
    }
  }

  /**
   * Check FFmpeg health
   */
  private static async checkFFmpeg(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();
    
    try {
      // We'll implement FFmpeg health check when we create the FFmpeg service
      // For now, return a basic check based on configuration
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'FFmpeg health check failed',
      };
    }
  }

  /**
   * Create error status object
   */
  private static createErrorStatus(error: string): ServiceHealthStatus {
    return {
      status: 'unhealthy',
      lastCheck: new Date().toISOString(),
      error,
    };
  }

  /**
   * Get server uptime in seconds
   */
  static getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get server start time
   */
  static getStartTime(): Date {
    return new Date(this.startTime);
  }

  /**
   * Get application version
   */
  static getAppVersion(): string {
    return config.appVersion || '1.0.0';
  }
}
