/**
 * Error Handling System - Main Export
 * Dynamic Video Content Generation Platform
 *
 * Comprehensive error handling system with React components, middleware,
 * services, and utilities for robust error management and user feedback.
 */

// Core Error Types and Interfaces
export * from './types/ErrorTypes';

// Error Factory and Utilities
export { ErrorFactory, ErrorClassifier, ErrorContextBuilder } from './core/ErrorFactory';

// Main Error Handler
export { ErrorHandler, defaultErrorHandlerConfig } from './core/ErrorHandler';

// React Components
export {
  ErrorBoundary,
  withErrorBoundary,
  useErrorBoundary,
  AsyncErrorBoundary
} from './components/ErrorBoundary';

export {
  NotificationProvider,
  useNotifications
} from './components/NotificationSystem';

export {
  LoadingSpinner,
  LoadingOverlay,
  Skeleton,
  ProgressBar,
  VideoCardSkeleton,
  TableRowSkeleton,
  UserProfileSkeleton,
  DashboardCardSkeleton,
  AsyncWrapper,
  SkeletonList,
  LoadingButton,
  DelayedSkeleton,
  useLoadingStates
} from './components/LoadingStates';

export {
  FeedbackForm,
  Rating,
  QuickFeedback,
  FeedbackSummary,
  useFeedback
} from './components/FeedbackSystem';

// Express Middleware
export {
  ErrorMiddleware,
  DatabaseErrorHandler,
  ValidationErrorHandler,
  MulterErrorHandler,
  JWTErrorHandler
} from './middleware/ErrorMiddleware';

// Services
export { OfflineService, createOfflineService } from './services/OfflineService';

// Utility Functions and Helpers
export const ErrorUtils = {
  /**
   * Check if error is retryable
   */
  isRetryableError: (error: any): boolean => {
    if (!error) return false;

    const retryableTypes = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'CONNECTION_LOST',
      'RATE_LIMITED',
      'INTERNAL_SERVER_ERROR',
      'SERVICE_UNAVAILABLE',
      'BAD_GATEWAY'
    ];

    return retryableTypes.includes(error.type) ||
           (error.status >= 500 && error.status < 600) ||
           error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT';
  },

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage: (error: any): string => {
    if (!error) return 'An unknown error occurred';

    if (error.userMessage) return error.userMessage;

    // Common error patterns
    if (error.message?.includes('network') || error.code === 'ECONNRESET') {
      return 'Network connection issue. Please check your internet and try again.';
    }

    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      return 'Request timed out. Please try again.';
    }

    if (error.status === 401 || error.message?.includes('unauthorized')) {
      return 'You need to log in to access this feature.';
    }

    if (error.status === 403 || error.message?.includes('forbidden')) {
      return 'You don\'t have permission to perform this action.';
    }

    if (error.status === 404) {
      return 'The requested resource was not found.';
    }

    if (error.status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    if (error.status >= 500) {
      return 'Server error occurred. Please try again later.';
    }

    return error.message || 'An unexpected error occurred';
  },

  /**
   * Create correlation ID for error tracking
   */
  createCorrelationId: (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Sanitize error for logging (remove sensitive data)
   */
  sanitizeError: (error: any): any => {
    if (!error || typeof error !== 'object') return error;

    const sensitiveFields = [
      'password', 'token', 'apiKey', 'secret', 'authorization',
      'cookie', 'session', 'credentials', 'key', 'auth'
    ];

    const sanitized = { ...error };

    // Remove sensitive fields
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    // Sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = ErrorUtils.sanitizeError(sanitized[key]);
      }
    });

    return sanitized;
  },

  /**
   * Format error for display
   */
  formatError: (error: any): string => {
    if (!error) return 'Unknown error';

    if (typeof error === 'string') return error;

    if (error.userMessage) return error.userMessage;
    if (error.message) return error.message;
    if (error.error) return ErrorUtils.formatError(error.error);

    return 'An error occurred';
  },

  /**
   * Check if error is network related
   */
  isNetworkError: (error: any): boolean => {
    if (!error) return false;

    const networkIndicators = [
      'NETWORK_ERROR', 'CONNECTION_LOST', 'ECONNRESET',
      'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'
    ];

    return networkIndicators.some(indicator =>
      error.type === indicator ||
      error.code === indicator ||
      error.message?.includes(indicator.toLowerCase())
    );
  },

  /**
   * Extract stack trace information
   */
  extractStackTrace: (error: any): string[] => {
    if (!error || !error.stack) return [];

    return error.stack
      .split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((line: string) => line.trim());
  }
};

// Constants
export const ERROR_CODES = {
  // Validation
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',

  // Authentication/Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_LOST: 'CONNECTION_LOST',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_GATEWAY: 'BAD_GATEWAY',

  // Database
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR: 'DATABASE_QUERY_ERROR',
  DATABASE_CONSTRAINT_ERROR: 'DATABASE_CONSTRAINT_ERROR',

  // Storage
  STORAGE_ERROR: 'STORAGE_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',

  // Processing
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  FFMPEG_ERROR: 'FFMPEG_ERROR',
  CODEC_ERROR: 'CODEC_ERROR',
  RENDERING_ERROR: 'RENDERING_ERROR',
  PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',

  // External Services
  AWS_S3_ERROR: 'AWS_S3_ERROR',
  SUPABASE_ERROR: 'SUPABASE_ERROR',
  THIRD_PARTY_API_ERROR: 'THIRD_PARTY_API_ERROR',

  // System
  MEMORY_ERROR: 'MEMORY_ERROR',
  DISK_SPACE_ERROR: 'DISK_SPACE_ERROR',
  CPU_OVERLOAD: 'CPU_OVERLOAD',

  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export const RECOVERY_ACTIONS = {
  RETRY: 'retry',
  REFRESH: 'refresh',
  LOGIN: 'login',
  CONTACT_SUPPORT: 'contact_support',
  TRY_AGAIN_LATER: 'try_again_later',
  CHECK_CONNECTION: 'check_connection',
  REDUCE_FILE_SIZE: 'reduce_file_size',
  NONE: 'none'
} as const;

// Default Configurations
export const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryCondition: (error: any, attempt: number) =>
    ErrorUtils.isRetryableError(error) && attempt <= 3
};

export const DEFAULT_NOTIFICATION_CONFIG = {
  type: 'toast' as const,
  duration: 5000,
  dismissible: true,
  priority: 'medium' as const
};

export const DEFAULT_OFFLINE_CONFIG = {
  maxQueueSize: 1000,
  maxRetryAttempts: 5,
  syncInterval: 30000,
  storageKey: 'offline_queue',
  apiEndpoint: '/api/sync',
  enableCompression: true,
  enableEncryption: false
};

// Version
export const VERSION = '1.0.0';

// Default export with commonly used items
export default {
  ErrorFactory,
  ErrorHandler,
  ErrorBoundary,
  NotificationProvider,
  OfflineService,
  ErrorUtils,
  ERROR_CODES,
  SEVERITY_LEVELS,
  RECOVERY_ACTIONS,
  VERSION
};
