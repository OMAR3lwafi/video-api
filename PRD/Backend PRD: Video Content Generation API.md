# Backend PRD: Video Content Generation API (Updated)

## Project Overview

### Product Name
Dynamic Video Content Generation API

### Purpose
A backend API system that allows users to dynamically create custom video content by combining multiple media elements (videos, images, logos) with precise positioning and automatic fitting. The system processes media inputs, applies transformations, stores the result in AWS S3, and returns either a direct URL (for quick processing) or a job ID for later retrieval.

### Updated Workflow
1. **API Request Reception**: User sends JSON request with media elements and positioning data
2. **Processing Decision**: System determines if processing will complete within 30 seconds
3. **Quick Response Path** (â‰¤30 seconds): 
   - Process video immediately
   - Upload to AWS S3
   - Store public URL in database
   - Return direct AWS S3 URL in response
4. **Async Response Path** (>30 seconds):
   - Create job record with job ID
   - Process video asynchronously
   - Upload to AWS S3 when complete
   - Store public URL in database
   - Return job ID for status checking
5. **Status Check**: Separate endpoint to retrieve URL using job ID

---

## API Specifications

### Base URL
```
https://api.videogen.example.com/v1/
```

### Endpoints

#### 1. Create Video Job
**POST** `/videocreate`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "output_format": "mp4",
  "width": 720,
  "height": 1280,
  "elements": [
    {
      "id": "main_video",
      "type": "video",
      "source": "https://storage.example.com/user/video1.mp4",
      "track": 1,
      "time": 0,
      "fit_mode": "auto",
      "duration_mode": "auto"
    },
    {
      "id": "profile_img", 
      "type": "image",
      "source": "https://storage.example.com/user/photo.png",
      "track": 2,
      "x": "5%",
      "y": "5%",
      "width": "25%",
      "height": "25%",
      "fit_mode": "auto"
    }
  ]
}
```

**Response Option 1 (Quick Processing - â‰¤30 seconds):**
```json
{
  "status": "completed",
  "processing_time": "18 seconds",
  "result_url": "https://s3.amazonaws.com/yourbucket/processed/video_vg_abc123def456.mp4",
  "job_id": "vg_abc123def456",
  "file_size": "15.2MB",
  "message": "Video processed successfully"
}
```

**Response Option 2 (Long Processing - >30 seconds):**
```json
{
  "status": "processing",
  "job_id": "vg_abc123def456",
  "message": "Video processing started - use job ID to check status",
  "estimated_completion": "2-5 minutes",
  "status_check_endpoint": "/videoresult/vg_abc123def456"
}
```

#### 2. Get Video Result by Job ID
**GET** `/videoresult/{job_id}`

**Response (Processing):**
```json
{
  "status": "processing",
  "job_id": "vg_abc123def456",
  "progress": "65%",
  "current_step": "Uploading to AWS S3",
  "message": "Video processing in progress"
}
```

**Response (Completed):**
```json
{
  "status": "completed",
  "job_id": "vg_abc123def456",
  "result_url": "https://s3.amazonaws.com/yourbucket/processed/video_vg_abc123def456.mp4",
  "file_size": "15.2MB",
  "duration": "30 seconds",
  "processing_time": "3 minutes 45 seconds",
  "message": "Video processing completed successfully"
}
```

**Response (Failed):**
```json
{
  "status": "failed",
  "job_id": "vg_abc123def456",
  "error": "PROCESSING_FAILED",
  "message": "Video processing failed due to invalid input format",
  "details": "FFmpeg error: Unsupported codec"
}
```

---

## Processing Logic Updates

### Processing Time Estimation
The system estimates processing time based on:
- Total video duration
- Number of elements
- Video resolution
- File sizes

```javascript
function estimateProcessingTime(jobData) {
  const baseTime = 5; // seconds
  const videoElements = jobData.elements.filter(e => e.type === 'video');
  const imageElements = jobData.elements.filter(e => e.type === 'image');
  
  // Rough estimation formula
  const videoTime = videoElements.length * 10; // 10s per video
  const imageTime = imageElements.length * 2;  // 2s per image
  const resolutionMultiplier = (jobData.width * jobData.height) / (720 * 1280);
  
  const estimatedTime = (baseTime + videoTime + imageTime) * resolutionMultiplier;
  return Math.round(estimatedTime);
}
```

### AWS S3 Storage Integration

#### S3 Configuration
```json
{
  "bucket_name": "videogen-output-bucket",
  "region": "us-west-2",
  "public_access": true,
  "naming_convention": "processed/video_{job_id}_{timestamp}.mp4",
  "lifecycle_policy": {
    "delete_after_days": 30
  },
  "cors_configuration": {
    "allowed_origins": ["*"],
    "allowed_methods": ["GET", "HEAD"]
  }
}
```

#### File Naming Convention
```
Format: processed/video_{job_id}_{timestamp}.{format}
Example: processed/video_vg_abc123def456_1695123456789.mp4
```

#### Public URL Generation
```javascript
function generatePublicS3URL(bucketName, region, key) {
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}
```

---

## Data Models Updates

### Updated Job Model
```json
{
  "_id": "ObjectId",
  "job_id": "string (unique)",
  "status": "enum [pending, processing, uploading, completed, failed]",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "started_at": "timestamp",
  "completed_at": "timestamp",
  
  "input_data": {
    "output_format": "string",
    "width": "number", 
    "height": "number",
    "elements": "array"
  },
  
  "result": {
    "s3_key": "string",
    "public_url": "string (AWS S3 direct URL)",
    "file_size_bytes": "number",
    "duration_seconds": "number"
  },
  
  "processing": {
    "estimated_time_seconds": "number",
    "actual_time_seconds": "number",
    "is_quick_response": "boolean"
  },
  
  "aws_storage": {
    "bucket_name": "string",
    "region": "string", 
    "upload_completed_at": "timestamp"
  },
  
  "error_info": {
    "error_code": "string",
    "error_message": "string",
    "retry_count": "number"
  }
}
```

---

## Implementation Architecture

### Controller Logic Flow

```javascript
// POST /videocreate
async function createVideo(req, res) {
  const jobData = req.body;
  const jobId = generateJobId();
  
  // Estimate processing time
  const estimatedTime = estimateProcessingTime(jobData);
  
  if (estimatedTime <= 30) {
    // Quick processing path
    try {
      const result = await processVideoSync(jobData, jobId);
      const s3Url = await uploadToS3(result.videoPath, jobId);
      
      // Store in database immediately
      await storeJobResult(jobId, {
        status: 'completed',
        public_url: s3Url,
        file_size_bytes: result.fileSize,
        processing_time: result.processingTime,
        is_quick_response: true
      });
      
      // Return direct URL response
      return res.json({
        status: "completed",
        processing_time: `${result.processingTime} seconds`,
        result_url: s3Url,
        job_id: jobId,
        file_size: formatFileSize(result.fileSize),
        message: "Video processed successfully"
      });
      
    } catch (error) {
      // If quick processing fails, fall back to async
      return await handleAsyncProcessing(jobId, jobData, res);
    }
  } else {
    // Async processing path
    return await handleAsyncProcessing(jobId, jobData, res);
  }
}

