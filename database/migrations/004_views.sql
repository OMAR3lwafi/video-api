-- Dynamic Video Content Generation Platform - Database Views
-- Migration: 004_views.sql
-- Description: Create optimized views for job summaries, real-time status, and analytics

-- ============================================================================
-- DROP ALL VIEWS FIRST (IN REVERSE DEPENDENCY ORDER)
-- ============================================================================

-- Drop views that depend on other views first
DROP VIEW IF EXISTS active_jobs CASCADE;
DROP VIEW IF EXISTS job_progress_subscription CASCADE;
DROP VIEW IF EXISTS error_analysis CASCADE;
DROP VIEW IF EXISTS system_health CASCADE;
DROP VIEW IF EXISTS storage_performance CASCADE;
DROP VIEW IF EXISTS element_type_stats CASCADE;
DROP VIEW IF EXISTS hourly_processing_load CASCADE;
DROP VIEW IF EXISTS daily_job_stats CASCADE;

-- Drop base views
DROP VIEW IF EXISTS job_status_realtime CASCADE;
DROP VIEW IF EXISTS job_summary CASCADE;

-- ============================================================================
-- JOB SUMMARY VIEWS
-- ============================================================================

-- Comprehensive job summary view with all related information
CREATE VIEW job_summary AS
SELECT 
    j.id,
    j.status,
    j.response_type,
    j.output_format,
    j.width,
    j.height,
    j.estimated_duration,
    j.actual_duration,
    j.processing_started_at,
    j.processing_completed_at,
    j.s3_bucket,
    j.s3_key,
    j.s3_region,
    j.result_url,
    j.file_size,
    j.progress_percentage,
    j.current_step,
    j.error_message,
    j.error_code,
    j.retry_count,
    j.client_ip,
    j.user_agent,
    j.request_metadata,
    j.created_at,
    j.updated_at,
    
    -- Element count and types
    COALESCE(e.element_count, 0) as element_count,
    e.element_types,
    e.total_source_size,
    e.elements_downloaded,
    e.elements_processed,
    
    -- Processing timeline summary
    COALESCE(pt.total_steps, 0) as total_processing_steps,
    COALESCE(pt.completed_steps, 0) as completed_processing_steps,
    pt.current_step_started_at,
    pt.last_step_completed_at,
    
    -- Storage operations summary
    COALESCE(so.upload_operations, 0) as upload_operations,
    COALESCE(so.successful_uploads, 0) as successful_uploads,
    so.last_upload_at,
    
    -- Calculated fields
    CASE 
        WHEN j.processing_started_at IS NOT NULL AND j.processing_completed_at IS NOT NULL 
        THEN j.processing_completed_at - j.processing_started_at
        ELSE NULL 
    END as processing_duration,
    
    CASE 
        WHEN j.status = 'completed' AND j.estimated_duration IS NOT NULL AND j.actual_duration IS NOT NULL
        THEN (j.actual_duration - j.estimated_duration)
        ELSE NULL 
    END as duration_variance_seconds,
    
    CASE 
        WHEN j.response_type = 'immediate' AND j.actual_duration > 30 
        THEN TRUE 
        ELSE FALSE 
    END as response_type_mismatch

FROM jobs j

LEFT JOIN (
    SELECT 
        job_id,
        COUNT(*) as element_count,
        array_agg(DISTINCT type) as element_types,
        SUM(source_size) as total_source_size,
        COUNT(*) FILTER (WHERE downloaded = TRUE) as elements_downloaded,
        COUNT(*) FILTER (WHERE processed = TRUE) as elements_processed
    FROM elements
    GROUP BY job_id
) e ON j.id = e.job_id

LEFT JOIN (
    SELECT 
        job_id,
        COUNT(*) as total_steps,
        COUNT(*) FILTER (WHERE success = TRUE) as completed_steps,
        MIN(started_at) FILTER (WHERE completed_at IS NULL) as current_step_started_at,
        MAX(completed_at) as last_step_completed_at
    FROM processing_timeline
    GROUP BY job_id
) pt ON j.id = pt.job_id

