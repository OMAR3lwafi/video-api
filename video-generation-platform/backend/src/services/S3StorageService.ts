/**
 * S3 Storage Service
 * Comprehensive AWS S3 integration for video file management with advanced features
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutBucketLifecycleConfigurationCommand,
  GetBucketLifecycleConfigurationCommand,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream, statSync } from 'fs';
import { extname, basename } from 'path';
import { createHash, randomUUID } from 'crypto';
import { promisify } from 'util';
import { pipeline } from 'stream';
import ffprobe from 'ffprobe-static';
import ffmpeg from 'fluent-ffmpeg';

import {
  S3Config,
  UploadOptions,
  MultipartUploadOptions,
  UploadProgress,
  UploadResult,
  FileMetadata,
  FileValidationResult,
  RetryConfig,
  CircuitBreakerConfig,
  S3OperationResult,
  BucketLifecycleRule,
  S3ServiceMetrics,
  ProgressCallback,
  SUPPORTED_VIDEO_TYPES,
  SUPPORTED_MIME_TYPES,
  SupportedVideoType,
  SupportedMimeType
} from '../types/s3';
import { logger } from '../utils/logger';

const pipelineAsync = promisify(pipeline);

/**
 * Circuit Breaker implementation for S3 operations
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return Boolean(
      this.lastFailureTime &&
      (Date.now() - this.lastFailureTime.getTime() > this.config.resetTimeout)
    );
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }
}

/**
 * S3 Storage Service with comprehensive video file management
 */
