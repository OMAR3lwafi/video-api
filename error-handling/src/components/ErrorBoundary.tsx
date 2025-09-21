/**
 * React Error Boundary Component
 * Dynamic Video Content Generation Platform
 *
 * Provides comprehensive error boundaries for React components with
 * graceful fallbacks, error reporting, and recovery mechanisms.
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import {
  AppError,
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  ErrorContext
} from '../types/ErrorTypes';
import { ErrorFactory } from '../core/ErrorFactory';
import { ErrorHandler } from '../core/ErrorHandler';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: AppError, retry: () => void) => ReactNode);
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  isolate?: boolean;
  level?: 'page' | 'component' | 'feature';
  context?: Partial<ErrorContext>;
  enableRecovery?: boolean;
  enableReporting?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorId: string | null;
  retryCount: number;
  isRecovering: boolean;
}

/**
 * Enhanced Error Boundary with comprehensive error handling
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorHandler: ErrorHandler | null = null;
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0,
      isRecovering: false
    };

    // Initialize error handler if needed
    if (props.enableReporting) {
      // In a real app, this would be injected via context or props
      // this.errorHandler = new ErrorHandler(defaultConfig);
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Convert error to AppError
    const appError = ErrorFactory.fromException(error, {
      component: 'ErrorBoundary',
      action: 'render'
    });

    return {
      hasError: true,
      error: appError,
      errorId: appError.id
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, enableReporting = true, context } = this.props;

    // Create comprehensive error with React-specific context
    const appError = ErrorFactory.fromException(error, {
      ...context,
      component: 'ErrorBoundary',
      action: 'componentDidCatch',
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundaryLevel: this.props.level || 'component',
        retryCount: this.state.retryCount
      }
    });

    // Update state with the created error
    this.setState({ error: appError, errorId: appError.id });

    // Handle error reporting
    if (enableReporting && this.errorHandler) {
      this.errorHandler.handleError(appError, {
        ...context,
        metadata: {
          ...context?.metadata,
          componentStack: errorInfo.componentStack,
          errorInfo
        }
      });
    }

    // Call custom error handler
    if (onError) {
      onError(appError, errorInfo);
    }

    // Log error for development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('App Error:', appError);
      console.groupEnd();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.children !== this.props.children) {
      if (resetOnPropsChange) {
        this.resetErrorBoundary();
      }
    }

    if (hasError && resetKeys) {
      const prevResetKeys = prevProps.resetKeys || [];
      const hasResetKeyChanged = resetKeys.some(
        (key, idx) => prevResetKeys[idx] !== key
      );

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  /**
   * Reset error boundary state
   */
  private resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0,
      isRecovering: false
    });
  };

  /**
   * Retry with exponential backoff
   */
  private handleRetry = (): void => {
    const { retryCount } = this.state;
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      return;
    }

    this.setState({
      isRecovering: true,
      retryCount: retryCount + 1
    });

    // Calculate delay with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);

    this.retryTimeoutId = setTimeout(() => {
      this.setState({ isRecovering: false });
      this.resetErrorBoundary();
    }, delay);
  };

  /**
   * Render error fallback UI
   */
  private renderErrorFallback(): ReactNode {
    const { fallback, level = 'component', enableRecovery = true } = this.props;
    const { error, retryCount, isRecovering } = this.state;

    if (!error) return null;

    // Use custom fallback if provided
    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback(error, this.handleRetry);
      }
      return fallback;
    }

    // Default fallback based on level
    return (
      <ErrorFallback
        error={error}
        level={level}
        onRetry={enableRecovery ? this.handleRetry : undefined}
        retryCount={retryCount}
        isRecovering={isRecovering}
        onReset={this.resetErrorBoundary}
      />
    );
  }

  render(): ReactNode {
    const { hasError } = this.state;
    const { children, isolate = false } = this.props;

    if (hasError) {
      const errorFallback = this.renderErrorFallback();

      // Isolate error to prevent cascading
      if (isolate) {
        return (
          <div className="error-boundary-isolate">
            {errorFallback}
          </div>
        );
      }

      return errorFallback;
    }

    return children;
  }
}

