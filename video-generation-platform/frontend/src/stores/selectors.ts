/**
 * Store Selectors
 * Centralized selectors for complex state derivations and cross-store data
 */

import type { 
  AppState, 
  ProjectState, 
  JobState, 
  UIState, 
  UserState, 
  CacheState, 
  OfflineState 
} from './types'

// ============================================================================
// APP SELECTORS
// ============================================================================

export const appSelectors = {
  // System health
  isSystemHealthy: (state: AppState) => state.system.health === 'healthy',
  isInMaintenance: (state: AppState) => state.system.maintenance,
  
  // Network status
  isOnline: (state: AppState) => state.isOnline,
  canMakeApiCalls: (state: AppState) => state.isOnline && state.system.health !== 'down',
  
  // Features
  isFeatureEnabled: (feature: keyof AppState['features']) => (state: AppState) => 
    state.features[feature],
  
  // Performance
  performanceScore: (state: AppState) => {
    const { renderTime, memoryUsage, apiLatency } = state.performance
    // Simple performance scoring (0-100)
    const renderScore = Math.max(0, 100 - (renderTime / 16) * 100) // 16ms = 60fps
    const memoryScore = Math.max(0, 100 - memoryUsage * 100)
    const latencyScore = Math.max(0, 100 - (apiLatency / 1000) * 100) // 1s = 0 score
    
    return Math.round((renderScore + memoryScore + latencyScore) / 3)
  },
}

// ============================================================================
// PROJECT SELECTORS
// ============================================================================

export const projectSelectors = {
  // Project status
  hasProject: (state: ProjectState) => !!state.currentProject,
  projectName: (state: ProjectState) => state.currentProject?.name || '',
  projectId: (state: ProjectState) => state.currentProject?.id || '',
  
  // Project metadata
  projectInfo: (state: ProjectState) => state.currentProject ? {
    id: state.currentProject.id,
    name: state.currentProject.name,
    duration: state.currentProject.duration,
    elementCount: state.currentProject.elements.length,
    createdAt: state.currentProject.createdAt,
    updatedAt: state.currentProject.updatedAt,
    version: state.currentProject.version,
  } : null,
  
  // Elements
  elements: (state: ProjectState) => state.currentProject?.elements || [],
  elementCount: (state: ProjectState) => state.currentProject?.elements.length || 0,
  selectedElements: (state: ProjectState) => {
    if (!state.currentProject) return []
    return state.currentProject.elements.filter(el => 
      state.canvas.selectedElements.includes(el.id)
    )
  },
  
  // Selection
  hasSelection: (state: ProjectState) => state.canvas.selectedElements.length > 0,
  selectionCount: (state: ProjectState) => state.canvas.selectedElements.length,
  canCopy: (state: ProjectState) => state.canvas.selectedElements.length > 0,
  canPaste: (state: ProjectState) => state.canvas.clipboard.length > 0,
  
  // History
  canUndo: (state: ProjectState) => state.history.canUndo,
  canRedo: (state: ProjectState) => state.history.canRedo,
  isDirty: (state: ProjectState) => state.isDirty,
  
  // Timeline
  timelineInfo: (state: ProjectState) => ({
    currentTime: state.timeline.currentTime,
    duration: state.timeline.duration,
    isPlaying: state.timeline.isPlaying,
    progress: state.timeline.duration > 0 ? 
      (state.timeline.currentTime / state.timeline.duration) * 100 : 0,
  }),
  
  // Canvas
  canvasInfo: (state: ProjectState) => ({
    zoom: state.canvas.zoom,
    pan: state.canvas.pan,
    gridEnabled: state.canvas.grid.enabled,
    guidesEnabled: state.canvas.guides.enabled,
  }),
}

// ============================================================================
// JOB SELECTORS
// ============================================================================

export const jobSelectors = {
  // Active jobs
  activeJobs: (state: JobState) => Array.from(state.activeJobs.values()),
  activeJobCount: (state: JobState) => state.activeJobs.size,
  hasActiveJobs: (state: JobState) => state.activeJobs.size > 0,
  
  // Job by project
  jobsByProject: (projectId: string) => (state: JobState) => {
    const active = Array.from(state.activeJobs.values())
      .filter(job => job.projectId === projectId)
    const completed = state.completedJobs
      .filter(job => job.projectId === projectId)
    return { active, completed, total: active.length + completed.length }
  },
  
  // Processing status
  isProcessing: (state: JobState) => state.activeJobs.size > 0,
  processingProgress: (state: JobState) => {
    const jobs = Array.from(state.activeJobs.values())
    if (jobs.length === 0) return 0
    
    const totalProgress = jobs.reduce((sum, job) => sum + job.progress, 0)
    return Math.round(totalProgress / jobs.length)
  },
  
  // Queue status
  queueInfo: (state: JobState) => ({
    pending: state.queue.pending.length,
    processing: state.queue.processing.length,
    total: state.queue.pending.length + state.queue.processing.length,
    maxConcurrent: state.queue.maxConcurrent,
    canProcess: state.queue.processing.length < state.queue.maxConcurrent,
  }),
  
  // Statistics
  successRate: (state: JobState) => state.stats.successRate * 100,
  averageTime: (state: JobState) => Math.round(state.stats.averageProcessingTime / 1000), // seconds
  
  // Recent jobs
  recentJobs: (limit: number = 10) => (state: JobState) => 
    state.completedJobs.slice(0, limit),
}

