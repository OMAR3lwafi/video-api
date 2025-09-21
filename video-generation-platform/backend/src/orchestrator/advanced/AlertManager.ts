
import { Anomaly, Alert, OptimizationRecommendation } from './types';
import { AutoOptimizer } from './AutoOptimizer';

/**
 * Alert Manager
 * Creates and manages alerts based on detected anomalies.
 */
export class AlertManager {
  private static instance: AlertManager;
  private alerts: Alert[] = [];

  private constructor() {}

  public static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  /**
   * Creates an alert for a given anomaly.
   * @param anomaly The anomaly to create an alert for.
   */
  public async createAlert(anomaly: Anomaly): Promise<void> {
    const recommendations = await AutoOptimizer.getInstance().getRecommendations(anomaly);
    const alert: Alert = {
      id: `alert-${Date.now()}`,
      anomaly,
      status: 'open',
      title: `Anomaly detected: ${anomaly.metric}`,
      summary: anomaly.details,
      recommendations,
      created_at: new Date().toISOString(),
    };

    this.alerts.push(alert);

    // In a real implementation, this would send the alert to a notification service (e.g., PagerDuty, Slack).
    console.log('New alert created:', alert);
  }

  public getOpenAlerts(): Alert[] {
    return this.alerts.filter((alert) => alert.status === 'open');
  }
}
