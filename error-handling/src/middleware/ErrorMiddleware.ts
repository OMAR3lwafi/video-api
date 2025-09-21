/**
 * Express.js Error Handling Middleware
 * Dynamic Video Content Generation Platform
 *
 * Comprehensive error handling middleware for Express.js with
 * proper error classification, logging, and response formatting.
 */

import { Request, Response, NextFunction } from 'express';
import {
  AppError,
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  ErrorHandlerConfig,
  ErrorReport,
  ErrorContext
} from '../types/ErrorTypes';
import { ErrorFactory } from '../core/ErrorFactory';
import { ErrorHandler } from '../core/ErrorHandler';

interface ErrorMiddlewareOptions {
  enableLogging?: boolean;
  enableReporting?: boolean;
  includeStack?: boolean;
  trustProxy?: boolean;
  corsEnabled?: boolean;
}

interface RequestWithContext extends Request {
  correlationId?: string;
  startTime?: number;
  userId?: string;
}

/**
 * Main Error Handling Middleware
 */
export class ErrorMiddleware {
  private errorHandler: ErrorHandler;
  private options: ErrorMiddlewareOptions;

  constructor(config: ErrorHandlerConfig, options: ErrorMiddlewareOptions = {}) {
    this.errorHandler = new ErrorHandler(config);
    this.options = {
      enableLogging: true,
      enableReporting: true,
      includeStack: process.env.NODE_ENV === 'development',
      trustProxy: false,
      corsEnabled: true,
      ...options
    };
  }

