// Workflow Engine - Manages workflow execution templates
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { EventBus } from '../events/EventBus';
import {
  WorkflowTemplate,
  WorkflowStep,
  StepType,
  RetryPolicy,
  JobAnalysis,
  EventType,
  ResourceRequirements
} from '../interfaces/orchestrator.interfaces';

export interface Workflow {
  id: string;
  name: string;
  template: WorkflowTemplate;
  steps: WorkflowStep[];
  parallelizable: boolean;
  timeout: number;
  description: string;
}

export interface WorkflowContext {
  jobId: string;
  request: any;
  node: any;
  resources: any;
  analysis: JobAnalysis;
  stepResults: Map<string, any>;
  startTime: Date;
}

export class WorkflowEngine extends EventEmitter {
  private workflows: Map<WorkflowTemplate, Workflow>;
  private activeWorkflows: Map<string, WorkflowContext>;
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    super();
    this.eventBus = eventBus;
    this.workflows = new Map();
    this.activeWorkflows = new Map();
    this.initializeWorkflows();
  }

  public async initialize(): Promise<void> {
    logger.info('Initializing Workflow Engine...');
    this.setupWorkflowHandlers();
  }

  private initializeWorkflows(): void {
    // Quick Sync Workflow - For simple, fast jobs
    this.workflows.set(WorkflowTemplate.QUICK_SYNC, {
      id: uuidv4(),
      name: 'Quick Sync Workflow',
      template: WorkflowTemplate.QUICK_SYNC,
      description: 'Synchronous processing for simple jobs under 30 seconds',
      parallelizable: false,
      timeout: 30000,
      steps: [
        {
          id: 'analyze',
          name: 'Analyze Input',
          type: StepType.ANALYZE,
          dependencies: [],
          timeout: 5000,
          retryPolicy: this.createRetryPolicy(2, 'exponential', 1000)
        },
        {
          id: 'download',
          name: 'Download Assets',
          type: StepType.DOWNLOAD,
          dependencies: ['analyze'],
          timeout: 10000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 2000)
        },
        {
          id: 'process',
          name: 'Process Video',
          type: StepType.PROCESS,
          dependencies: ['download'],
          timeout: 20000,
          retryPolicy: this.createRetryPolicy(2, 'exponential', 3000)
        },
        {
          id: 'upload',
          name: 'Upload Result',
          type: StepType.UPLOAD,
          dependencies: ['process'],
          timeout: 10000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 2000)
        }
      ]
    });

    // Balanced Async Workflow - For medium complexity jobs
    this.workflows.set(WorkflowTemplate.BALANCED_ASYNC, {
      id: uuidv4(),
      name: 'Balanced Async Workflow',
      template: WorkflowTemplate.BALANCED_ASYNC,
      description: 'Asynchronous processing with balanced resource allocation',
      parallelizable: true,
      timeout: 600000, // 10 minutes
      steps: [
        {
          id: 'analyze',
          name: 'Deep Analysis',
          type: StepType.ANALYZE,
          dependencies: [],
          timeout: 10000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 1000),
          resources: { cpu: 1, memory: 512, storage: 100, bandwidth: 50 }
        },
        {
          id: 'download_assets',
          name: 'Parallel Asset Download',
          type: StepType.DOWNLOAD,
          dependencies: ['analyze'],
          timeout: 30000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 2000),
          parallelizable: true,
          resources: { cpu: 1, memory: 256, storage: 500, bandwidth: 100 }
        },
        {
          id: 'process_chunks',
          name: 'Chunked Processing',
          type: StepType.PROCESS,
          dependencies: ['download_assets'],
          timeout: 300000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 5000),
          parallelizable: true,
          resources: { cpu: 4, memory: 2048, storage: 1000, bandwidth: 50 }
        },
        {
          id: 'encode',
          name: 'Encode Output',
          type: StepType.ENCODE,
          dependencies: ['process_chunks'],
          timeout: 120000,
          retryPolicy: this.createRetryPolicy(2, 'exponential', 3000),
          resources: { cpu: 2, memory: 1024, storage: 500, bandwidth: 50 }
        },
        {
          id: 'upload',
          name: 'Upload to S3',
          type: StepType.UPLOAD,
          dependencies: ['encode'],
          timeout: 60000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 2000),
          resources: { cpu: 1, memory: 256, storage: 100, bandwidth: 100 }
        },
        {
          id: 'notify',
          name: 'Send Notifications',
          type: StepType.NOTIFY,
          dependencies: ['upload'],
          timeout: 5000,
          retryPolicy: this.createRetryPolicy(3, 'linear', 1000)
        },
        {
          id: 'cleanup',
          name: 'Clean Temporary Files',
          type: StepType.CLEANUP,
          dependencies: ['notify'],
          timeout: 10000,
          retryPolicy: this.createRetryPolicy(2, 'fixed', 2000)
        }
      ]
    });

    // Distributed Workflow - For complex, resource-intensive jobs
    this.workflows.set(WorkflowTemplate.DISTRIBUTED, {
      id: uuidv4(),
      name: 'Distributed Processing Workflow',
      template: WorkflowTemplate.DISTRIBUTED,
      description: 'Distributed processing across multiple nodes for complex jobs',
      parallelizable: true,
      timeout: 1800000, // 30 minutes
      steps: [
        {
          id: 'analyze',
          name: 'Comprehensive Analysis',
          type: StepType.ANALYZE,
          dependencies: [],
          timeout: 15000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 2000),
          resources: { cpu: 2, memory: 1024, storage: 200, bandwidth: 50 }
        },
        {
          id: 'partition',
          name: 'Partition Job',
          type: StepType.ANALYZE,
          dependencies: ['analyze'],
          timeout: 10000,
          retryPolicy: this.createRetryPolicy(2, 'exponential', 1000),
          resources: { cpu: 1, memory: 512, storage: 100, bandwidth: 20 }
        },
        {
          id: 'download_distributed',
          name: 'Distributed Download',
          type: StepType.DOWNLOAD,
          dependencies: ['partition'],
          timeout: 60000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 3000),
          parallelizable: true,
          resources: { cpu: 2, memory: 512, storage: 1000, bandwidth: 200 }
        },
        {
          id: 'process_distributed',
          name: 'Distributed Processing',
          type: StepType.PROCESS,
          dependencies: ['download_distributed'],
          timeout: 900000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 10000),
          parallelizable: true,
          resources: { cpu: 8, memory: 4096, storage: 2000, bandwidth: 100 }
        },
        {
          id: 'merge_results',
          name: 'Merge Distributed Results',
          type: StepType.PROCESS,
          dependencies: ['process_distributed'],
          timeout: 120000,
          retryPolicy: this.createRetryPolicy(2, 'exponential', 5000),
          resources: { cpu: 2, memory: 2048, storage: 1000, bandwidth: 50 }
        },
        {
          id: 'encode_final',
          name: 'Final Encoding',
          type: StepType.ENCODE,
          dependencies: ['merge_results'],
          timeout: 180000,
          retryPolicy: this.createRetryPolicy(2, 'exponential', 5000),
          resources: { cpu: 4, memory: 2048, storage: 1000, bandwidth: 50 }
        },
        {
          id: 'upload_chunks',
          name: 'Chunked Upload',
          type: StepType.UPLOAD,
          dependencies: ['encode_final'],
          timeout: 120000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 3000),
          parallelizable: true,
          resources: { cpu: 2, memory: 512, storage: 500, bandwidth: 200 }
        },
        {
          id: 'verify_integrity',
          name: 'Verify Output Integrity',
          type: StepType.ANALYZE,
          dependencies: ['upload_chunks'],
          timeout: 30000,
          retryPolicy: this.createRetryPolicy(2, 'exponential', 2000),
          resources: { cpu: 1, memory: 256, storage: 100, bandwidth: 50 }
        },
        {
          id: 'notify_complete',
          name: 'Send Completion Notification',
          type: StepType.NOTIFY,
          dependencies: ['verify_integrity'],
          timeout: 5000,
          retryPolicy: this.createRetryPolicy(3, 'linear', 1000)
        },
        {
          id: 'cleanup_distributed',
          name: 'Distributed Cleanup',
          type: StepType.CLEANUP,
          dependencies: ['notify_complete'],
          timeout: 30000,
          retryPolicy: this.createRetryPolicy(2, 'fixed', 3000),
          parallelizable: true
        }
      ]
    });

    // High Performance Workflow - For GPU-accelerated processing
    this.workflows.set(WorkflowTemplate.HIGH_PERFORMANCE, {
      id: uuidv4(),
      name: 'High Performance GPU Workflow',
      template: WorkflowTemplate.HIGH_PERFORMANCE,
      description: 'GPU-accelerated processing for maximum performance',
      parallelizable: true,
      timeout: 600000,
      steps: [
        {
          id: 'gpu_init',
          name: 'Initialize GPU Context',
          type: StepType.ANALYZE,
          dependencies: [],
          timeout: 10000,
          retryPolicy: this.createRetryPolicy(2, 'exponential', 2000),
          resources: { cpu: 1, memory: 512, storage: 100, bandwidth: 20, gpu: 1 }
        },
        {
          id: 'download_gpu',
          name: 'High-Speed Download',
          type: StepType.DOWNLOAD,
          dependencies: ['gpu_init'],
          timeout: 30000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 2000),
          resources: { cpu: 2, memory: 1024, storage: 1000, bandwidth: 500 }
        },
        {
          id: 'gpu_process',
          name: 'GPU Processing',
          type: StepType.PROCESS,
          dependencies: ['download_gpu'],
          timeout: 180000,
          retryPolicy: this.createRetryPolicy(2, 'exponential', 5000),
          resources: { cpu: 4, memory: 4096, storage: 2000, bandwidth: 100, gpu: 2 }
        },
        {
          id: 'gpu_encode',
          name: 'Hardware Encoding',
          type: StepType.ENCODE,
          dependencies: ['gpu_process'],
          timeout: 60000,
          retryPolicy: this.createRetryPolicy(2, 'exponential', 3000),
          resources: { cpu: 2, memory: 2048, storage: 1000, bandwidth: 50, gpu: 1 }
        },
        {
          id: 'upload_hp',
          name: 'Upload Result',
          type: StepType.UPLOAD,
          dependencies: ['gpu_encode'],
          timeout: 60000,
          retryPolicy: this.createRetryPolicy(3, 'exponential', 2000),
          resources: { cpu: 1, memory: 512, storage: 500, bandwidth: 200 }
        }
      ]
    });

    // Economy Workflow - For cost-optimized processing
    this.workflows.set(WorkflowTemplate.ECONOMY, {
      id: uuidv4(),
      name: 'Economy Workflow',
      template: WorkflowTemplate.ECONOMY,
      description: 'Cost-optimized processing with lower resource usage',
      parallelizable: false,
      timeout: 1200000, // 20 minutes
      steps: [
        {
          id: 'analyze_eco',
          name: 'Basic Analysis',
          type: StepType.ANALYZE,
          dependencies: [],
          timeout: 10000,
          retryPolicy: this.createRetryPolicy(2, 'linear', 2000),
          resources: { cpu: 0.5, memory: 256, storage: 50, bandwidth: 20 }
        },
        {
          id: 'download_eco',
          name: 'Sequential Download',
          type: StepType.DOWNLOAD,
          dependencies: ['analyze_eco'],
          timeout: 60000,
          retryPolicy: this.createRetryPolicy(2, 'linear', 3000),
          resources: { cpu: 0.5, memory: 256, storage: 500, bandwidth: 50 }
        },
        {
          id: 'process_eco',
          name: 'Economy Processing',
          type: StepType.PROCESS,
          dependencies: ['download_eco'],
          timeout: 600000,
          retryPolicy: this.createRetryPolicy(2, 'linear', 5000),
          resources: { cpu: 1, memory: 512, storage: 500, bandwidth: 20 }
        },
        {
          id: 'encode_eco',
          name: 'Standard Encoding',
          type: StepType.ENCODE,
          dependencies: ['process_eco'],
          timeout: 300000,
          retryPolicy: this.createRetryPolicy(2, 'linear', 5000),
          resources: { cpu: 1, memory: 512, storage: 500, bandwidth: 20 }
        },
        {
          id: 'upload_eco',
          name: 'Economy Upload',
          type: StepType.UPLOAD,
          dependencies: ['encode_eco'],
          timeout: 120000,
          retryPolicy: this.createRetryPolicy(2, 'linear', 3000),
          resources: { cpu: 0.5, memory: 256, storage: 100, bandwidth: 50 }
        }
      ]
    });
  }

  private createRetryPolicy(
    maxAttempts: number,
    backoffType: 'exponential' | 'linear' | 'fixed',
    initialDelay: number
  ): RetryPolicy {
    return {
      maxAttempts,
      backoffType,
      initialDelay,
      maxDelay: initialDelay * 10,
      retryableErrors: ['TIMEOUT', 'CONNECTION_ERROR', 'RESOURCE_UNAVAILABLE']
    };
  }

  private setupWorkflowHandlers(): void {
    // Set up internal event handlers for workflow management
    this.on('step_completed', (workflowId: string, stepId: string, result: any) => {
      this.handleStepCompleted(workflowId, stepId, result);
    });

    this.on('step_failed', (workflowId: string, stepId: string, error: any) => {
      this.handleStepFailed(workflowId, stepId, error);
    });
  }

  public selectWorkflow(analysis: JobAnalysis): Workflow {
    const workflow = this.workflows.get(analysis.recommendedWorkflow);
    
    if (!workflow) {
      // Fallback to balanced async if recommended not found
      return this.workflows.get(WorkflowTemplate.BALANCED_ASYNC)!;
    }

    return workflow;
  }

  public async execute(workflow: Workflow, context: WorkflowContext): Promise<void> {
    const workflowId = uuidv4();
    context.startTime = new Date();
    context.stepResults = new Map();
    
    this.activeWorkflows.set(workflowId, context);

    logger.info(`Starting workflow ${workflow.name} for job ${context.jobId}`);
    
    // Emit workflow started event
    this.eventBus.emit(EventType.WORKFLOW_STARTED, {
      id: uuidv4(),
      type: EventType.WORKFLOW_STARTED,
      timestamp: new Date(),
      source: 'WorkflowEngine',
      data: {
        workflowId,
        jobId: context.jobId,
        workflow: workflow.name
      }
    });

    try {
      // Execute workflow steps
      if (workflow.parallelizable) {
        await this.executeParallelWorkflow(workflowId, workflow, context);
      } else {
        await this.executeSequentialWorkflow(workflowId, workflow, context);
      }

      // Emit workflow completed event
      this.eventBus.emit(EventType.WORKFLOW_COMPLETED, {
        id: uuidv4(),
        type: EventType.WORKFLOW_COMPLETED,
        timestamp: new Date(),
        source: 'WorkflowEngine',
        data: {
          workflowId,
          jobId: context.jobId,
          workflow: workflow.name,
          duration: Date.now() - context.startTime.getTime()
        }
      });

      logger.info(`Workflow ${workflow.name} completed for job ${context.jobId}`);
    } catch (error) {
      logger.error(`Workflow ${workflow.name} failed for job ${context.jobId}:`, error);
      
      // Emit workflow failed event
      this.eventBus.emit(EventType.JOB_FAILED, {
        id: uuidv4(),
        type: EventType.JOB_FAILED,
        timestamp: new Date(),
        source: 'WorkflowEngine',
        data: {
          workflowId,
          jobId: context.jobId,
          workflow: workflow.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    } finally {
      this.activeWorkflows.delete(workflowId);
    }
  }

  private async executeSequentialWorkflow(
    workflowId: string,
    workflow: Workflow,
    context: WorkflowContext
  ): Promise<void> {
    for (const step of workflow.steps) {
      await this.executeStep(workflowId, step, context);
    }
  }

  private async executeParallelWorkflow(
    workflowId: string,
    workflow: Workflow,
    context: WorkflowContext
  ): Promise<void> {
    const executionQueue: WorkflowStep[] = [...workflow.steps];
    const completed = new Set<string>();
    const executing = new Map<string, Promise<void>>();

    while (executionQueue.length > 0 || executing.size > 0) {
      // Find steps that can be executed
      const readySteps = executionQueue.filter(step =>
        step.dependencies.every(dep => completed.has(dep))
      );

      // Start execution of ready steps
      for (const step of readySteps) {
        if (!executing.has(step.id)) {
          const promise = this.executeStep(workflowId, step, context)
            .then(() => {
              completed.add(step.id);
              executing.delete(step.id);
              const index = executionQueue.indexOf(step);
              if (index > -1) {
                executionQueue.splice(index, 1);
              }
            })
            .catch(error => {
              executing.delete(step.id);
              throw error;
            });
          
          executing.set(step.id, promise);
        }
      }

      // Wait for at least one step to complete
      if (executing.size > 0) {
        await Promise.race(Array.from(executing.values()));
      }
    }
  }

  private async executeStep(
    workflowId: string,
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<void> {
    logger.info(`Executing step ${step.name} for job ${context.jobId}`);
    
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < step.retryPolicy.maxAttempts) {
      attempts++;
      
      try {
        // Execute step with timeout
        const result = await this.executeWithTimeout(
          () => this.performStep(step, context),
          step.timeout
        );

        // Store result
        context.stepResults.set(step.id, result);
        
        // Emit step completed
        this.emit('step_completed', workflowId, step.id, result);
        
        logger.info(`Step ${step.name} completed for job ${context.jobId}`);
        return;
        
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Step ${step.name} failed (attempt ${attempts}):`, error);
        
        if (attempts < step.retryPolicy.maxAttempts) {
          // Calculate retry delay
          const delay = this.calculateRetryDelay(
            attempts,
            step.retryPolicy
          );
          
          logger.info(`Retrying step ${step.name} in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    this.emit('step_failed', workflowId, step.id, lastError);
    throw new Error(`Step ${step.name} failed after ${attempts} attempts: ${lastError?.message}`);
  }

  private async performStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<any> {
    // This would be replaced with actual step execution logic
    // For now, simulating step execution
    switch (step.type) {
      case StepType.ANALYZE:
        return this.performAnalysis(context);
      case StepType.DOWNLOAD:
        return this.performDownload(context);
      case StepType.PROCESS:
        return this.performProcessing(context);
      case StepType.ENCODE:
        return this.performEncoding(context);
      case StepType.UPLOAD:
        return this.performUpload(context);
      case StepType.NOTIFY:
        return this.performNotification(context);
      case StepType.CLEANUP:
        return this.performCleanup(context);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async performAnalysis(context: WorkflowContext): Promise<any> {
    logger.debug(`Analyzing job ${context.jobId}`);
    // Implement actual analysis logic
    return { analyzed: true, elements: context.request.elements.length };
  }

  private async performDownload(context: WorkflowContext): Promise<any> {
    logger.debug(`Downloading assets for job ${context.jobId}`);
    // Implement actual download logic
    return { downloaded: true, files: context.request.elements.map((e: any) => e.source) };
  }

  private async performProcessing(context: WorkflowContext): Promise<any> {
    logger.debug(`Processing video for job ${context.jobId}`);
    // Implement actual processing logic
    return { processed: true, outputPath: `/tmp/${context.jobId}.mp4` };
  }

  private async performEncoding(context: WorkflowContext): Promise<any> {
    logger.debug(`Encoding video for job ${context.jobId}`);
    // Implement actual encoding logic
    return { encoded: true, format: context.request.output_format };
  }

  private async performUpload(context: WorkflowContext): Promise<any> {
    logger.debug(`Uploading result for job ${context.jobId}`);
    // Implement actual upload logic
    return { uploaded: true, url: `https://s3.amazonaws.com/videos/${context.jobId}.mp4` };
  }

  private async performNotification(context: WorkflowContext): Promise<any> {
    logger.debug(`Sending notification for job ${context.jobId}`);
    // Implement actual notification logic
    return { notified: true };
  }

  private async performCleanup(context: WorkflowContext): Promise<any> {
    logger.debug(`Cleaning up for job ${context.jobId}`);
    // Implement actual cleanup logic
    return { cleaned: true };
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
  }

  private calculateRetryDelay(
    attempt: number,
    policy: RetryPolicy
  ): number {
    let delay: number;
    
    switch (policy.backoffType) {
      case 'exponential':
        delay = policy.initialDelay * Math.pow(2, attempt - 1);
        break;
      case 'linear':
        delay = policy.initialDelay * attempt;
        break;
      case 'fixed':
        delay = policy.initialDelay;
        break;
      default:
        delay = policy.initialDelay;
    }

    return Math.min(delay, policy.maxDelay);
  }

  private handleStepCompleted(workflowId: string, stepId: string, result: any): void {
    const context = this.activeWorkflows.get(workflowId);
    if (context) {
      logger.debug(`Step ${stepId} completed for workflow ${workflowId}`);
    }
  }

  private handleStepFailed(workflowId: string, stepId: string, error: any): void {
    const context = this.activeWorkflows.get(workflowId);
    if (context) {
      logger.error(`Step ${stepId} failed for workflow ${workflowId}:`, error);
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getWorkflowTemplates(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  public getActiveWorkflows(): Map<string, WorkflowContext> {
    return this.activeWorkflows;
  }
}