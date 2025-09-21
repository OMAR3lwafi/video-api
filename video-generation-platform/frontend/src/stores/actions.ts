/**
 * Store Actions
 * Centralized actions that work across multiple stores
 */

import { useAppStore } from './appStore'
import { useProjectStore } from './projectStore'
import { useJobStore } from './jobStore'
import { useUIStore } from './uiStore'
import { useUserStore } from './userStore'
import { useCacheStore } from './cacheStore'
import { useOfflineStore } from './offlineStore'
import type { VideoCreateRequest } from '../types/api'

// ============================================================================
// PROJECT ACTIONS
// ============================================================================

/**
 * Create a new project with full initialization
 */
export const createProjectWithSetup = async (name: string, template?: string) => {
  const projectStore = useProjectStore.getState()
  const uiStore = useUIStore.getState()
  const userStore = useUserStore.getState()
  
  try {
    uiStore.setGlobalLoading(true, 'Creating project...')
    
    // Create the project
    projectStore.createProject(name, template)
    
    // Track activity
    userStore.trackActivity('project_created', {
      projectId: projectStore.currentProject?.id,
      projectName: name,
      templateId: template,
    })
    
    // Show success notification
    uiStore.addNotification({
      type: 'success',
      title: 'Project Created',
      message: `Project "${name}" has been created successfully.`,
      duration: 3000,
    })
    
  } catch (error) {
    uiStore.addNotification({
      type: 'error',
      title: 'Project Creation Failed',
      message: error instanceof Error ? error.message : 'Failed to create project',
      duration: 5000,
    })
    throw error
  } finally {
    uiStore.setGlobalLoading(false)
  }
}

/**
 * Save project with proper error handling and notifications
 */
export const saveProjectWithFeedback = async () => {
  const projectStore = useProjectStore.getState()
  const uiStore = useUIStore.getState()
  const offlineStore = useOfflineStore.getState()
  
  if (!projectStore.currentProject) {
    uiStore.addNotification({
      type: 'warning',
      title: 'No Project',
      message: 'No project is currently open to save.',
      duration: 3000,
    })
    return
  }
  
  try {
    // Check if online
    if (!offlineStore.isOnline) {
      // Queue for offline sync
      offlineStore.addToQueue({
        type: 'project_save',
        action: 'save_project',
        data: { project: projectStore.currentProject },
        priority: 'high',
      })
      
      uiStore.addNotification({
        type: 'info',
        title: 'Queued for Sync',
        message: 'Project saved locally and queued for sync when online.',
        duration: 3000,
      })
      return
    }
    
    uiStore.setGlobalLoading(true, 'Saving project...')
    
    await projectStore.saveProject()
    
    uiStore.addNotification({
      type: 'success',
      title: 'Project Saved',
      message: 'Your project has been saved successfully.',
      duration: 2000,
    })
    
  } catch (error) {
    uiStore.addNotification({
      type: 'error',
      title: 'Save Failed',
      message: error instanceof Error ? error.message : 'Failed to save project',
      duration: 5000,
    })
    throw error
  } finally {
    uiStore.setGlobalLoading(false)
  }
}

// ============================================================================
// VIDEO EXPORT ACTIONS
// ============================================================================

/**
 * Export video with comprehensive job management
 */
export const exportVideoWithTracking = async (request: VideoCreateRequest) => {
  const jobStore = useJobStore.getState()
  const uiStore = useUIStore.getState()
  const userStore = useUserStore.getState()
  const projectStore = useProjectStore.getState()
  const offlineStore = useOfflineStore.getState()
  
  try {
    // Check user limits
    const capabilities = userStore.profile ? {
      canMakeApiCall: userStore.usage.apiCallsThisMonth < userStore.usage.apiCallsLimit
    } : { canMakeApiCall: false }
    
    if (!capabilities.canMakeApiCall) {
      uiStore.addNotification({
        type: 'error',
        title: 'API Limit Reached',
        message: 'You have reached your monthly API call limit. Please upgrade your plan.',
        duration: 5000,
        actions: [{
          label: 'Upgrade Plan',
          action: () => {
            // Navigate to upgrade page
            console.log('Navigate to upgrade')
          }
        }]
      })
      return
    }
    
    // Check if online
    if (!offlineStore.isOnline) {
      // Queue for offline processing
      offlineStore.addToQueue({
        type: 'export_request',
        action: 'create_video',
        data: { request },
        priority: 'high',
      })
      
      uiStore.addNotification({
        type: 'info',
        title: 'Export Queued',
        message: 'Video export queued for processing when online.',
        duration: 3000,
      })
      return
    }
    
    // Add project ID to request
    const enrichedRequest = {
      ...request,
      projectId: projectStore.currentProject?.id,
    }
    
    // Create the job
    const jobId = await jobStore.createJob(enrichedRequest)
    
    // Track activity
    userStore.trackActivity('video_exported', {
      jobId,
      projectId: projectStore.currentProject?.id,
      format: request.output_format,
      elements: request.elements.length,
    })
    
    // Update API usage
    userStore.updateUsage({
      apiCallsThisMonth: userStore.usage.apiCallsThisMonth + 1,
    })
    
    uiStore.addNotification({
      type: 'success',
      title: 'Export Started',
      message: 'Your video export has been queued for processing.',
      duration: 3000,
    })
    
    return jobId
    
  } catch (error) {
    uiStore.addNotification({
      type: 'error',
      title: 'Export Failed',
      message: error instanceof Error ? error.message : 'Failed to start video export',
      duration: 5000,
    })
    throw error
  }
}

