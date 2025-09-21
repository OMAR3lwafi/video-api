import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X, 
  Upload, 
  Layers, 
  Settings as SettingsIcon,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useResponsive, useIsTouchDevice } from '../hooks/useResponsive';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  leftPanel?: React.ReactNode;
  rightPanel?: React.ReactNode;
  centerPanel?: React.ReactNode;
  className?: string;
}

interface MobilePanelProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const MobilePanel: React.FC<MobilePanelProps> = ({ 
  title, 
  icon, 
  children, 
  isOpen, 
  onToggle 
}) => {
  return (
    <>
      {/* Panel Toggle Button */}
      <button
        onClick={onToggle}
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors
          ${isOpen 
            ? 'bg-blue-500 text-white' 
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
          }
        `}
      >
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </button>

      {/* Panel Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              className="fixed inset-0 bg-black/50 z-40"
            />
            
            {/* Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-900 shadow-xl z-50 overflow-y-auto"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  {icon}
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                  </h2>
                </div>
                <button
                  onClick={onToggle}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Panel Content */}
              <div className="flex-1">
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  leftPanel,
  rightPanel,
  centerPanel,
  className = '',
}) => {
  const { isMobile, isTablet } = useResponsive();
  const isTouch = useIsTouchDevice();
  
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mobile layout
  if (isMobile) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            {leftPanel && (
              <MobilePanel
                title="Tools"
                icon={<Upload className="w-4 h-4" />}
                isOpen={leftPanelOpen}
                onToggle={() => setLeftPanelOpen(!leftPanelOpen)}
              >
                {leftPanel}
              </MobilePanel>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {rightPanel && (
              <MobilePanel
                title="Properties"
                icon={<SettingsIcon className="w-4 h-4" />}
                isOpen={rightPanelOpen}
                onToggle={() => setRightPanelOpen(!rightPanelOpen)}
              >
                {rightPanel}
              </MobilePanel>
            )}
          </div>
        </div>

        {/* Mobile Main Content */}
        <div className="flex-1 overflow-hidden">
          {centerPanel || children}
        </div>
      </div>
    );
  }

  // Tablet layout
  if (isTablet) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        {/* Tablet Header */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            {leftPanel && (
              <button
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                className={`
                  flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors
                  ${leftPanelOpen 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <Layers className="w-4 h-4" />
                <span className="text-sm">Elements</span>
              </button>
            )}

            {rightPanel && (
              <button
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                className={`
                  flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors
                  ${rightPanelOpen 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="text-sm">Properties</span>
              </button>
            )}
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Tablet Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel */}
          <AnimatePresence>
            {leftPanelOpen && leftPanel && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {leftPanel}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Center Content */}
          <div className="flex-1 overflow-hidden">
            {centerPanel || children}
          </div>

          {/* Right Panel */}
          <AnimatePresence>
            {rightPanelOpen && rightPanel && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {rightPanel}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={`flex h-full ${className}`}>
      {/* Left Panel */}
      {leftPanel && (
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          {leftPanel}
        </div>
      )}

      {/* Center Content */}
      <div className="flex-1 overflow-hidden">
        {centerPanel || children}
      </div>

      {/* Right Panel */}
      {rightPanel && (
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          {rightPanel}
        </div>
      )}
    </div>
  );
};
