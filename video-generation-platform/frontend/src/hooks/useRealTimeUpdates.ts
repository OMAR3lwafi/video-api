import { useEffect, useRef } from 'react';
import { useVideoStore } from '../stores/videoStore';

interface UseRealTimeUpdatesOptions {
  enableAutoSave?: boolean;
  autoSaveInterval?: number; // in milliseconds
  enablePreviewUpdates?: boolean;
  previewUpdateDelay?: number; // in milliseconds
}

export const useRealTimeUpdates = (options: UseRealTimeUpdatesOptions = {}) => {
  const {
    enableAutoSave = true,
    autoSaveInterval = 5000, // 5 seconds
    enablePreviewUpdates = true,
    previewUpdateDelay = 300, // 300ms debounce
  } = options;

  const {
    currentProject,
    canvasState,
    updateProject,
  } = useVideoStore();

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProjectStateRef = useRef<string>('');

  // Auto-save functionality
  useEffect(() => {
    if (!enableAutoSave || !currentProject) return;

    const currentProjectState = JSON.stringify(currentProject);
    
    // Only auto-save if project has actually changed
    if (currentProjectState !== lastProjectStateRef.current) {
      lastProjectStateRef.current = currentProjectState;
      
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      autoSaveTimeoutRef.current = setTimeout(() => {
        // Save to localStorage as a backup
        try {
          localStorage.setItem(`video-project-${currentProject.id}`, currentProjectState);
          localStorage.setItem('video-project-last-saved', new Date().toISOString());
        } catch (error) {
          console.warn('Failed to auto-save project to localStorage:', error);
        }
      }, autoSaveInterval);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [currentProject, enableAutoSave, autoSaveInterval]);

  // Preview update debouncing
  useEffect(() => {
    if (!enablePreviewUpdates || !currentProject) return;

    // Clear existing timeout
    if (previewUpdateTimeoutRef.current) {
      clearTimeout(previewUpdateTimeoutRef.current);
    }

    // Set new timeout for preview update
    previewUpdateTimeoutRef.current = setTimeout(() => {
      // Trigger any preview-related updates here
      // For example, regenerating preview thumbnails, updating timeline, etc.
      
      // Update the project's modified timestamp
      updateProject({ updatedAt: new Date() });
    }, previewUpdateDelay);

    return () => {
      if (previewUpdateTimeoutRef.current) {
        clearTimeout(previewUpdateTimeoutRef.current);
      }
    };
  }, [currentProject?.elements, canvasState, enablePreviewUpdates, previewUpdateDelay, updateProject]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (previewUpdateTimeoutRef.current) {
        clearTimeout(previewUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Load project from localStorage on mount
  useEffect(() => {
    if (!currentProject) return;

    try {
      const savedProject = localStorage.getItem(`video-project-${currentProject.id}`);
      if (savedProject) {
        const parsedProject = JSON.parse(savedProject);
        const lastSaved = localStorage.getItem('video-project-last-saved');
        
        // Only restore if the saved version is newer than current
        if (lastSaved && new Date(lastSaved) > currentProject.updatedAt) {
          console.log('Restoring project from auto-save');
          // You could dispatch an action here to restore the project
        }
      }
    } catch (error) {
      console.warn('Failed to load auto-saved project:', error);
    }
  }, [currentProject?.id]);

  return {
    isAutoSaveEnabled: enableAutoSave,
    isPreviewUpdatesEnabled: enablePreviewUpdates,
  };
};

// Hook for real-time canvas updates
export const useCanvasRealTime = () => {
  const { canvasState, setCanvasState } = useVideoStore();
  const animationFrameRef = useRef<number | null>(null);

  const requestCanvasUpdate = (updates: Partial<typeof canvasState>) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      setCanvasState(updates);
    });
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return { requestCanvasUpdate };
};

// Hook for element manipulation with real-time feedback
export const useElementManipulation = () => {
  const { updateElement } = useVideoStore();
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateElementRealTime = (elementId: string, updates: any, immediate = false) => {
    if (immediate) {
      updateElement(elementId, updates);
      return;
    }

    // Debounce updates for better performance
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      updateElement(elementId, updates);
    }, 16); // ~60fps
  };

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return { updateElementRealTime };
};
