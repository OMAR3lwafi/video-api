import { EventEmitter } from 'events';
import {
  OrchestratorEvent,
  EventType,
  OrchestratorError
} from '../types/index.js';
import { Logger } from '../utils/Logger.js';
import { ConfigurationManager } from './ConfigurationManager.js';

export class EventBus extends EventEmitter {
  private logger: Logger;
  private configManager: ConfigurationManager;
  private eventHistory: Map<string, OrchestratorEvent[]>;
  private eventHandlers: Map<EventType, EventHandler[]>;
  private eventMiddleware: EventMiddleware[];
  private isInitialized: boolean = false;
  private maxHistorySize: number = 1000;
  private deadLetterQueue: OrchestratorEvent[] = [];

  constructor() {
    super();
    this.logger = new Logger('EventBus');
    this.configManager = ConfigurationManager.getInstance();
    this.eventHistory = new Map();
    this.eventHandlers = new Map();
    this.eventMiddleware = [];

    // Increase max listeners to handle many components
    this.setMaxListeners(100);
  }

  /**
   * Initialize the event bus
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Event Bus...');

      // Set up error handling
      this.setupErrorHandling();

      // Initialize event tracking
      this.initializeEventTracking();

      this.isInitialized = true;
      this.logger.info('Event Bus initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Event Bus:', error);
      throw error;
    }
  }

  /**
   * Emit an orchestrator event
   */
  public emitEvent(event: OrchestratorEvent): void {
    if (!this.isInitialized) {
      throw new OrchestratorError('Event Bus not initialized', 'NOT_INITIALIZED');
    }

    try {
      // Validate event
      this.validateEvent(event);

      // Apply middleware
      const processedEvent = this.applyMiddleware(event);

      // Store in history
      this.storeEventInHistory(processedEvent);

      // Emit the event
      super.emit(processedEvent.type, processedEvent);

      // Emit generic event for listeners
      super.emit('event', processedEvent);

      this.logger.debug(`Event emitted: ${processedEvent.type} (${processedEvent.id})`);

    } catch (error) {
      this.logger.error(`Failed to emit event ${event.type}:`, error);
      this.handleEventError(event, error);
    }
  }

  /**
   * Subscribe to specific event type
   */
  public subscribe(eventType: EventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    this.eventHandlers.get(eventType)!.push(handler);

    // Also register with EventEmitter
    this.on(eventType, (event: OrchestratorEvent) => {
      this.executeHandler(handler, event);
    });

    this.logger.debug(`Handler subscribed to event type: ${eventType}`);
  }

