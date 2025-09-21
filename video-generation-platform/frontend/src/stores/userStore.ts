/**
 * User Store - User Profile, Authentication, and Preferences
 * Manages user authentication, profile, preferences, and usage tracking
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { persistMiddleware } from './middleware'
import type { UserState, UserActions } from './types'

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: UserState = {
  profile: null,
  
  auth: {
    isAuthenticated: false,
    token: undefined,
    refreshToken: undefined,
    expiresAt: undefined,
    lastLogin: undefined,
  },
  
  preferences: {
    editor: {
      autoSave: true,
      autoSaveInterval: 30000, // 30 seconds
      showWelcome: true,
      defaultQuality: 'high',
      defaultFormat: 'mp4',
      snapToGrid: true,
      snapThreshold: 10,
    },
    
    ui: {
      theme: 'system',
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      compactMode: false,
      animations: true,
      sounds: false,
    },
    
    notifications: {
      email: true,
      push: true,
      desktop: true,
      jobComplete: true,
      jobFailed: true,
      collaboration: true,
      marketing: false,
    },
    
    privacy: {
      analytics: true,
      crashReporting: true,
      usageData: true,
      shareData: false,
    },
  },
  
  usage: {
    projectsCreated: 0,
    videosExported: 0,
    storageUsed: 0,
    storageLimit: 1024 * 1024 * 1024, // 1GB
    apiCallsThisMonth: 0,
    apiCallsLimit: 1000,
    lastActivity: new Date().toISOString(),
    streakDays: 0,
  },
  
  recentActivity: [],
  
  favorites: {
    templates: [],
    assets: [],
    colors: [],
    fonts: [],
  },
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useUserStore = create<UserState & UserActions>()(
  devtools(
    persistMiddleware(
      immer((set, get) => ({
        ...initialState,

        // ====================================================================
        // AUTHENTICATION
        // ====================================================================

        login: async (email, password) => {
          try {
            // This would typically call an authentication API
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            })

            if (!response.ok) {
              throw new Error('Login failed')
            }

            const data = await response.json()
            
            set((state) => {
              state.auth.isAuthenticated = true
              state.auth.token = data.token
              state.auth.refreshToken = data.refreshToken
              state.auth.expiresAt = data.expiresAt
              state.auth.lastLogin = new Date().toISOString()
              
              state.profile = data.user
            })

            // Set up token refresh
            get().setupTokenRefresh()

          } catch (error) {
            console.error('Login failed:', error)
            throw error
          }
        },

        logout: async () => {
          try {
            // Call logout API if authenticated
            if (get().auth.token) {
              await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${get().auth.token}`,
                },
              })
            }

          } catch (error) {
            console.error('Logout API call failed:', error)
          } finally {
            // Clear auth state regardless of API call result
            set((state) => {
              state.auth.isAuthenticated = false
              state.auth.token = undefined
              state.auth.refreshToken = undefined
              state.auth.expiresAt = undefined
              state.profile = null
            })
          }
        },

        refreshAuth: async () => {
          const refreshToken = get().auth.refreshToken
          if (!refreshToken) {
            throw new Error('No refresh token available')
          }

          try {
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            })

            if (!response.ok) {
              throw new Error('Token refresh failed')
            }

            const data = await response.json()
            
            set((state) => {
              state.auth.token = data.token
              state.auth.expiresAt = data.expiresAt
            })

          } catch (error) {
            console.error('Token refresh failed:', error)
            // If refresh fails, logout the user
            get().logout()
            throw error
          }
        },

        // ====================================================================
        // PROFILE
        // ====================================================================

        updateProfile: async (updates) => {
          try {
            const response = await fetch('/api/user/profile', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${get().auth.token}`,
              },
              body: JSON.stringify(updates),
            })

            if (!response.ok) {
              throw new Error('Profile update failed')
            }

            const updatedProfile = await response.json()
            
            set((state) => {
              if (state.profile) {
                Object.assign(state.profile, updatedProfile)
              }
            })

          } catch (error) {
            console.error('Profile update failed:', error)
            throw error
          }
        },

        uploadAvatar: async (file) => {
          try {
            const formData = new FormData()
            formData.append('avatar', file)

            const response = await fetch('/api/user/avatar', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${get().auth.token}`,
              },
              body: formData,
            })

            if (!response.ok) {
              throw new Error('Avatar upload failed')
            }

            const data = await response.json()
            
            set((state) => {
              if (state.profile) {
                state.profile.avatar = data.avatarUrl
              }
            })

            return data.avatarUrl

          } catch (error) {
            console.error('Avatar upload failed:', error)
            throw error
          }
        },

        // ====================================================================
        // PREFERENCES
        // ====================================================================

        updatePreferences: (category, updates) => {
          set((state) => {
            Object.assign(state.preferences[category], updates)
          })

          // Apply certain preferences immediately
          if (category === 'ui') {
            get().applyUIPreferences(updates)
          }
        },

        resetPreferences: () => {
          set((state) => {
            state.preferences = initialState.preferences
          })
        },

        exportPreferences: () => {
          const preferences = get().preferences
          return JSON.stringify(preferences, null, 2)
        },

        importPreferences: (data) => {
          try {
            const preferences = JSON.parse(data)
            set((state) => {
              state.preferences = { ...state.preferences, ...preferences }
            })
          } catch (error) {
            console.error('Failed to import preferences:', error)
            throw new Error('Invalid preferences data')
          }
        },

        // ====================================================================
        // USAGE TRACKING
        // ====================================================================

        trackActivity: (type, details) => {
          const activity = {
            id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            timestamp: new Date().toISOString(),
            details,
          }

          set((state) => {
            state.recentActivity.unshift(activity)
            
            // Keep only last 100 activities
            if (state.recentActivity.length > 100) {
              state.recentActivity = state.recentActivity.slice(0, 100)
            }
            
            state.usage.lastActivity = activity.timestamp
            
            // Update usage counters
            switch (type) {
              case 'project_created':
                state.usage.projectsCreated++
                break
              case 'video_exported':
                state.usage.videosExported++
                break
            }
          })

          // Update streak
          get().updateStreak()
        },

        updateUsage: (usage) => {
          set((state) => {
            Object.assign(state.usage, usage)
          })
        },

        // ====================================================================
        // FAVORITES
        // ====================================================================

        addToFavorites: (type, id) => {
          set((state) => {
            const favorites = state.favorites[type]
            if (!favorites.includes(id)) {
              favorites.push(id)
            }
          })
        },

        removeFromFavorites: (type, id) => {
          set((state) => {
            state.favorites[type] = state.favorites[type].filter(favId => favId !== id)
          })
        },

        isFavorite: (type, id) => {
          return get().favorites[type].includes(id)
        },

        // ====================================================================
        // SUBSCRIPTION
        // ====================================================================

        upgradeSubscription: async (plan) => {
          try {
            const response = await fetch('/api/user/subscription/upgrade', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${get().auth.token}`,
              },
              body: JSON.stringify({ plan }),
            })

            if (!response.ok) {
              throw new Error('Subscription upgrade failed')
            }

            const subscription = await response.json()
            
            set((state) => {
              if (state.profile) {
                state.profile.plan = plan
                state.profile.subscription = subscription
              }
            })

          } catch (error) {
            console.error('Subscription upgrade failed:', error)
            throw error
          }
        },

        cancelSubscription: async () => {
          try {
            const response = await fetch('/api/user/subscription/cancel', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${get().auth.token}`,
              },
            })

            if (!response.ok) {
              throw new Error('Subscription cancellation failed')
            }

            set((state) => {
              if (state.profile?.subscription) {
                state.profile.subscription.status = 'cancelled'
              }
            })

          } catch (error) {
            console.error('Subscription cancellation failed:', error)
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

        setupTokenRefresh: () => {
          const expiresAt = get().auth.expiresAt
          if (!expiresAt) return

          const expirationTime = new Date(expiresAt).getTime()
          const now = Date.now()
          const timeUntilExpiry = expirationTime - now
          
          // Refresh token 5 minutes before expiry
          const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 0)

          setTimeout(() => {
            if (get().auth.isAuthenticated) {
              get().refreshAuth().catch(console.error)
            }
          }, refreshTime)
        },

        applyUIPreferences: (updates: any) => {
          if (updates.theme) {
            // Apply theme to document
            const root = document.documentElement
            root.classList.remove('theme-light', 'theme-dark', 'theme-system')
            
            if (updates.theme === 'system') {
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
              root.classList.add(prefersDark ? 'theme-dark' : 'theme-light')
            } else {
              root.classList.add(`theme-${updates.theme}`)
            }
          }

          if (updates.animations !== undefined) {
            document.documentElement.classList.toggle('no-animations', !updates.animations)
          }

          if (updates.compactMode !== undefined) {
            document.documentElement.classList.toggle('compact-mode', updates.compactMode)
          }
        },

        updateStreak: () => {
          const now = new Date()
          const lastActivity = get().usage.lastActivity
          
          if (!lastActivity) {
            set((state) => {
              state.usage.streakDays = 1
            })
            return
          }

          const lastDate = new Date(lastActivity)
          const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
          
          set((state) => {
            if (daysDiff === 0) {
              // Same day, no change
              return
            } else if (daysDiff === 1) {
              // Consecutive day, increment streak
              state.usage.streakDays++
            } else {
              // Streak broken, reset to 1
              state.usage.streakDays = 1
            }
          })
        },
      })),
      {
        name: 'user-store',
        blacklist: ['auth'], // Don't persist auth tokens for security
        version: 1,
      }
    ),
    {
      name: 'user-store',
    }
  )
)

// ============================================================================
// AUTH TOKEN MANAGEMENT
// ============================================================================

// Set up token refresh on app load
const setupInitialAuth = () => {
  const state = useUserStore.getState()
  if (state.auth.isAuthenticated && state.auth.expiresAt) {
    const expirationTime = new Date(state.auth.expiresAt).getTime()
    const now = Date.now()
    
    if (now >= expirationTime) {
      // Token expired, logout
      state.logout()
    } else {
      // Set up refresh
      state.setupTokenRefresh()
    }
  }
}

// Call on module load
setupInitialAuth()

// ============================================================================
// SELECTORS
// ============================================================================

export const userSelectors = {
  isAuthenticated: (state: UserState) => state.auth.isAuthenticated,
  profile: (state: UserState) => state.profile,
  preferences: (state: UserState) => state.preferences,
  usage: (state: UserState) => state.usage,
  plan: (state: UserState) => state.profile?.plan || 'free',
  isSubscribed: (state: UserState) => state.profile?.plan !== 'free',
  storageUsage: (state: UserState) => ({
    used: state.usage.storageUsed,
    limit: state.usage.storageLimit,
    percentage: (state.usage.storageUsed / state.usage.storageLimit) * 100,
  }),
  apiUsage: (state: UserState) => ({
    used: state.usage.apiCallsThisMonth,
    limit: state.usage.apiCallsLimit,
    percentage: (state.usage.apiCallsThisMonth / state.usage.apiCallsLimit) * 100,
  }),
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for authentication state
 */
