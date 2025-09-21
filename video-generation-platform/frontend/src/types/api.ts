/**
 * API Types for Dynamic Video Content Generation Platform
 * Dual Response Processing Handler System
 */

import { z } from 'zod';

// ============================================================================
// REQUEST TYPES
// ============================================================================

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
}

export interface VideoCreateRequest {
  output_format: 'mp4' | 'mov' | 'avi';
  width: number;
  height: number;
  elements: VideoElement[];
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ImmediateResponse {
  status: 'completed';
  processing_time: string;
  result_url: string; // AWS S3 public URL
  job_id: string;
  file_size: string;
  message: string;
  duration?: string;
  metadata?: {
    width: number;
    height: number;
    format: string;
    codec?: string;
    bitrate?: string;
  };
}

export interface AsyncResponse {
  status: 'processing';
  job_id: string;
  message: string;
  estimated_completion: string;
  status_check_endpoint: string;
  estimated_time_remaining?: string;
}

export type VideoProcessingResponse = ImmediateResponse | AsyncResponse;

export interface JobStatusResponse {
  status: 'processing' | 'completed' | 'failed' | 'pending' | 'cancelled';
  job_id: string;
  progress?: string; // percentage
  current_step?: string;
  message: string;
  result_url?: string; // when completed
  file_size?: string;
  duration?: string;
  processing_time?: string;
  error?: string; // when failed
  estimated_time_remaining?: string;
  metadata?: {
    steps_completed: number;
    total_steps: number;
    current_operation?: string;
    performance_metrics?: {
      cpu_usage?: number;
      memory_usage?: number;
      processing_speed?: string;
    };
  };
}

// ============================================================================
// PROCESSING STEPS & TIMELINE
// ============================================================================

export interface ProcessingStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  progress: number; // 0-100
  started_at?: string;
  completed_at?: string;
  error?: string;
  metadata?: {
    duration?: number;
    output_size?: number;
    operation_details?: Record<string, any>;
  };
}

export interface ProcessingTimeline {
  job_id: string;
  steps: ProcessingStep[];
  overall_progress: number;
  current_step?: string;
  estimated_completion?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  correlationId?: string;
  details?: {
    field?: string;
    code?: string;
    suggestion?: string;
  };
}

export interface ProcessingError {
  type: 'validation' | 'processing' | 'storage' | 'timeout' | 'resource' | 'network';
  message: string;
  details?: string;
  recoverable: boolean;
  retry_after?: number; // seconds
  suggested_action?: string;
}

// ============================================================================
// SHARING & DOWNLOAD TYPES
// ============================================================================

export interface ShareOptions {
  platform: 'twitter' | 'facebook' | 'linkedin' | 'email' | 'copy_link';
  title?: string;
  description?: string;
  hashtags?: string[];
}

export interface DownloadOptions {
  format?: 'mp4' | 'mov' | 'avi';
  quality?: 'original' | 'high' | 'medium' | 'low';
  include_metadata?: boolean;
}

export interface ShareableLink {
  id: string;
  url: string;
  expires_at?: string;
  password_protected?: boolean;
  view_count?: number;
  max_views?: number;
  created_at: string;
}

// ============================================================================
// REAL-TIME UPDATE TYPES
// ============================================================================

export interface RealtimeJobUpdate {
  job_id: string;
  status: JobStatusResponse['status'];
  progress?: number;
  current_step?: string;
  message?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface RealtimeStepUpdate {
  job_id: string;
  step_id: string;
  step_name: string;
  status: ProcessingStep['status'];
  progress: number;
  message?: string;
  timestamp: string;
}

// ============================================================================
// COMPONENT STATE TYPES
// ============================================================================

export interface ProcessingState {
  type: 'immediate' | 'async';
  status: 'idle' | 'submitting' | 'processing' | 'completed' | 'failed';
  response?: VideoProcessingResponse;
  jobStatus?: JobStatusResponse;
  timeline?: ProcessingTimeline;
  error?: ProcessingError;
  retryCount: number;
  maxRetries: number;
}

export interface UIState {
  showProgress: boolean;
  showSteps: boolean;
  showPreview: boolean;
  showSharing: boolean;
  showDownload: boolean;
  isFullscreen: boolean;
  activeTab: 'progress' | 'steps' | 'preview' | 'sharing';
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const videoElementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['video', 'image']),
  source: z.string().url(),
  track: z.number().int().min(0),
  x: z.string().regex(/^\d+(\.\d+)?%$/).optional(),
  y: z.string().regex(/^\d+(\.\d+)?%$/).optional(),
  width: z.string().regex(/^\d+(\.\d+)?%$/).optional(),
  height: z.string().regex(/^\d+(\.\d+)?%$/).optional(),
  fit_mode: z.enum(['auto', 'contain', 'cover', 'fill']).optional(),
});

export const videoCreateRequestSchema = z.object({
  output_format: z.enum(['mp4', 'mov', 'avi']),
  width: z.number().int().min(1).max(7680),
  height: z.number().int().min(1).max(4320),
  elements: z.array(videoElementSchema).min(1).max(10),
});

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type ProcessingResponseType<T extends VideoProcessingResponse> = 
  T extends ImmediateResponse ? 'immediate' : 'async';

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
  retryableStatuses: string[];
}

export interface PollingConfig {
  interval: number; // milliseconds
  maxDuration: number; // milliseconds
  backoffMultiplier: number;
  maxInterval: number; // milliseconds
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const PROCESSING_STEPS = {
  VALIDATION: 'validation',
  RESOURCE_ALLOCATION: 'resource_allocation', 
  MEDIA_DOWNLOAD: 'media_download',
  MEDIA_ANALYSIS: 'media_analysis',
  VIDEO_COMPOSITION: 'video_composition',
  ENCODING: 'encoding',
  UPLOAD: 'upload',
  FINALIZATION: 'finalization',
} as const;

export const PROCESSING_MESSAGES = {
  [PROCESSING_STEPS.VALIDATION]: 'Validating input parameters and media sources',
  [PROCESSING_STEPS.RESOURCE_ALLOCATION]: 'Allocating processing resources',
  [PROCESSING_STEPS.MEDIA_DOWNLOAD]: 'Downloading and preparing media files',
  [PROCESSING_STEPS.MEDIA_ANALYSIS]: 'Analyzing media properties and compatibility',
  [PROCESSING_STEPS.VIDEO_COMPOSITION]: 'Compositing video elements and effects',
  [PROCESSING_STEPS.ENCODING]: 'Encoding final video with optimal settings',
  [PROCESSING_STEPS.UPLOAD]: 'Uploading processed video to storage',
  [PROCESSING_STEPS.FINALIZATION]: 'Finalizing and preparing download links',
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  TIMEOUT_ERROR: 'Processing took too long. The job may still be running in the background.',
  VALIDATION_ERROR: 'Invalid input parameters. Please check your video configuration.',
  RESOURCE_ERROR: 'Insufficient resources available. Please try again later.',
  STORAGE_ERROR: 'Failed to upload or access media files. Please verify your files.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

export const RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableStatuses: ['timeout', 'network', 'resource', '500', '502', '503', '504'],
};

export const POLLING_CONFIG: PollingConfig = {
  interval: 2000, // Start with 2 seconds
  maxDuration: 600000, // 10 minutes max
  backoffMultiplier: 1.5,
  maxInterval: 10000, // Max 10 seconds between polls
};