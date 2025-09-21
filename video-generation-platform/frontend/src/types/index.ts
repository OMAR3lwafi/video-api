/**
 * Type definitions index file
 * Re-exports all type definitions for easy importing
 */

// API types
export type {
  ApiResponse,
  PaginatedResponse,
  VideoElement,
  VideoCreateRequest,
  ImmediateResponse,
  AsyncResponse,
  JobStatusResponse,
  JobListItem,
  HealthResponse,
  ErrorResponse,
  UploadResponse,
  FileValidation,
  SystemLimits,
  AnalyticsData,
  WebSocketMessage,
  JobUpdateMessage,
  ApiEndpoints,
} from './api'

export type {
  VideoElementType,
  FitMode,
  OutputFormat,
  JobStatus,
  WebSocketMessageType,
} from './api'

// UI types
export type {
  BaseComponentProps,
  ButtonProps,
  InputProps,
  SelectProps,
  SelectOption,
  ModalProps,
  ToastOptions,
  CardProps,
  BadgeProps,
  ProgressProps,
  SkeletonProps,
  NavItem,
  BreadcrumbItem,
  TableColumn,
  TableProps,
  FormFieldProps,
  FormSectionProps,
  FileUploadProps,
  UploadedFile,
  VideoPlayerProps,
  TimelineItem,
  TimelineProps,
  LayoutProps,
  ThemeConfig,
  AnimationProps,
  ResponsiveValue,
  AriaProps,
  LoadingState,
  ErrorState,
  DataState,
} from './ui'

export type {
  ButtonVariant,
  ButtonSize,
  InputType,
  InputVariant,
  ToastType,
  ToastPosition,
  BadgeVariant,
  BadgeSize,
  ThemeMode,
  AnimationType,
  AnimationDirection,
  Breakpoint,
} from './ui'

// Video types
export type {
  VideoDimensions,
  VideoElementWithState,
  VideoAnimation,
  VideoEffect,
  VideoProject,
  VideoExport,
  VideoEditorState,
  VideoElementValidation,
  VideoProcessingOptions,
  VideoTemplate,
  Asset,
  ColorPalette,
  FontDefinition,
  EditorTool,
  KeyboardShortcut,
  ExportPreset,
  PerformanceMetrics,
  VideoError,
  ValidationResult,
} from './video'

export type {
  VideoPreset,
  AnimationEasing,
  AssetType,
  VideoErrorType,
} from './video'

export { VIDEO_PRESETS } from './video'

// Common utility types
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type Maybe<T> = T | null | undefined

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P]
}

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

export type PickByType<T, U> = {
  [P in keyof T as T[P] extends U ? P : never]: T[P]
}

export type OmitByType<T, U> = {
  [P in keyof T as T[P] extends U ? never : P]: T[P]
}

// Event handler types
export type EventHandler<T = Element> = (event: React.SyntheticEvent<T>) => void
export type ChangeHandler<T = HTMLInputElement> = (event: React.ChangeEvent<T>) => void
export type ClickHandler<T = HTMLButtonElement> = (event: React.MouseEvent<T>) => void
export type KeyboardHandler<T = Element> = (event: React.KeyboardEvent<T>) => void

// Generic data fetching types
export interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export interface PaginationState {
  page: number
  pageSize: number
  total: number
  hasNext: boolean
  hasPrev: boolean
}

export interface SortState {
  field: string
  order: 'asc' | 'desc'
}

export interface FilterState {
  [key: string]: unknown
}

// Form types
export interface FormField<T = unknown> {
  name: string
  value: T
  error?: string
  touched: boolean
  dirty: boolean
}

export interface FormState<T extends Record<string, unknown>> {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  dirty: Partial<Record<keyof T, boolean>>
  isValid: boolean
  isSubmitting: boolean
  submitCount: number
}

// Route types
export interface RouteParams {
  [key: string]: string | undefined
}

export interface LocationState {
  [key: string]: unknown
}

// Configuration types
export interface AppConfig {
  api: {
    baseUrl: string
    timeout: number
    retries: number
  }
  features: {
    realtime: boolean
    analytics: boolean
    collaboration: boolean
  }
  limits: {
    maxFileSize: number
    maxElements: number
    maxDuration: number
  }
  ui: {
    theme: ThemeMode
    animations: boolean
    sounds: boolean
  }
}

// Store types
export interface StoreSlice<T> {
  state: T
  actions: Record<string, (...args: any[]) => void>
}

// Middleware types
export interface MiddlewareContext<T> {
  state: T
  action: string
  payload: unknown
  dispatch: (action: string, payload?: unknown) => void
}

export type Middleware<T> = (context: MiddlewareContext<T>) => void

// Plugin types
export interface Plugin {
  name: string
  version: string
  install: (app: unknown) => void
  uninstall?: (app: unknown) => void
}

// Service types
export interface Service<T = unknown> {
  initialize(): Promise<void>
  cleanup(): Promise<void>
  getState(): T
}

// Error types
export interface AppError extends Error {
  code: string
  context?: Record<string, unknown>
  recoverable: boolean
}

export interface ValidationError extends AppError {
  field: string
  value: unknown
}

export interface NetworkError extends AppError {
  status: number
  response?: unknown
}

// Analytics types
export interface AnalyticsEvent {
  name: string
  properties?: Record<string, unknown>
  timestamp: Date
  userId?: string
  sessionId: string
}

export interface AnalyticsProvider {
  track(event: AnalyticsEvent): void
  identify(userId: string, properties?: Record<string, unknown>): void
  page(name: string, properties?: Record<string, unknown>): void
}

// Feature flag types
export interface FeatureFlag {
  key: string
  enabled: boolean
  variants?: Record<string, unknown>
  conditions?: Array<{
    property: string
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'nin'
    value: unknown
  }>
}

export interface FeatureFlagProvider {
  isEnabled(key: string): boolean
  getVariant(key: string): unknown
  getAllFlags(): Record<string, FeatureFlag>
}
