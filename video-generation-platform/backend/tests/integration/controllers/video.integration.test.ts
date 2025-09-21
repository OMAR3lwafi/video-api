import request from 'supertest';
import { Express } from 'express';
import { TestDataFactory } from '../../factories/TestDataFactory';
import { DatabaseFixtures } from '../../fixtures/DatabaseFixtures';
import { createApp } from '@/app';
import { DatabaseService } from '@/services/DatabaseService';
import { S3StorageService } from '@/services/S3StorageService';
import { VideoProcessor } from '@/services/VideoProcessor';
import { JobQueue } from '@/services/JobQueue';
import { CacheService } from '@/services/CacheService';

// Mock external services
jest.mock('@/services/DatabaseService');
jest.mock('@/services/S3StorageService');
jest.mock('@/services/VideoProcessor');
jest.mock('@/services/JobQueue');
jest.mock('@/services/CacheService');

describe('Video Controller Integration Tests', () => {
  let app: Express;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockS3StorageService: jest.Mocked<S3StorageService>;
  let mockVideoProcessor: jest.Mocked<VideoProcessor>;
  let mockJobQueue: jest.Mocked<JobQueue>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeAll(async () => {
    // Setup mock services
    mockDatabaseService = {
      createJob: jest.fn(),
      updateJobStatus: jest.fn(),
      updateJobProgress: jest.fn(),
      getJobById: jest.fn(),
      getUserJobs: jest.fn(),
      deleteJob: jest.fn(),
      createUser: jest.fn(),
      getUserById: jest.fn(),
      checkHealth: jest.fn().mockResolvedValue({ healthy: true }),
      close: jest.fn(),
    } as any;

    mockS3StorageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      getFileUrl: jest.fn(),
      generatePresignedUrl: jest.fn(),
      checkHealth: jest.fn().mockResolvedValue({ healthy: true }),
    } as any;

    mockVideoProcessor = {
      processVideo: jest.fn(),
      estimateProcessingTime: jest.fn(),
      validateElements: jest.fn(),
      checkHealth: jest.fn().mockResolvedValue({ healthy: true }),
    } as any;

    mockJobQueue = {
      addJob: jest.fn(),
      getJobStatus: jest.fn(),
      cancelJob: jest.fn(),
      getQueueStats: jest.fn(),
      checkHealth: jest.fn().mockResolvedValue({ healthy: true }),
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      checkHealth: jest.fn().mockResolvedValue({ healthy: true }),
    } as any;

    // Mock implementations
    (DatabaseService as jest.MockedClass<typeof DatabaseService>).mockImplementation(() => mockDatabaseService);
    (S3StorageService as jest.MockedClass<typeof S3StorageService>).mockImplementation(() => mockS3StorageService);
    (VideoProcessor as jest.MockedClass<typeof VideoProcessor>).mockImplementation(() => mockVideoProcessor);
    (JobQueue as jest.MockedClass<typeof JobQueue>).mockImplementation(() => mockJobQueue);
    (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

    // Create app instance
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock responses
    mockDatabaseService.createJob.mockResolvedValue(DatabaseFixtures.videoJobs[0]);
    mockDatabaseService.getJobById.mockResolvedValue(DatabaseFixtures.videoJobs[0]);
    mockDatabaseService.getUserJobs.mockResolvedValue(DatabaseFixtures.videoJobs);

    mockS3StorageService.uploadFile.mockResolvedValue({
      success: true,
      key: 'videos/2024/01/01/test-output.mp4',
      location: 'https://test-bucket.s3.amazonaws.com/videos/2024/01/01/test-output.mp4',
      etag: '"test-etag"',
    });

    mockVideoProcessor.estimateProcessingTime.mockReturnValue(25000);
    mockVideoProcessor.validateElements.mockResolvedValue({ valid: true, errors: [] });
    mockVideoProcessor.processVideo.mockResolvedValue({
      success: true,
      outputPath: '/tmp/output.mp4',
      processingTime: 25000,
    });

    mockJobQueue.addJob.mockResolvedValue({ id: 'job-queue-123' });
    mockJobQueue.getJobStatus.mockResolvedValue({
      id: 'job-queue-123',
      status: 'completed',
      progress: 100,
    });

    mockCacheService.get.mockResolvedValue(null);
    mockCacheService.set.mockResolvedValue(undefined);
  });

  describe('POST /api/v1/videocreate', () => {
    it('should create a video job with immediate processing (≤30 seconds)', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest({
        elements: [TestDataFactory.createImageElement()], // Simple job
      });

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'completed');
      expect(response.body).toHaveProperty('result_url');
      expect(response.body).toHaveProperty('job_id');
      expect(response.body).toHaveProperty('processing_time');
      expect(response.body).toHaveProperty('file_size');
      expect(response.body).toHaveProperty('message');

      expect(mockVideoProcessor.estimateProcessingTime).toHaveBeenCalled();
      expect(mockVideoProcessor.processVideo).toHaveBeenCalled();
      expect(mockS3StorageService.uploadFile).toHaveBeenCalled();
      expect(mockDatabaseService.createJob).toHaveBeenCalled();
    });

    it('should create a video job with async processing (>30 seconds)', async () => {
      // Mock long processing time
      mockVideoProcessor.estimateProcessingTime.mockReturnValue(45000);

      const requestData = TestDataFactory.createVideoCreateRequest({
        elements: [
          TestDataFactory.createVideoElement(),
          TestDataFactory.createVideoElement(),
          TestDataFactory.createImageElement(),
        ],
      });

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(202);

      expect(response.body).toHaveProperty('status', 'processing');
      expect(response.body).toHaveProperty('job_id');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('estimated_completion');
      expect(response.body).toHaveProperty('status_check_endpoint');

      expect(mockJobQueue.addJob).toHaveBeenCalled();
      expect(mockDatabaseService.createJob).toHaveBeenCalled();
    });

    it('should validate request body schema', async () => {
      const invalidRequest = {
        // Missing required fields
        elements: [],
      };

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('validation');
    });

    it('should validate video elements', async () => {
      mockVideoProcessor.validateElements.mockResolvedValue({
        valid: false,
        errors: ['Invalid video source URL', 'Invalid positioning values'],
      });

      const requestData = TestDataFactory.createVideoCreateRequest();

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid video source URL');
    });

    it('should handle invalid output format', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest({
        output_format: 'invalid_format' as any,
      });

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid output format');
    });

    it('should handle invalid dimensions', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest({
        width: -1920,
        height: 0,
      });

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid dimensions');
    });

    it('should limit number of elements per job', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest({
        elements: Array.from({ length: 15 }, (_, i) =>
          TestDataFactory.createVideoElement({ track: i + 1 })
        ),
      });

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Too many elements');
    });

    it('should handle video processing errors', async () => {
      mockVideoProcessor.processVideo.mockResolvedValue({
        success: false,
        error: 'FFmpeg processing failed',
      });

      const requestData = TestDataFactory.createVideoCreateRequest();

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('FFmpeg processing failed');
    });

    it('should handle S3 upload errors', async () => {
      mockS3StorageService.uploadFile.mockResolvedValue({
        success: false,
        error: 'S3 upload failed: Access denied',
      });

      const requestData = TestDataFactory.createVideoCreateRequest();

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('S3 upload failed');
    });

    it('should handle database errors', async () => {
      mockDatabaseService.createJob.mockRejectedValue(new Error('Database connection failed'));

      const requestData = TestDataFactory.createVideoCreateRequest();

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Database connection failed');
    });

    it('should apply rate limiting', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest();

      // Make multiple rapid requests
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/v1/videocreate')
          .send(requestData)
      );

      const responses = await Promise.all(requests);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle request timeout', async () => {
      jest.setTimeout(35000);

      // Mock very slow processing
      mockVideoProcessor.processVideo.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          outputPath: '/tmp/output.mp4',
          processingTime: 32000,
        }), 32000))
      );

      const requestData = TestDataFactory.createVideoCreateRequest();

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(408);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('timeout');
    }, 35000);

    it('should support different video formats', async () => {
      const formats = ['mp4', 'mov', 'avi'] as const;

      for (const format of formats) {
        const requestData = TestDataFactory.createVideoCreateRequest({
          output_format: format,
        });

        const response = await request(app)
          .post('/api/v1/videocreate')
          .send(requestData)
          .expect(200);

        expect(response.body).toHaveProperty('result_url');
        expect(response.body.result_url).toContain(`.${format}`);
      }
    });

    it('should handle concurrent requests', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest();

      const concurrentRequests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/v1/videocreate')
          .send(requestData)
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach(response => {
        expect([200, 202]).toContain(response.status);
      });
    });
  });

  describe('GET /api/v1/videoresult/:jobId', () => {
    it('should return job status for existing job', async () => {
      const jobId = 'job-123';
      const mockJob = DatabaseFixtures.getJobById(jobId) || DatabaseFixtures.videoJobs[2]; // completed job

      mockDatabaseService.getJobById.mockResolvedValue(mockJob);

      const response = await request(app)
        .get(`/api/v1/videoresult/${jobId}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', mockJob.status);
      expect(response.body).toHaveProperty('job_id', jobId);
      expect(response.body).toHaveProperty('message');

      if (mockJob.status === 'completed') {
        expect(response.body).toHaveProperty('result_url');
        expect(response.body).toHaveProperty('file_size');
        expect(response.body).toHaveProperty('processing_time');
      }

      if (mockJob.status === 'processing') {
        expect(response.body).toHaveProperty('progress');
        expect(response.body).toHaveProperty('current_step');
      }

      if (mockJob.status === 'failed') {
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should return 404 for non-existent job', async () => {
      const jobId = 'non-existent-job';
      mockDatabaseService.getJobById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/videoresult/${jobId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Job not found');
    });

    it('should validate job ID format', async () => {
      const invalidJobId = 'invalid-job-id-format';

      const response = await request(app)
        .get(`/api/v1/videoresult/${invalidJobId}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid job ID format');
    });

    it('should handle database errors', async () => {
      const jobId = 'job-123';
      mockDatabaseService.getJobById.mockRejectedValue(new Error('Database query failed'));

      const response = await request(app)
        .get(`/api/v1/videoresult/${jobId}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Database query failed');
    });

    it('should return processing job with progress', async () => {
      const jobId = 'job-processing';
      const processingJob = DatabaseFixtures.videoJobs[1]; // processing job

      mockDatabaseService.getJobById.mockResolvedValue(processingJob);

      const response = await request(app)
        .get(`/api/v1/videoresult/${jobId}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'processing');
      expect(response.body).toHaveProperty('progress', 45);
      expect(response.body).toHaveProperty('current_step', 'encoding');
      expect(response.body).toHaveProperty('estimated_completion');
    });

    it('should return failed job with error details', async () => {
      const jobId = 'job-failed';
      const failedJob = DatabaseFixtures.videoJobs[3]; // failed job

      mockDatabaseService.getJobById.mockResolvedValue(failedJob);

      const response = await request(app)
        .get(`/api/v1/videoresult/${jobId}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'failed');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('progress', 75);
      expect(response.body).toHaveProperty('current_step', 'encoding');
    });

    it('should cache job results', async () => {
      const jobId = 'job-123';
      const mockJob = DatabaseFixtures.videoJobs[2]; // completed job

      // First request - should query database
      mockDatabaseService.getJobById.mockResolvedValue(mockJob);
      mockCacheService.get.mockResolvedValue(null);

      await request(app)
        .get(`/api/v1/videoresult/${jobId}`)
        .expect(200);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `job:${jobId}`,
        expect.any(Object),
        expect.any(Number)
      );

      // Second request - should use cache
      mockCacheService.get.mockResolvedValue(mockJob);
      mockDatabaseService.getJobById.mockClear();

      await request(app)
        .get(`/api/v1/videoresult/${jobId}`)
        .expect(200);

      expect(mockDatabaseService.getJobById).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/videojob/:jobId', () => {
    it('should delete existing job', async () => {
      const jobId = 'job-123';
      const mockJob = DatabaseFixtures.videoJobs[0];

      mockDatabaseService.getJobById.mockResolvedValue(mockJob);
      mockDatabaseService.deleteJob.mockResolvedValue(true);
      mockS3StorageService.deleteFile.mockResolvedValue({ success: true });

      const response = await request(app)
        .delete(`/api/v1/videojob/${jobId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');

      expect(mockDatabaseService.deleteJob).toHaveBeenCalledWith(jobId);
    });

    it('should clean up S3 files when deleting completed job', async () => {
      const jobId = 'job-123';
      const completedJob = {
        ...DatabaseFixtures.videoJobs[2],
        result_url: 'https://test-bucket.s3.amazonaws.com/videos/output.mp4',
      };

      mockDatabaseService.getJobById.mockResolvedValue(completedJob);
      mockDatabaseService.deleteJob.mockResolvedValue(true);
      mockS3StorageService.deleteFile.mockResolvedValue({ success: true });

      await request(app)
        .delete(`/api/v1/videojob/${jobId}`)
        .expect(200);

      expect(mockS3StorageService.deleteFile).toHaveBeenCalledWith('videos/output.mp4');
    });

    it('should return 404 for non-existent job', async () => {
      const jobId = 'non-existent-job';
      mockDatabaseService.getJobById.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/v1/videojob/${jobId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Job not found');
    });

    it('should cancel processing job before deletion', async () => {
      const jobId = 'job-processing';
      const processingJob = DatabaseFixtures.videoJobs[1]; // processing job

      mockDatabaseService.getJobById.mockResolvedValue(processingJob);
      mockJobQueue.cancelJob.mockResolvedValue(true);
      mockDatabaseService.deleteJob.mockResolvedValue(true);

      await request(app)
        .delete(`/api/v1/videojob/${jobId}`)
        .expect(200);

      expect(mockJobQueue.cancelJob).toHaveBeenCalledWith(jobId);
      expect(mockDatabaseService.deleteJob).toHaveBeenCalledWith(jobId);
    });

    it('should handle deletion errors gracefully', async () => {
      const jobId = 'job-123';
      const mockJob = DatabaseFixtures.videoJobs[0];

      mockDatabaseService.getJobById.mockResolvedValue(mockJob);
      mockDatabaseService.deleteJob.mockRejectedValue(new Error('Database deletion failed'));

      const response = await request(app)
        .delete(`/api/v1/videojob/${jobId}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Database deletion failed');
    });
  });

  describe('GET /api/v1/user/:userId/jobs', () => {
    it('should return user jobs with pagination', async () => {
      const userId = 'user-1';
      const userJobs = DatabaseFixtures.getJobsByUserId(userId);

      mockDatabaseService.getUserJobs.mockResolvedValue(userJobs);

      const response = await request(app)
        .get(`/api/v1/user/${userId}/jobs`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('jobs');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.jobs).toHaveLength(userJobs.length);
      expect(response.body.pagination).toHaveProperty('currentPage', 1);
      expect(response.body.pagination).toHaveProperty('totalItems');
    });

    it('should filter jobs by status', async () => {
      const userId = 'user-1';
      const completedJobs = DatabaseFixtures.getJobsByUserId(userId).filter(j => j.status === 'completed');

      mockDatabaseService.getUserJobs.mockResolvedValue(completedJobs);

      const response = await request(app)
        .get(`/api/v1/user/${userId}/jobs`)
        .query({ status: 'completed' })
        .expect(200);

      expect(response.body.jobs).toHaveLength(completedJobs.length);
      expect(response.body.jobs.every((job: any) => job.status === 'completed')).toBe(true);
    });

    it('should return empty array for user with no jobs', async () => {
      const userId = 'user-no-jobs';

      mockDatabaseService.getUserJobs.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/v1/user/${userId}/jobs`)
        .expect(200);

      expect(response.body.jobs).toHaveLength(0);
    });

    it('should handle invalid pagination parameters', async () => {
      const userId = 'user-1';

      const response = await request(app)
        .get(`/api/v1/user/${userId}/jobs`)
        .query({ page: -1, limit: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid pagination parameters');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/videocreate')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid JSON');
    });

    it('should handle missing Content-Type header', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest();

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(JSON.stringify(requestData))
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/v1/videocreate')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'POST')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should return appropriate HTTP status codes', async () => {
      // Test various error scenarios and their HTTP codes
      const scenarios = [
        { path: '/api/v1/videoresult/invalid', expectedStatus: 400 },
        { path: '/api/v1/videoresult/non-existent-job', expectedStatus: 404 },
        { path: '/api/v1/nonexistent-endpoint', expectedStatus: 404 },
      ];

      for (const scenario of scenarios) {
        const response = await request(app).get(scenario.path);
        expect(response.status).toBe(scenario.expectedStatus);
      }
    });

    it('should include correlation IDs in error responses', async () => {
      mockDatabaseService.createJob.mockRejectedValue(new Error('Database error'));

      const requestData = TestDataFactory.createVideoCreateRequest();

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(500);

      expect(response.body).toHaveProperty('correlationId');
      expect(response.body.correlationId).toMatch(/^[a-f0-9-]+$/);
    });
  });

  describe('Performance and scalability', () => {
    it('should respond within acceptable time limits', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest();

      const startTime = Date.now();
      await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(200);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it('should handle memory efficiently', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest();

      const initialMemory = process.memoryUsage().heapUsed;

      // Make multiple requests
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/v1/videocreate')
          .send(requestData)
      );

      await Promise.all(promises);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  afterAll(async () => {
    // Cleanup resources if needed
    await mockDatabaseService.close();
  });
});
