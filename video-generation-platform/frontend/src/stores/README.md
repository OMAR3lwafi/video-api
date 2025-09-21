# Comprehensive State Management System

## Overview

This directory contains a robust state management system built with Zustand for the Dynamic Video Content Generation Platform. The system provides comprehensive state management with API integration, real-time synchronization, caching, offline support, and optimistic updates.

## Architecture

### Store Structure

```
stores/
├── index.ts              # Central exports and store composition
├── types.ts              # TypeScript type definitions
├── appStore.ts           # Global application state
├── projectStore.ts       # Project and video management
├── jobStore.ts           # Video processing jobs
├── uiStore.ts            # UI state and preferences
├── userStore.ts          # User authentication and preferences
├── cacheStore.ts         # API response caching
├── offlineStore.ts       # Offline support and sync
├── context.tsx           # React context provider
├── selectors.ts          # State selectors and computed values
├── actions.ts            # Cross-store actions
├── middleware/           # Custom Zustand middleware
├── utils/                # Store utilities and helpers
└── README.md             # This documentation
```

### Core Features

- **🔄 Real-time Synchronization**: Live updates via Supabase
- **📡 Offline Support**: Queue operations for later sync
- **💾 Intelligent Caching**: Multi-layer caching with TTL
- **⚡ Optimistic Updates**: Immediate UI feedback
- **🔐 Type Safety**: Full TypeScript coverage
- **🎯 Performance**: Selective subscriptions and memoization
- **🔧 Developer Tools**: Redux DevTools integration
- **💪 Error Handling**: Comprehensive error recovery

## Store Descriptions

### AppStore (`appStore.ts`)

Manages global application state including system health, performance metrics, and feature flags.

**Key Features:**
- System health monitoring
- Network status tracking
- Performance metrics collection
- Feature flag management
- Application initialization

**Usage:**
```typescript
import { useAppStore } from './stores/appStore'

function SystemStatus() {
  const { isOnline, systemHealth, features } = useAppStore()
  
  return (
    <div>
      <span>Status: {isOnline ? 'Online' : 'Offline'}</span>
      <span>Health: {systemHealth}</span>
    </div>
  )
}
```

### ProjectStore (`projectStore.ts`)

Handles video project management, canvas state, timeline, and elements.

**Key Features:**
- Project CRUD operations
- Element management with optimistic updates
- Canvas state (zoom, pan, selection)
- Timeline controls
- History/undo system
- Auto-save functionality
- Collaboration support

**Usage:**
```typescript
import { useProjectStore } from './stores/projectStore'

function VideoEditor() {
  const { 
    currentProject, 
    addElement, 
    updateElement,
    undo,
    redo 
  } = useProjectStore()
  
  const handleAddImage = () => {
    addElement({
      type: 'image',
      source: 'https://example.com/image.jpg',
      track: 0
    })
  }
  
  return (
    <div>
      <button onClick={handleAddImage}>Add Image</button>
      <button onClick={undo}>Undo</button>
      <button onClick={redo}>Redo</button>
    </div>
  )
}
```

### JobStore (`jobStore.ts`)

Manages video processing jobs with real-time updates and queue management.

**Key Features:**
- Job lifecycle management
- Real-time status updates
- Queue management with priorities
- Retry logic for failed jobs
- Statistics tracking
- Supabase integration

**Usage:**
```typescript
import { useJobStore, useActiveJobs } from './stores/jobStore'

function JobQueue() {
  const activeJobs = useActiveJobs()
  const { createJob, cancelJob } = useJobStore()
  
  return (
    <div>
      {activeJobs.map(job => (
        <div key={job.id}>
          <span>{job.id} - {job.progress}%</span>
          <button onClick={() => cancelJob(job.id)}>Cancel</button>
        </div>
      ))}
    </div>
  )
}
```

### UIStore (`uiStore.ts`)

Controls global UI state including notifications, modals, panels, and layout.

**Key Features:**
- Global loading states
- Notification system
- Modal management
- Panel state control
- Theme management
- Keyboard shortcuts
- Accessibility settings

**Usage:**
```typescript
import { useUIStore, useNotifications } from './stores/uiStore'

function NotificationCenter() {
  const { notifications, addNotification, removeNotification } = useNotifications()
  
  const showSuccess = () => {
    addNotification({
      type: 'success',
      title: 'Success!',
      message: 'Operation completed successfully',
      duration: 3000
    })
  }
  
  return (
    <div>
      <button onClick={showSuccess}>Show Success</button>
      {notifications.map(notification => (
        <div key={notification.id}>
          {notification.title}
          <button onClick={() => removeNotification(notification.id)}>×</button>
        </div>
      ))}
    </div>
  )
}
```

### UserStore (`userStore.ts`)

Manages user authentication, profile, preferences, and usage tracking.

