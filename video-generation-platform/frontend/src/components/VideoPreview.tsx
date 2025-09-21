/**
 * VideoPreview - Enhanced video player component
 * Handles video preview with loading states and error handling
 */

import React, { forwardRef, useState, useEffect } from 'react';

// ============================================================================
// INTERFACES
// ============================================================================

interface VideoPreviewProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  onLoad?: () => void;
  onError?: (error: Event) => void;
  showControls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  poster?: string;
  className?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const VideoPreview = forwardRef<HTMLVideoElement, VideoPreviewProps>(({
  src,
  onLoad,
  onError,
  showControls = true,
  autoPlay = false,
  muted = true,
  loop = false,
  poster,
  className = '',
  ...props
}, ref) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
    setLoadProgress(0);
  };

  const handleProgress = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const duration = video.duration;
      if (duration > 0) {
        setLoadProgress((bufferedEnd / duration) * 100);
      }
    }
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsLoading(false);
    setHasError(true);
    onError?.(e.nativeEvent);
  };

  const handleLoadedMetadata = () => {
    setIsLoading(false);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`relative ${className}`}>
      <video
        ref={ref}
        src={src}
        controls={showControls}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        poster={poster}
        onLoadStart={handleLoadStart}
        onProgress={handleProgress}
        onCanPlay={handleCanPlay}
        onError={handleError}
        onLoadedMetadata={handleLoadedMetadata}
        className="w-full h-full object-contain bg-black"
        {...props}
      />

      {/* Loading overlay */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm">Loading video...</p>
            {loadProgress > 0 && (
              <div className="mt-2 w-32 bg-gray-700 rounded-full h-1">
                <div 
                  className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${loadProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
          <div className="text-center text-white">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm">Failed to load video</p>
          </div>
        </div>
      )}
    </div>
  );
});

VideoPreview.displayName = 'VideoPreview';

export default VideoPreview;
