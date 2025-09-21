/**
 * Error Factory and Utilities
 * Dynamic Video Content Generation Platform
 *
 * Provides factory methods and utilities for creating, classifying,
 * and managing application errors with proper typing and context.
 */

import {
  AppError,
  BaseError,
  ValidationError,
  NetworkError,
  ProcessingError,
  StorageError,
  DatabaseError,
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  RecoveryAction,
  ErrorContext,
  ErrorBreadcrumb,
  ErrorClassificationRule,
  RetryConfig
} from '../types/ErrorTypes';

/**
 * Error Factory Class
 * Creates properly typed and classified errors
 */
export class ErrorFactory {
  private static correlationId: string = '';
  private static sessionId: string = '';
  private static userId?: string;
  private static breadcrumbs: ErrorBreadcrumb[] = [];

  /**
   * Set global context for error creation
   */
  static setGlobalContext(context: {
    correlationId?: string;
    sessionId?: string;
    userId?: string;
  }): void {
    if (context.correlationId) this.correlationId = context.correlationId;
    if (context.sessionId) this.sessionId = context.sessionId;
    if (context.userId) this.userId = context.userId;
  }

  /**
   * Add breadcrumb for error tracking
   */
  static addBreadcrumb(breadcrumb: Omit<ErrorBreadcrumb, 'timestamp'>): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: new Date()
    });

    // Keep only last 50 breadcrumbs
    if (this.breadcrumbs.length > 50) {
      this.breadcrumbs = this.breadcrumbs.slice(-50);
    }
  }

  /**
   * Create a base application error
   */
  static createAppError(
    type: ErrorType,
    message: string,
    userMessage: string,
    options: Partial<AppError> = {}
  ): AppError {
    const error: AppError = {
      id: this.generateErrorId(),
      type,
      category: this.getCategoryForType(type),
      severity: this.getSeverityForType(type),
      message,
      userMessage,
      timestamp: new Date(),
      correlationId: this.correlationId,
      userId: this.userId,
      sessionId: this.sessionId,
      retryable: this.isRetryableType(type),
      recoveryAction: this.getRecoveryActionForType(type),
      ...options
    };

    return error;
  }

  /**
   * Create validation error
   */
  static createValidationError(
    message: string,
    field?: string,
    value?: any,
    constraint?: string,
    validationRules?: string[]
  ): ValidationError {
    const userMessage = field
      ? `Please check the ${field} field and try again.`
      : 'Please check your input and try again.';

    return {
      ...this.createAppError(ErrorType.INVALID_INPUT, message, userMessage),
      field,
      value,
      constraint,
      validationRules
    } as ValidationError;
  }

  /**
   * Create network error
   */
  static createNetworkError(
    message: string,
    endpoint?: string,
    method?: string,
    statusCode?: number,
    timeout?: number,
    retryAttempt?: number
  ): NetworkError {
    const type = this.getNetworkErrorType(statusCode);
    const userMessage = this.getNetworkErrorUserMessage(statusCode, timeout);

    return {
      ...this.createAppError(type, message, userMessage),
      endpoint,
      method,
      statusCode,
      timeout,
      retryAttempt
    } as NetworkError;
  }

  /**
   * Create processing error
   */
  static createProcessingError(
    message: string,
    jobId?: string,
    step?: string,
    progress?: number,
    processingDetails?: Record<string, any>
  ): ProcessingError {
    const userMessage = step
      ? `Processing failed at step: ${step}. Please try again.`
      : 'Video processing failed. Please try again with a different file.';

    return {
      ...this.createAppError(ErrorType.PROCESSING_ERROR, message, userMessage),
      jobId,
      step,
      progress,
      processingDetails
    } as ProcessingError;
  }

  /**
   * Create storage error
   */
  static createStorageError(
    message: string,
    bucket?: string,
    key?: string,
    operation?: string,
    fileSize?: number,
    quotaUsed?: number,
    quotaLimit?: number
  ): StorageError {
    const type = this.getStorageErrorType(message, quotaUsed, quotaLimit);
    const userMessage = this.getStorageErrorUserMessage(type, fileSize);

    return {
      ...this.createAppError(type, message, userMessage),
      bucket,
      key,
      operation,
      fileSize,
      quotaUsed,
      quotaLimit
    } as StorageError;
  }

  /**
   * Create database error
   */
  static createDatabaseError(
    message: string,
    query?: string,
    table?: string,
    operation?: string,
    constraint?: string
  ): DatabaseError {
    const type = this.getDatabaseErrorType(message, constraint);
    const userMessage = 'A database error occurred. Please try again later.';

    return {
      ...this.createAppError(type, message, userMessage, { severity: ErrorSeverity.HIGH }),
      query,
      table,
      operation,
      constraint
    } as DatabaseError;
  }

  /**
   * Create error from HTTP response
   */
  static fromHttpResponse(
    response: {
      status: number;
      statusText: string;
      url?: string;
      method?: string;
    },
    customMessage?: string
  ): NetworkError {
    const message = customMessage || `HTTP ${response.status}: ${response.statusText}`;

    return this.createNetworkError(
      message,
      response.url,
      response.method,
      response.status
    );
  }

  /**
   * Create error from caught exception
   */
  static fromException(
    error: Error | any,
    context?: Partial<ErrorContext>
  ): AppError {
    const message = error?.message || 'Unknown error occurred';
    const stack = error?.stack;

    let type = ErrorType.UNKNOWN_ERROR;
    let userMessage = 'An unexpected error occurred. Please try again.';

    // Try to classify the error based on the message
    if (message.includes('network') || message.includes('fetch')) {
      type = ErrorType.NETWORK_ERROR;
      userMessage = 'Network connection issue. Please check your internet and try again.';
    } else if (message.includes('timeout')) {
      type = ErrorType.TIMEOUT;
      userMessage = 'The operation timed out. Please try again.';
    } else if (message.includes('unauthorized') || message.includes('403')) {
      type = ErrorType.UNAUTHORIZED;
      userMessage = 'You are not authorized to perform this action.';
    } else if (message.includes('not found') || message.includes('404')) {
      type = ErrorType.FILE_NOT_FOUND;
      userMessage = 'The requested resource was not found.';
    }

    return this.createAppError(type, message, userMessage, {
      stack,
      context: context ? { ...context, breadcrumbs: this.breadcrumbs } : undefined
    });
  }

  /**
   * Create error with custom classification
   */
  static createCustomError(
    type: ErrorType,
    category: ErrorCategory,
    severity: ErrorSeverity,
    message: string,
    userMessage: string,
    options: Partial<AppError> = {}
  ): AppError {
    return {
      id: this.generateErrorId(),
      type,
      category,
      severity,
      message,
      userMessage,
      timestamp: new Date(),
      correlationId: this.correlationId,
      userId: this.userId,
      sessionId: this.sessionId,
      retryable: this.isRetryableType(type),
      recoveryAction: this.getRecoveryActionForType(type),
      context: { breadcrumbs: this.breadcrumbs },
      ...options
    };
  }

  /**
   * Generate unique error ID
   */
  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get category for error type
   */
  private static getCategoryForType(type: ErrorType): ErrorCategory {
    const categoryMap: Record<ErrorType, ErrorCategory> = {
      [ErrorType.INVALID_INPUT]: ErrorCategory.VALIDATION,
      [ErrorType.MISSING_REQUIRED_FIELD]: ErrorCategory.VALIDATION,
      [ErrorType.INVALID_FORMAT]: ErrorCategory.VALIDATION,
      [ErrorType.INVALID_FILE_TYPE]: ErrorCategory.VALIDATION,
      [ErrorType.FILE_TOO_LARGE]: ErrorCategory.VALIDATION,
      [ErrorType.UNAUTHORIZED]: ErrorCategory.AUTHENTICATION,
      [ErrorType.FORBIDDEN]: ErrorCategory.AUTHORIZATION,
      [ErrorType.TOKEN_EXPIRED]: ErrorCategory.AUTHENTICATION,
      [ErrorType.INVALID_CREDENTIALS]: ErrorCategory.AUTHENTICATION,
      [ErrorType.NETWORK_ERROR]: ErrorCategory.NETWORK,
      [ErrorType.TIMEOUT]: ErrorCategory.NETWORK,
      [ErrorType.CONNECTION_LOST]: ErrorCategory.NETWORK,
      [ErrorType.RATE_LIMITED]: ErrorCategory.NETWORK,
      [ErrorType.INTERNAL_SERVER_ERROR]: ErrorCategory.SERVER,
      [ErrorType.SERVICE_UNAVAILABLE]: ErrorCategory.SERVER,
      [ErrorType.BAD_GATEWAY]: ErrorCategory.SERVER,
      [ErrorType.DATABASE_CONNECTION_ERROR]: ErrorCategory.DATABASE,
      [ErrorType.DATABASE_QUERY_ERROR]: ErrorCategory.DATABASE,
      [ErrorType.DATABASE_CONSTRAINT_ERROR]: ErrorCategory.DATABASE,
      [ErrorType.STORAGE_ERROR]: ErrorCategory.STORAGE,
      [ErrorType.FILE_NOT_FOUND]: ErrorCategory.STORAGE,
      [ErrorType.STORAGE_QUOTA_EXCEEDED]: ErrorCategory.STORAGE,
      [ErrorType.UPLOAD_FAILED]: ErrorCategory.STORAGE,
      [ErrorType.PROCESSING_ERROR]: ErrorCategory.PROCESSING,
      [ErrorType.FFMPEG_ERROR]: ErrorCategory.PROCESSING,
      [ErrorType.CODEC_ERROR]: ErrorCategory.PROCESSING,
      [ErrorType.RENDERING_ERROR]: ErrorCategory.PROCESSING,
      [ErrorType.PROCESSING_TIMEOUT]: ErrorCategory.PROCESSING,
      [ErrorType.AWS_S3_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
      [ErrorType.SUPABASE_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
      [ErrorType.THIRD_PARTY_API_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
      [ErrorType.MEMORY_ERROR]: ErrorCategory.SYSTEM,
      [ErrorType.DISK_SPACE_ERROR]: ErrorCategory.SYSTEM,
      [ErrorType.CPU_OVERLOAD]: ErrorCategory.SYSTEM,
      [ErrorType.UNKNOWN_ERROR]: ErrorCategory.UNKNOWN
    };

    return categoryMap[type] || ErrorCategory.UNKNOWN;
  }

  /**
   * Get severity for error type
   */
  private static getSeverityForType(type: ErrorType): ErrorSeverity {
    const severityMap: Record<ErrorType, ErrorSeverity> = {
      [ErrorType.INVALID_INPUT]: ErrorSeverity.LOW,
      [ErrorType.MISSING_REQUIRED_FIELD]: ErrorSeverity.LOW,
      [ErrorType.INVALID_FORMAT]: ErrorSeverity.LOW,
      [ErrorType.INVALID_FILE_TYPE]: ErrorSeverity.LOW,
      [ErrorType.FILE_TOO_LARGE]: ErrorSeverity.MEDIUM,
      [ErrorType.UNAUTHORIZED]: ErrorSeverity.MEDIUM,
      [ErrorType.FORBIDDEN]: ErrorSeverity.MEDIUM,
      [ErrorType.TOKEN_EXPIRED]: ErrorSeverity.MEDIUM,
      [ErrorType.INVALID_CREDENTIALS]: ErrorSeverity.MEDIUM,
      [ErrorType.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.TIMEOUT]: ErrorSeverity.MEDIUM,
      [ErrorType.CONNECTION_LOST]: ErrorSeverity.MEDIUM,
      [ErrorType.RATE_LIMITED]: ErrorSeverity.MEDIUM,
      [ErrorType.INTERNAL_SERVER_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.SERVICE_UNAVAILABLE]: ErrorSeverity.HIGH,
      [ErrorType.BAD_GATEWAY]: ErrorSeverity.HIGH,
      [ErrorType.DATABASE_CONNECTION_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorType.DATABASE_QUERY_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.DATABASE_CONSTRAINT_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.STORAGE_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.FILE_NOT_FOUND]: ErrorSeverity.LOW,
      [ErrorType.STORAGE_QUOTA_EXCEEDED]: ErrorSeverity.MEDIUM,
      [ErrorType.UPLOAD_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.PROCESSING_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.FFMPEG_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.CODEC_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.RENDERING_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.PROCESSING_TIMEOUT]: ErrorSeverity.HIGH,
      [ErrorType.AWS_S3_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.SUPABASE_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.THIRD_PARTY_API_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.MEMORY_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorType.DISK_SPACE_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.CPU_OVERLOAD]: ErrorSeverity.HIGH,
      [ErrorType.UNKNOWN_ERROR]: ErrorSeverity.MEDIUM
    };

    return severityMap[type] || ErrorSeverity.MEDIUM;
  }

  /**
   * Check if error type is retryable
   */
  private static isRetryableType(type: ErrorType): boolean {
    const retryableTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT,
      ErrorType.CONNECTION_LOST,
      ErrorType.RATE_LIMITED,
      ErrorType.INTERNAL_SERVER_ERROR,
      ErrorType.SERVICE_UNAVAILABLE,
      ErrorType.BAD_GATEWAY,
      ErrorType.DATABASE_CONNECTION_ERROR,
      ErrorType.STORAGE_ERROR,
      ErrorType.UPLOAD_FAILED,
      ErrorType.PROCESSING_TIMEOUT,
      ErrorType.AWS_S3_ERROR,
      ErrorType.SUPABASE_ERROR,
      ErrorType.THIRD_PARTY_API_ERROR
    ];

    return retryableTypes.includes(type);
  }

  /**
   * Get recovery action for error type
   */
  private static getRecoveryActionForType(type: ErrorType): RecoveryAction {
    const recoveryMap: Record<ErrorType, RecoveryAction> = {
      [ErrorType.INVALID_INPUT]: RecoveryAction.NONE,
      [ErrorType.MISSING_REQUIRED_FIELD]: RecoveryAction.NONE,
      [ErrorType.INVALID_FORMAT]: RecoveryAction.NONE,
      [ErrorType.INVALID_FILE_TYPE]: RecoveryAction.NONE,
      [ErrorType.FILE_TOO_LARGE]: RecoveryAction.REDUCE_FILE_SIZE,
      [ErrorType.UNAUTHORIZED]: RecoveryAction.LOGIN,
      [ErrorType.FORBIDDEN]: RecoveryAction.CONTACT_SUPPORT,
      [ErrorType.TOKEN_EXPIRED]: RecoveryAction.LOGIN,
      [ErrorType.INVALID_CREDENTIALS]: RecoveryAction.LOGIN,
      [ErrorType.NETWORK_ERROR]: RecoveryAction.CHECK_CONNECTION,
      [ErrorType.TIMEOUT]: RecoveryAction.RETRY,
      [ErrorType.CONNECTION_LOST]: RecoveryAction.CHECK_CONNECTION,
      [ErrorType.RATE_LIMITED]: RecoveryAction.TRY_AGAIN_LATER,
      [ErrorType.INTERNAL_SERVER_ERROR]: RecoveryAction.TRY_AGAIN_LATER,
      [ErrorType.SERVICE_UNAVAILABLE]: RecoveryAction.TRY_AGAIN_LATER,
      [ErrorType.BAD_GATEWAY]: RecoveryAction.TRY_AGAIN_LATER,
      [ErrorType.DATABASE_CONNECTION_ERROR]: RecoveryAction.TRY_AGAIN_LATER,
      [ErrorType.DATABASE_QUERY_ERROR]: RecoveryAction.CONTACT_SUPPORT,
      [ErrorType.DATABASE_CONSTRAINT_ERROR]: RecoveryAction.NONE,
      [ErrorType.STORAGE_ERROR]: RecoveryAction.RETRY,
      [ErrorType.FILE_NOT_FOUND]: RecoveryAction.REFRESH,
      [ErrorType.STORAGE_QUOTA_EXCEEDED]: RecoveryAction.CONTACT_SUPPORT,
      [ErrorType.UPLOAD_FAILED]: RecoveryAction.RETRY,
      [ErrorType.PROCESSING_ERROR]: RecoveryAction.RETRY,
      [ErrorType.FFMPEG_ERROR]: RecoveryAction.CONTACT_SUPPORT,
      [ErrorType.CODEC_ERROR]: RecoveryAction.CONTACT_SUPPORT,
      [ErrorType.RENDERING_ERROR]: RecoveryAction.RETRY,
      [ErrorType.PROCESSING_TIMEOUT]: RecoveryAction.RETRY,
      [ErrorType.AWS_S3_ERROR]: RecoveryAction.TRY_AGAIN_LATER,
      [ErrorType.SUPABASE_ERROR]: RecoveryAction.TRY_AGAIN_LATER,
      [ErrorType.THIRD_PARTY_API_ERROR]: RecoveryAction.TRY_AGAIN_LATER,
      [ErrorType.MEMORY_ERROR]: RecoveryAction.CONTACT_SUPPORT,
      [ErrorType.DISK_SPACE_ERROR]: RecoveryAction.CONTACT_SUPPORT,
      [ErrorType.CPU_OVERLOAD]: RecoveryAction.TRY_AGAIN_LATER,
      [ErrorType.UNKNOWN_ERROR]: RecoveryAction.CONTACT_SUPPORT
    };

    return recoveryMap[type] || RecoveryAction.CONTACT_SUPPORT;
  }

  /**
   * Get network error type based on status code
   */
  private static getNetworkErrorType(statusCode?: number): ErrorType {
    if (!statusCode) return ErrorType.NETWORK_ERROR;

    switch (statusCode) {
      case 400:
        return ErrorType.INVALID_INPUT;
      case 401:
        return ErrorType.UNAUTHORIZED;
      case 403:
        return ErrorType.FORBIDDEN;
      case 404:
        return ErrorType.FILE_NOT_FOUND;
      case 408:
        return ErrorType.TIMEOUT;
      case 429:
        return ErrorType.RATE_LIMITED;
      case 500:
        return ErrorType.INTERNAL_SERVER_ERROR;
      case 502:
        return ErrorType.BAD_GATEWAY;
      case 503:
        return ErrorType.SERVICE_UNAVAILABLE;
      case 504:
        return ErrorType.TIMEOUT;
      default:
        return statusCode >= 500 ? ErrorType.INTERNAL_SERVER_ERROR : ErrorType.NETWORK_ERROR;
    }
  }

  /**
   * Get user-friendly message for network errors
   */
  private static getNetworkErrorUserMessage(statusCode?: number, timeout?: number): string {
    if (!statusCode) {
      return 'Network connection issue. Please check your internet and try again.';
    }

    switch (statusCode) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'You need to log in to access this feature.';
      case 403:
        return 'You don\'t have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 408:
      case 504:
        return timeout
          ? `Request timed out after ${timeout}ms. Please try again.`
          : 'Request timed out. Please try again.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error occurred. Please try again later.';
      case 502:
        return 'Service temporarily unavailable. Please try again later.';
      case 503:
        return 'Service is currently down for maintenance. Please try again later.';
      default:
        return statusCode >= 500
          ? 'Server error occurred. Please try again later.'
          : 'Network error occurred. Please try again.';
    }
  }

  /**
   * Get storage error type based on message and quota
   */
  private static getStorageErrorType(
    message: string,
    quotaUsed?: number,
    quotaLimit?: number
  ): ErrorType {
    const lowerMessage = message.toLowerCase();

    if (quotaUsed && quotaLimit && quotaUsed >= quotaLimit) {
      return ErrorType.STORAGE_QUOTA_EXCEEDED;
    }

    if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
      return ErrorType.FILE_NOT_FOUND;
    }

    if (lowerMessage.includes('upload') || lowerMessage.includes('put')) {
      return ErrorType.UPLOAD_FAILED;
    }

    return ErrorType.STORAGE_ERROR;
  }

  /**
   * Get user-friendly message for storage errors
   */
  private static getStorageErrorUserMessage(type: ErrorType, fileSize?: number): string {
    switch (type) {
      case ErrorType.STORAGE_QUOTA_EXCEEDED:
        return 'Storage quota exceeded. Please delete some files or upgrade your plan.';
      case ErrorType.FILE_NOT_FOUND:
        return 'File not found. It may have been moved or deleted.';
      case ErrorType.UPLOAD_FAILED:
        return fileSize && fileSize > 100 * 1024 * 1024 // 100MB
          ? 'Upload failed. File may be too large. Please try a smaller file.'
          : 'Upload failed. Please check your connection and try again.';
      default:
        return 'Storage error occurred. Please try again later.';
    }
  }

  /**
   * Get database error type based on message and constraint
   */
  private static getDatabaseErrorType(message: string, constraint?: string): ErrorType {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('connection') || lowerMessage.includes('connect')) {
      return ErrorType.DATABASE_CONNECTION_ERROR;
    }

    if (constraint || lowerMessage.includes('constraint') || lowerMessage.includes('unique')) {
      return ErrorType.DATABASE_CONSTRAINT_ERROR;
    }

    return ErrorType.DATABASE_QUERY_ERROR;
  }
}

