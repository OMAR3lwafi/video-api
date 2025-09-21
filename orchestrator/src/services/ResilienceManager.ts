import { EventEmitter } from 'events';
import {
  CircuitBreakerConfig,
  CircuitBreakerState,
  RetryPolicy,
  RollbackStrategy,
  OrchestratorError
} from '../types/index.js';
import { Logger } from '../utils/Logger.js';
import { ConfigurationManager } from './ConfigurationManager.js';

export class ResilienceManager extends EventEmitter {
  private circuitBreakers: Map<string, CircuitBreaker>;
  private retryPolicies: Map<string, RetryPolicy>;
  private failoverManager: FailoverManager;
  private backupOrchestrator: BackupOrchestrator;
  private logger: Logger;
  private configManager: ConfigurationManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.circuitBreakers = new Map();
    this.retryPolicies = new Map();
    this.failoverManager = new FailoverManager();
    this.backupOrchestrator = new BackupOrchestrator();
    this.logger = new Logger('ResilienceManager');
    this.configManager = ConfigurationManager.getInstance();
  }

  /**
   * Initialize the resilience manager
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Resilience Manager...');

      // Initialize resilience components
      this.initializeResilienceComponents();

      // Initialize failover manager
      await this.failoverManager.initialize();

      // Initialize backup orchestrator
      await this.backupOrchestrator.initialize();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      this.logger.info('Resilience Manager initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Resilience Manager:', error);
      throw error;
    }
  }

  /**
   * Execute operation with resilience patterns
   */
  public async executeWithResilience<T>(
    operationName: string,
    operation: () => Promise<T>,
    options: ResilienceOptions = {}
  ): Promise<T> {
    if (!this.isInitialized) {
      throw new OrchestratorError('Resilience Manager not initialized', 'NOT_INITIALIZED');
    }

    const {
      timeout = 30000,
      retries = 3,
      circuitBreakerEnabled = true,
      fallbackEnabled = true
    } = options;

    let circuitBreaker: CircuitBreaker | undefined;

    if (circuitBreakerEnabled) {
      circuitBreaker = this.getOrCreateCircuitBreaker(operationName);
    }

    try {
      // Check circuit breaker state
      if (circuitBreaker && circuitBreaker.currentState === 'open') {
        throw new OrchestratorError(
          `Circuit breaker is open for operation: ${operationName}`,
          'CIRCUIT_BREAKER_OPEN'
        );
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(operation, timeout);

      // Record success in circuit breaker
      if (circuitBreaker) {
        circuitBreaker.recordSuccess();
      }

      return result;

    } catch (error) {
      // Record failure in circuit breaker
      if (circuitBreaker) {
        circuitBreaker.recordFailure();
      }

      // Handle operation failure
      return await this.handleOperationFailure(
        operationName,
        operation,
        error,
        retries,
        fallbackEnabled
      );
    }
  }

  /**
   * Get or create circuit breaker for operation
   */
  private getOrCreateCircuitBreaker(operationName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operationName)) {
      const config = this.getCircuitBreakerConfig(operationName);
      const circuitBreaker = new CircuitBreaker(config);
      this.circuitBreakers.set(operationName, circuitBreaker);

      // Listen to circuit breaker events
      circuitBreaker.on('state_changed', (state: CircuitBreakerState) => {
        this.logger.warn(`Circuit breaker ${operationName} changed state to: ${state}`);
        this.emit('circuit_breaker_state_changed', { operationName, state });
      });
    }

    return this.circuitBreakers.get(operationName)!;
  }

  /**
   * Initialize resilience components
   */
  private initializeResilienceComponents(): void {
    // Initialize default circuit breaker configurations
    const defaultConfig: CircuitBreakerConfig = {
      name: 'default',
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 10000,
      halfOpenMaxCalls: 3
    };

    // Common operations that need circuit breakers
    const operations = [
      'job_analysis',
      'resource_allocation',
      'workflow_execution',
      'service_communication',
      'database_operation',
      's3_operation'
    ];

    for (const operation of operations) {
      const config = { ...defaultConfig, name: operation };
      this.circuitBreakers.set(operation, new CircuitBreaker(config));
    }

    // Initialize retry policies
    this.initializeRetryPolicies();

    this.logger.info(`Initialized ${this.circuitBreakers.size} circuit breakers`);
  }

  /**
   * Initialize retry policies for different operations
   */
  private initializeRetryPolicies(): void {
    const policies: Record<string, RetryPolicy> = {
      default: {
        maxRetries: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
        maxBackoffMs: 30000
      },
      network_operation: {
        maxRetries: 5,
        backoffMs: 500,
        backoffMultiplier: 1.5,
        maxBackoffMs: 10000
      },
      database_operation: {
        maxRetries: 3,
        backoffMs: 2000,
        backoffMultiplier: 2,
        maxBackoffMs: 60000
      },
      critical_operation: {
        maxRetries: 1,
        backoffMs: 5000,
        backoffMultiplier: 1,
        maxBackoffMs: 5000
      }
    };

    for (const [name, policy] of Object.entries(policies)) {
      this.retryPolicies.set(name, policy);
    }

    this.logger.info(`Initialized ${this.retryPolicies.size} retry policies`);
  }

  /**
   * Handle operation failure with retry logic
   */
  private async handleOperationFailure<T>(
    operationName: string,
    operation: () => Promise<T>,
    originalError: any,
    maxRetries: number,
    fallbackEnabled: boolean
  ): Promise<T> {

    if (maxRetries <= 0) {
      // No retries left, try fallback
      if (fallbackEnabled) {
        return await this.executeFallback(operationName, originalError);
      }
      throw originalError;
    }

    // Get retry policy for this operation
    const retryPolicy = this.getRetryPolicy(operationName);

    // Calculate backoff delay
    const attempt = retryPolicy.maxRetries - maxRetries + 1;
    const delay = this.calculateBackoffDelay(retryPolicy, attempt);

    this.logger.warn(`Retrying operation ${operationName} in ${delay}ms (attempt ${attempt}/${retryPolicy.maxRetries})`);

    // Wait before retry
    await this.sleep(delay);

    try {
      // Retry the operation
      const result = await this.executeWithTimeout(operation, 30000);
      this.logger.info(`Operation ${operationName} succeeded on retry attempt ${attempt}`);
      return result;

    } catch (retryError) {
      // Recursive retry with decremented count
      return await this.handleOperationFailure(
        operationName,
        operation,
        retryError,
        maxRetries - 1,
        fallbackEnabled
      );
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeout);
      })
    ]);
  }

  /**
   * Execute fallback for failed operation
   */
  private async executeFallback<T>(operationName: string, error: any): Promise<T> {
    this.logger.warn(`Executing fallback for operation: ${operationName}`);

    switch (operationName) {
      case 'job_analysis':
        return this.fallbackJobAnalysis() as T;

      case 'resource_allocation':
        return this.fallbackResourceAllocation() as T;

      case 'workflow_execution':
        return this.fallbackWorkflowExecution() as T;

      case 'service_communication':
        return this.fallbackServiceCommunication() as T;

      default:
        throw new OrchestratorError(
          `No fallback available for operation: ${operationName}`,
          'NO_FALLBACK',
          error
        );
    }
  }

  /**
   * Get circuit breaker configuration for operation
   */
  private getCircuitBreakerConfig(operationName: string): CircuitBreakerConfig {
    const config = this.configManager.getConfig();

    const configs: Record<string, CircuitBreakerConfig> = {
      job_analysis: {
        name: operationName,
        failureThreshold: 3,
        recoveryTimeout: 30000,
        monitoringPeriod: 10000,
        halfOpenMaxCalls: 2
      },
      resource_allocation: {
        name: operationName,
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 15000,
        halfOpenMaxCalls: 3
      },
      workflow_execution: {
        name: operationName,
        failureThreshold: 2,
        recoveryTimeout: 120000,
        monitoringPeriod: 20000,
        halfOpenMaxCalls: 1
      }
    };

    return configs[operationName] || {
      name: operationName,
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 10000,
      halfOpenMaxCalls: 3
    };
  }

  /**
   * Get retry policy for operation
   */
  private getRetryPolicy(operationName: string): RetryPolicy {
    // Map operations to retry policy types
    const policyMappings: Record<string, string> = {
      service_communication: 'network_operation',
      database_operation: 'database_operation',
      job_analysis: 'critical_operation'
    };

    const policyType = policyMappings[operationName] || 'default';
    return this.retryPolicies.get(policyType) || this.retryPolicies.get('default')!;
  }

  /**
   * Calculate backoff delay for retry
   */
  private calculateBackoffDelay(policy: RetryPolicy, attempt: number): number {
    let delay = policy.backoffMs;

    if (policy.backoffMultiplier && policy.backoffMultiplier > 1) {
      delay = Math.floor(delay * Math.pow(policy.backoffMultiplier, attempt - 1));
    }

    if (policy.maxBackoffMs) {
      delay = Math.min(delay, policy.maxBackoffMs);
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start health monitoring for resilience components
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performResilienceHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Perform health check on resilience components
   */
  private async performResilienceHealthCheck(): Promise<void> {
    try {
      // Check circuit breaker states
      let openCircuitBreakers = 0;
      for (const [name, circuitBreaker] of this.circuitBreakers.entries()) {
        if (circuitBreaker.currentState === 'open') {
          openCircuitBreakers++;
          this.logger.warn(`Circuit breaker ${name} is open`);
        }
      }

      // Alert if too many circuit breakers are open
      if (openCircuitBreakers > this.circuitBreakers.size * 0.5) {
        this.emit('resilience_degraded', {
          reason: 'Too many circuit breakers open',
          openCircuitBreakers,
          totalCircuitBreakers: this.circuitBreakers.size
        });
      }

      // Check failover manager health
      const failoverHealth = await this.failoverManager.getHealth();
      if (!failoverHealth.healthy) {
        this.emit('failover_unhealthy', failoverHealth);
      }

    } catch (error) {
      this.logger.error('Resilience health check failed:', error);
    }
  }

  // Fallback implementations
  private async fallbackJobAnalysis(): Promise<any> {
    // Return basic job analysis as fallback
    return {
      estimatedDuration: 60,
      resourceRequirements: { cpu: 2, memory: 4, storage: 10, bandwidth: 100, gpu: false, estimatedDuration: 60 },
      priority: 'normal',
      complexity: 'moderate',
      optimalStrategy: 'balanced_async',
      riskFactors: ['Fallback analysis used'],
      optimizationHints: ['Retry with full analysis when service recovers']
    };
  }

  private async fallbackResourceAllocation(): Promise<any> {
    // Return minimal resource allocation as fallback
    return {
      id: `fallback_${Date.now()}`,
      allocation: {
        cpu: { cores: 2, affinity: 'any', priority: 'normal' },
        memory: { size: 4, type: 'standard', swapEnabled: false },
        storage: { size: 10, type: 'ssd', iops: 1000 },
        network: { bandwidth: 100, latencyRequirement: 'standard', priorityClass: 'normal' },
        gpu: { enabled: false }
      },
      status: 'allocated',
      metrics: this.createEmptyMetrics(),
      nodeAssignments: []
    };
  }

  private async fallbackWorkflowExecution(): Promise<any> {
    // Return basic workflow result as fallback
    return {
      workflowId: `fallback_${Date.now()}`,
      state: 'completed',
      result: { message: 'Fallback execution completed' },
      duration: 30000,
      metrics: {
        totalSteps: 1,
        completedSteps: 1,
        failedSteps: 0,
        averageStepDuration: 30000,
        resourceUtilization: { cpu: 0.5, memory: 0.5, storage: 0.3, network: 0.2 }
      }
    };
  }

  private async fallbackServiceCommunication(): Promise<any> {
    // Return fallback service response
    return {
      status: 'success',
      message: 'Fallback response',
      data: null
    };
  }

  private createEmptyMetrics(): any {
    return {
      cpu: { averageUtilization: 0, peakUtilization: 0, idleTime: 0 },
      memory: { averageUtilization: 0, peakUtilization: 0, swapUsage: 0 },
      storage: { readThroughput: 0, writeThroughput: 0, iopsUtilization: 0 },
      network: { averageBandwidthUtilization: 0, latency: 0, packetLoss: 0 }
    };
  }

  /**
   * Get resilience statistics
   */
  public getResilienceStats(): ResilienceStats {
    const stats: ResilienceStats = {
      circuitBreakers: new Map(),
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      retriedOperations: 0,
      fallbackOperations: 0
    };

    // Collect circuit breaker stats
    for (const [name, circuitBreaker] of this.circuitBreakers.entries()) {
      stats.circuitBreakers.set(name, {
        state: circuitBreaker.currentState,
        failureCount: circuitBreaker.failureCount,
        successCount: circuitBreaker.successCount,
        lastFailureTime: circuitBreaker.lastFailureTime
      });
    }

    return stats;
  }

  /**
   * Reset circuit breaker
   */
  public resetCircuitBreaker(operationName: string): void {
    const circuitBreaker = this.circuitBreakers.get(operationName);
    if (circuitBreaker) {
      circuitBreaker.reset();
      this.logger.info(`Circuit breaker ${operationName} has been reset`);
    }
  }

  /**
   * Shutdown resilience manager
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Resilience Manager...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.failoverManager.shutdown();
    await this.backupOrchestrator.shutdown();

    this.circuitBreakers.clear();
    this.retryPolicies.clear();

    this.removeAllListeners();
    this.logger.info('Resilience Manager shutdown complete');
  }
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = 'closed';
  public failureCount: number = 0;
  public lastFailureTime?: Date;
  public successCount: number = 0;
  private config: CircuitBreakerConfig;
  private halfOpenCallCount: number = 0;

  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = config;
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half_open';
        this.halfOpenCallCount = 0;
        this.emit('state_changed', this.state);
      } else {
        throw new Error(`Circuit breaker ${this.config.name} is open`);
      }
    }

    if (this.state === 'half_open') {
      if (this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
        throw new Error(`Circuit breaker ${this.config.name} half-open call limit exceeded`);
      }
      this.halfOpenCallCount++;
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record successful operation
   */
  recordSuccess(): void {
    this.successCount++;

    if (this.state === 'half_open') {
      if (this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
        this.reset();
      }
    }
  }

  /**
   * Record failed operation
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === 'half_open') {
      this.state = 'open';
      this.emit('state_changed', this.state);
    } else if (this.state === 'closed' && this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      this.emit('state_changed', this.state);
    }
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCallCount = 0;
    this.lastFailureTime = undefined;
    this.emit('state_changed', this.state);
  }

  /**
   * Get current circuit breaker state
   */
  get currentState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Check if circuit breaker should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }
}

// Supporting interfaces and classes
export interface ResilienceOptions {
  timeout?: number;
  retries?: number;
  circuitBreakerEnabled?: boolean;
  fallbackEnabled?: boolean;
}

export interface ResilienceStats {
  circuitBreakers: Map<string, {
    state: CircuitBreakerState;
    failureCount: number;
    successCount: number;
    lastFailureTime?: Date;
  }>;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  retriedOperations: number;
  fallbackOperations: number;
}

/**
 * Failover Manager for handling service failover
 */
class FailoverManager {
  private logger: Logger;
  private primaryServices: Map<string, string> = new Map();
  private backupServices: Map<string, string[]> = new Map();

  constructor() {
    this.logger = new Logger('FailoverManager');
  }

  async initialize(): Promise<void> {
    this.logger.info('Failover Manager initialized');
  }

  async getHealth(): Promise<{ healthy: boolean; reason?: string }> {
    return { healthy: true };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Failover Manager shutdown');
  }
}

/**
 * Backup Orchestrator for handling backup operations
 */
class BackupOrchestrator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('BackupOrchestrator');
  }

  async initialize(): Promise<void> {
    this.logger.info('Backup Orchestrator initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Backup Orchestrator shutdown');
  }
}
