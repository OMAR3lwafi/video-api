/**
 * ShareButton - Social sharing functionality
 * Handles sharing videos across multiple platforms
 */

import React, { useState, useRef } from 'react';
import { ShareOptions } from '../types/api';

// ============================================================================
// INTERFACES
// ============================================================================

interface ShareButtonProps {
  onShare: (options: ShareOptions) => Promise<void> | void;
  videoUrl: string;
  title?: string;
  description?: string;
  hashtags?: string[];
  disabled?: boolean;
  className?: string;
}

interface ShareMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (options: ShareOptions) => void;
  videoUrl: string;
  title: string;
  description: string;
  hashtags?: string[];
  position: { x: number; y: number };
}

// ============================================================================
// SHARE PLATFORMS CONFIGURATION
// ============================================================================

const SHARE_PLATFORMS = [
  {
    id: 'copy_link' as const,
    name: 'Copy Link',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    color: 'bg-gray-600 hover:bg-gray-700',
    description: 'Copy video URL to clipboard',
  },
  {
    id: 'twitter' as const,
    name: 'Twitter',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
      </svg>
    ),
    color: 'bg-blue-500 hover:bg-blue-600',
    description: 'Share on Twitter',
  },
  {
    id: 'facebook' as const,
    name: 'Facebook',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    color: 'bg-blue-600 hover:bg-blue-700',
    description: 'Share on Facebook',
  },
  {
    id: 'linkedin' as const,
    name: 'LinkedIn',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    color: 'bg-blue-700 hover:bg-blue-800',
    description: 'Share on LinkedIn',
  },
  {
    id: 'email' as const,
    name: 'Email',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    color: 'bg-green-600 hover:bg-green-700',
    description: 'Share via email',
  },
];

// ============================================================================
// SHARE MENU COMPONENT
// ============================================================================

const ShareMenu: React.FC<ShareMenuProps> = ({
  isOpen,
  onClose,
  onShare,
  videoUrl,
  title,
  description,
  hashtags,
  position,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const handlePlatformShare = async (platform: ShareOptions['platform']) => {
    try {
      await onShare({
        platform,
        title,
        description,
        hashtags,
      });

      // Show copy success feedback for copy_link
      if (platform === 'copy_link') {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

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
          top: Math.min(position.y, window.innerHeight - 400),
        }}
      >
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">
          Share Video
        </h3>

        {/* Share platforms */}
        <div className="space-y-2">
          {SHARE_PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              onClick={() => handlePlatformShare(platform.id)}
              className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <div className={`p-2 rounded-lg text-white ${platform.color}`}>
                {platform.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {platform.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {platform.description}
                </div>
              </div>
              {platform.id === 'copy_link' && copySuccess && (
                <div className="text-green-600 dark:text-green-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Video URL display */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Video URL
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={videoUrl}
              readOnly
              className="flex-1 text-xs bg-transparent text-gray-600 dark:text-gray-400 truncate"
            />
            <button
              onClick={() => handlePlatformShare('copy_link')}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ShareButton: React.FC<ShareButtonProps> = ({
  onShare,
  videoUrl,
  title = 'Check out my video!',
  description = 'Created with Dynamic Video Content Generation Platform',
  hashtags = ['video', 'creative'],
  disabled = false,
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

  const handleShowMenu = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPosition({
      x: rect.left,
      y: rect.bottom + 8,
    });
    setShowMenu(true);
  };

  const handleMenuShare = async (options: ShareOptions) => {
    await onShare(options);
    setShowMenu(false);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleShowMenu}
        disabled={disabled}
        className={`px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 ${className}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
        </svg>
        <span>Share</span>
      </button>

      {/* Share menu */}
      <ShareMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        onShare={handleMenuShare}
        videoUrl={videoUrl}
        title={title}
        description={description}
        hashtags={hashtags}
        position={menuPosition}
      />
    </>
  );
};

export default ShareButton;
