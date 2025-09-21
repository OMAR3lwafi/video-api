/**
 * UI Store - Global UI State Management
 * Manages loading states, notifications, modals, panels, and UI preferences
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { persistMiddleware } from './middleware'
import type { UIState, UIActions } from './types'

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: UIState = {
  globalLoading: {
    isLoading: false,
    message: undefined,
    progress: undefined,
    cancellable: false,
  },
  
  notifications: [],
  
  modals: {
    active: null,
    stack: [],
    data: new Map(),
    blocking: false,
  },
  
  panels: {
    timeline: { open: true, width: 300 },
    properties: { open: true, width: 320 },
    assets: { open: false, width: 280 },
    layers: { open: true, width: 250 },
    effects: { open: false, width: 300 },
  },
  
  layout: {
    sidebarCollapsed: false,
    fullscreen: false,
    theme: 'system',
    compactMode: false,
    showGrid: true,
    showRulers: true,
    showGuides: true,
  },
  
  contextMenu: {
    visible: false,
    position: { x: 0, y: 0 },
    items: [],
  },
  
  tooltips: {
    enabled: true,
    delay: 500,
    active: null,
  },
  
  shortcuts: {
    enabled: true,
    recording: false,
    customShortcuts: new Map(),
  },
  
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    screenReader: false,
    keyboardNavigation: false,
  },
  
  performance: {
    reducedAnimations: false,
    lowQualityPreviews: false,
    autoOptimize: true,
  },
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useUIStore = create<UIState & UIActions>()(
  devtools(
    persistMiddleware(
      immer((set, get) => ({
        ...initialState,

        // ====================================================================
        // GLOBAL LOADING
        // ====================================================================

        setGlobalLoading: (loading, message, progress) => {
          set((state) => {
            state.globalLoading.isLoading = loading
            state.globalLoading.message = message
            state.globalLoading.progress = progress
          })
        },

        // ====================================================================
        // NOTIFICATIONS
        // ====================================================================

        addNotification: (notification) => {
          const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const newNotification = {
            ...notification,
            id,
            createdAt: new Date().toISOString(),
          }

          set((state) => {
            state.notifications.unshift(newNotification)
            
            // Limit to 50 notifications
            if (state.notifications.length > 50) {
              state.notifications = state.notifications.slice(0, 50)
            }
          })

          // Auto-remove notification if duration is set
          if (notification.duration && !notification.persistent) {
            setTimeout(() => {
              get().removeNotification(id)
            }, notification.duration)
          }

          return id
        },

        removeNotification: (id) => {
          set((state) => {
            state.notifications = state.notifications.filter(n => n.id !== id)
          })
        },

        clearNotifications: () => {
          set((state) => {
            state.notifications = []
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

        // ====================================================================
        // MODALS
        // ====================================================================

        openModal: (modalId, data) => {
          set((state) => {
            // Add to stack if not already active
            if (state.modals.active !== modalId) {
              if (state.modals.active) {
                state.modals.stack.push(state.modals.active)
              }
              state.modals.active = modalId
            }
            
            // Set modal data
            if (data) {
              state.modals.data.set(modalId, data)
            }
          })
        },

        closeModal: (modalId) => {
          set((state) => {
            if (modalId) {
              // Close specific modal
              if (state.modals.active === modalId) {
                state.modals.active = state.modals.stack.pop() || null
              } else {
                state.modals.stack = state.modals.stack.filter(id => id !== modalId)
              }
              state.modals.data.delete(modalId)
            } else {
              // Close current modal
              state.modals.active = state.modals.stack.pop() || null
            }
          })
        },

        setModalData: (modalId, data) => {
          set((state) => {
            state.modals.data.set(modalId, data)
          })
        },

        // ====================================================================
        // PANELS
        // ====================================================================

        togglePanel: (panel) => {
          set((state) => {
            state.panels[panel].open = !state.panels[panel].open
          })
        },

        resizePanel: (panel, width) => {
          set((state) => {
            state.panels[panel].width = Math.max(200, Math.min(600, width))
          })
        },

        resetPanels: () => {
          set((state) => {
            state.panels = initialState.panels
          })
        },

        // ====================================================================
        // LAYOUT
        // ====================================================================

        toggleSidebar: () => {
          set((state) => {
            state.layout.sidebarCollapsed = !state.layout.sidebarCollapsed
          })
        },

        setFullscreen: (fullscreen) => {
          set((state) => {
            state.layout.fullscreen = fullscreen
          })
          
          // Handle browser fullscreen
          if (fullscreen) {
            document.documentElement.requestFullscreen?.()
          } else {
            document.exitFullscreen?.()
          }
        },

        setTheme: (theme) => {
          set((state) => {
            state.layout.theme = theme
          })
          
          // Apply theme to document
          this.applyTheme(theme)
        },

        toggleCompactMode: () => {
          set((state) => {
            state.layout.compactMode = !state.layout.compactMode
          })
        },

        toggleGrid: () => {
          set((state) => {
            state.layout.showGrid = !state.layout.showGrid
          })
        },

        toggleRulers: () => {
          set((state) => {
            state.layout.showRulers = !state.layout.showRulers
          })
        },

        toggleGuides: () => {
          set((state) => {
            state.layout.showGuides = !state.layout.showGuides
          })
        },

        // ====================================================================
        // CONTEXT MENU
        // ====================================================================

        showContextMenu: (position, items) => {
          set((state) => {
            state.contextMenu.visible = true
            state.contextMenu.position = position
            state.contextMenu.items = items
          })
        },

        hideContextMenu: () => {
          set((state) => {
            state.contextMenu.visible = false
            state.contextMenu.items = []
          })
        },

        // ====================================================================
        // TOOLTIPS
        // ====================================================================

        enableTooltips: (enabled) => {
          set((state) => {
            state.tooltips.enabled = enabled
          })
        },

        setTooltipDelay: (delay) => {
          set((state) => {
            state.tooltips.delay = Math.max(0, delay)
          })
        },

        showTooltip: (id) => {
          set((state) => {
            state.tooltips.active = id
          })
        },

        hideTooltip: () => {
          set((state) => {
            state.tooltips.active = null
          })
        },

        // ====================================================================
        // KEYBOARD SHORTCUTS
        // ====================================================================

        enableShortcuts: (enabled) => {
          set((state) => {
            state.shortcuts.enabled = enabled
          })
        },

        startRecordingShortcut: () => {
          set((state) => {
            state.shortcuts.recording = true
          })
        },

        stopRecordingShortcut: () => {
          set((state) => {
            state.shortcuts.recording = false
          })
        },

        setCustomShortcut: (action, keys) => {
          set((state) => {
            state.shortcuts.customShortcuts.set(action, keys)
          })
        },

        // ====================================================================
        // ACCESSIBILITY
        // ====================================================================

        setHighContrast: (enabled) => {
          set((state) => {
            state.accessibility.highContrast = enabled
          })
          
          // Apply high contrast styles
          document.documentElement.classList.toggle('high-contrast', enabled)
        },

        setReducedMotion: (enabled) => {
          set((state) => {
            state.accessibility.reducedMotion = enabled
          })
          
          // Apply reduced motion styles
          document.documentElement.classList.toggle('reduce-motion', enabled)
        },

        setScreenReader: (enabled) => {
          set((state) => {
            state.accessibility.screenReader = enabled
          })
        },

        setKeyboardNavigation: (enabled) => {
          set((state) => {
            state.accessibility.keyboardNavigation = enabled
          })
        },

        // ====================================================================
        // PERFORMANCE
        // ====================================================================

        setReducedAnimations: (enabled) => {
          set((state) => {
            state.performance.reducedAnimations = enabled
          })
        },

        setLowQualityPreviews: (enabled) => {
          set((state) => {
            state.performance.lowQualityPreviews = enabled
          })
        },

        setAutoOptimize: (enabled) => {
          set((state) => {
            state.performance.autoOptimize = enabled
          })
        },

        // ====================================================================
        // RESET
        // ====================================================================

        reset: () => {
          set(() => ({ ...initialState }))
        },

        // ====================================================================
        // HELPER METHODS
        // ====================================================================

        applyTheme: (theme: UIState['layout']['theme']) => {
          const root = document.documentElement
          
          // Remove existing theme classes
          root.classList.remove('theme-light', 'theme-dark', 'theme-system')
          
          if (theme === 'system') {
            // Use system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            root.classList.add(prefersDark ? 'theme-dark' : 'theme-light')
            
            // Listen for system theme changes
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            const handleThemeChange = (e: MediaQueryListEvent) => {
              root.classList.remove('theme-light', 'theme-dark')
              root.classList.add(e.matches ? 'theme-dark' : 'theme-light')
            }
            
            mediaQuery.addEventListener('change', handleThemeChange)
          } else {
            root.classList.add(`theme-${theme}`)
          }
        },
      })),
      {
        name: 'ui-store',
        whitelist: ['layout', 'panels', 'tooltips', 'shortcuts', 'accessibility', 'performance'],
        version: 1,
      }
    ),
    {
      name: 'ui-store',
    }
  )
)

// ============================================================================
// SELECTORS
// ============================================================================

export const uiSelectors = {
  isLoading: (state: UIState) => state.globalLoading.isLoading,
  notifications: (state: UIState) => state.notifications,
  unreadNotifications: (state: UIState) => state.notifications.filter(n => !n.read),
  activeModal: (state: UIState) => state.modals.active,
  modalData: (modalId: string) => (state: UIState) => state.modals.data.get(modalId),
  panelState: (panel: keyof UIState['panels']) => (state: UIState) => state.panels[panel],
  theme: (state: UIState) => state.layout.theme,
  isFullscreen: (state: UIState) => state.layout.fullscreen,
  contextMenuVisible: (state: UIState) => state.contextMenu.visible,
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for global loading state
 */
