"use client";

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Settings,
  Check,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Job } from '@/types/job';
import { JobFilters } from './JobFilters';

interface JobExportProps {
  jobs?: Job[];
  filters?: JobFilters;
  onExport?: (format: ExportFormat, options: ExportOptions) => Promise<void>;
}

export type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf';

export interface ExportOptions {
  fields: string[];
  includeMetadata: boolean;
  dateFormat: string;
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeStats?: boolean;
}

const defaultFields = [
  'id',
  'name',
  'status',
  'type',
  'templateId',
  'createdAt',
  'completedAt',
  'processingTime',
  'progress',
  'resultUrl',
  'error',
  'elements'
];

const fieldLabels: Record<string, string> = {
  id: 'Job ID',
  name: 'Job Name',
  status: 'Status',
  type: 'Job Type',
  templateId: 'Template ID',
  createdAt: 'Created Date',
  completedAt: 'Completed Date',
  processingTime: 'Processing Time',
  progress: 'Progress',
  resultUrl: 'Result URL',
  error: 'Error Message',
  elements: 'Elements Count'
};

export const JobExport: React.FC<JobExportProps> = ({
  jobs = [],
  filters,
  onExport
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [selectedFields, setSelectedFields] = useState<string[]>(defaultFields);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeStats, setIncludeStats] = useState(true);
  const [dateFormat, setDateFormat] = useState('yyyy-MM-dd HH:mm:ss');
  const [groupBy, setGroupBy] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const formatConfigs = {
    csv: {
      icon: <FileSpreadsheet className="h-5 w-5" />,
      label: 'CSV',
      description: 'Comma-separated values, compatible with Excel',
      extension: '.csv'
    },
    json: {
      icon: <FileJson className="h-5 w-5" />,
      label: 'JSON',
      description: 'JavaScript Object Notation, for developers',
      extension: '.json'
    },
    excel: {
      icon: <FileSpreadsheet className="h-5 w-5 text-green-600" />,
      label: 'Excel',
      description: 'Microsoft Excel workbook',
      extension: '.xlsx'
    },
    pdf: {
      icon: <FileText className="h-5 w-5 text-red-600" />,
      label: 'PDF',
      description: 'Portable Document Format, for reports',
      extension: '.pdf'
    }
  };

  const handleFieldToggle = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleSelectAll = () => {
    if (selectedFields.length === defaultFields.length) {
      setSelectedFields([]);
    } else {
      setSelectedFields(defaultFields);
    }
  };

  const exportData = async () => {
    if (selectedFields.length === 0) {
      toast({
        title: 'No Fields Selected',
        description: 'Please select at least one field to export.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);

    try {
      const options: ExportOptions = {
        fields: selectedFields,
        includeMetadata,
        dateFormat,
        groupBy,
        sortBy,
        sortOrder,
        includeStats
      };

      if (onExport) {
        await onExport(format, options);
      } else {
        // Default export implementation
        await defaultExport(jobs, format, options);
      }

      toast({
        title: 'Export Successful',
        description: `Jobs exported as ${formatConfigs[format].label} file.`,
      });

      setIsOpen(false);
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export jobs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const defaultExport = async (
    data: Job[],
    exportFormat: ExportFormat,
    options: ExportOptions
  ) => {
    let exportData = [...data];

    // Sort data
    if (options.sortBy) {
      exportData.sort((a, b) => {
        const aVal = a[options.sortBy as keyof Job];
        const bVal = b[options.sortBy as keyof Job];
        
        if (aVal === bVal) return 0;
        
        const comparison = aVal < bVal ? -1 : 1;
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Format data based on selected fields
    const formattedData = exportData.map(job => {
      const row: any = {};
      
      options.fields.forEach(field => {
        if (field === 'elements') {
          row[field] = job.elements?.length || 0;
        } else if (field === 'createdAt' || field === 'completedAt') {
          const date = job[field as keyof Job];
          row[field] = date ? format(new Date(date as string), options.dateFormat) : '';
        } else {
          row[field] = job[field as keyof Job] || '';
        }
      });
      
      return row;
    });

    // Generate file content based on format
    let content: string;
    let mimeType: string;
    let filename: string;

    switch (exportFormat) {
      case 'csv':
        content = generateCSV(formattedData, options);
        mimeType = 'text/csv';
        filename = `jobs_export_${Date.now()}.csv`;
        break;
        
      case 'json':
        content = JSON.stringify({
          metadata: options.includeMetadata ? {
            exportDate: new Date().toISOString(),
            totalJobs: formattedData.length,
            filters: filters,
            fields: options.fields
          } : undefined,
          jobs: formattedData,
          stats: options.includeStats ? generateStats(exportData) : undefined
        }, null, 2);
        mimeType = 'application/json';
        filename = `jobs_export_${Date.now()}.json`;
        break;
        
      default:
        throw new Error(`Export format ${exportFormat} not implemented`);
    }

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateCSV = (data: any[], options: ExportOptions): string => {
    if (data.length === 0) return '';

    // Generate headers
    const headers = options.fields.map(field => fieldLabels[field] || field);
    
    // Generate rows
    const rows = data.map(row => 
      options.fields.map(field => {
        const value = row[field];
        // Escape values containing commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  };

  const generateStats = (data: Job[]) => {
    const total = data.length;
    const statusCounts = data.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeCounts = data.reduce((acc, job) => {
      acc[job.type] = (acc[job.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const successRate = (statusCounts.completed || 0) / total * 100;
    
    return {
      total,
      statusDistribution: statusCounts,
      typeDistribution: typeCounts,
      successRate: successRate.toFixed(2) + '%'
    };
  };

  const estimatedSize = useMemo(() => {
    const avgRecordSize = 200; // bytes
    const size = jobs.length * avgRecordSize * (selectedFields.length / defaultFields.length);
    
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }, [jobs.length, selectedFields.length]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Jobs</DialogTitle>
          <DialogDescription>
            Export {jobs.length} jobs to a file. Choose format and customize export options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(formatConfigs).map(([key, config]) => (
                  <Card 
                    key={key} 
                    className={cn(
                      "cursor-pointer transition-colors",
                      format === key && "border-primary"
                    )}
                    onClick={() => setFormat(key as ExportFormat)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value={key} id={key} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {config.icon}
                            <span className="font-medium text-sm">{config.label}</span>
                          </div>
                          <p className="text-xs text-gray-500">{config.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Field Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Fields to Export</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedFields.length === defaultFields.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <Card>
              <CardContent className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {defaultFields.map(field => (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox
                        id={field}
                        checked={selectedFields.includes(field)}
                        onCheckedChange={() => handleFieldToggle(field)}
                      />
                      <label
                        htmlFor={field}
                        className="text-sm cursor-pointer"
                      >
                        {fieldLabels[field] || field}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <Label>Export Options</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="metadata"
                  checked={includeMetadata}
                  onCheckedChange={(checked) => setIncludeMetadata(checked as boolean)}
                />
                <label htmlFor="metadata" className="text-sm cursor-pointer">
                  Include metadata (export date, filters, etc.)
                </label>
              </div>
              
              {format === 'json' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="stats"
                    checked={includeStats}
                    onCheckedChange={(checked) => setIncludeStats(checked as boolean)}
                  />
                  <label htmlFor="stats" className="text-sm cursor-pointer">
                    Include statistics summary
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dateFormat" className="text-sm">Date Format</Label>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger id="dateFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yyyy-MM-dd HH:mm:ss">2024-01-01 12:00:00</SelectItem>
                      <SelectItem value="MM/dd/yyyy">01/01/2024</SelectItem>
                      <SelectItem value="dd/MM/yyyy">01/01/2024</SelectItem>
                      <SelectItem value="MMM dd, yyyy">Jan 01, 2024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sortBy" className="text-sm">Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger id="sortBy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="createdAt">Created Date</SelectItem>
                      <SelectItem value="completedAt">Completed Date</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="type">Job Type</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Export Summary */}
          <Card className="bg-gray-50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Estimated file size:</span>
                <span className="font-medium">{estimatedSize}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Records to export:</span>
                <span className="font-medium">{jobs.length} jobs</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Selected fields:</span>
                <span className="font-medium">{selectedFields.length} of {defaultFields.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={exportData}
            disabled={isExporting || selectedFields.length === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {formatConfigs[format].label}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};