/**
 * Default Error Fallback Component
 */
interface ErrorFallbackProps {
  error: AppError;
  level: 'page' | 'component' | 'feature';
  onRetry?: () => void;
  onReset?: () => void;
  retryCount: number;
  isRecovering: boolean;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  level,
  onRetry,
  onReset,
  retryCount,
  isRecovering
}) => {
  const getIconForSeverity = (severity: ErrorSeverity): string => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return '🚨';
      case ErrorSeverity.HIGH:
        return '⚠️';
      case ErrorSeverity.MEDIUM:
        return '⚡';
      case ErrorSeverity.LOW:
        return 'ℹ️';
      default:
        return '❌';
    }
  };

  const getLevelStyles = (level: string): string => {
    const baseStyles = 'p-6 rounded-lg border text-center';
    switch (level) {
      case 'page':
        return `${baseStyles} min-h-screen flex flex-col items-center justify-center bg-gray-50 border-gray-200`;
      case 'feature':
        return `${baseStyles} min-h-64 bg-red-50 border-red-200`;
      case 'component':
      default:
        return `${baseStyles} bg-yellow-50 border-yellow-200`;
    }
  };

  const maxRetries = 3;
  const canRetry = onRetry && retryCount < maxRetries;

  return (
    <div className={getLevelStyles(level)}>
      <div className="text-4xl mb-4">
        {getIconForSeverity(error.severity)}
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        {level === 'page' ? 'Something went wrong' : 'Component Error'}
      </h2>

      <p className="text-gray-600 mb-4 max-w-md">
        {error.userMessage}
      </p>

      {process.env.NODE_ENV === 'development' && (
        <details className="mb-4 text-left max-w-2xl">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            Technical Details (Development Mode)
          </summary>
          <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-32">
            <div><strong>Type:</strong> {error.type}</div>
            <div><strong>Category:</strong> {error.category}</div>
            <div><strong>Message:</strong> {error.message}</div>
            <div><strong>ID:</strong> {error.id}</div>
            {error.stack && (
              <div className="mt-2">
                <strong>Stack:</strong>
                <pre className="whitespace-pre-wrap">{error.stack}</pre>
              </div>
            )}
          </div>
        </details>
      )}

      <div className="flex flex-wrap gap-3 justify-center">
        {canRetry && (
          <button
            onClick={onRetry}
            disabled={isRecovering}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              isRecovering
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
            }`}
          >
            {isRecovering ? (
              <>
                <span className="inline-block animate-spin mr-2">⟳</span>
                Retrying...
              </>
            ) : (
              `Retry${retryCount > 0 ? ` (${retryCount}/${maxRetries})` : ''}`
            )}
          </button>
        )}

        {level === 'page' && (
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 text-white rounded font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            Reload Page
          </button>
        )}

        {onReset && (
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            Reset
          </button>
        )}

        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.history.back();
            }
          }}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
        >
          Go Back
        </button>
      </div>

      {error.severity === ErrorSeverity.CRITICAL && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded text-sm text-red-800">
          <strong>Critical Error:</strong> This error has been automatically reported to our team.
          If the problem persists, please contact support with error ID: {error.id}
        </div>
      )}
    </div>
  );
};

/**
 * Higher-order component for adding error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Hook for imperative error boundary reset
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetBoundary = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    resetBoundary,
    captureError
  };
}

/**
 * Async Error Boundary for handling promise rejections
 */
export const AsyncErrorBoundary: React.FC<{
  children: ReactNode;
  onError?: (error: AppError) => void;
}> = ({ children, onError }) => {
  const { captureError } = useErrorBoundary();

  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = new Error(event.reason?.message || 'Unhandled Promise Rejection');
      const appError = ErrorFactory.fromException(error, {
        component: 'AsyncErrorBoundary',
        action: 'unhandledRejection',
        metadata: { reason: event.reason }
      });

      if (onError) {
        onError(appError);
      }

      captureError(error);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [captureError, onError]);

  return <>{children}</>;
};

export default ErrorBoundary;
