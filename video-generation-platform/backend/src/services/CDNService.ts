import {
  CloudFrontClient,
  CreateInvalidationCommand,
  GetDistributionCommand,
  UpdateDistributionCommand,
} from '@aws-sdk/client-cloudfront';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { pipeline } from 'stream';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { logger } from '../utils/logger';
import { MetricsCollector } from '../utils/MetricsCollector';
import cacheService from './CacheService';

const pipelineAsync = promisify(pipeline);

// CDN Configuration
interface CDNConfig {
  cloudfront: {
    distributionId: string;
    domain: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    invalidationBatchSize: number;
  };
  s3: {
    bucketName: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  optimization: {
    images: {
      formats: Array<'webp' | 'avif' | 'jpeg' | 'png'>;
      quality: number;
      progressive: boolean;
      sizes: number[];
    };
    videos: {
      formats: Array<'mp4' | 'webm' | 'mov'>;
      quality: Array<'360p' | '480p' | '720p' | '1080p'>;
      bitrates: number[];
    };
  };
  caching: {
    defaultTTL: number;
    maxTTL: number;
    edgeCaching: boolean;
  };
  zones: Array<{
    name: string;
    region: string;
    endpoint: string;
    priority: number;
  }>;
}

// Media optimization options
interface ImageOptimizationOptions {
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
  quality?: number;
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  progressive?: boolean;
  optimize?: boolean;
  sizes?: number[];
}

interface VideoOptimizationOptions {
  format?: 'mp4' | 'webm' | 'mov' | 'auto';
  quality?: '360p' | '480p' | '720p' | '1080p' | 'auto';
  bitrate?: number;
  fps?: number;
  codec?: string;
  preset?:
    | 'ultrafast'
    | 'superfast'
    | 'veryfast'
    | 'faster'
    | 'fast'
    | 'medium'
    | 'slow'
    | 'slower'
    | 'veryslow';
}

// CDN response interfaces
interface CDNUploadResult {
  url: string;
  cdnUrl: string;
  key: string;
  etag: string;
  size: number;
  optimized: boolean;
  variants?: Array<{
    url: string;
    format: string;
    size: number;
    dimensions?: { width: number; height: number };
  }>;
}

interface CDNInvalidationResult {
  id: string;
  status: 'InProgress' | 'Completed' | 'Failed';
  paths: string[];
  createdTime: Date;
}

interface CDNMetrics {
  uploads: number;
  downloads: number;
  invalidations: number;
  optimizations: number;
  cacheMisses: number;
  cacheHits: number;
  totalBandwidth: number;
  averageResponseTime: number;
  errorCount: number;
}

// CDN zones and fallback configuration
interface CDNZone {
  name: string;
  region: string;
  endpoint: string;
  priority: number;
  healthy: boolean;
  responseTime: number;
  errorRate: number;
}

export class CDNService {
  private static instance: CDNService;
  private config: CDNConfig;
  private cloudfrontClient: CloudFrontClient;
  private s3Client: S3Client;
  private metricsCollector: MetricsCollector;
  private metrics: CDNMetrics;
  private zones: Map<string, CDNZone>;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Optimization presets
  private readonly IMAGE_PRESETS = {
    thumbnail: { width: 150, height: 150, quality: 80, format: 'webp' as const },
    small: { width: 300, height: 300, quality: 85, format: 'webp' as const },
    medium: { width: 600, height: 600, quality: 85, format: 'webp' as const },
    large: { width: 1200, height: 1200, quality: 90, format: 'webp' as const },
    hero: { width: 1920, height: 1080, quality: 95, format: 'webp' as const },
  };

  private readonly VIDEO_PRESETS = {
    preview: { quality: '360p' as const, bitrate: 500, format: 'mp4' as const },
    mobile: { quality: '480p' as const, bitrate: 800, format: 'mp4' as const },
    standard: { quality: '720p' as const, bitrate: 1200, format: 'mp4' as const },
    hd: { quality: '1080p' as const, bitrate: 2000, format: 'mp4' as const },
  };

