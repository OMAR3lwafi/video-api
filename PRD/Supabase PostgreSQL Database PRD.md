# Supabase PostgreSQL Database PRD: Video Content Generation API (Updated)

## Project Overview

### Database Purpose
This updated document outlines the complete database schema design for the Video Content Generation API using Supabase PostgreSQL, now including AWS S3 storage integration, job tracking with public URLs, and dual response system support.

### Updated Key Requirements
- Track video processing jobs with AWS S3 storage details
- Store public direct URLs for processed videos in database
- Support both immediate and asynchronous response patterns
- Handle job ID to public URL mapping
- Track processing time estimates vs actual times
- Support real-time status updates via Supabase subscriptions

---

## Updated Database Schema Design

### 1. Jobs Table (Enhanced)
Primary table for tracking video processing jobs with AWS S3 integration.

```sql
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

-- Updated indexes for performance
CREATE INDEX idx_jobs_job_id ON jobs(job_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at);
CREATE INDEX idx_jobs_public_url ON jobs(public_url) WHERE public_url IS NOT NULL;
CREATE INDEX idx_jobs_s3_key ON jobs(s3_key) WHERE s3_key IS NOT NULL;
CREATE INDEX idx_jobs_quick_response ON jobs(is_quick_response);
CREATE INDEX idx_jobs_client_ip ON jobs(client_ip_address);
CREATE INDEX idx_jobs_completed_with_url ON jobs(completed_at, public_url) WHERE status = 'completed';
```

### 2. Storage Operations Table
Track all S3 operations for monitoring and debugging.

```sql
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

-- Storage operation indexes
CREATE INDEX idx_storage_ops_job_id ON storage_operations(job_id);
CREATE INDEX idx_storage_ops_status ON storage_operations(operation_status);
CREATE INDEX idx_storage_ops_s3_key ON storage_operations(s3_key);
CREATE INDEX idx_storage_ops_operation_type ON storage_operations(operation_type);
```

### 3. Processing Timeline Table
Detailed step-by-step processing timeline with resource usage metrics.

```sql
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

-- Timeline indexes
CREATE INDEX idx_timeline_job_id ON processing_timeline(job_id);
CREATE INDEX idx_timeline_step_name ON processing_timeline(step_name);
CREATE INDEX idx_timeline_status ON processing_timeline(step_status);
CREATE INDEX idx_timeline_order ON processing_timeline(job_id, step_order);
```

### 4. URL Access Logs Table
URL access analytics for monitoring and usage patterns.

```sql
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

-- Access log indexes
CREATE INDEX idx_access_logs_job_id ON url_access_logs(job_id);
CREATE INDEX idx_access_logs_accessed_at ON url_access_logs(accessed_at);
CREATE INDEX idx_access_logs_ip ON url_access_logs(client_ip);
CREATE INDEX idx_access_logs_url ON url_access_logs(url);
```

### 5. Elements Table
Video composition elements with positioning, timing, and processing status.

```sql
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
```

### 6. System Metrics Table
System performance metrics collection for monitoring and alerting.

```sql
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
```

---

## Database Functions and Triggers

### 1. Core Database Functions

```sql
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
-- Implementation details...
$$ LANGUAGE plpgsql;

-- Function to update job status with validation
CREATE OR REPLACE FUNCTION update_job_status(
    job_uuid UUID,
    new_status job_status,
    error_msg TEXT DEFAULT NULL,
    error_code_val VARCHAR(50) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
-- Implementation details...
$$ LANGUAGE plpgsql;

-- Function to add element to job
CREATE OR REPLACE FUNCTION add_job_element(
    job_uuid UUID,
    element_type_val element_type,
    source_url_val TEXT,
    element_order_val INTEGER,
    -- Additional parameters...
)
RETURNS UUID AS $$
-- Implementation details...
$$ LANGUAGE plpgsql;
```

### 2. Authentication Helper Functions (Public Schema)

```sql
-- Function to get current user role from JWT
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
-- Implementation details...
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
-- Implementation details...
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get client IP from request
CREATE OR REPLACE FUNCTION get_client_ip()
RETURNS INET AS $$
-- Implementation details...
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Job Status and S3 Validation
```sql
-- Enhanced job status validation with S3 integration
CREATE OR REPLACE FUNCTION validate_job_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Set timestamps based on status changes
    IF NEW.status = 'processing' AND OLD.status != 'processing' THEN
        NEW.started_at = NOW();
    END IF;
    
    IF NEW.status = 'uploading' AND OLD.status != 'uploading' THEN
        NEW.processing_timeout_at = NOW() + INTERVAL '10 minutes';
    END IF;
    
    -- Handle completion
    IF NEW.status IN ('completed', 'failed', 'cancelled', 'timeout') AND 
       OLD.status NOT IN ('completed', 'failed', 'cancelled', 'timeout') THEN
        NEW.completed_at = NOW();
        
        -- Calculate actual processing time
        IF NEW.started_at IS NOT NULL THEN
            NEW.actual_processing_seconds = EXTRACT(EPOCH FROM (NOW() - NEW.started_at));
        END IF;
    END IF;
    
    -- Validate S3 data when completed
    IF NEW.status = 'completed' THEN
        IF NEW.public_url IS NULL OR NEW.s3_key IS NULL THEN
            RAISE EXCEPTION 'Completed job must have public_url and s3_key';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_job_status 
    BEFORE UPDATE ON jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION validate_job_status_transition();
