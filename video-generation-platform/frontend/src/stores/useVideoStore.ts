/**
 * Video store using Zustand
 * Manages video creation, job tracking, and editor state
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  VideoProject,
  VideoElementWithState,
  JobStatusResponse,
  JobListItem,
} from '@/types'

interface VideoState {
  // Current project
  currentProject: VideoProject | null
  
  // Jobs
  jobs: JobListItem[]
  activeJobs: Map<string, JobStatusResponse>
  
  // Editor state
  selectedElements: string[]
  clipboard: VideoElementWithState[]
  
  // Timeline
  currentTime: number
  isPlaying: boolean
  zoom: number
  
  // Tools
  activeTool: 'select' | 'text' | 'image' | 'video' | 'shape' | 'crop'
  
  // Panels
  panels: {
    timeline: boolean
    properties: boolean
    assets: boolean
    effects: boolean
  }
  
  // History
  history: {
    past: VideoProject[]
    present: VideoProject | null
    future: VideoProject[]
    canUndo: boolean
    canRedo: boolean
  }
  
  // Performance
  previewQuality: 'low' | 'medium' | 'high'
  
  // Loading states
  isCreatingVideo: boolean
  isLoadingJobs: boolean
  uploadingFiles: Map<string, { progress: number; status: 'uploading' | 'completed' | 'error' }>
}

interface VideoActions {
  // Project management
  createProject: (project: Omit<VideoProject, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => void
  loadProject: (project: VideoProject) => void
  saveProject: () => void
  closeProject: () => void
  
  // Elements
  addElement: (element: Omit<VideoElementWithState, 'id'>) => void
  updateElement: (id: string, updates: Partial<VideoElementWithState>) => void
  removeElement: (id: string) => void
  duplicateElement: (id: string) => void
  selectElements: (ids: string[]) => void
  clearSelection: () => void
  
  // Clipboard
  copyElements: (ids: string[]) => void
  cutElements: (ids: string[]) => void
  pasteElements: () => void
  
  // Timeline
  setCurrentTime: (time: number) => void
  setPlaying: (playing: boolean) => void
  setZoom: (zoom: number) => void
  
  // Tools
  setActiveTool: (tool: VideoState['activeTool']) => void
  
  // Panels
  togglePanel: (panel: keyof VideoState['panels']) => void
  setPanelOpen: (panel: keyof VideoState['panels'], open: boolean) => void
  
  // History
  undo: () => void
  redo: () => void
  pushToHistory: (project: VideoProject) => void
  clearHistory: () => void
  
  // Jobs
  addJob: (job: JobListItem) => void
  updateJob: (jobId: string, updates: Partial<JobListItem>) => void
  removeJob: (jobId: string) => void
  setJobs: (jobs: JobListItem[]) => void
  updateActiveJob: (jobId: string, status: JobStatusResponse) => void
  removeActiveJob: (jobId: string) => void
  
  // Upload tracking
  startUpload: (fileId: string) => void
  updateUploadProgress: (fileId: string, progress: number) => void
  completeUpload: (fileId: string) => void
  failUpload: (fileId: string) => void
  
  // Settings
  setPreviewQuality: (quality: VideoState['previewQuality']) => void
  
  // Loading states
  setCreatingVideo: (creating: boolean) => void
  setLoadingJobs: (loading: boolean) => void
  
  // Reset
  reset: () => void
}

const initialState: VideoState = {
  currentProject: null,
  jobs: [],
  activeJobs: new Map(),
  selectedElements: [],
  clipboard: [],
  currentTime: 0,
  isPlaying: false,
  zoom: 1,
  activeTool: 'select',
  panels: {
    timeline: true,
    properties: true,
    assets: false,
    effects: false,
  },
  history: {
    past: [],
    present: null,
    future: [],
    canUndo: false,
    canRedo: false,
  },
  previewQuality: 'medium',
  isCreatingVideo: false,
  isLoadingJobs: false,
  uploadingFiles: new Map(),
}

export const useVideoStore = create<VideoState & VideoActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // Project management
      createProject: (projectData) => {
        const project: VideoProject = {
          ...projectData,
          id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        }

        set((state) => {
          state.currentProject = project
          state.history.present = project
          state.history.past = []
          state.history.future = []
          state.history.canUndo = false
          state.history.canRedo = false
        })
      },

      loadProject: (project) => {
        set((state) => {
          state.currentProject = project
          state.history.present = project
          state.history.past = []
          state.history.future = []
          state.history.canUndo = false
          state.history.canRedo = false
          state.selectedElements = []
        })
      },

      saveProject: () => {
        const { currentProject } = get()
        if (currentProject) {
          set((state) => {
            if (state.currentProject) {
              state.currentProject.updatedAt = new Date()
              state.currentProject.version += 1
            }
          })
        }
      },

      closeProject: () => {
        set((state) => {
          state.currentProject = null
          state.selectedElements = []
          state.clipboard = []
          state.currentTime = 0
          state.isPlaying = false
          state.history = initialState.history
        })
      },

      // Elements
      addElement: (elementData) => {
        const element: VideoElementWithState = {
          ...elementData,
          id: `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        }

        set((state) => {
          if (state.currentProject) {
            state.currentProject.elements.push(element)
            state.currentProject.updatedAt = new Date()
          }
        })

        get().pushToHistory(get().currentProject!)
      },

      updateElement: (id, updates) => {
        set((state) => {
          if (state.currentProject) {
            const element = state.currentProject.elements.find(el => el.id === id)
            if (element) {
              Object.assign(element, updates)
              state.currentProject.updatedAt = new Date()
            }
          }
        })

        get().pushToHistory(get().currentProject!)
      },

      removeElement: (id) => {
        set((state) => {
          if (state.currentProject) {
            state.currentProject.elements = state.currentProject.elements.filter(el => el.id !== id)
            state.selectedElements = state.selectedElements.filter(elId => elId !== id)
            state.currentProject.updatedAt = new Date()
          }
        })

        get().pushToHistory(get().currentProject!)
      },

      duplicateElement: (id) => {
        const { currentProject } = get()
        if (currentProject) {
          const element = currentProject.elements.find(el => el.id === id)
          if (element) {
            const duplicated: VideoElementWithState = {
              ...element,
              id: `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              x: element.x ? `${parseFloat(element.x) + 5}%` : '5%',
              y: element.y ? `${parseFloat(element.y) + 5}%` : '5%',
            }

            set((state) => {
              if (state.currentProject) {
                state.currentProject.elements.push(duplicated)
                state.currentProject.updatedAt = new Date()
                state.selectedElements = [duplicated.id]
              }
            })

            get().pushToHistory(get().currentProject!)
          }
        }
      },

      selectElements: (ids) => {
        set((state) => {
          state.selectedElements = ids
        })
      },

      clearSelection: () => {
        set((state) => {
          state.selectedElements = []
        })
      },

      // Clipboard
      copyElements: (ids) => {
        const { currentProject } = get()
        if (currentProject) {
          const elements = currentProject.elements.filter(el => ids.includes(el.id))
          set((state) => {
            state.clipboard = elements
          })
        }
      },

      cutElements: (ids) => {
        get().copyElements(ids)
        ids.forEach(id => get().removeElement(id))
      },

      pasteElements: () => {
        const { clipboard } = get()
        clipboard.forEach(element => {
          const newElement = {
            ...element,
            x: element.x ? `${parseFloat(element.x) + 10}%` : '10%',
            y: element.y ? `${parseFloat(element.y) + 10}%` : '10%',
          }
          get().addElement(newElement)
        })
      },

      // Timeline
      setCurrentTime: (time) => {
        set((state) => {
          state.currentTime = Math.max(0, time)
        })
      },

      setPlaying: (playing) => {
        set((state) => {
          state.isPlaying = playing
        })
      },

      setZoom: (zoom) => {
        set((state) => {
          state.zoom = Math.max(0.1, Math.min(10, zoom))
        })
      },

      // Tools
      setActiveTool: (tool) => {
        set((state) => {
          state.activeTool = tool
        })
      },

      // Panels
      togglePanel: (panel) => {
        set((state) => {
          state.panels[panel] = !state.panels[panel]
        })
      },

      setPanelOpen: (panel, open) => {
        set((state) => {
          state.panels[panel] = open
        })
      },

      // History
      undo: () => {
        const { history } = get()
        if (history.canUndo && history.past.length > 0) {
          const previous = history.past[history.past.length - 1]
          const newPast = history.past.slice(0, -1)

          set((state) => {
            if (state.history.present) {
              state.history.future.unshift(state.history.present)
            }
            state.history.past = newPast
            state.history.present = previous
            state.currentProject = previous
            state.history.canUndo = newPast.length > 0
            state.history.canRedo = true
          })
        }
      },

      redo: () => {
        const { history } = get()
        if (history.canRedo && history.future.length > 0) {
          const next = history.future[0]
          const newFuture = history.future.slice(1)

          set((state) => {
            if (state.history.present) {
              state.history.past.push(state.history.present)
            }
            state.history.future = newFuture
            state.history.present = next
            state.currentProject = next
            state.history.canUndo = true
            state.history.canRedo = newFuture.length > 0
          })
        }
      },

      pushToHistory: (project) => {
        if (!project) return

        set((state) => {
          if (state.history.present) {
            state.history.past.push(state.history.present)
            // Limit history size
            if (state.history.past.length > 50) {
              state.history.past = state.history.past.slice(-50)
            }
          }
          state.history.present = { ...project }
          state.history.future = []
          state.history.canUndo = state.history.past.length > 0
          state.history.canRedo = false
        })
      },

      clearHistory: () => {
        set((state) => {
          state.history = initialState.history
        })
      },

      // Jobs
      addJob: (job) => {
        set((state) => {
          state.jobs.unshift(job)
        })
      },

      updateJob: (jobId, updates) => {
        set((state) => {
          const job = state.jobs.find(j => j.job_id === jobId)
          if (job) {
            Object.assign(job, updates)
          }
        })
      },

      removeJob: (jobId) => {
        set((state) => {
          state.jobs = state.jobs.filter(j => j.job_id !== jobId)
          state.activeJobs.delete(jobId)
        })
      },

      setJobs: (jobs) => {
        set((state) => {
          state.jobs = jobs
        })
      },

      updateActiveJob: (jobId, status) => {
        set((state) => {
          state.activeJobs.set(jobId, status)
        })
      },

      removeActiveJob: (jobId) => {
        set((state) => {
          state.activeJobs.delete(jobId)
        })
      },

      // Upload tracking
      startUpload: (fileId) => {
        set((state) => {
          state.uploadingFiles.set(fileId, { progress: 0, status: 'uploading' })
        })
      },

      updateUploadProgress: (fileId, progress) => {
        set((state) => {
          const upload = state.uploadingFiles.get(fileId)
          if (upload) {
            upload.progress = progress
          }
        })
      },

      completeUpload: (fileId) => {
        set((state) => {
          const upload = state.uploadingFiles.get(fileId)
          if (upload) {
            upload.status = 'completed'
            upload.progress = 100
          }
        })
      },

      failUpload: (fileId) => {
        set((state) => {
          const upload = state.uploadingFiles.get(fileId)
          if (upload) {
            upload.status = 'error'
          }
        })
      },

      // Settings
      setPreviewQuality: (quality) => {
        set((state) => {
          state.previewQuality = quality
        })
      },

      // Loading states
      setCreatingVideo: (creating) => {
        set((state) => {
          state.isCreatingVideo = creating
        })
      },

      setLoadingJobs: (loading) => {
        set((state) => {
          state.isLoadingJobs = loading
        })
      },

      // Reset
      reset: () => {
        set(() => ({ ...initialState }))
      },
    }))
  )
)
