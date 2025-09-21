/**
 * App Store - Global Application State
 * Manages application lifecycle, system status, and performance metrics
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { AppState, AppActions } from './types'
import { videoApiService } from '../services/api'
import { env } from '../config/env'

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AppState = {
  isInitialized: false,
  isOnline: navigator.onLine,
  lastSync: undefined,
  
  performance: {
    renderTime: 0,
    memoryUsage: 0,
    apiLatency: 0,
  },
  
  features: {
    realtimeEnabled: env.ENABLE_REALTIME,
    offlineEnabled: true,
    analyticsEnabled: env.ENABLE_ANALYTICS,
    collaborationEnabled: env.ENABLE_COLLABORATION,
  },
  
  system: {
    health: 'healthy',
    maintenance: false,
    version: '1.0.0',
  },
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useAppStore = create<AppState & AppActions>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // ========================================================================
      // INITIALIZATION
      // ========================================================================

      initialize: async () => {
        try {
          set((state) => {
            state.isInitialized = false
          })

          // Check system health
          const healthCheck = await videoApiService.healthCheck()
          
          set((state) => {
            state.system.health = healthCheck.ok ? 'healthy' : 'degraded'
            state.isInitialized = true
            state.lastSync = new Date().toISOString()
          })

          // Set up performance monitoring
          if (get().features.analyticsEnabled) {
            setupPerformanceMonitoring()
          }

          // Set up online/offline listeners
          setupNetworkListeners()

        } catch (error) {
          console.error('App initialization failed:', error)
          
          set((state) => {
            state.system.health = 'down'
            state.isInitialized = true
          })
        }
      },

      setInitialized: (initialized) => {
        set((state) => {
          state.isInitialized = initialized
        })
      },

      // ========================================================================
      // NETWORK STATUS
      // ========================================================================

      setOnlineStatus: (online) => {
        set((state) => {
          state.isOnline = online
          if (online) {
            state.lastSync = new Date().toISOString()
          }
        })
      },

      updateLastSync: (timestamp) => {
        set((state) => {
          state.lastSync = timestamp || new Date().toISOString()
        })
      },

      // ========================================================================
      // PERFORMANCE TRACKING
      // ========================================================================

      updatePerformance: (metrics) => {
        set((state) => {
          Object.assign(state.performance, metrics)
        })
      },

      // ========================================================================
      // FEATURE FLAGS
      // ========================================================================

      toggleFeature: (feature, enabled) => {
        set((state) => {
          if (enabled !== undefined) {
            state.features[feature] = enabled
          } else {
            state.features[feature] = !state.features[feature]
          }
        })
      },

      // ========================================================================
      // SYSTEM STATUS
      // ========================================================================

      updateSystemHealth: (health) => {
        set((state) => {
          state.system.health = health
        })
      },

      setMaintenanceMode: (maintenance) => {
        set((state) => {
          state.system.maintenance = maintenance
        })
      },

      updateVersion: (version) => {
        set((state) => {
          state.system.version = version
        })
      },

      // ========================================================================
      // CLEANUP
      // ========================================================================

      reset: () => {
        set(() => ({ ...initialState }))
      },
    })),
    {
      name: 'app-store',
    }
  )
)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set up performance monitoring
 */
function setupPerformanceMonitoring() {
  const store = useAppStore.getState()
  
  // Monitor render performance
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      
      entries.forEach((entry) => {
        if (entry.entryType === 'measure') {
          store.updatePerformance({
            renderTime: entry.duration,
          })
        }
      })
    })
    
    observer.observe({ entryTypes: ['measure'] })
  }

  // Monitor memory usage
  if ('memory' in performance) {
    setInterval(() => {
      const memory = (performance as any).memory
      store.updatePerformance({
        memoryUsage: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
      })
    }, 10000) // Every 10 seconds
  }

  // Monitor API latency
  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    const start = performance.now()
    try {
      const response = await originalFetch(...args)
      const latency = performance.now() - start
      
      store.updatePerformance({
        apiLatency: latency,
      })
      
      return response
    } catch (error) {
      const latency = performance.now() - start
      store.updatePerformance({
        apiLatency: latency,
      })
      throw error
    }
  }
}

/**
 * Set up network status listeners
 */
function setupNetworkListeners() {
  const store = useAppStore.getState()
  
  const handleOnline = () => {
    store.setOnlineStatus(true)
    
    // Check system health when coming back online
    videoApiService.healthCheck()
      .then((result) => {
        store.updateSystemHealth(result.ok ? 'healthy' : 'degraded')
      })
      .catch(() => {
        store.updateSystemHealth('down')
      })
  }

  const handleOffline = () => {
    store.setOnlineStatus(false)
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Cleanup function (would be called on unmount if this were in a component)
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

// ============================================================================
// SELECTORS
// ============================================================================

export const appSelectors = {
  isInitialized: (state: AppState) => state.isInitialized,
  isOnline: (state: AppState) => state.isOnline,
  systemHealth: (state: AppState) => state.system.health,
  isHealthy: (state: AppState) => state.system.health === 'healthy',
  isInMaintenance: (state: AppState) => state.system.maintenance,
  performance: (state: AppState) => state.performance,
  features: (state: AppState) => state.features,
  isFeatureEnabled: (feature: keyof AppState['features']) => 
    (state: AppState) => state.features[feature],
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for system health status
 */
export function useSystemHealth() {
  return useAppStore((state) => ({
    health: state.system.health,
    isHealthy: state.system.health === 'healthy',
    maintenance: state.system.maintenance,
    version: state.system.version,
  }))
}

/**
 * Hook for network status
 */
export function useNetworkStatus() {
  return useAppStore((state) => ({
    isOnline: state.isOnline,
    lastSync: state.lastSync,
  }))
}

/**
 * Hook for performance metrics
 */
export function usePerformanceMetrics() {
  return useAppStore((state) => state.performance)
}

/**
 * Hook for feature flags
 */
export function useFeatureFlags() {
  const features = useAppStore((state) => state.features)
  const toggleFeature = useAppStore((state) => state.toggleFeature)
  
  return {
    features,
    toggleFeature,
    isEnabled: (feature: keyof AppState['features']) => features[feature],
  }
}

/**
 * Hook for app initialization
 */
export function useAppInitialization() {
  const isInitialized = useAppStore((state) => state.isInitialized)
  const initialize = useAppStore((state) => state.initialize)
  
  return {
    isInitialized,
    initialize,
  }
}
