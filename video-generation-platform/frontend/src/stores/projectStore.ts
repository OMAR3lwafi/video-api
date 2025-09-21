/**
 * Project Store - Enhanced Project and Video Management
 * Manages current project, elements, canvas state, timeline, and collaboration
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { persistMiddleware } from './middleware'
import type { ProjectState, ProjectActions } from './types'
import type { VideoProject, VideoElementWithState, AspectRatioKey, ASPECT_RATIOS } from '../types/video'
import { withOptimisticUpdate, withDebounce } from './utils/storeUtils'

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: ProjectState = {
  currentProject: null,
  isDirty: false,
  lastSaved: undefined,
  
  history: {
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  },
  
  autoSave: {
    enabled: true,
    interval: 30000, // 30 seconds
    lastAutoSave: undefined,
  },
  
  collaboration: {
    isShared: false,
    collaborators: [],
    conflicts: [],
  },
  
  canvas: {
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedElements: [],
    clipboard: [],
    grid: {
      enabled: true,
      size: 20,
      snap: true,
    },
    guides: {
      enabled: true,
      magnetic: true,
    },
  },
  
  timeline: {
    currentTime: 0,
    duration: 30, // 30 seconds default
    isPlaying: false,
    loop: false,
    markers: [],
    selectedRange: undefined,
  },
  
  templates: {
    recent: [],
    favorites: [],
    custom: [],
  },
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    persistMiddleware(
      immer((set, get) => ({
        ...initialState,

        // ====================================================================
        // PROJECT MANAGEMENT
        // ====================================================================

        createProject: (name, template) => {
          const project: VideoProject = {
            id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name,
            description: '',
            dimensions: { width: 1920, height: 1080, aspectRatio: '16:9' },
            duration: 30,
            fps: 30,
            backgroundColor: '#000000',
            outputFormat: 'mp4',
            quality: 'high',
            elements: [],
            timeline: {
              currentTime: 0,
              zoom: 1,
              selectedRange: undefined,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            isShared: false,
            exports: [],
          }

          set((state) => {
            state.currentProject = project
            state.isDirty = false
            state.lastSaved = new Date().toISOString()
            
            // Reset canvas and timeline
            state.canvas.selectedElements = []
            state.canvas.clipboard = []
            state.canvas.zoom = 1
            state.canvas.pan = { x: 0, y: 0 }
            
            state.timeline.currentTime = 0
            state.timeline.duration = project.duration
            state.timeline.isPlaying = false
            state.timeline.markers = []
            
            // Clear history
            state.history.past = []
            state.history.future = []
            state.history.canUndo = false
            state.history.canRedo = false
          })

          // Load template if specified
          if (template) {
            get().loadTemplate(template)
          }

          // Set up auto-save
          get().setupAutoSave()
        },

        loadProject: (project) => {
          set((state) => {
            state.currentProject = { ...project }
            state.isDirty = false
            state.lastSaved = new Date().toISOString()
            
            // Update timeline
            state.timeline.currentTime = project.timeline?.currentTime || 0
            state.timeline.duration = project.duration
            
            // Clear selection
            state.canvas.selectedElements = []
            
            // Clear history
            state.history.past = []
            state.history.future = []
            state.history.canUndo = false
            state.history.canRedo = false
          })

          get().setupAutoSave()
        },

        saveProject: async () => {
          const project = get().currentProject
          if (!project) return

          try {
            // Here you would typically call an API to save the project
            // For now, we'll just simulate the save
            await new Promise(resolve => setTimeout(resolve, 500))

            set((state) => {
              if (state.currentProject) {
                state.currentProject.updatedAt = new Date()
                state.currentProject.version++
              }
              state.isDirty = false
              state.lastSaved = new Date().toISOString()
            })

          } catch (error) {
            console.error('Failed to save project:', error)
            throw error
          }
        },

        exportProject: async () => {
          const project = get().currentProject
          if (!project) return

          // This would typically trigger the video export process
          console.log('Exporting project:', project.id)
        },

        duplicateProject: () => {
          const project = get().currentProject
          if (!project) return

          const duplicatedProject: VideoProject = {
            ...project,
            id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `${project.name} (Copy)`,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            exports: [],
          }

          get().loadProject(duplicatedProject)
        },

        deleteProject: (id) => {
          const currentProject = get().currentProject
          if (currentProject?.id === id) {
            set(() => ({ ...initialState }))
          }
        },

        // ====================================================================
        // DIRTY STATE
        // ====================================================================

        markDirty: () => {
          set((state) => {
            state.isDirty = true
          })
        },

        markClean: () => {
          set((state) => {
            state.isDirty = false
            state.lastSaved = new Date().toISOString()
          })
        },

        // ====================================================================
        // HISTORY
        // ====================================================================

        undo: () => {
          const state = get()
          if (!state.history.canUndo || !state.currentProject) return

          set((state) => {
            const currentProject = state.currentProject!
            const previousState = state.history.past.pop()
            
            if (previousState) {
              state.history.future.unshift(currentProject)
              state.currentProject = previousState
              state.history.canUndo = state.history.past.length > 0
              state.history.canRedo = true
              state.isDirty = true
            }
          })
        },

        redo: () => {
          const state = get()
          if (!state.history.canRedo || !state.currentProject) return

          set((state) => {
            const currentProject = state.currentProject!
            const nextState = state.history.future.shift()
            
            if (nextState) {
              state.history.past.push(currentProject)
              state.currentProject = nextState
              state.history.canUndo = true
              state.history.canRedo = state.history.future.length > 0
              state.isDirty = true
            }
          })
        },

        pushToHistory: () => {
          const project = get().currentProject
          if (!project) return

          set((state) => {
            // Deep clone the project
            const snapshot = JSON.parse(JSON.stringify(project))
            
            state.history.past.push(snapshot)
            state.history.future = [] // Clear future when new action is performed
            
            // Limit history size
            if (state.history.past.length > 50) {
              state.history.past.shift()
            }
            
            state.history.canUndo = true
            state.history.canRedo = false
          })
        },

        clearHistory: () => {
          set((state) => {
            state.history.past = []
            state.history.future = []
            state.history.canUndo = false
            state.history.canRedo = false
          })
        },

        // ====================================================================
        // AUTO-SAVE
        // ====================================================================

        enableAutoSave: (interval = 30000) => {
          set((state) => {
            state.autoSave.enabled = true
            state.autoSave.interval = interval
          })
          get().setupAutoSave()
        },

        disableAutoSave: () => {
          set((state) => {
            state.autoSave.enabled = false
          })
        },

        triggerAutoSave: withDebounce(async function() {
          const state = get()
          if (state.autoSave.enabled && state.isDirty && state.currentProject) {
            try {
              await get().saveProject()
              set((state) => {
                state.autoSave.lastAutoSave = new Date().toISOString()
              })
            } catch (error) {
              console.error('Auto-save failed:', error)
            }
          }
        }, 1000),

        // ====================================================================
        // ELEMENTS
        // ====================================================================

        addElement: withOptimisticUpdate(
          (state, element) => {
            if (state.currentProject) {
              const newElement: VideoElementWithState = {
                ...element,
                id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                x: element.x || '0%',
                y: element.y || '0%',
                width: element.width || '100%',
                height: element.height || '100%',
                fit_mode: element.fit_mode || 'contain',
                selected: false,
                locked: false,
                visible: true,
                isValid: true,
                zIndex: state.currentProject.elements.length,
              }
              
              state.currentProject.elements.push(newElement)
              state.isDirty = true
            }
          },
          async (element) => {
            // This would typically sync with the server
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        ),

        updateElement: withOptimisticUpdate(
          (state, id, updates) => {
            if (state.currentProject) {
              const elementIndex = state.currentProject.elements.findIndex(el => el.id === id)
              if (elementIndex !== -1) {
                Object.assign(state.currentProject.elements[elementIndex], updates)
                state.isDirty = true
              }
            }
          },
          async (id, updates) => {
            // This would typically sync with the server
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        ),

        deleteElement: (id) => {
          get().pushToHistory()
          
          set((state) => {
            if (state.currentProject) {
              state.currentProject.elements = state.currentProject.elements.filter(el => el.id !== id)
              state.canvas.selectedElements = state.canvas.selectedElements.filter(elId => elId !== id)
              state.isDirty = true
            }
          })
        },

        duplicateElement: (id) => {
          const project = get().currentProject
          if (!project) return

          const element = project.elements.find(el => el.id === id)
          if (!element) return

          get().pushToHistory()

          const duplicatedElement: VideoElementWithState = {
            ...element,
            id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            x: `${parseFloat(element.x || '0') + 5}%`,
            y: `${parseFloat(element.y || '0') + 5}%`,
          }

          get().addElement(duplicatedElement)
        },

        reorderElements: (fromIndex, toIndex) => {
          get().pushToHistory()
          
          set((state) => {
            if (state.currentProject) {
              const elements = [...state.currentProject.elements]
              const [moved] = elements.splice(fromIndex, 1)
              elements.splice(toIndex, 0, moved)
              
              // Update z-indices
              elements.forEach((element, index) => {
                element.zIndex = index
              })
              
              state.currentProject.elements = elements
              state.isDirty = true
            }
          })
        },

        // ====================================================================
        // SELECTION
        // ====================================================================

        selectElement: (id, multi = false) => {
          set((state) => {
            if (multi) {
              if (state.canvas.selectedElements.includes(id)) {
                state.canvas.selectedElements = state.canvas.selectedElements.filter(elId => elId !== id)
              } else {
                state.canvas.selectedElements.push(id)
              }
            } else {
              state.canvas.selectedElements = [id]
            }
            
            // Update element selection state
            if (state.currentProject) {
              state.currentProject.elements.forEach(element => {
                element.selected = state.canvas.selectedElements.includes(element.id)
              })
            }
          })
        },

        selectElements: (ids) => {
          set((state) => {
            state.canvas.selectedElements = [...ids]
            
            // Update element selection state
            if (state.currentProject) {
              state.currentProject.elements.forEach(element => {
                element.selected = ids.includes(element.id)
              })
            }
          })
        },

        clearSelection: () => {
          set((state) => {
            state.canvas.selectedElements = []
            
            // Update element selection state
            if (state.currentProject) {
              state.currentProject.elements.forEach(element => {
                element.selected = false
              })
            }
          })
        },

        selectAll: () => {
          const project = get().currentProject
          if (!project) return

          const allIds = project.elements.map(el => el.id)
          get().selectElements(allIds)
        },

        // ====================================================================
        // CLIPBOARD
        // ====================================================================

        copy: () => {
          const project = get().currentProject
          const selectedIds = get().canvas.selectedElements
          if (!project || selectedIds.length === 0) return

          const selectedElements = project.elements.filter(el => selectedIds.includes(el.id))
          
          set((state) => {
            state.canvas.clipboard = selectedElements.map(el => ({ ...el }))
          })
        },

        cut: () => {
          get().copy()
          get().pushToHistory()
          
          const selectedIds = get().canvas.selectedElements
          set((state) => {
            if (state.currentProject) {
              state.currentProject.elements = state.currentProject.elements.filter(
                el => !selectedIds.includes(el.id)
              )
              state.canvas.selectedElements = []
              state.isDirty = true
            }
          })
        },

        paste: () => {
          const clipboard = get().canvas.clipboard
          if (clipboard.length === 0) return

          get().pushToHistory()

          const newElements = clipboard.map(el => ({
            ...el,
            id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            x: `${parseFloat(el.x || '0') + 10}%`,
            y: `${parseFloat(el.y || '0') + 10}%`,
            selected: true,
          }))

          set((state) => {
            if (state.currentProject) {
              // Clear previous selection
              state.currentProject.elements.forEach(el => el.selected = false)
              
              // Add new elements
              state.currentProject.elements.push(...newElements)
              
              // Update selection
              state.canvas.selectedElements = newElements.map(el => el.id)
              state.isDirty = true
            }
          })
        },

        // ====================================================================
        // CANVAS
        // ====================================================================

        setZoom: (zoom) => {
          set((state) => {
            state.canvas.zoom = Math.max(0.1, Math.min(5, zoom))
          })
        },

        setPan: (pan) => {
          set((state) => {
            state.canvas.pan = pan
          })
        },

        resetView: () => {
          set((state) => {
            state.canvas.zoom = 1
            state.canvas.pan = { x: 0, y: 0 }
          })
        },

        fitToScreen: () => {
          // This would calculate the optimal zoom to fit the canvas
          set((state) => {
            state.canvas.zoom = 0.8 // Placeholder value
            state.canvas.pan = { x: 0, y: 0 }
          })
        },

        // ====================================================================
        // TIMELINE
        // ====================================================================

        setCurrentTime: (time) => {
          set((state) => {
            state.timeline.currentTime = Math.max(0, Math.min(state.timeline.duration, time))
            
            // Update project timeline
            if (state.currentProject) {
              state.currentProject.timeline.currentTime = state.timeline.currentTime
            }
          })
        },

        play: () => {
          set((state) => {
            state.timeline.isPlaying = true
          })
          
          // This would start the playback timer
          get().startPlayback()
        },

        pause: () => {
          set((state) => {
            state.timeline.isPlaying = false
          })
        },

        stop: () => {
          set((state) => {
            state.timeline.isPlaying = false
            state.timeline.currentTime = 0
          })
        },

        setLoop: (loop) => {
          set((state) => {
            state.timeline.loop = loop
          })
        },

        addMarker: (time, label, color = '#3b82f6') => {
          const id = `marker-${Date.now()}`
          
          set((state) => {
            state.timeline.markers.push({
              id,
              time,
              label,
              color,
            })
          })
        },

        removeMarker: (id) => {
          set((state) => {
            state.timeline.markers = state.timeline.markers.filter(marker => marker.id !== id)
          })
        },

        // ====================================================================
        // COLLABORATION (PLACEHOLDER)
        // ====================================================================

        shareProject: async () => {
          // This would create a shareable link
          return 'share-link-placeholder'
        },

        joinProject: async (shareId) => {
          // This would join a shared project
          console.log('Joining project:', shareId)
        },

        leaveProject: () => {
          set((state) => {
            state.collaboration.isShared = false
            state.collaboration.collaborators = []
          })
        },

        updateCursor: (position) => {
          // This would update cursor position for collaboration
          console.log('Cursor position:', position)
        },

        resolveConflict: (conflictId, resolution) => {
          set((state) => {
            state.collaboration.conflicts = state.collaboration.conflicts.filter(
              conflict => conflict.id !== conflictId
            )
          })
        },

        // ====================================================================
        // TEMPLATES
        // ====================================================================

        saveAsTemplate: (name) => {
          const project = get().currentProject
          if (!project) return

          const template = {
            id: `template-${Date.now()}`,
            name,
            thumbnail: '', // Would generate thumbnail
            elements: project.elements.map(el => ({ ...el })),
          }

          set((state) => {
            state.templates.custom.push(template)
          })
        },

        loadTemplate: (templateId) => {
          // This would load a template by ID
          console.log('Loading template:', templateId)
        },

        addToFavorites: (templateId) => {
          set((state) => {
            if (!state.templates.favorites.includes(templateId)) {
              state.templates.favorites.push(templateId)
            }
          })
        },

        removeFromFavorites: (templateId) => {
          set((state) => {
            state.templates.favorites = state.templates.favorites.filter(id => id !== templateId)
          })
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

        setupAutoSave: () => {
          const state = get()
          if (state.autoSave.enabled) {
            setInterval(() => {
              get().triggerAutoSave()
            }, state.autoSave.interval)
          }
        },

        startPlayback: () => {
          const playbackInterval = setInterval(() => {
            const state = get()
            if (!state.timeline.isPlaying) {
              clearInterval(playbackInterval)
              return
            }

            const newTime = state.timeline.currentTime + (1000 / 30) // 30fps
            
            if (newTime >= state.timeline.duration) {
              if (state.timeline.loop) {
                get().setCurrentTime(0)
              } else {
                get().pause()
                clearInterval(playbackInterval)
              }
            } else {
              get().setCurrentTime(newTime)
            }
          }, 1000 / 30) // 30fps
        },
      })),
      {
        name: 'project-store',
        whitelist: ['templates', 'autoSave'], // Only persist these parts
        version: 1,
      }
    ),
    {
      name: 'project-store',
    }
  )
)

// ============================================================================
// SELECTORS
// ============================================================================

export const projectSelectors = {
  currentProject: (state: ProjectState) => state.currentProject,
  isDirty: (state: ProjectState) => state.isDirty,
  canUndo: (state: ProjectState) => state.history.canUndo,
  canRedo: (state: ProjectState) => state.history.canRedo,
  selectedElements: (state: ProjectState) => state.canvas.selectedElements,
  isPlaying: (state: ProjectState) => state.timeline.isPlaying,
  currentTime: (state: ProjectState) => state.timeline.currentTime,
  hasProject: (state: ProjectState) => !!state.currentProject,
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for current project
 */
