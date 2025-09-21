-- Dynamic Video Content Generation Platform - Database Triggers
-- Migration: 003_triggers.sql
-- Description: Create triggers for automatic timestamps, status validation, and data integrity

-- ============================================================================
-- TIMESTAMP UPDATE TRIGGERS
-- ============================================================================

-- Generic function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER trigger_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_elements_updated_at
    BEFORE UPDATE ON elements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_processing_timeline_updated_at
    BEFORE UPDATE ON processing_timeline
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- JOB STATUS VALIDATION TRIGGERS
-- ============================================================================

-- Function to validate job status transitions
CREATE OR REPLACE FUNCTION validate_job_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transition BOOLEAN := FALSE;
BEGIN
    -- Skip validation for new records
    IF TG_OP = 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Skip if status hasn't changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Validate status transitions based on current status
    CASE OLD.status
        WHEN 'pending' THEN
            valid_transition := NEW.status IN ('processing', 'cancelled');
        WHEN 'processing' THEN
            valid_transition := NEW.status IN ('completed', 'failed', 'cancelled', 'timeout');
        WHEN 'completed' THEN
            valid_transition := FALSE; -- Completed jobs cannot change status
        WHEN 'failed' THEN
            valid_transition := NEW.status = 'processing'; -- Allow retry
        WHEN 'cancelled' THEN
            valid_transition := FALSE; -- Cancelled jobs cannot change status
        WHEN 'timeout' THEN
            valid_transition := NEW.status = 'processing'; -- Allow retry
        ELSE
            valid_transition := FALSE;
    END CASE;
    
    IF NOT valid_transition THEN
        RAISE EXCEPTION 'Invalid job status transition from % to % for job %', 
            OLD.status, NEW.status, NEW.id;
    END IF;
    
    -- Automatically set processing timestamps
    IF NEW.status = 'processing' AND OLD.status = 'pending' THEN
        NEW.processing_started_at = COALESCE(NEW.processing_started_at, NOW());
    END IF;
    
    IF NEW.status IN ('completed', 'failed', 'cancelled', 'timeout') AND OLD.status = 'processing' THEN
        NEW.processing_completed_at = COALESCE(NEW.processing_completed_at, NOW());
        
        -- Calculate actual duration if not set
        IF NEW.processing_started_at IS NOT NULL AND NEW.actual_duration IS NULL THEN
            NEW.actual_duration = EXTRACT(EPOCH FROM (NEW.processing_completed_at - NEW.processing_started_at))::INTEGER;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_job_status_transition
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION validate_job_status_transition();

-- ============================================================================
-- JOB PROGRESS VALIDATION TRIGGERS
-- ============================================================================

-- Function to validate job progress updates
CREATE OR REPLACE FUNCTION validate_job_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate progress percentage
    IF NEW.progress_percentage < 0 OR NEW.progress_percentage > 100 THEN
        RAISE EXCEPTION 'Job progress percentage must be between 0 and 100, got %', 
            NEW.progress_percentage;
    END IF;
    
    -- Ensure progress only increases (except for resets on retry)
    IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
        IF NEW.progress_percentage < OLD.progress_percentage AND NEW.status != 'processing' THEN
            RAISE EXCEPTION 'Job progress cannot decrease from % to % unless job is being retried', 
                OLD.progress_percentage, NEW.progress_percentage;
        END IF;
    END IF;
    
    -- Auto-complete job when progress reaches 100%
    IF NEW.progress_percentage = 100 AND NEW.status = 'processing' THEN
        NEW.status = 'completed';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_job_progress
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION validate_job_progress();

-- ============================================================================
-- ELEMENT VALIDATION TRIGGERS
-- ============================================================================

-- Function to validate element constraints
CREATE OR REPLACE FUNCTION validate_element_constraints()
RETURNS TRIGGER AS $$
DECLARE
    job_status job_status;
    element_count INTEGER;
