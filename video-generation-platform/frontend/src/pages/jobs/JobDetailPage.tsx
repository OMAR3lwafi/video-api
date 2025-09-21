/**
 * Job Detail Page
 * Detailed view of a specific video processing job
 */

import React from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  Download, 
  RefreshCw, 
  Trash2,
  Play,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  FileVideo,
  Settings
} from 'lucide-react'
import { Button, Card, CardHeader, Badge } from '@/components/ui'

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  // Mock data - in real app this would be fetched based on jobId
  const job = {
    id: jobId,
    name: 'Product Demo Video',
    status: 'completed' as const,
    progress: 100,
    duration: '1:30',
    fileSize: '24.5 MB',
    createdAt: '2024-01-15T10:30:00Z',
    completedAt: '2024-01-15T10:32:15Z',
    processingTime: '2m 15s',
    resultUrl: 'https://example.com/video1.mp4',
    format: 'MP4',
    dimensions: '1920x1080',
    fps: 30,
    bitrate: '5000 kbps',
    codec: 'H.264',
    elements: [
      { type: 'video', name: 'background-video.mp4', duration: '1:30' },
      { type: 'image', name: 'logo.png', duration: '1:30' },
      { type: 'image', name: 'product-image.jpg', duration: '0:45' }
    ],
    timeline: [
      { timestamp: '10:30:00', event: 'Job created', status: 'info' },
      { timestamp: '10:30:05', event: 'Started processing', status: 'info' },
      { timestamp: '10:30:30', event: 'Processing video elements', status: 'info' },
      { timestamp: '10:31:45', event: 'Rendering final video', status: 'info' },
      { timestamp: '10:32:15', event: 'Job completed successfully', status: 'success' }
    ]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle
      case 'processing': return RefreshCw
      case 'failed': return AlertCircle
      case 'pending': return Clock
      default: return Clock
    }
  }

  const StatusIcon = getStatusIcon(job.status)

  return (
    <div className="page-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              icon={ArrowLeft}
              onClick={() => navigate('/jobs')}
            >
              Back to Jobs
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-secondary-900">
                {job.name}
              </h1>
              <p className="text-secondary-600">
                Job ID: {job.id}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {job.status === 'completed' && job.resultUrl && (
              <>
                <Button
                  variant="outline"
                  icon={Eye}
                  onClick={() => window.open(job.resultUrl, '_blank')}
                >
                  Preview
                </Button>
                <Button
                  icon={Download}
                  onClick={() => window.open(job.resultUrl, '_blank')}
                >
                  Download
                </Button>
              </>
            )}
            <Button variant="ghost" icon={Trash2}>
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Overview */}
            <Card>
              <CardHeader title="Job Status" />
              <div className="p-6 pt-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    job.status === 'completed' ? 'bg-success-100' :
                    job.status === 'processing' ? 'bg-info-100' :
                    job.status === 'failed' ? 'bg-error-100' : 'bg-secondary-100'
                  }`}>
                    <StatusIcon className={`w-6 h-6 ${
                      job.status === 'completed' ? 'text-success-600' :
                      job.status === 'processing' ? 'text-info-600' :
                      job.status === 'failed' ? 'text-error-600' : 'text-secondary-600'
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={
                        job.status === 'completed' ? 'success' :
                        job.status === 'processing' ? 'info' :
                        job.status === 'failed' ? 'error' : 'secondary'
                      }>
                        {job.status}
                      </Badge>
                      <span className="text-lg font-semibold text-secondary-900">
                        {job.progress}% Complete
                      </span>
                    </div>
                    <p className="text-secondary-600">
                      {job.status === 'completed' && `Completed in ${job.processingTime}`}
                      {job.status === 'processing' && 'Processing your video...'}
                      {job.status === 'failed' && 'Job failed during processing'}
                      {job.status === 'pending' && 'Waiting to start processing'}
                    </p>
                  </div>
                </div>

                {job.status === 'processing' && (
                  <div className="w-full bg-secondary-200 rounded-full h-2">
                    <motion.div
                      className="bg-primary-600 h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${job.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Video Preview */}
            {job.status === 'completed' && job.resultUrl && (
              <Card>
                <CardHeader title="Video Preview" />
                <div className="p-6 pt-0">
                  <div className="aspect-video bg-secondary-900 rounded-lg flex items-center justify-center">
                    <Button
                      variant="ghost"
                      icon={Play}
                      className="text-white hover:bg-white/20"
                      size="lg"
                      onClick={() => window.open(job.resultUrl, '_blank')}
                    >
                      Play Video
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Processing Timeline */}
            <Card>
              <CardHeader title="Processing Timeline" />
              <div className="p-6 pt-0">
                <div className="space-y-4">
                  {job.timeline.map((event, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        event.status === 'success' ? 'bg-success-500' :
                        event.status === 'error' ? 'bg-error-500' : 'bg-info-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-secondary-900">
                          {event.event}
                        </p>
                        <p className="text-xs text-secondary-600">
                          {event.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Job Details */}
            <Card>
              <CardHeader title="Job Details" />
              <div className="p-6 pt-0 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-secondary-600">Format:</span>
                  <span className="text-sm font-medium text-secondary-900">{job.format}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-secondary-600">Dimensions:</span>
                  <span className="text-sm font-medium text-secondary-900">{job.dimensions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-secondary-600">FPS:</span>
                  <span className="text-sm font-medium text-secondary-900">{job.fps}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-secondary-600">Codec:</span>
                  <span className="text-sm font-medium text-secondary-900">{job.codec}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-secondary-600">Bitrate:</span>
                  <span className="text-sm font-medium text-secondary-900">{job.bitrate}</span>
                </div>
                {job.duration && (
                  <div className="flex justify-between">
                    <span className="text-sm text-secondary-600">Duration:</span>
                    <span className="text-sm font-medium text-secondary-900">{job.duration}</span>
                  </div>
                )}
                {job.fileSize && (
                  <div className="flex justify-between">
                    <span className="text-sm text-secondary-600">File Size:</span>
                    <span className="text-sm font-medium text-secondary-900">{job.fileSize}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-secondary-600">Created:</span>
                  <span className="text-sm font-medium text-secondary-900">
                    {formatDate(job.createdAt)}
                  </span>
                </div>
                {job.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-sm text-secondary-600">Completed:</span>
                    <span className="text-sm font-medium text-secondary-900">
                      {formatDate(job.completedAt)}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Elements Used */}
            <Card>
              <CardHeader title="Elements Used" />
              <div className="p-6 pt-0">
                <div className="space-y-3">
                  {job.elements.map((element, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-secondary-100 rounded flex items-center justify-center">
                        <FileVideo className="w-4 h-4 text-secondary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-secondary-900 truncate">
                          {element.name}
                        </p>
                        <p className="text-xs text-secondary-600">
                          {element.type} • {element.duration}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader title="Actions" />
              <div className="p-6 pt-0 space-y-2">
                <Button variant="outline" className="w-full" icon={RefreshCw}>
                  Retry Job
                </Button>
                <Button variant="outline" className="w-full" icon={Settings}>
                  Edit Settings
                </Button>
                <Link to={`/create?duplicate=${job.id}`}>
                  <Button variant="outline" className="w-full" icon={FileVideo}>
                    Duplicate Job
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
