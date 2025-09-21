/**
 * ImmediateVideoResult - Component for displaying completed video processing results
 * Handles immediate responses with video preview, download, and sharing capabilities
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  ImmediateResponse, 
  ShareOptions, 
  DownloadOptions, 
  ShareableLink 
} from '../types/api';
import { DownloadButton } from './DownloadButton';
import { ShareButton } from './ShareButton';
import { VideoPreview } from './VideoPreview';

// ============================================================================
// INTERFACES
// ============================================================================

interface ImmediateVideoResultProps {
  response: ImmediateResponse;
  showPreview?: boolean;
  showDownload?: boolean;
  showSharing?: boolean;
  onReset?: () => void;
  className?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ImmediateVideoResult: React.FC<ImmediateVideoResultProps> = ({
  response,
  showPreview = true,
  showDownload = true,
  showSharing = true,
  onReset,
  className = '',
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  const [shareableLink, setShareableLink] = useState<ShareableLink | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // VIDEO HANDLING
  // ============================================================================

  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
    setVideoError(null);
  };

  const handleVideoError = (error: Event) => {
    console.error('Video load error:', error);
    setVideoError('Failed to load video. The file may be corrupted or in an unsupported format.');
    setIsVideoLoaded(false);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  // ============================================================================
  // DOWNLOAD HANDLING
  // ============================================================================

  const handleDownload = async (options: DownloadOptions = {}) => {
    setDownloadInProgress(true);
    
    try {
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = response.result_url;
      link.download = `video_${response.job_id}.${options.format || 'mp4'}`;
      
      // Add to DOM temporarily and click
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Track download analytics if needed
      console.log('Video download initiated:', {
        jobId: response.job_id,
        format: options.format,
        quality: options.quality,
      });

    } catch (error) {
      console.error('Download failed:', error);
      // Could show error toast here
    } finally {
      setDownloadInProgress(false);
    }
  };

  // ============================================================================
  // SHARING HANDLING
  // ============================================================================

  const handleShare = async (options: ShareOptions) => {
    try {
      const shareData = {
        title: options.title || 'Check out my video!',
        text: options.description || 'Created with Dynamic Video Content Generation Platform',
        url: response.result_url,
      };

      switch (options.platform) {
        case 'copy_link':
          await navigator.clipboard.writeText(response.result_url);
          // Could show success toast
          break;

        case 'twitter':
          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}${options.hashtags ? `&hashtags=${options.hashtags.join(',')}` : ''}`;
          window.open(twitterUrl, '_blank');
          break;

        case 'facebook':
          const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`;
          window.open(facebookUrl, '_blank');
          break;

        case 'linkedin':
          const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareData.url)}`;
          window.open(linkedinUrl, '_blank');
          break;

        case 'email':
          const emailUrl = `mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(`${shareData.text}\n\n${shareData.url}`)}`;
          window.location.href = emailUrl;
          break;

        default:
          // Try native Web Share API if available
          if (navigator.share) {
            await navigator.share(shareData);
          } else {
            // Fallback to clipboard
            await navigator.clipboard.writeText(response.result_url);
          }
      }

      // Track sharing analytics
      console.log('Video shared:', {
        jobId: response.job_id,
        platform: options.platform,
      });

    } catch (error) {
      console.error('Share failed:', error);
      // Could show error toast
    }
  };

  // ============================================================================
  // FULLSCREEN EVENT HANDLING
  // ============================================================================

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const formatFileSize = (sizeStr: string): string => {
    // Handle different size formats
    const size = parseFloat(sizeStr);
    if (isNaN(size)) return sizeStr;
    
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDuration = (duration?: string): string => {
    if (!duration || duration === 'N/A') return 'Unknown';
    
    // Handle different duration formats
    const seconds = parseFloat(duration);
    if (isNaN(seconds)) return duration;
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div 
      ref={containerRef}
      className={`immediate-video-result bg-white rounded-lg shadow-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''} ${className}`}
    >
      {/* Header */}
      <div className={`p-4 border-b border-gray-200 ${isFullscreen ? 'bg-black text-white' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Video Processing Complete!
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Processed in {response.processing_time}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {showPreview && (
              <button
                onClick={toggleFullscreen}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
            )}
            {onReset && (
              <button
                onClick={onReset}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Create another video"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video Preview */}
      {showPreview && (
        <div className={`relative ${isFullscreen ? 'flex-1 flex items-center justify-center' : 'aspect-video'}`}>
          {videoError ? (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">{videoError}</p>
                <button
                  onClick={() => {
                    setVideoError(null);
                    if (videoRef.current) {
                      videoRef.current.load();
                    }
                  }}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <VideoPreview
              ref={videoRef}
              src={response.result_url}
              onLoad={handleVideoLoad}
              onError={handleVideoError}
              controls
              className={`w-full h-full ${isFullscreen ? 'max-h-screen' : ''}`}
            />
          )}

          {/* Loading overlay */}
          {!isVideoLoaded && !videoError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading video...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Information */}
      <div className={`p-4 ${isFullscreen ? 'bg-black text-white' : 'bg-white'}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">File Size</label>
            <p className="text-sm font-mono text-gray-900 dark:text-white">
              {formatFileSize(response.file_size)}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration</label>
            <p className="text-sm font-mono text-gray-900 dark:text-white">
              {formatDuration(response.duration)}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Format</label>
            <p className="text-sm font-mono text-gray-900 dark:text-white">
              {response.metadata?.format || 'MP4'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Resolution</label>
            <p className="text-sm font-mono text-gray-900 dark:text-white">
              {response.metadata ? `${response.metadata.width}×${response.metadata.height}` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {showDownload && (
            <DownloadButton
              onDownload={handleDownload}
              disabled={downloadInProgress}
              loading={downloadInProgress}
              videoUrl={response.result_url}
              fileName={`video_${response.job_id}`}
            />
          )}

          {showSharing && (
            <ShareButton
              onShare={handleShare}
              videoUrl={response.result_url}
              title="Check out my video!"
              description="Created with Dynamic Video Content Generation Platform"
            />
          )}

          <button
            onClick={() => window.open(response.result_url, '_blank')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Open in New Tab</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImmediateVideoResult;
