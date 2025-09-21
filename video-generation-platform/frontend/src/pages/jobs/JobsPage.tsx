/**
 * Jobs Page
 * List and manage video processing jobs
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Trash2,
  RefreshCw,
  Plus
} from 'lucide-react'
import { Button, Card, Badge, Input } from '@/components/ui'

export function JobsPage() {
  // Mock data - in real app this would come from API/store
  const jobs = [
    {
      id: 'job-1',
      name: 'Product Demo Video',
      status: 'completed' as const,
      progress: 100,
      duration: '1:30',
      fileSize: '24.5 MB',
      createdAt: '2024-01-15T10:30:00Z',
      completedAt: '2024-01-15T10:32:15Z',
      resultUrl: 'https://example.com/video1.mp4',
      format: 'MP4',
      dimensions: '1920x1080'
    },
    {
      id: 'job-2',
      name: 'Social Media Promo',
      status: 'processing' as const,
      progress: 75,
      currentStep: 'Rendering video layers',
      createdAt: '2024-01-15T11:00:00Z',
      format: 'MP4',
      dimensions: '1080x1080'
    },
    {
      id: 'job-3',
      name: 'Tutorial Series Intro',
      status: 'failed' as const,
      progress: 45,
      error: 'Source file format not supported',
      createdAt: '2024-01-15T09:15:00Z',
      format: 'MOV',
      dimensions: '1920x1080'
    },
    {
      id: 'job-4',
      name: 'Marketing Banner Video',
      status: 'pending' as const,
      progress: 0,
      createdAt: '2024-01-15T11:15:00Z',
      format: 'MP4',
      dimensions: '1280x720'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'processing': return 'info'
      case 'failed': return 'error'
      case 'pending': return 'secondary'
      default: return 'secondary'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  }

  return (
    <div className="page-container">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Video Jobs</h1>
            <p className="text-secondary-600">
              Track and manage your video processing jobs
            </p>
          </div>
          <Link to="/create">
            <Button icon={Plus}>
              Create New Video
            </Button>
          </Link>
        </motion.div>

        {/* Filters and Search */}
        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search jobs..."
                  icon={Search}
                  className="max-w-md"
                />
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" icon={Filter} size="sm">
                  Filter
                </Button>
                <Button variant="ghost" icon={RefreshCw} size="sm">
                  Refresh
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Jobs List */}
        <motion.div variants={itemVariants}>
          <div className="space-y-4">
            {jobs.map((job, index) => (
              <motion.div
                key={job.id}
                variants={itemVariants}
                custom={index}
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    {/* Job Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-secondary-900 truncate">
                          {job.name}
                        </h3>
                        <Badge variant={getStatusColor(job.status) as any}>
                          {job.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-secondary-600 mb-3">
                        <span>{job.format}</span>
                        <span>•</span>
                        <span>{job.dimensions}</span>
                        <span>•</span>
                        <span>Created {formatDate(job.createdAt)}</span>
                        {job.duration && (
                          <>
                            <span>•</span>
                            <span>{job.duration}</span>
                          </>
                        )}
                        {job.fileSize && (
                          <>
                            <span>•</span>
                            <span>{job.fileSize}</span>
                          </>
                        )}
                      </div>

                      {/* Progress bar for processing jobs */}
                      {job.status === 'processing' && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-secondary-600">
                              {job.currentStep || 'Processing...'}
                            </span>
                            <span className="text-sm font-medium text-secondary-900">
                              {job.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-secondary-200 rounded-full h-2">
                            <motion.div
                              className="bg-primary-600 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${job.progress}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Error message for failed jobs */}
                      {job.status === 'failed' && job.error && (
                        <div className="text-sm text-error-600 bg-error-50 px-3 py-2 rounded-lg">
                          {job.error}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {job.status === 'completed' && job.resultUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Download}
                          onClick={() => window.open(job.resultUrl, '_blank')}
                        >
                          Download
                        </Button>
                      )}
                      
                      <Link to={`/jobs/${job.id}`}>
                        <Button variant="outline" size="sm" icon={Eye}>
                          View
                        </Button>
                      </Link>
                      
                      <Button variant="ghost" size="sm" icon={Trash2}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Empty State */}
        {jobs.length === 0 && (
          <motion.div variants={itemVariants}>
            <Card className="p-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="w-8 h-8 text-secondary-400" />
                </div>
                <h3 className="text-lg font-semibold text-secondary-900 mb-2">
                  No jobs found
                </h3>
                <p className="text-secondary-600 mb-6">
                  You haven't created any video jobs yet. Start by creating your first video.
                </p>
                <Link to="/create">
                  <Button icon={Plus}>
                    Create Your First Video
                  </Button>
                </Link>
              </div>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
