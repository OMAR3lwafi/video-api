/**
 * RetryButton - Smart retry functionality with backoff logic
 * Handles retry attempts with visual feedback and intelligent delays
 */

import React, { useState, useEffect } from 'react';

// ============================================================================
// INTERFACES
// ============================================================================

interface RetryButtonProps {
  onRetry: () => void | Promise<void>;
  retryCount: number;
  maxRetries: number;
  disabled?: boolean;
  retryDelay?: number; // seconds
  showCountdown?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const RetryButton: React.FC<RetryButtonProps> = ({
  onRetry,
  retryCount,
  maxRetries,
  disabled = false,
  retryDelay = 0,
  showCountdown = true,
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState(retryDelay);
  const [canRetry, setCanRetry] = useState(retryDelay === 0);

  // ============================================================================
  // COUNTDOWN LOGIC
  // ============================================================================

  useEffect(() => {
    if (retryDelay > 0 && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => {
          const newCount = prev - 1;
          if (newCount <= 0) {
            setCanRetry(true);
          }
          return newCount;
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [countdown, retryDelay]);

  // Reset countdown when retryDelay changes
  useEffect(() => {
    if (retryDelay > 0) {
      setCountdown(retryDelay);
      setCanRetry(false);
    } else {
      setCanRetry(true);
    }
  }, [retryDelay]);

  // ============================================================================
  // RETRY LOGIC
  // ============================================================================

  const handleRetry = async () => {
    if (disabled || !canRetry || isRetrying || retryCount >= maxRetries) {
      return;
    }

    setIsRetrying(true);
    
    try {
      await onRetry();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  // ============================================================================
  // STYLE CONFIGURATIONS
  // ============================================================================

  const variantStyles = {
    primary: {
      base: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      disabled: 'bg-blue-300 text-blue-100 cursor-not-allowed',
    },
    secondary: {
      base: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
      disabled: 'bg-gray-300 text-gray-100 cursor-not-allowed',
    },
    danger: {
      base: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
      disabled: 'bg-red-300 text-red-100 cursor-not-allowed',
    },
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isDisabled = disabled || !canRetry || isRetrying || retryCount >= maxRetries;
  const styles = variantStyles[variant];
  const baseClasses = `
    inline-flex items-center justify-center space-x-2 rounded-lg font-medium 
    transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
    ${sizeStyles[size]}
    ${isDisabled ? styles.disabled : styles.base}
    ${className}
  `;

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderIcon = () => {
    if (isRetrying) {
      return (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
      );
    }

    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    );
  };

  const renderButtonText = () => {
    if (isRetrying) {
      return 'Retrying...';
    }

    if (countdown > 0 && showCountdown) {
      return `Retry in ${countdown}s`;
    }

    if (retryCount >= maxRetries) {
      return 'Max retries reached';
    }

    if (retryCount > 0) {
      return `Retry (${retryCount}/${maxRetries})`;
    }

    return 'Retry';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-col items-start space-y-2">
      <button
        onClick={handleRetry}
        disabled={isDisabled}
        className={baseClasses}
        title={
          retryCount >= maxRetries
            ? 'Maximum retry attempts reached'
            : countdown > 0
            ? `Wait ${countdown} seconds before retrying`
            : 'Retry the operation'
        }
      >
        {renderIcon()}
        <span>{renderButtonText()}</span>
      </button>

      {/* Retry progress indicator */}
      {maxRetries > 1 && (
        <div className="w-full max-w-xs">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Retry attempts</span>
            <span>{retryCount}/{maxRetries}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
            <div 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                retryCount >= maxRetries 
                  ? 'bg-red-500' 
                  : retryCount > 0 
                  ? 'bg-yellow-500' 
                  : 'bg-blue-500'
              }`}
              style={{ width: `${(retryCount / maxRetries) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Countdown progress bar */}
      {showCountdown && retryDelay > 0 && countdown > 0 && (
        <div className="w-full max-w-xs">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Retry available in</span>
            <span>{countdown}s</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${((retryDelay - countdown) / retryDelay) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Status message */}
      {retryCount > 0 && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {retryCount >= maxRetries
            ? 'All retry attempts have been exhausted. Please contact support if the issue persists.'
            : `Attempt ${retryCount} of ${maxRetries} failed. ${
                canRetry ? 'You can try again.' : `Please wait ${countdown} seconds.`
              }`
          }
        </p>
      )}
    </div>
  );
};

export default RetryButton;
