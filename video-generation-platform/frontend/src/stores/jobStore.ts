/**
 * Job Store - Video Processing Job Management
 * Manages active jobs, completed jobs, real-time updates, and job history
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { persistMiddleware } from './middleware'
import type { JobState, JobActions } from './types'
import type { 
  VideoCreateRequest,
  JobStatusResponse,
  RealtimeJobUpdate,
  RealtimeStepUpdate,
} from '../types/api'
import { apiService } from '../services/apiService'
import { useRealtimeJobUpdates } from '../hooks/useSupabase'

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: JobState = {
  activeJobs: new Map(),
  completedJobs: [],
  history: [],
  subscriptions: new Map(),
  queue: {
    pending: [],
    processing: [],
    maxConcurrent: 3,
    retryQueue: [],
  },
  stats: {
    totalJobs: 0,
    successRate: 0,
    averageProcessingTime: 0,
    totalProcessingTime: 0,
    peakConcurrency: 0,
  },
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useJobStore = create<JobState & JobActions>()(
  devtools(
    persistMiddleware(
      immer((set, get) => ({
        ...initialState,

        // ====================================================================
        // JOB LIFECYCLE
        // ====================================================================

        createJob: async (request: VideoCreateRequest) => {
          try {
            const response = await apiService.createVideo(request)
            const jobId = response.job_id
            
            // Add to active jobs
            set((state) => {
              state.activeJobs.set(jobId, {
                id: jobId,
                status: response.status === 'completed' ? 'completed' : 'processing',
                progress: response.status === 'completed' ? 100 : 0,
                message: response.message,
                startTime: new Date().toISOString(),
                estimatedCompletion: 'estimated_completion' in response ? response.estimated_completion : undefined,
                type: response.status === 'completed' ? 'immediate' : 'async',
                projectId: request.projectId,
              })
              
              // Update queue
              if (response.status !== 'completed') {
                state.queue.processing.push(jobId)
                state.queue.pending = state.queue.pending.filter(id => id !== jobId)
              }
              
              // Update stats
              state.stats.totalJobs++
              state.stats.peakConcurrency = Math.max(
                state.stats.peakConcurrency,
                state.queue.processing.length
              )
            })

            // Add to history
            get().addToHistory(jobId, 'created', { request, response })

            // Handle immediate completion
            if (response.status === 'completed') {
              get().completeJob(jobId, response)
            } else {
              // Subscribe to real-time updates
              get().subscribeToJob(jobId)
            }

            return jobId

          } catch (error) {
            console.error('Failed to create job:', error)
            throw error
          }
        },

        updateJobStatus: (jobId, status) => {
          set((state) => {
            const job = state.activeJobs.get(jobId)
            if (job) {
              state.activeJobs.set(jobId, {
                ...job,
                status: status.status,
                progress: status.progress ? parseInt(status.progress) : job.progress,
                message: status.message,
                estimatedCompletion: status.estimated_time_remaining,
              })
            }
          })

          // Add to history
          get().addToHistory(jobId, 'updated', status)

          // Handle completion
          if (status.status === 'completed') {
            get().completeJob(jobId, status)
          } else if (status.status === 'failed') {
            get().failJob(jobId, status.error || 'Job failed')
          }
        },

        completeJob: (jobId, result) => {
          set((state) => {
            const job = state.activeJobs.get(jobId)
            if (job) {
              // Move to completed jobs
              state.completedJobs.unshift({
                id: jobId,
                status: 'completed',
                resultUrl: result.result_url,
                duration: result.processing_time ? parseFloat(result.processing_time) : undefined,
                fileSize: result.file_size ? parseInt(result.file_size) : undefined,
                completedAt: new Date().toISOString(),
                projectId: job.projectId,
              })

              // Remove from active jobs
              state.activeJobs.delete(jobId)
              
              // Update queue
              state.queue.processing = state.queue.processing.filter(id => id !== jobId)
              
              // Update stats
              state.stats.successRate = state.completedJobs.filter(j => j.status === 'completed').length / state.stats.totalJobs
              
              if (result.processing_time) {
                const processingTime = parseFloat(result.processing_time)
                state.stats.totalProcessingTime += processingTime
                state.stats.averageProcessingTime = state.stats.totalProcessingTime / state.stats.totalJobs
              }
            }
          })

          // Unsubscribe from updates
          get().unsubscribeFromJob(jobId)

          // Add to history
          get().addToHistory(jobId, 'completed', result)

          // Process next job in queue
          get().processQueue()
        },

        failJob: (jobId, error) => {
          set((state) => {
            const job = state.activeJobs.get(jobId)
            if (job) {
              // Move to completed jobs
              state.completedJobs.unshift({
                id: jobId,
                status: 'failed',
                error,
                completedAt: new Date().toISOString(),
                projectId: job.projectId,
              })

              // Remove from active jobs
              state.activeJobs.delete(jobId)
              
              // Update queue
              state.queue.processing = state.queue.processing.filter(id => id !== jobId)
              
              // Add to retry queue if retryable
              if (this.isRetryableError(error)) {
                state.queue.retryQueue.push({
                  jobId,
                  retryCount: 1,
                  nextRetry: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
                })
              }
              
              // Update stats
              state.stats.successRate = state.completedJobs.filter(j => j.status === 'completed').length / state.stats.totalJobs
            }
          })

          // Unsubscribe from updates
          get().unsubscribeFromJob(jobId)

          // Add to history
          get().addToHistory(jobId, 'failed', { error })

          // Process next job in queue
          get().processQueue()
        },

        cancelJob: async (jobId) => {
          try {
            await apiService.cancelJob(jobId)
            
            set((state) => {
              const job = state.activeJobs.get(jobId)
              if (job) {
                // Move to completed jobs
                state.completedJobs.unshift({
                  id: jobId,
                  status: 'cancelled',
                  completedAt: new Date().toISOString(),
                  projectId: job.projectId,
                })

                // Remove from active jobs
                state.activeJobs.delete(jobId)
                
                // Update queue
                state.queue.processing = state.queue.processing.filter(id => id !== jobId)
                state.queue.pending = state.queue.pending.filter(id => id !== jobId)
              }
            })

            // Unsubscribe from updates
            get().unsubscribeFromJob(jobId)

            // Add to history
            get().addToHistory(jobId, 'cancelled')

            // Process next job in queue
            get().processQueue()

          } catch (error) {
            console.error('Failed to cancel job:', error)
            throw error
          }
        },

        retryJob: async (jobId) => {
          try {
            // Get original job data from history
            const history = get().getJobHistory(jobId)
            const createEvent = history.find(h => h.action === 'created')
            
            if (!createEvent?.details?.request) {
              throw new Error('Cannot retry job: original request not found')
            }

            // Remove from retry queue
            set((state) => {
              state.queue.retryQueue = state.queue.retryQueue.filter(item => item.jobId !== jobId)
            })

            // Create new job with original request
            return await get().createJob(createEvent.details.request)

          } catch (error) {
            console.error('Failed to retry job:', error)
            throw error
          }
        },

        // ====================================================================
        // REAL-TIME UPDATES
        // ====================================================================

        subscribeToJob: (jobId) => {
          set((state) => {
            state.subscriptions.set(jobId, {
              jobId,
              isConnected: false,
              lastUpdate: undefined,
              error: undefined,
            })
          })

          // Set up real-time subscription
          const { connect } = useRealtimeJobUpdates(jobId, {
            onJobUpdate: (update) => get().handleRealtimeUpdate(update),
            onStepUpdate: (update) => get().handleStepUpdate(update),
            onError: (error) => {
              set((state) => {
                const subscription = state.subscriptions.get(jobId)
                if (subscription) {
                  state.subscriptions.set(jobId, {
                    ...subscription,
                    error: error.message,
                    isConnected: false,
                  })
                }
              })
            },
          })

          connect()

          // Update subscription status
          set((state) => {
            const subscription = state.subscriptions.get(jobId)
            if (subscription) {
              state.subscriptions.set(jobId, {
                ...subscription,
                isConnected: true,
                lastUpdate: new Date().toISOString(),
              })
            }
          })
        },

        unsubscribeFromJob: (jobId) => {
          const { disconnect } = useRealtimeJobUpdates(jobId)
          disconnect()

          set((state) => {
            state.subscriptions.delete(jobId)
          })
        },

        handleRealtimeUpdate: (update) => {
          const { job_id, status, progress, message } = update
          
          set((state) => {
            const job = state.activeJobs.get(job_id)
            if (job) {
              state.activeJobs.set(job_id, {
                ...job,
                status,
                progress: progress || job.progress,
                message: message || job.message,
              })
            }
            
            // Update subscription
            const subscription = state.subscriptions.get(job_id)
            if (subscription) {
              state.subscriptions.set(job_id, {
                ...subscription,
                lastUpdate: update.timestamp,
              })
            }
          })

          // Handle status changes
          if (status === 'completed' || status === 'failed') {
            // Fetch final job status
            apiService.getJobStatus(job_id)
              .then((finalStatus) => {
                if (finalStatus.status === 'completed') {
                  get().completeJob(job_id, finalStatus)
                } else if (finalStatus.status === 'failed') {
                  get().failJob(job_id, finalStatus.error || 'Job failed')
                }
              })
              .catch(console.error)
          }
        },

        handleStepUpdate: (update) => {
          const { job_id, step_name, status, progress, message } = update
          
          set((state) => {
            const job = state.activeJobs.get(job_id)
            if (job) {
              state.activeJobs.set(job_id, {
                ...job,
                progress: Math.max(job.progress, progress),
                message: message || `${step_name}: ${status}`,
              })
            }
          })
        },

        // ====================================================================
        // QUEUE MANAGEMENT
        // ====================================================================

        addToQueue: (jobId) => {
          set((state) => {
            if (!state.queue.pending.includes(jobId) && !state.queue.processing.includes(jobId)) {
              state.queue.pending.push(jobId)
            }
          })
          
          get().processQueue()
        },

        removeFromQueue: (jobId) => {
          set((state) => {
            state.queue.pending = state.queue.pending.filter(id => id !== jobId)
            state.queue.processing = state.queue.processing.filter(id => id !== jobId)
          })
        },

        processQueue: () => {
          const state = get()
          const { pending, processing, maxConcurrent } = state.queue
          
          if (processing.length >= maxConcurrent || pending.length === 0) {
            return
          }

          // Move jobs from pending to processing
          const availableSlots = maxConcurrent - processing.length
          const jobsToProcess = pending.slice(0, availableSlots)
          
          set((state) => {
            jobsToProcess.forEach(jobId => {
              state.queue.pending = state.queue.pending.filter(id => id !== jobId)
              if (!state.queue.processing.includes(jobId)) {
                state.queue.processing.push(jobId)
              }
            })
          })
        },

        clearQueue: () => {
          set((state) => {
            state.queue.pending = []
            state.queue.processing = []
            state.queue.retryQueue = []
          })
        },

        // ====================================================================
        // HISTORY
        // ====================================================================

        addToHistory: (jobId, action, details) => {
          set((state) => {
            state.history.unshift({
              id: `${jobId}-${action}-${Date.now()}`,
              action,
              timestamp: new Date().toISOString(),
              details,
            })
            
            // Keep only last 1000 history entries
            if (state.history.length > 1000) {
              state.history = state.history.slice(0, 1000)
            }
          })
        },

        clearHistory: () => {
          set((state) => {
            state.history = []
          })
        },

        getJobHistory: (jobId) => {
          return get().history.filter(entry => 
            entry.details?.jobId === jobId || 
            entry.id.startsWith(jobId)
          )
        },

        // ====================================================================
        // STATISTICS
        // ====================================================================

        updateStats: () => {
          const state = get()
          const completedJobs = state.completedJobs
          const successfulJobs = completedJobs.filter(job => job.status === 'completed')
          
          set((state) => {
            state.stats.successRate = state.stats.totalJobs > 0 
              ? successfulJobs.length / state.stats.totalJobs 
              : 0
            
            const totalProcessingTime = successfulJobs.reduce((sum, job) => 
              sum + (job.duration || 0), 0
            )
            
            state.stats.totalProcessingTime = totalProcessingTime
            state.stats.averageProcessingTime = successfulJobs.length > 0 
              ? totalProcessingTime / successfulJobs.length 
              : 0
          })
        },

        getJobStats: () => {
          get().updateStats()
          return get().stats
        },

        // ====================================================================
        // CLEANUP
        // ====================================================================

        cleanupCompletedJobs: (olderThan = 24 * 60 * 60 * 1000) => { // 24 hours
          const cutoff = Date.now() - olderThan
          
          set((state) => {
            state.completedJobs = state.completedJobs.filter(job => 
              new Date(job.completedAt).getTime() > cutoff
            )
          })
        },

        reset: () => {
          // Cancel all active subscriptions
          const state = get()
          for (const jobId of state.subscriptions.keys()) {
            get().unsubscribeFromJob(jobId)
          }
          
          set(() => ({ ...initialState }))
        },

        // ====================================================================
        // HELPER METHODS
        // ====================================================================

        isRetryableError: (error: string) => {
          const retryableErrors = [
            'network error',
            'timeout',
            'server error',
            'service unavailable',
            'internal server error',
          ]
          
          return retryableErrors.some(retryableError => 
            error.toLowerCase().includes(retryableError)
          )
        },
      })),
      {
        name: 'job-store',
        blacklist: ['subscriptions'], // Don't persist real-time subscriptions
        version: 1,
      }
    ),
    {
      name: 'job-store',
    }
  )
)

// ============================================================================
// SELECTORS
// ============================================================================

export const jobSelectors = {
  activeJobs: (state: JobState) => Array.from(state.activeJobs.values()),
  completedJobs: (state: JobState) => state.completedJobs,
  jobById: (jobId: string) => (state: JobState) => state.activeJobs.get(jobId),
  jobsByProject: (projectId: string) => (state: JobState) => {
    const active = Array.from(state.activeJobs.values()).filter(job => job.projectId === projectId)
    const completed = state.completedJobs.filter(job => job.projectId === projectId)
    return [...active, ...completed]
  },
  queueLength: (state: JobState) => state.queue.pending.length + state.queue.processing.length,
  isProcessing: (state: JobState) => state.queue.processing.length > 0,
  stats: (state: JobState) => state.stats,
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for active jobs
 */
export function useActiveJobs(projectId?: string) {
  return useJobStore((state) => {
    const activeJobs = Array.from(state.activeJobs.values())
    return projectId 
      ? activeJobs.filter(job => job.projectId === projectId)
      : activeJobs
  })
}

/**
 * Hook for completed jobs
 */
export function useCompletedJobs(projectId?: string) {
  return useJobStore((state) => 
    projectId 
      ? state.completedJobs.filter(job => job.projectId === projectId)
      : state.completedJobs
  )
}

/**
 * Hook for job statistics
 */
export function useJobStats() {
  return useJobStore((state) => state.stats)
}

/**
 * Hook for queue status
 */
export function useQueueStatus() {
  return useJobStore((state) => ({
    pending: state.queue.pending.length,
    processing: state.queue.processing.length,
    total: state.queue.pending.length + state.queue.processing.length,
    maxConcurrent: state.queue.maxConcurrent,
  }))
}
