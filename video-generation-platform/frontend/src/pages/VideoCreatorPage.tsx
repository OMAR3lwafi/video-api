import React, { useEffect } from 'react';
import { VideoCreator } from '../components/VideoCreator';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import { useVideoStore } from '../stores/videoStore';

export const VideoCreatorPage: React.FC = () => {
  const { currentProject } = useVideoStore();
  
  // Enable real-time updates for the video creator
  useRealTimeUpdates({
    enableAutoSave: true,
    autoSaveInterval: 5000,
    enablePreviewUpdates: true,
    previewUpdateDelay: 300,
  });

  // Set document title based on project
  useEffect(() => {
    if (currentProject) {
      document.title = `${currentProject.name} - Video Creator`;
    } else {
      document.title = 'Video Creator - Dynamic Video Platform';
    }

    return () => {
      document.title = 'Dynamic Video Platform';
    };
  }, [currentProject]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      switch (e.key) {
        case 's':
          if (isCtrlOrCmd) {
            e.preventDefault();
            // Trigger manual save if needed
            console.log('Manual save triggered');
          }
          break;
        
        case 'z':
          if (isCtrlOrCmd && !e.shiftKey) {
            e.preventDefault();
            // Undo functionality (would need to implement in store)
            console.log('Undo triggered');
          }
          break;
          
        case 'z':
          if (isCtrlOrCmd && e.shiftKey) {
            e.preventDefault();
            // Redo functionality (would need to implement in store)
            console.log('Redo triggered');
          }
          break;
          
        case 'y':
          if (isCtrlOrCmd) {
            e.preventDefault();
            // Redo functionality alternative
            console.log('Redo triggered');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => document.removeEventListener('keydown', handleKeyboardShortcuts);
  }, []);

  // Prevent accidental page refresh when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentProject && currentProject.elements.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentProject]);

  return (
    <div className="h-screen overflow-hidden">
      <VideoCreator className="h-full" />
    </div>
  );
};
