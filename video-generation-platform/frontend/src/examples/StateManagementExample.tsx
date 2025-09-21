/**
 * State Management Integration Example
 * Demonstrates comprehensive state management with Zustand and API integration
 */

import React, { useEffect } from 'react'
import { StoreProvider } from '../stores/context'
import { useAppStore } from '../stores/appStore'
import { useProjectStore } from '../stores/projectStore'
import { useJobStore } from '../stores/jobStore'
import { useUIStore } from '../stores/uiStore'
import { useUserStore } from '../stores/userStore'
import { useCacheStore } from '../stores/cacheStore'
import { useOfflineStore } from '../stores/offlineStore'
import { useEnhancedRealtimeSync, useProjectCollaboration } from '../hooks/useSupabase'
import { exportVideoWithTracking, saveProjectWithFeedback } from '../stores/actions'
import type { VideoCreateRequest } from '../types/api'

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

function VideoCreationApp() {
  return (
    <StoreProvider autoInitialize>
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ProjectWorkspace />
            </div>
            <div className="space-y-6">
              <SystemStatus />
              <JobQueue />
              <CollaborationPanel />
            </div>
          </div>
        </main>
        <GlobalNotifications />
        <GlobalModals />
      </div>
    </StoreProvider>
  )
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

function AppHeader() {
  const { isAuthenticated, profile } = useUserStore((state) => ({
    isAuthenticated: state.auth.isAuthenticated,
    profile: state.profile,
  }))
  
  const { isOnline, systemHealth } = useAppStore((state) => ({
    isOnline: state.isOnline,
    systemHealth: state.system.health,
  }))
  
  const { isDirty, currentProject } = useProjectStore((state) => ({
    isDirty: state.isDirty,
    currentProject: state.currentProject,
  }))

  const handleSave = async () => {
    await saveProjectWithFeedback()
  }

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Video Platform
            </h1>
            
            {/* System Status Indicators */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-red-500'
              }`} title={isOnline ? 'Online' : 'Offline'} />
              
              <div className={`w-2 h-2 rounded-full ${
                systemHealth === 'healthy' ? 'bg-green-500' : 
                systemHealth === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
              }`} title={`System: ${systemHealth}`} />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Project Actions */}
            {currentProject && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {currentProject.name}
                  {isDirty && ' *'}
                </span>
                
                <button
                  onClick={handleSave}
                  disabled={!isDirty}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            )}

            {/* User Info */}
            {isAuthenticated && profile && (
              <div className="flex items-center space-x-2">
                {profile.avatar && (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm font-medium">{profile.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

// ============================================================================
// PROJECT WORKSPACE
// ============================================================================

function ProjectWorkspace() {
  const { currentProject } = useProjectStore()
  const { createProject } = useProjectStore()

  if (!currentProject) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Create New Project</h2>
        <button
          onClick={() => createProject('My Video Project')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Project
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <VideoCanvas />
      <ElementsPanel />
      <TimelinePanel />
      <ExportPanel />
    </div>
  )
}

function VideoCanvas() {
  const { currentProject, canvas } = useProjectStore((state) => ({
    currentProject: state.currentProject,
    canvas: state.canvas,
  }))

  if (!currentProject) return null

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Canvas</h3>
      <div
        className="relative bg-black rounded aspect-video overflow-hidden"
        style={{
          transform: `scale(${canvas.zoom}) translate(${canvas.pan.x}px, ${canvas.pan.y}px)`,
        }}
      >
        {currentProject.elements.map((element) => (
          <div
            key={element.id}
            className={`absolute border-2 ${
              element.selected ? 'border-blue-500' : 'border-transparent'
            }`}
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              zIndex: element.zIndex,
            }}
          >
            {element.type === 'image' ? (
              <img src={element.source} alt="" className="w-full h-full object-cover" />
            ) : (
              <video src={element.source} className="w-full h-full object-cover" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ElementsPanel() {
  const { elements, addElement } = useProjectStore((state) => ({
    elements: state.currentProject?.elements || [],
    addElement: state.addElement,
  }))

  const handleAddImage = () => {
    addElement({
      type: 'image',
      source: 'https://via.placeholder.com/300x200',
      track: elements.length,
    })
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Elements</h3>
      
      <div className="space-y-2 mb-4">
        {elements.map((element) => (
          <div key={element.id} className="flex items-center justify-between p-2 border rounded">
            <span className="text-sm">{element.type} - Track {element.track}</span>
            <button className="text-red-600 text-sm hover:text-red-800">
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddImage}
        className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Add Image Element
      </button>
    </div>
  )
}

function TimelinePanel() {
  const { timeline, setCurrentTime, play, pause } = useProjectStore((state) => ({
    timeline: state.timeline,
    setCurrentTime: state.setCurrentTime,
    play: state.play,
    pause: state.pause,
  }))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Timeline</h3>
      
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={timeline.isPlaying ? pause : play}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {timeline.isPlaying ? 'Pause' : 'Play'}
          </button>
          
          <span className="text-sm">
            {Math.round(timeline.currentTime)}s / {timeline.duration}s
          </span>
        </div>
        
        <div className="relative">
          <input
            type="range"
            min="0"
            max={timeline.duration}
            value={timeline.currentTime}
            onChange={(e) => setCurrentTime(Number(e.target.value))}
            className="w-full"
          />
          <div 
            className="absolute top-0 h-full bg-blue-600 rounded"
            style={{ width: `${(timeline.currentTime / timeline.duration) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function ExportPanel() {
  const { currentProject } = useProjectStore()
  const { addNotification } = useUIStore()

  const handleExport = async () => {
    if (!currentProject) return

    const request: VideoCreateRequest = {
      output_format: 'mp4',
      width: currentProject.dimensions.width,
      height: currentProject.dimensions.height,
      elements: currentProject.elements.map(el => ({
        id: el.id,
        type: el.type,
        source: el.source,
        track: el.track,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        fit_mode: el.fit_mode,
      })),
    }

    try {
      const jobId = await exportVideoWithTracking(request)
      addNotification({
        type: 'success',
        title: 'Export Started',
        message: `Export job ${jobId} has been created.`,
        duration: 3000,
      })
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Export</h3>
      
      <button
        onClick={handleExport}
        disabled={!currentProject}
        className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
      >
        Export Video
      </button>
    </div>
  )
}

// ============================================================================
// SYSTEM STATUS PANEL
// ============================================================================

function SystemStatus() {
  const appState = useAppStore()
  const cacheStats = useCacheStore((state) => state.stats)
  const offlineState = useOfflineStore()

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">System Status</h3>
      
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span>Network:</span>
          <span className={appState.isOnline ? 'text-green-600' : 'text-red-600'}>
            {appState.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>System Health:</span>
          <span className={
            appState.system.health === 'healthy' ? 'text-green-600' :
            appState.system.health === 'degraded' ? 'text-yellow-600' : 'text-red-600'
          }>
            {appState.system.health}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Cache Hit Rate:</span>
          <span>{Math.round(cacheStats.hitRate * 100)}%</span>
        </div>
        
        <div className="flex justify-between">
          <span>Offline Queue:</span>
          <span>{offlineState.queue.length} items</span>
        </div>
        
        <div className="flex justify-between">
          <span>Pending Changes:</span>
          <span>{offlineState.sync.pendingChanges}</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// JOB QUEUE PANEL
// ============================================================================

function JobQueue() {
  const { activeJobs, completedJobs } = useJobStore((state) => ({
    activeJobs: Array.from(state.activeJobs.values()),
    completedJobs: state.completedJobs.slice(0, 5), // Show last 5
  }))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Job Queue</h3>
      
      {activeJobs.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium mb-2">Active Jobs</h4>
          {activeJobs.map((job) => (
            <div key={job.id} className="mb-2 p-2 border rounded">
              <div className="flex justify-between text-sm">
                <span>{job.id}</span>
                <span>{job.status}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {completedJobs.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Recent Jobs</h4>
          {completedJobs.map((job) => (
            <div key={job.id} className="mb-2 p-2 border rounded text-sm">
              <div className="flex justify-between">
                <span>{job.id}</span>
                <span className={
                  job.status === 'completed' ? 'text-green-600' : 'text-red-600'
                }>
                  {job.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeJobs.length === 0 && completedJobs.length === 0 && (
        <p className="text-gray-500 text-sm">No jobs</p>
      )}
    </div>
  )
}

// ============================================================================
// COLLABORATION PANEL
// ============================================================================

function CollaborationPanel() {
  const { currentProject } = useProjectStore()
  const { profile } = useUserStore()

  const { collaborators, connectionState } = useProjectCollaboration(
    currentProject?.id || null,
    {
      onUserJoined: (user) => {
        console.log('User joined:', user)
      },
      onUserLeft: (userId) => {
        console.log('User left:', userId)
      },
    }
  )

  if (!currentProject) return null

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Collaboration</h3>
      
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionState.isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-sm">
            {connectionState.isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {collaborators.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Active Collaborators</h4>
            {collaborators.map((collaborator) => (
              <div key={collaborator.id} className="flex items-center space-x-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: collaborator.color }}
                />
                <span className="text-sm">{collaborator.name}</span>
                {collaborator.isOnline && (
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                )}
              </div>
            ))}
          </div>
        )}

        {collaborators.length === 0 && (
          <p className="text-gray-500 text-sm">No active collaborators</p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// GLOBAL COMPONENTS
// ============================================================================

function GlobalNotifications() {
  const { notifications, removeNotification } = useUIStore((state) => ({
    notifications: state.notifications,
    removeNotification: state.removeNotification,
  }))

  return (
    <div className="fixed top-4 right-4 space-y-2 z-50">
      {notifications.slice(0, 5).map((notification) => (
        <div
          key={notification.id}
          className={`p-4 rounded-lg shadow-lg max-w-sm ${
            notification.type === 'success' ? 'bg-green-100 border-green-500' :
            notification.type === 'error' ? 'bg-red-100 border-red-500' :
            notification.type === 'warning' ? 'bg-yellow-100 border-yellow-500' :
            'bg-blue-100 border-blue-500'
          } border-l-4`}
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium">{notification.title}</h4>
              {notification.message && (
                <p className="text-sm mt-1">{notification.message}</p>
              )}
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function GlobalModals() {
  const { activeModal, closeModal } = useUIStore((state) => ({
    activeModal: state.modals.active,
    closeModal: state.closeModal,
  }))

  if (!activeModal) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Modal: {activeModal}</h3>
          <button
            onClick={() => closeModal()}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
        <p>This is a modal example.</p>
      </div>
    </div>
  )
}

// ============================================================================
// ENHANCED REAL-TIME SYNC INTEGRATION
// ============================================================================

function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useUserStore()
  const { handleRealtimeUpdate, handleStepUpdate } = useJobStore()

  // Set up enhanced real-time sync
  useEnhancedRealtimeSync(profile?.id || null, {
    onJobUpdate: handleRealtimeUpdate,
    onStepUpdate: handleStepUpdate,
    onSystemAlert: (alert) => {
      console.log('System alert:', alert)
    },
    enableNotifications: true,
  })

  return <>{children}</>
}

// ============================================================================
// EXPORT
// ============================================================================

export default function StateManagementExample() {
  return (
    <RealtimeSyncProvider>
      <VideoCreationApp />
    </RealtimeSyncProvider>
  )
}
