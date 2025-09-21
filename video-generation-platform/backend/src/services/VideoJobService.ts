/**
 * Video Job Service
 * High-level service for video job management with database integration
 */

import { DatabaseService } from './DatabaseService';
import { logger } from '@/utils/logger';
import {
  DatabaseJob,
  DatabaseElement,
  JobStatus,
  ProcessingStep,
  CreateJobParams,
  UpdateJobStatusParams,
  UpdateJobProgressParams,
  AddJobElementParams,
  StartProcessingStepParams,
  CompleteProcessingStepParams,
  LogStorageOperationParams,
  JobFilterOptions,
  PaginationOptions,
  DatabaseOperationResult
} from '@/types/database';
import { VideoCreateRequest, JobStatusResponse } from '@/types/api';

export interface VideoJobCreateParams {
  request: VideoCreateRequest;
  estimated_duration?: number | undefined;
  client_ip?: string | undefined;
  user_agent?: string | undefined;
  response_type?: 'immediate' | 'async' | undefined;
}

export interface VideoJobResult {
  job: DatabaseJob;
  elements: DatabaseElement[];
}

/**
 * Video Job Service for managing video processing jobs
 */
export class VideoJobService {
  
  /**
   * Create a new video job with elements
   */
  static async createVideoJob(params: VideoJobCreateParams): Promise<DatabaseOperationResult<VideoJobResult>> {
    const startTime = Date.now();

    try {
      // Create the job
      const jobResult = await DatabaseService.createJob({
        output_format: params.request.output_format,
        width: params.request.width,
        height: params.request.height,
        estimated_duration: params.estimated_duration,
        client_ip: params.client_ip,
        user_agent: params.user_agent,
        request_metadata: {
          response_type: params.response_type,
          element_count: params.request.elements.length,
          total_elements: params.request.elements.length
        }
      });

      if (!jobResult.success || !jobResult.data) {
        return {
          success: false,
          error: jobResult.error || 'Failed to create job',
          duration_ms: Date.now() - startTime
        };
      }

      const job = jobResult.data;
      const elements: DatabaseElement[] = [];

      // Add elements to the job
      for (let i = 0; i < params.request.elements.length; i++) {
        const element = params.request.elements[i];
        if (!element) continue;
        
        const elementResult = await DatabaseService.addJobElement({
          job_id: job.id,
          type: element.type as any,
          source_url: element.source,
          element_order: i,
          track: element.track,
          x_position: element.x || '0%',
          y_position: element.y || '0%',
          width: element.width || '100%',
          height: element.height || '100%',
          fit_mode: element.fit_mode as any || 'auto',
          start_time: 0,
          metadata: {
            original_element_id: element.id,
            fit_mode: element.fit_mode
          }
        });

        if (!elementResult.success) {
          logger.error('Failed to add element to job', {
            job_id: job.id,
            element_order: i,
            error: elementResult.error
          });
          // Continue with other elements rather than failing the entire job
        } else {
          // Fetch the created element
          const elementsResult = await DatabaseService.getJobElements(job.id);
          
          if (elementsResult.success && elementsResult.data) {
            const createdElement = elementsResult.data.find(e => e.element_order === i);
            if (createdElement) {
              elements.push(createdElement);
            }
          }
        }
      }

      logger.info('Video job created successfully', {
        job_id: job.id,
        elements_count: elements.length,
        duration_ms: Date.now() - startTime
      });

      return {
        success: true,
        data: { job, elements },
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to create video job', {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      };
    }
  }

  /**
   * Get complete video job with elements
   */
  static async getVideoJob(jobId: string): Promise<DatabaseOperationResult<VideoJobResult>> {
    const startTime = Date.now();

    try {
      // Get job and elements in parallel
      const [jobResult, elementsResult] = await Promise.all([
        DatabaseService.getJob(jobId),
        DatabaseService.getJobElements(jobId)
      ]);

      if (!jobResult.success || !jobResult.data) {
        return {
          success: false,
          error: jobResult.error || 'Job not found',
          duration_ms: Date.now() - startTime
        };
      }

      if (!elementsResult.success) {
        logger.warn('Failed to get job elements', {
          job_id: jobId,
          error: elementsResult.error
        });
      }

      return {
        success: true,
        data: {
          job: jobResult.data,
          elements: elementsResult.data || []
        },
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get video job', {
        job_id: jobId,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      };
    }
  }

  /**
   * Update job status with automatic timeline tracking
   */
  static async updateJobStatus(
    jobId: string,
    status: JobStatus,
    errorMessage?: string,
    errorCode?: string
  ): Promise<DatabaseOperationResult<boolean>> {
    const startTime = Date.now();

    try {
      // Update job status
      const result = await DatabaseService.updateJobStatus({
        job_id: jobId,
        status,
        error_message: errorMessage || undefined,
        error_code: errorCode || undefined
      });

      if (result.success) {
        // Log status change metric
        await DatabaseService.recordSystemMetric({
          metric_name: 'job_status_change',
          metric_type: 'counter',
          value: 1,
          labels: {
            job_id: jobId,
            new_status: status,
            has_error: !!errorMessage
          }
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to update job status', {
        job_id: jobId,
        status,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      };
    }
  }

  /**
   * Start a processing step with timeline tracking
   */
  static async startProcessingStep(
    jobId: string,
    step: ProcessingStep,
    stepOrder: number,
    details?: Record<string, any>
  ): Promise<DatabaseOperationResult<string>> {
    const result = await DatabaseService.startProcessingStep({
      job_id: jobId,
      step,
      step_order: stepOrder,
      details: details || undefined
    });

    if (result.success) {
      // Record processing step metric
      await DatabaseService.recordSystemMetric({
        metric_name: 'processing_step_started',
        metric_type: 'counter',
        value: 1,
        labels: {
          job_id: jobId,
          step: step,
          step_order: stepOrder
        }
      });
    }

    return result;
  }

  /**
   * Complete a processing step with timeline tracking
   */
  static async completeProcessingStep(
    timelineId: string,
    success: boolean,
    progress?: number,
    details?: Record<string, any>,
    errorMessage?: string,
    resourceUsage?: { cpu?: number; memory?: number }
  ): Promise<DatabaseOperationResult<boolean>> {
    const result = await DatabaseService.completeProcessingStep({
      timeline_id: timelineId,
      success,
      progress: progress || undefined,
      details: details || undefined,
      error_message: errorMessage || undefined,
      cpu_usage: resourceUsage?.cpu || undefined,
      memory_usage: resourceUsage?.memory || undefined
    });

    if (result.success) {
      // Record processing step completion metric
      await DatabaseService.recordSystemMetric({
        metric_name: 'processing_step_completed',
        metric_type: 'counter',
        value: 1,
        labels: {
          timeline_id: timelineId,
          success: success.toString(),
          has_error: !!errorMessage
        }
      });
    }

    return result;
  }

  /**
   * Update element processing status
   */
  static async updateElementStatus(
    elementId: string,
    updates: {
      downloaded?: boolean;
      processed?: boolean;
      local_path?: string;
      processed_path?: string;
      error_message?: string;
      source_size?: number;
      source_duration?: number;
    }
  ): Promise<DatabaseOperationResult<boolean>> {
    return DatabaseService.updateElementStatus({
      element_id: elementId,
      ...updates
    });
  }

  /**
   * Log storage operation for job
   */
  static async logStorageOperation(
    jobId: string,
    operation: 'upload' | 'download' | 'delete' | 'access',
    bucket: string,
    key: string,
    success: boolean,
    details?: {
      file_size?: number;
      duration_ms?: number;
      error_message?: string;
      region?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<DatabaseOperationResult<string>> {
    return DatabaseService.logStorageOperation({
      job_id: jobId,
      operation: operation as any,
      bucket,
      key,
      region: details?.region || undefined,
      success,
      file_size: details?.file_size || undefined,
      duration_ms: details?.duration_ms || undefined,
      error_message: details?.error_message || undefined,
      metadata: details?.metadata || undefined
    });
  }

  /**
   * Convert database job to API response format
   */
  static toJobStatusResponse(job: DatabaseJob): JobStatusResponse {
    const apiStatus = job.status === 'pending' || job.status === 'processing' 
      ? 'processing' 
      : job.status === 'completed' 
      ? 'completed' 
      : 'failed';

    return {
      status: apiStatus,
      job_id: job.id,
      progress: `${job.progress_percentage}%`,
      current_step: job.current_step,
      message: job.status === 'completed'
        ? 'Video processing completed successfully'
        : job.status === 'failed'
        ? (job.error_message || 'Video processing failed')
        : job.status === 'cancelled'
        ? 'Job cancelled'
        : 'Video processing in progress',
      result_url: job.result_url,
      file_size: job.file_size ? `${Math.round(job.file_size / 1024)}KB` : undefined,
      duration: job.actual_duration ? `${job.actual_duration}s` : undefined,
      processing_time: job.actual_duration ? `${job.actual_duration}s` : undefined,
      error: job.status === 'failed' ? job.error_message : undefined
    };
  }

  /**
   * List video jobs with filtering
   */
  static async listVideoJobs(
    filters: JobFilterOptions = {},
    pagination: PaginationOptions = {}
  ): Promise<DatabaseOperationResult<DatabaseJob[]>> {
    return DatabaseService.listJobs(filters, pagination);
  }

  /**
   * Get job processing timeline
   */
  static async getJobTimeline(jobId: string) {
    return DatabaseService.getProcessingTimeline(jobId);
  }

  /**
   * Subscribe to job status changes
   */
  static subscribeToJobUpdates(
    jobId: string,
    callback: (job: DatabaseJob) => void
  ): string {
    return DatabaseService.subscribeToJobStatusChanges((notification) => {
      // Fetch updated job data and call callback
      DatabaseService.getJob(notification.job_id, false)
        .then(result => {
          if (result.success && result.data) {
            callback(result.data);
          }
        })
        .catch(error => {
          logger.error('Error fetching job for subscription callback', {
            job_id: notification.job_id,
            error
          });
        });
    }, jobId);
  }

  /**
   * Unsubscribe from job updates
   */
  static async unsubscribeFromJobUpdates(subscriptionId: string): Promise<void> {
    return DatabaseService.unsubscribe(subscriptionId);
  }

  /**
   * Get job statistics for dashboard
   */
  static async getJobStatistics(startDate?: string, endDate?: string) {
    return DatabaseService.getJobStatistics(startDate, endDate);
  }

  /**
   * Cleanup old completed jobs
   */
  static async cleanupOldJobs(daysOld: number = 30): Promise<DatabaseOperationResult<number>> {
    const startTime = Date.now();

    try {
      const client = DatabaseService.getServiceRoleClient();
      
      const { data, error } = await client.rpc('cleanup_old_jobs', {
        days_old: daysOld
      });

      if (error) {
        throw new Error(`Failed to cleanup old jobs: ${error.message}`);
      }

      logger.info('Old jobs cleanup completed', {
        deleted_count: data,
        days_old: daysOld,
        duration_ms: Date.now() - startTime
      });

      return {
        success: true,
        data: data,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to cleanup old jobs', {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      };
    }
  }
}
