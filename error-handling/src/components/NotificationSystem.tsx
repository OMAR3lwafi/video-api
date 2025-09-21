/**
 * Notification System Component
 * Dynamic Video Content Generation Platform
 *
 * Provides comprehensive notification system with toast notifications,
 * modals, banners, and inline messages for error handling and user feedback.
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
  AppError,
  NotificationConfig,
  NotificationAction,
  ErrorSeverity
} from '../types/ErrorTypes';

interface Notification {
  id: string;
  error?: AppError;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  config: NotificationConfig;
  timestamp: Date;
  dismissed: boolean;
  actions?: NotificationAction[];
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'dismissed'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  showError: (error: AppError, config?: Partial<NotificationConfig>) => string;
  showSuccess: (message: string, config?: Partial<NotificationConfig>) => string;
  showWarning: (message: string, config?: Partial<NotificationConfig>) => string;
  showInfo: (message: string, config?: Partial<NotificationConfig>) => string;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

/**
 * Notification Provider Component
 */
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const generateId = (): string => {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const addNotification = useCallback((
    notification: Omit<Notification, 'id' | 'timestamp' | 'dismissed'>
  ): string => {
    const id = generateId();
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      dismissed: false
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-dismiss if duration is set
    if (notification.config.duration && notification.config.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.config.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const showError = useCallback((error: AppError, config: Partial<NotificationConfig> = {}) => {
    const defaultConfig: NotificationConfig = {
      type: 'toast',
      duration: getSeverityDuration(error.severity),
      dismissible: true,
      priority: getSeverityPriority(error.severity)
    };

    return addNotification({
      error,
      title: getErrorTitle(error.severity),
      message: error.userMessage,
      type: 'error',
      config: { ...defaultConfig, ...config }
    });
  }, [addNotification]);

  const showSuccess = useCallback((message: string, config: Partial<NotificationConfig> = {}) => {
    const defaultConfig: NotificationConfig = {
      type: 'toast',
      duration: 3000,
      dismissible: true,
      priority: 'medium'
    };

    return addNotification({
      title: 'Success',
      message,
      type: 'success',
      config: { ...defaultConfig, ...config }
    });
  }, [addNotification]);

  const showWarning = useCallback((message: string, config: Partial<NotificationConfig> = {}) => {
    const defaultConfig: NotificationConfig = {
      type: 'toast',
      duration: 5000,
      dismissible: true,
      priority: 'medium'
    };

    return addNotification({
      title: 'Warning',
      message,
      type: 'warning',
      config: { ...defaultConfig, ...config }
    });
  }, [addNotification]);

  const showInfo = useCallback((message: string, config: Partial<NotificationConfig> = {}) => {
    const defaultConfig: NotificationConfig = {
      type: 'toast',
      duration: 4000,
      dismissible: true,
      priority: 'low'
    };

    return addNotification({
      title: 'Information',
      message,
      type: 'info',
      config: { ...defaultConfig, ...config }
    });
  }, [addNotification]);

  const contextValue: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    showError,
    showSuccess,
    showWarning,
    showInfo
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationRenderer />
    </NotificationContext.Provider>
  );
};

/**
 * Hook to use notification system
 */
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

/**
 * Main notification renderer component
 */
const NotificationRenderer: React.FC = () => {
  const { notifications } = useNotifications();

  // Group notifications by type
  const toastNotifications = notifications.filter(n => n.config.type === 'toast');
  const modalNotifications = notifications.filter(n => n.config.type === 'modal');
  const bannerNotifications = notifications.filter(n => n.config.type === 'banner');

  return (
    <>
      {/* Toast Container */}
      <ToastContainer notifications={toastNotifications} />

      {/* Modal Container */}
      {modalNotifications.map(notification => (
        <ModalNotification key={notification.id} notification={notification} />
      ))}

      {/* Banner Container */}
      <BannerContainer notifications={bannerNotifications} />
    </>
  );
};

/**
 * Toast notification container
 */
const ToastContainer: React.FC<{ notifications: Notification[] }> = ({ notifications }) => {
  if (notifications.length === 0) return null;

  // Sort by priority and timestamp
  const sortedNotifications = notifications
    .sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.config.priority] || 2;
      const bPriority = priorityOrder[b.config.priority] || 2;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return b.timestamp.getTime() - a.timestamp.getTime();
    })
    .slice(0, 5); // Limit to 5 toasts

  const portalElement = document.getElementById('toast-root') || document.body;

  return createPortal(
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {sortedNotifications.map(notification => (
        <ToastNotification key={notification.id} notification={notification} />
      ))}
    </div>,
    portalElement
  );
};