async function handleAsyncProcessing(jobId, jobData, res) {
  // Store initial job record
  await storeJobRecord(jobId, {
    status: 'pending',
    input_data: jobData,
    estimated_time_seconds: estimateProcessingTime(jobData),
    is_quick_response: false
  });
  
  // Start async processing
  processVideoAsync(jobId, jobData);
  
  // Return job ID response
  return res.json({
    status: "processing", 
    job_id: jobId,
    message: "Video processing started - use job ID to check status",
    estimated_completion: "2-5 minutes",
    status_check_endpoint: `/videoresult/${jobId}`
  });
}

// GET /videoresult/:jobId  
async function getVideoResult(req, res) {
  const { jobId } = req.params;
  const job = await getJobById(jobId);
  
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  
  if (job.status === 'completed') {
    return res.json({
      status: "completed",
      job_id: jobId,
      result_url: job.result.public_url,
      file_size: formatFileSize(job.result.file_size_bytes),
      duration: `${job.result.duration_seconds} seconds`,
      processing_time: formatDuration(job.processing.actual_time_seconds),
      message: "Video processing completed successfully"
    });
  } else if (job.status === 'failed') {
    return res.json({
      status: "failed",
      job_id: jobId,
      error: job.error_info.error_code,
      message: job.error_info.error_message,
      details: job.error_info.details
    });
  } else {
    // Still processing
    return res.json({
      status: job.status,
      job_id: jobId, 
      progress: calculateProgress(job),
      current_step: getCurrentStep(job.status),
      message: getStatusMessage(job.status)
    });
  }
}
```

### AWS S3 Service

```javascript
class S3StorageService {
  constructor(bucketName, region, accessKey, secretKey) {
    this.s3 = new AWS.S3({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      region: region
    });
    this.bucketName = bucketName;
    this.region = region;
  }
  