export function useGlobalLoading() {
  const { isLoading, message, progress, cancellable } = useUIStore((state) => state.globalLoading)
  const setGlobalLoading = useUIStore((state) => state.setGlobalLoading)
  
  return {
    isLoading,
    message,
    progress,
    cancellable,
    setLoading: setGlobalLoading,
  }
}

/**
 * Hook for notifications
 */
export function useNotifications() {
  const notifications = useUIStore((state) => state.notifications)
  const addNotification = useUIStore((state) => state.addNotification)
  const removeNotification = useUIStore((state) => state.removeNotification)
  const clearNotifications = useUIStore((state) => state.clearNotifications)
  
  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    addNotification,
    removeNotification,
    clearNotifications,
  }
}

/**
 * Hook for modals
 */
export function useModal(modalId?: string) {
  const activeModal = useUIStore((state) => state.modals.active)
  const modalData = useUIStore((state) => modalId ? state.modals.data.get(modalId) : null)
  const openModal = useUIStore((state) => state.openModal)
  const closeModal = useUIStore((state) => state.closeModal)
  const setModalData = useUIStore((state) => state.setModalData)
  
  return {
    isOpen: modalId ? activeModal === modalId : !!activeModal,
    activeModal,
    data: modalData,
    open: (id?: string, data?: any) => openModal(id || modalId || 'default', data),
    close: (id?: string) => closeModal(id || modalId),
    setData: (data: any) => modalId && setModalData(modalId, data),
  }
}