export class S3StorageService {
  private s3Client: S3Client;
  private circuitBreaker: CircuitBreaker;
  private metrics: S3ServiceMetrics;
  
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true
  };

  private readonly defaultUploadOptions: UploadOptions = {
    acl: 'public-read',
    storageClass: 'STANDARD',
    serverSideEncryption: 'AES256',
    cacheControl: 'max-age=31536000'
  };

  constructor(
    private config: S3Config,
    retryConfig?: Partial<RetryConfig>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>
  ) {
    const clientConfig: any = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    };
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }
    if (typeof config.forcePathStyle === 'boolean') {
      clientConfig.forcePathStyle = config.forcePathStyle;
    }
    this.s3Client = new S3Client(clientConfig);

    if (retryConfig) {
      this.retryConfig = { ...this.retryConfig, ...retryConfig };
    }

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 30000,
      ...circuitBreakerConfig
    });

    this.metrics = {
      uploadsTotal: 0,
      uploadsSuccessful: 0,
      uploadsFailed: 0,
      bytesUploaded: 0,
      averageUploadTime: 0,
      circuitBreakerState: 'CLOSED'
    };

    // Set ffmpeg path
    ffmpeg.setFfprobePath(ffprobe.path);
  }

  /**
   * Upload a video file to S3 with comprehensive error handling and progress tracking
   */
  async uploadVideo(
    filePath: string,
    key?: string,
    options?: MultipartUploadOptions,
    progressCallback?: ProgressCallback
  ): Promise<UploadResult> {
    const startTime = Date.now();
    this.metrics.uploadsTotal++;

    try {
      // Generate unique key if not provided
      const uploadKey = key || this.generateVideoKey(filePath);
      
      // Validate file before upload
      const validation = await this.validateVideoFile(filePath);
      if (!validation.isValid) {
        throw new S3ServiceError(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Get file stats
      const stats = statSync(filePath);
      const fileSize = stats.size;

      // Determine upload strategy based on file size
      const useMultipart = fileSize > 100 * 1024 * 1024; // 100MB threshold

      let result: UploadResult;

      if (useMultipart) {
        result = await this.multipartUpload(filePath, uploadKey, options, progressCallback);
      } else {
        result = await this.singlePartUpload(filePath, uploadKey, options, progressCallback);
      }

      // Update metrics
      this.metrics.uploadsSuccessful++;
      this.metrics.bytesUploaded += fileSize;
      const duration = Date.now() - startTime;
      this.updateAverageUploadTime(duration);

      logger.info('Video upload completed', {
        key: uploadKey,
        size: fileSize,
        duration: `${duration}ms`,
        strategy: useMultipart ? 'multipart' : 'single'
      });

      return result;

    } catch (error) {
      this.metrics.uploadsFailed++;
      this.metrics.lastFailure = new Date();
      
      logger.error('Video upload failed', {
        filePath,
        key,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Single part upload for smaller files
   */
  private async singlePartUpload(
    filePath: string,
    key: string,
    options?: UploadOptions,
    progressCallback?: ProgressCallback
  ): Promise<UploadResult> {
    return this.executeWithRetry(async () => {
      const fileStream = createReadStream(filePath);
      const stats = statSync(filePath);
      const contentType = this.getContentType(filePath);

      const uploadOptions = {
        ...this.defaultUploadOptions,
        ...options,
        contentType: contentType
      };

      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: fileStream,
        ContentType: uploadOptions.contentType,
        ACL: uploadOptions.acl,
        StorageClass: uploadOptions.storageClass,
        ServerSideEncryption: uploadOptions.serverSideEncryption,
        CacheControl: uploadOptions.cacheControl,
        Expires: uploadOptions.expires,
        Metadata: uploadOptions.metadata,
        Tagging: this.formatTags(uploadOptions.tags)
      });

      // Track progress for single part upload
      if (progressCallback) {
        let uploaded = 0;
        fileStream.on('data', (chunk) => {
          uploaded += chunk.length;
          progressCallback({
            loaded: uploaded,
            total: stats.size,
            percentage: Math.round((uploaded / stats.size) * 100)
          });
        });
      }

      const result = await this.circuitBreaker.execute(() => this.s3Client.send(command));

      const output: any = {
        key,
        location: `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${key}`,
        etag: result.ETag!,
        bucket: this.config.bucketName,
        publicUrl: this.generatePublicUrl(key),
        size: stats.size,
        contentType,
        lastModified: stats.mtime,
      };
      if (result.VersionId) {
        output.versionId = result.VersionId;
      }
      if (uploadOptions.metadata) {
        output.metadata = uploadOptions.metadata;
      }
      return output;
    });
  }

  /**
   * Multipart upload for larger files with progress tracking
   */
  private async multipartUpload(
    filePath: string,
    key: string,
    options?: MultipartUploadOptions,
    progressCallback?: ProgressCallback
  ): Promise<UploadResult> {
    return this.executeWithRetry(async () => {
      const fileStream = createReadStream(filePath);
      const stats = statSync(filePath);
      const contentType = this.getContentType(filePath);

      const uploadOptions = {
        ...this.defaultUploadOptions,
        ...options,
        contentType,
        partSize: options?.partSize || 10 * 1024 * 1024, // 10MB default
        queueSize: options?.queueSize || 4
      };

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.config.bucketName,
          Key: key,
          Body: fileStream,
          ContentType: uploadOptions.contentType,
          ACL: uploadOptions.acl,
          StorageClass: uploadOptions.storageClass,
          ServerSideEncryption: uploadOptions.serverSideEncryption,
          CacheControl: uploadOptions.cacheControl,
          Expires: uploadOptions.expires,
          Metadata: uploadOptions.metadata,
          Tagging: this.formatTags(uploadOptions.tags)
        },
        partSize: uploadOptions.partSize,
        queueSize: uploadOptions.queueSize,
        leavePartsOnError: uploadOptions.leavePartsOnError === true
      });

      // Progress tracking
      if (progressCallback) {
        upload.on('httpUploadProgress', (progress) => {
          if (progress.loaded && progress.total) {
            const payload: any = {
              loaded: progress.loaded,
              total: progress.total,
              percentage: Math.round((progress.loaded / progress.total) * 100),
            };
            if (typeof (progress as any).part === 'number') {
              payload.part = (progress as any).part as number;
            }
            const upId = (progress as any).uploadId;
            if (typeof upId === 'string') {
              payload.uploadId = upId;
            }
            progressCallback(payload);
          }
        });
      }

      const result = await this.circuitBreaker.execute(() => upload.done());

      const output: any = {
        key,
        location: result.Location!,
        etag: result.ETag!,
        bucket: this.config.bucketName,
        publicUrl: this.generatePublicUrl(key),
        size: stats.size,
        contentType,
        lastModified: stats.mtime,
      };
      if ((result as any).VersionId) {
        output.versionId = (result as any).VersionId as string;
      }
      if (uploadOptions.metadata) {
        output.metadata = uploadOptions.metadata;
      }
      return output;
    });
  }

  /**
   * Generate a consistent public URL for uploaded files
   */
  generatePublicUrl(key: string): string {
    if (this.config.endpoint) {
      // For S3-compatible services
      return `${this.config.endpoint}/${this.config.bucketName}/${key}`;
    }
    
    // Standard AWS S3 URL format
    return `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  /**
   * Generate a unique key for video files with consistent naming convention
   */
  private generateVideoKey(filePath: string): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const uuid = randomUUID();
    const extension = extname(filePath).toLowerCase();
    const baseName = basename(filePath, extension);
    
    // Sanitize base name
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 50);
    
    return `videos/${timestamp}/${uuid}/${sanitizedBaseName}${extension}`;
  }

  /**
   * Validate video file before upload
   */
  async validateVideoFile(filePath: string): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      isValid: true,
      fileType: '',
      mimeType: '',
      size: 0,
      errors: []
    };

    try {
      // Check file existence and size
      const stats = statSync(filePath);
      result.size = stats.size;

      // Validate file size (max 10GB)
      if (stats.size > 10 * 1024 * 1024 * 1024) {
        result.errors.push('File size exceeds 10GB limit');
        result.isValid = false;
      }

      // Validate file extension
      const extension = extname(filePath).toLowerCase().substring(1) as SupportedVideoType;
      if (!SUPPORTED_VIDEO_TYPES.includes(extension)) {
        result.errors.push(`Unsupported file type: ${extension}`);
        result.isValid = false;
      }

      result.fileType = extension;
      result.mimeType = this.getContentType(filePath);

      // Validate MIME type
      if (!SUPPORTED_MIME_TYPES.includes(result.mimeType as SupportedMimeType)) {
        result.errors.push(`Unsupported MIME type: ${result.mimeType}`);
        result.isValid = false;
      }

      // Extract video metadata using FFmpeg
      try {
        const metadata = await this.extractVideoMetadata(filePath);
        result.duration = metadata.duration;
        result.dimensions = metadata.dimensions;

        // Validate duration (max 10 minutes for processing limit)
        if (metadata.duration && metadata.duration > 600) {
          result.errors.push('Video duration exceeds 10 minutes limit');
          result.isValid = false;
        }

      } catch (error) {
        result.errors.push('Failed to extract video metadata');
        result.isValid = false;
      }

    } catch (error) {
      result.errors.push(`File validation error: ${error instanceof Error ? error.message : String(error)}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Health check for S3 service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; response_time_ms?: number; lastCheck: string; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Try to list objects in the bucket (with limit 1 for minimal cost)
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        MaxKeys: 1
      });
      
      await this.s3Client.send(command);
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        response_time_ms: responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        response_time_ms: responseTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'S3 health check failed'
      };
    }
  }

  /**
   * Extract video metadata using FFmpeg
   */
  private async extractVideoMetadata(filePath: string): Promise<{
    duration?: number;
    dimensions?: { width: number; height: number };
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const payload: any = {};
        if (typeof metadata.format.duration === 'number') {
          payload.duration = metadata.format.duration;
        }
        if (videoStream && typeof videoStream.width === 'number' && typeof videoStream.height === 'number') {
          payload.dimensions = { width: videoStream.width, height: videoStream.height };
        }
        resolve(payload);
      });
    });
  }

  /**
   * Get file metadata from S3
   */
  async getFileMetadata(key: string): Promise<FileMetadata> {
    return this.executeWithRetry(async () => {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key
      });

      const result = await this.circuitBreaker.execute(() => this.s3Client.send(command));

      const output: any = {
        size: result.ContentLength!,
        contentType: result.ContentType!,
        lastModified: result.LastModified!,
        etag: result.ETag!,
      };
      if (result.VersionId) {
        output.versionId = result.VersionId;
      }
      if (result.Metadata && Object.keys(result.Metadata).length > 0) {
        output.metadata = result.Metadata as Record<string, string>;
      }
      return output;
    });
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<S3OperationResult<void>> {
    const startTime = Date.now();

    try {
      await this.executeWithRetry(async () => {
        const command = new DeleteObjectCommand({
          Bucket: this.config.bucketName,
          Key: key
        });

        await this.circuitBreaker.execute(() => this.s3Client.send(command));
      });

      logger.info('File deleted successfully', { key });

      return {
        success: true,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error('File deletion failed', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Cleanup old files based on age
   */
  async cleanupOldFiles(olderThanDays: number, prefix?: string): Promise<S3OperationResult<number>> {
    const startTime = Date.now();
    let deletedCount = 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const listCommand = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: prefix
      });

      const objects = await this.circuitBreaker.execute(() => this.s3Client.send(listCommand));

      if (objects.Contents) {
        const oldObjects = objects.Contents.filter(
          obj => obj.LastModified && obj.LastModified < cutoffDate
        );

        for (const obj of oldObjects) {
          if (obj.Key) {
            const deleteResult = await this.deleteFile(obj.Key);
            if (deleteResult.success) {
              deletedCount++;
            }
          }
        }
      }

      logger.info('Cleanup completed', {
        deletedCount,
        olderThanDays,
        prefix
      });

      return {
        success: true,
        data: deletedCount,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Cleanup failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Set up S3 bucket lifecycle policies
   */
  async setupLifecyclePolicies(rules: BucketLifecycleRule[]): Promise<S3OperationResult<void>> {
    const startTime = Date.now();

    try {
      const command = new PutBucketLifecycleConfigurationCommand({
        Bucket: this.config.bucketName,
        LifecycleConfiguration: {
          Rules: rules.map(rule => {
            const filter = rule.filter;
            let Filter: any = undefined;
            if (filter?.prefix && filter?.tags && Object.keys(filter.tags).length > 0) {
              Filter = {
                And: {
                  Prefix: filter.prefix,
                  Tags: Object.entries(filter.tags).map(([Key, Value]) => ({ Key, Value }))
                }
              };
            } else if (filter?.prefix) {
              Filter = { Prefix: filter.prefix };
            } else if (filter?.tags && Object.keys(filter.tags).length > 0) {
              Filter = {
                And: {
                  Tags: Object.entries(filter.tags).map(([Key, Value]) => ({ Key, Value }))
                }
              };
            }

            return {
              ID: rule.id,
              Status: rule.status,
              Filter,
            Transitions: rule.transitions?.map(t => ({
              Days: t.days,
              StorageClass: t.storageClass as any
            })),
              Expiration: rule.expiration ? {
                Days: rule.expiration.days,
                ExpiredObjectDeleteMarker: rule.expiration.expiredObjectDeleteMarker
              } : undefined,
              AbortIncompleteMultipartUpload: rule.abortIncompleteMultipartUpload ? {
                DaysAfterInitiation: rule.abortIncompleteMultipartUpload.daysAfterInitiation
              } : undefined
            };
          })
        }
      });

      await this.circuitBreaker.execute(() => this.s3Client.send(command));

      logger.info('Lifecycle policies configured', { rulesCount: rules.length });

      return {
        success: true,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Lifecycle policy setup failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get current service metrics
   */
  getMetrics(): S3ServiceMetrics {
    return {
      ...this.metrics,
      circuitBreakerState: this.circuitBreaker.getState()
    };
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
        const jitter = this.retryConfig.jitter ? Math.random() * 0.1 * baseDelay : 0;
        const delay = Math.min(baseDelay + jitter, this.retryConfig.maxDelay);

        logger.warn('Operation failed, retrying', {
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          delay: `${delay}ms`,
          error: error instanceof Error ? error.message : String(error)
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Format tags for S3 API
   */
  private formatTags(tags?: Record<string, string>): string | undefined {
    if (!tags) return undefined;
    
    return Object.entries(tags)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Parse tags from S3 response
   */
  private parseTags(tagSet: any[]): Record<string, string> {
    const tags: Record<string, string> = {};
    tagSet.forEach(tag => {
      tags[tag.Key] = tag.Value;
    });
    return tags;
  }

  /**
   * Update average upload time metric
   */
  private updateAverageUploadTime(duration: number): void {
    const totalUploads = this.metrics.uploadsSuccessful;
    this.metrics.averageUploadTime = 
      ((this.metrics.averageUploadTime * (totalUploads - 1)) + duration) / totalUploads;
  }
}

/**
 * Custom S3 Error class
 */
class S3ServiceError extends Error {
  constructor(
    message: string,
    public code: string = 'S3_ERROR',
    public statusCode?: number,
    public retryable: boolean = true,
    public retryDelay?: number
  ) {
    super(message);
    this.name = 'S3ServiceError';
  }
}
