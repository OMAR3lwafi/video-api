import { EventEmitter } from 'events';
import {
  VideoJobRequest,
  JobAnalysis,
  OrchestrationResult,
  AllocatedResources,
  WorkflowExecution,
  ServiceInstance,
  OrchestratorSettings,
  JobPriority,
  JobComplexity,
  ProcessingStrategy,
  ResourceRequirements,
  OrchestratorEvent,
  OrchestratorError
} from '../types/index.js';
import { WorkflowEngine } from '../services/WorkflowEngine.js';
import { ResourceManager } from '../services/ResourceManager.js';
import { LoadBalancerManager } from '../services/LoadBalancerManager.js';
import { HealthCheckEngine } from '../services/HealthCheckEngine.js';
import { AnalyticsEngine } from '../services/AnalyticsEngine.js';
import { EventBus } from '../services/EventBus.js';
import { ConfigurationManager } from '../services/ConfigurationManager.js';
import { ResilienceManager } from '../services/ResilienceManager.js';
import { Logger } from '../utils/Logger.js';

export class MasterOrchestrator extends EventEmitter {
  private workflowEngine: WorkflowEngine;
  private resourceManager: ResourceManager;
  private loadBalancer: LoadBalancerManager;
  private healthChecker: HealthCheckEngine;
  private analyticsEngine: AnalyticsEngine;
  private eventBus: EventBus;
  private configManager: ConfigurationManager;
  private resilienceManager: ResilienceManager;
  private logger: Logger;

  private activeOrchestrations: Map<string, OrchestrationContext>;
  private orchestrationQueue: PriorityQueue<QueuedJob>;
  private isInitialized: boolean = false;
  private shutdownSignal: boolean = false;

  constructor() {
    super();

    this.logger = new Logger('MasterOrchestrator');
    this.configManager = ConfigurationManager.getInstance();
    this.eventBus = new EventBus();
    this.resilienceManager = new ResilienceManager();

    this.workflowEngine = new WorkflowEngine();
    this.resourceManager = new ResourceManager();
    this.loadBalancer = new LoadBalancerManager();
    this.healthChecker = new HealthCheckEngine();
    this.analyticsEngine = new AnalyticsEngine();

    this.activeOrchestrations = new Map();
    this.orchestrationQueue = new PriorityQueue();

    this.initializeOrchestrator();
  }

  /**
   * Initialize the orchestrator with all required components
   */
  private async initializeOrchestrator(): Promise<void> {
    try {
      this.logger.info('Initializing Master Orchestrator...');

      // Initialize configuration
      await this.configManager.loadConfiguration();

      // Initialize all service components
      await Promise.all([
        this.workflowEngine.initialize(),
        this.resourceManager.initialize(),
        this.loadBalancer.initialize(),
        this.healthChecker.initialize(),
        this.analyticsEngine.initialize()
      ]);

      // Set up event handlers
      this.setupEventHandlers();

      // Start background processes
      this.startBackgroundProcesses();

      this.isInitialized = true;
      this.logger.info('Master Orchestrator initialized successfully');

      this.eventBus.emit('orchestrator_initialized', { timestamp: new Date() });

    } catch (error) {
      this.logger.error('Failed to initialize Master Orchestrator:', error);
      throw new OrchestratorError('Initialization failed', 'INIT_ERROR', error);
    }
  }

  /**
   * Main orchestration entry point - intelligently routes and processes video jobs
   */
  public async orchestrateVideoJob(request: VideoJobRequest): Promise<OrchestrationResult> {
    if (!this.isInitialized) {
      throw new OrchestratorError('Orchestrator not initialized', 'NOT_INITIALIZED');
    }

    const orchestrationId = this.generateOrchestrationId();
    const correlationId = request.id;

    this.logger.info(`Starting orchestration ${orchestrationId} for job ${request.id}`);

    try {
      // Emit job received event
      this.eventBus.emit('job_received', {
        id: this.generateEventId(),
        type: 'job_received',
        source: 'master_orchestrator',
        timestamp: new Date(),
        data: { jobId: request.id, orchestrationId },
        correlationId
      });

      // 1. Pre-processing Analysis with resilience
      const jobAnalysis = await this.resilienceManager.executeWithResilience(
        'job_analysis',
        () => this.analyzeJobComplexity(request),
        { timeout: 30000, retries: 2 }
      );

      this.logger.debug(`Job analysis completed for ${request.id}:`, jobAnalysis);

      // 2. Determine processing strategy based on analysis
      const processingDecision = await this.makeProcessingDecision(jobAnalysis);

      // 3. Handle immediate vs async processing
      if (processingDecision.immediate) {
        return await this.handleImmediateProcessing(request, jobAnalysis, orchestrationId);
      } else {
        return await this.handleAsyncProcessing(request, jobAnalysis, orchestrationId);
      }

    } catch (error) {
      this.logger.error(`Orchestration failed for job ${request.id}:`, error);
      await this.handleOrchestrationError(orchestrationId, error);
      throw error;
    }
  }

