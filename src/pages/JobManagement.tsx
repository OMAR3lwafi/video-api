"use client";

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { JobHistory } from '@/components/jobs/JobHistory';
import { ActiveJobsPanel } from '@/components/jobs/ActiveJobsPanel';
import { JobAnalytics } from '@/components/jobs/JobAnalytics';
import { JobExport } from '@/components/jobs/JobExport';
import { Button } from '@/components/ui/button';
import { 
  History, 
  Activity, 
  BarChart3, 
  Settings,
  Plus,
  RefreshCw
} from 'lucide-react';
import { useJobStore } from '@/stores/jobStore';
import { Job } from '@/types/job';

export const JobManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('history');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const { loadPreferences } = useJobStore();

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleJobSelect = (job: Job) => {
    setSelectedJob(job);
    // You could open a job details modal here
    console.log('Selected job:', job);
  };

  const handleNewJob = () => {
    // Navigate to create new job page or open creation modal
    console.log('Create new job');
  };

  const handleRefresh = () => {
    // Trigger a refresh of the current view
    window.location.reload();
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Job Management</h1>
          <p className="text-gray-500 mt-1">
            Monitor, manage, and analyze your video processing jobs
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <JobExport />
          
          <Button
            variant="outline"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button
            onClick={handleNewJob}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>
      </div>

      {/* Active Jobs Summary */}
      <div className="mb-6">
        <ActiveJobsPanel
          onJobClick={handleJobSelect}
          maxHeight="300px"
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Job History
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <JobHistory
            onJobSelect={handleJobSelect}
            showBulkActions={true}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <JobAnalytics
            showInsights={true}
            dateRange="week"
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <JobPreferencesSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Job Preferences Settings Component
const JobPreferencesSettings: React.FC = () => {
  const { preferences, updatePreferences } = useJobStore();

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Display Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Default View</label>
            <select
              value={preferences.defaultView}
              onChange={(e) => updatePreferences({ defaultView: e.target.value as 'list' | 'grid' })}
              className="px-3 py-1 border rounded"
            >
              <option value="list">List View</option>
              <option value="grid">Grid View</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Auto Refresh</label>
            <input
              type="checkbox"
              checked={preferences.autoRefresh}
              onChange={(e) => updatePreferences({ autoRefresh: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
          
          {preferences.autoRefresh && (
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Refresh Interval (seconds)</label>
              <input
                type="number"
                value={preferences.refreshInterval / 1000}
                onChange={(e) => updatePreferences({ refreshInterval: parseInt(e.target.value) * 1000 })}
                className="w-20 px-2 py-1 border rounded"
                min="1"
                max="60"
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Show Thumbnails</label>
            <input
              type="checkbox"
              checked={preferences.displaySettings.showThumbnails}
              onChange={(e) => updatePreferences({ 
                displaySettings: { ...preferences.displaySettings, showThumbnails: e.target.checked }
              })}
              className="h-4 w-4"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Compact Mode</label>
            <input
              type="checkbox"
              checked={preferences.displaySettings.compactMode}
              onChange={(e) => updatePreferences({ 
                displaySettings: { ...preferences.displaySettings, compactMode: e.target.checked }
              })}
              className="h-4 w-4"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Notification Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Show Notifications</label>
            <input
              type="checkbox"
              checked={preferences.showNotifications}
              onChange={(e) => updatePreferences({ showNotifications: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
          
          {preferences.showNotifications && (
            <>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Job Completed</label>
                <input
                  type="checkbox"
                  checked={preferences.notificationTypes.completed}
                  onChange={(e) => updatePreferences({ 
                    notificationTypes: { ...preferences.notificationTypes, completed: e.target.checked }
                  })}
                  className="h-4 w-4"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Job Failed</label>
                <input
                  type="checkbox"
                  checked={preferences.notificationTypes.failed}
                  onChange={(e) => updatePreferences({ 
                    notificationTypes: { ...preferences.notificationTypes, failed: e.target.checked }
                  })}
                  className="h-4 w-4"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Job Queued</label>
                <input
                  type="checkbox"
                  checked={preferences.notificationTypes.queued}
                  onChange={(e) => updatePreferences({ 
                    notificationTypes: { ...preferences.notificationTypes, queued: e.target.checked }
                  })}
                  className="h-4 w-4"
                />
              </div>
            </>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Export Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Default Format</label>
            <select
              value={preferences.exportSettings.defaultFormat}
              onChange={(e) => updatePreferences({ 
                exportSettings: { ...preferences.exportSettings, defaultFormat: e.target.value as any }
              })}
              className="px-3 py-1 border rounded"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Include Metadata</label>
            <input
              type="checkbox"
              checked={preferences.exportSettings.includeMetadata}
              onChange={(e) => updatePreferences({ 
                exportSettings: { ...preferences.exportSettings, includeMetadata: e.target.checked }
              })}
              className="h-4 w-4"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Date Format</label>
            <select
              value={preferences.exportSettings.dateFormat}
              onChange={(e) => updatePreferences({ 
                exportSettings: { ...preferences.exportSettings, dateFormat: e.target.value }
              })}
              className="px-3 py-1 border rounded"
            >
              <option value="yyyy-MM-dd HH:mm:ss">2024-01-01 12:00:00</option>
              <option value="MM/dd/yyyy">01/01/2024</option>
              <option value="dd/MM/yyyy">01/01/2024</option>
              <option value="MMM dd, yyyy">Jan 01, 2024</option>
            </select>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default JobManagement;