  async uploadVideo(filePath, jobId) {
    const timestamp = Date.now();
    const key = `processed/video_${jobId}_${timestamp}.mp4`;
    
    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: 'video/mp4',
      ACL: 'public-read'
    };
    
    const result = await this.s3.upload(uploadParams).promise();
    return result.Location; // This is the public URL
  }
  
  async deleteVideo(key) {
    const deleteParams = {
      Bucket: this.bucketName,
      Key: key
    };
    
    return await this.s3.deleteObject(deleteParams).promise();
  }
  
  generatePublicUrl(key) {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
```

---

## Error Handling Updates

### Enhanced Error Types
```javascript
const ErrorTypes = {
  // Processing errors
  PROCESSING_TIMEOUT: 'Processing exceeded maximum time limit',
  FFMPEG_ERROR: 'Video processing failed due to FFmpeg error',
  INVALID_INPUT: 'Invalid input media format or configuration',
  
  // Storage errors  
  S3_UPLOAD_FAILED: 'Failed to upload processed video to AWS S3',
  S3_ACCESS_DENIED: 'AWS S3 access denied - check credentials',
  S3_BUCKET_NOT_FOUND: 'Specified S3 bucket does not exist',
  
  // Resource errors
  INSUFFICIENT_STORAGE: 'Insufficient storage space for processing',
  MEMORY_LIMIT_EXCEEDED: 'Processing requires more memory than available',
  
  // Network errors
  SOURCE_DOWNLOAD_FAILED: 'Failed to download source media files',
  NETWORK_TIMEOUT: 'Network request timed out'
};
```

### Retry Logic for S3 Uploads
```javascript
async function uploadWithRetry(filePath, jobId, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await s3Service.uploadVideo(filePath, jobId);
    } catch (error) {
      lastError = error;
      console.log(`S3 upload attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`S3 upload failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

---

## Performance Optimization

### Concurrent Processing Limits
```javascript
class JobQueue {
  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
    this.activeJobs = new Set();
    this.pendingJobs = [];
  }
  
  async addJob(jobId, processingFunction) {
    if (this.activeJobs.size < this.maxConcurrent) {
      this.executeJob(jobId, processingFunction);
    } else {
      this.pendingJobs.push({ jobId, processingFunction });
    }
  }
  
  async executeJob(jobId, processingFunction) {
    this.activeJobs.add(jobId);
    
    try {
      await processingFunction();
    } finally {
      this.activeJobs.delete(jobId);
      this.processNext();
    }
  }
  
  processNext() {
    if (this.pendingJobs.length > 0 && this.activeJobs.size < this.maxConcurrent) {
      const { jobId, processingFunction } = this.pendingJobs.shift();
      this.executeJob(jobId, processingFunction);
    }
  }
}
```

---

## Environment Variables Updates

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
REDIS_URL=redis://localhost:6379

# AWS S3 Configuration
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=videogen-output-bucket
S3_PUBLIC_URL_PREFIX=https://videogen-output-bucket.s3.us-west-2.amazonaws.com

# Processing Configuration
MAX_CONCURRENT_JOBS=5
QUICK_RESPONSE_THRESHOLD_SECONDS=30
TEMP_STORAGE_PATH=/tmp/videogen
MAX_FILE_SIZE_MB=100
MAX_OUTPUT_DURATION_SEC=600
PROCESSING_TIMEOUT_MINUTES=10

# Cleanup Configuration
AUTO_CLEANUP_TEMP_FILES=true
S3_LIFECYCLE_DAYS=30
```

---

## Monitoring and Logging Updates

### Key Metrics to Track
- Quick response rate (% of jobs completed within 30 seconds)
- S3 upload success rate
- Average file sizes and storage usage
- Processing time distribution
- Error rates by type (processing vs storage vs network)

### Enhanced Logging
```javascript
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'video-processing.log',
      level: 'info'
    }),
    new winston.transports.File({ 
      filename: 'errors.log', 
      level: 'error' 
    })
  ]
});

