/**
 * Loading States and Skeleton Screen Components
 * Dynamic Video Content Generation Platform
 *
 * Provides comprehensive loading states, skeleton screens, and loading
 * indicators for better user experience during async operations.
 */

import React, { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  className?: string;
}

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  children?: React.ReactNode;
  blur?: boolean;
  opacity?: number;
}

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rectangular' | 'circular';
  animation?: 'pulse' | 'wave' | 'none';
  className?: string;
}

interface ProgressBarProps {
  progress: number;
  total?: number;
  showPercentage?: boolean;
  showLabel?: boolean;
  label?: string;
  color?: 'primary' | 'success' | 'warning' | 'error';
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

/**
 * Loading Spinner Component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'primary',
  className = ''
}) => {
  const getSizeStyles = (): string => {
    switch (size) {
      case 'small':
        return 'w-4 h-4';
      case 'large':
        return 'w-12 h-12';
      case 'medium':
      default:
        return 'w-8 h-8';
    }
  };

  const getColorStyles = (): string => {
    switch (color) {
      case 'primary':
        return 'border-blue-600 border-t-transparent';
      case 'secondary':
        return 'border-gray-600 border-t-transparent';
      case 'white':
        return 'border-white border-t-transparent';
      case 'gray':
        return 'border-gray-300 border-t-transparent';
      default:
        return 'border-blue-600 border-t-transparent';
    }
  };

  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 ${getSizeStyles()} ${getColorStyles()} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

/**
 * Loading Overlay Component
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = 'Loading...',
  children,
  blur = true,
  opacity = 0.7
}) => {
  if (!visible) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {children && (
        <div className={blur ? 'filter blur-sm' : 'opacity-50'}>
          {children}
        </div>
      )}

      <div
        className="absolute inset-0 flex items-center justify-center z-10"
        style={{ backgroundColor: `rgba(255, 255, 255, ${opacity})` }}
      >
        <div className="flex flex-col items-center space-y-3 p-6 bg-white rounded-lg shadow-lg">
          <LoadingSpinner size="large" />
          {message && (
            <p className="text-gray-700 font-medium">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton Component
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  variant = 'text',
  animation = 'pulse',
  className = ''
}) => {
  const getVariantStyles = (): string => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded';
      case 'text':
      default:
        return 'rounded';
    }
  };

  const getAnimationStyles = (): string => {
    switch (animation) {
      case 'wave':
        return 'animate-wave';
      case 'pulse':
        return 'animate-pulse';
      case 'none':
      default:
        return '';
    }
  };

  const widthStyle = typeof width === 'number' ? `${width}px` : width;
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`bg-gray-200 ${getVariantStyles()} ${getAnimationStyles()} ${className}`}
      style={{ width: widthStyle, height: heightStyle }}
      role="status"
      aria-label="Loading content"
    />
  );
};

/**
 * Progress Bar Component
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  total = 100,
  showPercentage = true,
  showLabel = false,
  label,
  color = 'primary',
  size = 'medium',
  className = ''
}) => {
  const percentage = Math.min(100, Math.max(0, (progress / total) * 100));

  const getColorStyles = (): { bg: string; fill: string } => {
    switch (color) {
      case 'success':
        return { bg: 'bg-green-200', fill: 'bg-green-600' };
      case 'warning':
        return { bg: 'bg-yellow-200', fill: 'bg-yellow-600' };
      case 'error':
        return { bg: 'bg-red-200', fill: 'bg-red-600' };
      case 'primary':
      default:
        return { bg: 'bg-blue-200', fill: 'bg-blue-600' };
    }
  };

  const getSizeStyles = (): string => {
    switch (size) {
      case 'small':
        return 'h-2';
      case 'large':
        return 'h-6';
      case 'medium':
      default:
        return 'h-4';
    }
  };

  const colors = getColorStyles();

  return (
    <div className={`w-full ${className}`}>
      {(showLabel && label) && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm text-gray-500">{percentage.toFixed(0)}%</span>
          )}
        </div>
      )}

      <div className={`w-full ${colors.bg} rounded-full ${getSizeStyles()}`}>
        <div
          className={`${colors.fill} ${getSizeStyles()} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>

      {showPercentage && !(showLabel && label) && (
        <div className="text-center mt-2">
          <span className="text-sm text-gray-500">{percentage.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
};

/**
 * Video Card Skeleton
 */
export const VideoCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden">
    <Skeleton height="200px" variant="rectangular" />
    <div className="p-4 space-y-3">
      <Skeleton height="1.5rem" width="80%" />
      <Skeleton height="1rem" width="60%" />
      <div className="flex justify-between items-center">
        <Skeleton height="1rem" width="40%" />
        <Skeleton height="2rem" width="80px" variant="rectangular" />
      </div>
    </div>
  </div>
);

/**
 * Table Row Skeleton
 */
export const TableRowSkeleton: React.FC<{ columns: number }> = ({ columns }) => (
  <tr className="border-b">
    {Array.from({ length: columns }).map((_, index) => (
      <td key={index} className="px-6 py-4">
        <Skeleton height="1rem" width={index === 0 ? '60%' : '80%'} />
      </td>
    ))}
  </tr>
);

