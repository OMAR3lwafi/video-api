"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { JobCard } from './JobCard';
import { JobFilters } from './JobFilters';
import { BulkActionsBar } from './BulkActionsBar';
import { useJobStore } from '@/stores/jobStore';
import { useJobHistory } from '@/hooks/useJobHistory';
import { Job, JobStatus, JobType } from '@/types/job';

interface JobHistoryProps {
  onJobSelect?: (job: Job) => void;
  showBulkActions?: boolean;
  filterPresets?: JobFilters;
}

export const JobHistory: React.FC<JobHistoryProps> = ({
  onJobSelect,
  showBulkActions = true,
  filterPresets = {}
}) => {
  const { toast } = useToast();
  const { jobs, loading, error, pagination, filters, fetchJobs, updateFilters, refreshJobs } = useJobHistory();
  const { retryJob, cancelJob, deleteJob } = useJobStore();
  
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Initialize with filter presets
  useEffect(() => {
    if (Object.keys(filterPresets).length > 0) {
      updateFilters(filterPresets);
    }
  }, [filterPresets]);

  // Fetch jobs on mount and filter changes
  useEffect(() => {
    fetchJobs();
  }, [filters, pagination.page, pagination.limit, sortBy, sortOrder]);

  // Auto-refresh active jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some(job => 
      job.status === 'processing' || job.status === 'queued'
    );
    
    if (hasActiveJobs) {
      const interval = setInterval(() => {
        refreshJobs();
      }, 3000); // Refresh every 3 seconds
      
      return () => clearInterval(interval);
    }
  }, [jobs, refreshJobs]);

  // Filter jobs based on search query
  const filteredJobs = useMemo(() => {
    if (!searchQuery) return jobs;
    
    const query = searchQuery.toLowerCase();
    return jobs.filter(job => 
      job.id.toLowerCase().includes(query) ||
      job.name?.toLowerCase().includes(query) ||
      job.templateId?.toLowerCase().includes(query) ||
      job.type.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);

  // Sort jobs
  const sortedJobs = useMemo(() => {
    const sorted = [...filteredJobs].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return sorted;
  }, [filteredJobs, sortBy, sortOrder]);

  // Handle job selection
  const handleJobSelect = useCallback((job: Job) => {
    if (showBulkActions) {
      setSelectedJobs(prev => {
        const newSet = new Set(prev);
        if (newSet.has(job.id)) {
          newSet.delete(job.id);
        } else {
          newSet.add(job.id);
        }
        return newSet;
      });
    }
    
    onJobSelect?.(job);
  }, [showBulkActions, onJobSelect]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectedJobs.size === sortedJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(sortedJobs.map(job => job.id)));
    }
  }, [selectedJobs, sortedJobs]);

  // Handle job actions
  const handleRetry = async (jobId: string) => {
    try {
      await retryJob(jobId);
      toast({
        title: 'Job Requeued',
        description: 'The job has been queued for retry.',
      });
      refreshJobs();
    } catch (error) {
      toast({
        title: 'Retry Failed',
        description: 'Failed to retry the job. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      toast({
        title: 'Job Cancelled',
        description: 'The job has been cancelled successfully.',
      });
      refreshJobs();
    } catch (error) {
      toast({
        title: 'Cancel Failed',
        description: 'Failed to cancel the job. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      toast({
        title: 'Job Deleted',
        description: 'The job has been deleted successfully.',
      });
      refreshJobs();
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete the job. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action: string) => {
    const jobIds = Array.from(selectedJobs);
    
    try {
      switch (action) {
        case 'retry':
          await Promise.all(jobIds.map(id => retryJob(id)));
          toast({
            title: 'Jobs Requeued',
            description: `${jobIds.length} jobs have been queued for retry.`,
          });
          break;
        case 'cancel':
          await Promise.all(jobIds.map(id => cancelJob(id)));
          toast({
            title: 'Jobs Cancelled',
            description: `${jobIds.length} jobs have been cancelled.`,
          });
          break;
        case 'delete':
          await Promise.all(jobIds.map(id => deleteJob(id)));
          toast({
            title: 'Jobs Deleted',
            description: `${jobIds.length} jobs have been deleted.`,
          });
          break;
      }
      
      setSelectedJobs(new Set());
      refreshJobs();
    } catch (error) {
      toast({
        title: 'Bulk Action Failed',
        description: 'Failed to perform bulk action. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Get status icon
  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-2xl font-bold">Job History</CardTitle>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {Object.keys(filters).length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {Object.keys(filters).length}
                  </Badge>
                )}
              </Button>
              
              <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="grid">Grid</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="icon"
                onClick={refreshJobs}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search jobs by ID, name, or template..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Filters */}
          {showFilters && (
            <JobFilters
              filters={filters}
              onFiltersChange={updateFilters}
              onReset={() => updateFilters({})}
            />
          )}
          
          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Sort by:</span>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Created Date</SelectItem>
                <SelectItem value="updatedAt">Updated Date</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {showBulkActions && selectedJobs.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedJobs.size}
          onAction={handleBulkAction}
          onClear={() => setSelectedJobs(new Set())}
        />
      )}

      {/* Jobs List/Grid */}
      {loading && !jobs.length ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">Failed to load jobs</p>
            <p className="text-sm text-gray-400 mt-2">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={refreshJobs}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : sortedJobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">No jobs found</p>
            <p className="text-sm text-gray-400 mt-2">
              {searchQuery || Object.keys(filters).length > 0
                ? 'Try adjusting your search or filters'
                : 'Start by creating a new video job'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Select All */}
          {showBulkActions && (
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                checked={selectedJobs.size === sortedJobs.length && sortedJobs.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">
                Select all {sortedJobs.length} jobs
              </span>
            </div>
          )}
          
          {/* Jobs Display */}
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
            {sortedJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                selected={selectedJobs.has(job.id)}
                onSelect={() => handleJobSelect(job)}
                onRetry={() => handleRetry(job.id)}
                onCancel={() => handleCancel(job.id)}
                onDelete={() => handleDelete(job.id)}
                viewMode={viewMode}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} jobs
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchJobs(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <span className="text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchJobs(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};