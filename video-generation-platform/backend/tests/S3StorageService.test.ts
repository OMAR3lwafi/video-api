/**
 * Comprehensive tests for S3StorageService
 * Tests all major functionality including uploads, validation, error handling, and circuit breaker
 */

import { S3StorageService } from '../src/services/S3StorageService';
import { S3Config, UploadResult, FileValidationResult, S3ServiceMetrics } from '../src/types/s3';
import { createWriteStream, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/lib-storage');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('fluent-ffmpeg');
jest.mock('ffprobe-static');

const mockS3Client = {
  send: jest.fn()
};

const mockUpload = {
  on: jest.fn(),
  done: jest.fn()
};

// Mock constructors
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const ffmpeg = require('fluent-ffmpeg');

S3Client.mockImplementation(() => mockS3Client);
Upload.mockImplementation(() => mockUpload);

describe('S3StorageService', () => {
  let s3Service: S3StorageService;
  let testConfig: S3Config;
  let testVideoPath: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Test configuration
    testConfig = {
      region: 'us-east-1',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      bucketName: 'test-bucket'
    };

    // Create test video file
    testVideoPath = join(tmpdir(), 'test-video.mp4');
    writeFileSync(testVideoPath, Buffer.alloc(1024 * 1024, 'test')); // 1MB test file

    // Mock ffmpeg ffprobe
    ffmpeg.ffprobe = jest.fn((filePath, callback) => {
      callback(null, {
        format: { duration: 30.5 },
        streams: [
          {
            codec_type: 'video',
            width: 1920,
            height: 1080
          }
        ]
      });
    });

    s3Service = new S3StorageService(testConfig);
  });

  afterEach(() => {
    // Clean up test file
    try {
      unlinkSync(testVideoPath);
    } catch (error) {
      // File may not exist
    }
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(S3Client).toHaveBeenCalledWith({
        region: testConfig.region,
        credentials: {
          accessKeyId: testConfig.accessKeyId,
          secretAccessKey: testConfig.secretAccessKey
        },
        endpoint: undefined,
        forcePathStyle: false
      });
    });

    it('should initialize with custom endpoint', () => {
      const customConfig = {
        ...testConfig,
        endpoint: 'https://minio.example.com',
        forcePathStyle: true
      };

      new S3StorageService(customConfig);

      expect(S3Client).toHaveBeenCalledWith({
        region: customConfig.region,
        credentials: {
          accessKeyId: customConfig.accessKeyId,
          secretAccessKey: customConfig.secretAccessKey
        },
        endpoint: customConfig.endpoint,
        forcePathStyle: true
      });
    });

    it('should initialize metrics', () => {
      const metrics = s3Service.getMetrics();
      
      expect(metrics).toEqual({
        uploadsTotal: 0,
        uploadsSuccessful: 0,
        uploadsFailed: 0,
        bytesUploaded: 0,
        averageUploadTime: 0,
        circuitBreakerState: 'CLOSED'
      });
    });
  });

  describe('File Validation', () => {
    it('should validate supported video file', async () => {
      const result = await s3Service.validateVideoFile(testVideoPath);

      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe('mp4');
      expect(result.mimeType).toBe('video/mp4');
      expect(result.size).toBe(1024 * 1024);
      expect(result.duration).toBe(30.5);
      expect(result.dimensions).toEqual({ width: 1920, height: 1080 });
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unsupported file type', async () => {
      const unsupportedPath = join(tmpdir(), 'test.txt');
      writeFileSync(unsupportedPath, 'test content');

      const result = await s3Service.validateVideoFile(unsupportedPath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported file type: txt');

      unlinkSync(unsupportedPath);
    });

    it('should reject files exceeding size limit', async () => {
      const largePath = join(tmpdir(), 'large-video.mp4');
      writeFileSync(largePath, Buffer.alloc(11 * 1024 * 1024 * 1024, 'test')); // 11GB

      const result = await s3Service.validateVideoFile(largePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size exceeds 10GB limit');

      unlinkSync(largePath);
    });

    it('should reject videos exceeding duration limit', async () => {
      ffmpeg.ffprobe = jest.fn((filePath, callback) => {
        callback(null, {
          format: { duration: 700 }, // 11+ minutes
          streams: [{ codec_type: 'video', width: 1920, height: 1080 }]
        });
      });

      const result = await s3Service.validateVideoFile(testVideoPath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Video duration exceeds 10 minutes limit');
    });

    it('should handle ffmpeg errors gracefully', async () => {
      ffmpeg.ffprobe = jest.fn((filePath, callback) => {
        callback(new Error('FFmpeg error'));
      });

      const result = await s3Service.validateVideoFile(testVideoPath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Failed to extract video metadata');
    });
  });

  describe('URL Generation', () => {
    it('should generate standard AWS S3 public URL', () => {
      const key = 'videos/2024-01-01/test-uuid/video.mp4';
      const url = s3Service.generatePublicUrl(key);

      expect(url).toBe(`https://${testConfig.bucketName}.s3.${testConfig.region}.amazonaws.com/${key}`);
    });

    it('should generate custom endpoint URL', () => {
      const customConfig = {
        ...testConfig,
        endpoint: 'https://minio.example.com'
      };
      
      const customService = new S3StorageService(customConfig);
      const key = 'videos/test.mp4';
      const url = customService.generatePublicUrl(key);

      expect(url).toBe(`https://minio.example.com/${testConfig.bucketName}/${key}`);
    });
  });

  describe('Single Part Upload', () => {
    it('should successfully upload small video file', async () => {
      const mockResult = {
        ETag: '"test-etag"',
        VersionId: 'test-version',
        Location: 'https://test-bucket.s3.amazonaws.com/test-key'
      };

      mockS3Client.send.mockResolvedValueOnce(mockResult);

      const result = await s3Service.uploadVideo(testVideoPath, 'test-key');

      expect(result).toMatchObject({
        key: 'test-key',
        etag: '"test-etag"',
        bucket: testConfig.bucketName,
        size: 1024 * 1024,
        contentType: 'video/mp4'
      });

      expect(result.publicUrl).toContain('test-key');
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });

    it('should track upload progress for single part upload', async () => {
      const mockResult = { ETag: '"test-etag"' };
      mockS3Client.send.mockResolvedValueOnce(mockResult);

      const progressCallback = jest.fn();
      await s3Service.uploadVideo(testVideoPath, 'test-key', undefined, progressCallback);

      // Progress callback should be called (exact calls depend on stream chunks)
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('Multipart Upload', () => {
    beforeEach(() => {
      // Create larger test file for multipart upload (>100MB)
      const largePath = join(tmpdir(), 'large-video.mp4');
      writeFileSync(largePath, Buffer.alloc(150 * 1024 * 1024, 'test')); // 150MB
      testVideoPath = largePath;
    });

    it('should use multipart upload for large files', async () => {
      const mockResult = {
        Location: 'https://test-bucket.s3.amazonaws.com/test-key',
        ETag: '"test-etag"',
        VersionId: 'test-version'
      };

      mockUpload.done.mockResolvedValueOnce(mockResult);
      mockUpload.on.mockReturnThis();

      const result = await s3Service.uploadVideo(testVideoPath, 'test-key');

      expect(Upload).toHaveBeenCalledWith({
        client: mockS3Client,
        params: expect.objectContaining({
          Bucket: testConfig.bucketName,
          Key: 'test-key',
          ContentType: 'video/mp4'
        }),
        partSize: 10 * 1024 * 1024, // 10MB default
        queueSize: 4,
        leavePartsOnError: false
      });

      expect(result.key).toBe('test-key');
      expect(mockUpload.done).toHaveBeenCalled();
    });

    it('should track multipart upload progress', async () => {
      const mockResult = { Location: 'test-location', ETag: '"test-etag"' };
      mockUpload.done.mockResolvedValueOnce(mockResult);

      const progressCallback = jest.fn();
      let progressHandler: Function;

      mockUpload.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'httpUploadProgress') {
          progressHandler = handler;
        }
        return mockUpload;
      });

      const uploadPromise = s3Service.uploadVideo(testVideoPath, 'test-key', undefined, progressCallback);

      // Simulate progress event
      if (progressHandler) {
        progressHandler({
          loaded: 50 * 1024 * 1024,
          total: 150 * 1024 * 1024,
          part: 5,
          uploadId: 'test-upload-id'
        });
      }

      await uploadPromise;

      expect(progressCallback).toHaveBeenCalledWith({
        loaded: 50 * 1024 * 1024,
        total: 150 * 1024 * 1024,
        percentage: 33,
        part: 5,
        uploadId: 'test-upload-id'
      });
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should retry failed operations with exponential backoff', async () => {
      mockS3Client.send
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout error'))
        .mockResolvedValueOnce({ ETag: '"success-etag"' });

      const result = await s3Service.uploadVideo(testVideoPath, 'test-key');

      expect(mockS3Client.send).toHaveBeenCalledTimes(3);
      expect(result.etag).toBe('"success-etag"');
    });

    it('should fail after max retries', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Persistent error'));

      await expect(s3Service.uploadVideo(testVideoPath, 'test-key')).rejects.toThrow('Persistent error');
      expect(mockS3Client.send).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should update metrics on upload failure', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Upload failed'));

      await expect(s3Service.uploadVideo(testVideoPath, 'test-key')).rejects.toThrow();

      const metrics = s3Service.getMetrics();
      expect(metrics.uploadsTotal).toBe(1);
      expect(metrics.uploadsFailed).toBe(1);
      expect(metrics.uploadsSuccessful).toBe(0);
      expect(metrics.lastFailure).toBeInstanceOf(Date);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after failure threshold', async () => {
      // Configure circuit breaker with low threshold for testing
      const testService = new S3StorageService(
        testConfig,
        undefined,
        { failureThreshold: 2, resetTimeout: 1000, monitoringPeriod: 500 }
      );

      mockS3Client.send.mockRejectedValue(new Error('Service unavailable'));

      // Trigger failures to open circuit
      await expect(testService.uploadVideo(testVideoPath, 'test1')).rejects.toThrow();
      await expect(testService.uploadVideo(testVideoPath, 'test2')).rejects.toThrow();

      const metrics = testService.getMetrics();
      expect(metrics.circuitBreakerState).toBe('OPEN');

      // Next call should fail immediately without calling S3
      mockS3Client.send.mockClear();
      await expect(testService.uploadVideo(testVideoPath, 'test3')).rejects.toThrow('Circuit breaker is OPEN');
      expect(mockS3Client.send).not.toHaveBeenCalled();
    });
  });

  describe('File Operations', () => {
    it('should get file metadata', async () => {
      const mockMetadata = {
        ContentLength: 1024 * 1024,
        ContentType: 'video/mp4',
        LastModified: new Date(),
        ETag: '"test-etag"',
        VersionId: 'test-version',
        Metadata: { custom: 'value' }
      };

      mockS3Client.send.mockResolvedValueOnce(mockMetadata);

      const metadata = await s3Service.getFileMetadata('test-key');

      expect(metadata).toEqual({
        size: 1024 * 1024,
        contentType: 'video/mp4',
        lastModified: mockMetadata.LastModified,
        etag: '"test-etag"',
        versionId: 'test-version',
        metadata: { custom: 'value' }
      });
    });

    it('should delete file successfully', async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const result = await s3Service.deleteFile('test-key');

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: testConfig.bucketName,
            Key: 'test-key'
          }
        })
      );
    });

    it('should handle delete errors gracefully', async () => {
      mockS3Client.send.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await s3Service.deleteFile('test-key');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup old files', async () => {
      const oldDate = new Date('2023-01-01');
      const recentDate = new Date();

      mockS3Client.send
        .mockResolvedValueOnce({
          Contents: [
            { Key: 'old-file-1.mp4', LastModified: oldDate },
            { Key: 'old-file-2.mp4', LastModified: oldDate },
            { Key: 'recent-file.mp4', LastModified: recentDate }
          ]
        })
        .mockResolvedValueOnce({}) // Delete old-file-1
        .mockResolvedValueOnce({}); // Delete old-file-2

      const result = await s3Service.cleanupOldFiles(30, 'videos/');

      expect(result.success).toBe(true);
      expect(result.data).toBe(2); // Should delete 2 old files
      expect(mockS3Client.send).toHaveBeenCalledTimes(3); // List + 2 deletes
    });
  });

  describe('Lifecycle Policies', () => {
    it('should setup lifecycle policies', async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const rules = [
        {
          id: 'delete-old-videos',
          status: 'Enabled' as const,
          filter: { prefix: 'videos/' },
          expiration: { days: 90 }
        }
      ];

      const result = await s3Service.setupLifecyclePolicies(rules);

      expect(result.success).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: testConfig.bucketName,
            LifecycleConfiguration: {
              Rules: expect.arrayContaining([
                expect.objectContaining({
                  ID: 'delete-old-videos',
                  Status: 'Enabled'
                })
              ])
            }
          }
        })
      );
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should update metrics on successful upload', async () => {
      mockS3Client.send.mockResolvedValueOnce({ ETag: '"test-etag"' });

      await s3Service.uploadVideo(testVideoPath, 'test-key');

      const metrics = s3Service.getMetrics();
      expect(metrics.uploadsTotal).toBe(1);
      expect(metrics.uploadsSuccessful).toBe(1);
      expect(metrics.uploadsFailed).toBe(0);
      expect(metrics.bytesUploaded).toBe(1024 * 1024);
      expect(metrics.averageUploadTime).toBeGreaterThan(0);
    });

    it('should calculate average upload time correctly', async () => {
      mockS3Client.send.mockResolvedValue({ ETag: '"test-etag"' });

      // Perform multiple uploads
      await s3Service.uploadVideo(testVideoPath, 'test1');
      await s3Service.uploadVideo(testVideoPath, 'test2');
      await s3Service.uploadVideo(testVideoPath, 'test3');

      const metrics = s3Service.getMetrics();
      expect(metrics.uploadsSuccessful).toBe(3);
      expect(metrics.averageUploadTime).toBeGreaterThan(0);
    });
  });

  describe('Key Generation', () => {
    it('should generate unique keys with consistent format', async () => {
      mockS3Client.send.mockResolvedValue({ ETag: '"test-etag"' });

      const result1 = await s3Service.uploadVideo(testVideoPath);
      const result2 = await s3Service.uploadVideo(testVideoPath);

      expect(result1.key).toMatch(/^videos\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}\/test-video\.mp4$/);
      expect(result2.key).toMatch(/^videos\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}\/test-video\.mp4$/);
      expect(result1.key).not.toBe(result2.key); // Should be unique
    });

    it('should sanitize filename in generated key', async () => {
      const specialCharsPath = join(tmpdir(), 'test@#$%^&*()video!.mp4');
      writeFileSync(specialCharsPath, Buffer.alloc(1024, 'test'));

      mockS3Client.send.mockResolvedValue({ ETag: '"test-etag"' });

      const result = await s3Service.uploadVideo(specialCharsPath);

      expect(result.key).toMatch(/test-------video-\.mp4$/);

      unlinkSync(specialCharsPath);
    });
  });
});
