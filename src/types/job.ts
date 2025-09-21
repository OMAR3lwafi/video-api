export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type JobType = 'single' | 'batch' | 'template';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface VideoElement {
  id: string;
  type: 'video' | 'image' | 'text' | 'audio';
  source: string;
  track?: number;
  x?: string;
  y?: string;
  width?: string;
  height?: string;
  fit_mode?: 'auto' | 'contain' | 'cover' | 'fill';
  start_time?: number;
  end_time?: number;
  effects?: VideoEffect[];
}

export interface VideoEffect {
  type: 'fade_in' | 'fade_out' | 'zoom' | 'blur' | 'rotate';
  duration?: number;
  intensity?: number;
  params?: Record<string, any>;
}

export interface Job {
  id: string;
  name?: string;
  status: JobStatus;
  type: JobType;
  priority?: JobPriority;
  templateId?: string;
  templateName?: string;
  userId?: string;
  organizationId?: string;
  
  // Input/Output
  inputData?: Record<string, any>;
  outputFormat?: 'mp4' | 'mov' | 'avi' | 'webm';
  resultUrl?: string;
  thumbnailUrl?: string;
  
  // Video Configuration
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  elements?: VideoElement[];
  
  // Progress & Timing
  progress?: number;
  currentStep?: string;
  estimatedCompletion?: string;
  queuePosition?: number;
  
  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  
  // Performance
  processingTime?: string;
  fileSize?: string;
  duration?: string;
  
  // Error Handling
  error?: string;
  errorCode?: string;
  errorDetails?: Record<string, any>;
  retryCount?: number;
  maxRetries?: number;
  
  // Metadata
  tags?: string[];
  metadata?: Record<string, any>;
  source?: 'api' | 'ui' | 'batch' | 'webhook';
  webhookUrl?: string;
  
  // Batch Related
  batchId?: string;
  batchPosition?: number;
  batchTotal?: number;
  
  // Cost & Usage
  cost?: number;
  credits?: number;
  resourceUsage?: {
    cpu?: number;
    memory?: number;
    storage?: number;
  };
}

export interface JobStatistics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  processingJobs: number;
  queuedJobs: number;
  successRate: number;
  avgProcessingTime: number;
  totalProcessingTime: number;
}

export interface JobInsight {
  type: 'improvement' | 'warning' | 'issue';
  title: string;
  description: string;
  metric?: string;
  value?: number;
  action?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface JobAnalytics {
  metrics: {
    totalJobs: number;
    activeJobs: number;
    queuedJobs: number;
    successRate: number;
    avgProcessingTime: number;
    jobsGrowth: number;
    successRateChange: number;
    processingTimeChange: number;
    queueEfficiency: number;
    resourceUtilization: number;
  };
  
  statusDistribution: {
    completed: number;
    failed: number;
    processing: number;
    queued: number;
    cancelled: number;
  };
  
  jobTypeDistribution: {
    single: number;
    batch: number;
    template: number;
  };
  
  processingTimeDistribution: {
    quick: number; // <30s
    normal: number; // 30s-2m
    slow: number; // 2m-5m
    verySlow: number; // >5m
  };
  
  timeSeries: Array<{
    date: string;
    jobs: number;
    successful: number;
    failed: number;
    avgDuration: number;
    successRate: number;
  }>;
  
  topTemplates?: Array<{
    id: string;
    name: string;
    count: number;
    successRate: number;
  }>;
  
  insights?: JobInsight[];
}

export interface JobPreferences {
  defaultView: 'list' | 'grid';
  autoRefresh: boolean;
  refreshInterval: number;
  showNotifications: boolean;
  notificationTypes: {
    completed: boolean;
    failed: boolean;
    queued: boolean;
  };
  defaultFilters: {
    status?: JobStatus[];
    type?: JobType[];
    dateRange?: 'today' | 'week' | 'month';
  };
  exportSettings: {
    defaultFormat: 'csv' | 'json' | 'excel' | 'pdf';
    includeMetadata: boolean;
    dateFormat: string;
  };
  displaySettings: {
    showThumbnails: boolean;
    compactMode: boolean;
    showProgress: boolean;
    timeFormat: '12h' | '24h';
  };
}