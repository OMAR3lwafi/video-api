/**
 * Offline Store - Offline Support and Sync Management
 * Manages offline queue, sync operations, and offline storage
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { persistMiddleware } from './middleware'
import type { OfflineState, OfflineActions } from './types'
import type { VideoProject } from '../types/video'
import { apiService } from '../services/apiService'

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: OfflineState = {
  isOnline: navigator.onLine,
  lastOnline: navigator.onLine ? new Date().toISOString() : undefined,
  connectionQuality: 'excellent',
  
  queue: [],
  
  sync: {
    inProgress: false,
    lastSync: undefined,
    conflictsCount: 0,
    pendingChanges: 0,
    errors: [],
  },
  
  storage: {
    projects: new Map(),
    assets: new Map(),
    drafts: new Map(),
  },
  
  config: {
    enableOfflineMode: true,
    autoSync: true,
    syncInterval: 30000, // 30 seconds
    maxQueueSize: 100,
    maxStorageSize: 100 * 1024 * 1024, // 100MB
    conflictResolution: 'manual',
  },
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useOfflineStore = create<OfflineState & OfflineActions>()(
  devtools(
    persistMiddleware(
      immer((set, get) => ({
        ...initialState,

        // ====================================================================
        // NETWORK STATUS
        // ====================================================================

        setOnlineStatus: (online) => {
          set((state) => {
            state.isOnline = online
            if (online) {
              state.lastOnline = new Date().toISOString()
              // Trigger sync when coming back online
              if (state.config.autoSync && state.queue.length > 0) {
                setTimeout(() => get().processQueue(), 1000)
              }
            }
          })
        },

        setConnectionQuality: (quality) => {
          set((state) => {
            state.connectionQuality = quality
          })
        },

        // ====================================================================
        // QUEUE MANAGEMENT
        // ====================================================================

        addToQueue: (item) => {
          const id = `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const queueItem = {
            ...item,
            id,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            status: 'pending' as const,
          }

          set((state) => {
            // Check queue size limit
            if (state.queue.length >= state.config.maxQueueSize) {
              // Remove oldest low priority items
              state.queue = state.queue
                .sort((a, b) => {
                  if (a.priority !== b.priority) {
                    const priorityOrder = { high: 3, medium: 2, low: 1 }
                    return priorityOrder[b.priority] - priorityOrder[a.priority]
                  }
                  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                })
                .slice(0, state.config.maxQueueSize - 1)
            }

            state.queue.push(queueItem)
            state.sync.pendingChanges++
          })

          // Process queue if online
          if (get().isOnline && get().config.autoSync) {
            setTimeout(() => get().processQueue(), 100)
          }
        },

        removeFromQueue: (id) => {
          set((state) => {
            const index = state.queue.findIndex(item => item.id === id)
            if (index !== -1) {
              state.queue.splice(index, 1)
              state.sync.pendingChanges = Math.max(0, state.sync.pendingChanges - 1)
            }
          })
        },

        processQueue: async () => {
          const state = get()
          
          if (!state.isOnline || state.sync.inProgress || state.queue.length === 0) {
            return
          }

          set((state) => {
            state.sync.inProgress = true
          })

          try {
            const pendingItems = state.queue.filter(item => item.status === 'pending')
            const sortedItems = pendingItems.sort((a, b) => {
              // Sort by priority (high -> medium -> low) then by timestamp
              const priorityOrder = { high: 3, medium: 2, low: 1 }
              if (a.priority !== b.priority) {
                return priorityOrder[b.priority] - priorityOrder[a.priority]
              }
              return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            })

            // Process items one by one
            for (const item of sortedItems.slice(0, 5)) { // Process up to 5 items at a time
              try {
                await get().processQueueItem(item)
              } catch (error) {
                console.error('Failed to process queue item:', item, error)
              }
            }

          } finally {
            set((state) => {
              state.sync.inProgress = false
              state.sync.lastSync = new Date().toISOString()
            })
          }
        },

        retryQueueItem: async (id) => {
          const item = get().queue.find(item => item.id === id)
          if (!item) return

          set((state) => {
            const queueItem = state.queue.find(item => item.id === id)
            if (queueItem) {
              queueItem.status = 'pending'
              queueItem.retryCount++
            }
          })

          if (get().isOnline) {
            await get().processQueueItem(item)
          }
        },

        clearQueue: () => {
          set((state) => {
            state.queue = []
            state.sync.pendingChanges = 0
          })
        },

        // ====================================================================
        // SYNC OPERATIONS
        // ====================================================================

        startSync: async () => {
          if (get().sync.inProgress || !get().isOnline) {
            return
          }

          set((state) => {
            state.sync.inProgress = true
            state.sync.errors = []
          })

          try {
            // Process offline queue
            await get().processQueue()

            // Sync stored projects
            await get().syncStoredProjects()

            set((state) => {
              state.sync.lastSync = new Date().toISOString()
            })

          } catch (error) {
            set((state) => {
              state.sync.errors.push({
                id: `sync-error-${Date.now()}`,
                message: error instanceof Error ? error.message : 'Sync failed',
                timestamp: new Date().toISOString(),
                recoverable: true,
              })
            })
          } finally {
            set((state) => {
              state.sync.inProgress = false
            })
          }
        },

        pauseSync: () => {
          set((state) => {
            state.sync.inProgress = false
          })
        },

        resolveConflict: (projectId, resolution) => {
          const storedProject = get().storage.projects.get(projectId)
          if (!storedProject || storedProject.syncStatus !== 'conflict') {
            return
          }

          set((state) => {
            const project = state.storage.projects.get(projectId)
            if (project) {
              switch (resolution) {
                case 'local':
                  project.syncStatus = 'modified'
                  break
                case 'remote':
                  // Would fetch remote version and replace local
                  project.syncStatus = 'synced'
                  break
                case 'merge':
                  // Would implement merge logic
                  project.syncStatus = 'modified'
                  break
              }
              state.sync.conflictsCount = Math.max(0, state.sync.conflictsCount - 1)
            }
          })
        },

        // ====================================================================
        // OFFLINE STORAGE
        // ====================================================================

        storeProject: (project) => {
          const entry = {
            project,
            lastModified: new Date().toISOString(),
            syncStatus: 'modified' as const,
          }

          set((state) => {
            state.storage.projects.set(project.id, entry)
          })

          // Add to sync queue if online
          if (get().isOnline && get().config.autoSync) {
            get().addToQueue({
              type: 'project_save',
              action: 'save_project',
              data: { project },
              priority: 'medium',
            })
          }
        },

        getStoredProject: (id) => {
          const entry = get().storage.projects.get(id)
          return entry ? entry.project : null
        },

        removeStoredProject: (id) => {
          set((state) => {
            state.storage.projects.delete(id)
          })
        },

        storeAsset: (id, blob, metadata) => {
          const entry = {
            blob,
            metadata,
            lastAccessed: new Date().toISOString(),
          }

          set((state) => {
            state.storage.assets.set(id, entry)
          })

          get().checkStorageLimit()
        },

        getStoredAsset: (id) => {
          const entry = get().storage.assets.get(id)
          if (!entry) return null

          // Update last accessed
          set((state) => {
            const asset = state.storage.assets.get(id)
            if (asset) {
              asset.lastAccessed = new Date().toISOString()
            }
          })

          return {
            blob: entry.blob,
            metadata: entry.metadata,
          }
        },

        storeDraft: (id, data, autoSave = false) => {
          const entry = {
            data,
            timestamp: new Date().toISOString(),
            autoSave,
          }

          set((state) => {
            state.storage.drafts.set(id, entry)
          })
        },

        getDraft: (id) => {
          const entry = get().storage.drafts.get(id)
          return entry ? entry.data : null
        },

        removeDraft: (id) => {
          set((state) => {
            state.storage.drafts.delete(id)
          })
        },

        // ====================================================================
        // CONFIGURATION
        // ====================================================================

        updateConfig: (config) => {
          set((state) => {
            Object.assign(state.config, config)
          })

          // Set up auto-sync interval if enabled
          if (config.autoSync !== undefined) {
            get().setupAutoSync()
          }
        },

        enableOfflineMode: (enabled) => {
          set((state) => {
            state.config.enableOfflineMode = enabled
          })
        },

        // ====================================================================
        // UTILITIES
        // ====================================================================

        getStorageUsage: () => {
          let totalSize = 0
          const state = get()

          // Calculate project storage size
          for (const entry of state.storage.projects.values()) {
            totalSize += new Blob([JSON.stringify(entry.project)]).size
          }

          // Calculate asset storage size
          for (const entry of state.storage.assets.values()) {
            totalSize += entry.blob.size
          }

          // Calculate draft storage size
          for (const entry of state.storage.drafts.values()) {
            totalSize += new Blob([JSON.stringify(entry.data)]).size
          }

          return totalSize
        },

        cleanup: () => {
          const now = Date.now()
          const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days

          set((state) => {
            // Cleanup old drafts
            for (const [id, entry] of state.storage.drafts.entries()) {
              const age = now - new Date(entry.timestamp).getTime()
              if (age > maxAge && !entry.autoSave) {
                state.storage.drafts.delete(id)
              }
            }

            // Cleanup old assets
            for (const [id, entry] of state.storage.assets.entries()) {
              const age = now - new Date(entry.lastAccessed).getTime()
              if (age > maxAge) {
                state.storage.assets.delete(id)
              }
            }

            // Cleanup completed queue items
            state.queue = state.queue.filter(item => 
              item.status !== 'completed' || 
              now - new Date(item.timestamp).getTime() < 24 * 60 * 60 * 1000 // Keep for 24 hours
            )
          })
        },

        export: async () => {
          const state = get()
          const exportData = {
            queue: state.queue,
            projects: Array.from(state.storage.projects.entries()),
            drafts: Array.from(state.storage.drafts.entries()),
            // Note: We don't export assets (blobs) as they're too large
            sync: state.sync,
            config: state.config,
            exportedAt: new Date().toISOString(),
          }

          return new Blob([JSON.stringify(exportData)], { type: 'application/json' })
        },

        import: async (data) => {
          try {
            const text = await data.text()
            const importData = JSON.parse(text)

            set((state) => {
              if (importData.queue) {
                state.queue = importData.queue
              }
              if (importData.projects) {
                state.storage.projects = new Map(importData.projects)
              }
              if (importData.drafts) {
                state.storage.drafts = new Map(importData.drafts)
              }
              if (importData.sync) {
                Object.assign(state.sync, importData.sync)
              }
              if (importData.config) {
                Object.assign(state.config, importData.config)
              }
            })

          } catch (error) {
            console.error('Failed to import offline data:', error)
            throw error
          }
        },

        // ====================================================================
        // RESET
        // ====================================================================

        reset: () => {
          set(() => ({ ...initialState }))
        },

        // ====================================================================
        // PRIVATE HELPERS
        // ====================================================================

        processQueueItem: async (item) => {
          set((state) => {
            const queueItem = state.queue.find(i => i.id === item.id)
            if (queueItem) {
              queueItem.status = 'processing'
            }
          })

          try {
            switch (item.type) {
              case 'api_call':
                await get().processApiCall(item)
                break
              case 'file_upload':
                await get().processFileUpload(item)
                break
              case 'project_save':
                await get().processProjectSave(item)
                break
              case 'export_request':
                await get().processExportRequest(item)
                break
            }

            // Mark as completed
            set((state) => {
              const queueItem = state.queue.find(i => i.id === item.id)
              if (queueItem) {
                queueItem.status = 'completed'
              }
              state.sync.pendingChanges = Math.max(0, state.sync.pendingChanges - 1)
            })

          } catch (error) {
            // Mark as failed and potentially retry
            set((state) => {
              const queueItem = state.queue.find(i => i.id === item.id)
              if (queueItem) {
                queueItem.status = 'failed'
                queueItem.retryCount++

                // Remove from queue if max retries exceeded
                if (queueItem.retryCount >= 3) {
                  state.queue = state.queue.filter(i => i.id !== item.id)
                  state.sync.errors.push({
                    id: `queue-error-${Date.now()}`,
                    message: `Failed to process ${item.type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    timestamp: new Date().toISOString(),
                    recoverable: false,
                  })
                }
              }
            })
            throw error
          }
        },

        processApiCall: async (item) => {
          // Process generic API calls
          const { method, url, data } = item.data
          await apiService[method.toLowerCase()](url, data)
        },

        processFileUpload: async (item) => {
          // Process file uploads
          const { file, url } = item.data
          const formData = new FormData()
          formData.append('file', file)
          await fetch(url, { method: 'POST', body: formData })
        },

        processProjectSave: async (item) => {
          // Process project saves
          const { project } = item.data
          // This would typically call a project save API
          console.log('Saving project:', project.id)
        },

        processExportRequest: async (item) => {
          // Process export requests
          const { request } = item.data
          await apiService.createVideo(request)
        },

        syncStoredProjects: async () => {
          const state = get()
          
          for (const [id, entry] of state.storage.projects.entries()) {
            if (entry.syncStatus === 'modified') {
              try {
                // This would typically sync with the server
                console.log('Syncing project:', id)
                
                set((state) => {
                  const project = state.storage.projects.get(id)
                  if (project) {
                    project.syncStatus = 'synced'
                  }
                })
              } catch (error) {
                set((state) => {
                  const project = state.storage.projects.get(id)
                  if (project) {
                    project.syncStatus = 'conflict'
                    state.sync.conflictsCount++
                  }
                })
              }
            }
          }
        },

        checkStorageLimit: () => {
          const usage = get().getStorageUsage()
          const limit = get().config.maxStorageSize
          
          if (usage > limit) {
            get().evictOldestAssets()
          }
        },

        evictOldestAssets: () => {
          set((state) => {
            const assets = Array.from(state.storage.assets.entries())
            assets.sort((a, b) => 
              new Date(a[1].lastAccessed).getTime() - new Date(b[1].lastAccessed).getTime()
            )
            
            // Remove oldest 25% of assets
            const toRemove = Math.ceil(assets.length * 0.25)
            for (let i = 0; i < toRemove; i++) {
              state.storage.assets.delete(assets[i][0])
            }
          })
        },

        setupAutoSync: () => {
          // This would set up periodic sync intervals
          if (get().config.autoSync) {
            setInterval(() => {
              if (get().isOnline && !get().sync.inProgress) {
                get().startSync()
              }
            }, get().config.syncInterval)
          }
        },
      })),
      {
        name: 'offline-store',
        blacklist: ['isOnline', 'connectionQuality'], // Don't persist network status
        version: 1,
      }
    ),
    {
      name: 'offline-store',
    }
  )
)

// ============================================================================
// NETWORK STATUS MONITORING
// ============================================================================

// Set up network status listeners
window.addEventListener('online', () => {
  useOfflineStore.getState().setOnlineStatus(true)
})

window.addEventListener('offline', () => {
  useOfflineStore.getState().setOnlineStatus(false)
})

// Monitor connection quality
if ('connection' in navigator) {
  const connection = (navigator as any).connection
  
  const updateConnectionQuality = () => {
    const effectiveType = connection.effectiveType
    let quality: OfflineState['connectionQuality'] = 'excellent'
    
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        quality = 'poor'
        break
      case '3g':
        quality = 'fair'
        break
      case '4g':
        quality = 'good'
        break
      default:
        quality = 'excellent'
    }
    
    useOfflineStore.getState().setConnectionQuality(quality)
  }
  
  connection.addEventListener('change', updateConnectionQuality)
  updateConnectionQuality()
}

// ============================================================================
// SELECTORS
// ============================================================================

export const offlineSelectors = {
  isOnline: (state: OfflineState) => state.isOnline,
  queueLength: (state: OfflineState) => state.queue.length,
  pendingChanges: (state: OfflineState) => state.sync.pendingChanges,
  conflictsCount: (state: OfflineState) => state.sync.conflictsCount,
  isSyncing: (state: OfflineState) => state.sync.inProgress,
  storageUsage: (state: OfflineState) => {
    // This would be calculated in a real implementation
    return 0
  },
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for network status
 */
export function useNetworkStatus() {
  return useOfflineStore((state) => ({
    isOnline: state.isOnline,
    lastOnline: state.lastOnline,
    connectionQuality: state.connectionQuality,
  }))
}

/**
 * Hook for offline queue status
 */
export function useOfflineQueue() {
  return useOfflineStore((state) => ({
    length: state.queue.length,
    pending: state.queue.filter(item => item.status === 'pending').length,
    processing: state.queue.filter(item => item.status === 'processing').length,
    failed: state.queue.filter(item => item.status === 'failed').length,
  }))
}

/**
 * Hook for sync status
 */
export function useSyncStatus() {
  const sync = useOfflineStore((state) => state.sync)
  const actions = useOfflineStore((state) => ({
    startSync: state.startSync,
    pauseSync: state.pauseSync,
  }))
  
  return {
    ...sync,
    ...actions,
  }
}
