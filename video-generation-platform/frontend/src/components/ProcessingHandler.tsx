/**
 * ProcessingHandler - Main component for managing dual response video processing
 * Handles both immediate video results and asynchronous job tracking
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  VideoCreateRequest, 
  VideoProcessingResponse, 
  ImmediateResponse, 
  AsyncResponse,
  ProcessingState,
  UIState,
  ProcessingError,
  JobStatusResponse,
} from '../types/api';
import { videoApiService } from '../services/api';
import { useRealtimeJobUpdates } from '../hooks/useSupabase';
import { ImmediateVideoResult } from './ImmediateVideoResult';
import { AsyncVideoTracker } from './AsyncVideoTracker';
import { ProcessingStepsVisualization } from './ProcessingStepsVisualization';
import { JobProgressIndicator } from './JobProgressIndicator';
import { ErrorDisplay } from './ErrorDisplay';
import { RetryButton } from './RetryButton';

// ============================================================================
// INTERFACES
// ============================================================================

interface ProcessingHandlerProps {
  request: VideoCreateRequest | null;
  onComplete?: (result: ImmediateResponse) => void;
  onError?: (error: ProcessingError) => void;
  onCancel?: () => void;
  onReset?: () => void;
  className?: string;
  showStepsVisualization?: boolean;
  showProgressIndicator?: boolean;
  autoSubmit?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProcessingHandler: React.FC<ProcessingHandlerProps> = ({
  request,
  onComplete,
  onError,
  onCancel,
  onReset,
  className = '',
  showStepsVisualization = true,
  showProgressIndicator = true,
  autoSubmit = false,
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [processingState, setProcessingState] = useState<ProcessingState>({
    type: 'immediate',
    status: 'idle',
    retryCount: 0,
    maxRetries: 3,
  });

  const [uiState, setUIState] = useState<UIState>({
    showProgress: true,
    showSteps: showStepsVisualization,
    showPreview: false,
    showSharing: false,
    showDownload: false,
    isFullscreen: false,
    activeTab: 'progress',
  });

  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const processingStartTime = useRef<number | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  const { connectionState, connect, disconnect, reconnect } = useRealtimeJobUpdates(
    processingState.response?.job_id || null,
    {
      onJobUpdate: (update) => {
        console.log('Real-time job update:', update);
        
        // Update job status from real-time data
        if (jobStatus?.job_id === update.job_id) {
          setJobStatus(prev => prev ? {
            ...prev,
            status: update.status,
            progress: update.progress?.toString(),
            message: update.message || prev.message,
          } : null);
        }

        // Handle completion
        if (update.status === 'completed' && processingState.type === 'async') {
          handleAsyncCompletion(update.job_id);
        }

        // Handle failure
        if (update.status === 'failed') {
          handleProcessingError({
            type: 'processing',
            message: update.message || 'Processing failed',
            recoverable: true,
            retry_after: 10,
          });
        }
      },
      onStepUpdate: (update) => {
        console.log('Real-time step update:', update);
        // Step updates handled by ProcessingStepsVisualization
      },
      onError: (error) => {
        console.error('Real-time connection error:', error);
        // Try to reconnect after a delay
        setTimeout(reconnect, 5000);
      },
      autoConnect: false, // We'll connect manually when needed
    }
  );

  // ============================================================================
  // PROCESSING LOGIC
  // ============================================================================

  const submitVideoRequest = useCallback(async () => {
    if (!request) return;

    setProcessingState(prev => ({
      ...prev,
      status: 'submitting',
      error: undefined,
    }));

    processingStartTime.current = Date.now();

    try {
      const response = await videoApiService.createVideo(request);
      
      setProcessingState(prev => ({
        ...prev,
        status: 'processing',
        response,
        type: response.status === 'completed' ? 'immediate' : 'async',
      }));

      if (response.status === 'completed') {
        // Immediate response - show result immediately
        handleImmediateResponse(response as ImmediateResponse);
      } else {
        // Async response - start tracking job
        handleAsyncResponse(response as AsyncResponse);
      }

    } catch (error) {
      console.error('Video submission failed:', error);
      const processingError = error as ProcessingError;
      handleProcessingError(processingError);
    }
  }, [request]);

  const handleImmediateResponse = useCallback((response: ImmediateResponse) => {
    setProcessingState(prev => ({
      ...prev,
      status: 'completed',
      response,
    }));

    setUIState(prev => ({
      ...prev,
      showPreview: true,
      showDownload: true,
      showSharing: true,
      activeTab: 'preview',
    }));

    onComplete?.(response);
  }, [onComplete]);

  const handleAsyncResponse = useCallback((response: AsyncResponse) => {
    // Connect to real-time updates
    connect();

    // Start polling as backup
    startPolling(response.job_id);

    setUIState(prev => ({
      ...prev,
      showProgress: true,
      showSteps: true,
      activeTab: 'progress',
    }));
  }, [connect]);

  const handleAsyncCompletion = useCallback(async (jobId: string) => {
    try {
      // Get final job status
      const finalStatus = await videoApiService.getJobStatus(jobId);
      
      if (finalStatus.status === 'completed' && finalStatus.result_url) {
        const immediateResponse: ImmediateResponse = {
          status: 'completed',
          job_id: jobId,
          result_url: finalStatus.result_url,
          processing_time: finalStatus.processing_time || 'N/A',
          file_size: finalStatus.file_size || 'N/A',
          message: finalStatus.message,
          duration: finalStatus.duration,
        };

        handleImmediateResponse(immediateResponse);
      }
    } catch (error) {
      console.error('Failed to get final job status:', error);
      handleProcessingError(error as ProcessingError);
    }
  }, [handleImmediateResponse]);

  const handleProcessingError = useCallback((error: ProcessingError) => {
    setProcessingState(prev => ({
      ...prev,
      status: 'failed',
      error,
    }));

    setUIState(prev => ({
      ...prev,
      showProgress: false,
      showSteps: false,
      activeTab: 'progress',
    }));

    // Disconnect real-time updates
    disconnect();

    // Clear polling
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    onError?.(error);
  }, [disconnect, onError]);

  // ============================================================================
  // POLLING LOGIC (BACKUP TO REAL-TIME)
  // ============================================================================

  const startPolling = useCallback((jobId: string) => {
    const poll = async () => {
      try {
        const status = await videoApiService.getJobStatus(jobId);
        setJobStatus(status);

        if (status.status === 'completed') {
          handleAsyncCompletion(jobId);
          return;
        }

        if (status.status === 'failed') {
          handleProcessingError({
            type: 'processing',
            message: status.error || 'Processing failed',
            recoverable: true,
            retry_after: 10,
          });
          return;
        }

        // Continue polling if still processing
        if (status.status === 'processing' || status.status === 'pending') {
          pollingTimeoutRef.current = setTimeout(poll, 3000);
        }

      } catch (error) {
        console.error('Polling error:', error);
        // Retry polling after a delay
        pollingTimeoutRef.current = setTimeout(poll, 5000);
      }
    };

    // Start polling
    poll();
  }, [handleAsyncCompletion, handleProcessingError]);

  // ============================================================================
  // CONTROL FUNCTIONS
  // ============================================================================

  const handleRetry = useCallback(() => {
    if (processingState.retryCount >= processingState.maxRetries) {
      return;
    }

    setProcessingState(prev => ({
      ...prev,
      status: 'idle',
      error: undefined,
      retryCount: prev.retryCount + 1,
    }));

    // Reset UI state
    setUIState({
      showProgress: true,
      showSteps: showStepsVisualization,
      showPreview: false,
      showSharing: false,
      showDownload: false,
      isFullscreen: false,
      activeTab: 'progress',
    });

    // Retry submission
    setTimeout(submitVideoRequest, 1000);
  }, [processingState.retryCount, processingState.maxRetries, showStepsVisualization, submitVideoRequest]);

  const handleCancel = useCallback(async () => {
    // Cancel job if it's async and still processing
    if (processingState.type === 'async' && 
        processingState.response?.job_id &&
        (processingState.status === 'processing' || processingState.status === 'submitting')) {
      try {
        await videoApiService.cancelJob(processingState.response.job_id);
      } catch (error) {
        console.error('Failed to cancel job:', error);
      }
    }

    // Disconnect and cleanup
    disconnect();
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    // Reset state
    setProcessingState({
      type: 'immediate',
      status: 'idle',
      retryCount: 0,
      maxRetries: 3,
    });

    onCancel?.();
  }, [processingState, disconnect, onCancel]);

  const handleReset = useCallback(() => {
    handleCancel().then(() => {
      setJobStatus(null);
      processingStartTime.current = null;
      onReset?.();
    });
  }, [handleCancel, onReset]);

  // ============================================================================
  // AUTO-SUBMIT EFFECT
  // ============================================================================

  useEffect(() => {
    if (autoSubmit && request && processingState.status === 'idle') {
      submitVideoRequest();
    }
  }, [autoSubmit, request, processingState.status, submitVideoRequest]);

  // ============================================================================
  // CLEANUP EFFECT
  // ============================================================================

  useEffect(() => {
    return () => {
      disconnect();
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, [disconnect]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const renderContent = () => {
    // Error state
    if (processingState.status === 'failed' && processingState.error) {
      return (
        <div className="space-y-4">
          <ErrorDisplay
            error={processingState.error}
            onDismiss={() => setProcessingState(prev => ({ ...prev, error: undefined }))}
          />
          {processingState.error.recoverable && (
            <RetryButton
              onRetry={handleRetry}
              retryCount={processingState.retryCount}
              maxRetries={processingState.maxRetries}
              disabled={processingState.retryCount >= processingState.maxRetries}
            />
          )}
        </div>
      );
    }

    // Immediate response completed
    if (processingState.status === 'completed' && processingState.type === 'immediate') {
      return (
        <ImmediateVideoResult
          response={processingState.response as ImmediateResponse}
          showPreview={uiState.showPreview}
          showDownload={uiState.showDownload}
          showSharing={uiState.showSharing}
          onReset={handleReset}
        />
      );
    }

    // Async processing
    if (processingState.type === 'async' && processingState.response) {
      return (
        <AsyncVideoTracker
          response={processingState.response as AsyncResponse}
          jobStatus={jobStatus}
          connectionState={connectionState}
          showProgress={uiState.showProgress}
          showSteps={uiState.showSteps}
          onComplete={(result) => handleImmediateResponse(result)}
          onCancel={handleCancel}
          onRetry={handleRetry}
        />
      );
    }

    // Submitting state
    if (processingState.status === 'submitting') {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Submitting your video request...</p>
        </div>
      );
    }

    // Idle state - show submit button if not auto-submit
    if (processingState.status === 'idle' && !autoSubmit) {
      return (
        <div className="text-center py-8">
          <button
            onClick={submitVideoRequest}
            disabled={!request}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Video
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`processing-handler ${className}`}>
      {/* Progress indicator */}
      {showProgressIndicator && (processingState.status === 'processing' || processingState.status === 'submitting') && (
        <JobProgressIndicator
          jobStatus={jobStatus}
          processingState={processingState}
          startTime={processingStartTime.current}
        />
      )}

      {/* Steps visualization */}
      {showStepsVisualization && processingState.type === 'async' && processingState.response && (
        <ProcessingStepsVisualization
          jobId={processingState.response.job_id}
          currentStatus={jobStatus?.status}
          currentStep={jobStatus?.current_step}
          progress={jobStatus?.progress ? parseInt(jobStatus.progress) : 0}
        />
      )}

      {/* Main content */}
      <div className="processing-content">
        {renderContent()}
      </div>

      {/* Connection status indicator */}
      {processingState.type === 'async' && (
        <div className="mt-4 text-sm text-gray-500 flex items-center justify-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${connectionState.isConnected ? 'bg-green-500' : connectionState.isConnecting ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
          <span>
            {connectionState.isConnected ? 'Real-time updates active' :
             connectionState.isConnecting ? 'Connecting...' :
             'Using polling for updates'}
          </span>
        </div>
      )}
    </div>
  );
};

export default ProcessingHandler;
