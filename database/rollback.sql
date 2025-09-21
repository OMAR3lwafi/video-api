-- Dynamic Video Content Generation Platform - Database Rollback Script
-- File: rollback.sql
-- Description: Complete rollback script to remove all database objects

-- ============================================================================
-- ROLLBACK WARNING
-- ============================================================================

-- This script will completely remove all database objects created by the migration
-- Use with extreme caution in production environments
-- Ensure you have proper backups before running this script

-- ============================================================================
-- DISABLE ROW LEVEL SECURITY
-- ============================================================================

-- Disable RLS on all tables (if they exist)
DO $$
BEGIN
    -- Disable RLS and drop policies
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'jobs') THEN
        ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "jobs_insert_public" ON jobs;
        DROP POLICY IF EXISTS "jobs_select_own_ip" ON jobs;
        DROP POLICY IF EXISTS "jobs_all_service" ON jobs;
        DROP POLICY IF EXISTS "jobs_all_admin" ON jobs;
        DROP POLICY IF EXISTS "jobs_update_own_ip" ON jobs;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'elements') THEN
        ALTER TABLE elements DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "elements_insert_own_job" ON elements;
        DROP POLICY IF EXISTS "elements_select_own_job" ON elements;
        DROP POLICY IF EXISTS "elements_update_service" ON elements;
        DROP POLICY IF EXISTS "elements_all_admin" ON elements;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'storage_operations') THEN
        ALTER TABLE storage_operations DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "storage_operations_insert_service" ON storage_operations;
        DROP POLICY IF EXISTS "storage_operations_select_own_job" ON storage_operations;
        DROP POLICY IF EXISTS "storage_operations_all_service" ON storage_operations;
        DROP POLICY IF EXISTS "storage_operations_all_admin" ON storage_operations;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'processing_timeline') THEN
        ALTER TABLE processing_timeline DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "processing_timeline_insert_service" ON processing_timeline;
        DROP POLICY IF EXISTS "processing_timeline_select_own_job" ON processing_timeline;
        DROP POLICY IF EXISTS "processing_timeline_update_service" ON processing_timeline;
        DROP POLICY IF EXISTS "processing_timeline_all_admin" ON processing_timeline;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'url_access_logs') THEN
        ALTER TABLE url_access_logs DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "url_access_logs_insert_service" ON url_access_logs;
        DROP POLICY IF EXISTS "url_access_logs_select_own_job" ON url_access_logs;
        DROP POLICY IF EXISTS "url_access_logs_all_admin" ON url_access_logs;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'system_metrics') THEN
        ALTER TABLE system_metrics DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "system_metrics_insert_service" ON system_metrics;
        DROP POLICY IF EXISTS "system_metrics_select_admin" ON system_metrics;
        DROP POLICY IF EXISTS "system_metrics_all_admin" ON system_metrics;
    END IF;
END $$;

-- ============================================================================
-- DROP VIEWS
-- ============================================================================

DROP VIEW IF EXISTS job_progress_subscription CASCADE;
DROP VIEW IF EXISTS error_analysis CASCADE;
DROP VIEW IF EXISTS system_health CASCADE;
DROP VIEW IF EXISTS storage_performance CASCADE;
DROP VIEW IF EXISTS element_type_stats CASCADE;
DROP VIEW IF EXISTS hourly_processing_load CASCADE;
DROP VIEW IF EXISTS daily_job_stats CASCADE;
DROP VIEW IF EXISTS active_jobs CASCADE;
DROP VIEW IF EXISTS job_status_realtime CASCADE;
DROP VIEW IF EXISTS job_summary CASCADE;

-- ============================================================================
-- DROP TRIGGERS
-- ============================================================================

-- Drop notification triggers
DROP TRIGGER IF EXISTS trigger_notify_processing_timeline_update ON processing_timeline;
DROP TRIGGER IF EXISTS trigger_notify_job_status_change ON jobs;

-- Drop cleanup triggers
DROP TRIGGER IF EXISTS trigger_cleanup_job_data ON jobs;

