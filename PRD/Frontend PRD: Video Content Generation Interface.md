# Frontend PRD: Video Content Generation Interface (Updated)

## Project Overview

### Product Name
Dynamic Video Content Generation Frontend Interface

### Purpose
A modern web interface that provides an intuitive user experience for creating custom video content by combining multiple media elements. The updated frontend now handles the dual response system (immediate AWS S3 URLs for quick processing or job IDs for longer processing) and provides seamless user experience for both scenarios.

### Updated Features
- **Dual Response Handling**: Automatically handles both immediate results and job-based processing
- **S3 Integration**: Direct access to AWS S3 public URLs for processed videos
- **Smart Progress Tracking**: Different UI flows for quick vs async processing
- **Download Management**: Integrated download functionality for completed videos
- **Enhanced Real-time Updates**: Live status updates with S3 upload progress

---

## Updated Component Architecture

### 1. Enhanced Video Creator Component

#### VideoCreator.tsx (Updated)
```typescript
import React, { useState, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { ElementPanel } from './ElementPanel';
import { CanvasPreview } from './CanvasPreview';
import { PropertiesPanel } from './PropertiesPanel';
import { ProcessingHandler } from './ProcessingHandler';

export const VideoCreator: React.FC = () => {
  const {
    currentProject,
    selectedElementId,
    isProcessing,
    addElement,
    updateElement,
    removeElement,
    createVideo
  } = useAppStore();
  
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);

  const handleCreateVideo = useCallback(async () => {
    try {
      const jobData = {
        output_format: currentProject.settings.output_format,
        width: currentProject.settings.width,
        height: currentProject.settings.height,
        elements: currentProject.elements,
      };
      
      const result = await createVideo(jobData);
      setProcessingResult(result);
    } catch (error) {
      console.error('Failed to create video:', error);
    }
  }, [currentProject, createVideo]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Element Panel */}
          <div className="col-span-3">
            <ElementPanel
              elements={currentProject.elements}
              onElementAdd={addElement}
              onElementUpdate={updateElement}
              onElementRemove={removeElement}
            />
          </div>

          {/* Canvas Preview */}
          <div className="col-span-6">
            <CanvasPreview
              width={currentProject.settings.width}
              height={currentProject.settings.height}
              elements={currentProject.elements}
              selectedElementId={selectedElementId}
            />
            
            {/* Create Video Button */}
            <div className="mt-4 text-center">
              <button
                onClick={handleCreateVideo}
                disabled={isProcessing || currentProject.elements.length === 0}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isProcessing ? 'Creating...' : 'Create Video'}
              </button>
            </div>
          </div>

          {/* Properties Panel */}
          <div className="col-span-3">
            <PropertiesPanel />
          </div>
        </div>

        {/* Processing Handler - Shows different UI based on response type */}
        {processingResult && (
          <div className="mt-8">
            <ProcessingHandler
              result={processingResult}
              onComplete={() => setProcessingResult(null)}
              onError={() => setProcessingResult(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Updated processing result types
interface ProcessingResult {
  type: 'immediate' | 'async';
  data: ImmediateResult | AsyncResult;
}

interface ImmediateResult {
  status: 'completed';
  result_url: string;
  job_id: string;
  file_size: string;
  processing_time: string;
  message: string;
}

interface AsyncResult {
  status: 'processing';
  job_id: string;
  message: string;
  estimated_completion: string;
  status_check_endpoint: string;
}
```

### 2. New Processing Handler Component

#### ProcessingHandler.tsx
```typescript
import React from 'react';
import { ImmediateVideoResult } from './ImmediateVideoResult';
import { AsyncVideoTracker } from './AsyncVideoTracker';

interface ProcessingHandlerProps {
  result: ProcessingResult;
  onComplete: () => void;
  onError: () => void;
}

export const ProcessingHandler: React.FC<ProcessingHandlerProps> = ({
  result,
  onComplete,
  onError
}) => {
  if (result.type === 'immediate') {
    return (
      <ImmediateVideoResult
        result={result.data as ImmediateResult}
        onClose={onComplete}
      />
    );
  } else {
    return (
      <AsyncVideoTracker
        jobId={(result.data as AsyncResult).job_id}
        estimatedCompletion={(result.data as AsyncResult).estimated_completion}
        onJobCompleted={onComplete}
        onJobFailed={onError}
      />
    );
  }
};
```

