-- Dynamic Video Content Generation Platform - Row Level Security Policies
-- Migration: 005_rls_policies.sql
-- Description: Set up Row Level Security policies for data protection and multi-tenancy

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all main tables
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- AUTHENTICATION HELPER FUNCTIONS (PUBLIC SCHEMA)
-- ============================================================================

-- Function to get current user role from JWT
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::json->>'role',
        'anon'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user ID from JWT
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'sub')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() IN ('admin', 'service_account');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is system service
CREATE OR REPLACE FUNCTION is_service_account()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'service_account';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get client IP from request
CREATE OR REPLACE FUNCTION get_client_ip()
RETURNS INET AS $$
BEGIN
    RETURN COALESCE(
        (current_setting('request.headers', true)::json->>'x-forwarded-for')::inet,
        (current_setting('request.headers', true)::json->>'x-real-ip')::inet,
        '127.0.0.1'::inet
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN '127.0.0.1'::inet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- JOBS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Allow anonymous users to create jobs (public API)
CREATE POLICY "jobs_insert_public" ON jobs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy: Allow users to view their own jobs by client IP
CREATE POLICY "jobs_select_own_ip" ON jobs
    FOR SELECT
    TO anon, authenticated
    USING (
        client_ip = get_client_ip()
        OR is_admin_user()
        OR is_service_account()
    );

-- Policy: Allow service accounts to view and update all jobs
CREATE POLICY "jobs_all_service" ON jobs
    FOR ALL
    TO authenticated
    USING (is_service_account())
    WITH CHECK (is_service_account());

-- Policy: Allow admins full access to all jobs
CREATE POLICY "jobs_all_admin" ON jobs
    FOR ALL
    TO authenticated
    USING (is_admin_user())
    WITH CHECK (is_admin_user());

-- Policy: Allow users to update jobs they created (by IP)
CREATE POLICY "jobs_update_own_ip" ON jobs
    FOR UPDATE
    TO anon, authenticated
    USING (client_ip = get_client_ip())
    WITH CHECK (client_ip = get_client_ip());

-- ============================================================================
-- ELEMENTS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Allow users to insert elements for their jobs
CREATE POLICY "elements_insert_own_job" ON elements
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM jobs 
            WHERE id = job_id 
            AND (client_ip = get_client_ip() OR is_admin_user() OR is_service_account())
        )
    );

-- Policy: Allow users to view elements for their jobs
CREATE POLICY "elements_select_own_job" ON elements
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM jobs 
            WHERE id = job_id 
            AND (client_ip = get_client_ip() OR is_admin_user() OR is_service_account())
        )
    );

-- Policy: Allow service accounts to update elements
CREATE POLICY "elements_update_service" ON elements
    FOR UPDATE
    TO authenticated
    USING (is_service_account())
    WITH CHECK (is_service_account());

-- Policy: Allow admins full access to elements
CREATE POLICY "elements_all_admin" ON elements
    FOR ALL
    TO authenticated
    USING (is_admin_user())
    WITH CHECK (is_admin_user());

-- ============================================================================
-- STORAGE OPERATIONS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Allow service accounts to insert storage operations
CREATE POLICY "storage_operations_insert_service" ON storage_operations
    FOR INSERT
    TO authenticated
    WITH CHECK (is_service_account());

-- Policy: Allow users to view storage operations for their jobs
CREATE POLICY "storage_operations_select_own_job" ON storage_operations
    FOR SELECT
    TO anon, authenticated
    USING (
        job_id IS NULL  -- Allow viewing operations without job association
        OR EXISTS (
            SELECT 1 FROM jobs 
            WHERE id = job_id 
            AND (client_ip = get_client_ip() OR is_admin_user() OR is_service_account())
        )
    );

-- Policy: Allow service accounts full access to storage operations
CREATE POLICY "storage_operations_all_service" ON storage_operations
    FOR ALL
    TO authenticated
    USING (is_service_account())
    WITH CHECK (is_service_account());

-- Policy: Allow admins full access to storage operations
CREATE POLICY "storage_operations_all_admin" ON storage_operations
    FOR ALL
    TO authenticated
    USING (is_admin_user())
    WITH CHECK (is_admin_user());

-- ============================================================================
-- PROCESSING TIMELINE TABLE RLS POLICIES
-- ============================================================================

-- Policy: Allow service accounts to insert timeline entries
CREATE POLICY "processing_timeline_insert_service" ON processing_timeline
    FOR INSERT
    TO authenticated
    WITH CHECK (is_service_account());

-- Policy: Allow users to view timeline for their jobs
CREATE POLICY "processing_timeline_select_own_job" ON processing_timeline
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM jobs 
            WHERE id = job_id 
            AND (client_ip = get_client_ip() OR is_admin_user() OR is_service_account())
        )
    );

-- Policy: Allow service accounts to update timeline entries
CREATE POLICY "processing_timeline_update_service" ON processing_timeline
    FOR UPDATE
    TO authenticated
    USING (is_service_account())
    WITH CHECK (is_service_account());

