// Core Orchestrator Types
export interface VideoJobRequest {
  id: string;
  output_format: 'mp4' | 'mov' | 'avi';
  width: number;
  height: number;
  elements: VideoElement[];
  priority?: JobPriority;
  metadata?: Record<string, any>;
  webhook_url?: string;
  timeout?: number;
}

export interface VideoElement {
  id: string;
  type: 'video' | 'image';
  source: string; // URL
  track: number;
  x?: string; // percentage
  y?: string; // percentage
  width?: string; // percentage
  height?: string; // percentage
  fit_mode?: 'auto' | 'contain' | 'cover' | 'fill';
  start_time?: number; // seconds
  duration?: number; // seconds
  effects?: VideoEffect[];
}

export interface VideoEffect {
  type: 'fade_in' | 'fade_out' | 'blur' | 'brightness' | 'contrast';
  intensity: number;
  duration?: number;
}

// Job Analysis Types
export interface JobAnalysis {
  estimatedDuration: number;
  resourceRequirements: ResourceRequirements;
  priority: JobPriority;
  complexity: JobComplexity;
  optimalStrategy: ProcessingStrategy;
  riskFactors: string[];
  optimizationHints: string[];
}

export interface ResourceRequirements {
  cpu: number;        // CPU cores needed
  memory: number;     // Memory in GB
  storage: number;    // Temp storage in GB
  bandwidth: number;  // Network bandwidth in Mbps
  gpu: boolean;       // GPU acceleration needed
  estimatedDuration: number; // seconds
}

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';
export type JobComplexity = 'simple' | 'moderate' | 'complex' | 'enterprise';
export type ProcessingStrategy = 'quick_sync' | 'balanced_async' | 'resource_intensive' | 'distributed';

// Orchestration Result Types
export interface OrchestrationResult {
  jobId: string;
  orchestrationId: string;
  status: 'immediate' | 'queued' | 'processing' | 'completed' | 'failed';
  result_url?: string;
  job_id: string;
  processing_time?: string;
  file_size?: string;
  message: string;
  estimated_completion?: string;
  workflow_id?: string;
  resource_allocation_id?: string;
}

// Workflow Types
export interface WorkflowDefinition {
  id: string;
  template: string;
  steps: WorkflowStep[];
  dependencies: string[];
  timeouts: Record<string, number>;
  retryPolicies: Record<string, RetryPolicy>;
  rollbackStrategies: Record<string, RollbackStrategy>;
  metadata: WorkflowMetadata;
}

export interface WorkflowStep {
  name: string;
  type: WorkflowStepType;
  timeout: number;
  retryPolicy?: RetryPolicy;
  rollbackStrategy?: RollbackStrategy;
  dependencies?: string[];
  parameters?: Record<string, any>;
  condition?: string; // Conditional execution logic
  parallel?: boolean; // Can run in parallel with other steps
}

export interface WorkflowExecution {
  definition: WorkflowDefinition;
  state: WorkflowState;
  currentStep: number;
  startTime: Date;
  endTime?: Date;
  context: WorkflowContext;
  metrics: WorkflowMetrics;
  error?: Error;
  stepResults: Map<string, StepResult>;
}

export interface WorkflowTemplate {
  name: string;
  description: string;
  steps: WorkflowStep[];
  maxDuration: number;
  retryPolicy: RetryPolicy;
  dependencies: string[];
  resourceProfile: ResourceProfile;
  suitability: TemplateSuitability;
}

export interface WorkflowMetadata {
  created_at: Date;
  created_by: string;
  version: string;
  tags: string[];
  description: string;
}

export interface WorkflowContext {
  jobRequest: VideoJobRequest;
  allocatedResources: AllocatedResources;
  result?: any;
  stepData: Map<string, any>;
  environment: Record<string, string>;
}

export interface WorkflowMetrics {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  averageStepDuration: number;
  totalDuration?: number;
  resourceUtilization: ResourceUtilization;
}

export interface StepResult {
  success: boolean;
  duration: number;
  output?: any;
  error?: string;
  metrics?: Record<string, number>;
}

export type WorkflowState = 'initialized' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type WorkflowStepType =
  | 'validation'
  | 'resource_allocation'
  | 'media_download'
  | 'video_processing'
  | 's3_upload'
  | 'database_update'
  | 'cleanup'
  | 'queue_operation'
  | 'notification'
  | 'analysis'
  | 'workload_partitioning'
  | 'cluster_allocation'
  | 'parallel_download'
  | 'distributed_video_processing'
  | 'result_merging'
  | 'cluster_cleanup';

