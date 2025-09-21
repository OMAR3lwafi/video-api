/**
 * Core API Client with error handling and retry logic
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { env } from '@/config/env'
import type { ApiResponse, ErrorResponse } from '@/types'

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Request configuration interface
 */
interface RequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean
  skipRetry?: boolean
  timeout?: number
}

/**
 * API client class with comprehensive error handling and retry logic
 */
export class ApiClient {
  private client: AxiosInstance
  private requestInterceptorId: number | null = null
  private responseInterceptorId: number | null = null

  constructor() {
    this.client = axios.create({
      baseURL: env.API_BASE_URL,
      timeout: env.API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  /**
   * Set up request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.requestInterceptorId = this.client.interceptors.request.use(
      (config) => {
        // Add request timestamp for performance monitoring
        config.metadata = { startTime: Date.now() }
        
        // Add correlation ID for request tracking
        config.headers['X-Request-ID'] = this.generateRequestId()
        
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor
    this.responseInterceptorId = this.client.interceptors.response.use(
      (response) => {
        // Calculate response time for monitoring
        const responseTime = Date.now() - (response.config.metadata?.startTime || 0)
        response.config.metadata = { ...response.config.metadata, responseTime }
        
        return response
      },
      async (error: AxiosError) => {
        return this.handleResponseError(error)
      }
    )
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Handle response errors with retry logic
   */
  private async handleResponseError(error: AxiosError): Promise<never> {
    const config = error.config as RequestConfig & { _retryCount?: number }
    
    // Initialize retry count
    config._retryCount = config._retryCount || 0
    
    // Determine if we should retry
    const shouldRetry = this.shouldRetry(error, config)
    
    if (shouldRetry && config._retryCount < env.API_RETRIES) {
      config._retryCount++
      
      // Calculate delay with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, config._retryCount - 1), 10000)
      
      await this.delay(delay)
      
      return this.client.request(config)
    }

    // Transform error to our custom format
    throw this.transformError(error)
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: AxiosError, config: RequestConfig): boolean {
    // Don't retry if explicitly disabled
    if (config.skipRetry) return false
    
    // Don't retry POST, PUT, PATCH requests by default
    if (['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')) {
      return false
    }
    
    // Retry on network errors
    if (!error.response) return true
    
    // Retry on server errors (5xx) but not client errors (4xx)
    if (error.response.status >= 500) return true
    
    // Retry on specific status codes
    const retryableStatuses = [408, 429, 502, 503, 504]
    return retryableStatuses.includes(error.response.status)
  }

  /**
   * Transform axios error to our custom error format
   */
  private transformError(error: AxiosError): ApiError {
    if (!error.response) {
      return new ApiError(
        'Network error - please check your internet connection',
        0,
        'NETWORK_ERROR'
      )
    }

    const response = error.response
    const data = response.data as ErrorResponse | undefined

    return new ApiError(
      data?.message || error.message || 'An unexpected error occurred',
      response.status,
      data?.code || 'UNKNOWN_ERROR',
      data?.details
    )
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Generic request method
   */
  async request<T>(config: RequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.request(config)
      
      if (!response.data.success) {
        throw new ApiError(
          response.data.error || 'Request failed',
          response.status,
          'API_ERROR'
        )
      }
      
      return response.data.data as T
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError('Request failed', 500, 'UNKNOWN_ERROR')
    }
  }

  /**
   * HTTP method shortcuts
   */
  async get<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url })
  }

  async post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data })
  }

  async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data })
  }

  async patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, data })
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url })
  }

  /**
   * Clean up interceptors
   */
  destroy(): void {
    if (this.requestInterceptorId !== null) {
      this.client.interceptors.request.eject(this.requestInterceptorId)
    }
    if (this.responseInterceptorId !== null) {
      this.client.interceptors.response.eject(this.responseInterceptorId)
    }
  }
}

// Create singleton instance
export const apiClient = new ApiClient()
