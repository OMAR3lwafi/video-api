-- Dynamic Video Content Generation Platform - Transaction Functions
-- Migration: 006_transaction_functions.sql
-- Description: Create transaction management functions for database service

-- ============================================================================
-- TRANSACTION MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to begin a transaction (placeholder for explicit transaction management)
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS VOID AS $$
BEGIN
    -- PostgreSQL automatically begins transactions for function calls
    -- This function serves as a placeholder for explicit transaction management
    -- In practice, Supabase handles transactions automatically
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to commit a transaction (placeholder for explicit transaction management)
CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS VOID AS $$
BEGIN
    -- PostgreSQL automatically commits transactions for function calls
    -- This function serves as a placeholder for explicit transaction management
    -- In practice, Supabase handles transactions automatically
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback a transaction (placeholder for explicit transaction management)
CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS VOID AS $$
BEGIN
    -- PostgreSQL automatically handles rollbacks on exceptions
    -- This function serves as a placeholder for explicit transaction management
    -- In practice, Supabase handles rollbacks automatically on errors
    NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BATCH OPERATION FUNCTIONS
-- ============================================================================

-- Function to create job with elements in a single transaction
CREATE OR REPLACE FUNCTION create_job_with_elements(
    p_output_format VARCHAR(10),
    p_width INTEGER,
    p_height INTEGER,
    p_elements JSONB,
    p_estimated_duration INTEGER DEFAULT NULL,
    p_client_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_request_metadata JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    new_job_id UUID;
    element_record JSONB;
    element_id UUID;
    result JSONB;
    elements_array JSONB := '[]'::jsonb;
BEGIN
    -- Create the job first
    SELECT create_job(
        p_output_format,
        p_width,
        p_height,
        p_estimated_duration,
        p_client_ip,
        p_user_agent,
        p_request_metadata
    ) INTO new_job_id;
    
    -- Add elements to the job
    FOR element_record IN SELECT * FROM jsonb_array_elements(p_elements)
    LOOP
        SELECT add_job_element(
            new_job_id,
            (element_record->>'type')::element_type,
            element_record->>'source_url',
            (element_record->>'element_order')::INTEGER,
            COALESCE((element_record->>'track')::INTEGER, 0),
            COALESCE(element_record->>'x_position', '0%'),
            COALESCE(element_record->>'y_position', '0%'),
            COALESCE(element_record->>'width', '100%'),
            COALESCE(element_record->>'height', '100%'),
            COALESCE((element_record->>'fit_mode')::fit_mode, 'auto'),
            COALESCE((element_record->>'start_time')::DECIMAL, 0),
            (element_record->>'end_time')::DECIMAL,
            element_record->'metadata'
        ) INTO element_id;
        
        -- Add element ID to result array
        elements_array := elements_array || jsonb_build_object('element_id', element_id, 'order', element_record->>'element_order');
    END LOOP;
    
    -- Build result
    result := jsonb_build_object(
        'job_id', new_job_id,
        'elements', elements_array
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to update job with S3 results
CREATE OR REPLACE FUNCTION complete_job_with_s3_upload(
    job_uuid UUID,
    s3_bucket_val VARCHAR(255),
    s3_key_val VARCHAR(500),
    s3_region_val VARCHAR(50),
    result_url_val TEXT,
    file_size_val BIGINT,
    processing_time_ms INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update job with completion data
    UPDATE jobs 
    SET 
        status = 'completed',
        s3_bucket = s3_bucket_val,
        s3_key = s3_key_val,
        s3_region = s3_region_val,
        result_url = result_url_val,
        file_size = file_size_val,
        actual_duration = ROUND(processing_time_ms / 1000.0),
        progress_percentage = 100,
        current_step = 'cleanup',
        processing_completed_at = NOW(),
        updated_at = NOW()
    WHERE id = job_uuid;
    
    -- Log the successful upload operation
    INSERT INTO storage_operations (
        job_id,
        operation,
        bucket,
        key,
        region,
        success,
        file_size,
        duration_ms
    ) VALUES (
        job_uuid,
        'upload',
        s3_bucket_val,
        s3_key_val,
        s3_region_val,
        TRUE,
        file_size_val,
        processing_time_ms
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions for transaction functions
GRANT EXECUTE ON FUNCTION begin_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION commit_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_transaction TO authenticated;

-- Grant execute permissions for batch operation functions
GRANT EXECUTE ON FUNCTION create_job_with_elements TO authenticated;
GRANT EXECUTE ON FUNCTION complete_job_with_s3_upload TO authenticated;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION begin_transaction IS 'Placeholder function for explicit transaction management (Supabase handles automatically)';
COMMENT ON FUNCTION commit_transaction IS 'Placeholder function for explicit transaction management (Supabase handles automatically)';
COMMENT ON FUNCTION rollback_transaction IS 'Placeholder function for explicit transaction management (Supabase handles automatically)';
COMMENT ON FUNCTION create_job_with_elements IS 'Creates a job with all elements in a single atomic transaction';
COMMENT ON FUNCTION complete_job_with_s3_upload IS 'Completes a job with S3 upload results and logs storage operation';
