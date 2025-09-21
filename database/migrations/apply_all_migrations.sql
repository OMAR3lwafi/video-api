-- Dynamic Video Content Generation Platform - Complete Migration for Supabase Cloud
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- This combines all migrations in the correct order

-- ============================================================================
-- STEP 1: INITIAL SCHEMA
-- ============================================================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums
DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE element_type AS ENUM ('video', 'image', 'text', 'audio', 'transition');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE response_type AS ENUM ('immediate', 'async');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE storage_operation_type AS ENUM ('upload', 'delete', 'generate_url', 'copy', 'move');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fit_mode AS ENUM ('auto', 'contain', 'cover', 'fill', 'stretch');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status job_status DEFAULT 'pending' NOT NULL,
    response_type response_type DEFAULT 'immediate' NOT NULL,
    output_format VARCHAR(10) NOT NULL CHECK (output_format IN ('mp4', 'mov', 'avi', 'webm', 'mkv')),
    width INTEGER NOT NULL CHECK (width > 0 AND width <= 7680),
    height INTEGER NOT NULL CHECK (height > 0 AND height <= 4320),
    fps INTEGER DEFAULT 30 CHECK (fps > 0 AND fps <= 120),
    estimated_duration INTEGER,
    processing_duration_ms INTEGER,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    current_step VARCHAR(255),
    result_url TEXT,
    result_public_url TEXT,
    result_bucket VARCHAR(255),
    result_key VARCHAR(500),
    file_size BIGINT,
    error_message TEXT,
    error_code VARCHAR(50),
    client_ip INET,
    user_agent TEXT,
    request_metadata JSONB DEFAULT '{}'::jsonb,
    retry_count INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT valid_processing_times CHECK (
        (started_at IS NULL OR created_at <= started_at) AND
        (completed_at IS NULL OR started_at IS NULL OR started_at <= completed_at)
    ),
    CONSTRAINT valid_result_fields CHECK (
        (status != 'completed') OR 
        (result_url IS NOT NULL AND file_size IS NOT NULL)
    )
);

-- Elements table
CREATE TABLE IF NOT EXISTS elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    type element_type NOT NULL,
    source_url TEXT NOT NULL,
    cached_local_path TEXT,
    element_order INTEGER NOT NULL CHECK (element_order >= 0),
    track INTEGER DEFAULT 0 CHECK (track >= 0),
    x_position VARCHAR(20) DEFAULT '0%',
    y_position VARCHAR(20) DEFAULT '0%',
    width VARCHAR(20) DEFAULT '100%',
    height VARCHAR(20) DEFAULT '100%',
    fit_mode fit_mode DEFAULT 'auto',
    start_time DECIMAL(10,3) DEFAULT 0 CHECK (start_time >= 0),
    end_time DECIMAL(10,3) CHECK (end_time IS NULL OR end_time > start_time),
    z_index INTEGER DEFAULT 0,
    opacity DECIMAL(3,2) DEFAULT 1.0 CHECK (opacity >= 0 AND opacity <= 1),
    rotation DECIMAL(5,2) DEFAULT 0 CHECK (rotation >= -360 AND rotation <= 360),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, element_order)
);

-- Storage operations table
CREATE TABLE IF NOT EXISTS storage_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    operation storage_operation_type NOT NULL,
    bucket VARCHAR(255) NOT NULL,
    key VARCHAR(500) NOT NULL,
    region VARCHAR(50) DEFAULT 'us-east-1',
    public_url TEXT,
    file_size BIGINT,
    content_type VARCHAR(255),
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Processing timeline table
CREATE TABLE IF NOT EXISTS processing_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    step VARCHAR(255) NOT NULL,
    step_order INTEGER NOT NULL CHECK (step_order > 0),
    success BOOLEAN,
    duration_ms INTEGER,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT valid_timeline_times CHECK (
        completed_at IS NULL OR created_at <= completed_at
    )
);

-- URL access logs table
CREATE TABLE IF NOT EXISTS url_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    storage_operation_id UUID REFERENCES storage_operations(id) ON DELETE CASCADE,
    accessed_url TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    referer TEXT,
    http_method VARCHAR(10),
    response_status_code INTEGER,
    response_size_bytes BIGINT,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    unit VARCHAR(20),
    tags JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_response_type ON jobs(response_type);
CREATE INDEX IF NOT EXISTS idx_elements_job_id ON elements(job_id);
CREATE INDEX IF NOT EXISTS idx_storage_operations_job_id ON storage_operations(job_id);
CREATE INDEX IF NOT EXISTS idx_processing_timeline_job_id ON processing_timeline(job_id);
CREATE INDEX IF NOT EXISTS idx_system_metrics_created_at ON system_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);

-- ============================================================================
-- STEP 2: FUNCTIONS
-- ============================================================================

