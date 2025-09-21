import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Play, 
  Square, 
  Download, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useVideoStore } from '../stores/videoStore';
import { videoApiService } from '../services/api';
import { VideoCreateRequest, VIDEO_PRESETS, VideoPreset } from '../types/api';
import { VideoProcessingResponse, JobStatusResponse } from '../types/api';

import { FileUploader } from './FileUploader';
import { CanvasPreview } from './CanvasPreview';
import { ElementPanel } from './ElementPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { ResponsiveLayout } from './ResponsiveLayout';

// Form validation schemas
const projectSetupSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
  aspectRatio: z.enum(['16:9_HD', '16:9_FHD', '16:9_4K', '9:16_MOBILE', '9:16_FHD', '1:1_SQUARE', '4:3_STANDARD', '21:9_ULTRAWIDE', 'custom']),
  width: z.number().min(100, 'Width must be at least 100px').max(7680, 'Width too large'),
  height: z.number().min(100, 'Height must be at least 100px').max(4320, 'Height too large'),
  outputFormat: z.enum(['mp4', 'mov', 'avi']),
});

const videoExportSchema = z.object({
  outputFormat: z.enum(['mp4', 'mov', 'avi']),
});

type ProjectSetupForm = z.infer<typeof projectSetupSchema>;
type VideoExportForm = z.infer<typeof videoExportSchema>;

interface VideoCreatorProps {
  className?: string;
}

interface ExportStatus {
  isExporting: boolean;
  jobId?: string;
  progress?: string;
  status?: 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
}

