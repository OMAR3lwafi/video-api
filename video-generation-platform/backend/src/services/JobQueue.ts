import { randomUUID } from 'crypto';
import { InMemoryJobStore } from '@/services/JobStore';
import { VideoProcessor } from '@/services/VideoProcessor';
import { getS3Service } from '@/utils/s3-factory';
import { VideoJobService } from '@/services/VideoJobService';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { VideoCreateRequest } from '@/types/api';
import { EnqueueResult, JobRecord } from '@/types/jobs';

/**
 * Simple in-memory job queue with background worker.
 * Uses a concurrency limit from config.processing and environment.
 * Can be extended to Redis by swapping queue and store implementations.
 */
export class JobQueueService {
  private readonly store = new InMemoryJobStore();
  private readonly queue: string[] = [];
  private readonly processing = new Set<string>();
  private readonly concurrency: number;
  private isDraining = false;

  constructor() {
    const envMax = parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10);
    this.concurrency = Number.isFinite(envMax) && envMax > 0 ? envMax : 2;
  }

  enqueue(request: VideoCreateRequest): EnqueueResult {
    const id = `job_${Date.now()}_${randomUUID()}`;
    const now = Date.now();
    const job: JobRecord = {
      id,
      status: 'pending',
      request,
      createdAt: now,
      updatedAt: now,
      progressPercent: 0,
      currentStep: 'queued',
    };
    this.store.save(job);
    this.queue.push(id);
    this.drain();
    return { jobId: id, status: 'pending' };
  }

  /**
   * Record a completed job (used by synchronous path) so status queries remain consistent.
   */
  recordCompleted(request: VideoCreateRequest, resultUrl: string, fileSizeBytes: number, processingTimeMs: number): string {
    const id = `job_${Date.now()}_${randomUUID()}`;
    const now = Date.now();
    const job: JobRecord = {
      id,
      status: 'completed',
      request,
      createdAt: now,
      updatedAt: now,
      progressPercent: 100,
      currentStep: 'completed',
      resultUrl,
      fileSizeBytes,
      processingTimeMs,
    };
    this.store.save(job);
    return id;
  }

  getJob(id: string): JobRecord | undefined {
    return this.store.get(id);
  }

  cancel(jobId: string): boolean {
    const job = this.store.get(jobId);
    if (!job) return false;
    if (job.status === 'completed' || job.status === 'failed') return false;
    // Cooperative cancellation: we mark cancelled; running ffmpeg will be killed by signal via controller or future enhancement
    this.store.update(jobId, { status: 'cancelled', currentStep: 'cancelled' });
    return true;
  }

  list(limit?: number) { return this.store.list(limit); }

  // Duplicate method removed - using the one above

  private drain(): void {
    if (this.isDraining) return;
    this.isDraining = true;
    setImmediate(async () => {
      try {
        while (this.processing.size < this.concurrency && this.queue.length > 0) {
          const id = this.queue.shift()!;
          this.runJob(id).catch((e) => {
            logger.error('Background job failed', { jobId: id, error: e instanceof Error ? e.message : String(e) });
          });
        }
      } finally {
        this.isDraining = false;
        // If more items remain, schedule another drain
        if (this.queue.length > 0 && this.processing.size < this.concurrency) {
          this.drain();
        }
      }
    });
  }

  private async runJob(jobId: string): Promise<void> {
    const job = this.store.get(jobId);
    if (!job) return;
    if (job.status === 'cancelled') return;

    this.processing.add(jobId);
    this.store.update(jobId, { status: 'processing', currentStep: 'downloading', progressPercent: 1 });

    // Create database job record
    const dbJobResult = await VideoJobService.createVideoJob({
      request: job.request,
      client_ip: '127.0.0.1', // TODO: Get from original request
      response_type: 'async'
    });

    if (!dbJobResult.success) {
      logger.error('Failed to create database job record', { jobId, error: dbJobResult.error });
      this.store.update(jobId, { status: 'failed', currentStep: 'error', error: 'Database error' });
      this.processing.delete(jobId);
      return;
    }

    const dbJob = dbJobResult.data!.job;
    const processor = new VideoProcessor();
    const s3 = getS3Service();

    const start = Date.now();
    let timelineId: string | undefined;

    try {
      // Start processing timeline
      const stepResult = await VideoJobService.startProcessingStep(dbJob.id, 'download', 0);
      if (stepResult.success) {
        timelineId = stepResult.data;
      }

      // Update database job status
      await VideoJobService.updateJobStatus(dbJob.id, 'processing');

      const result = await processor.process(job.request, {
        timeoutMs: config.processing.timeoutMs,
        onProgress: (p) => {
          const percent = typeof p.percent === 'number' ? p.percent : undefined;
          if (percent !== undefined) {
            this.store.update(jobId, { progressPercent: percent, currentStep: p.step ?? 'processing' });
            // Update database progress
            VideoJobService.updateJobStatus(dbJob.id, 'processing').catch(() => {});
          }
        },
      });

      // Complete processing step
      if (timelineId) {
        await VideoJobService.completeProcessingStep(timelineId, true, 90);
      }

      // Start upload step
      const uploadStepResult = await VideoJobService.startProcessingStep(dbJob.id, 'upload', 1);
      this.store.update(jobId, { currentStep: 'uploading', progressPercent: 95 });

      const upload = await s3.uploadVideo(result.outputPath);

      // Log storage operation
      await VideoJobService.logStorageOperation(
        dbJob.id,
        'upload',
        upload.bucket,
        upload.key,
        true,
        {
          file_size: result.outputSizeBytes,
          duration_ms: Date.now() - start,
          region: config.aws.region
        }
      );

      // Complete upload step
      if (uploadStepResult.success) {
        await VideoJobService.completeProcessingStep(uploadStepResult.data!, true, 100);
      }

      const duration = Date.now() - start;
      
      // Update database job as completed
      await VideoJobService.updateJobStatus(dbJob.id, 'completed');

      this.store.update(jobId, {
        status: 'completed',
        currentStep: 'completed',
        progressPercent: 100,
        resultUrl: upload.publicUrl,
        fileSizeBytes: result.outputSizeBytes,
        processingTimeMs: duration,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      
      // Complete failed step
      if (timelineId) {
        await VideoJobService.completeProcessingStep(timelineId, false, undefined, undefined, message);
      }

      // Update database job as failed
      await VideoJobService.updateJobStatus(dbJob.id, 'failed', message);

      this.store.update(jobId, { status: 'failed', currentStep: 'error', error: message });
    } finally {
      this.processing.delete(jobId);
    }
  }
}

let singleton: JobQueueService | null = null;
export function getJobQueue(): JobQueueService {
  if (!singleton) singleton = new JobQueueService();
  return singleton;
}



