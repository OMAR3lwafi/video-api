/**
 * Store Type Definitions
 * Comprehensive type definitions for all state slices
 */

import type { 
  VideoProject, 
  VideoElementWithState, 
  VideoExport,
  JobStatusResponse,
  ProcessingError,
  RealtimeJobUpdate,
  RealtimeStepUpdate,
} from '../types'

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface LoadingState {
  isLoading: boolean
  progress?: number
  message?: string
}

export interface ErrorState {
  error: string | null
  errorCode?: string
  recoverable?: boolean
  retryCount?: number
}

export interface AsyncState extends LoadingState, ErrorState {
  lastUpdate?: string
}

// ============================================================================
// APP STORE TYPES
// ============================================================================

export interface AppState {
  // Application lifecycle
  isInitialized: boolean
  isOnline: boolean
  lastSync?: string
  
  // Performance
  performance: {
    renderTime: number
    memoryUsage: number
    apiLatency: number
  }
  
  // Feature flags
  features: {
    realtimeEnabled: boolean
    offlineEnabled: boolean
    analyticsEnabled: boolean
    collaborationEnabled: boolean
  }
  
  // System status
  system: {
    health: 'healthy' | 'degraded' | 'down'
    maintenance: boolean
    version: string
  }
}

export interface AppActions {
  // Initialization
  initialize: () => Promise<void>
  setInitialized: (initialized: boolean) => void
  
  // Network status
  setOnlineStatus: (online: boolean) => void
  updateLastSync: (timestamp?: string) => void
  
  // Performance tracking
  updatePerformance: (metrics: Partial<AppState['performance']>) => void
  
  // Feature flags
  toggleFeature: (feature: keyof AppState['features'], enabled?: boolean) => void
  
  // System status
  updateSystemHealth: (health: AppState['system']['health']) => void
  setMaintenanceMode: (maintenance: boolean) => void
  updateVersion: (version: string) => void
  
  // Cleanup
  reset: () => void
}

// ============================================================================
// PROJECT STORE TYPES
// ============================================================================

export interface ProjectState {
  // Current project
  currentProject: VideoProject | null
  isDirty: boolean
  lastSaved?: string
  
  // Project history
  history: {
    past: VideoProject[]
    future: VideoProject[]
    canUndo: boolean
    canRedo: boolean
  }
  
  // Auto-save
  autoSave: {
    enabled: boolean
    interval: number
    lastAutoSave?: string
  }
  
  // Collaboration
  collaboration: {
    isShared: boolean
    collaborators: Array<{
      id: string
      name: string
      avatar?: string
      isOnline: boolean
      cursor?: { x: number; y: number }
    }>
    conflicts: Array<{
      id: string
      element: string
      type: 'edit' | 'delete' | 'move'
      timestamp: string
    }>
  }
  
  // Canvas state
  canvas: {
    zoom: number
    pan: { x: number; y: number }
    selectedElements: string[]
    clipboard: VideoElementWithState[]
    grid: {
      enabled: boolean
      size: number
      snap: boolean
    }
    guides: {
      enabled: boolean
      magnetic: boolean
    }
  }
  
  // Timeline
  timeline: {
    currentTime: number
    duration: number
    isPlaying: boolean
    loop: boolean
    markers: Array<{
      id: string
      time: number
      label: string
      color: string
    }>
    selectedRange?: { start: number; end: number }
  }
  
  // Templates and presets
  templates: {
    recent: string[]
    favorites: string[]
    custom: Array<{
      id: string
      name: string
      thumbnail: string
      elements: VideoElementWithState[]
    }>
  }
}

export interface ProjectActions {
  // Project management
  createProject: (name: string, template?: string) => void
  loadProject: (project: VideoProject) => void
  saveProject: () => Promise<void>
  exportProject: () => Promise<void>
  duplicateProject: () => void
  deleteProject: (id: string) => void
  
  // Dirty state
  markDirty: () => void
  markClean: () => void
  
  // History
  undo: () => void
  redo: () => void
  pushToHistory: () => void
  clearHistory: () => void
  
  // Auto-save
  enableAutoSave: (interval?: number) => void
  disableAutoSave: () => void
  triggerAutoSave: () => Promise<void>
  
