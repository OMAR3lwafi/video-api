/**
 * Environment configuration
 * Validates and exports environment variables with proper typing
 */

interface EnvironmentConfig {
  // API Configuration
  API_BASE_URL: string
  API_TIMEOUT: number
  API_RETRIES: number
  
  // Supabase Configuration
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  
  // AWS S3 Configuration (for direct uploads if needed)
  AWS_REGION?: string
  AWS_S3_BUCKET?: string
  
  // Feature Flags
  ENABLE_ANALYTICS: boolean
  ENABLE_REALTIME: boolean
  ENABLE_COLLABORATION: boolean
  ENABLE_DEV_TOOLS: boolean
  
  // Upload Limits
  MAX_FILE_SIZE: number
  MAX_ELEMENTS: number
  MAX_VIDEO_DURATION: number
  
  // UI Configuration
  DEFAULT_THEME: 'light' | 'dark' | 'system'
  ENABLE_ANIMATIONS: boolean
  ENABLE_SOUNDS: boolean
  
  // Performance
  CACHE_TTL: number
  PREFETCH_ENABLED: boolean
  
  // Development
  NODE_ENV: 'development' | 'production' | 'test'
  DEV_MODE: boolean
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug'
}

/**
 * Validates and parses environment variables
 */
function validateEnv(): EnvironmentConfig {
  // Helper functions
  const getEnvVar = (key: string, fallback?: string): string => {
    const value = import.meta.env[`VITE_${key}`] ?? fallback
    if (!value) {
      throw new Error(`Missing required environment variable: VITE_${key}`)
    }
    return value
  }

  const getEnvVarOptional = (key: string, fallback?: string): string | undefined => {
    return import.meta.env[`VITE_${key}`] ?? fallback
  }

  const getBooleanEnv = (key: string, fallback: boolean = false): boolean => {
    const value = import.meta.env[`VITE_${key}`]
    if (value === undefined) return fallback
    return value.toLowerCase() === 'true' || value === '1'
  }

  const getNumberEnv = (key: string, fallback: number): number => {
    const value = import.meta.env[`VITE_${key}`]
    if (!value) return fallback
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) {
      throw new Error(`Invalid number for environment variable VITE_${key}: ${value}`)
    }
    return parsed
  }

  // Validate required variables
  const config: EnvironmentConfig = {
    // API Configuration
    API_BASE_URL: getEnvVar('API_BASE_URL', 'http://localhost:3000'),
    API_TIMEOUT: getNumberEnv('API_TIMEOUT', 30000),
    API_RETRIES: getNumberEnv('API_RETRIES', 3),
    
    // Supabase Configuration
    SUPABASE_URL: getEnvVar('SUPABASE_URL'),
    SUPABASE_ANON_KEY: getEnvVar('SUPABASE_ANON_KEY'),
    
    // AWS S3 Configuration
    AWS_REGION: getEnvVarOptional('AWS_REGION'),
    AWS_S3_BUCKET: getEnvVarOptional('AWS_S3_BUCKET'),
    
    // Feature Flags
    ENABLE_ANALYTICS: getBooleanEnv('ENABLE_ANALYTICS', true),
    ENABLE_REALTIME: getBooleanEnv('ENABLE_REALTIME', true),
    ENABLE_COLLABORATION: getBooleanEnv('ENABLE_COLLABORATION', false),
    ENABLE_DEV_TOOLS: getBooleanEnv('ENABLE_DEV_TOOLS', import.meta.env.DEV),
    
    // Upload Limits
    MAX_FILE_SIZE: getNumberEnv('MAX_FILE_SIZE', 100 * 1024 * 1024), // 100MB
    MAX_ELEMENTS: getNumberEnv('MAX_ELEMENTS', 10),
    MAX_VIDEO_DURATION: getNumberEnv('MAX_VIDEO_DURATION', 600), // 10 minutes
    
    // UI Configuration
    DEFAULT_THEME: (getEnvVarOptional('DEFAULT_THEME', 'system') as 'light' | 'dark' | 'system'),
    ENABLE_ANIMATIONS: getBooleanEnv('ENABLE_ANIMATIONS', true),
    ENABLE_SOUNDS: getBooleanEnv('ENABLE_SOUNDS', false),
    
    // Performance
    CACHE_TTL: getNumberEnv('CACHE_TTL', 300000), // 5 minutes
    PREFETCH_ENABLED: getBooleanEnv('PREFETCH_ENABLED', true),
    
    // Development
    NODE_ENV: (import.meta.env.MODE as 'development' | 'production' | 'test') || 'development',
    DEV_MODE: import.meta.env.DEV,
    LOG_LEVEL: (getEnvVarOptional('LOG_LEVEL', 'info') as 'error' | 'warn' | 'info' | 'debug'),
  }

  // Additional validation
  try {
    new URL(config.API_BASE_URL)
  } catch {
    throw new Error(`Invalid API_BASE_URL: ${config.API_BASE_URL}`)
  }

  try {
    new URL(config.SUPABASE_URL)
  } catch {
    throw new Error(`Invalid SUPABASE_URL: ${config.SUPABASE_URL}`)
  }

  if (config.API_TIMEOUT < 1000) {
    throw new Error('API_TIMEOUT must be at least 1000ms')
  }

  if (config.MAX_FILE_SIZE < 1024 * 1024) {
    throw new Error('MAX_FILE_SIZE must be at least 1MB')
  }

  if (config.MAX_ELEMENTS < 1) {
    throw new Error('MAX_ELEMENTS must be at least 1')
  }

  if (config.MAX_VIDEO_DURATION < 1) {
    throw new Error('MAX_VIDEO_DURATION must be at least 1 second')
  }

  return config
}