-- Drop validation triggers
DROP TRIGGER IF EXISTS trigger_validate_system_metric ON system_metrics;
DROP TRIGGER IF EXISTS trigger_update_job_s3_info ON storage_operations;
DROP TRIGGER IF EXISTS trigger_validate_storage_operation ON storage_operations;
DROP TRIGGER IF EXISTS trigger_validate_processing_timeline ON processing_timeline;
DROP TRIGGER IF EXISTS trigger_validate_element_constraints ON elements;
DROP TRIGGER IF EXISTS trigger_validate_job_progress ON jobs;
DROP TRIGGER IF EXISTS trigger_validate_job_status_transition ON jobs;

-- Drop timestamp triggers
DROP TRIGGER IF EXISTS trigger_processing_timeline_updated_at ON processing_timeline;
DROP TRIGGER IF EXISTS trigger_elements_updated_at ON elements;
DROP TRIGGER IF EXISTS trigger_jobs_updated_at ON jobs;

-- ============================================================================
-- DROP FUNCTIONS
-- ============================================================================

-- Drop security and auth functions
DROP FUNCTION IF EXISTS enforce_data_retention();
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, INTEGER, INTERVAL);
DROP FUNCTION IF EXISTS log_security_event(TEXT, JSONB);
DROP FUNCTION IF EXISTS auth.can_subscribe_to_job(UUID);
DROP FUNCTION IF EXISTS auth.client_ip();
DROP FUNCTION IF EXISTS auth.is_service();
DROP FUNCTION IF EXISTS auth.is_admin();
DROP FUNCTION IF EXISTS auth.user_id();
DROP FUNCTION IF EXISTS auth.user_role();

-- Drop notification trigger functions
DROP FUNCTION IF EXISTS notify_processing_timeline_update();
DROP FUNCTION IF EXISTS notify_job_status_change();
DROP FUNCTION IF EXISTS cleanup_job_data();