```

### 3. Automatic Processing Timeline Creation
```sql
-- Function to automatically create timeline entries
CREATE OR REPLACE FUNCTION create_timeline_entry(
    p_job_id UUID,
    p_step_name processing_step_enum,
    p_step_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    timeline_id UUID;
    step_order_num INTEGER;
BEGIN
    -- Get next step order
    SELECT COALESCE(MAX(step_order), 0) + 1 
    INTO step_order_num
    FROM processing_timeline 
    WHERE job_id = p_job_id;
    
    -- Insert timeline entry
    INSERT INTO processing_timeline (
        job_id, 
        step_name, 
        step_order, 
        step_status,
        step_details,
        started_at
    ) VALUES (
        p_job_id, 
        p_step_name, 
        step_order_num, 
        'running',
        p_step_details,
        NOW()
    ) RETURNING id INTO timeline_id;
    
    RETURN timeline_id;
END;
$$ language 'plpgsql';

-- Function to complete timeline entry
CREATE OR REPLACE FUNCTION complete_timeline_entry(
    p_job_id UUID,
    p_step_name processing_step_enum,
    p_output_data JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE processing_timeline 
    SET 
        step_status = 'completed',
        completed_at = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at)),
        progress_percent = 100,
        output_data = p_output_data
    WHERE job_id = p_job_id AND step_name = p_step_name;
END;
$$ language 'plpgsql';
```

### 4. Storage Operation Management
```sql
-- Function to create storage operation record
CREATE OR REPLACE FUNCTION create_storage_operation(
    p_job_id UUID,
    p_operation_type storage_operation_enum,
    p_s3_bucket VARCHAR(255),
    p_s3_key TEXT,
    p_s3_region VARCHAR(50)
)
RETURNS UUID AS $$
DECLARE
    operation_id UUID;
BEGIN
    INSERT INTO storage_operations (
        job_id,
        operation_type,
        s3_bucket_name,
        s3_key,
        s3_region,
        operation_status,
        started_at
    ) VALUES (
        p_job_id,
        p_operation_type,
        p_s3_bucket,
        p_s3_key,
        p_s3_region,
        'in_progress',
        NOW()
    ) RETURNING id INTO operation_id;
    
    RETURN operation_id;
END;
$$ language 'plpgsql';

-- Function to complete storage operation
CREATE OR REPLACE FUNCTION complete_storage_operation(
    p_operation_id UUID,
    p_public_url TEXT,
    p_file_size_bytes BIGINT,
    p_aws_request_id VARCHAR(255) DEFAULT NULL,
    p_etag VARCHAR(255) DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE storage_operations 
    SET 
        operation_status = 'completed',
        completed_at = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at)),
        public_url = p_public_url,
        file_size_bytes = p_file_size_bytes,
        aws_request_id = p_aws_request_id,
        etag = p_etag
    WHERE id = p_operation_id;
END;
$$ language 'plpgsql';
```

---

## Enhanced Database Views

### 1. Job Summary with Storage Info
```sql
CREATE OR REPLACE VIEW job_summary_with_storage AS
SELECT 
    j.id,
    j.job_id,
    j.status,
    j.created_at,
    j.completed_at,
    j.output_format,
    j.output_width,
    j.output_height,
    j.public_url,
    j.file_size_bytes,
    j.is_quick_response,
    j.estimated_processing_seconds,
    j.actual_processing_seconds,
    j.error_message,
    
    -- Storage information
    j.s3_bucket_name,
    j.s3_key,
    j.s3_region,
    j.upload_completed_at,
    
    -- Element counts
    COUNT(e.id) as element_count,
    COUNT(CASE WHEN e.element_type = 'video' THEN 1 END) as video_count,
    COUNT(CASE WHEN e.element_type = 'image' THEN 1 END) as image_count,
    
    -- Processing efficiency
    CASE 
        WHEN j.estimated_processing_seconds > 0 AND j.actual_processing_seconds > 0 THEN
            ROUND((j.actual_processing_seconds::DECIMAL / j.estimated_processing_seconds) * 100, 2)
        ELSE NULL
    END as processing_accuracy_percent,
    
    -- Storage operation status
    so.operation_status as last_storage_status,
    so.completed_at as storage_completed_at
    
