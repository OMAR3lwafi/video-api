/**
 * Home/Dashboard Page
 * Main landing page with overview and quick actions
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Plus, 
  Video, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Activity
} from 'lucide-react'
import { Button, Card, CardHeader, Badge } from '@/components/ui'

export function HomePage() {
  // Mock data - in real app this would come from API/store
  const stats = {
    totalVideos: 42,
    processingJobs: 3,
    completedToday: 8,
    totalDuration: '2h 34m'
  }

  const recentJobs = [
    {
      id: '1',
      name: 'Product Demo Video',
      status: 'completed' as const,
      duration: '1:30',
      createdAt: '2 hours ago'
    },
    {
      id: '2',
      name: 'Social Media Promo',
      status: 'processing' as const,
      progress: 75,
      createdAt: '30 minutes ago'
    },
    {
      id: '3',
      name: 'Tutorial Series Intro',
      status: 'failed' as const,
      createdAt: '1 hour ago'
    }
  ]

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
        className="space-y-8"
      >
        {/* Welcome Section */}
        <motion.div variants={itemVariants}>
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold text-secondary-900 mb-4">
              Welcome to VideoGen Pro
            </h1>
            <p className="text-xl text-secondary-600 mb-8 max-w-2xl mx-auto">
              Create stunning videos with our AI-powered platform. 
              Upload your assets, customize your layout, and generate professional videos in minutes.
            </p>
            <Link to="/create">
              <Button size="lg" icon={Plus} className="px-8">
                Create Your First Video
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-secondary-600">Total Videos</p>
                  <p className="text-3xl font-bold text-secondary-900">{stats.totalVideos}</p>
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Video className="w-6 h-6 text-primary-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-secondary-600">Processing</p>
                  <p className="text-3xl font-bold text-secondary-900">{stats.processingJobs}</p>
                </div>
                <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warning-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-secondary-600">Completed Today</p>
                  <p className="text-3xl font-bold text-secondary-900">{stats.completedToday}</p>
                </div>
                <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-success-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-secondary-600">Total Duration</p>
                  <p className="text-3xl font-bold text-secondary-900">{stats.totalDuration}</p>
                </div>
                <div className="w-12 h-12 bg-info-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-info-600" />
                </div>
              </div>
            </Card>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader 
              title="Quick Actions" 
              subtitle="Get started with common tasks"
            />
            <div className="p-6 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link to="/create">
                  <div className="p-4 border border-secondary-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <Plus className="w-5 h-5 text-primary-600" />
                      <h3 className="font-medium text-secondary-900">Create New Video</h3>
                    </div>
                    <p className="text-sm text-secondary-600">
                      Start with a blank canvas or choose from templates
                    </p>
                  </div>
                </Link>

                <Link to="/jobs">
                  <div className="p-4 border border-secondary-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <Activity className="w-5 h-5 text-primary-600" />
                      <h3 className="font-medium text-secondary-900">View All Jobs</h3>
                    </div>
                    <p className="text-sm text-secondary-600">
                      Monitor progress and download completed videos
                    </p>
                  </div>
                </Link>

                <div className="p-4 border border-secondary-200 rounded-lg opacity-50 cursor-not-allowed">
                  <div className="flex items-center gap-3 mb-2">
                    <Video className="w-5 h-5 text-secondary-400" />
                    <h3 className="font-medium text-secondary-600">Templates</h3>
                  </div>
                  <p className="text-sm text-secondary-500">
                    Coming soon - Pre-designed video templates
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Recent Jobs */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader 
              title="Recent Jobs" 
              subtitle="Your latest video processing jobs"
              action={
                <Link to="/jobs">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              }
            />
            <div className="p-6 pt-0">
              {recentJobs.length > 0 ? (
                <div className="space-y-4">
                  {recentJobs.map((job) => (
                    <div 
                      key={job.id}
                      className="flex items-center justify-between p-4 border border-secondary-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-secondary-100 rounded-lg flex items-center justify-center">
                          <Video className="w-5 h-5 text-secondary-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-secondary-900">{job.name}</h4>
                          <p className="text-sm text-secondary-600">{job.createdAt}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {job.status === 'processing' && job.progress && (
                          <div className="text-sm text-secondary-600">
                            {job.progress}%
                          </div>
                        )}
                        {job.duration && (
                          <div className="text-sm text-secondary-600">
                            {job.duration}
                          </div>
                        )}
                        <Badge 
                          variant={
                            job.status === 'completed' ? 'success' :
                            job.status === 'processing' ? 'info' :
                            job.status === 'failed' ? 'error' : 'secondary'
                          }
                        >
                          {job.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Video className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-secondary-900 mb-2">
                    No jobs yet
                  </h3>
                  <p className="text-secondary-600 mb-4">
                    Create your first video to see it here
                  </p>
                  <Link to="/create">
                    <Button icon={Plus}>
                      Create Video
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