-- Drop validation trigger functions
DROP FUNCTION IF EXISTS validate_system_metric();
DROP FUNCTION IF EXISTS update_job_s3_info();
DROP FUNCTION IF EXISTS validate_storage_operation();
DROP FUNCTION IF EXISTS validate_processing_timeline();
DROP FUNCTION IF EXISTS validate_element_constraints();
DROP FUNCTION IF EXISTS validate_job_progress();
DROP FUNCTION IF EXISTS validate_job_status_transition();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop cleanup functions
DROP FUNCTION IF EXISTS cleanup_old_metrics(INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_jobs(INTEGER);

-- Drop analytics functions
DROP FUNCTION IF EXISTS record_system_metric(VARCHAR(100), VARCHAR(50), DECIMAL(15,6), VARCHAR(20), JSONB);
DROP FUNCTION IF EXISTS get_storage_statistics(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_job_statistics(TIMESTAMPTZ, TIMESTAMPTZ);

-- Drop storage operation functions
DROP FUNCTION IF EXISTS log_storage_operation(UUID, storage_operation, VARCHAR(255), VARCHAR(500), VARCHAR(50), BOOLEAN, BIGINT, INTEGER, TEXT, JSONB);

-- Drop timeline tracking functions
DROP FUNCTION IF EXISTS complete_processing_step(UUID, BOOLEAN, INTEGER, JSONB, TEXT, DECIMAL(5,2), BIGINT);
DROP FUNCTION IF EXISTS start_processing_step(UUID, processing_step, INTEGER, JSONB);

-- Drop element management functions
DROP FUNCTION IF EXISTS update_element_status(UUID, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, BIGINT, DECIMAL(10,3));
DROP FUNCTION IF EXISTS add_job_element(UUID, element_type, TEXT, INTEGER, INTEGER, VARCHAR(10), VARCHAR(10), VARCHAR(10), VARCHAR(10), fit_mode, DECIMAL(10,3), DECIMAL(10,3), JSONB);

-- Drop job management functions
DROP FUNCTION IF EXISTS update_job_progress(UUID, INTEGER, processing_step);
DROP FUNCTION IF EXISTS update_job_status(UUID, job_status, TEXT, VARCHAR(50));
DROP FUNCTION IF EXISTS create_job(VARCHAR(10), INTEGER, INTEGER, INTEGER, INET, TEXT, JSONB);

-- Drop utility functions
DROP FUNCTION IF EXISTS calculate_job_progress(UUID);
DROP FUNCTION IF EXISTS calculate_job_duration(UUID);

-- ============================================================================
-- DROP TABLES (IN REVERSE DEPENDENCY ORDER)
-- ============================================================================

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS system_metrics CASCADE;
DROP TABLE IF EXISTS url_access_logs CASCADE;
DROP TABLE IF EXISTS processing_timeline CASCADE;
DROP TABLE IF EXISTS storage_operations CASCADE;
DROP TABLE IF EXISTS elements CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;

-- ============================================================================
-- DROP CUSTOM TYPES (ENUMS)
-- ============================================================================

DROP TYPE IF EXISTS response_type CASCADE;
DROP TYPE IF EXISTS storage_operation CASCADE;
DROP TYPE IF EXISTS processing_step CASCADE;
DROP TYPE IF EXISTS fit_mode CASCADE;
DROP TYPE IF EXISTS element_type CASCADE;
DROP TYPE IF EXISTS job_status CASCADE;

-- ============================================================================
-- REMOVE EXTENSIONS (OPTIONAL)
-- ============================================================================

-- Note: Only drop extensions if they're not used by other parts of the system
-- DROP EXTENSION IF EXISTS "pg_stat_statements";
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all objects have been removed
DO $$
DECLARE
    remaining_tables INTEGER;
    remaining_functions INTEGER;
    remaining_views INTEGER;
    remaining_types INTEGER;
BEGIN
    -- Count remaining tables from our migration
    SELECT COUNT(*) INTO remaining_tables
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('jobs', 'elements', 'storage_operations', 'processing_timeline', 'url_access_logs', 'system_metrics');
    
    -- Count remaining functions from our migration
    SELECT COUNT(*) INTO remaining_functions
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN ('create_job', 'update_job_status', 'add_job_element', 'start_processing_step', 'complete_processing_step');
    
    -- Count remaining views from our migration
    SELECT COUNT(*) INTO remaining_views
    FROM information_schema.views 
    WHERE table_schema = 'public'
    AND table_name IN ('job_summary', 'job_status_realtime', 'active_jobs', 'daily_job_stats', 'system_health');
    
    -- Count remaining custom types from our migration
    SELECT COUNT(*) INTO remaining_types
    FROM pg_type 
    WHERE typtype = 'e'
    AND typname IN ('job_status', 'element_type', 'fit_mode', 'processing_step', 'storage_operation', 'response_type');
    
    -- Report results
    IF remaining_tables > 0 THEN
        RAISE NOTICE 'Warning: % tables still exist', remaining_tables;
    END IF;
    
    IF remaining_functions > 0 THEN
        RAISE NOTICE 'Warning: % functions still exist', remaining_functions;
    END IF;
    
    IF remaining_views > 0 THEN
        RAISE NOTICE 'Warning: % views still exist', remaining_views;
    END IF;
    
    IF remaining_types > 0 THEN
        RAISE NOTICE 'Warning: % custom types still exist', remaining_types;
    END IF;
    
    IF remaining_tables = 0 AND remaining_functions = 0 AND remaining_views = 0 AND remaining_types = 0 THEN
        RAISE NOTICE 'Rollback completed successfully - all migration objects removed';
    ELSE
        RAISE NOTICE 'Rollback completed with warnings - some objects may still exist';
    END IF;
END $$;

-- ============================================================================
-- CLEANUP SYSTEM CATALOG
-- ============================================================================

-- Clean up any remaining references
VACUUM FULL pg_proc;
VACUUM FULL pg_class;
VACUUM FULL pg_type;

-- ============================================================================
-- FINAL MESSAGE
-- ============================================================================

SELECT 
    'Database rollback completed' as status,
    NOW() as completed_at,
    'All migration objects have been removed' as message;