LEFT JOIN (
    SELECT 
        job_id,
        COUNT(*) FILTER (WHERE operation = 'upload') as upload_operations,
        COUNT(*) FILTER (WHERE operation = 'upload' AND success = TRUE) as successful_uploads,
        MAX(created_at) FILTER (WHERE operation = 'upload' AND success = TRUE) as last_upload_at
    FROM storage_operations
    GROUP BY job_id
) so ON j.id = so.job_id;

-- Real-time job status view for live updates
CREATE VIEW job_status_realtime AS
SELECT 
    j.id,
    j.status,
    j.progress_percentage,
    j.current_step,
    j.result_url,
    j.error_message,
    j.updated_at,
    j.estimated_duration,
    j.processing_started_at,
    j.created_at,
    j.response_type,
    
    -- Current processing step details
    pt.step as current_step_name,
    pt.started_at as current_step_started_at,
    pt.progress_percentage as current_step_progress,
    
    -- Time estimates
    CASE 
        WHEN j.status = 'processing' AND j.processing_started_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (NOW() - j.processing_started_at))::INTEGER
        ELSE NULL 
    END as processing_time_seconds,
    
    CASE 
        WHEN j.status = 'processing' AND j.estimated_duration IS NOT NULL AND j.progress_percentage > 0
        THEN j.estimated_duration * (100 - j.progress_percentage) / j.progress_percentage
        ELSE NULL 
    END as estimated_remaining_seconds

FROM jobs j

LEFT JOIN processing_timeline pt ON j.id = pt.job_id 
    AND pt.step = j.current_step 
    AND pt.completed_at IS NULL

WHERE j.status IN ('pending', 'processing');

-- Active jobs view for monitoring
CREATE VIEW active_jobs AS
SELECT 
    js.*,
    
    -- Processing health indicators
    CASE 
        WHEN js.status = 'processing' AND js.processing_time_seconds IS NOT NULL AND js.estimated_duration IS NOT NULL AND js.processing_time_seconds > (js.estimated_duration * 2)
        THEN 'slow'
        WHEN js.status = 'processing' AND js.current_step_started_at < NOW() - INTERVAL '5 minutes'
        THEN 'stalled'
        ELSE 'normal'
    END as processing_health,
    
    -- Resource allocation priority
    CASE 
        WHEN js.response_type = 'immediate' THEN 1
        WHEN js.status = 'processing' AND js.processing_time_seconds IS NOT NULL AND js.processing_time_seconds > 60 THEN 2
        ELSE 3
    END as priority_level

FROM job_status_realtime js

ORDER BY priority_level ASC, js.updated_at ASC;

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Daily job statistics view
CREATE VIEW daily_job_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_jobs,
    COUNT(*) FILTER (WHERE status = 'timeout') as timeout_jobs,
    COUNT(*) FILTER (WHERE response_type = 'immediate') as immediate_response_jobs,
    COUNT(*) FILTER (WHERE response_type = 'async') as async_response_jobs,
    
    -- Performance metrics
    AVG(actual_duration) FILTER (WHERE status = 'completed') as avg_processing_time,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY actual_duration) 
        FILTER (WHERE status = 'completed') as median_processing_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY actual_duration) 
        FILTER (WHERE status = 'completed') as p95_processing_time,
    
    -- Size metrics
    AVG(file_size) FILTER (WHERE status = 'completed') as avg_file_size,
    SUM(file_size) FILTER (WHERE status = 'completed') as total_file_size,
    
    -- Error analysis
    COUNT(DISTINCT error_code) FILTER (WHERE status = 'failed') as unique_error_codes,
    
    -- Response type accuracy
    COUNT(*) FILTER (WHERE response_type = 'immediate' AND actual_duration > 30) as immediate_response_overruns,
    COUNT(*) FILTER (WHERE response_type = 'async' AND actual_duration <= 30) as async_response_underruns

