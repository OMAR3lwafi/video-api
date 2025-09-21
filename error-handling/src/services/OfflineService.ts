/**
 * Offline Support Service
 * Dynamic Video Content Generation Platform
 *
 * Provides comprehensive offline support with error queue management,
 * sync capabilities, and graceful degradation when network is unavailable.
 */

import {
  AppError,
  OfflineErrorEntry,
  ErrorReport,
  ErrorContext,
  UserFeedback
} from '../types/ErrorTypes';

interface OfflineQueueItem {
  id: string;
  type: 'error' | 'feedback' | 'analytics';
  data: any;
  timestamp: Date;
  retryCount: number;
  nextRetryAt?: Date;
  synced: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  errors: string[];
}

interface OfflineServiceConfig {
  maxQueueSize: number;
  maxRetryAttempts: number;
  syncInterval: number;
  storageKey: string;
  apiEndpoint: string;
  enableCompression: boolean;
  enableEncryption: boolean;
}

export class OfflineService {
  private config: OfflineServiceConfig;
  private queue: OfflineQueueItem[] = [];
  private isOnline: boolean = true;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, Function[]> = new Map();

  constructor(config: Partial<OfflineServiceConfig> = {}) {
    this.config = {
      maxQueueSize: 1000,
      maxRetryAttempts: 5,
      syncInterval: 30000, // 30 seconds
      storageKey: 'offline_queue',
      apiEndpoint: '/api/sync',
      enableCompression: true,
      enableEncryption: false,
      ...config
    };

    this.initializeService();
  }