### 3. Immediate Result Component

#### ImmediateVideoResult.tsx
```typescript
import React, { useState } from 'react';
import { CheckCircleIcon, DownloadIcon, ShareIcon, PlayIcon } from '@heroicons/react/24/solid';

interface ImmediateVideoResultProps {
  result: ImmediateResult;
  onClose: () => void;
}

export const ImmediateVideoResult: React.FC<ImmediateVideoResultProps> = ({
  result,
  onClose
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(result.result_url);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `video_${result.job_id}.mp4`;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Generated Video',
          text: 'Check out this video I created!',
          url: result.result_url,
        });
      } catch (error) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(result.result_url);
        alert('Video URL copied to clipboard!');
      }
    } else {
      await navigator.clipboard.writeText(result.result_url);
      alert('Video URL copied to clipboard!');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-green-200">
      <div className="flex items-center mb-4">
        <CheckCircleIcon className="h-8 w-8 text-green-500 mr-3" />
        <div>
          <h3 className="text-xl font-semibold text-green-800">Video Ready!</h3>
          <p className="text-green-600">
            Processed in {result.processing_time} â€¢ {result.file_size}
          </p>
        </div>
      </div>

      {/* Video Preview */}
      <div className="mb-6">
        {showPreview ? (
          <video
            controls
            className="w-full max-w-md mx-auto rounded-lg shadow-md"
            src={result.result_url}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="w-full max-w-md mx-auto bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <PlayIcon className="h-5 w-5" />
              <span>Preview Video</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <DownloadIcon className="h-5 w-5" />
          <span>{isDownloading ? 'Downloading...' : 'Download Video'}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <ShareIcon className="h-5 w-5" />
          <span>Share Link</span>
        </button>

        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          Create Another
        </button>
      </div>

      {/* Technical Details */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <details>
          <summary className="text-sm text-gray-600 cursor-pointer">Technical Details</summary>
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            <p><strong>Job ID:</strong> {result.job_id}</p>
            <p><strong>Direct URL:</strong> <a href={result.result_url} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Open in new tab</a></p>
            <p><strong>File Size:</strong> {result.file_size}</p>
            <p><strong>Processing Time:</strong> {result.processing_time}</p>
          </div>
        </details>
      </div>
    </div>
  );
};
```

### 4. Enhanced Async Video Tracker