-- Create job function
CREATE OR REPLACE FUNCTION create_job(
    p_output_format VARCHAR(10),
    p_width INTEGER,
    p_height INTEGER,
    p_estimated_duration INTEGER DEFAULT NULL,
    p_client_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_request_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_response_type response_type;
BEGIN
    -- Determine response type based on estimated duration
    IF p_estimated_duration IS NULL OR p_estimated_duration <= 30 THEN
        v_response_type := 'immediate';
    ELSE
        v_response_type := 'async';
    END IF;

    -- Insert new job
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
        v_response_type,
        p_client_ip,
        p_user_agent,
        p_request_metadata
    ) RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Add job element function
CREATE OR REPLACE FUNCTION add_job_element(
    job_uuid UUID,
    element_type_val element_type,
    source_url_val TEXT,
    element_order_val INTEGER,
    track_val INTEGER DEFAULT 0,
    x_pos VARCHAR(20) DEFAULT '0%',
    y_pos VARCHAR(20) DEFAULT '0%',
    width_val VARCHAR(20) DEFAULT '100%',
    height_val VARCHAR(20) DEFAULT '100%',
    fit_mode_val fit_mode DEFAULT 'auto',
    start_time_val DECIMAL(10,3) DEFAULT 0,
    end_time_val DECIMAL(10,3) DEFAULT NULL,
    metadata_val JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_element_id UUID;
BEGIN
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
    ) RETURNING id INTO v_element_id;

    RETURN v_element_id;
END;
$$ LANGUAGE plpgsql;

-- Update job status function
CREATE OR REPLACE FUNCTION update_job_status(
    job_uuid UUID,
    new_status job_status,
    error_msg TEXT DEFAULT NULL,
    error_code_val VARCHAR(50) DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_status job_status;
BEGIN
    -- Get current status
    SELECT status INTO v_current_status FROM jobs WHERE id = job_uuid;
    
    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Job % not found', job_uuid;
    END IF;

    -- Validate status transition
    IF v_current_status = 'completed' OR v_current_status = 'failed' OR v_current_status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot change status from % to %', v_current_status, new_status;
    END IF;

    -- Update job
    UPDATE jobs SET
        status = new_status,
        error_message = COALESCE(error_msg, error_message),
        error_code = COALESCE(error_code_val, error_code),
        started_at = CASE 
            WHEN new_status = 'processing' AND started_at IS NULL 
            THEN NOW() 
            ELSE started_at 
        END,
        completed_at = CASE 
            WHEN new_status IN ('completed', 'failed', 'cancelled') 
            THEN NOW() 
            ELSE completed_at 
        END,
        updated_at = NOW()
    WHERE id = job_uuid;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Update job progress function
CREATE OR REPLACE FUNCTION update_job_progress(
    job_uuid UUID,
    progress INTEGER,
    current_step_val VARCHAR(255) DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE jobs SET
        progress_percentage = progress,
        current_step = COALESCE(current_step_val, current_step),
        updated_at = NOW()
    WHERE id = job_uuid AND status = 'processing';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Log storage operation function
CREATE OR REPLACE FUNCTION log_storage_operation(
    job_uuid UUID,
    operation_val storage_operation_type,
    bucket_val VARCHAR(255),
    key_val VARCHAR(500),
    region_val VARCHAR(50) DEFAULT 'us-east-1',
    success_val BOOLEAN DEFAULT false,
    public_url_val TEXT DEFAULT NULL,
    file_size_val BIGINT DEFAULT NULL,
    error_msg TEXT DEFAULT NULL,
    duration_ms_val INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_operation_id UUID;
BEGIN
    INSERT INTO storage_operations (
        job_id,
        operation,
        bucket,
        key,
        region,
        success,
        public_url,
        file_size,
        error_message,
        duration_ms
    ) VALUES (
        job_uuid,
        operation_val,
        bucket_val,
        key_val,
        region_val,
        success_val,
        public_url_val,
        file_size_val,
        error_msg,
        duration_ms_val
    ) RETURNING id INTO v_operation_id;

    RETURN v_operation_id;
END;
$$ LANGUAGE plpgsql;

-- Start processing step function
CREATE OR REPLACE FUNCTION start_processing_step(
    job_uuid UUID,
    step_val VARCHAR(255),
    step_order_val INTEGER,
    details_val JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_timeline_id UUID;
BEGIN
    INSERT INTO processing_timeline (
        job_id,
        step,
        step_order,
        details
    ) VALUES (
        job_uuid,
        step_val,
        step_order_val,
        details_val
    ) RETURNING id INTO v_timeline_id;

    RETURN v_timeline_id;
END;
$$ LANGUAGE plpgsql;

-- Complete processing step function
CREATE OR REPLACE FUNCTION complete_processing_step(
    timeline_uuid UUID,
    success_val BOOLEAN,
    progress_val INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_job_id UUID;
    v_duration_ms INTEGER;
BEGIN
    -- Calculate duration and update timeline
    UPDATE processing_timeline SET
        success = success_val,
        completed_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - created_at)) * 1000
    WHERE id = timeline_uuid
    RETURNING job_id, duration_ms INTO v_job_id, v_duration_ms;

    -- Update job progress if provided
    IF progress_val IS NOT NULL AND v_job_id IS NOT NULL THEN
        UPDATE jobs SET
            progress_percentage = progress_val,
            updated_at = NOW()
        WHERE id = v_job_id AND status = 'processing';
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Get job statistics function
CREATE OR REPLACE FUNCTION get_job_statistics(
    start_date TIMESTAMP DEFAULT NOW() - INTERVAL '7 days',
    end_date TIMESTAMP DEFAULT NOW()
) RETURNS TABLE (
    total_jobs BIGINT,
    completed_jobs BIGINT,
    failed_jobs BIGINT,
    avg_processing_time_ms NUMERIC,
    total_file_size_mb NUMERIC,
    immediate_vs_async JSONB,
    formats_breakdown JSONB,
    daily_breakdown JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) AS total,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
            AVG(processing_duration_ms) AS avg_duration,
            SUM(file_size) / 1048576.0 AS total_size_mb,
            jsonb_object_agg(
                response_type::text, 
                COUNT(*)
            ) FILTER (WHERE response_type IS NOT NULL) AS response_types,
            jsonb_object_agg(
                output_format, 
                COUNT(*)
            ) FILTER (WHERE output_format IS NOT NULL) AS formats
        FROM jobs
        WHERE created_at BETWEEN start_date AND end_date
    ),
    daily AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', day::date,
                'count', COALESCE(job_count, 0)
            ) ORDER BY day
        ) AS daily_data
        FROM (
            SELECT 
                generate_series(
                    start_date::date, 
                    end_date::date, 
                    '1 day'::interval
                )::date AS day
        ) dates
        LEFT JOIN (
            SELECT 
                DATE(created_at) AS job_date,
                COUNT(*) AS job_count
            FROM jobs
            WHERE created_at BETWEEN start_date AND end_date
            GROUP BY DATE(created_at)
        ) job_counts ON dates.day = job_counts.job_date
    )
    SELECT 
        stats.total,
        stats.completed,
        stats.failed,
        stats.avg_duration,
        stats.total_size_mb,
        stats.response_types,
        stats.formats,
        daily.daily_data
    FROM stats, daily;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: TRIGGERS
