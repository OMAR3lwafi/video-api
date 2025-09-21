// Master Orchestrator - Central coordination hub
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { WorkflowEngine } from '../engines/WorkflowEngine';
import { ResourceManager } from '../managers/ResourceManager';
import { LoadBalancerManager } from '../managers/LoadBalancerManager';
import { HealthCheckEngine } from '../engines/HealthCheckEngine';
import { AnalyticsEngine } from '../engines/AnalyticsEngine';
import { ResilienceManager } from '../managers/ResilienceManager';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { EventBus } from '../events/EventBus';
import { StateManager } from '../managers/StateManager';
import {
  OrchestratorConfig,
  JobAnalysis,
  WorkflowTemplate,
  WorkerNode,
  OrchestratorEvent,
  EventType,
  SystemMetrics,
  JobState
} from '../interfaces/orchestrator.interfaces';
import { VideoCreateRequest } from '../../types/video.types';

export class MasterOrchestrator extends EventEmitter {
  private static instance: MasterOrchestrator;
  private config: OrchestratorConfig;
  private workflowEngine: WorkflowEngine;
  private resourceManager: ResourceManager;
  private loadBalancer: LoadBalancerManager;
  private healthEngine: HealthCheckEngine;
  private analyticsEngine: AnalyticsEngine;
  private resilienceManager: ResilienceManager;
  private configManager: ConfigurationManager;
  private eventBus: EventBus;
  private stateManager: StateManager;
  private activeJobs: Map<string, JobState>;
  private isRunning: boolean = false;
  private orchestrationInterval?: NodeJS.Timeout;

