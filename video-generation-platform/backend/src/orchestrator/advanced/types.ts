
/**
 * Types for Advanced Orchestrator Features
 */

// ===========================================================================
// METRICS
// ===========================================================================

export type MetricName =
  | 'cpu_usage'
  | 'memory_usage'
  | 'gpu_usage'
  | 'disk_io'
  | 'network_io'
  | 'job_processing_time'
  | 'job_queue_length'
  | 'api_latency'
  | 'database_connections';

export interface Metric {
  name: MetricName;
  value: number;
  timestamp: string;
  tags?: Record<string, string>;
}

// ===========================================================================
// PREDICTIVE ANALYTICS
// ===========================================================================

export interface ResourcePrediction {
  metric: MetricName;
  predicted_value: number;
  confidence_interval: [number, number];
  prediction_time: string;
}

// ===========================================================================
// ANOMALY DETECTION
// ===========================================================================

export interface Anomaly {
  metric: MetricName;
  actual_value: number;
  expected_value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  details: string;
}

// ===========================================================================
// AUTO OPTIMIZER
// ===========================================================================

export type OptimizationAction =
  | 'scale_up'
  | 'scale_down'
  | 'adjust_job_concurrency'
  | 'reconfigure_database_pool'
  | 'throttle_requests';

export interface OptimizationRecommendation {
  action: OptimizationAction;
  resource: string;
  reason: string;
  confidence: number;
  estimated_impact: string;
}

// ===========================================================================
// ALERTING
// ===========================================================================

export interface Alert {
  id: string;
  anomaly: Anomaly;
  status: 'open' | 'acknowledged' | 'resolved';
  title: string;
  summary: string;
  recommendations: OptimizationRecommendation[];
  created_at: string;
}

// ===========================================================================
// CAPACITY PLANNING
// ===========================================================================

export interface CapacityPlan {
  resource: string;
  current_capacity: number;
  recommended_capacity: number;
  reason: string;
  projected_utilization: number;
}

// ===========================================================================
// PERFORMANCE PROFILING
// ===========================================================================

export interface Bottleneck {
  resource: string;
  service: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  potential_impact: string;
}

// ===========================================================================
// COST OPTIMIZATION
// ===========================================================================

export interface CostAnalysis {
  resource: string;
  current_cost: number;
  optimized_cost: number;
  savings: number;
  recommendations: OptimizationRecommendation[];
}

// ===========================================================================
// SYSTEM INSIGHTS
// ===========================================================================

export interface SystemInsight {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  recommendations: OptimizationRecommendation[];
}
