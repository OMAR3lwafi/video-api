/**
 * Workflow Engine - Workflow Definition and Execution
 * Dynamic Video Content Generation Platform
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
  VideoJobRequest,
  AllocatedResources,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowResult,
  WorkflowTemplate,
  WorkflowStep,
  WorkflowState,
  ExecutionContext,
  WorkflowMetrics,
  RetryPolicy,
  RollbackStrategy,
  WorkflowTimeouts,
  ResourceUtilization,
  StepMetrics
} from '../types';

import { EventBus } from './EventBus';
import { ResilienceManager } from './ResilienceManager';

export class WorkflowEngine extends EventEmitter {
  private logger: Logger;
  private eventBus: EventBus;
  private resilienceManager: ResilienceManager;
  
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private activeWorkflows: Map<string, WorkflowExecution> = new Map();
  private workflowTemplates: Map<string, WorkflowTemplate> = new Map();
  private stepExecutors: Map<string, StepExecutor> = new Map();
  
  private isInitialized: boolean = false;

  constructor(
    logger: Logger,
    eventBus: EventBus,
    resilienceManager: ResilienceManager
  ) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
    this.resilienceManager = resilienceManager;
  }

  /**
   * Initialize the workflow engine
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Workflow Engine...');
      
      // Initialize workflow templates
      this.initializeWorkflowTemplates();
      
      // Initialize step executors
      this.initializeStepExecutors();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      this.isInitialized = true;
      this.logger.info('Workflow Engine initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Workflow Engine:', error);
      throw error;
    }
  }

  /**
   * Create a workflow from request and resources
   */
  async createWorkflow(request: VideoJobRequest, resources: AllocatedResources): Promise<WorkflowExecution> {
    if (!this.isInitialized) {
      throw new Error('Workflow Engine not initialized');
    }

    const workflowId = this.generateWorkflowId();
    
    try {
      // Select appropriate workflow template
      const template = this.selectWorkflowTemplate(request);
      
      // Create workflow definition
      const workflow: WorkflowDefinition = {
        id: workflowId,
        template: template.name,
        steps: this.generateWorkflowSteps(template, request, resources),
        dependencies: template.dependencies,
        timeouts: this.generateTimeouts(template),
        retryPolicies: [template.retryPolicy],
        rollbackStrategies: this.generateRollbackStrategies(template),
        metadata: {
          jobId: request.id,
          priority: request.priority || 'normal',
          createdAt: new Date().toISOString()
        }
      };

      // Create workflow execution context
      const execution: WorkflowExecution = {
        definition: workflow,
        state: 'initialized',
        currentStep: 0,
        startTime: new Date(),
        context: this.createExecutionContext(request, resources),
        metrics: this.initializeMetrics()
      };

      // Store workflow and execution
      this.workflows.set(workflowId, workflow);
      this.activeWorkflows.set(workflowId, execution);
      
      this.logger.info(`Workflow ${workflowId} created using template ${template.name}`);
      
      // Emit workflow created event
      await this.eventBus.publish({
        id: uuidv4(),
        type: 'workflow:created',
        source: 'workflow_engine',
        timestamp: new Date(),
        data: { workflowId, template: template.name, jobId: request.id },
        correlationId: workflowId
      });

      return execution;

    } catch (error) {
      this.logger.error(`Failed to create workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string): Promise<WorkflowResult> {
    const execution = this.activeWorkflows.get(workflowId);
    if (!execution) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    this.logger.info(`Starting execution of workflow ${workflowId}`);
    
    execution.state = 'running';
    const startTime = Date.now();
    
    try {
      // Emit workflow started event
      await this.eventBus.publish({
        id: uuidv4(),
        type: 'workflow:started',
        source: 'workflow_engine',
        timestamp: new Date(),
        data: { workflowId, jobId: execution.context.jobRequest.id },
        correlationId: workflowId
      });

      // Execute workflow steps
      for (let i = 0; i < execution.definition.steps.length; i++) {
        const step = execution.definition.steps[i];
        execution.currentStep = i;
        
        this.logger.debug(`Executing step ${i + 1}/${execution.definition.steps.length}: ${step.name}`);
        
        try {
          await this.executeWorkflowStep(execution, step);
          
          // Update step metrics
          const stepMetrics = execution.metrics.stepDurations.get(step.name) || 0;
          execution.metrics.stepDurations.set(step.name, stepMetrics);
          
        } catch (stepError) {
          this.logger.error(`Step ${step.name} failed:`, stepError);
          
          // Handle step failure
          const shouldContinue = await this.handleStepFailure(execution, step, stepError);
          if (!shouldContinue) {
            throw stepError;
          }
        }
      }
      
      // Workflow completed successfully
      execution.state = 'completed';
      execution.endTime = new Date();
      
      const totalDuration = Date.now() - startTime;
      execution.metrics.totalDuration = totalDuration;
      
      this.logger.info(`Workflow ${workflowId} completed successfully in ${totalDuration}ms`);
      
      // Emit workflow completed event
      await this.eventBus.publish({
        id: uuidv4(),
        type: 'workflow:completed',
        source: 'workflow_engine',
        timestamp: new Date(),
        data: { 
          workflowId, 
          jobId: execution.context.jobRequest.id,
          duration: totalDuration,
          result: execution.context.result
        },
        correlationId: workflowId
      });

      return {
        workflowId,
        state: 'completed',
        result: execution.context.result,
        duration: totalDuration,
        metrics: execution.metrics
      };
      
    } catch (error) {
      execution.state = 'failed';
      execution.error = error as Error;
      execution.endTime = new Date();
      
      const totalDuration = Date.now() - startTime;
      execution.metrics.totalDuration = totalDuration;
      execution.metrics.errorCount++;
      
      this.logger.error(`Workflow ${workflowId} failed after ${totalDuration}ms:`, error);
      
      // Handle workflow failure
      await this.handleWorkflowFailure(execution, error as Error);
      
      return {
        workflowId,
        state: 'failed',
        duration: totalDuration,
        metrics: execution.metrics,
        error: error as Error
      };
    } finally {
      // Cleanup workflow execution
      this.activeWorkflows.delete(workflowId);
    }
  }

  /**
   * Initialize workflow templates
   */
  private initializeWorkflowTemplates(): void {
    // Quick Sync Processing Template
    this.workflowTemplates.set('quick_sync', {
      name: 'quick_sync',
      description: 'Fast synchronous processing for simple jobs',
      steps: [
        { name: 'validate_request', type: 'validation', timeout: 5000, critical: true },
        { name: 'allocate_resources', type: 'resource_allocation', timeout: 2000, critical: true },
        { name: 'download_media', type: 'media_download', timeout: 15000, critical: true },
        { name: 'process_video', type: 'video_processing', timeout: 25000, critical: true },
        { name: 'upload_result', type: 's3_upload', timeout: 10000, critical: true },
        { name: 'update_database', type: 'database_update', timeout: 2000, critical: false },
        { name: 'cleanup_resources', type: 'cleanup', timeout: 3000, critical: false }
      ],
      maxDuration: 60000, // 60 seconds
      retryPolicy: { maxRetries: 1, backoffMs: 1000, jitter: true },
      dependencies: ['ffmpeg', 's3', 'database'],
      resourceProfile: {
        minCpu: 1,
        maxCpu: 4,
        minMemory: 1,
        maxMemory: 8,
        requiresGpu: false,
        networkIntensive: true,
        storageIntensive: false
      },
      suitableFor: ['simple']
    });

    // Balanced Async Processing Template
    this.workflowTemplates.set('balanced_async', {
      name: 'balanced_async',
      description: 'Balanced asynchronous processing for moderate jobs',
      steps: [
        { name: 'validate_request', type: 'validation', timeout: 10000, critical: true },
        { name: 'create_job_record', type: 'database_insert', timeout: 5000, critical: true },
        { name: 'queue_job', type: 'queue_operation', timeout: 3000, critical: false },
        { name: 'allocate_resources', type: 'resource_allocation', timeout: 10000, critical: true },
        { name: 'download_media', type: 'media_download', timeout: 60000, critical: true },
        { name: 'process_video', type: 'video_processing', timeout: 300000, critical: true },
        { name: 'upload_result', type: 's3_upload', timeout: 60000, critical: true },
        { name: 'update_job_status', type: 'database_update', timeout: 5000, critical: false },
        { name: 'send_notifications', type: 'notification', timeout: 10000, critical: false },
        { name: 'cleanup_resources', type: 'cleanup', timeout: 15000, critical: false }
      ],
      maxDuration: 600000, // 10 minutes
      retryPolicy: { maxRetries: 3, backoffMs: 5000, backoffMultiplier: 2, maxBackoffMs: 30000, jitter: true },
      dependencies: ['ffmpeg', 's3', 'database', 'redis', 'notification_service'],
      resourceProfile: {
        minCpu: 2,
        maxCpu: 8,
        minMemory: 2,
        maxMemory: 16,
        requiresGpu: false,
        networkIntensive: true,
        storageIntensive: true
      },
      suitableFor: ['simple', 'moderate']
    });

    // Resource Intensive Processing Template
    this.workflowTemplates.set('resource_intensive', {
      name: 'resource_intensive',
      description: 'Resource-intensive processing for complex jobs',
      steps: [
        { name: 'validate_request', type: 'validation', timeout: 15000, critical: true },
        { name: 'create_job_record', type: 'database_insert', timeout: 5000, critical: true },
        { name: 'analyze_complexity', type: 'analysis', timeout: 30000, critical: true },
        { name: 'allocate_high_resources', type: 'resource_allocation', timeout: 20000, critical: true },
        { name: 'optimize_media', type: 'media_download', timeout: 120000, critical: true },
        { name: 'intensive_processing', type: 'video_processing', timeout: 900000, critical: true },
        { name: 'quality_check', type: 'validation', timeout: 30000, critical: false },
        { name: 'upload_result', type: 's3_upload', timeout: 120000, critical: true },
        { name: 'update_job_completion', type: 'database_update', timeout: 10000, critical: false },
        { name: 'cleanup_resources', type: 'cleanup', timeout: 30000, critical: false }
      ],
      maxDuration: 1800000, // 30 minutes
      retryPolicy: { maxRetries: 2, backoffMs: 10000, backoffMultiplier: 2, maxBackoffMs: 60000, jitter: true },
      dependencies: ['ffmpeg', 'gpu_ffmpeg', 's3', 'database', 'redis'],
      resourceProfile: {
        minCpu: 4,
        maxCpu: 16,
        minMemory: 8,
        maxMemory: 32,
        requiresGpu: true,
        networkIntensive: true,
        storageIntensive: true
      },
      suitableFor: ['complex']
    });

    // Distributed Processing Template
    this.workflowTemplates.set('distributed', {
      name: 'distributed',
      description: 'Distributed processing for enterprise jobs',
      steps: [
        { name: 'validate_request', type: 'validation', timeout: 15000, critical: true },
        { name: 'create_job_record', type: 'database_insert', timeout: 5000, critical: true },
        { name: 'analyze_complexity', type: 'analysis', timeout: 30000, critical: true },
        { name: 'partition_workload', type: 'workload_partitioning', timeout: 20000, critical: true },
        { name: 'allocate_cluster_resources', type: 'cluster_allocation', timeout: 30000, critical: true },
        { name: 'parallel_media_download', type: 'parallel_download', timeout: 120000, critical: true },
        { name: 'distributed_processing', type: 'distributed_video_processing', timeout: 1800000, critical: true },
        { name: 'merge_results', type: 'result_merging', timeout: 60000, critical: true },
        { name: 'upload_final_result', type: 's3_upload', timeout: 120000, critical: true },
        { name: 'update_job_completion', type: 'database_update', timeout: 10000, critical: false },
        { name: 'cleanup_cluster', type: 'cluster_cleanup', timeout: 30000, critical: false }
      ],
      maxDuration: 3600000, // 60 minutes
      retryPolicy: { maxRetries: 2, backoffMs: 30000, backoffMultiplier: 1.5, maxBackoffMs: 120000, jitter: true },
      dependencies: ['kubernetes', 'distributed_ffmpeg', 's3', 'database', 'redis'],
      resourceProfile: {
        minCpu: 8,
        maxCpu: 64,
        minMemory: 16,
        maxMemory: 128,
        requiresGpu: true,
        networkIntensive: true,
        storageIntensive: true
      },
      suitableFor: ['enterprise']
    });

    this.logger.info(`Initialized ${this.workflowTemplates.size} workflow templates`);
  }

  /**
   * Initialize step executors
   */
  private initializeStepExecutors(): void {
    // Validation executor
    this.stepExecutors.set('validation', async (execution, step) => {
      this.logger.debug(`Validating request for workflow ${execution.definition.id}`);
      
      const request = execution.context.jobRequest;
      
      // Validate basic request structure
      if (!request.id || !request.elements || request.elements.length === 0) {
        throw new Error('Invalid request: missing required fields');
      }
      
      // Validate elements
      for (const element of request.elements) {
        if (!element.id || !element.type || !element.source) {
          throw new Error(`Invalid element: ${element.id}`);
        }
      }
      
      execution.context.stepResults.set(step.name, { validated: true });
      return { success: true, message: 'Request validated successfully' };
    });

    // Resource allocation executor
    this.stepExecutors.set('resource_allocation', async (execution, step) => {
      this.logger.debug(`Allocating resources for workflow ${execution.definition.id}`);
      
      // Simulate resource allocation
      await this.sleep(100);
      
      execution.context.stepResults.set(step.name, { 
        allocated: true,
        resources: execution.context.allocatedResources
      });
      
      return { success: true, message: 'Resources allocated successfully' };
    });

    // Media download executor
    this.stepExecutors.set('media_download', async (execution, step) => {
      this.logger.debug(`Downloading media for workflow ${execution.definition.id}`);
      
      const request = execution.context.jobRequest;
      const downloadedFiles: string[] = [];
      
      // Simulate media download
      for (const element of request.elements) {
        await this.sleep(200); // Simulate download time
        downloadedFiles.push(`/tmp/${element.id}_${Date.now()}`);
      }
      
      execution.context.stepResults.set(step.name, { 
        downloadedFiles,
        totalSize: downloadedFiles.length * 1024 * 1024 // Simulate file sizes
      });
      
      return { success: true, message: `Downloaded ${downloadedFiles.length} files` };
    });

    // Video processing executor
    this.stepExecutors.set('video_processing', async (execution, step) => {
      this.logger.debug(`Processing video for workflow ${execution.definition.id}`);
      
      const request = execution.context.jobRequest;
      const processingTime = Math.max(1000, request.elements.length * 500); // Simulate processing time
      
      await this.sleep(processingTime);
      
      const outputFile = `/tmp/output_${execution.definition.id}_${Date.now()}.${request.output_format}`;
      
      execution.context.stepResults.set(step.name, { 
        outputFile,
        processingTime,
        format: request.output_format,
        resolution: `${request.width}x${request.height}`
      });
      
      return { success: true, message: 'Video processed successfully', outputFile };
    });

    // S3 upload executor
    this.stepExecutors.set('s3_upload', async (execution, step) => {
      this.logger.debug(`Uploading result to S3 for workflow ${execution.definition.id}`);
      
      const processingResult = execution.context.stepResults.get('process_video') || 
                              execution.context.stepResults.get('intensive_processing') ||
                              execution.context.stepResults.get('distributed_processing');
      
      if (!processingResult?.outputFile) {
        throw new Error('No output file to upload');
      }
      
      // Simulate S3 upload
      await this.sleep(500);
      
      const s3Url = `https://video-platform-results.s3.amazonaws.com/${execution.definition.id}/${Date.now()}.${execution.context.jobRequest.output_format}`;
      
      execution.context.stepResults.set(step.name, { 
        s3Url,
        uploadTime: 500,
        fileSize: 1024 * 1024 * 10 // 10MB
      });
      
      // Set final result
      execution.context.result = {
        status: 'completed',
        result_url: s3Url,
        file_size: '10MB',
        processing_time: execution.metrics.totalDuration || 0
      };
      
      return { success: true, message: 'File uploaded to S3', s3Url };
    });

    // Database update executor
    this.stepExecutors.set('database_update', async (execution, step) => {
      this.logger.debug(`Updating database for workflow ${execution.definition.id}`);
      
      // Simulate database update
      await this.sleep(100);
      
      execution.context.stepResults.set(step.name, { 
        updated: true,
        timestamp: new Date().toISOString()
      });
      
      return { success: true, message: 'Database updated successfully' };
    });

    // Cleanup executor
    this.stepExecutors.set('cleanup', async (execution, step) => {
      this.logger.debug(`Cleaning up resources for workflow ${execution.definition.id}`);
      
      // Simulate cleanup
      await this.sleep(200);
      
      execution.context.stepResults.set(step.name, { 
        cleaned: true,
        filesRemoved: 3,
        resourcesReleased: true
      });
      
      return { success: true, message: 'Cleanup completed successfully' };
    });

    this.logger.info(`Initialized ${this.stepExecutors.size} step executors`);
  }

  /**
   * Select appropriate workflow template
   */
  private selectWorkflowTemplate(request: VideoJobRequest): WorkflowTemplate {
    // Determine complexity
    const elementCount = request.elements.length;
    const pixelCount = request.width * request.height;
    const hasVideo = request.elements.some(e => e.type === 'video');
    
    // Simple jobs
    if (elementCount <= 2 && pixelCount <= 1920 * 1080 && !hasVideo) {
      return this.workflowTemplates.get('quick_sync')!;
    }
    
    // Moderate jobs
    if (elementCount <= 5 && pixelCount <= 2560 * 1440) {
      return this.workflowTemplates.get('balanced_async')!;
    }
    
    // Complex jobs
    if (elementCount <= 10 && pixelCount <= 3840 * 2160) {
      return this.workflowTemplates.get('resource_intensive')!;
    }
    
    // Enterprise jobs
    return this.workflowTemplates.get('distributed')!;
  }

  /**
   * Generate workflow steps from template
   */
  private generateWorkflowSteps(
    template: WorkflowTemplate, 
    request: VideoJobRequest, 
    resources: AllocatedResources
  ): WorkflowStep[] {
    return template.steps.map(step => ({
      ...step,
      retryPolicy: step.retryPolicy || template.retryPolicy,
      rollback: {
        type: 'cleanup_resources',
        target: step.name,
        parameters: { workflowId: request.id }
      }
    }));
  }

  /**
   * Generate timeouts configuration
   */
  private generateTimeouts(template: WorkflowTemplate): WorkflowTimeouts {
    return {
      total: template.maxDuration,
      step: Math.max(...template.steps.map(s => s.timeout)),
      idle: 30000, // 30 seconds
      heartbeat: 5000 // 5 seconds
    };
  }

  /**
   * Generate rollback strategies
   */
  private generateRollbackStrategies(template: WorkflowTemplate): RollbackStrategy[] {
    return [
      {
        trigger: 'step_failure',
        actions: [
          { type: 'cleanup_resources', target: 'allocated_resources' },
          { type: 'delete_files', target: 'temp_files' },
          { type: 'update_database', target: 'job_status' }
        ]
      },
      {
        trigger: 'timeout',
        actions: [
          { type: 'cleanup_resources', target: 'all_resources' },
          { type: 'send_notification', target: 'timeout_notification' }
        ]
      }
    ];
  }

  /**
   * Create execution context
   */
  private createExecutionContext(request: VideoJobRequest, resources: AllocatedResources): ExecutionContext {
    return {
      jobRequest: request,
      allocatedResources: resources,
      stepResults: new Map(),
      variables: new Map(),
      artifacts: []
    };
  }

  /**
   * Initialize workflow metrics
   */
  private initializeMetrics(): WorkflowMetrics {
    return {
      stepDurations: new Map(),
      resourceUtilization: {
        cpu: 0,
        memory: 0,
        storage: 0,
        network: 0
      },
      errorCount: 0,
      retryCount: 0
    };
  }

  /**
   * Execute a workflow step
   */
  private async executeWorkflowStep(execution: WorkflowExecution, step: WorkflowStep): Promise<any> {
    const stepStartTime = Date.now();
    
    try {
      // Emit step started event
      await this.eventBus.publish({
        id: uuidv4(),
        type: 'workflow:step_started',
        source: 'workflow_engine',
        timestamp: new Date(),
        data: { 
          workflowId: execution.definition.id,
          stepName: step.name,
          stepType: step.type
        },
        correlationId: execution.definition.id
      });

      // Get step executor
      const executor = this.stepExecutors.get(step.type);
      if (!executor) {
        throw new Error(`No executor found for step type: ${step.type}`);
      }

      // Execute step with timeout
      const result = await Promise.race([
        executor(execution, step),
        this.createTimeoutPromise(step.timeout, `Step ${step.name} timed out`)
      ]);

      const stepDuration = Date.now() - stepStartTime;
      execution.metrics.stepDurations.set(step.name, stepDuration);

      // Emit step completed event
      await this.eventBus.publish({
        id: uuidv4(),
        type: 'workflow:step_completed',
        source: 'workflow_engine',
        timestamp: new Date(),
        data: { 
          workflowId: execution.definition.id,
          stepName: step.name,
          duration: stepDuration,
          result
        },
        correlationId: execution.definition.id
      });

      this.logger.debug(`Step ${step.name} completed in ${stepDuration}ms`);
      return result;

    } catch (error) {
      const stepDuration = Date.now() - stepStartTime;
      execution.metrics.stepDurations.set(step.name, stepDuration);
      execution.metrics.errorCount++;

      // Emit step failed event
      await this.eventBus.publish({
        id: uuidv4(),
        type: 'workflow:step_failed',
        source: 'workflow_engine',
        timestamp: new Date(),
        data: { 
          workflowId: execution.definition.id,
          stepName: step.name,
          duration: stepDuration,
          error: error.message
        },
        correlationId: execution.definition.id
      });

      throw error;
    }
  }

  /**
   * Handle step failure
   */
  private async handleStepFailure(
    execution: WorkflowExecution, 
    step: WorkflowStep, 
    error: Error
  ): Promise<boolean> {
    this.logger.warn(`Step ${step.name} failed:`, error.message);

    // Check if step is critical
    if (step.critical) {
      this.logger.error(`Critical step ${step.name} failed, aborting workflow`);
      return false;
    }

    // Check retry policy
    const retryPolicy = step.retryPolicy || execution.definition.retryPolicies[0];
    if (retryPolicy && execution.metrics.retryCount < retryPolicy.maxRetries) {
      this.logger.info(`Retrying step ${step.name} (attempt ${execution.metrics.retryCount + 1}/${retryPolicy.maxRetries})`);
      
      // Wait for backoff period
      const backoffMs = this.calculateBackoff(retryPolicy, execution.metrics.retryCount);
      await this.sleep(backoffMs);
      
      execution.metrics.retryCount++;
      
      try {
        await this.executeWorkflowStep(execution, step);
        return true;
      } catch (retryError) {
        this.logger.error(`Retry failed for step ${step.name}:`, retryError.message);
        return false;
      }
    }

    // Non-critical step failed, continue workflow
    this.logger.warn(`Non-critical step ${step.name} failed, continuing workflow`);
    return true;
  }

  /**
   * Handle workflow failure
   */
  private async handleWorkflowFailure(execution: WorkflowExecution, error: Error): Promise<void> {
    try {
      // Execute rollback strategies
      for (const strategy of execution.definition.rollbackStrategies) {
        if (this.shouldExecuteRollback(strategy, error)) {
          await this.executeRollback(execution, strategy);
        }
      }

      // Emit workflow failed event
      await this.eventBus.publish({
        id: uuidv4(),
        type: 'workflow:failed',
        source: 'workflow_engine',
        timestamp: new Date(),
        data: { 
          workflowId: execution.definition.id,
          jobId: execution.context.jobRequest.id,
          error: error.message,
          rollbackExecuted: execution.rollbackExecuted
        },
        correlationId: execution.definition.id
      });

    } catch (rollbackError) {
      this.logger.error(`Rollback failed for workflow ${execution.definition.id}:`, rollbackError);
    }
  }

  /**
   * Check if rollback should be executed
   */
  private shouldExecuteRollback(strategy: RollbackStrategy, error: Error): boolean {
    switch (strategy.trigger) {
      case 'step_failure':
        return true;
      case 'timeout':
        return error.message.includes('timeout') || error.message.includes('timed out');
      case 'resource_exhaustion':
        return error.message.includes('resource') || error.message.includes('memory');
      default:
        return false;
    }
  }

  /**
   * Execute rollback strategy
   */
  private async executeRollback(execution: WorkflowExecution, strategy: RollbackStrategy): Promise<void> {
    this.logger.info(`Executing rollback strategy for workflow ${execution.definition.id}`);
    
    try {
      for (const action of strategy.actions) {
        await this.executeRollbackAction(execution, action);
      }
      
      execution.rollbackExecuted = true;
      
    } catch (error) {
      this.logger.error(`Rollback action failed:`, error);
    }
  }

  /**
   * Execute rollback action
   */
  private async executeRollbackAction(execution: WorkflowExecution, action: any): Promise<void> {
    this.logger.debug(`Executing rollback action: ${action.type}`);
    
    switch (action.type) {
      case 'cleanup_resources':
        // Simulate resource cleanup
        await this.sleep(100);
        break;
      case 'delete_files':
        // Simulate file deletion
        await this.sleep(50);
        break;
      case 'update_database':
        // Simulate database update
        await this.sleep(100);
        break;
      case 'send_notification':
        // Simulate notification sending
        await this.sleep(200);
        break;
    }
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoff(retryPolicy: RetryPolicy, attempt: number): number {
    let backoff = retryPolicy.backoffMs;
    
    if (retryPolicy.backoffMultiplier) {
      backoff *= Math.pow(retryPolicy.backoffMultiplier, attempt);
    }
    
    if (retryPolicy.maxBackoffMs) {
      backoff = Math.min(backoff, retryPolicy.maxBackoffMs);
    }
    
    if (retryPolicy.jitter) {
      backoff += Math.random() * 1000;
    }
    
    return backoff;
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeoutMs: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle resource events
    this.eventBus.subscribe('resource:allocated', async (event) => {
      this.logger.debug('Resource allocated for workflow:', event.data);
    });

    this.eventBus.subscribe('resource:released', async (event) => {
      this.logger.debug('Resource released from workflow:', event.data);
    });
  }

  /**
   * Generate unique workflow ID
   */
  private generateWorkflowId(): string {
    return `wf_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<any> {
    const execution = this.activeWorkflows.get(workflowId);
    if (!execution) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    return {
      workflowId,
      state: execution.state,
      currentStep: execution.currentStep,
      totalSteps: execution.definition.steps.length,
      startTime: execution.startTime,
      endTime: execution.endTime,
      metrics: execution.metrics,
      error: execution.error?.message
    };
  }

  /**
   * Shutdown workflow engine
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Workflow Engine...');
    
    try {
      // Cancel active workflows
      for (const [workflowId, execution] of this.activeWorkflows) {
        execution.state = 'cancelled';
        this.logger.info(`Cancelled workflow ${workflowId}`);
      }
      
      // Clear all data structures
      this.workflows.clear();
      this.activeWorkflows.clear();
      this.workflowTemplates.clear();
      this.stepExecutors.clear();
      
      this.isInitialized = false;
      this.logger.info('Workflow Engine shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during workflow engine shutdown:', error);
      throw error;
    }
  }
}

/**
 * Step executor function type
 */
type StepExecutor = (execution: WorkflowExecution, step: WorkflowStep) => Promise<any>;