**Key Features:**
- Authentication flow
- User profile management
- Preferences synchronization
- Usage statistics
- Subscription management
- Activity tracking

**Usage:**
```typescript
import { useAuth, useUserPreferences } from './stores/userStore'

function UserProfile() {
  const { isAuthenticated, profile, login, logout } = useAuth()
  const { preferences, updatePreferences } = useUserPreferences()
  
  if (!isAuthenticated) {
    return (
      <button onClick={() => login('email', 'password')}>
        Login
      </button>
    )
  }
  
  return (
    <div>
      <h3>Welcome, {profile?.name}!</h3>
      <label>
        <input
          type="checkbox"
          checked={preferences.ui.animations}
          onChange={(e) => updatePreferences('ui', { 
            animations: e.target.checked 
          })}
        />
        Enable Animations
      </label>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

### CacheStore (`cacheStore.ts`)

Implements intelligent caching for API responses, assets, and computed data.

**Key Features:**
- Multi-layer caching (API, assets, templates, projects)
- TTL-based expiration
- LRU eviction
- Compression support
- Cache statistics
- Import/export functionality

**Usage:**
```typescript
import { useCacheStore, useCacheStats } from './stores/cacheStore'

function CacheManager() {
  const { hitRate, totalSize } = useCacheStats()
  const { clear, cleanup } = useCacheStore()
  
  return (
    <div>
      <p>Hit Rate: {Math.round(hitRate * 100)}%</p>
      <p>Size: {totalSize} bytes</p>
      <button onClick={() => clear()}>Clear Cache</button>
      <button onClick={() => cleanup()}>Cleanup Expired</button>
    </div>
  )
}
```

### OfflineStore (`offlineStore.ts`)

Provides offline support with operation queuing and synchronization.

**Key Features:**
- Network status monitoring
- Operation queuing
- Conflict resolution
- Offline storage
- Sync management
- Connection quality detection

**Usage:**
```typescript
import { useNetworkStatus, useOfflineQueue } from './stores/offlineStore'

function OfflineIndicator() {
  const { isOnline, connectionQuality } = useNetworkStatus()
  const { length, pending, processing } = useOfflineQueue()
  
  return (
    <div>
      <span>Status: {isOnline ? 'Online' : 'Offline'}</span>
      <span>Quality: {connectionQuality}</span>
      {length > 0 && (
        <span>Queue: {pending} pending, {processing} processing</span>
      )}
    </div>
  )
}
```

## API Integration

### Enhanced API Service (`services/apiService.ts`)

The API service provides comprehensive HTTP client functionality:

**Features:**
- Request/response interceptors
- Automatic retry with exponential backoff
- Request cancellation
- Caching integration
- Error transformation
- Performance monitoring

**Usage:**
```typescript
import { apiService } from '../services/apiService'

// Create video with automatic retry and caching
const response = await apiService.createVideo({
  output_format: 'mp4',
  width: 1920,
  height: 1080,
  elements: [...]
})

// Get job status with caching disabled
const status = await apiService.getJobStatus(jobId)

// Cancel active requests
apiService.cancelRequest()
```

## Real-time Features

### Supabase Integration (`hooks/useSupabase.ts`)

Comprehensive real-time synchronization with multiple subscription types:

**Features:**
- Job status updates
- Processing timeline updates
- Project collaboration
- System alerts
- Connection health monitoring

**Usage:**
```typescript
import { 
  useEnhancedRealtimeSync, 
  useProjectCollaboration 
} from '../hooks/useSupabase'

function RealtimeComponent() {
  // Enhanced sync for user-specific updates
  const { connectionState, syncStats } = useEnhancedRealtimeSync(userId, {
    onJobUpdate: (update) => console.log('Job update:', update),
    onSystemAlert: (alert) => console.log('System alert:', alert),
  })
  
  // Project collaboration
  const { collaborators, broadcastCursorMove } = useProjectCollaboration(projectId, {
    onUserJoined: (user) => console.log('User joined:', user),
    onCursorUpdate: (userId, position) => console.log('Cursor moved:', userId, position),
  })
  
  return (
    <div>
      <p>Connected: {connectionState.isConnected}</p>
      <p>Messages: {syncStats.messagesReceived}</p>
      <p>Collaborators: {collaborators.length}</p>
    </div>
  )
}
```

## Cross-Store Actions

### Centralized Actions (`actions.ts`)

High-level actions that coordinate multiple stores:

```typescript
import { 
  createProjectWithSetup,
  exportVideoWithTracking,
  loginWithSetup,
  forceSyncWithProgress 
} from './stores/actions'

// Create project with full initialization
await createProjectWithSetup('My Project', 'template-id')

// Export video with job tracking and user limits
const jobId = await exportVideoWithTracking({
  output_format: 'mp4',
  width: 1920,
  height: 1080,
  elements: [...]
})