export const VideoCreator: React.FC<VideoCreatorProps> = ({ className = '' }) => {
  const {
    currentProject,
    currentStep,
    isLoading,
    isExporting,
    createProject,
    updateProject,
    setCurrentStep,
    nextStep,
    prevStep,
    resetProject,
    setLoading,
    setExporting,
  } = useVideoStore();

  const [exportStatus, setExportStatus] = useState<ExportStatus>({
    isExporting: false,
  });

  // Form setup
  const setupForm = useForm<ProjectSetupForm>({
    resolver: zodResolver(projectSetupSchema),
    defaultValues: {
      name: '',
      aspectRatio: '16:9_FHD',
      width: VIDEO_PRESETS['16:9_FHD'].width,
      height: VIDEO_PRESETS['16:9_FHD'].height,
      outputFormat: 'mp4',
    },
  });

  const exportForm = useForm<VideoExportForm>({
    resolver: zodResolver(videoExportSchema),
    defaultValues: {
      outputFormat: 'mp4',
    },
  });

  // Watch aspect ratio changes
  const watchedAspectRatio = setupForm.watch('aspectRatio');
  useEffect(() => {
    if (watchedAspectRatio !== 'custom') {
      const dimensions = VIDEO_PRESETS[watchedAspectRatio as VideoPreset];
      if (dimensions) {
        setupForm.setValue('width', dimensions.width);
        setupForm.setValue('height', dimensions.height);
      }
    }
  }, [watchedAspectRatio, setupForm]);

  // Project setup handler
  const handleProjectSetup = (data: ProjectSetupForm) => {
    createProject(data.name, data.aspectRatio);
    if (currentProject) {
      updateProject({
        dimensions: {
          width: data.width,
          height: data.height,
          aspectRatio: data.aspectRatio !== 'custom' ? VIDEO_PRESETS[data.aspectRatio as VideoPreset]?.aspectRatio : undefined,
        },
        outputFormat: data.outputFormat,
      });
    }
  };

  // Video export handler
  const handleVideoExport = async (data: VideoExportForm) => {
    if (!currentProject || currentProject.elements.length === 0) {
      toast.error('No elements to export');
      return;
    }

    setExporting(true);
    setExportStatus({ isExporting: true });

    try {
      const request: VideoCreateRequest = {
        output_format: data.outputFormat,
        width: currentProject.dimensions.width,
        height: currentProject.dimensions.height,
        elements: currentProject.elements,
      };

      const response: VideoProcessingResponse = await videoApiService.createVideo(request);

      if (response.status === 'completed') {
        // Immediate response
        setExportStatus({
          isExporting: false,
          status: 'completed',
          resultUrl: response.result_url,
        });
        toast.success('Video exported successfully!');
      } else {
        // Async response - start polling
        setExportStatus({
          isExporting: true,
          jobId: response.job_id,
          status: 'processing',
        });
        startJobPolling(response.job_id);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Export failed';
      setExportStatus({
        isExporting: false,
        status: 'failed',
        error: errorMessage,
      });
      toast.error(`Export failed: ${errorMessage}`);
    } finally {
      setExporting(false);
    }
  };

  // Job polling for async exports
  const startJobPolling = (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const status: JobStatusResponse = await videoApiService.getJobStatus(jobId);
        
        setExportStatus(prev => ({
          ...prev,
          progress: status.progress,
          status: status.status,
        }));

        if (status.status === 'completed') {
          clearInterval(pollInterval);
          setExportStatus({
            isExporting: false,
            jobId,
            status: 'completed',
            resultUrl: status.result_url,
          });
          toast.success('Video exported successfully!');
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          setExportStatus({
            isExporting: false,
            jobId,
            status: 'failed',
            error: status.error || 'Export failed',
          });
          toast.error(`Export failed: ${status.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Continue polling on error, but log it
      }
    }, 2000); // Poll every 2 seconds

    // Cleanup after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (exportStatus.isExporting) {
        setExportStatus(prev => ({
          ...prev,
          isExporting: false,
          status: 'failed',
          error: 'Export timeout',
        }));
        toast.error('Export timed out');
      }
    }, 600000);
  };

  // Download result
  const handleDownload = () => {
    if (exportStatus.resultUrl) {
      const link = document.createElement('a');
      link.href = exportStatus.resultUrl;
      link.download = `${currentProject?.name || 'video'}.${exportForm.getValues('outputFormat')}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Reset export status
  const resetExportStatus = () => {
    setExportStatus({ isExporting: false });
  };

  // Step navigation validation
  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 'setup':
        return setupForm.formState.isValid;
      case 'elements':
        return currentProject && currentProject.elements.length > 0;
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'setup':
        return (
          <div className="max-w-2xl mx-auto p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Create New Video Project
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Set up your project dimensions and output format
              </p>
            </div>

            <form onSubmit={setupForm.handleSubmit(handleProjectSetup)} className="space-y-6">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Name
                </label>
                <input
                  {...setupForm.register('name')}
                  type="text"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter project name"
                />
                {setupForm.formState.errors.name && (
                  <p className="text-red-500 text-sm mt-1">
                    {setupForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Video Preset
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(VIDEO_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setupForm.setValue('aspectRatio', key as VideoPreset)}
                      className={`
                        p-3 border rounded-lg text-center transition-all
                        ${setupForm.watch('aspectRatio') === key
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }
                      `}
                    >
                      <div className="text-sm font-medium">{preset.aspectRatio || key}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {preset.width}×{preset.height}
                      </div>
                    </button>
                  ))}
                  <button
                    key="custom"
                    type="button"
                    onClick={() => setupForm.setValue('aspectRatio', 'custom')}
                    className={`
                      p-3 border rounded-lg text-center transition-all
                      ${setupForm.watch('aspectRatio') === 'custom'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }
                    `}
                  >
                    <div className="text-sm font-medium">Custom</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Custom Size
                    </div>
                  </button>
                </div>
              </div>

              {/* Custom Dimensions */}
              {watchedAspectRatio === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Width (px)
                    </label>
                    <input
                      {...setupForm.register('width', { valueAsNumber: true })}
                      type="number"
                      min="100"
                      max="7680"
                      className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Height (px)
                    </label>
                    <input
                      {...setupForm.register('height', { valueAsNumber: true })}
                      type="number"
                      min="100"
                      max="4320"
                      className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Output Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Output Format
                </label>
                <select
                  {...setupForm.register('outputFormat')}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  <option value="mp4">MP4 (Recommended)</option>
                  <option value="mov">MOV</option>
                  <option value="avi">AVI</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!setupForm.formState.isValid}
                className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Project
              </button>
            </form>
          </div>
        );

      case 'elements':
        return (
          <ResponsiveLayout
            leftPanel={
              <div className="space-y-4">
                <FileUploader />
                <ElementPanel />
              </div>
            }
            centerPanel={<CanvasPreview className="h-full" />}
            rightPanel={<PropertiesPanel />}
          />
        );

      case 'preview':
        return (
          <div className="h-full flex flex-col">
            {/* Preview Controls */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Preview & Export
              </h2>
              <div className="flex items-center space-x-2">
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  <Play className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  <Square className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Canvas */}
            <ResponsiveLayout
              centerPanel={<CanvasPreview className="h-full" />}
              rightPanel={<PropertiesPanel />}
            />
          </div>
        );

      case 'export':
        return (
          <div className="max-w-2xl mx-auto p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Export Video
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Configure export settings and generate your video
              </p>
            </div>

            <form onSubmit={exportForm.handleSubmit(handleVideoExport)} className="space-y-6">
              {/* Export Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Export Format
                </label>
                <select
                  {...exportForm.register('outputFormat')}
                  disabled={exportStatus.isExporting}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
                >
                  <option value="mp4">MP4 (Recommended)</option>
                  <option value="mov">MOV</option>
                  <option value="avi">AVI</option>
                </select>
              </div>

              {/* Project Summary */}
              {currentProject && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Project Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="font-medium">Dimensions:</span><br/>
                      {currentProject.dimensions.width} × {currentProject.dimensions.height}px
                    </div>
                    <div>
                      <span className="font-medium">Elements:</span><br/>
                      {currentProject.elements.length} items
                    </div>
                  </div>
                </div>
              )}

              {/* Export Status */}
              <AnimatePresence>
                {exportStatus.isExporting && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
                  >
                    <div className="flex items-center space-x-3">
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      <div>
                        <p className="text-blue-800 dark:text-blue-200 font-medium">
                          Exporting video...
                        </p>
                        {exportStatus.progress && (
                          <p className="text-blue-600 dark:text-blue-300 text-sm">
                            Progress: {exportStatus.progress}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {exportStatus.status === 'completed' && exportStatus.resultUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
                  >
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-green-800 dark:text-green-200 font-medium">
                          Video exported successfully!
                        </p>
                        <button
                          onClick={handleDownload}
                          className="mt-2 inline-flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download Video</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {exportStatus.status === 'failed' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
                  >
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="text-red-800 dark:text-red-200 font-medium">
                          Export failed
                        </p>
                        <p className="text-red-600 dark:text-red-300 text-sm mt-1">
                          {exportStatus.error}
                        </p>
                        <button
                          onClick={resetExportStatus}
                          className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Export Button */}
              <button
                type="submit"
                disabled={exportStatus.isExporting || !currentProject?.elements.length}
                className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {exportStatus.isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Export Video</span>
                  </>
                )}
              </button>
            </form>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`flex flex-col h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Video Creator
            </h1>
            {currentProject && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {currentProject.name}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Step Navigation */}
            {currentStep !== 'setup' && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={prevStep}
                  className="flex items-center space-x-1 px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                {currentStep !== 'export' && (
                  <button
                    onClick={() => setCurrentStep('export')}
                    disabled={!canProceedToNextStep()}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span>Export</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Reset Project */}
            {currentProject && (
              <button
                onClick={resetProject}
                className="px-3 py-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
              >
                Reset Project
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {renderStepContent()}
      </main>
    </div>
  );
};
