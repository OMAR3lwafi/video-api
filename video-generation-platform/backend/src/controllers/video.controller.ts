import { Request, Response } from 'express';
import { sendSuccess, sendError, sendAccepted } from '../utils/responseFormatter';
import { NotFoundError } from '../errors';
import { VideoProcessor } from '@/services/VideoProcessor';
import { config } from '@/config';
import { ProcessingEstimator } from '@/services/Estimator';
import { getJobQueue } from '@/services/JobQueue';
import { getS3Service } from '@/utils/s3-factory';
import { VideoJobService } from '@/services/VideoJobService';
import { JobRepository, SubscriptionRepository } from '@/services/DatabaseRepository';
import { videoCreationRequests, jobsInProgress, videoProcessingDuration, videoProcessingSummary } from '@/config/metrics';

class VideoController {
  /**
   * Create a new video processing job
   * POST /api/v1/video/create
   */
  async createVideo(req: Request, res: Response): Promise<void> {
    videoCreationRequests.inc();
    jobsInProgress.inc();
    const end = videoProcessingDuration.startTimer();
    const endSummary = videoProcessingSummary.startTimer();

    try {
      const estimator = new ProcessingEstimator();
      const est = await estimator.estimate(req.body);

      const threshold = config.processing.quickThresholdMs;

      if (est.estimatedMs <= threshold) {
        // Synchronous path: process immediately and upload to S3
        const processor = new VideoProcessor();
        const s3 = getS3Service();
        
        // Create database job for immediate processing
        const dbJobResult = await VideoJobService.createVideoJob({
          request: req.body,
          estimated_duration: Math.round(est.estimatedMs / 1000),
          client_ip: req.ip || '127.0.0.1',
          user_agent: req.get('User-Agent') || 'Unknown',
          response_type: 'immediate'
        });

        if (!dbJobResult.success) {
          throw new Error(`Database error: ${dbJobResult.error}`);
        }

        const dbJob = dbJobResult.data!.job;
        
        try {
          // Start processing timeline
          const stepResult = await VideoJobService.startProcessingStep(dbJob.id, 'processing', 0);
          
          const result = await processor.process(req.body, {
            timeoutMs: config.processing.timeoutMs,
          });
          
          // Complete processing step
          if (stepResult.success) {
            await VideoJobService.completeProcessingStep(stepResult.data!, true, 90);
          }

          // Start upload step
          const uploadStepResult = await VideoJobService.startProcessingStep(dbJob.id, 'upload', 1);
          const uploaded = await s3.uploadVideo(result.outputPath);

          // Log storage operation and complete job
          await VideoJobService.logStorageOperation(
            dbJob.id,
            'upload',
            uploaded.bucket,
            uploaded.key,
            true,
            {
              file_size: result.outputSizeBytes,
              duration_ms: result.durationMs,
              region: config.aws.region
            }
          );

          // Complete upload step and job
          if (uploadStepResult.success) {
            await VideoJobService.completeProcessingStep(uploadStepResult.data!, true, 100);
          }
          await VideoJobService.updateJobStatus(dbJob.id, 'completed');

          sendSuccess(res, {
            status: 'completed' as const,
            processing_time: `${Math.round(result.durationMs / 10) / 100}s`,
            result_url: uploaded.publicUrl,
            job_id: dbJob.id,
            file_size: `${Math.round(result.outputSizeBytes / 1024)}KB`,
            message: 'Video processing completed successfully',
          }, 'Video processed successfully', 200);
          return;
        } catch (processingError) {
          // Update database job as failed
          await VideoJobService.updateJobStatus(
            dbJob.id, 
            'failed', 
            processingError instanceof Error ? processingError.message : String(processingError)
          );
          throw processingError;
        }
      }

      // Asynchronous path: enqueue job and return 202
      const queue = getJobQueue();
      const { jobId } = queue.enqueue(req.body);
      const eta = new Date(Date.now() + Math.max(threshold, est.estimatedMs)).toISOString();
      sendAccepted(res, {
        status: 'processing' as const,
        job_id: jobId,
        message: 'Video processing started',
        estimated_completion: eta,
        status_check_endpoint: `/api/v1/video/result/${jobId}`,
      }, 'Request accepted for processing');
    } catch (error) {
      sendError(
        res,
        'VideoProcessingError',
        'Failed to create video processing job',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } finally {
      jobsInProgress.dec();
      end();
      endSummary();
    }
  }

  /**
   * Get video processing job status
   * GET /api/v1/video/result/:jobId
   */
  async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      if (!jobId) {
        throw new NotFoundError('Job ID is required');
      }
      
      // Try in-memory queue first (for recently submitted jobs)
      const queue = getJobQueue();
      const queueJob = queue.getJob(jobId);
      
      if (queueJob) {
        const { toJobStatusResponse } = await import('@/types/jobs');
        const payload = toJobStatusResponse(queueJob);
        sendSuccess(res, payload, 'Job status retrieved successfully');
        return;
      }

      // Check database for persisted jobs
      const dbJobResult = await VideoJobService.getVideoJob(jobId);
      
      if (!dbJobResult.success || !dbJobResult.data) {
        throw new NotFoundError(`Job ${jobId} not found`);
      }

      const dbJob = dbJobResult.data.job;
      const payload = VideoJobService.toJobStatusResponse(dbJob);
      sendSuccess(res, payload, 'Job status retrieved successfully');
    } catch (error) {
      if (error instanceof NotFoundError) {
        sendError(res, 'JobNotFound', `Job ${req.params.jobId} not found`, 404);
      } else {
        sendError(
          res,
          'JobStatusError',
          'Failed to retrieve job status',
          500,
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    }
  }

  /**
   * Cancel a video processing job
   * DELETE /api/v1/video/job/:jobId
   */
  async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      if (!jobId) {
        throw new NotFoundError('Job ID is required');
      }
      
      // Try cancelling in-memory queue first
      const queue = getJobQueue();
      const queueSuccess = queue.cancel(jobId);
      
      // Also try cancelling in database
      const dbSuccess = await VideoJobService.updateJobStatus(jobId, 'cancelled');
      
      if (!queueSuccess && !dbSuccess.success) {
        throw new NotFoundError(`Job ${jobId} not found or cannot be cancelled`);
      }
      
      sendSuccess(res, { job_id: jobId, status: 'cancelled' }, 'Job cancelled successfully');
    } catch (error) {
      if (error instanceof NotFoundError) {
        sendError(res, 'JobNotFound', `Job ${req.params.jobId} not found`, 404);
      } else {
        sendError(
          res,
          'JobCancellationError',
          'Failed to cancel job',
          500,
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    }
  }

  /**
   * List user's video processing jobs
   * GET /api/v1/video/jobs
   */
  async listJobs(req: Request, res: Response): Promise<void> {
    try {
      const clientIp = req.ip || '127.0.0.1';
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      
      // Get jobs from database with client IP filtering
      const result = await JobRepository.findByClientIp(clientIp, { page, limit });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to retrieve jobs');
      }

      const jobs = result.data || [];
      const list = jobs.map((j) => ({
        job_id: j.id,
        status: j.status,
        created_at: j.created_at,
        updated_at: j.updated_at,
        result_url: j.result_url,
        progress: `${j.progress_percentage}%`,
        current_step: j.current_step,
        file_size: j.file_size ? `${Math.round(j.file_size / 1024)}KB` : undefined,
        processing_time: j.actual_duration ? `${j.actual_duration}s` : undefined,
      }));

      sendSuccess(res, list, 'Jobs retrieved successfully');
    } catch (error) {
      sendError(
        res,
        'JobListError',
        'Failed to retrieve jobs',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Get detailed job information with timeline
   * GET /api/v1/video/job/:jobId/details
   */
  async getJobDetails(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      if (!jobId) {
        throw new NotFoundError('Job ID is required');
      }
      
      const result = await JobRepository.getJobWithDetails(jobId);
      
      if (!result.success || !result.data) {
        throw new NotFoundError(`Job ${jobId} not found`);
      }

      sendSuccess(res, result.data, 'Job details retrieved successfully');
    } catch (error) {
      if (error instanceof NotFoundError) {
        sendError(res, 'JobNotFound', error.message, 404);
      } else {
        sendError(
          res,
          'JobDetailsError',
          'Failed to retrieve job details',
          500,
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    }
  }

  /**
   * Subscribe to job status updates (Server-Sent Events)
   * GET /api/v1/video/job/:jobId/subscribe
   */
  async subscribeToJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      if (!jobId) {
        throw new NotFoundError('Job ID is required');
      }
      
      // Verify job exists and user has access
      const jobResult = await VideoJobService.getVideoJob(jobId);
      if (!jobResult.success || !jobResult.data) {
        throw new NotFoundError(`Job ${jobId} not found`);
      }

      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial job status
      const initialStatus = VideoJobService.toJobStatusResponse(jobResult.data.job);
      res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);

      // Subscribe to updates
      const subscriptionId = SubscriptionRepository.subscribeToJob(jobId, (notification) => {
        res.write(`data: ${JSON.stringify(notification)}\n\n`);
      });

      // Handle client disconnect
      req.on('close', async () => {
        await SubscriptionRepository.unsubscribe(jobId);
      });

      // Keep connection alive
      const keepAlive = setInterval(() => {
        res.write(': keepalive\n\n');
      }, 30000);

      req.on('close', () => {
        clearInterval(keepAlive);
      });

    } catch (error) {
      if (error instanceof NotFoundError) {
        sendError(res, 'JobNotFound', error.message, 404);
      } else {
        sendError(
          res,
          'SubscriptionError',
          'Failed to subscribe to job updates',
          500,
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    }
  }
}

export const videoController = new VideoController();