  /**
   * Initialize the offline service
   */
  private initializeService(): void {
    // Load persisted queue
    this.loadQueue();

    // Setup online/offline detection
    this.setupNetworkDetection();

    // Start sync process
    this.startSyncProcess();

    // Setup beforeunload handler to persist queue
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.persistQueue();
      });
    }
  }

  /**
   * Add error to offline queue
   */
  queueError(error: AppError, context?: ErrorContext): string {
    const item: OfflineQueueItem = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'error',
      data: {
        error,
        context,
        report: this.createErrorReport(error, context)
      },
      timestamp: new Date(),
      retryCount: 0,
      synced: false,
      priority: this.getErrorPriority(error)
    };

    this.addToQueue(item);
    this.emit('error:queued', item);

    return item.id;
  }

  /**
   * Add feedback to offline queue
   */
  queueFeedback(feedback: UserFeedback): string {
    const item: OfflineQueueItem = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'feedback',
      data: feedback,
      timestamp: new Date(),
      retryCount: 0,
      synced: false,
      priority: 'medium'
    };

    this.addToQueue(item);
    this.emit('feedback:queued', item);

    return item.id;
  }

  /**
   * Add analytics data to offline queue
   */
  queueAnalytics(event: string, data: any): string {
    const item: OfflineQueueItem = {
      id: `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'analytics',
      data: { event, data },
      timestamp: new Date(),
      retryCount: 0,
      synced: false,
      priority: 'low'
    };

    this.addToQueue(item);
    this.emit('analytics:queued', item);

    return item.id;
  }

  /**
   * Get offline status
   */
  isOffline(): boolean {
    return !this.isOnline;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    total: number;
    pending: number;
    failed: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    oldestItem?: Date;
    newestItem?: Date;
  } {
    const pending = this.queue.filter(item => !item.synced);
    const failed = this.queue.filter(item => item.retryCount >= this.config.maxRetryAttempts);

    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    this.queue.forEach(item => {
      byType[item.type] = (byType[item.type] || 0) + 1;
      byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
    });

    const timestamps = this.queue.map(item => item.timestamp);
    const oldestItem = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(d => d.getTime()))) : undefined;
    const newestItem = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(d => d.getTime()))) : undefined;

    return {
      total: this.queue.length,
      pending: pending.length,
      failed: failed.length,
      byType,
      byPriority,
      oldestItem,
      newestItem
    };
  }

  /**
   * Manual sync trigger
   */
  async syncNow(): Promise<SyncResult> {
    if (!this.isOnline) {
      return {
        success: false,
        syncedItems: 0,
        failedItems: 0,
        errors: ['Device is offline']
      };
    }

    return await this.performSync();
  }

  /**
   * Clear synced items from queue
   */
  clearSynced(): void {
    const beforeCount = this.queue.length;
    this.queue = this.queue.filter(item => !item.synced);
    const clearedCount = beforeCount - this.queue.length;

    this.persistQueue();
    this.emit('queue:cleared', { clearedCount });
  }

  /**
   * Clear entire queue (use with caution)
   */
  clearAll(): void {
    const clearedCount = this.queue.length;
    this.queue = [];
    this.persistQueue();
    this.emit('queue:cleared_all', { clearedCount });
  }

  /**
   * Get items by type
   */
  getItemsByType(type: string): OfflineQueueItem[] {
    return this.queue.filter(item => item.type === type);
  }

  /**
   * Get failed items
   */
  getFailedItems(): OfflineQueueItem[] {
    return this.queue.filter(item => item.retryCount >= this.config.maxRetryAttempts);
  }

  /**
   * Retry failed item
   */
  retryItem(itemId: string): boolean {
    const item = this.queue.find(i => i.id === itemId);
    if (!item) return false;

    item.retryCount = 0;
    item.nextRetryAt = undefined;
    this.persistQueue();
    this.emit('item:retry', item);

    return true;
  }

  /**
   * Remove item from queue
   */
  removeItem(itemId: string): boolean {
    const index = this.queue.findIndex(i => i.id === itemId);
    if (index === -1) return false;

    const item = this.queue.splice(index, 1)[0];
    this.persistQueue();
    this.emit('item:removed', item);

    return true;
  }

  /**
   * Event listener management
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Stop the service and cleanup
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.persistQueue();
    this.listeners.clear();

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }

  /**
   * Add item to queue with size management
   */
  private addToQueue(item: OfflineQueueItem): void {
    // Add item to queue
    this.queue.push(item);

    // Sort by priority and timestamp
    this.queue.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return a.timestamp.getTime() - b.timestamp.getTime();
    });

    // Manage queue size
    if (this.queue.length > this.config.maxQueueSize) {
      const removedItems = this.queue.splice(this.config.maxQueueSize);
      this.emit('queue:overflow', { removedCount: removedItems.length });
    }

    this.persistQueue();
  }

  /**
   * Create error report from error and context
   */
  private createErrorReport(error: AppError, context?: ErrorContext): ErrorReport {
    return {
      error,
      context: context || {},
      environment: {
        platform: typeof window !== 'undefined' ? 'browser' : 'node',
        version: process.env.npm_package_version || 'unknown',
        buildId: process.env.BUILD_ID,
        nodeVersion: process.version,
        browserName: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        browserVersion: typeof navigator !== 'undefined' ? navigator.appVersion : undefined,
        os: typeof navigator !== 'undefined' ? navigator.platform : process.platform
      },
      user: {
        id: error.userId
      },
      session: {
        id: error.sessionId || 'unknown',
        duration: Date.now() - (Date.parse(error.timestamp.toString()) || Date.now()),
        actionsCount: 1
      }
    };
  }

  /**
   * Get error priority based on severity
   */
  private getErrorPriority(error: AppError): 'low' | 'medium' | 'high' | 'urgent' {
    switch (error.severity) {
      case 'critical':
        return 'urgent';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Setup network detection
   */
  private setupNetworkDetection(): void {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;

      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    } else {
      // For Node.js environment, assume online
      this.isOnline = true;
    }
  }

  /**
   * Handle online event
   */
  private handleOnline = (): void => {
    this.isOnline = true;
    this.emit('network:online');

    // Trigger immediate sync when back online
    this.performSync().catch(error => {
      console.error('Sync failed after coming online:', error);
    });
  };

  /**
   * Handle offline event
   */
  private handleOffline = (): void => {
    this.isOnline = false;
    this.emit('network:offline');
  };

  /**
   * Start sync process
   */
  private startSyncProcess(): void {
    this.syncInterval = setInterval(async () => {
      if (this.isOnline) {
        try {
          await this.performSync();
        } catch (error) {
          console.error('Scheduled sync failed:', error);
        }
      }
    }, this.config.syncInterval);
  }

  /**
   * Perform sync operation
   */
  private async performSync(): Promise<SyncResult> {
    const pendingItems = this.queue.filter(item =>
      !item.synced &&
      item.retryCount < this.config.maxRetryAttempts &&
      (!item.nextRetryAt || item.nextRetryAt <= new Date())
    );

    if (pendingItems.length === 0) {
      return {
        success: true,
        syncedItems: 0,
        failedItems: 0,
        errors: []
      };
    }

    const result: SyncResult = {
      success: true,
      syncedItems: 0,
      failedItems: 0,
      errors: []
    };

    // Process items in batches
    const batchSize = 10;
    for (let i = 0; i < pendingItems.length; i += batchSize) {
      const batch = pendingItems.slice(i, i + batchSize);

      try {
        const batchResult = await this.syncBatch(batch);
        result.syncedItems += batchResult.synced;
        result.failedItems += batchResult.failed;
        result.errors.push(...batchResult.errors);
      } catch (error) {
        result.errors.push(`Batch sync failed: ${error}`);
        result.failedItems += batch.length;
      }
    }

    result.success = result.errors.length === 0;
    this.persistQueue();
    this.emit('sync:completed', result);

    return result;
  }

  /**
   * Sync batch of items
   */
  private async syncBatch(items: OfflineQueueItem[]): Promise<{
    synced: number;
    failed: number;
    errors: string[];
  }> {
    const payload = {
      items: items.map(item => ({
        id: item.id,
        type: item.type,
        data: item.data,
        timestamp: item.timestamp.toISOString(),
        priority: item.priority
      }))
    };

    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Offline-Sync': 'true'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Mark items as synced or failed based on response
      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      items.forEach(item => {
        const itemResult = result.results?.find((r: any) => r.id === item.id);

        if (itemResult?.success) {
          item.synced = true;
          item.retryCount = 0;
          synced++;
          this.emit('item:synced', item);
        } else {
          item.retryCount++;
          item.nextRetryAt = new Date(Date.now() + this.calculateRetryDelay(item.retryCount));
          failed++;
          errors.push(`Item ${item.id}: ${itemResult?.error || 'Unknown error'}`);
          this.emit('item:failed', item);
        }
      });

      return { synced, failed, errors };
    } catch (error) {
      // Mark all items in batch as failed
      items.forEach(item => {
        item.retryCount++;
        item.nextRetryAt = new Date(Date.now() + this.calculateRetryDelay(item.retryCount));
        this.emit('item:failed', item);
      });

      return {
        synced: 0,
        failed: items.length,
        errors: [`Batch sync failed: ${error}`]
      };
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 300000; // 5 minutes
    const backoffFactor = 2;

    const delay = Math.min(
      baseDelay * Math.pow(backoffFactor, attempt - 1),
      maxDelay
    );

    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }

  /**
   * Load queue from storage
   */
  private loadQueue(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.config.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.queue = parsed.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
            nextRetryAt: item.nextRetryAt ? new Date(item.nextRetryAt) : undefined
          }));

          this.emit('queue:loaded', { itemCount: this.queue.length });
        }
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  /**
   * Persist queue to storage
   */
  private persistQueue(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const serialized = JSON.stringify(this.queue);
        localStorage.setItem(this.config.storageKey, serialized);
      }
    } catch (error) {
      console.error('Failed to persist offline queue:', error);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

/**
 * Create default offline service instance
 */
export const createOfflineService = (config?: Partial<OfflineServiceConfig>): OfflineService => {
  return new OfflineService(config);
};

export default OfflineService;
