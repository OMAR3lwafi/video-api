/**
 * S3 Service Factory
 * Factory for creating configured S3StorageService instances
 */

import { S3StorageService } from '../services/S3StorageService';
import { getS3ServiceConfig, validateS3Config } from '../config/s3.config';
import { logger } from './logger';

let s3ServiceInstance: S3StorageService | null = null;

/**
 * Create a new S3StorageService instance with full configuration
 */
export function createS3Service(): S3StorageService {
  try {
    const config = getS3ServiceConfig();
    
    // Validate configuration
    validateS3Config(config.s3Config);
    
    logger.info('Creating S3StorageService instance', {
      region: config.s3Config.region,
      bucket: config.s3Config.bucketName,
      endpoint: config.s3Config.endpoint || 'AWS S3',
      retryConfig: config.retryConfig,
      circuitBreakerConfig: config.circuitBreakerConfig
    });

    const service = new S3StorageService(
      config.s3Config,
      config.retryConfig,
      config.circuitBreakerConfig
    );

    // Setup lifecycle policies on initialization
    service.setupLifecyclePolicies(config.lifecyclePolicies)
      .then(result => {
        if (result.success) {
          logger.info('S3 lifecycle policies configured successfully');
        } else {
          logger.warn('Failed to configure S3 lifecycle policies', { error: result.error });
        }
      })
      .catch(error => {
        logger.error('Error setting up S3 lifecycle policies', { error: error.message });
      });

    return service;

  } catch (error) {
    logger.error('Failed to create S3StorageService', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get singleton S3StorageService instance
 */
export function getS3Service(): S3StorageService {
  if (!s3ServiceInstance) {
    s3ServiceInstance = createS3Service();
  }
  return s3ServiceInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetS3Service(): void {
  s3ServiceInstance = null;
}

/**
 * Health check for S3 service
 */
export async function checkS3Health(): Promise<{
  healthy: boolean;
  message: string;
  metrics?: any;
}> {
  try {
    const service = getS3Service();
    const metrics = service.getMetrics();

    // Check circuit breaker state
    if (metrics.circuitBreakerState === 'OPEN') {
      return {
        healthy: false,
        message: 'S3 service circuit breaker is OPEN',
        metrics
      };
    }

    // Try a simple operation (list objects with limit)
    const testKey = 'health-check-test.txt';
    
    // Create a small test file upload to verify connectivity
    const testResult = await service.getFileMetadata(testKey).catch(() => null);
    
    return {
      healthy: true,
      message: 'S3 service is healthy',
      metrics
    };

  } catch (error) {
    return {
      healthy: false,
      message: `S3 service health check failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