  // Cache TTL configurations
  private readonly CACHE_CONFIGS = {
    images: { ttl: 30 * 24 * 60 * 60, edgeTtl: 7 * 24 * 60 * 60 }, // 30 days origin, 7 days edge
    videos: { ttl: 7 * 24 * 60 * 60, edgeTtl: 1 * 24 * 60 * 60 }, // 7 days origin, 1 day edge
    static: { ttl: 365 * 24 * 60 * 60, edgeTtl: 30 * 24 * 60 * 60 }, // 1 year origin, 30 days edge
    dynamic: { ttl: 1 * 60 * 60, edgeTtl: 5 * 60 }, // 1 hour origin, 5 minutes edge
  };

  constructor() {
    this.initializeConfig();
    this.initializeClients();
    this.zones = new Map();
    this.metricsCollector = new MetricsCollector();
    this.metrics = {
      uploads: 0,
      downloads: 0,
      invalidations: 0,
      optimizations: 0,
      cacheMisses: 0,
      cacheHits: 0,
      totalBandwidth: 0,
      averageResponseTime: 0,
      errorCount: 0,
    };

    this.initializeZones();
    this.startHealthChecks();
    logger.info('CDNService initialized');
  }

  static getInstance(): CDNService {
    if (!CDNService.instance) {
      CDNService.instance = new CDNService();
    }
    return CDNService.instance;
  }