// Log processing events
logger.info('Processing started', { 
  jobId, 
  estimatedTime, 
  isQuickResponse: estimatedTime <= 30 
});

logger.info('S3 upload completed', { 
  jobId, 
  s3Key, 
  publicUrl, 
  fileSize 
});
```

---

## Security Updates

### S3 Security Best Practices
1. **Bucket Policies**: Restrict access to specific operations
2. **Public Read Only**: Files are publicly readable but not writable
3. **Signed URLs**: Option to generate time-limited access URLs
4. **Content Type Validation**: Ensure only video files are uploaded
5. **File Size Limits**: Prevent storage abuse

### S3 Bucket Policy Example
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::videogen-output-bucket/processed/*"
    },
    {
      "Sid": "DenyDirectWrite",
      "Effect": "Deny", 
      "Principal": "*",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::videogen-output-bucket/processed/*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalServiceName": "videogen-api.yourcompany.com"
        }
      }
    }
  ]
}
```

---

## Testing Updates

### Integration Tests for S3 Storage
```javascript
describe('S3 Storage Integration', () => {
  test('should upload video and return public URL', async () => {
    const mockVideoPath = './test/fixtures/sample.mp4';
    const jobId = 'test_job_123';
    
    const publicUrl = await s3Service.uploadVideo(mockVideoPath, jobId);
    
    expect(publicUrl).toMatch(/^https:\/\/.*\.s3\..*\.amazonaws\.com\//);
    
    // Verify file is accessible
    const response = await fetch(publicUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('video/mp4');
  });
  
  test('should handle S3 upload failures gracefully', async () => {
    const invalidPath = './nonexistent.mp4';
    const jobId = 'test_job_456';
    
    await expect(s3Service.uploadVideo(invalidPath, jobId))
      .rejects.toThrow('ENOENT');
  });
});
```

### Load Testing Scenarios
```javascript
// Test concurrent job processing
describe('Concurrent Processing Load Test', () => {
  test('should handle multiple simultaneous requests', async () => {
    const requests = Array(10).fill().map((_, i) => 
      request(app)
        .post('/videocreate')
        .send(mockJobData)
    );
    
    const responses = await Promise.all(requests);
    
    // Check that some are quick responses and some are async
    const quickResponses = responses.filter(r => r.body.status === 'completed');
    const asyncResponses = responses.filter(r => r.body.status === 'processing');
    
    expect(quickResponses.length + asyncResponses.length).toBe(10);
  });
});
```

---

This updated Backend PRD now includes the complete AWS S3 integration with the dual response system (immediate URL for quick processing, job ID for longer processing) as requested. The system intelligently determines response type based on estimated processing time and provides robust error handling and monitoring for the storage operations.