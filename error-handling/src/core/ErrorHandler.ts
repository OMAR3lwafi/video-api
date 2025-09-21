/**
 * Comprehensive Error Handler
 * Dynamic Video Content Generation Platform
 *
 * Main error handling service with retry mechanisms, recovery strategies,
 * notification management, and offline support.
 */

import {
  AppError,
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  RecoveryAction,
  RecoveryStrategy,
  RetryConfig,
  NotificationConfig,
  ErrorHandlerConfig,
  ErrorHandlerEvents,
  OfflineErrorEntry,
  ErrorReport,
  ErrorContext
} from '../types/ErrorTypes';

import { ErrorFactory } from './ErrorFactory';
import { EventEmitter } from 'events';

/**
 * Main Error Handler Class
 */
export class ErrorHandler extends EventEmitter {
  private config: ErrorHandlerConfig;
  private retryQueue: Map<string, { error: AppError; attempts: number; nextRetry: Date }> = new Map();
  private offlineQueue: OfflineErrorEntry[] = [];
  private isOnline: boolean = true;
  private errorMetrics: Map<string, { count: number; lastSeen: Date }> = new Map();
  private circuitBreakers: Map<string, { failures: number; lastFailure: Date; state: 'closed' | 'open' | 'half-open' }> = new Map();

  constructor(config: ErrorHandlerConfig) {
    super();
    this.config = config;
    this.setupOnlineDetection();
    this.startRetryProcessor();
    this.startOfflineSync();
  }

  /**
   * Handle error with comprehensive processing
   */
  async handleError(
    error: Error | AppError,
    context?: ErrorContext,
    options: {
      retry?: boolean;
      notify?: boolean;
      report?: boolean;
      recoveryStrategy?: RecoveryStrategy;
    } = {}
  ): Promise<AppError> {
    // Convert to AppError if needed
    const appError = this.normalizeError(error, context);

    // Add to error metrics
    this.updateErrorMetrics(appError);

    // Emit error occurred event
    this.emit('error:occurred', appError);

    // Check circuit breaker
    if (this.isCircuitOpen(appError)) {
      const circuitError = ErrorFactory.createAppError(
        ErrorType.SERVICE_UNAVAILABLE,
        'Service circuit breaker is open',
        'Service is temporarily unavailable. Please try again later.',
        { severity: ErrorSeverity.HIGH }
      );
      return circuitError;
    }

    // Determine if should retry
    const shouldRetry = options.retry !== false && appError.retryable && this.shouldRetryError(appError);

    if (shouldRetry) {
      await this.scheduleRetry(appError);
    }

    // Handle recovery strategy
    const recoveryStrategy = options.recoveryStrategy || this.getRecoveryStrategy(appError);
    if (recoveryStrategy.automatic) {
      await this.executeRecoveryStrategy(appError, recoveryStrategy);
    }

    // Send notifications
    if (options.notify !== false && this.config.enableNotifications) {
      await this.sendNotification(appError, recoveryStrategy);
    }

    // Report error
    if (options.report !== false && this.config.enableReporting) {
      await this.reportError(appError, context);
    }

    // Update circuit breaker
    this.updateCircuitBreaker(appError);

    // Emit error handled event
    this.emit('error:handled', appError);

    return appError;
  }

  /**
   * Handle async operation with automatic error handling
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    context?: ErrorContext,
    options?: {
      maxRetries?: number;
      timeout?: number;
      fallback?: () => Promise<T>;
    }
  ): Promise<T> {
    const maxRetries = options?.maxRetries || 3;
    const timeout = options?.timeout || 30000;
    let lastError: AppError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout wrapper
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), timeout);
        });

        const result = await Promise.race([operation(), timeoutPromise]);
        return result;
      } catch (error) {
        lastError = await this.handleError(error, {
          ...context,
          metadata: { ...context?.metadata, attempt, maxRetries }
        });

        // Don't retry on final attempt
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await this.delay(delay);
      }
    }

    // Try fallback if available
    if (options?.fallback) {
      try {
        return await options.fallback();
      } catch (fallbackError) {
        await this.handleError(fallbackError, {
          ...context,
          metadata: { ...context?.metadata, fallbackAttempt: true }
        });
      }
    }

    throw lastError;
  }

  /**
   * Handle validation errors
   */
  handleValidationError(
    field: string,
    value: any,
    message: string,
    constraint?: string
  ): AppError {
    const error = ErrorFactory.createValidationError(
      `Validation failed for field '${field}': ${message}`,
      field,
      value,
      constraint
    );

    this.emit('error:occurred', error);
    return error;
  }

