// Analytics Engine - System performance analysis and predictions
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import {
  SystemMetrics,
  PredictiveAnalytics,
  ScalingRecommendation,
  Anomaly
} from '../interfaces/orchestrator.interfaces';

interface MetricHistory {
  timestamp: Date;
  value: number;
}

interface TrendAnalysis {
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  prediction: number[];
}

export class AnalyticsEngine extends EventEmitter {
  private metricsHistory: Map<string, MetricHistory[]>;
  private anomalies: Anomaly[];
  private metricsInterval: number;
  private collectionTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private windowSize: number = 100;
  private anomalyThreshold: number = 2.5; // Standard deviations

  constructor(metricsInterval: number = 30000) {
    super();
    this.metricsInterval = metricsInterval;
    this.metricsHistory = new Map();
    this.anomalies = [];
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Initialize metric categories
    const metrics = [
      'cpu_usage', 'memory_usage', 'gpu_usage', 'storage_usage',
      'network_bandwidth', 'job_throughput', 'job_latency',
      'success_rate', 'error_rate', 'queue_length',
      'active_nodes', 'processing_time'
    ];

    for (const metric of metrics) {
      this.metricsHistory.set(metric, []);
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Analytics Engine is already running');
      return;
    }

    logger.info('Starting Analytics Engine...');
    this.isRunning = true;

    // Start metrics collection
    this.startMetricsCollection();
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Analytics Engine is not running');
      return;
    }

