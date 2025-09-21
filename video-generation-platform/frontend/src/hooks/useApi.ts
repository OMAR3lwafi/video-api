/**
 * API hooks using React Query for data fetching and caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { videoApi, uploadApi, systemApi } from '@/services'
import type {
  VideoCreateRequest,
  JobListItem,
  JobStatusResponse,
  HealthResponse,
  SystemLimits,
  AnalyticsData,
} from '@/types'

/**
 * Hook for fetching jobs list
 */
export function useJobs(params?: {
  page?: number
  limit?: number
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => videoApi.listJobs(params),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: (data) => {
      // Refetch more frequently if there are active jobs
      const hasActiveJobs = data?.data?.some(job => 
        job.status === 'processing' || job.status === 'pending'
      )
      return hasActiveJobs ? 5000 : 30000 // 5s vs 30s
    },
  })
}

/**
 * Hook for fetching single job status
 */
export function useJob(jobId: string, enabled = true) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => videoApi.getJobStatus(jobId),
    enabled: enabled && !!jobId,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: (data) => {
      // Refetch while job is processing
      return data?.status === 'processing' ? 2000 : false
    },
  })
}

/**
 * Hook for creating videos
 */
export function useCreateVideo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: VideoCreateRequest) => videoApi.createVideo(request),
    onSuccess: (data) => {
      // Invalidate jobs list to show new job
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      
      if (data.status === 'completed') {
        toast.success('Video created successfully!')
      } else {
        toast.success('Video job started - check the jobs page for progress')
      }
    },
    onError: (error) => {
      console.error('Video creation failed:', error)
      toast.error('Failed to create video')
    },
  })
}

/**
 * Hook for canceling jobs
 */
export function useCancelJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobId: string) => videoApi.cancelJob(jobId),
    onSuccess: (_, jobId) => {
      // Update job status in cache
      queryClient.setQueryData(['job', jobId], (old: JobStatusResponse) => ({
        ...old,
        status: 'cancelled' as const,
      }))
      
      // Invalidate jobs list
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      
      toast.success('Job canceled successfully')
    },
    onError: () => {
      toast.error('Failed to cancel job')
    },
  })
}

/**
 * Hook for deleting jobs
 */
export function useDeleteJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobId: string) => videoApi.deleteJob(jobId),
    onSuccess: (_, jobId) => {
      // Remove job from cache
      queryClient.removeQueries({ queryKey: ['job', jobId] })
      
      // Update jobs list cache
      queryClient.setQueryData(['jobs'], (old: any) => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.filter((job: JobListItem) => job.job_id !== jobId),
        }
      })
      
      toast.success('Job deleted successfully')
    },
    onError: () => {
      toast.error('Failed to delete job')
    },
  })
}

/**
 * Hook for uploading single file
 */
export function useUploadFile() {
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (progress: number) => void }) =>
      uploadApi.uploadSingle(file, onProgress),
    onSuccess: () => {
      toast.success('File uploaded successfully')
    },
    onError: () => {
      toast.error('File upload failed')
    },
  })
}

/**
 * Hook for uploading multiple files
 */
export function useUploadFiles() {
  return useMutation({
    mutationFn: ({ files, onProgress }: { files: File[]; onProgress?: (progress: number) => void }) =>
      uploadApi.uploadMultiple(files, onProgress),
    onSuccess: (data) => {
      toast.success(`Successfully uploaded ${data.length} file(s)`)
    },
    onError: () => {
      toast.error('File upload failed')
    },
  })
}

/**
 * Hook for validating files before upload
 */
export function useValidateFile() {
  return useMutation({
    mutationFn: (file: File) => uploadApi.validateFile(file),
    onError: () => {
      toast.error('File validation failed')
    },
  })
}

/**
 * Hook for fetching system health
 */
export function useSystemHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => systemApi.getHealth(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Check health every minute
    retry: (failureCount, error: any) => {
      // Don't retry if it's a client error
      if (error?.status >= 400 && error?.status < 500) {
        return false
      }
      return failureCount < 3
    },
  })
}

/**
 * Hook for fetching system limits
 */
export function useSystemLimits() {
  return useQuery({
    queryKey: ['system', 'limits'],
    queryFn: () => systemApi.getLimits(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook for fetching analytics data
 */
export function useAnalytics() {
  return useQuery({
    queryKey: ['system', 'analytics'],
    queryFn: () => systemApi.getAnalytics(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Hook for real-time job updates via polling
 */
export function useJobUpdates(jobIds: string[]) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['job-updates', jobIds],
    queryFn: async () => {
      const updates = await Promise.allSettled(
        jobIds.map(id => videoApi.getJobStatus(id))
      )
      
      return updates.map((result, index) => ({
        jobId: jobIds[index],
        status: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null,
      }))
    },
    enabled: jobIds.length > 0,
    refetchInterval: 3000, // Poll every 3 seconds
    onSuccess: (updates) => {
      // Update individual job caches
      updates.forEach(({ jobId, status }) => {
        if (status) {
          queryClient.setQueryData(['job', jobId], status)
        }
      })
    },
  })
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdate() {
  const queryClient = useQueryClient()

  const updateJobStatus = (jobId: string, status: Partial<JobStatusResponse>) => {
    queryClient.setQueryData(['job', jobId], (old: JobStatusResponse) => ({
      ...old,
      ...status,
    }))

    // Also update in jobs list
    queryClient.setQueryData(['jobs'], (old: any) => {
      if (!old?.data) return old
      return {
        ...old,
        data: old.data.map((job: JobListItem) =>
          job.job_id === jobId ? { ...job, ...status } : job
        ),
      }
    })
  }

  const addJob = (job: JobListItem) => {
    queryClient.setQueryData(['jobs'], (old: any) => {
      if (!old?.data) return { data: [job] }
      return {
        ...old,
        data: [job, ...old.data],
      }
    })
  }

  return {
    updateJobStatus,
    addJob,
  }
}

/**
 * Hook for background refetching
 */
export function useBackgroundRefetch() {
  const queryClient = useQueryClient()

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Refetch important queries when tab becomes visible
        queryClient.invalidateQueries({ queryKey: ['jobs'] })
        queryClient.invalidateQueries({ queryKey: ['system', 'health'] })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [queryClient])
}