  /**
   * Handle network errors with retry logic
   */
  async handleNetworkError(
    endpoint: string,
    method: string,
    statusCode: number,
    context?: ErrorContext
  ): Promise<AppError> {
    const error = ErrorFactory.createNetworkError(
      `Network request failed: ${method} ${endpoint}`,
      endpoint,
      method,
      statusCode
    );

    return await this.handleError(error, context, {
      retry: statusCode >= 500 || statusCode === 408 || statusCode === 429
    });
  }

  /**
   * Handle processing errors
   */
  async handleProcessingError(
    jobId: string,
    step: string,
    message: string,
    processingDetails?: Record<string, any>
  ): Promise<AppError> {
    const error = ErrorFactory.createProcessingError(
      message,
      jobId,
      step,
      undefined,
      processingDetails
    );

    return await this.handleError(error, {
      component: 'VideoProcessor',
      action: 'processVideo',
      metadata: { jobId, step }
    });
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    topErrors: { type: ErrorType; count: number; lastSeen: Date }[];
    retryQueueSize: number;
    offlineQueueSize: number;
    circuitBreakerStatus: Record<string, string>;
  } {
    const errorsByCategory: Record<ErrorCategory, number> = {} as any;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;
    let totalErrors = 0;

    for (const [, metrics] of this.errorMetrics) {
      totalErrors += metrics.count;
    }

    const topErrors = Array.from(this.errorMetrics.entries())
      .map(([type, metrics]) => ({
        type: type as ErrorType,
        count: metrics.count,
        lastSeen: metrics.lastSeen
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const circuitBreakerStatus: Record<string, string> = {};
    for (const [service, breaker] of this.circuitBreakers) {
      circuitBreakerStatus[service] = breaker.state;
    }

    return {
      totalErrors,
      errorsByCategory,
      errorsBySeverity,
      topErrors,
      retryQueueSize: this.retryQueue.size,
      offlineQueueSize: this.offlineQueue.length,
      circuitBreakerStatus
    };
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorMetrics.clear();
    this.retryQueue.clear();
    this.offlineQueue.length = 0;
    this.circuitBreakers.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Normalize error to AppError
   */
  private normalizeError(error: Error | AppError, context?: ErrorContext): AppError {
    if ('type' in error && 'category' in error) {
      return { ...error, context: { ...error.context, ...context } };
    }

    return ErrorFactory.fromException(error, context);
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(error: AppError): void {
    const key = error.type;
    const current = this.errorMetrics.get(key);

    this.errorMetrics.set(key, {
      count: (current?.count || 0) + 1,
      lastSeen: new Date()
    });

    // Clean old metrics (keep only last 1000 entries)
    if (this.errorMetrics.size > 1000) {
      const oldestKey = Array.from(this.errorMetrics.entries())
        .sort((a, b) => a[1].lastSeen.getTime() - b[1].lastSeen.getTime())[0][0];
      this.errorMetrics.delete(oldestKey);
    }
  }

  /**
   * Check if should retry error
   */
  private shouldRetryError(error: AppError): boolean {
    if (!error.retryable) return false;

    const retryEntry = this.retryQueue.get(error.id);
    const maxAttempts = this.config.globalRetryConfig.maxAttempts;

    return !retryEntry || retryEntry.attempts < maxAttempts;
  }

  /**
   * Schedule retry for error
   */
  private async scheduleRetry(error: AppError): Promise<void> {
    const retryEntry = this.retryQueue.get(error.id);
    const attempts = (retryEntry?.attempts || 0) + 1;

    const delay = this.calculateRetryDelay(attempts);
    const nextRetry = new Date(Date.now() + delay);

    this.retryQueue.set(error.id, {
      error,
      attempts,
      nextRetry
    });

    this.emit('error:retry', { error, attempt: attempts });
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const config = this.config.globalRetryConfig;
    const delay = Math.min(
      config.initialDelay * Math.pow(config.backoffFactor, attempt - 1),
      config.maxDelay
    );

    // Add jitter if enabled
    if (config.jitter) {
      return delay + (Math.random() * 1000);
    }

    return delay;
  }

  /**
   * Get recovery strategy for error
   */
  private getRecoveryStrategy(error: AppError): RecoveryStrategy {
    const action = error.recoveryAction || RecoveryAction.CONTACT_SUPPORT;

    const strategies: Record<RecoveryAction, RecoveryStrategy> = {
      [RecoveryAction.RETRY]: {
        action: RecoveryAction.RETRY,
        automatic: true,
        delay: 2000,
        maxRetries: 3
      },
      [RecoveryAction.REFRESH]: {
        action: RecoveryAction.REFRESH,
        automatic: false,
        userPrompt: 'Please refresh the page and try again.'
      },
      [RecoveryAction.LOGIN]: {
        action: RecoveryAction.LOGIN,
        automatic: false,
        userPrompt: 'Please log in again to continue.',
        userOptions: ['Log In', 'Cancel']
      },
      [RecoveryAction.CONTACT_SUPPORT]: {
        action: RecoveryAction.CONTACT_SUPPORT,
        automatic: false,
        userPrompt: 'Please contact support for assistance.',
        userOptions: ['Contact Support', 'Try Again', 'Cancel']
      },
      [RecoveryAction.TRY_AGAIN_LATER]: {
        action: RecoveryAction.TRY_AGAIN_LATER,
        automatic: false,
        userPrompt: 'Please try again later.',
        userOptions: ['Try Again', 'Cancel']
      },
      [RecoveryAction.CHECK_CONNECTION]: {
        action: RecoveryAction.CHECK_CONNECTION,
        automatic: false,
        userPrompt: 'Please check your internet connection and try again.',
        userOptions: ['Retry', 'Cancel']
      },
      [RecoveryAction.REDUCE_FILE_SIZE]: {
        action: RecoveryAction.REDUCE_FILE_SIZE,
        automatic: false,
        userPrompt: 'Please reduce the file size and try again.',
        userOptions: ['Choose Different File', 'Cancel']
      },
      [RecoveryAction.NONE]: {
        action: RecoveryAction.NONE,
        automatic: false
      }
    };

    return strategies[action];
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecoveryStrategy(error: AppError, strategy: RecoveryStrategy): Promise<void> {
    this.emit('recovery:attempted', { error, strategy });

    switch (strategy.action) {
      case RecoveryAction.RETRY:
        if (strategy.delay) {
          await this.delay(strategy.delay);
        }
        // Retry logic would be handled by the calling code
        break;

      case RecoveryAction.REFRESH:
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
        break;

      case RecoveryAction.LOGIN:
        // Emit event for login flow
        this.emit('recovery:login_required', error);
        break;

      default:
        // Other recovery actions handled by UI components
        break;
    }
  }

  /**
   * Send notification for error
   */
  private async sendNotification(error: AppError, strategy: RecoveryStrategy): Promise<void> {
    const config: NotificationConfig = {
      type: this.getNotificationType(error.severity),
      duration: this.getNotificationDuration(error.severity),
      dismissible: error.severity !== ErrorSeverity.CRITICAL,
      priority: this.getNotificationPriority(error.severity),
      actions: strategy.userOptions ? strategy.userOptions.map(option => ({
        label: option,
        action: option.toLowerCase().replace(' ', '_')
      })) : undefined
    };

    this.emit('notification:shown', { error, config });
  }

  /**
   * Get notification type based on severity
   */
  private getNotificationType(severity: ErrorSeverity): 'toast' | 'modal' | 'inline' | 'banner' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'modal';
      case ErrorSeverity.HIGH:
        return 'banner';
      case ErrorSeverity.MEDIUM:
        return 'toast';
      case ErrorSeverity.LOW:
        return 'inline';
      default:
        return 'toast';
    }
  }

  /**
   * Get notification duration based on severity
   */
  private getNotificationDuration(severity: ErrorSeverity): number | undefined {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return undefined; // Persistent
      case ErrorSeverity.HIGH:
        return 10000;
      case ErrorSeverity.MEDIUM:
        return 5000;
      case ErrorSeverity.LOW:
        return 3000;
      default:
        return 5000;
    }
  }

  /**
   * Get notification priority based on severity
   */
  private getNotificationPriority(severity: ErrorSeverity): 'low' | 'medium' | 'high' | 'urgent' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'urgent';
      case ErrorSeverity.HIGH:
        return 'high';
      case ErrorSeverity.MEDIUM:
        return 'medium';
      case ErrorSeverity.LOW:
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Report error to tracking service
   */
  private async reportError(error: AppError, context?: ErrorContext): Promise<void> {
    if (!this.isOnline && this.config.enableOfflineSupport) {
      this.queueOfflineError(error, context);
      return;
    }

    const report: ErrorReport = {
      error,
      context: context || {},
      environment: {
        platform: typeof window !== 'undefined' ? 'browser' : 'node',
        version: process.env.npm_package_version || 'unknown',
        buildId: process.env.BUILD_ID,
        nodeVersion: process.version,
        browserName: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        browserVersion: typeof navigator !== 'undefined' ? navigator.appVersion : undefined,
        os: typeof navigator !== 'undefined' ? navigator.platform : process.platform
      },
      user: {
        id: error.userId
      },
      session: {
        id: error.sessionId || 'unknown',
        duration: Date.now() - (Date.parse(error.timestamp.toString()) || Date.now()),
        actionsCount: this.errorMetrics.size
      }
    };

    try {
      // In a real implementation, this would send to error tracking service
      // like Sentry, Bugsnag, or custom endpoint
      if (this.config.reportingEndpoint) {
        const response = await fetch(this.config.reportingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.reportingApiKey}`
          },
          body: JSON.stringify(report)
        });

        if (!response.ok) {
          throw new Error(`Failed to report error: ${response.statusText}`);
        }
      }

      this.emit('error:reported', report);
    } catch (reportError) {
      // If reporting fails, queue for offline sync
      this.queueOfflineError(error, context);
    }
  }

  /**
   * Queue error for offline sync
   */
  private queueOfflineError(error: AppError, context?: ErrorContext): void {
    const entry: OfflineErrorEntry = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      error,
      report: {
        error,
        context: context || {},
        environment: {
          platform: typeof window !== 'undefined' ? 'browser' : 'node',
          version: process.env.npm_package_version || 'unknown'
        },
        session: {
          id: error.sessionId || 'unknown',
          duration: 0,
          actionsCount: 0
        }
      },
      timestamp: new Date(),
      synced: false,
      retryCount: 0
    };

    this.offlineQueue.push(entry);
    this.emit('offline:queued', entry);

    // Limit offline queue size
    if (this.offlineQueue.length > 100) {
      this.offlineQueue.shift();
    }
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(error: AppError): boolean {
    const service = this.getServiceFromError(error);
    const breaker = this.circuitBreakers.get(service);

    if (!breaker) return false;

    if (breaker.state === 'open') {
      // Check if we should transition to half-open
      const timeSinceLastFailure = Date.now() - breaker.lastFailure.getTime();
      if (timeSinceLastFailure > 60000) { // 1 minute timeout
        breaker.state = 'half-open';
        this.circuitBreakers.set(service, breaker);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(error: AppError): void {
    const service = this.getServiceFromError(error);
    const breaker = this.circuitBreakers.get(service) || {
      failures: 0,
      lastFailure: new Date(),
      state: 'closed' as const
    };

    if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
      breaker.failures++;
      breaker.lastFailure = new Date();

      // Trip circuit breaker after 5 failures
      if (breaker.failures >= 5) {
        breaker.state = 'open';
      }
    } else if (breaker.state === 'half-open') {
      // Success in half-open state, close circuit
      breaker.state = 'closed';
      breaker.failures = 0;
    }

    this.circuitBreakers.set(service, breaker);
  }

  /**
   * Get service name from error
   */
  private getServiceFromError(error: AppError): string {
    if (error.category === ErrorCategory.DATABASE) return 'database';
    if (error.category === ErrorCategory.STORAGE) return 'storage';
    if (error.category === ErrorCategory.PROCESSING) return 'processing';
    if (error.category === ErrorCategory.EXTERNAL_SERVICE) return 'external';
    return 'general';
  }

  /**
   * Setup online/offline detection
   */
  private setupOnlineDetection(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.syncOfflineErrors();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });

      this.isOnline = navigator.onLine;
    }
  }

  /**
   * Start retry processor
   */
  private startRetryProcessor(): void {
    setInterval(() => {
      const now = new Date();

      for (const [errorId, entry] of this.retryQueue) {
        if (entry.nextRetry <= now) {
          // Remove from queue and emit retry event
          this.retryQueue.delete(errorId);
          this.emit('error:retry', { error: entry.error, attempt: entry.attempts });
        }
      }
    }, 1000);
  }

  /**
   * Start offline sync processor
   */
  private startOfflineSync(): void {
    setInterval(() => {
      if (this.isOnline) {
        this.syncOfflineErrors();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Sync offline errors when back online
   */
  private async syncOfflineErrors(): Promise<void> {
    const unsyncedErrors = this.offlineQueue.filter(entry => !entry.synced);

    for (const entry of unsyncedErrors) {
      try {
        await this.reportError(entry.error, entry.report.context);
        entry.synced = true;
        this.emit('offline:synced', entry);
      } catch (error) {
        entry.retryCount++;
        entry.nextRetryAt = new Date(Date.now() + (entry.retryCount * 60000)); // Exponential backoff
      }
    }

    // Remove synced errors older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.offlineQueue = this.offlineQueue.filter(entry =>
      !entry.synced || entry.timestamp > oneDayAgo
    );
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Default Error Handler Configuration
 */
export const defaultErrorHandlerConfig: ErrorHandlerConfig = {
  enableTracking: true,
  enableReporting: true,
  enableRetry: true,
  enableNotifications: true,
  enableOfflineSupport: true,
  maxErrorsInMemory: 1000,
  classificationRules: [],
  globalRetryConfig: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true,
    retryCondition: (error, attempt) => error.retryable && attempt <= 3
  },
  environment: 'production'
};
