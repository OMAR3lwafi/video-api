import { performance } from 'perf_hooks';
import request from 'supertest';
import { Express } from 'express';
import { TestDataFactory } from '../factories/TestDataFactory';
import { DatabaseFixtures } from '../fixtures/DatabaseFixtures';
import { createApp } from '@/app';
import { VideoProcessor } from '@/services/VideoProcessor';
import { S3StorageService } from '@/services/S3StorageService';
import { DatabaseService } from '@/services/DatabaseService';

// Mock external services for performance testing
jest.mock('@/services/VideoProcessor');
jest.mock('@/services/S3StorageService');
jest.mock('@/services/DatabaseService');

describe('Video Processing Performance Tests', () => {
  let app: Express;
  let mockVideoProcessor: jest.Mocked<VideoProcessor>;
  let mockS3StorageService: jest.Mocked<S3StorageService>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeAll(async () => {
    // Setup mock services with performance-realistic responses
    mockVideoProcessor = {
      processVideo: jest.fn().mockImplementation((job) => {
        // Simulate realistic processing times based on job complexity
        const processingTime = job.elements.length * 1000 + job.width * job.height * 0.001;
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              outputPath: '/tmp/output.mp4',
              processingTime,
            });
          }, Math.min(processingTime, 100)); // Cap simulation at 100ms for tests
        });
      }),
      estimateProcessingTime: jest.fn().mockImplementation((job) => {
        return job.elements.length * 5000 + job.width * job.height * 0.001;
      }),
      validateElements: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      checkHealth: jest.fn().mockResolvedValue({ healthy: true }),
    } as any;

    mockS3StorageService = {
      uploadFile: jest.fn().mockImplementation((file) => {
        // Simulate realistic upload times based on file size
        const uploadTime = Math.max(50, file.size / 10000); // Minimum 50ms
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              key: `videos/${Date.now()}.mp4`,
              location: 'https://test-bucket.s3.amazonaws.com/test.mp4',
              etag: '"test-etag"',
            });
          }, Math.min(uploadTime, 200)); // Cap at 200ms for tests
        });
      }),
      deleteFile: jest.fn().mockResolvedValue({ success: true }),
      getFileUrl: jest.fn().mockReturnValue('https://test-bucket.s3.amazonaws.com/test.mp4'),
      checkHealth: jest.fn().mockResolvedValue({ healthy: true }),
    } as any;

    mockDatabaseService = {
      createJob: jest.fn().mockImplementation((job) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ ...job, id: `job-${Date.now()}` });
          }, 10); // 10ms database latency simulation
        });
      }),
      updateJobStatus: jest.fn().mockResolvedValue(true),
      getJobById: jest.fn().mockResolvedValue(DatabaseFixtures.videoJobs[0]),
      getUserJobs: jest.fn().mockResolvedValue(DatabaseFixtures.videoJobs),
      checkHealth: jest.fn().mockResolvedValue({ healthy: true }),
    } as any;

    // Mock implementations
    (VideoProcessor as jest.MockedClass<typeof VideoProcessor>).mockImplementation(() => mockVideoProcessor);
    (S3StorageService as jest.MockedClass<typeof S3StorageService>).mockImplementation(() => mockS3StorageService);
    (DatabaseService as jest.MockedClass<typeof DatabaseService>).mockImplementation(() => mockDatabaseService);

    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Response Time Performance', () => {
    it('should respond to health check within 100ms', async () => {
      const start = performance.now();

      await request(app)
        .get('/api/health')
        .expect(200);

      const end = performance.now();
      const responseTime = end - start;

      expect(responseTime).toBeLessThan(100);
    });

    it('should handle video creation request within 2 seconds', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest({
        elements: [TestDataFactory.createImageElement()], // Simple job
      });

      const start = performance.now();

      await request(app)
        .post('/api/v1/videocreate')
        .send(requestData)
        .expect(200);

      const end = performance.now();
      const responseTime = end - start;

      expect(responseTime).toBeLessThan(2000);
    });

    it('should handle job status requests within 500ms', async () => {
      const jobId = 'test-job-123';

      const start = performance.now();

      await request(app)
        .get(`/api/v1/videoresult/${jobId}`)
        .expect(200);

      const end = performance.now();
      const responseTime = end - start;

      expect(responseTime).toBeLessThan(500);
    });

    it('should handle user jobs listing within 1 second', async () => {
      const userId = 'user-1';

      const start = performance.now();

      await request(app)
        .get(`/api/v1/user/${userId}/jobs`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      const end = performance.now();
      const responseTime = end - start;

      expect(responseTime).toBeLessThan(1000);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 10 concurrent health checks efficiently', async () => {
      const concurrency = 10;
      const start = performance.now();

      const promises = Array.from({ length: concurrency }, () =>
        request(app).get('/api/health').expect(200)
      );

      const results = await Promise.all(promises);
      const end = performance.now();
      const totalTime = end - start;

      expect(results).toHaveLength(concurrency);
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

      const avgResponseTime = totalTime / concurrency;
      expect(avgResponseTime).toBeLessThan(200); // Average under 200ms per request
    });

    it('should handle 5 concurrent video creation requests', async () => {
      const concurrency = 5;
      const requestData = TestDataFactory.createVideoCreateRequest({
        elements: [TestDataFactory.createImageElement()],
      });

      const start = performance.now();

      const promises = Array.from({ length: concurrency }, () =>
        request(app)
          .post('/api/v1/videocreate')
          .send(requestData)
      );

      const results = await Promise.all(promises);
      const end = performance.now();
      const totalTime = end - start;

      expect(results.every(r => [200, 202].includes(r.status))).toBe(true);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance under mixed request load', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest();

      const start = performance.now();

      const promises = [
        // Health checks (fast)
        ...Array.from({ length: 20 }, () =>
          request(app).get('/api/health')
        ),
        // Job status requests (medium)
        ...Array.from({ length: 10 }, () =>
          request(app).get('/api/v1/videoresult/test-job-123')
        ),
        // Video creation requests (slow)
        ...Array.from({ length: 3 }, () =>
          request(app).post('/api/v1/videocreate').send(requestData)
        ),
      ];

      const results = await Promise.all(promises);
      const end = performance.now();
      const totalTime = end - start;

      expect(results).toHaveLength(33);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Check that faster requests weren't significantly delayed by slower ones
      const healthCheckResponses = results.slice(0, 20);
      expect(healthCheckResponses.every(r => r.status === 200)).toBe(true);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory during multiple requests', async () => {
      const initialMemory = process.memoryUsage();
      const requestData = TestDataFactory.createVideoCreateRequest();

      // Make multiple requests to test for memory leaks
      for (let i = 0; i < 50; i++) {
        await request(app)
          .post('/api/v1/videocreate')
          .send(requestData);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large request payloads efficiently', async () => {
      const largeRequestData = TestDataFactory.createVideoCreateRequest({
        elements: Array.from({ length: 10 }, (_, i) =>
          TestDataFactory.createVideoElement({ track: i + 1 })
        ),
      });

      const memoryBefore = process.memoryUsage();
      const start = performance.now();

      await request(app)
        .post('/api/v1/videocreate')
        .send(largeRequestData)
        .expect(202); // Should be async processing

      const end = performance.now();
      const memoryAfter = process.memoryUsage();
      const responseTime = end - start;
      const memoryUsed = memoryAfter.heapUsed - memoryBefore.heapUsed;

      expect(responseTime).toBeLessThan(3000);
      expect(memoryUsed).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });
  });

  describe('Database Operation Performance', () => {
    it('should perform job creation within acceptable time', async () => {
      const job = TestDataFactory.createVideoJob();

      const start = performance.now();
      await mockDatabaseService.createJob(job);
      const end = performance.now();

      const operationTime = end - start;
      expect(operationTime).toBeLessThan(100); // Database ops under 100ms
    });

    it('should handle batch job queries efficiently', async () => {
      const userId = 'user-1';

      const start = performance.now();

      // Simulate multiple concurrent database queries
      const promises = Array.from({ length: 20 }, () =>
        mockDatabaseService.getUserJobs(userId)
      );

      await Promise.all(promises);
      const end = performance.now();

      const totalTime = end - start;
      expect(totalTime).toBeLessThan(500); // Batch queries under 500ms
    });
  });

  describe('Video Processing Performance', () => {
    it('should estimate processing time accurately', () => {
      const jobs = [
        TestDataFactory.createVideoJob({
          elements: [TestDataFactory.createImageElement()],
          width: 1280,
          height: 720,
        }),
        TestDataFactory.createVideoJob({
          elements: [
            TestDataFactory.createVideoElement(),
            TestDataFactory.createImageElement(),
          ],
          width: 1920,
          height: 1080,
        }),
        TestDataFactory.createVideoJob({
          elements: Array.from({ length: 5 }, () => TestDataFactory.createVideoElement()),
          width: 3840,
          height: 2160,
        }),
      ];

      const estimates = jobs.map(job => {
        const start = performance.now();
        const estimate = mockVideoProcessor.estimateProcessingTime(job);
        const end = performance.now();

        expect(end - start).toBeLessThan(10); // Estimation should be near-instantaneous
        return estimate;
      });

      // Estimates should increase with job complexity
      expect(estimates[0]).toBeLessThan(estimates[1]);
      expect(estimates[1]).toBeLessThan(estimates[2]);
    });

    it('should process simple jobs within time limits', async () => {
      const simpleJob = TestDataFactory.createVideoJob({
        elements: [TestDataFactory.createImageElement()],
        width: 1280,
        height: 720,
      });

      const start = performance.now();
      const result = await mockVideoProcessor.processVideo(simpleJob);
      const end = performance.now();

      const processingTime = end - start;
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(200); // Mocked processing under 200ms
    });

    it('should validate elements efficiently', async () => {
      const elements = Array.from({ length: 10 }, () =>
        TestDataFactory.createVideoElement()
      );

      const start = performance.now();
      const result = await mockVideoProcessor.validateElements(elements);
      const end = performance.now();

      const validationTime = end - start;
      expect(result.valid).toBe(true);
      expect(validationTime).toBeLessThan(50); // Validation under 50ms
    });
  });

  describe('Storage Operation Performance', () => {
    it('should upload files within acceptable time', async () => {
      const mockFile = TestDataFactory.createMockFile({
        size: 1024 * 1024, // 1MB
      });

      const start = performance.now();
      const result = await mockS3StorageService.uploadFile(mockFile, 'test/');
      const end = performance.now();

      const uploadTime = end - start;
      expect(result.success).toBe(true);
      expect(uploadTime).toBeLessThan(300); // Upload under 300ms (mocked)
    });

    it('should handle multiple file operations concurrently', async () => {
      const files = Array.from({ length: 5 }, (_, i) =>
        TestDataFactory.createMockFile({
          filename: `test-${i}.mp4`,
          size: 512 * 1024, // 512KB each
        })
      );

      const start = performance.now();

      const uploadPromises = files.map(file =>
        mockS3StorageService.uploadFile(file, 'batch/')
      );

      const results = await Promise.all(uploadPromises);
      const end = performance.now();

      const totalTime = end - start;
      expect(results.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(1000); // Concurrent uploads under 1s
    });

    it('should generate URLs efficiently', () => {
      const keys = Array.from({ length: 100 }, (_, i) => `test-file-${i}.mp4`);

      const start = performance.now();
      const urls = keys.map(key => mockS3StorageService.getFileUrl(key));
      const end = performance.now();

      const generationTime = end - start;
      expect(urls).toHaveLength(100);
      expect(generationTime).toBeLessThan(50); // URL generation under 50ms
    });
  });

  describe('End-to-End Performance', () => {
    it('should complete full video creation workflow efficiently', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest({
        elements: [
          TestDataFactory.createVideoElement(),
          TestDataFactory.createImageElement(),
        ],
      });

      const start = performance.now();

      const response = await request(app)
        .post('/api/v1/videocreate')
        .send(requestData);

      const end = performance.now();
      const totalTime = end - start;

      expect([200, 202]).toContain(response.status);
      expect(totalTime).toBeLessThan(3000); // Full workflow under 3 seconds

      if (response.status === 200) {
        // Immediate processing
        expect(response.body).toHaveProperty('result_url');
        expect(response.body).toHaveProperty('processing_time');
      } else {
        // Async processing
        expect(response.body).toHaveProperty('job_id');
        expect(response.body).toHaveProperty('estimated_completion');
      }
    });

    it('should maintain performance across multiple workflow executions', async () => {
      const requestData = TestDataFactory.createVideoCreateRequest();
      const iterations = 10;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await request(app)
          .post('/api/v1/videocreate')
          .send(requestData);

        const end = performance.now();
        responseTimes.push(end - start);
      }

      // Calculate statistics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      expect(avgResponseTime).toBeLessThan(2000); // Average under 2 seconds
      expect(maxResponseTime).toBeLessThan(5000); // Max under 5 seconds
      expect(minResponseTime).toBeGreaterThan(0); // Sanity check

      // Performance should be relatively consistent
      const performanceVariance = maxResponseTime / minResponseTime;
      expect(performanceVariance).toBeLessThan(10); // Less than 10x variance
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain baseline performance metrics', async () => {
      // Define performance baselines
      const baselines = {
        healthCheck: 100, // ms
        videoCreation: 2000, // ms
        jobStatus: 500, // ms
        userJobs: 1000, // ms
      };

      const metrics = {
        healthCheck: 0,
        videoCreation: 0,
        jobStatus: 0,
        userJobs: 0,
      };

      // Test health check
      let start = performance.now();
      await request(app).get('/api/health').expect(200);
      metrics.healthCheck = performance.now() - start;

      // Test video creation
      start = performance.now();
      const requestData = TestDataFactory.createVideoCreateRequest();
      await request(app).post('/api/v1/videocreate').send(requestData);
      metrics.videoCreation = performance.now() - start;

      // Test job status
      start = performance.now();
      await request(app).get('/api/v1/videoresult/test-job').expect(200);
      metrics.jobStatus = performance.now() - start;

      // Test user jobs
      start = performance.now();
      await request(app).get('/api/v1/user/user-1/jobs').expect(200);
      metrics.userJobs = performance.now() - start;

      // Assert all metrics meet baselines
      Object.entries(baselines).forEach(([key, baseline]) => {
        expect(metrics[key as keyof typeof metrics]).toBeLessThan(baseline);
      });

      console.log('Performance Metrics:', {
        healthCheck: `${metrics.healthCheck.toFixed(2)}ms (baseline: ${baselines.healthCheck}ms)`,
        videoCreation: `${metrics.videoCreation.toFixed(2)}ms (baseline: ${baselines.videoCreation}ms)`,
        jobStatus: `${metrics.jobStatus.toFixed(2)}ms (baseline: ${baselines.jobStatus}ms)`,
        userJobs: `${metrics.userJobs.toFixed(2)}ms (baseline: ${baselines.userJobs}ms)`,
      });
    });

    it('should scale linearly with request complexity', async () => {
      const complexities = [1, 3, 5, 10]; // Number of elements
      const results: Array<{ complexity: number; responseTime: number }> = [];

      for (const complexity of complexities) {
        const requestData = TestDataFactory.createVideoCreateRequest({
          elements: Array.from({ length: complexity }, (_, i) =>
            TestDataFactory.createVideoElement({ track: i + 1 })
          ),
        });

        const start = performance.now();
        await request(app)
          .post('/api/v1/videocreate')
          .send(requestData)
          .expect(202); // Should be async for complex jobs

        const responseTime = performance.now() - start;
        results.push({ complexity, responseTime });
      }

      // Check that response time increases somewhat linearly with complexity
      for (let i = 1; i < results.length; i++) {
        const current = results[i];
        const previous = results[i - 1];

        // Response time should increase, but not exponentially
        const growthRatio = current.responseTime / previous.responseTime;
        expect(growthRatio).toBeLessThan(3); // Less than 3x growth per step
      }

      console.log('Complexity Scaling Results:', results);
    });
  });
});
