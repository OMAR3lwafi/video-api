/**
 * Mock Service Worker (MSW) request handlers
 * Provides comprehensive API mocking for frontend tests
 */

import { http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker';

// Mock data generators
const createMockVideoJob = (overrides: any = {}) => ({
  id: faker.string.uuid(),
  status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
  output_format: faker.helpers.arrayElement(['mp4', 'mov', 'avi']),
  width: faker.helpers.arrayElement([1280, 1920, 3840]),
  height: faker.helpers.arrayElement([720, 1080, 2160]),
  elements: [
    {
      id: faker.string.uuid(),
      type: 'video',
      source: `https://test-bucket.s3.amazonaws.com/${faker.system.fileName({ extension: 'mp4' })}`,
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
      id: faker.string.uuid(),
      type: 'image',
      source: `https://test-bucket.s3.amazonaws.com/${faker.system.fileName({ extension: 'jpg' })}`,
      track: 2,
      x: '10%',
      y: '10%',
      width: '80%',
      height: '80%',
      fit_mode: 'contain',
      duration: '5',
    },
  ],
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
});

const createMockUser = (overrides: any = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  ...overrides,
});

// Mock database for persistent data during tests
let mockJobs: any[] = [];
let mockUsers: any[] = [];

// Initialize with some default data
const initializeMockData = () => {
  mockUsers = [
    createMockUser({ id: 'user-1', email: 'john@example.com', name: 'John Doe' }),
    createMockUser({ id: 'user-2', email: 'jane@example.com', name: 'Jane Smith' }),
  ];

  mockJobs = [
    createMockVideoJob({
      id: 'job-1',
      user_id: 'user-1',
      status: 'completed',
      result_url: 'https://test-bucket.s3.amazonaws.com/completed-video.mp4',
      processing_time: '25000',
      file_size: '15.2MB',
      progress: 100,
      current_step: 'completed',
    }),
    createMockVideoJob({
      id: 'job-2',
      user_id: 'user-1',
      status: 'processing',
      progress: 45,
      current_step: 'encoding',
      estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }),
    createMockVideoJob({
      id: 'job-3',
      user_id: 'user-2',
      status: 'failed',
      error_message: 'FFmpeg processing failed: Invalid codec parameters',
      progress: 75,
      current_step: 'encoding',
    }),
    createMockVideoJob({
      id: 'job-4',
      user_id: 'user-2',
      status: 'pending',
      progress: 0,
    }),
  ];
};

// Initialize mock data
initializeMockData();