#### AsyncVideoTracker.tsx
```typescript
import React from 'react';
import { useJobTracking } from '../../hooks/useJobTracking';
import { JobProgressIndicator } from './JobProgressIndicator';
import { ImmediateVideoResult } from './ImmediateVideoResult';

interface AsyncVideoTrackerProps {
  jobId: string;
  estimatedCompletion: string;
  onJobCompleted: (result: CompletedJobResult) => void;
  onJobFailed: (error: JobError) => void;
}

export const AsyncVideoTracker: React.FC<AsyncVideoTrackerProps> = ({
  jobId,
  estimatedCompletion,
  onJobCompleted,
  onJobFailed
}) => {
  const { jobStatus, error } = useJobTracking(jobId);

  // Handle completed job
  React.useEffect(() => {
    if (jobStatus?.status === 'completed' && jobStatus.result_url) {
      onJobCompleted({
        job_id: jobId,
        result_url: jobStatus.result_url,
        file_size: jobStatus.file_size || 'Unknown',
        duration: jobStatus.duration || 'Unknown',
        processing_time: jobStatus.processing_time || 'Unknown'
      });
    } else if (jobStatus?.status === 'failed') {
      onJobFailed({
        job_id: jobId,
        error: jobStatus.error || 'UNKNOWN_ERROR',
        message: jobStatus.message || 'Processing failed'
      });
    }
  }, [jobStatus, jobId, onJobCompleted, onJobFailed]);

  // Show immediate result if job completed
  if (jobStatus?.status === 'completed' && jobStatus.result_url) {
    return (
      <ImmediateVideoResult
        result={{
          status: 'completed',
          result_url: jobStatus.result_url,
          job_id: jobId,
          file_size: jobStatus.file_size || 'Unknown',
          processing_time: jobStatus.processing_time || 'Unknown',
          message: 'Video processing completed successfully'
        }}
        onClose={() => onJobCompleted({
          job_id: jobId,
          result_url: jobStatus.result_url,
          file_size: jobStatus.file_size || 'Unknown',
          duration: jobStatus.duration || 'Unknown',
          processing_time: jobStatus.processing_time || 'Unknown'
        })}
      />
    );
  }

  // Show error state
  if (jobStatus?.status === 'failed' || error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <svg className="h-8 w-8 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-xl font-semibold text-red-800">Processing Failed</h3>
            <p className="text-red-600">Job ID: {jobId}</p>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-red-700">{jobStatus?.message || error?.message || 'An unexpected error occurred'}</p>
        </div>

        <button
          onClick={() => onJobFailed({ 
            job_id: jobId, 
            error: 'PROCESSING_FAILED', 
            message: jobStatus?.message || 'Unknown error' 
          })}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Show processing state
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-blue-800 mb-2">Processing Your Video</h3>
        <p className="text-blue-600">Job ID: {jobId}</p>
        <p className="text-sm text-gray-600">Estimated completion: {estimatedCompletion}</p>
      </div>

      <JobProgressIndicator jobStatus={jobStatus} />

      {/* Processing Steps Visualization */}
      {jobStatus && (
        <div className="mt-6">
          <ProcessingStepsVisualization
            currentStep={jobStatus.current_step}
            status={jobStatus.status}
          />
        </div>
      )}
    </div>
  );
};

// Processing steps visualization component
const ProcessingStepsVisualization: React.FC<{
  currentStep?: string;
  status: string;
}> = ({ currentStep, status }) => {
  const steps = [
    { key: 'downloading', label: 'Downloading Media', icon: 'ðŸ“¥' },
    { key: 'processing', label: 'Processing Video', icon: 'ðŸŽ¬' },
    { key: 'uploading', label: 'Uploading to Storage', icon: 'â˜ï¸' },
    { key: 'completed', label: 'Ready!', icon: 'âœ…' }
  ];

  const getStepStatus = (stepKey: string): 'completed' | 'current' | 'pending' => {
    if (status === 'completed') return 'completed';
    if (currentStep && currentStep.includes(stepKey)) return 'current';
    
    const stepIndex = steps.findIndex(s => s.key === stepKey);
    const currentIndex = steps.findIndex(s => currentStep?.includes(s.key));
    
    return stepIndex < currentIndex ? 'completed' : 'pending';
  };

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const stepStatus = getStepStatus(step.key);
        
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm
                ${stepStatus === 'completed' ? 'bg-green-500 text-white' : ''}
                ${stepStatus === 'current' ? 'bg-blue-500 text-white animate-pulse' : ''}
                ${stepStatus === 'pending' ? 'bg-gray-200 text-gray-500' : ''}
              `}>
                {stepStatus === 'completed' ? 'âœ“' : step.icon}
              </div>
              <span className={`
                text-xs mt-2 text-center max-w-20
                ${stepStatus === 'current' ? 'text-blue-600 font-medium' : ''}
                ${stepStatus === 'completed' ? 'text-green-600' : ''}
                ${stepStatus === 'pending' ? 'text-gray-500' : ''}
              `}>
                {step.label}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div className={`
                flex-1 h-1 mx-2
                ${getStepStatus(steps[index + 1].key) === 'completed' ? 'bg-green-500' : 'bg-gray-200'}
              `} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

interface CompletedJobResult {
  job_id: string;
  result_url: string;
  file_size: string;
  duration: string;
  processing_time: string;
}
```

---

## Updated State Management

### Enhanced App Store (appStore.ts)
```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { api } from '../services/api';

interface AppState {
  // Project state
  currentProject: {
    settings: OutputSettings;
    elements: ElementConfig[];
    isDirty: boolean;
  };
  
  // Job state
  activeJobs: Map<string, JobProgress>;
  completedJobs: CompletedJobResult[];
  
  // UI state
  isProcessing: boolean;
  selectedElementId?: string;
  
  // Actions
  addElement: (element: ElementConfig) => void;
  updateElement: (id: string, updates: Partial<ElementConfig>) => void;
  removeElement: (id: string) => void;
  createVideo: (projectData: VideoCreationForm) => Promise<ProcessingResult>;
  addCompletedJob: (job: CompletedJobResult) => void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    currentProject: {
      settings: {
        output_format: 'mp4',
        width: 720,
        height: 1280,
        quality: 'high',
        fps: 30,
      },
      elements: [],
      isDirty: false,
    },
    
