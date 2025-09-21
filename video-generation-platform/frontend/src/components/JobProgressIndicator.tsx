/**
 * JobProgressIndicator - Visual progress display component
 * Shows processing progress with animations and detailed metrics
 */

import React, { useState, useEffect, useMemo } from 'react';
import { JobStatusResponse, ProcessingState } from '../types/api';

// ============================================================================
// INTERFACES
// ============================================================================

interface JobProgressIndicatorProps {
  jobStatus?: JobStatusResponse | null;
  processingState?: ProcessingState;
  startTime?: number | null;
  showTimeEstimate?: boolean;
  showMetrics?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'circular' | 'linear' | 'detailed';
  className?: string;
}

interface ProgressMetrics {
  elapsedTime: number;
  estimatedTotal: number;
  remainingTime: number;
  processingSpeed: number; // percentage per second
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

const calculateMetrics = (
  progress: number,
  startTime: number | null
): ProgressMetrics => {
  const now = Date.now();
  const elapsedTime = startTime ? (now - startTime) / 1000 : 0;
  
  let estimatedTotal = 0;
  let remainingTime = 0;
  let processingSpeed = 0;

  if (progress > 0 && elapsedTime > 0) {
    processingSpeed = progress / elapsedTime;
    estimatedTotal = 100 / processingSpeed;
    remainingTime = Math.max(0, estimatedTotal - elapsedTime);
  }

  return {
    elapsedTime,
    estimatedTotal,
    remainingTime,
    processingSpeed,
  };
};

// ============================================================================
// CIRCULAR PROGRESS COMPONENT
// ============================================================================

interface CircularProgressProps {
  progress: number;
  size: number;
  strokeWidth: number;
  className?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size,
  strokeWidth,
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={`relative ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="text-blue-600 transition-all duration-300 ease-in-out"
          strokeLinecap="round"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// LINEAR PROGRESS COMPONENT
// ============================================================================

interface LinearProgressProps {
  progress: number;
  height?: number;
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

const LinearProgress: React.FC<LinearProgressProps> = ({
  progress,
  height = 8,
  showLabel = true,
  animated = true,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div 
        className="w-full bg-gray-200 rounded-full dark:bg-gray-700 overflow-hidden"
        style={{ height }}
      >
        <div
          className={`bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300 ${
            animated ? 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-size-200 animate-gradient' : ''
          }`}
          style={{ width: `${progress}%` }}
        >
          {animated && (
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const JobProgressIndicator: React.FC<JobProgressIndicatorProps> = ({
  jobStatus,
  processingState,
  startTime,
  showTimeEstimate = true,
  showMetrics = true,
  size = 'md',
  variant = 'detailed',
  className = '',
}) => {
  // ============================================================================
  // STATE & EFFECTS
  // ============================================================================

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const progress = useMemo(() => {
    if (jobStatus?.progress) {
      const p = parseInt(jobStatus.progress);
      return isNaN(p) ? 0 : Math.min(100, Math.max(0, p));
    }
    
    // Fallback progress estimation based on status
    switch (processingState?.status) {
      case 'submitting':
        return 5;
      case 'processing':
        return jobStatus?.current_step ? 25 : 10;
      case 'completed':
        return 100;
      default:
        return 0;
    }
  }, [jobStatus?.progress, jobStatus?.current_step, processingState?.status]);

  const metrics = useMemo(() => 
    calculateMetrics(progress, startTime), 
    [progress, startTime, currentTime]
  );

  const status = jobStatus?.status || processingState?.status || 'idle';

  // ============================================================================
  // SIZE CONFIGURATIONS
  // ============================================================================

  const sizeConfig = {
    sm: {
      circular: { size: 40, strokeWidth: 3 },
      linear: { height: 4 },
      text: 'text-xs',
    },
    md: {
      circular: { size: 60, strokeWidth: 4 },
      linear: { height: 6 },
      text: 'text-sm',
    },
    lg: {
      circular: { size: 80, strokeWidth: 6 },
      linear: { height: 8 },
      text: 'text-base',
    },
  };

  const config = sizeConfig[size];

  // ============================================================================
  // RENDER VARIANTS
  // ============================================================================

  const renderCircular = () => (
    <div className={`flex items-center justify-center ${className}`}>
      <CircularProgress
        progress={progress}
        size={config.circular.size}
        strokeWidth={config.circular.strokeWidth}
      />
    </div>
  );

  const renderLinear = () => (
    <div className={className}>
      <LinearProgress
        progress={progress}
        height={config.linear.height}
        showLabel={size !== 'sm'}
        animated={status === 'processing'}
      />
    </div>
  );

  const renderDetailed = () => (
    <div className={`space-y-4 ${className}`}>
      {/* Main Progress Bar */}
      <LinearProgress
        progress={progress}
        height={config.linear.height}
        showLabel={true}
        animated={status === 'processing'}
      />

      {/* Status and Current Step */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {status === 'processing' && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
          <span className={`${config.text} text-gray-600 dark:text-gray-400 capitalize`}>
            {status === 'processing' && jobStatus?.current_step 
              ? jobStatus.current_step 
              : status}
          </span>
        </div>
        
        {showTimeEstimate && metrics.elapsedTime > 0 && (
          <span className={`${config.text} text-gray-500 dark:text-gray-500`}>
            {formatTime(metrics.elapsedTime)} elapsed
          </span>
        )}
      </div>

      {/* Detailed Metrics */}
      {showMetrics && metrics.elapsedTime > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Elapsed</label>
            <p className={`${config.text} font-mono text-gray-900 dark:text-white`}>
              {formatTime(metrics.elapsedTime)}
            </p>
          </div>
          
          {metrics.remainingTime > 0 && progress < 100 && (
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Remaining</label>
              <p className={`${config.text} font-mono text-gray-900 dark:text-white`}>
                ~{formatTime(metrics.remainingTime)}
              </p>
            </div>
          )}
          
          {metrics.processingSpeed > 0 && (
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Speed</label>
              <p className={`${config.text} font-mono text-gray-900 dark:text-white`}>
                {metrics.processingSpeed.toFixed(1)}%/s
              </p>
            </div>
          )}
          
          {jobStatus?.metadata?.steps_completed && jobStatus?.metadata?.total_steps && (
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Steps</label>
              <p className={`${config.text} font-mono text-gray-900 dark:text-white`}>
                {jobStatus.metadata.steps_completed}/{jobStatus.metadata.total_steps}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {jobStatus?.message && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <p className={`${config.text} text-blue-700 dark:text-blue-300`}>
            {jobStatus.message}
          </p>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  switch (variant) {
    case 'circular':
      return renderCircular();
    case 'linear':
      return renderLinear();
    case 'detailed':
      return renderDetailed();
    default:
      return renderDetailed();
  }
};

export default JobProgressIndicator;