    logger.info('Stopping Analytics Engine...');
    
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }
    
    this.isRunning = false;
  }

  private startMetricsCollection(): void {
    // Collect metrics immediately
    this.collectMetrics();

    // Schedule periodic collection
    this.collectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.metricsInterval);
  }

  private async collectMetrics(): Promise<void> {
    const timestamp = new Date();

    // Simulate metric collection (in production, would collect from actual sources)
    const metrics = await this.gatherSystemMetrics();

    // Store metrics
    this.storeMetric('cpu_usage', metrics.resources.cpuUsage, timestamp);
    this.storeMetric('memory_usage', metrics.resources.memoryUsage, timestamp);
    this.storeMetric('storage_usage', metrics.resources.storageUsage, timestamp);
    this.storeMetric('network_bandwidth', metrics.resources.networkBandwidth, timestamp);
    this.storeMetric('job_throughput', metrics.performance.throughput, timestamp);
    this.storeMetric('success_rate', metrics.performance.successRate, timestamp);
    this.storeMetric('error_rate', metrics.performance.errorRate, timestamp);
    this.storeMetric('queue_length', metrics.jobs.queued, timestamp);
    this.storeMetric('active_nodes', metrics.nodes.healthy, timestamp);
    this.storeMetric('processing_time', metrics.performance.avgProcessingTime, timestamp);

    // Detect anomalies
    this.detectAnomalies();

    // Analyze trends
    this.analyzeTrends();

    // Emit metrics event
    this.emit('metrics_collected', metrics);
  }

  private async gatherSystemMetrics(): Promise<SystemMetrics> {
    // In production, would gather from actual system
    // For now, simulating with realistic values
    return {
      timestamp: new Date(),
      jobs: {
        total: Math.floor(Math.random() * 1000),
        active: Math.floor(Math.random() * 50),
        queued: Math.floor(Math.random() * 100),
        completed: Math.floor(Math.random() * 800),
        failed: Math.floor(Math.random() * 20)
      },
      resources: {
        cpuUsage: 0.4 + Math.random() * 0.4,
        memoryUsage: 0.5 + Math.random() * 0.3,
        gpuUsage: Math.random() * 0.6,
        storageUsage: 0.3 + Math.random() * 0.4,
        networkBandwidth: 500 + Math.random() * 500
      },
      performance: {
        avgProcessingTime: 5000 + Math.random() * 10000,
        throughput: 10 + Math.random() * 20,
        successRate: 0.85 + Math.random() * 0.14,
        errorRate: Math.random() * 0.1
      },
      nodes: {
        total: 10,
        healthy: 8 + Math.floor(Math.random() * 2),
        degraded: Math.floor(Math.random() * 2),
        offline: Math.floor(Math.random() * 2)
      }
    };
  }

  private storeMetric(metric: string, value: number, timestamp: Date): void {
    const history = this.metricsHistory.get(metric);
    if (!history) return;

    history.push({ timestamp, value });

    // Keep only recent history
    if (history.length > this.windowSize) {
      history.shift();
    }
  }

  private detectAnomalies(): void {
    this.anomalies = [];

    for (const [metric, history] of this.metricsHistory.entries()) {
      if (history.length < 10) continue;

      const values = history.map(h => h.value);
      const mean = this.calculateMean(values);
      const stdDev = this.calculateStdDev(values, mean);
      const latest = values[values.length - 1];

      // Check for anomaly
      if (Math.abs(latest - mean) > this.anomalyThreshold * stdDev) {
        const severity = Math.abs(latest - mean) > 3 * stdDev ? 'high' :
                        Math.abs(latest - mean) > 2.5 * stdDev ? 'medium' : 'low';

        this.anomalies.push({
          metric,
          value: latest,
          expected: mean,
          severity,
          timestamp: new Date()
        });

        logger.warn(`Anomaly detected in ${metric}: ${latest} (expected: ${mean})`);
        this.emit('anomaly_detected', { metric, value: latest, expected: mean, severity });
      }
    }
  }

  private analyzeTrends(): Map<string, TrendAnalysis> {
    const trends = new Map<string, TrendAnalysis>();

    for (const [metric, history] of this.metricsHistory.entries()) {
      if (history.length < 5) continue;

      const recentValues = history.slice(-10).map(h => h.value);
      const trend = this.calculateTrend(recentValues);
      const prediction = this.predictFuture(recentValues, 5);

      trends.set(metric, {
        metric,
        trend,
        changeRate: this.calculateChangeRate(recentValues),
        prediction
      });
    }

    return trends;
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';

    const slope = this.calculateSlope(values);
    const threshold = 0.05;

    if (slope > threshold) return 'increasing';
    if (slope < -threshold) return 'decreasing';
    return 'stable';
  }

  private calculateSlope(values: number[]): number {
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private calculateChangeRate(values: number[]): number {
    if (values.length < 2) return 0;
    
    const first = values[0];
    const last = values[values.length - 1];
    
    if (first === 0) return last > 0 ? 1 : 0;
    return (last - first) / first;
  }

  private predictFuture(values: number[], steps: number): number[] {
    if (values.length < 3) return [];

    // Simple linear prediction
    const slope = this.calculateSlope(values);
    const lastValue = values[values.length - 1];
    const predictions: number[] = [];

    for (let i = 1; i <= steps; i++) {
      const predicted = lastValue + slope * i;
      predictions.push(Math.max(0, predicted));
    }

    return predictions;
  }

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }

  public async getMetrics(): Promise<SystemMetrics> {
    return await this.gatherSystemMetrics();
  }

  public async getPredictions(): Promise<PredictiveAnalytics> {
    const trends = this.analyzeTrends();
    const cpuTrend = trends.get('cpu_usage');
    const memoryTrend = trends.get('memory_usage');
    const queueTrend = trends.get('queue_length');

    // Generate scaling recommendation
    const recommendation = this.generateScalingRecommendation(trends);

    // Generate optimization suggestions
    const suggestions = this.generateOptimizationSuggestions(trends);

    // Predict future load
    const predictedLoad = cpuTrend?.prediction || [];

    return {
      predictedLoad,
      recommendedScaling: recommendation,
      anomalies: this.anomalies,
      optimizationSuggestions: suggestions
    };
  }

  private generateScalingRecommendation(trends: Map<string, TrendAnalysis>): ScalingRecommendation {
    const cpuTrend = trends.get('cpu_usage');
    const memoryTrend = trends.get('memory_usage');
    const queueTrend = trends.get('queue_length');

    let action: 'scale_up' | 'scale_down' | 'maintain' = 'maintain';
    let nodeCount = 0;
    let reason = '';
    let confidence = 0.5;

    // Check if scaling up is needed
    if (cpuTrend && cpuTrend.trend === 'increasing' && cpuTrend.prediction[0] > 0.8) {
      action = 'scale_up';
      nodeCount = Math.ceil(cpuTrend.prediction[0] / 0.6);
      reason = 'CPU usage trending high';
      confidence = 0.8;
    } else if (memoryTrend && memoryTrend.trend === 'increasing' && memoryTrend.prediction[0] > 0.85) {
      action = 'scale_up';
      nodeCount = 2;
      reason = 'Memory usage trending high';
      confidence = 0.75;
    } else if (queueTrend && queueTrend.trend === 'increasing' && queueTrend.changeRate > 0.5) {
      action = 'scale_up';
      nodeCount = Math.ceil(queueTrend.changeRate * 2);
      reason = 'Queue length increasing rapidly';
      confidence = 0.7;
    }
    // Check if scaling down is possible
    else if (cpuTrend && cpuTrend.trend === 'decreasing' && cpuTrend.prediction[0] < 0.3) {
      if (memoryTrend && memoryTrend.prediction[0] < 0.4) {
        action = 'scale_down';
        nodeCount = 1;
        reason = 'Resource usage consistently low';
        confidence = 0.6;
      }
    }

    return { action, nodeCount, reason, confidence };
  }

  private generateOptimizationSuggestions(trends: Map<string, TrendAnalysis>): string[] {
    const suggestions: string[] = [];

    // Analyze CPU trends
    const cpuTrend = trends.get('cpu_usage');
    if (cpuTrend && cpuTrend.trend === 'increasing') {
      suggestions.push('Consider optimizing video processing algorithms for CPU efficiency');
    }

    // Analyze memory trends
    const memoryTrend = trends.get('memory_usage');
    if (memoryTrend && memoryTrend.changeRate > 0.2) {
      suggestions.push('Implement memory pooling to reduce allocation overhead');
    }

    // Analyze error rate
    const errorTrend = trends.get('error_rate');
    if (errorTrend && errorTrend.trend === 'increasing') {
      suggestions.push('Investigate increasing error rates and add retry mechanisms');
    }

    // Analyze processing time
    const processingTrend = trends.get('processing_time');
    if (processingTrend && processingTrend.trend === 'increasing') {
      suggestions.push('Enable GPU acceleration for video processing tasks');
      suggestions.push('Consider implementing distributed processing for large jobs');
    }

    // Analyze queue length
    const queueTrend = trends.get('queue_length');
    if (queueTrend && queueTrend.changeRate > 0.3) {
      suggestions.push('Increase worker pool size to handle queue backlog');
    }

    return suggestions;
  }

  public getHistoricalMetrics(metric: string, duration: number = 3600000): MetricHistory[] {
    const history = this.metricsHistory.get(metric);
    if (!history) return [];

    const cutoff = new Date(Date.now() - duration);
    return history.filter(h => h.timestamp >= cutoff);
  }

  public getAnomalies(): Anomaly[] {
    return this.anomalies;
  }

  public getPerformanceReport(): any {
    const report: any = {
      timestamp: new Date(),
      metrics: {},
      trends: {},
      anomalies: this.anomalies,
      health: 'good'
    };

    // Add current metrics
    for (const [metric, history] of this.metricsHistory.entries()) {
      if (history.length > 0) {
        const values = history.map(h => h.value);
        report.metrics[metric] = {
          current: values[values.length - 1],
          avg: this.calculateMean(values),
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    }

    // Add trends
    const trends = this.analyzeTrends();
    for (const [metric, trend] of trends.entries()) {
      report.trends[metric] = trend;
    }

    // Determine overall health
    if (this.anomalies.filter(a => a.severity === 'high').length > 0) {
      report.health = 'critical';
    } else if (this.anomalies.filter(a => a.severity === 'medium').length > 0) {
      report.health = 'warning';
    }

    return report;
  }
}