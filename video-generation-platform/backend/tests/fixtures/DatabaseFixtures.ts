import { TestDataFactory } from '../factories/TestDataFactory';
import { VideoJob, User, VideoElement } from '@/types';

/**
 * Database Test Fixtures
 * Provides consistent test data for database operations
 */
export class DatabaseFixtures {
  /**
   * Sample users for testing
   */
  static readonly users: User[] = [
    {
      id: 'user-1',
      email: 'john.doe@example.com',
      name: 'John Doe',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'user-2',
      email: 'jane.smith@example.com',
      name: 'Jane Smith',
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'user-3',
      email: 'admin@example.com',
      name: 'Admin User',
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
    },
  ];

  /**
   * Sample video elements for testing
   */
  static readonly videoElements: VideoElement[] = [
    {
      id: 'element-1',
      type: 'video',
      source: 'https://test-bucket.s3.amazonaws.com/sample-video-1.mp4',
      track: 1,
      x: '0%',
      y: '0%',
      width: '100%',
      height: '100%',
      fit_mode: 'contain',
      start_time: '0',
      duration: '30',
    },
    {
      id: 'element-2',
      type: 'image',
      source: 'https://test-bucket.s3.amazonaws.com/sample-image-1.jpg',
      track: 2,
      x: '10%',
      y: '10%',
      width: '80%',
      height: '80%',
      fit_mode: 'contain',
      duration: '5',
    },
    {
      id: 'element-3',
      type: 'video',
      source: 'https://test-bucket.s3.amazonaws.com/sample-video-2.mp4',
      track: 3,
      x: '20%',
      y: '20%',
      width: '60%',
      height: '60%',
      fit_mode: 'cover',
      start_time: '5',
      duration: '15',
    },
  ];

  /**
   * Sample video jobs for testing
   */
  static readonly videoJobs: VideoJob[] = [
    {
      id: 'job-1',
      user_id: 'user-1',
      status: 'pending',
      output_format: 'mp4',
      width: 1920,
      height: 1080,
      elements: [this.videoElements[0], this.videoElements[1]],
      result_url: null,
      error_message: null,
      processing_time: null,
      file_size: null,
      progress: 0,
      current_step: null,
      estimated_completion: null,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 'job-2',
      user_id: 'user-1',
      status: 'processing',
      output_format: 'mp4',
      width: 1920,
      height: 1080,
      elements: [this.videoElements[0]],
      result_url: null,
      error_message: null,
      processing_time: null,
      file_size: null,
      progress: 45,
      current_step: 'encoding',
      estimated_completion: '2024-01-01T10:15:00Z',
      created_at: '2024-01-01T10:05:00Z',
      updated_at: '2024-01-01T10:10:00Z',
    },
    {
      id: 'job-3',
      user_id: 'user-2',
      status: 'completed',
      output_format: 'mp4',
      width: 1280,
      height: 720,
      elements: [this.videoElements[1], this.videoElements[2]],
      result_url: 'https://test-bucket.s3.amazonaws.com/completed-video-1.mp4',
      error_message: null,
      processing_time: '25000',
      file_size: '15.2MB',
      progress: 100,
      current_step: 'completed',
      estimated_completion: null,
      created_at: '2024-01-01T09:00:00Z',
      updated_at: '2024-01-01T09:25:00Z',
    },
    {
      id: 'job-4',
      user_id: 'user-2',
      status: 'failed',
      output_format: 'avi',
      width: 1920,
      height: 1080,
      elements: [this.videoElements[0], this.videoElements[1], this.videoElements[2]],
      result_url: null,
      error_message: 'FFmpeg processing failed: Invalid codec parameters',
      processing_time: null,
      file_size: null,
      progress: 75,
      current_step: 'encoding',
      estimated_completion: null,
      created_at: '2024-01-01T08:00:00Z',
      updated_at: '2024-01-01T08:20:00Z',
    },
  ];