  /**
   * Unsubscribe from event type
   */
  public unsubscribe(eventType: EventType, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
        this.logger.debug(`Handler unsubscribed from event type: ${eventType}`);
      }
    }

    // Remove from EventEmitter
    this.removeListener(eventType, handler as any);
  }

  /**
   * Subscribe to all events
   */
  public subscribeAll(handler: EventHandler): void {
    this.on('event', (event: OrchestratorEvent) => {
      this.executeHandler(handler, event);
    });

    this.logger.debug('Handler subscribed to all events');
  }

  /**
   * Add middleware for event processing
   */
  public addMiddleware(middleware: EventMiddleware): void {
    this.eventMiddleware.push(middleware);
    this.logger.debug('Event middleware added');
  }

  /**
   * Get event history for a specific type
   */
  public getEventHistory(eventType?: EventType, limit: number = 100): OrchestratorEvent[] {
    if (eventType) {
      const events = this.eventHistory.get(eventType) || [];
      return events.slice(-limit);
    }

    // Get all events across all types
    const allEvents: OrchestratorEvent[] = [];
    for (const events of this.eventHistory.values()) {
      allEvents.push(...events);
    }

    // Sort by timestamp and return most recent
    return allEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get event statistics
   */
  public getEventStats(): EventStats {
    const stats: EventStats = {
      totalEvents: 0,
      eventsByType: new Map(),
      recentEvents: 0,
      errorRate: 0,
      averageHandlingTime: 0
    };

    // Count events by type
    for (const [eventType, events] of this.eventHistory.entries()) {
      stats.totalEvents += events.length;
      stats.eventsByType.set(eventType, events.length);

      // Count recent events (last hour)
      const recentThreshold = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = events.filter(e => e.timestamp > recentThreshold).length;
      stats.recentEvents += recentCount;
    }

    // Calculate error rate from dead letter queue
    if (stats.totalEvents > 0) {
      stats.errorRate = this.deadLetterQueue.length / stats.totalEvents;
    }

    return stats;
  }

  /**
   * Replay events from history
   */
  public replayEvents(eventType?: EventType, fromTimestamp?: Date): void {
    const events = this.getEventHistory(eventType);

    const eventsToReplay = fromTimestamp
      ? events.filter(e => e.timestamp >= fromTimestamp)
      : events;

    this.logger.info(`Replaying ${eventsToReplay.length} events`);

    for (const event of eventsToReplay) {
      // Create a replay version of the event
      const replayEvent: OrchestratorEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: new Date(),
        metadata: {
          ...event.metadata,
          isReplay: true,
          originalEventId: event.id,
          originalTimestamp: event.timestamp
        }
      };

      this.emitEvent(replayEvent);
    }
  }

  /**
   * Clear event history
   */
  public clearHistory(eventType?: EventType): void {
    if (eventType) {
      this.eventHistory.delete(eventType);
      this.logger.debug(`Cleared history for event type: ${eventType}`);
    } else {
      this.eventHistory.clear();
      this.logger.debug('Cleared all event history');
    }
  }

  /**
   * Wait for specific event
   */
  public async waitForEvent(eventType: EventType, timeout: number = 30000): Promise<OrchestratorEvent> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.removeListener(eventType, eventHandler);
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);

      const eventHandler = (event: OrchestratorEvent) => {
        clearTimeout(timeoutHandle);
        this.removeListener(eventType, eventHandler);
        resolve(event);
      };

      this.once(eventType, eventHandler);
    });
  }

  /**
   * Create event pattern matcher
   */
  public createEventPattern(pattern: EventPattern): EventPatternMatcher {
    return new EventPatternMatcher(pattern, this);
  }

  /**
   * Validate event structure
   */
  private validateEvent(event: OrchestratorEvent): void {
    if (!event.id || !event.type || !event.source || !event.timestamp) {
      throw new OrchestratorError('Invalid event structure', 'INVALID_EVENT');
    }

    if (!this.isValidEventType(event.type)) {
      throw new OrchestratorError(`Invalid event type: ${event.type}`, 'INVALID_EVENT_TYPE');
    }
  }

  /**
   * Check if event type is valid
   */
  private isValidEventType(type: string): boolean {
    const validTypes: EventType[] = [
      'job_received',
      'job_started',
      'job_completed',
      'job_failed',
      'workflow_created',
      'workflow_completed',
      'resource_allocated',
      'resource_released',
      'health_check_failed',
      'system_alert',
      'optimization_applied'
    ];

    return validTypes.includes(type as EventType);
  }

  /**
   * Apply middleware to event
   */
  private applyMiddleware(event: OrchestratorEvent): OrchestratorEvent {
    let processedEvent = { ...event };

    for (const middleware of this.eventMiddleware) {
      try {
        processedEvent = middleware.process(processedEvent);
      } catch (error) {
        this.logger.warn('Event middleware failed:', error);
      }
    }

    return processedEvent;
  }

  /**
   * Store event in history
   */
  private storeEventInHistory(event: OrchestratorEvent): void {
    if (!this.eventHistory.has(event.type)) {
      this.eventHistory.set(event.type, []);
    }

    const events = this.eventHistory.get(event.type)!;
    events.push(event);

    // Limit history size
    if (events.length > this.maxHistorySize) {
      events.shift();
    }
  }

  /**
   * Execute event handler with error handling
   */
  private async executeHandler(handler: EventHandler, event: OrchestratorEvent): Promise<void> {
    try {
      const startTime = Date.now();
      await handler.handle(event);
      const duration = Date.now() - startTime;

      this.logger.debug(`Event handler executed in ${duration}ms for event: ${event.type}`);
    } catch (error) {
      this.logger.error(`Event handler failed for event ${event.type}:`, error);
      this.handleEventError(event, error);
    }
  }

  /**
   * Handle event processing errors
   */
  private handleEventError(event: OrchestratorEvent, error: any): void {
    // Add to dead letter queue
    const errorEvent: OrchestratorEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
      metadata: {
        ...event.metadata,
        error: error.message,
        originalEventId: event.id
      }
    };

    this.deadLetterQueue.push(errorEvent);

    // Limit dead letter queue size
    if (this.deadLetterQueue.length > 1000) {
      this.deadLetterQueue.shift();
    }

    // Emit error event
    this.emit('event_error', { event, error });
  }

  /**
   * Set up error handling
   */
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      this.logger.error('EventBus error:', error);
    });

    // Handle uncaught exceptions in event handlers
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception in event handler:', error);
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled promise rejection in event handler:', reason);
    });
  }

  /**
   * Initialize event tracking
   */
  private initializeEventTracking(): void {
    // Track event emission rates
    setInterval(() => {
      const stats = this.getEventStats();
      if (stats.recentEvents > 1000) {
        this.logger.warn(`High event rate detected: ${stats.recentEvents} events in last hour`);
      }
    }, 300000); // Check every 5 minutes

    // Clean up old events periodically
    setInterval(() => {
      this.cleanupOldEvents();
    }, 3600000); // Clean up every hour
  }

  /**
   * Clean up old events from history
   */
  private cleanupOldEvents(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [eventType, events] of this.eventHistory.entries()) {
      const filteredEvents = events.filter(e => e.timestamp > cutoffTime);
      this.eventHistory.set(eventType, filteredEvents);
    }

    // Clean up dead letter queue
    this.deadLetterQueue = this.deadLetterQueue.filter(e => e.timestamp > cutoffTime);

    this.logger.debug('Cleaned up old events from history');
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown the event bus
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Event Bus...');

    // Remove all listeners
    this.removeAllListeners();

    // Clear history and queues
    this.eventHistory.clear();
    this.deadLetterQueue = [];
    this.eventHandlers.clear();
    this.eventMiddleware = [];

    this.logger.info('Event Bus shutdown complete');
  }
}

