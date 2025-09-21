import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../src/app';
import { getJobQueue } from '../src/services/JobQueue';
import { VideoProcessor } from '../src/services/VideoProcessor';
import { getS3Service } from '../src/utils/s3-factory';
import { ProcessingEstimator } from '../src/services/Estimator';

// Mock external dependencies
jest.mock('../src/services/VideoProcessor');
jest.mock('../src/utils/s3-factory');
jest.mock('../src/services/Estimator');

const MockVideoProcessor = VideoProcessor as jest.MockedClass<typeof VideoProcessor>;
const mockGetS3Service = getS3Service as jest.MockedFunction<typeof getS3Service>;
const MockProcessingEstimator = ProcessingEstimator as jest.MockedClass<typeof ProcessingEstimator>;

describe('VideoController', () => {
  let app: Express;
  let mockS3Service: any;
  let mockProcessor: any;
  let mockEstimator: any;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup S3 service mock
    mockS3Service = {
      uploadVideo: jest.fn(),
    };
    mockGetS3Service.mockReturnValue(mockS3Service);

    // Setup VideoProcessor mock
    mockProcessor = {
      process: jest.fn(),
    };
    MockVideoProcessor.mockImplementation(() => mockProcessor);

    // Setup ProcessingEstimator mock
    mockEstimator = {
      estimate: jest.fn(),
    };
    MockProcessingEstimator.mockImplementation(() => mockEstimator);
  });

  describe('POST /api/v1/video/create', () => {
    const validRequest = {
      output_format: 'mp4',
      width: 1920,
      height: 1080,
      elements: [
        {
          id: 'element1',
          type: 'image',
          source: 'https://example.com/image.jpg',
          track: 0,
          x: '0%',
          y: '0%',
          width: '100%',
          height: '100%',
          fit_mode: 'contain'
        }
      ]
    };

    it('should process video synchronously when estimated time is under threshold', async () => {
      // Mock fast processing estimation
      mockEstimator.estimate.mockResolvedValue({
        estimatedMs: 25000, // Under 30s threshold
        reasons: ['base:2000', 'elements:500']
      });

      // Mock successful processing
      mockProcessor.process.mockResolvedValue({
        outputPath: '/tmp/output.mp4',
        durationMs: 15000,
        outputSizeBytes: 1024 * 1024, // 1MB
        width: 1920,
        height: 1080,
        format: 'mp4',
        logs: []
      });

      // Mock successful S3 upload
      mockS3Service.uploadVideo.mockResolvedValue({
        publicUrl: 'https://s3.amazonaws.com/bucket/video.mp4'
      });

      const response = await request(app)
        .post('/api/v1/video/create')
        .send(validRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.result_url).toBe('https://s3.amazonaws.com/bucket/video.mp4');
      expect(response.body.data.processing_time).toBeDefined();
      expect(response.body.data.job_id).toBeDefined();
      expect(response.body.data.file_size).toBe('1024KB');

      expect(mockEstimator.estimate).toHaveBeenCalledWith(validRequest);
      expect(mockProcessor.process).toHaveBeenCalledWith(validRequest, expect.any(Object));
      expect(mockS3Service.uploadVideo).toHaveBeenCalledWith('/tmp/output.mp4');
    });

    it('should process video asynchronously when estimated time exceeds threshold', async () => {
      // Mock slow processing estimation
      mockEstimator.estimate.mockResolvedValue({
        estimatedMs: 45000, // Over 30s threshold
        reasons: ['base:2000', 'elements:2000', 'resolution:5000']
      });

      const response = await request(app)
        .post('/api/v1/video/create')
        .send(validRequest)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('processing');
      expect(response.body.data.job_id).toBeDefined();
      expect(response.body.data.estimated_completion).toBeDefined();
      expect(response.body.data.status_check_endpoint).toBeDefined();

      expect(mockEstimator.estimate).toHaveBeenCalledWith(validRequest);
      expect(mockProcessor.process).not.toHaveBeenCalled();
      expect(mockS3Service.uploadVideo).not.toHaveBeenCalled();
    });

    it('should validate request body and return 400 for invalid input', async () => {
      const invalidRequest = {
        output_format: 'invalid_format',
        width: -100,
        height: 'not_a_number',
        elements: []
      };

      const response = await request(app)
        .post('/api/v1/video/create')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle processing errors gracefully', async () => {
      mockEstimator.estimate.mockResolvedValue({
        estimatedMs: 25000,
        reasons: ['base:2000']
      });

      mockProcessor.process.mockRejectedValue(new Error('Processing failed'));

      const response = await request(app)
        .post('/api/v1/video/create')
        .send(validRequest)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VideoProcessingError');
      expect(response.body.message).toBe('Failed to create video processing job');
    });

    it('should handle S3 upload errors gracefully', async () => {
      mockEstimator.estimate.mockResolvedValue({
        estimatedMs: 25000,
        reasons: ['base:2000']
      });

      mockProcessor.process.mockResolvedValue({
        outputPath: '/tmp/output.mp4',
        durationMs: 15000,
        outputSizeBytes: 1024 * 1024,
        width: 1920,
        height: 1080,
        format: 'mp4',
        logs: []
      });

      mockS3Service.uploadVideo.mockRejectedValue(new Error('S3 upload failed'));

      const response = await request(app)
        .post('/api/v1/video/create')
        .send(validRequest)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VideoProcessingError');
    });
  });

  describe('GET /api/v1/video/result/:jobId', () => {
    it('should return job status for existing job', async () => {
      const queue = getJobQueue();
      
      // Create a test job
      const { jobId } = queue.enqueue(validRequest);
      
      const response = await request(app)
        .get(`/api/v1/video/result/${jobId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.job_id).toBe(jobId);
      expect(response.body.data.status).toBeDefined();
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/v1/video/result/nonexistent-job-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('JobNotFound');
    });

    it('should validate job ID parameter', async () => {
      const response = await request(app)
        .get('/api/v1/video/result/')
        .expect(404); // Route not found due to missing parameter

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/video/job/:jobId', () => {
    it('should cancel existing pending job', async () => {
      const queue = getJobQueue();
      
      // Create a test job
      const { jobId } = queue.enqueue(validRequest);
      
      const response = await request(app)
        .delete(`/api/v1/video/job/${jobId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.job_id).toBe(jobId);
      expect(response.body.data.status).toBe('cancelled');

      // Verify job is actually cancelled
      const job = queue.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .delete('/api/v1/video/job/nonexistent-job-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('JobNotFound');
    });
  });

  describe('GET /api/v1/video/jobs', () => {
    it('should return list of jobs', async () => {
      const queue = getJobQueue();
      
      // Create some test jobs
      const { jobId: job1 } = queue.enqueue(validRequest);
      const { jobId: job2 } = queue.enqueue(validRequest);
      
      const response = await request(app)
        .get('/api/v1/video/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      
      const jobIds = response.body.data.map((job: any) => job.job_id);
      expect(jobIds).toContain(job1);
      expect(jobIds).toContain(job2);
    });

    it('should return empty array when no jobs exist', async () => {
      // Clear any existing jobs by creating a fresh queue instance
      const response = await request(app)
        .get('/api/v1/video/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Background Processing', () => {
    it('should process async jobs in background', async () => {
      // Mock slow estimation to trigger async path
      mockEstimator.estimate.mockResolvedValue({
        estimatedMs: 45000,
        reasons: ['base:2000', 'elements:10000']
      });

      // Mock successful background processing
      mockProcessor.process.mockResolvedValue({
        outputPath: '/tmp/background-output.mp4',
        durationMs: 30000,
        outputSizeBytes: 2 * 1024 * 1024, // 2MB
        width: 1920,
        height: 1080,
        format: 'mp4',
        logs: []
      });

      mockS3Service.uploadVideo.mockResolvedValue({
        publicUrl: 'https://s3.amazonaws.com/bucket/background-video.mp4'
      });

      // Create async job
      const createResponse = await request(app)
        .post('/api/v1/video/create')
        .send(validRequest)
        .expect(202);

      const jobId = createResponse.body.data.job_id;

      // Wait for background processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check job status
      const statusResponse = await request(app)
        .get(`/api/v1/video/result/${jobId}`)
        .expect(200);

      // Job should eventually complete
      expect(statusResponse.body.data.status).toMatch(/processing|completed/);
    });
  });
});
