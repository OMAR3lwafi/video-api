# Complete System Building PRD: Video Content Generation Platform (Updated)

## Project Overview

### System Name
Dynamic Video Content Generation Platform with AWS S3 Integration

### Updated Building Scope
This updated document provides a comprehensive step-by-step implementation guide for building the complete Video Content Generation system with AWS S3 storage integration and dual response system:

1. **Backend API** (Node.js/Python + FFmpeg + AWS S3)
2. **Database** (Supabase PostgreSQL with S3 tracking)
3. **Frontend Interface** (React.js + TypeScript with dual response handling)

### Enhanced Architecture Summary
- **Backend**: REST API with intelligent processing-time estimation and dual response system
- **Database**: PostgreSQL with S3 storage tracking and public URL management  
- **Frontend**: React interface handling both immediate results and async job tracking
- **Storage**: AWS S3 with public URLs and lifecycle management
- **Processing**: FFmpeg with S3 upload pipeline

---

## Updated Implementation Roadmap

### Phase 1: Enhanced Foundation Setup (Week 1)

#### 1.1 AWS S3 Bucket Configuration

**S3 Bucket Setup**:
```bash
# Create S3 bucket with proper configuration
aws s3 mb s3://videogen-output-bucket --region us-west-2

# Set bucket policy for public read access
cat > bucket-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::videogen-output-bucket/processed/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket videogen-output-bucket --policy file://bucket-policy.json

# Set lifecycle policy for 30-day deletion
cat > lifecycle-policy.json << 'EOF'
{
  "Rules": [
    {
      "ID": "DeleteOldVideos",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "processed/"
      },
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
EOF

aws s3api put-bucket-lifecycle-configuration --bucket videogen-output-bucket --lifecycle-configuration file://lifecycle-policy.json
```

**Enhanced Backend Environment**:
```bash
# Backend setup with S3 integration
cd backend
npm init -y
npm install express cors helmet morgan compression dotenv
npm install multer axios uuid ffmpeg fluent-ffmpeg
npm install @supabase/supabase-js
npm install aws-sdk
npm install --save-dev nodemon typescript @types/node ts-node
```

#### 1.2 Updated Configuration Files

**Enhanced Backend Configuration** (`backend/src/config/index.ts`):
```typescript
export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Supabase Configuration
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  
  // AWS S3 Configuration
  aws: {
    region: process.env.AWS_REGION || 'us-west-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    s3Bucket: process.env.S3_BUCKET_NAME!,
    s3PublicUrlPrefix: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com`,
  },
  
  // Processing Configuration with Quick Response
  processing: {
    maxConcurrentJobs: 5,
    quickResponseThresholdSeconds: 30,
    tempStoragePath: '/tmp/videogen',
    maxFileSizeMB: 100,
    maxOutputDurationSec: 600,
    processingTimeoutMinutes: 10,
  },
  
  // S3 Storage Configuration
  storage: {
    autoCleanupTempFiles: true,
    s3LifecycleDays: 30,
    uploadRetries: 3,
    uploadTimeout: 300000, // 5 minutes
  },
};
```

**Updated Environment Variables** (`.env`):
```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AWS S3 Configuration
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=videogen-output-bucket

# Processing Configuration
MAX_CONCURRENT_JOBS=5
QUICK_RESPONSE_THRESHOLD_SECONDS=30
TEMP_STORAGE_PATH=/tmp/videogen
PROCESSING_TIMEOUT_MINUTES=10

# Storage Configuration
AUTO_CLEANUP_TEMP_FILES=true
S3_LIFECYCLE_DAYS=30
UPLOAD_RETRIES=3
```

---

### Phase 2: Enhanced Database Implementation (Week 1-2)

#### 2.1 Updated Database Schema with S3 Integration

**Enhanced Migration** (`supabase/migrations/001_enhanced_s3_schema.sql`):
```sql
-- Job status enum with comprehensive states
CREATE TYPE job_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'timeout'
);

-- Response types for dual response system
CREATE TYPE response_type AS ENUM (
    'immediate',
    'async'
);

-- Enhanced jobs table with S3 integration
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

-- Storage operations tracking table
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

