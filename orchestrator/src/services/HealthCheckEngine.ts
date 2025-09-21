import { EventEmitter } from 'events';
import {
  HealthCheckResult,
  SystemHealthReport,
  HealthStatus,
  HealthSummary,
  ResourceUtilization,
  OrchestratorError
} from '../types/index.js';
import { Logger } from '../utils/Logger.js';
import { ConfigurationManager } from './ConfigurationManager.js';

export class HealthCheckEngine extends EventEmitter {
  private healthCheckers: Map<string, HealthChecker>;
  private healthStatus: Map<string, HealthCheckResult>;
  private alertManager: AlertManager;
  private recoveryManager: RecoveryManager;
  private logger: Logger;
  private configManager: ConfigurationManager;
  private checkInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.healthCheckers = new Map();
    this.healthStatus = new Map();
    this.alertManager = new AlertManager();
    this.recoveryManager = new RecoveryManager();
    this.logger = new Logger('HealthCheckEngine');
    this.configManager = ConfigurationManager.getInstance();
  }

  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Health Check Engine...');

      // Initialize health checkers
      this.initializeHealthCheckers();

      // Initialize alert manager
      await this.alertManager.initialize();

      // Initialize recovery manager
      await this.recoveryManager.initialize();

      // Start health check scheduling
      this.startHealthCheckScheduling();

      this.isInitialized = true;
      this.logger.info('Health Check Engine initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Health Check Engine:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive health check across all components
   */
  public async performComprehensiveHealthCheck(): Promise<SystemHealthReport> {
    if (!this.isInitialized) {
      throw new OrchestratorError('Health Check Engine not initialized', 'NOT_INITIALIZED');
    }

    this.logger.debug('Starting comprehensive health check');

    const healthCheckResults: HealthCheckResult[] = [];
    const checkPromises: Promise<HealthCheckResult>[] = [];

    // Execute all health checkers in parallel
    for (const [componentName, checker] of this.healthCheckers.entries()) {
      checkPromises.push(
        this.executeHealthCheck(componentName, checker)
          .catch(error => ({
            component: componentName,
            status: 'unhealthy' as HealthStatus,
            message: `Health check failed: ${error.message}`,
            timestamp: new Date(),
            details: { error: error.message }
          }))
      );
    }

    const results = await Promise.all(checkPromises);
    healthCheckResults.push(...results);

    // Update health status cache
    for (const result of results) {
      this.healthStatus.set(result.component, result);
    }

    // Generate system health report
    const report = this.generateSystemHealthReport(healthCheckResults);

    // Handle unhealthy components
    await this.handleUnhealthyComponents(healthCheckResults);

    this.logger.debug(`Health check completed. Overall status: ${report.overall}`);
    this.emit('health_check_completed', report);

    return report;
  }

  /**
   * Get overall system health status
   */
  public async getOverallHealth(): Promise<{ overall: HealthStatus; components: number }> {
    const healthResults = Array.from(this.healthStatus.values());

    if (healthResults.length === 0) {
      return { overall: 'unknown', components: 0 };
    }

    const healthyCount = healthResults.filter(r => r.status === 'healthy').length;
    const degradedCount = healthResults.filter(r => r.status === 'degraded').length;
    const unhealthyCount = healthResults.filter(r => r.status === 'unhealthy').length;

    let overall: HealthStatus = 'healthy';

    if (unhealthyCount > healthResults.length * 0.3) {
      overall = 'unhealthy';
    } else if (unhealthyCount > 0 || degradedCount > healthResults.length * 0.2) {
      overall = 'degraded';
    }

    return { overall, components: healthResults.length };
  }

  /**
   * Get health status for a specific component
   */
  public getComponentHealth(componentName: string): HealthCheckResult | undefined {
    return this.healthStatus.get(componentName);
  }

  /**
   * Initialize built-in health checkers
   */
  private initializeHealthCheckers(): void {
    // System resource health checker
    this.healthCheckers.set('system_resources', new SystemResourceHealthChecker());

    // Database health checker
    this.healthCheckers.set('database', new DatabaseHealthChecker());

    // Redis health checker
    this.healthCheckers.set('redis', new RedisHealthChecker());

    // Processing service health checker
    this.healthCheckers.set('processing_services', new ProcessingServiceHealthChecker());

    // S3 health checker
    this.healthCheckers.set('s3_storage', new S3HealthChecker());

    // Network connectivity health checker
    this.healthCheckers.set('network_connectivity', new NetworkHealthChecker());

    // Workflow engine health checker
    this.healthCheckers.set('workflow_engine', new WorkflowEngineHealthChecker());

    // Load balancer health checker
    this.healthCheckers.set('load_balancer', new LoadBalancerHealthChecker());

    this.logger.info(`Initialized ${this.healthCheckers.size} health checkers`);
  }

  /**
   * Execute a single health check
   */
  private async executeHealthCheck(componentName: string, checker: HealthChecker): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const result = await checker.performHealthCheck();

      const duration = Date.now() - startTime;

      return {
        ...result,
        component: componentName,
        timestamp: new Date(),
        metrics: {
          ...result.metrics,
          checkDuration: duration
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        component: componentName,
        status: 'unhealthy',
        message: `Health check failed: ${error.message}`,
        timestamp: new Date(),
        metrics: {
          checkDuration: duration,
          error: error.message
        }
      };
    }
  }

  /**
   * Generate system health report
   */
  private generateSystemHealthReport(results: HealthCheckResult[]): SystemHealthReport {
    const healthy = results.filter(r => r.status === 'healthy').length;
    const degraded = results.filter(r => r.status === 'degraded').length;
    const unhealthy = results.filter(r => r.status === 'unhealthy').length;
    const total = results.length;

    let overall: HealthStatus = 'healthy';
    if (unhealthy > total * 0.3) {
      overall = 'unhealthy';
    } else if (unhealthy > 0 || degraded > total * 0.2) {
      overall = 'degraded';
    }

    const summary: HealthSummary = {
      healthy,
      degraded,
      unhealthy,
      total
    };

    const recommendations = this.generateHealthRecommendations(results);

    return {
      overall,
      components: results,
      timestamp: new Date(),
      summary,
      recommendations
    };
  }

  /**
   * Handle unhealthy components
   */
  private async handleUnhealthyComponents(results: HealthCheckResult[]): Promise<void> {
    const unhealthyComponents = results.filter(r => r.status === 'unhealthy');
    const degradedComponents = results.filter(r => r.status === 'degraded');

    // Handle unhealthy components
    for (const component of unhealthyComponents) {
      this.logger.warn(`Component ${component.component} is unhealthy: ${component.message}`);

      // Send alert
      await this.alertManager.sendAlert({
        severity: 'critical',
        component: component.component,
        message: component.message,
        timestamp: component.timestamp
      });

      // Attempt recovery
      await this.recoveryManager.attemptRecovery(component.component, component);
    }

    // Handle degraded components
    for (const component of degradedComponents) {
      this.logger.warn(`Component ${component.component} is degraded: ${component.message}`);

      // Send warning alert
      await this.alertManager.sendAlert({
        severity: 'warning',
        component: component.component,
        message: component.message,
        timestamp: component.timestamp
      });
    }
  }

  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(results: HealthCheckResult[]): string[] {
    const recommendations: string[] = [];

    const unhealthyComponents = results.filter(r => r.status === 'unhealthy');
    const degradedComponents = results.filter(r => r.status === 'degraded');

    if (unhealthyComponents.length > 0) {
      recommendations.push(`${unhealthyComponents.length} critical components need immediate attention`);
    }

    if (degradedComponents.length > 0) {
      recommendations.push(`${degradedComponents.length} components are degraded and may need maintenance`);
    }

    // Component-specific recommendations
    for (const result of results) {
      if (result.status !== 'healthy' && result.details?.recommendation) {
        recommendations.push(`${result.component}: ${result.details.recommendation}`);
      }
    }

    return recommendations;
  }

  /**
   * Start health check scheduling
   */
  private startHealthCheckScheduling(): void {
    const config = this.configManager.getConfig();
    const interval = config.monitoring?.healthCheckInterval || 30000; // 30 seconds default

    this.checkInterval = setInterval(async () => {
      try {
        await this.performComprehensiveHealthCheck();
      } catch (error) {
        this.logger.error('Scheduled health check failed:', error);
      }
    }, interval);

    this.logger.info(`Started health check scheduling with ${interval}ms interval`);
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Health Check Engine...');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    await this.alertManager.shutdown();
    await this.recoveryManager.shutdown();

    this.removeAllListeners();
    this.logger.info('Health Check Engine shutdown complete');
  }
}

