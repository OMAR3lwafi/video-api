# Video API Usage Examples

This document provides comprehensive examples for using the Video Generation Platform API across different scenarios and use cases.

## Table of Contents

- [Authentication](#authentication)
- [Basic Video Creation](#basic-video-creation)
- [Complex Multi-Element Videos](#complex-multi-element-videos)
- [Async Job Monitoring](#async-job-monitoring)
- [Real-time Updates](#real-time-updates)
- [Job Management](#job-management)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Health Monitoring](#health-monitoring)
- [SDK Usage](#sdk-usage)

## Authentication

### API Key Authentication

```bash
curl -X GET "https://api.videogeneration.platform/api/v1/health" \
  -H "X-API-Key: vapi_abc123def456ghi789"
```

### Bearer Token Authentication

```bash
curl -X GET "https://api.videogeneration.platform/api/v1/video/jobs" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### JavaScript/TypeScript

```typescript
// Using fetch with API Key
const response = await fetch('https://api.videogeneration.platform/api/v1/health', {
  headers: {
    'X-API-Key': 'vapi_abc123def456ghi789',
    'Content-Type': 'application/json'
  }
});

// Using fetch with Bearer Token
const response = await fetch('https://api.videogeneration.platform/api/v1/video/jobs', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  }
});
```

## Basic Video Creation

### Simple Image Overlay

Create a video with a logo overlay in the top-right corner:

```bash
curl -X POST "https://api.videogeneration.platform/api/v1/videocreate" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "output_format": "mp4",
    "width": 1920,
    "height": 1080,
    "elements": [
      {
        "id": "background_video",
        "type": "video",
        "source": "https://example.com/background.mp4",
        "track": 0
      },
      {
        "id": "logo_overlay",
        "type": "image",
        "source": "https://example.com/logo.png",
        "track": 1,
        "x": "80%",
        "y": "10%",
        "width": "15%",
        "height": "15%",
        "fit_mode": "contain"
      }
    ]
  }'
```

**Expected Response (Immediate):**

```json
{
  "status": "completed",
  "processing_time": "12.3s",
  "result_url": "https://cdn.videogeneration.platform/videos/abc123/output.mp4",
  "job_id": "job_abc123def456",
  "file_size": "8.7 MB",
  "message": "Video processing completed successfully"
}
```

### JavaScript Example

```javascript
async function createSimpleVideo() {
  const response = await fetch('https://api.videogeneration.platform/api/v1/videocreate', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.VIDEO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      output_format: 'mp4',
      width: 1920,
      height: 1080,
      elements: [
        {
          id: 'background',
          type: 'video',
          source: 'https://example.com/background.mp4',
          track: 0
        },
        {
          id: 'watermark',
          type: 'image',
          source: 'https://example.com/watermark.png',
          track: 1,
          x: '85%',
          y: '5%',
          width: '10%',
          height: '10%',
          fit_mode: 'contain'
        }
      ]
    })
  });

  const result = await response.json();
  console.log('Video created:', result);
  return result;
}
```

## Complex Multi-Element Videos

### Picture-in-Picture with Multiple Overlays

```bash
curl -X POST "https://api.videogeneration.platform/api/v1/videocreate" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "output_format": "mp4",
    "width": 1920,
    "height": 1080,
    "elements": [
      {
        "id": "main_video",
        "type": "video",
        "source": "https://example.com/presentation.mp4",
        "track": 0
      },
      {
        "id": "speaker_video",
        "type": "video",
        "source": "https://example.com/speaker.mp4",
        "track": 1,
        "x": "70%",
        "y": "70%",
        "width": "25%",
        "height": "25%",
        "fit_mode": "cover"
      },
      {
        "id": "company_logo",
        "type": "image",
        "source": "https://example.com/logo.png",
        "track": 2,
        "x": "5%",
        "y": "5%",
        "width": "10%",
        "height": "10%",
        "fit_mode": "contain"
      },
      {
        "id": "title_card",
        "type": "image",
        "source": "https://example.com/title.png",
        "track": 3,
        "x": "10%",
        "y": "85%",
        "width": "30%",
        "height": "8%",
        "fit_mode": "contain"
      },
      {
        "id": "social_handle",
        "type": "image",
        "source": "https://example.com/social.png",
        "track": 4,
        "x": "85%",
        "y": "92%",
        "width": "12%",
        "height": "5%",
        "fit_mode": "contain"
      }
    ]
  }'
