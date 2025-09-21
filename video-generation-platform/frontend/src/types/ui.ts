/**
 * UI Component Types and Interfaces
 * Defines types for UI components, forms, and interactions
 */

import { ReactNode, ComponentProps } from 'react'
import { LucideIcon } from 'lucide-react'

// Base component props
export interface BaseComponentProps {
  className?: string
  children?: ReactNode
  testId?: string
}

// Button component types
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface ButtonProps extends BaseComponentProps {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
}

// Input component types
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
export type InputVariant = 'default' | 'error' | 'success'

export interface InputProps extends BaseComponentProps {
  type?: InputType
  variant?: InputVariant
  placeholder?: string
  value?: string | number
  defaultValue?: string | number
  disabled?: boolean
  required?: boolean
  readOnly?: boolean
  autoFocus?: boolean
  autoComplete?: string
  maxLength?: number
  minLength?: number
  min?: number
  max?: number
  step?: number
  pattern?: string
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  error?: string
  helperText?: string
  label?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
}

// Select component types
export interface SelectOption<T = string> {
  value: T
  label: string
  disabled?: boolean
  icon?: LucideIcon
}

export interface SelectProps<T = string> extends BaseComponentProps {
  options: SelectOption<T>[]
  value?: T
  defaultValue?: T
  placeholder?: string
  disabled?: boolean
  required?: boolean
  error?: string
  helperText?: string
  label?: string
  searchable?: boolean
  multiple?: boolean
  clearable?: boolean
  loading?: boolean
  onChange?: (value: T | T[]) => void
  onSearch?: (query: string) => void
}

// Modal component types
export interface ModalProps extends BaseComponentProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  preventScroll?: boolean
}

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info'
export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface ToastOptions {
  type?: ToastType
  duration?: number
  position?: ToastPosition
  dismissible?: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

// Card component types
export interface CardProps extends BaseComponentProps {
  variant?: 'default' | 'elevated' | 'outlined'
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  header?: ReactNode
  footer?: ReactNode
}

// Badge component types
export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
export type BadgeSize = 'sm' | 'md' | 'lg'

export interface BadgeProps extends BaseComponentProps {
  variant?: BadgeVariant
  size?: BadgeSize
  icon?: LucideIcon
  dot?: boolean
}

// Progress component types
export interface ProgressProps extends BaseComponentProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'success' | 'warning' | 'error'
  showLabel?: boolean
  animated?: boolean
  indeterminate?: boolean
}

// Skeleton component types
export interface SkeletonProps extends BaseComponentProps {
  width?: string | number
  height?: string | number
  variant?: 'text' | 'rectangular' | 'circular'
  animation?: 'pulse' | 'wave' | 'none'
}

// Navigation types
export interface NavItem {
  id: string
  label: string
  icon?: LucideIcon
  path?: string
  badge?: string | number
  children?: NavItem[]
  disabled?: boolean
  external?: boolean
}

export interface BreadcrumbItem {
  label: string
  path?: string
  current?: boolean
}

// Table component types
export interface TableColumn<T = unknown> {
  key: string
  title: string
  sortable?: boolean
  width?: string | number
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, item: T, index: number) => ReactNode
}

export interface TableProps<T = unknown> extends BaseComponentProps {
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  empty?: ReactNode
  selectable?: boolean
  selectedRows?: string[]
  onSelectionChange?: (selectedRows: string[]) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (column: string, order: 'asc' | 'desc') => void
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: number) => void
  }
}

// Form types
export interface FormFieldProps extends BaseComponentProps {
  name: string
  label?: string
  required?: boolean
  error?: string
  helperText?: string
  disabled?: boolean
}

export interface FormSectionProps extends BaseComponentProps {
  title?: string
  description?: string
  collapsible?: boolean
  defaultExpanded?: boolean
}

// File upload types
export interface FileUploadProps extends BaseComponentProps {
  accept?: string
  multiple?: boolean
  maxSize?: number // bytes
  maxFiles?: number
  disabled?: boolean
  loading?: boolean
  preview?: boolean
  dragAndDrop?: boolean
  onUpload?: (files: File[]) => void
  onRemove?: (file: File) => void
  onError?: (error: string) => void
}

export interface UploadedFile {
  file: File
  id: string
  name: string
  size: number
  type: string
  url?: string
  progress?: number
  error?: string
  status: 'pending' | 'uploading' | 'completed' | 'error'
}

// Video player types
export interface VideoPlayerProps extends BaseComponentProps {
  src: string
  poster?: string
  autoPlay?: boolean
  controls?: boolean
  muted?: boolean
  loop?: boolean
  width?: number
  height?: number
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onTimeUpdate?: (currentTime: number) => void
  onLoadedMetadata?: (duration: number) => void
  onError?: (error: string) => void
}

// Timeline component types
export interface TimelineItem {
  id: string
  timestamp: string
  title: string
  description?: string
  status?: 'pending' | 'processing' | 'completed' | 'error'
  icon?: LucideIcon
  metadata?: Record<string, unknown>
}

export interface TimelineProps extends BaseComponentProps {
  items: TimelineItem[]
  variant?: 'default' | 'compact'
  showTime?: boolean
  interactive?: boolean
  onItemClick?: (item: TimelineItem) => void
}

// Layout types
export interface LayoutProps extends BaseComponentProps {
  sidebar?: ReactNode
  header?: ReactNode
  footer?: ReactNode
  sidebarCollapsed?: boolean
  onSidebarToggle?: () => void
}

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeConfig {
  mode: ThemeMode
  primaryColor: string
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  fontFamily: 'inter' | 'system' | 'mono'
}

// Animation types
export type AnimationType = 'fade' | 'slide' | 'scale' | 'bounce' | 'spin'
export type AnimationDirection = 'up' | 'down' | 'left' | 'right'

export interface AnimationProps {
  type?: AnimationType
  direction?: AnimationDirection
  duration?: number
  delay?: number
  repeat?: boolean | number
  reverse?: boolean
}

// Responsive types
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export interface ResponsiveValue<T> {
  xs?: T
  sm?: T
  md?: T
  lg?: T
  xl?: T
  '2xl'?: T
}

// Event handler types
export interface ClickHandler {
  onClick?: (event: React.MouseEvent) => void
}

export interface KeyboardHandler {
  onKeyDown?: (event: React.KeyboardEvent) => void
  onKeyUp?: (event: React.KeyboardEvent) => void
  onKeyPress?: (event: React.KeyboardEvent) => void
}

export interface FocusHandler {
  onFocus?: (event: React.FocusEvent) => void
  onBlur?: (event: React.FocusEvent) => void
}

// Accessibility types
export interface AriaProps {
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-expanded'?: boolean
  'aria-hidden'?: boolean
  'aria-disabled'?: boolean
  'aria-required'?: boolean
  'aria-invalid'?: boolean
  role?: string
}

// Component composition types
export type ComponentVariants<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K] extends readonly unknown[] ? T[K][number] : T[K]
}

export type PolymorphicComponentProps<T extends React.ElementType> = {
  as?: T
} & ComponentProps<T>

// State types
export interface LoadingState {
  isLoading: boolean
  loadingText?: string
}

export interface ErrorState {
  hasError: boolean
  error?: Error | string
  errorBoundary?: boolean
}

export interface DataState<T> extends LoadingState, ErrorState {
  data?: T
  isEmpty?: boolean
  isStale?: boolean
  lastUpdated?: Date
}