-- ============================================================================

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_elements_updated_at ON elements;
CREATE TRIGGER update_elements_updated_at
    BEFORE UPDATE ON elements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-complete job on 100% progress
CREATE OR REPLACE FUNCTION auto_complete_job()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.progress_percentage = 100 AND NEW.status = 'processing' THEN
        NEW.status = 'completed';
        NEW.completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_complete_on_progress ON jobs;
CREATE TRIGGER auto_complete_on_progress
    BEFORE UPDATE OF progress_percentage ON jobs
    FOR EACH ROW
    WHEN (NEW.progress_percentage = 100)
    EXECUTE FUNCTION auto_complete_job();

-- Update job from storage operations
CREATE OR REPLACE FUNCTION update_job_from_storage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.operation = 'upload' AND NEW.success = true THEN
        UPDATE jobs SET
            result_url = 'https://' || NEW.bucket || '.s3.' || NEW.region || '.amazonaws.com/' || NEW.key,
            result_public_url = NEW.public_url,
            result_bucket = NEW.bucket,
            result_key = NEW.key,
            file_size = NEW.file_size,
            updated_at = NOW()
        WHERE id = NEW.job_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_job_on_storage_success ON storage_operations;
CREATE TRIGGER update_job_on_storage_success
    AFTER INSERT ON storage_operations
    FOR EACH ROW
    WHEN (NEW.operation = 'upload' AND NEW.success = true)
    EXECUTE FUNCTION update_job_from_storage();

-- ============================================================================
-- STEP 4: VIEWS
-- ============================================================================

-- Job summary view
CREATE OR REPLACE VIEW job_summary AS
SELECT 
    j.id,
    j.status,
    j.response_type,
    j.output_format,
    j.width,
    j.height,
    j.fps,
    j.progress_percentage,
    j.current_step,
    j.result_url,
    j.result_public_url,
    j.file_size,
    j.error_message,
    j.error_code,
    j.created_at,
    j.updated_at,
    j.started_at,
    j.completed_at,
    j.processing_duration_ms,
    COUNT(DISTINCT e.id) AS element_count,
    STRING_AGG(DISTINCT e.type::text, ', ') AS element_types,
    MAX(e.updated_at) AS last_element_update