  // Elements
  addElement: (element: Omit<VideoElementWithState, 'id'>) => void
  updateElement: (id: string, updates: Partial<VideoElementWithState>) => void
  deleteElement: (id: string) => void
  duplicateElement: (id: string) => void
  reorderElements: (fromIndex: number, toIndex: number) => void
  
  // Selection
  selectElement: (id: string, multi?: boolean) => void
  selectElements: (ids: string[]) => void
  clearSelection: () => void
  selectAll: () => void
  
  // Clipboard
  copy: () => void
  cut: () => void
  paste: () => void
  
  // Canvas
  setZoom: (zoom: number) => void
  setPan: (pan: { x: number; y: number }) => void
  resetView: () => void
  fitToScreen: () => void
  
  // Timeline
  setCurrentTime: (time: number) => void
  play: () => void
  pause: () => void
  stop: () => void
  setLoop: (loop: boolean) => void
  addMarker: (time: number, label: string, color?: string) => void
  removeMarker: (id: string) => void
  
  // Collaboration
  shareProject: () => Promise<string>
  joinProject: (shareId: string) => Promise<void>
  leaveProject: () => void
  updateCursor: (position: { x: number; y: number }) => void
  resolveConflict: (conflictId: string, resolution: 'accept' | 'reject') => void
  
  // Templates
  saveAsTemplate: (name: string) => void
  loadTemplate: (templateId: string) => void
  addToFavorites: (templateId: string) => void
  removeFromFavorites: (templateId: string) => void
  
  // Reset
  reset: () => void
}

// ============================================================================
// JOB STORE TYPES
// ============================================================================

export interface JobState {
  // Active jobs
  activeJobs: Map<string, {
    id: string
    status: JobStatusResponse['status']
    progress: number
    message: string
    startTime: string
    estimatedCompletion?: string
    type: 'immediate' | 'async'
    projectId?: string
  }>
  
  // Completed jobs
  completedJobs: Array<{
    id: string
    status: 'completed' | 'failed' | 'cancelled'
    resultUrl?: string
    error?: string
    duration?: number
    fileSize?: number
    completedAt: string
    projectId?: string
  }>
  
  // Job history
  history: Array<{
    id: string
    action: 'created' | 'updated' | 'completed' | 'failed' | 'cancelled'
    timestamp: string
    details?: Record<string, unknown>
  }>
  
  // Real-time subscriptions
  subscriptions: Map<string, {
    jobId: string
    isConnected: boolean
    lastUpdate?: string
    error?: string
  }>
  
  // Queue management
  queue: {
    pending: string[]
    processing: string[]
    maxConcurrent: number
    retryQueue: Array<{
      jobId: string
      retryCount: number
      nextRetry: string
    }>
  }
  
  // Statistics
  stats: {
    totalJobs: number
    successRate: number
    averageProcessingTime: number
    totalProcessingTime: number
    peakConcurrency: number
  }
}

export interface JobActions {
  // Job lifecycle
  createJob: (request: any) => Promise<string>
  updateJobStatus: (jobId: string, status: JobStatusResponse) => void
  completeJob: (jobId: string, result: any) => void
  failJob: (jobId: string, error: string) => void
  cancelJob: (jobId: string) => Promise<void>
  retryJob: (jobId: string) => Promise<void>
  
  // Real-time updates
  subscribeToJob: (jobId: string) => void
  unsubscribeFromJob: (jobId: string) => void
  handleRealtimeUpdate: (update: RealtimeJobUpdate) => void
  handleStepUpdate: (update: RealtimeStepUpdate) => void
  
  // Queue management
  addToQueue: (jobId: string) => void
  removeFromQueue: (jobId: string) => void
  processQueue: () => void
  clearQueue: () => void
  
  // History
  addToHistory: (jobId: string, action: string, details?: any) => void
  clearHistory: () => void
  getJobHistory: (jobId: string) => JobState['history']
  
  // Statistics
  updateStats: () => void
  getJobStats: () => JobState['stats']
  
  // Cleanup
  cleanupCompletedJobs: (olderThan?: number) => void
  reset: () => void
}

// ============================================================================
// UI STORE TYPES
// ============================================================================

export interface UIState {
  // Global loading states
  globalLoading: {
    isLoading: boolean
    message?: string
    progress?: number
    cancellable?: boolean
  }
  