```

**Expected Response (Async):**

```json
{
  "status": "processing",
  "job_id": "job_def456ghi789",
  "message": "Video processing started. Check status for updates.",
  "estimated_completion": "2024-01-15T10:38:00.000Z",
  "status_check_endpoint": "/api/v1/videoresult/job_def456ghi789"
}
```

### TypeScript Example with Error Handling

```typescript
interface VideoCreationResult {
  status: 'completed' | 'processing';
  job_id: string;
  result_url?: string;
  message: string;
}

async function createComplexVideo(): Promise<VideoCreationResult> {
  try {
    const response = await fetch('https://api.videogeneration.platform/api/v1/videocreate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.JWT_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Correlation-ID': `req_${Date.now()}`
      },
      body: JSON.stringify({
        output_format: 'mp4',
        width: 3840, // 4K resolution
        height: 2160,
        elements: [
          {
            id: 'main_content',
            type: 'video',
            source: 'https://storage.example.com/main-video-4k.mp4',
            track: 0
          },
          {
            id: 'pip_speaker',
            type: 'video',
            source: 'https://storage.example.com/speaker-hd.mp4',
            track: 1,
            x: '65%',
            y: '65%',
            width: '30%',
            height: '30%',
            fit_mode: 'cover'
          },
          {
            id: 'animated_logo',
            type: 'video', // Animated logo as video
            source: 'https://storage.example.com/logo-animation.mp4',
            track: 2,
            x: '5%',
            y: '5%',
            width: '15%',
            height: '15%',
            fit_mode: 'contain'
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.message} (${error.error})`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Failed to create video:', error);
    throw error;
  }
}
```

## Async Job Monitoring

### Polling for Job Status

```bash
# Check job status
curl -X GET "https://api.videogeneration.platform/api/v1/videoresult/job_def456ghi789" \
  -H "X-API-Key: YOUR_API_KEY"
```

**Response During Processing:**

```json
{
  "status": "processing",
  "job_id": "job_def456ghi789",
  "progress": "45%",
  "current_step": "Encoding video layers",
  "message": "Video processing in progress",
  "estimated_time_remaining": "3m 15s"
}
```

**Response When Completed:**

```json
{
  "status": "completed",
  "job_id": "job_def456ghi789",
  "message": "Video processing completed successfully",
  "result_url": "https://cdn.videogeneration.platform/videos/def456/output.mp4",
  "file_size": "47.3 MB",
  "duration": "00:05:42",
  "processing_time": "8m 23s"
}
```

### JavaScript Job Monitoring

```javascript
async function monitorJobStatus(jobId, maxAttempts = 60) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(
        `https://api.videogeneration.platform/api/v1/videoresult/${jobId}`,
        {
          headers: {
            'X-API-Key': process.env.VIDEO_API_KEY
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const status = await response.json();
      
      console.log(`Job ${jobId}: ${status.status} (${status.progress || '0%'})`);
      
      if (status.current_step) {
        console.log(`Current step: ${status.current_step}`);
      }

      if (status.status === 'completed') {
        console.log('✅ Video completed:', status.result_url);
        return status;
      } else if (status.status === 'failed') {
        console.error('❌ Video processing failed:', status.error);
        throw new Error(status.error);
      }

      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
      attempts++;
      
    } catch (error) {
      console.error('Error checking job status:', error.message);
      attempts++;
      
      // Exponential backoff for errors
      await new Promise(resolve => 
        setTimeout(resolve, Math.min(5000 * Math.pow(2, attempts), 30000))
      );
    }
  }

  throw new Error('Job monitoring timed out');
}

// Usage
async function createAndWaitForVideo() {
  const createResult = await createComplexVideo();
  
  if (createResult.status === 'processing') {
    const finalResult = await monitorJobStatus(createResult.job_id);
    return finalResult;
  }
  
  return createResult;
}
```

## Real-time Updates

### Server-Sent Events (SSE)

```javascript
function subscribeToJobUpdates(jobId, authToken) {
  const eventSource = new EventSource(
    `https://api.videogeneration.platform/api/v1/video/job/${jobId}/subscribe`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }
  );

  eventSource.addEventListener('progress', (event) => {
    const data = JSON.parse(event.data);
    console.log('Progress update:', data);
    
    // Update UI progress bar
    updateProgressBar(data.progress);
  });

  eventSource.addEventListener('step', (event) => {
    const data = JSON.parse(event.data);
    console.log('Processing step:', data.current_step);
    
    // Update UI status text
    updateStatusText(data.current_step);
  });

  eventSource.addEventListener('completed', (event) => {
    const data = JSON.parse(event.data);
    console.log('Video completed:', data.result_url);
    
    // Show completion UI
    showCompletionMessage(data.result_url);
    eventSource.close();
  });

  eventSource.addEventListener('failed', (event) => {
    const data = JSON.parse(event.data);
    console.error('Video processing failed:', data.error);
    
    // Show error UI
    showErrorMessage(data.error);
    eventSource.close();
  });

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    
    // Fallback to polling
    console.log('Falling back to polling...');
    eventSource.close();
    monitorJobStatus(jobId);
  };

  return eventSource;
}
```

### React Hook for Real-time Updates

```typescript
import { useState, useEffect, useRef } from 'react';

interface JobStatus {
  status: 'processing' | 'completed' | 'failed';
  progress?: string;
  current_step?: string;
  result_url?: string;
  error?: string;
}

export function useJobStatus(jobId: string, authToken: string) {
  const [status, setStatus] = useState<JobStatus>({ status: 'processing' });
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId || !authToken) return;

    // Try SSE first
    const eventSource = new EventSource(
      `https://api.videogeneration.platform/api/v1/video/job/${jobId}/subscribe`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setStatus(prev => ({ ...prev, ...data }));
    });

    eventSource.addEventListener('completed', (event) => {
      const data = JSON.parse(event.data);
      setStatus(data);
      eventSource.close();
    });

    eventSource.addEventListener('failed', (event) => {
      const data = JSON.parse(event.data);
      setStatus(data);
      eventSource.close();
    });

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
      
      // Fallback to polling
      startPolling();
    };

    return () => {
      eventSource.close();
    };
  }, [jobId, authToken]);

  const startPolling = async () => {
    // Polling fallback implementation
    const pollStatus = async () => {
      try {
        const response = await fetch(
          `https://api.videogeneration.platform/api/v1/videoresult/${jobId}`,
          {
            headers: { 'Authorization': `Bearer ${authToken}` }
          }
        );
        
        const data = await response.json();
        setStatus(data);
        
        if (data.status === 'processing') {
          setTimeout(pollStatus, 5000);
        }
      } catch (error) {
        console.error('Polling error:', error);
        setTimeout(pollStatus, 10000);
      }
    };
    
    pollStatus();
  };

  return { status, isConnected };
}
```

## Job Management

### List Jobs with Filtering

```bash
# Get completed jobs, newest first
curl -X GET "https://api.videogeneration.platform/api/v1/video/jobs?status=completed&sort=created_at&order=desc&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
  "data": [
    {
      "job_id": "job_abc123def456",
      "status": "completed",
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:05:23.000Z",
      "output_format": "mp4",
      "width": 1920,
      "height": 1080,
      "elements_count": 2,
      "file_size": "15.2 MB",
      "processing_time": "5m 23s",
      "result_url": "https://cdn.videogeneration.platform/videos/abc123/output.mp4"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Get Detailed Job Information

```bash
curl -X GET "https://api.videogeneration.platform/api/v1/video/job/job_abc123def456/details" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Cancel a Job

```bash
curl -X DELETE "https://api.videogeneration.platform/api/v1/video/job/job_processing123/cancel" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "Job cancelled successfully",
  "job_id": "job_processing123",
  "status": "cancelled",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Error Handling

### Common Error Responses

#### Validation Error (400)

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "correlationId": "req_123abc",
  "details": [
    {
      "field": "width",
      "message": "Width must be between 1 and 7680 pixels",
      "value": 8000
    },
    {
      "field": "elements[0].source",
      "message": "Element source must be a valid URL",
      "value": "invalid-url"
    }
  ]
}
```

#### Rate Limit Error (429)

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "statusCode": 429,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "correlationId": "req_456def"
}
```

### JavaScript Error Handling

```javascript
async function createVideoWithErrorHandling(videoData) {
  try {
    const response = await fetch('https://api.videogeneration.platform/api/v1/videocreate', {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.VIDEO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(videoData)
    });

    // Parse response regardless of status
    const result = await response.json();

    if (!response.ok) {
      handleApiError(result, response.status);
      return;
    }

    return result;

  } catch (error) {
    console.error('Network error:', error);
    throw new Error('Failed to connect to API');
  }
}

function handleApiError(error, statusCode) {
  switch (statusCode) {
    case 400:
      console.error('Validation errors:');
      if (error.details) {
        error.details.forEach(detail => {
          console.error(`- ${detail.field}: ${detail.message}`);
        });
      }
      break;

    case 401:
      console.error('Authentication failed - check your API key or token');
      // Redirect to login or refresh token
      break;

    case 403:
      console.error('Insufficient permissions for this operation');
      break;

    case 404:
      console.error('Resource not found');
      break;

    case 413:
      console.error('Request payload too large');
      break;

    case 429:
      console.error('Rate limit exceeded - please wait before retrying');
      // Implement exponential backoff retry
      scheduleRetry(error);
      break;

    case 500:
    case 502:
    case 503:
    case 504:
      console.error('Server error - retrying...');
      // Implement retry logic
      scheduleRetry(error);
      break;

    default:
      console.error('Unexpected error:', error);
  }
}

function scheduleRetry(error, attempt = 1, maxAttempts = 3) {
  if (attempt > maxAttempts) {
    console.error('Max retry attempts reached');
    return;
  }

  const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff
  
  console.log(`Retrying in ${delay/1000} seconds... (attempt ${attempt}/${maxAttempts})`);
  
  setTimeout(() => {
    // Retry the original request
    createVideoWithErrorHandling(originalVideoData)
      .catch(() => scheduleRetry(error, attempt + 1, maxAttempts));
  }, delay);
}
```

## Rate Limiting

### Handling Rate Limits

```javascript
class RateLimitedApiClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.requestQueue = [];
    this.processing = false;
    this.rateLimits = {
      upload: { limit: 10, remaining: 10, resetTime: Date.now() + 60000 },
      status: { limit: 100, remaining: 100, resetTime: Date.now() + 60000 }
    };
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const { url, options, resolve, reject } = this.requestQueue.shift();

      try {
        // Check if we need to wait for rate limit reset
        await this.waitForRateLimit(url);

        const response = await fetch(url, {
          ...options,
          headers: {
            'X-API-Key': this.apiKey,
            ...options.headers
          }
        });

        // Update rate limit info from headers
        this.updateRateLimits(response.headers);

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${result.message}`);
        }

        resolve(result);

      } catch (error) {
        reject(error);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.processing = false;
  }

  async waitForRateLimit(url) {
    const endpoint = this.getEndpointType(url);
    const limits = this.rateLimits[endpoint];

    if (limits && limits.remaining <= 0) {
      const waitTime = limits.resetTime - Date.now();
      if (waitTime > 0) {
        console.log(`Rate limit exceeded for ${endpoint}. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  updateRateLimits(headers) {
    const limit = parseInt(headers.get('X-RateLimit-Limit'));
    const remaining = parseInt(headers.get('X-RateLimit-Remaining'));
    const reset = parseInt(headers.get('X-RateLimit-Reset')) * 1000;

    if (limit && remaining !== undefined && reset) {
      // Update appropriate rate limit based on endpoint
      // This would be more sophisticated in practice
      Object.keys(this.rateLimits).forEach(key => {
        this.rateLimits[key] = { limit, remaining, resetTime: reset };
      });
    }
  }

  getEndpointType(url) {
    if (url.includes('/videocreate') || url.includes('/video/create')) {
      return 'upload';
    }
    return 'status';
  }
}
```

## Health Monitoring

### Basic Health Check

```bash
curl -X GET "https://api.videogeneration.platform/api/v1/health"
```

**Response:**

```json
{
  "ok": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 86400
}
```

### Detailed Health Check

```bash
curl -X GET "https://api.videogeneration.platform/api/v1/health/detailed"
```

**Response:**

```json
{
  "ok": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 86400,
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 12,
      "lastCheck": "2024-01-15T10:29:55.000Z"
    },
    "s3": {
      "status": "healthy",
      "responseTime": 45,
      "lastCheck": "2024-01-15T10:29:55.000Z"
    },
    "ffmpeg": {
      "status": "healthy",
      "responseTime": 8,
      "lastCheck": "2024-01-15T10:29:55.000Z"
    }
  }
}
```

## SDK Usage

### TypeScript SDK

```typescript
import { VideoApiClient, VideoFormat, JobStatus } from '@videogeneration/api-client';

// Initialize client
const client = new VideoApiClient({
  apiKey: process.env.VIDEO_API_KEY,
  timeout: 30000,
  retries: 3
});

// Create video
async function createVideo() {
  try {
    const result = await client.videocreate({
      output_format: VideoFormat.MP4,
      width: 1920,
      height: 1080,
      elements: [
        {
          id: 'background',
          type: 'video',
          source: 'https://example.com/video.mp4',
          track: 0
        }
      ]
    });

    if (result.status === 'completed') {
      console.log('Video ready:', result.result_url);
    } else {
      // Monitor async job
      const final = await monitorJob(result.job_id);
      console.log('Video completed:', final.result_url);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Monitor job with SDK
async function monitorJob(jobId: string) {
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    const status = await client.videoresult(jobId);
    
    console.log(`Progress: ${status.progress || '0%'}`);
    
    if (status.status === JobStatus.COMPLETED) {
      return status;
    } else if (status.status === JobStatus.FAILED) {
      throw new Error(status.error);
    }

    await new Promise(resolve => setTimeout(resolve, 10000));
    attempts++;
  }

  throw new Error('Monitoring timeout');
}
```

### Python Example

```python
import requests
import time
import os

class VideoApiClient:
    def __init__(self, api_key, base_url="https://api.videogeneration.platform/api/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        })

    def create_video(self, video_data):
        response = self.session.post(f"{self.base_url}/videocreate", json=video_data)
        response.raise_for_status()
        return response.json()

    def get_job_status(self, job_id):
        response = self.session.get(f"{self.base_url}/videoresult/{job_id}")
        response.raise_for_status()
        return response.json()

    def monitor_job(self, job_id, max_attempts=60):
        for attempt in range(max_attempts):
            status = self.get_job_status(job_id)
            
            print(f"Job {job_id}: {status['status']} ({status.get('progress', '0%')})")
            
            if status['status'] == 'completed':
                return status
            elif status['status'] == 'failed':
                raise Exception(f"Job failed: {status.get('error')}")
            
            time.sleep(10)
        
        raise Exception("Monitoring timeout")

# Usage
client = VideoApiClient(os.getenv('VIDEO_API_KEY'))

video_data = {
    "output_format": "mp4",
    "width": 1920,
    "height": 1080,
    "elements": [
        {
            "id": "background",
            "type": "video",
            "source": "https://example.com/video.mp4",
            "track": 0
        }
    ]
}

result = client.create_video(video_data)

if result['status'] == 'processing':
    final_result = client.monitor_job(result['job_id'])
    print(f"Video completed: {final_result['result_url']}")
else:
    print(f"Video ready: {result['result_url']}")
```

## Best Practices

1. **Always include correlation IDs** for request tracking
2. **Implement proper error handling** for all status codes
3. **Use exponential backoff** for retries
4. **Monitor rate limits** and queue requests appropriately
5. **Validate input data** before sending requests
6. **Store job IDs** for later status checking
7. **Use webhook endpoints** for production applications instead of polling
8. **Implement circuit breakers** for resilient integrations
9. **Log all API interactions** for debugging
10. **Use environment variables** for sensitive configuration

This comprehensive guide should help you