  /**
   * Database schema for testing
   */
  static readonly schema = {
    users: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    video_jobs: `
      CREATE TABLE IF NOT EXISTS video_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        output_format VARCHAR(10) NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        elements JSONB NOT NULL,
        result_url TEXT,
        error_message TEXT,
        processing_time VARCHAR(50),
        file_size VARCHAR(50),
        progress INTEGER DEFAULT 0,
        current_step VARCHAR(100),
        estimated_completion TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    video_metrics: `
      CREATE TABLE IF NOT EXISTS video_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID REFERENCES video_jobs(id),
        metric_type VARCHAR(100) NOT NULL,
        metric_value NUMERIC NOT NULL,
        metric_unit VARCHAR(50),
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    user_sessions: `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        session_token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  };

  /**
   * Sample metrics data
   */
  static readonly metrics = [
    {
      id: 'metric-1',
      job_id: 'job-3',
      metric_type: 'processing_time',
      metric_value: 25000,
      metric_unit: 'milliseconds',
      recorded_at: '2024-01-01T09:25:00Z',
    },
    {
      id: 'metric-2',
      job_id: 'job-3',
      metric_type: 'file_size',
      metric_value: 15943680,
      metric_unit: 'bytes',
      recorded_at: '2024-01-01T09:25:00Z',
    },
    {
      id: 'metric-3',
      job_id: 'job-3',
      metric_type: 'elements_count',
      metric_value: 2,
      metric_unit: 'count',
      recorded_at: '2024-01-01T09:25:00Z',
    },
  ];

  /**
   * Sample user sessions
   */
  static readonly sessions = [
    {
      id: 'session-1',
      user_id: 'user-1',
      session_token: 'test-session-token-1',
      expires_at: '2024-01-02T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'session-2',
      user_id: 'user-2',
      session_token: 'test-session-token-2',
      expires_at: '2024-01-02T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
    },
  ];

  /**
   * Create test database with sample data
   */
  static async seedTestDatabase(client: any): Promise<void> {
    // Create tables
    for (const [tableName, createStatement] of Object.entries(this.schema)) {
      await client.query(createStatement);
    }

    // Insert users
    for (const user of this.users) {
      await client.query(
        'INSERT INTO users (id, email, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [user.id, user.email, user.name, user.created_at, user.updated_at]
      );
    }

    // Insert video jobs
    for (const job of this.videoJobs) {
      await client.query(
        `INSERT INTO video_jobs
         (id, user_id, status, output_format, width, height, elements, result_url, error_message,
          processing_time, file_size, progress, current_step, estimated_completion, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO NOTHING`,
        [
          job.id, job.user_id, job.status, job.output_format, job.width, job.height,
          JSON.stringify(job.elements), job.result_url, job.error_message,
          job.processing_time, job.file_size, job.progress, job.current_step,
          job.estimated_completion, job.created_at, job.updated_at
        ]
      );
    }

    // Insert metrics
    for (const metric of this.metrics) {
      await client.query(
        'INSERT INTO video_metrics (id, job_id, metric_type, metric_value, metric_unit, recorded_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [metric.id, metric.job_id, metric.metric_type, metric.metric_value, metric.metric_unit, metric.recorded_at]
      );
    }

    // Insert sessions
    for (const session of this.sessions) {
      await client.query(
        'INSERT INTO user_sessions (id, user_id, session_token, expires_at, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [session.id, session.user_id, session.session_token, session.expires_at, session.created_at]
      );
    }
  }

  /**
   * Clean test database
   */
  static async cleanTestDatabase(client: any): Promise<void> {
    const tables = ['user_sessions', 'video_metrics', 'video_jobs', 'users'];

    for (const table of tables) {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);
    }
  }

  /**
   * Drop test database tables
   */
  static async dropTestDatabase(client: any): Promise<void> {
    const tables = ['user_sessions', 'video_metrics', 'video_jobs', 'users'];

    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
  }

  /**
   * Get user by ID
   */
  static getUserById(id: string): User | undefined {
    return this.users.find(user => user.id === id);
  }

  /**
   * Get job by ID
   */
  static getJobById(id: string): VideoJob | undefined {
    return this.videoJobs.find(job => job.id === id);
  }

  /**
   * Get jobs by user ID
   */
  static getJobsByUserId(userId: string): VideoJob[] {
    return this.videoJobs.filter(job => job.user_id === userId);
  }

  /**
   * Get jobs by status
   */
  static getJobsByStatus(status: string): VideoJob[] {
    return this.videoJobs.filter(job => job.status === status);
  }

  /**
   * Generate dynamic test data
   */
  static generateTestData(count: number = 10) {
    const users = TestDataFactory.createUsers(count);
    const jobs = TestDataFactory.createVideoJobs(count * 2);

    // Assign jobs to users
    jobs.forEach((job, index) => {
      job.user_id = users[index % users.length].id;
    });

    return { users, jobs };
  }

  /**
   * Create test scenarios
   */
  static getTestScenarios() {
    return {
      emptyDatabase: [],
      singleUser: [this.users[0]],
      multipleUsers: this.users,
      pendingJobs: this.getJobsByStatus('pending'),
      completedJobs: this.getJobsByStatus('completed'),
      failedJobs: this.getJobsByStatus('failed'),
      userWithJobs: {
        user: this.users[0],
        jobs: this.getJobsByUserId('user-1'),
      },
    };
  }

  /**
   * Mock database responses
   */
  static getMockResponses() {
    return {
      selectUsers: { data: this.users, error: null },
      selectUserById: { data: this.users[0], error: null },
      insertUser: { data: [this.users[0]], error: null },
      updateUser: { data: [{ ...this.users[0], updated_at: new Date().toISOString() }], error: null },
      deleteUser: { data: [], error: null },

      selectJobs: { data: this.videoJobs, error: null },
      selectJobById: { data: this.videoJobs[0], error: null },
      insertJob: { data: [this.videoJobs[0]], error: null },
      updateJob: { data: [{ ...this.videoJobs[0], updated_at: new Date().toISOString() }], error: null },
      deleteJob: { data: [], error: null },

      databaseError: { data: null, error: new Error('Database connection failed') },
      notFound: { data: null, error: null },
      duplicateKey: { data: null, error: new Error('Duplicate key violation') },
    };
  }
}

// Export commonly used fixtures
export const testUsers = DatabaseFixtures.users;
export const testJobs = DatabaseFixtures.videoJobs;
export const testElements = DatabaseFixtures.videoElements;
export const testMetrics = DatabaseFixtures.metrics;
export const testSessions = DatabaseFixtures.sessions;