  private constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.activeJobs = new Map();
    this.initializeComponents();
  }

  public static getInstance(config?: OrchestratorConfig): MasterOrchestrator {
    if (!MasterOrchestrator.instance) {
      if (!config) {
        throw new Error('Configuration required for first initialization');
      }
      MasterOrchestrator.instance = new MasterOrchestrator(config);
    }
    return MasterOrchestrator.instance;
  }

  private initializeComponents(): void {
    // Initialize all orchestrator components
    this.configManager = ConfigurationManager.getInstance(this.config);
    this.eventBus = EventBus.getInstance();
    this.stateManager = new StateManager(this.config.distributedLocking);
    this.workflowEngine = new WorkflowEngine(this.eventBus);
    this.resourceManager = new ResourceManager(this.eventBus);
    this.loadBalancer = new LoadBalancerManager(this.config.loadBalancingStrategy);
    this.healthEngine = new HealthCheckEngine(this.config.healthCheckInterval);
    this.analyticsEngine = new AnalyticsEngine(this.config.metricsInterval);
    this.resilienceManager = new ResilienceManager(this.eventBus);

    this.setupEventHandlers();
    logger.info('Master Orchestrator initialized with all components');
  }

  private setupEventHandlers(): void {
    // Handle workflow events
    this.eventBus.on(EventType.WORKFLOW_COMPLETED, (event: OrchestratorEvent) => {
      this.handleWorkflowCompleted(event);
    });

    this.eventBus.on(EventType.WORKFLOW_STARTED, (event: OrchestratorEvent) => {
      this.handleWorkflowStarted(event);
    });

    // Handle node events
    this.eventBus.on(EventType.NODE_UNHEALTHY, (event: OrchestratorEvent) => {
      this.handleNodeFailure(event);
    });

    // Handle job events
    this.eventBus.on(EventType.JOB_FAILED, (event: OrchestratorEvent) => {
      this.handleJobFailure(event);
    });

    // Handle resource alerts
    this.eventBus.on(EventType.RESOURCE_ALERT, (event: OrchestratorEvent) => {
      this.handleResourceAlert(event);
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Orchestrator is already running');
      return;
    }

    logger.info('Starting Master Orchestrator...');
    
    try {
      // Start all engines and managers
      await this.stateManager.initialize();
      await this.healthEngine.start();
      await this.analyticsEngine.start();
      await this.resourceManager.initialize();
      await this.workflowEngine.initialize();
      
      // Start orchestration loop
      this.startOrchestrationLoop();
      
      this.isRunning = true;
      logger.info('Master Orchestrator started successfully');
      
      // Emit start event
      this.eventBus.emit(EventType.JOB_STARTED, {
        id: uuidv4(),
        type: EventType.JOB_STARTED,
        timestamp: new Date(),
        source: 'MasterOrchestrator',
        data: { message: 'Orchestrator started' }
      });
    } catch (error) {
      logger.error('Failed to start orchestrator:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Orchestrator is not running');
      return;
    }

    logger.info('Stopping Master Orchestrator...');
    
    // Stop orchestration loop
    if (this.orchestrationInterval) {
      clearInterval(this.orchestrationInterval);
    }

    // Stop all components
    await this.healthEngine.stop();
    await this.analyticsEngine.stop();
    await this.stateManager.shutdown();
    
    this.isRunning = false;
    logger.info('Master Orchestrator stopped');
  }

  private startOrchestrationLoop(): void {
    this.orchestrationInterval = setInterval(async () => {
      try {
        await this.orchestrate();
      } catch (error) {
        logger.error('Orchestration loop error:', error);
      }
    }, 5000); // Run every 5 seconds
  }

  private async orchestrate(): Promise<void> {
    // Get system metrics
    const metrics = await this.analyticsEngine.getMetrics();
    
    // Check for scaling needs
    if (this.config.enablePredictiveScaling) {
      const prediction = await this.analyticsEngine.getPredictions();
      if (prediction.recommendedScaling.action !== 'maintain') {
        await this.handleScalingRecommendation(prediction.recommendedScaling);
      }
    }

    // Rebalance jobs if needed
    await this.rebalanceJobs();

    // Clean up completed jobs
    await this.cleanupCompletedJobs();

    // Update state snapshot
    await this.stateManager.saveSnapshot({
      version: '1.0.0',
      timestamp: new Date(),
      jobs: this.activeJobs,
      nodes: await this.resourceManager.getNodes(),
      metrics,
      locks: await this.stateManager.getLocks()
    });
  }

  public async processJob(request: VideoCreateRequest): Promise<string> {
    const jobId = uuidv4();
    
    try {
      // Acquire distributed lock for job
      if (this.config.distributedLocking.enabled) {
        const lock = await this.stateManager.acquireLock(`job:${jobId}`);
        if (!lock) {
          throw new Error('Failed to acquire job lock');
        }
      }

      // Analyze job requirements
      const analysis = await this.analyzeJob(request);
      logger.info(`Job ${jobId} analysis:`, analysis);

      // Select workflow based on analysis
      const workflow = this.workflowEngine.selectWorkflow(analysis);

      // Allocate resources
      const resources = await this.resourceManager.allocateResources(
        analysis.requiredResources
      );

      if (!resources) {
        throw new Error('Insufficient resources available');
      }

      // Select worker node
      const node = await this.loadBalancer.selectNode(
        await this.resourceManager.getAvailableNodes(),
        analysis.requiredResources
      );

      if (!node) {
        throw new Error('No available worker nodes');
      }

      // Create job state
      const jobState: JobState = {
        id: jobId,
        status: 'pending',
        workflow: workflow.name,
        currentStep: 'initialization',
        startTime: new Date(),
        lastUpdate: new Date(),
        retryCount: 0,
        assignedNode: node.id
      };

      this.activeJobs.set(jobId, jobState);

      // Execute workflow with resilience
      await this.resilienceManager.executeWithResilience(
        async () => {
          await this.workflowEngine.execute(workflow, {
            jobId,
            request,
            node,
            resources,
            analysis
          });
        },
        {
          maxRetries: this.config.maxJobRetries,
          onRetry: (attempt) => {
            jobState.retryCount = attempt;
            this.eventBus.emit(EventType.JOB_RETRYING, {
              id: uuidv4(),
              type: EventType.JOB_RETRYING,
              timestamp: new Date(),
              source: 'MasterOrchestrator',
              data: { jobId, attempt }
            });
          }
        }
      );

      // Update job state
      jobState.status = 'processing';
      jobState.lastUpdate = new Date();

      logger.info(`Job ${jobId} submitted successfully to node ${node.id}`);
      return jobId;

    } catch (error) {
      logger.error(`Failed to process job ${jobId}:`, error);
      
      // Clean up on failure
      this.activeJobs.delete(jobId);
      if (this.config.distributedLocking.enabled) {
        await this.stateManager.releaseLock(`job:${jobId}`);
      }
      
      throw error;
    }
  }

  private async analyzeJob(request: VideoCreateRequest): Promise<JobAnalysis> {
    // Calculate complexity based on elements and operations
    const elementCount = request.elements.length;
    const hasVideoElements = request.elements.some(e => e.type === 'video');
    const totalDuration = await this.estimateDuration(request);
    
    let complexity: 'low' | 'medium' | 'high' | 'extreme';
    if (elementCount <= 2 && !hasVideoElements) {
      complexity = 'low';
    } else if (elementCount <= 5) {
      complexity = 'medium';
    } else if (elementCount <= 10) {
      complexity = 'high';
    } else {
      complexity = 'extreme';
    }

    // Calculate resource requirements
    const requiredResources = {
      cpu: elementCount * (hasVideoElements ? 2 : 1),
      memory: 512 + (elementCount * 256),
      storage: elementCount * 100,
      bandwidth: 100,
      gpu: hasVideoElements ? 1 : 0
    };

    // Determine workflow recommendation
    let recommendedWorkflow: WorkflowTemplate;
    if (totalDuration <= 30000 && complexity === 'low') {
      recommendedWorkflow = WorkflowTemplate.QUICK_SYNC;
    } else if (complexity === 'extreme') {
      recommendedWorkflow = WorkflowTemplate.DISTRIBUTED;
    } else if (requiredResources.gpu > 0) {
      recommendedWorkflow = WorkflowTemplate.HIGH_PERFORMANCE;
    } else {
      recommendedWorkflow = WorkflowTemplate.BALANCED_ASYNC;
    }

    return {
      estimatedDuration: totalDuration,
      requiredResources,
      complexity,
      recommendedWorkflow,
      parallelizable: elementCount > 3,
      chunksCount: elementCount > 5 ? Math.ceil(elementCount / 3) : undefined
    };
  }

  private async estimateDuration(request: VideoCreateRequest): Promise<number> {
    // Base processing time
    let duration = 5000;
    
    // Add time per element
    for (const element of request.elements) {
      if (element.type === 'video') {
        duration += 15000; // 15 seconds per video
      } else {
        duration += 5000; // 5 seconds per image
      }
    }

    // Add encoding time based on output format
    switch (request.output_format) {
      case 'mp4':
        duration += 10000;
        break;
      case 'mov':
        duration += 15000;
        break;
      case 'avi':
        duration += 20000;
        break;
    }

    // Add time for resolution
    const pixels = request.width * request.height;
    if (pixels > 1920 * 1080) {
      duration += 20000; // 4K or higher
    } else if (pixels > 1280 * 720) {
      duration += 10000; // HD
    }

    return duration;
  }

  private async handleWorkflowStarted(event: OrchestratorEvent): Promise<void> {
    const { jobId } = event.data;
    const jobState = this.activeJobs.get(jobId);
    
    if (jobState) {
      jobState.status = 'processing';
      jobState.lastUpdate = new Date();
      logger.info(`Workflow started for job ${jobId}`);
    }
  }

  private async handleWorkflowCompleted(event: OrchestratorEvent): Promise<void> {
    const { jobId, result } = event.data;
    const jobState = this.activeJobs.get(jobId);
    
    if (jobState) {
      jobState.status = 'completed';
      jobState.lastUpdate = new Date();
      
      // Release resources
      await this.resourceManager.releaseResources(jobId);
      
      // Release distributed lock
      if (this.config.distributedLocking.enabled) {
        await this.stateManager.releaseLock(`job:${jobId}`);
      }
      
      logger.info(`Workflow completed for job ${jobId}`);
    }
  }

  private async handleJobFailure(event: OrchestratorEvent): Promise<void> {
    const { jobId, error } = event.data;
    const jobState = this.activeJobs.get(jobId);
    
    if (jobState) {
      jobState.status = 'failed';
      jobState.error = error;
      jobState.lastUpdate = new Date();
      
      // Attempt recovery if enabled
      if (this.config.enableAutoRecovery && jobState.retryCount < this.config.maxJobRetries) {
        logger.info(`Attempting recovery for job ${jobId}`);
        await this.recoverJob(jobId);
      } else {
        // Clean up failed job
        await this.resourceManager.releaseResources(jobId);
        if (this.config.distributedLocking.enabled) {
          await this.stateManager.releaseLock(`job:${jobId}`);
        }
      }
    }
  }

  private async handleNodeFailure(event: OrchestratorEvent): Promise<void> {
    const { nodeId } = event.data;
    logger.warn(`Node ${nodeId} failed, redistributing jobs...`);
    
    // Find all jobs on failed node
    const affectedJobs = Array.from(this.activeJobs.entries())
      .filter(([_, state]) => state.assignedNode === nodeId);
    
    // Redistribute jobs
    for (const [jobId, _] of affectedJobs) {
      await this.redistributeJob(jobId);
    }
  }

  private async handleResourceAlert(event: OrchestratorEvent): Promise<void> {
    const { alert } = event.data;
    logger.warn('Resource alert received:', alert);
    
    // Take action based on alert severity
    if (alert.severity === 'critical') {
      // Pause new job intake
      await this.pauseNewJobs();
    } else if (alert.severity === 'warning') {
      // Trigger rebalancing
      await this.rebalanceJobs();
    }
  }

  private async handleScalingRecommendation(recommendation: any): Promise<void> {
    logger.info('Scaling recommendation:', recommendation);
    
    if (recommendation.action === 'scale_up') {
      await this.resourceManager.scaleUp(recommendation.nodeCount);
    } else if (recommendation.action === 'scale_down') {
      await this.resourceManager.scaleDown(recommendation.nodeCount);
    }
  }

  private async recoverJob(jobId: string): Promise<void> {
    const jobState = this.activeJobs.get(jobId);
    if (!jobState) return;
    
    jobState.retryCount++;
    jobState.status = 'retrying';
    
    // Find new node for job
    const nodes = await this.resourceManager.getAvailableNodes();
    const newNode = await this.loadBalancer.selectNode(nodes);
    
    if (newNode) {
      jobState.assignedNode = newNode.id;
      // Re-submit job to new node
      // Implementation depends on job execution system
      logger.info(`Job ${jobId} reassigned to node ${newNode.id}`);
    }
  }

  private async redistributeJob(jobId: string): Promise<void> {
    const jobState = this.activeJobs.get(jobId);
    if (!jobState || jobState.status === 'completed') return;
    
    // Find healthy node
    const nodes = await this.resourceManager.getHealthyNodes();
    const newNode = await this.loadBalancer.selectNode(nodes);
    
    if (newNode) {
      jobState.assignedNode = newNode.id;
      logger.info(`Job ${jobId} redistributed to node ${newNode.id}`);
    } else {
      logger.error(`No healthy nodes available for job ${jobId}`);
      jobState.status = 'failed';
      jobState.error = 'No healthy nodes available';
    }
  }

  private async rebalanceJobs(): Promise<void> {
    const nodes = await this.resourceManager.getNodes();
    const nodeLoads = new Map<string, number>();
    
    // Calculate load per node
    nodes.forEach((node, id) => {
      nodeLoads.set(id, node.currentJobs.length);
    });
    
    // Find overloaded and underloaded nodes
    const avgLoad = Array.from(nodeLoads.values()).reduce((a, b) => a + b, 0) / nodeLoads.size;
    const overloaded = Array.from(nodeLoads.entries()).filter(([_, load]) => load > avgLoad * 1.5);
    const underloaded = Array.from(nodeLoads.entries()).filter(([_, load]) => load < avgLoad * 0.5);
    
    if (overloaded.length > 0 && underloaded.length > 0) {
      logger.info('Rebalancing jobs across nodes...');
      // Move jobs from overloaded to underloaded nodes
      // Implementation depends on job execution system
    }
  }

  private async pauseNewJobs(): Promise<void> {
    logger.warn('Pausing new job intake due to critical resource alert');
    // Implementation to pause job intake
    this.config.maxConcurrentJobs = 0;
  }

  private async cleanupCompletedJobs(): Promise<void> {
    const now = new Date();
    const expiryTime = 60 * 60 * 1000; // 1 hour
    
    for (const [jobId, state] of this.activeJobs.entries()) {
      if (state.status === 'completed' || state.status === 'failed') {
        const age = now.getTime() - state.lastUpdate.getTime();
        if (age > expiryTime) {
          this.activeJobs.delete(jobId);
          logger.debug(`Cleaned up expired job ${jobId}`);
        }
      }
    }
  }

  public async getJobStatus(jobId: string): Promise<JobState | undefined> {
    return this.activeJobs.get(jobId);
  }

  public async getSystemMetrics(): Promise<SystemMetrics> {
    return await this.analyticsEngine.getMetrics();
  }

  public async getNodeStatus(): Promise<Map<string, WorkerNode>> {
    return await this.resourceManager.getNodes();
  }
}