  /**
   * Analyze job complexity and resource requirements using ML-driven insights
   */
  private async analyzeJobComplexity(request: VideoJobRequest): Promise<JobAnalysis> {
    const startTime = Date.now();

    try {
      // Calculate basic metrics
      const elementCount = request.elements.length;
      const totalDuration = this.calculateTotalDuration(request.elements);
      const outputResolution = request.width * request.height;
      const hasComplexEffects = this.hasComplexEffects(request.elements);
      const hasMultipleTracks = this.hasMultipleTracks(request.elements);

      // Estimate processing duration using historical data
      const estimatedDuration = await this.estimateProcessingDuration(request);

      // Calculate resource requirements
      const resourceRequirements = await this.calculateResourceRequirements(
        request,
        estimatedDuration,
        hasComplexEffects
      );

      // Determine job priority
      const priority = this.calculateJobPriority(request);

      // Assess complexity level
      const complexity = this.assessComplexity(
        elementCount,
        totalDuration,
        outputResolution,
        hasComplexEffects,
        hasMultipleTracks
      );

      // Select optimal processing strategy
      const optimalStrategy = this.determineProcessingStrategy(
        complexity,
        estimatedDuration,
        resourceRequirements,
        priority
      );

      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(request, complexity);

      // Generate optimization hints
      const optimizationHints = this.generateOptimizationHints(request, resourceRequirements);

      const analysis: JobAnalysis = {
        estimatedDuration,
        resourceRequirements,
        priority,
        complexity,
        optimalStrategy,
        riskFactors,
        optimizationHints
      };

      const analysisTime = Date.now() - startTime;
      this.logger.debug(`Job analysis completed in ${analysisTime}ms for job ${request.id}`);

      return analysis;

    } catch (error) {
      this.logger.error(`Job analysis failed for ${request.id}:`, error);
      throw new OrchestratorError('Job analysis failed', 'ANALYSIS_ERROR', error);
    }
  }

  /**
   * Handle immediate processing for simple jobs (≤30 seconds)
   */
  private async handleImmediateProcessing(
    request: VideoJobRequest,
    jobAnalysis: JobAnalysis,
    orchestrationId: string
  ): Promise<OrchestrationResult> {

    this.logger.info(`Processing job ${request.id} immediately (estimated: ${jobAnalysis.estimatedDuration}s)`);

    try {
      // Quick resource allocation
      const resources = await this.resourceManager.allocateResourcesImmediate(jobAnalysis);

      // Select best available service
      const targetService = await this.loadBalancer.selectOptimalService(jobAnalysis);

      // Create and execute immediate workflow
      const workflow = await this.workflowEngine.createImmediateWorkflow(request, resources);

      // Execute workflow with timeout
      const workflowResult = await Promise.race([
        this.workflowEngine.executeWorkflow(workflow.definition.id),
        this.createTimeoutPromise(30000) // 30-second timeout
      ]);

      if (!workflowResult || workflowResult.state !== 'completed') {
        throw new OrchestratorError('Immediate processing failed', 'IMMEDIATE_FAILED');
      }

      // Release resources
      await this.resourceManager.releaseResources(resources.id);

      // Record metrics
      await this.analyticsEngine.recordJobCompletion(request.id, jobAnalysis, workflowResult);

      return {
        jobId: request.id,
        orchestrationId,
        status: 'immediate',
        result_url: workflowResult.result?.url || '',
        job_id: request.id,
        processing_time: `${workflowResult.duration}ms`,
        file_size: workflowResult.result?.fileSize || '0',
        message: 'Job completed successfully'
      };

    } catch (error) {
      this.logger.error(`Immediate processing failed for job ${request.id}:`, error);
      throw error;
    }
  }

