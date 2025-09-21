import { useState, useCallback } from 'react';
import { JobAnalytics, JobInsight } from '@/types/job';

export const useJobAnalytics = () => {
  const [analytics, setAnalytics] = useState<JobAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (dateRange: 'today' | 'week' | 'month' | 'year' = 'week') => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/analytics?range=${dateRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      
      // Generate insights based on analytics
      const insights = generateInsights(data);
      
      setAnalytics({
        ...data,
        insights
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      
      // Mock data for development
      if (process.env.NODE_ENV === 'development') {
        setAnalytics(generateMockAnalytics(dateRange));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    analytics,
    loading,
    error,
    fetchAnalytics
  };
};

function generateInsights(analytics: JobAnalytics): JobInsight[] {
  const insights: JobInsight[] = [];

  // Success rate insights
  if (analytics.metrics.successRate < 70) {
    insights.push({
      type: 'issue',
      title: 'Low Success Rate Detected',
      description: `Your job success rate is ${analytics.metrics.successRate.toFixed(1)}%. Consider reviewing failed jobs to identify common issues.`,
      metric: 'successRate',
      value: analytics.metrics.successRate,
      action: 'View Failed Jobs',
      priority: 'high'
    });
  } else if (analytics.metrics.successRate > 95) {
    insights.push({
      type: 'improvement',
      title: 'Excellent Success Rate',
      description: `Your job success rate is ${analytics.metrics.successRate.toFixed(1)}%. Keep up the great work!`,
      metric: 'successRate',
      value: analytics.metrics.successRate,
      priority: 'low'
    });
  }

  // Processing time insights
  if (analytics.metrics.avgProcessingTime > 180) {
    insights.push({
      type: 'warning',
      title: 'High Average Processing Time',
      description: `Jobs are taking an average of ${analytics.metrics.avgProcessingTime}s to complete. Consider optimizing your video configurations.`,
      metric: 'avgProcessingTime',
      value: analytics.metrics.avgProcessingTime,
      action: 'Optimize Settings',
      priority: 'medium'
    });
  }

  // Queue efficiency insights
  if (analytics.metrics.queueEfficiency < 60) {
    insights.push({
      type: 'warning',
      title: 'Queue Bottleneck Detected',
      description: 'Your queue efficiency is low. Consider scaling up processing capacity or optimizing job distribution.',
      metric: 'queueEfficiency',
      value: analytics.metrics.queueEfficiency,
      action: 'Scale Resources',
      priority: 'medium'
    });
  }

  // Resource utilization insights
  if (analytics.metrics.resourceUtilization > 85) {
    insights.push({
      type: 'warning',
      title: 'High Resource Usage',
      description: 'Your resource utilization is approaching capacity. Consider scaling to handle increased load.',
      metric: 'resourceUtilization',
      value: analytics.metrics.resourceUtilization,
      action: 'Increase Capacity',
      priority: 'high'
    });
  }

  // Growth trend insights
  if (analytics.metrics.jobsGrowth > 50) {
    insights.push({
      type: 'improvement',
      title: 'Rapid Growth Detected',
      description: `Job volume has increased by ${analytics.metrics.jobsGrowth}%. Ensure your infrastructure can handle this growth.`,
      metric: 'jobsGrowth',
      value: analytics.metrics.jobsGrowth,
      priority: 'medium'
    });
  } else if (analytics.metrics.jobsGrowth < -20) {
    insights.push({
      type: 'warning',
      title: 'Declining Job Volume',
      description: `Job volume has decreased by ${Math.abs(analytics.metrics.jobsGrowth)}%. Review your usage patterns.`,
      metric: 'jobsGrowth',
      value: analytics.metrics.jobsGrowth,
      priority: 'low'
    });
  }

  return insights;
}

function generateMockAnalytics(dateRange: string): JobAnalytics {
  const days = dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 365;
  
  // Generate time series data
  const timeSeries = Array.from({ length: Math.min(days, 30) }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - i - 1));
    
    const jobs = Math.floor(Math.random() * 100) + 50;
    const successful = Math.floor(jobs * (0.7 + Math.random() * 0.25));
    const failed = jobs - successful;
    
    return {
      date: date.toISOString(),
      jobs,
      successful,
      failed,
      avgDuration: Math.floor(Math.random() * 120) + 30,
      successRate: (successful / jobs) * 100
    };
  });

  const totalJobs = timeSeries.reduce((sum, day) => sum + day.jobs, 0);
  const totalSuccessful = timeSeries.reduce((sum, day) => sum + day.successful, 0);
  const avgProcessingTime = Math.floor(Math.random() * 120) + 30;

  const analytics: JobAnalytics = {
    metrics: {
      totalJobs,
      activeJobs: Math.floor(Math.random() * 10),
      queuedJobs: Math.floor(Math.random() * 20),
      successRate: (totalSuccessful / totalJobs) * 100,
      avgProcessingTime,
      jobsGrowth: Math.floor(Math.random() * 60) - 20,
      successRateChange: Math.floor(Math.random() * 10) - 5,
      processingTimeChange: Math.floor(Math.random() * 20) - 10,
      queueEfficiency: Math.floor(Math.random() * 40) + 60,
      resourceUtilization: Math.floor(Math.random() * 40) + 50
    },
    
    statusDistribution: {
      completed: Math.floor(totalJobs * 0.75),
      failed: Math.floor(totalJobs * 0.15),
      processing: Math.floor(Math.random() * 10),
      queued: Math.floor(Math.random() * 20),
      cancelled: Math.floor(totalJobs * 0.05)
    },
    
    jobTypeDistribution: {
      single: Math.floor(totalJobs * 0.5),
      batch: Math.floor(totalJobs * 0.3),
      template: Math.floor(totalJobs * 0.2)
    },
    
    processingTimeDistribution: {
      quick: Math.floor(totalJobs * 0.3),
      normal: Math.floor(totalJobs * 0.4),
      slow: Math.floor(totalJobs * 0.2),
      verySlow: Math.floor(totalJobs * 0.1)
    },
    
    timeSeries,
    
    topTemplates: [
      { id: 'marketing-video', name: 'Marketing Video', count: 234, successRate: 95.5 },
      { id: 'social-media', name: 'Social Media Post', count: 189, successRate: 92.3 },
      { id: 'product-demo', name: 'Product Demo', count: 156, successRate: 88.7 },
      { id: 'tutorial', name: 'Tutorial Video', count: 98, successRate: 91.2 },
      { id: 'testimonial', name: 'Customer Testimonial', count: 67, successRate: 94.8 }
    ]
  };

  analytics.insights = generateInsights(analytics);
  
  return analytics;
}