# S3 Storage Service Documentation

## Overview

The S3StorageService provides comprehensive video file management capabilities for the Dynamic Video Content Generation Platform. It includes advanced features like intelligent upload strategies, circuit breaker patterns, retry mechanisms, and comprehensive error handling.

## Features

### Core Capabilities
- **Intelligent Upload Strategy**: Automatically chooses between single-part and multipart uploads based on file size
- **Progress Tracking**: Real-time upload progress with callback support
- **Public URL Generation**: Consistent naming convention and public URL generation
- **File Validation**: Comprehensive video file validation with metadata extraction
- **Error Handling**: Robust error handling with retry logic and circuit breaker pattern
- **Cleanup Operations**: Automated cleanup of old files and failed uploads
- **Lifecycle Management**: S3 bucket lifecycle policies integration

### Advanced Features
- **Circuit Breaker Pattern**: Prevents cascading failures with configurable thresholds
- **Exponential Backoff**: Intelligent retry mechanism with jitter
- **Multipart Upload**: Optimized for large files with progress tracking
- **Metadata Extraction**: FFmpeg integration for video metadata
- **Metrics and Monitoring**: Comprehensive metrics collection
- **Type Safety**: Full TypeScript support with detailed interfaces

## Installation

```bash
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner fluent-ffmpeg ffprobe-static
```

## Configuration

### Environment Variables

```bash
# Required
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# Optional
S3_ENDPOINT=https://your-custom-endpoint.com
S3_FORCE_PATH_STYLE=false

# Retry Configuration
S3_MAX_RETRIES=3
S3_BASE_DELAY=1000
S3_MAX_DELAY=10000
S3_BACKOFF_MULTIPLIER=2
S3_JITTER=true

# Circuit Breaker Configuration
S3_CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
S3_CIRCUIT_BREAKER_RESET_TIMEOUT=60000
S3_CIRCUIT_BREAKER_MONITORING_PERIOD=30000

# Lifecycle Configuration
S3_VIDEO_RETENTION_DAYS=1095
```

### Basic Usage

```typescript
import { S3StorageService } from './services/S3StorageService';
import { getS3Service } from './utils/s3-factory';

// Using factory (recommended)
const s3Service = getS3Service();

// Manual instantiation
const s3Service = new S3StorageService({
  region: 'us-east-1',
  accessKeyId: 'your-access-key',
  secretAccessKey: 'your-secret-key',
  bucketName: 'your-bucket'
});
```

## API Reference

### Upload Operations

#### `uploadVideo(filePath, key?, options?, progressCallback?)`

Upload a video file with automatic strategy selection.

```typescript
// Basic upload
const result = await s3Service.uploadVideo('/path/to/video.mp4');

// Upload with custom key
const result = await s3Service.uploadVideo('/path/to/video.mp4', 'custom/path/video.mp4');

// Upload with progress tracking
const result = await s3Service.uploadVideo(
  '/path/to/video.mp4',
  undefined,
  { storageClass: 'STANDARD_IA' },
  (progress) => {
    console.log(`Upload progress: ${progress.percentage}%`);
  }
);
```

**Parameters:**
- `filePath` (string): Path to the video file
- `key` (string, optional): S3 object key (auto-generated if not provided)
- `options` (MultipartUploadOptions, optional): Upload configuration
- `progressCallback` (ProgressCallback, optional): Progress tracking callback

**Returns:** `Promise<UploadResult>`

#### Upload Options

```typescript
interface MultipartUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  acl?: 'public-read' | 'private' | 'public-read-write';
  storageClass?: 'STANDARD' | 'REDUCED_REDUNDANCY' | 'STANDARD_IA' | 'ONEZONE_IA' | 'INTELLIGENT_TIERING' | 'GLACIER' | 'DEEP_ARCHIVE';
  serverSideEncryption?: 'AES256' | 'aws:kms';
  cacheControl?: string;
  expires?: Date;
  partSize?: number;
  queueSize?: number;
  leavePartsOnError?: boolean;
}
```

### File Operations

#### `validateVideoFile(filePath)`

Validate a video file before upload.

```typescript
const validation = await s3Service.validateVideoFile('/path/to/video.mp4');

if (validation.isValid) {
  console.log('File is valid:', validation);
} else {
  console.error('Validation errors:', validation.errors);
}
```

#### `getFileMetadata(key)`

Get metadata for an uploaded file.

```typescript
const metadata = await s3Service.getFileMetadata('videos/2024-01-01/uuid/video.mp4');
console.log('File size:', metadata.size);
console.log('Content type:', metadata.contentType);
```

#### `deleteFile(key)`

Delete a file from S3.

```typescript
const result = await s3Service.deleteFile('videos/old-video.mp4');
if (result.success) {
  console.log('File deleted successfully');
} else {
  console.error('Delete failed:', result.error);
}
```

### Cleanup Operations

#### `cleanupOldFiles(olderThanDays, prefix?)`

Clean up files older than specified days.

```typescript
// Clean up videos older than 30 days
const result = await s3Service.cleanupOldFiles(30, 'videos/');
console.log('Deleted files:', result.data);
```

### Lifecycle Management

#### `setupLifecyclePolicies(rules)`

Configure S3 bucket lifecycle policies.

```typescript
const rules = [
  {
    id: 'video-lifecycle',
    status: 'Enabled',
    filter: { prefix: 'videos/' },
    transitions: [
      { days: 30, storageClass: 'STANDARD_IA' },
      { days: 90, storageClass: 'GLACIER' }
    ],
    expiration: { days: 365 }
  }
];

await s3Service.setupLifecyclePolicies(rules);
```

