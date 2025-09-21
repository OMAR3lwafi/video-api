/**
 * Store Middleware
 * Custom middleware for Zustand stores
 */

import { StateCreator } from 'zustand'

// ============================================================================
// PERSISTENCE MIDDLEWARE
// ============================================================================

export interface PersistOptions<T> {
  name: string
  version?: number
  whitelist?: (keyof T)[]
  blacklist?: (keyof T)[]
  storage?: Storage
  serialize?: (state: T) => string
  deserialize?: (str: string) => T
  onRehydrateStorage?: (state: T) => void
  migrate?: (persistedState: any, version: number) => T
}

export function persistMiddleware<T>(
  config: StateCreator<T, [], [], T>,
  options: PersistOptions<T>
): StateCreator<T, [], [], T> {
  return (set, get, api) => {
    const {
      name,
      version = 1,
      whitelist,
      blacklist,
      storage = localStorage,
      serialize = JSON.stringify,
      deserialize = JSON.parse,
      onRehydrateStorage,
      migrate,
    } = options

    // Create the store
    const store = config(set, get, api)

    // Load persisted state
    const loadPersistedState = () => {
      try {
        const item = storage.getItem(name)
        if (!item) return

        const persistedState = deserialize(item)
        const persistedVersion = persistedState._version || 0

        let stateToRestore = persistedState

        // Handle version migration
        if (migrate && persistedVersion !== version) {
          stateToRestore = migrate(persistedState, persistedVersion)
        }

        // Apply whitelist/blacklist
        if (whitelist || blacklist) {
          const currentState = get()
          const filteredState = { ...currentState }

          if (whitelist) {
            Object.keys(filteredState).forEach((key) => {
              if (!whitelist.includes(key as keyof T)) {
                delete filteredState[key as keyof T]
              }
            })
          }

          if (blacklist) {
            blacklist.forEach((key) => {
              delete filteredState[key]
            })
          }

          Object.assign(filteredState, stateToRestore)
          set(filteredState)
        } else {
          set({ ...stateToRestore, _version: version })
        }

        onRehydrateStorage?.(get())
      } catch (error) {
        console.error(`Failed to load persisted state for ${name}:`, error)
      }
    }

    // Save state to storage
    const saveState = () => {
      try {
        const state = get()
        let stateToSave: Partial<T> = state

        // Apply whitelist/blacklist
        if (whitelist) {
          stateToSave = {}
          whitelist.forEach((key) => {
            stateToSave[key] = state[key]
          })
        } else if (blacklist) {
          stateToSave = { ...state }
          blacklist.forEach((key) => {
            delete stateToSave[key]
          })
        }

        const serializedState = serialize({
          ...stateToSave,
          _version: version,
        } as T)

        storage.setItem(name, serializedState)
      } catch (error) {
        console.error(`Failed to save state for ${name}:`, error)
      }
    }

    // Subscribe to state changes
    api.subscribe(saveState)

    // Load initial state
    loadPersistedState()

    return store
  }
}

// ============================================================================
// DEVTOOLS MIDDLEWARE
// ============================================================================

export interface DevtoolsOptions {
  name?: string
  enabled?: boolean
  actionSanitizer?: (action: any, id: number) => any
  stateSanitizer?: (state: any, index: number) => any
}

export function devtoolsMiddleware<T>(
  config: StateCreator<T, [], [], T>,
  options: DevtoolsOptions = {}
): StateCreator<T, [], [], T> {
  return (set, get, api) => {
    const {
      name = 'Store',
      enabled = process.env.NODE_ENV === 'development',
      actionSanitizer,
      stateSanitizer,
    } = options

    if (!enabled || typeof window === 'undefined' || !window.__REDUX_DEVTOOLS_EXTENSION__) {
      return config(set, get, api)
    }

    const devtools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({
      name,
      actionSanitizer,
      stateSanitizer,
    })

    let isRecording = true
    devtools.init(get())

    const newSet: typeof set = (partial, replace, action) => {
      const nextState = typeof partial === 'function' ? partial(get()) : partial
      const previousState = get()

      set(partial, replace)

      if (isRecording) {
        devtools.send(
          action || { type: 'anonymous' },
          replace ? nextState : { ...previousState, ...nextState }
        )
      }
    }

    const newApi = {
      ...api,
      setState: newSet,
    }

    devtools.subscribe((message: any) => {
      switch (message.type) {
        case 'DISPATCH':
          switch (message.payload.type) {
            case 'RESET':
              devtools.init(get())
              return

            case 'COMMIT':
              devtools.init(get())
              return

            case 'ROLLBACK':
              const state = devtools.getState()
              if (state) {
                set(JSON.parse(state), true)
              }
              return

            case 'JUMP_TO_STATE':
            case 'JUMP_TO_ACTION':
              if (message.state) {
                set(JSON.parse(message.state), true)
              }
              return

            case 'IMPORT_STATE':
              const { nextLiftedState } = message.payload
              const computedStates = nextLiftedState.computedStates || []
              
              isRecording = false
              computedStates.forEach(({ state }: any, index: number) => {
                if (index === 0) {
                  devtools.init(state)
                } else {
                  set(state, true)
                }
              })
              isRecording = true
              return

            case 'PAUSE_RECORDING':
              isRecording = !isRecording
              return
          }
      }
    })

    return config(newSet, get, newApi)
  }
}

// ============================================================================
// LOGGER MIDDLEWARE
// ============================================================================

