/**
 * ProcessingHandlerExample - Complete usage example
 * Demonstrates the dual response processing handler system
 */

import React, { useState } from 'react';
import {
  ProcessingHandler,
  ImmediateVideoResult,
  AsyncVideoTracker,
  JobProgressIndicator,
  ProcessingStepsVisualization,
  ErrorDisplay,
  RetryButton,
} from '../components';
import {
  VideoCreateRequest,
  ImmediateResponse,
  ProcessingError,
  ProcessingState,
} from '../types/api';

// ============================================================================
// EXAMPLE DATA
// ============================================================================

const exampleVideoRequest: VideoCreateRequest = {
  output_format: 'mp4',
  width: 1920,
  height: 1080,
  elements: [
    {
      id: 'element-1',
      type: 'video',
      source: 'https://example.com/background-video.mp4',
      track: 0,
      x: '0%',
      y: '0%',
      width: '100%',
      height: '100%',
      fit_mode: 'cover',
    },
    {
      id: 'element-2',
      type: 'image',
      source: 'https://example.com/overlay-image.png',
      track: 1,
      x: '10%',
      y: '10%',
      width: '30%',
      height: '30%',
      fit_mode: 'contain',
    },
  ],
};

// ============================================================================
// MAIN EXAMPLE COMPONENT
// ============================================================================

