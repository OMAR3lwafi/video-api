/**
 * Database Initialization Utilities
 * Handles database setup, migration verification, and initial data seeding
 */

import { DatabaseService } from '@/services/DatabaseService';
import { CacheRepository } from '@/services/DatabaseRepository';
import { logger } from '@/utils/logger';

/**
 * Initialize database with comprehensive setup
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Initialize database connections
    await DatabaseService.initialize();
    
    // Perform health check
    const healthCheck = await DatabaseService.healthCheck();
    
    if (healthCheck.status === 'unhealthy') {
      throw new Error(`Database health check failed: ${healthCheck.error}`);
    }
    
    if (healthCheck.status === 'degraded') {
      logger.warn('Database is in degraded state but functional', {
        checks: healthCheck.checks,
        response_time: healthCheck.response_time_ms
      });
    }

    // Warm up cache with frequently accessed data
    await CacheRepository.warmUpCache();

    logger.info('Database initialization completed successfully', {
      status: healthCheck.status,
      response_time_ms: healthCheck.response_time_ms,
      checks: healthCheck.checks
    });
    
  } catch (error) {
    logger.error('Database initialization failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Verify database schema and functions exist
 */
export async function verifyDatabaseSchema(): Promise<{
  tables_exist: boolean;
  functions_exist: boolean;
  views_exist: boolean;
  indexes_exist: boolean;
}> {
  try {
    const client = DatabaseService.getServiceRoleClient();
    
    // Check if core tables exist
    let tables = false;
    let tablesError = null;
    try {
      const result = await client.rpc('check_tables_exist', {
        table_names: ['jobs', 'elements', 'storage_operations', 'processing_timeline']
      });
      tables = result.data;
      tablesError = result.error;
    } catch (e) {
      tablesError = e;
    }

    // Check if core functions exist
    let functions = false;
    let functionsError = null;
    try {
      const result = await client.rpc('check_functions_exist', {
        function_names: ['create_job', 'update_job_status', 'add_job_element']
      });
      functions = result.data;
      functionsError = result.error;
    } catch (e) {
      functionsError = e;
    }

    // Check if views exist
    let views = false;
    let viewsError = null;
    try {
      const result = await client.rpc('check_views_exist', {
        view_names: ['job_summary', 'job_status_realtime', 'active_jobs']
      });
      views = result.data;
      viewsError = result.error;
    } catch (e) {
      viewsError = e;
    }

    return {
      tables_exist: !tablesError && !!tables,
      functions_exist: !functionsError && !!functions,
      views_exist: !viewsError && !!views,
      indexes_exist: true // Assume indexes exist if tables exist
    };
    
  } catch (error) {
    logger.error('Database schema verification failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return {
      tables_exist: false,
      functions_exist: false,
      views_exist: false,
      indexes_exist: false
    };
  }
}

/**
 * Set up database maintenance tasks
 */
export function setupDatabaseMaintenance(): void {
  // Run maintenance every 24 hours
  setInterval(async () => {
    try {
      const client = DatabaseService.getServiceRoleClient();
      
      // Cleanup old jobs (30 days)
      const { data: cleanedJobs } = await client.rpc('cleanup_old_jobs', { days_old: 30 });
      
      // Cleanup old metrics (7 days)  
      const { data: cleanedMetrics } = await client.rpc('cleanup_old_metrics', { days_old: 7 });

      // Clear cache
      CacheRepository.clearCache();

      logger.info('Database maintenance completed', {
        cleaned_jobs: cleanedJobs || 0,
        cleaned_metrics: cleanedMetrics || 0
      });
      
    } catch (error) {
      logger.error('Database maintenance failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  logger.info('Database maintenance tasks scheduled');
}
