/**
 * Health Check Engine - Comprehensive Health Monitoring
 * Dynamic Video Content Generation Platform
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import axios from 'axios';
import {
  HealthStatus,
  HealthCheckConfig,
  HealthCheck,
  HealthCheckResult
} from '../types';
import { EventBus } from './EventBus';
import { ConfigurationManager } from './ConfigurationManager';

export class HealthCheckEngine extends EventEmitter {
  private logger: Logger;
  private eventBus: EventBus;
  private configManager: ConfigurationManager;
  
  private healthChecks: Map<string, HealthCheck> = new Map();
  private healthStatuses: Map<string, HealthStatus> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private healthHistory: Array<{
    service: string;
    status: HealthStatus;
    timestamp: Date;
  }> = [];
  
  private isInitialized: boolean = false;
  private isMonitoring: boolean = false;
  private maxHistorySize: number = 1000;
  private defaultConfig: HealthCheckConfig;

  constructor(logger: Logger, eventBus: EventBus, configManager: ConfigurationManager) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
    this.configManager = configManager;
    
    this.defaultConfig = {
      interval: 30000, // 30 seconds
      timeout: 5000,   // 5 seconds
      retries: 3,
      successThreshold: 2,
      failureThreshold: 3,
      checks: []
    };
  }

  /**
   * Initialize the health check engine
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Health Check Engine...');
      
      // Initialize default health checks
      await this.initializeDefaultHealthChecks();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      this.isInitialized = true;
      this.logger.info('Health Check Engine initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Health Check Engine:', error);
      throw error;
    }
  }

  /**
   * Start health monitoring
   */
  async startMonitoring(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Health Check Engine not initialized');
    }

    if (this.isMonitoring) {
      this.logger.warn('Health monitoring is already running');
      return;
    }

    try {
      this.logger.info('Starting health monitoring...');
      
      // Start monitoring for each registered health check
      for (const [serviceName, healthCheck] of this.healthChecks) {
        await this.startServiceMonitoring(serviceName, healthCheck);
      }
      
      this.isMonitoring = true;
      this.logger.info('Health monitoring started successfully');
      
      // Emit monitoring started event
      await this.eventBus.publish({
        id: uuidv4(),
        type: 'health:monitoring_started',
        source: 'health_check_engine',
        timestamp: new Date(),
        data: { services: Array.from(this.healthChecks.keys()) }
      });
      
    } catch (error) {
      this.logger.error('Failed to start health monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop health monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      this.logger.warn('Health monitoring is not running');
      return;
    }

    try {
      this.logger.info('Stopping health monitoring...');
      
      // Stop all monitoring intervals
      for (const [serviceName, interval] of this.checkIntervals) {
        clearInterval(interval);
        this.logger.debug(`Stopped monitoring for service: ${serviceName}`);
      }
      
      this.checkIntervals.clear();
      this.isMonitoring = false;
      
      this.logger.info('Health monitoring stopped successfully');
      
      // Emit monitoring stopped event
      await this.eventBus.publish({
        id: uuidv4(),
        type: 'health:monitoring_stopped',
        source: 'health_check_engine',
        timestamp: new Date(),
        data: { services: Array.from(this.healthChecks.keys()) }
      });
      
    } catch (error) {
      this.logger.error('Failed to stop health monitoring:', error);
      throw error;
    }
  }

  /**
   * Register a new health check
   */
  registerHealthCheck(serviceName: string, healthCheck: HealthCheck, config?: Partial<HealthCheckConfig>): void {
    const fullConfig = { ...this.defaultConfig, ...config };
    
    this.healthChecks.set(serviceName, healthCheck);
    
    // Initialize health status
    this.healthStatuses.set(serviceName, {
      service: serviceName,
      status: 'unknown',
      checks: [],
      lastCheck: new Date(),
      uptime: 0
    });
    
    this.logger.info(`Registered health check for service: ${serviceName}`);
    
    // Start monitoring if engine is already running
    if (this.isMonitoring) {
      this.startServiceMonitoring(serviceName, healthCheck, fullConfig);
    }
    
    this.emit('healthCheck:registered', { serviceName, healthCheck });
  }

  /**
   * Unregister a health check
   */
  unregisterHealthCheck(serviceName: string): void {
    // Stop monitoring interval
    const interval = this.checkIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(serviceName);
    }
    
    // Remove health check and status
    this.healthChecks.delete(serviceName);
    this.healthStatuses.delete(serviceName);
    
    this.logger.info(`Unregistered health check for service: ${serviceName}`);
    this.emit('healthCheck:unregistered', { serviceName });
  }

  /**
   * Get health status for a specific service
   */
  getHealthStatus(serviceName: string): HealthStatus | null {
    return this.healthStatuses.get(serviceName) || null;
  }

  /**
   * Get health status for all services
   */
  getAllHealthStatuses(): Record<string, HealthStatus> {
    const statuses: Record<string, HealthStatus> = {};
    
    for (const [serviceName, status] of this.healthStatuses) {
      statuses[serviceName] = status;
    }
    
    return statuses;
  }

  /**
   * Perform immediate health check for a service
   */
  async performHealthCheck(serviceName: string): Promise<HealthStatus> {
    const healthCheck = this.healthChecks.get(serviceName);
    if (!healthCheck) {
      throw new Error(`Health check not found for service: ${serviceName}`);
    }

    try {
      const result = await this.executeHealthCheck(healthCheck);
      const status = this.updateHealthStatus(serviceName, [result]);
      
      this.logger.debug(`Performed health check for ${serviceName}:`, {
        status: status.status,
        responseTime: result.responseTime
      });
      
      return status;
      
    } catch (error) {
      this.logger.error(`Health check failed for ${serviceName}:`, error);
      
      const failedResult: HealthCheckResult = {
        check: healthCheck.name,
        status: 'fail',
        responseTime: 0,
        message: error.message,
        timestamp: new Date()
      };
      
      return this.updateHealthStatus(serviceName, [failedResult]);
    }
  }

  /**
   * Initialize default health checks
   */
  private async initializeDefaultHealthChecks(): Promise<void> {
    // Database health check
    this.registerHealthCheck('database', {
      name: 'database',
      type: 'http',
      target: 'http://localhost:54321/rest/v1/',
      expectedResponse: null,
      critical: true,
      timeout: 5000
    });

    // S3 health check
    this.registerHealthCheck('s3', {
      name: 's3',
      type: 'http',
      target: 'https://s3.amazonaws.com',
      expectedResponse: null,
      critical: true,
      timeout: 10000
    });

    // FFmpeg health check
    this.registerHealthCheck('ffmpeg', {
      name: 'ffmpeg',
      type: 'command',
      target: 'ffmpeg -version',
      expectedResponse: null,
      critical: true,
      timeout: 3000
    });

    // API Gateway health check
    this.registerHealthCheck('api_gateway', {
      name: 'api_gateway',
      type: 'http',
      target: 'http://localhost:3000/health',
      expectedResponse: { ok: true },
      critical: true,
      timeout: 5000
    });

    // Redis health check (optional)
    this.registerHealthCheck('redis', {
      name: 'redis',
      type: 'tcp',
      target: 'localhost:6379',
      expectedResponse: null,
      critical: false,
      timeout: 3000
    });

    this.logger.info(`Initialized ${this.healthChecks.size} default health checks`);
  }

  /**
   * Start monitoring for a specific service
   */
  private async startServiceMonitoring(
    serviceName: string, 
    healthCheck: HealthCheck, 
    config: HealthCheckConfig = this.defaultConfig
  ): Promise<void> {
    // Stop existing interval if any
    const existingInterval = this.checkIntervals.get(serviceName);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Start new monitoring interval
    const interval = setInterval(async () => {
      try {
        await this.performHealthCheck(serviceName);
      } catch (error) {
        this.logger.error(`Scheduled health check failed for ${serviceName}:`, error);
      }
    }, config.interval);

    this.checkIntervals.set(serviceName, interval);
    
    // Perform initial health check
    try {
      await this.performHealthCheck(serviceName);
    } catch (error) {
      this.logger.warn(`Initial health check failed for ${serviceName}:`, error);
    }

    this.logger.debug(`Started monitoring for service: ${serviceName} (interval: ${config.interval}ms)`);
  }

  /**
   * Execute a health check
   */
  private async executeHealthCheck(healthCheck: HealthCheck): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      let result: any;
      
      switch (healthCheck.type) {
        case 'http':
          result = await this.executeHttpCheck(healthCheck);
          break;
        case 'tcp':
          result = await this.executeTcpCheck(healthCheck);
          break;
        case 'command':
          result = await this.executeCommandCheck(healthCheck);
          break;
        case 'custom':
          result = await this.executeCustomCheck(healthCheck);
          break;
        default:
          throw new Error(`Unsupported health check type: ${healthCheck.type}`);
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        check: healthCheck.name,
        status: 'pass',
        responseTime,
        message: 'Health check passed',
        timestamp: new Date(),
        details: result
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        check: healthCheck.name,
        status: 'fail',
        responseTime,
        message: error.message,
        timestamp: new Date(),
        details: { error: error.message }
      };
    }
  }

  /**
   * Execute HTTP health check
   */
  private async executeHttpCheck(healthCheck: HealthCheck): Promise<any> {
    const timeout = healthCheck.timeout || this.defaultConfig.timeout;
    
    try {
      const response = await axios.get(healthCheck.target, {
        timeout,
        validateStatus: (status) => status < 500 // Accept 4xx as valid responses
      });
      
      // Check expected response if specified
      if (healthCheck.expectedResponse) {
        const expected = healthCheck.expectedResponse;
        const actual = response.data;
        
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
          throw new Error(`Response mismatch. Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
        }
      }
      
      return {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      };
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Connection refused - service may be down');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Request timed out');
      } else {
        throw error;
      }
    }
  }

  /**
   * Execute TCP health check
   */
  private async executeTcpCheck(healthCheck: HealthCheck): Promise<any> {
    return new Promise((resolve, reject) => {
      const [host, portStr] = healthCheck.target.split(':');
      const port = parseInt(portStr, 10);
      const timeout = healthCheck.timeout || this.defaultConfig.timeout;
      
      const net = require('net');
      const socket = new net.Socket();
      
      const timeoutId = setTimeout(() => {
        socket.destroy();
        reject(new Error('TCP connection timed out'));
      }, timeout);
      
      socket.connect(port, host, () => {
        clearTimeout(timeoutId);
        socket.destroy();
        resolve({ connected: true, host, port });
      });
      
      socket.on('error', (error) => {
        clearTimeout(timeoutId);
        socket.destroy();
        reject(new Error(`TCP connection failed: ${error.message}`));
      });
    });
  }

  /**
   * Execute command health check
   */
  private async executeCommandCheck(healthCheck: HealthCheck): Promise<any> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const timeout = healthCheck.timeout || this.defaultConfig.timeout;
      
      exec(healthCheck.target, { timeout }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${error.message}`));
          return;
        }
        
        if (stderr) {
          reject(new Error(`Command stderr: ${stderr}`));
          return;
        }
        
        resolve({ stdout: stdout.trim(), command: healthCheck.target });
      });
    });
  }

  /**
   * Execute custom health check
   */
  private async executeCustomCheck(healthCheck: HealthCheck): Promise<any> {
    // For custom checks, the target should be a function
    // This is a placeholder implementation
    throw new Error('Custom health checks not implemented yet');
  }

  /**
   * Update health status based on check results
   */
  private updateHealthStatus(serviceName: string, results: HealthCheckResult[]): HealthStatus {
    const currentStatus = this.healthStatuses.get(serviceName);
    if (!currentStatus) {
      throw new Error(`Health status not found for service: ${serviceName}`);
    }

    // Determine overall status
    const hasFailures = results.some(r => r.status === 'fail');
    const hasWarnings = results.some(r => r.status === 'warn');
    
    let newStatus: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
    if (hasFailures) {
      newStatus = 'unhealthy';
    } else if (hasWarnings) {
      newStatus = 'degraded';
    } else {
      newStatus = 'healthy';
    }

    // Calculate uptime
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - currentStatus.lastCheck.getTime();
    const uptime = newStatus === 'healthy' ? 
      currentStatus.uptime + timeSinceLastCheck : 0;

    // Calculate average response time
    const avgResponseTime = results.length > 0 ? 
      results.reduce((sum, r) => sum + r.responseTime, 0) / results.length : 0;

    const updatedStatus: HealthStatus = {
      service: serviceName,
      status: newStatus,
      checks: results,
      lastCheck: now,
      uptime,
      responseTime: avgResponseTime,
      metadata: {
        checkCount: results.length,
        lastStatusChange: currentStatus.status !== newStatus ? now : currentStatus.metadata?.lastStatusChange
      }
    };

    this.healthStatuses.set(serviceName, updatedStatus);

    // Add to history
    this.addToHistory(serviceName, updatedStatus);

    // Emit status change event if status changed
    if (currentStatus.status !== newStatus) {
      this.logger.info(`Health status changed for ${serviceName}: ${currentStatus.status} -> ${newStatus}`);
      
      this.eventBus.publish({
        id: uuidv4(),
        type: 'health:status_changed',
        source: 'health_check_engine',
        timestamp: now,
        data: {
          service: serviceName,
          oldStatus: currentStatus.status,
          newStatus,
          responseTime: avgResponseTime
        }
      });
      
      this.emit('healthStatus:changed', {
        service: serviceName,
        oldStatus: currentStatus.status,
        newStatus,
        status: updatedStatus
      });
    }

    return updatedStatus;
  }

  /**
   * Add status to history
   */
  private addToHistory(serviceName: string, status: HealthStatus): void {
    this.healthHistory.push({
      service: serviceName,
      status: { ...status },
      timestamp: new Date()
    });

    // Trim history if too large
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle service registration events
    this.eventBus.subscribe('service:registered', async (event) => {
      const { serviceName, endpoint } = event.data;
      
      // Auto-register health check for new services
      if (endpoint && endpoint.url) {
        this.registerHealthCheck(serviceName, {
          name: serviceName,
          type: 'http',
          target: `${endpoint.url}/health`,
          expectedResponse: null,
          critical: false,
          timeout: 5000
        });
      }
    });

    // Handle service unregistration events
    this.eventBus.subscribe('service:unregistered', async (event) => {
      const { serviceName } = event.data;
      this.unregisterHealthCheck(serviceName);
    });
  }

  /**
   * Get health check statistics
   */
  getHealthCheckStats(): any {
    const stats = {
      totalServices: this.healthChecks.size,
      healthyServices: 0,
      unhealthyServices: 0,
      degradedServices: 0,
      unknownServices: 0,
      isMonitoring: this.isMonitoring,
      historySize: this.healthHistory.length,
      serviceDetails: {} as Record<string, any>
    };

    for (const [serviceName, status] of this.healthStatuses) {
      switch (status.status) {
        case 'healthy':
          stats.healthyServices++;
          break;
        case 'unhealthy':
          stats.unhealthyServices++;
          break;
        case 'degraded':
          stats.degradedServices++;
          break;
        case 'unknown':
          stats.unknownServices++;
          break;
      }

      stats.serviceDetails[serviceName] = {
        status: status.status,
        lastCheck: status.lastCheck,
        uptime: status.uptime,
        responseTime: status.responseTime,
        checkCount: status.checks.length
      };
    }

    return stats;
  }

  /**
   * Get health history for a service
   */
  getHealthHistory(serviceName?: string, limit?: number): any[] {
    let history = [...this.healthHistory];

    if (serviceName) {
      history = history.filter(h => h.service === serviceName);
    }

    if (limit) {
      history = history.slice(-limit);
    }

    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Shutdown health check engine
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Health Check Engine...');
    
    try {
      // Stop monitoring
      await this.stopMonitoring();
      
      // Clear all data structures
      this.healthChecks.clear();
      this.healthStatuses.clear();
      this.checkIntervals.clear();
      this.healthHistory = [];
      
      this.isInitialized = false;
      this.logger.info('Health Check Engine shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during health check engine shutdown:', error);
      throw error;
    }
  }
}