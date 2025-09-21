import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { logger } from './logger';
import { promisify } from 'util';
import * as client from 'prom-client';

// Metric types
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

// Metric interfaces
interface BaseMetric {
  name: string;
  help: string;
  type: MetricType;
  labels?: Record<string, string>;
  timestamp?: number;
  value: number;
}

interface CounterMetric extends BaseMetric {
  type: MetricType.COUNTER;
}

interface GaugeMetric extends BaseMetric {
  type: MetricType.GAUGE;
}

interface HistogramMetric extends BaseMetric {
  type: MetricType.HISTOGRAM;
  buckets?: number[];
}

interface SummaryMetric extends BaseMetric {
  type: MetricType.SUMMARY;
  quantiles?: number[];
}

type Metric = CounterMetric | GaugeMetric | HistogramMetric | SummaryMetric;

// Application-specific metric interfaces
interface ApiRequestMetric {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  memoryUsage: number;
  dbQueryCount?: number;
  dbQueryTime?: number;
}

interface DatabaseQueryMetric {
  executionTime: number;
  success: boolean;
  slow: boolean;
  queryType?: string;
  table?: string;
}

interface CacheOperationMetric {
  operation: 'hit' | 'miss' | 'set' | 'delete';
  responseTime: number;
  keySize?: number;
  valueSize?: number;
}

interface VideoProcessingMetric {
  jobId: string;
  operation: string;
  duration: number;
  inputSize: number;
  outputSize?: number;
  success: boolean;
  errorType?: string;
}

interface SystemResourceMetric {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
}

interface BusinessMetric {
  event: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

// Configuration interface
interface MetricsConfig {
  enabled: boolean;
  exportInterval: number; // milliseconds
  batchSize: number;
  retention: number; // milliseconds
  prometheus: {
    enabled: boolean;
    port?: number;
    endpoint?: string;
    defaultLabels?: Record<string, string>;
  };
  customExporters: string[];
  bufferSize: number;
  flushOnExit: boolean;
}

export class MetricsCollector extends EventEmitter {
  private static instance: MetricsCollector;
  private config: MetricsConfig;
  private metricsBuffer: Map<string, Metric[]>;
  private prometheusMetrics: Map<string, any>;
  private exportTimer: NodeJS.Timeout | null = null;
  private isEnabled: boolean;
  private registry: client.Registry;

  // Prometheus metric instances
  private httpRequestsTotal: client.Counter;
  private httpRequestDuration: client.Histogram;
  private dbQueryDuration: client.Histogram;
  private dbQueryTotal: client.Counter;
  private cacheOperationsTotal: client.Counter;
  private cacheOperationDuration: client.Histogram;
  private videoProcessingDuration: client.Histogram;
  private videoProcessingTotal: client.Counter;
  private systemCpuUsage: client.Gauge;
  private systemMemoryUsage: client.Gauge;
  private systemDiskUsage: client.Gauge;
  private businessEventsTotal: client.Counter;
  private activeConnections: client.Gauge;
  private errorTotal: client.Counter;

  // Internal metrics
  private startTime: number;
  private totalRequests: number = 0;
  private totalErrors: number = 0;
  private averageResponseTime: number = 0;

