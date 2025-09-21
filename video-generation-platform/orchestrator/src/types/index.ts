/**
 * Orchestrator Type Definitions
 * Dynamic Video Content Generation Platform
 */

// ============================================================================
// CORE ORCHESTRATION TYPES
// ============================================================================

export interface VideoJobRequest {
  id: string;
  output_format: 'mp4' | 'mov' | 'avi';
  width: number;
  height: number;
  elements: VideoElement[];
  priority?: JobPriority;
  metadata?: Record<string, any>;
  callback_url?: string;
  user_id?: string;
  project_id?: string;
}

export interface VideoElement {
  id: string;
  type: 'video' | 'image';
  source: string;
  track: number;
  x?: string;
  y?: string;
  width?: string;
  height?: string;
  fit_mode?: 'auto' | 'contain' | 'cover' | 'fill';
  start_time?: number;
  duration?: number;
  opacity?: number;
  rotation?: number;
}

export interface JobAnalysis {
  estimatedDuration: number;
  resourceRequirements: ResourceRequirements;
  priority: JobPriority;
  complexity: JobComplexity;
  optimalStrategy: ProcessingStrategy;
  riskFactors: RiskFactor[];
  optimizations: OptimizationSuggestion[];
}

export interface ResourceRequirements {
  cpu: number;        // CPU cores needed
  memory: number;     // Memory in GB
  storage: number;    // Temp storage in GB
  bandwidth: number;  // Network bandwidth in Mbps
  gpu: boolean;       // GPU acceleration needed
  estimatedTime: number; // Processing time in seconds
}

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';
export type JobComplexity = 'simple' | 'moderate' | 'complex' | 'enterprise';
export type ProcessingStrategy = 'quick_sync' | 'balanced_async' | 'resource_intensive' | 'distributed';

export interface RiskFactor {
  type: 'timeout' | 'resource_exhaustion' | 'dependency_failure' | 'quality_degradation';
  severity: 'low' | 'medium' | 'high';
  probability: number; // 0-1
  mitigation: string;
}

export interface OptimizationSuggestion {
  type: 'resource_optimization' | 'workflow_optimization' | 'caching' | 'preprocessing';
  description: string;
  expectedImprovement: number; // percentage
  implementationCost: 'low' | 'medium' | 'high';
}

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export interface WorkflowDefinition {
  id: string;
  template: string;
  steps: WorkflowStep[];
  dependencies: string[];
  timeouts: WorkflowTimeouts;
  retryPolicies: RetryPolicy[];
  rollbackStrategies: RollbackStrategy[];
  metadata?: Record<string, any>;
}

export interface WorkflowStep {
  name: string;
  type: WorkflowStepType;
  timeout: number;
  retryPolicy?: RetryPolicy;
  dependencies?: string[];
  condition?: string;
  parallel?: boolean;
  critical?: boolean;
  rollback?: RollbackAction;
}

export type WorkflowStepType = 
  | 'validation'
  | 'resource_allocation'
  | 'media_download'
  | 'video_processing'
  | 's3_upload'
  | 'database_update'
  | 'database_insert'
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

export interface WorkflowTimeouts {
  total: number;
  step: number;
  idle: number;
  heartbeat: number;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier?: number;
  maxBackoffMs?: number;
  retryableErrors?: string[];
  jitter?: boolean;
}

export interface RollbackStrategy {
  trigger: 'step_failure' | 'timeout' | 'manual' | 'resource_exhaustion';
  actions: RollbackAction[];
  compensation?: CompensationAction[];
}

export interface RollbackAction {
  type: 'cleanup_resources' | 'delete_files' | 'update_database' | 'send_notification';
  target: string;
  parameters?: Record<string, any>;
}

export interface CompensationAction {
  type: 'refund' | 'retry_later' | 'alternative_processing' | 'manual_intervention';
  parameters?: Record<string, any>;
}

export interface WorkflowExecution {
  definition: WorkflowDefinition;
  state: WorkflowState;
  currentStep: number;
  startTime: Date;
  endTime?: Date;
  context: ExecutionContext;
  metrics: WorkflowMetrics;
  error?: Error;
  rollbackExecuted?: boolean;
}

export type WorkflowState = 'initialized' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'rolling_back';

export interface ExecutionContext {
  jobRequest: VideoJobRequest;
  allocatedResources: AllocatedResources;
  stepResults: Map<string, any>;
  variables: Map<string, any>;
  result?: any;
  artifacts?: string[];
}