export const handlers = [
  // Health check endpoint
  http.get('/api/health', () => {
    return HttpResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'healthy',
        s3: 'healthy',
        ffmpeg: 'healthy',
      },
    });
  }),

  // Create video job (POST /api/v1/videocreate)
  http.post('/api/v1/videocreate', async ({ request }) => {
    const body = await request.json() as any;

    // Validate request body
    if (!body.output_format || !body.width || !body.height || !body.elements) {
      return HttpResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.elements) || body.elements.length === 0) {
      return HttpResponse.json(
        { error: 'Elements array cannot be empty' },
        { status: 400 }
      );
    }

    if (body.elements.length > 10) {
      return HttpResponse.json(
        { error: 'Too many elements. Maximum 10 allowed.' },
        { status: 400 }
      );
    }

    // Create new job
    const newJob = createMockVideoJob({
      id: `job-${Date.now()}`,
      status: 'pending',
      output_format: body.output_format,
      width: body.width,
      height: body.height,
      elements: body.elements,
      user_id: body.user_id || 'user-1',
    });

    // Simulate processing time estimation
    const estimatedTime = body.elements.length * 5000 + body.width * body.height * 0.001;

    if (estimatedTime <= 30000) {
      // Quick processing - return immediate result
      const completedJob = {
        ...newJob,
        status: 'completed',
        result_url: `https://test-bucket.s3.amazonaws.com/output-${newJob.id}.mp4`,
        processing_time: estimatedTime.toString(),
        file_size: `${(estimatedTime / 1000 * 0.5).toFixed(1)}MB`,
        progress: 100,
        current_step: 'completed',
      };

      mockJobs.push(completedJob);

      return HttpResponse.json({
        status: 'completed',
        processing_time: estimatedTime.toString(),
        result_url: completedJob.result_url,
        job_id: completedJob.id,
        file_size: completedJob.file_size,
        message: 'Video processing completed successfully',
      });
    } else {
      // Long processing - return async response
      const processingJob = {
        ...newJob,
        status: 'processing',
        progress: 0,
        current_step: 'validation',
        estimated_completion: new Date(Date.now() + estimatedTime).toISOString(),
      };

      mockJobs.push(processingJob);

      return HttpResponse.json({
        status: 'processing',
        job_id: processingJob.id,
        message: 'Video processing started',
        estimated_completion: processingJob.estimated_completion,
        status_check_endpoint: `/api/v1/videoresult/${processingJob.id}`,
      }, { status: 202 });
    }
  }),

  // Get video job result (GET /api/v1/videoresult/:jobId)
  http.get('/api/v1/videoresult/:jobId', ({ params }) => {
    const jobId = params.jobId as string;
    const job = mockJobs.find(j => j.id === jobId);

    if (!job) {
      return HttpResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const response: any = {
      status: job.status,
      job_id: job.id,
      message: `Job is ${job.status}`,
    };

    if (job.status === 'processing') {
      response.progress = job.progress;
      response.current_step = job.current_step;
      response.estimated_completion = job.estimated_completion;
    }

    if (job.status === 'completed') {
      response.result_url = job.result_url;
      response.file_size = job.file_size;
      response.processing_time = job.processing_time;
      response.duration = '30s';
    }

    if (job.status === 'failed') {
      response.error = job.error_message;
      response.progress = job.progress;
      response.current_step = job.current_step;
    }

    return HttpResponse.json(response);
  }),

  // Delete video job (DELETE /api/v1/videojob/:jobId)
  http.delete('/api/v1/videojob/:jobId', ({ params }) => {
    const jobId = params.jobId as string;
    const jobIndex = mockJobs.findIndex(j => j.id === jobId);

    if (jobIndex === -1) {
      return HttpResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    mockJobs.splice(jobIndex, 1);

    return HttpResponse.json({
      success: true,
      message: 'Job deleted successfully',
    });
  }),

  // Get user jobs (GET /api/v1/user/:userId/jobs)
  http.get('/api/v1/user/:userId/jobs', ({ params, request }) => {
    const userId = params.userId as string;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status');

    let userJobs = mockJobs.filter(job => job.user_id === userId);

    if (status) {
      userJobs = userJobs.filter(job => job.status === status);
    }

    // Sort by created_at descending
    userJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedJobs = userJobs.slice(startIndex, endIndex);

    return HttpResponse.json({
      jobs: paginatedJobs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(userJobs.length / limit),
        totalItems: userJobs.length,
        itemsPerPage: limit,
        hasNext: endIndex < userJobs.length,
        hasPrev: page > 1,
      },
    });
  }),

  // Get user profile (GET /api/v1/user/:userId)
  http.get('/api/v1/user/:userId', ({ params }) => {
    const userId = params.userId as string;
    const user = mockUsers.find(u => u.id === userId);

    if (!user) {
      return HttpResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json(user);
  }),

  // Update user profile (PUT /api/v1/user/:userId)
  http.put('/api/v1/user/:userId', async ({ params, request }) => {
    const userId = params.userId as string;
    const body = await request.json() as any;
    const userIndex = mockUsers.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      return HttpResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    mockUsers[userIndex] = {
      ...mockUsers[userIndex],
      ...body,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(mockUsers[userIndex]);
  }),

  // Get job statistics (GET /api/v1/stats/jobs)
  http.get('/api/v1/stats/jobs', ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    let jobs = mockJobs;
    if (userId) {
      jobs = jobs.filter(job => job.user_id === userId);
    }

    const stats = {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      avgProcessingTime: jobs
        .filter(j => j.processing_time)
        .reduce((acc, j) => acc + parseInt(j.processing_time), 0) /
        jobs.filter(j => j.processing_time).length || 0,
      totalProcessingTime: jobs
        .filter(j => j.processing_time)
        .reduce((acc, j) => acc + parseInt(j.processing_time), 0),
    };

    return HttpResponse.json(stats);
  }),

  // Upload file endpoint (POST /api/v1/upload)
  http.post('/api/v1/upload', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return HttpResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return HttpResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      );
    }

    // Validate file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      return HttpResponse.json(
        { error: 'File size too large' },
        { status: 400 }
      );
    }

    // Mock successful upload
    const uploadResult = {
      success: true,
      url: `https://test-bucket.s3.amazonaws.com/uploads/${Date.now()}-${file.name}`,
      key: `uploads/${Date.now()}-${file.name}`,
      size: file.size,
      type: file.type,
      uploadId: faker.string.uuid(),
    };

    return HttpResponse.json(uploadResult);
  }),

  // Get presigned URL (GET /api/v1/upload/presigned)
  http.get('/api/v1/upload/presigned', ({ request }) => {
    const url = new URL(request.url);
    const fileName = url.searchParams.get('fileName');
    const fileType = url.searchParams.get('fileType');

    if (!fileName || !fileType) {
      return HttpResponse.json(
        { error: 'fileName and fileType are required' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      uploadUrl: `https://test-bucket.s3.amazonaws.com/${fileName}?presigned=true`,
      key: `uploads/${fileName}`,
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    });
  }),

  // WebSocket simulation for real-time updates
  http.get('/api/v1/jobs/:jobId/stream', ({ params }) => {
    const jobId = params.jobId as string;

    // This would normally establish a WebSocket connection
    // For testing, we can simulate the connection response
    return HttpResponse.json({
      success: true,
      endpoint: `ws://localhost:3000/api/v1/jobs/${jobId}/stream`,
      protocols: ['job-updates'],
    });
  }),

  // Error simulation endpoints for testing error handling
  http.get('/api/v1/test/error/:statusCode', ({ params }) => {
    const statusCode = parseInt(params.statusCode as string);

    const errorMessages: Record<number, string> = {
      400: 'Bad Request - Invalid parameters',
      401: 'Unauthorized - Authentication required',
      403: 'Forbidden - Access denied',
      404: 'Not Found - Resource not found',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Something went wrong',
      502: 'Bad Gateway - Upstream server error',
      503: 'Service Unavailable - Server temporarily unavailable',
    };

    return HttpResponse.json(
      {
        error: errorMessages[statusCode] || 'Unknown error',
        code: statusCode,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }),

  // Slow response simulation for testing loading states
  http.get('/api/v1/test/slow/:delay', async ({ params }) => {
    const delay = parseInt(params.delay as string) || 1000;

    await new Promise(resolve => setTimeout(resolve, delay));

    return HttpResponse.json({
      message: `Response delayed by ${delay}ms`,
      timestamp: new Date().toISOString(),
    });
  }),

  // Reset mock data for testing
  http.post('/api/v1/test/reset', () => {
    initializeMockData();
    return HttpResponse.json({
      success: true,
      message: 'Mock data reset successfully',
    });
  }),

  // Fallback handler for unmatched requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);

    return HttpResponse.json(
      {
        error: 'Not Found',
        message: `No handler found for ${request.method} ${request.url}`,
      },
      { status: 404 }
    );
  }),
];

