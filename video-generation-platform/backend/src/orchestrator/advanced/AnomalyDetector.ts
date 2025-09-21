
import { Metric, Anomaly } from './types';

/**
 * Anomaly Detector
 * Detects anomalies in system metrics using statistical methods.
 */
export class AnomalyDetector {
  private static instance: AnomalyDetector;

  private constructor() {}

  public static getInstance(): AnomalyDetector {
    if (!AnomalyDetector.instance) {
      AnomalyDetector.instance = new AnomalyDetector();
    }
    return AnomalyDetector.instance;
  }

  /**
   * Detects anomalies in a given metric.
   * @param metric The metric to analyze.
   * @returns An anomaly if one is detected, otherwise null.
   */
  public async detect(metric: Metric): Promise<Anomaly | null> {
    // In a real implementation, this would use more sophisticated statistical models.
    // For now, we'll use a simple threshold-based approach.
    const { name, value } = metric;
    const thresholds = {
      cpu_usage: { high: 90, critical: 95 },
      memory_usage: { high: 85, critical: 95 },
      job_queue_length: { high: 100, critical: 200 },
    };

    const threshold = thresholds[name];
    if (!threshold) {
      return null;
    }

    let severity: 'high' | 'critical' | null = null;
    if (value > threshold.critical) {
      severity = 'critical';
    } else if (value > threshold.high) {
      severity = 'high';
    }

    if (severity) {
      return {
        metric: name,
        actual_value: value,
        expected_value: threshold.high,
        severity,
        timestamp: new Date().toISOString(),
        details: `Metric ${name} exceeded threshold of ${threshold.high}`,
      };
    }

    return null;
  }
}