export interface WorkflowMetrics {
  totalDuration?: number;
  stepDurations: Map<string, number>;
  resourceUtilization: ResourceUtilization;
  errorCount: number;
  retryCount: number;
  throughput?: number;
}

export interface WorkflowResult {
  workflowId: string;
  state: WorkflowState;
  result?: any;
  duration: number;
  metrics: WorkflowMetrics;
  error?: Error;
}

export interface WorkflowTemplate {
  name: string;
  description: string;
  steps: WorkflowStep[];
  maxDuration: number;
  retryPolicy: RetryPolicy;
  dependencies: string[];
  resourceProfile: ResourceProfile;
  suitableFor: JobComplexity[];
}

export interface ResourceProfile {
  minCpu: number;
  maxCpu: number;
  minMemory: number;
  maxMemory: number;
  requiresGpu: boolean;
  networkIntensive: boolean;
  storageIntensive: boolean;
}

// ============================================================================
// RESOURCE MANAGEMENT TYPES
// ============================================================================

export interface AllocatedResources {
  id: string;
  cpu: number;
  memory: number;
  storage: number;
  gpu?: boolean;
  nodeId?: string;
  containerId?: string;
  allocatedAt: Date;
  expiresAt?: Date;
  tags?: Record<string, string>;
}

export interface ResourceUtilization {
  cpu: number;        // 0-100%
  memory: number;     // 0-100%
  storage: number;    // 0-100%
  network: number;    // 0-100%
  gpu?: number;       // 0-100%
}

export interface ResourceNode {
  id: string;
  type: 'compute' | 'gpu' | 'storage' | 'network';
  status: 'available' | 'busy' | 'maintenance' | 'failed';
  capacity: ResourceCapacity;
  utilization: ResourceUtilization;
  location?: string;
  tags?: Record<string, string>;
  lastHeartbeat: Date;
  metadata?: Record<string, any>;
}

export interface ResourceCapacity {
  cpu: number;        // Total CPU cores
  memory: number;     // Total memory in GB
  storage: number;    // Total storage in GB
  bandwidth: number;  // Network bandwidth in Mbps
  gpu?: number;       // Number of GPUs
}

export interface ResourceAllocationRequest {
  requirements: ResourceRequirements;
  duration?: number;
  priority: JobPriority;
  constraints?: ResourceConstraints;
  preferences?: ResourcePreferences;
}

export interface ResourceConstraints {
  nodeTypes?: string[];
  excludeNodes?: string[];
  requireTags?: Record<string, string>;
  maxLatency?: number;
  region?: string;
}

export interface ResourcePreferences {
  preferredNodes?: string[];
  preferredRegion?: string;
  costOptimized?: boolean;
  performanceOptimized?: boolean;
}

// ============================================================================
// LOAD BALANCING TYPES
// ============================================================================

export interface LoadBalancingStrategy {
  name: string;
  algorithm: LoadBalancingAlgorithm;
  weights?: Record<string, number>;
  healthThreshold?: number;
  stickiness?: boolean;
  failoverEnabled?: boolean;
}

export type LoadBalancingAlgorithm = 
  | 'round_robin'
  | 'weighted_round_robin'
  | 'least_connections'
  | 'least_response_time'
  | 'resource_based'
  | 'geographic'
  | 'consistent_hash';

export interface ServiceEndpoint {
  id: string;
  url: string;
  type: 'api' | 'processing' | 'storage' | 'database';
  status: 'healthy' | 'unhealthy' | 'degraded' | 'maintenance';
  weight: number;
  currentConnections: number;
  averageResponseTime: number;
  lastHealthCheck: Date;
  metadata?: Record<string, any>;
}

export interface LoadBalancingDecision {
  selectedEndpoint: ServiceEndpoint;
  algorithm: LoadBalancingAlgorithm;
  reason: string;
  confidence: number;
  alternatives?: ServiceEndpoint[];
}

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  retries: number;
  successThreshold: number;
  failureThreshold: number;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  type: 'http' | 'tcp' | 'command' | 'custom';
  target: string;
  expectedResponse?: any;
  critical: boolean;
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  checks: HealthCheckResult[];
  lastCheck: Date;
  uptime: number;
  responseTime?: number;
  metadata?: Record<string, any>;
}