// Supporting interfaces and classes
export interface EventHandler {
  handle(event: OrchestratorEvent): Promise<void> | void;
}

export interface EventMiddleware {
  process(event: OrchestratorEvent): OrchestratorEvent;
}

export interface EventStats {
  totalEvents: number;
  eventsByType: Map<EventType, number>;
  recentEvents: number;
  errorRate: number;
  averageHandlingTime: number;
}

export interface EventPattern {
  type?: EventType | EventType[];
  source?: string | string[];
  correlationId?: string;
  metadata?: Record<string, any>;
  timeRange?: {
    from: Date;
    to: Date;
  };
}

export class EventPatternMatcher {
  private pattern: EventPattern;
  private eventBus: EventBus;
  private matchedEvents: OrchestratorEvent[] = [];

  constructor(pattern: EventPattern, eventBus: EventBus) {
    this.pattern = pattern;
    this.eventBus = eventBus;
    this.setupMatcher();
  }

  /**
   * Check if event matches pattern
   */
  public matches(event: OrchestratorEvent): boolean {
    // Type matching
    if (this.pattern.type) {
      const types = Array.isArray(this.pattern.type) ? this.pattern.type : [this.pattern.type];
      if (!types.includes(event.type)) {
        return false;
      }
    }

    // Source matching
    if (this.pattern.source) {
      const sources = Array.isArray(this.pattern.source) ? this.pattern.source : [this.pattern.source];
      if (!sources.includes(event.source)) {
        return false;
      }
    }

    // Correlation ID matching
    if (this.pattern.correlationId && event.correlationId !== this.pattern.correlationId) {
      return false;
    }

    // Metadata matching
    if (this.pattern.metadata) {
      for (const [key, value] of Object.entries(this.pattern.metadata)) {
        if (!event.metadata || event.metadata[key] !== value) {
          return false;
        }
      }
    }

    // Time range matching
    if (this.pattern.timeRange) {
      const eventTime = event.timestamp.getTime();
      const fromTime = this.pattern.timeRange.from.getTime();
      const toTime = this.pattern.timeRange.to.getTime();

      if (eventTime < fromTime || eventTime > toTime) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all matched events
   */
  public getMatches(): OrchestratorEvent[] {
    return [...this.matchedEvents];
  }

  /**
   * Wait for next matching event
   */
  public async waitForMatch(timeout: number = 30000): Promise<OrchestratorEvent> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error('Timeout waiting for matching event'));
      }, timeout);

      const checkMatch = (event: OrchestratorEvent) => {
        if (this.matches(event)) {
          clearTimeout(timeoutHandle);
          this.eventBus.removeListener('event', checkMatch);
          resolve(event);
        }
      };

      this.eventBus.on('event', checkMatch);
    });
  }

  /**
   * Set up event matcher
   */
  private setupMatcher(): void {
    this.eventBus.on('event', (event: OrchestratorEvent) => {
      if (this.matches(event)) {
        this.matchedEvents.push(event);

        // Limit matched events to prevent memory leaks
        if (this.matchedEvents.length > 1000) {
          this.matchedEvents.shift();
        }
      }
    });
  }
}

// Built-in middleware implementations
export class LoggingMiddleware implements EventMiddleware {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('EventLoggingMiddleware');
  }

  process(event: OrchestratorEvent): OrchestratorEvent {
    this.logger.debug(`Processing event: ${event.type} from ${event.source}`);
    return event;
  }
}

export class TimestampMiddleware implements EventMiddleware {
  process(event: OrchestratorEvent): OrchestratorEvent {
    if (!event.timestamp) {
      event.timestamp = new Date();
    }
    return event;
  }
}

export class CorrelationMiddleware implements EventMiddleware {
  process(event: OrchestratorEvent): OrchestratorEvent {
    if (!event.correlationId && event.data?.jobId) {
      event.correlationId = `job_${event.data.jobId}`;
    }
    return event;
  }
}

export class MetricsMiddleware implements EventMiddleware {
  private eventCounts: Map<EventType, number> = new Map();

  process(event: OrchestratorEvent): OrchestratorEvent {
    // Track event metrics
    const currentCount = this.eventCounts.get(event.type) || 0;
    this.eventCounts.set(event.type, currentCount + 1);

    // Add metrics to event metadata
    event.metadata = {
      ...event.metadata,
      eventCount: this.eventCounts.get(event.type)
    };

    return event;
  }

  getMetrics(): Map<EventType, number> {
    return new Map(this.eventCounts);
  }
}