  constructor(config?: Partial<MetricsConfig>) {
    super();

    this.config = {
      enabled: process.env.METRICS_ENABLED !== 'false',
      exportInterval: parseInt(process.env.METRICS_EXPORT_INTERVAL || '30000'),
      batchSize: parseInt(process.env.METRICS_BATCH_SIZE || '100'),
      retention: parseInt(process.env.METRICS_RETENTION || '86400000'), // 24 hours
      prometheus: {
        enabled: process.env.PROMETHEUS_ENABLED !== 'false',
        port: parseInt(process.env.PROMETHEUS_PORT || '9464'),
        endpoint: process.env.PROMETHEUS_ENDPOINT || '/metrics',
        defaultLabels: {
          service: 'video-generation-platform',
          version: process.env.APP_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
        },
      },
      customExporters: (process.env.CUSTOM_EXPORTERS || '').split(',').filter(Boolean),
      bufferSize: parseInt(process.env.METRICS_BUFFER_SIZE || '1000'),
      flushOnExit: process.env.METRICS_FLUSH_ON_EXIT !== 'false',
      ...config,
    };

    this.isEnabled = this.config.enabled;
    this.metricsBuffer = new Map();
    this.prometheusMetrics = new Map();
    this.startTime = performance.now();

    if (this.isEnabled) {
      this.initializePrometheus();
      this.startExportTimer();
      this.setupExitHandlers();
      logger.info('MetricsCollector initialized', {
        enabled: this.isEnabled,
        exportInterval: this.config.exportInterval,
        prometheusEnabled: this.config.prometheus.enabled,
      });
    }
  }

