// Health Check Engine - Comprehensive health monitoring
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import axios from 'axios';
import {
  HealthCheckResult,
  HealthAlert,
  NodeStatus,
  WorkerNode
} from '../interfaces/orchestrator.interfaces';

interface HealthCheck {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'process' | 'custom';
  target: string;
  interval: number;
  timeout: number;
  retries: number;
  expectedStatus?: number;
  customCheck?: () => Promise<boolean>;
}

export class HealthCheckEngine extends EventEmitter {
  private checks: Map<string, HealthCheck>;
  private results: Map<string, HealthCheckResult[]>;
  private checkInterval: number;
  private checkTimers: Map<string, NodeJS.Timeout>;
  private isRunning: boolean = false;
  
  constructor(checkInterval: number = 30000) {
    super();
    this.checkInterval = checkInterval;
    this.checks = new Map();
    this.results = new Map();
    this.checkTimers = new Map();
    this.initializeHealthChecks();
  }

  private initializeHealthChecks(): void {
    // Database health check
    this.registerCheck({
      id: 'database',
      name: 'Database Health',
      type: 'custom',
      target: 'postgresql',
      interval: 30000,
      timeout: 5000,
      retries: 3,
      customCheck: async () => await this.checkDatabase()
    });

    // Redis health check
    this.registerCheck({
      id: 'redis',
      name: 'Redis Health',
      type: 'custom',
      target: 'redis',
      interval: 20000,
      timeout: 3000,
      retries: 2,
      customCheck: async () => await this.checkRedis()
    });

    // S3 health check
    this.registerCheck({
      id: 's3',
      name: 'S3 Health',
      type: 'custom',
      target: 'aws-s3',
      interval: 60000,
      timeout: 10000,
      retries: 3,
      customCheck: async () => await this.checkS3()
    });

    // FFmpeg health check
    this.registerCheck({
      id: 'ffmpeg',
      name: 'FFmpeg Health',
      type: 'process',
      target: 'ffmpeg',
      interval: 60000,
      timeout: 5000,
      retries: 2
    });

    // API endpoint health check
    this.registerCheck({
      id: 'api',
      name: 'API Health',
      type: 'http',
      target: 'http://localhost:3000/health',
      interval: 15000,
      timeout: 5000,
      retries: 3,
      expectedStatus: 200
    });
  }

  public registerCheck(check: HealthCheck): void {
    this.checks.set(check.id, check);
    logger.info(`Health check registered: ${check.name}`);
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Health Check Engine is already running');
      return;
    }

    logger.info('Starting Health Check Engine...');
    this.isRunning = true;

    // Start individual health checks
    for (const [id, check] of this.checks.entries()) {
      this.startCheck(id, check);
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Health Check Engine is not running');
      return;
    }

    logger.info('Stopping Health Check Engine...');
    
    // Stop all check timers
    for (const timer of this.checkTimers.values()) {
      clearInterval(timer);
    }
    this.checkTimers.clear();
    
