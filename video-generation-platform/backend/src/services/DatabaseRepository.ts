/**
 * Database Repository Service
 * Provides convenient repository patterns for common database operations
 */

import { DatabaseService } from './DatabaseService';
import { logger } from '@/utils/logger';
import {
  DatabaseJob,
  DatabaseElement,
  JobSummary,
  JobStatusRealtime,
  ActiveJob,
  JobStatus,
  JobFilterOptions,
  PaginationOptions,
  DatabaseOperationResult
} from '@/types/database';

/**
 * Job Repository - High-level job operations
 */
export class JobRepository {
  
  /**
   * Find jobs by status with caching
   */
  static async findByStatus(
    status: JobStatus | JobStatus[],
    pagination: PaginationOptions = {}
  ): Promise<DatabaseOperationResult<DatabaseJob[]>> {
    return DatabaseService.listJobs(
      { status },
      pagination
    );
  }

  /**
   * Find active jobs (pending or processing)
   */
  static async findActive(
    pagination: PaginationOptions = {}
  ): Promise<DatabaseOperationResult<DatabaseJob[]>> {
    return DatabaseService.listJobs(
      { status: ['pending', 'processing'] },
      pagination
    );
  }

  /**
   * Find jobs by client IP
   */
  static async findByClientIp(
    clientIp: string,
    pagination: PaginationOptions = {}
  ): Promise<DatabaseOperationResult<DatabaseJob[]>> {
    return DatabaseService.listJobs(
      { client_ip: clientIp },
      pagination
    );
  }

  /**
   * Find jobs created in date range
   */
  static async findByDateRange(
    startDate: string,
    endDate: string,
    pagination: PaginationOptions = {}
  ): Promise<DatabaseOperationResult<DatabaseJob[]>> {
    return DatabaseService.listJobs(
      { 
        created_after: startDate,
        created_before: endDate
      },
      pagination
    );
  }

  /**
   * Find failed jobs with errors
   */
  static async findFailedJobs(
    pagination: PaginationOptions = {}
  ): Promise<DatabaseOperationResult<DatabaseJob[]>> {
    return DatabaseService.listJobs(
      { 
        status: 'failed',
        has_errors: true
      },
      pagination
    );
  }

