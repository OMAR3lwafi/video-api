"use client";

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, X, Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { DateRange } from 'react-day-picker';
import { JobStatus, JobType } from '@/types/job';
import { cn } from '@/lib/utils';

export interface JobFilters {
  status?: JobStatus[];
  type?: JobType[];
  templateId?: string;
  dateRange?: DateRange;
  duration?: {
    min?: number;
    max?: number;
  };
  elements?: {
    min?: number;
    max?: number;
  };
  search?: string;
  tags?: string[];
  errorType?: string[];
}

interface JobFiltersProps {
  filters: JobFilters;
  onFiltersChange: (filters: JobFilters) => void;
  onReset: () => void;
  showAdvanced?: boolean;
  availableTemplates?: { id: string; name: string }[];
  availableTags?: string[];
}

export const JobFilters: React.FC<JobFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset,
  showAdvanced = true,
  availableTemplates = [],
  availableTags = []
}) => {
  const [localFilters, setLocalFilters] = useState<JobFilters>(filters);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(filters.dateRange);

  useEffect(() => {
    setLocalFilters(filters);
    setDateRange(filters.dateRange);
  }, [filters]);

  const handleStatusChange = (status: JobStatus, checked: boolean) => {
    const currentStatuses = localFilters.status || [];
    const newStatuses = checked
      ? [...currentStatuses, status]
      : currentStatuses.filter(s => s !== status);
    
    const newFilters = {
      ...localFilters,
      status: newStatuses.length > 0 ? newStatuses : undefined
    };
    
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleTypeChange = (type: JobType, checked: boolean) => {
    const currentTypes = localFilters.type || [];
    const newTypes = checked
      ? [...currentTypes, type]
      : currentTypes.filter(t => t !== type);
    
    const newFilters = {
      ...localFilters,
      type: newTypes.length > 0 ? newTypes : undefined
    };
    
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    const newFilters = {
      ...localFilters,
      dateRange: range
    };
    
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleTemplateChange = (templateId: string) => {
    const newFilters = {
      ...localFilters,
      templateId: templateId === 'all' ? undefined : templateId
    };
    
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleDurationChange = (field: 'min' | 'max', value: string) => {
    const duration = { ...localFilters.duration };
    const numValue = parseInt(value);
    
    if (value === '' || isNaN(numValue)) {
      delete duration[field];
    } else {
      duration[field] = numValue;
    }
    
    const newFilters = {
      ...localFilters,
      duration: Object.keys(duration).length > 0 ? duration : undefined
    };
    
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleElementsChange = (field: 'min' | 'max', value: string) => {
    const elements = { ...localFilters.elements };
    const numValue = parseInt(value);
    
    if (value === '' || isNaN(numValue)) {
      delete elements[field];
    } else {
      elements[field] = numValue;
    }
    
    const newFilters = {
      ...localFilters,
      elements: Object.keys(elements).length > 0 ? elements : undefined
    };
    
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = localFilters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    
    const newFilters = {
      ...localFilters,
      tags: newTags.length > 0 ? newTags : undefined
    };
    
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleReset = () => {
    setLocalFilters({});
    setDateRange(undefined);
    onReset();
  };

  const activeFilterCount = Object.keys(localFilters).filter(key => 
    localFilters[key as keyof JobFilters] !== undefined
  ).length;

  const statusOptions: { value: JobStatus; label: string; color: string }[] = [
    { value: 'completed', label: 'Completed', color: 'bg-green-500' },
    { value: 'failed', label: 'Failed', color: 'bg-red-500' },
    { value: 'processing', label: 'Processing', color: 'bg-blue-500' },
    { value: 'queued', label: 'Queued', color: 'bg-yellow-500' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-500' }
  ];

  const typeOptions: { value: JobType; label: string }[] = [
    { value: 'single', label: 'Single Video' },
    { value: 'batch', label: 'Batch Processing' },
    { value: 'template', label: 'Template Based' }
  ];

  const errorTypeOptions = [
    { value: 'ffmpeg', label: 'FFmpeg Error' },
    { value: 'upload', label: 'Upload Failed' },
    { value: 'timeout', label: 'Timeout' },
    { value: 'validation', label: 'Validation Error' },
    { value: 'resource', label: 'Resource Limit' }
  ];

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={activeFilterCount === 0}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>
      
      <Separator />
      
      {/* Main Filters */}
      <div className="space-y-4">
        {/* Status Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Status</Label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${option.value}`}
                  checked={localFilters.status?.includes(option.value) || false}
                  onCheckedChange={(checked) => 
                    handleStatusChange(option.value, checked as boolean)
                  }
                />
                <label
                  htmlFor={`status-${option.value}`}
                  className="flex items-center gap-1.5 text-sm cursor-pointer"
                >
                  <span className={cn("w-2 h-2 rounded-full", option.color)} />
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>
        
        {/* Type Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Job Type</Label>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${option.value}`}
                  checked={localFilters.type?.includes(option.value) || false}
                  onCheckedChange={(checked) => 
                    handleTypeChange(option.value, checked as boolean)
                  }
                />
                <label
                  htmlFor={`type-${option.value}`}
                  className="text-sm cursor-pointer"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>
        
        {/* Template Filter */}
        {availableTemplates.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Template</Label>
            <Select
              value={localFilters.templateId || 'all'}
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All templates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {availableTemplates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Date Range Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={handleDateRangeChange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {/* Advanced Filters */}
      {showAdvanced && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced" className="border-none">
            <AccordionTrigger className="py-2 hover:no-underline">
              <span className="text-sm font-medium">Advanced Filters</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {/* Duration Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Processing Duration (seconds)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={localFilters.duration?.min || ''}
                    onChange={(e) => handleDurationChange('min', e.target.value)}
                  />
                  <span className="flex items-center">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={localFilters.duration?.max || ''}
                    onChange={(e) => handleDurationChange('max', e.target.value)}
                  />
                </div>
              </div>
              
              {/* Elements Count Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Number of Elements</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={localFilters.elements?.min || ''}
                    onChange={(e) => handleElementsChange('min', e.target.value)}
                  />
                  <span className="flex items-center">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={localFilters.elements?.max || ''}
                    onChange={(e) => handleElementsChange('max', e.target.value)}
                  />
                </div>
              </div>
              
              {/* Error Type Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Error Type</Label>
                <div className="space-y-2">
                  {errorTypeOptions.map(option => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`error-${option.value}`}
                        checked={localFilters.errorType?.includes(option.value) || false}
                        onCheckedChange={(checked) => {
                          const currentErrors = localFilters.errorType || [];
                          const newErrors = checked
                            ? [...currentErrors, option.value]
                            : currentErrors.filter(e => e !== option.value);
                          
                          const newFilters = {
                            ...localFilters,
                            errorType: newErrors.length > 0 ? newErrors : undefined
                          };
                          
                          setLocalFilters(newFilters);
                          onFiltersChange(newFilters);
                        }}
                      />
                      <label
                        htmlFor={`error-${option.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Tags Filter */}
              {availableTags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                      <Badge
                        key={tag}
                        variant={localFilters.tags?.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => handleTagToggle(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      
      {/* Active Filters Summary */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {localFilters.status?.map(status => (
            <Badge key={`status-${status}`} variant="secondary">
              Status: {status}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => handleStatusChange(status, false)}
              />
            </Badge>
          ))}
          
          {localFilters.type?.map(type => (
            <Badge key={`type-${type}`} variant="secondary">
              Type: {type}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => handleTypeChange(type, false)}
              />
            </Badge>
          ))}
          
          {localFilters.templateId && (
            <Badge variant="secondary">
              Template: {localFilters.templateId}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => handleTemplateChange('all')}
              />
            </Badge>
          )}
          
          {dateRange && (
            <Badge variant="secondary">
              Date Range
              <X 
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => handleDateRangeChange(undefined)}
              />
            </Badge>
          )}
          
          {localFilters.tags?.map(tag => (
            <Badge key={`tag-${tag}`} variant="secondary">
              Tag: {tag}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => handleTagToggle(tag)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};