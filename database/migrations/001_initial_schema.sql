-- Dynamic Video Content Generation Platform - Initial Schema
-- Migration: 001_initial_schema.sql
-- Description: Create all tables, enums, relationships, and base functions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================================
-- CUSTOM ENUM TYPES
-- ============================================================================

-- Job status enum with comprehensive states
CREATE TYPE job_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'timeout'
);

-- Element types for video composition
CREATE TYPE element_type AS ENUM (
    'video',
    'image',
    'audio',
    'text',
    'overlay'
);

-- Fit modes for element positioning
CREATE TYPE fit_mode AS ENUM (
    'auto',
    'contain',
    'cover',
    'fill',
    'stretch'
);

-- Processing step types for timeline tracking
CREATE TYPE processing_step AS ENUM (
    'validation',
    'download',
    'processing',
    'composition',
    'encoding',
    'upload',
    'cleanup'
);

-- Storage operation types
CREATE TYPE storage_operation AS ENUM (
    'upload',
    'download',
    'delete',
    'access'
);

-- Response types for dual response system
CREATE TYPE response_type AS ENUM (
    'immediate',
    'async'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Jobs table - Main job tracking with AWS S3 integration
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic job information
    status job_status NOT NULL DEFAULT 'pending',
    response_type response_type NOT NULL,
    
    -- Video output specifications
    output_format VARCHAR(10) NOT NULL DEFAULT 'mp4',
    width INTEGER NOT NULL CHECK (width > 0 AND width <= 7680),
    height INTEGER NOT NULL CHECK (height > 0 AND height <= 4320),
    
    -- Processing metrics
    estimated_duration INTEGER, -- seconds
    actual_duration INTEGER, -- seconds
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    
    -- AWS S3 storage information
    s3_bucket VARCHAR(255),
    s3_key VARCHAR(500),
    s3_region VARCHAR(50) DEFAULT 'us-east-1',
    result_url TEXT,
    file_size BIGINT, -- bytes
    
    -- Progress tracking
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    current_step processing_step,
    
    -- Error handling
    error_message TEXT,
    error_code VARCHAR(50),
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    client_ip INET,
    user_agent TEXT,
    request_metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Elements table - Video composition elements
CREATE TABLE elements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    
    -- Element identification
    element_order INTEGER NOT NULL CHECK (element_order >= 0),
    type element_type NOT NULL,
    
    -- Source information
    source_url TEXT NOT NULL,
    source_filename VARCHAR(255),
    source_size BIGINT, -- bytes
    source_duration DECIMAL(10,3), -- seconds for video/audio
    
    -- Positioning and sizing (percentages as strings)
    track INTEGER NOT NULL DEFAULT 0,
    x_position VARCHAR(10) DEFAULT '0%',
    y_position VARCHAR(10) DEFAULT '0%',
    width VARCHAR(10) DEFAULT '100%',
    height VARCHAR(10) DEFAULT '100%',
    fit_mode fit_mode DEFAULT 'auto',
    
    -- Timing (for video elements)
    start_time DECIMAL(10,3) DEFAULT 0, -- seconds
    end_time DECIMAL(10,3), -- seconds, NULL for full duration
    
    -- Processing status
    downloaded BOOLEAN DEFAULT FALSE,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    
    -- Local file paths during processing
    local_path TEXT,
    processed_path TEXT,
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(job_id, element_order)
);

-- Storage operations table - Track all S3 operations
CREATE TABLE storage_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    
    -- Operation details
    operation storage_operation NOT NULL,
    bucket VARCHAR(255) NOT NULL,
    key VARCHAR(500) NOT NULL,
    region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    
    -- Operation results
    success BOOLEAN NOT NULL DEFAULT FALSE,
    file_size BIGINT,
    duration_ms INTEGER, -- operation duration in milliseconds
    error_message TEXT,
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Processing timeline table - Detailed step tracking
CREATE TABLE processing_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    
    -- Step information
    step processing_step NOT NULL,
    step_order INTEGER NOT NULL,
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER, -- calculated duration in milliseconds
    
    -- Status and results
    success BOOLEAN,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- Details
    details JSONB,
    error_message TEXT,
    
    -- Resource usage
    cpu_usage DECIMAL(5,2), -- percentage
    memory_usage BIGINT, -- bytes
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(job_id, step, step_order)
);

