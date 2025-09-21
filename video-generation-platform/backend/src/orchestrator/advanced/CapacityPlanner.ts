
import { ResourcePrediction, CapacityPlan } from './types';

/**
 * Capacity Planner
 * Provides resource scaling recommendations based on predictive analytics.
 */
export class CapacityPlanner {
  private static instance: CapacityPlanner;

  private constructor() {}

  public static getInstance(): CapacityPlanner {
    if (!CapacityPlanner.instance) {
      CapacityPlanner.instance = new CapacityPlanner();
    }
    return CapacityPlanner.instance;
  }

  /**
   * Generates a capacity plan based on resource predictions.
   * @param predictions A list of resource predictions.
   * @returns A list of capacity plans.
   */
  public async generatePlan(predictions: ResourcePrediction[]): Promise<CapacityPlan[]> {
    const plans: CapacityPlan[] = [];

    for (const prediction of predictions) {
      const { metric, predicted_value } = prediction;
      // Placeholder logic for capacity planning
      if (predicted_value > 80) {
        plans.push({
          resource: this.getResourceForMetric(metric),
          current_capacity: 100, // Placeholder
          recommended_capacity: 150, // Placeholder
          reason: `Predicted ${metric} to exceed 80%`,
          projected_utilization: predicted_value,
        });
      }
    }

    return plans;
  }

  private getResourceForMetric(metric: string): string {
    if (metric.includes('cpu')) return 'cpu';
    if (metric.includes('memory')) return 'memory';
    return 'general';
  }
}