// ============================================================================
// UI SELECTORS
// ============================================================================

export const uiSelectors = {
  // Loading states
  isLoading: (state: UIState) => state.globalLoading.isLoading,
  loadingInfo: (state: UIState) => state.globalLoading,
  
  // Notifications
  notifications: (state: UIState) => state.notifications,
  unreadNotifications: (state: UIState) => state.notifications.filter(n => !n.read),
  notificationCount: (state: UIState) => state.notifications.length,
  unreadCount: (state: UIState) => state.notifications.filter(n => !n.read).length,
  
  // Modals
  activeModal: (state: UIState) => state.modals.active,
  hasActiveModal: (state: UIState) => !!state.modals.active,
  modalStack: (state: UIState) => state.modals.stack,
  
  // Panels
  panelStates: (state: UIState) => state.panels,
  visiblePanels: (state: UIState) => 
    Object.entries(state.panels)
      .filter(([, panel]) => panel.open)
      .map(([name]) => name),
  
  // Layout
  layoutInfo: (state: UIState) => ({
    theme: state.layout.theme,
    fullscreen: state.layout.fullscreen,
    sidebarCollapsed: state.layout.sidebarCollapsed,
    compactMode: state.layout.compactMode,
  }),
  
  // Context menu
  contextMenuVisible: (state: UIState) => state.contextMenu.visible,
  
  // Accessibility
  accessibilityEnabled: (state: UIState) => 
    state.accessibility.highContrast || 
    state.accessibility.reducedMotion || 
    state.accessibility.screenReader,
}

// ============================================================================
// USER SELECTORS
// ============================================================================

export const userSelectors = {
  // Authentication
  isAuthenticated: (state: UserState) => state.auth.isAuthenticated,
  user: (state: UserState) => state.profile,
  userInfo: (state: UserState) => state.profile ? {
    id: state.profile.id,
    name: state.profile.name,
    email: state.profile.email,
    plan: state.profile.plan,
    avatar: state.profile.avatar,
  } : null,
  
  // Subscription
  plan: (state: UserState) => state.profile?.plan || 'free',
  isSubscribed: (state: UserState) => state.profile?.plan !== 'free',
  subscriptionStatus: (state: UserState) => state.profile?.subscription?.status,
  
  // Usage
  storageUsage: (state: UserState) => ({
    used: state.usage.storageUsed,
    limit: state.usage.storageLimit,
    percentage: Math.round((state.usage.storageUsed / state.usage.storageLimit) * 100),
    remaining: state.usage.storageLimit - state.usage.storageUsed,
  }),
  
  apiUsage: (state: UserState) => ({
    used: state.usage.apiCallsThisMonth,
    limit: state.usage.apiCallsLimit,
    percentage: Math.round((state.usage.apiCallsThisMonth / state.usage.apiCallsLimit) * 100),
    remaining: state.usage.apiCallsLimit - state.usage.apiCallsThisMonth,
  }),
  
  // Activity
  recentActivity: (limit: number = 10) => (state: UserState) =>
    state.recentActivity.slice(0, limit),
  
  // Preferences
  preferences: (state: UserState) => state.preferences,
  editorPrefs: (state: UserState) => state.preferences.editor,
  uiPrefs: (state: UserState) => state.preferences.ui,
  
  // Favorites
  favoriteCount: (state: UserState) => 
    Object.values(state.favorites).reduce((sum, arr) => sum + arr.length, 0),
}

// ============================================================================
// CACHE SELECTORS
// ============================================================================

