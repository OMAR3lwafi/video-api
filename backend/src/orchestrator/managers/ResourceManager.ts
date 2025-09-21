// Resource Manager - Intelligent resource allocation and management
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { EventBus } from '../events/EventBus';
import {
  WorkerNode,
  NodeStatus,
  NodeResources,
  ResourceRequirements,
  EventType,
  HealthAlert
} from '../interfaces/orchestrator.interfaces';

interface ResourceAllocation {
  jobId: string;
  nodeId: string;
  resources: ResourceRequirements;
  allocatedAt: Date;
  priority: number;
}

interface ResourcePool {
  totalCpu: number;
  totalMemory: number;
  totalGpu: number;
  totalStorage: number;
  totalBandwidth: number;
  availableCpu: number;
  availableMemory: number;
  availableGpu: number;
  availableStorage: number;
  availableBandwidth: number;
}

export class ResourceManager extends EventEmitter {
  private nodes: Map<string, WorkerNode>;
  private allocations: Map<string, ResourceAllocation>;
  private resourcePool: ResourcePool;
  private eventBus: EventBus;
  private monitoringInterval?: NodeJS.Timeout;
  private resourceThresholds = {
    cpu: { warning: 0.75, critical: 0.9 },
    memory: { warning: 0.8, critical: 0.95 },
    storage: { warning: 0.85, critical: 0.95 },
    bandwidth: { warning: 0.7, critical: 0.9 }
  };

  constructor(eventBus: EventBus) {
    super();
    this.nodes = new Map();
    this.allocations = new Map();
    this.eventBus = eventBus;
    this.resourcePool = this.initializeResourcePool();
  }

  private initializeResourcePool(): ResourcePool {
    return {
      totalCpu: 0,
      totalMemory: 0,
      totalGpu: 0,
      totalStorage: 0,
      totalBandwidth: 0,
      availableCpu: 0,
      availableMemory: 0,
      availableGpu: 0,
      availableStorage: 0,
      availableBandwidth: 0
    };
  }

  public async initialize(): Promise<void> {
    logger.info('Initializing Resource Manager...');
    
    // Start resource monitoring
    this.startResourceMonitoring();
    
    // Discover initial nodes
    await this.discoverNodes();
  }

  private async discoverNodes(): Promise<void> {
    // In production, this would discover actual worker nodes
    // For now, simulating with mock nodes
    const mockNodes: WorkerNode[] = [
      {
        id: 'node-1',
        hostname: 'worker-1.local',
        status: NodeStatus.HEALTHY,
        resources: {
          cpu: { cores: 8, usage: 0.2 },
          memory: { total: 16384, used: 3000, available: 13384 },
          gpu: { count: 1, memory: 8192, usage: 0 },
          storage: { total: 500000, used: 100000, available: 400000 },
          network: { bandwidth: 1000, latency: 5 }
        },
        currentJobs: [],
        lastHealthCheck: new Date(),
        performanceScore: 0.9,
        tags: ['gpu', 'high-memory']
      },
      {
        id: 'node-2',
        hostname: 'worker-2.local',
        status: NodeStatus.HEALTHY,
        resources: {
          cpu: { cores: 4, usage: 0.3 },
          memory: { total: 8192, used: 2000, available: 6192 },
          storage: { total: 250000, used: 50000, available: 200000 },
          network: { bandwidth: 1000, latency: 3 }
        },
        currentJobs: [],
        lastHealthCheck: new Date(),
        performanceScore: 0.85,
        tags: ['general']
      },
      {
        id: 'node-3',
        hostname: 'worker-3.local',
        status: NodeStatus.HEALTHY,
        resources: {
          cpu: { cores: 16, usage: 0.1 },
          memory: { total: 32768, used: 5000, available: 27768 },
          gpu: { count: 2, memory: 16384, usage: 0 },
          storage: { total: 1000000, used: 200000, available: 800000 },
          network: { bandwidth: 10000, latency: 1 }
        },
        currentJobs: [],
        lastHealthCheck: new Date(),
        performanceScore: 0.95,
        tags: ['gpu', 'high-performance', 'high-memory']
      }
    ];

    for (const node of mockNodes) {
      this.registerNode(node);
    }
  }