// ============================================================================
// AUTHENTICATION ACTIONS
// ============================================================================

/**
 * Login with comprehensive state management
 */
export const loginWithSetup = async (email: string, password: string) => {
  const userStore = useUserStore.getState()
  const uiStore = useUIStore.getState()
  const appStore = useAppStore.getState()
  
  try {
    uiStore.setGlobalLoading(true, 'Signing in...')
    
    await userStore.login(email, password)
    
    // Initialize user-specific features
    if (appStore.features.analyticsEnabled) {
      // Set up analytics
      console.log('Setting up analytics for user')
    }
    
    uiStore.addNotification({
      type: 'success',
      title: 'Welcome Back!',
      message: `Welcome back, ${userStore.profile?.name || 'User'}!`,
      duration: 3000,
    })
    
  } catch (error) {
    uiStore.addNotification({
      type: 'error',
      title: 'Login Failed',
      message: error instanceof Error ? error.message : 'Failed to sign in',
      duration: 5000,
    })
    throw error
  } finally {
    uiStore.setGlobalLoading(false)
  }
}

/**
 * Logout with cleanup
 */
export const logoutWithCleanup = async () => {
  const userStore = useUserStore.getState()
  const uiStore = useUIStore.getState()
  const projectStore = useProjectStore.getState()
  const jobStore = useJobStore.getState()
  const cacheStore = useCacheStore.getState()
  
  try {
    // Check for unsaved changes
    if (projectStore.isDirty) {
      const shouldSave = window.confirm('You have unsaved changes. Save before logging out?')
      if (shouldSave) {
        await saveProjectWithFeedback()
      }
    }
    
    // Clear sensitive data
    cacheStore.clear('api') // Clear API cache
    jobStore.reset() // Clear job data
    projectStore.reset() // Clear project data
    
    // Logout
    await userStore.logout()
    
    uiStore.addNotification({
      type: 'info',
      title: 'Signed Out',
      message: 'You have been signed out successfully.',
      duration: 3000,
    })
    
  } catch (error) {
    console.error('Logout error:', error)
    // Force logout even if there's an error
    userStore.reset()
    
    uiStore.addNotification({
      type: 'warning',
      title: 'Signed Out',
      message: 'You have been signed out (some cleanup may have failed).',
      duration: 3000,
    })
  }
}

// ============================================================================
// CACHE MANAGEMENT ACTIONS
// ============================================================================

/**
 * Clear cache with user confirmation
 */
export const clearCacheWithConfirmation = async (type?: 'api' | 'asset' | 'template' | 'project') => {
  const cacheStore = useCacheStore.getState()
  const uiStore = useUIStore.getState()
  
  const typeLabel = type ? type.charAt(0).toUpperCase() + type.slice(1) : 'All'
  
  const confirmed = window.confirm(
    `Are you sure you want to clear ${typeLabel.toLowerCase()} cache? This action cannot be undone.`
  )
  
  if (!confirmed) return
  
  try {
    uiStore.setGlobalLoading(true, `Clearing ${typeLabel.toLowerCase()} cache...`)
    
    cacheStore.clear(type)
    
    uiStore.addNotification({
      type: 'success',
      title: 'Cache Cleared',
      message: `${typeLabel} cache has been cleared successfully.`,
      duration: 3000,
    })
    
  } catch (error) {
    uiStore.addNotification({
      type: 'error',
      title: 'Cache Clear Failed',
      message: error instanceof Error ? error.message : 'Failed to clear cache',
      duration: 5000,
    })
  } finally {
    uiStore.setGlobalLoading(false)
  }
}

// ============================================================================
// SYNC ACTIONS
// ============================================================================

/**
 * Force sync with progress feedback
 */
