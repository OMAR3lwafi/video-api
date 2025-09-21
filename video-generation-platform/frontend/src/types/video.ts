/**
 * Video-specific types and interfaces
 * Defines types for video processing, elements, and creation workflow
 */

import { VideoElement, OutputFormat, FitMode } from './api'

// Video canvas dimensions
export interface VideoDimensions {
  width: number
  height: number
  aspectRatio?: string
}

// Common video presets
export const VIDEO_PRESETS: Record<string, VideoDimensions> = {
  '16:9_HD': { width: 1280, height: 720, aspectRatio: '16:9' },
  '16:9_FHD': { width: 1920, height: 1080, aspectRatio: '16:9' },
  '16:9_4K': { width: 3840, height: 2160, aspectRatio: '16:9' },
  '9:16_MOBILE': { width: 720, height: 1280, aspectRatio: '9:16' },
  '9:16_FHD': { width: 1080, height: 1920, aspectRatio: '9:16' },
  '1:1_SQUARE': { width: 1080, height: 1080, aspectRatio: '1:1' },
  '4:3_STANDARD': { width: 1024, height: 768, aspectRatio: '4:3' },
  '21:9_ULTRAWIDE': { width: 2560, height: 1080, aspectRatio: '21:9' },
} as const

export type VideoPreset = keyof typeof VIDEO_PRESETS

// Extended video element with UI state
export interface VideoElementWithState extends VideoElement {
  // UI state properties
  selected?: boolean
  locked?: boolean
  visible?: boolean
  name?: string
  
  // Validation state
  isValid?: boolean
  validationErrors?: string[]
  
  // Loading state
  isLoading?: boolean
  loadingProgress?: number
  
  // Preview data
  thumbnail?: string
  metadata?: {
    originalWidth?: number
    originalHeight?: number
    duration?: number
    format?: string
    size?: number
    fps?: number
  }
  
  // Transform state
  transform?: {
    scale: number
    rotation: number
    position: { x: number; y: number }
    anchor: { x: number; y: number }
  }
  
  // Animation properties
  animations?: VideoAnimation[]
  
  // Effects
  effects?: VideoEffect[]
}

// Animation types
export type AnimationEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce' | 'elastic'

export interface VideoAnimation {
  id: string
  type: 'fade' | 'slide' | 'scale' | 'rotate' | 'custom'
  startTime: number // seconds
  duration: number // seconds
  easing: AnimationEasing
  properties: Record<string, { from: unknown; to: unknown }>
  delay?: number
}

// Effect types
export interface VideoEffect {
  id: string
  type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'hue' | 'sepia' | 'grayscale' | 'invert'
  intensity: number // 0-100
  enabled: boolean
}

// Video project interface
export interface VideoProject {
  id: string
  name: string
  description?: string
  
  // Canvas properties
  dimensions: VideoDimensions
  duration: number // seconds
  fps: number
  backgroundColor: string
  
  // Output settings
  outputFormat: OutputFormat
  quality: 'low' | 'medium' | 'high' | 'ultra'
  
  // Elements
  elements: VideoElementWithState[]
  
  // Audio
  audio?: {
    backgroundMusic?: {
      source: string
      volume: number
      loop: boolean
      fadeIn?: number
      fadeOut?: number
    }
    narration?: {
      source: string
      volume: number
      startTime: number
    }
  }
  
  // Timeline
  timeline: {
    currentTime: number
    zoom: number
    selectedRange?: { start: number; end: number }
  }
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  version: number
  thumbnail?: string
  
  // Collaboration
  isShared?: boolean
  collaborators?: string[]
  
  // Export history
  exports?: VideoExport[]
}

// Video export record
export interface VideoExport {
  id: string
  jobId: string
  timestamp: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
  settings: {
    format: OutputFormat
    quality: string
    dimensions: VideoDimensions
  }
  resultUrl?: string
  fileSize?: number
  processingTime?: number
  error?: string
}

// Video editor state
export interface VideoEditorState {
  // Current project
  project: VideoProject | null
  
  // UI state
  isPlaying: boolean
  currentTime: number
  zoom: number
  selectedElements: string[]
  clipboard: VideoElementWithState[]
  
  // Tools
  activeTool: 'select' | 'text' | 'image' | 'video' | 'shape' | 'crop'
  