  /**
   * Handle async processing for complex jobs (>30 seconds)
   */
  private async handleAsyncProcessing(
    request: VideoJobRequest,
    jobAnalysis: JobAnalysis,
    orchestrationId: string
  ): Promise<OrchestrationResult> {

    this.logger.info(`Queueing job ${request.id} for async processing (estimated: ${jobAnalysis.estimatedDuration}s)`);

    try {
      // Create workflow for async processing
      const resources = await this.resourceManager.allocateResourcesAsync(jobAnalysis);
      const workflow = await this.workflowEngine.createAsyncWorkflow(request, resources);

      // Store orchestration context
      const context: OrchestrationContext = {
        orchestrationId,
        jobRequest: request,
        jobAnalysis,
        workflow,
        resources,
        status: 'queued',
        createdAt: new Date()
      };

      this.activeOrchestrations.set(orchestrationId, context);

      // Queue for background processing
      await this.queueForProcessing({
        jobId: request.id,
        orchestrationId,
        priority: jobAnalysis.priority,
        estimatedDuration: jobAnalysis.estimatedDuration,
        queuedAt: new Date()
      });

      // Calculate estimated completion time
      const estimatedCompletion = this.calculateEstimatedCompletion(jobAnalysis);

      return {
        jobId: request.id,
        orchestrationId,
        status: 'queued',
        job_id: request.id,
        message: 'Job queued for processing',
        estimated_completion: estimatedCompletion.toISOString(),
        workflow_id: workflow.definition.id,
        resource_allocation_id: resources.id
      };

    } catch (error) {
      this.logger.error(`Async processing setup failed for job ${request.id}:`, error);
      throw error;
    }
  }

  /**
   * Make intelligent processing decision based on job analysis
   */
  private async makeProcessingDecision(jobAnalysis: JobAnalysis): Promise<ProcessingDecision> {
    const settings = this.configManager.getConfig();
    const systemLoad = await this.resourceManager.getCurrentSystemLoad();
    const healthStatus = await this.healthChecker.getOverallHealth();

    // Decision factors
    const estimatedDuration = jobAnalysis.estimatedDuration;
    const resourceLoad = systemLoad.cpu + systemLoad.memory + systemLoad.storage;
    const healthScore = healthStatus.overall === 'healthy' ? 1.0 : 0.5;

    // Immediate processing conditions
    const canProcessImmediate = (
      estimatedDuration <= 30 && // Under 30 seconds
      resourceLoad < 0.8 && // System not overloaded
      healthScore > 0.8 && // System healthy
      jobAnalysis.complexity !== 'enterprise' // Not enterprise complexity
    );

    // Load balancing considerations
    const availableServices = await this.loadBalancer.getAvailableServices();
    const hasCapacity = availableServices.some(service =>
      service.currentLoad.activeJobs < service.capacity.maxConcurrentJobs * 0.8
    );

    return {
      immediate: canProcessImmediate && hasCapacity,
      reason: canProcessImmediate
        ? 'Job meets immediate processing criteria'
        : `Async processing required: duration=${estimatedDuration}s, load=${resourceLoad}, health=${healthScore}`,
      recommendedStrategy: jobAnalysis.optimalStrategy
    };
  }