    activeJobs: new Map(),
    completedJobs: [],
    isProcessing: false,
    
    addElement: (element) => set((state) => ({
      currentProject: {
        ...state.currentProject,
        elements: [...state.currentProject.elements, element],
        isDirty: true,
      }
    })),
    
    updateElement: (id, updates) => set((state) => ({
      currentProject: {
        ...state.currentProject,
        elements: state.currentProject.elements.map(el => 
          el.id === id ? { ...el, ...updates } : el
        ),
        isDirty: true,
      }
    })),
    
    removeElement: (id) => set((state) => ({
      currentProject: {
        ...state.currentProject,
        elements: state.currentProject.elements.filter(el => el.id !== id),
        isDirty: true,
      }
    })),
    
    createVideo: async (projectData) => {
      set({ isProcessing: true });
      try {
        const response = await api.createVideo(projectData);
        
        // Determine response type based on status
        if (response.status === 'completed') {
          // Immediate response with direct URL
          const result: ProcessingResult = {
            type: 'immediate',
            data: response as ImmediateResult
          };
          
          // Add to completed jobs
          get().addCompletedJob({
            job_id: response.job_id,
            result_url: response.result_url,
            file_size: response.file_size,
            duration: 'N/A', // Not provided in immediate response
            processing_time: response.processing_time
          });
          
          return result;
        } else {
          // Async response with job ID
          return {
            type: 'async',
            data: response as AsyncResult
          };
        }
      } finally {
        set({ isProcessing: false });
      }
    },
    
    addCompletedJob: (job) => set((state) => ({
      completedJobs: [job, ...state.completedJobs.slice(0, 9)] // Keep last 10
    }))
  }))
);
```

---

## Updated API Service

### Enhanced API Service (api.ts)
```typescript
import axios, { AxiosInstance } from 'axios';

export class VideoGenerationAPI {
  private httpClient: AxiosInstance;

  constructor(baseURL: string) {
    this.httpClient = axios.create({
      baseURL,
      timeout: 60000, // Increased timeout for potential immediate processing
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Updated to handle both immediate and async responses
  async createVideo(jobData: VideoCreationForm): Promise<ImmediateResult | AsyncResult> {
    const response = await this.httpClient.post('/videocreate', jobData);
    return response.data;
  }

  // Enhanced job status checking
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await this.httpClient.get(`/videoresult/${jobId}`);
    return response.data;
  }

  // New method to check if URL is accessible
  async verifyVideoUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Updated response types
export interface ImmediateResult {
  status: 'completed';
  processing_time: string;
  result_url: string;
  job_id: string;
  file_size: string;
  message: string;
}

export interface AsyncResult {
  status: 'processing';
  job_id: string;
  message: string;
  estimated_completion: string;
  status_check_endpoint: string;
}

export interface JobStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  job_id: string;
  progress?: string;
  current_step?: string;
  message: string;
  result_url?: string;
  file_size?: string;
  duration?: string;
  processing_time?: string;
  error?: string;
  details?: string;
}
```

---

## Updated Job Tracking Hook

### Enhanced Job Tracking Hook (useJobTracking.ts)
```typescript
import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { databaseService } from '../services/database';

export const useJobTracking = (jobId: string) => {
  const [jobStatus, setJobStatus] = useState<JobProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;

    // Initial status fetch
    const fetchInitialStatus = async () => {
      try {
        const status = await api.getJobStatus(jobId);
        if (isMounted) {
          setJobStatus(transformApiResponse(status));
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
        }
      }
    };

    fetchInitialStatus();

    // Try real-time subscription first
    if (databaseService.isAvailable()) {
      const sub = databaseService.subscribeToJobUpdates(jobId, (updatedJob) => {
        if (isMounted) {
          setJobStatus(updatedJob);
        }
      });
      setSubscription(sub);
    } else {
      // Fallback to polling
      pollingInterval.current = setInterval(async () => {
        try {
          const status = await api.getJobStatus(jobId);
          if (isMounted) {
            setJobStatus(transformApiResponse(status));
            
            // Stop polling if job is complete
            if (['completed', 'failed', 'cancelled'].includes(status.status)) {
              if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
                pollingInterval.current = null;
              }
            }
          }
        } catch (err) {
          if (isMounted) {
            setError(err as Error);
          }
        }
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      isMounted = false;
      
      if (subscription) {
        subscription.unsubscribe();
      }
      
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [jobId]);

  const transformApiResponse = (response: JobStatusResponse): JobProgress => ({
    jobId: response.job_id,
    status: response.status,
    progress: response.progress ? parseInt(response.progress) : 0,
    current_step: response.current_step,
    message: response.message,
    result_url: response.result_url,
    file_size: response.file_size,
    duration: response.duration,
    processing_time: response.processing_time,
    error: response.error
  });

  return { jobStatus, error, isSubscribed: !!subscription };
};

interface JobProgress {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  current_step?: string;
  message: string;
  result_url?: string;
  file_size?: string;
  duration?: string;
  processing_time?: string;
  error?: string;
}
```

---

## Updated Validation Schemas

### Enhanced Form Validation (validation.ts)
```typescript
import { z } from 'zod';

// Updated validation to match backend expectations
const VideoCreationFormSchema = z.object({
  output_format: z.enum(['mp4', 'mov', 'avi']),
  width: z.number().min(240).max(4096),
  height: z.number().min(240).max(4096),
  elements: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(['video', 'image']),
    source: z.string().url(),
    track: z.number().min(1),
    time: z.number().min(0).optional(),
    x: z.string().regex(/^\d+(\.\d+)?%$/).optional(),
    y: z.string().regex(/^\d+(\.\d+)?%$/).optional(),
    width: z.string().regex(/^\d+(\.\d+)?%$/).optional(),
    height: z.string().regex(/^\d+(\.\d+)?%$/).optional(),
    fit_mode: z.enum(['auto', 'contain', 'cover', 'fill']).optional(),
    duration_mode: z.enum(['auto', 'original', 'custom']).optional(),
    opacity: z.string().regex(/^\d+(\.\d+)?%$/).optional(),
  })).min(1).max(10),
});

