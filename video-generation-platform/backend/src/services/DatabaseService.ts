/**
 * Comprehensive Database Service Layer
 * Handles all database operations with Supabase integration, real-time subscriptions,
 * transaction management, caching, and comprehensive error handling
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import {
  DatabaseJob,
  DatabaseElement,
  DatabaseStorageOperation,
  DatabaseProcessingTimeline,
  DatabaseSystemMetric,
  JobSummary,
  JobStatusRealtime,
  ActiveJob,
  JobStatus,
  ElementType,
  ProcessingStep,
  StorageOperation,
  CreateJobParams,
  UpdateJobStatusParams,
  UpdateJobProgressParams,
  AddJobElementParams,
  UpdateElementStatusParams,
  StartProcessingStepParams,
  CompleteProcessingStepParams,
  LogStorageOperationParams,
  RecordSystemMetricParams,
  JobFilterOptions,
  ElementFilterOptions,
  StorageOperationFilterOptions,
  PaginationOptions,
  DatabaseOperationResult,
  TransactionResult,
  DatabaseHealthCheck,
  JobStatusChangeNotification,
  ProcessingTimelineUpdateNotification,
  JobStatistics,
  StorageStatistics,
  SystemHealth,
  ErrorAnalysis,
  CacheOptions,
  CachedResult
} from '@/types/database';

/**
 * Database Service Error Classes
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any,
    public query?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class TransactionError extends DatabaseError {
  constructor(message: string, public rollbackReason?: string) {
    super(message, 'TRANSACTION_ERROR');
    this.name = 'TransactionError';
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

/**
 * In-Memory Cache Implementation
 */
class MemoryCache {
  private cache = new Map<string, { data: any; expires_at: number; tags: string[] }>();