// Export utilities for test manipulation
export const testUtils = {
  // Get current mock data
  getMockJobs: () => [...mockJobs],
  getMockUsers: () => [...mockUsers],

  // Add mock data
  addMockJob: (job: any) => mockJobs.push(job),
  addMockUser: (user: any) => mockUsers.push(user),

  // Update mock data
  updateMockJob: (jobId: string, updates: any) => {
    const index = mockJobs.findIndex(j => j.id === jobId);
    if (index !== -1) {
      mockJobs[index] = { ...mockJobs[index], ...updates };
    }
  },

  // Clear mock data
  clearMockData: () => {
    mockJobs = [];
    mockUsers = [];
  },

  // Reset to default mock data
  resetMockData: initializeMockData,

  // Simulate job progress
  simulateJobProgress: (jobId: string, progress: number, currentStep?: string) => {
    const job = mockJobs.find(j => j.id === jobId);
    if (job && job.status === 'processing') {
      job.progress = progress;
      if (currentStep) job.current_step = currentStep;

      if (progress >= 100) {
        job.status = 'completed';
        job.result_url = `https://test-bucket.s3.amazonaws.com/output-${jobId}.mp4`;
        job.processing_time = '25000';
        job.file_size = '15.2MB';
        job.current_step = 'completed';
      }
    }
  },

  // Simulate job failure
  simulateJobFailure: (jobId: string, errorMessage: string) => {
    const job = mockJobs.find(j => j.id === jobId);
    if (job) {
      job.status = 'failed';
      job.error_message = errorMessage;
    }
  },
};