  /**
   * Calculate estimated processing duration using historical data and ML predictions
   */
  private async estimateProcessingDuration(request: VideoJobRequest): Promise<number> {
    try {
      // Get historical data for similar jobs
      const similarJobs = await this.analyticsEngine.findSimilarJobs(request);

      // Base calculation factors
      const elementCount = request.elements.length;
      const totalFrames = this.calculateTotalFrames(request);
      const outputResolution = request.width * request.height;
      const hasComplexEffects = this.hasComplexEffects(request.elements);

      // Base processing time (seconds per element)
      let baseDuration = elementCount * 2;

      // Resolution factor (higher resolution = longer processing)
      const resolutionFactor = Math.sqrt(outputResolution / (1920 * 1080));
      baseDuration *= resolutionFactor;

      // Effects complexity factor
      if (hasComplexEffects) {
        baseDuration *= 2.5;
      }

      // Frame count factor
      const frameFactor = Math.log(totalFrames + 1) / Math.log(1000);
      baseDuration *= (1 + frameFactor);

      // Apply historical data adjustment
      if (similarJobs.length > 0) {
        const avgHistoricalDuration = similarJobs.reduce((sum, job) => sum + job.duration, 0) / similarJobs.length;
        baseDuration = (baseDuration + avgHistoricalDuration) / 2;
      }

      // Add safety margin (20%)
      const estimatedDuration = Math.ceil(baseDuration * 1.2);

      return Math.max(estimatedDuration, 5); // Minimum 5 seconds

    } catch (error) {
      this.logger.warn('Failed to get historical data for duration estimation:', error);
      // Fallback to basic calculation
      return Math.max(request.elements.length * 3, 10);
    }
  }

  /**
   * Calculate resource requirements based on job characteristics
   */
  private async calculateResourceRequirements(
    request: VideoJobRequest,
    estimatedDuration: number,
    hasComplexEffects: boolean
  ): Promise<ResourceRequirements> {

    const elementCount = request.elements.length;
    const outputResolution = request.width * request.height;
    const megapixels = outputResolution / (1024 * 1024);

    // Base resource calculations
    let cpuCores = Math.max(2, Math.ceil(elementCount / 2));
    let memoryGB = Math.max(4, Math.ceil(megapixels * 2 + elementCount * 0.5));
    let storageGB = Math.max(10, Math.ceil(megapixels * 0.1 * elementCount));
    let bandwidthMbps = Math.max(100, Math.ceil(megapixels * 10));

    // Complexity adjustments
    if (hasComplexEffects) {
      cpuCores *= 1.5;
      memoryGB *= 1.8;
      storageGB *= 1.3;
    }

    // Duration-based adjustments
    if (estimatedDuration > 300) { // > 5 minutes
      cpuCores *= 1.2;
      memoryGB *= 1.3;
    }

    // GPU requirements
    const needsGPU = (
      hasComplexEffects ||
      outputResolution >= (3840 * 2160) || // 4K+
      elementCount > 10
    );

    return {
      cpu: Math.ceil(cpuCores),
      memory: Math.ceil(memoryGB),
      storage: Math.ceil(storageGB),
      bandwidth: Math.ceil(bandwidthMbps),
      gpu: needsGPU,
      estimatedDuration
    };
  }

  /**
   * Determine optimal processing strategy based on job characteristics
   */
  private determineProcessingStrategy(
    complexity: JobComplexity,
    estimatedDuration: number,
    resourceRequirements: ResourceRequirements,
    priority: JobPriority
  ): ProcessingStrategy {

    // Quick sync for simple, fast jobs
    if (complexity === 'simple' && estimatedDuration <= 30) {
      return 'quick_sync';
    }

    // Distributed processing for enterprise complexity
    if (complexity === 'enterprise' || resourceRequirements.cpu > 8) {
      return 'distributed';
    }

    // Resource intensive for high resource jobs
    if (resourceRequirements.cpu > 4 || resourceRequirements.memory > 16) {
      return 'resource_intensive';
    }

    // Default to balanced async
    return 'balanced_async';
  }