  // Panels
  panels: {
    timeline: boolean
    properties: boolean
    assets: boolean
    effects: boolean
  }
  
  // History
  history: {
    past: VideoProject[]
    present: VideoProject
    future: VideoProject[]
    canUndo: boolean
    canRedo: boolean
  }
  
  // Performance
  previewQuality: 'low' | 'medium' | 'high'
  autoSave: boolean
  lastSaved?: Date
}

// File validation for video elements
export interface VideoElementValidation {
  maxFileSize: number // bytes
  allowedTypes: string[]
  maxDuration?: number // seconds
  maxDimensions?: VideoDimensions
  minDimensions?: VideoDimensions
}

// Video processing options
export interface VideoProcessingOptions {
  // Quality settings
  quality: 'draft' | 'preview' | 'high' | 'production'
  
  // Optimization
  optimize: boolean
  targetFileSize?: number // bytes
  
  // Hardware acceleration
  useGpuAcceleration?: boolean
  
  // Progress tracking
  onProgress?: (progress: number, step: string) => void
  
  // Callbacks
  onStart?: () => void
  onComplete?: (result: { url: string; fileSize: number }) => void
  onError?: (error: string) => void
}

// Template types
export interface VideoTemplate {
  id: string
  name: string
  description: string
  thumbnail: string
  category: string
  tags: string[]
  
  // Template data
  dimensions: VideoDimensions
  duration: number
  elements: Omit<VideoElementWithState, 'id' | 'source'>[]
  
  // Customization options
  customizable: {
    text: boolean
    images: boolean
    colors: boolean
    duration: boolean
  }
  
  // Usage
  popularity: number
  isPremium: boolean
  createdBy?: string
  createdAt: Date
}

// Asset types
export type AssetType = 'image' | 'video' | 'audio' | 'font'

export interface Asset {
  id: string
  type: AssetType
  name: string
  url: string
  thumbnail?: string
  size: number
  duration?: number // for video/audio
  dimensions?: VideoDimensions // for image/video
  format: string
  tags: string[]
  uploadedAt: Date
  
  // Metadata
  metadata?: {
    fps?: number
    bitrate?: string
    codec?: string
    colorSpace?: string
    hasAudio?: boolean
  }
  
  // Usage tracking
  usageCount?: number
  lastUsed?: Date
}

// Color palette
export interface ColorPalette {
  id: string
  name: string
  colors: string[]
  isPredefined: boolean
}

// Font definition
export interface FontDefinition {
  family: string
  variants: string[]
  category: 'serif' | 'sans-serif' | 'monospace' | 'display' | 'handwriting'
  isWebFont: boolean
  url?: string
}

// Video editor tools
export interface EditorTool {
  id: string
  name: string
  icon: string
  category: 'basic' | 'advanced' | 'effects'
  shortcut?: string
  description: string
  isActive: boolean
  isEnabled: boolean
}

// Keyboard shortcuts
export interface KeyboardShortcut {
  keys: string[]
  action: string
  description: string
  category: string
}

// Export presets
export interface ExportPreset {
  id: string
  name: string
  description: string
  settings: {
    format: OutputFormat
    quality: string
    dimensions?: VideoDimensions
    fps?: number
    bitrate?: string
    codec?: string
  }
  isDefault: boolean
  category: 'web' | 'social' | 'broadcast' | 'mobile' | 'custom'
}

// Performance metrics
export interface PerformanceMetrics {
  renderTime: number
  memoryUsage: number
  frameRate: number
  droppedFrames: number
  processingLoad: number
}

// Error types specific to video processing
export type VideoErrorType = 
  | 'INVALID_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'DURATION_EXCEEDED'
  | 'CODEC_NOT_SUPPORTED'
  | 'RESOLUTION_TOO_HIGH'
  | 'CORRUPT_FILE'
  | 'NETWORK_ERROR'
  | 'PROCESSING_TIMEOUT'
  | 'INSUFFICIENT_RESOURCES'

export interface VideoError {
  type: VideoErrorType
  message: string
  elementId?: string
  details?: Record<string, unknown>
  recoverable: boolean
  suggestions?: string[]
}

// Validation result
export interface ValidationResult {
  isValid: boolean
  errors: VideoError[]
  warnings: string[]
  suggestions: string[]
}