-- Dynamic Video Content Generation Platform - Database Functions
-- Migration: 002_functions.sql
-- Description: Create database functions for job management, timeline tracking, and analytics

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to calculate job processing duration
CREATE OR REPLACE FUNCTION calculate_job_duration(job_uuid UUID)
RETURNS INTERVAL AS $$
DECLARE
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
BEGIN
    SELECT processing_started_at, processing_completed_at 
    INTO start_time, end_time
    FROM jobs 
    WHERE id = job_uuid;
    
    IF start_time IS NULL OR end_time IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN end_time - start_time;
END;
$$ LANGUAGE plpgsql;

-- Function to get job progress percentage based on timeline steps
CREATE OR REPLACE FUNCTION calculate_job_progress(job_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    total_steps INTEGER;
    completed_steps INTEGER;
    progress INTEGER;
BEGIN
    -- Count total expected steps
    SELECT COUNT(*) INTO total_steps
    FROM processing_timeline
    WHERE job_id = job_uuid;
    
    IF total_steps = 0 THEN
        RETURN 0;
    END IF;
    
    -- Count completed steps
    SELECT COUNT(*) INTO completed_steps
    FROM processing_timeline
    WHERE job_id = job_uuid AND success = TRUE;
    
    progress := ROUND((completed_steps::DECIMAL / total_steps::DECIMAL) * 100);
    
    RETURN LEAST(progress, 100);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- JOB MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to create a new job with validation
CREATE OR REPLACE FUNCTION create_job(
    p_output_format VARCHAR(10),
    p_width INTEGER,
    p_height INTEGER,
    p_estimated_duration INTEGER DEFAULT NULL,
    p_client_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_request_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_job_id UUID;
    estimated_response_type response_type;
BEGIN
    -- Validate input parameters
    IF p_output_format NOT IN ('mp4', 'mov', 'avi', 'webm') THEN
        RAISE EXCEPTION 'Invalid output format: %', p_output_format;
    END IF;
    
    IF p_width <= 0 OR p_width > 7680 THEN
        RAISE EXCEPTION 'Width must be between 1 and 7680 pixels';
    END IF;
    
    IF p_height <= 0 OR p_height > 4320 THEN
        RAISE EXCEPTION 'Height must be between 1 and 4320 pixels';
    END IF;
    
    -- Determine response type based on estimated duration
    IF p_estimated_duration IS NULL OR p_estimated_duration <= 30 THEN
        estimated_response_type := 'immediate';
    ELSE
        estimated_response_type := 'async';
    END IF;
    
    -- Create the job
    INSERT INTO jobs (
        output_format,
        width,
        height,
        estimated_duration,
        response_type,
        client_ip,
        user_agent,
        request_metadata
    ) VALUES (
        p_output_format,
        p_width,
        p_height,
        p_estimated_duration,
        estimated_response_type,
        p_client_ip,
        p_user_agent,
        p_request_metadata
    ) RETURNING id INTO new_job_id;
    
    RETURN new_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update job status with validation
CREATE OR REPLACE FUNCTION update_job_status(
    job_uuid UUID,
    new_status job_status,
    error_msg TEXT DEFAULT NULL,
    error_code_val VARCHAR(50) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status job_status;
    valid_transition BOOLEAN := FALSE;
BEGIN
    -- Get current status
    SELECT status INTO current_status FROM jobs WHERE id = job_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found: %', job_uuid;
    END IF;
    
    -- Validate status transitions
    CASE current_status
        WHEN 'pending' THEN
            valid_transition := new_status IN ('processing', 'cancelled');
        WHEN 'processing' THEN
            valid_transition := new_status IN ('completed', 'failed', 'cancelled', 'timeout');
        WHEN 'completed' THEN
            valid_transition := FALSE; -- Completed jobs cannot change status
        WHEN 'failed' THEN
            valid_transition := new_status = 'processing'; -- Allow retry
        WHEN 'cancelled' THEN
            valid_transition := FALSE; -- Cancelled jobs cannot change status
        WHEN 'timeout' THEN
            valid_transition := new_status = 'processing'; -- Allow retry
    END CASE;
    
    IF NOT valid_transition THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', current_status, new_status;
    END IF;
    
    -- Update the job
    UPDATE jobs 
    SET 
        status = new_status,
        error_message = COALESCE(error_msg, error_message),
        error_code = COALESCE(error_code_val, error_code),
        processing_started_at = CASE 
            WHEN new_status = 'processing' AND processing_started_at IS NULL 
            THEN NOW() 
            ELSE processing_started_at 
        END,
        processing_completed_at = CASE 
            WHEN new_status IN ('completed', 'failed', 'cancelled', 'timeout') 
            THEN NOW() 
            ELSE processing_completed_at 
        END,
        updated_at = NOW()
    WHERE id = job_uuid;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to update job progress
CREATE OR REPLACE FUNCTION update_job_progress(
    job_uuid UUID,
    progress INTEGER,
    current_step_val processing_step DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate progress
    IF progress < 0 OR progress > 100 THEN
        RAISE EXCEPTION 'Progress must be between 0 and 100';
    END IF;
    
    UPDATE jobs 
    SET 
        progress_percentage = progress,
        current_step = COALESCE(current_step_val, current_step),
        updated_at = NOW()
    WHERE id = job_uuid;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ELEMENT MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to add element to job
CREATE OR REPLACE FUNCTION add_job_element(
    job_uuid UUID,
    element_type_val element_type,
    source_url_val TEXT,
    element_order_val INTEGER,
    track_val INTEGER DEFAULT 0,
    x_pos VARCHAR(10) DEFAULT '0%',
    y_pos VARCHAR(10) DEFAULT '0%',
    width_val VARCHAR(10) DEFAULT '100%',
    height_val VARCHAR(10) DEFAULT '100%',
    fit_mode_val fit_mode DEFAULT 'auto',
    start_time_val DECIMAL(10,3) DEFAULT 0,
    end_time_val DECIMAL(10,3) DEFAULT NULL,
    metadata_val JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_element_id UUID;
    job_exists BOOLEAN;
BEGIN
    -- Check if job exists
    SELECT EXISTS(SELECT 1 FROM jobs WHERE id = job_uuid) INTO job_exists;
    
    IF NOT job_exists THEN
        RAISE EXCEPTION 'Job not found: %', job_uuid;
    END IF;
    
    -- Validate element order uniqueness
    IF EXISTS(SELECT 1 FROM elements WHERE job_id = job_uuid AND element_order = element_order_val) THEN
        RAISE EXCEPTION 'Element order % already exists for job %', element_order_val, job_uuid;
    END IF;
    
    -- Create the element
    INSERT INTO elements (
        job_id,
        type,
        source_url,
        element_order,
        track,
        x_position,
        y_position,
        width,
        height,
        fit_mode,
        start_time,
        end_time,
        metadata
    ) VALUES (
        job_uuid,
        element_type_val,
        source_url_val,
        element_order_val,
        track_val,
        x_pos,
        y_pos,
        width_val,
        height_val,
        fit_mode_val,
        start_time_val,
        end_time_val,
        metadata_val
    ) RETURNING id INTO new_element_id;
    
    RETURN new_element_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update element processing status
CREATE OR REPLACE FUNCTION update_element_status(
    element_uuid UUID,
    downloaded_val BOOLEAN DEFAULT NULL,
    processed_val BOOLEAN DEFAULT NULL,
    local_path_val TEXT DEFAULT NULL,
    processed_path_val TEXT DEFAULT NULL,
    error_msg TEXT DEFAULT NULL,
    source_size_val BIGINT DEFAULT NULL,
    source_duration_val DECIMAL(10,3) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE elements 
    SET 
        downloaded = COALESCE(downloaded_val, downloaded),
        processed = COALESCE(processed_val, processed),
        local_path = COALESCE(local_path_val, local_path),
        processed_path = COALESCE(processed_path_val, processed_path),
        error_message = COALESCE(error_msg, error_message),
        source_size = COALESCE(source_size_val, source_size),
        source_duration = COALESCE(source_duration_val, source_duration),
        updated_at = NOW()
    WHERE id = element_uuid;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TIMELINE TRACKING FUNCTIONS
-- ============================================================================

-- Function to start a processing step
CREATE OR REPLACE FUNCTION start_processing_step(
    job_uuid UUID,
    step_val processing_step,
    step_order_val INTEGER,
    details_val JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    timeline_id UUID;
BEGIN
    INSERT INTO processing_timeline (
        job_id,
        step,
        step_order,
        started_at,
        details
    ) VALUES (
        job_uuid,
        step_val,
        step_order_val,
        NOW(),
        details_val
    ) RETURNING id INTO timeline_id;
    
    -- Update job current step
    UPDATE jobs 
    SET current_step = step_val, updated_at = NOW() 
    WHERE id = job_uuid;
    
    RETURN timeline_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete a processing step
CREATE OR REPLACE FUNCTION complete_processing_step(
    timeline_uuid UUID,
    success_val BOOLEAN,
    progress_val INTEGER DEFAULT NULL,
    details_val JSONB DEFAULT NULL,
    error_msg TEXT DEFAULT NULL,
    cpu_usage_val DECIMAL(5,2) DEFAULT NULL,
    memory_usage_val BIGINT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    step_started_at TIMESTAMPTZ;
    job_uuid UUID;
BEGIN
    -- Get timeline info
    SELECT started_at, job_id INTO step_started_at, job_uuid
    FROM processing_timeline 
    WHERE id = timeline_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Timeline entry not found: %', timeline_uuid;
    END IF;
    
    -- Update timeline entry
    UPDATE processing_timeline 
    SET 
        completed_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - step_started_at)) * 1000,
        success = success_val,
        progress_percentage = COALESCE(progress_val, progress_percentage),
        details = COALESCE(details_val, details),
        error_message = error_msg,
        cpu_usage = cpu_usage_val,
        memory_usage = memory_usage_val,
        updated_at = NOW()
    WHERE id = timeline_uuid;
    
    -- Update job progress if provided
    IF progress_val IS NOT NULL THEN
        UPDATE jobs 
        SET progress_percentage = progress_val, updated_at = NOW() 
        WHERE id = job_uuid;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STORAGE OPERATION FUNCTIONS
-- ============================================================================

-- Function to log storage operation
CREATE OR REPLACE FUNCTION log_storage_operation(
    job_uuid UUID,
    operation_val storage_operation,
    bucket_val VARCHAR(255),
    key_val VARCHAR(500),
    region_val VARCHAR(50) DEFAULT 'us-east-1',
    success_val BOOLEAN DEFAULT TRUE,
    file_size_val BIGINT DEFAULT NULL,
    duration_ms_val INTEGER DEFAULT NULL,
    error_msg TEXT DEFAULT NULL,
    metadata_val JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    operation_id UUID;
BEGIN
    INSERT INTO storage_operations (
        job_id,
        operation,
        bucket,
        key,
        region,
        success,
        file_size,
        duration_ms,
        error_message,
        metadata
    ) VALUES (
        job_uuid,
        operation_val,
        bucket_val,
        key_val,
        region_val,
        success_val,
        file_size_val,
        duration_ms_val,
        error_msg,
        metadata_val
    ) RETURNING id INTO operation_id;
    
    RETURN operation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ANALYTICS FUNCTIONS
-- ============================================================================

-- Function to get job statistics for a time period
CREATE OR REPLACE FUNCTION get_job_statistics(
    start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
    end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_jobs BIGINT,
    completed_jobs BIGINT,
    failed_jobs BIGINT,
    avg_processing_time INTERVAL,
    immediate_response_jobs BIGINT,
    async_response_jobs BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
        AVG(processing_completed_at - processing_started_at) as avg_processing_time,
        COUNT(*) FILTER (WHERE response_type = 'immediate') as immediate_response_jobs,
        COUNT(*) FILTER (WHERE response_type = 'async') as async_response_jobs
    FROM jobs 
    WHERE created_at BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get storage usage statistics
CREATE OR REPLACE FUNCTION get_storage_statistics(
    start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
    end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_operations BIGINT,
    successful_operations BIGINT,
    total_bytes_uploaded BIGINT,
    total_bytes_downloaded BIGINT,
    avg_operation_duration_ms DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_operations,
        COUNT(*) FILTER (WHERE success = TRUE) as successful_operations,
        COALESCE(SUM(file_size) FILTER (WHERE operation = 'upload'), 0) as total_bytes_uploaded,
        COALESCE(SUM(file_size) FILTER (WHERE operation = 'download'), 0) as total_bytes_downloaded,
        AVG(duration_ms) as avg_operation_duration_ms
    FROM storage_operations 
    WHERE created_at BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- Function to record system metric
CREATE OR REPLACE FUNCTION record_system_metric(
    metric_name_val VARCHAR(100),
    metric_type_val VARCHAR(50),
    value_val DECIMAL(15,6),
    unit_val VARCHAR(20) DEFAULT NULL,
    labels_val JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    metric_id UUID;
BEGIN
    INSERT INTO system_metrics (
        metric_name,
        metric_type,
        value,
        unit,
        labels
    ) VALUES (
        metric_name_val,
        metric_type_val,
        value_val,
        unit_val,
        labels_val
    ) RETURNING id INTO metric_id;
    
    RETURN metric_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

-- Function to cleanup old completed jobs (older than specified days)
CREATE OR REPLACE FUNCTION cleanup_old_jobs(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM jobs 
    WHERE status IN ('completed', 'failed', 'cancelled') 
    AND created_at < NOW() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old system metrics (older than specified days)
CREATE OR REPLACE FUNCTION cleanup_old_metrics(days_old INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM system_metrics 
    WHERE recorded_at < NOW() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION create_job IS 'Creates a new video processing job with validation and automatic response type determination';
COMMENT ON FUNCTION update_job_status IS 'Updates job status with validation for allowed transitions';
COMMENT ON FUNCTION add_job_element IS 'Adds a video element to a job with positioning and timing parameters';
COMMENT ON FUNCTION start_processing_step IS 'Starts a new processing step and updates job current step';
COMMENT ON FUNCTION complete_processing_step IS 'Completes a processing step with metrics and resource usage';
COMMENT ON FUNCTION log_storage_operation IS 'Logs S3 storage operations for monitoring and debugging';
COMMENT ON FUNCTION get_job_statistics IS 'Returns comprehensive job statistics for a specified time period';
COMMENT ON FUNCTION cleanup_old_jobs IS 'Removes old completed jobs to manage database size';
