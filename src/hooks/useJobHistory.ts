import { useState, useEffect, useCallback } from 'react';
import { Job, JobStatus, JobType } from '@/types/job';
import { JobFilters } from '@/components/jobs/JobFilters';
import { useJobStore } from '@/stores/jobStore';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const useJobHistory = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<JobFilters>({});
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  const { fetchJobs: fetchJobsFromStore } = useJobStore();

  const fetchJobs = useCallback(async (page: number = pagination.page) => {
    setLoading(true);
    setError(null);

    try {
      // Build query params from filters
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pagination.limit.toString());

      if (filters.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','));
      }
      
      if (filters.type && filters.type.length > 0) {
        params.append('type', filters.type.join(','));
      }
      
      if (filters.templateId) {
        params.append('templateId', filters.templateId);
      }
      
      if (filters.dateRange) {
        if (filters.dateRange.from) {
          params.append('dateFrom', filters.dateRange.from.toISOString());
        }
        if (filters.dateRange.to) {
          params.append('dateTo', filters.dateRange.to.toISOString());
        }
      }
      
      if (filters.search) {
        params.append('search', filters.search);
      }

      // Fetch from API
      const response = await fetch(`/api/jobs?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }

      const data = await response.json();
      
      setJobs(data.jobs);
      setPagination({
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: Math.ceil(data.total / data.limit)
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
      
      // Fallback to mock data for development
      if (process.env.NODE_ENV === 'development') {
        const mockJobs = generateMockJobs(pagination.limit);
        setJobs(mockJobs);
        setPagination({
          ...pagination,
          total: 100,
          totalPages: Math.ceil(100 / pagination.limit)
        });
      }
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  const refreshJobs = useCallback(() => {
    return fetchJobs(pagination.page);
  }, [fetchJobs, pagination.page]);

  const updateFilters = useCallback((newFilters: JobFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  }, []);

  const updatePagination = useCallback((updates: Partial<Pagination>) => {
    setPagination(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    jobs,
    loading,
    error,
    filters,
    pagination,
    fetchJobs,
    refreshJobs,
    updateFilters,
    updatePagination
  };
};

// Mock data generator for development
function generateMockJobs(count: number): Job[] {
  const statuses: JobStatus[] = ['completed', 'failed', 'processing', 'queued', 'cancelled'];
  const types: JobType[] = ['single', 'batch', 'template'];
  const templates = ['marketing-video', 'social-media-reel', 'product-demo', 'tutorial'];
  
  return Array.from({ length: count }, (_, i) => {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const startedAt = new Date(createdAt.getTime() + Math.random() * 60 * 1000);
    const completedAt = status === 'completed' || status === 'failed' 
      ? new Date(startedAt.getTime() + Math.random() * 300 * 1000)
      : undefined;
    
    return {
      id: `job-${Date.now()}-${i}`,
      name: `Video Job ${i + 1}`,
      status,
      type,
      templateId: type === 'template' ? templates[Math.floor(Math.random() * templates.length)] : undefined,
      createdAt: createdAt.toISOString(),
      startedAt: status !== 'queued' ? startedAt.toISOString() : undefined,
      completedAt: completedAt?.toISOString(),
      updatedAt: (completedAt || startedAt).toISOString(),
      progress: status === 'processing' ? Math.floor(Math.random() * 100) : status === 'completed' ? 100 : undefined,
      currentStep: status === 'processing' ? 'Encoding video...' : undefined,
      elements: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, j) => ({
        id: `element-${j}`,
        type: Math.random() > 0.5 ? 'video' : 'image',
        source: `https://example.com/media-${j}`,
        x: '0',
        y: '0',
        width: '100%',
        height: '100%'
      })),
      resultUrl: status === 'completed' ? `https://example.com/result-${i}.mp4` : undefined,
      error: status === 'failed' ? 'Processing failed due to invalid video format' : undefined,
      processingTime: completedAt ? `${Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)}s` : undefined,
      fileSize: status === 'completed' ? `${(Math.random() * 100).toFixed(2)} MB` : undefined,
      tags: ['automated', 'client-x', 'campaign-2024']
    };
  });
}