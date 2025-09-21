"use client";

import React, { useMemo } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import {
  MoreVertical,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Download,
  Eye,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  Film,
  Image,
  FileText,
  Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { Job, JobStatus, JobType } from '@/types/job';
import { cn } from '@/lib/utils';

interface JobCardProps {
  job: Job;
  selected?: boolean;
  onSelect?: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  viewMode?: 'list' | 'grid';
  showCheckbox?: boolean;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  selected = false,
  onSelect,
  onRetry,
  onCancel,
  onDelete,
  onView,
  viewMode = 'list',
  showCheckbox = true
}) => {
  const { toast } = useToast();

  // Get status configuration
  const statusConfig = useMemo(() => {
    const configs: Record<JobStatus, {
      icon: React.ReactNode;
      color: string;
      bgColor: string;
      label: string;
    }> = {
      completed: {
        icon: <CheckCircle2 className="h-4 w-4" />,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        label: 'Completed'
      },
      failed: {
        icon: <XCircle className="h-4 w-4" />,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        label: 'Failed'
      },
      processing: {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        label: 'Processing'
      },
      queued: {
        icon: <Clock className="h-4 w-4" />,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        label: 'Queued'
      },
      cancelled: {
        icon: <AlertCircle className="h-4 w-4" />,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        label: 'Cancelled'
      }
    };
    
    return configs[job.status] || configs.queued;
  }, [job.status]);

  // Get job type icon
  const getJobTypeIcon = (type: JobType) => {
    switch (type) {
      case 'single':
        return <Film className="h-4 w-4" />;
      case 'batch':
        return <Layers className="h-4 w-4" />;
      case 'template':
        return <FileText className="h-4 w-4" />;
      default:
        return <Film className="h-4 w-4" />;
    }
  };

  // Copy job ID to clipboard
  const handleCopyId = () => {
    navigator.clipboard.writeText(job.id);
    toast({
      title: 'Copied',
      description: 'Job ID copied to clipboard',
    });
  };

  // Download result
  const handleDownload = () => {
    if (job.resultUrl) {
      window.open(job.resultUrl, '_blank');
    }
  };

  // Calculate processing duration
  const processingDuration = useMemo(() => {
    if (!job.startedAt) return null;
    
    const start = new Date(job.startedAt);
    const end = job.completedAt ? new Date(job.completedAt) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    return `${minutes}m ${seconds}s`;
  }, [job.startedAt, job.completedAt]);

  if (viewMode === 'grid') {
    return (
      <Card className={cn(
        "relative transition-all hover:shadow-lg",
        selected && "ring-2 ring-primary"
      )}>
        {showCheckbox && (
          <div className="absolute top-4 left-4 z-10">
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2 mb-2">
                {getJobTypeIcon(job.type)}
                <Badge variant="outline" className="text-xs">
                  {job.type}
                </Badge>
              </div>
              
              <h3 className="font-semibold text-sm truncate">
                {job.name || `Job ${job.id.slice(0, 8)}`}
              </h3>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs text-gray-500 truncate cursor-pointer" onClick={handleCopyId}>
                      {job.id}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Click to copy ID</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView && (
                  <DropdownMenuItem onClick={onView}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                )}
                
                {job.status === 'completed' && job.resultUrl && (
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Result
                  </DropdownMenuItem>
                )}
                
                {(job.status === 'failed' || job.status === 'cancelled') && onRetry && (
                  <DropdownMenuItem onClick={onRetry}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Job
                  </DropdownMenuItem>
                )}
                
                {job.status === 'processing' && onCancel && (
                  <DropdownMenuItem onClick={onCancel}>
                    <Pause className="h-4 w-4 mr-2" />
                    Cancel Job
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={handleCopyId}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy ID
                </DropdownMenuItem>
                
                {onDelete && (
                  <DropdownMenuItem onClick={onDelete} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Job
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {/* Status Badge */}
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
            statusConfig.color,
            statusConfig.bgColor
          )}>
            {statusConfig.icon}
            {statusConfig.label}
          </div>
          
          {/* Progress Bar */}
          {job.status === 'processing' && job.progress !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Progress</span>
                <span>{job.progress}%</span>
              </div>
              <Progress value={job.progress} className="h-1.5" />
            </div>
          )}
          
          {/* Metadata */}
          <div className="space-y-1.5 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Created</span>
              <span>{formatDistanceToNow(parseISO(job.createdAt), { addSuffix: true })}</span>
            </div>
            
            {processingDuration && (
              <div className="flex justify-between">
                <span>Duration</span>
                <span>{processingDuration}</span>
              </div>
            )}
            
            {job.elements && (
              <div className="flex justify-between">
                <span>Elements</span>
                <span>{job.elements.length}</span>
              </div>
            )}
          </div>
          
          {/* Error Message */}
          {job.status === 'failed' && job.error && (
            <div className="p-2 bg-red-50 rounded text-xs text-red-600">
              {job.error}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // List View
  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      selected && "ring-2 ring-primary"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Checkbox */}
          {showCheckbox && (
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          
          {/* Status Icon */}
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full",
            statusConfig.bgColor
          )}>
            <div className={statusConfig.color}>
              {statusConfig.icon}
            </div>
          </div>
          
          {/* Job Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">
                {job.name || `Job ${job.id.slice(0, 8)}`}
              </h3>
              
              <Badge variant="outline" className="text-xs">
                {getJobTypeIcon(job.type)}
                <span className="ml-1">{job.type}</span>
              </Badge>
              
              {job.templateId && (
                <Badge variant="secondary" className="text-xs">
                  Template: {job.templateId}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-pointer hover:text-gray-700" onClick={handleCopyId}>
                      ID: {job.id.slice(0, 8)}...
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Click to copy full ID</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <span>•</span>
              <span>{format(parseISO(job.createdAt), 'MMM dd, yyyy HH:mm')}</span>
              
              {processingDuration && (
                <>
                  <span>•</span>
                  <span>Duration: {processingDuration}</span>
                </>
              )}
              
              {job.elements && (
                <>
                  <span>•</span>
                  <span>{job.elements.length} elements</span>
                </>
              )}
            </div>
            
            {/* Error Message */}
            {job.status === 'failed' && job.error && (
              <div className="mt-2 text-xs text-red-600">
                Error: {job.error}
              </div>
            )}
          </div>
          
          {/* Progress */}
          {job.status === 'processing' && job.progress !== undefined && (
            <div className="w-32">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{job.progress}%</span>
              </div>
              <Progress value={job.progress} className="h-2" />
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            {job.status === 'completed' && job.resultUrl && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDownload}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download Result</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {(job.status === 'failed' || job.status === 'cancelled') && onRetry && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onRetry}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Retry Job</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {job.status === 'processing' && onCancel && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onCancel}
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cancel Job</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView && (
                  <DropdownMenuItem onClick={onView}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem onClick={handleCopyId}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy ID
                </DropdownMenuItem>
                
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Job
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};