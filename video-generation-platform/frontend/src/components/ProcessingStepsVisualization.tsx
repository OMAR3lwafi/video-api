/**
 * ProcessingStepsVisualization - Step-by-step processing visualization
 * Shows detailed progress through video processing pipeline
 */

import React, { useState, useEffect } from 'react';
import { useProcessingTimeline } from '../hooks/useSupabase';
import { PROCESSING_STEPS, PROCESSING_MESSAGES } from '../types/api';

// ============================================================================
// INTERFACES
// ============================================================================

interface ProcessingStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

interface ProcessingStepsVisualizationProps {
  jobId: string;
  currentStatus?: string;
  currentStep?: string;
  progress?: number;
  showTimeline?: boolean;
  showDetails?: boolean;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

// ============================================================================
// DEFAULT STEPS CONFIGURATION
// ============================================================================

const DEFAULT_STEPS: ProcessingStep[] = [
  {
    id: PROCESSING_STEPS.VALIDATION,
    name: 'Validation',
    description: PROCESSING_MESSAGES[PROCESSING_STEPS.VALIDATION],
    status: 'pending',
    progress: 0,
  },
  {
    id: PROCESSING_STEPS.RESOURCE_ALLOCATION,
    name: 'Resource Allocation',
    description: PROCESSING_MESSAGES[PROCESSING_STEPS.RESOURCE_ALLOCATION],
    status: 'pending',
    progress: 0,
  },
  {
    id: PROCESSING_STEPS.MEDIA_DOWNLOAD,
    name: 'Media Download',
    description: PROCESSING_MESSAGES[PROCESSING_STEPS.MEDIA_DOWNLOAD],
    status: 'pending',
    progress: 0,
  },
  {
    id: PROCESSING_STEPS.MEDIA_ANALYSIS,
    name: 'Media Analysis',
    description: PROCESSING_MESSAGES[PROCESSING_STEPS.MEDIA_ANALYSIS],
    status: 'pending',
    progress: 0,
  },
  {
    id: PROCESSING_STEPS.VIDEO_COMPOSITION,
    name: 'Video Composition',
    description: PROCESSING_MESSAGES[PROCESSING_STEPS.VIDEO_COMPOSITION],
    status: 'pending',
    progress: 0,
  },
  {
    id: PROCESSING_STEPS.ENCODING,
    name: 'Encoding',
    description: PROCESSING_MESSAGES[PROCESSING_STEPS.ENCODING],
    status: 'pending',
    progress: 0,
  },
  {
    id: PROCESSING_STEPS.UPLOAD,
    name: 'Upload',
    description: PROCESSING_MESSAGES[PROCESSING_STEPS.UPLOAD],
    status: 'pending',
    progress: 0,
  },
  {
    id: PROCESSING_STEPS.FINALIZATION,
    name: 'Finalization',
    description: PROCESSING_MESSAGES[PROCESSING_STEPS.FINALIZATION],
    status: 'pending',
    progress: 0,
  },
];

// ============================================================================
// STEP ICON COMPONENT
// ============================================================================

interface StepIconProps {
  status: ProcessingStep['status'];
  stepNumber: number;
  size?: 'sm' | 'md' | 'lg';
}

const StepIcon: React.FC<StepIconProps> = ({ status, stepNumber, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const iconClass = sizeClasses[size];

  switch (status) {
    case 'completed':
      return (
        <div className={`${iconClass} bg-green-100 text-green-600 rounded-full flex items-center justify-center dark:bg-green-900/20 dark:text-green-400`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    
    case 'processing':
      return (
        <div className={`${iconClass} bg-blue-100 text-blue-600 rounded-full flex items-center justify-center dark:bg-blue-900/20 dark:text-blue-400`}>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
        </div>
      );
    
    case 'failed':
      return (
        <div className={`${iconClass} bg-red-100 text-red-600 rounded-full flex items-center justify-center dark:bg-red-900/20 dark:text-red-400`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      );
    
    case 'skipped':
      return (
        <div className={`${iconClass} bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center dark:bg-yellow-900/20 dark:text-yellow-400`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </div>
      );
    
    default: // pending
      return (
        <div className={`${iconClass} bg-gray-100 text-gray-400 rounded-full flex items-center justify-center dark:bg-gray-800 dark:text-gray-500`}>
          <span className="font-medium">{stepNumber}</span>
        </div>
      );
  }
};

// ============================================================================
// STEP PROGRESS BAR COMPONENT
// ============================================================================

interface StepProgressProps {
  progress: number;
  status: ProcessingStep['status'];
  size?: 'sm' | 'md' | 'lg';
}

const StepProgress: React.FC<StepProgressProps> = ({ progress, status, size = 'md' }) => {
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const getProgressColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  return (
    <div className={`w-full bg-gray-200 rounded-full ${heightClasses[size]} dark:bg-gray-700 overflow-hidden`}>
      <div
        className={`${heightClasses[size]} rounded-full transition-all duration-300 ${getProgressColor()}`}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      >
        {status === 'processing' && (
          <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProcessingStepsVisualization: React.FC<ProcessingStepsVisualizationProps> = ({
  jobId,
  currentStatus,
  currentStep,
  progress = 0,
  showTimeline = true,
  showDetails = true,
  orientation = 'vertical',
  className = '',
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [steps, setSteps] = useState<ProcessingStep[]>(DEFAULT_STEPS);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // ============================================================================
  // REAL-TIME UPDATES
  // ============================================================================

  const { connectionState } = useProcessingTimeline(jobId, {
    onStepUpdate: (update) => {
      setSteps(prevSteps => 
        prevSteps.map(step => {
          if (step.id === update.step_name || step.name.toLowerCase().includes(update.step_name.toLowerCase())) {
            return {
              ...step,
              status: update.status,
              progress: update.progress,
              ...(update.status === 'processing' && !step.startTime ? { startTime: new Date() } : {}),
              ...(update.status === 'completed' && !step.endTime ? { 
                endTime: new Date(),
                duration: step.startTime ? Date.now() - step.startTime.getTime() : undefined,
              } : {}),
            };
          }
          return step;
        })
      );
    },
    autoConnect: true,
  });

  // ============================================================================
  // STEP STATUS LOGIC
  // ============================================================================

  useEffect(() => {
    // Update steps based on current status and progress
    setSteps(prevSteps => {
      const updatedSteps = [...prevSteps];
      const totalSteps = updatedSteps.length;
      const progressPerStep = 100 / totalSteps;

      // Find current step index
      let currentStepIndex = -1;
      if (currentStep) {
        currentStepIndex = updatedSteps.findIndex(step => 
          step.id === currentStep || 
          step.name.toLowerCase().includes(currentStep.toLowerCase())
        );
      }

      // If no specific step found, estimate based on overall progress
      if (currentStepIndex === -1) {
        currentStepIndex = Math.floor(progress / progressPerStep);
      }

      // Update step statuses
      updatedSteps.forEach((step, index) => {
        if (currentStatus === 'completed') {
          step.status = 'completed';
          step.progress = 100;
        } else if (currentStatus === 'failed') {
          if (index <= currentStepIndex) {
            step.status = index === currentStepIndex ? 'failed' : 'completed';
          }
        } else if (currentStatus === 'processing') {
          if (index < currentStepIndex) {
            step.status = 'completed';
            step.progress = 100;
          } else if (index === currentStepIndex) {
            step.status = 'processing';
            step.progress = ((progress % progressPerStep) / progressPerStep) * 100;
          } else {
            step.status = 'pending';
            step.progress = 0;
          }
        }
      });

      return updatedSteps;
    });
  }, [currentStatus, currentStep, progress]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const formatDuration = (duration?: number): string => {
    if (!duration) return '';
    const seconds = Math.floor(duration / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const renderStepDetails = (step: ProcessingStep) => {
    if (!showDetails) return null;

    return (
      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
        <p className="text-gray-600 dark:text-gray-400 mb-2">{step.description}</p>
        
        {step.progress > 0 && (
          <div className="mb-2">
            <StepProgress progress={step.progress} status={step.status} size="sm" />
          </div>
        )}

        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          {step.startTime && (
            <span>Started: {step.startTime.toLocaleTimeString()}</span>
          )}
          {step.duration && (
            <span>Duration: {formatDuration(step.duration)}</span>
          )}
        </div>

        {step.error && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-400 text-xs">
            {step.error}
          </div>
        )}
      </div>
    );
  };

  const renderVerticalStep = (step: ProcessingStep, index: number) => (
    <div key={step.id} className="flex">
      {/* Timeline line */}
      <div className="flex flex-col items-center mr-4">
        <StepIcon status={step.status} stepNumber={index + 1} />
        {index < steps.length - 1 && (
          <div className={`w-px h-12 mt-2 ${
            steps[index + 1].status === 'completed' || steps[index + 1].status === 'processing'
              ? 'bg-blue-300 dark:bg-blue-600'
              : 'bg-gray-200 dark:bg-gray-700'
          }`}></div>
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 pb-8">
        <button
          onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
          className="w-full text-left group"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {step.name}
            </h4>
            <div className="flex items-center space-x-2">
              {step.status === 'processing' && (
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {Math.round(step.progress)}%
                </span>
              )}
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  expandedStep === step.id ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </button>

        {expandedStep === step.id && renderStepDetails(step)}
      </div>
    </div>
  );

  const renderHorizontalStep = (step: ProcessingStep, index: number) => (
    <div key={step.id} className="flex flex-col items-center flex-1">
      <StepIcon status={step.status} stepNumber={index + 1} size="sm" />
      <div className="mt-2 text-center">
        <h4 className="text-xs font-medium text-gray-900 dark:text-white">
          {step.name}
        </h4>
        {step.status === 'processing' && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            {Math.round(step.progress)}%
          </span>
        )}
      </div>
      
      {/* Connecting line */}
      {index < steps.length - 1 && (
        <div className={`absolute top-4 left-1/2 w-full h-px ${
          steps[index + 1].status === 'completed' || steps[index + 1].status === 'processing'
            ? 'bg-blue-300 dark:bg-blue-600'
            : 'bg-gray-200 dark:bg-gray-700'
        }`} style={{ transform: 'translateX(50%)' }}></div>
      )}
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`processing-steps-visualization ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Processing Steps
        </h3>
        {connectionState.isConnected && (
          <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Live updates</span>
          </div>
        )}
      </div>

      {/* Steps visualization */}
      {orientation === 'vertical' ? (
        <div className="space-y-0">
          {steps.map((step, index) => renderVerticalStep(step, index))}
        </div>
      ) : (
        <div className="relative flex items-start space-x-4">
          {steps.map((step, index) => renderHorizontalStep(step, index))}
        </div>
      )}

      {/* Summary */}
      {showTimeline && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="text-gray-500 dark:text-gray-400">Completed</label>
              <p className="font-semibold text-green-600 dark:text-green-400">
                {steps.filter(s => s.status === 'completed').length}/{steps.length}
              </p>
            </div>
            <div>
              <label className="text-gray-500 dark:text-gray-400">Processing</label>
              <p className="font-semibold text-blue-600 dark:text-blue-400">
                {steps.filter(s => s.status === 'processing').length}
              </p>
            </div>
            <div>
              <label className="text-gray-500 dark:text-gray-400">Failed</label>
              <p className="font-semibold text-red-600 dark:text-red-400">
                {steps.filter(s => s.status === 'failed').length}
              </p>
            </div>
            <div>
              <label className="text-gray-500 dark:text-gray-400">Remaining</label>
              <p className="font-semibold text-gray-600 dark:text-gray-400">
                {steps.filter(s => s.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingStepsVisualization;
