/**
 * API Service for Dynamic Video Content Generation Platform
 * Handles all API communications and dual response processing
 */

import {
  VideoCreateRequest,
  VideoProcessingResponse,
  JobStatusResponse,
  ImmediateResponse,
  AsyncResponse,
  ProcessingError,
  RetryConfig,
  PollingConfig,
  RETRY_CONFIG,
  POLLING_CONFIG,
  ERROR_MESSAGES,
} from '../types/api';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_VERSION = 'v1';

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sleep utility for delays
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate retry delay with exponential backoff
 */
const calculateRetryDelay = (
  attempt: number, 
  config: RetryConfig = RETRY_CONFIG
): number => {
  const delay = Math.min(
    config.initialDelay * Math.pow(config.backoffFactor, attempt - 1),
    config.maxDelay
  );
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
};

/**
 * Check if error is retryable
 */
const isRetryableError = (
  error: any, 
  config: RetryConfig = RETRY_CONFIG
): boolean => {
  if (error instanceof ApiError) {
    return config.retryableStatuses.includes(error.statusCode.toString());
  }
  
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true; // Network error
  }
  
  return config.retryableStatuses.some(status => 
    error.message?.toLowerCase().includes(status.toLowerCase())
  );
};

/**
 * Create processing error from API response
 */
const createProcessingError = (
  error: any,
  type: ProcessingError['type'] = 'processing'
): ProcessingError => {
  let message = ERROR_MESSAGES.UNKNOWN_ERROR;
  let recoverable = false;
  let retryAfter: number | undefined;

  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 400:
        message = ERROR_MESSAGES.VALIDATION_ERROR;
        type = 'validation';
        break;
      case 408:
      case 504:
        message = ERROR_MESSAGES.TIMEOUT_ERROR;
        type = 'timeout';
        recoverable = true;
        retryAfter = 30;
        break;
      case 429:
        message = 'Too many requests. Please wait before trying again.';
        type = 'resource';
        recoverable = true;
        retryAfter = 60;
        break;
      case 500:
      case 502:
      case 503:
        message = 'Server error. Please try again.';
        recoverable = true;
        retryAfter = 10;
        break;
      default:
        message = error.message || ERROR_MESSAGES.UNKNOWN_ERROR;
    }
  } else if (error.name === 'TypeError') {
    message = ERROR_MESSAGES.NETWORK_ERROR;
    type = 'network';
    recoverable = true;
    retryAfter = 5;
  }

  return {
    type,
    message,
    details: error.details || error.message,
    recoverable,
    retry_after: retryAfter,
    suggested_action: recoverable 
      ? 'Click retry to attempt processing again'
      : 'Please check your input and try again',
  };
};

// ============================================================================
// HTTP CLIENT
// ============================================================================

/**
 * Enhanced fetch with retry logic and error handling
 */
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retryConfig: RetryConfig = RETRY_CONFIG
): Promise<Response> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      // If response is ok or not retryable, return it
      if (response.ok || !isRetryableError({ statusCode: response.status }, retryConfig)) {
        return response;
      }

      // Create error for potential retry
      const errorText = await response.text();
      lastError = new ApiError(
        errorText || `HTTP ${response.status}`,
        response.status
      );

    } catch (error) {
      lastError = error;
    }

    // If this was the last attempt, throw the error
    if (attempt > retryConfig.maxRetries) {
      break;
    }

    // Only retry if error is retryable
    if (!isRetryableError(lastError, retryConfig)) {
      break;
    }

    // Wait before retrying
    const delay = calculateRetryDelay(attempt, retryConfig);
    console.log(`API request failed (attempt ${attempt}), retrying in ${delay}ms...`);
    await sleep(delay);
  }

  throw lastError;
};

/**
 * Parse API response with error handling
 */
const parseApiResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    let errorDetails: any;

    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.message || errorData.error || errorMessage;
      errorDetails = errorData;
    } catch {
      errorMessage = text || errorMessage;
    }

    throw new ApiError(errorMessage, response.status, errorDetails);
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ApiError('Invalid JSON response', response.status, { originalText: text });
  }
};

// ============================================================================
// API SERVICE CLASS
// ============================================================================

