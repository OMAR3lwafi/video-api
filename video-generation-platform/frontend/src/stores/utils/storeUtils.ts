/**
 * Store Utilities
 * Helper functions for creating and managing Zustand stores
 */

import { StateCreator } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// ============================================================================
// STORE SLICE CREATOR
// ============================================================================

/**
 * Creates a store slice with common patterns
 */
export function createStoreSlice<T, A>(
  name: string,
  stateCreator: StateCreator<T & A, [], [], T & A>
): StateCreator<T & A, [], [], T & A> {
  return (set, get, api) => ({
    ...stateCreator(set, get, api),
  })
}

/**
 * Creates an async store slice with loading and error states
 */
export function createAsyncSlice<T, A>(
  name: string,
  initialState: T,
  actions: (
    set: (fn: (state: T & AsyncState) => void) => void,
    get: () => T & AsyncState,
    api: any
  ) => A
): StateCreator<T & AsyncState & A, [], [], T & AsyncState & A> {
  return (set, get, api) => {
    const setState = (fn: (state: T & AsyncState) => void) => {
      set((state) => {
        fn(state)
      })
    }

    return {
      ...initialState,
      isLoading: false,
      error: null,
      lastUpdate: undefined,
      ...actions(setState, get, api),
    } as T & AsyncState & A
  }
}

interface AsyncState {
  isLoading: boolean
  error: string | null
  lastUpdate?: string
}

// ============================================================================
// MIDDLEWARE FACTORIES
// ============================================================================

/**
 * Creates devtools middleware with proper naming
 */
export function createDevtoolsMiddleware<T>(name: string) {
  return devtools<T>((set, get, api) => ({} as T), {
    name: `VideoPlatform-${name}`,
    enabled: process.env.NODE_ENV === 'development',
  })
}

/**
 * Creates persist middleware with storage options
 */
export function createPersistMiddleware<T>(
  name: string,
  options: {
    whitelist?: (keyof T)[]
    blacklist?: (keyof T)[]
    version?: number
    migrate?: (persistedState: any, version: number) => T
  } = {}
) {
  return persist<T>(
    (set, get, api) => ({} as T),
    {
      name: `video-platform-${name}`,
      version: options.version || 1,
      partialize: (state) => {
        if (options.whitelist) {
          const result: Partial<T> = {}
          options.whitelist.forEach((key) => {
            result[key] = state[key]
          })
          return result
        }
        
        if (options.blacklist) {
          const result = { ...state }
          options.blacklist.forEach((key) => {
            delete result[key]
          })
          return result
        }
        
        return state
      },
      migrate: options.migrate,
    }
  )
}

/**
 * Creates immer middleware for immutable updates
 */
export function createImmerMiddleware<T>() {
  return immer<T>((set, get, api) => ({} as T))
}

/**
 * Creates subscription middleware
 */
export function createSubscriptionMiddleware<T>() {
  return subscribeWithSelector<T>((set, get, api) => ({} as T))
}

// ============================================================================
// ASYNC ACTION HELPERS
// ============================================================================

/**
 * Wraps async actions with loading and error handling
 */
