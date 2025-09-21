/**
 * Load Balancer Manager - Multiple Balancing Strategies
 * Dynamic Video Content Generation Platform
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
  JobAnalysis,
  LoadBalancingStrategy,
  LoadBalancingAlgorithm,
  ServiceEndpoint,
  LoadBalancingDecision
} from '../types';
import { ConfigurationManager } from './ConfigurationManager';

export class LoadBalancerManager extends EventEmitter {
  private logger: Logger;
  private configManager: ConfigurationManager;
  
  private serviceEndpoints: Map<string, ServiceEndpoint> = new Map();
  private strategies: Map<string, LoadBalancingStrategy> = new Map();
  private requestHistory: Array<{
    endpointId: string;
    timestamp: Date;
    responseTime: number;
    success: boolean;
  }> = [];
  
  private isInitialized: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private maxHistorySize: number = 1000;

  constructor(logger: Logger, configManager: ConfigurationManager) {
    super();
    this.logger = logger;
    this.configManager = configManager;
  }

  /**
   * Initialize the load balancer manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Load Balancer Manager...');
      
      // Initialize default service endpoints
      await this.initializeDefaultEndpoints();
      
      // Initialize load balancing strategies
      this.initializeStrategies();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isInitialized = true;
      this.logger.info('Load Balancer Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Load Balancer Manager:', error);
      throw error;
    }
  }

  /**
   * Select optimal service endpoint based on job analysis
   */
  async selectOptimalService(jobAnalysis: JobAnalysis): Promise<ServiceEndpoint> {
    if (!this.isInitialized) {
      throw new Error('Load Balancer Manager not initialized');
    }

    try {
      // Get strategy based on job characteristics
      const strategy = this.selectStrategy(jobAnalysis);
      
      // Get healthy endpoints
      const healthyEndpoints = this.getHealthyEndpoints();
      
      if (healthyEndpoints.length === 0) {
        throw new Error('No healthy service endpoints available');
      }
      
      // Apply load balancing algorithm
      const decision = await this.applyLoadBalancingAlgorithm(
        strategy,
        healthyEndpoints,
        jobAnalysis
      );
      
      // Update endpoint metrics
      this.updateEndpointMetrics(decision.selectedEndpoint.id);
      
      this.logger.debug(`Selected endpoint ${decision.selectedEndpoint.id} using ${strategy.algorithm}`, {
        reason: decision.reason,
        confidence: decision.confidence
      });
      
      return decision.selectedEndpoint;
      
    } catch (error) {
      this.logger.error('Failed to select optimal service:', error);
      throw error;
    }
  }

  /**
   * Register a new service endpoint
   */
  registerEndpoint(endpoint: ServiceEndpoint): void {
    this.serviceEndpoints.set(endpoint.id, endpoint);
    this.logger.info(`Registered service endpoint: ${endpoint.id} (${endpoint.url})`);
    
    this.emit('endpoint:registered', { endpoint });
  }

  /**
   * Unregister a service endpoint
   */
  unregisterEndpoint(endpointId: string): void {
    const endpoint = this.serviceEndpoints.get(endpointId);
    if (endpoint) {
      this.serviceEndpoints.delete(endpointId);
      this.logger.info(`Unregistered service endpoint: ${endpointId}`);
      
      this.emit('endpoint:unregistered', { endpointId, endpoint });
    }
  }

  /**
   * Update endpoint health status
   */
  updateEndpointHealth(endpointId: string, isHealthy: boolean, responseTime?: number): void {
    const endpoint = this.serviceEndpoints.get(endpointId);
    if (!endpoint) return;

    const oldStatus = endpoint.status;
    endpoint.status = isHealthy ? 'healthy' : 'unhealthy';
    endpoint.lastHealthCheck = new Date();
    
    if (responseTime !== undefined) {
      // Update average response time with exponential moving average
      const alpha = 0.3; // Smoothing factor
      endpoint.averageResponseTime = 
        (alpha * responseTime) + ((1 - alpha) * endpoint.averageResponseTime);
    }

    if (oldStatus !== endpoint.status) {
      this.logger.info(`Endpoint ${endpointId} status changed: ${oldStatus} -> ${endpoint.status}`);
      this.emit('endpoint:status_changed', { endpointId, oldStatus, newStatus: endpoint.status });
    }
  }

  /**
   * Record request completion for metrics
   */
  recordRequest(endpointId: string, responseTime: number, success: boolean): void {
    // Add to history
    this.requestHistory.push({
      endpointId,
      timestamp: new Date(),
      responseTime,
      success
    });

    // Trim history if too large
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory = this.requestHistory.slice(-this.maxHistorySize);
    }

    // Update endpoint metrics
    const endpoint = this.serviceEndpoints.get(endpointId);
    if (endpoint) {
      // Update average response time
      const alpha = 0.2;
      endpoint.averageResponseTime = 
        (alpha * responseTime) + ((1 - alpha) * endpoint.averageResponseTime);
      
      // Update connection count (simulate)
      if (success) {
        endpoint.currentConnections = Math.max(0, endpoint.currentConnections - 1);
      }
    }
  }

  /**
   * Initialize default service endpoints
   */
  private async initializeDefaultEndpoints(): Promise<void> {
    // Main processing service
    this.registerEndpoint({
      id: 'processing-main',
      url: 'http://localhost:3000',
      type: 'processing',
      status: 'healthy',
      weight: 10,
      currentConnections: 0,
      averageResponseTime: 150,
      lastHealthCheck: new Date(),
      metadata: {
        capacity: 'high',
        features: ['video', 'image', 'gpu']
      }
    });

    // Secondary processing service
    this.registerEndpoint({
      id: 'processing-secondary',
      url: 'http://localhost:3001',
      type: 'processing',
      status: 'healthy',
      weight: 8,
      currentConnections: 0,
      averageResponseTime: 200,
      lastHealthCheck: new Date(),
      metadata: {
        capacity: 'medium',
        features: ['video', 'image']
      }
    });

    // GPU-optimized processing service
    this.registerEndpoint({
      id: 'processing-gpu',
      url: 'http://localhost:3002',
      type: 'processing',
      status: 'healthy',
      weight: 15,
      currentConnections: 0,
      averageResponseTime: 100,
      lastHealthCheck: new Date(),
      metadata: {
        capacity: 'high',
        features: ['video', 'image', 'gpu', 'ai']
      }
    });

    // API gateway service
    this.registerEndpoint({
      id: 'api-gateway',
      url: 'http://localhost:8080',
      type: 'api',
      status: 'healthy',
      weight: 5,
      currentConnections: 0,
      averageResponseTime: 50,
      lastHealthCheck: new Date(),
      metadata: {
        capacity: 'high',
        features: ['routing', 'auth', 'rate-limiting']
      }
    });

    this.logger.info(`Initialized ${this.serviceEndpoints.size} default service endpoints`);
  }

  /**
   * Initialize load balancing strategies
   */
  private initializeStrategies(): void {
    // Round Robin Strategy
    this.strategies.set('round_robin', {
      name: 'round_robin',
      algorithm: 'round_robin',
      healthThreshold: 0.8,
      stickiness: false,
      failoverEnabled: true
    });

    // Weighted Round Robin Strategy
    this.strategies.set('weighted_round_robin', {
      name: 'weighted_round_robin',
      algorithm: 'weighted_round_robin',
      weights: {
        'processing-main': 10,
        'processing-secondary': 8,
        'processing-gpu': 15
      },
      healthThreshold: 0.8,
      stickiness: false,
      failoverEnabled: true
    });

    // Least Connections Strategy
    this.strategies.set('least_connections', {
      name: 'least_connections',
      algorithm: 'least_connections',
      healthThreshold: 0.9,
      stickiness: false,
      failoverEnabled: true
    });

    // Least Response Time Strategy
    this.strategies.set('least_response_time', {
      name: 'least_response_time',
      algorithm: 'least_response_time',
      healthThreshold: 0.9,
      stickiness: false,
      failoverEnabled: true
    });

    // Resource-Based Strategy
    this.strategies.set('resource_based', {
      name: 'resource_based',
      algorithm: 'resource_based',
      healthThreshold: 0.8,
      stickiness: false,
      failoverEnabled: true
    });

    // Geographic Strategy
    this.strategies.set('geographic', {
      name: 'geographic',
      algorithm: 'geographic',
      healthThreshold: 0.7,
      stickiness: true,
      failoverEnabled: true
    });

    this.logger.info(`Initialized ${this.strategies.size} load balancing strategies`);
  }

  /**
   * Select appropriate strategy based on job analysis
   */
  private selectStrategy(jobAnalysis: JobAnalysis): LoadBalancingStrategy {
    // For GPU-intensive jobs, use resource-based strategy
    if (jobAnalysis.resourceRequirements.gpu) {
      return this.strategies.get('resource_based')!;
    }

    // For high-priority jobs, use least response time
    if (jobAnalysis.priority === 'critical' || jobAnalysis.priority === 'high') {
      return this.strategies.get('least_response_time')!;
    }

    // For complex jobs, use least connections
    if (jobAnalysis.complexity === 'complex' || jobAnalysis.complexity === 'enterprise') {
      return this.strategies.get('least_connections')!;
    }

    // For simple jobs, use weighted round robin
    if (jobAnalysis.complexity === 'simple') {
      return this.strategies.get('weighted_round_robin')!;
    }

    // Default to round robin
    return this.strategies.get('round_robin')!;
  }

  /**
   * Get healthy service endpoints
   */
  private getHealthyEndpoints(): ServiceEndpoint[] {
    return Array.from(this.serviceEndpoints.values())
      .filter(endpoint => endpoint.status === 'healthy');
  }

  /**
   * Apply load balancing algorithm
   */
  private async applyLoadBalancingAlgorithm(
    strategy: LoadBalancingStrategy,
    endpoints: ServiceEndpoint[],
    jobAnalysis: JobAnalysis
  ): Promise<LoadBalancingDecision> {
    switch (strategy.algorithm) {
      case 'round_robin':
        return this.roundRobinSelection(endpoints);
      
      case 'weighted_round_robin':
        return this.weightedRoundRobinSelection(endpoints, strategy.weights);
      
      case 'least_connections':
        return this.leastConnectionsSelection(endpoints);
      
      case 'least_response_time':
        return this.leastResponseTimeSelection(endpoints);
      
      case 'resource_based':
        return this.resourceBasedSelection(endpoints, jobAnalysis);
      
      case 'geographic':
        return this.geographicSelection(endpoints, jobAnalysis);
      
      case 'consistent_hash':
        return this.consistentHashSelection(endpoints, jobAnalysis);
      
      default:
        return this.roundRobinSelection(endpoints);
    }
  }

  /**
   * Round Robin selection
   */
  private roundRobinSelection(endpoints: ServiceEndpoint[]): LoadBalancingDecision {
    if (endpoints.length === 0) {
      throw new Error('No endpoints available for selection');
    }

    const timestamp = Date.now();
    const index = Math.floor(timestamp / 1000) % endpoints.length;
    const selected = endpoints[index]!; // Safe because we checked length above

    return {
      selectedEndpoint: selected,
      algorithm: 'round_robin',
      reason: `Round robin selection (index: ${index})`,
      confidence: 0.8,
      alternatives: endpoints.filter(e => e.id !== selected.id).slice(0, 2)
    };
  }

  /**
   * Weighted Round Robin selection
   */
  private weightedRoundRobinSelection(
    endpoints: ServiceEndpoint[], 
    weights?: Record<string, number>
  ): LoadBalancingDecision {
    if (endpoints.length === 0) {
      throw new Error('No endpoints available for selection');
    }

    // Calculate total weight
    const totalWeight = endpoints.reduce((sum, endpoint) => {
      const weight = weights?.[endpoint.id] || endpoint.weight;
      return sum + weight;
    }, 0);

    // Generate random number
    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    // Select endpoint based on weight
    for (const endpoint of endpoints) {
      const weight = weights?.[endpoint.id] || endpoint.weight;
      currentWeight += weight;
      
      if (random <= currentWeight) {
        return {
          selectedEndpoint: endpoint,
          algorithm: 'weighted_round_robin',
          reason: `Weighted selection (weight: ${weight}/${totalWeight})`,
          confidence: 0.85,
          alternatives: endpoints.filter(e => e.id !== endpoint.id).slice(0, 2)
        };
      }
    }

    // Fallback to first endpoint
    const selected = endpoints[0]!; // Safe because we checked length above
    return {
      selectedEndpoint: selected,
      algorithm: 'weighted_round_robin',
      reason: 'Fallback to first endpoint',
      confidence: 0.5,
      alternatives: endpoints.slice(1, 3)
    };
  }

  /**
   * Least Connections selection
   */
  private leastConnectionsSelection(endpoints: ServiceEndpoint[]): LoadBalancingDecision {
    if (endpoints.length === 0) {
      throw new Error('No endpoints available for selection');
    }

    const sorted = [...endpoints].sort((a, b) => a.currentConnections - b.currentConnections);
    const selected = sorted[0]!; // Safe because we checked length above

    return {
      selectedEndpoint: selected,
      algorithm: 'least_connections',
      reason: `Least connections (${selected.currentConnections} active)`,
      confidence: 0.9,
      alternatives: sorted.slice(1, 3)
    };
  }

  /**
   * Least Response Time selection
   */
  private leastResponseTimeSelection(endpoints: ServiceEndpoint[]): LoadBalancingDecision {
    if (endpoints.length === 0) {
      throw new Error('No endpoints available for selection');
    }

    const sorted = [...endpoints].sort((a, b) => a.averageResponseTime - b.averageResponseTime);
    const selected = sorted[0]!; // Safe because we checked length above

    return {
      selectedEndpoint: selected,
      algorithm: 'least_response_time',
      reason: `Fastest response time (${selected.averageResponseTime}ms avg)`,
      confidence: 0.95,
      alternatives: sorted.slice(1, 3)
    };
  }

  /**
   * Resource-based selection
   */
  private resourceBasedSelection(endpoints: ServiceEndpoint[], jobAnalysis: JobAnalysis): LoadBalancingDecision {
    if (endpoints.length === 0) {
      throw new Error('No endpoints available for selection');
    }

    // Score endpoints based on resource requirements
    const scored = endpoints.map(endpoint => {
      let score = 0;
      
      // GPU requirement
      if (jobAnalysis.resourceRequirements.gpu) {
        const hasGpu = endpoint.metadata?.features?.includes('gpu');
        score += hasGpu ? 50 : -20;
      }
      
      // CPU and memory requirements
      const capacity = endpoint.metadata?.capacity;
      if (capacity === 'high') score += 30;
      else if (capacity === 'medium') score += 15;
      else if (capacity === 'low') score += 5;
      
      // Response time factor
      score += Math.max(0, 100 - endpoint.averageResponseTime / 10);
      
      // Connection load factor
      score += Math.max(0, 50 - endpoint.currentConnections * 5);
      
      return { endpoint, score };
    });

    const sorted = scored.sort((a, b) => b.score - a.score);
    const bestMatch = sorted[0];
    
    if (!bestMatch) {
      throw new Error('No suitable endpoint found');
    }

    return {
      selectedEndpoint: bestMatch.endpoint,
      algorithm: 'resource_based',
      reason: `Best resource match (score: ${bestMatch.score})`,
      confidence: 0.9,
      alternatives: sorted.slice(1, 3).map(s => s.endpoint)
    };
  }

  /**
   * Geographic selection
   */
  private geographicSelection(endpoints: ServiceEndpoint[], jobAnalysis: JobAnalysis): LoadBalancingDecision {
    if (endpoints.length === 0) {
      throw new Error('No endpoints available for selection');
    }

    // For now, prefer endpoints with lower latency
    // In production, this would consider actual geographic proximity
    const sorted = [...endpoints].sort((a, b) => a.averageResponseTime - b.averageResponseTime);
    const selected = sorted[0]!; // Safe because we checked length above

    return {
      selectedEndpoint: selected,
      algorithm: 'geographic',
      reason: `Geographic proximity (lowest latency: ${selected.averageResponseTime}ms)`,
      confidence: 0.8,
      alternatives: sorted.slice(1, 3)
    };
  }

  /**
   * Consistent Hash selection
   */
  private consistentHashSelection(endpoints: ServiceEndpoint[], jobAnalysis: JobAnalysis): LoadBalancingDecision {
    if (endpoints.length === 0) {
      throw new Error('No endpoints available for selection');
    }

    // Simple hash based on job characteristics
    const hashInput = `${jobAnalysis.complexity}_${jobAnalysis.priority}_${jobAnalysis.resourceRequirements.cpu}`;
    const hash = this.simpleHash(hashInput);
    const index = hash % endpoints.length;
    const selected = endpoints[index]!; // Safe because we checked length above

    return {
      selectedEndpoint: selected,
      algorithm: 'consistent_hash',
      reason: `Consistent hash selection (hash: ${hash}, index: ${index})`,
      confidence: 0.85,
      alternatives: endpoints.filter(e => e.id !== selected.id).slice(0, 2)
    };
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Update endpoint metrics
   */
  private updateEndpointMetrics(endpointId: string): void {
    const endpoint = this.serviceEndpoints.get(endpointId);
    if (endpoint) {
      endpoint.currentConnections++;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000); // Every 30 seconds

    this.logger.debug('Health monitoring started for load balancer');
  }

  /**
   * Perform health checks on all endpoints
   */
  private performHealthChecks(): void {
    for (const endpoint of this.serviceEndpoints.values()) {
      // Simulate health check (in production, this would make actual HTTP requests)
      const isHealthy = Math.random() > 0.1; // 90% healthy rate
      const responseTime = 50 + Math.random() * 200; // 50-250ms
      
      this.updateEndpointHealth(endpoint.id, isHealthy, responseTime);
    }
  }

  /**
   * Get load balancer statistics
   */
  getLoadBalancerStats(): any {
    const stats = {
      totalEndpoints: this.serviceEndpoints.size,
      healthyEndpoints: 0,
      unhealthyEndpoints: 0,
      strategies: Array.from(this.strategies.keys()),
      requestHistory: this.requestHistory.length,
      endpointStats: {} as Record<string, any>
    };

    for (const [id, endpoint] of this.serviceEndpoints) {
      if (endpoint.status === 'healthy') {
        stats.healthyEndpoints++;
      } else {
        stats.unhealthyEndpoints++;
      }

      stats.endpointStats[id] = {
        status: endpoint.status,
        currentConnections: endpoint.currentConnections,
        averageResponseTime: endpoint.averageResponseTime,
        weight: endpoint.weight,
        lastHealthCheck: endpoint.lastHealthCheck
      };
    }

    return stats;
  }

  /**
   * Shutdown load balancer manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Load Balancer Manager...');
    
    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      // Clear data structures
      this.serviceEndpoints.clear();
      this.strategies.clear();
      this.requestHistory = [];
      
      this.isInitialized = false;
      this.logger.info('Load Balancer Manager shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during load balancer manager shutdown:', error);
      throw error;
    }
  }
}