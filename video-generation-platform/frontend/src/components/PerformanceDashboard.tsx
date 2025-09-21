import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Database,
  Server,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
  PieChart,
  Monitor,
  HardDrive,
  Cpu,
  MemoryStick,
  Network,
  Globe,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import { usePerformanceMonitoring } from '../utils/performance';
import clsx from 'clsx';

// Types for performance data
interface SystemMetrics {
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  uptime: number;
  bufferSize: number;
  metricsEnabled: boolean;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  avgResponseTime: number;
  memorySize: number;
  redisConnected: boolean;
}

interface DatabaseMetrics {
  totalQueries: number;
  slowQueries: number;
  failedQueries: number;
  avgQueryTime: number;
  cacheHits: number;
  cacheMisses: number;
  activeConnections: number;
  idleConnections: number;
  waitingCount: number;
  poolStats: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
}

interface CDNMetrics {
  uploads: number;
  downloads: number;
  invalidations: number;
  optimizations: number;
  cacheMisses: number;
  cacheHits: number;
  totalBandwidth: number;
  averageResponseTime: number;
  errorCount: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    cache: { status: 'healthy' | 'unhealthy'; details: any };
    database: { status: 'healthy' | 'unhealthy'; details: any };
    cdn: { status: 'healthy' | 'degraded' | 'unhealthy'; details: any };
  };
  performance: SystemMetrics;
}

// Custom hook for fetching performance data
const usePerformanceData = (refreshInterval: number = 30000) => {
  const queryClient = useQueryClient();

  const healthQuery = useQuery<HealthStatus>({
    queryKey: ['performance', 'health'],
    queryFn: async () => {
      const response = await fetch('/health/performance');
      if (!response.ok) throw new Error('Failed to fetch health data');
      return response.json();
    },
    refetchInterval: refreshInterval,
  });

  const cacheQuery = useQuery<{ data: CacheMetrics }>({
    queryKey: ['performance', 'cache'],
    queryFn: async () => {
      const response = await fetch('/admin/cache/stats');
      if (!response.ok) throw new Error('Failed to fetch cache stats');
      return response.json();
    },
    refetchInterval: refreshInterval,
  });

  const dbQuery = useQuery<{ data: DatabaseMetrics }>({
    queryKey: ['performance', 'database'],
    queryFn: async () => {
      const response = await fetch('/admin/db/stats');
      if (!response.ok) throw new Error('Failed to fetch database stats');
      return response.json();
    },
    refetchInterval: refreshInterval,
  });

  const cdnQuery = useQuery<{ data: { metrics: CDNMetrics } }>({
    queryKey: ['performance', 'cdn'],
    queryFn: async () => {
      const response = await fetch('/admin/cdn/stats');
      if (!response.ok) throw new Error('Failed to fetch CDN stats');
      return response.json();
    },
    refetchInterval: refreshInterval,
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['performance'] });
  };

  return {
    health: healthQuery.data,
    cache: cacheQuery.data?.data,
    database: dbQuery.data?.data,
    cdn: cdnQuery.data?.data.metrics,
    isLoading: healthQuery.isLoading || cacheQuery.isLoading || dbQuery.isLoading || cdnQuery.isLoading,
    error: healthQuery.error || cacheQuery.error || dbQuery.error || cdnQuery.error,
    refreshAll,
  };
};

// Utility functions
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'healthy': return 'text-green-500';
    case 'degraded': return 'text-yellow-500';
    case 'unhealthy': return 'text-red-500';
    default: return 'text-gray-500';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'healthy': return <CheckCircle className="w-5 h-5" />;
    case 'degraded': return <AlertCircle className="w-5 h-5" />;
    case 'unhealthy': return <XCircle className="w-5 h-5" />;
    default: return <Clock className="w-5 h-5" />;
  }
};

// Metric Card Component
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  color?: string;
}> = ({ title, value, icon, trend, subtitle, color = 'bg-white' }) => {
  const trendIcon = trend === 'up' ? <TrendingUp className="w-4 h-4 text-green-500" /> :
                   trend === 'down' ? <TrendingDown className="w-4 h-4 text-red-500" /> : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'p-6 rounded-lg shadow-sm border border-gray-200',
        color
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        {trendIcon && (
          <div className="flex items-center">
            {trendIcon}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Status Badge Component
const StatusBadge: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      status === 'healthy' && 'bg-green-100 text-green-800',
      status === 'degraded' && 'bg-yellow-100 text-yellow-800',
      status === 'unhealthy' && 'bg-red-100 text-red-800'
    )}>
      {getStatusIcon(status)}
      <span className="ml-1">{label || status}</span>
    </span>
  );
};

