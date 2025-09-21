/**
 * Database Types and Interfaces
 * Generated from Supabase schema for type safety and consistency
 */

// ============================================================================
// ENUM TYPES
// ============================================================================

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export type ElementType = 'video' | 'image' | 'audio' | 'text' | 'overlay';

export type FitMode = 'auto' | 'contain' | 'cover' | 'fill' | 'stretch';

export type ProcessingStep = 'validation' | 'download' | 'processing' | 'composition' | 'encoding' | 'upload' | 'cleanup';

export type StorageOperation = 'upload' | 'download' | 'delete' | 'access';

export type ResponseType = 'immediate' | 'async';

// ============================================================================
// TABLE INTERFACES
// ============================================================================

export interface DatabaseJob {
  id: string;
  status: JobStatus;
  response_type: ResponseType;
  output_format: string;
  width: number;
  height: number;
  estimated_duration?: number;
  actual_duration?: number;
  processing_started_at?: string;
  processing_completed_at?: string;
  s3_bucket?: string;
  s3_key?: string;
  s3_region?: string;
  result_url?: string;
  file_size?: number;
  progress_percentage: number;
  current_step?: ProcessingStep;
  error_message?: string;
  error_code?: string;
  retry_count: number;
  client_ip?: string;
  user_agent?: string;
  request_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DatabaseElement {
  id: string;
  job_id: string;
  element_order: number;
  type: ElementType;
  source_url: string;
  source_filename?: string;
  source_size?: number;
  source_duration?: number;
  track: number;
  x_position: string;
  y_position: string;
  width: string;
  height: string;
  fit_mode: FitMode;
  start_time: number;
  end_time?: number;
  downloaded: boolean;
  processed: boolean;
  error_message?: string;
  local_path?: string;
  processed_path?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DatabaseStorageOperation {
  id: string;
  job_id?: string;
  operation: StorageOperation;
  bucket: string;
  key: string;
  region: string;
  success: boolean;
  file_size?: number;
  duration_ms?: number;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface DatabaseProcessingTimeline {
  id: string;
  job_id: string;
  step: ProcessingStep;
  step_order: number;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  success?: boolean;
  progress_percentage: number;
  details?: Record<string, any>;
  error_message?: string;
  cpu_usage?: number;
  memory_usage?: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseUrlAccessLog {
  id: string;
  job_id?: string;
  url: string;
  access_type: string;
  client_ip?: string;
  user_agent?: string;
  referer?: string;
  response_code?: number;
  bytes_served?: number;
  response_time_ms?: number;
  country?: string;
  region?: string;
  city?: string;
  accessed_at: string;
}

export interface DatabaseSystemMetric {
  id: string;
  metric_name: string;
  metric_type: string;
  value: number;
  unit?: string;
  labels?: Record<string, any>;
  recorded_at: string;
}

// ============================================================================
// VIEW INTERFACES
// ============================================================================

export interface JobSummary {
  id: string;
  status: JobStatus;
  response_type: ResponseType;
  output_format: string;
  width: number;
  height: number;
  estimated_duration?: number;
  actual_duration?: number;
  processing_started_at?: string;
  processing_completed_at?: string;
  s3_bucket?: string;
  s3_key?: string;
  s3_region?: string;
  result_url?: string;
  file_size?: number;
  progress_percentage: number;
  current_step?: ProcessingStep;
  error_message?: string;
  error_code?: string;
  retry_count: number;
  client_ip?: string;
  user_agent?: string;
  request_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  element_count: number;
  element_types?: ElementType[];
  total_source_size?: number;
  elements_downloaded: number;
  elements_processed: number;
  total_processing_steps: number;
  completed_processing_steps: number;
  current_step_started_at?: string;
  last_step_completed_at?: string;
  upload_operations: number;
  successful_uploads: number;
  last_upload_at?: string;
  processing_duration?: string;
  duration_variance_seconds?: number;
  response_type_mismatch: boolean;
}

export interface JobStatusRealtime {
  id: string;
  status: JobStatus;
  progress_percentage: number;
  current_step?: ProcessingStep;
  result_url?: string;
  error_message?: string;
  updated_at: string;
  estimated_duration?: number;
  processing_started_at?: string;
  created_at: string;
  response_type: ResponseType;
  current_step_name?: ProcessingStep;
  current_step_started_at?: string;
  current_step_progress?: number;
  processing_time_seconds?: number;
  estimated_remaining_seconds?: number;
}

export interface ActiveJob extends JobStatusRealtime {
  processing_health: 'normal' | 'slow' | 'stalled';
  priority_level: number;
}

// ============================================================================
// FUNCTION PARAMETER INTERFACES
// ============================================================================

export interface CreateJobParams {
  output_format: string;
  width: number;
  height: number;
  estimated_duration?: number | undefined;
  client_ip?: string | undefined;
  user_agent?: string | undefined;
  request_metadata?: Record<string, any> | undefined;
}

export interface UpdateJobStatusParams {
  job_id: string;
  status: JobStatus;
  error_message?: string | undefined;
  error_code?: string | undefined;
}

export interface UpdateJobProgressParams {
  job_id: string;
  progress: number;
  current_step?: ProcessingStep | undefined;
}

export interface AddJobElementParams {
  job_id: string;
  type: ElementType;
  source_url: string;
  element_order: number;
  track?: number | undefined;
  x_position?: string | undefined;
  y_position?: string | undefined;
  width?: string | undefined;
  height?: string | undefined;
  fit_mode?: FitMode | undefined;
  start_time?: number | undefined;
  end_time?: number | undefined;
  metadata?: Record<string, any> | undefined;
}

export interface UpdateElementStatusParams {
  element_id: string;
  downloaded?: boolean;
  processed?: boolean;
  local_path?: string;
  processed_path?: string;
  error_message?: string;
  source_size?: number;
  source_duration?: number;
}

export interface StartProcessingStepParams {
  job_id: string;
  step: ProcessingStep;
  step_order: number;
  details?: Record<string, any> | undefined;
}

export interface CompleteProcessingStepParams {
  timeline_id: string;
  success: boolean;
  progress?: number | undefined;
  details?: Record<string, any> | undefined;
  error_message?: string | undefined;
  cpu_usage?: number | undefined;
  memory_usage?: number | undefined;
}

export interface LogStorageOperationParams {
  job_id?: string | undefined;
  operation: StorageOperation;
  bucket: string;
  key: string;
  region?: string | undefined;
  success?: boolean | undefined;
  file_size?: number | undefined;
  duration_ms?: number | undefined;
  error_message?: string | undefined;
  metadata?: Record<string, any> | undefined;
}

export interface RecordSystemMetricParams {
  metric_name: string;
  metric_type: string;
  value: number;
  unit?: string;
  labels?: Record<string, any>;
}

// ============================================================================
// QUERY RESULT INTERFACES
// ============================================================================

export interface JobStatistics {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  avg_processing_time?: string;
  immediate_response_jobs: number;
  async_response_jobs: number;
}

export interface StorageStatistics {
  total_operations: number;
  successful_operations: number;
  total_bytes_uploaded: number;
  total_bytes_downloaded: number;
  avg_operation_duration_ms?: number;
}

export interface SystemHealth {
  stalled_jobs: number;
  recent_failures: number;
  recent_timeouts: number;
  pending_jobs: number;
  processing_jobs: number;
  active_buckets: number;
  recent_storage_failures: number;
  recent_avg_processing_time?: number;
  recent_sla_violations: number;
}

export interface ErrorAnalysis {
  error_code?: string;
  error_message?: string;
  occurrence_count: number;
  affected_clients: number;
  first_occurrence: string;
  last_occurrence: string;
  retried_jobs: number;
  avg_retry_count?: number;
  associated_element_types?: ElementType[];
  failure_steps?: ProcessingStep[];
}

// ============================================================================
// SUBSCRIPTION INTERFACES
// ============================================================================

export interface JobStatusChangeNotification {
  job_id: string;
  old_status?: JobStatus;
  new_status: JobStatus;
  progress_percentage: number;
  current_step?: ProcessingStep;
  result_url?: string;
  error_message?: string;
  updated_at: string;
}

export interface ProcessingTimelineUpdateNotification {
  timeline_id: string;
  job_id: string;
  step: ProcessingStep;
  step_order: number;
  started_at: string;
  completed_at?: string;
  success?: boolean;
  progress_percentage: number;
  error_message?: string;
}

// ============================================================================
// PAGINATION AND FILTERING
// ============================================================================

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface JobFilterOptions {
  status?: JobStatus | JobStatus[];
  response_type?: ResponseType;
  client_ip?: string;
  created_after?: string;
  created_before?: string;
  has_errors?: boolean;
}

export interface ElementFilterOptions {
  job_id?: string;
  type?: ElementType | ElementType[];
  downloaded?: boolean;
  processed?: boolean;
}

export interface StorageOperationFilterOptions {
  job_id?: string;
  operation?: StorageOperation | StorageOperation[];
  bucket?: string;
  success?: boolean;
  created_after?: string;
  created_before?: string;
}

// ============================================================================
// DATABASE OPERATION RESULTS
// ============================================================================

export interface DatabaseOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
  duration_ms?: number;
}

export interface TransactionResult<T = any> {
  success: boolean;
  data?: T | undefined;
  error?: string | undefined;
  rollback_reason?: string | undefined;
}

// ============================================================================
// CACHE INTERFACES
// ============================================================================

export interface CacheOptions {
  key: string;
  ttl_seconds?: number;
  tags?: string[];
}

export interface CachedResult<T = any> {
  data: T;
  cached_at: string;
  expires_at: string;
  hit: boolean;
}

// ============================================================================
// CONNECTION AND HEALTH
// ============================================================================

export interface DatabaseConnectionInfo {
  connected: boolean;
  pool_size?: number;
  active_connections?: number;
  idle_connections?: number;
  waiting_connections?: number;
  last_health_check: string;
}

export interface DatabaseHealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  response_time_ms: number;
  error?: string;
  checks: {
    connection: boolean;
    read_operations: boolean;
    write_operations: boolean;
    real_time: boolean;
  };
  timestamp: string;
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export type DatabaseTables = {
  jobs: DatabaseJob;
  elements: DatabaseElement;
  storage_operations: DatabaseStorageOperation;
  processing_timeline: DatabaseProcessingTimeline;
  url_access_logs: DatabaseUrlAccessLog;
  system_metrics: DatabaseSystemMetric;
};

export type DatabaseViews = {
  job_summary: JobSummary;
  job_status_realtime: JobStatusRealtime;
  active_jobs: ActiveJob;
};