/**
 * Hook for panels
 */
export function usePanel(panelId: keyof UIState['panels']) {
  const panel = useUIStore((state) => state.panels[panelId])
  const togglePanel = useUIStore((state) => state.togglePanel)
  const resizePanel = useUIStore((state) => state.resizePanel)
  
  return {
    ...panel,
    toggle: () => togglePanel(panelId),
    resize: (width: number) => resizePanel(panelId, width),
  }
}

/**
 * Hook for layout state
 */
export function useLayout() {
  const layout = useUIStore((state) => state.layout)
  const actions = useUIStore((state) => ({
    toggleSidebar: state.toggleSidebar,
    setFullscreen: state.setFullscreen,
    setTheme: state.setTheme,
    toggleCompactMode: state.toggleCompactMode,
    toggleGrid: state.toggleGrid,
    toggleRulers: state.toggleRulers,
    toggleGuides: state.toggleGuides,
  }))
  
  return {
    ...layout,
    ...actions,
  }
}

/**
 * Hook for context menu
 */
export function useContextMenu() {
  const contextMenu = useUIStore((state) => state.contextMenu)
  const showContextMenu = useUIStore((state) => state.showContextMenu)
  const hideContextMenu = useUIStore((state) => state.hideContextMenu)
  
  return {
    ...contextMenu,
    show: showContextMenu,
    hide: hideContextMenu,
  }
}

/**
 * Hook for accessibility settings
 */
export function useAccessibility() {
  const accessibility = useUIStore((state) => state.accessibility)
  const actions = useUIStore((state) => ({
    setHighContrast: state.setHighContrast,
    setReducedMotion: state.setReducedMotion,
    setScreenReader: state.setScreenReader,
    setKeyboardNavigation: state.setKeyboardNavigation,
  }))
  
  return {
    ...accessibility,
    ...actions,
  }
}

/**
 * Hook for performance settings
 */
export function usePerformanceSettings() {
  const performance = useUIStore((state) => state.performance)
  const actions = useUIStore((state) => ({
    setReducedAnimations: state.setReducedAnimations,
    setLowQualityPreviews: state.setLowQualityPreviews,
    setAutoOptimize: state.setAutoOptimize,
  }))
  
  return {
    ...performance,
    ...actions,
  }
}
