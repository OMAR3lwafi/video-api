/**
 * Comprehensive Database Service Tests
 * Tests for all database operations, real-time subscriptions, and error handling
 */

import { DatabaseService } from '../src/services/DatabaseService';
import { VideoJobService } from '../src/services/VideoJobService';
import { JobRepository, AnalyticsRepository } from '../src/services/DatabaseRepository';

describe('DatabaseService', () => {
  beforeAll(async () => {
    // Initialize database for testing
    await DatabaseService.initialize();
  });

  afterAll(async () => {
    // Cleanup after tests
    await DatabaseService.disconnect();
  });

  describe('Job Operations', () => {
    it('should create a job successfully', async () => {
      const jobResult = await DatabaseService.createJob({
        output_format: 'mp4',
        width: 1920,
        height: 1080,
        estimated_duration: 25,
        client_ip: '127.0.0.1',
        user_agent: 'Test Agent'
      });

      expect(jobResult.success).toBe(true);
      expect(jobResult.data).toBeDefined();
      expect(jobResult.data?.output_format).toBe('mp4');
      expect(jobResult.data?.width).toBe(1920);
      expect(jobResult.data?.height).toBe(1080);
    });

    it('should update job status with validation', async () => {
      // Create a test job first
      const jobResult = await DatabaseService.createJob({
        output_format: 'mp4',
        width: 1280,
        height: 720
      });

      expect(jobResult.success).toBe(true);
      const jobId = jobResult.data!.id;

      // Update status to processing
      const updateResult = await DatabaseService.updateJobStatus({
        job_id: jobId,
        status: 'processing'
      });

      expect(updateResult.success).toBe(true);

      // Verify the update
      const getResult = await DatabaseService.getJob(jobId);
      expect(getResult.success).toBe(true);
      expect(getResult.data?.status).toBe('processing');
    });

    it('should prevent invalid status transitions', async () => {
      // Create a completed job
      const jobResult = await DatabaseService.createJob({
        output_format: 'mp4',
        width: 1280,
        height: 720
      });

      const jobId = jobResult.data!.id;
      
      // Complete the job
      await DatabaseService.updateJobStatus({
        job_id: jobId,
        status: 'completed'
      });

      // Try to change status from completed (should fail)
      const invalidUpdate = await DatabaseService.updateJobStatus({
        job_id: jobId,
        status: 'processing'
      });

      expect(invalidUpdate.success).toBe(false);
      expect(invalidUpdate.error).toContain('Invalid status transition');
    });
  });

  describe('Element Management', () => {
    it('should add elements to job', async () => {
      // Create a test job
      const jobResult = await DatabaseService.createJob({
        output_format: 'mp4',
        width: 1920,
        height: 1080
      });

      const jobId = jobResult.data!.id;

      // Add an element
      const elementResult = await DatabaseService.addJobElement({
        job_id: jobId,
        type: 'video',
        source_url: 'https://example.com/video.mp4',
        element_order: 0,
        track: 0,
        x_position: '10%',
        y_position: '10%',
        width: '80%',
        height: '80%',
        fit_mode: 'contain'
      });

      expect(elementResult.success).toBe(true);
      expect(elementResult.data).toBeDefined();

      // Verify element was added
      const elementsResult = await DatabaseService.getJobElements(jobId);
      expect(elementsResult.success).toBe(true);
      expect(elementsResult.data).toHaveLength(1);
      expect(elementsResult.data?.[0].type).toBe('video');
    });

    it('should update element processing status', async () => {
      // Create job and element
      const jobResult = await DatabaseService.createJob({
        output_format: 'mp4',
        width: 1280,
        height: 720
      });

      const elementResult = await DatabaseService.addJobElement({
        job_id: jobResult.data!.id,
        type: 'image',
        source_url: 'https://example.com/image.jpg',
        element_order: 0
      });

      const elementId = elementResult.data!;

      // Update element status
      const updateResult = await DatabaseService.updateElementStatus({
        element_id: elementId,
        downloaded: true,
        local_path: '/tmp/downloaded-image.jpg',
        source_size: 1024000
      });

      expect(updateResult.success).toBe(true);
    });
  });

  describe('Processing Timeline', () => {
    it('should track processing steps', async () => {
      // Create a test job
      const jobResult = await DatabaseService.createJob({
        output_format: 'mp4',
        width: 1920,
        height: 1080
      });

      const jobId = jobResult.data!.id;

      // Start a processing step
      const stepResult = await DatabaseService.startProcessingStep({
        job_id: jobId,
        step: 'download',
        step_order: 0,
        details: { source_count: 2 }
      });

      expect(stepResult.success).toBe(true);
      expect(stepResult.data).toBeDefined();

      const timelineId = stepResult.data!;

      // Complete the step
      const completeResult = await DatabaseService.completeProcessingStep({
        timeline_id: timelineId,
        success: true,
        progress: 50,
        cpu_usage: 25.5,
        memory_usage: 512000000
      });

      expect(completeResult.success).toBe(true);

      // Verify timeline
      const timelineResult = await DatabaseService.getProcessingTimeline(jobId);
      expect(timelineResult.success).toBe(true);
      expect(timelineResult.data).toHaveLength(1);
      expect(timelineResult.data?.[0].step).toBe('download');
      expect(timelineResult.data?.[0].success).toBe(true);
    });
  });

  describe('Storage Operations', () => {
    it('should log storage operations', async () => {
      // Create a test job
      const jobResult = await DatabaseService.createJob({
        output_format: 'mp4',
        width: 1280,
        height: 720
      });

      const jobId = jobResult.data!.id;

      // Log an upload operation
      const logResult = await DatabaseService.logStorageOperation({
        job_id: jobId,
        operation: 'upload',
        bucket: 'test-bucket',
        key: 'videos/test.mp4',
        region: 'us-east-1',
        success: true,
        file_size: 5000000,
        duration_ms: 2500
      });

      expect(logResult.success).toBe(true);

      // Verify operation was logged
      const opsResult = await DatabaseService.getStorageOperations({ job_id: jobId });
      expect(opsResult.success).toBe(true);
      expect(opsResult.data).toHaveLength(1);
      expect(opsResult.data?.[0].operation).toBe('upload');
      expect(opsResult.data?.[0].success).toBe(true);
    });
  });

  describe('Health Checking', () => {
    it('should perform comprehensive health check', async () => {
      const healthResult = await DatabaseService.healthCheck();

      expect(healthResult).toBeDefined();
      expect(healthResult.status).toBeOneOf(['healthy', 'degraded', 'unhealthy']);
      expect(healthResult.response_time_ms).toBeGreaterThan(0);
      expect(healthResult.checks).toBeDefined();
      expect(healthResult.checks.connection).toBe(true);
      expect(healthResult.timestamp).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should cache and retrieve job data', async () => {
      // Create a test job
      const jobResult = await DatabaseService.createJob({
        output_format: 'mp4',
        width: 1280,
        height: 720
      });

      const jobId = jobResult.data!.id;

      // First call should hit database
      const firstCall = await DatabaseService.getJob(jobId, true);
      expect(firstCall.success).toBe(true);

      // Second call should hit cache (would be faster)
      const secondCall = await DatabaseService.getJob(jobId, true);
      expect(secondCall.success).toBe(true);
      expect(secondCall.data?.id).toBe(jobId);
    });

    it('should invalidate cache properly', async () => {
      DatabaseService.clearCache();
      const stats = DatabaseService.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});

describe('VideoJobService', () => {
  it('should create video job with elements', async () => {
    const videoRequest = {
      output_format: 'mp4' as const,
      width: 1920,
      height: 1080,
      elements: [
        {
          id: 'bg-video',
          type: 'video' as const,
          source: 'https://example.com/background.mp4',
          track: 0,
          fit_mode: 'cover' as const
        },
        {
          id: 'overlay-image',
          type: 'image' as const,
          source: 'https://example.com/overlay.png',
          track: 1,
          x: '10%',
          y: '10%',
          width: '20%',
          height: '20%'
        }
      ]
    };

    const result = await VideoJobService.createVideoJob({
      request: videoRequest,
      estimated_duration: 45,
      client_ip: '192.168.1.100',
      user_agent: 'Test Client',
      response_type: 'async'
    });

    expect(result.success).toBe(true);
    expect(result.data?.job).toBeDefined();
    expect(result.data?.elements).toHaveLength(2);
    expect(result.data?.job.output_format).toBe('mp4');
    expect(result.data?.elements[0].type).toBe('video');
    expect(result.data?.elements[1].type).toBe('image');
  });

  it('should convert database job to API response format', async () => {
    const jobResult = await DatabaseService.createJob({
      output_format: 'mp4',
      width: 1920,
      height: 1080
    });

    const dbJob = jobResult.data!;
    const apiResponse = VideoJobService.toJobStatusResponse(dbJob);

    expect(apiResponse.job_id).toBe(dbJob.id);
    expect(apiResponse.status).toBe('processing');
    expect(apiResponse.progress).toBe('0%');
  });
});

describe('JobRepository', () => {
  it('should find jobs by status', async () => {
    // Create test jobs
    const job1 = await DatabaseService.createJob({
      output_format: 'mp4',
      width: 1280,
      height: 720
    });

    const job2 = await DatabaseService.createJob({
      output_format: 'mov',
      width: 1920,
      height: 1080
    });

    // Update one to completed
    await DatabaseService.updateJobStatus({
      job_id: job1.data!.id,
      status: 'completed'
    });

    // Find pending jobs
    const pendingResult = await JobRepository.findByStatus('pending');
    expect(pendingResult.success).toBe(true);
    expect(pendingResult.data?.some(j => j.id === job2.data!.id)).toBe(true);

    // Find completed jobs
    const completedResult = await JobRepository.findByStatus('completed');
    expect(completedResult.success).toBe(true);
    expect(completedResult.data?.some(j => j.id === job1.data!.id)).toBe(true);
  });

  it('should get job with full details', async () => {
    // Create a job with elements
    const jobResult = await DatabaseService.createJob({
      output_format: 'mp4',
      width: 1280,
      height: 720
    });

    const jobId = jobResult.data!.id;

    // Add an element
    await DatabaseService.addJobElement({
      job_id: jobId,
      type: 'video',
      source_url: 'https://example.com/test.mp4',
      element_order: 0
    });

    // Start a processing step
    await DatabaseService.startProcessingStep({
      job_id: jobId,
      step: 'download',
      step_order: 0
    });

    // Get full details
    const detailsResult = await JobRepository.getJobWithDetails(jobId);
    expect(detailsResult.success).toBe(true);
    expect(detailsResult.data?.job).toBeDefined();
    expect(detailsResult.data?.elements).toHaveLength(1);
    expect(detailsResult.data?.timeline).toHaveLength(1);
  });
});

describe('Real-time Subscriptions', () => {
  it('should handle job status change subscriptions', (done) => {
    const callback = jest.fn((notification) => {
      expect(notification.job_id).toBeDefined();
      expect(notification.new_status).toBeDefined();
      done();
    });

    // Subscribe to job status changes
    const subscriptionId = DatabaseService.subscribeToJobStatusChanges(callback);
    expect(subscriptionId).toBeDefined();

    // Create a job to trigger notification
    DatabaseService.createJob({
      output_format: 'mp4',
      width: 1280,
      height: 720
    }).then(result => {
      if (result.success) {
        // Update status to trigger notification
        DatabaseService.updateJobStatus({
          job_id: result.data!.id,
          status: 'processing'
        });
      }
    });

    // Cleanup after test
    setTimeout(async () => {
      await DatabaseService.unsubscribe(subscriptionId);
    }, 1000);
  });
});

describe('Analytics and Statistics', () => {
  it('should get job statistics', async () => {
    const statsResult = await DatabaseService.getJobStatistics();
    expect(statsResult.success).toBe(true);
    expect(statsResult.data).toBeDefined();
    expect(typeof statsResult.data?.total_jobs).toBe('number');
  });

  it('should get storage statistics', async () => {
    const statsResult = await DatabaseService.getStorageStatistics();
    expect(statsResult.success).toBe(true);
    expect(statsResult.data).toBeDefined();
    expect(typeof statsResult.data?.total_operations).toBe('number');
  });
});

describe('Error Handling', () => {
  it('should handle database errors gracefully', async () => {
    // Try to get non-existent job
    const result = await DatabaseService.getJob('00000000-0000-0000-0000-000000000000');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should handle invalid job creation parameters', async () => {
    const result = await DatabaseService.createJob({
      output_format: 'invalid_format',
      width: -1,
      height: -1
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