  get<T>(key: string): CachedResult<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expires_at) {
      this.cache.delete(key);
      return null;
    }

    return {
      data: entry.data,
      cached_at: new Date(entry.expires_at - (entry.expires_at - now)).toISOString(),
      expires_at: new Date(entry.expires_at).toISOString(),
      hit: true
    };
  }

  set<T>(key: string, data: T, options: CacheOptions): void {
    const ttl = (options.ttl_seconds || 300) * 1000; // Default 5 minutes
    const expires_at = Date.now() + ttl;
    
    this.cache.set(key, {
      data,
      expires_at,
      tags: options.tags || []
    });
  }

  invalidate(pattern: string): void {
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateByTags(tags: string[]): void {
    for (const [key, entry] of this.cache) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Comprehensive Database Service
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private supabaseClient: SupabaseClient | null = null;
  private serviceRoleClient: SupabaseClient | null = null;
  private isConnected = false;
  private subscriptions = new Map<string, RealtimeChannel>();
  private cache = new MemoryCache();
  private connectionPool: {
    active: number;
    idle: number;
    waiting: number;
  } = { active: 0, idle: 0, waiting: 0 };

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Initialize database connections
   */
  static async initialize(): Promise<void> {
    const instance = DatabaseService.getInstance();
    await instance.connect();
  }

  /**
   * Get the standard Supabase client (with RLS)
   */
  static getClient(): SupabaseClient {
    const instance = DatabaseService.getInstance();
    if (!instance.supabaseClient) {
      throw new ConnectionError('Database not initialized. Call DatabaseService.initialize() first.');
    }
    return instance.supabaseClient;
  }

  /**
   * Get the service role client (bypasses RLS)
   */
  static getServiceRoleClient(): SupabaseClient {
    const instance = DatabaseService.getInstance();
    if (!instance.serviceRoleClient) {
      throw new ConnectionError('Database not initialized. Call DatabaseService.initialize() first.');
    }
    return instance.serviceRoleClient;
  }

  /**
   * Check if database is connected
   */
  static isConnected(): boolean {
    const instance = DatabaseService.getInstance();
    return instance.isConnected;
  }

  /**
   * Connect to the database
   */
  private async connect(): Promise<void> {
    try {
      // Create standard client with RLS
      this.supabaseClient = createClient(
        config.database.url,
        config.database.anonKey,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: false,
          },
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        }
      );

      // Create service role client (bypasses RLS)
      this.serviceRoleClient = createClient(
        config.database.url,
        config.database.serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        }
      );

      // Test the connection
      await this.testConnection();
      
      this.isConnected = true;
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw new ConnectionError(`Database connection failed: ${error}`);
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    try {
      if (!this.supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      // Test with a simple query
      const { error } = await this.supabaseClient
        .from('jobs')
        .select('count')
        .limit(1);

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw new ConnectionError(`Database connection test failed: ${error}`);
    }
  }

  /**
   * Disconnect from database
   */
  static async disconnect(): Promise<void> {
    const instance = DatabaseService.getInstance();
    
    // Close all subscriptions
    for (const [channel, subscription] of instance.subscriptions) {
      await subscription.unsubscribe();
    }
    instance.subscriptions.clear();

    // Clear cache
    instance.cache.clear();

    if (instance.supabaseClient) {
      instance.supabaseClient = null;
    }

    if (instance.serviceRoleClient) {
      instance.serviceRoleClient = null;
    }

    instance.isConnected = false;
    logger.info('Database connections closed');
  }

  // ============================================================================
  // JOB OPERATIONS (CRUD)
  // ============================================================================

  /**
   * Create a new job
   */
  static async createJob(params: CreateJobParams): Promise<DatabaseOperationResult<DatabaseJob>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.serviceRoleClient!;
      
      const { data, error } = await client.rpc('create_job', {
        p_output_format: params.output_format,
        p_width: params.width,
        p_height: params.height,
        p_estimated_duration: params.estimated_duration,
        p_client_ip: params.client_ip,
        p_user_agent: params.user_agent,
        p_request_metadata: params.request_metadata
      });

      if (error) {
        throw new DatabaseError('Failed to create job', error.code, error);
      }

      // Fetch the created job
      const { data: job, error: fetchError } = await client
        .from('jobs')
        .select('*')
        .eq('id', data)
        .single();

      if (fetchError) {
        throw new DatabaseError('Failed to fetch created job', fetchError.code, fetchError);
      }

      // Invalidate related cache
      instance.cache.invalidateByTags(['jobs', 'job_summary']);

      const duration = Date.now() - startTime;
      logger.info('Job created successfully', { job_id: data, duration_ms: duration });

      return {
        success: true,
        data: job,
        duration_ms: duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to create job', { error: error instanceof Error ? error.message : String(error), duration_ms: duration });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      };
    }
  }

  /**
   * Get job by ID
   */
  static async getJob(jobId: string, useCache = true): Promise<DatabaseOperationResult<DatabaseJob>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();
    const cacheKey = `job:${jobId}`;

    try {
      // Check cache first
      if (useCache) {
        const cached = instance.cache.get<DatabaseJob>(cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached.data,
            duration_ms: Date.now() - startTime
          };
        }
      }

      const client = instance.supabaseClient!;
      
      const { data, error } = await client
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Job not found',
            duration_ms: Date.now() - startTime
          };
        }
        throw new DatabaseError('Failed to get job', error.code, error);
      }

      // Cache the result
      if (useCache) {
        instance.cache.set(cacheKey, data, {
          key: cacheKey,
          ttl_seconds: 300,
          tags: ['jobs', `job:${jobId}`]
        });
      }

      return {
        success: true,
        data,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get job', { job_id: jobId, error: error instanceof Error ? error.message : String(error), duration_ms: duration });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      };
    }
  }

  /**
   * Update job status
   */
  static async updateJobStatus(params: UpdateJobStatusParams): Promise<DatabaseOperationResult<boolean>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.serviceRoleClient!;
      
      const { data, error } = await client.rpc('update_job_status', {
        job_uuid: params.job_id,
        new_status: params.status,
        error_msg: params.error_message,
        error_code_val: params.error_code
      });

      if (error) {
        throw new DatabaseError('Failed to update job status', error.code, error);
      }

      // Invalidate cache
      instance.cache.invalidate(`job:${params.job_id}`);
      instance.cache.invalidateByTags(['jobs', 'job_summary', 'active_jobs']);

      const duration = Date.now() - startTime;
      logger.info('Job status updated', { job_id: params.job_id, status: params.status, duration_ms: duration });

      return {
        success: true,
        data: data,
        duration_ms: duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to update job status', { 
        job_id: params.job_id, 
        status: params.status,
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
   * Update job progress
   */
  static async updateJobProgress(params: UpdateJobProgressParams): Promise<DatabaseOperationResult<boolean>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.serviceRoleClient!;
      
      const { data, error } = await client.rpc('update_job_progress', {
        job_uuid: params.job_id,
        progress: params.progress,
        current_step_val: params.current_step
      });

      if (error) {
        throw new DatabaseError('Failed to update job progress', error.code, error);
      }

      // Invalidate cache
      instance.cache.invalidate(`job:${params.job_id}`);
      instance.cache.invalidateByTags(['jobs', 'job_summary', 'active_jobs']);

      return {
        success: true,
        data: data,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to update job progress', { 
        job_id: params.job_id, 
        progress: params.progress,
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
   * List jobs with filtering and pagination
   */
  static async listJobs(
    filters: JobFilterOptions = {},
    pagination: PaginationOptions = {}
  ): Promise<DatabaseOperationResult<DatabaseJob[]>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.supabaseClient!;
      let query = client.from('jobs').select('*');

      // Apply filters
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters.response_type) {
        query = query.eq('response_type', filters.response_type);
      }

      if (filters.client_ip) {
        query = query.eq('client_ip', filters.client_ip);
      }

      if (filters.created_after) {
        query = query.gte('created_at', filters.created_after);
      }

      if (filters.created_before) {
        query = query.lte('created_at', filters.created_before);
      }

      if (filters.has_errors !== undefined) {
        if (filters.has_errors) {
          query = query.not('error_message', 'is', null);
        } else {
          query = query.is('error_message', null);
        }
      }

      // Apply pagination
      const page = pagination.page || 1;
      const limit = Math.min(pagination.limit || 50, 100);
      const offset = (page - 1) * limit;

      query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        throw new DatabaseError('Failed to list jobs', error.code, error);
      }

      return {
        success: true,
        data: data || [],
        count: count || 0,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to list jobs', { error: error instanceof Error ? error.message : String(error), duration_ms: duration });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      };
    }
  }

  // ============================================================================
  // ELEMENT MANAGEMENT
  // ============================================================================

  /**
   * Add element to job
   */
  static async addJobElement(params: AddJobElementParams): Promise<DatabaseOperationResult<string>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.serviceRoleClient!;
      
      const { data, error } = await client.rpc('add_job_element', {
        job_uuid: params.job_id,
        element_type_val: params.type,
        source_url_val: params.source_url,
        element_order_val: params.element_order,
        track_val: params.track || 0,
        x_pos: params.x_position || '0%',
        y_pos: params.y_position || '0%',
        width_val: params.width || '100%',
        height_val: params.height || '100%',
        fit_mode_val: params.fit_mode || 'auto',
        start_time_val: params.start_time || 0,
        end_time_val: params.end_time,
        metadata_val: params.metadata
      });

      if (error) {
        throw new DatabaseError('Failed to add job element', error.code, error);
      }

      // Invalidate cache
      instance.cache.invalidate(`job:${params.job_id}`);
      instance.cache.invalidateByTags(['jobs', 'elements', 'job_summary']);

      const duration = Date.now() - startTime;
      logger.info('Job element added', { job_id: params.job_id, element_id: data, duration_ms: duration });

      return {
        success: true,
        data: data,
        duration_ms: duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to add job element', { 
        job_id: params.job_id,
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
   * Update element status
   */
  static async updateElementStatus(params: UpdateElementStatusParams): Promise<DatabaseOperationResult<boolean>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.serviceRoleClient!;
      
      const { data, error } = await client.rpc('update_element_status', {
        element_uuid: params.element_id,
        downloaded_val: params.downloaded,
        processed_val: params.processed,
        local_path_val: params.local_path,
        processed_path_val: params.processed_path,
        error_msg: params.error_message,
        source_size_val: params.source_size,
        source_duration_val: params.source_duration
      });

      if (error) {
        throw new DatabaseError('Failed to update element status', error.code, error);
      }

      // Invalidate cache
      instance.cache.invalidateByTags(['elements', 'job_summary']);

      return {
        success: true,
        data: data,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to update element status', { 
        element_id: params.element_id,
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
   * Get elements for job
   */
  static async getJobElements(
    jobId: string,
    filters: ElementFilterOptions = {}
  ): Promise<DatabaseOperationResult<DatabaseElement[]>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.supabaseClient!;
      let query = client.from('elements').select('*').eq('job_id', jobId);

      // Apply filters
      if (filters.type) {
        if (Array.isArray(filters.type)) {
          query = query.in('type', filters.type);
        } else {
          query = query.eq('type', filters.type);
        }
      }

      if (filters.downloaded !== undefined) {
        query = query.eq('downloaded', filters.downloaded);
      }

      if (filters.processed !== undefined) {
        query = query.eq('processed', filters.processed);
      }

      query = query.order('element_order', { ascending: true });

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError('Failed to get job elements', error.code, error);
      }

      return {
        success: true,
        data: data || [],
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get job elements', { 
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

  // ============================================================================
  // PROCESSING TIMELINE MANAGEMENT
  // ============================================================================

  /**
   * Start processing step
   */
  static async startProcessingStep(params: StartProcessingStepParams): Promise<DatabaseOperationResult<string>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.serviceRoleClient!;
      
      const { data, error } = await client.rpc('start_processing_step', {
        job_uuid: params.job_id,
        step_val: params.step,
        step_order_val: params.step_order,
        details_val: params.details
      });

      if (error) {
        throw new DatabaseError('Failed to start processing step', error.code, error);
      }

      // Invalidate cache
      instance.cache.invalidate(`job:${params.job_id}`);
      instance.cache.invalidateByTags(['jobs', 'processing_timeline', 'active_jobs']);

      const duration = Date.now() - startTime;
      logger.info('Processing step started', { 
        job_id: params.job_id, 
        step: params.step, 
        timeline_id: data,
        duration_ms: duration 
      });

      return {
        success: true,
        data: data,
        duration_ms: duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to start processing step', { 
        job_id: params.job_id,
        step: params.step,
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
   * Complete processing step
   */
  static async completeProcessingStep(params: CompleteProcessingStepParams): Promise<DatabaseOperationResult<boolean>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.serviceRoleClient!;
      
      const { data, error } = await client.rpc('complete_processing_step', {
        timeline_uuid: params.timeline_id,
        success_val: params.success,
        progress_val: params.progress,
        details_val: params.details,
        error_msg: params.error_message,
        cpu_usage_val: params.cpu_usage,
        memory_usage_val: params.memory_usage
      });

      if (error) {
        throw new DatabaseError('Failed to complete processing step', error.code, error);
      }

      // Invalidate cache
      instance.cache.invalidateByTags(['jobs', 'processing_timeline', 'active_jobs']);

      return {
        success: true,
        data: data,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to complete processing step', { 
        timeline_id: params.timeline_id,
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
   * Get processing timeline for job
   */
  static async getProcessingTimeline(jobId: string): Promise<DatabaseOperationResult<DatabaseProcessingTimeline[]>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.supabaseClient!;
      
      const { data, error } = await client
        .from('processing_timeline')
        .select('*')
        .eq('job_id', jobId)
        .order('step_order', { ascending: true });

      if (error) {
        throw new DatabaseError('Failed to get processing timeline', error.code, error);
      }

      return {
        success: true,
        data: data || [],
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get processing timeline', { 
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

  // ============================================================================
  // STORAGE OPERATIONS TRACKING
  // ============================================================================

  /**
   * Log storage operation
   */
  static async logStorageOperation(params: LogStorageOperationParams): Promise<DatabaseOperationResult<string>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.serviceRoleClient!;
      
      const { data, error } = await client.rpc('log_storage_operation', {
        job_uuid: params.job_id,
        operation_val: params.operation,
        bucket_val: params.bucket,
        key_val: params.key,
        region_val: params.region || 'us-east-1',
        success_val: params.success !== false,
        file_size_val: params.file_size,
        duration_ms_val: params.duration_ms,
        error_msg: params.error_message,
        metadata_val: params.metadata
      });

      if (error) {
        throw new DatabaseError('Failed to log storage operation', error.code, error);
      }

      // Invalidate cache
      if (params.job_id) {
        instance.cache.invalidate(`job:${params.job_id}`);
      }
      instance.cache.invalidateByTags(['storage_operations', 'job_summary']);

      return {
        success: true,
        data: data,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to log storage operation', { 
        operation: params.operation,
        bucket: params.bucket,
        key: params.key,
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
   * Get storage operations
   */
  static async getStorageOperations(
    filters: StorageOperationFilterOptions = {},
    pagination: PaginationOptions = {}
  ): Promise<DatabaseOperationResult<DatabaseStorageOperation[]>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.supabaseClient!;
      let query = client.from('storage_operations').select('*');

      // Apply filters
      if (filters.job_id) {
        query = query.eq('job_id', filters.job_id);
      }

      if (filters.operation) {
        if (Array.isArray(filters.operation)) {
          query = query.in('operation', filters.operation);
        } else {
          query = query.eq('operation', filters.operation);
        }
      }

      if (filters.bucket) {
        query = query.eq('bucket', filters.bucket);
      }

      if (filters.success !== undefined) {
        query = query.eq('success', filters.success);
      }

      if (filters.created_after) {
        query = query.gte('created_at', filters.created_after);
      }

      if (filters.created_before) {
        query = query.lte('created_at', filters.created_before);
      }

      // Apply pagination
      const page = pagination.page || 1;
      const limit = Math.min(pagination.limit || 50, 100);
      const offset = (page - 1) * limit;

      query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        throw new DatabaseError('Failed to get storage operations', error.code, error);
      }

      return {
        success: true,
        data: data || [],
        count: count || 0,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get storage operations', { 
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

  // ============================================================================
  // SYSTEM METRICS
  // ============================================================================

  /**
   * Record system metric
   */
  static async recordSystemMetric(params: RecordSystemMetricParams): Promise<DatabaseOperationResult<string>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.serviceRoleClient!;
      
      const { data, error } = await client.rpc('record_system_metric', {
        metric_name_val: params.metric_name,
        metric_type_val: params.metric_type,
        value_val: params.value,
        unit_val: params.unit,
        labels_val: params.labels
      });

      if (error) {
        throw new DatabaseError('Failed to record system metric', error.code, error);
      }

      return {
        success: true,
        data: data,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      // Don't log errors for metrics to avoid recursion
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime
      };
    }
  }

  // ============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to job status changes
   */
  static subscribeToJobStatusChanges(
    callback: (payload: JobStatusChangeNotification) => void,
    jobId?: string
  ): string {
    const instance = DatabaseService.getInstance();
    const client = instance.supabaseClient!;
    
    const channelName = jobId ? `job_status_${jobId}` : 'job_status_all';
    
    const channel = client.channel(channelName);
    
    let subscription = channel.on('postgres_changes' as any, {
      event: '*',
      schema: 'public',
      table: 'jobs',
      filter: jobId ? `id=eq.${jobId}` : undefined
    }, (payload: any) => {
      try {
        const notification: JobStatusChangeNotification = {
          job_id: payload.new?.id || payload.old?.id,
          old_status: payload.old?.status,
          new_status: payload.new?.status,
          progress_percentage: payload.new?.progress_percentage || 0,
          current_step: payload.new?.current_step,
          result_url: payload.new?.result_url,
          error_message: payload.new?.error_message,
          updated_at: payload.new?.updated_at || new Date().toISOString()
        };
        
        callback(notification);
      } catch (error) {
        logger.error('Error processing job status change notification', { error });
      }
    });

    subscription.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logger.info('Subscribed to job status changes', { channel: channelName });
      } else if (status === 'CHANNEL_ERROR') {
        logger.error('Job status subscription error', { channel: channelName });
      }
    });

    instance.subscriptions.set(channelName, channel);
    return channelName;
  }

  /**
   * Subscribe to processing timeline updates
   */
  static subscribeToProcessingTimelineUpdates(
    callback: (payload: ProcessingTimelineUpdateNotification) => void,
    jobId?: string
  ): string {
    const instance = DatabaseService.getInstance();
    const client = instance.supabaseClient!;
    
    const channelName = jobId ? `timeline_${jobId}` : 'timeline_all';
    
    const channel = client.channel(channelName);
    
    let subscription = channel.on('postgres_changes' as any, {
      event: '*',
      schema: 'public',
      table: 'processing_timeline',
      filter: jobId ? `job_id=eq.${jobId}` : undefined
    }, (payload: any) => {
      try {
        const notification: ProcessingTimelineUpdateNotification = {
          timeline_id: payload.new?.id || payload.old?.id,
          job_id: payload.new?.job_id || payload.old?.job_id,
          step: payload.new?.step || payload.old?.step,
          step_order: payload.new?.step_order || payload.old?.step_order,
          started_at: payload.new?.started_at || payload.old?.started_at,
          completed_at: payload.new?.completed_at,
          success: payload.new?.success,
          progress_percentage: payload.new?.progress_percentage || 0,
          error_message: payload.new?.error_message
        };
        
        callback(notification);
      } catch (error) {
        logger.error('Error processing timeline update notification', { error });
      }
    });

    subscription.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logger.info('Subscribed to processing timeline updates', { channel: channelName });
      } else if (status === 'CHANNEL_ERROR') {
        logger.error('Processing timeline subscription error', { channel: channelName });
      }
    });

    instance.subscriptions.set(channelName, channel);
    return channelName;
  }

  /**
   * Unsubscribe from channel
   */
  static async unsubscribe(channelName: string): Promise<void> {
    const instance = DatabaseService.getInstance();
    const channel = instance.subscriptions.get(channelName);
    
    if (channel) {
      await channel.unsubscribe();
      instance.subscriptions.delete(channelName);
      logger.info('Unsubscribed from channel', { channel: channelName });
    }
  }

  // ============================================================================
  // TRANSACTION HANDLING
  // ============================================================================

  /**
   * Execute a transaction with automatic rollback on failure
   */
  static async executeTransaction<T>(
    callback: (client: SupabaseClient) => Promise<T>
  ): Promise<TransactionResult<T>> {
    const instance = DatabaseService.getInstance();
    const client = instance.serviceRoleClient!;
    const startTime = Date.now();

    try {
      // Begin transaction
      const { error: beginError } = await client.rpc('begin_transaction');
      if (beginError) {
        throw new TransactionError('Failed to begin transaction', beginError.message);
      }

      let result: T;
      try {
        // Execute callback
        result = await callback(client);
        
        // Commit transaction
        const { error: commitError } = await client.rpc('commit_transaction');
        if (commitError) {
          throw new TransactionError('Failed to commit transaction', commitError.message);
        }

        logger.info('Transaction completed successfully', { duration_ms: Date.now() - startTime });

        return {
          success: true,
          data: result
        };
      } catch (callbackError) {
        // Rollback transaction
        const { error: rollbackError } = await client.rpc('rollback_transaction');
        if (rollbackError) {
          logger.error('Failed to rollback transaction', { error: rollbackError });
        }

        throw callbackError;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Transaction failed', { 
        error: error instanceof Error ? error.message : String(error), 
        duration_ms: duration 
      });

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          rollback_reason: error instanceof TransactionError ? (error.rollbackReason || undefined) : undefined
        };
    }
  }

  // ============================================================================
  // ANALYTICS AND REPORTING
  // ============================================================================

  /**
   * Get job statistics
   */
  static async getJobStatistics(
    startDate?: string,
    endDate?: string
  ): Promise<DatabaseOperationResult<JobStatistics>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.supabaseClient!;
      
      const { data, error } = await client.rpc('get_job_statistics', {
        start_date: startDate,
        end_date: endDate
      });

      if (error) {
        throw new DatabaseError('Failed to get job statistics', error.code, error);
      }

      return {
        success: true,
        data: data[0],
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get job statistics', { 
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
   * Get storage statistics
   */
  static async getStorageStatistics(
    startDate?: string,
    endDate?: string
  ): Promise<DatabaseOperationResult<StorageStatistics>> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();

    try {
      const client = instance.supabaseClient!;
      
      const { data, error } = await client.rpc('get_storage_statistics', {
        start_date: startDate,
        end_date: endDate
      });

      if (error) {
        throw new DatabaseError('Failed to get storage statistics', error.code, error);
      }

      return {
        success: true,
        data: data[0],
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get storage statistics', { 
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

  // ============================================================================
  // HEALTH CHECKING
  // ============================================================================

  /**
   * Comprehensive database health check
   */
  static async healthCheck(): Promise<DatabaseHealthCheck> {
    const instance = DatabaseService.getInstance();
    const startTime = Date.now();
    
    const result: DatabaseHealthCheck = {
      status: 'healthy',
      response_time_ms: 0,
      checks: {
        connection: false,
        read_operations: false,
        write_operations: false,
        real_time: false
      },
      timestamp: new Date().toISOString()
    };

    try {
      // Test connection
      if (!instance.isConnected || !instance.supabaseClient) {
        throw new Error('Database not connected');
      }
      result.checks.connection = true;

      // Test read operations
      const { error: readError } = await instance.supabaseClient
        .from('jobs')
        .select('count')
        .limit(1);
      
      if (readError) {
        throw new Error(`Read test failed: ${readError.message}`);
      }
      result.checks.read_operations = true;

      // Test write operations (system metric)
      const { error: writeError } = await instance.serviceRoleClient!
        .rpc('record_system_metric', {
          metric_name_val: 'health_check',
          metric_type_val: 'counter',
          value_val: 1,
          labels_val: { source: 'health_check' }
        });

      if (writeError) {
        throw new Error(`Write test failed: ${writeError.message}`);
      }
      result.checks.write_operations = true;

      // Test real-time (check if we can create a channel)
      try {
        const testChannel = instance.supabaseClient.channel('health_test');
        await testChannel.subscribe();
        await testChannel.unsubscribe();
        result.checks.real_time = true;
      } catch (realtimeError) {
        logger.warn('Real-time test failed', { error: realtimeError });
        result.checks.real_time = false;
      }

      result.response_time_ms = Date.now() - startTime;

      // Determine overall status
      const failedChecks = Object.values(result.checks).filter(check => !check).length;
      if (failedChecks === 0) {
        result.status = 'healthy';
      } else if (failedChecks <= 1) {
        result.status = 'degraded';
      } else {
        result.status = 'unhealthy';
      }

    } catch (error) {
      result.status = 'unhealthy';
      result.error = error instanceof Error ? error.message : String(error);
      result.response_time_ms = Date.now() - startTime;
      
      logger.error('Database health check failed', { error: result.error });
    }

    return result;
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; hit_rate?: number } {
    const instance = DatabaseService.getInstance();
    return {
      size: instance.cache.size()
    };
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    const instance = DatabaseService.getInstance();
    instance.cache.clear();
    logger.info('Database cache cleared');
  }

  /**
   * Invalidate cache by pattern
   */
  static invalidateCache(pattern: string): void {
    const instance = DatabaseService.getInstance();
    instance.cache.invalidate(pattern);
    logger.info('Cache invalidated', { pattern });
  }
}
