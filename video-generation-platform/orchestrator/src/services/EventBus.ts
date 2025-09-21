/**
 * Event Bus - Inter-Service Communication
 * Dynamic Video Content Generation Platform
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
  Event,
  EventHandler,
  EventSubscription,
  EventFilter,
  RetryPolicy
} from '../types';

export class EventBus extends EventEmitter {
  private logger: Logger;
  private redis?: any; // Using any instead of Redis type
  private localEmitter: EventEmitter;
  
  private subscriptions: Map<string, EventSubscription> = new Map();
  private handlers: Map<string, EventHandler> = new Map();
  private eventHistory: Event[] = [];
  private deadLetterQueue: Event[] = [];
  
  private isInitialized: boolean = false;
  private useRedis: boolean = false;
  private maxHistorySize: number = 1000;
  private maxRetries: number = 3;

  constructor(logger: Logger, redisConfig?: any) {
    super();
    this.logger = logger;
    this.localEmitter = new EventEmitter();
    this.localEmitter.setMaxListeners(100);
    
    // Initialize Redis if config provided
    if (redisConfig) {
      this.useRedis = true;
      // Redis initialization would be done here in production
      this.logger.info('Redis configuration provided but not initialized in this implementation');
    }
  }

  /**
   * Initialize the event bus
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Event Bus...');
      
      if (this.useRedis && this.redis) {
        // Test Redis connection
        await this.redis.ping();
        this.logger.info('Redis connection established for Event Bus');
      }
      
      // Setup error handlers
      this.setupErrorHandlers();
      
      this.isInitialized = true;
      this.logger.info('Event Bus initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Event Bus:', error);
      throw error;
    }
  }

  /**
   * Publish an event
   */
  async publish(event: Event): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Event Bus not initialized');
    }

    try {
      // Add to event history
      this.addToHistory(event);
      
      // Emit locally
      this.localEmitter.emit(event.type, event);
      this.localEmitter.emit('*', event); // Wildcard listeners
      
      // Publish to Redis if available
      if (this.useRedis && this.redis) {
        await this.redis.publish('events', JSON.stringify(event));
      }
      
      this.logger.debug(`Published event: ${event.type}`, {
        id: event.id,
        source: event.source,
        correlationId: event.correlationId
      });
      
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to events
   */
  subscribe(
    eventTypes: string | string[],
    handler: (event: Event) => Promise<void>,
    options: {
      filter?: EventFilter;
      priority?: number;
      retryPolicy?: RetryPolicy;
      deadLetterQueue?: boolean;
    } = {}
  ): string {
    const subscriptionId = uuidv4();
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    
    const eventHandler: EventHandler = {
      id: uuidv4(),
      eventTypes: types,
      handler,
      priority: options.priority || 0,
      retryPolicy: options.retryPolicy,
      deadLetterQueue: options.deadLetterQueue || false
    };
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventTypes: types,
      filter: options.filter,
      handler: eventHandler,
      status: 'active',
      createdAt: new Date()
    };
    
    // Store subscription and handler
    this.subscriptions.set(subscriptionId, subscription);
    this.handlers.set(eventHandler.id, eventHandler);
    
    // Setup local listeners
    for (const eventType of types) {
      this.localEmitter.on(eventType, async (event: Event) => {
        await this.handleEvent(subscription, event);
      });
    }
    
    this.logger.debug(`Created subscription ${subscriptionId} for events: ${types.join(', ')}`);
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.logger.warn(`Subscription ${subscriptionId} not found`);
      return;
    }
    
    // Remove listeners
    for (const eventType of subscription.eventTypes) {
      this.localEmitter.removeAllListeners(eventType);
    }
    
    // Remove from storage
    this.subscriptions.delete(subscriptionId);
    this.handlers.delete(subscription.handler.id);
    
    this.logger.debug(`Removed subscription ${subscriptionId}`);
  }

  /**
   * Handle incoming event
   */
  private async handleEvent(subscription: EventSubscription, event: Event): Promise<void> {
    try {
      // Check if subscription is active
      if (subscription.status !== 'active') {
        return;
      }
      
      // Apply filters
      if (subscription.filter && !this.matchesFilter(event, subscription.filter)) {
        return;
      }
      
      // Execute handler with retry logic
      await this.executeHandler(subscription.handler, event);
      
      // Update last processed time
      subscription.lastProcessed = new Date();
      
    } catch (error) {
      this.logger.error(`Error handling event ${event.type} for subscription ${subscription.id}:`, error);
      
      // Mark subscription as failed if too many errors
      subscription.status = 'failed';
    }
  }

  /**
   * Execute event handler with retry logic
   */
  private async executeHandler(handler: EventHandler, event: Event): Promise<void> {
    const maxRetries = handler.retryPolicy?.maxRetries || this.maxRetries;
    let attempt = 0;
    
    while (attempt <= maxRetries) {
      try {
        await handler.handler(event);
        return; // Success
        
      } catch (error) {
        attempt++;
        
        if (attempt > maxRetries) {
          this.logger.error(`Handler ${handler.id} failed after ${maxRetries} retries:`, error);
          
          // Add to dead letter queue if enabled
          if (handler.deadLetterQueue) {
            this.addToDeadLetterQueue(event, error as Error);
          }
          
          throw error;
        }
        
        // Calculate backoff delay
        const backoffMs = this.calculateBackoff(handler.retryPolicy, attempt);
        await this.sleep(backoffMs);
        
        this.logger.warn(`Retrying handler ${handler.id} (attempt ${attempt}/${maxRetries})`);
      }
    }
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: Event, filter: EventFilter): boolean {
    // Source filter
    if (filter.source && !filter.source.includes(event.source)) {
      return false;
    }
    
    // Time range filter
    if (filter.timeRange) {
      const eventTime = event.timestamp.getTime();
      
      if (filter.timeRange.start && eventTime < filter.timeRange.start.getTime()) {
        return false;
      }
      
      if (filter.timeRange.end && eventTime > filter.timeRange.end.getTime()) {
        return false;
      }
    }
    
    // Data filter (simple key-value matching)
    if (filter.data) {
      for (const [key, value] of Object.entries(filter.data)) {
        if (event.data[key] !== value) {
          return false;
        }
      }
    }
    
    // Metadata filter
    if (filter.metadata && event.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (event.metadata[key] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Calculate backoff delay for retries
   */
  private calculateBackoff(retryPolicy: RetryPolicy | undefined, attempt: number): number {
    if (!retryPolicy) {
      return 1000 * attempt; // Default: 1s, 2s, 3s...
    }
    
    let backoff = retryPolicy.backoffMs;
    
    if (retryPolicy.backoffMultiplier) {
      backoff *= Math.pow(retryPolicy.backoffMultiplier, attempt - 1);
    }
    
    if (retryPolicy.maxBackoffMs) {
      backoff = Math.min(backoff, retryPolicy.maxBackoffMs);
    }
    
    if (retryPolicy.jitter) {
      backoff += Math.random() * 1000;
    }
    
    return backoff;
  }

  /**
   * Add event to history
   */
  private addToHistory(event: Event): void {
    this.eventHistory.push(event);
    
    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Add event to dead letter queue
   */
  private addToDeadLetterQueue(event: Event, error: Error): void {
    const deadLetterEvent: Event = {
      ...event,
      id: uuidv4(),
      type: 'dead_letter',
      timestamp: new Date(),
      metadata: {
        ...event.metadata,
        originalType: event.type,
        error: error.message,
        failedAt: new Date().toISOString()
      }
    };
    
    this.deadLetterQueue.push(deadLetterEvent);
    
    this.logger.warn(`Added event to dead letter queue:`, {
      originalId: event.id,
      originalType: event.type,
      error: error.message
    });
  }

  /**
   * Setup Redis handlers
   */
  private setupRedisHandlers(): void {
    if (!this.redis) return;
    
    // Subscribe to Redis events
    const subscriber = this.redis.duplicate();
    subscriber.subscribe('events');
    
    subscriber.on('message', async (channel: string, message: string) => {
      if (channel === 'events') {
        try {
          const event: Event = JSON.parse(message);
          
          // Don't process our own events
          if (event.source === 'local') return;
          
          // Emit locally
          this.localEmitter.emit(event.type, event);
          this.localEmitter.emit('*', event);
          
        } catch (error) {
          this.logger.error('Error processing Redis event:', error);
        }
      }
    });
    
    // Handle Redis connection events
    this.redis.on('connect', () => {
      this.logger.info('Redis connected for Event Bus');
    });
    
    this.redis.on('error', (error) => {
      this.logger.error('Redis error in Event Bus:', error);
    });
    
    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed for Event Bus');
    });
  }

  /**
   * Setup error handlers
   */
  private setupErrorHandlers(): void {
    this.localEmitter.on('error', (error) => {
      this.logger.error('Local event emitter error:', error);
    });
    
    // Handle uncaught exceptions in event handlers
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception in event handler:', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection in event handler:', reason);
    });
  }

  /**
   * Get event history
   */
  getEventHistory(filter?: {
    eventType?: string;
    source?: string;
    since?: Date;
    limit?: number;
  }): Event[] {
    let events = [...this.eventHistory];
    
    if (filter) {
      if (filter.eventType) {
        events = events.filter(e => e.type === filter.eventType);
      }
      
      if (filter.source) {
        events = events.filter(e => e.source === filter.source);
      }
      
      if (filter.since) {
        events = events.filter(e => e.timestamp >= filter.since!);
      }
      
      if (filter.limit) {
        events = events.slice(-filter.limit);
      }
    }
    
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): Event[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Reprocess dead letter queue item
   */
  async reprocessDeadLetter(eventId: string): Promise<void> {
    const eventIndex = this.deadLetterQueue.findIndex(e => e.id === eventId);
    if (eventIndex === -1) {
      throw new Error(`Dead letter event ${eventId} not found`);
    }
    
    const deadLetterEvent = this.deadLetterQueue[eventIndex];
    
    // Recreate original event
    const originalEvent: Event = {
      id: uuidv4(),
      type: deadLetterEvent.metadata?.originalType || deadLetterEvent.type,
      source: deadLetterEvent.source,
      timestamp: new Date(),
      data: deadLetterEvent.data,
      metadata: deadLetterEvent.metadata,
      correlationId: deadLetterEvent.correlationId,
      causationId: deadLetterEvent.causationId
    };
    
    // Remove from dead letter queue
    this.deadLetterQueue.splice(eventIndex, 1);
    
    // Republish
    await this.publish(originalEvent);
    
    this.logger.info(`Reprocessed dead letter event ${eventId}`);
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): void {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    this.logger.info(`Cleared ${count} events from dead letter queue`);
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats(): any {
    const stats = {
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: 0,
      failedSubscriptions: 0,
      subscriptionsByType: new Map<string, number>()
    };
    
    for (const subscription of this.subscriptions.values()) {
      if (subscription.status === 'active') {
        stats.activeSubscriptions++;
      } else if (subscription.status === 'failed') {
        stats.failedSubscriptions++;
      }
      
      for (const eventType of subscription.eventTypes) {
        const count = stats.subscriptionsByType.get(eventType) || 0;
        stats.subscriptionsByType.set(eventType, count + 1);
      }
    }
    
    return {
      ...stats,
      subscriptionsByType: Object.fromEntries(stats.subscriptionsByType),
      eventHistorySize: this.eventHistory.length,
      deadLetterQueueSize: this.deadLetterQueue.length
    };
  }

  /**
   * Emit event synchronously (for internal use)
   */
  emitEvent(eventType: string, data: any): void {
    const event: Event = {
      id: uuidv4(),
      type: eventType,
      source: 'internal',
      timestamp: new Date(),
      data
    };
    
    this.localEmitter.emit(eventType, event);
  }

  /**
   * Wait for specific event
   */
  async waitForEvent(
    eventType: string, 
    timeout: number = 30000,
    filter?: (event: Event) => boolean
  ): Promise<Event> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.localEmitter.removeListener(eventType, eventListener);
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);
      
      const eventListener = (event: Event) => {
        if (!filter || filter(event)) {
          clearTimeout(timeoutId);
          this.localEmitter.removeListener(eventType, eventListener);
          resolve(event);
        }
      };
      
      this.localEmitter.on(eventType, eventListener);
    });
  }

  /**
   * Bulk publish events
   */
  async publishBatch(events: Event[]): Promise<void> {
    const promises = events.map(event => this.publish(event));
    await Promise.all(promises);
    
    this.logger.debug(`Published batch of ${events.length} events`);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown event bus
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Event Bus...');
    
    try {
      // Remove all listeners
      this.localEmitter.removeAllListeners();
      
      // Close Redis connection
      if (this.redis) {
        await this.redis.quit();
      }
      
      // Clear data structures
      this.subscriptions.clear();
      this.handlers.clear();
      this.eventHistory = [];
      this.deadLetterQueue = [];
      
      this.isInitialized = false;
      this.logger.info('Event Bus shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during event bus shutdown:', error);
      throw error;
    }
  }
}