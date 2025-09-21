/**
 * Resilience Manager - Circuit Breakers and Fault Tolerance
 * Dynamic Video Content Generation Platform
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
  CircuitBreakerConfig,
  CircuitBreakerState,
  BulkheadConfig,
  TimeoutConfig,
  RetryPolicy
} from '../types';

import { ConfigurationManager } from './ConfigurationManager';

export class ResilienceManager extends EventEmitter {
  private logger: Logger;
  private configManager: ConfigurationManager;
  
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private bulkheads: Map<string, Bulkhead> = new Map();
  private timeouts: Map<string, TimeoutManager> = new Map();
  private retryPolicies: Map<string, RetryPolicy> = new Map();
  
  private isInitialized: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(logger: Logger, configManager: ConfigurationManager) {
    super();
    this.logger = logger;
    this.configManager = configManager;
  }

  /**
   * Initialize the resilience manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Resilience Manager...');
      
      // Initialize default circuit breakers
      await this.initializeDefaultCircuitBreakers();
      
      // Initialize default bulkheads
      await this.initializeDefaultBulkheads();
      
      // Initialize default retry policies
      await this.initializeDefaultRetryPolicies();
      
      // Start monitoring
      this.startMonitoring();
      
      this.isInitialized = true;
      this.logger.info('Resilience Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Resilience Manager:', error);
      throw error;
    }
  }

  /**
   * Create or get circuit breaker
   */
  getCircuitBreaker(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    let circuitBreaker = this.circuitBreakers.get(name);
    
    if (!circuitBreaker) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 10000, // 10 seconds
        expectedErrors: ['TIMEOUT', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR']
      };
      
      circuitBreaker = new CircuitBreaker(
        name,
        { ...defaultConfig, ...config },
        this.logger
      );
      
      this.circuitBreakers.set(name, circuitBreaker);
      
      // Setup event handlers
      circuitBreaker.on('stateChanged', (state) => {
        this.logger.info(`Circuit breaker ${name} state changed to: ${state}`);
        this.emit('circuitBreaker:stateChanged', { name, state });
      });
      
      this.logger.debug(`Created circuit breaker: ${name}`);
    }
    
    return circuitBreaker;
  }

  /**
   * Create or get bulkhead
   */
  getBulkhead(name: string, config?: BulkheadConfig): Bulkhead {
    let bulkhead = this.bulkheads.get(name);
    
    if (!bulkhead) {
      const defaultConfig: BulkheadConfig = {
        maxConcurrentCalls: 10,
        maxWaitTime: 5000,
        queueSize: 20
      };
      
      bulkhead = new Bulkhead(
        name,
        { ...defaultConfig, ...config },
        this.logger
      );
      
      this.bulkheads.set(name, bulkhead);
      
      this.logger.debug(`Created bulkhead: ${name}`);
    }
    
    return bulkhead;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    circuitBreakerName: string,
    fn: () => Promise<T>,
    config?: CircuitBreakerConfig
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(circuitBreakerName, config);
    return circuitBreaker.execute(fn);
  }

  /**
   * Execute function with bulkhead protection
   */
  async executeWithBulkhead<T>(
    bulkheadName: string,
    fn: () => Promise<T>,
    config?: BulkheadConfig
  ): Promise<T> {
    const bulkhead = this.getBulkhead(bulkheadName, config);
    return bulkhead.execute(fn);
  }

  /**
   * Execute function with retry policy
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryPolicy: RetryPolicy,
    context?: string
  ): Promise<T> {
    let lastError: Error;
    let attempt = 0;
    
    while (attempt <= retryPolicy.maxRetries) {
      try {
        const result = await fn();
        
        if (attempt > 0) {
          this.logger.info(`Function succeeded after ${attempt} retries`, { context });
        }
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        // Check if error is retryable
        if (retryPolicy.retryableErrors && 
            !retryPolicy.retryableErrors.some(errType => 
              lastError.message.includes(errType) || lastError.name === errType
            )) {
          this.logger.warn(`Non-retryable error encountered:`, lastError.message);
          throw lastError;
        }
        
        if (attempt > retryPolicy.maxRetries) {
          this.logger.error(`Function failed after ${retryPolicy.maxRetries} retries:`, lastError.message);
          throw lastError;
        }
        
        // Calculate backoff delay
        const backoffMs = this.calculateBackoff(retryPolicy, attempt);
        
        this.logger.warn(`Attempt ${attempt} failed, retrying in ${backoffMs}ms:`, {
          error: lastError.message,
          context
        });
        
        await this.sleep(backoffMs);
      }
    }
    
    throw lastError!;
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage?: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      this.createTimeoutPromise(timeoutMs, timeoutMessage || `Operation timed out after ${timeoutMs}ms`)
    ]);
  }

  /**
   * Execute function with full resilience protection
   */
  async executeWithResilience<T>(
    name: string,
    fn: () => Promise<T>,
    options: {
      circuitBreaker?: CircuitBreakerConfig;
      bulkhead?: BulkheadConfig;
      retry?: RetryPolicy;
      timeout?: number;
    } = {}
  ): Promise<T> {
    let wrappedFn = fn;
    
    // Wrap with timeout if specified
    if (options.timeout) {
      const originalFn = wrappedFn;
      wrappedFn = () => this.executeWithTimeout(originalFn, options.timeout!);
    }
    
    // Wrap with retry if specified
    if (options.retry) {
      const originalFn = wrappedFn;
      wrappedFn = () => this.executeWithRetry(originalFn, options.retry!, name);
    }
    
    // Wrap with bulkhead if specified
    if (options.bulkhead) {
      const originalFn = wrappedFn;
      wrappedFn = () => this.executeWithBulkhead(`${name}_bulkhead`, originalFn, options.bulkhead);
    }
    
    // Wrap with circuit breaker if specified
    if (options.circuitBreaker) {
      const originalFn = wrappedFn;
      wrappedFn = () => this.executeWithCircuitBreaker(`${name}_cb`, originalFn, options.circuitBreaker);
    }
    
    return wrappedFn();
  }

  /**
   * Initialize default circuit breakers
   */
  private async initializeDefaultCircuitBreakers(): Promise<void> {
    // Database circuit breaker
    this.getCircuitBreaker('database', {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      monitoringPeriod: 5000,
      expectedErrors: ['CONNECTION_ERROR', 'TIMEOUT', 'QUERY_ERROR']
    });
    
    // S3 circuit breaker
    this.getCircuitBreaker('s3', {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 10000,
      expectedErrors: ['SERVICE_UNAVAILABLE', 'TIMEOUT', 'NETWORK_ERROR']
    });
    
    // FFmpeg circuit breaker
    this.getCircuitBreaker('ffmpeg', {
      failureThreshold: 3,
      recoveryTimeout: 45000,
      monitoringPeriod: 8000,
      expectedErrors: ['PROCESSING_ERROR', 'TIMEOUT', 'RESOURCE_ERROR']
    });
    
    // External API circuit breaker
    this.getCircuitBreaker('external_api', {
      failureThreshold: 5,
      recoveryTimeout: 120000,
      monitoringPeriod: 15000,
      expectedErrors: ['HTTP_ERROR', 'TIMEOUT', 'RATE_LIMITED']
    });
    
    this.logger.info('Default circuit breakers initialized');
  }

  /**
   * Initialize default bulkheads
   */
  private async initializeDefaultBulkheads(): Promise<void> {
    // Video processing bulkhead
    this.getBulkhead('video_processing', {
      maxConcurrentCalls: 5,
      maxWaitTime: 10000,
      queueSize: 15
    });
    
    // Database operations bulkhead
    this.getBulkhead('database_ops', {
      maxConcurrentCalls: 20,
      maxWaitTime: 5000,
      queueSize: 50
    });
    
    // File upload bulkhead
    this.getBulkhead('file_upload', {
      maxConcurrentCalls: 10,
      maxWaitTime: 15000,
      queueSize: 25
    });
    
    this.logger.info('Default bulkheads initialized');
  }

  /**
   * Initialize default retry policies
   */
  private async initializeDefaultRetryPolicies(): Promise<void> {
    // Network operations retry policy
    this.retryPolicies.set('network', {
      maxRetries: 3,
      backoffMs: 1000,
      backoffMultiplier: 2,
      maxBackoffMs: 10000,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'CONNECTION_ERROR'],
      jitter: true
    });
    
    // Database operations retry policy
    this.retryPolicies.set('database', {
      maxRetries: 2,
      backoffMs: 500,
      backoffMultiplier: 2,
      maxBackoffMs: 5000,
      retryableErrors: ['CONNECTION_ERROR', 'DEADLOCK', 'TIMEOUT'],
      jitter: true
    });
    
    // Processing operations retry policy
    this.retryPolicies.set('processing', {
      maxRetries: 1,
      backoffMs: 2000,
      backoffMultiplier: 1.5,
      maxBackoffMs: 8000,
      retryableErrors: ['TEMPORARY_ERROR', 'RESOURCE_BUSY'],
      jitter: false
    });
    
    this.logger.info('Default retry policies initialized');
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoff(retryPolicy: RetryPolicy, attempt: number): number {
    let backoff = retryPolicy.backoffMs;
    
    if (retryPolicy.backoffMultiplier) {
      backoff *= Math.pow(retryPolicy.backoffMultiplier, attempt - 1);
    }
    
    if (retryPolicy.maxBackoffMs) {
      backoff = Math.min(backoff, retryPolicy.maxBackoffMs);
    }
    
    if (retryPolicy.jitter) {
      backoff += Math.random() * 1000;
    }
    
    return Math.floor(backoff);
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeoutMs: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    });
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000); // Every 30 seconds
    
    this.logger.debug('Resilience monitoring started');
  }

  /**
   * Collect resilience metrics
   */
  private collectMetrics(): void {
    const metrics = {
      circuitBreakers: {},
      bulkheads: {},
      timestamp: new Date().toISOString()
    };
    
    // Collect circuit breaker metrics
    for (const [name, cb] of this.circuitBreakers) {
      metrics.circuitBreakers[name] = {
        state: cb.getState().state,
        failureCount: cb.getState().failureCount,
        successCount: cb.getState().successCount || 0,
        lastFailureTime: cb.getState().lastFailureTime
      };
    }
    
    // Collect bulkhead metrics
    for (const [name, bulkhead] of this.bulkheads) {
      metrics.bulkheads[name] = {
        activeCalls: bulkhead.getActiveCalls(),
        queuedCalls: bulkhead.getQueuedCalls(),
        rejectedCalls: bulkhead.getRejectedCalls()
      };
    }
    
    this.emit('metrics:collected', metrics);
  }

  /**
   * Get resilience statistics
   */
  getResilienceStats(): any {
    const stats = {
      circuitBreakers: {},
      bulkheads: {},
      retryPolicies: Array.from(this.retryPolicies.keys())
    };
    
    // Circuit breaker stats
    for (const [name, cb] of this.circuitBreakers) {
      const state = cb.getState();
      stats.circuitBreakers[name] = {
        state: state.state,
        failureCount: state.failureCount,
        successCount: state.successCount || 0,
        lastFailureTime: state.lastFailureTime,
        nextAttemptTime: state.nextAttemptTime
      };
    }
    
    // Bulkhead stats
    for (const [name, bulkhead] of this.bulkheads) {
      stats.bulkheads[name] = {
        activeCalls: bulkhead.getActiveCalls(),
        queuedCalls: bulkhead.getQueuedCalls(),
        rejectedCalls: bulkhead.getRejectedCalls(),
        maxConcurrentCalls: bulkhead.getMaxConcurrentCalls()
      };
    }
    
    return stats;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(name: string): void {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.reset();
      this.logger.info(`Circuit breaker ${name} reset`);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown resilience manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Resilience Manager...');
    
    try {
      // Stop monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      
      // Clear all data structures
      this.circuitBreakers.clear();
      this.bulkheads.clear();
      this.timeouts.clear();
      this.retryPolicies.clear();
      
      this.isInitialized = false;
      this.logger.info('Resilience Manager shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during resilience manager shutdown:', error);
      throw error;
    }
  }
}