BEGIN
    -- Check if job exists and get its status
    SELECT status INTO job_status FROM jobs WHERE id = NEW.job_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job % does not exist', NEW.job_id;
    END IF;
    
    -- Prevent adding elements to completed or failed jobs
    IF job_status IN ('completed', 'failed', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot add elements to job with status %', job_status;
    END IF;
    
    -- Limit number of elements per job (max 10)
    SELECT COUNT(*) INTO element_count FROM elements WHERE job_id = NEW.job_id;
    
    IF element_count >= 10 THEN
        RAISE EXCEPTION 'Maximum of 10 elements allowed per job';
    END IF;
    
    -- Validate positioning percentages
    IF NEW.x_position !~ '^\d+(\.\d+)?%$' OR 
       NEW.y_position !~ '^\d+(\.\d+)?%$' OR 
       NEW.width !~ '^\d+(\.\d+)?%$' OR 
       NEW.height !~ '^\d+(\.\d+)?%$' THEN
        RAISE EXCEPTION 'Position and size values must be valid percentages (e.g., "50.5%%")';
    END IF;
    
    -- Validate timing for video elements
    IF NEW.type IN ('video', 'audio') THEN
        IF NEW.start_time < 0 THEN
            RAISE EXCEPTION 'Start time cannot be negative';
        END IF;
        
        IF NEW.end_time IS NOT NULL AND NEW.end_time <= NEW.start_time THEN
            RAISE EXCEPTION 'End time must be greater than start time';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_element_constraints
    BEFORE INSERT OR UPDATE ON elements
    FOR EACH ROW
    EXECUTE FUNCTION validate_element_constraints();

-- ============================================================================
-- PROCESSING TIMELINE TRIGGERS
-- ============================================================================

-- Function to validate processing timeline entries
CREATE OR REPLACE FUNCTION validate_processing_timeline()
RETURNS TRIGGER AS $$
DECLARE
    job_status job_status;
    existing_step_count INTEGER;
BEGIN
    -- Check if job exists and get its status
    SELECT status INTO job_status FROM jobs WHERE id = NEW.job_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job % does not exist', NEW.job_id;
    END IF;
    
    -- Ensure timeline entries are only added for processing jobs
    IF TG_OP = 'INSERT' AND job_status NOT IN ('pending', 'processing') THEN
        RAISE EXCEPTION 'Cannot add timeline entries to job with status %', job_status;
    END IF;
    
    -- Validate step order uniqueness
    SELECT COUNT(*) INTO existing_step_count 
    FROM processing_timeline 
    WHERE job_id = NEW.job_id AND step = NEW.step AND step_order = NEW.step_order;
    
    IF existing_step_count > 0 AND TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Step % with order % already exists for job %', 
            NEW.step, NEW.step_order, NEW.job_id;
    END IF;
    
    -- Validate progress percentage
    IF NEW.progress_percentage < 0 OR NEW.progress_percentage > 100 THEN
        RAISE EXCEPTION 'Progress percentage must be between 0 and 100';
    END IF;
    
    -- Calculate duration if completing a step
    IF TG_OP = 'UPDATE' AND OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
        NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_processing_timeline
    BEFORE INSERT OR UPDATE ON processing_timeline
    FOR EACH ROW
    EXECUTE FUNCTION validate_processing_timeline();

-- ============================================================================
-- STORAGE OPERATION TRIGGERS
-- ============================================================================

-- Function to validate storage operations
CREATE OR REPLACE FUNCTION validate_storage_operation()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate bucket name format (basic AWS S3 validation)
    IF NEW.bucket !~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$' OR LENGTH(NEW.bucket) < 3 OR LENGTH(NEW.bucket) > 63 THEN
        RAISE EXCEPTION 'Invalid S3 bucket name format: %', NEW.bucket;
    END IF;
    
    -- Validate S3 key (object key) constraints
    IF LENGTH(NEW.key) = 0 OR LENGTH(NEW.key) > 1024 THEN
        RAISE EXCEPTION 'S3 key must be between 1 and 1024 characters';
    END IF;
    
    -- Validate file size for successful uploads
    IF NEW.operation = 'upload' AND NEW.success = TRUE AND (NEW.file_size IS NULL OR NEW.file_size <= 0) THEN
        RAISE EXCEPTION 'File size is required for successful upload operations';
    END IF;
    
    -- Validate duration is positive
    IF NEW.duration_ms IS NOT NULL AND NEW.duration_ms < 0 THEN
        RAISE EXCEPTION 'Operation duration cannot be negative';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_storage_operation
    BEFORE INSERT OR UPDATE ON storage_operations
    FOR EACH ROW
    EXECUTE FUNCTION validate_storage_operation();

-- ============================================================================
-- AUTO-UPDATE JOB S3 INFO TRIGGER
-- ============================================================================

-- Function to automatically update job S3 information from storage operations
CREATE OR REPLACE FUNCTION update_job_s3_info()
RETURNS TRIGGER AS $$
BEGIN
    -- Update job S3 information when a successful upload operation is logged
    IF NEW.operation = 'upload' AND NEW.success = TRUE AND NEW.job_id IS NOT NULL THEN
        UPDATE jobs 
        SET 
            s3_bucket = NEW.bucket,
            s3_key = NEW.key,
            s3_region = NEW.region,
            file_size = NEW.file_size,
            result_url = 'https://' || NEW.bucket || '.s3.' || NEW.region || '.amazonaws.com/' || NEW.key,
            updated_at = NOW()
        WHERE id = NEW.job_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_s3_info
    AFTER INSERT ON storage_operations
    FOR EACH ROW
    EXECUTE FUNCTION update_job_s3_info();

-- ============================================================================
-- SYSTEM METRICS VALIDATION TRIGGERS
-- ============================================================================

-- Function to validate system metrics
CREATE OR REPLACE FUNCTION validate_system_metric()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate metric name
    IF LENGTH(TRIM(NEW.metric_name)) = 0 THEN
        RAISE EXCEPTION 'Metric name cannot be empty';
    END IF;
    
    -- Validate metric type
    IF NEW.metric_type NOT IN ('counter', 'gauge', 'histogram', 'timer') THEN
        RAISE EXCEPTION 'Invalid metric type: %. Must be counter, gauge, histogram, or timer', 
            NEW.metric_type;
    END IF;
    
    -- Validate counter metrics (must be non-negative and increasing)
    IF NEW.metric_type = 'counter' AND NEW.value < 0 THEN
        RAISE EXCEPTION 'Counter metrics cannot have negative values';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_system_metric
    BEFORE INSERT ON system_metrics
    FOR EACH ROW
    EXECUTE FUNCTION validate_system_metric();

-- ============================================================================
-- NOTIFICATION TRIGGERS FOR REAL-TIME UPDATES
-- ============================================================================

-- Function to notify on job status changes
CREATE OR REPLACE FUNCTION notify_job_status_change()
RETURNS TRIGGER AS $$
DECLARE
    notification JSONB;
BEGIN
    -- Create notification payload
    notification = jsonb_build_object(
        'job_id', NEW.id,
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        'new_status', NEW.status,
        'progress_percentage', NEW.progress_percentage,
        'current_step', NEW.current_step,
        'result_url', NEW.result_url,
        'error_message', NEW.error_message,
        'updated_at', NEW.updated_at
    );
    
    -- Send notification for real-time subscriptions
    PERFORM pg_notify('job_status_change', notification::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_job_status_change
    AFTER INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_job_status_change();

-- Function to notify on processing timeline updates
CREATE OR REPLACE FUNCTION notify_processing_timeline_update()
RETURNS TRIGGER AS $$
DECLARE
    notification JSONB;
BEGIN
    -- Create notification payload
    notification = jsonb_build_object(
        'timeline_id', NEW.id,
        'job_id', NEW.job_id,
        'step', NEW.step,
        'step_order', NEW.step_order,
        'started_at', NEW.started_at,
        'completed_at', NEW.completed_at,
        'success', NEW.success,
        'progress_percentage', NEW.progress_percentage,
        'error_message', NEW.error_message
    );
    
    -- Send notification for real-time subscriptions
    PERFORM pg_notify('processing_timeline_update', notification::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_processing_timeline_update
    AFTER INSERT OR UPDATE ON processing_timeline
    FOR EACH ROW
    EXECUTE FUNCTION notify_processing_timeline_update();

-- ============================================================================
-- CLEANUP TRIGGERS
-- ============================================================================

-- Function to cleanup related data when job is deleted
CREATE OR REPLACE FUNCTION cleanup_job_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the deletion for audit purposes
    INSERT INTO system_metrics (metric_name, metric_type, value, labels)
    VALUES ('job_deleted', 'counter', 1, 
            jsonb_build_object('status', OLD.status, 'response_type', OLD.response_type));
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_job_data
    AFTER DELETE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_job_data();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION update_updated_at_column IS 'Generic trigger function to automatically update updated_at timestamp';
COMMENT ON FUNCTION validate_job_status_transition IS 'Validates job status transitions and automatically sets processing timestamps';
COMMENT ON FUNCTION validate_job_progress IS 'Validates job progress updates and auto-completes jobs at 100%';
COMMENT ON FUNCTION validate_element_constraints IS 'Validates element constraints including positioning, timing, and job limits';
COMMENT ON FUNCTION validate_processing_timeline IS 'Validates processing timeline entries and calculates step durations';
COMMENT ON FUNCTION validate_storage_operation IS 'Validates S3 storage operations including bucket names and file sizes';
COMMENT ON FUNCTION update_job_s3_info IS 'Automatically updates job S3 information from successful upload operations';
COMMENT ON FUNCTION notify_job_status_change IS 'Sends real-time notifications for job status changes via pg_notify';
COMMENT ON FUNCTION notify_processing_timeline_update IS 'Sends real-time notifications for processing timeline updates';
COMMENT ON FUNCTION cleanup_job_data IS 'Logs metrics when jobs are deleted for audit purposes';