-- Enhanced indexes for performance
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_jobs_response_type ON jobs(response_type);
CREATE INDEX idx_jobs_processing_times ON jobs(processing_started_at, processing_completed_at);
CREATE INDEX idx_jobs_s3_location ON jobs(s3_bucket, s3_key);
CREATE INDEX idx_jobs_client_ip ON jobs(client_ip);

CREATE INDEX idx_storage_operations_job_id ON storage_operations(job_id);
CREATE INDEX idx_storage_operations_operation ON storage_operations(operation);
CREATE INDEX idx_storage_operations_created_at ON storage_operations(created_at DESC);
CREATE INDEX idx_storage_operations_success ON storage_operations(success);
```

---

### Phase 3: Enhanced Backend Implementation (Week 2-3)

#### 3.1 S3 Storage Service Implementation

**AWS S3 Service** (`src/services/s3StorageService.ts`):
```typescript
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

export class S3StorageService {
  private s3: AWS.S3;
  private bucketName: string;
  private region: string;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
      region: config.aws.region,
    });
    this.bucketName = config.aws.s3Bucket;
    this.region = config.aws.region;
  }

  async uploadVideo(filePath: string, jobId: string): Promise<S3UploadResult> {
    const timestamp = Date.now();
    const key = `processed/video_${jobId}_${timestamp}.mp4`;
    
    const fileStats = fs.statSync(filePath);
    
    const uploadParams: AWS.S3.PutObjectRequest = {
      Bucket: this.bucketName,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: 'video/mp4',
      ACL: 'public-read',
      Metadata: {
        'job-id': jobId,
        'upload-timestamp': timestamp.toString(),
      },
    };

    try {
      const result = await this.s3.upload(uploadParams).promise();
      
      return {
        success: true,
        publicUrl: result.Location,
        s3Key: key,
        bucketName: this.bucketName,
        region: this.region,
        fileSize: fileStats.size,
        etag: result.ETag,
        requestId: result.$response.requestId,
      };
    } catch (error) {
      throw new S3UploadError(`S3 upload failed: ${error.message}`, error);
    }
  }

  async verifyUpload(s3Key: string): Promise<boolean> {
    try {
      await this.s3.headObject({
        Bucket: this.bucketName,
        Key: s3Key,
      }).promise();
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(s3Key: string): Promise<void> {
    await this.s3.deleteObject({
      Bucket: this.bucketName,
      Key: s3Key,
    }).promise();
  }

  generatePublicUrl(s3Key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;
  }
}

export interface S3UploadResult {
  success: boolean;
  publicUrl: string;
  s3Key: string;
  bucketName: string;
  region: string;
  fileSize: number;
  etag?: string;
  requestId?: string;
}

export class S3UploadError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'S3UploadError';
  }
}
```

#### 3.2 Enhanced Video Processing Service

**Updated Video Processor** (`src/services/videoProcessor.ts`):
```typescript
import { DatabaseService } from '../database/supabase';
import { S3StorageService } from './s3StorageService';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';

export class VideoProcessor {
  private db: DatabaseService;
  private s3: S3StorageService;

  constructor() {
    this.db = new DatabaseService();
    this.s3 = new S3StorageService();
  }

  // Estimate processing time for quick response decision
  estimateProcessingTime(jobData: any): number {
    const baseTime = 5; // Base processing time in seconds
    const videoElements = jobData.elements.filter(e => e.type === 'video');
    const imageElements = jobData.elements.filter(e => e.type === 'image');
    
    // Rough estimation based on complexity
    const videoTime = videoElements.length * 8; // 8 seconds per video
    const imageTime = imageElements.length * 2;  // 2 seconds per image
    const resolutionMultiplier = (jobData.width * jobData.height) / (720 * 1280);
    
    return Math.round((baseTime + videoTime + imageTime) * resolutionMultiplier);
  }

  // Process video synchronously for quick responses
  async processSyncJob(jobData: any, jobId: string): Promise<SyncProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Update status to processing
      await this.db.updateJobStatus(jobId, 'processing', {
        started_at: new Date().toISOString(),
        is_quick_response: true
      });