FROM jobs j
LEFT JOIN elements e ON j.id = e.job_id
LEFT JOIN LATERAL (
    SELECT operation_status, completed_at 
    FROM storage_operations 
    WHERE job_id = j.id 
    ORDER BY created_at DESC 
    LIMIT 1
) so ON true
GROUP BY j.id, j.job_id, j.status, j.created_at, j.completed_at, 
         j.output_format, j.output_width, j.output_height, j.public_url,
         j.file_size_bytes, j.is_quick_response, j.estimated_processing_seconds,
         j.actual_processing_seconds, j.error_message, j.s3_bucket_name,
         j.s3_key, j.s3_region, j.upload_completed_at, so.operation_status,
         so.completed_at;
```

### 2. Real-time Processing Status
```sql
CREATE OR REPLACE VIEW processing_status_realtime AS
SELECT 
    j.job_id,
    j.status as job_status,
    j.created_at,
    j.is_quick_response,
    j.public_url,
    
    -- Overall progress calculation
    COALESCE(
        CASE 
            WHEN j.status = 'completed' THEN 100
            WHEN j.status = 'failed' THEN 0
            WHEN j.status = 'cancelled' THEN 0
            ELSE (
                SELECT AVG(pt.progress_percent) 
                FROM processing_timeline pt 
                WHERE pt.job_id = j.id AND pt.step_status IN ('completed', 'running')
            )
        END, 0
    ) as overall_progress_percent,
    
    -- Current step information
    (
        SELECT pt.step_name 
        FROM processing_timeline pt 
        WHERE pt.job_id = j.id 
        AND pt.step_status = 'running' 
        ORDER BY pt.step_order DESC
        LIMIT 1
    ) as current_step,
    
    -- Timing estimates
    j.estimated_processing_seconds,
    j.actual_processing_seconds,
    
    -- Time remaining estimate
    CASE 
        WHEN j.status IN ('pending', 'downloading', 'processing', 'uploading') AND j.estimated_processing_seconds > 0 THEN
            GREATEST(0, j.estimated_processing_seconds - COALESCE(
                EXTRACT(EPOCH FROM (NOW() - j.started_at))::INTEGER, 0
            ))
        ELSE 0
    END as estimated_time_remaining_seconds,
    
    -- Storage status
    so.operation_status as storage_status,
    so.public_url as storage_public_url
    
