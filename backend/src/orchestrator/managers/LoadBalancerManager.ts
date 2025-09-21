// Load Balancer Manager - Multiple load balancing strategies
import { logger } from '../../utils/logger';
import {
  LoadBalancingStrategy,
  WorkerNode,
  NodeStatus,
  ResourceRequirements
} from '../interfaces/orchestrator.interfaces';

export class LoadBalancerManager {
  private strategy: LoadBalancingStrategy;
  private roundRobinIndex: Map<string, number> = new Map();
  private connectionCounts: Map<string, number> = new Map();
  private nodeWeights: Map<string, number> = new Map();

  constructor(strategy: LoadBalancingStrategy) {
    this.strategy = strategy;
    logger.info(`Load Balancer initialized with strategy: ${strategy}`);
  }

  public async selectNode(
    nodes: WorkerNode[],
    requirements?: ResourceRequirements
  ): Promise<WorkerNode | null> {
    if (nodes.length === 0) {
      logger.warn('No nodes available for load balancing');
      return null;
    }

    // Filter healthy nodes
    const availableNodes = nodes.filter(
      node => node.status === NodeStatus.HEALTHY || node.status === NodeStatus.DEGRADED
    );

    if (availableNodes.length === 0) {
      logger.warn('No healthy nodes available');
      return null;
    }

    switch (this.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.roundRobinSelect(availableNodes);
      
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.leastConnectionsSelect(availableNodes);
      
      case LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
        return this.weightedRoundRobinSelect(availableNodes);
      
      case LoadBalancingStrategy.IP_HASH:
        return this.ipHashSelect(availableNodes);
      
      case LoadBalancingStrategy.RESOURCE_BASED:
        return this.resourceBasedSelect(availableNodes, requirements);
      
      case LoadBalancingStrategy.AI_DRIVEN:
        return this.aiDrivenSelect(availableNodes, requirements);
      
      default:
        return this.roundRobinSelect(availableNodes);
    }
  }

  private roundRobinSelect(nodes: WorkerNode[]): WorkerNode {
    const key = 'global';
    const currentIndex = this.roundRobinIndex.get(key) || 0;
    const selectedNode = nodes[currentIndex % nodes.length];
    
    this.roundRobinIndex.set(key, currentIndex + 1);
    
    logger.debug(`Round-robin selected node: ${selectedNode.id}`);
    return selectedNode;
  }

  private leastConnectionsSelect(nodes: WorkerNode[]): WorkerNode {
    let selectedNode = nodes[0];
    let minConnections = this.getNodeConnections(selectedNode.id);

    for (const node of nodes) {
      const connections = this.getNodeConnections(node.id);
      if (connections < minConnections) {
        selectedNode = node;
        minConnections = connections;
      }
    }

    // Update connection count
    this.incrementNodeConnections(selectedNode.id);

    logger.debug(`Least connections selected node: ${selectedNode.id} with ${minConnections} connections`);
    return selectedNode;
  }

  private weightedRoundRobinSelect(nodes: WorkerNode[]): WorkerNode {
    // Calculate weights based on performance scores
    const weights: Array<{ node: WorkerNode; weight: number; range: number }> = [];
    let totalWeight = 0;

    for (const node of nodes) {
      const weight = Math.floor(node.performanceScore * 100);
      totalWeight += weight;
      weights.push({ node, weight, range: totalWeight });
    }

    // Select based on weighted random
    const random = Math.random() * totalWeight;
    
    for (const item of weights) {
      if (random <= item.range) {
        logger.debug(`Weighted round-robin selected node: ${item.node.id}`);
        return item.node;
      }
    }

    return nodes[0];
  }

  private ipHashSelect(nodes: WorkerNode[]): WorkerNode {
    // In production, would use client IP for consistent hashing
    // For now, using a random hash
    const hash = Math.floor(Math.random() * 1000000);
    const index = hash % nodes.length;
    
    const selectedNode = nodes[index];
    logger.debug(`IP hash selected node: ${selectedNode.id}`);
    return selectedNode;
  }

