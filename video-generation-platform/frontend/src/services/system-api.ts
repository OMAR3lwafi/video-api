/**
 * System API service methods
 */

import { apiClient } from './api-client'
import { API_ENDPOINTS } from '@/config/env'
import type { HealthResponse, SystemLimits, AnalyticsData } from '@/types'

/**
 * System API service
 */
export const systemApi = {
  /**
   * Get system health
   */
  async getHealth(): Promise<HealthResponse> {
    return apiClient.get(API_ENDPOINTS.health, { skipAuth: true })
  },

  /**
   * Get system limits
   */
  async getLimits(): Promise<SystemLimits> {
    return apiClient.get(API_ENDPOINTS.system.limits)
  },

  /**
   * Get analytics data
   */
  async getAnalytics(): Promise<AnalyticsData> {
    return apiClient.get(API_ENDPOINTS.system.analytics)
  },
}