// Login with user setup and analytics
await loginWithSetup('user@example.com', 'password')

// Force sync with progress feedback
await forceSyncWithProgress()
```

## Performance Optimizations

### Selective Subscriptions

Use specific selectors to minimize re-renders:

```typescript
// ❌ Bad - subscribes to entire store
const store = useProjectStore()

// ✅ Good - subscribes only to needed data
const projectName = useProjectStore(state => state.currentProject?.name)
const isDirty = useProjectStore(state => state.isDirty)
```

### Memoized Selectors

Use selectors for computed values:

```typescript
import { projectSelectors } from './stores/selectors'

const elementCount = useProjectStore(projectSelectors.elementCount)
const canUndo = useProjectStore(projectSelectors.canUndo)
```

### Optimistic Updates

Updates happen immediately with rollback on failure:

```typescript
// Element updates are optimistic by default
updateElement(elementId, { x: '50%', y: '50%' })
// UI updates immediately, syncs in background
```

## Error Handling

### Comprehensive Error Recovery

```typescript
try {
  await saveProjectWithFeedback()
} catch (error) {
  // Error is automatically handled:
  // 1. User notification shown
  // 2. Error logged
  // 3. Offline queue if network issue
  // 4. Retry options presented
}
```

### Error Boundaries

The store context provides global error handling:

```typescript
// Errors are automatically caught and displayed as notifications
// No manual error handling needed for most operations
```

## Development Tools

### Redux DevTools Integration

All stores support Redux DevTools for debugging:

```typescript
// Actions are logged with descriptive names
// State changes are tracked
// Time travel debugging available
```

### Debug Utilities

```typescript
import { useStoreDebug } from './stores/context'

function DebugPanel() {
  const { exportStoreStates, reset } = useStoreDebug()
  
  return (
    <div>
      <button onClick={exportStoreStates}>Export State</button>
      <button onClick={reset}>Reset All Stores</button>
    </div>
  )
}
```

## Testing

### Store Testing

```typescript
import { useProjectStore } from './stores/projectStore'

describe('ProjectStore', () => {
  beforeEach(() => {
    useProjectStore.getState().reset()
  })
  
  it('should create project', () => {
    const { createProject } = useProjectStore.getState()
    createProject('Test Project')
    
    const project = useProjectStore.getState().currentProject
    expect(project?.name).toBe('Test Project')
  })
})
```

### Integration Testing

```typescript
import { render } from '@testing-library/react'
import { StoreProvider } from './stores/context'
import MyComponent from './MyComponent'

test('component with stores', () => {
  render(
    <StoreProvider>
      <MyComponent />
    </StoreProvider>
  )
})
```

## Best Practices

### 1. Store Organization
- Keep stores focused on specific domains
- Use cross-store actions for complex workflows
- Maintain clear separation of concerns

### 2. Performance
- Use selective subscriptions
- Implement memoized selectors
- Avoid unnecessary re-renders

### 3. Error Handling
- Use provided error boundaries
- Implement graceful degradation
- Provide user feedback

### 4. Type Safety
- Define comprehensive types
- Use strict TypeScript settings
- Validate data at boundaries

### 5. Real-time Features
- Handle connection failures gracefully
- Implement conflict resolution
- Provide offline fallbacks

## Migration Guide

### From Existing Store

If migrating from an existing store system:

1. **Identify State Domains**: Map existing state to appropriate stores
2. **Create Migration Actions**: Use cross-store actions for complex migrations
3. **Update Components Gradually**: Migrate components one by one
4. **Test Thoroughly**: Ensure all functionality works with new stores

### Example Migration

```typescript
// Old: Single store
const oldState = useStore(state => ({
  project: state.project,
  jobs: state.jobs,
  ui: state.ui
}))

// New: Specific stores
const project = useProjectStore(state => state.currentProject)
const jobs = useActiveJobs()
const { notifications } = useNotifications()
```

## Troubleshooting

### Common Issues

1. **Store Not Updating**: Check if using correct selector
2. **Memory Leaks**: Ensure proper cleanup in useEffect
3. **Performance Issues**: Use selective subscriptions
4. **Type Errors**: Verify type definitions are up to date

### Debug Steps

1. Check Redux DevTools for state changes
2. Verify network requests in browser tools
3. Check console for error messages
4. Use store debug utilities

## Contributing

When adding new features to the store system:

1. Follow existing patterns and conventions
2. Add comprehensive TypeScript types
3. Include error handling
4. Add tests for new functionality
5. Update documentation
6. Consider performance implications

## Conclusion

This state management system provides a robust foundation for complex applications with real-time features, offline support, and comprehensive error handling. The modular architecture allows for easy extension and maintenance while providing excellent developer experience and performance.