/**
 * Circuit Breaker Implementation
 */
class CircuitBreaker extends EventEmitter {
  private name: string;
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private logger: Logger;
  private successCount: number = 0;

  constructor(name: string, config: CircuitBreakerConfig, logger: Logger) {
    super();
    this.name = name;
    this.config = config;
    this.logger = logger;
    
    this.state = {
      state: 'closed',
      failureCount: 0
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state.state = 'half_open';
        this.emit('stateChanged', 'half_open');
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
      
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    
    if (this.state.state === 'half_open') {
      // Reset circuit breaker
      this.reset();
    } else {
      // Reset failure count on success
      this.state.failureCount = 0;
    }
  }

  private onFailure(error: Error): void {
    // Check if error is expected
    if (this.config.expectedErrors && 
        !this.config.expectedErrors.some(expectedError => 
          error.message.includes(expectedError) || error.name === expectedError
        )) {
      return; // Don't count unexpected errors
    }

    this.state.failureCount++;
    this.state.lastFailureTime = new Date();

    if (this.state.failureCount >= this.config.failureThreshold) {
      this.state.state = 'open';
      this.state.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
      this.emit('stateChanged', 'open');
      
      this.logger.warn(`Circuit breaker ${this.name} opened after ${this.state.failureCount} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    return this.state.nextAttemptTime ? 
      new Date() >= this.state.nextAttemptTime : false;
  }

  reset(): void {
    this.state = {
      state: 'closed',
      failureCount: 0
    };
    this.successCount = 0;
    this.emit('stateChanged', 'closed');
    
    this.logger.info(`Circuit breaker ${this.name} reset to CLOSED state`);
  }

  getState(): CircuitBreakerState & { successCount: number } {
    return { ...this.state, successCount: this.successCount };
  }
}

/**
 * Bulkhead Implementation
 */
class Bulkhead {
  private name: string;
  private config: BulkheadConfig;
  private logger: Logger;
  
  private activeCalls: number = 0;
  private queuedCalls: number = 0;
  private rejectedCalls: number = 0;
  private queue: Array<{ 
    resolve: (value: any) => void; 
    reject: (error: Error) => void; 
    fn: () => Promise<any> 
  }> = [];

  constructor(name: string, config: BulkheadConfig, logger: Logger) {
    this.name = name;
    this.config = config;
    this.logger = logger;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can execute immediately
    if (this.activeCalls < this.config.maxConcurrentCalls) {
      return this.executeImmediately(fn);
    }

    // Check if we can queue
    if (this.queue.length < this.config.queueSize) {
      return this.executeQueued(fn);
    }

    // Reject if queue is full
    this.rejectedCalls++;
    throw new Error(`Bulkhead ${this.name} is full (active: ${this.activeCalls}, queued: ${this.queue.length})`);
  }

  private async executeImmediately<T>(fn: () => Promise<T>): Promise<T> {
    this.activeCalls++;
    
    try {
      const result = await fn();
      return result;
    } finally {
      this.activeCalls--;
      this.processQueue();
    }
  }

  private async executeQueued<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from queue
        const index = this.queue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.queuedCalls--;
        }
        reject(new Error(`Bulkhead ${this.name} queue timeout`));
      }, this.config.maxWaitTime);

      this.queue.push({
        resolve: (result: any) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        fn: fn as () => Promise<any>
      });
      
      this.queuedCalls++;
    });
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.activeCalls < this.config.maxConcurrentCalls) {
      const item = this.queue.shift()!;
      this.queuedCalls--;
      
      this.executeImmediately(item.fn)
        .then(item.resolve)
        .catch(item.reject);
    }
  }

  getActiveCalls(): number {
    return this.activeCalls;
  }

  getQueuedCalls(): number {
    return this.queuedCalls;
  }

  getRejectedCalls(): number {
    return this.rejectedCalls;
  }

  getMaxConcurrentCalls(): number {
    return this.config.maxConcurrentCalls;
  }
}

/**
 * Timeout Manager Implementation
 */
class TimeoutManager {
  private name: string;
  private config: TimeoutConfig;
  private logger: Logger;

  constructor(name: string, config: TimeoutConfig, logger: Logger) {
    this.name = name;
    this.config = config;
    this.logger = logger;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      this.createTimeoutPromise()
    ]);
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(async () => {
        if (this.config.timeoutAction) {
          try {
            await this.config.timeoutAction();
          } catch (error) {
            this.logger.error(`Timeout action failed for ${this.name}:`, error);
          }
        }
        
        reject(new Error(`Operation ${this.name} timed out after ${this.config.duration}ms`));
      }, this.config.duration);
    });
  }
}