// Response validation schemas
const ImmediateResponseSchema = z.object({
  status: z.literal('completed'),
  processing_time: z.string(),
  result_url: z.string().url(),
  job_id: z.string(),
  file_size: z.string(),
  message: z.string(),
});

const AsyncResponseSchema = z.object({
  status: z.literal('processing'),
  job_id: z.string(),
  message: z.string(),
  estimated_completion: z.string(),
  status_check_endpoint: z.string(),
});

export const useFormValidation = () => {
  const validateVideoCreation = (data: any) => {
    try {
      VideoCreationFormSchema.parse(data);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        };
      }
      return { isValid: false, errors: [{ path: 'general', message: 'Validation failed' }] };
    }
  };

  const validateResponse = (data: any): 'immediate' | 'async' | 'invalid' => {
    if (ImmediateResponseSchema.safeParse(data).success) {
      return 'immediate';
    }
    if (AsyncResponseSchema.safeParse(data).success) {
      return 'async';
    }
    return 'invalid';
  };

  return { validateVideoCreation, validateResponse };
};
```

---

## Performance Optimizations

### Smart Caching for Completed Videos
```typescript
// Enhanced video cache service
class VideoCache {
  private cache = new Map<string, CompletedJobResult>();
  private maxSize = 50;

  set(jobId: string, result: CompletedJobResult) {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(jobId, result);
    
    // Persist to localStorage
    try {
      const cacheData = Array.from(this.cache.entries());
      localStorage.setItem('videoCache', JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to persist video cache:', error);
    }
  }

  get(jobId: string): CompletedJobResult | null {
    return this.cache.get(jobId) || null;
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('videoCache');
      if (stored) {
        const cacheData = JSON.parse(stored);
        this.cache = new Map(cacheData);
      }
    } catch (error) {
      console.warn('Failed to load video cache:', error);
    }
  }

  async verifyUrls() {
    // Verify that cached URLs are still accessible
    for (const [jobId, result] of this.cache.entries()) {
      const isAccessible = await api.verifyVideoUrl(result.result_url);
      if (!isAccessible) {
        this.cache.delete(jobId);
      }
    }
  }
}

export const videoCache = new VideoCache();
```

This updated Frontend PRD now fully supports the AWS S3 integration with the dual response system (immediate URLs for quick processing, job IDs for longer processing). The components intelligently handle both scenarios and provide a seamless user experience regardless of processing time.