/**
 * Individual toast notification component
 */
const ToastNotification: React.FC<{ notification: Notification }> = ({ notification }) => {
  const { removeNotification } = useNotifications();
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = useCallback(() => {
    if (!notification.config.dismissible) return;

    setIsExiting(true);
    setTimeout(() => {
      removeNotification(notification.id);
    }, 300);
  }, [notification.id, notification.config.dismissible, removeNotification]);

  const handleAction = useCallback((action: NotificationAction) => {
    if (action.callback) {
      action.callback();
    }
    handleDismiss();
  }, [handleDismiss]);

  const getToastStyles = (type: string): string => {
    const baseStyles = `relative p-4 rounded-lg shadow-lg border transition-all duration-300 transform ${
      isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`;

    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-50 border-green-200 text-green-800`;
      case 'error':
        return `${baseStyles} bg-red-50 border-red-200 text-red-800`;
      case 'warning':
        return `${baseStyles} bg-yellow-50 border-yellow-200 text-yellow-800`;
      case 'info':
        return `${baseStyles} bg-blue-50 border-blue-200 text-blue-800`;
      default:
        return `${baseStyles} bg-gray-50 border-gray-200 text-gray-800`;
    }
  };

  const getIcon = (type: string): string => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  return (
    <div className={getToastStyles(notification.type)}>
      {/* Progress bar for timed notifications */}
      {notification.config.duration && notification.config.duration > 0 && (
        <div className="absolute top-0 left-0 h-1 bg-current opacity-30 rounded-t-lg animate-progress"
             style={{
               animation: `progress ${notification.config.duration}ms linear forwards`,
               width: '100%'
             }} />
      )}

      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 text-xl">
          {getIcon(notification.type)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{notification.title}</h4>
              <p className="text-sm mt-1 break-words">{notification.message}</p>
            </div>

            {notification.config.dismissible && (
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 ml-2 p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors"
                aria-label="Dismiss notification"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="mt-3 flex space-x-2">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleAction(action)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    action.style === 'primary'
                      ? 'bg-current text-white bg-opacity-80 hover:bg-opacity-100'
                      : action.style === 'danger'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-white bg-opacity-70 hover:bg-opacity-90'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Modal notification component
 */
const ModalNotification: React.FC<{ notification: Notification }> = ({ notification }) => {
  const { removeNotification } = useNotifications();

  const handleDismiss = useCallback(() => {
    if (notification.config.dismissible) {
      removeNotification(notification.id);
    }
  }, [notification.id, notification.config.dismissible, removeNotification]);

  const handleAction = useCallback((action: NotificationAction) => {
    if (action.callback) {
      action.callback();
    }

    // Only dismiss if it's not the primary action or if explicitly allowed
    if (action.style !== 'primary' || notification.config.dismissible) {
      handleDismiss();
    }
  }, [handleDismiss, notification.config.dismissible]);

  const getModalStyles = (type: string): string => {
    const baseStyles = 'bg-white rounded-lg shadow-xl border-l-4 max-w-md w-full mx-4';

    switch (type) {
      case 'success':
        return `${baseStyles} border-green-500`;
      case 'error':
        return `${baseStyles} border-red-500`;
      case 'warning':
        return `${baseStyles} border-yellow-500`;
      case 'info':
        return `${baseStyles} border-blue-500`;
      default:
        return `${baseStyles} border-gray-500`;
    }
  };

  const portalElement = document.getElementById('modal-root') || document.body;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className={`relative ${getModalStyles(notification.type)} animate-modal-enter`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">
                {notification.type === 'success' && '✅'}
                {notification.type === 'error' && '❌'}
                {notification.type === 'warning' && '⚠️'}
                {notification.type === 'info' && 'ℹ️'}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {notification.title}
              </h3>
            </div>

            {notification.config.dismissible && (
              <button
                onClick={handleDismiss}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {/* Content */}
          <div className="text-gray-700 mb-6">
            <p>{notification.message}</p>

            {/* Error details for development */}
            {notification.error && process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Technical Details
                </summary>
                <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono max-h-32 overflow-auto">
                  <div><strong>Error ID:</strong> {notification.error.id}</div>
                  <div><strong>Type:</strong> {notification.error.type}</div>
                  <div><strong>Category:</strong> {notification.error.category}</div>
                  <div><strong>Message:</strong> {notification.error.message}</div>
                </div>
              </details>
            )}
          </div>

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex flex-wrap gap-3 justify-end">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleAction(action)}
                  className={`px-4 py-2 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    action.style === 'primary'
                      ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                      : action.style === 'danger'
                      ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    portalElement
  );
};

