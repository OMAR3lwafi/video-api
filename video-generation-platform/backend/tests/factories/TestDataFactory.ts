import { faker } from '@faker-js/faker';
import { VideoElement, VideoJob, User } from '@/types';

/**
 * Test Data Factory for generating consistent test data
 */
export class TestDataFactory {
  /**
   * Generate a test video element
   */
  static createVideoElement(overrides: Partial<VideoElement> = {}): VideoElement {
    return {
      id: faker.string.uuid(),
      type: 'video',
      source: `https://test-bucket.s3.amazonaws.com/${faker.system.fileName({ extension: 'mp4' })}`,
      track: faker.number.int({ min: 1, max: 10 }),
      x: `${faker.number.int({ min: 0, max: 80 })}%`,
      y: `${faker.number.int({ min: 0, max: 80 })}%`,
      width: `${faker.number.int({ min: 20, max: 100 })}%`,
      height: `${faker.number.int({ min: 20, max: 100 })}%`,
      fit_mode: faker.helpers.arrayElement(['auto', 'contain', 'cover', 'fill']),
      start_time: faker.number.int({ min: 0, max: 30 }).toString(),
      duration: faker.number.int({ min: 5, max: 60 }).toString(),
      ...overrides,
    };
  }

  /**
   * Generate a test image element
   */
  static createImageElement(overrides: Partial<VideoElement> = {}): VideoElement {
    return {
      id: faker.string.uuid(),
      type: 'image',
      source: `https://test-bucket.s3.amazonaws.com/${faker.system.fileName({ extension: 'jpg' })}`,
      track: faker.number.int({ min: 1, max: 10 }),
      x: `${faker.number.int({ min: 0, max: 80 })}%`,
      y: `${faker.number.int({ min: 0, max: 80 })}%`,
      width: `${faker.number.int({ min: 20, max: 100 })}%`,
      height: `${faker.number.int({ min: 20, max: 100 })}%`,
      fit_mode: faker.helpers.arrayElement(['auto', 'contain', 'cover', 'fill']),
      duration: faker.number.int({ min: 1, max: 30 }).toString(),
      ...overrides,
    };
  }