export const cacheSelectors = {
  // Cache info
  cacheSize: (state: CacheState) => state.stats.totalSize,
  cacheSizeFormatted: (state: CacheState) => {
    const size = state.stats.totalSize
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
    if (size < 1024 * 1024 * 1024) return `${Math.round(size / (1024 * 1024))} MB`
    return `${Math.round(size / (1024 * 1024 * 1024))} GB`
  },
  
  cacheUsage: (state: CacheState) => ({
    used: state.stats.totalSize,
    limit: state.config.maxSize,
    percentage: Math.round((state.stats.totalSize / state.config.maxSize) * 100),
  }),
  
  hitRate: (state: CacheState) => Math.round(state.stats.hitRate * 100),
  
  // Cache health
  isOverLimit: (state: CacheState) => state.stats.totalSize > state.config.maxSize,
  needsCleanup: (state: CacheState) => {
    const lastCleanup = new Date(state.stats.lastCleanup).getTime()
    const now = Date.now()
    return now - lastCleanup > state.config.cleanupInterval
  },
}

// ============================================================================
// OFFLINE SELECTORS
// ============================================================================

export const offlineSelectors = {
  // Network status
  isOnline: (state: OfflineState) => state.isOnline,
  connectionQuality: (state: OfflineState) => state.connectionQuality,
  lastOnline: (state: OfflineState) => state.lastOnline,
  
  // Queue status
  queueLength: (state: OfflineState) => state.queue.length,
  pendingItems: (state: OfflineState) => 
    state.queue.filter(item => item.status === 'pending').length,
  processingItems: (state: OfflineState) => 
    state.queue.filter(item => item.status === 'processing').length,
  failedItems: (state: OfflineState) => 
    state.queue.filter(item => item.status === 'failed').length,
  
  // Sync status
  isSyncing: (state: OfflineState) => state.sync.inProgress,
  pendingChanges: (state: OfflineState) => state.sync.pendingChanges,
  hasConflicts: (state: OfflineState) => state.sync.conflictsCount > 0,
  syncErrors: (state: OfflineState) => state.sync.errors,
  
  // Storage
  storageUsage: (state: OfflineState) => {
    // This would calculate actual usage in a real implementation
    const projectCount = state.storage.projects.size
    const assetCount = state.storage.assets.size
    const draftCount = state.storage.drafts.size
    
    return {
      projects: projectCount,
      assets: assetCount,
      drafts: draftCount,
      total: projectCount + assetCount + draftCount,
    }
  },
}

// ============================================================================
// CROSS-STORE SELECTORS
// ============================================================================

export const crossStoreSelectors = {
  // System status combining app and offline states
  systemStatus: (appState: AppState, offlineState: OfflineState) => ({
    online: appState.isOnline && offlineState.isOnline,
    healthy: appState.system.health === 'healthy',
    maintenance: appState.system.maintenance,
    canOperate: appState.isOnline && 
                offlineState.isOnline && 
                appState.system.health !== 'down' && 
                !appState.system.maintenance,
  }),
  
  // Current project with job status
  projectWithJobs: (projectState: ProjectState, jobState: JobState) => {
    const project = projectState.currentProject
    if (!project) return null
    
    const activeJobs = Array.from(jobState.activeJobs.values())
      .filter(job => job.projectId === project.id)
    const completedJobs = jobState.completedJobs
      .filter(job => job.projectId === project.id)
    
    return {
      ...project,
      jobs: {
        active: activeJobs,
        completed: completedJobs,
        hasActive: activeJobs.length > 0,
        total: activeJobs.length + completedJobs.length,
      },
    }
  },
  
  // User capabilities based on plan and usage
  userCapabilities: (userState: UserState) => {
    const plan = userState.profile?.plan || 'free'
    const usage = userState.usage
    
    const limits = {
      free: { storage: 1024 * 1024 * 1024, apiCalls: 100, projects: 3 },
      pro: { storage: 10 * 1024 * 1024 * 1024, apiCalls: 1000, projects: 50 },
      enterprise: { storage: 100 * 1024 * 1024 * 1024, apiCalls: 10000, projects: -1 },
    }
    
    const planLimits = limits[plan as keyof typeof limits] || limits.free
    
    return {
      canCreateProject: planLimits.projects === -1 || usage.projectsCreated < planLimits.projects,
      canUpload: usage.storageUsed < planLimits.storage,
      canMakeApiCall: usage.apiCallsThisMonth < planLimits.apiCalls,
      storagePercentage: (usage.storageUsed / planLimits.storage) * 100,
      apiPercentage: (usage.apiCallsThisMonth / planLimits.apiCalls) * 100,
    }
  },
  
  // Application readiness
  appReadiness: (
    appState: AppState, 
    userState: UserState, 
    offlineState: OfflineState
  ) => ({
    initialized: appState.isInitialized,
    authenticated: userState.auth.isAuthenticated,
    online: appState.isOnline && offlineState.isOnline,
    healthy: appState.system.health === 'healthy',
    ready: appState.isInitialized && 
           userState.auth.isAuthenticated && 
           appState.system.health !== 'down',
  }),
}
