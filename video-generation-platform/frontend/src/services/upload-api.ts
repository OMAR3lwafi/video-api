/**
 * Upload API service methods
 */

import { apiClient } from './api-client'
import { API_ENDPOINTS } from '@/config/env'
import type { UploadResponse } from '@/types'

/**
 * Upload API service
 */
export const uploadApi = {
  /**
   * Upload single file
   */
  async uploadSingle(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)

    return apiClient.request<UploadResponse>({
      method: 'POST',
      url: API_ENDPOINTS.upload.single,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    })
  },

  /**
   * Upload multiple files
   */
  async uploadMultiple(
    files: File[],
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse[]> {
    const formData = new FormData()
    files.forEach((file, index) => {
      formData.append(`files[${index}]`, file)
    })

    return apiClient.request<UploadResponse[]>({
      method: 'POST',
      url: API_ENDPOINTS.upload.multiple,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    })
  },

  /**
   * Validate file before upload
   */
  async validateFile(file: File): Promise<{ valid: boolean; errors?: string[] }> {
    const formData = new FormData()
    formData.append('file', file)

    return apiClient.post(API_ENDPOINTS.upload.validate, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}
