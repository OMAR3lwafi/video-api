import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Move, 
  Maximize2, 
  RotateCw, 
  Eye, 
  Image as ImageIcon,
  Video,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useVideoStore } from '../stores/videoStore';
import { VideoElement } from '../types/video';

interface PropertiesPanelProps {
  className?: string;
}

interface PropertyGroupProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

interface SelectInputProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface NumberInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const PropertyGroup: React.FC<PropertyGroupProps> = ({ 
  title, 
  icon, 
  children, 
  defaultExpanded = true 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center space-x-2">
          {icon}
          <span className="font-medium text-gray-900 dark:text-gray-100">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>
      
      {isExpanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          transition={{ duration: 0.2 }}
          className="p-4 space-y-4 bg-white dark:bg-gray-900"
        >
          {children}
        </motion.div>
      )}
    </div>
  );
};

const SliderInput: React.FC<SliderInputProps> = ({ 
  label, 
  value, 
  min, 
  max, 
  step = 1, 
  unit = '', 
  onChange, 
  disabled = false 
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {value}{unit}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className={`
            w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
      </div>
    </div>
  );
};

const SelectInput: React.FC<SelectInputProps> = ({ 
  label, 
  value, 
  options, 
  onChange, 
  disabled = false 
}) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
          rounded-lg text-sm text-gray-900 dark:text-gray-100
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const NumberInput: React.FC<NumberInputProps> = ({ 
  label, 
  value, 
  onChange, 
  unit = '%', 
  min, 
  max, 
  disabled = false 
}) => {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleBlur = () => {
    let numericValue = parseFloat(inputValue.replace(unit, ''));
    
    if (isNaN(numericValue)) {
      setInputValue(value);
      return;
    }

    if (min !== undefined && numericValue < min) numericValue = min;
    if (max !== undefined && numericValue > max) numericValue = max;
    
    const newValue = numericValue + unit;
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyPress={handleKeyPress}
        disabled={disabled}
        className={`
          w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
          rounded-lg text-sm text-gray-900 dark:text-gray-100
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        placeholder={`0${unit}`}
      />
    </div>
  );
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ className = '' }) => {
  const {
    currentProject,
    canvasState,
    updateElement,
  } = useVideoStore();

  if (!currentProject) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Settings className="w-8 h-8 mx-auto mb-2" />
          <p>No project loaded</p>
        </div>
      </div>
    );
  }

  const { elements } = currentProject;
  const { selectedElementId } = canvasState;

  const selectedElement = elements.find(el => el.id === selectedElementId);

  if (!selectedElement) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Settings className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm mb-2">No element selected</p>
          <p className="text-xs">Select an element to edit its properties</p>
        </div>
      </div>
    );
  }

  const handleUpdateElement = (updates: Partial<VideoElement>) => {
    updateElement(selectedElement.id, updates);
  };

  const fitModeOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'contain', label: 'Contain' },
    { value: 'cover', label: 'Cover' },
    { value: 'fill', label: 'Fill' },
  ];

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Properties
          </h3>
        </div>
        
        <div className="flex items-center space-x-2">
          {selectedElement.type === 'video' ? (
            <Video className="w-4 h-4 text-blue-500" />
          ) : (
            <ImageIcon className="w-4 h-4 text-green-500" />
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Track {selectedElement.track}
          </span>
        </div>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Position & Size */}
        <PropertyGroup
          title="Transform"
          icon={<Move className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
        >
          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="X Position"
              value={selectedElement.x || '0%'}
              onChange={(value) => handleUpdateElement({ x: value })}
              unit="%"
              min={0}
              max={100}
            />
            <NumberInput
              label="Y Position"
              value={selectedElement.y || '0%'}
              onChange={(value) => handleUpdateElement({ y: value })}
              unit="%"
              min={0}
              max={100}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="Width"
              value={selectedElement.width || '100%'}
              onChange={(value) => handleUpdateElement({ width: value })}
              unit="%"
              min={1}
              max={200}
            />
            <NumberInput
              label="Height"
              value={selectedElement.height || '100%'}
              onChange={(value) => handleUpdateElement({ height: value })}
              unit="%"
              min={1}
              max={200}
            />
          </div>
        </PropertyGroup>

        {/* Appearance */}
        <PropertyGroup
          title="Appearance"
          icon={<Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
        >
          <SliderInput
            label="Opacity"
            value={Math.round((selectedElement.opacity || 1) * 100)}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => handleUpdateElement({ opacity: value / 100 })}
          />
          
          <SliderInput
            label="Rotation"
            value={selectedElement.rotation || 0}
            min={-360}
            max={360}
            unit="°"
            onChange={(value) => handleUpdateElement({ rotation: value })}
          />
          
          <SelectInput
            label="Fit Mode"
            value={selectedElement.fit_mode || 'contain'}
            options={fitModeOptions}
            onChange={(value) => handleUpdateElement({ fit_mode: value as any })}
          />
        </PropertyGroup>

        {/* Layering */}
        <PropertyGroup
          title="Layering"
          icon={<Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Z-Index (Layer Order)
              </label>
              <input
                type="number"
                value={selectedElement.zIndex || 0}
                onChange={(e) => handleUpdateElement({ zIndex: parseInt(e.target.value) })}
                min={0}
                max={elements.length - 1}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Higher values appear on top
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Track
              </label>
              <input
                type="number"
                value={selectedElement.track}
                onChange={(e) => handleUpdateElement({ track: parseInt(e.target.value) })}
                min={0}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Timeline track number
              </p>
            </div>
          </div>
        </PropertyGroup>

        {/* Element Info */}
        <PropertyGroup
          title="Element Info"
          icon={
            selectedElement.type === 'video' 
              ? <Video className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              : <ImageIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          }
          defaultExpanded={false}
        >
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Type
              </label>
              <p className="text-sm text-gray-900 dark:text-gray-100 capitalize">
                {selectedElement.type}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Source URL
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                {selectedElement.source}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Element ID
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {selectedElement.id}
              </p>
            </div>
          </div>
        </PropertyGroup>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleUpdateElement({ 
              x: '50%', 
              y: '50%', 
              width: '50%', 
              height: '50%' 
            })}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Center
          </button>
          <button
            onClick={() => handleUpdateElement({ 
              x: '0%', 
              y: '0%', 
              width: '100%', 
              height: '100%' 
            })}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Fill Canvas
          </button>
          <button
            onClick={() => handleUpdateElement({ rotation: 0, opacity: 1 })}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Reset Transform
          </button>
          <button
            onClick={() => handleUpdateElement({ 
              opacity: (selectedElement.opacity || 1) > 0 ? 0 : 1 
            })}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {(selectedElement.opacity || 1) > 0 ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
    </div>
  );
};
