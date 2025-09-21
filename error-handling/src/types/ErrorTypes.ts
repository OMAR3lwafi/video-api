/**
 * Comprehensive Error Types and Classification System
 * Dynamic Video Content Generation Platform
 */

// Base error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories for classification
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NETWORK = 'network',
  SERVER = 'server',
  DATABASE = 'database',
  STORAGE = 'storage',
  PROCESSING = 'processing',
  EXTERNAL_SERVICE = 'external_service',
  USER_INPUT = 'user_input',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

// Error types for specific scenarios
export enum ErrorType {
  // Validation errors
  INVALID_INPUT = 'invalid_input',
  MISSING_REQUIRED_FIELD = 'missing_required_field',
  INVALID_FORMAT = 'invalid_format',
  INVALID_FILE_TYPE = 'invalid_file_type',
  FILE_TOO_LARGE = 'file_too_large',

  // Authentication/Authorization
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  TOKEN_EXPIRED = 'token_expired',
  INVALID_CREDENTIALS = 'invalid_credentials',

  // Network errors
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  CONNECTION_LOST = 'connection_lost',
  RATE_LIMITED = 'rate_limited',

  // Server errors
  INTERNAL_SERVER_ERROR = 'internal_server_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  BAD_GATEWAY = 'bad_gateway',

  // Database errors
  DATABASE_CONNECTION_ERROR = 'database_connection_error',
  DATABASE_QUERY_ERROR = 'database_query_error',
  DATABASE_CONSTRAINT_ERROR = 'database_constraint_error',

  // Storage errors
  STORAGE_ERROR = 'storage_error',
  FILE_NOT_FOUND = 'file_not_found',
  STORAGE_QUOTA_EXCEEDED = 'storage_quota_exceeded',
  UPLOAD_FAILED = 'upload_failed',

  // Processing errors
  PROCESSING_ERROR = 'processing_error',
  FFMPEG_ERROR = 'ffmpeg_error',
  CODEC_ERROR = 'codec_error',
  RENDERING_ERROR = 'rendering_error',
  PROCESSING_TIMEOUT = 'processing_timeout',

  // External service errors
  AWS_S3_ERROR = 'aws_s3_error',
  SUPABASE_ERROR = 'supabase_error',
  THIRD_PARTY_API_ERROR = 'third_party_api_error',

  // System errors
  MEMORY_ERROR = 'memory_error',
  DISK_SPACE_ERROR = 'disk_space_error',
  CPU_OVERLOAD = 'cpu_overload',

  // Generic
  UNKNOWN_ERROR = 'unknown_error'
}

// Recovery action types
export enum RecoveryAction {
  RETRY = 'retry',
  REFRESH = 'refresh',
  LOGIN = 'login',
  CONTACT_SUPPORT = 'contact_support',
  TRY_AGAIN_LATER = 'try_again_later',
  CHECK_CONNECTION = 'check_connection',
  REDUCE_FILE_SIZE = 'reduce_file_size',
  NONE = 'none'
}

// Base error interface
export interface BaseError {
  id: string;
  type: ErrorType;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  timestamp: Date;
  context?: Record<string, any>;
  stack?: string;
  recoveryAction?: RecoveryAction;
  retryable: boolean;
}

// Application-specific error
export interface AppError extends BaseError {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  method?: string;
  statusCode?: number;
}

// Validation error details
export interface ValidationError extends AppError {
  field?: string;
  value?: any;
  constraint?: string;
  validationRules?: string[];
}

// Network error details
export interface NetworkError extends AppError {
  endpoint?: string;
  method?: string;
  statusCode?: number;
  timeout?: number;
  retryAttempt?: number;
}

// Processing error details
export interface ProcessingError extends AppError {
  jobId?: string;
  step?: string;
  progress?: number;
  estimatedTimeRemaining?: number;
  processingDetails?: Record<string, any>;
}

// Storage error details
export interface StorageError extends AppError {
  bucket?: string;
  key?: string;
  operation?: string;
  fileSize?: number;
  quotaUsed?: number;
  quotaLimit?: number;
}

// Database error details
export interface DatabaseError extends AppError {
  query?: string;
  table?: string;
  operation?: string;
  constraint?: string;
}

// Error context for tracking
export interface ErrorContext {
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
  breadcrumbs?: ErrorBreadcrumb[];
  tags?: string[];
}