export class VideoApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = `${baseUrl}/api/${API_VERSION}`;
  }

  /**
   * Submit video creation request with dual response handling
   */
  async createVideo(request: VideoCreateRequest): Promise<VideoProcessingResponse> {
    const url = `${this.baseUrl}/videocreate`;
    
    try {
      const response = await fetchWithRetry(url, {
        method: 'POST',
        body: JSON.stringify(request),
      });

      const data = await parseApiResponse<VideoProcessingResponse>(response);
      
      // Validate response type
      if (data.status === 'completed') {
        const immediateResponse = data as ImmediateResponse;
        if (!immediateResponse.result_url || !immediateResponse.job_id) {
          throw new ApiError('Invalid immediate response format', 200);
        }
      } else if (data.status === 'processing') {
        const asyncResponse = data as AsyncResponse;
        if (!asyncResponse.job_id || !asyncResponse.status_check_endpoint) {
          throw new ApiError('Invalid async response format', 200);
        }
      } else {
        throw new ApiError('Invalid response status', 200);
      }

      return data;
    } catch (error) {
      console.error('Video creation failed:', error);
      throw createProcessingError(error, 'processing');
    }
  }

  /**
   * Get job status with polling support
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const url = `${this.baseUrl}/videoresult/${jobId}`;
    
    try {
      const response = await fetchWithRetry(url, {
        method: 'GET',
      });

      const data = await parseApiResponse<JobStatusResponse>(response);
      
      // Validate response
      if (!data.job_id || !data.status) {
        throw new ApiError('Invalid job status response format', 200);
      }

      return data;
    } catch (error) {
      console.error('Job status fetch failed:', error);
      throw createProcessingError(error, 'network');
    }
  }

  /**
   * Poll job status until completion or timeout
   */
  async pollJobStatus(
    jobId: string,
    onUpdate?: (status: JobStatusResponse) => void,
    config: PollingConfig = POLLING_CONFIG
  ): Promise<JobStatusResponse> {
    const startTime = Date.now();
    let interval = config.interval;
    let attempts = 0;

    while (Date.now() - startTime < config.maxDuration) {
      attempts++;
      
      try {
        const status = await this.getJobStatus(jobId);
        
        // Notify callback of update
        onUpdate?.(status);

        // Check if job is complete
        if (status.status === 'completed' || status.status === 'failed') {
          return status;
        }

        // Wait before next poll
        await sleep(interval);
        
        // Increase interval with backoff (but cap at maxInterval)
        interval = Math.min(
          interval * config.backoffMultiplier,
          config.maxInterval
        );

      } catch (error) {
        console.warn(`Polling attempt ${attempts} failed:`, error);
        
        // If we can't get status, wait a bit and try again
        await sleep(Math.min(interval, 5000));
        
        // Don't increase interval on errors to retry quickly
      }
    }

    throw createProcessingError(
      new Error('Polling timeout exceeded'),
      'timeout'
    );
  }

  /**
   * Cancel a processing job
   */
  async cancelJob(jobId: string): Promise<void> {
    const url = `${this.baseUrl}/videoresult/${jobId}/cancel`;
    
    try {
      const response = await fetchWithRetry(url, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new ApiError(`Failed to cancel job`, response.status);
      }
    } catch (error) {
      console.error('Job cancellation failed:', error);
      throw createProcessingError(error, 'network');
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<VideoProcessingResponse> {
    const url = `${this.baseUrl}/videoresult/${jobId}/retry`;
    
    try {
      const response = await fetchWithRetry(url, {
        method: 'POST',
      });

      return await parseApiResponse<VideoProcessingResponse>(response);
    } catch (error) {
      console.error('Job retry failed:', error);
      throw createProcessingError(error, 'processing');
    }
  }

  /**
   * Get processing timeline for a job
   */
  async getProcessingTimeline(jobId: string) {
    const url = `${this.baseUrl}/videoresult/${jobId}/timeline`;
    
    try {
      const response = await fetchWithRetry(url, {
        method: 'GET',
      });

      return await parseApiResponse(response);
    } catch (error) {
      console.error('Timeline fetch failed:', error);
      throw createProcessingError(error, 'network');
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck() {
    const url = `${this.baseUrl.replace(`/api/${API_VERSION}`, '')}/health`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      return await parseApiResponse(response);
    } catch (error) {
      console.error('Health check failed:', error);
      return { ok: false, error: error.message };
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const videoApiService = new VideoApiService();

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export {
  ApiError,
  createProcessingError,
  isRetryableError,
  calculateRetryDelay,
};

export type { ProcessingError };