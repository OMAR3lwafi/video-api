import { VideoCreateRequest, JobStatusResponse } from '@/types/api';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface JobRecord {
  id: string;
  status: JobStatus;
  request: VideoCreateRequest;
  createdAt: number;
  updatedAt: number;
  progressPercent?: number;
  currentStep?: string;
  resultUrl?: string;
  fileSizeBytes?: number;
  processingTimeMs?: number;
  error?: string;
}

export interface EnqueueResult {
  jobId: string;
  status: JobStatus;
  etaMs?: number;
}

export interface JobStore {
  save(job: JobRecord): void;
  get(jobId: string): JobRecord | undefined;
  update(jobId: string, patch: Partial<JobRecord>): JobRecord | undefined;
  list(limit?: number): JobRecord[];
}

export function toJobStatusResponse(job: JobRecord): JobStatusResponse {
  return {
    status: job.status === 'pending' || job.status === 'processing' ? 'processing' : job.status === 'completed' ? 'completed' : 'failed',
    job_id: job.id,
    progress: typeof job.progressPercent === 'number' ? `${Math.max(0, Math.min(100, Math.round(job.progressPercent)))}%` : '0%',
    current_step: job.currentStep,
    message: job.status === 'completed'
      ? 'Video processing completed successfully'
      : job.status === 'failed'
      ? (job.error || 'Video processing failed')
      : job.status === 'cancelled'
      ? 'Job cancelled'
      : 'Video processing in progress',
    result_url: job.resultUrl,
    file_size: typeof job.fileSizeBytes === 'number' ? `${Math.round(job.fileSizeBytes / 1024)}KB` : undefined,
    duration: typeof job.processingTimeMs === 'number' ? `${Math.round(job.processingTimeMs / 100) / 10}s` : undefined,
    processing_time: typeof job.processingTimeMs === 'number' ? `${Math.round(job.processingTimeMs / 100) / 10}s` : undefined,
    error: job.status === 'failed' ? job.error : undefined,
  };
}



