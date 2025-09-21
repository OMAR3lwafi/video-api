
import { DatabaseService } from '@/services/DatabaseService';
import { Metric, MetricName } from './types';

/**
 * Metrics Collector
 * Gathers and stores system metrics from various sources.
 */
export class MetricsCollector {
  private static instance: MetricsCollector;

  private constructor() {}

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Collects and stores a metric.
   * @param name The name of the metric.
   * @param value The value of the metric.
   * @param tags Optional tags for the metric.
   */
  public async collect(name: MetricName, value: number, tags?: Record<string, string>): Promise<void> {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date().toISOString(),
      tags,
    };

    // In a real implementation, this would send the metric to a time-series database like Prometheus.
    // For now, we'll log it to the console and store it in our database.
    console.log('Collecting metric:', metric);

    await DatabaseService.recordSystemMetric({
      metric_name: name,
      metric_type: 'gauge', // Or determine based on metric name
      value: value,
      unit: this.getUnitForMetric(name),
      labels: tags,
    });
  }

  private getUnitForMetric(name: MetricName): string {
    switch (name) {
      case 'cpu_usage':
      case 'memory_usage':
      case 'gpu_usage':
        return '%';
      case 'disk_io':
        return 'bytes/s';
      case 'network_io':
        return 'bytes/s';
      case 'job_processing_time':
        return 'ms';
      case 'job_queue_length':
      case 'database_connections':
        return 'count';
      case 'api_latency':
        return 'ms';
      default:
        return '';
    }
  }
}