FROM jobs 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Hourly processing load view
CREATE VIEW hourly_processing_load AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as jobs_created,
    COUNT(*) FILTER (WHERE status = 'processing') as jobs_processing,
    COUNT(*) FILTER (WHERE status = 'completed') as jobs_completed,
    
    -- Resource utilization indicators
    AVG(
        CASE 
            WHEN response_type = 'immediate' THEN 1.0
            ELSE 0.3  -- Async jobs use less immediate resources
        END
    ) as avg_resource_weight,
    
    -- Peak detection
    COUNT(*) > LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('hour', created_at)) as is_peak_hour

FROM jobs 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- Element type usage statistics
CREATE VIEW element_type_stats AS
SELECT 
    e.type,
    COUNT(*) as total_elements,
    COUNT(DISTINCT e.job_id) as jobs_using_type,
    AVG(e.source_size) as avg_source_size,
    SUM(e.source_size) as total_source_size,
    AVG(e.source_duration) FILTER (WHERE e.type IN ('video', 'audio')) as avg_duration,
    
    -- Processing success rates
    COUNT(*) FILTER (WHERE e.downloaded = TRUE) * 100.0 / COUNT(*) as download_success_rate,
    COUNT(*) FILTER (WHERE e.processed = TRUE) * 100.0 / COUNT(*) as processing_success_rate,
    
    -- Popular positioning patterns
    MODE() WITHIN GROUP (ORDER BY e.fit_mode) as most_common_fit_mode,
    COUNT(DISTINCT CONCAT(e.x_position, ',', e.y_position)) as unique_positions

FROM elements e
JOIN jobs j ON e.job_id = j.id
WHERE j.created_at >= NOW() - INTERVAL '30 days'
GROUP BY e.type
ORDER BY total_elements DESC;

-- Storage operation performance view
CREATE VIEW storage_performance AS
SELECT 
    so.operation,
    so.bucket,
    COUNT(*) as total_operations,
    COUNT(*) FILTER (WHERE so.success = TRUE) as successful_operations,
    COUNT(*) FILTER (WHERE so.success = TRUE) * 100.0 / COUNT(*) as success_rate,
    
    -- Performance metrics
    AVG(so.duration_ms) as avg_duration_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY so.duration_ms) as median_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY so.duration_ms) as p95_duration_ms,
    MAX(so.duration_ms) as max_duration_ms,
    
    -- Size metrics
    AVG(so.file_size) FILTER (WHERE so.success = TRUE) as avg_file_size,
    SUM(so.file_size) FILTER (WHERE so.success = TRUE) as total_bytes,
    
    -- Error analysis
    COUNT(DISTINCT so.error_message) FILTER (WHERE so.success = FALSE) as unique_errors

FROM storage_operations so
WHERE so.created_at >= NOW() - INTERVAL '7 days'
GROUP BY so.operation, so.bucket
ORDER BY total_operations DESC;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- System health overview
CREATE VIEW system_health AS
SELECT 
    -- Job processing health
    COUNT(*) FILTER (WHERE j.status = 'processing' AND j.created_at < NOW() - INTERVAL '1 hour') as stalled_jobs,
    COUNT(*) FILTER (WHERE j.status = 'failed' AND j.created_at >= NOW() - INTERVAL '1 hour') as recent_failures,
    COUNT(*) FILTER (WHERE j.status = 'timeout' AND j.created_at >= NOW() - INTERVAL '1 hour') as recent_timeouts,
    
    -- Processing queue depth
    COUNT(*) FILTER (WHERE j.status = 'pending') as pending_jobs,
    COUNT(*) FILTER (WHERE j.status = 'processing') as processing_jobs,
    
    -- Storage health
    COUNT(DISTINCT so.bucket) as active_buckets,
    COUNT(*) FILTER (WHERE so.success = FALSE AND so.created_at >= NOW() - INTERVAL '1 hour') as recent_storage_failures,
    
    -- Performance indicators
    AVG(j.actual_duration) FILTER (WHERE j.status = 'completed' AND j.created_at >= NOW() - INTERVAL '1 hour') as recent_avg_processing_time,
    COUNT(*) FILTER (WHERE j.response_type = 'immediate' AND j.actual_duration > 30 AND j.created_at >= NOW() - INTERVAL '1 hour') as recent_sla_violations