export const forceSyncWithProgress = async () => {
  const offlineStore = useOfflineStore.getState()
  const uiStore = useUIStore.getState()
  
  if (offlineStore.sync.inProgress) {
    uiStore.addNotification({
      type: 'info',
      title: 'Sync in Progress',
      message: 'Sync is already in progress.',
      duration: 2000,
    })
    return
  }
  
  if (!offlineStore.isOnline) {
    uiStore.addNotification({
      type: 'warning',
      title: 'Offline',
      message: 'Cannot sync while offline.',
      duration: 3000,
    })
    return
  }
  
  try {
    uiStore.setGlobalLoading(true, 'Syncing data...', 0)
    
    await offlineStore.startSync()
    
    uiStore.addNotification({
      type: 'success',
      title: 'Sync Complete',
      message: 'All data has been synchronized successfully.',
      duration: 3000,
    })
    
  } catch (error) {
    uiStore.addNotification({
      type: 'error',
      title: 'Sync Failed',
      message: error instanceof Error ? error.message : 'Failed to sync data',
      duration: 5000,
    })
  } finally {
    uiStore.setGlobalLoading(false)
  }
}

// ============================================================================
// BULK ACTIONS
// ============================================================================

/**
 * Import project data with validation
 */
export const importProjectData = async (file: File) => {
  const projectStore = useProjectStore.getState()
  const uiStore = useUIStore.getState()
  
  try {
    uiStore.setGlobalLoading(true, 'Importing project...')
    
    const text = await file.text()
    const projectData = JSON.parse(text)
    
    // Validate project data structure
    if (!projectData.id || !projectData.name || !Array.isArray(projectData.elements)) {
      throw new Error('Invalid project file format')
    }
    
    // Load the project
    projectStore.loadProject(projectData)
    
    uiStore.addNotification({
      type: 'success',
      title: 'Project Imported',
      message: `Project "${projectData.name}" has been imported successfully.`,
      duration: 3000,
    })
    
  } catch (error) {
    uiStore.addNotification({
      type: 'error',
      title: 'Import Failed',
      message: error instanceof Error ? error.message : 'Failed to import project',
      duration: 5000,
    })
    throw error
  } finally {
    uiStore.setGlobalLoading(false)
  }
}

/**
 * Export project data
 */
export const exportProjectData = () => {
  const projectStore = useProjectStore.getState()
  const uiStore = useUIStore.getState()
  
  if (!projectStore.currentProject) {
    uiStore.addNotification({
      type: 'warning',
      title: 'No Project',
      message: 'No project is currently open to export.',
      duration: 3000,
    })
    return
  }
  
  try {
    const projectData = JSON.stringify(projectStore.currentProject, null, 2)
    const blob = new Blob([projectData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectStore.currentProject.name}.json`
    a.click()
    
    URL.revokeObjectURL(url)
    
    uiStore.addNotification({
      type: 'success',
      title: 'Project Exported',
      message: 'Project data has been exported successfully.',
      duration: 3000,
    })
    
  } catch (error) {
    uiStore.addNotification({
      type: 'error',
      title: 'Export Failed',
      message: error instanceof Error ? error.message : 'Failed to export project',
      duration: 5000,
    })
  }
}

// ============================================================================
// SYSTEM ACTIONS
// ============================================================================

/**
 * Check system health and update status
 */
export const checkSystemHealth = async () => {
  const appStore = useAppStore.getState()
  const uiStore = useUIStore.getState()
  
  try {
    // This would typically call the health check API
    const health = await fetch('/api/health').then(r => r.json())
    
    appStore.updateSystemHealth(health.ok ? 'healthy' : 'degraded')
    
    if (!health.ok) {
      uiStore.addNotification({
        type: 'warning',
        title: 'System Health Warning',
        message: 'Some system services may be experiencing issues.',
        duration: 5000,
      })
    }
    
  } catch (error) {
    appStore.updateSystemHealth('down')
    
    uiStore.addNotification({
      type: 'error',
      title: 'System Health Check Failed',
      message: 'Unable to check system health. You may be offline.',
      duration: 5000,
    })
  }
}

/**
 * Reset application state
 */
export const resetApplicationState = () => {
  const confirmed = window.confirm(
    'Are you sure you want to reset the application? This will clear all local data and cannot be undone.'
  )
  
  if (!confirmed) return
  
  // Reset all stores
  useAppStore.getState().reset()
  useProjectStore.getState().reset()
  useJobStore.getState().reset()
  useUIStore.getState().reset()
  useUserStore.getState().reset()
  useCacheStore.getState().reset()
  useOfflineStore.getState().reset()
  
  // Clear localStorage
  localStorage.clear()
  
  // Reload the page
  window.location.reload()
}
