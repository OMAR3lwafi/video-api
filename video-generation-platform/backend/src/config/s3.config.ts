/**
 * S3 Configuration
 * Centralized configuration for S3 storage service
 */

import { S3Config, RetryConfig, CircuitBreakerConfig, BucketLifecycleRule } from '../types/s3';

/**
 * Get S3 configuration from environment variables
 */
export function getS3Config(): S3Config {
  const requiredEnvVars = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET'
  ];

  // Validate required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  const baseConfig: S3Config = {
    region: process.env.AWS_REGION!,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    bucketName: process.env.AWS_S3_BUCKET!,
  };

  // Only include optional fields when explicitly defined to satisfy exactOptionalPropertyTypes
  if (typeof process.env.S3_ENDPOINT === 'string' && process.env.S3_ENDPOINT.length > 0) {
    (baseConfig as any).endpoint = process.env.S3_ENDPOINT;
  }
  if (typeof process.env.S3_FORCE_PATH_STYLE !== 'undefined') {
    (baseConfig as any).forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
  }

  return baseConfig;
}

/**
 * Default retry configuration
 */
export const defaultRetryConfig: RetryConfig = {
  maxRetries: parseInt(process.env.S3_MAX_RETRIES || '3'),
  baseDelay: parseInt(process.env.S3_BASE_DELAY || '1000'),
  maxDelay: parseInt(process.env.S3_MAX_DELAY || '10000'),
  backoffMultiplier: parseFloat(process.env.S3_BACKOFF_MULTIPLIER || '2'),
  jitter: process.env.S3_JITTER !== 'false'
};

/**
 * Default circuit breaker configuration
 */
export const defaultCircuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.S3_CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
  resetTimeout: parseInt(process.env.S3_CIRCUIT_BREAKER_RESET_TIMEOUT || '60000'),
  monitoringPeriod: parseInt(process.env.S3_CIRCUIT_BREAKER_MONITORING_PERIOD || '30000')
};

/**
 * Default lifecycle policies for video storage
 */
export const defaultLifecyclePolicies: BucketLifecycleRule[] = [
  {
    id: 'video-storage-lifecycle',
    status: 'Enabled',
    filter: {
      prefix: 'videos/'
    },
    transitions: [
      {
        days: 30,
        storageClass: 'STANDARD_IA'
      },
      {
        days: 90,
        storageClass: 'GLACIER'
      },
      {
        days: 365,
        storageClass: 'DEEP_ARCHIVE'
      }
    ],
    expiration: {
      days: parseInt(process.env.S3_VIDEO_RETENTION_DAYS || '1095') // 3 years default
    },
    abortIncompleteMultipartUpload: {
      daysAfterInitiation: 7
    }
  },
  {
    id: 'temp-files-cleanup',
    status: 'Enabled',
    filter: {
      prefix: 'temp/'
    },
    expiration: {
      days: 1
    },
    abortIncompleteMultipartUpload: {
      daysAfterInitiation: 1
    }
  },
  {
    id: 'failed-uploads-cleanup',
    status: 'Enabled',
    filter: {
      prefix: 'failed/'
    },
    expiration: {
      days: 7
    },
    abortIncompleteMultipartUpload: {
      daysAfterInitiation: 1
    }
  }
];

/**
 * S3 service configuration with all defaults
 */
export interface S3ServiceConfig {
  s3Config: S3Config;
  retryConfig: RetryConfig;
  circuitBreakerConfig: CircuitBreakerConfig;
  lifecyclePolicies: BucketLifecycleRule[];
}

/**
 * Get complete S3 service configuration
 */
export function getS3ServiceConfig(): S3ServiceConfig {
  return {
    s3Config: getS3Config(),
    retryConfig: defaultRetryConfig,
    circuitBreakerConfig: defaultCircuitBreakerConfig,
    lifecyclePolicies: defaultLifecyclePolicies
  };
}

/**
 * Validate S3 configuration
 */
export function validateS3Config(config: S3Config): void {
  const errors: string[] = [];

  if (!config.region) {
    errors.push('AWS region is required');
  }

  if (!config.accessKeyId) {
    errors.push('AWS access key ID is required');
  }

  if (!config.secretAccessKey) {
    errors.push('AWS secret access key is required');
  }

  if (!config.bucketName) {
    errors.push('S3 bucket name is required');
  }

  // Validate bucket name format (basic validation)
  if (config.bucketName) {
    const bucketNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (!bucketNameRegex.test(config.bucketName) || config.bucketName.length < 3 || config.bucketName.length > 63) {
      errors.push('Invalid S3 bucket name format');
    }
  }

  if (errors.length > 0) {
    throw new Error(`S3 configuration validation failed: ${errors.join(', ')}`);
  }
}
