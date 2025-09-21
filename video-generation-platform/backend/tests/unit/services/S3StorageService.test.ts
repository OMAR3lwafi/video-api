import { S3StorageService } from '@/services/S3StorageService';
import { TestDataFactory } from '../../factories/TestDataFactory';
import { DatabaseFixtures } from '../../fixtures/DatabaseFixtures';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/lib-storage');
jest.mock('@aws-sdk/s3-request-presigner');

describe('S3StorageService', () => {
  let s3StorageService: S3StorageService;
  let mockS3Client: jest.Mocked<S3Client>;
  let mockUpload: jest.Mocked<Upload>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock S3 Client
    mockS3Client = {
      send: jest.fn().mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
        ETag: '"test-etag-12345"',
        Location: 'https://test-bucket.s3.amazonaws.com/test-file.mp4',
        Key: 'test-file.mp4',
      }),
      config: {
        region: 'us-east-1',
      },
    } as any;

    (S3Client as jest.MockedClass<typeof S3Client>).mockImplementation(() => mockS3Client);

    // Mock Upload
    mockUpload = {
      done: jest.fn().mockResolvedValue({
        Location: 'https://test-bucket.s3.amazonaws.com/test-file.mp4',
        Key: 'test-file.mp4',
        Bucket: 'test-bucket',
        ETag: '"test-etag-12345"',
      }),
      abort: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockReturnThis(),
    } as any;

    (Upload as jest.MockedClass<typeof Upload>).mockImplementation(() => mockUpload);

    // Mock getSignedUrl
    (getSignedUrl as jest.MockedFunction<typeof getSignedUrl>).mockResolvedValue(
      'https://test-bucket.s3.amazonaws.com/test-file.mp4?presigned=true'
    );

    s3StorageService = new S3StorageService();
  });

  describe('uploadFile', () => {
    it('should successfully upload a file to S3', async () => {
      const mockFile = TestDataFactory.createMockFile({
        filename: 'test-video.mp4',
        mimetype: 'video/mp4',
        size: 1024 * 1024, // 1MB
      });

      const result = await s3StorageService.uploadFile(mockFile, 'videos/');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('key', expect.stringContaining('videos/'));
      expect(result).toHaveProperty('location', expect.stringContaining('test-bucket.s3.amazonaws.com'));
      expect(result).toHaveProperty('etag');
      expect(Upload).toHaveBeenCalledWith({
        client: mockS3Client,
        params: expect.objectContaining({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: expect.any(String),
          Body: mockFile.buffer,
          ContentType: mockFile.mimetype,
        }),
      });
    });

    it('should generate unique file keys', async () => {
      const mockFile = TestDataFactory.createMockFile({
        filename: 'test.mp4',
      });

      const result1 = await s3StorageService.uploadFile(mockFile, 'videos/');
      const result2 = await s3StorageService.uploadFile(mockFile, 'videos/');

      expect(result1.key).not.toBe(result2.key);
      expect(result1.key).toMatch(/^videos\/\d{4}\/\d{2}\/\d{2}\/[a-f0-9-]+_test\.mp4$/);
      expect(result2.key).toMatch(/^videos\/\d{4}\/\d{2}\/\d{2}\/[a-f0-9-]+_test\.mp4$/);
    });

    it('should handle different file types', async () => {
      const testFiles = [
        { filename: 'test.mp4', mimetype: 'video/mp4' },
        { filename: 'test.mov', mimetype: 'video/quicktime' },
        { filename: 'test.avi', mimetype: 'video/x-msvideo' },
        { filename: 'test.jpg', mimetype: 'image/jpeg' },
        { filename: 'test.png', mimetype: 'image/png' },
      ];

      for (const fileData of testFiles) {
        const mockFile = TestDataFactory.createMockFile(fileData);
        const result = await s3StorageService.uploadFile(mockFile, 'media/');

        expect(result.success).toBe(true);
        expect(result.key).toContain('media/');
        expect(Upload).toHaveBeenCalledWith({
          client: mockS3Client,
          params: expect.objectContaining({
            ContentType: fileData.mimetype,
          }),
        });
      }
    });

    it('should apply metadata to uploaded files', async () => {
      const mockFile = TestDataFactory.createMockFile();
      const metadata = {
        userId: 'user-123',
        jobId: 'job-456',
        originalName: 'original-video.mp4',
      };

      await s3StorageService.uploadFile(mockFile, 'videos/', { metadata });

      expect(Upload).toHaveBeenCalledWith({
        client: mockS3Client,
        params: expect.objectContaining({
          Metadata: metadata,
        }),
      });
    });

    it('should handle upload progress tracking', async () => {
      const mockFile = TestDataFactory.createMockFile({ size: 10 * 1024 * 1024 }); // 10MB
      const progressCallback = jest.fn();

      mockUpload.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'httpUploadProgress') {
          setTimeout(() => {
            callback({ loaded: 2 * 1024 * 1024, total: 10 * 1024 * 1024 });
            callback({ loaded: 5 * 1024 * 1024, total: 10 * 1024 * 1024 });
            callback({ loaded: 10 * 1024 * 1024, total: 10 * 1024 * 1024 });
          }, 50);
        }
        return mockUpload;
      });

      await s3StorageService.uploadFile(mockFile, 'videos/', { onProgress: progressCallback });

      expect(mockUpload.on).toHaveBeenCalledWith('httpUploadProgress', expect.any(Function));
      expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({
        percent: expect.any(Number),
        loaded: expect.any(Number),
        total: expect.any(Number),
      }));
    });

    it('should handle upload failures', async () => {
      const uploadError = new Error('Network error occurred');
      mockUpload.done = jest.fn().mockRejectedValue(uploadError);

      const mockFile = TestDataFactory.createMockFile();

      const result = await s3StorageService.uploadFile(mockFile, 'videos/');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error occurred');
    });

    it('should validate file size limits', async () => {
      const largeFile = TestDataFactory.createMockFile({
        size: 1024 * 1024 * 1024, // 1GB - exceeds limit
      });

      const result = await s3StorageService.uploadFile(largeFile, 'videos/');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File size exceeds limit');
    });

    it('should validate file types', async () => {
      const invalidFile = TestDataFactory.createMockFile({
        filename: 'test.exe',
        mimetype: 'application/x-msdownload',
      });

      const result = await s3StorageService.uploadFile(invalidFile, 'videos/');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should handle S3 service errors', async () => {
      const s3Error = {
        name: 'NoSuchBucket',
        message: 'The specified bucket does not exist',
        $metadata: { httpStatusCode: 404 },
      };
      mockUpload.done = jest.fn().mockRejectedValue(s3Error);

      const mockFile = TestDataFactory.createMockFile();

      const result = await s3StorageService.uploadFile(mockFile, 'videos/');

      expect(result.success).toBe(false);
      expect(result.error).toContain('The specified bucket does not exist');
    });
  });

  describe('deleteFile', () => {
    it('should successfully delete a file from S3', async () => {
      const fileKey = 'videos/2024/01/01/test-video.mp4';

      const result = await s3StorageService.deleteFile(fileKey);

      expect(result.success).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(DeleteObjectCommand)
      );
    });

    it('should handle deletion of non-existent files', async () => {
      const s3Error = {
        name: 'NoSuchKey',
        message: 'The specified key does not exist',
        $metadata: { httpStatusCode: 404 },
      };
      mockS3Client.send = jest.fn().mockRejectedValue(s3Error);

      const fileKey = 'videos/2024/01/01/nonexistent.mp4';

      const result = await s3StorageService.deleteFile(fileKey);

      expect(result.success).toBe(true); // Should succeed even if file doesn't exist
    });

    it('should handle S3 deletion errors', async () => {
      const s3Error = {
        name: 'AccessDenied',
        message: 'Access denied for delete operation',
        $metadata: { httpStatusCode: 403 },
      };
      mockS3Client.send = jest.fn().mockRejectedValue(s3Error);

      const fileKey = 'videos/2024/01/01/protected-video.mp4';

      const result = await s3StorageService.deleteFile(fileKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  describe('getFileUrl', () => {
    it('should generate public URLs for files', () => {
      const fileKey = 'videos/2024/01/01/test-video.mp4';

      const url = s3StorageService.getFileUrl(fileKey);

      expect(url).toBe(`https://test-bucket.s3.amazonaws.com/${fileKey}`);
    });

    it('should handle file keys with special characters', () => {
      const fileKey = 'videos/2024/01/01/test video (1).mp4';
      const expectedKey = 'videos/2024/01/01/test%20video%20(1).mp4';

      const url = s3StorageService.getFileUrl(fileKey);

      expect(url).toBe(`https://test-bucket.s3.amazonaws.com/${expectedKey}`);
    });

    it('should generate CDN URLs when configured', () => {
      process.env.CLOUDFRONT_DOMAIN = 'cdn.example.com';
      s3StorageService = new S3StorageService();

      const fileKey = 'videos/2024/01/01/test-video.mp4';

      const url = s3StorageService.getFileUrl(fileKey);

      expect(url).toBe(`https://cdn.example.com/${fileKey}`);

      delete process.env.CLOUDFRONT_DOMAIN;
    });
  });

  describe('generatePresignedUrl', () => {
    it('should generate presigned URLs for secure access', async () => {
      const fileKey = 'private/user-123/video.mp4';

      const result = await s3StorageService.generatePresignedUrl(fileKey, 'getObject');

      expect(result.success).toBe(true);
      expect(result.url).toContain('presigned=true');
      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );
    });

    it('should support custom expiration times', async () => {
      const fileKey = 'private/user-123/video.mp4';
      const expiresIn = 7200; // 2 hours

      const result = await s3StorageService.generatePresignedUrl(fileKey, 'getObject', expiresIn);

      expect(result.success).toBe(true);
      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(GetObjectCommand),
        { expiresIn }
      );
    });

    it('should generate presigned URLs for uploads', async () => {
      const fileKey = 'uploads/temp/video.mp4';

      const result = await s3StorageService.generatePresignedUrl(fileKey, 'putObject');

      expect(result.success).toBe(true);
      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(PutObjectCommand),
        { expiresIn: 3600 }
      );
    });

    it('should handle presigned URL generation errors', async () => {
      const signUrlError = new Error('Invalid credentials');
      (getSignedUrl as jest.MockedFunction<typeof getSignedUrl>).mockRejectedValue(signUrlError);

      const fileKey = 'private/user-123/video.mp4';

      const result = await s3StorageService.generatePresignedUrl(fileKey, 'getObject');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });
  });

  describe('listFiles', () => {
    beforeEach(() => {
      mockS3Client.send = jest.fn().mockResolvedValue({
        Contents: [
          {
            Key: 'videos/2024/01/01/video1.mp4',
            LastModified: new Date('2024-01-01T10:00:00Z'),
            Size: 1024000,
            ETag: '"etag1"',
          },
          {
            Key: 'videos/2024/01/01/video2.mp4',
            LastModified: new Date('2024-01-01T11:00:00Z'),
            Size: 2048000,
            ETag: '"etag2"',
          },
        ],
        IsTruncated: false,
      });
    });

    it('should list files in a given prefix', async () => {
      const result = await s3StorageService.listFiles('videos/2024/01/01/');

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toHaveProperty('key', 'videos/2024/01/01/video1.mp4');
      expect(result.files[0]).toHaveProperty('size', 1024000);
      expect(result.files[0]).toHaveProperty('lastModified');
    });

    it('should handle pagination for large file lists', async () => {
      mockS3Client.send = jest.fn()
        .mockResolvedValueOnce({
          Contents: [{ Key: 'file1.mp4', Size: 1000 }],
          IsTruncated: true,
          NextContinuationToken: 'token1',
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'file2.mp4', Size: 2000 }],
          IsTruncated: false,
        });

      const result = await s3StorageService.listFiles('videos/', { maxKeys: 1 });

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(mockS3Client.send).toHaveBeenCalledTimes(2);
    });

    it('should filter files by extension', async () => {
      const result = await s3StorageService.listFiles('videos/', { extension: '.mp4' });

      expect(result.success).toBe(true);
      expect(result.files.every(file => file.key.endsWith('.mp4'))).toBe(true);
    });

    it('should handle empty directories', async () => {
      mockS3Client.send = jest.fn().mockResolvedValue({
        Contents: [],
        IsTruncated: false,
      });

      const result = await s3StorageService.listFiles('empty-folder/');

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(0);
    });

    it('should handle list operation errors', async () => {
      const listError = {
        name: 'AccessDenied',
        message: 'Access denied for list operation',
      };
      mockS3Client.send = jest.fn().mockRejectedValue(listError);

      const result = await s3StorageService.listFiles('protected/');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  describe('copyFile', () => {
    it('should successfully copy files within S3', async () => {
      const sourceKey = 'videos/source/video.mp4';
      const destKey = 'videos/destination/video.mp4';

      const result = await s3StorageService.copyFile(sourceKey, destKey);

      expect(result.success).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            CopySource: `test-bucket/${sourceKey}`,
            Key: destKey,
          }),
        })
      );
    });

    it('should handle cross-bucket copying', async () => {
      const sourceKey = 'videos/source/video.mp4';
      const destKey = 'videos/destination/video.mp4';
      const sourceBucket = 'source-bucket';

      const result = await s3StorageService.copyFile(sourceKey, destKey, { sourceBucket });

      expect(result.success).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            CopySource: `${sourceBucket}/${sourceKey}`,
          }),
        })
      );
    });

    it('should preserve metadata during copy', async () => {
      const sourceKey = 'videos/source/video.mp4';
      const destKey = 'videos/destination/video.mp4';

      const result = await s3StorageService.copyFile(sourceKey, destKey, {
        preserveMetadata: true,
      });

      expect(result.success).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            MetadataDirective: 'COPY',
          }),
        })
      );
    });

    it('should handle copy operation errors', async () => {
      const copyError = {
        name: 'NoSuchKey',
        message: 'The specified key does not exist',
      };
      mockS3Client.send = jest.fn().mockRejectedValue(copyError);

      const sourceKey = 'videos/nonexistent/video.mp4';
      const destKey = 'videos/destination/video.mp4';

      const result = await s3StorageService.copyFile(sourceKey, destKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('The specified key does not exist');
    });
  });

  describe('getFileMetadata', () => {
    beforeEach(() => {
      mockS3Client.send = jest.fn().mockResolvedValue({
        ContentLength: 1024000,
        ContentType: 'video/mp4',
        LastModified: new Date('2024-01-01T10:00:00Z'),
        ETag: '"test-etag"',
        Metadata: {
          userId: 'user-123',
          jobId: 'job-456',
        },
      });
    });

    it('should retrieve file metadata', async () => {
      const fileKey = 'videos/2024/01/01/video.mp4';

      const result = await s3StorageService.getFileMetadata(fileKey);

      expect(result.success).toBe(true);
      expect(result.metadata).toHaveProperty('contentLength', 1024000);
      expect(result.metadata).toHaveProperty('contentType', 'video/mp4');
      expect(result.metadata).toHaveProperty('lastModified');
      expect(result.metadata).toHaveProperty('etag', '"test-etag"');
      expect(result.metadata).toHaveProperty('userMetadata', {
        userId: 'user-123',
        jobId: 'job-456',
      });
    });

    it('should handle metadata retrieval errors', async () => {
      const headError = {
        name: 'NotFound',
        message: 'Not Found',
        $metadata: { httpStatusCode: 404 },
      };
      mockS3Client.send = jest.fn().mockRejectedValue(headError);

      const fileKey = 'videos/2024/01/01/nonexistent.mp4';

      const result = await s3StorageService.getFileMetadata(fileKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not Found');
    });
  });

  describe('health checks and monitoring', () => {
    it('should check S3 service health', async () => {
      mockS3Client.send = jest.fn().mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
      });

      const health = await s3StorageService.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.region).toBe('us-east-1');
      expect(health.bucket).toBe(process.env.AWS_S3_BUCKET);
    });

    it('should detect S3 service issues', async () => {
      const serviceError = {
        name: 'ServiceUnavailable',
        message: 'Service temporarily unavailable',
        $metadata: { httpStatusCode: 503 },
      };
      mockS3Client.send = jest.fn().mockRejectedValue(serviceError);

      const health = await s3StorageService.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toContain('Service temporarily unavailable');
    });

    it('should measure operation performance', async () => {
      const mockFile = TestDataFactory.createMockFile();

      const startTime = Date.now();
      await s3StorageService.uploadFile(mockFile, 'performance-test/');
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('configuration and initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(S3Client).toHaveBeenCalledWith({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    });

    it('should handle missing configuration gracefully', () => {
      const originalRegion = process.env.AWS_REGION;
      delete process.env.AWS_REGION;

      expect(() => new S3StorageService()).toThrow('AWS configuration incomplete');

      process.env.AWS_REGION = originalRegion;
    });

    it('should support custom S3 endpoints', () => {
      process.env.AWS_S3_ENDPOINT = 'https://custom-s3.example.com';

      new S3StorageService();

      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'https://custom-s3.example.com',
        })
      );

      delete process.env.AWS_S3_ENDPOINT;
    });
  });

  describe('security and access control', () => {
    it('should validate file access permissions', async () => {
      const mockFile = TestDataFactory.createMockFile();
      const restrictedPrefix = 'private/';

      const result = await s3StorageService.uploadFile(mockFile, restrictedPrefix, {
        acl: 'private',
      });

      expect(result.success).toBe(true);
      expect(Upload).toHaveBeenCalledWith({
        client: mockS3Client,
        params: expect.objectContaining({
          ACL: 'private',
        }),
      });
    });

    it('should encrypt files at rest', async () => {
      const mockFile = TestDataFactory.createMockFile();

      await s3StorageService.uploadFile(mockFile, 'encrypted/', {
        encryption: 'AES256',
      });

      expect(Upload).toHaveBeenCalledWith({
        client: mockS3Client,
        params: expect.objectContaining({
          ServerSideEncryption: 'AES256',
        }),
      });
    });

    it('should handle access denied errors', async () => {
      const accessError = {
        name: 'AccessDenied',
        message: 'Access denied',
        $metadata: { httpStatusCode: 403 },
      };
      mockUpload.done = jest.fn().mockRejectedValue(accessError);

      const mockFile = TestDataFactory.createMockFile();

      const result = await s3StorageService.uploadFile(mockFile, 'restricted/');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });
});