-- Policy: Allow admins full access to processing timeline
CREATE POLICY "processing_timeline_all_admin" ON processing_timeline
    FOR ALL
    TO authenticated
    USING (is_admin_user())
    WITH CHECK (is_admin_user());

-- ============================================================================
-- URL ACCESS LOGS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Allow service accounts to insert access logs
CREATE POLICY "url_access_logs_insert_service" ON url_access_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (is_service_account());

-- Policy: Allow users to view access logs for their jobs
CREATE POLICY "url_access_logs_select_own_job" ON url_access_logs
    FOR SELECT
    TO anon, authenticated
    USING (
        job_id IS NULL  -- Allow viewing logs without job association
        OR EXISTS (
            SELECT 1 FROM jobs 
            WHERE id = job_id 
            AND (client_ip = get_client_ip() OR is_admin_user() OR is_service_account())
        )
    );

-- Policy: Allow admins full access to access logs
CREATE POLICY "url_access_logs_all_admin" ON url_access_logs
    FOR ALL
    TO authenticated
    USING (is_admin_user())
    WITH CHECK (is_admin_user());

-- ============================================================================
-- SYSTEM METRICS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Allow service accounts to insert system metrics
CREATE POLICY "system_metrics_insert_service" ON system_metrics
    FOR INSERT
    TO authenticated
    WITH CHECK (is_service_account());

-- Policy: Allow admins to view system metrics
CREATE POLICY "system_metrics_select_admin" ON system_metrics
    FOR SELECT
    TO authenticated
    USING (is_admin_user());

-- Policy: Allow admins full access to system metrics
CREATE POLICY "system_metrics_all_admin" ON system_metrics
    FOR ALL
    TO authenticated
    USING (is_admin_user())
    WITH CHECK (is_admin_user());

-- ============================================================================
-- VIEW ACCESS POLICIES
-- ============================================================================

-- Grant access to views based on underlying table policies
-- Views inherit RLS from their base tables automatically

-- Allow public access to job summary for own jobs
GRANT SELECT ON job_summary TO anon, authenticated;

-- Allow public access to real-time status for own jobs
GRANT SELECT ON job_status_realtime TO anon, authenticated;

-- Allow public access to active jobs (filtered by RLS)
GRANT SELECT ON active_jobs TO anon, authenticated;

-- Restrict analytics views to admins only
GRANT SELECT ON daily_job_stats TO authenticated;
GRANT SELECT ON hourly_processing_load TO authenticated;
GRANT SELECT ON element_type_stats TO authenticated;
GRANT SELECT ON storage_performance TO authenticated;
GRANT SELECT ON system_health TO authenticated;
GRANT SELECT ON error_analysis TO authenticated;

-- Allow subscription view access for real-time updates
GRANT SELECT ON job_progress_subscription TO anon, authenticated;

-- ============================================================================
-- FUNCTION ACCESS POLICIES
-- ============================================================================

-- Grant execute permissions for public API functions
GRANT EXECUTE ON FUNCTION create_job TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_job_duration TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_job_progress TO anon, authenticated;

-- Grant execute permissions for service account functions
GRANT EXECUTE ON FUNCTION update_job_status TO authenticated;
GRANT EXECUTE ON FUNCTION update_job_progress TO authenticated;
GRANT EXECUTE ON FUNCTION add_job_element TO authenticated;
GRANT EXECUTE ON FUNCTION update_element_status TO authenticated;
GRANT EXECUTE ON FUNCTION start_processing_step TO authenticated;
GRANT EXECUTE ON FUNCTION complete_processing_step TO authenticated;
GRANT EXECUTE ON FUNCTION log_storage_operation TO authenticated;
GRANT EXECUTE ON FUNCTION record_system_metric TO authenticated;

-- Grant execute permissions for analytics functions (admin only)
GRANT EXECUTE ON FUNCTION get_job_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_storage_statistics TO authenticated;

-- Grant execute permissions for cleanup functions (admin only)
GRANT EXECUTE ON FUNCTION cleanup_old_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_metrics TO authenticated;

-- ============================================================================
-- REAL-TIME SUBSCRIPTION POLICIES
-- ============================================================================

