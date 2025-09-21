export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  correlationId?: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  correlationId?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface HealthCheckResponse {
  ok: boolean;
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    s3: ServiceStatus;
    ffmpeg: ServiceStatus;
  };
}

export interface ServiceStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  lastCheck: string;
  error?: string;
}

// Video processing related types
export interface VideoElement {
  id: string;
  type: 'video' | 'image';
  source: string; // URL
  track: number;
  x?: string; // percentage
  y?: string; // percentage
  width?: string; // percentage
  height?: string; // percentage
  fit_mode?: 'auto' | 'contain' | 'cover' | 'fill';
}

export interface VideoCreateRequest {
  output_format: 'mp4' | 'mov' | 'avi';
  width: number;
  height: number;
  elements: VideoElement[];
}

export interface ImmediateResponse {
  status: 'completed';
  processing_time: string;
  result_url: string; // AWS S3 public URL
  job_id: string;
  file_size: string;
  message: string;
}

export interface AsyncResponse {
  status: 'processing';
  job_id: string;
  message: string;
  estimated_completion: string;
  status_check_endpoint: string;
}

export interface JobStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  job_id: string;
  progress?: string | undefined; // percentage
  current_step?: string | undefined;
  message: string;
  result_url?: string | undefined; // when completed
  file_size?: string | undefined;
  duration?: string | undefined;
  processing_time?: string | undefined;
  error?: string | undefined; // when failed
  estimated_time_remaining?: string | undefined;
}
