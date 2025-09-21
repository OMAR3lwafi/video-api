import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { VideoProject, VideoElementWithState, Asset, VideoPreset, VIDEO_PRESETS } from '../types/video';
import { VideoElement } from '../types/api';

// Legacy types for compatibility
export interface UploadedFile {
  id: string;
  file: File;
  url: string;
  type: 'video' | 'image';
  name: string;
  size: number;
  duration?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  uploadProgress: number;
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'error';
}

export interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
  selectedElementId: string | null;
  isPlaying: boolean;
  currentTime: number;
}

export type VideoCreationStep = 'setup' | 'elements' | 'preview' | 'export';
export type ManipulationMode = 'select' | 'move' | 'resize' | 'rotate';

export interface GridSettings {
  enabled: boolean;
  size: number;
  snapToGrid: boolean;
  snapToElements: boolean;
}

interface VideoStore {
  // Current project state
  currentProject: VideoProject | null;
  
  // UI state
  currentStep: VideoCreationStep;
  canvasState: CanvasState;
  manipulationMode: ManipulationMode;
  gridSettings: GridSettings;
  
  // File management
  uploadedFiles: UploadedFile[];
  
  // Loading states
  isLoading: boolean;
  isExporting: boolean;
  
  // Actions
  // Project management
  createProject: (name: string, aspectRatio: VideoPreset | 'custom') => void;
  updateProject: (updates: Partial<VideoProject>) => void;
  resetProject: () => void;
  
  // Step navigation
  setCurrentStep: (step: VideoCreationStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  
  // Element management
  addElement: (element: Omit<VideoElement, 'id'>) => void;
  updateElement: (id: string, updates: Partial<VideoElement>) => void;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  reorderElements: (elements: VideoElement[]) => void;
  
  // Canvas management
  setCanvasState: (updates: Partial<CanvasState>) => void;
  selectElement: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  resetCanvas: () => void;
  
  // Manipulation mode
  setManipulationMode: (mode: ManipulationMode) => void;
  
  // Grid settings
  updateGridSettings: (settings: Partial<GridSettings>) => void;
  
  // File management
  addUploadedFile: (file: UploadedFile) => void;
  updateUploadedFile: (id: string, updates: Partial<UploadedFile>) => void;
  removeUploadedFile: (id: string) => void;
  clearUploadedFiles: () => void;
  
  // Loading states
  setLoading: (loading: boolean) => void;
  setExporting: (exporting: boolean) => void;
}

const initialCanvasState: CanvasState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  selectedElementId: null,
  isPlaying: false,
  currentTime: 0,
};

const initialGridSettings: GridSettings = {
  enabled: true,
  size: 20,
  snapToGrid: true,
  snapToElements: true,
};

const steps: VideoCreationStep[] = ['setup', 'elements', 'preview', 'export'];

