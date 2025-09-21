"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  Activity,
  Pause,
  Play,
  RefreshCw,
  X,
  Maximize2,
  Minimize2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { useJobStore } from '@/stores/jobStore';
import { useActiveJobs } from '@/hooks/useActiveJobs';
import { Job, JobStatus } from '@/types/job';
import { cn } from '@/lib/utils';

interface ActiveJobsPanelProps {
  className?: string;
  onJobClick?: (job: Job) => void;
  maxHeight?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface ActiveJobItemProps {
  job: Job;
  onClick?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

const ActiveJobItem: React.FC<ActiveJobItemProps> = ({
  job,
  onClick,
  onCancel,
  onRetry,
  onPause,
  onResume
}) => {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = useMemo(() => {
    switch (job.status) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  }, [job.status]);

  const getProgressColor = (progress: number) => {
    if (progress < 30) return 'bg-red-500';
    if (progress < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="group border rounded-lg p-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
            {statusIcon}
          </div>

          {/* Job Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 
                className="font-medium text-sm truncate cursor-pointer hover:underline"
                onClick={onClick}
              >
                {job.name || `Job ${job.id.slice(0, 8)}`}
              </h4>
              
              <div className="flex items-center gap-1">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    {expanded ? (
                      <Minimize2 className="h-3 w-3" />
                    ) : (
                      <Maximize2 className="h-3 w-3" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {job.status === 'processing' && (
                      <>
                        {onPause && (
                          <DropdownMenuItem onClick={onPause}>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </DropdownMenuItem>
                        )}
                        {onCancel && (
                          <DropdownMenuItem onClick={onCancel}>
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    
                    {job.status === 'paused' && onResume && (
                      <DropdownMenuItem onClick={onResume}>
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </DropdownMenuItem>
                    )}
                    
                    {job.status === 'queued' && onCancel && (
                      <DropdownMenuItem onClick={onCancel}>
                        <X className="h-4 w-4 mr-2" />
                        Remove from Queue
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Status and Time */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Badge variant={job.status === 'processing' ? 'default' : 'secondary'} className="text-xs">
                {job.status}
              </Badge>
              <span>•</span>
              <span>
                Started {formatDistanceToNow(parseISO(job.startedAt || job.createdAt), { addSuffix: true })}
              </span>
            </div>

            {/* Progress Bar */}
            {job.progress !== undefined && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">
                    {job.currentStep || 'Processing...'}
                  </span>
                  <span className="font-medium">{job.progress}%</span>
                </div>
                <Progress 
                  value={job.progress} 
                  className="h-2"
                  indicatorClassName={getProgressColor(job.progress)}
                />
                
                {/* ETA */}
                {job.estimatedCompletion && (
                  <div className="text-xs text-gray-500 mt-1">
                    ETA: {formatDistanceToNow(parseISO(job.estimatedCompletion), { addSuffix: true })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        <CollapsibleContent>
          <div className="mt-3 pt-3 border-t space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Job ID:</span>
                <p className="font-mono truncate">{job.id}</p>
              </div>
              
              <div>
                <span className="text-gray-500">Type:</span>
                <p className="capitalize">{job.type}</p>
              </div>
              
              {job.templateId && (
                <div>
                  <span className="text-gray-500">Template:</span>
                  <p className="truncate">{job.templateId}</p>
                </div>
              )}
              
              {job.elements && (
                <div>
                  <span className="text-gray-500">Elements:</span>
                  <p>{job.elements.length} items</p>
                </div>
              )}
              
              {job.processingTime && (
                <div>
                  <span className="text-gray-500">Processing Time:</span>
                  <p>{job.processingTime}</p>
                </div>
              )}
              
              {job.queuePosition !== undefined && job.status === 'queued' && (
                <div>
                  <span className="text-gray-500">Queue Position:</span>
                  <p>#{job.queuePosition}</p>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {job.status === 'processing' && (
                <>
                  {onPause && (
                    <Button size="sm" variant="outline" onClick={onPause}>
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </Button>
                  )}
                  {onCancel && (
                    <Button size="sm" variant="destructive" onClick={onCancel}>
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  )}
                </>
              )}
              
              {job.status === 'paused' && onResume && (
                <Button size="sm" variant="default" onClick={onResume}>
                  <Play className="h-3 w-3 mr-1" />
                  Resume
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export const ActiveJobsPanel: React.FC<ActiveJobsPanelProps> = ({
  className,
  onJobClick,
  maxHeight = '400px',
  autoRefresh = true,
  refreshInterval = 3000
}) => {
  const { toast } = useToast();
  const { activeJobs, loading, error, fetchActiveJobs, subscribeToUpdates } = useActiveJobs();
  const { cancelJob, pauseJob, resumeJob } = useJobStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initial fetch and subscription
  useEffect(() => {
    fetchActiveJobs();
    const unsubscribe = subscribeToUpdates();
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !activeJobs.length) return;
    
    const interval = setInterval(() => {
      fetchActiveJobs();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, activeJobs.length]);

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchActiveJobs();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Job actions
  const handleCancel = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      toast({
        title: 'Job Cancelled',
        description: 'The job has been cancelled successfully.',
      });
      fetchActiveJobs();
    } catch (error) {
      toast({
        title: 'Cancel Failed',
        description: 'Failed to cancel the job. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handlePause = async (jobId: string) => {
    try {
      await pauseJob(jobId);
      toast({
        title: 'Job Paused',
        description: 'The job has been paused successfully.',
      });
      fetchActiveJobs();
    } catch (error) {
      toast({
        title: 'Pause Failed',
        description: 'Failed to pause the job. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleResume = async (jobId: string) => {
    try {
      await resumeJob(jobId);
      toast({
        title: 'Job Resumed',
        description: 'The job has been resumed successfully.',
      });
      fetchActiveJobs();
    } catch (error) {
      toast({
        title: 'Resume Failed',
        description: 'Failed to resume the job. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Group jobs by status
  const groupedJobs = useMemo(() => {
    const groups: Record<string, Job[]> = {
      processing: [],
      queued: [],
      paused: []
    };
    
    activeJobs.forEach(job => {
      const group = groups[job.status];
      if (group) {
        group.push(job);
      }
    });
    
    return groups;
  }, [activeJobs]);

  const totalJobs = activeJobs.length;
  const processingCount = groupedJobs.processing.length;
  const queuedCount = groupedJobs.queued.length;
  const pausedCount = groupedJobs.paused.length;

  return (
    <Card className={cn("relative", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Active Jobs</CardTitle>
            {totalJobs > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalJobs}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={loading || isRefreshing}
                    className="h-8 w-8"
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4",
                      (loading || isRefreshing) && "animate-spin"
                    )} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Status Summary */}
        {totalJobs > 0 && isExpanded && (
          <div className="flex items-center gap-4 mt-3 text-sm">
            {processingCount > 0 && (
              <div className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                <span className="text-gray-600">{processingCount} processing</span>
              </div>
            )}
            
            {queuedCount > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-500" />
                <span className="text-gray-600">{queuedCount} queued</span>
              </div>
            )}
            
            {pausedCount > 0 && (
              <div className="flex items-center gap-1">
                <Pause className="h-3 w-3 text-orange-500" />
                <span className="text-gray-600">{pausedCount} paused</span>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-0">
          {error ? (
            <div className="p-4 text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Failed to load active jobs</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          ) : totalJobs === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No active jobs</p>
              <p className="text-xs text-gray-400 mt-1">
                All jobs have been completed
              </p>
            </div>
          ) : (
            <ScrollArea className="w-full" style={{ maxHeight }}>
              <div className="p-4 space-y-3">
                {/* Processing Jobs */}
                {groupedJobs.processing.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Processing ({groupedJobs.processing.length})
                    </h3>
                    {groupedJobs.processing.map(job => (
                      <ActiveJobItem
                        key={job.id}
                        job={job}
                        onClick={() => onJobClick?.(job)}
                        onCancel={() => handleCancel(job.id)}
                        onPause={() => handlePause(job.id)}
                      />
                    ))}
                  </div>
                )}
                
                {/* Queued Jobs */}
                {groupedJobs.queued.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Queued ({groupedJobs.queued.length})
                    </h3>
                    {groupedJobs.queued.map(job => (
                      <ActiveJobItem
                        key={job.id}
                        job={job}
                        onClick={() => onJobClick?.(job)}
                        onCancel={() => handleCancel(job.id)}
                      />
                    ))}
                  </div>
                )}
                
                {/* Paused Jobs */}
                {groupedJobs.paused.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Paused ({groupedJobs.paused.length})
                    </h3>
                    {groupedJobs.paused.map(job => (
                      <ActiveJobItem
                        key={job.id}
                        job={job}
                        onClick={() => onJobClick?.(job)}
                        onResume={() => handleResume(job.id)}
                        onCancel={() => handleCancel(job.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}
      
      {/* Real-time indicator */}
      {autoRefresh && totalJobs > 0 && (
        <div className="absolute top-2 right-2">
          <div className="relative">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};