/**
 * Banner notification container
 */
const BannerContainer: React.FC<{ notifications: Notification[] }> = ({ notifications }) => {
  if (notifications.length === 0) return null;

  // Show only the most recent banner
  const latestBanner = notifications[0];
  const portalElement = document.getElementById('banner-root') || document.body;

  return createPortal(
    <BannerNotification notification={latestBanner} />,
    portalElement
  );
};

/**
 * Banner notification component
 */
const BannerNotification: React.FC<{ notification: Notification }> = ({ notification }) => {
  const { removeNotification } = useNotifications();

  const handleDismiss = useCallback(() => {
    if (notification.config.dismissible) {
      removeNotification(notification.id);
    }
  }, [notification.id, notification.config.dismissible, removeNotification]);

  const getBannerStyles = (type: string): string => {
    const baseStyles = 'border-l-4 p-4';

    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-50 border-green-400 text-green-800`;
      case 'error':
        return `${baseStyles} bg-red-50 border-red-400 text-red-800`;
      case 'warning':
        return `${baseStyles} bg-yellow-50 border-yellow-400 text-yellow-800`;
      case 'info':
        return `${baseStyles} bg-blue-50 border-blue-400 text-blue-800`;
      default:
        return `${baseStyles} bg-gray-50 border-gray-400 text-gray-800`;
    }
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-40 ${getBannerStyles(notification.type)}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-xl">
            {notification.type === 'success' && '✅'}
            {notification.type === 'error' && '❌'}
            {notification.type === 'warning' && '⚠️'}
            {notification.type === 'info' && 'ℹ️'}
          </div>
          <div>
            <h4 className="font-semibold">{notification.title}</h4>
            <p className="text-sm">{notification.message}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex space-x-2">
              {notification.actions.slice(0, 2).map((action, index) => (
                <button
                  key={index}
                  onClick={() => action.callback?.()}
                  className="px-3 py-1 text-xs font-medium rounded bg-white bg-opacity-70 hover:bg-opacity-90 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {notification.config.dismissible && (
            <button
              onClick={handleDismiss}
              className="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors"
              aria-label="Dismiss banner"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
const getSeverityDuration = (severity: ErrorSeverity): number => {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return 0; // Persistent
    case ErrorSeverity.HIGH:
      return 10000;
    case ErrorSeverity.MEDIUM:
      return 5000;
    case ErrorSeverity.LOW:
      return 3000;
    default:
      return 5000;
  }
};

const getSeverityPriority = (severity: ErrorSeverity): 'low' | 'medium' | 'high' | 'urgent' => {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return 'urgent';
    case ErrorSeverity.HIGH:
      return 'high';
    case ErrorSeverity.MEDIUM:
      return 'medium';
    case ErrorSeverity.LOW:
      return 'low';
    default:
      return 'medium';
  }
};

const getErrorTitle = (severity: ErrorSeverity): string => {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return 'Critical Error';
    case ErrorSeverity.HIGH:
      return 'Error';
    case ErrorSeverity.MEDIUM:
      return 'Warning';
    case ErrorSeverity.LOW:
      return 'Notice';
    default:
      return 'Error';
  }
};

// Add CSS animations to your stylesheet
const styles = `
@keyframes progress {
  from { width: 100%; }
  to { width: 0%; }
}

@keyframes modal-enter {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.animate-progress {
  animation: progress var(--duration) linear forwards;
}

.animate-modal-enter {
  animation: modal-enter 0.3s ease-out forwards;
}
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('notification-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'notification-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default NotificationProvider;