// Error breadcrumb for tracking user actions
export interface ErrorBreadcrumb {
  timestamp: Date;
  category: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

// Error reporting payload
export interface ErrorReport {
  error: AppError;
  context: ErrorContext;
  environment: {
    platform: string;
    version: string;
    buildId?: string;
    nodeVersion?: string;
    browserName?: string;
    browserVersion?: string;
    os?: string;
  };
  user?: {
    id?: string;
    email?: string;
    role?: string;
  };
  session: {
    id: string;
    duration: number;
    actionsCount: number;
  };
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
  retryCondition: (error: AppError, attempt: number) => boolean;
}

// Error recovery strategy
export interface RecoveryStrategy {
  action: RecoveryAction;
  automatic: boolean;
  delay?: number;
  maxRetries?: number;
  fallbackAction?: RecoveryAction;
  userPrompt?: string;
  userOptions?: string[];
}

// Notification configuration
export interface NotificationConfig {
  type: 'toast' | 'modal' | 'inline' | 'banner';
  duration?: number;
  dismissible: boolean;
  actions?: NotificationAction[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sound?: boolean;
  vibrate?: boolean;
}

// Notification action
export interface NotificationAction {
  label: string;
  action: string;
  style?: 'primary' | 'secondary' | 'danger';
  callback?: () => void | Promise<void>;
}

// Error metrics
export interface ErrorMetrics {
  errorId: string;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  userCount: number;
  resolvedCount: number;
  averageResolutionTime: number;
  impactScore: number;
  trends: {
    hourly: number[];
    daily: number[];
    weekly: number[];
  };
}

// Error status
export enum ErrorStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  IGNORED = 'ignored'
}

// Error tracking entry
export interface ErrorTrackingEntry {
  id: string;
  error: AppError;
  report: ErrorReport;
  status: ErrorStatus;
  assignee?: string;
  resolution?: string;
  resolutionTime?: Date;
  metrics: ErrorMetrics;
  similarErrors: string[];
  userReports: number;
  priority: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Error classification rules
export interface ErrorClassificationRule {
  id: string;
  name: string;
  condition: (error: AppError) => boolean;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoveryStrategy: RecoveryStrategy;
  notificationConfig: NotificationConfig;
  retryConfig?: RetryConfig;
  enabled: boolean;
  priority: number;
}

// Error handler configuration
export interface ErrorHandlerConfig {
  enableTracking: boolean;
  enableReporting: boolean;
  enableRetry: boolean;
  enableNotifications: boolean;
  enableOfflineSupport: boolean;
  maxErrorsInMemory: number;
  reportingEndpoint?: string;
  reportingApiKey?: string;
  classificationRules: ErrorClassificationRule[];
  globalRetryConfig: RetryConfig;
  environment: 'development' | 'staging' | 'production';
}

// User feedback types
export enum FeedbackType {
  BUG_REPORT = 'bug_report',
  FEATURE_REQUEST = 'feature_request',
  IMPROVEMENT = 'improvement',
  COMPLAINT = 'complaint',
  COMPLIMENT = 'compliment',
  OTHER = 'other'
}

// User feedback entry
export interface UserFeedback {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  category: string;
  severity: ErrorSeverity;
  userId?: string;
  email?: string;
  errorId?: string;
  context: ErrorContext;
  attachments: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignee?: string;
  resolution?: string;
  userAgent: string;
  url: string;
  timestamp: Date;
  resolvedAt?: Date;
  upvotes: number;
  downvotes: number;
}

// Offline error queue entry
export interface OfflineErrorEntry {
  id: string;
  error: AppError;
  report: ErrorReport;
  timestamp: Date;
  synced: boolean;
  retryCount: number;
  nextRetryAt?: Date;
}

// Service health status
export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  uptime: number;
  version?: string;
  dependencies: ServiceHealth[];
}

// System status
export interface SystemStatus {
  overall: 'operational' | 'degraded' | 'down';
  services: ServiceHealth[];
  lastUpdate: Date;
  incidents: {
    id: string;
    title: string;
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
    severity: ErrorSeverity;
    startTime: Date;
    endTime?: Date;
    affectedServices: string[];
    description: string;
  }[];
}

// Error handler events
export type ErrorHandlerEvents = {
  'error:occurred': AppError;
  'error:handled': AppError;
  'error:retry': { error: AppError; attempt: number };
  'error:resolved': AppError;
  'error:reported': ErrorReport;
  'notification:shown': { error: AppError; config: NotificationConfig };
  'recovery:attempted': { error: AppError; strategy: RecoveryStrategy };
  'feedback:submitted': UserFeedback;
  'offline:queued': OfflineErrorEntry;
  'offline:synced': OfflineErrorEntry;
};