/**
 * Error Classification Utilities
 */
export class ErrorClassifier {
  private static rules: ErrorClassificationRule[] = [];

  /**
   * Add classification rule
   */
  static addRule(rule: ErrorClassificationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Classify error using rules
   */
  static classify(error: AppError): {
    category: ErrorCategory;
    severity: ErrorSeverity;
    recoveryAction: RecoveryAction;
  } {
    for (const rule of this.rules) {
      if (rule.enabled && rule.condition(error)) {
        return {
          category: rule.category,
          severity: rule.severity,
          recoveryAction: rule.recoveryStrategy.action
        };
      }
    }

    // Fallback to original classification
    return {
      category: error.category,
      severity: error.severity,
      recoveryAction: error.recoveryAction || RecoveryAction.CONTACT_SUPPORT
    };
  }

  /**
   * Get default classification rules
   */
  static getDefaultRules(): ErrorClassificationRule[] {
    return [
      {
        id: 'critical-database-errors',
        name: 'Critical Database Errors',
        condition: (error) =>
          error.category === ErrorCategory.DATABASE &&
          error.type === ErrorType.DATABASE_CONNECTION_ERROR,
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.CRITICAL,
        recoveryStrategy: {
          action: RecoveryAction.TRY_AGAIN_LATER,
          automatic: false,
          userPrompt: 'Database connection issues detected. Please try again in a few minutes.'
        },
        notificationConfig: {
          type: 'modal',
          dismissible: false,
          priority: 'urgent'
        },
        enabled: true,
        priority: 100
      },
      {
        id: 'processing-timeouts',
        name: 'Processing Timeouts',
        condition: (error) =>
          error.type === ErrorType.PROCESSING_TIMEOUT ||
          (error.type === ErrorType.TIMEOUT && error.category === ErrorCategory.PROCESSING),
        category: ErrorCategory.PROCESSING,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: {
          action: RecoveryAction.RETRY,
          automatic: true,
          delay: 5000,
          maxRetries: 2
        },
        notificationConfig: {
          type: 'toast',
          duration: 5000,
          dismissible: true,
          priority: 'medium'
        },
        enabled: true,
        priority: 90
      },
      {
        id: 'network-connectivity',
        name: 'Network Connectivity Issues',
        condition: (error) =>
          error.category === ErrorCategory.NETWORK &&
          (error.type === ErrorType.CONNECTION_LOST || error.type === ErrorType.NETWORK_ERROR),
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: {
          action: RecoveryAction.CHECK_CONNECTION,
          automatic: false,
          userPrompt: 'Please check your internet connection and try again.'
        },
        notificationConfig: {
          type: 'banner',
          dismissible: true,
          priority: 'medium'
        },
        enabled: true,
        priority: 80
      }
    ];
  }
}

/**
 * Error Context Builder
 */
export class ErrorContextBuilder {
  private context: ErrorContext = {};

  component(component: string): ErrorContextBuilder {
    this.context.component = component;
    return this;
  }

  action(action: string): ErrorContextBuilder {
    this.context.action = action;
    return this;
  }

  metadata(metadata: Record<string, any>): ErrorContextBuilder {
    this.context.metadata = { ...this.context.metadata, ...metadata };
    return this;
  }

  tag(tag: string): ErrorContextBuilder {
    this.context.tags = this.context.tags || [];
    this.context.tags.push(tag);
    return this;
  }

  tags(tags: string[]): ErrorContextBuilder {
    this.context.tags = [...(this.context.tags || []), ...tags];
    return this;
  }

  build(): ErrorContext {
    return { ...this.context };
  }
}