  // Notifications
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message?: string
    duration?: number
    persistent?: boolean
    actions?: Array<{
      label: string
      action: () => void
      style?: 'primary' | 'secondary' | 'destructive'
    }>
    createdAt: string
  }>
  
  // Modals and dialogs
  modals: {
    active: string | null
    stack: string[]
    data: Map<string, any>
    blocking: boolean
  }
  
  // Panels and sidebars
  panels: {
    timeline: { open: boolean; width: number }
    properties: { open: boolean; width: number }
    assets: { open: boolean; width: number }
    layers: { open: boolean; width: number }
    effects: { open: boolean; width: number }
  }
  
  // Layout
  layout: {
    sidebarCollapsed: boolean
    fullscreen: boolean
    theme: 'light' | 'dark' | 'system'
    compactMode: boolean
    showGrid: boolean
    showRulers: boolean
    showGuides: boolean
  }
  
  // Context menus
  contextMenu: {
    visible: boolean
    position: { x: number; y: number }
    items: Array<{
      id: string
      label: string
      icon?: string
      disabled?: boolean
      separator?: boolean
      children?: any[]
      action?: () => void
    }>
  }
  
  // Tooltips
  tooltips: {
    enabled: boolean
    delay: number
    active: string | null
  }
  
  // Keyboard shortcuts
  shortcuts: {
    enabled: boolean
    recording: boolean
    customShortcuts: Map<string, string>
  }
  
  // Accessibility
  accessibility: {
    highContrast: boolean
    reducedMotion: boolean
    screenReader: boolean
    keyboardNavigation: boolean
  }
  
  // Performance
  performance: {
    reducedAnimations: boolean
    lowQualityPreviews: boolean
    autoOptimize: boolean
  }
}

export interface UIActions {
  // Global loading
  setGlobalLoading: (loading: boolean, message?: string, progress?: number) => void
  
  // Notifications
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'createdAt'>) => string
  removeNotification: (id: string) => void
  clearNotifications: () => void
  markNotificationRead: (id: string) => void
  
  // Modals
  openModal: (modalId: string, data?: any) => void
  closeModal: (modalId?: string) => void
  setModalData: (modalId: string, data: any) => void
  
  // Panels
  togglePanel: (panel: keyof UIState['panels']) => void
  resizePanel: (panel: keyof UIState['panels'], width: number) => void
  resetPanels: () => void
  
  // Layout
  toggleSidebar: () => void
  setFullscreen: (fullscreen: boolean) => void
  setTheme: (theme: UIState['layout']['theme']) => void
  toggleCompactMode: () => void
  toggleGrid: () => void
  toggleRulers: () => void
  toggleGuides: () => void
  
  // Context menu
  showContextMenu: (position: { x: number; y: number }, items: UIState['contextMenu']['items']) => void
  hideContextMenu: () => void
  
  // Tooltips
  enableTooltips: (enabled: boolean) => void
  setTooltipDelay: (delay: number) => void
  showTooltip: (id: string) => void
  hideTooltip: () => void
  
  // Keyboard shortcuts
  enableShortcuts: (enabled: boolean) => void
  startRecordingShortcut: () => void
  stopRecordingShortcut: () => void
  setCustomShortcut: (action: string, keys: string) => void
  
  // Accessibility
  setHighContrast: (enabled: boolean) => void
  setReducedMotion: (enabled: boolean) => void
  setScreenReader: (enabled: boolean) => void
  setKeyboardNavigation: (enabled: boolean) => void
  
  // Performance
  setReducedAnimations: (enabled: boolean) => void
  setLowQualityPreviews: (enabled: boolean) => void
  setAutoOptimize: (enabled: boolean) => void
  
  // Reset
  reset: () => void
}

// ============================================================================
// USER STORE TYPES
// ============================================================================

export interface UserState {
  // User profile
  profile: {
    id: string
    email: string
    name: string
    avatar?: string
    plan: 'free' | 'pro' | 'enterprise'
    subscription?: {
      status: 'active' | 'cancelled' | 'expired'
      expiresAt: string
      features: string[]
    }
  } | null
  
  // Authentication
  auth: {
    isAuthenticated: boolean
    token?: string
    refreshToken?: string
    expiresAt?: string
    lastLogin?: string
  }
  
