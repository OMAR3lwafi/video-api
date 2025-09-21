/**
 * Cache Store - API Response and Asset Caching
 * Manages API response cache, asset cache, and cache optimization
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { CacheState, CacheActions } from './types'
import type { VideoProject } from '../types/video'
import { env } from '../config/env'

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

/**
 * Simple compression using JSON stringify with space removal
 */
function compress(data: any): string {
  return JSON.stringify(data)
}

/**
 * Simple decompression
 */
function decompress(data: string): any {
  return JSON.parse(data)
}

/**
 * Calculate size of data in bytes
 */
function getDataSize(data: any): number {
  return new Blob([JSON.stringify(data)]).size
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: CacheState = {
  apiCache: new Map(),
  assetCache: new Map(),
  templateCache: new Map(),
  projectCache: new Map(),
  
  stats: {
    totalSize: 0,
    maxSize: env.CACHE_CONFIG?.maxSize || 50 * 1024 * 1024, // 50MB
    hitRate: 0,
    missRate: 0,
    evictionCount: 0,
    lastCleanup: new Date().toISOString(),
  },
  
  config: {
    apiTtl: env.CACHE_CONFIG?.ttl || 5 * 60 * 1000, // 5 minutes
    assetTtl: 30 * 60 * 1000, // 30 minutes
    templateTtl: 60 * 60 * 1000, // 1 hour
    projectTtl: 10 * 60 * 1000, // 10 minutes
    maxSize: env.CACHE_CONFIG?.maxSize || 50 * 1024 * 1024, // 50MB
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    compressionEnabled: true,
  },
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useCacheStore = create<CacheState & CacheActions>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // ====================================================================
      // API CACHE
      // ====================================================================

      setApiCache: (key, data, ttl) => {
        const entry = {
          data: get().config.compressionEnabled ? compress(data) : data,
          timestamp: new Date().toISOString(),
          ttl: ttl || get().config.apiTtl,
        }

        set((state) => {
          state.apiCache.set(key, entry)
        })

        get().updateStats()
        get().checkSizeLimit()
      },

      getApiCache: (key) => {
        const entry = get().apiCache.get(key)
        if (!entry) {
          get().recordCacheMiss()
          return null
        }

        // Check if expired
        const now = Date.now()
        const entryTime = new Date(entry.timestamp).getTime()
        if (now - entryTime > entry.ttl) {
          set((state) => {
            state.apiCache.delete(key)
          })
          get().recordCacheMiss()
          return null
        }

        get().recordCacheHit()
        return get().config.compressionEnabled ? decompress(entry.data) : entry.data
      },

      invalidateApiCache: (pattern) => {
        if (!pattern) {
          set((state) => {
            state.apiCache.clear()
          })
          return
        }

        set((state) => {
          for (const key of state.apiCache.keys()) {
            if (key.includes(pattern)) {
              state.apiCache.delete(key)
            }
          }
        })

        get().updateStats()
      },

      // ====================================================================
      // ASSET CACHE
      // ====================================================================

      setAssetCache: (key, url, blob) => {
        const entry = {
          url,
          blob,
          metadata: {
            size: blob ? blob.size : 0,
            type: blob ? blob.type : 'unknown',
            lastAccessed: new Date().toISOString(),
            accessCount: 1,
          },
        }

        set((state) => {
          state.assetCache.set(key, entry)
        })

        get().updateStats()
        get().checkSizeLimit()
      },

      getAssetCache: (key) => {
        const entry = get().assetCache.get(key)
        if (!entry) {
          get().recordCacheMiss()
          return null
        }

        // Update access metadata
        set((state) => {
          const cached = state.assetCache.get(key)
          if (cached) {
            cached.metadata.lastAccessed = new Date().toISOString()
            cached.metadata.accessCount++
          }
        })

        get().recordCacheHit()
        return entry
      },

      preloadAsset: async (url) => {
        const key = `asset:${url}`
        
        // Check if already cached
        if (get().getAssetCache(key)) {
          return
        }

        try {
          const response = await fetch(url)
          if (response.ok) {
            const blob = await response.blob()
            get().setAssetCache(key, url, blob)
          }
        } catch (error) {
          console.warn(`Failed to preload asset: ${url}`, error)
        }
      },

      // ====================================================================
      // TEMPLATE CACHE
      // ====================================================================

      setTemplateCache: (id, template, thumbnail) => {
        const entry = {
          template,
          thumbnail,
          metadata: {
            size: getDataSize(template),
            lastUsed: new Date().toISOString(),
            useCount: 1,
          },
        }

        set((state) => {
          state.templateCache.set(id, entry)
        })

        get().updateStats()
        get().checkSizeLimit()
      },

      getTemplateCache: (id) => {
        const entry = get().templateCache.get(id)
        if (!entry) {
          get().recordCacheMiss()
          return null
        }

        // Update usage metadata
        set((state) => {
          const cached = state.templateCache.get(id)
          if (cached) {
            cached.metadata.lastUsed = new Date().toISOString()
            cached.metadata.useCount++
          }
        })

        get().recordCacheHit()
        return entry.template
      },

      preloadTemplate: async (id) => {
        // Check if already cached
        if (get().getTemplateCache(id)) {
          return
        }

        try {
          // This would typically fetch from an API
          // For now, we'll just simulate the operation
          console.log(`Preloading template: ${id}`)
        } catch (error) {
          console.warn(`Failed to preload template: ${id}`, error)
        }
      },

      // ====================================================================
      // PROJECT CACHE
      // ====================================================================

      setProjectCache: (id, project, thumbnail) => {
        const entry = {
          project,
          thumbnail,
          metadata: {
            size: getDataSize(project),
            lastAccessed: new Date().toISOString(),
            version: project.version || 1,
          },
        }

        set((state) => {
          state.projectCache.set(id, entry)
        })

        get().updateStats()
        get().checkSizeLimit()
      },

      getProjectCache: (id) => {
        const entry = get().projectCache.get(id)
        if (!entry) {
          get().recordCacheMiss()
          return null
        }

        // Update access metadata
        set((state) => {
          const cached = state.projectCache.get(id)
          if (cached) {
            cached.metadata.lastAccessed = new Date().toISOString()
          }
        })

        get().recordCacheHit()
        return entry.project
      },

      // ====================================================================
      // CACHE MANAGEMENT
      // ====================================================================

      cleanup: () => {
        const now = Date.now()
        let evictionCount = 0

        set((state) => {
          // Cleanup API cache
          for (const [key, entry] of state.apiCache.entries()) {
            const entryTime = new Date(entry.timestamp).getTime()
            if (now - entryTime > entry.ttl) {
              state.apiCache.delete(key)
              evictionCount++
            }
          }

          // Cleanup asset cache based on TTL
          for (const [key, entry] of state.assetCache.entries()) {
            const accessTime = new Date(entry.metadata.lastAccessed).getTime()
            if (now - accessTime > state.config.assetTtl) {
              state.assetCache.delete(key)
              evictionCount++
            }
          }

          // Cleanup template cache
          for (const [key, entry] of state.templateCache.entries()) {
            const useTime = new Date(entry.metadata.lastUsed).getTime()
            if (now - useTime > state.config.templateTtl) {
              state.templateCache.delete(key)
              evictionCount++
            }
          }

          // Cleanup project cache
          for (const [key, entry] of state.projectCache.entries()) {
            const accessTime = new Date(entry.metadata.lastAccessed).getTime()
            if (now - accessTime > state.config.projectTtl) {
              state.projectCache.delete(key)
              evictionCount++
            }
          }

          state.stats.evictionCount += evictionCount
          state.stats.lastCleanup = new Date().toISOString()
        })

        get().updateStats()
      },

      clear: (type) => {
        set((state) => {
          if (!type) {
            // Clear all caches
            state.apiCache.clear()
            state.assetCache.clear()
            state.templateCache.clear()
            state.projectCache.clear()
          } else {
            // Clear specific cache type
            switch (type) {
              case 'api':
                state.apiCache.clear()
                break
              case 'asset':
                state.assetCache.clear()
                break
              case 'template':
                state.templateCache.clear()
                break
              case 'project':
                state.projectCache.clear()
                break
            }
          }
        })

        get().updateStats()
      },

      compress: async () => {
        if (!get().config.compressionEnabled) {
          return
        }

        set((state) => {
          // Compress API cache entries
          for (const [key, entry] of state.apiCache.entries()) {
            if (typeof entry.data !== 'string') {
              entry.data = compress(entry.data)
            }
          }
        })

        get().updateStats()
      },

      export: async () => {
        const state = get()
        const exportData = {
          apiCache: Array.from(state.apiCache.entries()),
          templateCache: Array.from(state.templateCache.entries()),
          projectCache: Array.from(state.projectCache.entries()),
          // Note: We don't export asset cache (blobs) as they're too large
          stats: state.stats,
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
            // Import caches
            if (importData.apiCache) {
              state.apiCache = new Map(importData.apiCache)
            }
            if (importData.templateCache) {
              state.templateCache = new Map(importData.templateCache)
            }
            if (importData.projectCache) {
              state.projectCache = new Map(importData.projectCache)
            }

            // Import configuration
            if (importData.config) {
              Object.assign(state.config, importData.config)
            }
          })

          get().updateStats()
        } catch (error) {
          console.error('Failed to import cache data:', error)
          throw error
        }
      },

      // ====================================================================
      // CONFIGURATION
      // ====================================================================

      updateConfig: (config) => {
        set((state) => {
          Object.assign(state.config, config)
        })
      },

      // ====================================================================
      // STATISTICS
      // ====================================================================

      updateStats: () => {
        set((state) => {
          let totalSize = 0

          // Calculate API cache size
          for (const entry of state.apiCache.values()) {
            totalSize += getDataSize(entry.data)
          }

          // Calculate asset cache size
          for (const entry of state.assetCache.values()) {
            totalSize += entry.metadata.size
          }

          // Calculate template cache size
          for (const entry of state.templateCache.values()) {
            totalSize += entry.metadata.size
          }

          // Calculate project cache size
          for (const entry of state.projectCache.values()) {
            totalSize += entry.metadata.size
          }

          state.stats.totalSize = totalSize
        })
      },

      getCacheInfo: () => {
        get().updateStats()
        return get().stats
      },

      // ====================================================================
      // PRIVATE HELPERS
      // ====================================================================

      recordCacheHit: () => {
        set((state) => {
          const total = state.stats.hitRate + state.stats.missRate + 1
          state.stats.hitRate = (state.stats.hitRate + 1) / total
          state.stats.missRate = state.stats.missRate / total
        })
      },

      recordCacheMiss: () => {
        set((state) => {
          const total = state.stats.hitRate + state.stats.missRate + 1
          state.stats.hitRate = state.stats.hitRate / total
          state.stats.missRate = (state.stats.missRate + 1) / total
        })
      },

      checkSizeLimit: () => {
        const state = get()
        if (state.stats.totalSize > state.config.maxSize) {
          get().evictLeastRecentlyUsed()
        }
      },

      evictLeastRecentlyUsed: () => {
        // Simple LRU eviction strategy
        set((state) => {
          const entries: Array<{
            key: string
            type: 'api' | 'asset' | 'template' | 'project'
            lastAccess: number
            size: number
          }> = []

          // Collect all cache entries with access times
          for (const [key, entry] of state.apiCache.entries()) {
            entries.push({
              key,
              type: 'api',
              lastAccess: new Date(entry.timestamp).getTime(),
              size: getDataSize(entry.data),
            })
          }

          for (const [key, entry] of state.assetCache.entries()) {
            entries.push({
              key,
              type: 'asset',
              lastAccess: new Date(entry.metadata.lastAccessed).getTime(),
              size: entry.metadata.size,
            })
          }

          for (const [key, entry] of state.templateCache.entries()) {
            entries.push({
              key,
              type: 'template',
              lastAccess: new Date(entry.metadata.lastUsed).getTime(),
              size: entry.metadata.size,
            })
          }

          for (const [key, entry] of state.projectCache.entries()) {
            entries.push({
              key,
              type: 'project',
              lastAccess: new Date(entry.metadata.lastAccessed).getTime(),
              size: entry.metadata.size,
            })
          }

          // Sort by last access time (oldest first)
          entries.sort((a, b) => a.lastAccess - b.lastAccess)

          // Evict entries until we're under the size limit
          let evictedSize = 0
          const targetReduction = state.stats.totalSize * 0.2 // Remove 20% of cache

          for (const entry of entries) {
            if (evictedSize >= targetReduction) break

            switch (entry.type) {
              case 'api':
                state.apiCache.delete(entry.key)
                break
              case 'asset':
                state.assetCache.delete(entry.key)
                break
              case 'template':
                state.templateCache.delete(entry.key)
                break
              case 'project':
                state.projectCache.delete(entry.key)
                break
            }

            evictedSize += entry.size
            state.stats.evictionCount++
          }
        })

        get().updateStats()
      },

      // ====================================================================
      // RESET
      // ====================================================================

      reset: () => {
        set(() => ({ ...initialState }))
      },
    })),
    {
      name: 'cache-store',
    }
  )
)