// Resource Management Types
export interface ResourceAllocation {
  cpu: {
    cores: number;
    affinity: string;
    priority: ResourcePriority;
  };
  memory: {
    size: number; // GB
    type: MemoryType;
    swapEnabled: boolean;
  };
  storage: {
    size: number; // GB
    type: StorageType;
    iops: number;
  };
  network: {
    bandwidth: number; // Mbps
    latencyRequirement: LatencyRequirement;
    priorityClass: NetworkPriorityClass;
  };
  gpu: {
    enabled: boolean;
    type?: GpuType;
    memorySize?: number; // GB
  };
}

export interface AllocatedResources {
  id: string;
  jobAnalysis: JobAnalysis;
  allocation: ResourceAllocation;
  reservedAt: Date;
  releasedAt?: Date;
  status: ResourceStatus;
  metrics: ResourceMetrics;
  nodeAssignments: NodeAssignment[];
}

export interface ResourcePool {
  cpu: {
    totalCores: number;
    availableCores: number;
    reservedCores: number;
  };
  memory: {
    totalSize: number;
    availableSize: number;
    reservedSize: number;
  };
  storage: {
    totalSize: number;
    availableSize: number;
    reservedSize: number;
  };
  network: {
    totalBandwidth: number;
    availableBandwidth: number;
    reservedBandwidth: number;
  };
  gpu: {
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
  };
}

export interface ResourceMetrics {
  cpu: {
    averageUtilization: number;
    peakUtilization: number;
    idleTime: number;
  };
  memory: {
    averageUtilization: number;
    peakUtilization: number;
    swapUsage: number;
  };
  storage: {
    readThroughput: number;
    writeThroughput: number;
    iopsUtilization: number;
  };
  network: {
    averageBandwidthUtilization: number;
    latency: number;
    packetLoss: number;
  };
  gpu?: {
    averageUtilization: number;
    memoryUtilization: number;
    temperature: number;
  };
}

export interface ResourceUtilization {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  gpu?: number;
}

export interface NodeAssignment {
  nodeId: string;
  nodeType: string;
  resources: Partial<ResourceAllocation>;
  status: 'assigned' | 'active' | 'released';
}

export type ResourceStatus = 'allocated' | 'active' | 'released' | 'failed';
export type ResourcePriority = 'low' | 'normal' | 'high' | 'realtime';
export type MemoryType = 'standard' | 'high_performance' | 'gpu_optimized';
export type StorageType = 'hdd' | 'ssd' | 'nvme';
export type LatencyRequirement = 'standard' | 'low' | 'ultra_low';
export type NetworkPriorityClass = 'bulk' | 'normal' | 'priority' | 'critical';
export type GpuType = 'basic' | 'professional' | 'enterprise';

// Load Balancing Types
export interface ServiceRegistry {
  services: Map<string, ServiceInstance[]>;
  healthStatus: Map<string, HealthStatus>;
  performanceMetrics: Map<string, PerformanceMetrics>;
}

export interface ServiceInstance {
  id: string;
  name: string;
  endpoint: string;
  capacity: ServiceCapacity;
  currentLoad: ServiceLoad;
  healthStatus: HealthStatus;
  performanceProfile: PerformanceProfile;
  lastHealthCheck: Date;
}

export interface ServiceCapacity {
  maxConcurrentJobs: number;
  maxResourceUtilization: ResourceUtilization;
  supportedJobTypes: string[];
  capabilities: string[];
}

export interface ServiceLoad {
  activeJobs: number;
  queuedJobs: number;
  resourceUtilization: ResourceUtilization;
  responseTime: number;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  successRate: number;
  throughput: number;
  errorRate: number;
  availability: number;
}

export interface PerformanceProfile {
  historicalMetrics: PerformanceMetrics[];
  benchmarkResults: BenchmarkResult[];
  optimizationLevel: number;
}

export interface BenchmarkResult {
  testType: string;
  duration: number;
  resourceUsage: ResourceUtilization;
  score: number;
  timestamp: Date;
}

// Health Check Types
export interface HealthCheckResult {
  component: string;
  status: HealthStatus;
  message: string;
  timestamp: Date;
  metrics?: Record<string, number>;
  details?: Record<string, any>;
}

export interface SystemHealthReport {
  overall: HealthStatus;
  components: HealthCheckResult[];
  timestamp: Date;
  summary: HealthSummary;
  recommendations: string[];
}

export interface HealthSummary {
  healthy: number;
  degraded: number;
  unhealthy: number;
  total: number;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

// Analytics Types
export interface SystemAnalyticsReport {
  timestamp: Date;
  period: string;
  performanceMetrics: SystemPerformanceMetrics;
  resourceAnalysis: ResourceAnalysis;
  jobAnalysis: JobAnalysis[];
  predictions: SystemPredictions;
  recommendations: OptimizationRecommendation[];
}

export interface SystemPerformanceMetrics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  throughput: number;
  resourceEfficiency: number;
}

export interface ResourceAnalysis {
  utilizationTrends: UtilizationTrend[];
  bottlenecks: ResourceBottleneck[];
  wasteIdentification: ResourceWaste[];
  capacityForecast: CapacityForecast;
}

