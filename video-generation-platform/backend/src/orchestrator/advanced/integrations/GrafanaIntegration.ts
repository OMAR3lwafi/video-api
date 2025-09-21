
import { Alert } from '../types';

/**
 * Grafana Integration
 * Handles integration with Grafana for visualization and alerting.
 */
export class GrafanaIntegration {
  /**
   * Creates a Grafana annotation for an alert.
   * @param alert The alert to create an annotation for.
   */
  public static async createAnnotation(alert: Alert): Promise<void> {
    const annotation = {
      time: new Date(alert.created_at).getTime(),
      text: alert.title,
      tags: ['anomaly', alert.anomaly.severity],
    };

    // In a real implementation, this would send the annotation to the Grafana API.
    console.log('Creating Grafana annotation:', annotation);
  }
}