// ============================================================================
// AUTO CLEANUP
// ============================================================================

// Set up automatic cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null

export function startCacheCleanup() {
  if (cleanupInterval) return

  cleanupInterval = setInterval(() => {
    const store = useCacheStore.getState()
    store.cleanup()
  }, initialState.config.cleanupInterval)
}

export function stopCacheCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

// Start cleanup by default
startCacheCleanup()

// ============================================================================
// SELECTORS
// ============================================================================

export const cacheSelectors = {
  totalSize: (state: CacheState) => state.stats.totalSize,
  hitRate: (state: CacheState) => state.stats.hitRate,
  isOverLimit: (state: CacheState) => state.stats.totalSize > state.config.maxSize,
  cacheStats: (state: CacheState) => state.stats,
  config: (state: CacheState) => state.config,
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for cache statistics
 */
export function useCacheStats() {
  return useCacheStore((state) => state.stats)
}

/**
 * Hook for cache configuration
 */
export function useCacheConfig() {
  const config = useCacheStore((state) => state.config)
  const updateConfig = useCacheStore((state) => state.updateConfig)
  
  return {
    config,
    updateConfig,
  }
}

/**
 * Hook for cache management actions
 */
export function useCacheActions() {
  return useCacheStore((state) => ({
    cleanup: state.cleanup,
    clear: state.clear,
    compress: state.compress,
    export: state.export,
    import: state.import,
  }))
}