export interface LoggerOptions {
  enabled?: boolean
  collapsed?: boolean
  predicate?: (state: any, action: any) => boolean
  logger?: Pick<Console, 'log' | 'group' | 'groupEnd' | 'groupCollapsed'>
  actionTransformer?: (action: any) => any
  stateTransformer?: (state: any) => any
  errorTransformer?: (error: any) => any
}

export function loggerMiddleware<T>(
  config: StateCreator<T, [], [], T>,
  options: LoggerOptions = {}
): StateCreator<T, [], [], T> {
  return (set, get, api) => {
    const {
      enabled = process.env.NODE_ENV === 'development',
      collapsed = false,
      predicate = () => true,
      logger = console,
      actionTransformer = (action: any) => action,
      stateTransformer = (state: any) => state,
      errorTransformer = (error: any) => error,
    } = options

    if (!enabled) {
      return config(set, get, api)
    }

    const newSet: typeof set = (partial, replace, action) => {
      const previousState = get()
      const actionToLog = actionTransformer(action || { type: 'anonymous' })

      if (!predicate(previousState, actionToLog)) {
        set(partial, replace)
        return
      }

      const startTime = Date.now()
      const groupMethod = collapsed ? logger.groupCollapsed : logger.group

      try {
        set(partial, replace)
        const nextState = get()
        const took = Date.now() - startTime

        groupMethod(`%c action`, 'color: #03A9F4; font-weight: bold', actionToLog.type)
        logger.log('%c prev state', 'color: #9E9E9E; font-weight: bold', stateTransformer(previousState))
        logger.log('%c action    ', 'color: #03A9F4; font-weight: bold', actionToLog)
        logger.log('%c next state', 'color: #4CAF50; font-weight: bold', stateTransformer(nextState))
        logger.log(`%c took ${took}ms`, 'color: #FF9800; font-weight: bold')
        logger.groupEnd()
      } catch (error) {
        const took = Date.now() - startTime

        groupMethod(`%c action`, 'color: #F44336; font-weight: bold', actionToLog.type)
        logger.log('%c prev state', 'color: #9E9E9E; font-weight: bold', stateTransformer(previousState))
        logger.log('%c action    ', 'color: #03A9F4; font-weight: bold', actionToLog)
        logger.log('%c error     ', 'color: #F44336; font-weight: bold', errorTransformer(error))
        logger.log(`%c took ${took}ms`, 'color: #FF9800; font-weight: bold')
        logger.groupEnd()

        throw error
      }
    }

    return config(newSet, get, api)
  }
}

// ============================================================================
// ANALYTICS MIDDLEWARE
// ============================================================================

export interface AnalyticsOptions {
  enabled?: boolean
  trackActions?: boolean
  trackStateChanges?: boolean
  actionFilter?: (action: any) => boolean
  stateFilter?: (state: any) => boolean
  onAction?: (action: any, state: any) => void
  onStateChange?: (state: any, prevState: any) => void
}

export function analyticsMiddleware<T>(
  config: StateCreator<T, [], [], T>,
  options: AnalyticsOptions = {}
): StateCreator<T, [], [], T> {
  return (set, get, api) => {
    const {
      enabled = true,
      trackActions = true,
      trackStateChanges = false,
      actionFilter = () => true,
      stateFilter = () => true,
      onAction,
      onStateChange,
    } = options

    if (!enabled) {
      return config(set, get, api)
    }

    const newSet: typeof set = (partial, replace, action) => {
      const previousState = get()

      if (trackActions && action && actionFilter(action)) {
        onAction?.(action, previousState)
      }

      set(partial, replace)

      if (trackStateChanges) {
        const nextState = get()
        if (stateFilter(nextState)) {
          onStateChange?.(nextState, previousState)
        }
      }
    }

    return config(newSet, get, api)
  }
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

export interface ValidationOptions<T> {
  enabled?: boolean
  validator?: (state: T) => boolean | string
  onValidationError?: (error: string, state: T) => void
  strict?: boolean
}

export function validationMiddleware<T>(
  config: StateCreator<T, [], [], T>,
  options: ValidationOptions<T> = {}
): StateCreator<T, [], [], T> {
  return (set, get, api) => {
    const {
      enabled = process.env.NODE_ENV === 'development',
      validator,
      onValidationError,
      strict = false,
    } = options

    if (!enabled || !validator) {
      return config(set, get, api)
    }

    const newSet: typeof set = (partial, replace, action) => {
      const previousState = get()
      
      // Create a temporary state to validate
      const tempState = typeof partial === 'function' 
        ? partial(previousState)
        : replace 
          ? partial as T
          : { ...previousState, ...partial }

      const validation = validator(tempState)

      if (validation !== true) {
        const errorMessage = typeof validation === 'string' ? validation : 'Validation failed'
        onValidationError?.(errorMessage, tempState)

        if (strict) {
          throw new Error(`State validation failed: ${errorMessage}`)
        } else {
          console.warn(`State validation failed: ${errorMessage}`)
          return // Don't update state if validation fails
        }
      }

      set(partial, replace)
    }

    return config(newSet, get, api)
  }
}

// ============================================================================
// MIDDLEWARE COMPOSER
// ============================================================================

export function composeMiddleware<T>(
  ...middlewares: Array<(config: StateCreator<T, [], [], T>) => StateCreator<T, [], [], T>>
) {
  return (config: StateCreator<T, [], [], T>) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), config)
  }
}

// ============================================================================
// TYPE EXTENSIONS
// ============================================================================

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: any
  }
}
