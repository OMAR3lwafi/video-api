import { create } from 'zustand';
import { Job, JobStatus, JobPreferences } from '@/types/job';

interface JobStore {
  jobs: Job[];
  selectedJobs: Set<string>;
  preferences: JobPreferences;
  
  // Job Management
  fetchJobs: () => Promise<void>;
  addJob: (job: Job) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  deleteJob: (jobId: string) => Promise<void>;
  
  // Job Actions
  retryJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  pauseJob: (jobId: string) => Promise<void>;
  resumeJob: (jobId: string) => Promise<void>;
  
  // Bulk Operations
  retryJobs: (jobIds: string[]) => Promise<void>;
  cancelJobs: (jobIds: string[]) => Promise<void>;
  deleteJobs: (jobIds: string[]) => Promise<void>;
  
  // Selection
  selectJob: (jobId: string) => void;
  deselectJob: (jobId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  
  // Preferences
  updatePreferences: (preferences: Partial<JobPreferences>) => void;
  loadPreferences: () => void;
  savePreferences: () => void;
}

const defaultPreferences: JobPreferences = {
  defaultView: 'list',
  autoRefresh: true,
  refreshInterval: 5000,
  showNotifications: true,
  notificationTypes: {
    completed: true,
    failed: true,
    queued: false
  },
  defaultFilters: {
    dateRange: 'week'
  },
  exportSettings: {
    defaultFormat: 'csv',
    includeMetadata: true,
    dateFormat: 'yyyy-MM-dd HH:mm:ss'
  },
  displaySettings: {
    showThumbnails: true,
    compactMode: false,
    showProgress: true,
    timeFormat: '12h'
  }
};

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  selectedJobs: new Set(),
  preferences: defaultPreferences,

  fetchJobs: async () => {
    try {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      
      const data = await response.json();
      set({ jobs: data.jobs });
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      // In development, use mock data
      if (process.env.NODE_ENV === 'development') {
        // Mock data is handled by hooks
      }
    }
  },

  addJob: (job) => {
    set((state) => ({
      jobs: [...state.jobs, job]
    }));
  },

  updateJob: (jobId, updates) => {
    set((state) => ({
      jobs: state.jobs.map(job =>
        job.id === jobId ? { ...job, ...updates } : job
      )
    }));
  },

  deleteJob: async (jobId) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete job');
      
      set((state) => ({
        jobs: state.jobs.filter(job => job.id !== jobId),
        selectedJobs: new Set([...state.selectedJobs].filter(id => id !== jobId))
      }));
    } catch (error) {
      console.error('Failed to delete job:', error);
      throw error;
    }
  },

  retryJob: async (jobId) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to retry job');
      
      const updatedJob = await response.json();
      get().updateJob(jobId, updatedJob);
    } catch (error) {
      console.error('Failed to retry job:', error);
      throw error;
    }
  },

  cancelJob: async (jobId) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to cancel job');
      
      get().updateJob(jobId, { status: 'cancelled' });
    } catch (error) {
      console.error('Failed to cancel job:', error);
      throw error;
    }
  },

  pauseJob: async (jobId) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/pause`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to pause job');
      
      get().updateJob(jobId, { status: 'paused' as JobStatus });
    } catch (error) {
      console.error('Failed to pause job:', error);
      throw error;
    }
  },

  resumeJob: async (jobId) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/resume`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to resume job');
      
      get().updateJob(jobId, { status: 'processing' });
    } catch (error) {
      console.error('Failed to resume job:', error);
      throw error;
    }
  },

  retryJobs: async (jobIds) => {
    const promises = jobIds.map(id => get().retryJob(id));
    await Promise.all(promises);
  },

  cancelJobs: async (jobIds) => {
    const promises = jobIds.map(id => get().cancelJob(id));
    await Promise.all(promises);
  },

  deleteJobs: async (jobIds) => {
    const promises = jobIds.map(id => get().deleteJob(id));
    await Promise.all(promises);
  },

  selectJob: (jobId) => {
    set((state) => {
      const newSelection = new Set(state.selectedJobs);
      newSelection.add(jobId);
      return { selectedJobs: newSelection };
    });
  },

  deselectJob: (jobId) => {
    set((state) => {
      const newSelection = new Set(state.selectedJobs);
      newSelection.delete(jobId);
      return { selectedJobs: newSelection };
    });
  },

  selectAll: () => {
    set((state) => ({
      selectedJobs: new Set(state.jobs.map(job => job.id))
    }));
  },

  clearSelection: () => {
    set({ selectedJobs: new Set() });
  },

  updatePreferences: (updates) => {
    set((state) => ({
      preferences: { ...state.preferences, ...updates }
    }));
    get().savePreferences();
  },

  loadPreferences: () => {
    try {
      const stored = localStorage.getItem('jobPreferences');
      if (stored) {
        const preferences = JSON.parse(stored);
        set({ preferences: { ...defaultPreferences, ...preferences } });
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  },

  savePreferences: () => {
    try {
      localStorage.setItem('jobPreferences', JSON.stringify(get().preferences));
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }
}));