  // Preferences
  preferences: {
    // Editor preferences
    editor: {
      autoSave: boolean
      autoSaveInterval: number
      showWelcome: boolean
      defaultQuality: 'draft' | 'preview' | 'high'
      defaultFormat: 'mp4' | 'mov' | 'avi'
      snapToGrid: boolean
      snapThreshold: number
    }
    
    // UI preferences
    ui: {
      theme: 'light' | 'dark' | 'system'
      language: string
      timezone: string
      dateFormat: string
      timeFormat: '12h' | '24h'
      compactMode: boolean
      animations: boolean
      sounds: boolean
    }
    
    // Notifications
    notifications: {
      email: boolean
      push: boolean
      desktop: boolean
      jobComplete: boolean
      jobFailed: boolean
      collaboration: boolean
      marketing: boolean
    }
    
    // Privacy
    privacy: {
      analytics: boolean
      crashReporting: boolean
      usageData: boolean
      shareData: boolean
    }
  }
  
  // Usage statistics
  usage: {
    projectsCreated: number
    videosExported: number
    storageUsed: number
    storageLimit: number
    apiCallsThisMonth: number
    apiCallsLimit: number
    lastActivity: string
    streakDays: number
  }
  
  // Recent activity
  recentActivity: Array<{
    id: string
    type: 'project_created' | 'project_updated' | 'video_exported' | 'template_used'
    timestamp: string
    details: {
      projectId?: string
      projectName?: string
      templateId?: string
      templateName?: string
      duration?: number
    }
  }>
  
  // Favorites
  favorites: {
    templates: string[]
    assets: string[]
    colors: string[]
    fonts: string[]
  }
}

export interface UserActions {
  // Authentication
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  
  // Profile
  updateProfile: (updates: Partial<UserState['profile']>) => Promise<void>
  uploadAvatar: (file: File) => Promise<string>
  
  // Preferences
  updatePreferences: (category: keyof UserState['preferences'], updates: any) => void
  resetPreferences: () => void
  exportPreferences: () => string
  importPreferences: (data: string) => void
  
  // Usage tracking
  trackActivity: (type: UserState['recentActivity'][0]['type'], details: any) => void
  updateUsage: (usage: Partial<UserState['usage']>) => void
  
  // Favorites
  addToFavorites: (type: keyof UserState['favorites'], id: string) => void
  removeFromFavorites: (type: keyof UserState['favorites'], id: string) => void
  isFavorite: (type: keyof UserState['favorites'], id: string) => boolean
  
  // Subscription
  upgradeSubscription: (plan: 'pro' | 'enterprise') => Promise<void>
  cancelSubscription: () => Promise<void>
  
  // Reset
  reset: () => void
}

// ============================================================================
// CACHE STORE TYPES
// ============================================================================

export interface CacheState {
  // API response cache
  apiCache: Map<string, {
    data: any
    timestamp: string
    ttl: number
    etag?: string
    lastModified?: string
  }>
  
  // Asset cache
  assetCache: Map<string, {
    url: string
    blob?: Blob
    metadata: {
      size: number
      type: string
      lastAccessed: string
      accessCount: number
    }
  }>
  
  // Template cache
  templateCache: Map<string, {
    template: any
    thumbnail?: string
    metadata: {
      size: number
      lastUsed: string
      useCount: number
    }
  }>
  
  // Project cache
  projectCache: Map<string, {
    project: VideoProject
    thumbnail?: string
    metadata: {
      size: number
      lastAccessed: string
      version: number
    }
  }>
  
  // Cache statistics
  stats: {
    totalSize: number
    maxSize: number
    hitRate: number
    missRate: number
    evictionCount: number
    lastCleanup: string
  }
  
  // Cache configuration
  config: {
    apiTtl: number
    assetTtl: number
    templateTtl: number
    projectTtl: number
    maxSize: number
    cleanupInterval: number
    compressionEnabled: boolean
  }
}

export interface CacheActions {
  // API cache
  setApiCache: (key: string, data: any, ttl?: number) => void
  getApiCache: (key: string) => any | null
  invalidateApiCache: (pattern?: string) => void
  
  // Asset cache
  setAssetCache: (key: string, url: string, blob?: Blob) => void
  getAssetCache: (key: string) => CacheState['assetCache'] extends Map<string, infer T> ? T : never | null
  preloadAsset: (url: string) => Promise<void>
  