### URL Generation

#### `generatePublicUrl(key)`

Generate a public URL for an uploaded file.

```typescript
const url = s3Service.generatePublicUrl('videos/2024-01-01/uuid/video.mp4');
console.log('Public URL:', url);
```

### Monitoring

#### `getMetrics()`

Get service metrics and health information.

```typescript
const metrics = s3Service.getMetrics();
console.log('Upload success rate:', metrics.uploadsSuccessful / metrics.uploadsTotal);
console.log('Circuit breaker state:', metrics.circuitBreakerState);
console.log('Average upload time:', metrics.averageUploadTime);
```

## Error Handling

The service includes comprehensive error handling:

### Retry Logic
- Automatic retry with exponential backoff
- Configurable retry attempts and delays
- Jitter to prevent thundering herd

### Circuit Breaker
- Prevents cascading failures
- Configurable failure thresholds
- Automatic recovery attempts

### Error Types
```typescript
try {
  await s3Service.uploadVideo('/path/to/video.mp4');
} catch (error) {
  if (error instanceof S3Error) {
    console.log('S3 Error Code:', error.code);
    console.log('Retryable:', error.retryable);
    console.log('Status Code:', error.statusCode);
  }
}
```

## File Validation

### Supported Formats
- **Video Types**: mp4, mov, avi, webm, mkv
- **MIME Types**: video/mp4, video/quicktime, video/x-msvideo, video/webm, video/x-matroska

### Validation Rules
- Maximum file size: 10GB
- Maximum duration: 10 minutes (600 seconds)
- Valid video metadata required

### Validation Example
```typescript
const validation = await s3Service.validateVideoFile('/path/to/video.mp4');

// Validation result
interface FileValidationResult {
  isValid: boolean;
  fileType: string;
  mimeType: string;
  size: number;
  duration?: number;
  dimensions?: { width: number; height: number };
  errors: string[];
}
```

## Progress Tracking

### Upload Progress
```typescript
await s3Service.uploadVideo('/path/to/video.mp4', undefined, undefined, (progress) => {
  console.log(`Progress: ${progress.percentage}%`);
  console.log(`Loaded: ${progress.loaded} / ${progress.total} bytes`);
  
  if (progress.part) {
    console.log(`Part: ${progress.part}`);
    console.log(`Upload ID: ${progress.uploadId}`);
  }
});
```

### Progress Interface
```typescript
interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  part?: number;        // For multipart uploads
  uploadId?: string;    // For multipart uploads
}
```

## Health Checks

```typescript
import { checkS3Health } from './utils/s3-factory';

const health = await checkS3Health();
console.log('S3 Health:', health.healthy);
console.log('Message:', health.message);
console.log('Metrics:', health.metrics);
```

## Best Practices

### Performance Optimization
1. **Use multipart upload** for files > 100MB
2. **Configure appropriate part sizes** (10MB default)
3. **Set reasonable timeouts** and retry limits
4. **Monitor circuit breaker state**

### Error Handling
1. **Always validate files** before upload
2. **Handle progress callbacks** gracefully
3. **Log errors** with correlation IDs
4. **Monitor metrics** for performance issues

### Security
1. **Use IAM roles** when possible
2. **Configure proper ACLs** for files
3. **Enable server-side encryption**
4. **Validate file types** strictly

### Cost Optimization
1. **Use appropriate storage classes**
2. **Configure lifecycle policies**
3. **Clean up failed uploads**
4. **Monitor storage usage**

## Testing

Run the comprehensive test suite:

```bash
npm test src/tests/S3StorageService.test.ts
```

### Test Coverage
- Upload operations (single-part and multipart)
- File validation and metadata extraction
- Error handling and retry logic
- Circuit breaker functionality
- Cleanup and lifecycle operations
- Progress tracking
- URL generation
- Metrics collection

## Troubleshooting

### Common Issues

#### Upload Failures
```typescript
// Check circuit breaker state
const metrics = s3Service.getMetrics();
if (metrics.circuitBreakerState === 'OPEN') {
  console.log('Circuit breaker is open, waiting for reset...');
}
```

#### Validation Errors
```typescript
const validation = await s3Service.validateVideoFile(filePath);
if (!validation.isValid) {
  validation.errors.forEach(error => console.error('Validation error:', error));
}
```

#### Connection Issues
```typescript
import { checkS3Health } from './utils/s3-factory';

const health = await checkS3Health();
if (!health.healthy) {
  console.error('S3 service unhealthy:', health.message);
}
```

### Debug Logging

Enable debug logging for detailed operation information:

```typescript
import { logger } from './utils/logger';

// The service automatically logs:
// - Upload start/completion with timing
// - Retry attempts with backoff delays
// - Circuit breaker state changes
// - File validation results
// - Error details with context
```

## Integration with Video Processing

The S3StorageService integrates seamlessly with the video processing pipeline:

```typescript
// In your video controller
import { getS3Service } from '../utils/s3-factory';

const s3Service = getS3Service();

// Upload processed video
const uploadResult = await s3Service.uploadVideo(
  processedVideoPath,
  undefined,
  {
    metadata: {
      jobId: job.id,
      originalFilename: job.originalFilename,
      processedAt: new Date().toISOString()
    },
    tags: {
      jobType: 'video-generation',
      userId: job.userId
    }
  }
);

// Return public URL
return {
  status: 'completed',
  result_url: uploadResult.publicUrl,
  file_size: uploadResult.size,
  processing_time: processingDuration
};
```

This comprehensive S3 storage service provides enterprise-grade video file management with all the advanced features required for the Dynamic Video Content Generation Platform.