-- URL access logs table - Analytics and monitoring
CREATE TABLE url_access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    
    -- Access details
    url TEXT NOT NULL,
    access_type VARCHAR(50) NOT NULL, -- 'download', 'stream', 'preview'
    
    -- Client information
    client_ip INET,
    user_agent TEXT,
    referer TEXT,
    
    -- Response details
    response_code INTEGER,
    bytes_served BIGINT,
    response_time_ms INTEGER,
    
    -- Geolocation (if available)
    country VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    
    -- Timestamps
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System metrics table - Performance monitoring
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Metric identification
    metric_name VARCHAR(100) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'counter', 'gauge', 'histogram'
    
    -- Metric values
    value DECIMAL(15,6) NOT NULL,
    unit VARCHAR(20),
    
    -- Labels for grouping
    labels JSONB,
    
    -- Timestamps
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Jobs table indexes
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_jobs_response_type ON jobs(response_type);
CREATE INDEX idx_jobs_processing_times ON jobs(processing_started_at, processing_completed_at);
CREATE INDEX idx_jobs_s3_location ON jobs(s3_bucket, s3_key);
CREATE INDEX idx_jobs_client_ip ON jobs(client_ip);

-- Elements table indexes
CREATE INDEX idx_elements_job_id ON elements(job_id);
CREATE INDEX idx_elements_type ON elements(type);
CREATE INDEX idx_elements_processing_status ON elements(downloaded, processed);
CREATE INDEX idx_elements_job_order ON elements(job_id, element_order);

-- Storage operations indexes
CREATE INDEX idx_storage_operations_job_id ON storage_operations(job_id);
CREATE INDEX idx_storage_operations_operation ON storage_operations(operation);
CREATE INDEX idx_storage_operations_created_at ON storage_operations(created_at DESC);
CREATE INDEX idx_storage_operations_success ON storage_operations(success);
CREATE INDEX idx_storage_operations_bucket_key ON storage_operations(bucket, key);

-- Processing timeline indexes
CREATE INDEX idx_processing_timeline_job_id ON processing_timeline(job_id);
CREATE INDEX idx_processing_timeline_step ON processing_timeline(step);
CREATE INDEX idx_processing_timeline_job_step_order ON processing_timeline(job_id, step_order);
CREATE INDEX idx_processing_timeline_started_at ON processing_timeline(started_at DESC);

-- URL access logs indexes
CREATE INDEX idx_url_access_logs_job_id ON url_access_logs(job_id);
CREATE INDEX idx_url_access_logs_accessed_at ON url_access_logs(accessed_at DESC);
CREATE INDEX idx_url_access_logs_client_ip ON url_access_logs(client_ip);
CREATE INDEX idx_url_access_logs_response_code ON url_access_logs(response_code);

-- System metrics indexes
CREATE INDEX idx_system_metrics_name_type ON system_metrics(metric_name, metric_type);
CREATE INDEX idx_system_metrics_recorded_at ON system_metrics(recorded_at DESC);
CREATE INDEX idx_system_metrics_labels ON system_metrics USING GIN(labels);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE jobs IS 'Main job tracking table with AWS S3 integration and dual response system support';
COMMENT ON TABLE elements IS 'Video composition elements with positioning, timing, and processing status';
COMMENT ON TABLE storage_operations IS 'Comprehensive S3 operation tracking for monitoring and debugging';
COMMENT ON TABLE processing_timeline IS 'Detailed step-by-step processing timeline with resource usage metrics';
COMMENT ON TABLE url_access_logs IS 'URL access analytics for monitoring and usage patterns';
COMMENT ON TABLE system_metrics IS 'System performance metrics collection for monitoring and alerting';

-- Column comments for critical fields
COMMENT ON COLUMN jobs.response_type IS 'Immediate (≤30s) or async (>30s) response classification';
COMMENT ON COLUMN jobs.s3_key IS 'Full S3 object key including folder structure';
COMMENT ON COLUMN jobs.result_url IS 'Public S3 URL for completed video download';
COMMENT ON COLUMN elements.element_order IS 'Processing order within the job (0-based)';
COMMENT ON COLUMN elements.track IS 'Video track/layer number for composition';
COMMENT ON COLUMN processing_timeline.step_order IS 'Sequential order of processing steps';
COMMENT ON COLUMN storage_operations.duration_ms IS 'S3 operation duration for performance monitoring';
