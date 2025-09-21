/**
 * DownloadButton - Enhanced download functionality
 * Handles video downloads with format options and progress tracking
 */

import React, { useState, useRef } from 'react';
import { DownloadOptions } from '../types/api';

// ============================================================================
// INTERFACES
// ============================================================================

interface DownloadButtonProps {
  onDownload: (options: DownloadOptions) => Promise<void> | void;
  videoUrl: string;
  fileName?: string;
  disabled?: boolean;
  loading?: boolean;
  showOptions?: boolean;
  className?: string;
}

interface DownloadMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (options: DownloadOptions) => void;
  position: { x: number; y: number };
}

// ============================================================================
// DOWNLOAD MENU COMPONENT
// ============================================================================

const DownloadMenu: React.FC<DownloadMenuProps> = ({
  isOpen,
  onClose,
  onDownload,
  position,
}) => {
  if (!isOpen) return null;

  const formatOptions = [
    { value: 'mp4', label: 'MP4 (Recommended)', description: 'Best compatibility' },
    { value: 'mov', label: 'MOV', description: 'High quality' },
    { value: 'avi', label: 'AVI', description: 'Legacy format' },
  ] as const;

  const qualityOptions = [
    { value: 'original', label: 'Original', description: 'Full quality' },
    { value: 'high', label: 'High', description: '1080p' },
    { value: 'medium', label: 'Medium', description: '720p' },
    { value: 'low', label: 'Low', description: '480p' },
  ] as const;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Menu */}
      <div 
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 w-64"
        style={{ 
          left: Math.min(position.x, window.innerWidth - 280),
          top: Math.min(position.y, window.innerHeight - 300),
        }}
      >
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">
          Download Options
        </h3>

        {/* Format Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Format
          </label>
          <div className="space-y-1">
            {formatOptions.map((format) => (
              <button
                key={format.value}
                onClick={() => {
                  onDownload({ format: format.value });
                  onClose();
                }}
                className="w-full text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {format.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {format.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quality Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quality
          </label>
          <div className="space-y-1">
            {qualityOptions.map((quality) => (
              <button
                key={quality.value}
                onClick={() => {
                  onDownload({ quality: quality.value });
                  onClose();
                }}
                className="w-full text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {quality.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {quality.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Options */}
        <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
          <button
            onClick={() => {
              onDownload({ include_metadata: true });
              onClose();
            }}
            className="w-full text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="font-medium text-gray-900 dark:text-white">
              Include Metadata
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Download with technical information
            </div>
          </button>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  onDownload,
  videoUrl,
  fileName = 'video',
  disabled = false,
  loading = false,
  showOptions = true,
  className = '',
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleQuickDownload = async () => {
    if (loading || disabled) return;
    
    await onDownload({
      format: 'mp4',
      quality: 'original',
    });
  };

  const handleShowOptions = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPosition({
      x: rect.left,
      y: rect.bottom + 8,
    });
    setShowMenu(true);
  };

  const handleMenuDownload = async (options: DownloadOptions) => {
    await onDownload(options);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className={`flex items-center ${className}`}>
        {/* Main download button */}
        <button
          ref={buttonRef}
          onClick={handleQuickDownload}
          disabled={disabled || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-l-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-4-4m4 4l4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>Download</span>
        </button>

        {/* Options dropdown button */}
        {showOptions && (
          <button
            onClick={handleShowOptions}
            disabled={disabled || loading}
            className="px-2 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-l border-blue-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Download options menu */}
      <DownloadMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        onDownload={handleMenuDownload}
        position={menuPosition}
      />
    </>
  );
};

export default DownloadButton;