/**
 * User Profile Skeleton
 */
export const UserProfileSkeleton: React.FC = () => (
  <div className="flex items-center space-x-4">
    <Skeleton width={48} height={48} variant="circular" />
    <div className="space-y-2">
      <Skeleton height="1rem" width="120px" />
      <Skeleton height="0.875rem" width="80px" />
    </div>
  </div>
);

/**
 * Dashboard Card Skeleton
 */
export const DashboardCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center justify-between mb-4">
      <Skeleton height="1.5rem" width="120px" />
      <Skeleton width={24} height={24} variant="circular" />
    </div>
    <Skeleton height="2rem" width="80px" className="mb-2" />
    <Skeleton height="0.875rem" width="60%" />
  </div>
);

/**
 * Loading States Hook
 */
export const useLoadingStates = () => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setLoading = (key: string, loading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: loading
    }));
  };

  const isLoading = (key: string): boolean => {
    return loadingStates[key] || false;
  };

  const isAnyLoading = (): boolean => {
    return Object.values(loadingStates).some(loading => loading);
  };

  return {
    setLoading,
    isLoading,
    isAnyLoading,
    loadingStates
  };
};

/**
 * Async Loading Wrapper Component
 */
interface AsyncWrapperProps<T> {
  promise: Promise<T>;
  children: (data: T) => React.ReactNode;
  loading?: React.ReactNode;
  error?: (error: Error) => React.ReactNode;
  skeleton?: React.ReactNode;
  retry?: () => void;
}

export function AsyncWrapper<T>({
  promise,
  children,
  loading,
  error,
  skeleton,
  retry
}: AsyncWrapperProps<T>) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    setState({ data: null, loading: true, error: null });

    promise
      .then(data => {
        setState({ data, loading: false, error: null });
      })
      .catch(err => {
        setState({ data: null, loading: false, error: err });
      });
  }, [promise]);

  if (state.loading) {
    return (
      <>
        {skeleton || loading || (
          <div className="flex justify-center items-center p-8">
            <LoadingSpinner size="large" />
          </div>
        )}
      </>
    );
  }

  if (state.error) {
    if (error) {
      return <>{error(state.error)}</>;
    }

    return (
      <div className="text-center p-8">
        <div className="text-red-600 mb-4">
          <svg className="w-12 h-12 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-lg font-semibold">Failed to load content</p>
          <p className="text-sm text-gray-600 mt-1">{state.error.message}</p>
        </div>
        {retry && (
          <button
            onClick={retry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return <>{state.data ? children(state.data) : null}</>;
}

/**
 * Skeleton List Component
 */
interface SkeletonListProps {
  count: number;
  itemHeight?: number;
  spacing?: number;
  variant?: 'text' | 'card' | 'table';
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count,
  itemHeight = 60,
  spacing = 12,
  variant = 'text'
}) => {
  const renderSkeletonItem = (index: number) => {
    switch (variant) {
      case 'card':
        return <VideoCardSkeleton key={index} />;
      case 'table':
        return <TableRowSkeleton key={index} columns={4} />;
      case 'text':
      default:
        return (
          <div key={index} className="space-y-2">
            <Skeleton height="1.5rem" width="80%" />
            <Skeleton height="1rem" width="60%" />
          </div>
        );
    }
  };

  return (
    <div style={{ gap: `${spacing}px` }} className="flex flex-col">
      {Array.from({ length: count }, (_, index) => renderSkeletonItem(index))}
    </div>
  );
};

/**
 * Loading Button Component
 */
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  loadingText,
  children,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`relative ${className} ${
        loading || disabled ? 'opacity-75 cursor-not-allowed' : ''
      }`}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="small" color="white" />
        </div>
      )}

      <span className={loading ? 'invisible' : ''}>
        {loading && loadingText ? loadingText : children}
      </span>
    </button>
  );
};

/**
 * Delayed Skeleton Component
 * Only shows skeleton after a delay to prevent flashing
 */
interface DelayedSkeletonProps extends SkeletonProps {
  delay?: number;
  fallback?: React.ReactNode;
}

export const DelayedSkeleton: React.FC<DelayedSkeletonProps> = ({
  delay = 200,
  fallback = null,
  ...skeletonProps
}) => {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  if (!showSkeleton) {
    return <>{fallback}</>;
  }

  return <Skeleton {...skeletonProps} />;
};

// CSS for wave animation (add to your global styles)
const waveStyles = `
@keyframes wave {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-wave {
  position: relative;
  overflow: hidden;
}

.animate-wave::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  transform: translateX(-100%);
  animation: wave 1.5s infinite;
}
`;

// Inject wave animation styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('loading-wave-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'loading-wave-styles';
  styleSheet.textContent = waveStyles;
  document.head.appendChild(styleSheet);
}

export default {
  LoadingSpinner,
  LoadingOverlay,
  Skeleton,
  ProgressBar,
  VideoCardSkeleton,
  TableRowSkeleton,
  UserProfileSkeleton,
  DashboardCardSkeleton,
  AsyncWrapper,
  SkeletonList,
  LoadingButton,
  DelayedSkeleton,
  useLoadingStates
};