FROM jobs j
LEFT JOIN LATERAL (
    SELECT operation_status, public_url 
    FROM storage_operations 
    WHERE job_id = j.id AND operation_type = 'upload'
    ORDER BY created_at DESC 
    LIMIT 1
) so ON true;
```

### 3. Performance Analytics View
```sql
CREATE OR REPLACE VIEW performance_analytics AS
SELECT 
    DATE_TRUNC('hour', j.created_at) as time_bucket,
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN j.is_quick_response THEN 1 END) as quick_response_jobs,
    COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as completed_jobs,
    COUNT(CASE WHEN j.status = 'failed' THEN 1 END) as failed_jobs,
    
    -- Processing time statistics
    AVG(j.actual_processing_seconds) as avg_processing_time,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY j.actual_processing_seconds) as median_processing_time,
    MAX(j.actual_processing_seconds) as max_processing_time,
    
    -- File size statistics  
    AVG(j.file_size_bytes) as avg_file_size,
    SUM(j.file_size_bytes) as total_storage_used,
    
    -- Accuracy metrics
    AVG(CASE 
        WHEN j.estimated_processing_seconds > 0 AND j.actual_processing_seconds > 0 THEN
            ABS(j.actual_processing_seconds - j.estimated_processing_seconds)::DECIMAL / j.estimated_processing_seconds
        ELSE NULL
    END) as avg_estimation_error_ratio,
    
    -- Quick response rate
    ROUND(
        (COUNT(CASE WHEN j.is_quick_response THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2
    ) as quick_response_rate_percent
    
FROM jobs j
WHERE j.created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', j.created_at)
ORDER BY time_bucket DESC;
```

---

## Updated Supabase Integration Examples

### 1. Create Job with Storage Tracking
```javascript
async function createJobWithStorage(jobData) {
  const jobId = `vg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create job record with S3 configuration
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      job_id: jobId,
      status: 'pending',
      output_format: jobData.output_format,
      output_width: jobData.width,
      output_height: jobData.height,
      estimated_processing_seconds: estimateProcessingTime(jobData),
      s3_bucket_name: config.aws.s3Bucket,
      s3_region: config.aws.region,
      client_ip_address: jobData.clientIP
    })
    .select()
    .single();

  if (jobError) throw jobError;

  // Create initial timeline entry
  await supabase.rpc('create_timeline_entry', {
    p_job_id: job.id,
    p_step_name: 'job_created',
    p_step_details: { estimated_time: jobData.estimatedTime }
  });

  return { jobId, jobDbId: job.id };
}
```

### 2. Update Job with S3 URL
```javascript
async function completeJobWithS3Url(jobId, s3Details) {
  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'completed',
      public_url: s3Details.publicUrl,
      s3_key: s3Details.s3Key,
      file_size_bytes: s3Details.fileSize,
      upload_completed_at: new Date().toISOString()
    })
    .eq('job_id', jobId)
    .select()
    .single();

  if (error) throw error;

  // Complete storage operation
  await supabase.rpc('complete_storage_operation', {
    p_operation_id: s3Details.operationId,
    p_public_url: s3Details.publicUrl,
    p_file_size_bytes: s3Details.fileSize,
    p_aws_request_id: s3Details.requestId,
    p_etag: s3Details.etag
  });

  return data;
}
```

### 3. Real-time Status Subscription with Storage Info
```javascript
function subscribeToJobWithStorage(jobId, callback) {
  return supabase
    .from('processing_status_realtime')
    .on('UPDATE', { filter: `job_id=eq.${jobId}` }, (payload) => {
      const jobStatus = {
        jobId: payload.new.job_id,
        status: payload.new.job_status,
        progress: payload.new.overall_progress_percent,
        currentStep: payload.new.current_step,
        publicUrl: payload.new.public_url,
        storageStatus: payload.new.storage_status,
        estimatedTimeRemaining: payload.new.estimated_time_remaining_seconds
      };
      callback(jobStatus);
    })
    .subscribe();
}
```

---

## Migration Scripts

### Initial Migration (001_enhanced_schema.sql)
```sql
-- This migration adds S3 storage support and enhanced job tracking

-- Add new columns to existing jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS s3_bucket_name VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS s3_key TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS s3_region VARCHAR(50) DEFAULT 'us-west-2';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS public_url TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS upload_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_processing_seconds INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_processing_seconds INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_quick_response BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS error_details JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

-- Update job status enum
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'uploading';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'storing';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'timeout';

-- Add new constraints
ALTER TABLE jobs ADD CONSTRAINT IF NOT EXISTS public_url_when_completed CHECK (
    (status = 'completed' AND public_url IS NOT NULL) OR 
    (status != 'completed')
);

-- Add new indexes
CREATE INDEX IF NOT EXISTS idx_jobs_public_url ON jobs(public_url) WHERE public_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_s3_key ON jobs(s3_key) WHERE s3_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_quick_response ON jobs(is_quick_response);

-- Create new tables
-- (Include all CREATE TABLE statements for new tables)
```

### Performance Optimization Migration (002_performance_indexes.sql)
```sql
-- Add additional indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_completed_recent ON jobs(completed_at DESC) WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '30 days';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_storage_ops_job_status ON storage_operations(job_id, operation_status);

-- Add partial indexes for active jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_active ON jobs(created_at DESC) WHERE status IN ('pending', 'processing', 'uploading');
```

---

## Cleanup and Maintenance Updates

### Automated S3 Cleanup Function
```sql
-- Function to mark old jobs for S3 cleanup
CREATE OR REPLACE FUNCTION mark_jobs_for_cleanup()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER;
BEGIN
    -- Mark jobs older than 30 days for cleanup
    UPDATE jobs 
    SET status = 'expired'
    WHERE status = 'completed' 
    AND completed_at < NOW() - INTERVAL '30 days'
    AND status != 'expired';
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    -- Log cleanup operation
    INSERT INTO processing_timeline (job_id, step_name, step_status, step_details)
    SELECT 
        id, 
        'cleanup_scheduled'::processing_step_enum,
        'completed'::step_status_enum,
        jsonb_build_object('cleanup_date', NOW(), 'reason', 'lifecycle_policy')
    FROM jobs 
    WHERE status = 'expired' AND completed_at < NOW() - INTERVAL '30 days';
    
    RETURN cleanup_count;
END;
$$ language 'plpgsql';

-- Schedule cleanup (if pg_cron is available)
SELECT cron.schedule('s3-cleanup-marker', '0 2 * * *', 'SELECT mark_jobs_for_cleanup();');
```

This updated database PRD now fully supports the AWS S3 integration with public URL storage, job tracking, and the dual response system (immediate vs job ID) as requested. The schema maintains referential integrity while providing comprehensive tracking of processing times, storage operations, and system performance analytics.