export const useVideoStore = create<VideoStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentProject: null,
      currentStep: 'setup',
      canvasState: initialCanvasState,
      manipulationMode: 'select',
      gridSettings: initialGridSettings,
      uploadedFiles: [],
      isLoading: false,
      isExporting: false,

      // Project management
      createProject: (name: string, aspectRatio: VideoPreset | 'custom') => {
        const dimensions = aspectRatio !== 'custom' ? VIDEO_PRESETS[aspectRatio] : { width: 1920, height: 1080 };
        const project: VideoProject = {
          id: `project-${Date.now()}`,
          name,
          description: '',
          dimensions: {
            width: dimensions.width,
            height: dimensions.height,
            aspectRatio: dimensions.aspectRatio,
          },
          duration: 30,
          fps: 30,
          backgroundColor: '#000000',
          outputFormat: 'mp4',
          quality: 'high',
          elements: [],
          timeline: {
            currentTime: 0,
            zoom: 1,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        };
        
        set({ 
          currentProject: project,
          currentStep: 'elements',
          canvasState: { ...initialCanvasState },
        }, false, 'createProject');
      },

      updateProject: (updates) => {
        const { currentProject } = get();
        if (!currentProject) return;
        
        set({
          currentProject: {
            ...currentProject,
            ...updates,
            updatedAt: new Date(),
          },
        }, false, 'updateProject');
      },

      resetProject: () => {
        set({
          currentProject: null,
          currentStep: 'setup',
          canvasState: initialCanvasState,
          uploadedFiles: [],
        }, false, 'resetProject');
      },

      // Step navigation
      setCurrentStep: (step) => {
        set({ currentStep: step }, false, 'setCurrentStep');
      },

      nextStep: () => {
        const { currentStep } = get();
        const currentIndex = steps.indexOf(currentStep);
        if (currentIndex < steps.length - 1) {
          set({ currentStep: steps[currentIndex + 1] }, false, 'nextStep');
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        const currentIndex = steps.indexOf(currentStep);
        if (currentIndex > 0) {
          set({ currentStep: steps[currentIndex - 1] }, false, 'prevStep');
        }
      },

      // Element management
      addElement: (elementData) => {
        const { currentProject } = get();
        if (!currentProject) return;

        const element: VideoElement = {
          ...elementData,
          id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          x: elementData.x || '0%',
          y: elementData.y || '0%',
          width: elementData.width || '100%',
          height: elementData.height || '100%',
          fit_mode: elementData.fit_mode || 'contain',
          opacity: elementData.opacity || 1,
          rotation: elementData.rotation || 0,
          zIndex: elementData.zIndex || currentProject.elements.length,
        };

        set({
          currentProject: {
            ...currentProject,
            elements: [...currentProject.elements, element],
            updatedAt: new Date(),
          },
        }, false, 'addElement');
      },

      updateElement: (id, updates) => {
        const { currentProject } = get();
        if (!currentProject) return;

        const elementIndex = currentProject.elements.findIndex(el => el.id === id);
        if (elementIndex === -1) return;

        const updatedElements = [...currentProject.elements];
        updatedElements[elementIndex] = {
          ...updatedElements[elementIndex],
          ...updates,
        };

        set({
          currentProject: {
            ...currentProject,
            elements: updatedElements,
            updatedAt: new Date(),
          },
        }, false, 'updateElement');
      },

      removeElement: (id) => {
        const { currentProject, canvasState } = get();
        if (!currentProject) return;

        const updatedElements = currentProject.elements.filter(el => el.id !== id);
        
        set({
          currentProject: {
            ...currentProject,
            elements: updatedElements,
            updatedAt: new Date(),
          },
          canvasState: {
            ...canvasState,
            selectedElementId: canvasState.selectedElementId === id ? null : canvasState.selectedElementId,
          },
        }, false, 'removeElement');
      },

      duplicateElement: (id) => {
        const { currentProject } = get();
        if (!currentProject) return;

        const element = currentProject.elements.find(el => el.id === id);
        if (!element) return;

        const duplicatedElement: VideoElement = {
          ...element,
          id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          x: `${parseFloat(element.x || '0') + 5}%`,
          y: `${parseFloat(element.y || '0') + 5}%`,
        };

        set({
          currentProject: {
            ...currentProject,
            elements: [...currentProject.elements, duplicatedElement],
            updatedAt: new Date(),
          },
        }, false, 'duplicateElement');
      },

      reorderElements: (elements) => {
        const { currentProject } = get();
        if (!currentProject) return;

        set({
          currentProject: {
            ...currentProject,
            elements,
            updatedAt: new Date(),
          },
        }, false, 'reorderElements');
      },

      // Canvas management
      setCanvasState: (updates) => {
        const { canvasState } = get();
        set({
          canvasState: { ...canvasState, ...updates },
        }, false, 'setCanvasState');
      },

      selectElement: (id) => {
        const { canvasState } = get();
        set({
          canvasState: { ...canvasState, selectedElementId: id },
        }, false, 'selectElement');
      },

      setZoom: (zoom) => {
        const { canvasState } = get();
        set({
          canvasState: { ...canvasState, zoom: Math.max(0.1, Math.min(5, zoom)) },
        }, false, 'setZoom');
      },

      setPan: (panX, panY) => {
        const { canvasState } = get();
        set({
          canvasState: { ...canvasState, panX, panY },
        }, false, 'setPan');
      },

      resetCanvas: () => {
        set({
          canvasState: initialCanvasState,
        }, false, 'resetCanvas');
      },

      // Manipulation mode
      setManipulationMode: (mode) => {
        set({ manipulationMode: mode }, false, 'setManipulationMode');
      },

      // Grid settings
      updateGridSettings: (settings) => {
        const { gridSettings } = get();
        set({
          gridSettings: { ...gridSettings, ...settings },
        }, false, 'updateGridSettings');
      },

      // File management
      addUploadedFile: (file) => {
        const { uploadedFiles } = get();
        set({
          uploadedFiles: [...uploadedFiles, file],
        }, false, 'addUploadedFile');
      },

      updateUploadedFile: (id, updates) => {
        const { uploadedFiles } = get();
        const fileIndex = uploadedFiles.findIndex(f => f.id === id);
        if (fileIndex === -1) return;

        const updatedFiles = [...uploadedFiles];
        updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], ...updates };

        set({
          uploadedFiles: updatedFiles,
        }, false, 'updateUploadedFile');
      },

      removeUploadedFile: (id) => {
        const { uploadedFiles } = get();
        set({
          uploadedFiles: uploadedFiles.filter(f => f.id !== id),
        }, false, 'removeUploadedFile');
      },

      clearUploadedFiles: () => {
        set({ uploadedFiles: [] }, false, 'clearUploadedFiles');
      },

      // Loading states
      setLoading: (loading) => {
        set({ isLoading: loading }, false, 'setLoading');
      },

      setExporting: (exporting) => {
        set({ isExporting: exporting }, false, 'setExporting');
      },
    }),
    {
      name: 'video-store',
    }
  )
);