FROM jobs j
LEFT JOIN elements e ON j.id = e.job_id
GROUP BY j.id;

-- Job status realtime view
CREATE OR REPLACE VIEW job_status_realtime AS
SELECT 
    j.id,
    j.status,
    j.progress_percentage,
    j.current_step,
    j.updated_at,
    pt.step AS latest_step,
    pt.success AS latest_step_success,
    pt.created_at AS latest_step_started,
    pt.completed_at AS latest_step_completed
FROM jobs j
LEFT JOIN LATERAL (
    SELECT *
    FROM processing_timeline
    WHERE job_id = j.id
    ORDER BY created_at DESC
    LIMIT 1
) pt ON true;

-- Active jobs view
CREATE OR REPLACE VIEW active_jobs AS
SELECT 
    j.*,
    COUNT(e.id) AS element_count,
    EXTRACT(EPOCH FROM (NOW() - j.started_at)) AS processing_seconds
FROM jobs j
LEFT JOIN elements e ON j.id = e.job_id
WHERE j.status IN ('pending', 'processing')
GROUP BY j.id;

-- Storage summary view
CREATE OR REPLACE VIEW storage_summary AS
SELECT 
    DATE(created_at) AS date,
    COUNT(*) AS operations_count,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successful_operations,
    SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) AS failed_operations,
    SUM(file_size) / 1048576.0 AS total_mb_uploaded,
    AVG(duration_ms) AS avg_duration_ms,
    COUNT(DISTINCT job_id) AS unique_jobs
FROM storage_operations
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Processing timeline view
CREATE OR REPLACE VIEW processing_timeline_view AS
SELECT 
    pt.*,
    j.status AS job_status,
    j.output_format,
    j.width,
    j.height,
    RANK() OVER (PARTITION BY pt.job_id ORDER BY pt.step_order) AS step_rank
FROM processing_timeline pt
JOIN jobs j ON pt.job_id = j.id;

-- ============================================================================
-- STEP 5: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Jobs policies
CREATE POLICY "Jobs are viewable by everyone" ON jobs
    FOR SELECT USING (true);

CREATE POLICY "Jobs can be created by everyone" ON jobs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Jobs can be updated by everyone" ON jobs
    FOR UPDATE USING (true);

-- Elements policies
CREATE POLICY "Elements are viewable by everyone" ON elements
    FOR SELECT USING (true);

CREATE POLICY "Elements can be created by everyone" ON elements
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Elements can be updated by everyone" ON elements
    FOR UPDATE USING (true);

-- Storage operations policies
CREATE POLICY "Storage operations are viewable by everyone" ON storage_operations
    FOR SELECT USING (true);

CREATE POLICY "Storage operations can be created by everyone" ON storage_operations
    FOR INSERT WITH CHECK (true);

-- Processing timeline policies
CREATE POLICY "Timeline is viewable by everyone" ON processing_timeline
    FOR SELECT USING (true);

CREATE POLICY "Timeline can be created by everyone" ON processing_timeline
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Timeline can be updated by everyone" ON processing_timeline
    FOR UPDATE USING (true);

-- URL access logs policies
CREATE POLICY "URL logs are viewable by everyone" ON url_access_logs
    FOR SELECT USING (true);

CREATE POLICY "URL logs can be created by everyone" ON url_access_logs
    FOR INSERT WITH CHECK (true);

-- System metrics policies
CREATE POLICY "Metrics are viewable by everyone" ON system_metrics
    FOR SELECT USING (true);

CREATE POLICY "Metrics can be created by everyone" ON system_metrics
    FOR INSERT WITH CHECK (true);

-- ============================================================================
-- STEP 6: ENABLE REALTIME
-- ============================================================================

-- Enable realtime for jobs and processing_timeline tables
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE processing_timeline;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all objects were created successfully
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check tables
    SELECT COUNT(*) INTO v_count FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    RAISE NOTICE 'Created % tables', v_count;
    
    -- Check functions
    SELECT COUNT(*) INTO v_count FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
    RAISE NOTICE 'Created % functions', v_count;
    
    -- Check views
    SELECT COUNT(*) INTO v_count FROM information_schema.views 
    WHERE table_schema = 'public';
    RAISE NOTICE 'Created % views', v_count;
    
    -- Check triggers
    SELECT COUNT(*) INTO v_count FROM information_schema.triggers 
    WHERE trigger_schema = 'public';
    RAISE NOTICE 'Created % triggers', v_count;
    
    -- Check RLS policies
    SELECT COUNT(*) INTO v_count FROM pg_policies 
    WHERE schemaname = 'public';
    RAISE NOTICE 'Created % RLS policies', v_count;
END $$;