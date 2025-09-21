/**
 * EstimatedTimeRemaining - Time estimation display component
 * Shows estimated completion time with visual progress indicators
 */

import React, { useState, useEffect } from 'react';

// ============================================================================
// INTERFACES
// ============================================================================

interface EstimatedTimeRemainingProps {
  estimatedCompletion: Date;
  currentProgress: number; // 0-100
  showProgressBar?: boolean;
  showCountdown?: boolean;
  updateInterval?: number; // milliseconds
  className?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatTimeRemaining = (milliseconds: number): string => {
  if (milliseconds <= 0) return 'Completing...';

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
};

const getTimeAccuracy = (milliseconds: number): 'high' | 'medium' | 'low' => {
  if (milliseconds < 60000) return 'high'; // < 1 minute
  if (milliseconds < 300000) return 'medium'; // < 5 minutes
  return 'low'; // > 5 minutes
};

const getProgressColor = (progress: number, timeRemaining: number): string => {
  if (timeRemaining < 30000) return 'bg-green-500'; // < 30 seconds
  if (progress > 80) return 'bg-blue-500';
  if (progress > 50) return 'bg-yellow-500';
  return 'bg-gray-500';
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const EstimatedTimeRemaining: React.FC<EstimatedTimeRemainingProps> = ({
  estimatedCompletion,
  currentProgress,
  showProgressBar = true,
  showCountdown = true,
  updateInterval = 1000,
  className = '',
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOverdue, setIsOverdue] = useState(false);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      setIsOverdue(now > estimatedCompletion);
    }, updateInterval);

    return () => clearInterval(interval);
  }, [estimatedCompletion, updateInterval]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const timeRemaining = Math.max(0, estimatedCompletion.getTime() - currentTime.getTime());
  const accuracy = getTimeAccuracy(timeRemaining);
  const progressColor = getProgressColor(currentProgress, timeRemaining);

  // Calculate progress-based time estimation
  const progressBasedRemaining = currentProgress > 0 
    ? ((100 - currentProgress) / currentProgress) * (Date.now() - (estimatedCompletion.getTime() - timeRemaining))
    : timeRemaining;

  // Use the more conservative estimate
  const displayTimeRemaining = Math.max(timeRemaining, progressBasedRemaining);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`estimated-time-remaining ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Estimated Time Remaining
          </h4>
          
          {/* Accuracy indicator */}
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${
              accuracy === 'high' ? 'bg-green-500' :
              accuracy === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {accuracy} accuracy
            </span>
          </div>
        </div>

        {/* Time display */}
        <div className="text-center mb-4">
          {isOverdue ? (
            <div className="text-orange-600 dark:text-orange-400">
              <div className="text-2xl font-bold mb-1">
                Overdue
              </div>
              <div className="text-sm">
                Expected completion: {estimatedCompletion.toLocaleTimeString()}
              </div>
            </div>
          ) : (
            <div className="text-gray-900 dark:text-white">
              <div className="text-2xl font-bold mb-1">
                {formatTimeRemaining(displayTimeRemaining)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Expected completion: {estimatedCompletion.toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {showProgressBar && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Progress</span>
              <span>{Math.round(currentProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${progressColor}`}
                style={{ width: `${currentProgress}%` }}
              >
                {/* Animated shimmer effect */}
                <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
              </div>
            </div>
          </div>
        )}

        {/* Countdown visualization */}
        {showCountdown && !isOverdue && timeRemaining > 0 && (
          <div className="grid grid-cols-4 gap-2 text-center">
            {/* Hours */}
            {Math.floor(timeRemaining / 3600000) > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {Math.floor(timeRemaining / 3600000)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  hours
                </div>
              </div>
            )}
            
            {/* Minutes */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {Math.floor((timeRemaining % 3600000) / 60000)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                minutes
              </div>
            </div>
            
            {/* Seconds */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {Math.floor((timeRemaining % 60000) / 1000)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                seconds
              </div>
            </div>

            {/* Progress indicator */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {Math.round(currentProgress)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                complete
              </div>
            </div>
          </div>
        )}

        {/* Status messages */}
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
          {isOverdue ? (
            <div className="text-orange-600 dark:text-orange-400">
              Processing is taking longer than expected. Your video will be ready soon.
            </div>
          ) : timeRemaining < 30000 ? (
            <div className="text-green-600 dark:text-green-400">
              Almost done! Final processing steps in progress.
            </div>
          ) : timeRemaining < 120000 ? (
            <div className="text-blue-600 dark:text-blue-400">
              Processing is progressing well. Please stay on this page.
            </div>
          ) : (
            <div>
              Estimated completion time based on current progress and system load.
            </div>
          )}
        </div>

        {/* Technical details */}
        {accuracy === 'low' && (
          <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-300">
            <strong>Note:</strong> Time estimates for longer processing jobs may be less accurate. 
            The system will provide more precise estimates as processing progresses.
          </div>
        )}
      </div>
    </div>
  );
};

export default EstimatedTimeRemaining;