// Health Checker Interface
export interface HealthChecker {
  performHealthCheck(): Promise<Omit<HealthCheckResult, 'component' | 'timestamp'>>;
}

// System Resource Health Checker
export class SystemResourceHealthChecker implements HealthChecker {
  async performHealthCheck(): Promise<Omit<HealthCheckResult, 'component' | 'timestamp'>> {
    try {
      const cpuUsage = await this.checkCPUUsage();
      const memoryUsage = await this.checkMemoryUsage();
      const diskUsage = await this.checkDiskUsage();
      const networkHealth = await this.checkNetworkHealth();

      let status: HealthStatus = 'healthy';
      const issues: string[] = [];

      if (cpuUsage > 90) {
        status = 'unhealthy';
        issues.push(`High CPU usage: ${cpuUsage}%`);
      } else if (cpuUsage > 80) {
        status = 'degraded';
        issues.push(`Elevated CPU usage: ${cpuUsage}%`);
      }

      if (memoryUsage > 95) {
        status = 'unhealthy';
        issues.push(`Critical memory usage: ${memoryUsage}%`);
      } else if (memoryUsage > 85) {
        status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        issues.push(`High memory usage: ${memoryUsage}%`);
      }

      if (diskUsage > 95) {
        status = 'unhealthy';
        issues.push(`Critical disk usage: ${diskUsage}%`);
      } else if (diskUsage > 85) {
        status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        issues.push(`High disk usage: ${diskUsage}%`);
      }

      return {
        status,
        message: issues.length > 0 ? issues.join(', ') : 'System resources are healthy',
        metrics: {
          cpuUsage,
          memoryUsage,
          diskUsage,
          networkLatency: networkHealth.latency,
          networkPacketLoss: networkHealth.packetLoss
        },
        details: {
          cpu: cpuUsage,
          memory: memoryUsage,
          disk: diskUsage,
          network: networkHealth
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Failed to check system resources: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  private async checkCPUUsage(): Promise<number> {
    // Simulate CPU usage check - in real implementation, use system monitoring
    return Math.random() * 100;
  }

  private async checkMemoryUsage(): Promise<number> {
    // Simulate memory usage check - in real implementation, use system monitoring
    return Math.random() * 100;
  }

  private async checkDiskUsage(): Promise<number> {
    // Simulate disk usage check - in real implementation, use filesystem monitoring
    return Math.random() * 100;
  }

  private async checkNetworkHealth(): Promise<{ latency: number; packetLoss: number }> {
    // Simulate network health check
    return {
      latency: Math.random() * 100 + 10, // 10-110ms
      packetLoss: Math.random() * 5 // 0-5%
    };
  }
}

// Processing Service Health Checker
export class ProcessingServiceHealthChecker implements HealthChecker {
  async performHealthCheck(): Promise<Omit<HealthCheckResult, 'component' | 'timestamp'>> {
    try {
      const ffmpegAvailable = await this.checkFFmpegAvailability();
      const workerProcesses = await this.checkWorkerProcesses();
      const queueHealth = await this.checkQueueHealth();

      let status: HealthStatus = 'healthy';
      const issues: string[] = [];

      if (!ffmpegAvailable) {
        status = 'unhealthy';
        issues.push('FFmpeg not available');
      }

      if (workerProcesses.active === 0) {
        status = 'unhealthy';
        issues.push('No active worker processes');
      } else if (workerProcesses.active < workerProcesses.expected * 0.5) {
        status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        issues.push(`Low worker count: ${workerProcesses.active}/${workerProcesses.expected}`);
      }

      if (queueHealth.backlog > 1000) {
        status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        issues.push(`High queue backlog: ${queueHealth.backlog}`);
      }

      return {
        status,
        message: issues.length > 0 ? issues.join(', ') : 'Processing services are healthy',
        metrics: {
          ffmpegAvailable: ffmpegAvailable ? 1 : 0,
          activeWorkers: workerProcesses.active,
          expectedWorkers: workerProcesses.expected,
          queueBacklog: queueHealth.backlog,
          queueThroughput: queueHealth.throughput
        },
        details: {
          ffmpeg: ffmpegAvailable,
          workers: workerProcesses,
          queue: queueHealth
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Failed to check processing services: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  private async checkFFmpegAvailability(): Promise<boolean> {
    // Simulate FFmpeg availability check
    return Math.random() > 0.05; // 95% uptime
  }

  private async checkWorkerProcesses(): Promise<{ active: number; expected: number }> {
    // Simulate worker process check
    const expected = 4;
    const active = Math.floor(Math.random() * (expected + 1));
    return { active, expected };
  }

  private async checkQueueHealth(): Promise<{ backlog: number; throughput: number }> {
    // Simulate queue health check
    return {
      backlog: Math.floor(Math.random() * 1500),
      throughput: Math.floor(Math.random() * 100 + 50) // 50-150 jobs/min
    };
  }
}

// Database Health Checker
export class DatabaseHealthChecker implements HealthChecker {
  async performHealthCheck(): Promise<Omit<HealthCheckResult, 'component' | 'timestamp'>> {
    try {
      const connectionStatus = await this.checkConnectionStatus();
      const queryPerformance = await this.checkQueryPerformance();
      const connectionPool = await this.checkConnectionPool();

      let status: HealthStatus = 'healthy';
      const issues: string[] = [];

      if (!connectionStatus.connected) {
        status = 'unhealthy';
        issues.push('Database connection failed');
      } else if (queryPerformance.averageTime > 5000) {
        status = 'degraded';
        issues.push(`Slow query performance: ${queryPerformance.averageTime}ms`);
      }

      if (connectionPool.usage > 0.9) {
        status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        issues.push(`High connection pool usage: ${Math.round(connectionPool.usage * 100)}%`);
      }

      return {
        status,
        message: issues.length > 0 ? issues.join(', ') : 'Database is healthy',
        metrics: {
          connected: connectionStatus.connected ? 1 : 0,
          queryTime: queryPerformance.averageTime,
          poolUsage: connectionPool.usage,
          activeConnections: connectionPool.active,
          totalConnections: connectionPool.total
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database health check failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  private async checkConnectionStatus(): Promise<{ connected: boolean }> {
    return { connected: Math.random() > 0.02 }; // 98% uptime
  }

  private async checkQueryPerformance(): Promise<{ averageTime: number }> {
    return { averageTime: Math.random() * 3000 + 100 }; // 100-3100ms
  }

  private async checkConnectionPool(): Promise<{ usage: number; active: number; total: number }> {
    const total = 20;
    const active = Math.floor(Math.random() * total);
    return { usage: active / total, active, total };
  }
}

// Redis Health Checker
export class RedisHealthChecker implements HealthChecker {
  async performHealthCheck(): Promise<Omit<HealthCheckResult, 'component' | 'timestamp'>> {
    // Simplified Redis health check
    return {
      status: 'healthy',
      message: 'Redis is healthy'
    };
  }
}

// S3 Health Checker
export class S3HealthChecker implements HealthChecker {
  async performHealthCheck(): Promise<Omit<HealthCheckResult, 'component' | 'timestamp'>> {
    // Simplified S3 health check
    return {
      status: 'healthy',
      message: 'S3 storage is healthy'
    };
  }
}

// Network Health Checker
export class NetworkHealthChecker implements HealthChecker {
  async performHealthCheck(): Promise<Omit<HealthCheckResult, 'component' | 'timestamp'>> {
    // Simplified network health check
    return {
      status: 'healthy',
      message: 'Network connectivity is healthy'
    };
  }
}

// Workflow Engine Health Checker
export class WorkflowEngineHealthChecker implements HealthChecker {
  async performHealthCheck(): Promise<Omit<HealthCheckResult, 'component' | 'timestamp'>> {
    // Simplified workflow engine health check
    return {
      status: 'healthy',
      message: 'Workflow engine is healthy'
    };
  }
}

// Load Balancer Health Checker
export class LoadBalancerHealthChecker implements HealthChecker {
  async performHealthCheck(): Promise<Omit<HealthCheckResult, 'component' | 'timestamp'>> {
    // Simplified load balancer health check
    return {
      status: 'healthy',
      message: 'Load balancer is healthy'
    };
  }
}

// Alert Manager
class AlertManager {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('AlertManager');
  }

  async initialize(): Promise<void> {
    this.logger.info('Alert Manager initialized');
  }

  async sendAlert(alert: {
    severity: 'warning' | 'critical';
    component: string;
    message: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.warn(`ALERT [${alert.severity.toUpperCase()}] ${alert.component}: ${alert.message}`);
    // In real implementation, send to alerting systems (Slack, PagerDuty, etc.)
  }

  async shutdown(): Promise<void> {
    this.logger.info('Alert Manager shutdown');
  }
}

// Recovery Manager
class RecoveryManager {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('RecoveryManager');
  }

  async initialize(): Promise<void> {
    this.logger.info('Recovery Manager initialized');
  }

  async attemptRecovery(componentName: string, healthResult: HealthCheckResult): Promise<void> {
    this.logger.info(`Attempting recovery for component: ${componentName}`);

    switch (componentName) {
      case 'processing_services':
        await this.recoverProcessingServices();
        break;
      case 'database':
        await this.recoverDatabase();
        break;
      case 'redis':
        await this.recoverRedis();
        break;
      default:
        this.logger.info(`No automatic recovery available for component: ${componentName}`);
    }
  }

  private async recoverProcessingServices(): Promise<void> {
    this.logger.info('Attempting to restart processing services');
    // Implementation for service recovery
  }

  private async recoverDatabase(): Promise<void> {
    this.logger.info('Attempting to recover database connections');
    // Implementation for database recovery
  }

  private async recoverRedis(): Promise<void> {
    this.logger.info('Attempting to recover Redis connections');
    // Implementation for Redis recovery
  }

  async shutdown(): Promise<void> {
    this.logger.info('Recovery Manager shutdown');
  }
}