    this.isRunning = false;
  }

  private startCheck(id: string, check: HealthCheck): void {
    // Perform immediate check
    this.performCheck(check);

    // Schedule periodic checks
    const timer = setInterval(() => {
      this.performCheck(check);
    }, check.interval);

    this.checkTimers.set(id, timer);
  }

  private async performCheck(check: HealthCheck): Promise<void> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let attempts = 0;
    let lastError: Error | null = null;
    const alerts: HealthAlert[] = [];

    while (attempts < check.retries) {
      attempts++;
      
      try {
        let success = false;
        
        switch (check.type) {
          case 'http':
            success = await this.performHttpCheck(check);
            break;
          case 'tcp':
            success = await this.performTcpCheck(check);
            break;
          case 'process':
            success = await this.performProcessCheck(check);
            break;
          case 'custom':
            if (check.customCheck) {
              success = await check.customCheck();
            }
            break;
        }

        if (success) {
          status = 'healthy';
          break;
        } else {
          status = 'unhealthy';
        }
      } catch (error) {
        lastError = error as Error;
        status = 'unhealthy';
        logger.warn(`Health check ${check.name} failed (attempt ${attempts}):`, error);
        
        if (attempts < check.retries) {
          await this.sleep(1000 * attempts);
        }
      }
    }

    const latency = Date.now() - startTime;

    // Create health check result
    const result: HealthCheckResult = {
      service: check.id,
      status,
      latency,
      timestamp: new Date(),
      details: {
        checkType: check.type,
        target: check.target,
        attempts,
        error: lastError?.message
      },
      alerts
    };

    // Generate alerts based on status
    if (status === 'unhealthy') {
      alerts.push({
        severity: 'error',
        message: `${check.name} is unhealthy`,
        metric: 'health',
        value: 0,
        threshold: 1,
        timestamp: new Date()
      });
    } else if (status === 'degraded') {
      alerts.push({
        severity: 'warning',
        message: `${check.name} is degraded`,
        metric: 'health',
        value: 0.5,
        threshold: 1,
        timestamp: new Date()
      });
    }

    // Check latency alerts
    if (latency > check.timeout * 0.8) {
      alerts.push({
        severity: 'warning',
        message: `${check.name} latency is high`,
        metric: 'latency',
        value: latency,
        threshold: check.timeout * 0.8,
        timestamp: new Date()
      });
    }

    // Store result
    this.storeResult(check.id, result);

    // Emit health check event
    this.emit('health_check_completed', result);

    if (alerts.length > 0) {
      this.emit('health_alerts', alerts);
    }
  }

  private async performHttpCheck(check: HealthCheck): Promise<boolean> {
    try {
      const response = await axios.get(check.target, {
        timeout: check.timeout,
        validateStatus: () => true
      });

      if (check.expectedStatus) {
        return response.status === check.expectedStatus;
      }
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error(`HTTP health check failed for ${check.target}:`, error);
      return false;
    }
  }

  private async performTcpCheck(check: HealthCheck): Promise<boolean> {
    // TCP check implementation
    const net = require('net');
    const [host, port] = check.target.split(':');

    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(check.timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(parseInt(port), host);
    });
  }

  private async performProcessCheck(check: HealthCheck): Promise<boolean> {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec(`which ${check.target}`, (error: any) => {
        resolve(!error);
      });
    });
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      // Implement actual database health check
      // For now, simulating
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      // Implement actual Redis health check
      // For now, simulating
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  private async checkS3(): Promise<boolean> {
    try {
      // Implement actual S3 health check
      // For now, simulating
      return true;
    } catch (error) {
      logger.error('S3 health check failed:', error);
      return false;
    }
  }

  private storeResult(checkId: string, result: HealthCheckResult): void {
    if (!this.results.has(checkId)) {
      this.results.set(checkId, []);
    }

    const results = this.results.get(checkId)!;
    results.push(result);

    // Keep only last 100 results
    if (results.length > 100) {
      results.shift();
    }
  }

  public getLatestResults(): Map<string, HealthCheckResult> {
    const latest = new Map<string, HealthCheckResult>();
    
    for (const [id, results] of this.results.entries()) {
      if (results.length > 0) {
        latest.set(id, results[results.length - 1]);
      }
    }
    
    return latest;
  }

  public getHealthSummary(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Map<string, HealthCheckResult>;
    alerts: HealthAlert[];
  } {
    const services = this.getLatestResults();
    const alerts: HealthAlert[] = [];
    let unhealthyCount = 0;
    let degradedCount = 0;

    for (const result of services.values()) {
      if (result.status === 'unhealthy') {
        unhealthyCount++;
      } else if (result.status === 'degraded') {
        degradedCount++;
      }

      if (result.alerts) {
        alerts.push(...result.alerts);
      }
    }

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return { overall, services, alerts };
  }

  public async checkNodeHealth(node: WorkerNode): Promise<NodeStatus> {
    const checks: Promise<boolean>[] = [];

    // Check node connectivity
    if (node.hostname) {
      checks.push(this.performHttpCheck({
        id: `node-${node.id}`,
        name: `Node ${node.id} Health`,
        type: 'http',
        target: `http://${node.hostname}:3000/health`,
        interval: 30000,
        timeout: 5000,
        retries: 2
      }));
    }

    // Check node resources
    const resourceHealth = this.evaluateNodeResources(node);
    checks.push(Promise.resolve(resourceHealth));

    const results = await Promise.all(checks);
    const allHealthy = results.every(r => r);

    if (allHealthy) {
      return NodeStatus.HEALTHY;
    } else if (results.some(r => r)) {
      return NodeStatus.DEGRADED;
    } else {
      return NodeStatus.UNHEALTHY;
    }
  }

  private evaluateNodeResources(node: WorkerNode): boolean {
    const cpuHealthy = node.resources.cpu.usage < 0.9;
    const memoryHealthy = (node.resources.memory.used / node.resources.memory.total) < 0.9;
    const storageHealthy = (node.resources.storage.used / node.resources.storage.total) < 0.95;
    
    return cpuHealthy && memoryHealthy && storageHealthy;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getMetrics(): any {
    const metrics: any = {};
    
    for (const [id, results] of this.results.entries()) {
      if (results.length === 0) continue;
      
      const latencies = results.map(r => r.latency);
      const healthyCount = results.filter(r => r.status === 'healthy').length;
      
      metrics[id] = {
        avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        maxLatency: Math.max(...latencies),
        minLatency: Math.min(...latencies),
        uptime: (healthyCount / results.length) * 100,
        totalChecks: results.length
      };
    }
    
    return metrics;
  }
}