export interface UtilizationTrend {
  resource: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  forecast: number[];
}

export interface ResourceBottleneck {
  resource: string;
  severity: 'low' | 'medium' | 'high';
  impact: string;
  recommendation: string;
}

export interface ResourceWaste {
  resource: string;
  wastePercentage: number;
  potentialSavings: number;
  cause: string;
}

export interface CapacityForecast {
  resource: string;
  currentCapacity: number;
  predictedDemand: number[];
  recommendedCapacity: number;
  timeline: string;
}

export interface SystemPredictions {
  demandForecast: DemandForecast;
  failurePredictions: FailurePrediction[];
  optimizationOpportunities: OptimizationOpportunity[];
}

export interface DemandForecast {
  period: string;
  predictedJobCount: number;
  predictedResourceDemand: ResourceRequirements;
  confidence: number;
}

export interface FailurePrediction {
  component: string;
  failureType: string;
  probability: number;
  timeframe: string;
  impact: string;
}

export interface OptimizationOpportunity {
  type: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  potentialSavings: number;
}

export interface OptimizationRecommendation {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  implementationEffort: string;
  estimatedSavings?: number;
  deadline?: Date;
}

// Circuit Breaker & Resilience Types
export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier?: number;
  maxBackoffMs?: number;
  retryConditions?: string[];
}

export interface RollbackStrategy {
  type: 'immediate' | 'graceful' | 'checkpoint';
  checkpoints?: string[];
  cleanupActions?: string[];
}

// Configuration Types
export interface OrchestratorSettings {
  orchestration: {
    maxConcurrentJobs: number;
    defaultTimeout: number;
    priorityWeights: Record<JobPriority, number>;
  };
  workflows: {
    templateDirectory: string;
    enableCustomTemplates: boolean;
    maxWorkflowDuration: number;
  };
  resources: {
    autoScalingEnabled: boolean;
    resourceReservationTimeout: number;
    optimizationInterval: number;
  };
  loadBalancing: {
    strategy: LoadBalancingStrategy;
    healthCheckInterval: number;
    failoverThreshold: number;
  };
  monitoring: {
    metricsRetention: number;
    alertingEnabled: boolean;
    dashboardRefreshInterval: number;
  };
  resilience: {
    circuitBreakerEnabled: boolean;
    retryEnabled: boolean;
    failoverEnabled: boolean;
  };
  analytics: {
    enabled: boolean;
    reportingInterval: number;
    predictionEnabled: boolean;
  };
  security: {
    encryptionEnabled: boolean;
    auditLogging: boolean;
    accessControlEnabled: boolean;
  };
}

export type LoadBalancingStrategy = 'round_robin' | 'weighted' | 'least_connections' | 'ai_driven' | 'performance_based';

// Event Bus Types
export interface OrchestratorEvent {
  id: string;
  type: EventType;
  source: string;
  timestamp: Date;
  data: any;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export type EventType =
  | 'job_received'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'workflow_created'
  | 'workflow_completed'
  | 'resource_allocated'
  | 'resource_released'
  | 'health_check_failed'
  | 'system_alert'
  | 'optimization_applied';

// Utility Types
export interface Optimization {
  type: string;
  severity: 'low' | 'medium' | 'high';
  potentialSavings: number;
  recommendation: string;
}

export interface OptimizationResult {
  optimizationsApplied: number;
  resourcesSaved: ResourceUtilization;
  performanceImprovement: number;
  costSavings: number;
}

export interface WorkflowResult {
  workflowId: string;
  state: WorkflowState;
  result?: any;
  duration: number;
  metrics: WorkflowMetrics;
  error?: string;
}

export interface ResourceProfile {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  gpu: boolean;
}

export interface TemplateSuitability {
  minComplexity: JobComplexity;
  maxComplexity: JobComplexity;
  optimalJobSize: number;
  supportedFormats: string[];
}

export interface ResourceAvailability {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  gpu: number;
  timestamp: Date;
}

// Error Types
export class OrchestratorError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'OrchestratorError';
    this.code = code;
    this.details = details;
  }
}

export class WorkflowError extends Error {
  public readonly workflowId: string;
  public readonly step?: string;
  public readonly retryable: boolean;

  constructor(message: string, workflowId: string, step?: string, retryable = true) {
    super(message);
    this.name = 'WorkflowError';
    this.workflowId = workflowId;
    this.step = step;
    this.retryable = retryable;
  }
}

export class ResourceError extends Error {
  public readonly resourceType: string;
  public readonly requested: number;
  public readonly available: number;

  constructor(message: string, resourceType: string, requested: number, available: number) {
    super(message);
    this.name = 'ResourceError';
    this.resourceType = resourceType;
    this.requested = requested;
    this.available = available;
  }
}
