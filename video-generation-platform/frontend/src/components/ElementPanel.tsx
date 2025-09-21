import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  FileVideo, 
  FileImage, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash2, 
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus,
  Layers
} from 'lucide-react';
import { useVideoStore } from '../stores/videoStore';
import { VideoElement, UploadedFile } from '../types/video';

interface ElementPanelProps {
  className?: string;
}

interface ElementItemProps {
  element: VideoElement;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const ElementItem: React.FC<ElementItemProps> = ({
  element,
  isSelected,
  onSelect,
  onToggleVisibility,
  onDuplicate,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isVisible = (element.opacity || 1) > 0;

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleVisibility(element.id, !isVisible);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate(element.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(element.id);
  };

  const formatPosition = (value?: string) => {
    if (!value) return '0%';
    return parseFloat(value).toFixed(1) + '%';
  };

  const formatSize = (value?: string) => {
    if (!value) return '100%';
    return parseFloat(value).toFixed(1) + '%';
  };

  return (
    <motion.div
      layout
      className={`
        group border rounded-lg transition-all duration-200
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }
        ${!isVisible ? 'opacity-60' : ''}
      `}
    >
      {/* Element Header */}
      <div
        className="flex items-center p-3 cursor-pointer"
        onClick={() => onSelect(element.id)}
      >
        {/* Drag Handle */}
        <div className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
        </div>

        {/* Element Icon */}
        <div className="mr-3">
          {element.type === 'video' ? (
            <FileVideo className="w-5 h-5 text-blue-500" />
          ) : (
            <FileImage className="w-5 h-5 text-green-500" />
          )}
        </div>

        {/* Element Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {element.type === 'video' ? 'Video' : 'Image'} {element.track}
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              Track {element.track}
            </span>
          </div>
          
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>
              {formatPosition(element.x)}, {formatPosition(element.y)}
            </span>
            <span>•</span>
            <span>
              {formatSize(element.width)} × {formatSize(element.height)}
            </span>
            {element.opacity !== undefined && element.opacity < 1 && (
              <>
                <span>•</span>
                <span>{Math.round((element.opacity || 1) * 100)}% opacity</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1 ml-2">
          <button
            onClick={handleToggleVisibility}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title={isVisible ? 'Hide element' : 'Show element'}
          >
            {isVisible ? (
              <Eye className="w-4 h-4 text-gray-500" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-400" />
            )}
          </button>
          
          <button
            onClick={handleDuplicate}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Duplicate element"
          >
            <Copy className="w-4 h-4 text-gray-500" />
          </button>
          
          <button
            onClick={handleDelete}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete element"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>

          {/* Expand/Collapse */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* Element Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-200 dark:border-gray-700"
          >
            <div className="p-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Position:</span>
                  <div className="text-gray-900 dark:text-gray-100">
                    X: {formatPosition(element.x)}<br/>
                    Y: {formatPosition(element.y)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Size:</span>
                  <div className="text-gray-900 dark:text-gray-100">
                    W: {formatSize(element.width)}<br/>
                    H: {formatSize(element.height)}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Opacity:</span>
                  <div className="text-gray-900 dark:text-gray-100">
                    {Math.round((element.opacity || 1) * 100)}%
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Fit Mode:</span>
                  <div className="text-gray-900 dark:text-gray-100 capitalize">
                    {element.fit_mode || 'contain'}
                  </div>
                </div>
              </div>
              
              {element.rotation && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Rotation:</span>
                  <span className="text-gray-900 dark:text-gray-100 ml-2">
                    {element.rotation}°
                  </span>
                </div>
              )}
              
              <div>
                <span className="text-gray-500 dark:text-gray-400">Source:</span>
                <div className="text-gray-900 dark:text-gray-100 break-all">
                  {element.source}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const ElementPanel: React.FC<ElementPanelProps> = ({ className = '' }) => {
  const {
    currentProject,
    canvasState,
    uploadedFiles,
    selectElement,
    updateElement,
    removeElement,
    duplicateElement,
    addElement,
    reorderElements,
  } = useVideoStore();

  const [showAddMenu, setShowAddMenu] = useState(false);

  if (!currentProject) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Layers className="w-8 h-8 mx-auto mb-2" />
          <p>No project loaded</p>
        </div>
      </div>
    );
  }

  const { elements } = currentProject;
  const { selectedElementId } = canvasState;

  const handleElementSelect = (id: string) => {
    selectElement(id);
  };

  const handleToggleVisibility = (id: string, visible: boolean) => {
    updateElement(id, { opacity: visible ? 1 : 0 });
  };

  const handleDuplicate = (id: string) => {
    duplicateElement(id);
  };

  const handleDelete = (id: string) => {
    removeElement(id);
  };

  const handleReorder = (newElements: VideoElement[]) => {
    // Update z-index based on new order
    const elementsWithZIndex = newElements.map((element, index) => ({
      ...element,
      zIndex: index,
    }));
    reorderElements(elementsWithZIndex);
  };

  const handleAddFromUpload = (uploadedFile: UploadedFile) => {
    if (uploadedFile.uploadStatus !== 'completed') return;

    const newElement = {
      type: uploadedFile.type,
      source: uploadedFile.url,
      track: elements.length,
      x: '10%',
      y: '10%',
      width: '50%',
      height: '50%',
      fit_mode: 'contain' as const,
      opacity: 1,
      rotation: 0,
    };

    addElement(newElement);
    setShowAddMenu(false);
  };

  const availableFiles = uploadedFiles.filter(file => file.uploadStatus === 'completed');

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Elements ({elements.length})
          </h3>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            disabled={availableFiles.length === 0}
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>

          {/* Add Menu */}
          <AnimatePresence>
            {showAddMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
              >
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 mb-1">
                    Add from uploaded files:
                  </div>
                  
                  {availableFiles.length === 0 ? (
                    <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                      No uploaded files available
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {availableFiles.map((file) => (
                        <button
                          key={file.id}
                          onClick={() => handleAddFromUpload(file)}
                          className="w-full flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left"
                        >
                          {file.type === 'video' ? (
                            <FileVideo className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          ) : (
                            <FileImage className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {file.name}
                            </p>
                            {file.dimensions && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {file.dimensions.width}×{file.dimensions.height}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Elements List */}
      <div className="flex-1 overflow-y-auto p-4">
        {elements.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm mb-2">No elements added yet</p>
            <p className="text-xs">Add elements from uploaded files to get started</p>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={elements}
            onReorder={handleReorder}
            className="space-y-2"
          >
            {elements.map((element) => (
              <Reorder.Item key={element.id} value={element}>
                <ElementItem
                  element={element}
                  isSelected={element.id === selectedElementId}
                  onSelect={handleElementSelect}
                  onToggleVisibility={handleToggleVisibility}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}
      </div>

      {/* Footer */}
      {elements.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {elements.filter(el => (el.opacity || 1) > 0).length} visible
            </span>
            {selectedElementId && (
              <span>
                Selected: {elements.find(el => el.id === selectedElementId)?.type} {
                  elements.find(el => el.id === selectedElementId)?.track
                }
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