export const ProcessingHandlerExample: React.FC = () => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [activeExample, setActiveExample] = useState<string>('complete');
  const [processingState, setProcessingState] = useState<ProcessingState>({
    type: 'immediate',
    status: 'idle',
    retryCount: 0,
    maxRetries: 3,
  });

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleComplete = (result: ImmediateResponse) => {
    console.log('Video processing completed:', result);
    setProcessingState(prev => ({
      ...prev,
      status: 'completed',
      response: result,
    }));
  };

  const handleError = (error: ProcessingError) => {
    console.error('Processing failed:', error);
    setProcessingState(prev => ({
      ...prev,
      status: 'failed',
      error,
    }));
  };

  const handleCancel = () => {
    console.log('Processing cancelled');
    setProcessingState({
      type: 'immediate',
      status: 'idle',
      retryCount: 0,
      maxRetries: 3,
    });
  };

  const handleReset = () => {
    console.log('Processing reset');
    setProcessingState({
      type: 'immediate',
      status: 'idle',
      retryCount: 0,
      maxRetries: 3,
    });
  };

  // ============================================================================
  // EXAMPLE COMPONENTS
  // ============================================================================

  const renderCompleteExample = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Complete Processing Handler</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          This example shows the complete dual response processing handler with all features enabled.
        </p>
        
        <ProcessingHandler
          request={exampleVideoRequest}
          onComplete={handleComplete}
          onError={handleError}
          onCancel={handleCancel}
          onReset={handleReset}
          autoSubmit={false}
          showStepsVisualization={true}
          showProgressIndicator={true}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        />
      </div>
    </div>
  );

  const renderImmediateExample = () => {
    const mockImmediateResponse: ImmediateResponse = {
      status: 'completed',
      processing_time: '2.3s',
      result_url: 'https://example.com/videos/completed-video.mp4',
      job_id: 'job-12345',
      file_size: '15.2 MB',
      message: 'Video processing completed successfully!',
      duration: '30s',
      metadata: {
        width: 1920,
        height: 1080,
        format: 'MP4',
        codec: 'H.264',
        bitrate: '2.5 Mbps',
      },
    };

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-4">Immediate Video Result</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This example shows how completed videos are displayed with preview, download, and sharing options.
          </p>
          
          <ImmediateVideoResult
            response={mockImmediateResponse}
            showPreview={true}
            showDownload={true}
            showSharing={true}
            onReset={handleReset}
            className="border border-gray-200 dark:border-gray-700 rounded-lg"
          />
        </div>
      </div>
    );
  };

  const renderAsyncExample = () => {
    const mockAsyncResponse = {
      status: 'processing' as const,
      job_id: 'job-67890',
      message: 'Your video is being processed. This may take a few minutes.',
      estimated_completion: new Date(Date.now() + 180000).toISOString(), // 3 minutes from now
      status_check_endpoint: '/api/v1/videoresult/job-67890',
    };

    const mockJobStatus = {
      status: 'processing' as const,
      job_id: 'job-67890',
      progress: '45',
      current_step: 'Video Composition',
      message: 'Compositing video elements and effects...',
      estimated_time_remaining: '120',
      metadata: {
        steps_completed: 4,
        total_steps: 8,
        current_operation: 'Applying transitions',
        performance_metrics: {
          cpu_usage: 78,
          memory_usage: 65,
          processing_speed: '1.2x',
        },
      },
    };

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-4">Async Video Tracker</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This example shows how long-running video processing jobs are tracked with real-time updates.
          </p>
          
          <AsyncVideoTracker
            response={mockAsyncResponse}
            jobStatus={mockJobStatus}
            connectionState={{
              isConnected: true,
              isConnecting: false,
              lastUpdate: new Date().toISOString(),
            }}
            showProgress={true}
            showSteps={true}
            onComplete={handleComplete}
            onCancel={handleCancel}
            onRetry={() => console.log('Retry requested')}
            className="border border-gray-200 dark:border-gray-700 rounded-lg"
          />
        </div>
      </div>
    );
  };

  const renderProgressExample = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Progress Indicators</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Different variants of progress indicators for various use cases.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Circular Progress */}
          <div className="text-center">
            <h4 className="font-medium mb-3">Circular</h4>
            <JobProgressIndicator
              jobStatus={{
                status: 'processing',
                job_id: 'test-job',
                progress: '67',
                current_step: 'Encoding',
                message: 'Processing video...',
              }}
              processingState={{
                type: 'async',
                status: 'processing',
                retryCount: 0,
                maxRetries: 3,
              }}
              startTime={Date.now() - 45000}
              variant="circular"
              size="lg"
            />
          </div>

          {/* Linear Progress */}
          <div>
            <h4 className="font-medium mb-3">Linear</h4>
            <JobProgressIndicator
              jobStatus={{
                status: 'processing',
                job_id: 'test-job',
                progress: '67',
                current_step: 'Encoding',
                message: 'Processing video...',
              }}
              processingState={{
                type: 'async',
                status: 'processing',
                retryCount: 0,
                maxRetries: 3,
              }}
              startTime={Date.now() - 45000}
              variant="linear"
              size="md"
            />
          </div>

          {/* Detailed Progress */}
          <div>
            <h4 className="font-medium mb-3">Detailed</h4>
            <JobProgressIndicator
              jobStatus={{
                status: 'processing',
                job_id: 'test-job',
                progress: '67',
                current_step: 'Encoding video with optimal settings',
                message: 'Processing video...',
                metadata: {
                  steps_completed: 5,
                  total_steps: 8,
                },
              }}
              processingState={{
                type: 'async',
                status: 'processing',
                retryCount: 0,
                maxRetries: 3,
              }}
              startTime={Date.now() - 45000}
              variant="detailed"
              size="sm"
              showTimeEstimate={true}
              showMetrics={true}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepsExample = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Processing Steps Visualization</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Step-by-step visualization of the video processing pipeline.
        </p>
        
        <div className="space-y-6">
          {/* Vertical Layout */}
          <div>
            <h4 className="font-medium mb-3">Vertical Layout</h4>
            <ProcessingStepsVisualization
              jobId="example-job-vertical"
              currentStatus="processing"
              currentStep="video_composition"
              progress={60}
              orientation="vertical"
              showTimeline={true}
              showDetails={true}
              className="max-w-2xl"
            />
          </div>

          {/* Horizontal Layout */}
          <div>
            <h4 className="font-medium mb-3">Horizontal Layout</h4>
            <ProcessingStepsVisualization
              jobId="example-job-horizontal"
              currentStatus="processing"
              currentStep="encoding"
              progress={75}
              orientation="horizontal"
              showTimeline={false}
              showDetails={false}
              className="max-w-4xl"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderErrorExample = () => {
    const mockErrors: ProcessingError[] = [
      {
        type: 'validation',
        message: 'Invalid video dimensions. Width and height must be between 1 and 7680 pixels.',
        recoverable: false,
        suggested_action: 'Please check your video dimensions and try again.',
      },
      {
        type: 'processing',
        message: 'Video processing failed due to codec incompatibility.',
        details: 'The source video uses an unsupported codec (AV1). Please convert to H.264 or H.265.',
        recoverable: true,
        retry_after: 30,
        suggested_action: 'Convert your video to a supported format or try again with different settings.',
      },
      {
        type: 'timeout',
        message: 'Processing took too long and was cancelled.',
        recoverable: true,
        retry_after: 60,
        suggested_action: 'The system was busy. Please try again in a few minutes.',
      },
    ];

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-4">Error Handling</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Different types of errors and how they are displayed to users.
          </p>
          
          <div className="space-y-4">
            {mockErrors.map((error, index) => (
              <div key={index}>
                <h4 className="font-medium mb-2 capitalize">{error.type} Error</h4>
                <ErrorDisplay
                  error={error}
                  onDismiss={() => console.log('Error dismissed')}
                  onRetry={error.recoverable ? () => console.log('Retry requested') : undefined}
                  showDetails={true}
                />
              </div>
            ))}
          </div>

          {/* Retry Button Example */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-medium mb-3">Retry Button</h4>
            <div className="flex items-start space-x-4">
              <RetryButton
                onRetry={() => console.log('Retry attempt')}
                retryCount={2}
                maxRetries={3}
                retryDelay={10}
                showCountdown={true}
                variant="primary"
              />
              <RetryButton
                onRetry={() => console.log('Retry attempt')}
                retryCount={3}
                maxRetries={3}
                disabled={true}
                variant="danger"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Dual Response Processing Handler Examples
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive examples of the video processing components and their features.
        </p>
      </div>

      {/* Navigation */}
      <div className="mb-8">
        <nav className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'complete', label: 'Complete Handler' },
            { id: 'immediate', label: 'Immediate Result' },
            { id: 'async', label: 'Async Tracker' },
            { id: 'progress', label: 'Progress Indicators' },
            { id: 'steps', label: 'Processing Steps' },
            { id: 'errors', label: 'Error Handling' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveExample(tab.id)}
              className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
                activeExample === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="animate-fade-in">
        {activeExample === 'complete' && renderCompleteExample()}
        {activeExample === 'immediate' && renderImmediateExample()}
        {activeExample === 'async' && renderAsyncExample()}
        {activeExample === 'progress' && renderProgressExample()}
        {activeExample === 'steps' && renderStepsExample()}
        {activeExample === 'errors' && renderErrorExample()}
      </div>

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p className="mb-2">
            Dynamic Video Content Generation Platform - Dual Response Processing Handler System
          </p>
          <p className="text-sm">
            Built with React, TypeScript, Tailwind CSS, and Supabase real-time subscriptions
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProcessingHandlerExample;