  /**
   * Main error handling middleware function
   */
  public handle = async (
    error: Error | AppError,
    req: RequestWithContext,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Create error context from request
      const context = this.createErrorContext(req);

      // Handle the error
      const appError = await this.errorHandler.handleError(error, context, {
        notify: false, // Don't send notifications from server-side
        report: this.options.enableReporting
      });

      // Log the error if enabled
      if (this.options.enableLogging) {
        this.logError(appError, req);
      }

      // Send error response
      this.sendErrorResponse(appError, req, res);
    } catch (handlingError) {
      // Fallback error handling
      console.error('Error in error handler:', handlingError);
      this.sendFallbackErrorResponse(res);
    }
  };

  /**
   * Not Found (404) middleware
   */
  public handleNotFound = (req: Request, res: Response, next: NextFunction): void => {
    const error = ErrorFactory.createAppError(
      ErrorType.FILE_NOT_FOUND,
      `Route not found: ${req.method} ${req.originalUrl}`,
      'The requested resource was not found.',
      {
        statusCode: 404,
        url: req.originalUrl,
        method: req.method
      }
    );

    next(error);
  };

  /**
   * Request timeout middleware
   */
  public handleTimeout = (timeoutMs: number = 30000) => {
    return (req: RequestWithContext, res: Response, next: NextFunction): void => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          const error = ErrorFactory.createAppError(
            ErrorType.TIMEOUT,
            `Request timeout after ${timeoutMs}ms`,
            'The request took too long to process. Please try again.',
            {
              statusCode: 408,
              timeout: timeoutMs
            }
          );

          next(error);
        }
      }, timeoutMs);

      // Clear timeout when response is sent
      res.on('finish', () => clearTimeout(timeout));
      res.on('close', () => clearTimeout(timeout));

      next();
    };
  };

  /**
   * Rate limiting error handler
   */
  public handleRateLimit = (req: Request, res: Response, next: NextFunction): void => {
    const error = ErrorFactory.createAppError(
      ErrorType.RATE_LIMITED,
      'Too many requests from this IP',
      'You have made too many requests. Please wait before trying again.',
      {
        statusCode: 429,
        retryAfter: 60
      }
    );

    res.set('Retry-After', '60');
    next(error);
  };

  /**
   * Validation error handler
   */
  public handleValidationError = (validationErrors: any[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const error = ErrorFactory.createValidationError(
        'Validation failed',
        validationErrors[0]?.path,
        validationErrors[0]?.value,
        validationErrors[0]?.message,
        validationErrors.map(err => err.message)
      );

      error.statusCode = 400;
      error.context = {
        ...error.context,
        validationErrors: validationErrors
      };

      next(error);
    };
  };

  /**
   * Async wrapper for route handlers
   */
  public asyncWrapper = <T extends Request, U extends Response>(
    fn: (req: T, res: U, next: NextFunction) => Promise<any>
  ) => {
    return (req: T, res: U, next: NextFunction): void => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * Request correlation ID middleware
   */
  public addCorrelationId = (req: RequestWithContext, res: Response, next: NextFunction): void => {
    req.correlationId = req.headers['x-correlation-id'] as string ||
                       `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.startTime = Date.now();

    res.set('X-Correlation-ID', req.correlationId);
    next();
  };

  /**
   * Request logging middleware
   */
  public logRequests = (req: RequestWithContext, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        correlationId: req.correlationId,
        userAgent: req.get('User-Agent'),
        ip: this.getClientIP(req),
        timestamp: new Date().toISOString()
      };

      if (res.statusCode >= 400) {
        console.error('Request Error:', logData);
      } else {
        console.log('Request:', logData);
      }
    });

    next();
  };

  /**
   * Health check endpoint
   */
  public healthCheck = (req: Request, res: Response): void => {
    const healthStatus = {
      ok: true,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV || 'unknown'
    };

    res.status(200).json(healthStatus);
  };

  /**
   * Create error context from request
   */
  private createErrorContext(req: RequestWithContext): ErrorContext {
    return {
      component: 'API',
      action: `${req.method} ${req.route?.path || req.originalUrl}`,
      metadata: {
        correlationId: req.correlationId,
        userId: req.userId,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: this.getClientIP(req),
        timestamp: new Date().toISOString(),
        duration: req.startTime ? Date.now() - req.startTime : undefined,
        headers: this.sanitizeHeaders(req.headers),
        query: req.query,
        params: req.params
      }
    };
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: AppError, req: RequestWithContext): void {
    const logData = {
      error: {
        id: error.id,
        type: error.type,
        category: error.category,
        severity: error.severity,
        message: error.message,
        userMessage: error.userMessage,
        stack: this.options.includeStack ? error.stack : undefined
      },
      request: {
        correlationId: req.correlationId,
        method: req.method,
        url: req.originalUrl,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent')
      },
      timestamp: new Date().toISOString()
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('CRITICAL ERROR:', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('HIGH ERROR:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('MEDIUM ERROR:', logData);
        break;
      case ErrorSeverity.LOW:
        console.info('LOW ERROR:', logData);
        break;
      default:
        console.error('ERROR:', logData);
    }
  }

  /**
   * Send structured error response
   */
  private sendErrorResponse(error: AppError, req: RequestWithContext, res: Response): void {
    const statusCode = error.statusCode || this.getHttpStatusCode(error.type);

    const errorResponse = {
      error: {
        id: error.id,
        type: error.type,
        category: error.category,
        severity: error.severity,
        message: error.userMessage,
        timestamp: error.timestamp,
        correlationId: req.correlationId
      }
    };

    // Add stack trace in development
    if (this.options.includeStack && error.stack) {
      (errorResponse.error as any).stack = error.stack;
    }

    // Add retry information for retryable errors
    if (error.retryable) {
      (errorResponse.error as any).retryable = true;
      (errorResponse.error as any).retryAfter = this.getRetryAfter(error.type);
    }

    // Set appropriate headers
    res.set('Content-Type', 'application/json');

    if (this.options.corsEnabled) {
      res.set('Access-Control-Allow-Origin', '*');
    }

    if (error.type === ErrorType.RATE_LIMITED) {
      res.set('Retry-After', '60');
    }

    res.status(statusCode).json(errorResponse);
  }

  /**
   * Send fallback error response when error handling fails
   */
  private sendFallbackErrorResponse(res: Response): void {
    if (res.headersSent) {
      return;
    }

    res.status(500).json({
      error: {
        id: 'fallback-error',
        type: 'internal_server_error',
        category: 'server',
        severity: 'critical',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get HTTP status code from error type
   */
  private getHttpStatusCode(errorType: ErrorType): number {
    const statusCodeMap: Record<ErrorType, number> = {
      [ErrorType.INVALID_INPUT]: 400,
      [ErrorType.MISSING_REQUIRED_FIELD]: 400,
      [ErrorType.INVALID_FORMAT]: 400,
      [ErrorType.INVALID_FILE_TYPE]: 400,
      [ErrorType.FILE_TOO_LARGE]: 413,
      [ErrorType.UNAUTHORIZED]: 401,
      [ErrorType.FORBIDDEN]: 403,
      [ErrorType.TOKEN_EXPIRED]: 401,
      [ErrorType.INVALID_CREDENTIALS]: 401,
      [ErrorType.FILE_NOT_FOUND]: 404,
      [ErrorType.TIMEOUT]: 408,
      [ErrorType.RATE_LIMITED]: 429,
      [ErrorType.INTERNAL_SERVER_ERROR]: 500,
      [ErrorType.SERVICE_UNAVAILABLE]: 503,
      [ErrorType.BAD_GATEWAY]: 502,
      [ErrorType.DATABASE_CONNECTION_ERROR]: 503,
      [ErrorType.DATABASE_QUERY_ERROR]: 500,
      [ErrorType.DATABASE_CONSTRAINT_ERROR]: 400,
      [ErrorType.STORAGE_ERROR]: 500,
      [ErrorType.STORAGE_QUOTA_EXCEEDED]: 507,
      [ErrorType.UPLOAD_FAILED]: 500,
      [ErrorType.PROCESSING_ERROR]: 500,
      [ErrorType.FFMPEG_ERROR]: 500,
      [ErrorType.CODEC_ERROR]: 400,
      [ErrorType.RENDERING_ERROR]: 500,
      [ErrorType.PROCESSING_TIMEOUT]: 408,
      [ErrorType.AWS_S3_ERROR]: 500,
      [ErrorType.SUPABASE_ERROR]: 500,
      [ErrorType.THIRD_PARTY_API_ERROR]: 502,
      [ErrorType.NETWORK_ERROR]: 500,
      [ErrorType.CONNECTION_LOST]: 503,
      [ErrorType.MEMORY_ERROR]: 500,
      [ErrorType.DISK_SPACE_ERROR]: 507,
      [ErrorType.CPU_OVERLOAD]: 503,
      [ErrorType.UNKNOWN_ERROR]: 500
    };

    return statusCodeMap[errorType] || 500;
  }

  /**
   * Get retry after seconds for different error types
   */
  private getRetryAfter(errorType: ErrorType): number {
    const retryAfterMap: Record<ErrorType, number> = {
      [ErrorType.RATE_LIMITED]: 60,
      [ErrorType.SERVICE_UNAVAILABLE]: 30,
      [ErrorType.DATABASE_CONNECTION_ERROR]: 10,
      [ErrorType.TIMEOUT]: 5,
      [ErrorType.PROCESSING_TIMEOUT]: 10,
      [ErrorType.CPU_OVERLOAD]: 30,
      [ErrorType.MEMORY_ERROR]: 60
    };

    return retryAfterMap[errorType] || 5;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    if (this.options.trustProxy) {
      return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
             (req.headers['x-real-ip'] as string) ||
             req.connection.remoteAddress ||
             'unknown';
    }

    return req.connection.remoteAddress || 'unknown';
  }

  /**
   * Sanitize request headers for logging
   */
  private sanitizeHeaders(headers: any): Record<string, string> {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value as string;
      }
    }

    return sanitized;
  }
}

/**
 * Database Error Handler
 */
export class DatabaseErrorHandler {
  static handle(error: any): AppError {
    // PostgreSQL/Supabase specific errors
    if (error.code) {
      switch (error.code) {
        case '23505': // unique_violation
          return ErrorFactory.createDatabaseError(
            'Duplicate entry',
            error.detail,
            error.table,
            'INSERT',
            'unique'
          );
        case '23503': // foreign_key_violation
          return ErrorFactory.createDatabaseError(
            'Foreign key constraint violation',
            error.detail,
            error.table,
            'INSERT/UPDATE',
            'foreign_key'
          );
        case '23502': // not_null_violation
          return ErrorFactory.createDatabaseError(
            'Required field missing',
            error.detail,
            error.table,
            'INSERT/UPDATE',
            'not_null'
          );
        case 'PGRST116': // Supabase RLS policy violation
          return ErrorFactory.createAppError(
            ErrorType.FORBIDDEN,
            'Row level security policy violation',
            'You do not have permission to access this resource'
          );
        default:
          return ErrorFactory.createDatabaseError(
            error.message || 'Database operation failed',
            error.hint,
            error.table
          );
      }
    }

    // Generic database errors
    if (error.message?.includes('connection')) {
      return ErrorFactory.createDatabaseError(
        'Database connection failed',
        undefined,
        undefined,
        'CONNECTION'
      );
    }

    return ErrorFactory.createDatabaseError(
      error.message || 'Unknown database error'
    );
  }
}

/**
 * Validation Error Handler
 */
export class ValidationErrorHandler {
  static handle(errors: any[]): AppError {
    const firstError = errors[0];

    return ErrorFactory.createValidationError(
      `Validation failed: ${firstError.message}`,
      firstError.path || firstError.field,
      firstError.value,
      firstError.rule || firstError.constraint,
      errors.map(err => err.message)
    );
  }
}

/**
 * Multer Error Handler (for file uploads)
 */
export class MulterErrorHandler {
  static handle(error: any): AppError {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return ErrorFactory.createAppError(
          ErrorType.FILE_TOO_LARGE,
          'File size exceeds limit',
          `File is too large. Maximum size is ${this.formatBytes(error.limit)}`
        );
      case 'LIMIT_FILE_COUNT':
        return ErrorFactory.createAppError(
          ErrorType.INVALID_INPUT,
          'Too many files',
          `Maximum ${error.limit} files allowed`
        );
      case 'LIMIT_UNEXPECTED_FILE':
        return ErrorFactory.createAppError(
          ErrorType.INVALID_INPUT,
          'Unexpected file field',
          'Invalid file upload field'
        );
      default:
        return ErrorFactory.createAppError(
          ErrorType.UPLOAD_FAILED,
          error.message || 'File upload failed',
          'Failed to upload file. Please try again.'
        );
    }
  }

  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * JWT Error Handler
 */
export class JWTErrorHandler {
  static handle(error: any): AppError {
    switch (error.name) {
      case 'TokenExpiredError':
        return ErrorFactory.createAppError(
          ErrorType.TOKEN_EXPIRED,
          'JWT token has expired',
          'Your session has expired. Please log in again.'
        );
      case 'JsonWebTokenError':
        return ErrorFactory.createAppError(
          ErrorType.INVALID_CREDENTIALS,
          'Invalid JWT token',
          'Invalid authentication token'
        );
      case 'NotBeforeError':
        return ErrorFactory.createAppError(
          ErrorType.UNAUTHORIZED,
          'JWT token not active',
          'Authentication token is not yet active'
        );
      default:
        return ErrorFactory.createAppError(
          ErrorType.UNAUTHORIZED,
          'JWT authentication failed',
          'Authentication failed'
        );
    }
  }
}

export default ErrorMiddleware;
