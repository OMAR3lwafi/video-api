/**
 * Store Context Provider
 * React context for store access and initialization
 */

import React, { createContext, useContext, useEffect, ReactNode } from 'react'
import { useAppStore } from './appStore'
import { useProjectStore } from './projectStore'
import { useJobStore } from './jobStore'
import { useUIStore } from './uiStore'
import { useUserStore } from './userStore'
import { useCacheStore } from './cacheStore'
import { useOfflineStore } from './offlineStore'

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface StoreContextValue {
  // Store instances
  app: typeof useAppStore
  project: typeof useProjectStore
  job: typeof useJobStore
  ui: typeof useUIStore
  user: typeof useUserStore
  cache: typeof useCacheStore
  offline: typeof useOfflineStore
  
  // Utility functions
  reset: () => void
  initialize: () => Promise<void>
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const StoreContext = createContext<StoreContextValue | null>(null)

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface StoreProviderProps {
  children: ReactNode
  autoInitialize?: boolean
}

export function StoreProvider({ children, autoInitialize = true }: StoreProviderProps) {
  // Store references
  const appStore = useAppStore
  const projectStore = useProjectStore
  const jobStore = useJobStore
  const uiStore = useUIStore
  const userStore = useUserStore
  const cacheStore = useCacheStore
  const offlineStore = useOfflineStore

  // Initialize application
  const initialize = async () => {
    try {
      // Initialize app store first
      await useAppStore.getState().initialize()
      
      // Set up other stores based on app state
      const appState = useAppStore.getState()
      
      if (appState.features.realtimeEnabled) {
        // Initialize real-time features
        console.log('Real-time features enabled')
      }
      
      if (appState.features.offlineEnabled) {
        // Initialize offline features
        console.log('Offline features enabled')
      }
      
      if (appState.features.analyticsEnabled) {
        // Initialize analytics
        console.log('Analytics enabled')
      }
      
    } catch (error) {
      console.error('Failed to initialize stores:', error)
      
      // Show error notification
      useUIStore.getState().addNotification({
        type: 'error',
        title: 'Initialization Failed',
        message: 'Failed to initialize the application. Some features may not work correctly.',
        persistent: true,
      })
    }
  }

  // Reset all stores
  const reset = () => {
    useAppStore.getState().reset()
    useProjectStore.getState().reset()
    useJobStore.getState().reset()
    useUIStore.getState().reset()
    useUserStore.getState().reset()
    useCacheStore.getState().reset()
    useOfflineStore.getState().reset()
  }

  // Context value
  const contextValue: StoreContextValue = {
    app: appStore,
    project: projectStore,
    job: jobStore,
    ui: uiStore,
    user: userStore,
    cache: cacheStore,
    offline: offlineStore,
    reset,
    initialize,
  }

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInitialize) {
      initialize()
    }
  }, [autoInitialize])

  // Set up global error handling
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error)
      
      useUIStore.getState().addNotification({
        type: 'error',
        title: 'Application Error',
        message: event.error?.message || 'An unexpected error occurred',
        duration: 5000,
      })
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
      
      useUIStore.getState().addNotification({
        type: 'error',
        title: 'Promise Rejection',
        message: event.reason?.message || 'An unhandled promise rejection occurred',
        duration: 5000,
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const uiState = useUIStore.getState()
      const projectState = useProjectStore.getState()
      
      if (!uiState.shortcuts.enabled) return

      // Global shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault()
            if (projectState.currentProject) {
              projectState.saveProject()
            }
            break
            
          case 'z':
            event.preventDefault()
            if (event.shiftKey) {
              projectState.redo()
            } else {
              projectState.undo()
            }
            break
            
          case 'c':
            if (!event.target || (event.target as HTMLElement).tagName !== 'INPUT') {
              event.preventDefault()
              projectState.copy()
            }
            break
            
          case 'v':
            if (!event.target || (event.target as HTMLElement).tagName !== 'INPUT') {
              event.preventDefault()
              projectState.paste()
            }
            break
            
          case 'a':
            if (!event.target || (event.target as HTMLElement).tagName !== 'INPUT') {
              event.preventDefault()
              projectState.selectAll()
            }
            break
        }
      }
      
      // Other shortcuts
      switch (event.key) {
        case 'Escape':
          // Close modals, clear selection, etc.
          if (uiState.modals.active) {
            uiState.closeModal()
          } else if (projectState.canvas.selectedElements.length > 0) {
            projectState.clearSelection()
          }
          break
          
        case 'Delete':
        case 'Backspace':
          if (projectState.canvas.selectedElements.length > 0) {
            event.preventDefault()
            projectState.canvas.selectedElements.forEach(id => {
              projectState.deleteElement(id)
            })
          }
          break
          
        case ' ':
          // Play/pause timeline
          if (!event.target || (event.target as HTMLElement).tagName !== 'INPUT') {
            event.preventDefault()
            if (projectState.timeline.isPlaying) {
              projectState.pause()
            } else {
              projectState.play()
            }
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  )
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to access store context
 */
export function useStoreContext() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useStoreContext must be used within a StoreProvider')
  }
  return context
}

