/**
 * Video API service methods
 */

import { apiClient } from './api-client'
import { API_ENDPOINTS } from '@/config/env'
import type {
  VideoCreateRequest,
  ImmediateResponse,
  AsyncResponse,
  JobStatusResponse,
  JobListItem,
  PaginatedResponse,
} from '@/types'

/**
 * Video API service
 */
export const videoApi = {
  /**
   * Create a new video
   */
  async createVideo(request: VideoCreateRequest): Promise<ImmediateResponse | AsyncResponse> {
    return apiClient.post(API_ENDPOINTS.video.create, request)
  },

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    return apiClient.get(API_ENDPOINTS.video.status(jobId))
  },

  /**
   * Get job result (alias for status)
   */
  async getJobResult(jobId: string): Promise<JobStatusResponse> {
    return apiClient.get(API_ENDPOINTS.video.result(jobId))
  },

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    return apiClient.delete(API_ENDPOINTS.video.cancel(jobId))
  },

  /**
   * List jobs with pagination
   */
  async listJobs(params?: {
    page?: number
    limit?: number
    status?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<JobListItem>> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set('page', params.page.toString())
    if (params?.limit) queryParams.set('limit', params.limit.toString())
    if (params?.status) queryParams.set('status', params.status)
    if (params?.sortBy) queryParams.set('sortBy', params.sortBy)
    if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder)

    const url = `${API_ENDPOINTS.video.list}?${queryParams.toString()}`
    return apiClient.get(url)
  },

  /**
   * Delete a job
   */
  async deleteJob(jobId: string): Promise<{ success: boolean }> {
    return apiClient.delete(API_ENDPOINTS.video.delete(jobId))
  },
}
