"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { format, startOfDay, startOfWeek, startOfMonth, eachDayOfInterval, subDays } from 'date-fns';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  Zap,
  FileVideo,
  DollarSign,
  Users,
  ArrowUp,
  ArrowDown,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useJobAnalytics } from '@/hooks/useJobAnalytics';
import { cn } from '@/lib/utils';

interface JobAnalyticsProps {
  className?: string;
  showInsights?: boolean;
  dateRange?: 'today' | 'week' | 'month' | 'year';
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeLabel = 'from yesterday',
  icon,
  description,
  trend = 'neutral'
}) => {
  const getTrendIcon = () => {
    if (!change) return null;
    
    if (change > 0) {
      return <ArrowUp className="h-4 w-4" />;
    } else if (change < 0) {
      return <ArrowDown className="h-4 w-4" />;
    }
    return null;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">{title}</span>
          <div className="p-2 bg-gray-100 rounded-lg">
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className={cn("flex items-center gap-1 text-xs mt-1", getTrendColor())}>
            {getTrendIcon()}
            <span>{Math.abs(change)}%</span>
            <span className="text-gray-500">{changeLabel}</span>
          </div>
        )}
        {description && (
          <p className="text-xs text-gray-500 mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};

export const JobAnalytics: React.FC<JobAnalyticsProps> = ({
  className,
  showInsights = true,
  dateRange: initialDateRange = 'week'
}) => {
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [selectedMetric, setSelectedMetric] = useState<'jobs' | 'duration' | 'success'>('jobs');
  const { analytics, loading, fetchAnalytics } = useJobAnalytics();

  useEffect(() => {
    fetchAnalytics(dateRange);
  }, [dateRange]);

  // Process data for charts
  const processedData = useMemo(() => {
    if (!analytics) return null;

    // Status distribution for pie chart
    const statusData = [
      { name: 'Completed', value: analytics.statusDistribution.completed, color: '#10B981' },
      { name: 'Failed', value: analytics.statusDistribution.failed, color: '#EF4444' },
      { name: 'Processing', value: analytics.statusDistribution.processing, color: '#3B82F6' },
      { name: 'Queued', value: analytics.statusDistribution.queued, color: '#F59E0B' },
      { name: 'Cancelled', value: analytics.statusDistribution.cancelled, color: '#6B7280' }
    ].filter(item => item.value > 0);

    // Time series data
    const timeSeriesData = analytics.timeSeries.map(point => ({
      date: format(new Date(point.date), 'MMM dd'),
      jobs: point.jobs,
      successful: point.successful,
      failed: point.failed,
      avgDuration: point.avgDuration,
      successRate: point.successRate
    }));

    // Job type distribution
    const jobTypeData = [
      { type: 'Single', count: analytics.jobTypeDistribution.single },
      { type: 'Batch', count: analytics.jobTypeDistribution.batch },
      { type: 'Template', count: analytics.jobTypeDistribution.template }
    ];

    // Processing time distribution
    const processingTimeData = [
      { range: '<30s', count: analytics.processingTimeDistribution.quick },
      { range: '30s-2m', count: analytics.processingTimeDistribution.normal },
      { range: '2m-5m', count: analytics.processingTimeDistribution.slow },
      { range: '>5m', count: analytics.processingTimeDistribution.verySlow }
    ];

    // Performance metrics for radial bar
    const performanceData = [
      {
        name: 'Success Rate',
        value: analytics.metrics.successRate,
        fill: '#10B981'
      },
      {
        name: 'Queue Efficiency',
        value: analytics.metrics.queueEfficiency,
        fill: '#3B82F6'
      },
      {
        name: 'Resource Usage',
        value: analytics.metrics.resourceUtilization,
        fill: '#F59E0B'
      }
    ];

    return {
      statusData,
      timeSeriesData,
      jobTypeData,
      processingTimeData,
      performanceData
    };
  }, [analytics]);

  if (loading || !analytics || !processedData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="h-8 w-8 animate-pulse text-gray-400" />
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Job Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">
            Monitor your video processing performance and trends
          </p>
        </div>
        
        <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Jobs"
          value={analytics.metrics.totalJobs.toLocaleString()}
          change={analytics.metrics.jobsGrowth}
          icon={<FileVideo className="h-5 w-5 text-blue-600" />}
          trend={analytics.metrics.jobsGrowth > 0 ? 'up' : 'down'}
        />
        
        <MetricCard
          title="Success Rate"
          value={`${analytics.metrics.successRate.toFixed(1)}%`}
          change={analytics.metrics.successRateChange}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          trend={analytics.metrics.successRateChange > 0 ? 'up' : 'down'}
        />
        
        <MetricCard
          title="Avg Processing Time"
          value={`${analytics.metrics.avgProcessingTime}s`}
          change={analytics.metrics.processingTimeChange}
          icon={<Clock className="h-5 w-5 text-yellow-600" />}
          trend={analytics.metrics.processingTimeChange < 0 ? 'up' : 'down'}
        />
        
        <MetricCard
          title="Active Jobs"
          value={analytics.metrics.activeJobs}
          description={`${analytics.metrics.queuedJobs} in queue`}
          icon={<Activity className="h-5 w-5 text-purple-600" />}
        />
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Job Volume Over Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Job Volume</CardTitle>
                <CardDescription>Daily job processing volume</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={processedData.timeSeriesData}>
                    <defs>
                      <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="jobs" 
                      stroke="#3B82F6" 
                      fillOpacity={1} 
                      fill="url(#colorJobs)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status Distribution</CardTitle>
                <CardDescription>Job completion status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={processedData.statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {processedData.statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RadialBarChart 
                    cx="50%" 
                    cy="50%" 
                    innerRadius="10%" 
                    outerRadius="90%" 
                    data={processedData.performanceData}
                  >
                    <RadialBar
                      minAngle={15}
                      label={{ position: 'insideStart', fill: '#fff' }}
                      background
                      clockWise
                      dataKey="value"
                    />
                    <Legend 
                      iconSize={10}
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                    />
                    <Tooltip />
                  </RadialBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Processing Time Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Processing Time Distribution</CardTitle>
                <CardDescription>Jobs grouped by processing duration</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={processedData.processingTimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          {/* Job Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Type Distribution</CardTitle>
              <CardDescription>Breakdown by job type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {processedData.jobTypeData.map((type) => {
                  const percentage = (type.count / analytics.metrics.totalJobs) * 100;
                  return (
                    <div key={type.type} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{type.type}</span>
                        <span className="font-medium">{type.count} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Template Usage */}
          {analytics.topTemplates && analytics.topTemplates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Templates</CardTitle>
                <CardDescription>Most used templates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.topTemplates.map((template, index) => (
                    <div key={template.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">#{index + 1}</span>
                        <span className="text-sm">{template.name}</span>
                      </div>
                      <Badge variant="secondary">{template.count} uses</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Success Rate Trend</CardTitle>
              <CardDescription>Job success rate over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={processedData.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="successRate" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    name="Success Rate (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Comparative Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparative Analysis</CardTitle>
              <CardDescription>Success vs Failed jobs over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={processedData.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="successful" 
                    stackId="1"
                    stroke="#10B981" 
                    fill="#10B981" 
                    name="Successful"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="failed" 
                    stackId="1"
                    stroke="#EF4444" 
                    fill="#EF4444" 
                    name="Failed"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Insights and Recommendations */}
      {showInsights && analytics.insights && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Insights & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.insights.map((insight, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  {insight.type === 'improvement' && (
                    <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                  )}
                  {insight.type === 'warning' && (
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  )}
                  {insight.type === 'issue' && (
                    <TrendingDown className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{insight.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{insight.description}</p>
                    {insight.action && (
                      <Button variant="link" size="sm" className="px-0 h-auto mt-2">
                        {insight.action}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};