const { config } = require('dotenv');
const path = require('path');

// Load test environment variables
config({ path: path.join(__dirname, '../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

// Test database configuration
process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || 'test-service-key';

// Test S3 configuration
process.env.AWS_REGION = process.env.AWS_TEST_REGION || 'us-east-1';
process.env.AWS_S3_BUCKET = process.env.AWS_TEST_S3_BUCKET || 'test-video-bucket';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_TEST_ACCESS_KEY_ID || 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_TEST_SECRET_ACCESS_KEY || 'test-secret-key';

// Test Redis configuration
process.env.REDIS_URL = process.env.REDIS_TEST_URL || 'redis://localhost:6379/1';

// Test application configuration
process.env.PORT = '3001';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters!';
process.env.API_RATE_LIMIT = '1000';
process.env.FILE_SIZE_LIMIT = '104857600'; // 100MB
process.env.VIDEO_PROCESSING_TIMEOUT = '300000'; // 5 minutes

// Mock external services
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/lib-storage');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('@supabase/supabase-js');
jest.mock('ioredis');
jest.mock('fluent-ffmpeg');

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    ...jest.requireActual('fs').promises,
    unlink: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ size: 1024 }),
    readdir: jest.fn().mockResolvedValue([]),
    rmdir: jest.fn().mockResolvedValue(undefined),
  },
  existsSync: jest.fn().mockReturnValue(true),
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
  }),
  createReadStream: jest.fn().mockReturnValue({
    pipe: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
  }),
}));

// Mock child_process for FFmpeg
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    stdout: {
      on: jest.fn(),
      pipe: jest.fn(),
    },
    stderr: {
      on: jest.fn(),
    },
    on: jest.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 100);
      }
    }),
    kill: jest.fn(),
  }),
  exec: jest.fn((command, callback) => {
    callback(null, 'ffmpeg version 4.4.0', '');
  }),
}));

// Mock crypto for deterministic testing
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid-12345'),
  randomBytes: jest.fn(() => Buffer.from('test-random-bytes')),
}));

// Global test utilities
global.testUtils = {
  // Wait for a specified amount of time
  wait: ms => new Promise(resolve => setTimeout(resolve, ms)),

  // Create test file buffer
  createTestBuffer: (size = 1024) => Buffer.alloc(size, 'test-data'),

  // Mock request object
  mockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    file: null,
    files: [],
    user: null,
    ...overrides,
  }),

  // Mock response object
  mockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      attachment: jest.fn().mockReturnThis(),
      locals: {},
    };
    return res;
  },

  // Mock next function
  mockNext: () => jest.fn(),

  // Create test video element
  createTestVideoElement: (overrides = {}) => ({
    id: 'test-element-1',
    type: 'video',
    source: 'https://test-bucket.s3.amazonaws.com/test-video.mp4',
    track: 1,
    x: '0%',
    y: '0%',
    width: '100%',
    height: '100%',
    fit_mode: 'contain',
    start_time: '0',
    duration: '10',
    ...overrides,
  }),

  // Create test image element
  createTestImageElement: (overrides = {}) => ({
    id: 'test-element-2',
    type: 'image',
    source: 'https://test-bucket.s3.amazonaws.com/test-image.jpg',
    track: 2,
    x: '10%',
    y: '10%',
    width: '80%',
    height: '80%',
    fit_mode: 'contain',
    duration: '5',
    ...overrides,
  }),

  // Create test job data
  createTestJob: (overrides = {}) => ({
    id: 'test-job-12345',
    status: 'pending',
    output_format: 'mp4',
    width: 1920,
    height: 1080,
    elements: [
      global.testUtils.createTestVideoElement(),
      global.testUtils.createTestImageElement(),
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),

  // Create test user
  createTestUser: (overrides = {}) => ({
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    created_at: new Date().toISOString(),
    ...overrides,
  }),
};

// Global test constants
global.testConstants = {
  TEST_VIDEO_URL: 'https://test-bucket.s3.amazonaws.com/test-video.mp4',
  TEST_IMAGE_URL: 'https://test-bucket.s3.amazonaws.com/test-image.jpg',
  TEST_BUCKET: 'test-video-bucket',
  TEST_REGION: 'us-east-1',
  TEST_JOB_ID: 'test-job-12345',
  TEST_USER_ID: 'test-user-123',
  TEST_FILE_SIZE: 1024 * 1024, // 1MB
  TEST_PROCESSING_TIMEOUT: 30000, // 30 seconds
};

// Console suppression for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();

  // Clean up any temp files or resources
  if (global.tempFiles) {
    global.tempFiles.forEach(file => {
      try {
        require('fs').unlinkSync(file);
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    });
    global.tempFiles = [];
  }
});

// Initialize temp files array
global.tempFiles = [];

// Mock implementations for common services
const mockS3Client = {
  send: jest.fn().mockResolvedValue({
    $metadata: { httpStatusCode: 200 },
    Location: 'https://test-bucket.s3.amazonaws.com/test-file.mp4',
    Key: 'test-file.mp4',
    Bucket: 'test-bucket',
  }),
};

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  channel: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
  unsubscribe: jest.fn().mockResolvedValue({ error: null }),
};

const mockRedisClient = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
  flushdb: jest.fn().mockResolvedValue('OK'),
  quit: jest.fn().mockResolvedValue('OK'),
  ping: jest.fn().mockResolvedValue('PONG'),
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
};

// Export mock implementations
global.mockImplementations = {
  s3Client: mockS3Client,
  supabaseClient: mockSupabaseClient,
  redisClient: mockRedisClient,
};

// Error simulation utilities
global.errorUtils = {
  networkError: new Error('Network connection failed'),
  timeoutError: new Error('Request timeout'),
  validationError: new Error('Validation failed'),
  notFoundError: new Error('Resource not found'),
  unauthorizedError: new Error('Unauthorized access'),
  serverError: new Error('Internal server error'),
  s3Error: new Error('S3 operation failed'),
  databaseError: new Error('Database operation failed'),
  ffmpegError: new Error('Video processing failed'),
};

// Test data generators
global.dataGenerators = {
  generateVideoJob: (count = 1) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-job-${i + 1}`,
      status: 'pending',
      output_format: 'mp4',
      width: 1920,
      height: 1080,
      elements: [
        {
          id: `element-${i + 1}-1`,
          type: 'video',
          source: `https://test-bucket.s3.amazonaws.com/video-${i + 1}.mp4`,
          track: 1,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  },

  generateUsers: (count = 1) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `user-${i + 1}`,
      email: `user${i + 1}@example.com`,
      name: `Test User ${i + 1}`,
      created_at: new Date().toISOString(),
    }));
  },
};

// Performance testing utilities
global.perfUtils = {
  measureTime: async fn => {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    return {
      result,
      duration: Number(end - start) / 1000000, // Convert to milliseconds
    };
  },

  measureMemory: fn => {
    const before = process.memoryUsage();
    const result = fn();
    const after = process.memoryUsage();
    return {
      result,
      heapUsed: after.heapUsed - before.heapUsed,
      heapTotal: after.heapTotal - before.heapTotal,
      external: after.external - before.external,
    };
  },
};

// Database testing utilities
global.dbUtils = {
  cleanDatabase: jest.fn().mockResolvedValue(undefined),
  seedDatabase: jest.fn().mockResolvedValue(undefined),
  createTestData: jest.fn().mockResolvedValue(undefined),
};

console.log('Jest setup completed successfully');
