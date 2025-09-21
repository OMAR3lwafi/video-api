/**
 * Video Create Page
 * Main page for creating new videos with form and preview
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Upload, 
  Plus, 
  Settings, 
  Play,
  Download,
  Save
} from 'lucide-react'
import { Button, Card, CardHeader } from '@/components/ui'
import { useVideoStore } from '@/stores'
import type { VideoDimensions, OutputFormat } from '@/types'

export function VideoCreatePage() {
  const { currentProject, createProject } = useVideoStore()
  const [selectedPreset, setSelectedPreset] = useState<string>('16:9_FHD')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('mp4')

  const videoPresets = [
    { id: '16:9_HD', name: 'HD (1280x720)', ratio: '16:9', width: 1280, height: 720 },
    { id: '16:9_FHD', name: 'Full HD (1920x1080)', ratio: '16:9', width: 1920, height: 1080 },
    { id: '9:16_MOBILE', name: 'Mobile (720x1280)', ratio: '9:16', width: 720, height: 1280 },
    { id: '1:1_SQUARE', name: 'Square (1080x1080)', ratio: '1:1', width: 1080, height: 1080 },
  ]

  const handleCreateProject = () => {
    const preset = videoPresets.find(p => p.id === selectedPreset)
    if (!preset) return

    const dimensions: VideoDimensions = {
      width: preset.width,
      height: preset.height,
      aspectRatio: preset.ratio
    }

    createProject({
      name: 'New Video Project',
      description: 'Created with VideoGen Pro',
      dimensions,
      duration: 30, // 30 seconds default
      fps: 30,
      backgroundColor: '#000000',
      outputFormat,
      quality: 'high',
      elements: [],
      timeline: {
        currentTime: 0,
        zoom: 1
      }
    })
  }

  if (currentProject) {
    return <VideoEditor />
  }

  return (
    <div className="page-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 mb-4">
            Create New Video
          </h1>
          <p className="text-lg text-secondary-600">
            Choose your video settings and start creating amazing content
          </p>
        </div>

        {/* Project Settings */}
        <Card className="mb-8">
          <CardHeader 
            title="Video Settings" 
            subtitle="Configure your video dimensions and output format"
          />
          <div className="p-6 pt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Video Presets */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-3">
                  Video Dimensions
                </label>
                <div className="space-y-2">
                  {videoPresets.map((preset) => (
                    <label
                      key={preset.id}
                      className="flex items-center p-3 border border-secondary-200 rounded-lg cursor-pointer hover:bg-secondary-50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="preset"
                        value={preset.id}
                        checked={selectedPreset === preset.id}
                        onChange={(e) => setSelectedPreset(e.target.value)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-secondary-900">
                          {preset.name}
                        </div>
                        <div className="text-sm text-secondary-600">
                          {preset.width} × {preset.height} ({preset.ratio})
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Output Settings */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-3">
                  Output Format
                </label>
                <div className="space-y-2">
                  {(['mp4', 'mov', 'avi'] as OutputFormat[]).map((format) => (
                    <label
                      key={format}
                      className="flex items-center p-3 border border-secondary-200 rounded-lg cursor-pointer hover:bg-secondary-50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="format"
                        value={format}
                        checked={outputFormat === format}
                        onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-secondary-900 uppercase">
                          {format}
                        </div>
                        <div className="text-sm text-secondary-600">
                          {format === 'mp4' && 'Most compatible, recommended for web'}
                          {format === 'mov' && 'High quality, good for editing'}
                          {format === 'avi' && 'Legacy format, larger file size'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-secondary-200 flex justify-between items-center">
              <div className="text-sm text-secondary-600">
                You can change these settings later in the editor
              </div>
              <Button onClick={handleCreateProject} size="lg" icon={Plus}>
                Create Project
              </Button>
            </div>
          </div>
        </Card>

        {/* Quick Start Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card interactive>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Upload className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="font-semibold text-secondary-900 mb-2">
                Upload Assets
              </h3>
              <p className="text-sm text-secondary-600 mb-4">
                Start by uploading your images and videos
              </p>
              <Button variant="outline" size="sm" disabled>
                Coming Soon
              </Button>
            </div>
          </Card>

          <Card interactive>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Settings className="w-6 h-6 text-success-600" />
              </div>
              <h3 className="font-semibold text-secondary-900 mb-2">
                Use Template
              </h3>
              <p className="text-sm text-secondary-600 mb-4">
                Start with a pre-designed template
              </p>
              <Button variant="outline" size="sm" disabled>
                Coming Soon
              </Button>
            </div>
          </Card>

          <Card interactive>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Play className="w-6 h-6 text-warning-600" />
              </div>
              <h3 className="font-semibold text-secondary-900 mb-2">
                Import Project
              </h3>
              <p className="text-sm text-secondary-600 mb-4">
                Import an existing project file
              </p>
              <Button variant="outline" size="sm" disabled>
                Coming Soon
              </Button>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * Video Editor Component - Placeholder for now
 */
function VideoEditor() {
  const { currentProject, closeProject } = useVideoStore()

  return (
    <div className="h-screen flex flex-col">
      {/* Editor Header */}
      <div className="bg-white border-b border-secondary-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-secondary-900">
              {currentProject?.name || 'Video Editor'}
            </h1>
            <p className="text-sm text-secondary-600">
              {currentProject?.dimensions.width} × {currentProject?.dimensions.height}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={Save}>
              Save
            </Button>
            <Button variant="outline" size="sm" icon={Download}>
              Export
            </Button>
            <Button variant="ghost" size="sm" onClick={closeProject}>
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Editor Content - Placeholder */}
      <div className="flex-1 bg-secondary-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 bg-secondary-300 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Play className="w-12 h-12 text-secondary-600" />
          </div>
          <h2 className="text-xl font-semibold text-secondary-900 mb-2">
            Video Editor
          </h2>
          <p className="text-secondary-600 mb-6">
            The full video editor interface will be implemented here.
            <br />
            This includes timeline, canvas, tools, and asset management.
          </p>
          <Button onClick={closeProject} variant="outline">
            Back to Settings
          </Button>
        </div>
      </div>
    </div>
  )
}