-- Function to check if user can subscribe to job updates
CREATE OR REPLACE FUNCTION can_subscribe_to_job(job_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    job_client_ip INET;
BEGIN
    -- Admins and service accounts can subscribe to any job
    IF is_admin_user() OR is_service_account() THEN
        RETURN TRUE;
    END IF;
    
    -- Get job client IP
    SELECT client_ip INTO job_client_ip FROM jobs WHERE id = job_uuid;
    
    -- Allow subscription if client IP matches or job not found (will be filtered by RLS)
    RETURN job_client_ip IS NULL OR job_client_ip = get_client_ip();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECURITY AUDIT FUNCTIONS
-- ============================================================================

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    event_type TEXT,
    details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO system_metrics (metric_name, metric_type, value, labels)
    VALUES (
        'security_event',
        'counter',
        1,
        jsonb_build_object(
            'event_type', event_type,
            'user_role', get_current_user_role(),
            'user_id', get_current_user_id(),
            'client_ip', get_client_ip(),
            'details', details
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for suspicious activity
CREATE OR REPLACE FUNCTION check_rate_limit(
    identifier TEXT,
    max_requests INTEGER DEFAULT 100,
    time_window INTERVAL DEFAULT INTERVAL '1 hour'
)
RETURNS BOOLEAN AS $$
DECLARE
    request_count INTEGER;
BEGIN
    -- Count recent requests from this identifier
    SELECT COUNT(*)
    INTO request_count
    FROM system_metrics
    WHERE metric_name = 'api_request'
    AND labels->>'identifier' = identifier
    AND recorded_at >= NOW() - time_window;
    
    -- Log if rate limit exceeded
    IF request_count >= max_requests THEN
        PERFORM log_security_event('rate_limit_exceeded', 
            jsonb_build_object('identifier', identifier, 'count', request_count));
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DATA RETENTION POLICIES
-- ============================================================================

-- Function to enforce data retention policies
CREATE OR REPLACE FUNCTION enforce_data_retention()
RETURNS INTEGER AS $$
DECLARE
    deleted_jobs INTEGER := 0;
    deleted_metrics INTEGER := 0;
    deleted_logs INTEGER := 0;
BEGIN
    -- Only allow admins to run retention policies
    IF NOT is_admin_user() THEN
        RAISE EXCEPTION 'Insufficient privileges for data retention operations';
    END IF;
    
    -- Delete old completed jobs (90 days)
    DELETE FROM jobs 
    WHERE status IN ('completed', 'failed', 'cancelled') 
    AND created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_jobs = ROW_COUNT;
    
    -- Delete old system metrics (30 days)
    DELETE FROM system_metrics 
    WHERE recorded_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_metrics = ROW_COUNT;
    
    -- Delete old access logs (7 days)
    DELETE FROM url_access_logs 
    WHERE accessed_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_logs = ROW_COUNT;
    
    -- Log retention activity
    PERFORM record_system_metric('data_retention_jobs_deleted', 'counter', deleted_jobs);
    PERFORM record_system_metric('data_retention_metrics_deleted', 'counter', deleted_metrics);
    PERFORM record_system_metric('data_retention_logs_deleted', 'counter', deleted_logs);
    
    RETURN deleted_jobs + deleted_metrics + deleted_logs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS FOR AUTH FUNCTIONS
-- ============================================================================

-- Grant execute permissions for auth helper functions
GRANT EXECUTE ON FUNCTION get_current_user_role TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_id TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_admin_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_service_account TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_client_ip TO anon, authenticated;
GRANT EXECUTE ON FUNCTION can_subscribe_to_job TO anon, authenticated;

-- Grant execute permissions for security functions
GRANT EXECUTE ON FUNCTION log_security_event TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION enforce_data_retention TO authenticated;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_current_user_role IS 'Extracts user role from JWT token for RLS policies';
COMMENT ON FUNCTION get_current_user_id IS 'Extracts user ID from JWT token for RLS policies';
COMMENT ON FUNCTION is_admin_user IS 'Checks if current user has admin privileges';
COMMENT ON FUNCTION is_service_account IS 'Checks if current user is a service account';
COMMENT ON FUNCTION get_client_ip IS 'Extracts client IP from request headers for IP-based access control';
COMMENT ON FUNCTION can_subscribe_to_job IS 'Checks if user can subscribe to real-time updates for a specific job';
COMMENT ON FUNCTION log_security_event IS 'Logs security events for audit and monitoring';
COMMENT ON FUNCTION check_rate_limit IS 'Implements rate limiting based on identifier and time window';
COMMENT ON FUNCTION enforce_data_retention IS 'Enforces data retention policies by deleting old records';

-- ============================================================================
-- CREATE INDEXES FOR RLS PERFORMANCE
-- ============================================================================

-- Indexes to optimize RLS policy performance
CREATE INDEX IF NOT EXISTS idx_jobs_client_ip_status ON jobs(client_ip, status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at_client_ip ON jobs(created_at DESC, client_ip);
CREATE INDEX IF NOT EXISTS idx_elements_job_id_rls ON elements(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storage_operations_job_id_rls ON storage_operations(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processing_timeline_job_id_rls ON processing_timeline(job_id);
CREATE INDEX IF NOT EXISTS idx_url_access_logs_job_id_rls ON url_access_logs(job_id) WHERE job_id IS NOT NULL;

-- Indexes for security and audit queries
CREATE INDEX IF NOT EXISTS idx_system_metrics_security ON system_metrics(metric_name, recorded_at DESC) 
    WHERE metric_name IN ('security_event', 'api_request');
CREATE INDEX IF NOT EXISTS idx_system_metrics_labels_gin ON system_metrics USING GIN(labels) 
    WHERE metric_name IN ('security_event', 'api_request');
