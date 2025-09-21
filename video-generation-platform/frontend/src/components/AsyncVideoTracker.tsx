/**
 * AsyncVideoTracker - Component for tracking long-running video processing jobs
 * Provides real-time status updates, progress tracking, and completion handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  AsyncResponse, 
  JobStatusResponse, 
  ImmediateResponse,
  ProcessingError,
} from '../types/api';
import { JobProgressIndicator } from './JobProgressIndicator';
import { ProcessingStepsVisualization } from './ProcessingStepsVisualization';
import { EstimatedTimeRemaining } from './EstimatedTimeRemaining';
import { ImmediateVideoResult } from './ImmediateVideoResult';

// ============================================================================
// INTERFACES
// ============================================================================

interface AsyncVideoTrackerProps {
  response: AsyncResponse;
  jobStatus?: JobStatusResponse | null;
  connectionState?: {
    isConnected: boolean;
    isConnecting: boolean;
    error?: string;
    lastUpdate?: string;
  };
  showProgress?: boolean;
  showSteps?: boolean;
  onComplete?: (result: ImmediateResponse) => void;
  onError?: (error: ProcessingError) => void;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

interface TabProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: { id: string; label: string; count?: number }[];
}

// ============================================================================
// TAB COMPONENT
// ============================================================================

const TabNavigation: React.FC<TabProps> = ({ activeTab, onTabChange, tabs }) => (
  <div className="border-b border-gray-200 dark:border-gray-700">
    <nav className="-mb-px flex space-x-8">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === tab.id
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs dark:bg-gray-800 dark:text-gray-400">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </nav>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AsyncVideoTracker: React.FC<AsyncVideoTrackerProps> = ({
  response,
  jobStatus,
  connectionState = { isConnected: false, isConnecting: false },
  showProgress = true,
  showSteps = true,
  onComplete,
  onError,
  onCancel,
  onRetry,
  className = '',
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [activeTab, setActiveTab] = useState<string>('progress');
  const [completedResult, setCompletedResult] = useState<ImmediateResponse | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [estimatedCompletion, setEstimatedCompletion] = useState<Date | null>(null);

  // ============================================================================
  // COMPLETION HANDLING
  // ============================================================================

  useEffect(() => {
    if (jobStatus?.status === 'completed' && jobStatus.result_url && !completedResult) {
      const result: ImmediateResponse = {
        status: 'completed',
        job_id: response.job_id,
        result_url: jobStatus.result_url,
        processing_time: jobStatus.processing_time || calculateProcessingTime(),
        file_size: jobStatus.file_size || 'N/A',
        message: jobStatus.message,
        duration: jobStatus.duration,
        metadata: jobStatus.metadata,
      };

      setCompletedResult(result);
      onComplete?.(result);
    }
  }, [jobStatus, response.job_id, completedResult, onComplete]);

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  useEffect(() => {
    if (jobStatus?.status === 'failed') {
      const error: ProcessingError = {
        type: 'processing',
        message: jobStatus.error || 'Video processing failed',
        details: jobStatus.message,
        recoverable: true,
        retry_after: 30,
        suggested_action: 'Try processing your video again, or contact support if the problem persists.',
      };
      onError?.(error);
    }
  }, [jobStatus, onError]);

  // ============================================================================
  // TIME CALCULATIONS
  // ============================================================================

  const calculateProcessingTime = useCallback(() => {
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }, [startTime]);

  const updateEstimatedCompletion = useCallback(() => {
    if (response.estimated_completion) {
      setEstimatedCompletion(new Date(response.estimated_completion));
    } else if (jobStatus?.estimated_time_remaining) {
      const remainingSeconds = parseInt(jobStatus.estimated_time_remaining);
      if (!isNaN(remainingSeconds)) {
        setEstimatedCompletion(new Date(Date.now() + remainingSeconds * 1000));
      }
    }
  }, [response.estimated_completion, jobStatus?.estimated_time_remaining]);

  useEffect(() => {
    updateEstimatedCompletion();
  }, [updateEstimatedCompletion]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getProgressPercentage = (): number => {
    if (jobStatus?.progress) {
      const progress = parseInt(jobStatus.progress);
      return isNaN(progress) ? 0 : Math.min(100, Math.max(0, progress));
    }
    return 0;
  };

  const getStatusIcon = () => {
    const status = jobStatus?.status || 'pending';
    
    switch (status) {
      case 'processing':
        return (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        );
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getStatusMessage = (): string => {
    if (jobStatus?.message) return jobStatus.message;
    
    switch (jobStatus?.status) {
      case 'pending':
        return 'Your video is queued for processing...';
      case 'processing':
        return jobStatus?.current_step 
          ? `Processing: ${jobStatus.current_step}...`
          : 'Processing your video...';
      case 'completed':
        return 'Video processing completed successfully!';
      case 'failed':
        return 'Video processing failed. Please try again.';
      default:
        return 'Initializing video processing...';
    }
  };

  // ============================================================================
  // TAB CONFIGURATION
  // ============================================================================

  const tabs = [
    { id: 'progress', label: 'Progress' },
    ...(showSteps ? [{ id: 'steps', label: 'Processing Steps' }] : []),
    { id: 'details', label: 'Job Details' },
  ];

  // ============================================================================
  // RENDER CONTENT BY TAB
  // ============================================================================

  const renderTabContent = () => {
    switch (activeTab) {
      case 'progress':
        return (
          <div className="space-y-6">
            {showProgress && (
              <JobProgressIndicator
                jobStatus={jobStatus}
                processingState={{
                  type: 'async',
                  status: jobStatus?.status === 'completed' ? 'completed' : 'processing',
                  response,
                  retryCount: 0,
                  maxRetries: 3,
                }}
                startTime={startTime}
              />
            )}

            {estimatedCompletion && jobStatus?.status === 'processing' && (
              <EstimatedTimeRemaining
                estimatedCompletion={estimatedCompletion}
                currentProgress={getProgressPercentage()}
              />
            )}

            {/* Current Operation */}
            {jobStatus?.current_step && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Current Operation
                </h4>
                <p className="text-blue-700 dark:text-blue-300">
                  {jobStatus.current_step}
                </p>
              </div>
            )}

            {/* Performance Metrics */}
            {jobStatus?.metadata?.performance_metrics && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Performance Metrics
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {jobStatus.metadata.performance_metrics.cpu_usage && (
                    <div>
                      <label className="text-sm text-gray-500 dark:text-gray-400">CPU Usage</label>
                      <p className="font-mono text-sm">
                        {jobStatus.metadata.performance_metrics.cpu_usage}%
                      </p>
                    </div>
                  )}
                  {jobStatus.metadata.performance_metrics.memory_usage && (
                    <div>
                      <label className="text-sm text-gray-500 dark:text-gray-400">Memory Usage</label>
                      <p className="font-mono text-sm">
                        {jobStatus.metadata.performance_metrics.memory_usage}%
                      </p>
                    </div>
                  )}
                  {jobStatus.metadata.performance_metrics.processing_speed && (
                    <div>
                      <label className="text-sm text-gray-500 dark:text-gray-400">Processing Speed</label>
                      <p className="font-mono text-sm">
                        {jobStatus.metadata.performance_metrics.processing_speed}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 'steps':
        return showSteps ? (
          <ProcessingStepsVisualization
            jobId={response.job_id}
            currentStatus={jobStatus?.status}
            currentStep={jobStatus?.current_step}
            progress={getProgressPercentage()}
          />
        ) : null;

      case 'details':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Job ID</label>
                <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                  {response.job_id}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                <div className="flex items-center space-x-2">
                  {getStatusIcon()}
                  <span className="text-sm capitalize">
                    {jobStatus?.status || 'pending'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Processing Time</label>
                <p className="font-mono text-sm text-gray-900 dark:text-white">
                  {jobStatus?.processing_time || calculateProcessingTime()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Progress</label>
                <p className="font-mono text-sm text-gray-900 dark:text-white">
                  {getProgressPercentage()}%
                </p>
              </div>
            </div>

            {/* Connection Status */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Connection Status
              </h4>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  connectionState.isConnected ? 'bg-green-500' :
                  connectionState.isConnecting ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {connectionState.isConnected ? 'Real-time updates active' :
                   connectionState.isConnecting ? 'Connecting to real-time updates...' :
                   'Using polling for status updates'}
                </span>
              </div>
              {connectionState.lastUpdate && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Last update: {new Date(connectionState.lastUpdate).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Show completed result if processing is done
  if (completedResult) {
    return (
      <ImmediateVideoResult
        response={completedResult}
        showPreview={true}
        showDownload={true}
        showSharing={true}
        className={className}
      />
    );
  }

  return (
    <div className={`async-video-tracker bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Processing Video
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {getStatusMessage()}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {jobStatus?.status === 'processing' && onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                Cancel
              </button>
            )}
            
            {jobStatus?.status === 'failed' && onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span>{getProgressPercentage()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={tabs}
      />

      {/* Tab Content */}
      <div className="p-6">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AsyncVideoTracker;