      // Get job details
      const job = await this.db.getJobWithElements(jobId);
      
      // Download media (quick timeout for sync processing)
      const downloadStart = Date.now();
      const localPaths = await this.downloadMediaFilesQuick(job.elements);
      const downloadTime = Math.round((Date.now() - downloadStart) / 1000);

      // Process video
      const processingStart = Date.now();
      const outputPath = await this.generateVideo(job, localPaths);
      const processingTime = Math.round((Date.now() - processingStart) / 1000);

      // Upload to S3
      await this.db.updateJobStatus(jobId, 'uploading');
      const uploadStart = Date.now();
      const s3Result = await this.s3.uploadVideo(outputPath, jobId);
      const uploadTime = Math.round((Date.now() - uploadStart) / 1000);

      // Update job with final results
      await this.db.updateJobStatus(jobId, 'completed', {
        public_url: s3Result.publicUrl,
        s3_key: s3Result.s3Key,
        s3_bucket_name: s3Result.bucketName,
        s3_region: s3Result.region,
        file_size_bytes: s3Result.fileSize,
        upload_completed_at: new Date().toISOString(),
        download_time_seconds: downloadTime,
        video_processing_time_seconds: processingTime,
        upload_time_seconds: uploadTime,
      });

      // Cleanup temp files
      await this.cleanup(localPaths, outputPath);

      const totalTime = Math.round((Date.now() - startTime) / 1000);

      return {
        success: true,
        publicUrl: s3Result.publicUrl,
        jobId,
        fileSize: s3Result.fileSize,
        processingTime: totalTime,
        breakdown: {
          download: downloadTime,
          processing: processingTime,
          upload: uploadTime,
        }
      };

    } catch (error) {
      await this.db.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
        error_code: 'SYNC_PROCESSING_FAILED'
      });
      throw error;
    }
  }

  // Process video asynchronously for longer jobs
  async processAsyncJob(jobId: string): Promise<void> {
    try {
      const job = await this.db.getJobWithElements(jobId);
      
      // Update status progression with detailed tracking
      await this.db.updateJobStatus(jobId, 'downloading');
      const localPaths = await this.downloadMediaFiles(job.elements);
      
      await this.db.updateJobStatus(jobId, 'processing');
      const outputPath = await this.generateVideo(job, localPaths);
      
      await this.db.updateJobStatus(jobId, 'uploading');
      const s3Result = await this.s3.uploadVideo(outputPath, jobId);
      
      await this.db.updateJobStatus(jobId, 'completed', {
        public_url: s3Result.publicUrl,
        s3_key: s3Result.s3Key,
        s3_bucket_name: s3Result.bucketName,
        file_size_bytes: s3Result.fileSize,
        upload_completed_at: new Date().toISOString(),
      });

      // Cleanup
      await this.cleanup(localPaths, outputPath);

    } catch (error) {
      await this.db.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
        error_code: 'ASYNC_PROCESSING_FAILED'
      });
    }
  }

  private async downloadMediaFilesQuick(elements: any[], timeoutMs = 15000): Promise<Map<string, string>> {
    // Implement quick download with shorter timeout for sync processing
    const localPaths = new Map<string, string>();
    
    const downloadPromises = elements.map(async (element) => {
      const localPath = path.join(
        config.processing.tempStoragePath,
        `${element.element_id}_${Date.now()}.${this.getFileExtension(element.source_url)}`
      );
      
      // Download with timeout
      await Promise.race([
        this.downloadFile(element.source_url, localPath),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Download timeout')), timeoutMs)
        )
      ]);
      
      localPaths.set(element.element_id, localPath);
    });

    await Promise.all(downloadPromises);
    return localPaths;
  }

  private async downloadMediaFiles(elements: any[]): Promise<Map<string, string>> {
    // Standard download implementation for async processing
    // (Implementation similar to original but with more generous timeouts)
  }

  // Additional methods remain the same as in original implementation
}