/**
 * Hook for application initialization status
 */
export function useAppInitialization() {
  const isInitialized = useAppStore((state) => state.isInitialized)
  const isHealthy = useAppStore((state) => state.system.health === 'healthy')
  const { initialize } = useStoreContext()
  
  return {
    isInitialized,
    isHealthy,
    initialize,
    isReady: isInitialized && isHealthy,
  }
}

/**
 * Hook for global application state
 */
export function useGlobalState() {
  const app = useAppStore()
  const ui = useUIStore()
  const user = useUserStore()
  const offline = useOfflineStore()
  
  return {
    // System status
    isOnline: app.isOnline && offline.isOnline,
    isHealthy: app.system.health === 'healthy',
    isInitialized: app.isInitialized,
    isAuthenticated: user.auth.isAuthenticated,
    
    // UI state
    isLoading: ui.globalLoading.isLoading,
    theme: ui.layout.theme,
    
    // Notifications
    notifications: ui.notifications,
    unreadCount: ui.notifications.filter(n => !n.read).length,
    
    // User info
    user: user.profile,
    plan: user.profile?.plan || 'free',
  }
}

/**
 * Hook for store performance metrics
 */
export function useStoreMetrics() {
  const appMetrics = useAppStore((state) => state.performance)
  const cacheStats = useCacheStore((state) => state.stats)
  const queueLength = useOfflineStore((state) => state.queue.length)
  
  return {
    performance: appMetrics,
    cache: cacheStats,
    offlineQueue: queueLength,
    
    // Derived metrics
    overallHealth: {
      performance: appMetrics.renderTime < 16 && appMetrics.memoryUsage < 0.8,
      cache: cacheStats.hitRate > 0.7,
      sync: queueLength < 10,
    },
  }
}

/**
 * Hook for debugging store state
 */
export function useStoreDebug() {
  const stores = useStoreContext()
  
  const getStoreStates = () => ({
    app: useAppStore.getState(),
    project: useProjectStore.getState(),
    job: useJobStore.getState(),
    ui: useUIStore.getState(),
    user: useUserStore.getState(),
    cache: useCacheStore.getState(),
    offline: useOfflineStore.getState(),
  })
  
  const exportStoreStates = () => {
    const states = getStoreStates()
    const blob = new Blob([JSON.stringify(states, null, 2)], { 
      type: 'application/json' 
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `store-states-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  return {
    stores,
    getStoreStates,
    exportStoreStates,
    reset: stores.reset,
  }
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

// Expose stores to window for debugging in development
if (process.env.NODE_ENV === 'development') {
  (window as any).__STORES__ = {
    app: useAppStore,
    project: useProjectStore,
    job: useJobStore,
    ui: useUIStore,
    user: useUserStore,
    cache: useCacheStore,
    offline: useOfflineStore,
  }
}