export interface HealthCheckResult {
  check: string;
  status: 'pass' | 'fail' | 'warn';
  responseTime: number;
  message?: string;
  timestamp: Date;
  details?: Record<string, any>;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface SystemMetrics {
  timestamp: Date;
  cpu: ResourceUtilization;
  memory: ResourceUtilization;
  storage: ResourceUtilization;
  network: ResourceUtilization;
  activeJobs: number;
  queuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  throughput: number;
  errorRate: number;
}

export interface PerformanceAnalysis {
  period: string;
  metrics: SystemMetrics[];
  trends: PerformanceTrend[];
  bottlenecks: Bottleneck[];
  recommendations: PerformanceRecommendation[];
  predictions: PerformancePrediction[];
}

export interface PerformanceTrend {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  rate: number;
  confidence: number;
  significance: 'low' | 'medium' | 'high';
}

export interface Bottleneck {
  component: string;
  type: 'cpu' | 'memory' | 'storage' | 'network' | 'database' | 'external_service';
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  suggestedActions: string[];
}

export interface PerformanceRecommendation {
  type: 'scaling' | 'optimization' | 'configuration' | 'architecture';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImpact: string;
  implementationEffort: 'low' | 'medium' | 'high';
  estimatedCost?: number;
}

export interface PerformancePrediction {
  metric: string;
  timeframe: string;
  predictedValue: number;
  confidence: number;
  factors: string[];
}

// ============================================================================
// EVENT BUS TYPES
// ============================================================================

export interface Event {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: any;
  metadata?: Record<string, any>;
  correlationId?: string;
  causationId?: string;
}

export interface EventHandler {
  id: string;
  eventTypes: string[];
  handler: (event: Event) => Promise<void>;
  priority: number;
  retryPolicy?: RetryPolicy;
  deadLetterQueue?: boolean;
}

export interface EventSubscription {
  id: string;
  eventTypes: string[];
  filter?: EventFilter;
  handler: EventHandler;
  status: 'active' | 'paused' | 'failed';
  createdAt: Date;
  lastProcessed?: Date;
}

export interface EventFilter {
  source?: string[];
  data?: Record<string, any>;
  metadata?: Record<string, any>;
  timeRange?: {
    start?: Date;
    end?: Date;
  };
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface ConfigurationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    default?: any;
    validation?: ValidationRule[];
    description?: string;
  };
}

export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'enum' | 'custom';
  value: any;
  message?: string;
}

export interface ConfigurationUpdate {
  key: string;
  value: any;
  source: 'api' | 'file' | 'environment' | 'database';
  timestamp: Date;
  userId?: string;
  reason?: string;
}

// ============================================================================
// RESILIENCE TYPES
// ============================================================================

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
  fallbackFunction?: () => Promise<any>;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  successCount?: number;
}

export interface BulkheadConfig {
  maxConcurrentCalls: number;
  maxWaitTime: number;
  queueSize: number;
}

export interface TimeoutConfig {
  duration: number;
  cancelOnTimeout: boolean;
  timeoutAction?: () => Promise<void>;
}

// ============================================================================
// DISTRIBUTED LOCKING TYPES
// ============================================================================

export interface DistributedLock {
  key: string;
  owner: string;
  expiresAt: Date;
  renewable: boolean;
  metadata?: Record<string, any>;
}

export interface LockAcquisitionOptions {
  timeout?: number;
  retryInterval?: number;
  renewable?: boolean;
  metadata?: Record<string, any>;
}

// ============================================================================
// ORCHESTRATION RESULT TYPES
// ============================================================================

export interface OrchestrationResult {
  orchestrationId: string;
  jobId: string;
  status: 'immediate' | 'async' | 'failed';
  result?: any;
  processingTime?: number;
  estimatedCompletion?: Date;
  statusCheckEndpoint?: string;
  error?: OrchestrationError;
  metrics?: OrchestrationMetrics;
}

export interface OrchestrationError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
  retryAfter?: number;
  suggestedAction?: string;
}

export interface OrchestrationMetrics {
  totalDuration: number;
  queueTime: number;
  processingTime: number;
  resourceAllocationTime: number;
  workflowExecutionTime: number;
  resourceUtilization: ResourceUtilization;
  stepMetrics: Map<string, StepMetrics>;
}

export interface StepMetrics {
  duration: number;
  retryCount: number;
  resourceUsage: ResourceUtilization;
  errorCount: number;
  throughput?: number;
}