export function withAsyncState<T extends AsyncState, Args extends any[], Return>(
  action: (...args: Args) => Promise<Return>
) {
  return async function (
    this: T,
    set: (fn: (state: T) => void) => void,
    ...args: Args
  ): Promise<Return> {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      const result = await action.apply(this, args)
      
      set((state) => {
        state.isLoading = false
        state.lastUpdate = new Date().toISOString()
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      set((state) => {
        state.isLoading = false
        state.error = errorMessage
        state.lastUpdate = new Date().toISOString()
      })

      throw error
    }
  }
}

/**
 * Creates optimistic update wrapper
 */
export function withOptimisticUpdate<T, Args extends any[], Return>(
  optimisticUpdate: (state: T, ...args: Args) => void,
  action: (...args: Args) => Promise<Return>,
  rollback?: (state: T, error: Error, ...args: Args) => void
) {
  return async function (
    this: T,
    set: (fn: (state: T) => void) => void,
    get: () => T,
    ...args: Args
  ): Promise<Return> {
    // Apply optimistic update
    const previousState = JSON.parse(JSON.stringify(get()))
    set((state) => optimisticUpdate(state, ...args))

    try {
      const result = await action.apply(this, args)
      return result
    } catch (error) {
      // Rollback on error
      if (rollback) {
        set((state) => rollback(state, error as Error, ...args))
      } else {
        // Simple rollback to previous state
        set(() => previousState)
      }
      throw error
    }
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Creates validation wrapper for actions
 */
export function withValidation<Args extends any[], Return>(
  validator: (...args: Args) => boolean | string,
  action: (...args: Args) => Return
) {
  return function (...args: Args): Return {
    const validation = validator(...args)
    
    if (validation !== true) {
      const errorMessage = typeof validation === 'string' ? validation : 'Validation failed'
      throw new Error(errorMessage)
    }

    return action.apply(this, args)
  }
}

// ============================================================================
// DEBOUNCE HELPERS
// ============================================================================

/**
 * Creates debounced action wrapper
 */
export function withDebounce<Args extends any[], Return>(
  action: (...args: Args) => Return,
  delay: number
) {
  let timeoutId: NodeJS.Timeout | null = null

  return function (...args: Args): Promise<Return> {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(() => {
        try {
          const result = action.apply(this, args)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }, delay)
    })
  }
}

/**
 * Creates throttled action wrapper
 */
export function withThrottle<Args extends any[], Return>(
  action: (...args: Args) => Return,
  delay: number
) {
  let lastCall = 0
  let timeoutId: NodeJS.Timeout | null = null

  return function (...args: Args): Return | Promise<Return> {
    const now = Date.now()

    if (now - lastCall >= delay) {
      lastCall = now
      return action.apply(this, args)
    } else {
      return new Promise((resolve, reject) => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        timeoutId = setTimeout(() => {
          lastCall = Date.now()
          try {
            const result = action.apply(this, args)
            resolve(result)
          } catch (error) {
            reject(error)
          }
        }, delay - (now - lastCall))
      })
    }
  }
}

// ============================================================================
// CACHE HELPERS
// ============================================================================

/**
 * Creates cached action wrapper
 */
export function withCache<Args extends any[], Return>(
  action: (...args: Args) => Return,
  getCacheKey: (...args: Args) => string,
  ttl: number = 5 * 60 * 1000 // 5 minutes
) {
  const cache = new Map<string, { value: Return; timestamp: number }>()

  return function (...args: Args): Return {
    const key = getCacheKey(...args)
    const cached = cache.get(key)
    const now = Date.now()

    if (cached && now - cached.timestamp < ttl) {
      return cached.value
    }

    const result = action.apply(this, args)
    cache.set(key, { value: result, timestamp: now })

    // Cleanup old entries
    for (const [cacheKey, cacheValue] of cache.entries()) {
      if (now - cacheValue.timestamp >= ttl) {
        cache.delete(cacheKey)
      }
    }

    return result
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Creates error boundary wrapper for actions
 */
export function withErrorBoundary<Args extends any[], Return>(
  action: (...args: Args) => Return,
  onError?: (error: Error, ...args: Args) => void,
  fallback?: (...args: Args) => Return
) {
  return function (...args: Args): Return {
    try {
      return action.apply(this, args)
    } catch (error) {
      onError?.(error as Error, ...args)
      
      if (fallback) {
        return fallback.apply(this, args)
      }
      
      throw error
    }
  }
}

// ============================================================================
// STORE COMPOSITION
// ============================================================================

/**
 * Composes multiple store slices
 */
export function composeStores<T>(...slices: StateCreator<T, [], [], any>[]): StateCreator<T, [], [], T> {
  return (set, get, api) => {
    const composedState = {} as T
    
    slices.forEach((slice) => {
      Object.assign(composedState, slice(set, get, api))
    })
    
    return composedState
  }
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

export type StoreApi<T> = {
  getState: () => T
  setState: (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => void
  subscribe: (listener: (state: T, prevState: T) => void) => () => void
  destroy: () => void
}

export type StoreSlice<T, A> = T & A

export type AsyncAction<Args extends any[], Return> = (
  ...args: Args
) => Promise<Return>

export type SyncAction<Args extends any[], Return> = (
  ...args: Args
) => Return
