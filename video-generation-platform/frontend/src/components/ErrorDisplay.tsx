/**
 * ErrorDisplay - Comprehensive error display component
 * Shows processing errors with actionable feedback
 */

import React, { useState } from 'react';
import { ProcessingError } from '../types/api';

// ============================================================================
// INTERFACES
// ============================================================================

interface ErrorDisplayProps {
  error: ProcessingError;
  onDismiss?: () => void;
  onRetry?: () => void;
  showDetails?: boolean;
  className?: string;
}

// ============================================================================
// ERROR TYPE CONFIGURATIONS
// ============================================================================

const ERROR_CONFIGS = {
  validation: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    title: 'Validation Error',
  },
  processing: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    title: 'Processing Error',
  },
  storage: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    title: 'Storage Error',
  },
  timeout: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    title: 'Timeout Error',
  },
  resource: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    title: 'Resource Error',
  },
  network: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
    title: 'Network Error',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onDismiss,
  onRetry,
  showDetails = true,
  className = '',
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [isExpanded, setIsExpanded] = useState(false);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const config = ERROR_CONFIGS[error.type] || ERROR_CONFIGS.processing;

  const formatRetryTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor} ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className={`flex-shrink-0 ${config.color}`}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-medium ${config.color}`}>
              {config.title}
            </h3>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {error.message}
            </p>
            
            {/* Suggested action */}
            {error.suggested_action && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                <strong>Suggestion:</strong> {error.suggested_action}
              </p>
            )}

            {/* Retry information */}
            {error.recoverable && error.retry_after && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                <strong>Retry in:</strong> {formatRetryTime(error.retry_after)}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          {showDetails && error.details && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`text-sm ${config.color} hover:opacity-75 transition-opacity`}
            >
              {isExpanded ? 'Hide' : 'Details'}
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && error.details && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Technical Details
          </h4>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {typeof error.details === 'string' ? error.details : JSON.stringify(error.details, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(error.recoverable || onRetry) && (
        <div className="mt-4 flex items-center space-x-3">
          {error.recoverable && onRetry && (
            <button
              onClick={onRetry}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                error.type === 'validation' 
                  ? 'bg-yellow-600 hover:bg-yellow-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Try Again
            </button>
          )}

          {/* Recovery status indicator */}
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <div className={`w-2 h-2 rounded-full ${
              error.recoverable ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span>
              {error.recoverable ? 'Recoverable error' : 'Manual intervention required'}
            </span>
          </div>
        </div>
      )}

      {/* Error type badge */}
      <div className="mt-3 flex items-center justify-between">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
          {error.type.charAt(0).toUpperCase() + error.type.slice(1)} Error
        </span>
        
        {/* Timestamp */}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

export default ErrorDisplay;
