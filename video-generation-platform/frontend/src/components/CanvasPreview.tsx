import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, RotateCcw, Grid, Move, MousePointer, RotateCw, Copy } from 'lucide-react';
import { useVideoStore } from '../stores/videoStore';
import { VideoElement } from '../types/video';

interface CanvasPreviewProps {
  className?: string;
}

interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  isDragging: boolean;
  elementId: string | null;
  startX: number;
  startY: number;
  initialBounds: ElementBounds | null;
}

interface ResizeHandle {
  position: 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';
  cursor: string;
}

const RESIZE_HANDLES: ResizeHandle[] = [
  { position: 'nw', cursor: 'nw-resize' },
  { position: 'n', cursor: 'n-resize' },
  { position: 'ne', cursor: 'ne-resize' },
  { position: 'w', cursor: 'w-resize' },
  { position: 'e', cursor: 'e-resize' },
  { position: 'sw', cursor: 'sw-resize' },
  { position: 's', cursor: 's-resize' },
  { position: 'se', cursor: 'se-resize' },
];

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({ className = '' }) => {
  const {
    currentProject,
    canvasState,
    manipulationMode,
    gridSettings,
    setCanvasState,
    selectElement,
    updateElement,
    duplicateElement,
    setZoom,
    setPan,
    resetCanvas,
  } = useVideoStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    elementId: null,
    startX: 0,
    startY: 0,
    initialBounds: null,
  });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  if (!currentProject) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">No project loaded</p>
      </div>
    );
  }

  const { dimensions: { width: projectWidth, height: projectHeight }, elements } = currentProject;
  const { zoom, panX, panY, selectedElementId } = canvasState;

  // Convert percentage to pixels based on project dimensions
  const percentToPixels = useCallback((percent: string, dimension: 'width' | 'height') => {
    const value = parseFloat(percent.replace('%', ''));
    const baseDimension = dimension === 'width' ? projectWidth : projectHeight;
    return (value / 100) * baseDimension;
  }, [projectWidth, projectHeight]);

  // Convert pixels to percentage
  const pixelsToPercent = useCallback((pixels: number, dimension: 'width' | 'height') => {
    const baseDimension = dimension === 'width' ? projectWidth : projectHeight;
    return ((pixels / baseDimension) * 100).toFixed(2) + '%';
  }, [projectWidth, projectHeight]);

  // Get element bounds in pixels
  const getElementBounds = useCallback((element: VideoElement): ElementBounds => {
    return {
      x: percentToPixels(element.x || '0%', 'width'),
      y: percentToPixels(element.y || '0%', 'height'),
      width: percentToPixels(element.width || '100%', 'width'),
      height: percentToPixels(element.height || '100%', 'height'),
    };
  }, [percentToPixels]);

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectElement(null);
    }
  }, [selectElement]);

  // Handle element click
  const handleElementClick = useCallback((elementId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    selectElement(elementId);
  }, [selectElement]);

  // Handle element double click (for editing)
  const handleElementDoubleClick = useCallback((elementId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateElement(elementId);
  }, [duplicateElement]);

  // Mouse down handler for dragging
  const handleMouseDown = useCallback((elementId: string, e: React.MouseEvent) => {
    if (manipulationMode !== 'move' && manipulationMode !== 'select') return;
    
    e.preventDefault();
    e.stopPropagation();

    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    const bounds = getElementBounds(element);
    
    setDragState({
      isDragging: true,
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      initialBounds: bounds,
    });

    selectElement(elementId);
  }, [manipulationMode, elements, getElementBounds, selectElement]);

  // Mouse move handler for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.elementId || !dragState.initialBounds) return;

    const deltaX = (e.clientX - dragState.startX) / zoom;
    const deltaY = (e.clientY - dragState.startY) / zoom;

    let newX = dragState.initialBounds.x + deltaX;
    let newY = dragState.initialBounds.y + deltaY;

    // Snap to grid if enabled
    if (gridSettings.snapToGrid && gridSettings.enabled) {
      newX = Math.round(newX / gridSettings.size) * gridSettings.size;
      newY = Math.round(newY / gridSettings.size) * gridSettings.size;
    }

    // Constrain to canvas bounds
    newX = Math.max(0, Math.min(newX, projectWidth - dragState.initialBounds.width));
    newY = Math.max(0, Math.min(newY, projectHeight - dragState.initialBounds.height));

    updateElement(dragState.elementId, {
      x: pixelsToPercent(newX, 'width'),
      y: pixelsToPercent(newY, 'height'),
    });
  }, [dragState, zoom, gridSettings, projectWidth, projectHeight, updateElement, pixelsToPercent]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      elementId: null,
      startX: 0,
      startY: 0,
      initialBounds: null,
    });
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  // Wheel handler for zooming
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom + delta));
    setZoom(newZoom);
  }, [zoom, setZoom]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body) return;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (selectedElementId) {
            // Remove element (would need to add this to store)
          }
          break;
        case 'Escape':
          selectElement(null);
          break;
        case 'd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (selectedElementId) {
              duplicateElement(selectedElementId);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, selectElement, duplicateElement]);

  // Mouse event listeners
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragState.isDragging) {
        handleMouseMove(e as any);
      }
    };

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  // Render grid
  const renderGrid = () => {
    if (!gridSettings.enabled) return null;

    const gridLines = [];
    const { size } = gridSettings;

    // Vertical lines
    for (let x = 0; x <= projectWidth; x += size) {
      gridLines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={projectHeight}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.2"
        />
      );
    }

    // Horizontal lines
    for (let y = 0; y <= projectHeight; y += size) {
      gridLines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={projectWidth}
          y2={y}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.2"
        />
      );
    }

    return (
      <svg
        className="absolute inset-0 pointer-events-none text-gray-400 dark:text-gray-600"
        width={projectWidth}
        height={projectHeight}
      >
        {gridLines}
      </svg>
    );
  };

  // Render element
  const renderElement = (element: VideoElement) => {
    const bounds = getElementBounds(element);
    const isSelected = element.id === selectedElementId;

    return (
      <div
        key={element.id}
        className={`absolute cursor-pointer transition-all duration-200 ${
          isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
        }`}
        style={{
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
          transform: `rotate(${element.rotation || 0}deg)`,
          opacity: element.opacity || 1,
          zIndex: element.zIndex || 0,
        }}
        onClick={(e) => handleElementClick(element.id, e)}
        onDoubleClick={(e) => handleElementDoubleClick(element.id, e)}
        onMouseDown={(e) => handleMouseDown(element.id, e)}
      >
        {element.type === 'image' ? (
          <img
            src={element.source}
            alt={`Element ${element.id}`}
            className="w-full h-full object-cover rounded border border-gray-300 dark:border-gray-600"
            style={{ objectFit: element.fit_mode || 'contain' }}
            draggable={false}
          />
        ) : (
          <video
            src={element.source}
            className="w-full h-full object-cover rounded border border-gray-300 dark:border-gray-600"
            style={{ objectFit: element.fit_mode || 'contain' }}
            muted
            loop
          />
        )}

        {/* Selection handles */}
        {isSelected && (
          <>
            {RESIZE_HANDLES.map((handle) => (
              <div
                key={handle.position}
                className={`absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full ${
                  handle.position.includes('n') ? '-top-1.5' : 
                  handle.position.includes('s') ? '-bottom-1.5' : 'top-1/2 -translate-y-1/2'
                } ${
                  handle.position.includes('w') ? '-left-1.5' : 
                  handle.position.includes('e') ? '-right-1.5' : 'left-1/2 -translate-x-1/2'
                }`}
                style={{ cursor: handle.cursor }}
              />
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`relative bg-white dark:bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2">
        <button
          onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        
        <span className="text-sm font-medium px-2 min-w-[60px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        
        <button
          onClick={() => setZoom(Math.min(5, zoom + 0.1))}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
        
        <button
          onClick={resetCanvas}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => gridSettings.enabled ? 
            useVideoStore.getState().updateGridSettings({ enabled: false }) :
            useVideoStore.getState().updateGridSettings({ enabled: true })
          }
          className={`p-2 rounded transition-colors ${
            gridSettings.enabled 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="Toggle Grid"
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative w-full h-full overflow-hidden bg-gray-100 dark:bg-gray-800"
        onClick={handleCanvasClick}
        onWheel={handleWheel}
      >
        <div
          className="relative bg-white dark:bg-gray-900 shadow-lg mx-auto my-8"
          style={{
            width: projectWidth * zoom,
            height: projectHeight * zoom,
            transform: `translate(${panX}px, ${panY}px)`,
          }}
        >
          {/* Grid */}
          <div
            style={{
              width: projectWidth,
              height: projectHeight,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            {renderGrid()}
            
            {/* Elements */}
            {elements.map(renderElement)}
          </div>

          {/* Project info overlay */}
          <div className="absolute -bottom-8 left-0 text-xs text-gray-500 dark:text-gray-400">
            {projectWidth} × {projectHeight}px
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="absolute bottom-4 right-4 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-2">
        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
          <span>Elements: {elements.length}</span>
          {selectedElementId && (
            <span>Selected: {selectedElementId}</span>
          )}
          <span>Mode: {manipulationMode}</span>
        </div>
      </div>
    </div>
  );
};
