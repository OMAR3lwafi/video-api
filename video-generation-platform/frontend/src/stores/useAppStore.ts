/**
 * Main application store using Zustand
 * Manages global app state including initialization, theme, and user preferences
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { ThemeMode } from '@/types'

interface AppState {
  // Initialization
  isInitialized: boolean
  isLoading: boolean
  error: string | null

  // Theme
  theme: ThemeMode
  systemTheme: 'light' | 'dark'

  // User preferences
  preferences: {
    animations: boolean
    sounds: boolean
    notifications: boolean
    autoSave: boolean
    previewQuality: 'low' | 'medium' | 'high'
  }

  // UI state
  sidebarCollapsed: boolean
  activeModal: string | null
  notifications: Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    timestamp: Date
    read: boolean
  }>

  // Connection status
  isOnline: boolean
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
}

interface AppActions {
  // Initialization
  initializeApp: () => Promise<void>
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Theme
  setTheme: (theme: ThemeMode) => void
  setSystemTheme: (theme: 'light' | 'dark') => void
  getEffectiveTheme: () => 'light' | 'dark'

  // Preferences
  updatePreferences: (preferences: Partial<AppState['preferences']>) => void

  // UI state
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  openModal: (modalId: string) => void
  closeModal: () => void

  // Notifications
  addNotification: (notification: Omit<AppState['notifications'][0], 'id' | 'timestamp' | 'read'>) => void
  removeNotification: (id: string) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void

  // Connection
  setOnlineStatus: (isOnline: boolean) => void
  setConnectionStatus: (status: AppState['connectionStatus']) => void

  // Reset
  reset: () => void
}

const initialState: AppState = {
  isInitialized: false,
  isLoading: false,
  error: null,
  theme: 'system',
  systemTheme: 'light',
  preferences: {
    animations: true,
    sounds: false,
    notifications: true,
    autoSave: true,
    previewQuality: 'medium',
  },
  sidebarCollapsed: false,
  activeModal: null,
  notifications: [],
  isOnline: true,
  connectionStatus: 'connected',
}

export const useAppStore = create<AppState & AppActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // Initialization
      initializeApp: async () => {
        set((state) => {
          state.isLoading = true
          state.error = null
        })

        try {
          // Detect system theme
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          set((state) => {
            state.systemTheme = prefersDark ? 'dark' : 'light'
          })

          // Set up system theme listener
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            set((state) => {
              state.systemTheme = e.matches ? 'dark' : 'light'
            })
          })

          // Set up online/offline listeners
          const handleOnline = () => {
            set((state) => {
              state.isOnline = true
              state.connectionStatus = 'connected'
            })
          }

          const handleOffline = () => {
            set((state) => {
              state.isOnline = false
              state.connectionStatus = 'disconnected'
            })
          }

          window.addEventListener('online', handleOnline)
          window.addEventListener('offline', handleOffline)

          // Check initial online status
          set((state) => {
            state.isOnline = navigator.onLine
            state.connectionStatus = navigator.onLine ? 'connected' : 'disconnected'
          })

          // Apply theme to document
          const effectiveTheme = get().getEffectiveTheme()
          document.documentElement.classList.toggle('dark', effectiveTheme === 'dark')

          set((state) => {
            state.isInitialized = true
            state.isLoading = false
          })
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to initialize app'
            state.isLoading = false
          })
        }
      },

      setLoading: (loading) => {
        set((state) => {
          state.isLoading = loading
        })
      },

      setError: (error) => {
        set((state) => {
          state.error = error
        })
      },

      // Theme
      setTheme: (theme) => {
        set((state) => {
          state.theme = theme
        })

        // Apply theme to document
        const effectiveTheme = get().getEffectiveTheme()
        document.documentElement.classList.toggle('dark', effectiveTheme === 'dark')
      },

      setSystemTheme: (theme) => {
        set((state) => {
          state.systemTheme = theme
        })

        // Apply theme if using system theme
        if (get().theme === 'system') {
          document.documentElement.classList.toggle('dark', theme === 'dark')
        }
      },

      getEffectiveTheme: () => {
        const { theme, systemTheme } = get()
        return theme === 'system' ? systemTheme : theme
      },

      // Preferences
      updatePreferences: (preferences) => {
        set((state) => {
          Object.assign(state.preferences, preferences)
        })
      },

      // UI state
      toggleSidebar: () => {
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed
        })
      },

      setSidebarCollapsed: (collapsed) => {
        set((state) => {
          state.sidebarCollapsed = collapsed
        })
      },

      openModal: (modalId) => {
        set((state) => {
          state.activeModal = modalId
        })
      },

      closeModal: () => {
        set((state) => {
          state.activeModal = null
        })
      },

      // Notifications
      addNotification: (notification) => {
        const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        set((state) => {
          state.notifications.unshift({
            ...notification,
            id,
            timestamp: new Date(),
            read: false,
          })
        })

        // Auto-remove after 5 seconds for non-error notifications
        if (notification.type !== 'error') {
          setTimeout(() => {
            get().removeNotification(id)
          }, 5000)
        }
      },

      removeNotification: (id) => {
        set((state) => {
          state.notifications = state.notifications.filter(n => n.id !== id)
        })
      },

      markNotificationRead: (id) => {
        set((state) => {
          const notification = state.notifications.find(n => n.id === id)
          if (notification) {
            notification.read = true
          }
        })
      },

      clearNotifications: () => {
        set((state) => {
          state.notifications = []
        })
      },

      // Connection
      setOnlineStatus: (isOnline) => {
        set((state) => {
          state.isOnline = isOnline
          state.connectionStatus = isOnline ? 'connected' : 'disconnected'
        })
      },

      setConnectionStatus: (status) => {
        set((state) => {
          state.connectionStatus = status
        })
      },

      // Reset
      reset: () => {
        set(() => ({ ...initialState }))
      },
    })),
    {
      name: 'video-platform-app-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        preferences: state.preferences,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      version: 1,
    }
  )
)