export function useCurrentProject() {
  return useProjectStore((state) => state.currentProject)
}

/**
 * Hook for project actions
 */
export function useProjectActions() {
  return useProjectStore((state) => ({
    createProject: state.createProject,
    loadProject: state.loadProject,
    saveProject: state.saveProject,
    exportProject: state.exportProject,
  }))
}

/**
 * Hook for element management
 */
export function useElements() {
  const elements = useProjectStore((state) => state.currentProject?.elements || [])
  const actions = useProjectStore((state) => ({
    addElement: state.addElement,
    updateElement: state.updateElement,
    deleteElement: state.deleteElement,
    duplicateElement: state.duplicateElement,
  }))
  
  return { elements, ...actions }
}

/**
 * Hook for selection
 */
export function useSelection() {
  const selectedElements = useProjectStore((state) => state.canvas.selectedElements)
  const actions = useProjectStore((state) => ({
    selectElement: state.selectElement,
    selectElements: state.selectElements,
    clearSelection: state.clearSelection,
    selectAll: state.selectAll,
  }))
  
  return { selectedElements, ...actions }
}

/**
 * Hook for timeline
 */
export function useTimeline() {
  const timeline = useProjectStore((state) => state.timeline)
  const actions = useProjectStore((state) => ({
    setCurrentTime: state.setCurrentTime,
    play: state.play,
    pause: state.pause,
    stop: state.stop,
    setLoop: state.setLoop,
  }))
  
  return { ...timeline, ...actions }
}