interface SyncProcessingResult {
  success: boolean;
  publicUrl: string;
  jobId: string;
  fileSize: number;
  processingTime: number;
  breakdown: {
    download: number;
    processing: number;
    upload: number;
  };
}
```

#### 3.3 Enhanced Video Controller with Dual Response

**Updated Video Controller** (`src/controllers/videoController.ts`):
```typescript
import { Request, Response } from 'express';
import { DatabaseService } from '../database/supabase';
import { VideoProcessor } from '../services/videoProcessor';
import { validateVideoCreationRequest } from '../middleware/validation';
import { config } from '../config';

export class VideoController {
  private db: DatabaseService;
  private processor: VideoProcessor;

  constructor() {
    this.db = new DatabaseService();
    this.processor = new VideoProcessor();
  }

  // POST /videocreate - Enhanced with dual response system
  async createVideo(req: Request, res: Response) {
    try {
      // Validate request
      const validationResult = validateVideoCreationRequest(req.body);
      if (!validationResult.isValid) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.errors
        });
      }

      // Estimate processing time
      const estimatedTime = this.processor.estimateProcessingTime(req.body);
      const isQuickResponse = estimatedTime <= config.processing.quickResponseThresholdSeconds;

      // Create job record
      const jobId = await this.db.createJob({
        ...req.body,
        clientIP: req.ip,
        userAgent: req.get('User-Agent'),
        estimatedProcessingSeconds: estimatedTime,
      });

      if (isQuickResponse) {
        // Quick processing path - return direct URL
        try {
          const result = await this.processor.processSyncJob(req.body, jobId);
          
          return res.json({
            status: "completed",
            processing_time: `${result.processingTime} seconds`,
            result_url: result.publicUrl,
            job_id: jobId,
            file_size: this.formatFileSize(result.fileSize),
            message: "Video processed successfully"
          });

        } catch (error) {
          // If sync processing fails, fall back to async
          console.warn(`Sync processing failed for ${jobId}, falling back to async:`, error.message);
          
          // Update job to pending for async processing
          await this.db.updateJobStatus(jobId, 'pending', {
            is_quick_response: false,
            error_message: `Sync processing failed: ${error.message}`
          });
          
          // Start async processing
          this.processor.processAsyncJob(jobId).catch(console.error);
          
          return res.status(202).json({
            status: "processing",
            job_id: jobId,
            message: "Video processing started - use job ID to check status", 
            estimated_completion: "2-5 minutes",
            status_check_endpoint: `/videoresult/${jobId}`
          });
        }
      } else {
        // Async processing path - return job ID
        this.processor.processAsyncJob(jobId).catch(console.error);
        
        return res.status(202).json({
          status: "processing",
          job_id: jobId,
          message: "Video processing started - use job ID to check status",
          estimated_completion: this.formatEstimatedTime(estimatedTime),
          status_check_endpoint: `/videoresult/${jobId}`
        });
      }

    } catch (error) {
      console.error('Create video error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  // GET /videoresult/:jobId - Enhanced with S3 URL support
  async getJobResult(req: Request, res: Response) {
    try {
      const { jobId } = req.params;
      const job = await this.db.getJobWithElements(jobId);

      if (!job) {
        return res.status(404).json({
          error: 'Job not found'
        });
      }

      if (job.status === 'completed') {
        return res.json({
          status: 'completed',
          job_id: jobId,
          result_url: job.public_url,
          file_size: this.formatFileSize(job.file_size_bytes),
          duration: `${Math.round(job.output_duration_seconds || 0)} seconds`,
          processing_time: this.formatDuration(job.actual_processing_seconds),
          message: 'Video processing completed successfully'
        });
      } else if (job.status === 'failed') {
        return res.json({
          status: 'failed',
          job_id: jobId,
          error: job.error_code || 'PROCESSING_FAILED',
          message: job.error_message || 'Processing failed',
          details: job.error_details
        });
      } else {
        // Still processing - return current status
        const progress = this.calculateProgress(job.status);
        return res.json({
          status: job.status,
          job_id: jobId,
          progress: `${progress}%`,
          current_step: this.getCurrentStepDescription(job.status),
          message: this.getStatusMessage(job.status)
        });
      }

    } catch (error) {
      console.error('Get job result error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  private calculateProgress(status: string): number {
    const progressMap = {
      'pending': 0,
      'estimating': 5,
      'downloading': 20,
      'processing': 60,
      'uploading': 85,
      'storing': 95,
      'completed': 100,
      'failed': 0,
      'cancelled': 0,
      'timeout': 0
    };
    return progressMap[status] || 0;
  }

  private getCurrentStepDescription(status: string): string {
    const stepMap = {
      'pending': 'Queued for processing',
      'estimating': 'Analyzing complexity',
      'downloading': 'Downloading source media',
      'processing': 'Processing video elements',
      'uploading': 'Uploading to cloud storage',
      'storing': 'Finalizing storage',
      'completed': 'Completed',
      'failed': 'Failed',
      'cancelled': 'Cancelled',
      'timeout': 'Timed out'
    };
    return stepMap[status] || 'Processing';
  }

  private formatEstimatedTime(seconds: number): string {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  private formatDuration(seconds: number): string {
    if (!seconds) return '0 seconds';
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${minutes} minute${minutes > 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`;
  }

  private formatFileSize(bytes: number): string {
    if (!bytes) return '0 KB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }
}
```

---

### Phase 4: Updated Frontend Implementation (Week 3-4)

#### 4.1 Enhanced API Service with Dual Response Handling

**Updated API Service** (`src/services/api.ts`):
```typescript
import axios, { AxiosInstance } from 'axios';

export class VideoGenerationAPI {
  private httpClient: AxiosInstance;

  constructor(baseURL: string) {
    this.httpClient = axios.create({
      baseURL,
      timeout: 60000, // Increased timeout to handle sync processing
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Enhanced to handle both immediate and async responses
  async createVideo(jobData: VideoCreationForm): Promise<ImmediateResult | AsyncResult> {
    const response = await this.httpClient.post('/videocreate', jobData);
    
    // The response structure determines the type
    if (response.data.status === 'completed') {
      return response.data as ImmediateResult;
    } else if (response.data.status === 'processing') {
      return response.data as AsyncResult;
    } else {
      throw new Error(`Unexpected response status: ${response.data.status}`);
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await this.httpClient.get(`/videoresult/${jobId}`);
    return response.data;
  }

  // Verify if S3 URL is accessible
  async verifyVideoUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok && response.headers.get('content-type')?.includes('video');
    } catch {
      return false;
    }
  }

  // Helper to determine response type
  static isImmediateResult(response: any): response is ImmediateResult {
    return response.status === 'completed' && response.result_url;
  }

  static isAsyncResult(response: any): response is AsyncResult {
    return response.status === 'processing' && response.job_id && response.status_check_endpoint;
  }
}

export interface ImmediateResult {
  status: 'completed';
  processing_time: string;
  result_url: string;
  job_id: string;
  file_size: string;
  message: string;
}

export interface AsyncResult {
  status: 'processing';
  job_id: string;
  message: string;
  estimated_completion: string;
  status_check_endpoint: string;
}

export interface JobStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  job_id: string;
  progress?: string;
  current_step?: string;
  message: string;
  result_url?: string;
  file_size?: string;
  duration?: string;
  processing_time?: string;
  error?: string;
  details?: string;
}

// Initialize API service
export const api = new VideoGenerationAPI(
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
);
```

#### 4.2 Processing Result Handler Component

**Processing Handler Component** (`src/components/ProcessingHandler.tsx`):
```typescript
import React from 'react';
import { ImmediateVideoResult } from './ImmediateVideoResult';
import { AsyncVideoTracker } from './AsyncVideoTracker';
import { api, ImmediateResult, AsyncResult } from '../services/api';

interface ProcessingHandlerProps {
  result: ProcessingResult;
  onComplete: () => void;
  onError: () => void;
}

export interface ProcessingResult {
  type: 'immediate' | 'async';
  data: ImmediateResult | AsyncResult;
}

export const ProcessingHandler: React.FC<ProcessingHandlerProps> = ({
  result,
  onComplete,
  onError
}) => {
  // Handle immediate results (quick processing completed)
  if (result.type === 'immediate') {
    const immediateData = result.data as ImmediateResult;
    
    return (
      <div className="mt-8">
        <ImmediateVideoResult
          result={immediateData}
          onClose={onComplete}
        />
      </div>
    );
  }

  // Handle async results (job tracking needed)
  if (result.type === 'async') {
    const asyncData = result.data as AsyncResult;
    
    return (
      <div className="mt-8">
        <AsyncVideoTracker
          jobId={asyncData.job_id}
          estimatedCompletion={asyncData.estimated_completion}
          statusEndpoint={asyncData.status_check_endpoint}
          onJobCompleted={(completedResult) => {
            // When async job completes, show the same immediate result UI
            const immediateResult: ImmediateResult = {
              status: 'completed',
              result_url: completedResult.result_url,
              job_id: completedResult.job_id,
              file_size: completedResult.file_size,
              processing_time: completedResult.processing_time,
              message: 'Video processing completed successfully'
            };
            
            // Could transition to immediate result view or just call onComplete
            onComplete();
          }}
          onJobFailed={(error) => {
            console.error('Job processing failed:', error);
            onError();
          }}
        />
      </div>
    );
  }

  // Fallback error state
  return (
    <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-red-600">Unknown processing result type</p>
      <button 
        onClick={onError}
        className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Dismiss
      </button>
    </div>
  );
};

// Helper function to create ProcessingResult from API response
export const createProcessingResult = (response: ImmediateResult | AsyncResult): ProcessingResult => {
  if (api.constructor.isImmediateResult(response)) {
    return {
      type: 'immediate',
      data: response
    };
  } else if (api.constructor.isAsyncResult(response)) {
    return {
      type: 'async', 
      data: response
    };
  } else {
    throw new Error('Invalid API response format');
  }
};
```

---

### Phase 5: Enhanced Integration & Testing (Week 4-5)

#### 5.1 S3 Integration Tests

**S3 Storage Integration Tests** (`tests/s3-integration.test.ts`):
```typescript
import { S3StorageService } from '../src/services/s3StorageService';
import { config } from '../src/config';
import fs from 'fs';
import path from 'path';

describe('S3 Storage Integration', () => {
  let s3Service: S3StorageService;
  const testVideoPath = path.join(__dirname, 'fixtures', 'test-video.mp4');

  beforeAll(() => {
    s3Service = new S3StorageService();
    
    // Create test video file if it doesn't exist
    if (!fs.existsSync(testVideoPath)) {
      // Create a minimal test video file
      fs.mkdirSync(path.dirname(testVideoPath), { recursive: true });
      fs.writeFileSync(testVideoPath, Buffer.alloc(1024)); // 1KB dummy file
    }
  });

  test('should upload video to S3 and return public URL', async () => {
    const jobId = `test_${Date.now()}`;
    
    const result = await s3Service.uploadVideo(testVideoPath, jobId);
    
    expect(result.success).toBe(true);
    expect(result.publicUrl).toMatch(/^https:\/\/.*\.s3\..*\.amazonaws\.com\//);
    expect(result.s3Key).toMatch(new RegExp(`processed/video_${jobId}_\\d+\\.mp4`));
    expect(result.fileSize).toBeGreaterThan(0);
    
    // Verify file is accessible
    const response = await fetch(result.publicUrl, { method: 'HEAD' });
    expect(response.status).toBe(200);
    
    // Cleanup
    await s3Service.deleteObject(result.s3Key);
  }, 30000);

  test('should verify uploaded file exists', async () => {
    const jobId = `verify_test_${Date.now()}`;
    
    const result = await s3Service.uploadVideo(testVideoPath, jobId);
    
    const exists = await s3Service.verifyUpload(result.s3Key);
    expect(exists).toBe(true);
    
    // Test non-existent file
    const notExists = await s3Service.verifyUpload('non-existent-key');
    expect(notExists).toBe(false);
    
    // Cleanup
    await s3Service.deleteObject(result.s3Key);
  });

  test('should handle upload failures gracefully', async () => {
    const invalidPath = '/path/to/non-existent-file.mp4';
    const jobId = `fail_test_${Date.now()}`;
    
    await expect(s3Service.uploadVideo(invalidPath, jobId))
      .rejects.toThrow('S3 upload failed');
  });
});
```

#### 5.2 Dual Response System Tests

**Dual Response API Tests** (`tests/dual-response.test.ts`):
```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('Dual Response System', () => {
  test('should return immediate result for simple job', async () => {
    const simpleJobData = {
      output_format: 'mp4',
      width: 480,
      height: 640,
      elements: [
        {
          id: 'simple-image',
          type: 'image',
          source: 'https://picsum.photos/400/400',
          track: 1,
          fit_mode: 'auto'
        }
      ]
    };

    const response = await request(app)
      .post('/api/v1/videocreate')
      .send(simpleJobData);

    // Should be immediate response (completed) for simple job
    if (response.status === 200) {
      expect(response.body.status).toBe('completed');
      expect(response.body.result_url).toMatch(/^https:\/\/.*\.s3\..*\.amazonaws\.com\//);
      expect(response.body.job_id).toBeTruthy();
      expect(response.body.processing_time).toBeTruthy();
    } else {
      // Could still be async if server is loaded
      expect(response.status).toBe(202);
      expect(response.body.status).toBe('processing');
    }
  });

  test('should return async response for complex job', async () => {
    const complexJobData = {
      output_format: 'mp4',
      width: 1920,
      height: 1080,
      elements: [
        {
          id: 'main-video',
          type: 'video',
          source: 'https://sample-videos.com/zip/10/mp4/SampleVideo_720x480_1mb.mp4',
          track: 1,
          fit_mode: 'auto'
        },
        {
          id: 'overlay-1',
          type: 'image', 
          source: 'https://picsum.photos/400/400',
          track: 2,
          x: '10%',
          y: '10%',
          width: '25%',
          height: '25%'
        },
        {
          id: 'overlay-2',
          type: 'image',
          source: 'https://picsum.photos/300/300',
          track: 3,
          x: '70%', 
          y: '70%',
          width: '20%',
          height: '20%'
        }
      ]
    };

    const response = await request(app)
      .post('/api/v1/videocreate')
      .send(complexJobData);

    // Should be async response for complex job
    expect(response.status).toBe(202);
    expect(response.body.status).toBe('processing');
    expect(response.body.job_id).toBeTruthy();
    expect(response.body.status_check_endpoint).toBeTruthy();
    expect(response.body.estimated_completion).toBeTruthy();
  });

  test('should be able to check status of async job', async () => {
    // First create an async job
    const jobData = {
      output_format: 'mp4',
      width: 1280,
      height: 720, 
      elements: [
        {
          id: 'test-video',
          type: 'video',
          source: 'https://sample-videos.com/zip/10/mp4/SampleVideo_720x480_1mb.mp4',
          track: 1
        }
      ]
    };

    const createResponse = await request(app)
      .post('/api/v1/videocreate')
      .send(jobData);

    const jobId = createResponse.body.job_id;
    expect(jobId).toBeTruthy();

    // Check job status
    const statusResponse = await request(app)
      .get(`/api/v1/videoresult/${jobId}`);

    expect(statusResponse.status).toBe(200);
    expect(['processing', 'completed', 'failed'].includes(statusResponse.body.status)).toBe(true);
    expect(statusResponse.body.job_id).toBe(jobId);

    // If completed, should have result URL
    if (statusResponse.body.status === 'completed') {
      expect(statusResponse.body.result_url).toMatch(/^https:\/\/.*\.s3\..*\.amazonaws\.com\//);
    }
  });
});
```

---

### Phase 6: Enhanced Production Deployment (Week 5-6)

#### 6.1 Docker Configuration with S3 Support

**Enhanced Dockerfile** (`backend/Dockerfile`):
```dockerfile
FROM node:18-alpine

# Install FFmpeg and AWS CLI
RUN apk add --no-cache ffmpeg aws-cli

# Create app directory
WORKDIR /usr/src/app

# Create temp directory for video processing
RUN mkdir -p /tmp/videogen && chmod 755 /tmp/videogen

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set ownership
RUN chown -R nodejs:nodejs /usr/src/app /tmp/videogen
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node healthcheck.js

EXPOSE 3000
CMD ["node", "dist/app.js"]
```

**Health Check Script** (`backend/healthcheck.js`):
```javascript
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  method: 'GET',
  timeout: 5000,
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => {
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
```

#### 6.2 Enhanced Production Deployment

**Production Docker Compose** (`docker-compose.prod.yml`):
```yaml
version: '3.8'
services:
  api:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - AWS_REGION=${AWS_REGION}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      - QUICK_RESPONSE_THRESHOLD_SECONDS=30
      - MAX_CONCURRENT_JOBS=5
    volumes:
      - /tmp/videogen:/tmp/videogen
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'  
          memory: 2G
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.prod.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
      - ./frontend/dist:/usr/share/nginx/html
    depends_on:
      - api
    restart: unless-stopped

  redis:
    image: redis:alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

#### 6.3 Monitoring and Alerts

**Enhanced Monitoring** (`src/middleware/monitoring.ts`):
```typescript
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

// Metrics collection
export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: {
    requests: Map<string, number>;
    responseTime: Map<string, number[]>;
    s3Uploads: { success: number; failed: number };
    quickResponses: number;
    asyncResponses: number;
    processingTimes: number[];
  };

  constructor() {
    this.metrics = {
      requests: new Map(),
      responseTime: new Map(),
      s3Uploads: { success: 0, failed: 0 },
      quickResponses: 0,
      asyncResponses: 0,
      processingTimes: []
    };
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  recordRequest(path: string) {
    const count = this.metrics.requests.get(path) || 0;
    this.metrics.requests.set(path, count + 1);
  }

  recordResponseTime(path: string, timeMs: number) {
    if (!this.metrics.responseTime.has(path)) {
      this.metrics.responseTime.set(path, []);
    }
    this.metrics.responseTime.get(path)!.push(timeMs);
  }

  recordS3Upload(success: boolean) {
    if (success) {
      this.metrics.s3Uploads.success++;
    } else {
      this.metrics.s3Uploads.failed++;
    }
  }

  recordResponseType(type: 'quick' | 'async') {
    if (type === 'quick') {
      this.metrics.quickResponses++;
    } else {
      this.metrics.asyncResponses++;
    }
  }

  recordProcessingTime(timeSeconds: number) {
    this.metrics.processingTimes.push(timeSeconds);
    // Keep only last 100 entries
    if (this.metrics.processingTimes.length > 100) {
      this.metrics.processingTimes.shift();
    }
  }

  getMetrics() {
    const responseTime = new Map();
    for (const [path, times] of this.metrics.responseTime.entries()) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      responseTime.set(path, {
        average: Math.round(avg),
        count: times.length,
        min: Math.min(...times),
        max: Math.max(...times)
      });
    }

    const avgProcessingTime = this.metrics.processingTimes.length > 0
      ? this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length
      : 0;

    return {
      requests: Object.fromEntries(this.metrics.requests),
      responseTime: Object.fromEntries(responseTime),
      s3Uploads: this.metrics.s3Uploads,
      responseTypes: {
        quick: this.metrics.quickResponses,
        async: this.metrics.asyncResponses,
        quickRatePercent: this.metrics.quickResponses + this.metrics.asyncResponses > 0 
          ? Math.round((this.metrics.quickResponses / (this.metrics.quickResponses + this.metrics.asyncResponses)) * 100)
          : 0
      },
      averageProcessingTime: Math.round(avgProcessingTime)
    };
  }
}

// Metrics middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = performance.now();
  const collector = MetricsCollector.getInstance();
  
  collector.recordRequest(req.path);
  
  const originalSend = res.send;
  res.send = function(body) {
    const duration = performance.now() - start;
    collector.recordResponseTime(req.path, Math.round(duration));
    return originalSend.call(this, body);
  };
  
  next();
};

// Metrics endpoint
export const getMetrics = (req: Request, res: Response) => {
  const collector = MetricsCollector.getInstance();
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    ...collector.getMetrics()
  });
};
```

This updated Building PRD now includes complete AWS S3 integration with the dual response system (immediate URLs for quick processing â‰¤30 seconds, job IDs for longer processing >30 seconds). The system intelligently determines response type and provides seamless user experience for both scenarios while maintaining full tracking and monitoring capabilities.