// Export validated configuration
export const env = validateEnv()

// Helper functions for common checks
export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

// API endpoints configuration
export const API_ENDPOINTS = {
  // Health
  health: '/health',
  
  // Video endpoints
  video: {
    create: '/api/v1/videocreate',
    status: (jobId: string) => `/api/v1/videoresult/${jobId}`,
    result: (jobId: string) => `/api/v1/videoresult/${jobId}`,
    cancel: (jobId: string) => `/api/v1/video/cancel/${jobId}`,
    list: '/api/v1/video/jobs',
    delete: (jobId: string) => `/api/v1/video/jobs/${jobId}`,
  },
  
  // Upload endpoints
  upload: {
    single: '/api/v1/upload/single',
    multiple: '/api/v1/upload/multiple',
    validate: '/api/v1/upload/validate',
  },
  
  // System endpoints
  system: {
    limits: '/api/v1/system/limits',
    analytics: '/api/v1/system/analytics',
    status: '/api/v1/system/status',
  },
} as const

// WebSocket endpoints
export const WS_ENDPOINTS = {
  jobs: '/ws/jobs',
  system: '/ws/system',
} as const

// File upload configuration
export const UPLOAD_CONFIG = {
  maxSize: env.MAX_FILE_SIZE,
  allowedTypes: {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    video: ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'],
    audio: ['audio/mp3', 'audio/wav', 'audio/aac', 'audio/ogg'],
  },
  chunkSize: 1024 * 1024, // 1MB chunks for large file uploads
} as const

// Cache configuration
export const CACHE_CONFIG = {
  ttl: env.CACHE_TTL,
  maxSize: 50 * 1024 * 1024, // 50MB
  keys: {
    jobs: 'jobs',
    templates: 'templates',
    assets: 'assets',
    user: 'user',
    system: 'system',
  },
} as const

// Performance monitoring
export const PERFORMANCE_CONFIG = {
  enableMetrics: env.ENABLE_ANALYTICS,
  sampleRate: isProduction ? 0.1 : 1.0, // 10% in production, 100% in development
  thresholds: {
    pageLoad: 3000, // 3 seconds
    apiResponse: 1000, // 1 second
    renderTime: 16, // 16ms (60fps)
  },
} as const

// Error tracking configuration
export const ERROR_CONFIG = {
  enableReporting: isProduction,
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    'Network request failed',
  ],
  maxBreadcrumbs: 50,
  beforeSend: (error: Error) => {
    // Filter out development-only errors
    if (isDevelopment && error.message.includes('HMR')) {
      return null
    }
    return error
  },
} as const

// Feature flags (can be overridden by remote config)
export const FEATURE_FLAGS = {
  enableAnalytics: env.ENABLE_ANALYTICS,
  enableRealtime: env.ENABLE_REALTIME,
  enableCollaboration: env.ENABLE_COLLABORATION,
  enableDevTools: env.ENABLE_DEV_TOOLS,
  enableAnimations: env.ENABLE_ANIMATIONS,
  enableSounds: env.ENABLE_SOUNDS,
  prefetchEnabled: env.PREFETCH_ENABLED,
} as const

// UI configuration
export const UI_CONFIG = {
  theme: {
    default: env.DEFAULT_THEME,
    storageKey: 'video-platform-theme',
  },
  animations: {
    enabled: env.ENABLE_ANIMATIONS,
    duration: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
    easing: {
      ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  breakpoints: {
    xs: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  },
} as const

// Logging configuration
export const LOGGING_CONFIG = {
  level: env.LOG_LEVEL,
  enableConsole: isDevelopment,
  enableRemote: isProduction,
  format: isDevelopment ? 'pretty' : 'json',
  maxLogSize: 1000, // Maximum number of logs to keep in memory
} as const
