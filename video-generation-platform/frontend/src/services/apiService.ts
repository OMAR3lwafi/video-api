/**
 * Enhanced API Service Layer
 * Dynamic Video Content Generation Platform
 * 
 * Comprehensive API service with:
 * - Request/response interceptors
 * - Error handling and retry logic
 * - Caching strategy
 * - Timeout and cancellation
 * - Offline support
 * - Performance monitoring
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, CancelTokenSource } from 'axios'
import { env, API_ENDPOINTS } from '../config/env'
import type {
  VideoCreateRequest,
  VideoProcessingResponse,
  JobStatusResponse,
  ProcessingError,
} from '../types/api'

// ============================================================================
// TYPES
// ============================================================================

export interface ApiServiceConfig {
  baseURL: string
  timeout: number
  retries: number
  retryDelay: number
  cacheEnabled: boolean
  cacheTTL: number
  offlineEnabled: boolean
}

export interface RequestOptions extends AxiosRequestConfig {
  retries?: number
  retryDelay?: number
  cache?: boolean
  cacheTTL?: number
  skipAuth?: boolean
  skipInterceptors?: boolean
}

export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  etag?: string
  lastModified?: string
}

export interface RetryConfig {
  attempts: number
  delay: number
  backoff: number
  maxDelay: number
  retryCondition: (error: any) => boolean
}

export interface PerformanceMetrics {
  requestCount: number
  averageLatency: number
  errorRate: number
  cacheHitRate: number
  retryRate: number
}

// ============================================================================
// API SERVICE CLASS
// ============================================================================

export class ApiService {
  private client: AxiosInstance
  private cache = new Map<string, CacheEntry>()
  private activeRequests = new Map<string, CancelTokenSource>()
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    averageLatency: 0,
    errorRate: 0,
    cacheHitRate: 0,
    retryRate: 0,
  }
  private config: ApiServiceConfig

  constructor(config: Partial<ApiServiceConfig> = {}) {
    this.config = {
      baseURL: env.API_BASE_URL,
      timeout: env.API_TIMEOUT,
      retries: env.API_RETRIES,
      retryDelay: 1000,
      cacheEnabled: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      offlineEnabled: true,
      ...config,
    }

    this.client = this.createAxiosInstance()
    this.setupInterceptors()
    this.setupCacheCleanup()
  }

  // ========================================================================
  // CLIENT SETUP
  // ========================================================================

  private createAxiosInstance(): AxiosInstance {
    return axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add timestamp for performance tracking
        config.metadata = { startTime: Date.now() }
        
        // Add correlation ID
        config.headers['X-Correlation-ID'] = this.generateCorrelationId()
        
        // Add auth token if available
        const token = this.getAuthToken()
        if (token && !config.skipAuth) {
          config.headers['Authorization'] = `Bearer ${token}`
        }

        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.updateMetrics(response)
        return response
      },
      async (error) => {
        this.updateMetrics(null, error)
        
        // Handle retry logic
        if (this.shouldRetry(error)) {
          return this.retryRequest(error)
        }
        
        return Promise.reject(this.transformError(error))
      }
    )
  }

  private setupCacheCleanup(): void {
    // Clean expired cache entries every 5 minutes
    setInterval(() => {
      this.cleanExpiredCache()
    }, 5 * 60 * 1000)
  }

  // ========================================================================
  // CORE REQUEST METHODS
  // ========================================================================

  async get<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    const cacheKey = this.getCacheKey('GET', url, options.params)
    
    // Check cache first
    if (options.cache !== false && this.config.cacheEnabled) {
      const cached = this.getFromCache<T>(cacheKey)
      if (cached) {
        this.metrics.cacheHitRate = this.calculateHitRate(true)
        return cached
      }
    }

    const response = await this.request<T>({
      method: 'GET',
      url,
      ...options,
    })

    // Cache successful responses
    if (options.cache !== false && this.config.cacheEnabled) {
      this.setCache(cacheKey, response, options.cacheTTL)
      this.metrics.cacheHitRate = this.calculateHitRate(false)
    }

    return response
  }

  async post<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      ...options,
    })
  }

  async put<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      ...options,
    })
  }

  async patch<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>({
      method: 'PATCH',
      url,
      data,
      ...options,
    })
  }

  async delete<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      url,
      ...options,
    })
  }

  // ========================================================================
  // REQUEST EXECUTION
  // ========================================================================

  private async request<T>(config: RequestOptions): Promise<T> {
    const requestId = this.generateRequestId()
    
    try {
      // Create cancel token
      const cancelToken = axios.CancelToken.source()
      this.activeRequests.set(requestId, cancelToken)
      
      // Execute request
      const response = await this.client.request<T>({
        ...config,
        cancelToken: cancelToken.token,
      })
      
      return response.data
      
    } catch (error) {
      throw this.transformError(error)
    } finally {
      this.activeRequests.delete(requestId)
    }
  }

  // ========================================================================
  // RETRY LOGIC
  // ========================================================================

  private shouldRetry(error: any): boolean {
    // Don't retry if explicitly disabled
    if (error.config?.retries === 0) {
      return false
    }

    // Don't retry client errors (4xx)
    if (error.response?.status >= 400 && error.response?.status < 500) {
      return false
    }

    // Don't retry if already retried max times
    const retryCount = error.config?._retryCount || 0
    const maxRetries = error.config?.retries || this.config.retries
    
    if (retryCount >= maxRetries) {
      return false
    }

    // Retry on network errors or server errors (5xx)
    return !error.response || error.response.status >= 500
  }

  private async retryRequest(error: any): Promise<any> {
    const config = error.config
    config._retryCount = (config._retryCount || 0) + 1
    
    const delay = this.calculateRetryDelay(config._retryCount, config.retryDelay)
    await this.sleep(delay)
    
    this.metrics.retryRate = this.calculateRetryRate()
    
    return this.client.request(config)
  }

  private calculateRetryDelay(attempt: number, baseDelay: number = this.config.retryDelay): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
    const jitter = Math.random() * 1000
    return Math.min(exponentialDelay + jitter, 30000) // Max 30 seconds
  }

  // ========================================================================
  // CACHING
  // ========================================================================

  private getCacheKey(method: string, url: string, params?: any): string {
    const paramString = params ? JSON.stringify(params) : ''
    return `${method}:${url}:${paramString}`
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTTL,
    }
    
    this.cache.set(key, entry)
  }

  private cleanExpiredCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  public clearCache(): void {
    this.cache.clear()
  }

  public invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.clearCache()
      return
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  // ========================================================================
  // ERROR HANDLING
  // ========================================================================

  private transformError(error: any): ProcessingError {
    if (axios.isCancel(error)) {
      return {
        type: 'network',
        message: 'Request was cancelled',
        recoverable: true,
        retry_after: 0,
        suggested_action: 'Try the request again',
      }
    }

    if (!error.response) {
      return {
        type: 'network',
        message: 'Network error occurred',
        details: error.message,
        recoverable: true,
        retry_after: 5,
        suggested_action: 'Check your internet connection and try again',
      }
    }

    const status = error.response.status
    const data = error.response.data

    switch (status) {
      case 400:
        return {
          type: 'validation',
          message: data?.message || 'Invalid request parameters',
          details: data?.details,
          recoverable: false,
          suggested_action: 'Please check your input and try again',
        }

      case 401:
        return {
          type: 'network',
          message: 'Authentication required',
          recoverable: true,
          suggested_action: 'Please log in and try again',
        }

      case 403:
        return {
          type: 'validation',
          message: 'Access denied',
          recoverable: false,
          suggested_action: 'You do not have permission to perform this action',
        }

      case 404:
        return {
          type: 'validation',
          message: 'Resource not found',
          recoverable: false,
          suggested_action: 'The requested resource does not exist',
        }

      case 408:
        return {
          type: 'timeout',
          message: 'Request timeout',
          recoverable: true,
          retry_after: 10,
          suggested_action: 'The request took too long. Please try again',
        }

      case 429:
        return {
          type: 'resource',
          message: 'Too many requests',
          recoverable: true,
          retry_after: 60,
          suggested_action: 'Please wait before making more requests',
        }

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: 'processing',
          message: 'Server error occurred',
          details: data?.message,
          recoverable: true,
          retry_after: 30,
          suggested_action: 'Server is experiencing issues. Please try again later',
        }

      default:
        return {
          type: 'processing',
          message: 'An unexpected error occurred',
          details: data?.message || error.message,
          recoverable: true,
          suggested_action: 'Please try again or contact support if the problem persists',
        }
    }
  }

  // ========================================================================
  // CANCELLATION
  // ========================================================================

  public cancelRequest(requestId?: string): void {
    if (requestId) {
      const cancelToken = this.activeRequests.get(requestId)
      if (cancelToken) {
        cancelToken.cancel('Request cancelled by user')
        this.activeRequests.delete(requestId)
      }
    } else {
      // Cancel all active requests
      for (const [id, cancelToken] of this.activeRequests.entries()) {
        cancelToken.cancel('Request cancelled by user')
        this.activeRequests.delete(id)
      }
    }
  }

  // ========================================================================
  // METRICS AND MONITORING
  // ========================================================================

  private updateMetrics(response?: AxiosResponse, error?: any): void {
    this.metrics.requestCount++
    
    if (response?.config.metadata?.startTime) {
      const latency = Date.now() - response.config.metadata.startTime
      this.metrics.averageLatency = (
        (this.metrics.averageLatency * (this.metrics.requestCount - 1) + latency) /
        this.metrics.requestCount
      )
    }
    
    if (error) {
      this.metrics.errorRate = this.calculateErrorRate()
    }
  }

  private calculateHitRate(isHit: boolean): number {
    // Simplified hit rate calculation
    return isHit ? this.metrics.cacheHitRate + 0.1 : Math.max(0, this.metrics.cacheHitRate - 0.1)
  }

  private calculateErrorRate(): number {
    // Simplified error rate calculation
    return Math.min(1, this.metrics.errorRate + 0.01)
  }

  private calculateRetryRate(): number {
    // Simplified retry rate calculation
    return Math.min(1, this.metrics.retryRate + 0.01)
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  // ========================================================================
  // VIDEO API METHODS
  // ========================================================================

  async createVideo(request: VideoCreateRequest): Promise<VideoProcessingResponse> {
    return this.post<VideoProcessingResponse>(API_ENDPOINTS.video.create, request, {
      cache: false, // Don't cache video creation requests
      retries: 2, // Limit retries for video creation
    })
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    return this.get<JobStatusResponse>(API_ENDPOINTS.video.status(jobId), {
      cache: false, // Don't cache job status (real-time data)
    })
  }

  async cancelJob(jobId: string): Promise<void> {
    return this.post<void>(API_ENDPOINTS.video.cancel(jobId), {}, {
      cache: false,
      retries: 1,
    })
  }

  async getJobList(params?: { page?: number; limit?: number; status?: string }): Promise<any> {
    return this.get(API_ENDPOINTS.video.list, {
      params,
      cache: true,
      cacheTTL: 30000, // 30 seconds cache for job list
    })
  }

  async deleteJob(jobId: string): Promise<void> {
    const result = await this.delete<void>(API_ENDPOINTS.video.delete(jobId), {
      cache: false,
    })
    
    // Invalidate related cache entries
    this.invalidateCache('video/jobs')
    this.invalidateCache(`video/status/${jobId}`)
    
    return result
  }

  // ========================================================================
  // HEALTH CHECK
  // ========================================================================

  async healthCheck(): Promise<{ ok: boolean; timestamp: string; services?: any }> {
    return this.get(API_ENDPOINTS.health, {
      timeout: 5000, // Short timeout for health checks
      retries: 1,
      cache: false,
    })
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private getAuthToken(): string | null {
    // This would typically come from your auth store
    return localStorage.getItem('auth_token')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  public updateConfig(newConfig: Partial<ApiServiceConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Update axios instance if needed
    if (newConfig.baseURL || newConfig.timeout) {
      this.client.defaults.baseURL = this.config.baseURL
      this.client.defaults.timeout = this.config.timeout
    }
  }

  public getConfig(): ApiServiceConfig {
    return { ...this.config }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const apiService = new ApiService()

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for API service metrics
 */
export function useApiMetrics() {
  return apiService.getMetrics()
}

/**
 * Hook for API service configuration
 */
export function useApiConfig() {
  const config = apiService.getConfig()
  const updateConfig = (newConfig: Partial<ApiServiceConfig>) => {
    apiService.updateConfig(newConfig)
  }
  
  return { config, updateConfig }
}
