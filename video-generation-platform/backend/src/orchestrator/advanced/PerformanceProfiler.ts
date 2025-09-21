
import { Metric, Bottleneck } from './types';

/**
 * Performance Profiler
 * Identifies performance bottlenecks in the system.
 */
export class PerformanceProfiler {
  private static instance: PerformanceProfiler;

  private constructor() {}

  public static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  /**
   * Analyzes metrics to identify potential bottlenecks.
   * @param metrics A list of metrics to analyze.
   * @returns A list of identified bottlenecks.
   */
  public async identifyBottlenecks(metrics: Metric[]): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = [];

    const apiLatency = metrics.find((m) => m.name === 'api_latency');
    if (apiLatency && apiLatency.value > 1000) {
      bottlenecks.push({
        resource: 'api',
        service: 'backend',
        description: 'High API latency detected',
        severity: 'high',
        potential_impact: 'Slow user experience and potential timeouts',
      });
    }

    const dbConnections = metrics.find((m) => m.name === 'database_connections');
    if (dbConnections && dbConnections.value > 50) {
      bottlenecks.push({
        resource: 'database',
        service: 'database',
        description: 'High number of database connections',
        severity: 'medium',
        potential_impact: 'Increased database load and potential connection errors',
      });
    }

    return bottlenecks;
  }
}