  // Template cache
  setTemplateCache: (id: string, template: any, thumbnail?: string) => void
  getTemplateCache: (id: string) => any | null
  preloadTemplate: (id: string) => Promise<void>
  
  // Project cache
  setProjectCache: (id: string, project: VideoProject, thumbnail?: string) => void
  getProjectCache: (id: string) => VideoProject | null
  
  // Cache management
  cleanup: () => void
  clear: (type?: 'api' | 'asset' | 'template' | 'project') => void
  compress: () => Promise<void>
  export: () => Promise<Blob>
  import: (data: Blob) => Promise<void>
  
  // Configuration
  updateConfig: (config: Partial<CacheState['config']>) => void
  
  // Statistics
  updateStats: () => void
  getCacheInfo: () => CacheState['stats']
  
  // Reset
  reset: () => void
}

// ============================================================================
// OFFLINE STORE TYPES
// ============================================================================

export interface OfflineState {
  // Network status
  isOnline: boolean
  lastOnline?: string
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'offline'
  
  // Offline queue
  queue: Array<{
    id: string
    type: 'api_call' | 'file_upload' | 'project_save' | 'export_request'
    action: string
    data: any
    timestamp: string
    retryCount: number
    priority: 'high' | 'medium' | 'low'
    status: 'pending' | 'processing' | 'failed' | 'completed'
  }>
  
  // Sync status
  sync: {
    inProgress: boolean
    lastSync?: string
    conflictsCount: number
    pendingChanges: number
    errors: Array<{
      id: string
      message: string
      timestamp: string
      recoverable: boolean
    }>
  }
  
  // Offline storage
  storage: {
    projects: Map<string, {
      project: VideoProject
      lastModified: string
      syncStatus: 'synced' | 'modified' | 'conflict'
    }>
    assets: Map<string, {
      blob: Blob
      metadata: any
      lastAccessed: string
    }>
    drafts: Map<string, {
      data: any
      timestamp: string
      autoSave: boolean
    }>
  }
  
  // Configuration
  config: {
    enableOfflineMode: boolean
    autoSync: boolean
    syncInterval: number
    maxQueueSize: number
    maxStorageSize: number
    conflictResolution: 'manual' | 'local' | 'remote' | 'merge'
  }
}

export interface OfflineActions {
  // Network status
  setOnlineStatus: (online: boolean) => void
  setConnectionQuality: (quality: OfflineState['connectionQuality']) => void
  
  // Queue management
  addToQueue: (item: Omit<OfflineState['queue'][0], 'id' | 'timestamp' | 'retryCount' | 'status'>) => void
  removeFromQueue: (id: string) => void
  processQueue: () => Promise<void>
  retryQueueItem: (id: string) => Promise<void>
  clearQueue: () => void
  
  // Sync operations
  startSync: () => Promise<void>
  pauseSync: () => void
  resolveConflict: (projectId: string, resolution: 'local' | 'remote' | 'merge') => void
  
  // Offline storage
  storeProject: (project: VideoProject) => void
  getStoredProject: (id: string) => VideoProject | null
  removeStoredProject: (id: string) => void
  storeAsset: (id: string, blob: Blob, metadata: any) => void
  getStoredAsset: (id: string) => { blob: Blob; metadata: any } | null
  storeDraft: (id: string, data: any, autoSave?: boolean) => void
  getDraft: (id: string) => any | null
  removeDraft: (id: string) => void
  
  // Configuration
  updateConfig: (config: Partial<OfflineState['config']>) => void
  enableOfflineMode: (enabled: boolean) => void
  
  // Utilities
  getStorageUsage: () => number
  cleanup: () => void
  export: () => Promise<Blob>
  import: (data: Blob) => Promise<void>
  
  // Reset
  reset: () => void
}

// ============================================================================
// COMBINED STORE TYPE
// ============================================================================

export interface RootState {
  app: AppState
  project: ProjectState
  job: JobState
  ui: UIState
  user: UserState
  cache: CacheState
  offline: OfflineState
}

export interface RootActions {
  app: AppActions
  project: ProjectActions
  job: JobActions
  ui: UIActions
  user: UserActions
  cache: CacheActions
  offline: OfflineActions
}
