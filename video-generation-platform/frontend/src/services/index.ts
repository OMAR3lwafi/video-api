/**
 * Services index - exports all API services
 */

export { apiClient, ApiError } from './api-client'
export { videoApi } from './video-api'
export { uploadApi } from './upload-api'
export { systemApi } from './system-api'

// Default export with all services
export default {
  video: videoApi,
  upload: uploadApi,
  system: systemApi,
  client: apiClient,
}
