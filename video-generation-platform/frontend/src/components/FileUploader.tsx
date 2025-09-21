import React, { useCallback, useState, useRef } from 'react';
import { Upload, X, FileVideo, FileImage, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoStore } from '../stores/videoStore';
import { fileApi, handleApiError } from '../services/api';
import { UploadedFile } from '../types/video';

interface FileUploaderProps {
  className?: string;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  acceptedTypes?: string[];
  onFilesUploaded?: (files: UploadedFile[]) => void;
}

const DEFAULT_ACCEPTED_TYPES = [
  'video/mp4',
  'video/mov',
  'video/avi',
  'video/webm',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

export const FileUploader: React.FC<FileUploaderProps> = ({
  className = '',
  maxFiles = 10,
  maxFileSize = 100, // 100MB
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  onFilesUploaded,
}) => {
  const { uploadedFiles, addUploadedFile, updateUploadedFile, removeUploadedFile } = useVideoStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported`;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return `File size (${fileSizeMB.toFixed(1)}MB) exceeds limit of ${maxFileSize}MB`;
    }

    return null;
  }, [acceptedTypes, maxFileSize]);

  const getFileType = (file: File): 'video' | 'image' => {
    return file.type.startsWith('video/') ? 'video' : 'image';
  };

  const getFileDimensions = (file: File): Promise<{ width: number; height: number } | null> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(file);
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          resolve({ width: video.videoWidth, height: video.videoHeight });
        };
        video.onerror = () => resolve(null);
        video.src = URL.createObjectURL(file);
      } else {
        resolve(null);
      }
    });
  };

  const getVideoDuration = (file: File): Promise<number | null> => {
    if (!file.type.startsWith('video/')) return Promise.resolve(null);

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve(video.duration);
      };
      video.onerror = () => resolve(null);
      video.src = URL.createObjectURL(file);
    });
  };

  const uploadFile = async (file: File) => {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get file metadata
    const [dimensions, duration] = await Promise.all([
      getFileDimensions(file),
      getVideoDuration(file),
    ]);

    const uploadedFile: UploadedFile = {
      id: fileId,
      file,
      url: '', // Will be set after upload
      type: getFileType(file),
      name: file.name,
      size: file.size,
      dimensions: dimensions || undefined,
      duration: duration || undefined,
      uploadProgress: 0,
      uploadStatus: 'uploading',
    };

    // Add to store immediately
    addUploadedFile(uploadedFile);

    try {
      // Upload file
      const response = await fileApi.uploadFile(file, (progress) => {
        updateUploadedFile(fileId, { uploadProgress: progress });
      });

      // Update with server response
      updateUploadedFile(fileId, {
        url: response.url,
        uploadStatus: 'completed',
        uploadProgress: 100,
        dimensions: response.dimensions || uploadedFile.dimensions,
        duration: response.duration || uploadedFile.duration,
      });

      return uploadedFile;
    } catch (error) {
      const errorMessage = handleApiError(error);
      updateUploadedFile(fileId, {
        uploadStatus: 'error',
        uploadProgress: 0,
      });
      
      setErrors(prev => [...prev, `Failed to upload ${file.name}: ${errorMessage}`]);
      return null;
    }
  };

  const handleFiles = async (files: FileList) => {
    setErrors([]);
    
    const fileArray = Array.from(files);
    
    // Check total file limit
    if (uploadedFiles.length + fileArray.length > maxFiles) {
      setErrors([`Cannot upload more than ${maxFiles} files total`]);
      return;
    }

    // Validate files
    const validFiles: File[] = [];
    const newErrors: string[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        newErrors.push(error);
      } else {
        validFiles.push(file);
      }
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
    }

    // Upload valid files
    const uploadPromises = validFiles.map(uploadFile);
    const uploadedResults = await Promise.all(uploadPromises);
    const successfulUploads = uploadedResults.filter(Boolean) as UploadedFile[];

    if (onFilesUploaded && successfulUploads.length > 0) {
      onFilesUploaded(successfulUploads);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset input value to allow same file selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    removeUploadedFile(fileId);
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${uploadedFiles.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
          disabled={uploadedFiles.length >= maxFiles}
        />
        
        <motion.div
          animate={{ scale: isDragOver ? 1.05 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {isDragOver ? 'Drop files here' : 'Upload media files'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Drag & drop files here or click to browse
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Supports: MP4, MOV, AVI, WebM, JPEG, PNG, GIF, WebP
            <br />
            Max {maxFiles} files, {maxFileSize}MB each
          </p>
        </motion.div>
      </div>

      {/* Error Messages */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
          >
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                  Upload Errors
                </h4>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
                <button
                  onClick={clearErrors}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 mt-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Uploaded Files ({uploadedFiles.length}/{maxFiles})
          </h4>
          
          <div className="grid gap-2">
            <AnimatePresence>
              {uploadedFiles.map((file) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  {/* File Icon */}
                  <div className="flex-shrink-0 mr-3">
                    {file.type === 'video' ? (
                      <FileVideo className="w-8 h-8 text-blue-500" />
                    ) : (
                      <FileImage className="w-8 h-8 text-green-500" />
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center space-x-2">
                        {file.uploadStatus === 'completed' && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {file.uploadStatus === 'error' && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <button
                          onClick={() => removeFile(file.id)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>{formatFileSize(file.size)}</span>
                      {file.dimensions && (
                        <span>{file.dimensions.width}×{file.dimensions.height}</span>
                      )}
                      {file.duration && (
                        <span>{formatDuration(file.duration)}</span>
                      )}
                    </div>

                    {/* Upload Progress */}
                    {file.uploadStatus === 'uploading' && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Uploading...</span>
                          <span>{file.uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <motion.div
                            className="bg-blue-500 h-1.5 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${file.uploadProgress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {file.uploadStatus === 'error' && (
                      <p className="text-xs text-red-500 mt-1">
                        Upload failed. Please try again.
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};