// Chart Component (simplified pie chart)
const SimpleChart: React.FC<{
  data: Array<{ name: string; value: number; color: string }>;
  title: string;
}> = ({ data, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600">{item.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">{item.value}</span>
                <span className="text-xs text-gray-500">({percentage.toFixed(1)}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Main Performance Dashboard Component
export const PerformanceDashboard: React.FC = () => {
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [showDetails, setShowDetails] = useState(false);
  const { renderCount } = usePerformanceMonitoring('PerformanceDashboard');

  const { health, cache, database, cdn, isLoading, error, refreshAll } = usePerformanceData(refreshInterval);

  // Calculate derived metrics
  const cacheHitRate = useMemo(() => {
    if (!cache) return 0;
    const total = cache.hits + cache.misses;
    return total > 0 ? (cache.hits / total) * 100 : 0;
  }, [cache]);

  const dbConnectionUtilization = useMemo(() => {
    if (!database) return 0;
    return database.poolStats.totalCount > 0
      ? ((database.poolStats.totalCount - database.poolStats.idleCount) / database.poolStats.totalCount) * 100
      : 0;
  }, [database]);

  const cdnCacheHitRate = useMemo(() => {
    if (!cdn) return 0;
    const total = cdn.cacheHits + cdn.cacheMisses;
    return total > 0 ? (cdn.cacheHits / total) * 100 : 0;
  }, [cdn]);

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-500 mr-2" />
            <h2 className="text-lg font-semibold text-red-900">
              Failed to Load Performance Data
            </h2>
          </div>
          <p className="text-red-700 mt-2">
            {(error as Error).message}
          </p>
          <button
            onClick={refreshAll}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Real-time monitoring of system performance and health
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={5000}>5 seconds</option>
            <option value={15000}>15 seconds</option>
            <option value={30000}>30 seconds</option>
            <option value={60000}>1 minute</option>
          </select>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            {showDetails ? <EyeOff className="w-5 h-5 mr-1" /> : <Eye className="w-5 h-5 mr-1" />}
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>

          <button
            onClick={refreshAll}
            disabled={isLoading}
            className={clsx(
              'flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RefreshCw className={clsx('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Health Status */}
      {health && (
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">System Health</h2>
                <p className="text-gray-600 mt-1">Overall system status and uptime</p>
              </div>
              <StatusBadge status={health.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(health.performance.uptime)}
                </p>
                <p className="text-sm text-gray-600">Uptime</p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {health.performance.totalRequests.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Total Requests</p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {health.performance.averageResponseTime.toFixed(2)}ms
                </p>
                <p className="text-sm text-gray-600">Avg Response Time</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cache && (
          <MetricCard
            title="Cache Hit Rate"
            value={`${cacheHitRate.toFixed(1)}%`}
            icon={<Database className="w-6 h-6 text-blue-600" />}
            trend={cacheHitRate > 80 ? 'up' : cacheHitRate < 50 ? 'down' : 'neutral'}
            subtitle={`${cache.hits + cache.misses} total operations`}
          />
        )}

        {database && (
          <MetricCard
            title="DB Connection Pool"
            value={`${dbConnectionUtilization.toFixed(1)}%`}
            icon={<Server className="w-6 h-6 text-green-600" />}
            trend={dbConnectionUtilization < 80 ? 'up' : 'down'}
            subtitle={`${database.poolStats.totalCount} total connections`}
          />
        )}

        {cdn && (
          <MetricCard
            title="CDN Cache Rate"
            value={`${cdnCacheHitRate.toFixed(1)}%`}
            icon={<Globe className="w-6 h-6 text-purple-600" />}
            trend={cdnCacheHitRate > 70 ? 'up' : 'down'}
            subtitle={`${formatBytes(cdn.totalBandwidth)} bandwidth`}
          />
        )}

        {health && (
          <MetricCard
            title="Error Rate"
            value={`${((health.performance.totalErrors / health.performance.totalRequests) * 100 || 0).toFixed(2)}%`}
            icon={<AlertCircle className="w-6 h-6 text-red-600" />}
            trend={health.performance.totalErrors === 0 ? 'up' : 'down'}
            subtitle={`${health.performance.totalErrors} total errors`}
          />
        )}
      </div>

      {/* Service Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Cache Service */}
        {cache && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Cache Service</h3>
              <StatusBadge status={cache.redisConnected ? 'healthy' : 'unhealthy'} />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Memory Usage</span>
                <span className="text-sm font-medium">{cache.memorySize} entries</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg Response Time</span>
                <span className="text-sm font-medium">{cache.avgResponseTime.toFixed(2)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Operations</span>
                <span className="text-sm font-medium">{(cache.sets + cache.deletes).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Database Service */}
        {database && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Database</h3>
              <StatusBadge status={database.activeConnections < database.poolStats.totalCount ? 'healthy' : 'degraded'} />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Connections</span>
                <span className="text-sm font-medium">{database.activeConnections}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg Query Time</span>
                <span className="text-sm font-medium">{database.avgQueryTime.toFixed(2)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Slow Queries</span>
                <span className="text-sm font-medium">{database.slowQueries}</span>
              </div>
            </div>
          </div>
        )}

        {/* CDN Service */}
        {cdn && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">CDN Service</h3>
              <StatusBadge status={cdn.errorCount === 0 ? 'healthy' : 'degraded'} />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Uploads</span>
                <span className="text-sm font-medium">{cdn.uploads.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Optimizations</span>
                <span className="text-sm font-medium">{cdn.optimizations.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg Response Time</span>
                <span className="text-sm font-medium">{cdn.averageResponseTime.toFixed(2)}ms</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Charts */}
      {showDetails && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
          >
            {/* Cache Operations Chart */}
            {cache && (
              <SimpleChart
                title="Cache Operations"
                data={[
                  { name: 'Hits', value: cache.hits, color: '#10b981' },
                  { name: 'Misses', value: cache.misses, color: '#ef4444' },
                  { name: 'Sets', value: cache.sets, color: '#3b82f6' },
                  { name: 'Deletes', value: cache.deletes, color: '#f59e0b' },
                ]}
              />
            )}

            {/* Database Queries Chart */}
            {database && (
              <SimpleChart
                title="Database Queries"
                data={[
                  { name: 'Total Queries', value: database.totalQueries, color: '#3b82f6' },
                  { name: 'Slow Queries', value: database.slowQueries, color: '#f59e0b' },
                  { name: 'Failed Queries', value: database.failedQueries, color: '#ef4444' },
                ]}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Component Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <p className="text-xs text-gray-600">
            Debug: Component rendered {renderCount} times | Refresh interval: {refreshInterval}ms
          </p>
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;
