import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export class Logger {
  private logger: winston.Logger;
  private context: string;

  constructor(context: string) {
    this.context = context;
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const contextStr = context || this.context;
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `${timestamp} [${level.toUpperCase()}] [${contextStr}] ${message} ${metaStr}`;
      })
    );

    const transports: winston.transport[] = [
      // Console transport
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(({ timestamp, level, message, context }) => {
            const contextStr = context || this.context;
            return `${timestamp} [${level}] [${contextStr}] ${message}`;
          })
        )
      })
    ];

    // File transports for production
    if (process.env.NODE_ENV === 'production') {
      // Error log file
      transports.push(
        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          handleExceptions: true,
          maxFiles: '30d',
          maxSize: '20m',
          format: logFormat
        })
      );

      // Combined log file
      transports.push(
        new DailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '14d',
          maxSize: '20m',
          format: logFormat
        })
      );

      // Application log file
      transports.push(
        new DailyRotateFile({
          filename: 'logs/orchestrator-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '7d',
          maxSize: '50m',
          format: logFormat
        })
      );
    }

    return winston.createLogger({
      level: logLevel,
      format: logFormat,
      transports,
      exitOnError: false,
      // Handle uncaught exceptions and promise rejections
      exceptionHandlers: process.env.NODE_ENV === 'production' ? [
        new DailyRotateFile({
          filename: 'logs/exceptions-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d',
          maxSize: '20m'
        })
      ] : [],
      rejectionHandlers: process.env.NODE_ENV === 'production' ? [
        new DailyRotateFile({
          filename: 'logs/rejections-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d',
          maxSize: '20m'
        })
      ] : []
    });
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, { context: this.context, ...meta });
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, { context: this.context, ...meta });
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  public error(message: string, error?: any, meta?: any): void {
    const errorMeta = error instanceof Error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } : { error };

    this.logger.error(message, { context: this.context, ...errorMeta, ...meta });
  }

  public fatal(message: string, error?: any, meta?: any): void {
    const errorMeta = error instanceof Error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } : { error };

    this.logger.error(`[FATAL] ${message}`, { context: this.context, ...errorMeta, ...meta });
  }

  // Performance logging
  public perf(operation: string, duration: number, meta?: any): void {
    this.logger.info(`Performance: ${operation} completed in ${duration}ms`, {
      context: this.context,
      operation,
      duration,
      type: 'performance',
      ...meta
    });
  }

  // Audit logging for security events
  public audit(action: string, userId?: string, meta?: any): void {
    this.logger.info(`Audit: ${action}`, {
      context: this.context,
      action,
      userId,
      type: 'audit',
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  // Security logging
  public security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', meta?: any): void {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';

    this.logger[level](`Security: ${event}`, {
      context: this.context,
      event,
      severity,
      type: 'security',
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  // Business logic logging
  public business(event: string, meta?: any): void {
    this.logger.info(`Business: ${event}`, {
      context: this.context,
      event,
      type: 'business',
      ...meta
    });
  }

  // Metrics logging
  public metric(name: string, value: number, unit?: string, meta?: any): void {
    this.logger.info(`Metric: ${name}`, {
      context: this.context,
      metric: {
        name,
        value,
        unit: unit || 'count',
        timestamp: Date.now()
      },
      type: 'metric',
      ...meta
    });
  }

  // HTTP request logging
  public http(method: string, url: string, statusCode: number, duration: number, meta?: any): void {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';

    this.logger[level](`HTTP: ${method} ${url} ${statusCode}`, {
      context: this.context,
      http: {
        method,
        url,
        statusCode,
        duration
      },
      type: 'http',
      ...meta
    });
  }

  // Database operation logging
  public database(operation: string, table: string, duration: number, meta?: any): void {
    this.logger.debug(`Database: ${operation} on ${table}`, {
      context: this.context,
      database: {
        operation,
        table,
        duration
      },
      type: 'database',
      ...meta
    });
  }

  // External service logging
  public external(service: string, operation: string, success: boolean, duration: number, meta?: any): void {
    const level = success ? 'info' : 'error';
    const status = success ? 'success' : 'failure';

    this.logger[level](`External: ${service}.${operation} ${status}`, {
      context: this.context,
      external: {
        service,
        operation,
        success,
        duration
      },
      type: 'external',
      ...meta
    });
  }

  // Job processing logging
  public job(jobId: string, status: string, duration?: number, meta?: any): void {
    const level = status === 'failed' ? 'error' : status === 'completed' ? 'info' : 'debug';

    this.logger[level](`Job: ${jobId} ${status}`, {
      context: this.context,
      job: {
        jobId,
        status,
        duration
      },
      type: 'job',
      ...meta
    });
  }

  // Resource allocation logging
  public resource(action: string, resourceType: string, amount: number, meta?: any): void {
    this.logger.debug(`Resource: ${action} ${amount} ${resourceType}`, {
      context: this.context,
      resource: {
        action,
        resourceType,
        amount
      },
      type: 'resource',
      ...meta
    });
  }

  // Workflow logging
  public workflow(workflowId: string, step: string, status: string, meta?: any): void {
    const level = status === 'failed' ? 'error' : 'debug';

    this.logger[level](`Workflow: ${workflowId} ${step} ${status}`, {
      context: this.context,
      workflow: {
        workflowId,
        step,
        status
      },
      type: 'workflow',
      ...meta
    });
  }

  // Health check logging
  public health(component: string, status: string, meta?: any): void {
    const level = status === 'unhealthy' ? 'error' : status === 'degraded' ? 'warn' : 'debug';

    this.logger[level](`Health: ${component} is ${status}`, {
      context: this.context,
      health: {
        component,
        status
      },
      type: 'health',
      ...meta
    });
  }

  // Configuration logging
  public config(action: string, key: string, meta?: any): void {
    this.logger.info(`Config: ${action} ${key}`, {
      context: this.context,
      config: {
        action,
        key
      },
      type: 'config',
      ...meta
    });
  }

  // Create a child logger with additional context
  public child(additionalContext: string): Logger {
    const childContext = `${this.context}:${additionalContext}`;
    return new Logger(childContext);
  }

  // Structured logging with correlation ID
  public withCorrelation(correlationId: string): CorrelationLogger {
    return new CorrelationLogger(this, correlationId);
  }

  // Get the underlying winston logger
  public getWinstonLogger(): winston.Logger {
    return this.logger;
  }

  // Create a timer for measuring operation duration
  public timer(): LogTimer {
    return new LogTimer(this);
  }

  // Close logger and flush logs
  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.close(() => resolve());
    });
  }
}

// Correlation Logger for request tracing
export class CorrelationLogger {
  constructor(private logger: Logger, private correlationId: string) {}

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, { correlationId: this.correlationId, ...meta });
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, { correlationId: this.correlationId, ...meta });
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, { correlationId: this.correlationId, ...meta });
  }

  public error(message: string, error?: any, meta?: any): void {
    this.logger.error(message, error, { correlationId: this.correlationId, ...meta });
  }

  public job(jobId: string, status: string, duration?: number, meta?: any): void {
    this.logger.job(jobId, status, duration, { correlationId: this.correlationId, ...meta });
  }
}

// Timer utility for measuring operation duration
export class LogTimer {
  private startTime: number;

  constructor(private logger: Logger) {
    this.startTime = Date.now();
  }

  public end(operation: string, meta?: any): number {
    const duration = Date.now() - this.startTime;
    this.logger.perf(operation, duration, meta);
    return duration;
  }

  public lap(operation: string, meta?: any): number {
    const duration = Date.now() - this.startTime;
    this.logger.perf(`${operation} (lap)`, duration, meta);
    return duration;
  }
}

// Default logger instance
export const defaultLogger = new Logger('DefaultLogger');

// Logger factory
export class LoggerFactory {
  private static loggers: Map<string, Logger> = new Map();

  public static getLogger(context: string): Logger {
    if (!this.loggers.has(context)) {
      this.loggers.set(context, new Logger(context));
    }
    return this.loggers.get(context)!;
  }

  public static clearLoggers(): void {
    this.loggers.clear();
  }
}

// Export utility functions
export function createLogger(context: string): Logger {
  return LoggerFactory.getLogger(context);
}

export function withCorrelation(logger: Logger, correlationId: string): CorrelationLogger {
  return logger.withCorrelation(correlationId);
}

export default Logger;