  private initializeConfig(): void {
    this.config = {
      cloudfront: {
        distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID || '',
        domain: process.env.CLOUDFRONT_DOMAIN || '',
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        invalidationBatchSize: parseInt(process.env.CDN_INVALIDATION_BATCH_SIZE || '1000'),
      },
      s3: {
        bucketName: process.env.AWS_S3_BUCKET || '',
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      optimization: {
        images: {
          formats: ['webp', 'avif', 'jpeg'],
          quality: parseInt(process.env.CDN_IMAGE_QUALITY || '85'),
          progressive: true,
          sizes: [150, 300, 600, 1200, 1920],
        },
        videos: {
          formats: ['mp4', 'webm'],
          quality: ['360p', '480p', '720p', '1080p'],
          bitrates: [500, 800, 1200, 2000, 3000],
        },
      },
      caching: {
        defaultTTL: parseInt(process.env.CDN_DEFAULT_TTL || '86400'), // 24 hours
        maxTTL: parseInt(process.env.CDN_MAX_TTL || '31536000'), // 1 year
        edgeCaching: process.env.CDN_EDGE_CACHING !== 'false',
      },
      zones: [
        {
          name: 'primary',
          region: 'us-east-1',
          endpoint: process.env.CDN_PRIMARY_ENDPOINT || '',
          priority: 1,
        },
        {
          name: 'secondary',
          region: 'us-west-2',
          endpoint: process.env.CDN_SECONDARY_ENDPOINT || '',
          priority: 2,
        },
        {
          name: 'europe',
          region: 'eu-west-1',
          endpoint: process.env.CDN_EUROPE_ENDPOINT || '',
          priority: 3,
        },
      ],
    };
  }

  private initializeClients(): void {
    this.cloudfrontClient = new CloudFrontClient({
      region: this.config.cloudfront.region,
      credentials: {
        accessKeyId: this.config.cloudfront.accessKeyId,
        secretAccessKey: this.config.cloudfront.secretAccessKey,
      },
    });

    this.s3Client = new S3Client({
      region: this.config.s3.region,
      credentials: {
        accessKeyId: this.config.s3.accessKeyId,
        secretAccessKey: this.config.s3.secretAccessKey,
      },
    });
  }

  private initializeZones(): void {
    for (const zoneConfig of this.config.zones) {
      if (zoneConfig.endpoint) {
        this.zones.set(zoneConfig.name, {
          ...zoneConfig,
          healthy: true,
          responseTime: 0,
          errorRate: 0,
        });
      }
    }
  }

  /**
   * Upload and optimize image with multiple formats and sizes
   */
  async uploadImage(
    buffer: Buffer,
    key: string,
    options: ImageOptimizationOptions = {}
  ): Promise<CDNUploadResult> {
    const startTime = Date.now();

    try {
      const {
        format = 'auto',
        quality = this.config.optimization.images.quality,
        progressive = this.config.optimization.images.progressive,
        optimize = true,
        sizes = this.config.optimization.images.sizes,
      } = options;

      let optimizedBuffer = buffer;
      let finalFormat = format;
      const variants: CDNUploadResult['variants'] = [];

      // Auto-detect optimal format
      if (format === 'auto') {
        finalFormat = await this.detectOptimalImageFormat(buffer);
      }

      // Create multiple variants
      if (sizes && sizes.length > 0) {
        for (const size of sizes) {
          const variantBuffer = await this.optimizeImage(buffer, {
            ...options,
            width: size,
            height: size,
            format: finalFormat as any,
            quality,
            progressive,
            fit: 'inside',
          });

          const variantKey = `${key}_${size}w.${finalFormat}`;
          const variantResult = await this.uploadToS3(variantBuffer, variantKey, {
            contentType: `image/${finalFormat}`,
            cacheControl: `public, max-age=${this.CACHE_CONFIGS.images.ttl}`,
          });

          variants.push({
            url: variantResult.url,
            format: finalFormat,
            size: variantBuffer.length,
            dimensions: { width: size, height: size },
          });
        }
      }

      // Optimize main image
      if (optimize) {
        optimizedBuffer = await this.optimizeImage(buffer, {
          ...options,
          format: finalFormat as any,
          quality,
          progressive,
        });
      }

      // Upload main image
      const mainKey = `${key}.${finalFormat}`;
      const uploadResult = await this.uploadToS3(optimizedBuffer, mainKey, {
        contentType: `image/${finalFormat}`,
        cacheControl: `public, max-age=${this.CACHE_CONFIGS.images.ttl}`,
      });

      // Generate CDN URL
      const cdnUrl = this.generateCDNUrl(mainKey);

      // Update metrics
      this.metrics.uploads++;
      this.metrics.optimizations++;
      this.updateAverageResponseTime(Date.now() - startTime);

      // Record metrics
      this.metricsCollector.recordBusinessEvent({
        event: 'cdn_image_upload',
        metadata: {
          originalSize: buffer.length,
          optimizedSize: optimizedBuffer.length,
          format: finalFormat,
          variants: variants.length,
          compressionRatio:
            (((buffer.length - optimizedBuffer.length) / buffer.length) * 100).toFixed(2) + '%',
        },
      });

      const result: CDNUploadResult = {
        url: uploadResult.url,
        cdnUrl,
        key: mainKey,
        etag: uploadResult.etag,
        size: optimizedBuffer.length,
        optimized: optimize,
        variants,
      };

      // Cache the result
      await cacheService.set(`cdn_image:${key}`, result, {
        namespace: 'cdn',
        ttl: 3600, // 1 hour
      });

      return result;
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('Image upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload and optimize video with multiple quality levels
   */
  async uploadVideo(
    inputPath: string,
    key: string,
    options: VideoOptimizationOptions = {}
  ): Promise<CDNUploadResult> {
    const startTime = Date.now();

    try {
      const { format = 'auto', quality = 'auto', bitrate, fps, codec, preset = 'fast' } = options;

      let finalFormat = format;
      const variants: CDNUploadResult['variants'] = [];

      // Auto-detect optimal format
      if (format === 'auto') {
        finalFormat = 'mp4'; // Default to MP4 for widest compatibility
      }

      // Create multiple quality variants
      if (quality === 'auto') {
        for (const [presetName, presetOptions] of Object.entries(this.VIDEO_PRESETS)) {
          const variantPath = `/tmp/${key}_${presetName}.${presetOptions.format}`;

          await this.optimizeVideo(inputPath, variantPath, {
            ...presetOptions,
            codec,
            preset,
          });

          const variantBuffer = await this.readFile(variantPath);
          const variantKey = `${key}_${presetName}.${presetOptions.format}`;

          const variantResult = await this.uploadToS3(variantBuffer, variantKey, {
            contentType: `video/${presetOptions.format}`,
            cacheControl: `public, max-age=${this.CACHE_CONFIGS.videos.ttl}`,
          });

          variants.push({
            url: variantResult.url,
            format: presetOptions.format,
            size: variantBuffer.length,
          });

          // Clean up temporary file
          await this.deleteFile(variantPath);
        }
      }

      // Optimize main video
      const optimizedPath = `/tmp/${key}_optimized.${finalFormat}`;
      await this.optimizeVideo(inputPath, optimizedPath, {
        format: finalFormat as any,
        quality: quality === 'auto' ? '720p' : quality,
        bitrate,
        fps,
        codec,
        preset,
      });

      const optimizedBuffer = await this.readFile(optimizedPath);

      // Upload main video
      const mainKey = `${key}.${finalFormat}`;
      const uploadResult = await this.uploadToS3(optimizedBuffer, mainKey, {
        contentType: `video/${finalFormat}`,
        cacheControl: `public, max-age=${this.CACHE_CONFIGS.videos.ttl}`,
      });

      // Generate CDN URL
      const cdnUrl = this.generateCDNUrl(mainKey);

      // Clean up temporary files
      await this.deleteFile(optimizedPath);

      // Update metrics
      this.metrics.uploads++;
      this.metrics.optimizations++;
      this.updateAverageResponseTime(Date.now() - startTime);

      // Record metrics
      const originalSize = await this.getFileSize(inputPath);
      this.metricsCollector.recordVideoProcessing({
        jobId: key,
        operation: 'cdn_upload_optimization',
        duration: Date.now() - startTime,
        inputSize: originalSize,
        outputSize: optimizedBuffer.length,
        success: true,
      });

      const result: CDNUploadResult = {
        url: uploadResult.url,
        cdnUrl,
        key: mainKey,
        etag: uploadResult.etag,
        size: optimizedBuffer.length,
        optimized: true,
        variants,
      };

      // Cache the result
      await cacheService.set(`cdn_video:${key}`, result, {
        namespace: 'cdn',
        ttl: 1800, // 30 minutes
      });

      return result;
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('Video upload failed:', error);
      throw error;
    }
  }

  /**
   * Generate responsive image srcset
   */
  generateResponsiveImageSrcset(baseUrl: string, sizes: number[]): string {
    return sizes
      .map(size => `${baseUrl.replace(/\.[^.]+$/, '')}_${size}w.webp ${size}w`)
      .join(', ');
  }

  /**
   * Generate progressive video sources
   */
  generateProgressiveVideoSources(
    baseUrl: string
  ): Array<{ src: string; type: string; quality: string }> {
    const baseKey = baseUrl.replace(/\.[^.]+$/, '');

    return [
      { src: `${baseKey}_preview.mp4`, type: 'video/mp4', quality: '360p' },
      { src: `${baseKey}_mobile.mp4`, type: 'video/mp4', quality: '480p' },
      { src: `${baseKey}_standard.mp4`, type: 'video/mp4', quality: '720p' },
      { src: `${baseKey}_hd.mp4`, type: 'video/mp4', quality: '1080p' },
    ];
  }

  /**
   * Invalidate CDN cache for specific paths
   */
  async invalidateCache(paths: string[]): Promise<CDNInvalidationResult> {
    try {
      // Batch paths if needed
      const batches = this.batchPaths(paths, this.config.cloudfront.invalidationBatchSize);
      const invalidationResults: CDNInvalidationResult[] = [];

      for (const batch of batches) {
        const command = new CreateInvalidationCommand({
          DistributionId: this.config.cloudfront.distributionId,
          InvalidationBatch: {
            Paths: {
              Quantity: batch.length,
              Items: batch.map(path => (path.startsWith('/') ? path : `/${path}`)),
            },
            CallerReference: `invalidation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        });

        const result = await this.cloudfrontClient.send(command);

        invalidationResults.push({
          id: result.Invalidation?.Id || 'unknown',
          status: (result.Invalidation?.Status as any) || 'InProgress',
          paths: batch,
          createdTime: new Date(),
        });
      }

      // Update metrics
      this.metrics.invalidations += paths.length;

      // Record metrics
      this.metricsCollector.recordBusinessEvent({
        event: 'cdn_cache_invalidation',
        metadata: {
          pathCount: paths.length,
          batchCount: batches.length,
        },
      });

      // Return first result or combined result
      return (
        invalidationResults[0] || {
          id: 'batch-invalidation',
          status: 'InProgress',
          paths,
          createdTime: new Date(),
        }
      );
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('Cache invalidation failed:', error);
      throw error;
    }
  }

  /**
   * Get CDN analytics and usage statistics
   */
  async getCDNAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    requests: number;
    bandwidth: number;
    cacheHitRate: number;
    topContent: Array<{ path: string; requests: number; bandwidth: number }>;
    errors: Array<{ code: number; count: number }>;
    regions: Array<{ region: string; requests: number; bandwidth: number }>;
  }> {
    try {
      // This would integrate with CloudFront reporting API
      // For now, return cached analytics data
      const analytics = await cacheService.get('cdn_analytics', {
        namespace: 'cdn',
      });

      if (analytics) {
        return analytics;
      }

      // Mock analytics data - replace with actual CloudFront API calls
      const mockAnalytics = {
        requests: this.metrics.uploads + this.metrics.downloads,
        bandwidth: this.metrics.totalBandwidth,
        cacheHitRate:
          (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100,
        topContent: [],
        errors: [],
        regions: [],
      };

      // Cache for 1 hour
      await cacheService.set('cdn_analytics', mockAnalytics, {
        namespace: 'cdn',
        ttl: 3600,
      });

      return mockAnalytics;
    } catch (error) {
      logger.error('Failed to get CDN analytics:', error);
      throw error;
    }
  }

  /**
   * Get optimal CDN zone based on user location and zone health
   */
  getOptimalZone(userRegion?: string): CDNZone | null {
    const healthyZones = Array.from(this.zones.values()).filter(zone => zone.healthy);

    if (healthyZones.length === 0) {
      return null;
    }

    // If user region specified, find closest zone
    if (userRegion) {
      const regionalZone = healthyZones.find(zone => zone.region === userRegion);
      if (regionalZone) {
        return regionalZone;
      }
    }

    // Sort by priority and response time
    return healthyZones.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.responseTime - b.responseTime;
    })[0];
  }

  /**
   * Get CDN service metrics
   */
  getMetrics(): CDNMetrics {
    return { ...this.metrics };
  }

  /**
   * Health check for CDN service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    zones: Array<{ name: string; healthy: boolean; responseTime: number }>;
    metrics: CDNMetrics;
  }> {
    const zoneStatus = Array.from(this.zones.entries()).map(([name, zone]) => ({
      name,
      healthy: zone.healthy,
      responseTime: zone.responseTime,
    }));

    const healthyZones = zoneStatus.filter(zone => zone.healthy);
    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (healthyZones.length === zoneStatus.length) {
      status = 'healthy';
    } else if (healthyZones.length > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      zones: zoneStatus,
      metrics: this.metrics,
    };
  }

  // Private helper methods

  private async optimizeImage(buffer: Buffer, options: ImageOptimizationOptions): Promise<Buffer> {
    try {
      let image = sharp(buffer);

      // Resize if dimensions specified
      if (options.width || options.height) {
        image = image.resize(options.width, options.height, {
          fit: options.fit || 'cover',
          withoutEnlargement: true,
        });
      }

      // Set format and quality
      switch (options.format) {
        case 'webp':
          image = image.webp({
            quality: options.quality || 85,
            progressive: options.progressive,
          });
          break;
        case 'avif':
          image = image.avif({
            quality: options.quality || 85,
          });
          break;
        case 'jpeg':
          image = image.jpeg({
            quality: options.quality || 85,
            progressive: options.progressive,
            mozjpeg: true,
          });
          break;
        case 'png':
          image = image.png({
            progressive: options.progressive,
            compressionLevel: 9,
          });
          break;
        default:
          // Keep original format
          break;
      }

      // Apply optimizations
      if (options.optimize) {
        image = image.normalize().sharpen();
      }

      return await image.toBuffer();
    } catch (error) {
      logger.error('Image optimization failed:', error);
      throw error;
    }
  }

  private async optimizeVideo(
    inputPath: string,
    outputPath: string,
    options: VideoOptimizationOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // Set video codec
      if (options.codec) {
        command = command.videoCodec(options.codec);
      } else {
        command = command.videoCodec(options.format === 'webm' ? 'libvpx-vp9' : 'libx264');
      }

      // Set quality/bitrate
      if (options.bitrate) {
        command = command.videoBitrate(options.bitrate);
      }

      // Set resolution
      if (options.quality && options.quality !== 'auto') {
        const resolutions = {
          '360p': '640x360',
          '480p': '854x480',
          '720p': '1280x720',
          '1080p': '1920x1080',
        };
        command = command.size(resolutions[options.quality]);
      }

      // Set frame rate
      if (options.fps) {
        command = command.fps(options.fps);
      }

      // Set preset
      if (options.preset) {
        command = command.preset(options.preset);
      }

      // Set format-specific options
      if (options.format === 'mp4') {
        command = command.format('mp4').audioCodec('aac').audioChannels(2).audioFrequency(44100);
      } else if (options.format === 'webm') {
        command = command.format('webm').audioCodec('libvorbis');
      }

      command
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', error => reject(error))
        .run();
    });
  }

  private async detectOptimalImageFormat(buffer: Buffer): Promise<string> {
    try {
      const metadata = await sharp(buffer).metadata();

      // Prefer WebP for most cases
      if (metadata.channels === 4) {
        // Has alpha channel
        return 'webp'; // WebP supports alpha
      }

      // For photographs, prefer WebP or AVIF
      if (metadata.density && metadata.density > 150) {
        return 'webp';
      }

      return 'webp'; // Default to WebP for best compression
    } catch (error) {
      logger.warn('Could not detect optimal format, using WebP:', error);
      return 'webp';
    }
  }

  private async uploadToS3(
    buffer: Buffer,
    key: string,
    options: { contentType: string; cacheControl: string }
  ): Promise<{ url: string; etag: string }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.s3.bucketName,
        Key: key,
        Body: buffer,
        ContentType: options.contentType,
        CacheControl: options.cacheControl,
        Metadata: {
          'upload-timestamp': Date.now().toString(),
          optimized: 'true',
        },
      });

      const result = await this.s3Client.send(command);
      const url = `https://${this.config.s3.bucketName}.s3.${this.config.s3.region}.amazonaws.com/${key}`;

      return {
        url,
        etag: result.ETag || '',
      };
    } catch (error) {
      logger.error('S3 upload failed:', error);
      throw error;
    }
  }

  private generateCDNUrl(key: string): string {
    if (this.config.cloudfront.domain) {
      return `https://${this.config.cloudfront.domain}/${key}`;
    }
    return `https://${this.config.s3.bucketName}.s3.${this.config.s3.region}.amazonaws.com/${key}`;
  }

  private batchPaths(paths: string[], batchSize: number): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < paths.length; i += batchSize) {
      batches.push(paths.slice(i, i + batchSize));
    }
    return batches;
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalOperations =
      this.metrics.uploads + this.metrics.downloads + this.metrics.invalidations;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (totalOperations - 1) + responseTime) / totalOperations;
  }

  private startHealthChecks(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      for (const [name, zone] of this.zones.entries()) {
        try {
          const startTime = Date.now();

          // Simple health check by making a HEAD request to the zone endpoint
          const response = await fetch(`${zone.endpoint}/health`, {
            method: 'HEAD',
            timeout: 5000,
          });

          const responseTime = Date.now() - startTime;
          const healthy = response.ok && responseTime < 2000; // Consider healthy if < 2s

          // Update zone health status
          this.zones.set(name, {
            ...zone,
            healthy,
            responseTime,
            errorRate: healthy ? Math.max(0, zone.errorRate - 0.1) : zone.errorRate + 0.1,
          });

          if (!healthy) {
            logger.warn(`CDN zone ${name} health check failed`, {
              responseTime,
              status: response.status,
            });
          }
        } catch (error) {
          // Mark zone as unhealthy on error
          this.zones.set(name, {
            ...zone,
            healthy: false,
            errorRate: Math.min(1, zone.errorRate + 0.2),
          });

          logger.error(`CDN zone ${name} health check error:`, error);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async readFile(filePath: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    return await fs.readFile(filePath);
  }

  private async deleteFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore file not found errors
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async getFileSize(filePath: string): Promise<number> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      logger.warn(`Could not get file size for ${filePath}:`, error);
      return 0;
    }
  }

  /**
   * Cleanup resources on service shutdown
   */
  destroy(): void {
    this.stopHealthChecks();
    logger.info('CDNService destroyed');
  }
}

// Export singleton instance
export const cdnService = CDNService.getInstance();
export default cdnService;
