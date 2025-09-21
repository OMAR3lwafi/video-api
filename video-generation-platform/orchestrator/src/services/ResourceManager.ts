/**
 * Resource Manager - Intelligent Resource Allocation
 * Dynamic Video Content Generation Platform
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
  AllocatedResources,
  ResourceAllocationRequest,
  ResourceNode,
  ResourceCapacity,
  ResourceUtilization,
  ResourceConstraints,
  ResourcePreferences
} from '../types';

import { EventBus } from './EventBus';
import { ConfigurationManager } from './ConfigurationManager';

export class ResourceManager extends EventEmitter {
  private logger: Logger;
  private eventBus: EventBus;
  private configManager: ConfigurationManager;
  
  private resourceNodes: Map<string, ResourceNode> = new Map();
  private allocatedResources: Map<string, AllocatedResources> = new Map();
  private allocationHistory: Array<{
    id: string;
    request: ResourceAllocationRequest;
    result: AllocatedResources;
    timestamp: Date;
  }> = [];
  
  private isInitialized: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private maxHistorySize: number = 1000;

  constructor(
    logger: Logger,
    eventBus: EventBus,
    configManager: ConfigurationManager
  ) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
    this.configManager = configManager;
  }

  /**
   * Initialize the resource manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Resource Manager...');
      
      // Initialize default resource nodes
      await this.initializeDefaultNodes();
      
      // Start resource monitoring
      this.startResourceMonitoring();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      this.isInitialized = true;
      this.logger.info('Resource Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Resource Manager:', error);
      throw error;
    }
  }

  /**
   * Allocate resources based on request
   */
  async allocateResources(request: ResourceAllocationRequest): Promise<AllocatedResources> {
    if (!this.isInitialized) {
      throw new Error('Resource Manager not initialized');
    }

    try {
      this.logger.debug('Allocating resources:', request.requirements);
      
      // Find suitable nodes
      const suitableNodes = this.findSuitableNodes(request);
      
      if (suitableNodes.length === 0) {
        throw new Error('No suitable nodes available for resource allocation');
      }
      
      // Select best node
      const selectedNode = this.selectBestNode(suitableNodes, request);
      
      // Create allocation
      const allocation: AllocatedResources = {
        id: this.generateAllocationId(),
        cpu: request.requirements.cpu,
        memory: request.requirements.memory,
        storage: request.requirements.storage,
        gpu: request.requirements.gpu,
        nodeId: selectedNode.id,
        allocatedAt: new Date(),
        expiresAt: request.duration ? 
          new Date(Date.now() + request.duration * 1000) : undefined,
        tags: {
          priority: request.priority,
          type: 'video_processing'
        }
      };
      
      // Update node utilization
      this.updateNodeUtilization(selectedNode.id, allocation, 'allocate');
      
      // Store allocation
      this.allocatedResources.set(allocation.id, allocation);
      
      // Add to history
      this.allocationHistory.push({
        id: allocation.id,
        request,
        result: allocation,
        timestamp: new Date()
      });
      
      // Trim history if needed
      if (this.allocationHistory.length > this.maxHistorySize) {
        this.allocationHistory = this.allocationHistory.slice(-this.maxHistorySize);
      }
      
      // Emit allocation event
      await this.eventBus.publish({
        id: uuidv4(),
        type: 'resource:allocated',
        source: 'resource_manager',
        timestamp: new Date(),
        data: {
          allocationId: allocation.id,
          nodeId: selectedNode.id,
          resources: allocation
        }
      });
      
      this.logger.info(`Resources allocated: ${allocation.id} on node ${selectedNode.id}`);
      
      return allocation;
      
    } catch (error) {
      this.logger.error('Resource allocation failed:', error);
      throw error;
    }
  }

  /**
   * Release allocated resources
   */
  async releaseResources(allocationId: string): Promise<void> {
    const allocation = this.allocatedResources.get(allocationId);
    if (!allocation) {
      this.logger.warn(`Allocation ${allocationId} not found for release`);
      return;
    }

    try {
      // Update node utilization
      if (allocation.nodeId) {
        this.updateNodeUtilization(allocation.nodeId, allocation, 'release');
      }
      
      // Remove allocation
      this.allocatedResources.delete(allocationId);
      
      // Emit release event
      await this.eventBus.publish({
        id: uuidv4(),
        type: 'resource:released',
        source: 'resource_manager',
        timestamp: new Date(),
        data: {
          allocationId,
          nodeId: allocation.nodeId,
          resources: allocation
        }
      });
      
      this.logger.info(`Resources released: ${allocationId}`);
      
    } catch (error) {
      this.logger.error(`Failed to release resources ${allocationId}:`, error);
      throw error;
    }
  }

  /**
   * Get resource utilization for a node
   */
  getNodeUtilization(nodeId: string): ResourceUtilization | null {
    const node = this.resourceNodes.get(nodeId);
    return node ? node.utilization : null;
  }

  /**
   * Get all resource nodes
   */
  getResourceNodes(): ResourceNode[] {
    return Array.from(this.resourceNodes.values());
  }

  /**
   * Get available resources across all nodes
   */
  getAvailableResources(): ResourceCapacity {
    const totalCapacity: ResourceCapacity = {
      cpu: 0,
      memory: 0,
      storage: 0,
      bandwidth: 0,
      gpu: 0
    };

    for (const node of this.resourceNodes.values()) {
      if (node.status === 'available') {
        const availableCpu = node.capacity.cpu * (1 - node.utilization.cpu / 100);
        const availableMemory = node.capacity.memory * (1 - node.utilization.memory / 100);
        const availableStorage = node.capacity.storage * (1 - node.utilization.storage / 100);
        
        totalCapacity.cpu += availableCpu;
        totalCapacity.memory += availableMemory;
        totalCapacity.storage += availableStorage;
        totalCapacity.bandwidth += node.capacity.bandwidth;
        
        if (node.capacity.gpu) {
          totalCapacity.gpu = (totalCapacity.gpu || 0) + node.capacity.gpu;
        }
      }
    }

    return totalCapacity;
  }

  /**
   * Initialize default resource nodes
   */
  private async initializeDefaultNodes(): Promise<void> {
    // Main processing node
    this.addResourceNode({
      id: 'node-main-01',
      type: 'compute',
      status: 'available',
      capacity: {
        cpu: 8,
        memory: 32,
        storage: 500,
        bandwidth: 1000,
        gpu: 1
      },
      utilization: {
        cpu: 0,
        memory: 0,
        storage: 0,
        network: 0,
        gpu: 0
      },
      location: 'us-east-1a',
      tags: {
        environment: 'production',
        type: 'video-processing'
      },
      lastHeartbeat: new Date(),
      metadata: {
        instance_type: 'c5.2xlarge',
        gpu_type: 'nvidia-t4'
      }
    });

    // Secondary processing node
    this.addResourceNode({
      id: 'node-secondary-01',
      type: 'compute',
      status: 'available',
      capacity: {
        cpu: 4,
        memory: 16,
        storage: 250,
        bandwidth: 500
      },
      utilization: {
        cpu: 0,
        memory: 0,
        storage: 0,
        network: 0
      },
      location: 'us-east-1b',
      tags: {
        environment: 'production',
        type: 'general-purpose'
      },
      lastHeartbeat: new Date(),
      metadata: {
        instance_type: 'c5.large'
      }
    });

    // GPU-optimized node
    this.addResourceNode({
      id: 'node-gpu-01',
      type: 'gpu',
      status: 'available',
      capacity: {
        cpu: 16,
        memory: 64,
        storage: 1000,
        bandwidth: 2000,
        gpu: 4
      },
      utilization: {
        cpu: 0,
        memory: 0,
        storage: 0,
        network: 0,
        gpu: 0
      },
      location: 'us-east-1c',
      tags: {
        environment: 'production',
        type: 'gpu-processing'
      },
      lastHeartbeat: new Date(),
      metadata: {
        instance_type: 'p3.2xlarge',
        gpu_type: 'nvidia-v100'
      }
    });

    this.logger.info(`Initialized ${this.resourceNodes.size} default resource nodes`);
  }

  /**
   * Add a resource node
   */
  private addResourceNode(node: ResourceNode): void {
    this.resourceNodes.set(node.id, node);
    this.logger.debug(`Added resource node: ${node.id}`);
  }

  /**
   * Find suitable nodes for allocation request
   */
  private findSuitableNodes(request: ResourceAllocationRequest): ResourceNode[] {
    const suitableNodes: ResourceNode[] = [];

    for (const node of this.resourceNodes.values()) {
      if (this.isNodeSuitable(node, request)) {
        suitableNodes.push(node);
      }
    }

    return suitableNodes;
  }

  /**
   * Check if node is suitable for request
   */
  private isNodeSuitable(node: ResourceNode, request: ResourceAllocationRequest): boolean {
    // Check node status
    if (node.status !== 'available') {
      return false;
    }

    // Check basic resource requirements
    const availableCpu = node.capacity.cpu * (1 - node.utilization.cpu / 100);
    const availableMemory = node.capacity.memory * (1 - node.utilization.memory / 100);
    const availableStorage = node.capacity.storage * (1 - node.utilization.storage / 100);

    if (availableCpu < request.requirements.cpu ||
        availableMemory < request.requirements.memory ||
        availableStorage < request.requirements.storage) {
      return false;
    }

    // Check GPU requirement
    if (request.requirements.gpu && !node.capacity.gpu) {
      return false;
    }

    // Check constraints
    if (request.constraints) {
      // Node type constraints
      if (request.constraints.nodeTypes && 
          !request.constraints.nodeTypes.includes(node.type)) {
        return false;
      }

      // Exclude nodes
      if (request.constraints.excludeNodes && 
          request.constraints.excludeNodes.includes(node.id)) {
        return false;
      }

      // Required tags
      if (request.constraints.requireTags) {
        for (const [key, value] of Object.entries(request.constraints.requireTags)) {
          if (!node.tags || node.tags[key] !== value) {
            return false;
          }
        }
      }

      // Region constraint
      if (request.constraints.region && 
          node.location && !node.location.startsWith(request.constraints.region)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Select best node from suitable nodes
   */
  private selectBestNode(nodes: ResourceNode[], request: ResourceAllocationRequest): ResourceNode {
    // Sort nodes by preference score
    const scoredNodes = nodes.map(node => ({
      node,
      score: this.calculateNodeScore(node, request)
    }));

    scoredNodes.sort((a, b) => b.score - a.score);

    return scoredNodes[0].node;
  }

  /**
   * Calculate node score for selection
   */
  private calculateNodeScore(node: ResourceNode, request: ResourceAllocationRequest): number {
    let score = 0;

    // Base score from available resources
    const availableCpu = node.capacity.cpu * (1 - node.utilization.cpu / 100);
    const availableMemory = node.capacity.memory * (1 - node.utilization.memory / 100);
    
    score += (availableCpu / request.requirements.cpu) * 10;
    score += (availableMemory / request.requirements.memory) * 10;

    // Bonus for GPU if required
    if (request.requirements.gpu && node.capacity.gpu) {
      score += 20;
    }

    // Preference bonuses
    if (request.preferences) {
      // Preferred nodes
      if (request.preferences.preferredNodes && 
          request.preferences.preferredNodes.includes(node.id)) {
        score += 15;
      }

      // Performance optimization
      if (request.preferences.performanceOptimized && node.type === 'gpu') {
        score += 10;
      }

      // Cost optimization (prefer smaller nodes)
      if (request.preferences.costOptimized && node.capacity.cpu <= 4) {
        score += 5;
      }
    }

    // Priority bonus
    switch (request.priority) {
      case 'critical':
        if (node.type === 'gpu') score += 15;
        break;
      case 'high':
        if (node.type === 'compute') score += 10;
        break;
      case 'normal':
        score += 5;
        break;
    }

    // Penalty for high utilization
    const avgUtilization = (node.utilization.cpu + node.utilization.memory) / 2;
    score -= avgUtilization * 0.1;

    return score;
  }

  /**
   * Update node utilization
   */
  private updateNodeUtilization(
    nodeId: string, 
    allocation: AllocatedResources, 
    operation: 'allocate' | 'release'
  ): void {
    const node = this.resourceNodes.get(nodeId);
    if (!node) return;

    const multiplier = operation === 'allocate' ? 1 : -1;
    
    // Calculate utilization changes
    const cpuChange = (allocation.cpu / node.capacity.cpu) * 100 * multiplier;
    const memoryChange = (allocation.memory / node.capacity.memory) * 100 * multiplier;
    const storageChange = (allocation.storage / node.capacity.storage) * 100 * multiplier;
    const gpuChange = allocation.gpu && node.capacity.gpu ? 
      (1 / node.capacity.gpu) * 100 * multiplier : 0;

    // Update utilization
    node.utilization.cpu = Math.max(0, Math.min(100, node.utilization.cpu + cpuChange));
    node.utilization.memory = Math.max(0, Math.min(100, node.utilization.memory + memoryChange));
    node.utilization.storage = Math.max(0, Math.min(100, node.utilization.storage + storageChange));
    
    if (allocation.gpu && node.capacity.gpu) {
      node.utilization.gpu = Math.max(0, Math.min(100, (node.utilization.gpu || 0) + gpuChange));
    }

    // Update last heartbeat
    node.lastHeartbeat = new Date();

    this.logger.debug(`Updated utilization for node ${nodeId}:`, node.utilization);
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.monitorResources();
    }, 30000); // Every 30 seconds

    this.logger.debug('Resource monitoring started');
  }

  /**
   * Monitor resource health and utilization
   */
  private monitorResources(): void {
    const now = new Date();
    
    for (const node of this.resourceNodes.values()) {
      // Check heartbeat
      const timeSinceHeartbeat = now.getTime() - node.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > 120000) { // 2 minutes
        if (node.status !== 'failed') {
          node.status = 'failed';
          this.logger.warn(`Node ${node.id} marked as failed due to missing heartbeat`);
          
          this.eventBus.publish({
            id: uuidv4(),
            type: 'resource:node_failed',
            source: 'resource_manager',
            timestamp: new Date(),
            data: { nodeId: node.id, reason: 'heartbeat_timeout' }
          });
        }
      } else if (node.status === 'failed') {
        // Node recovered
        node.status = 'available';
        this.logger.info(`Node ${node.id} recovered`);
        
        this.eventBus.publish({
          id: uuidv4(),
          type: 'resource:node_recovered',
          source: 'resource_manager',
          timestamp: new Date(),
          data: { nodeId: node.id }
        });
      }
      
      // Check for high utilization
      const avgUtilization = (node.utilization.cpu + node.utilization.memory) / 2;
      if (avgUtilization > 90) {
        this.eventBus.publish({
          id: uuidv4(),
          type: 'resource:high_utilization',
          source: 'resource_manager',
          timestamp: new Date(),
          data: { 
            nodeId: node.id, 
            utilization: node.utilization,
            avgUtilization 
          }
        });
      }
    }

    // Clean up expired allocations
    this.cleanupExpiredAllocations();
  }

  /**
   * Cleanup expired allocations
   */
  private cleanupExpiredAllocations(): void {
    const now = new Date();
    const expiredAllocations: string[] = [];

    for (const [id, allocation] of this.allocatedResources) {
      if (allocation.expiresAt && now > allocation.expiresAt) {
        expiredAllocations.push(id);
      }
    }

    for (const id of expiredAllocations) {
      this.releaseResources(id).catch(error => {
        this.logger.error(`Failed to cleanup expired allocation ${id}:`, error);
      });
    }

    if (expiredAllocations.length > 0) {
      this.logger.info(`Cleaned up ${expiredAllocations.length} expired allocations`);
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle node heartbeats
    this.eventBus.subscribe('resource:heartbeat', async (event) => {
      const { nodeId, utilization } = event.data;
      const node = this.resourceNodes.get(nodeId);
      
      if (node) {
        node.lastHeartbeat = new Date();
        if (utilization) {
          node.utilization = utilization;
        }
      }
    });
  }

  /**
   * Generate allocation ID
   */
  private generateAllocationId(): string {
    return `alloc_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * Get resource statistics
   */
  getResourceStats(): any {
    const stats = {
      totalNodes: this.resourceNodes.size,
      availableNodes: 0,
      busyNodes: 0,
      failedNodes: 0,
      totalAllocations: this.allocatedResources.size,
      totalCapacity: { cpu: 0, memory: 0, storage: 0, gpu: 0 },
      totalUtilization: { cpu: 0, memory: 0, storage: 0, gpu: 0 },
      allocationHistory: this.allocationHistory.length
    };

    for (const node of this.resourceNodes.values()) {
      switch (node.status) {
        case 'available':
          stats.availableNodes++;
          break;
        case 'busy':
          stats.busyNodes++;
          break;
        case 'failed':
          stats.failedNodes++;
          break;
      }

      stats.totalCapacity.cpu += node.capacity.cpu;
      stats.totalCapacity.memory += node.capacity.memory;
      stats.totalCapacity.storage += node.capacity.storage;
      if (node.capacity.gpu) {
        stats.totalCapacity.gpu += node.capacity.gpu;
      }

      stats.totalUtilization.cpu += node.utilization.cpu;
      stats.totalUtilization.memory += node.utilization.memory;
      stats.totalUtilization.storage += node.utilization.storage;
      if (node.utilization.gpu) {
        stats.totalUtilization.gpu += node.utilization.gpu;
      }
    }

    // Calculate average utilization
    if (stats.totalNodes > 0) {
      stats.totalUtilization.cpu /= stats.totalNodes;
      stats.totalUtilization.memory /= stats.totalNodes;
      stats.totalUtilization.storage /= stats.totalNodes;
      stats.totalUtilization.gpu /= stats.totalNodes;
    }

    return stats;
  }

  /**
   * Shutdown resource manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Resource Manager...');
    
    try {
      // Stop monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      
      // Release all allocations
      const allocationIds = Array.from(this.allocatedResources.keys());
      for (const id of allocationIds) {
        await this.releaseResources(id);
      }
      
      // Clear data structures
      this.resourceNodes.clear();
      this.allocatedResources.clear();
      this.allocationHistory = [];
      
      this.isInitialized = false;
      this.logger.info('Resource Manager shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during resource manager shutdown:', error);
      throw error;
    }
  }
}