  /**
   * Get job with full details (elements, timeline, storage operations)
   */
  static async getJobWithDetails(jobId: string): Promise<DatabaseOperationResult<{
    job: DatabaseJob;
    elements: DatabaseElement[];
    timeline: any[];
    storageOperations: any[];
  }>> {
    const startTime = Date.now();

    try {
      // Fetch all related data in parallel
      const [jobResult, elementsResult, timelineResult, storageResult] = await Promise.all([
        DatabaseService.getJob(jobId),
        DatabaseService.getJobElements(jobId),
        DatabaseService.getProcessingTimeline(jobId),
        DatabaseService.getStorageOperations({ job_id: jobId })
      ]);

      if (!jobResult.success || !jobResult.data) {
        return {
          success: false,
          error: jobResult.error || 'Job not found',
          duration_ms: Date.now() - startTime
        };
      }

      return {
        success: true,
        data: {
          job: jobResult.data,
          elements: elementsResult.data || [],
          timeline: timelineResult.data || [],
          storageOperations: storageResult.data || []
        },
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get job with details', {
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
}

/**
 * Analytics Repository - Analytics and reporting operations
 */
export class AnalyticsRepository {
  
  /**
   * Get comprehensive system statistics
   */
  static async getSystemStats(
    startDate?: string,
    endDate?: string
  ): Promise<DatabaseOperationResult<{
    jobs: any;
    storage: any;
    system_health: any;
  }>> {
    const startTime = Date.now();

    try {
      // Fetch all statistics in parallel
      const [jobStats, storageStats, systemHealth] = await Promise.all([
        DatabaseService.getJobStatistics(startDate, endDate),
        DatabaseService.getStorageStatistics(startDate, endDate),
        this.getSystemHealthMetrics()
      ]);

      return {
        success: true,
        data: {
          jobs: jobStats.data,
          storage: storageStats.data,
          system_health: systemHealth.data
        },
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get system statistics', {
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
   * Get processing performance metrics
   */
  static async getProcessingMetrics(
    startDate?: string,
    endDate?: string
  ): Promise<DatabaseOperationResult<{
    avg_processing_time: number;
    success_rate: number;
    throughput: number;
    error_rate: number;
  }>> {
    const startTime = Date.now();

    try {
      const client = DatabaseService.getServiceRoleClient();
      
      const { data, error } = await client
        .from('jobs')
        .select('status, actual_duration, created_at, response_type')
        .gte('created_at', startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', endDate || new Date().toISOString());

      if (error) {
        throw new Error(`Failed to get processing metrics: ${error.message}`);
      }

      const jobs = data || [];
      const completedJobs = jobs.filter(j => j.status === 'completed');
      const failedJobs = jobs.filter(j => j.status === 'failed');
      
      const avgProcessingTime = completedJobs.length > 0 
        ? completedJobs.reduce((sum, job) => sum + (job.actual_duration || 0), 0) / completedJobs.length
        : 0;

      const successRate = jobs.length > 0 
        ? (completedJobs.length / jobs.length) * 100
        : 0;

      const errorRate = jobs.length > 0 
        ? (failedJobs.length / jobs.length) * 100
        : 0;

      // Calculate throughput (jobs per hour)
      const timeRangeHours = startDate && endDate 
        ? (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60)
        : 24;
      
      const throughput = jobs.length / timeRangeHours;

      return {
        success: true,
        data: {
          avg_processing_time: avgProcessingTime,
          success_rate: successRate,
          throughput: throughput,
          error_rate: errorRate
        },
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get processing metrics', {
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
   * Get system health metrics
   */
  private static async getSystemHealthMetrics(): Promise<DatabaseOperationResult<any>> {
    const startTime = Date.now();

    try {
      const client = DatabaseService.getServiceRoleClient();
      
      // Get recent system metrics
      const { data, error } = await client
        .from('system_metrics')
        .select('*')
        .gte('recorded_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('recorded_at', { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(`Failed to get system health metrics: ${error.message}`);
      }

      // Process metrics into health indicators
      const metrics = data || [];
      const healthData = {
        total_metrics: metrics.length,
        error_rate: metrics.filter(m => m.metric_name.includes('error')).length,
        performance_issues: metrics.filter(m => m.metric_name.includes('slow') || m.metric_name.includes('timeout')).length,
        last_updated: metrics.length > 0 ? metrics[0].recorded_at : null
      };

      return {
        success: true,
        data: healthData,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      };
    }
  }
}

/**
 * Subscription Repository - Real-time subscription management
 */
export class SubscriptionRepository {
  private static subscriptions = new Map<string, string>();

  /**
   * Subscribe to job status updates for a specific job
   */
  static subscribeToJob(
    jobId: string,
    callback: (notification: any) => void
  ): string {
    const subscriptionId = DatabaseService.subscribeToJobStatusChanges(
      callback,
      jobId
    );

    this.subscriptions.set(jobId, subscriptionId);
    
    logger.info('Subscribed to job updates', { job_id: jobId, subscription_id: subscriptionId });
    
    return subscriptionId;
  }

  /**
   * Subscribe to all job status updates
   */
  static subscribeToAllJobs(
    callback: (notification: any) => void
  ): string {
    const subscriptionId = DatabaseService.subscribeToJobStatusChanges(callback);
    
    this.subscriptions.set('all_jobs', subscriptionId);
    
    logger.info('Subscribed to all job updates', { subscription_id: subscriptionId });
    
    return subscriptionId;
  }

  /**
   * Subscribe to processing timeline updates
   */
  static subscribeToProcessingUpdates(
    jobId: string,
    callback: (notification: any) => void
  ): string {
    const subscriptionId = DatabaseService.subscribeToProcessingTimelineUpdates(
      callback,
      jobId
    );

    this.subscriptions.set(`timeline_${jobId}`, subscriptionId);
    
    logger.info('Subscribed to processing timeline updates', { 
      job_id: jobId, 
      subscription_id: subscriptionId 
    });
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from updates
   */
  static async unsubscribe(key: string): Promise<void> {
    const subscriptionId = this.subscriptions.get(key);
    
    if (subscriptionId) {
      await DatabaseService.unsubscribe(subscriptionId);
      this.subscriptions.delete(key);
      
      logger.info('Unsubscribed from updates', { key, subscription_id: subscriptionId });
    }
  }

  /**
   * Unsubscribe from all active subscriptions
   */
  static async unsubscribeAll(): Promise<void> {
    const promises = Array.from(this.subscriptions.entries()).map(
      ([key, subscriptionId]) => DatabaseService.unsubscribe(subscriptionId)
    );

    await Promise.allSettled(promises);
    this.subscriptions.clear();
    
    logger.info('Unsubscribed from all updates');
  }

  /**
   * Get active subscriptions count
   */
  static getActiveSubscriptionsCount(): number {
    return this.subscriptions.size;
  }
}

/**
 * Cache Repository - Database cache management
 */
export class CacheRepository {
  
  /**
   * Warm up cache with frequently accessed data
   */
  static async warmUpCache(): Promise<void> {
    const startTime = Date.now();

    try {
      // Pre-load active jobs
      await DatabaseService.listJobs({ status: ['pending', 'processing'] }, { limit: 50 });
      
      // Pre-load recent job statistics
      await DatabaseService.getJobStatistics();
      
      // Pre-load storage statistics
      await DatabaseService.getStorageStatistics();

      logger.info('Cache warmed up successfully', { duration_ms: Date.now() - startTime });
    } catch (error) {
      logger.error('Failed to warm up cache', {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime
      });
    }
  }

  /**
   * Clear all cache
   */
  static clearCache(): void {
    DatabaseService.clearCache();
    logger.info('Database cache cleared');
  }

  /**
   * Invalidate cache for specific job
   */
  static invalidateJobCache(jobId: string): void {
    DatabaseService.invalidateCache(`job:${jobId}`);
    logger.info('Job cache invalidated', { job_id: jobId });
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return DatabaseService.getCacheStats();
  }
}

/**
 * Maintenance Repository - Database maintenance operations
 */
export class MaintenanceRepository {
  
  /**
   * Run database maintenance tasks
   */
  static async runMaintenance(): Promise<{
    jobs_cleaned: number;
    metrics_cleaned: number;
    cache_cleared: boolean;
    duration_ms: number;
  }> {
    const startTime = Date.now();

    try {
      const client = DatabaseService.getServiceRoleClient();
      
      // Run cleanup functions in parallel
      const [jobsResult, metricsResult] = await Promise.all([
        client.rpc('cleanup_old_jobs', { days_old: 30 }),
        client.rpc('cleanup_old_metrics', { days_old: 7 })
      ]);

      // Clear cache
      DatabaseService.clearCache();

      const result = {
        jobs_cleaned: jobsResult.data || 0,
        metrics_cleaned: metricsResult.data || 0,
        cache_cleared: true,
        duration_ms: Date.now() - startTime
      };

      logger.info('Database maintenance completed', result);
      
      return result;
    } catch (error) {
      logger.error('Database maintenance failed', {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime
      });

      return {
        jobs_cleaned: 0,
        metrics_cleaned: 0,
        cache_cleared: false,
        duration_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Analyze database performance
   */
  static async analyzePerformance(): Promise<{
    slow_queries: any[];
    table_sizes: any[];
    index_usage: any[];
    connection_stats: any;
  }> {
    const startTime = Date.now();

    try {
      const client = DatabaseService.getServiceRoleClient();
      
      // Get slow queries from pg_stat_statements (if available)
      let slowQueries: any[] = [];
      try {
        const slowQueriesResult = await client.rpc('get_slow_queries');
        slowQueries = slowQueriesResult.data || [];
      } catch {
        // Function may not exist, continue
      }

      // Get table sizes (if available)
      let tableSizes: any[] = [];
      try {
        const tableSizesResult = await client.rpc('get_table_sizes');
        tableSizes = tableSizesResult.data || [];
      } catch {
        // Function may not exist, continue
      }

      // Get index usage (if available)
      let indexUsage: any[] = [];
      try {
        const indexUsageResult = await client.rpc('get_index_usage');
        indexUsage = indexUsageResult.data || [];
      } catch {
        // Function may not exist, continue
      }

      const result = {
        slow_queries: slowQueries || [],
        table_sizes: tableSizes || [],
        index_usage: indexUsage || [],
        connection_stats: {
          active_connections: 0, // Would need custom monitoring
          idle_connections: 0,
          max_connections: 0
        }
      };

      logger.info('Database performance analysis completed', {
        slow_queries_count: result.slow_queries.length,
        tables_analyzed: result.table_sizes.length,
        duration_ms: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('Database performance analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime
      });

      return {
        slow_queries: [],
        table_sizes: [],
        index_usage: [],
        connection_stats: {
          active_connections: 0,
          idle_connections: 0,
          max_connections: 0
        }
      };
    }
  }
}