  private resourceBasedSelect(
    nodes: WorkerNode[],
    requirements?: ResourceRequirements
  ): WorkerNode {
    if (!requirements) {
      return this.roundRobinSelect(nodes);
    }

    // Score nodes based on available resources
    let bestNode = nodes[0];
    let bestScore = -1;

    for (const node of nodes) {
      const score = this.calculateResourceScore(node, requirements);
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    logger.debug(`Resource-based selected node: ${bestNode.id} with score ${bestScore}`);
    return bestNode;
  }

  private aiDrivenSelect(
    nodes: WorkerNode[],
    requirements?: ResourceRequirements
  ): WorkerNode {
    // AI-driven selection using multiple factors
    let bestNode = nodes[0];
    let bestScore = -1;

    for (const node of nodes) {
      let score = 0;

      // Performance history
      score += node.performanceScore * 30;

      // Current load
      const cpuAvailable = 1 - node.resources.cpu.usage;
      const memAvailable = node.resources.memory.available / node.resources.memory.total;
      score += (cpuAvailable * 20) + (memAvailable * 20);

      // Network latency (lower is better)
      score += (100 / node.resources.network.latency);

      // Job queue length (fewer is better)
      score += (10 / (node.currentJobs.length + 1));

      // Resource match
      if (requirements) {
        score += this.calculateResourceMatch(node, requirements) * 10;
      }

      // Node health status
      if (node.status === NodeStatus.HEALTHY) {
        score += 10;
      } else if (node.status === NodeStatus.DEGRADED) {
        score *= 0.7;
      }

      // GPU availability bonus
      if (requirements?.gpu && node.resources.gpu) {
        score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    logger.debug(`AI-driven selected node: ${bestNode.id} with score ${bestScore.toFixed(2)}`);
    return bestNode;
  }

  private calculateResourceScore(node: WorkerNode, requirements: ResourceRequirements): number {
    let score = 100;

    // CPU availability
    const cpuAvailable = node.resources.cpu.cores * (1 - node.resources.cpu.usage);
    if (cpuAvailable < requirements.cpu) {
      return 0;
    }
    score += (cpuAvailable - requirements.cpu) * 10;

    // Memory availability
    if (node.resources.memory.available < requirements.memory) {
      return 0;
    }
    score += ((node.resources.memory.available - requirements.memory) / 1024) * 5;

    // Storage availability
    if (node.resources.storage.available < requirements.storage) {
      return 0;
    }
    score += ((node.resources.storage.available - requirements.storage) / 10000) * 2;

    // GPU availability
    if (requirements.gpu) {
      if (!node.resources.gpu || node.resources.gpu.count < requirements.gpu) {
        return 0;
      }
      score += 50;
    }

    // Penalize degraded nodes
    if (node.status === NodeStatus.DEGRADED) {
      score *= 0.7;
    }

    return score;
  }

  private calculateResourceMatch(node: WorkerNode, requirements: ResourceRequirements): number {
    let match = 0;
    let factors = 0;

    // CPU match
    const cpuAvailable = node.resources.cpu.cores * (1 - node.resources.cpu.usage);
    if (cpuAvailable >= requirements.cpu) {
      match += Math.min(1, requirements.cpu / cpuAvailable);
      factors++;
    }

    // Memory match
    if (node.resources.memory.available >= requirements.memory) {
      match += Math.min(1, requirements.memory / node.resources.memory.available);
      factors++;
    }

    // Storage match
    if (node.resources.storage.available >= requirements.storage) {
      match += Math.min(1, requirements.storage / node.resources.storage.available);
      factors++;
    }

    // GPU match
    if (requirements.gpu && node.resources.gpu) {
      const gpuAvailable = node.resources.gpu.count * (1 - node.resources.gpu.usage);
      if (gpuAvailable >= requirements.gpu) {
        match += Math.min(1, requirements.gpu / gpuAvailable);
        factors++;
      }
    }

    return factors > 0 ? match / factors : 0;
  }

  private getNodeConnections(nodeId: string): number {
    return this.connectionCounts.get(nodeId) || 0;
  }

  private incrementNodeConnections(nodeId: string): void {
    const current = this.connectionCounts.get(nodeId) || 0;
    this.connectionCounts.set(nodeId, current + 1);
  }

  public decrementNodeConnections(nodeId: string): void {
    const current = this.connectionCounts.get(nodeId) || 0;
    this.connectionCounts.set(nodeId, Math.max(0, current - 1));
  }

  public setStrategy(strategy: LoadBalancingStrategy): void {
    this.strategy = strategy;
    logger.info(`Load balancing strategy changed to: ${strategy}`);
  }

  public getStrategy(): LoadBalancingStrategy {
    return this.strategy;
  }

  public resetCounters(): void {
    this.roundRobinIndex.clear();
    this.connectionCounts.clear();
    this.nodeWeights.clear();
    logger.debug('Load balancer counters reset');
  }

  public getStatistics(): any {
    return {
      strategy: this.strategy,
      connectionCounts: Object.fromEntries(this.connectionCounts),
      roundRobinIndices: Object.fromEntries(this.roundRobinIndex),
      nodeWeights: Object.fromEntries(this.nodeWeights)
    };
  }
}