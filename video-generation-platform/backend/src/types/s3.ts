/**
 * S3 Storage Service Types and Interfaces
 * Comprehensive type definitions for S3 operations in the video platform
 */

export interface S3Config {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint?: string | undefined;
  forcePathStyle?: boolean | undefined;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  acl?: 'public-read' | 'private' | 'public-read-write';
  storageClass?: 'STANDARD' | 'STANDARD_IA' | 'ONEZONE_IA' | 'INTELLIGENT_TIERING' | 'GLACIER' | 'GLACIER_IR' | 'DEEP_ARCHIVE';
  serverSideEncryption?: 'AES256' | 'aws:kms';
  cacheControl?: string;
  expires?: Date | undefined;
}

export interface MultipartUploadOptions extends UploadOptions {
  partSize?: number | undefined;
  queueSize?: number | undefined;
  leavePartsOnError?: boolean | undefined;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  part?: number | undefined;
  uploadId?: string | undefined;
}

export interface UploadResult {
  key: string;
  location: string;
  etag: string;
  bucket: string;
  publicUrl: string;
  versionId?: string | undefined;
  size: number;
  contentType: string;
  lastModified: Date;
  metadata?: Record<string, string> | undefined;
}

export interface FileMetadata {
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
  versionId?: string | undefined;
  metadata?: Record<string, string> | undefined;
  tags?: Record<string, string> | undefined;
}

export interface FileValidationResult {
  isValid: boolean;
  fileType: string;
  mimeType: string;
  size: number;
  duration?: number | undefined;
  dimensions?: {
    width: number;
    height: number;
  } | undefined;
  errors: string[];
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export interface S3OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  retryCount?: number;
  duration: number;
}

export interface BucketLifecycleRule {
  id: string;
  status: 'Enabled' | 'Disabled';
  filter?: {
    prefix?: string | undefined;
    tags?: Record<string, string> | undefined;
  };
  transitions?: Array<{
    days: number;
    storageClass: 'STANDARD_IA' | 'ONEZONE_IA' | 'INTELLIGENT_TIERING' | 'GLACIER' | 'GLACIER_IR' | 'DEEP_ARCHIVE';
  }>;
  expiration?: {
    days?: number | undefined;
    expiredObjectDeleteMarker?: boolean | undefined;
  };
  abortIncompleteMultipartUpload?: {
    daysAfterInitiation: number;
  };
}

export interface S3ServiceMetrics {
  uploadsTotal: number;
  uploadsSuccessful: number;
  uploadsFailed: number;
  bytesUploaded: number;
  averageUploadTime: number;
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  lastFailure?: Date | undefined;
}

export type ProgressCallback = (progress: UploadProgress) => void;

export const SUPPORTED_VIDEO_TYPES = ['mp4', 'mov', 'avi', 'webm', 'mkv'] as const;
export const SUPPORTED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/x-matroska'
] as const;

export type SupportedVideoType = typeof SUPPORTED_VIDEO_TYPES[number];
export type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number];

export interface S3Error extends Error {
  code: string;
  statusCode?: number | undefined;
  retryable: boolean;
  retryDelay?: number | undefined;
}
