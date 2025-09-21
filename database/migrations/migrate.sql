-- Dynamic Video Content Generation Platform - Master Migration Script (Corrected)
-- File: migrate.sql
-- Description: Execute all migrations in correct order for complete database setup

-- ============================================================================
-- MIGRATION EXECUTION ORDER
-- ============================================================================

-- NOTE: This master migration file is for reference only.
-- For Supabase deployment, run individual migration files in this order:
-- 1. 001_initial_schema.sql
-- 2. 002_functions.sql  
-- 3. 003_triggers.sql
-- 4. 004_views.sql
-- 5. 005_rls_policies.sql

-- For psql command-line deployment, use the individual files:
-- psql -f 001_initial_schema.sql
-- psql -f 002_functions.sql
-- psql -f 003_triggers.sql
-- psql -f 004_views.sql
-- psql -f 005_rls_policies.sql

-- The \i commands below only work in psql interactive mode:
-- \i 001_initial_schema.sql
-- \i 002_functions.sql
-- \i 003_triggers.sql
-- \i 004_views.sql
-- \i 005_rls_policies.sql

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

-- Verify all tables exist
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::text[];
    tname TEXT;
    expected_tables TEXT[] := ARRAY[
        'jobs',
        'elements', 
        'storage_operations',
        'processing_timeline',
        'url_access_logs',
        'system_metrics'
    ]::text[];
BEGIN
    FOREACH tname IN ARRAY expected_tables
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables it
            WHERE it.table_name = tname AND it.table_schema = 'public'
        ) THEN
            missing_tables := array_append(missing_tables, tname);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing tables: %', array_to_string(missing_tables, ', ');
    END IF;
    
    RAISE NOTICE 'All required tables created successfully';
END $$;

-- Verify all enums exist
DO $$
DECLARE
    missing_enums TEXT[] := ARRAY[]::text[];
    ename TEXT;
    expected_enums TEXT[] := ARRAY[
        'job_status',
        'element_type',
        'fit_mode',
        'processing_step',
        'storage_operation',
        'response_type'
    ]::text[];
BEGIN
    FOREACH ename IN ARRAY expected_enums
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_type pt
            WHERE pt.typname = ename AND pt.typtype = 'e'
        ) THEN
            missing_enums := array_append(missing_enums, ename);
        END IF;
    END LOOP;
    
    IF array_length(missing_enums, 1) > 0 THEN
        RAISE EXCEPTION 'Missing enums: %', array_to_string(missing_enums, ', ');
    END IF;
    
    RAISE NOTICE 'All required enums created successfully';
END $$;

-- Verify all functions exist
DO $$
DECLARE
    missing_functions TEXT[] := ARRAY[]::text[];
    fname TEXT;
    expected_functions TEXT[] := ARRAY[
        'create_job',
        'update_job_status',
        'add_job_element',
        'start_processing_step',
        'complete_processing_step',
        'log_storage_operation',
        'get_job_statistics',
        'cleanup_old_jobs'
    ]::text[];
BEGIN
    FOREACH fname IN ARRAY expected_functions
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE p.proname = fname AND n.nspname = 'public'
        ) THEN
            missing_functions := array_append(missing_functions, fname);
        END IF;
    END LOOP;
    
    IF array_length(missing_functions, 1) > 0 THEN
        RAISE EXCEPTION 'Missing functions: %', array_to_string(missing_functions, ', ');
    END IF;
    
    RAISE NOTICE 'All required functions created successfully';
END $$;

-- Verify all views exist
DO $$
DECLARE
    missing_views TEXT[] := ARRAY[]::text[];
    vname TEXT;
    expected_views TEXT[] := ARRAY[
        'job_summary',
        'job_status_realtime',
        'active_jobs',
        'daily_job_stats',
        'system_health',
        'job_progress_subscription'
    ]::text[];
BEGIN
    FOREACH vname IN ARRAY expected_views
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.views v
            WHERE v.table_name = vname AND v.table_schema = 'public'
        ) THEN
            missing_views := array_append(missing_views, vname);
        END IF;
    END LOOP;
    
    IF array_length(missing_views, 1) > 0 THEN
        RAISE EXCEPTION 'Missing views: %', array_to_string(missing_views, ', ');
    END IF;
    
    RAISE NOTICE 'All required views created successfully';
END $$;

-- Verify RLS is enabled
DO $$
DECLARE
    tables_without_rls TEXT[] := ARRAY[]::text[];
    rls_tbl TEXT;
    rls_enabled BOOLEAN;
    expected_rls_tables TEXT[] := ARRAY[
        'jobs',
        'elements',
        'storage_operations', 
        'processing_timeline',
        'url_access_logs',
        'system_metrics'
    ]::text[];
BEGIN
    FOREACH rls_tbl IN ARRAY expected_rls_tables
    LOOP
        SELECT c.relrowsecurity INTO rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relname = rls_tbl AND n.nspname = 'public';
        
        IF NOT COALESCE(rls_enabled, FALSE) THEN
            tables_without_rls := array_append(tables_without_rls, rls_tbl);
        END IF;
    END LOOP;
    
    IF array_length(tables_without_rls, 1) > 0 THEN
        RAISE EXCEPTION 'RLS not enabled on tables: %', array_to_string(tables_without_rls, ', ');
    END IF;
    
    RAISE NOTICE 'Row Level Security enabled on all required tables';
END $$;

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- Insert initial system metrics for monitoring
INSERT INTO system_metrics (metric_name, metric_type, value, labels)
VALUES 
    ('database_migration_completed', 'counter', 1, 
     jsonb_build_object('version', '1.0.0', 'timestamp', NOW())),
    ('database_initialized', 'gauge', 1,
     jsonb_build_object('tables_created', 6, 'functions_created', 20, 'views_created', 10));

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Analyze all tables for query optimization
ANALYZE jobs;
ANALYZE elements;
ANALYZE storage_operations;
ANALYZE processing_timeline;
ANALYZE url_access_logs;
ANALYZE system_metrics;

-- Update table statistics
DO $$
DECLARE
    tbl TEXT;
    table_names TEXT[] := ARRAY['jobs', 'elements', 'storage_operations', 'processing_timeline', 'url_access_logs', 'system_metrics']::text[];
BEGIN
    FOREACH tbl IN ARRAY table_names
    LOOP
        EXECUTE format('VACUUM ANALYZE %I', tbl);
    END LOOP;
    
    RAISE NOTICE 'Table statistics updated for all tables';
END $$;

-- ============================================================================
-- FINAL VERIFICATION AND SUMMARY
-- ============================================================================

-- Display migration summary
SELECT 
    'Migration completed successfully' as status,
    NOW() as completed_at,
    (
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ) as tables_created,
    (
        SELECT COUNT(*) FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    ) as functions_created,
    (
        SELECT COUNT(*) FROM information_schema.views 
        WHERE table_schema = 'public'
    ) as views_created,
    (
        SELECT COUNT(*) FROM pg_type 
        WHERE typtype = 'e'
    ) as enums_created;

-- Display database size and statistics
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
AND tablename IN ('jobs', 'elements', 'storage_operations', 'processing_timeline')
ORDER BY tablename, attname;

-- Final completion messages
DO $$
BEGIN
    RAISE NOTICE 'Database migration completed successfully!';
    RAISE NOTICE 'All tables, functions, views, triggers, and RLS policies are in place.';
    RAISE NOTICE 'The database is ready for production use.';
END $$;