  public registerNode(node: WorkerNode): void {
    this.nodes.set(node.id, node);
    this.updateResourcePool();
    
    logger.info(`Node ${node.id} registered with status ${node.status}`);
    
    // Emit node joined event
    this.eventBus.emit(EventType.NODE_JOINED, {
      id: uuidv4(),
      type: EventType.NODE_JOINED,
      timestamp: new Date(),
      source: 'ResourceManager',
      data: { nodeId: node.id, hostname: node.hostname }
    });
  }

  public unregisterNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      this.nodes.delete(nodeId);
      this.updateResourcePool();
      
      logger.info(`Node ${nodeId} unregistered`);
      
      // Emit node left event
      this.eventBus.emit(EventType.NODE_LEFT, {
        id: uuidv4(),
        type: EventType.NODE_LEFT,
        timestamp: new Date(),
        source: 'ResourceManager',
        data: { nodeId, hostname: node.hostname }
      });
    }
  }

  private updateResourcePool(): void {
    this.resourcePool = this.initializeResourcePool();
    
    for (const node of this.nodes.values()) {
      if (node.status === NodeStatus.HEALTHY || node.status === NodeStatus.DEGRADED) {
        this.resourcePool.totalCpu += node.resources.cpu.cores;
        this.resourcePool.totalMemory += node.resources.memory.total;
        this.resourcePool.totalGpu += node.resources.gpu?.count || 0;
        this.resourcePool.totalStorage += node.resources.storage.total;
        this.resourcePool.totalBandwidth += node.resources.network.bandwidth;
        
        this.resourcePool.availableCpu += node.resources.cpu.cores * (1 - node.resources.cpu.usage);
        this.resourcePool.availableMemory += node.resources.memory.available;
        this.resourcePool.availableGpu += (node.resources.gpu?.count || 0) * (1 - (node.resources.gpu?.usage || 0));
        this.resourcePool.availableStorage += node.resources.storage.available;
        this.resourcePool.availableBandwidth += node.resources.network.bandwidth * 0.8; // Reserve 20% for overhead
      }
    }
    
    logger.debug('Resource pool updated:', this.resourcePool);
  }

  private startResourceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.monitorResources();
    }, 10000); // Monitor every 10 seconds
  }

  private monitorResources(): void {
    for (const node of this.nodes.values()) {
      // Check resource usage and emit alerts
      this.checkResourceUsage(node);
      
      // Update node health status
      this.updateNodeHealth(node);
    }
    
    // Update resource pool
    this.updateResourcePool();
  }

  private checkResourceUsage(node: WorkerNode): void {
    const alerts: HealthAlert[] = [];
    
    // Check CPU usage
    if (node.resources.cpu.usage > this.resourceThresholds.cpu.critical) {
      alerts.push({
        severity: 'critical',
        message: `Node ${node.id} CPU usage critical`,
        metric: 'cpu',
        value: node.resources.cpu.usage,
        threshold: this.resourceThresholds.cpu.critical,
        timestamp: new Date()
      });
    } else if (node.resources.cpu.usage > this.resourceThresholds.cpu.warning) {
      alerts.push({
        severity: 'warning',
        message: `Node ${node.id} CPU usage high`,
        metric: 'cpu',
        value: node.resources.cpu.usage,
        threshold: this.resourceThresholds.cpu.warning,
        timestamp: new Date()
      });
    }
    
    // Check memory usage
    const memoryUsage = node.resources.memory.used / node.resources.memory.total;
    if (memoryUsage > this.resourceThresholds.memory.critical) {
      alerts.push({
        severity: 'critical',
        message: `Node ${node.id} memory usage critical`,
        metric: 'memory',
        value: memoryUsage,
        threshold: this.resourceThresholds.memory.critical,
        timestamp: new Date()
      });
    } else if (memoryUsage > this.resourceThresholds.memory.warning) {
      alerts.push({
        severity: 'warning',
        message: `Node ${node.id} memory usage high`,
        metric: 'memory',
        value: memoryUsage,
        threshold: this.resourceThresholds.memory.warning,
        timestamp: new Date()
      });
    }
    
    // Check storage usage
    const storageUsage = node.resources.storage.used / node.resources.storage.total;
    if (storageUsage > this.resourceThresholds.storage.critical) {
      alerts.push({
        severity: 'critical',
        message: `Node ${node.id} storage usage critical`,
        metric: 'storage',
        value: storageUsage,
        threshold: this.resourceThresholds.storage.critical,
        timestamp: new Date()
      });
    }
    
    // Emit resource alerts
    if (alerts.length > 0) {
      this.eventBus.emit(EventType.RESOURCE_ALERT, {
        id: uuidv4(),
        type: EventType.RESOURCE_ALERT,
        timestamp: new Date(),
        source: 'ResourceManager',
        data: { nodeId: node.id, alerts }
      });
    }
  }

  private updateNodeHealth(node: WorkerNode): void {
    const oldStatus = node.status;
    
    // Calculate health based on resource usage
    const cpuHealth = 1 - node.resources.cpu.usage;
    const memoryHealth = node.resources.memory.available / node.resources.memory.total;
    const storageHealth = node.resources.storage.available / node.resources.storage.total;
    
    const overallHealth = (cpuHealth + memoryHealth + storageHealth) / 3;
    
    if (overallHealth < 0.2) {
      node.status = NodeStatus.UNHEALTHY;
    } else if (overallHealth < 0.5) {
      node.status = NodeStatus.DEGRADED;
    } else {
      node.status = NodeStatus.HEALTHY;
    }
    
    node.performanceScore = overallHealth;
    node.lastHealthCheck = new Date();
    
    // Emit event if status changed
    if (oldStatus !== node.status && node.status === NodeStatus.UNHEALTHY) {
      this.eventBus.emit(EventType.NODE_UNHEALTHY, {
        id: uuidv4(),
        type: EventType.NODE_UNHEALTHY,
        timestamp: new Date(),
        source: 'ResourceManager',
        data: { nodeId: node.id, status: node.status }
      });
    }
  }

  public async allocateResources(requirements: ResourceRequirements): Promise<ResourceAllocation | null> {
    // Check if resources are available
    if (!this.hasAvailableResources(requirements)) {
      logger.warn('Insufficient resources for allocation:', requirements);
      return null;
    }
    
    // Find best node for allocation
    const node = this.findBestNodeForAllocation(requirements);
    if (!node) {
      logger.warn('No suitable node found for allocation');
      return null;
    }
    
    // Create allocation
    const allocation: ResourceAllocation = {
      jobId: uuidv4(),
      nodeId: node.id,
      resources: requirements,
      allocatedAt: new Date(),
      priority: 1
    };
    
    // Update node resources
    node.resources.cpu.usage += requirements.cpu / node.resources.cpu.cores;
    node.resources.memory.used += requirements.memory;
    node.resources.memory.available -= requirements.memory;
    if (requirements.gpu && node.resources.gpu) {
      node.resources.gpu.usage += requirements.gpu / node.resources.gpu.count;
    }
    node.resources.storage.used += requirements.storage;
    node.resources.storage.available -= requirements.storage;
    
    this.allocations.set(allocation.jobId, allocation);
    this.updateResourcePool();
    
    logger.info(`Resources allocated for job ${allocation.jobId} on node ${node.id}`);
    return allocation;
  }

  public async releaseResources(jobId: string): Promise<void> {
    const allocation = this.allocations.get(jobId);
    if (!allocation) {
      logger.warn(`No allocation found for job ${jobId}`);
      return;
    }
    
    const node = this.nodes.get(allocation.nodeId);
    if (node) {
      // Release resources
      node.resources.cpu.usage -= allocation.resources.cpu / node.resources.cpu.cores;
      node.resources.memory.used -= allocation.resources.memory;
      node.resources.memory.available += allocation.resources.memory;
      if (allocation.resources.gpu && node.resources.gpu) {
        node.resources.gpu.usage -= allocation.resources.gpu / node.resources.gpu.count;
      }
      node.resources.storage.used -= allocation.resources.storage;
      node.resources.storage.available += allocation.resources.storage;
      
      // Ensure values don't go negative
      node.resources.cpu.usage = Math.max(0, node.resources.cpu.usage);
      node.resources.memory.used = Math.max(0, node.resources.memory.used);
      if (node.resources.gpu) {
        node.resources.gpu.usage = Math.max(0, node.resources.gpu.usage);
      }
      node.resources.storage.used = Math.max(0, node.resources.storage.used);
    }
    
    this.allocations.delete(jobId);
    this.updateResourcePool();
    
    logger.info(`Resources released for job ${jobId}`);
  }

  private hasAvailableResources(requirements: ResourceRequirements): boolean {
    return (
      this.resourcePool.availableCpu >= requirements.cpu &&
      this.resourcePool.availableMemory >= requirements.memory &&
      this.resourcePool.availableStorage >= requirements.storage &&
      this.resourcePool.availableBandwidth >= requirements.bandwidth &&
      (!requirements.gpu || this.resourcePool.availableGpu >= requirements.gpu)
    );
  }

  private findBestNodeForAllocation(requirements: ResourceRequirements): WorkerNode | null {
    let bestNode: WorkerNode | null = null;
    let bestScore = -1;
    
    for (const node of this.nodes.values()) {
      if (node.status !== NodeStatus.HEALTHY && node.status !== NodeStatus.DEGRADED) {
        continue;
      }
      
      // Check if node has required resources
      if (!this.nodeHasResources(node, requirements)) {
        continue;
      }
      
      // Calculate allocation score
      const score = this.calculateAllocationScore(node, requirements);
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }
    
    return bestNode;
  }

  private nodeHasResources(node: WorkerNode, requirements: ResourceRequirements): boolean {
    const availableCpu = node.resources.cpu.cores * (1 - node.resources.cpu.usage);
    const availableMemory = node.resources.memory.available;
    const availableStorage = node.resources.storage.available;
    const availableGpu = node.resources.gpu ? 
      node.resources.gpu.count * (1 - node.resources.gpu.usage) : 0;
    
    return (
      availableCpu >= requirements.cpu &&
      availableMemory >= requirements.memory &&
      availableStorage >= requirements.storage &&
      (!requirements.gpu || availableGpu >= requirements.gpu)
    );
  }

  private calculateAllocationScore(node: WorkerNode, requirements: ResourceRequirements): number {
    // Higher score is better
    let score = 0;
    
    // Prefer nodes with better performance scores
    score += node.performanceScore * 100;
    
    // Prefer nodes with lower current load
    score += (1 - node.resources.cpu.usage) * 50;
    score += (node.resources.memory.available / node.resources.memory.total) * 30;
    
    // Prefer nodes with lower latency
    score += (10 / node.resources.network.latency) * 20;
    
    // Bonus for GPU if required
    if (requirements.gpu && node.resources.gpu) {
      score += 50;
    }
    
    // Penalty for degraded nodes
    if (node.status === NodeStatus.DEGRADED) {
      score *= 0.7;
    }
    
    return score;
  }

  public async scaleUp(nodeCount: number): Promise<void> {
    logger.info(`Scaling up by ${nodeCount} nodes`);
    
    // In production, this would provision new nodes
    // For now, simulating by adding mock nodes
    for (let i = 0; i < nodeCount; i++) {
      const newNode: WorkerNode = {
        id: `node-scale-${uuidv4()}`,
        hostname: `worker-scale-${i}.local`,
        status: NodeStatus.HEALTHY,
        resources: {
          cpu: { cores: 4, usage: 0 },
          memory: { total: 8192, used: 0, available: 8192 },
          storage: { total: 200000, used: 0, available: 200000 },
          network: { bandwidth: 1000, latency: 5 }
        },
        currentJobs: [],
        lastHealthCheck: new Date(),
        performanceScore: 1.0,
        tags: ['auto-scaled']
      };
      
      this.registerNode(newNode);
    }
  }

  public async scaleDown(nodeCount: number): Promise<void> {
    logger.info(`Scaling down by ${nodeCount} nodes`);
    
    // Find nodes that can be removed (no current jobs)
    const removableNodes: string[] = [];
    for (const [nodeId, node] of this.nodes.entries()) {
      if (node.currentJobs.length === 0 && node.tags.includes('auto-scaled')) {
        removableNodes.push(nodeId);
        if (removableNodes.length >= nodeCount) {
          break;
        }
      }
    }
    
    // Remove nodes
    for (const nodeId of removableNodes) {
      this.unregisterNode(nodeId);
    }
  }

  public async getNodes(): Promise<Map<string, WorkerNode>> {
    return this.nodes;
  }

  public async getAvailableNodes(): Promise<WorkerNode[]> {
    return Array.from(this.nodes.values()).filter(
      node => node.status === NodeStatus.HEALTHY || node.status === NodeStatus.DEGRADED
    );
  }

  public async getHealthyNodes(): Promise<WorkerNode[]> {
    return Array.from(this.nodes.values()).filter(
      node => node.status === NodeStatus.HEALTHY
    );
  }

  public getResourcePool(): ResourcePool {
    return this.resourcePool;
  }

  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}