FROM jobs j
LEFT JOIN storage_operations so ON j.id = so.job_id;

-- Error analysis view
CREATE VIEW error_analysis AS
SELECT 
    j.error_code,
    j.error_message,
    COUNT(*) as occurrence_count,
    COUNT(DISTINCT j.client_ip) as affected_clients,
    MIN(j.created_at) as first_occurrence,
    MAX(j.created_at) as last_occurrence,
    
    -- Error patterns
    COUNT(*) FILTER (WHERE j.retry_count > 0) as retried_jobs,
    AVG(j.retry_count) as avg_retry_count,
    
    -- Associated element types
    array_agg(DISTINCT e.type) as associated_element_types,
    
    -- Processing step context
    array_agg(DISTINCT j.current_step) as failure_steps

FROM jobs j
LEFT JOIN elements e ON j.id = e.job_id
WHERE j.status = 'failed' 
    AND j.created_at >= NOW() - INTERVAL '7 days'
    AND j.error_code IS NOT NULL
GROUP BY j.error_code, j.error_message
ORDER BY occurrence_count DESC, last_occurrence DESC;

-- ============================================================================
-- REAL-TIME SUBSCRIPTION VIEWS
-- ============================================================================

-- Job progress subscription view (optimized for real-time updates)
CREATE VIEW job_progress_subscription AS
SELECT 
    j.id,
    j.status,
    j.progress_percentage,
    j.current_step,
    j.result_url,
    j.error_message,
    j.updated_at,
    
    -- Processing timeline context
    pt.step_details,
    pt.step_progress,
    pt.step_started_at,
    
    -- Estimated completion
    CASE 
        WHEN j.status = 'processing' AND j.estimated_duration IS NOT NULL AND j.progress_percentage > 0
        THEN j.created_at + (j.estimated_duration * INTERVAL '1 second')
        ELSE NULL 
    END as estimated_completion_at

FROM jobs j

LEFT JOIN (
    SELECT 
        pt.job_id,
        jsonb_agg(
            jsonb_build_object(
                'step', pt.step,
                'progress', pt.progress_percentage,
                'started_at', pt.started_at,
                'completed_at', pt.completed_at,
                'success', pt.success
            ) ORDER BY pt.step_order
        ) as step_details,
        MAX(pt.progress_percentage) FILTER (WHERE pt.completed_at IS NULL) as step_progress,
        MIN(pt.started_at) FILTER (WHERE pt.completed_at IS NULL) as step_started_at
    FROM processing_timeline pt
    GROUP BY pt.job_id
) pt ON j.id = pt.job_id

WHERE j.status IN ('pending', 'processing', 'completed', 'failed');

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON VIEW job_summary IS 'Comprehensive job summary with all related data for detailed analysis and reporting';
COMMENT ON VIEW job_status_realtime IS 'Optimized view for real-time job status updates with time estimates';
COMMENT ON VIEW active_jobs IS 'Currently active jobs with health indicators and priority levels';
COMMENT ON VIEW daily_job_stats IS 'Daily aggregated job statistics for trend analysis and reporting';
COMMENT ON VIEW hourly_processing_load IS 'Hourly processing load metrics for capacity planning';
COMMENT ON VIEW element_type_stats IS 'Element type usage statistics and processing success rates';
COMMENT ON VIEW storage_performance IS 'S3 storage operation performance metrics and error analysis';
COMMENT ON VIEW system_health IS 'Overall system health indicators and alerts';
COMMENT ON VIEW error_analysis IS 'Detailed error analysis with patterns and context';
COMMENT ON VIEW job_progress_subscription IS 'Optimized view for real-time job progress subscriptions';
