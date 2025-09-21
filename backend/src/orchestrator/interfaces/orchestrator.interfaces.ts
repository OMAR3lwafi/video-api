// Orchestrator Core Interfaces
import { VideoElement } from '../../types/video.types';

export interface OrchestratorConfig {
  maxConcurrentJobs: number;
  maxJobRetries: number;
  healthCheckInterval: number;
  metricsInterval: number;
  resourceCheckInterval: number;
  loadBalancingStrategy: LoadBalancingStrategy;
  enablePredictiveScaling: boolean;
  enableAutoRecovery: boolean;
  distributedLocking: {
    enabled: boolean;
    ttl: number;
    acquireTimeout: number;
  };
}

export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  IP_HASH = 'ip_hash',
  AI_DRIVEN = 'ai_driven',
  RESOURCE_BASED = 'resource_based'
}

export enum WorkflowTemplate {
  QUICK_SYNC = 'quick_sync',
  BALANCED_ASYNC = 'balanced_async',
  DISTRIBUTED = 'distributed',
  HIGH_PERFORMANCE = 'high_performance',
  ECONOMY = 'economy'
}

export interface JobAnalysis {
  estimatedDuration: number;
  requiredResources: ResourceRequirements;
  complexity: 'low' | 'medium' | 'high' | 'extreme';
  recommendedWorkflow: WorkflowTemplate;
  parallelizable: boolean;
  chunksCount?: number;
}

export interface ResourceRequirements {
  cpu: number;
  memory: number;
  gpu?: number;
  storage: number;
  bandwidth: number;
}

export interface WorkerNode {
  id: string;
  hostname: string;
  status: NodeStatus;
  resources: NodeResources;
  currentJobs: string[];
  lastHealthCheck: Date;
  performanceScore: number;
  tags: string[];
}

export enum NodeStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance'
}

export interface NodeResources {
  cpu: {
    cores: number;
    usage: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
  };
  gpu?: {
    count: number;
    memory: number;
    usage: number;
  };
  storage: {
    total: number;
    used: number;
    available: number;
  };
  network: {
    bandwidth: number;
    latency: number;
  };
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  dependencies: string[];
  timeout: number;
  retryPolicy: RetryPolicy;
  resources?: ResourceRequirements;
  parallelizable?: boolean;
}

export enum StepType {
  ANALYZE = 'analyze',
  DOWNLOAD = 'download',
  PROCESS = 'process',
  ENCODE = 'encode',
  UPLOAD = 'upload',
  NOTIFY = 'notify',
  CLEANUP = 'cleanup'
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffType: 'exponential' | 'linear' | 'fixed';
  initialDelay: number;
  maxDelay: number;
  retryableErrors?: string[];
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  timestamp: Date;
  details?: Record<string, any>;
  alerts?: HealthAlert[];
}

export interface HealthAlert {
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface SystemMetrics {
  timestamp: Date;
  jobs: {
    total: number;
    active: number;
    queued: number;
    completed: number;
    failed: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    gpuUsage?: number;
    storageUsage: number;
    networkBandwidth: number;
  };
  performance: {
    avgProcessingTime: number;
    throughput: number;
    successRate: number;
    errorRate: number;
  };
  nodes: {
    total: number;
    healthy: number;
    degraded: number;
    offline: number;
  };
}

export interface OrchestratorEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  source: string;
  data: Record<string, any>;
  correlationId?: string;
}

export enum EventType {
  JOB_STARTED = 'job_started',
  JOB_COMPLETED = 'job_completed',
  JOB_FAILED = 'job_failed',
  JOB_RETRYING = 'job_retrying',
  NODE_JOINED = 'node_joined',
  NODE_LEFT = 'node_left',
  NODE_UNHEALTHY = 'node_unhealthy',
  RESOURCE_ALERT = 'resource_alert',
  WORKFLOW_STARTED = 'workflow_started',
  WORKFLOW_COMPLETED = 'workflow_completed',
  CIRCUIT_BREAKER_OPEN = 'circuit_breaker_open',
  CIRCUIT_BREAKER_CLOSED = 'circuit_breaker_closed'
}

export interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
  resetTimeout: number;
  halfOpenRequests: number;
  monitoredErrors?: string[];
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failures: number;
  successCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export interface PredictiveAnalytics {
  predictedLoad: number[];
  recommendedScaling: ScalingRecommendation;
  anomalies: Anomaly[];
  optimizationSuggestions: string[];
}

export interface ScalingRecommendation {
  action: 'scale_up' | 'scale_down' | 'maintain';
  nodeCount: number;
  reason: string;
  confidence: number;
}

export interface Anomaly {
  metric: string;
  value: number;
  expected: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export interface DistributedLock {
  key: string;
  owner: string;
  acquiredAt: Date;
  expiresAt: Date;
  renewalCount: number;
}

export interface StateSnapshot {
  version: string;
  timestamp: Date;
  jobs: Map<string, JobState>;
  nodes: Map<string, WorkerNode>;
  metrics: SystemMetrics;
  locks: Map<string, DistributedLock>;
}

export interface JobState {
  id: string;
  status: string;
  workflow: string;
  currentStep: string;
  startTime: Date;
  lastUpdate: Date;
  retryCount: number;
  assignedNode?: string;
  error?: string;
}