  /**
   * Generate a test video job
   */
  static createVideoJob(overrides: Partial<VideoJob> = {}): VideoJob {
    const elementCount = faker.number.int({ min: 1, max: 5 });
    const elements: VideoElement[] = [];

    for (let i = 0; i < elementCount; i++) {
      if (faker.datatype.boolean()) {
        elements.push(this.createVideoElement({ track: i + 1 }));
      } else {
        elements.push(this.createImageElement({ track: i + 1 }));
      }
    }

    return {
      id: faker.string.uuid(),
      status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
      output_format: faker.helpers.arrayElement(['mp4', 'mov', 'avi']),
      width: faker.helpers.arrayElement([1280, 1920, 3840]),
      height: faker.helpers.arrayElement([720, 1080, 2160]),
      elements,
      user_id: faker.string.uuid(),
      result_url: null,
      error_message: null,
      processing_time: null,
      file_size: null,
      progress: 0,
      current_step: null,
      estimated_completion: null,
      created_at: faker.date.recent().toISOString(),
      updated_at: faker.date.recent().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate a completed video job
   */
  static createCompletedVideoJob(overrides: Partial<VideoJob> = {}): VideoJob {
    return this.createVideoJob({
      status: 'completed',
      result_url: `https://test-bucket.s3.amazonaws.com/${faker.system.fileName({ extension: 'mp4' })}`,
      processing_time: faker.number.int({ min: 5000, max: 300000 }).toString(),
      file_size: `${faker.number.int({ min: 1, max: 100 })}MB`,
      progress: 100,
      current_step: 'completed',
      ...overrides,
    });
  }

  /**
   * Generate a failed video job
   */
  static createFailedVideoJob(overrides: Partial<VideoJob> = {}): VideoJob {
    return this.createVideoJob({
      status: 'failed',
      error_message: faker.helpers.arrayElement([
        'FFmpeg processing failed',
        'Invalid video format',
        'File not found',
        'Processing timeout',
        'Insufficient resources',
      ]),
      progress: faker.number.int({ min: 0, max: 99 }),
      current_step: faker.helpers.arrayElement(['validation', 'processing', 'encoding', 'upload']),
      ...overrides,
    });
  }

  /**
   * Generate a test user
   */
  static createUser(overrides: Partial<User> = {}): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      created_at: faker.date.past().toISOString(),
      updated_at: faker.date.recent().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate multiple video jobs
   */
  static createVideoJobs(count: number, overrides: Partial<VideoJob> = {}): VideoJob[] {
    return Array.from({ length: count }, () => this.createVideoJob(overrides));
  }

  /**
   * Generate multiple users
   */
  static createUsers(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, () => this.createUser(overrides));
  }

  /**
   * Generate video creation request payload
   */
  static createVideoCreateRequest(overrides: any = {}) {
    const elementCount = faker.number.int({ min: 1, max: 3 });
    const elements: VideoElement[] = [];

    for (let i = 0; i < elementCount; i++) {
      if (faker.datatype.boolean()) {
        elements.push(this.createVideoElement({ track: i + 1 }));
      } else {
        elements.push(this.createImageElement({ track: i + 1 }));
      }
    }

    return {
      output_format: faker.helpers.arrayElement(['mp4', 'mov', 'avi']),
      width: faker.helpers.arrayElement([1280, 1920]),
      height: faker.helpers.arrayElement([720, 1080]),
      elements,
      ...overrides,
    };
  }

  /**
   * Generate S3 upload response
   */
  static createS3UploadResponse(overrides: any = {}) {
    return {
      Location: `https://test-bucket.s3.amazonaws.com/${faker.system.fileName({ extension: 'mp4' })}`,
      Key: faker.system.fileName({ extension: 'mp4' }),
      Bucket: 'test-bucket',
      ETag: `"${faker.string.hexadecimal({ length: 32 })}"`,
      ...overrides,
    };
  }

  /**
   * Generate database record
   */
  static createDatabaseRecord(tableName: string, overrides: any = {}) {
    const baseRecord = {
      id: faker.string.uuid(),
      created_at: faker.date.past().toISOString(),
      updated_at: faker.date.recent().toISOString(),
    };

    switch (tableName) {
      case 'video_jobs':
        return { ...baseRecord, ...this.createVideoJob(), ...overrides };
      case 'users':
        return { ...baseRecord, ...this.createUser(), ...overrides };
      default:
        return { ...baseRecord, ...overrides };
    }
  }

  /**
   * Generate performance test data
   */
  static createPerformanceTestData() {
    return {
      smallJob: this.createVideoCreateRequest({
        elements: [this.createImageElement()],
      }),
      mediumJob: this.createVideoCreateRequest({
        elements: [
          this.createVideoElement(),
          this.createImageElement(),
          this.createImageElement(),
        ],
      }),
      largeJob: this.createVideoCreateRequest({
        elements: Array.from({ length: 10 }, (_, i) =>
          i % 2 === 0 ? this.createVideoElement({ track: i + 1 }) : this.createImageElement({ track: i + 1 })
        ),
      }),
    };
  }

  /**
   * Generate load test scenarios
   */
  static createLoadTestScenarios() {
    return {
      lightLoad: Array.from({ length: 10 }, () => this.createVideoCreateRequest()),
      mediumLoad: Array.from({ length: 50 }, () => this.createVideoCreateRequest()),
      heavyLoad: Array.from({ length: 100 }, () => this.createVideoCreateRequest()),
      stressLoad: Array.from({ length: 500 }, () => this.createVideoCreateRequest()),
    };
  }

  /**
   * Generate error scenarios
   */
  static createErrorScenarios() {
    return {
      invalidFormat: this.createVideoCreateRequest({
        output_format: 'invalid_format',
      }),
      missingElements: this.createVideoCreateRequest({
        elements: [],
      }),
      invalidDimensions: this.createVideoCreateRequest({
        width: -1,
        height: 0,
      }),
      invalidElement: this.createVideoCreateRequest({
        elements: [
          {
            id: 'invalid',
            type: 'invalid_type',
            source: 'not_a_url',
          },
        ],
      }),
      tooManyElements: this.createVideoCreateRequest({
        elements: Array.from({ length: 50 }, (_, i) => this.createVideoElement({ track: i + 1 })),
      }),
    };
  }

  /**
   * Generate mock file data
   */
  static createMockFile(options: {
    filename?: string;
    mimetype?: string;
    size?: number;
    buffer?: Buffer;
  } = {}) {
    const {
      filename = faker.system.fileName({ extension: 'mp4' }),
      mimetype = 'video/mp4',
      size = faker.number.int({ min: 1024, max: 10485760 }), // 1KB to 10MB
      buffer = Buffer.alloc(size, 'test-data'),
    } = options;

    return {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype,
      size,
      buffer,
      destination: '/tmp',
      filename,
      path: `/tmp/${filename}`,
    };
  }

  /**
   * Reset faker seed for consistent testing
   */
  static seedFaker(seed: number = 12345) {
    faker.seed(seed);
  }

  /**
   * Generate test metrics data
   */
  static createMetricsData() {
    return {
      processing_time: faker.number.int({ min: 1000, max: 300000 }),
      file_size: faker.number.int({ min: 1024, max: 104857600 }),
      elements_count: faker.number.int({ min: 1, max: 10 }),
      output_format: faker.helpers.arrayElement(['mp4', 'mov', 'avi']),
      resolution: faker.helpers.arrayElement(['720p', '1080p', '4K']),
      success_rate: faker.number.float({ min: 0.8, max: 1.0, fractionDigits: 2 }),
      error_rate: faker.number.float({ min: 0.0, max: 0.2, fractionDigits: 2 }),
      average_processing_time: faker.number.int({ min: 5000, max: 30000 }),
      peak_processing_time: faker.number.int({ min: 30000, max: 600000 }),
      concurrent_jobs: faker.number.int({ min: 1, max: 100 }),
      queue_length: faker.number.int({ min: 0, max: 50 }),
      memory_usage: faker.number.int({ min: 100, max: 2048 }), // MB
      cpu_usage: faker.number.float({ min: 10, max: 100, fractionDigits: 1 }), // %
    };
  }
}

// Export commonly used factory methods for convenience
export const createVideoJob = TestDataFactory.createVideoJob.bind(TestDataFactory);
export const createVideoElement = TestDataFactory.createVideoElement.bind(TestDataFactory);
export const createImageElement = TestDataFactory.createImageElement.bind(TestDataFactory);
export const createUser = TestDataFactory.createUser.bind(TestDataFactory);
export const createVideoCreateRequest = TestDataFactory.createVideoCreateRequest.bind(TestDataFactory);