  static getInstance(config?: Partial<MetricsConfig>): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector(config);
    }
    return MetricsCollector.instance;
  }

  private initializePrometheus(): void {
    if (!this.config.prometheus.enabled) return;

    try {
      this.registry = new client.Registry();

      // Set default labels
      if (this.config.prometheus.defaultLabels) {
        this.registry.setDefaultLabels(this.config.prometheus.defaultLabels);
      }

      // Initialize HTTP request metrics
      this.httpRequestsTotal = new client.Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
        registers: [this.registry],
      });

      this.httpRequestDuration = new client.Histogram({
        name: 'http_request_duration_milliseconds',
        help: 'HTTP request duration in milliseconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [1, 5, 15, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
        registers: [this.registry],
      });

      // Initialize database metrics
      this.dbQueryDuration = new client.Histogram({
        name: 'db_query_duration_milliseconds',
        help: 'Database query duration in milliseconds',
        labelNames: ['query_type', 'table', 'success'],
        buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
        registers: [this.registry],
      });

      this.dbQueryTotal = new client.Counter({
        name: 'db_queries_total',
        help: 'Total number of database queries',
        labelNames: ['query_type', 'table', 'success'],
        registers: [this.registry],
      });

      // Initialize cache metrics
      this.cacheOperationsTotal = new client.Counter({
        name: 'cache_operations_total',
        help: 'Total number of cache operations',
        labelNames: ['operation'],
        registers: [this.registry],
      });

      this.cacheOperationDuration = new client.Histogram({
        name: 'cache_operation_duration_milliseconds',
        help: 'Cache operation duration in milliseconds',
        labelNames: ['operation'],
        buckets: [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100],
        registers: [this.registry],
      });

      // Initialize video processing metrics
      this.videoProcessingDuration = new client.Histogram({
        name: 'video_processing_duration_seconds',
        help: 'Video processing duration in seconds',
        labelNames: ['operation', 'success'],
        buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1200, 1800],
        registers: [this.registry],
      });

      this.videoProcessingTotal = new client.Counter({
        name: 'video_processing_jobs_total',
        help: 'Total number of video processing jobs',
        labelNames: ['operation', 'success'],
        registers: [this.registry],
      });

      // Initialize system metrics
      this.systemCpuUsage = new client.Gauge({
        name: 'system_cpu_usage_percent',
        help: 'System CPU usage percentage',
        registers: [this.registry],
      });

      this.systemMemoryUsage = new client.Gauge({
        name: 'system_memory_usage_bytes',
        help: 'System memory usage in bytes',
        registers: [this.registry],
      });

      this.systemDiskUsage = new client.Gauge({
        name: 'system_disk_usage_bytes',
        help: 'System disk usage in bytes',
        registers: [this.registry],
      });

      // Initialize business metrics
      this.businessEventsTotal = new client.Counter({
        name: 'business_events_total',
        help: 'Total number of business events',
        labelNames: ['event', 'user_type'],
        registers: [this.registry],
      });

      // Initialize connection metrics
      this.activeConnections = new client.Gauge({
        name: 'active_connections',
        help: 'Number of active connections',
        labelNames: ['type'],
        registers: [this.registry],
      });

      // Initialize error metrics
      this.errorTotal = new client.Counter({
        name: 'errors_total',
        help: 'Total number of errors',
        labelNames: ['type', 'severity'],
        registers: [this.registry],
      });

      // Collect default metrics (CPU, memory, etc.)
      client.collectDefaultMetrics({ register: this.registry });

      logger.info('Prometheus metrics initialized');
    } catch (error) {
      logger.error('Failed to initialize Prometheus metrics:', error);
      this.config.prometheus.enabled = false;
    }
  }

  // Public API methods

  recordApiRequest(data: ApiRequestMetric): void {
    if (!this.isEnabled) return;

    try {
      this.totalRequests++;

      // Update average response time
      this.averageResponseTime =
        ((this.averageResponseTime * (this.totalRequests - 1)) + data.responseTime) /
        this.totalRequests;

      // Record in Prometheus
      if (this.config.prometheus.enabled) {
        const labels = {
          method: data.method.toUpperCase(),
          route: this.sanitizeRoute(data.path),
          status_code: data.statusCode.toString(),
        };

        this.httpRequestsTotal.inc(labels);
        this.httpRequestDuration.observe(labels, data.responseTime);
      }

      // Store in buffer
      this.addMetric({
        name: 'http_request',
        help: 'HTTP request metrics',
        type: MetricType.HISTOGRAM,
        value: data.responseTime,
        labels: {
          method: data.method,
          path: data.path,
          status_code: data.statusCode.toString(),
          memory_usage: data.memoryUsage.toString(),
          db_query_count: data.dbQueryCount?.toString() || '0',
          db_query_time: data.dbQueryTime?.toString() || '0',
        },
        timestamp: Date.now(),
      });

      // Emit event for real-time monitoring
      this.emit('api_request', data);

    } catch (error) {
      logger.error('Error recording API request metric:', error);
    }
  }

  recordDatabaseQuery(data: DatabaseQueryMetric): void {
    if (!this.isEnabled) return;

    try {
      // Record in Prometheus
      if (this.config.prometheus.enabled) {
        const labels = {
          query_type: data.queryType || 'unknown',
          table: data.table || 'unknown',
          success: data.success.toString(),
        };

        this.dbQueryTotal.inc(labels);
        this.dbQueryDuration.observe(labels, data.executionTime);
      }

      // Store in buffer
      this.addMetric({
        name: 'db_query',
        help: 'Database query metrics',
        type: MetricType.HISTOGRAM,
        value: data.executionTime,
        labels: {
          success: data.success.toString(),
          slow: data.slow.toString(),
          query_type: data.queryType || 'unknown',
          table: data.table || 'unknown',
        },
        timestamp: Date.now(),
      });

      this.emit('db_query', data);

    } catch (error) {
      logger.error('Error recording database query metric:', error);
    }
  }

  recordCacheOperation(operation: CacheOperationMetric['operation'], responseTime: number, keySize?: number, valueSize?: number): void {
    if (!this.isEnabled) return;

    try {
      const data: CacheOperationMetric = {
        operation,
        responseTime,
        keySize,
        valueSize,
      };

      // Record in Prometheus
      if (this.config.prometheus.enabled) {
        this.cacheOperationsTotal.inc({ operation });
        this.cacheOperationDuration.observe({ operation }, responseTime);
      }

      // Store in buffer
      this.addMetric({
        name: 'cache_operation',
        help: 'Cache operation metrics',
        type: MetricType.HISTOGRAM,
        value: responseTime,
        labels: {
          operation,
          key_size: keySize?.toString() || '0',
          value_size: valueSize?.toString() || '0',
        },
        timestamp: Date.now(),
      });

      this.emit('cache_operation', data);

    } catch (error) {
      logger.error('Error recording cache operation metric:', error);
    }
  }

  recordVideoProcessing(data: VideoProcessingMetric): void {
    if (!this.isEnabled) return;

    try {
      // Record in Prometheus
      if (this.config.prometheus.enabled) {
        const labels = {
          operation: data.operation,
          success: data.success.toString(),
        };

        this.videoProcessingTotal.inc(labels);
        this.videoProcessingDuration.observe(labels, data.duration / 1000); // Convert to seconds
      }

      // Store in buffer
      this.addMetric({
        name: 'video_processing',
        help: 'Video processing metrics',
        type: MetricType.HISTOGRAM,
        value: data.duration,
        labels: {
          job_id: data.jobId,
          operation: data.operation,
          success: data.success.toString(),
          input_size: data.inputSize.toString(),
          output_size: data.outputSize?.toString() || '0',
          error_type: data.errorType || 'none',
        },
        timestamp: Date.now(),
      });

      this.emit('video_processing', data);

    } catch (error) {
      logger.error('Error recording video processing metric:', error);
    }
  }

  recordSystemResources(data: SystemResourceMetric): void {
    if (!this.isEnabled) return;

    try {
      // Record in Prometheus
      if (this.config.prometheus.enabled) {
        this.systemCpuUsage.set(data.cpuUsage);
        this.systemMemoryUsage.set(data.memoryUsage);
        this.systemDiskUsage.set(data.diskUsage);
      }

      // Store in buffer
      this.addMetric({
        name: 'system_resources',
        help: 'System resource usage metrics',
        type: MetricType.GAUGE,
        value: data.cpuUsage,
        labels: {
          cpu_usage: data.cpuUsage.toString(),
          memory_usage: data.memoryUsage.toString(),
          disk_usage: data.diskUsage.toString(),
          network_in: data.networkIn.toString(),
          network_out: data.networkOut.toString(),
        },
        timestamp: Date.now(),
      });

      this.emit('system_resources', data);

    } catch (error) {
      logger.error('Error recording system resources metric:', error);
    }
  }

  recordBusinessEvent(data: BusinessMetric): void {
    if (!this.isEnabled) return;

    try {
      // Record in Prometheus
      if (this.config.prometheus.enabled) {
        this.businessEventsTotal.inc({
          event: data.event,
          user_type: data.userId ? 'authenticated' : 'anonymous',
        });
      }

      // Store in buffer
      this.addMetric({
        name: 'business_event',
        help: 'Business event metrics',
        type: MetricType.COUNTER,
        value: 1,
        labels: {
          event: data.event,
          user_id: data.userId || 'anonymous',
          session_id: data.sessionId || 'unknown',
          ...data.metadata,
        },
        timestamp: Date.now(),
      });

      this.emit('business_event', data);

    } catch (error) {
      logger.error('Error recording business event metric:', error);
    }
  }

  recordError(errorType: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium', metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    try {
      this.totalErrors++;

      // Record in Prometheus
      if (this.config.prometheus.enabled) {
        this.errorTotal.inc({ type: errorType, severity });
      }

      // Store in buffer
      this.addMetric({
        name: 'error',
        help: 'Error metrics',
        type: MetricType.COUNTER,
        value: 1,
        labels: {
          type: errorType,
          severity,
          ...metadata,
        },
        timestamp: Date.now(),
      });

      this.emit('error', { type: errorType, severity, metadata });

    } catch (error) {
      logger.error('Error recording error metric:', error);
    }
  }

  updateActiveConnections(type: string, count: number): void {
    if (!this.isEnabled) return;

    try {
      if (this.config.prometheus.enabled) {
        this.activeConnections.set({ type }, count);
      }

      this.emit('connection_update', { type, count });

    } catch (error) {
      logger.error('Error updating active connections metric:', error);
    }
  }

  // Custom metric recording
  recordCustomMetric(metric: Metric): void {
    if (!this.isEnabled) return;

    try {
      this.addMetric(metric);
      this.emit('custom_metric', metric);
    } catch (error) {
      logger.error('Error recording custom metric:', error);
    }
  }

  // Metric retrieval and export methods

  getPrometheusMetrics(): Promise<string> {
    if (!this.config.prometheus.enabled || !this.registry) {
      return Promise.resolve('');
    }

    return this.registry.metrics();
  }

  getMetrics(name?: string, since?: number): Metric[] {
    if (!this.isEnabled) return [];

    if (name) {
      const metrics = this.metricsBuffer.get(name) || [];
      return since ? metrics.filter(m => (m.timestamp || 0) >= since) : metrics;
    }

    const allMetrics: Metric[] = [];
    for (const metricsList of this.metricsBuffer.values()) {
      allMetrics.push(...metricsList);
    }

    return since ? allMetrics.filter(m => (m.timestamp || 0) >= since) : allMetrics;
  }

  getStats(): {
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    uptime: number;
    bufferSize: number;
    metricsEnabled: boolean;
  } {
    return {
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      averageResponseTime: this.averageResponseTime,
      uptime: performance.now() - this.startTime,
      bufferSize: Array.from(this.metricsBuffer.values()).reduce((sum, arr) => sum + arr.length, 0),
      metricsEnabled: this.isEnabled,
    };
  }

  // Configuration and lifecycle methods

  updateConfig(newConfig: Partial<MetricsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isEnabled = this.config.enabled;

    if (this.isEnabled && !this.exportTimer) {
      this.startExportTimer();
    } else if (!this.isEnabled && this.exportTimer) {
      this.stopExportTimer();
    }

    logger.info('MetricsCollector configuration updated', this.config);
  }

  async flush(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      logger.info('Flushing metrics buffer');
      await this.exportMetrics();
      this.clearOldMetrics();
      logger.info('Metrics buffer flushed successfully');
    } catch (error) {
      logger.error('Error flushing metrics:', error);
    }
  }

  clearMetrics(name?: string): void {
    if (name) {
      this.metricsBuffer.delete(name);
    } else {
      this.metricsBuffer.clear();
    }
  }

  destroy(): void {
    this.stopExportTimer();
    this.clearMetrics();
    this.removeAllListeners();
    this.isEnabled = false;
    logger.info('MetricsCollector destroyed');
  }

  // Private helper methods

  private addMetric(metric: Metric): void {
    const metrics = this.metricsBuffer.get(metric.name) || [];
    metrics.push({ ...metric, timestamp: Date.now() });

    // Limit buffer size per metric
    if (metrics.length > this.config.bufferSize) {
      metrics.splice(0, metrics.length - this.config.bufferSize);
    }

    this.metricsBuffer.set(metric.name, metrics);
  }

  private sanitizeRoute(path: string): string {
    // Remove IDs and other dynamic parts from routes for better grouping
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '/:uuid')
      .replace(/\?.*/, ''); // Remove query parameters
  }

  private startExportTimer(): void {
    if (this.exportTimer) return;

    this.exportTimer = setInterval(async () => {
      try {
        await this.exportMetrics();
        this.clearOldMetrics();
      } catch (error) {
        logger.error('Error in metrics export timer:', error);
      }
    }, this.config.exportInterval);
  }

  private stopExportTimer(): void {
    if (this.exportTimer) {
      clearInterval(this.exportTimer);
      this.exportTimer = null;
    }
  }

  private async exportMetrics(): Promise<void> {
    // This method can be extended to export to external systems
    // For now, it just emits an event
    this.emit('metrics_export', {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      stats: this.getStats(),
    });
  }

  private clearOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.retention;

    for (const [name, metrics] of this.metricsBuffer.entries()) {
      const filteredMetrics = metrics.filter(m => (m.timestamp || 0) > cutoffTime);
      if (filteredMetrics.length === 0) {
        this.metricsBuffer.delete(name);
      } else {
        this.metricsBuffer.set(name, filteredMetrics);
      }
    }
  }

  private setupExitHandlers(): void {
    if (!this.config.flushOnExit) return;

    const handleExit = async () => {
      logger.info('Flushing metrics on exit...');
      await this.flush();
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);
    process.on('beforeExit', handleExit);
  }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance();
export default metricsCollector;