  /**
   * Set up event handlers for inter-component communication
   */
  private setupEventHandlers(): void {
    // Workflow completion events
    this.workflowEngine.on('workflow_completed', this.handleWorkflowCompletion.bind(this));
    this.workflowEngine.on('workflow_failed', this.handleWorkflowFailure.bind(this));

    // Resource events
    this.resourceManager.on('resource_shortage', this.handleResourceShortage.bind(this));
    this.resourceManager.on('optimization_opportunity', this.handleOptimizationOpportunity.bind(this));

    // Health check events
    this.healthChecker.on('component_unhealthy', this.handleComponentUnhealthy.bind(this));
    this.healthChecker.on('system_degraded', this.handleSystemDegraded.bind(this));

    // Load balancer events
    this.loadBalancer.on('service_unavailable', this.handleServiceUnavailable.bind(this));

    // Shutdown handling
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  /**
   * Start background processes for monitoring and optimization
   */
  private startBackgroundProcesses(): void {
    // Process queued jobs
    setInterval(() => this.processQueue(), 5000);

    // System health monitoring
    setInterval(() => this.performSystemHealthCheck(), 30000);

    // Resource optimization
    setInterval(() => this.optimizeSystemResources(), 300000); // 5 minutes

    // Analytics and reporting
    setInterval(() => this.generateSystemAnalytics(), 600000); // 10 minutes

    // Cleanup completed orchestrations
    setInterval(() => this.cleanupCompletedOrchestrations(), 3600000); // 1 hour
  }

  /**
   * Process queued jobs in priority order
   */
  private async processQueue(): Promise<void> {
    if (this.shutdownSignal || this.orchestrationQueue.isEmpty()) {
      return;
    }

    try {
      const systemLoad = await this.resourceManager.getCurrentSystemLoad();
      if (systemLoad.cpu > 0.9 || systemLoad.memory > 0.9) {
        this.logger.debug('System overloaded, skipping queue processing');
        return;
      }

      const queuedJob = this.orchestrationQueue.dequeue();
      if (queuedJob) {
        await this.processQueuedJob(queuedJob);
      }

    } catch (error) {
      this.logger.error('Queue processing error:', error);
    }
  }

  /**
   * Handle graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    this.logger.info('Initiating graceful shutdown...');
    this.shutdownSignal = true;

    try {
      // Stop accepting new jobs
      this.removeAllListeners();

      // Wait for active orchestrations to complete (with timeout)
      const activeCount = this.activeOrchestrations.size;
      if (activeCount > 0) {
        this.logger.info(`Waiting for ${activeCount} active orchestrations to complete...`);
        await this.waitForActiveOrchestrations(30000); // 30 second timeout
      }

      // Clean shutdown of all services
      await Promise.all([
        this.workflowEngine.shutdown(),
        this.resourceManager.shutdown(),
        this.loadBalancer.shutdown(),
        this.healthChecker.shutdown(),
        this.analyticsEngine.shutdown()
      ]);

      this.logger.info('Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  // Helper methods
  private generateOrchestrationId(): string {
    return `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateTotalDuration(elements: any[]): number {
    return elements.reduce((sum, element) => sum + (element.duration || 10), 0);
  }

  private calculateTotalFrames(request: VideoJobRequest): number {
    const fps = 30; // Assume 30 FPS
    const totalDuration = this.calculateTotalDuration(request.elements);
    return totalDuration * fps;
  }

  private hasComplexEffects(elements: any[]): boolean {
    return elements.some(element =>
      element.effects && element.effects.length > 0
    );
  }

  private hasMultipleTracks(elements: any[]): boolean {
    const tracks = new Set(elements.map(element => element.track));
    return tracks.size > 1;
  }

  private calculateJobPriority(request: VideoJobRequest): JobPriority {
    return request.priority || 'normal';
  }

  private assessComplexity(
    elementCount: number,
    totalDuration: number,
    outputResolution: number,
    hasComplexEffects: boolean,
    hasMultipleTracks: boolean
  ): JobComplexity {

    let complexity = 0;

    // Element count factor
    if (elementCount > 10) complexity += 2;
    else if (elementCount > 5) complexity += 1;

    // Duration factor
    if (totalDuration > 300) complexity += 2; // > 5 minutes
    else if (totalDuration > 60) complexity += 1; // > 1 minute

    // Resolution factor
    if (outputResolution >= 3840 * 2160) complexity += 2; // 4K+
    else if (outputResolution >= 1920 * 1080) complexity += 1; // 1080p+

    // Effects factor
    if (hasComplexEffects) complexity += 2;

    // Multi-track factor
    if (hasMultipleTracks) complexity += 1;

    if (complexity >= 6) return 'enterprise';
    if (complexity >= 4) return 'complex';
    if (complexity >= 2) return 'moderate';
    return 'simple';
  }

  private identifyRiskFactors(request: VideoJobRequest, complexity: JobComplexity): string[] {
    const risks: string[] = [];

    if (complexity === 'enterprise') {
      risks.push('High complexity job may require extended processing time');
    }

    if (request.elements.length > 15) {
      risks.push('Large number of elements may impact performance');
    }

    if (request.width * request.height >= 3840 * 2160) {
      risks.push('4K+ resolution requires significant resources');
    }

    return risks;
  }

  private generateOptimizationHints(request: VideoJobRequest, requirements: ResourceRequirements): string[] {
    const hints: string[] = [];

    if (requirements.cpu > 8) {
      hints.push('Consider distributed processing for CPU-intensive job');
    }

    if (requirements.gpu) {
      hints.push('GPU acceleration recommended for this job');
    }

    return hints;
  }

  private calculateEstimatedCompletion(jobAnalysis: JobAnalysis): Date {
    const queueDelay = this.estimateQueueDelay();
    const processingTime = jobAnalysis.estimatedDuration * 1000;
    const totalTime = queueDelay + processingTime;

    return new Date(Date.now() + totalTime);
  }

  private estimateQueueDelay(): number {
    const queueSize = this.orchestrationQueue.size();
    const avgProcessingTime = 60000; // 60 seconds average
    return queueSize * avgProcessingTime;
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeout);
    });
  }

  private async handleOrchestrationError(orchestrationId: string, error: any): Promise<void> {
    this.logger.error(`Orchestration ${orchestrationId} failed:`, error);

    // Clean up resources
    const context = this.activeOrchestrations.get(orchestrationId);
    if (context && context.resources) {
      await this.resourceManager.releaseResources(context.resources.id);
    }

    // Remove from active orchestrations
    this.activeOrchestrations.delete(orchestrationId);

    // Emit failure event
    this.eventBus.emit('orchestration_failed', {
      id: this.generateEventId(),
      type: 'job_failed',
      source: 'master_orchestrator',
      timestamp: new Date(),
      data: { orchestrationId, error: error.message }
    });
  }

  // Event handler methods (stubs - implement as needed)
  private async handleWorkflowCompletion(event: any): Promise<void> {
    // Implementation for workflow completion
  }

  private async handleWorkflowFailure(event: any): Promise<void> {
    // Implementation for workflow failure
  }

  private async handleResourceShortage(event: any): Promise<void> {
    // Implementation for resource shortage
  }

  private async handleOptimizationOpportunity(event: any): Promise<void> {
    // Implementation for optimization opportunity
  }

  private async handleComponentUnhealthy(event: any): Promise<void> {
    // Implementation for unhealthy component
  }

  private async handleSystemDegraded(event: any): Promise<void> {
    // Implementation for system degradation
  }

  private async handleServiceUnavailable(event: any): Promise<void> {
    // Implementation for service unavailability
  }

  private async queueForProcessing(queuedJob: QueuedJob): Promise<void> {
    this.orchestrationQueue.enqueue(queuedJob, this.calculatePriorityScore(queuedJob.priority));
  }

  private calculatePriorityScore(priority: JobPriority): number {
    const scores = { critical: 4, high: 3, normal: 2, low: 1 };
    return scores[priority] || 2;
  }

  private async processQueuedJob(queuedJob: QueuedJob): Promise<void> {
    // Implementation for processing queued jobs
  }

  private async performSystemHealthCheck(): Promise<void> {
    // Implementation for system health check
  }

  private async optimizeSystemResources(): Promise<void> {
    // Implementation for resource optimization
  }

  private async generateSystemAnalytics(): Promise<void> {
    // Implementation for analytics generation
  }

  private async cleanupCompletedOrchestrations(): Promise<void> {
    // Implementation for cleanup
  }

  private async waitForActiveOrchestrations(timeout: number): Promise<void> {
    // Implementation for waiting on active orchestrations
  }
}

// Supporting interfaces and classes
interface OrchestrationContext {
  orchestrationId: string;
  jobRequest: VideoJobRequest;
  jobAnalysis: JobAnalysis;
  workflow: WorkflowExecution;
  resources: AllocatedResources;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

interface ProcessingDecision {
  immediate: boolean;
  reason: string;
  recommendedStrategy: ProcessingStrategy;
}

interface QueuedJob {
  jobId: string;
  orchestrationId: string;
  priority: JobPriority;
  estimatedDuration: number;
  queuedAt: Date;
}

class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  enqueue(item: T, priority: number): void {
    this.items.push({ item, priority });
    this.items.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): T | undefined {
    const result = this.items.shift();
    return result?.item;
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}