export function useAuth() {
  const isAuthenticated = useUserStore((state) => state.auth.isAuthenticated)
  const profile = useUserStore((state) => state.profile)
  const actions = useUserStore((state) => ({
    login: state.login,
    logout: state.logout,
    refreshAuth: state.refreshAuth,
  }))
  
  return {
    isAuthenticated,
    profile,
    ...actions,
  }
}

/**
 * Hook for user preferences
 */
export function useUserPreferences() {
  const preferences = useUserStore((state) => state.preferences)
  const updatePreferences = useUserStore((state) => state.updatePreferences)
  
  return {
    preferences,
    updatePreferences,
    editor: preferences.editor,
    ui: preferences.ui,
    notifications: preferences.notifications,
    privacy: preferences.privacy,
  }
}

/**
 * Hook for usage statistics
 */
export function useUsageStats() {
  const usage = useUserStore((state) => state.usage)
  const profile = useUserStore((state) => state.profile)
  
  return {
    ...usage,
    plan: profile?.plan || 'free',
    storagePercentage: (usage.storageUsed / usage.storageLimit) * 100,
    apiPercentage: (usage.apiCallsThisMonth / usage.apiCallsLimit) * 100,
  }
}

/**
 * Hook for favorites management
 */
export function useFavorites() {
  const favorites = useUserStore((state) => state.favorites)
  const actions = useUserStore((state) => ({
    addToFavorites: state.addToFavorites,
    removeFromFavorites: state.removeFromFavorites,
    isFavorite: state.isFavorite,
  }))
  
  return {
    favorites,
    ...actions,
  }
}

/**
 * Hook for recent activity
 */
export function useRecentActivity() {
  return useUserStore((state) => state.recentActivity)
}
