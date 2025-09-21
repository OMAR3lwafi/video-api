/**
 * Enhanced Supabase Hooks for Real-time Updates
 * Dynamic Video Content Generation Platform
 * 
 * Comprehensive real-time synchronization with:
 * - Job status updates
 * - Processing timeline updates
 * - Project collaboration
 * - Conflict resolution
 * - Connection health monitoring
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../../src/lib/supabase';
import type { Database } from '../../../src/lib/database.types';
import type { JobStatusResponse, RealtimeJobUpdate, RealtimeStepUpdate } from '../types/api';
import { useUIStore } from '../stores/uiStore';
import { useOfflineStore } from '../stores/offlineStore';

// ============================================================================
// TYPES
// ============================================================================

type JobRow = Database['public']['Tables']['jobs']['Row'];
type TimelineRow = Database['public']['Tables']['processing_timeline']['Row'];

interface UseJobStatusOptions {
  onUpdate?: (update: RealtimeJobUpdate) => void;
  onError?: (error: Error) => void;
  autoConnect?: boolean;
}

interface UseProcessingTimelineOptions {
  onStepUpdate?: (update: RealtimeStepUpdate) => void;
  onError?: (error: Error) => void;
  autoConnect?: boolean;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error?: string;
  lastUpdate?: string;
}

// ============================================================================
// JOB STATUS SUBSCRIPTION HOOK
// ============================================================================

/**
 * Hook for subscribing to real-time job status updates
 */
export function useJobStatus(
  jobId: string | null,
  options: UseJobStatusOptions = {}
) {
  const { onUpdate, onError, autoConnect = true } = options;
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
  });
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    if (!jobId || channelRef.current) return;

    setConnectionState(prev => ({ ...prev, isConnecting: true, error: undefined }));

    const channelName = `job_status_${jobId}`;
    
    try {
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            try {
              if (payload.new) {
                const jobRow = payload.new as JobRow;
                const update: RealtimeJobUpdate = {
                  job_id: jobRow.id,
                  status: jobRow.status as JobStatusResponse['status'],
                  progress: jobRow.progress_percentage || undefined,
                  message: `Job ${jobRow.status}`,
                  timestamp: new Date().toISOString(),
                };

                onUpdate?.(update);
                setConnectionState(prev => ({ 
                  ...prev, 
                  lastUpdate: update.timestamp 
                }));
              }
            } catch (error) {
              console.error('Error processing job status update:', error);
              onError?.(error as Error);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionState({
              isConnected: true,
              isConnecting: false,
              lastUpdate: new Date().toISOString(),
            });
            console.log(`Subscribed to job status updates: ${jobId}`);
          } else if (status === 'CHANNEL_ERROR') {
            const error = new Error(`Failed to subscribe to job status: ${jobId}`);
            setConnectionState({
              isConnected: false,
              isConnecting: false,
              error: error.message,
            });
            onError?.(error);
          } else if (status === 'CLOSED') {
            setConnectionState({
              isConnected: false,
              isConnecting: false,
            });
          }
        });

      channelRef.current = channel;
      jobIdRef.current = jobId;
    } catch (error) {
      const err = error as Error;
      setConnectionState({
        isConnected: false,
        isConnecting: false,
        error: err.message,
      });
      onError?.(err);
    }
  }, [jobId, onUpdate, onError]);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
      jobIdRef.current = null;
      setConnectionState({
        isConnected: false,
        isConnecting: false,
      });
      console.log('Disconnected from job status updates');
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 1000); // Wait a bit before reconnecting
  }, [disconnect, connect]);

  // Auto-connect when jobId changes
  useEffect(() => {
    if (autoConnect && jobId && jobId !== jobIdRef.current) {
      disconnect();
      connect();
    }

    return () => {
      if (!autoConnect) disconnect();
    };
  }, [jobId, autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    connectionState,
    connect,
    disconnect,
    reconnect,
  };
}

// ============================================================================
// PROCESSING TIMELINE SUBSCRIPTION HOOK
// ============================================================================

/**
 * Hook for subscribing to real-time processing step updates
 */
export function useProcessingTimeline(
  jobId: string | null,
  options: UseProcessingTimelineOptions = {}
) {
  const { onStepUpdate, onError, autoConnect = true } = options;
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
  });
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    if (!jobId || channelRef.current) return;

    setConnectionState(prev => ({ ...prev, isConnecting: true, error: undefined }));

    const channelName = `timeline_${jobId}`;
    
    try {
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'processing_timeline',
            filter: `job_id=eq.${jobId}`,
          },
          (payload) => {
            try {
              if (payload.new) {
                const timelineRow = payload.new as TimelineRow;
                const stepUpdate: RealtimeStepUpdate = {
                  job_id: timelineRow.job_id,
                  step_id: timelineRow.id,
                  step_name: timelineRow.step,
                  status: timelineRow.success === null ? 'processing' : 
                          timelineRow.success ? 'completed' : 'failed',
                  progress: timelineRow.success === null ? 50 : 
                           timelineRow.success ? 100 : 0,
                  timestamp: new Date().toISOString(),
                };

                onStepUpdate?.(stepUpdate);
                setConnectionState(prev => ({ 
                  ...prev, 
                  lastUpdate: stepUpdate.timestamp 
                }));
              }
            } catch (error) {
              console.error('Error processing timeline update:', error);
              onError?.(error as Error);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionState({
              isConnected: true,
              isConnecting: false,
              lastUpdate: new Date().toISOString(),
            });
            console.log(`Subscribed to timeline updates: ${jobId}`);
          } else if (status === 'CHANNEL_ERROR') {
            const error = new Error(`Failed to subscribe to timeline: ${jobId}`);
            setConnectionState({
              isConnected: false,
              isConnecting: false,
              error: error.message,
            });
            onError?.(error);
          } else if (status === 'CLOSED') {
            setConnectionState({
              isConnected: false,
              isConnecting: false,
            });
          }
        });

      channelRef.current = channel;
      jobIdRef.current = jobId;
    } catch (error) {
      const err = error as Error;
      setConnectionState({
        isConnected: false,
        isConnecting: false,
        error: err.message,
      });
      onError?.(err);
    }
  }, [jobId, onStepUpdate, onError]);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
      jobIdRef.current = null;
      setConnectionState({
        isConnected: false,
        isConnecting: false,
      });
      console.log('Disconnected from timeline updates');
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 1000);
  }, [disconnect, connect]);

  // Auto-connect when jobId changes
  useEffect(() => {
    if (autoConnect && jobId && jobId !== jobIdRef.current) {
      disconnect();
      connect();
    }

    return () => {
      if (!autoConnect) disconnect();
    };
  }, [jobId, autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    connectionState,
    connect,
    disconnect,
    reconnect,
  };
}

// ============================================================================
// COMBINED REAL-TIME HOOK
// ============================================================================

/**
 * Hook that combines job status and timeline subscriptions
 */
export function useRealtimeJobUpdates(
  jobId: string | null,
  options: {
    onJobUpdate?: (update: RealtimeJobUpdate) => void;
    onStepUpdate?: (update: RealtimeStepUpdate) => void;
    onError?: (error: Error) => void;
    autoConnect?: boolean;
  } = {}
) {
  const { onJobUpdate, onStepUpdate, onError, autoConnect = true } = options;

  const jobStatus = useJobStatus(jobId, {
    onUpdate: onJobUpdate,
    onError,
    autoConnect,
  });

  const timeline = useProcessingTimeline(jobId, {
    onStepUpdate,
    onError,
    autoConnect,
  });

  const isConnected = jobStatus.connectionState.isConnected && 
                     timeline.connectionState.isConnected;
  
  const isConnecting = jobStatus.connectionState.isConnecting || 
                      timeline.connectionState.isConnecting;

  const error = jobStatus.connectionState.error || timeline.connectionState.error;

  const connect = useCallback(() => {
    jobStatus.connect();
    timeline.connect();
  }, [jobStatus, timeline]);

  const disconnect = useCallback(() => {
    jobStatus.disconnect();
    timeline.disconnect();
  }, [jobStatus, timeline]);

  const reconnect = useCallback(() => {
    jobStatus.reconnect();
    timeline.reconnect();
  }, [jobStatus, timeline]);

  return {
    connectionState: {
      isConnected,
      isConnecting,
      error,
      lastUpdate: jobStatus.connectionState.lastUpdate || timeline.connectionState.lastUpdate,
    },
    connect,
    disconnect,
    reconnect,
  };
}

// ============================================================================
// CONNECTION HEALTH HOOK
// ============================================================================

/**
 * Hook for monitoring Supabase connection health
 */
export function useSupabaseHealth() {
  const [health, setHealth] = useState({
    isHealthy: true,
    lastCheck: new Date().toISOString(),
    error: null as string | null,
  });

  const checkHealth = useCallback(async () => {
    try {
      // Simple query to test connection
      const { error } = await supabase
        .from('jobs')
        .select('count')
        .limit(1);

      setHealth({
        isHealthy: !error,
        lastCheck: new Date().toISOString(),
        error: error?.message || null,
      });

      return !error;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setHealth({
        isHealthy: false,
        lastCheck: new Date().toISOString(),
        error: errorMessage,
      });
      return false;
    }
  }, []);

  // Check health every 30 seconds
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return {
    ...health,
    checkHealth,
  };
}

// ============================================================================
// PROJECT COLLABORATION HOOKS
// ============================================================================

interface UseProjectCollaborationOptions {
  onUserJoined?: (user: CollaboratorInfo) => void
  onUserLeft?: (userId: string) => void
  onCursorUpdate?: (userId: string, position: { x: number; y: number }) => void
  onElementUpdate?: (elementId: string, updates: any) => void
  onConflict?: (conflict: CollaborationConflict) => void
  autoConnect?: boolean
}

interface CollaboratorInfo {
  id: string
  name: string
  avatar?: string
  isOnline: boolean
  cursor?: { x: number; y: number }
  color: string
}

interface CollaborationConflict {
  id: string
  elementId: string
  type: 'edit' | 'delete' | 'move'
  conflictingUser: string
  timestamp: string
}

/**
 * Hook for project collaboration features
 */
export function useProjectCollaboration(
  projectId: string | null,
  options: UseProjectCollaborationOptions = {}
) {
  const { onUserJoined, onUserLeft, onCursorUpdate, onElementUpdate, onConflict, autoConnect = true } = options
  const [collaborators, setCollaborators] = useState<Map<string, CollaboratorInfo>>(new Map())
  const [conflicts, setConflicts] = useState<CollaborationConflict[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
  })
  
  const channelRef = useRef<RealtimeChannel | null>(null)
  const projectIdRef = useRef<string | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (!projectId || channelRef.current) return

    setConnectionState(prev => ({ ...prev, isConnecting: true, error: undefined }))

    const channelName = `project_collaboration_${projectId}`
    
    try {
      const channel = supabase
        .channel(channelName)
        .on('presence', { event: 'sync' }, () => {
          const newState = channel.presenceState()
          const collaboratorMap = new Map<string, CollaboratorInfo>()
          
          Object.entries(newState).forEach(([userId, presences]) => {
            const presence = presences[0] as any
            collaboratorMap.set(userId, {
              id: userId,
              name: presence.name || 'Anonymous',
              avatar: presence.avatar,
              isOnline: true,
              cursor: presence.cursor,
              color: presence.color || '#3b82f6',
            })
          })
          
          setCollaborators(collaboratorMap)
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          const user = newPresences[0] as any
          const collaborator: CollaboratorInfo = {
            id: key,
            name: user.name || 'Anonymous',
            avatar: user.avatar,
            isOnline: true,
            cursor: user.cursor,
            color: user.color || '#3b82f6',
          }
          
          setCollaborators(prev => new Map(prev.set(key, collaborator)))
          onUserJoined?.(collaborator)
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          setCollaborators(prev => {
            const newMap = new Map(prev)
            newMap.delete(key)
            return newMap
          })
          onUserLeft?.(key)
        })
        .on('broadcast', { event: 'cursor_move' }, ({ payload }) => {
          const { userId, position } = payload
          setCollaborators(prev => {
            const collaborator = prev.get(userId)
            if (collaborator) {
              const updated = new Map(prev)
              updated.set(userId, { ...collaborator, cursor: position })
              return updated
            }
            return prev
          })
          onCursorUpdate?.(userId, position)
        })
        .on('broadcast', { event: 'element_update' }, ({ payload }) => {
          const { elementId, updates, userId } = payload
          onElementUpdate?.(elementId, updates)
          
          // Check for conflicts
          const currentUser = getCurrentUserId()
          if (userId !== currentUser) {
            // Potential conflict - would need more sophisticated conflict detection
            console.log('Potential conflict detected:', { elementId, userId })
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionState({
              isConnected: true,
              isConnecting: false,
              lastUpdate: new Date().toISOString(),
            })
            
            // Send presence
            await channel.track({
              name: getCurrentUserName(),
              avatar: getCurrentUserAvatar(),
              color: getCurrentUserColor(),
              cursor: null,
            })
            
            // Set up heartbeat
            heartbeatRef.current = setInterval(() => {
              channel.send({
                type: 'broadcast',
                event: 'heartbeat',
                payload: { userId: getCurrentUserId(), timestamp: Date.now() }
              })
            }, 30000)
            
            console.log(`Connected to project collaboration: ${projectId}`)
          } else if (status === 'CHANNEL_ERROR') {
            const error = new Error(`Failed to connect to collaboration: ${projectId}`)
            setConnectionState({
              isConnected: false,
              isConnecting: false,
              error: error.message,
            })
          } else if (status === 'CLOSED') {
            setConnectionState({
              isConnected: false,
              isConnecting: false,
            })
          }
        })

      channelRef.current = channel
      projectIdRef.current = projectId
    } catch (error) {
      const err = error as Error
      setConnectionState({
        isConnected: false,
        isConnecting: false,
        error: err.message,
      })
    }
  }, [projectId, onUserJoined, onUserLeft, onCursorUpdate, onElementUpdate])

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
      projectIdRef.current = null
      
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      
      setConnectionState({
        isConnected: false,
        isConnecting: false,
      })
      setCollaborators(new Map())
      console.log('Disconnected from project collaboration')
    }
  }, [])

  const broadcastCursorMove = useCallback((position: { x: number; y: number }) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'cursor_move',
        payload: { userId: getCurrentUserId(), position }
      })
    }
  }, [])

  const broadcastElementUpdate = useCallback((elementId: string, updates: any) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'element_update',
        payload: { elementId, updates, userId: getCurrentUserId() }
      })
    }
  }, [])

  // Auto-connect when projectId changes
  useEffect(() => {
    if (autoConnect && projectId && projectId !== projectIdRef.current) {
      disconnect()
      connect()
    }

    return () => {
      if (!autoConnect) disconnect()
    }
  }, [projectId, autoConnect, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect()
  }, [disconnect])

  return {
    collaborators: Array.from(collaborators.values()),
    conflicts,
    connectionState,
    connect,
    disconnect,
    broadcastCursorMove,
    broadcastElementUpdate,
  }
}

// ============================================================================
// ENHANCED REAL-TIME SYNC HOOK
// ============================================================================

interface UseEnhancedRealtimeSyncOptions {
  onJobUpdate?: (update: RealtimeJobUpdate) => void
  onStepUpdate?: (update: RealtimeStepUpdate) => void
  onProjectUpdate?: (projectId: string, updates: any) => void
  onSystemAlert?: (alert: SystemAlert) => void
  onError?: (error: Error) => void
  autoConnect?: boolean
  enableNotifications?: boolean
}

interface SystemAlert {
  id: string
  type: 'maintenance' | 'service_disruption' | 'feature_update'
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
}

/**
 * Enhanced hook for comprehensive real-time synchronization
 */
export function useEnhancedRealtimeSync(
  userId: string | null,
  options: UseEnhancedRealtimeSyncOptions = {}
) {
  const {
    onJobUpdate,
    onStepUpdate,
    onProjectUpdate,
    onSystemAlert,
    onError,
    autoConnect = true,
    enableNotifications = true
  } = options

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
  })
  
  const [syncStats, setSyncStats] = useState({
    messagesReceived: 0,
    lastMessage: null as string | null,
    connectionUptime: 0,
  })

  const channelRef = useRef<RealtimeChannel | null>(null)
  const userIdRef = useRef<string | null>(null)
  const uptimeStartRef = useRef<number>(0)
  const uiStore = useUIStore()
  const offlineStore = useOfflineStore()

  const connect = useCallback(() => {
    if (!userId || channelRef.current) return

    setConnectionState(prev => ({ ...prev, isConnecting: true, error: undefined }))

    const channelName = `user_sync_${userId}`
    
    try {
      const channel = supabase
        .channel(channelName)
        // Job updates
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            try {
              const jobRow = payload.new as any
              if (jobRow) {
                const update: RealtimeJobUpdate = {
                  job_id: jobRow.id,
                  status: jobRow.status,
                  progress: jobRow.progress_percentage,
                  message: `Job ${jobRow.status}`,
                  timestamp: new Date().toISOString(),
                }

                onJobUpdate?.(update)
                setSyncStats(prev => ({
                  ...prev,
                  messagesReceived: prev.messagesReceived + 1,
                  lastMessage: 'job_update',
                }))

                // Show notification for important job updates
                if (enableNotifications && (jobRow.status === 'completed' || jobRow.status === 'failed')) {
                  uiStore.addNotification({
                    type: jobRow.status === 'completed' ? 'success' : 'error',
                    title: `Job ${jobRow.status}`,
                    message: jobRow.status === 'completed' 
                      ? 'Your video has been processed successfully!'
                      : 'Video processing failed. Please try again.',
                    duration: 5000,
                  })
                }
              }
            } catch (error) {
              console.error('Error processing job update:', error)
              onError?.(error as Error)
            }
          }
        )
        // Processing timeline updates
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'processing_timeline',
          },
          (payload) => {
            try {
              const timelineRow = payload.new as any
              if (timelineRow) {
                const stepUpdate: RealtimeStepUpdate = {
                  job_id: timelineRow.job_id,
                  step_id: timelineRow.id,
                  step_name: timelineRow.step,
                  status: timelineRow.success === null ? 'processing' : 
                          timelineRow.success ? 'completed' : 'failed',
                  progress: timelineRow.success === null ? 50 : 
                           timelineRow.success ? 100 : 0,
                  timestamp: new Date().toISOString(),
                }

                onStepUpdate?.(stepUpdate)
                setSyncStats(prev => ({
                  ...prev,
                  messagesReceived: prev.messagesReceived + 1,
                  lastMessage: 'step_update',
                }))
              }
            } catch (error) {
              console.error('Error processing step update:', error)
              onError?.(error as Error)
            }
          }
        )
        // System alerts
        .on('broadcast', { event: 'system_alert' }, ({ payload }) => {
          const alert = payload as SystemAlert
          onSystemAlert?.(alert)
          
          if (enableNotifications) {
            const notificationType = alert.severity === 'critical' ? 'error' : 
                                   alert.severity === 'high' ? 'warning' : 'info'
            
            uiStore.addNotification({
              type: notificationType,
              title: alert.title,
              message: alert.message,
              persistent: alert.severity === 'critical',
              duration: alert.severity === 'critical' ? undefined : 10000,
            })
          }
          
          setSyncStats(prev => ({
            ...prev,
            messagesReceived: prev.messagesReceived + 1,
            lastMessage: 'system_alert',
          }))
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionState({
              isConnected: true,
              isConnecting: false,
              lastUpdate: new Date().toISOString(),
            })
            
            uptimeStartRef.current = Date.now()
            
            // Update offline store
            offlineStore.setOnlineStatus(true)
            
            console.log(`Connected to enhanced real-time sync: ${userId}`)
          } else if (status === 'CHANNEL_ERROR') {
            const error = new Error(`Failed to connect to real-time sync: ${userId}`)
            setConnectionState({
              isConnected: false,
              isConnecting: false,
              error: error.message,
            })
            onError?.(error)
          } else if (status === 'CLOSED') {
            setConnectionState({
              isConnected: false,
              isConnecting: false,
            })
          }
        })

      channelRef.current = channel
      userIdRef.current = userId
    } catch (error) {
      const err = error as Error
      setConnectionState({
        isConnected: false,
        isConnecting: false,
        error: err.message,
      })
      onError?.(err)
    }
  }, [userId, onJobUpdate, onStepUpdate, onSystemAlert, onError, enableNotifications])

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
      userIdRef.current = null
      
      setConnectionState({
        isConnected: false,
        isConnecting: false,
      })
      
      console.log('Disconnected from enhanced real-time sync')
    }
  }, [])

  // Update connection uptime
  useEffect(() => {
    if (connectionState.isConnected && uptimeStartRef.current) {
      const interval = setInterval(() => {
        setSyncStats(prev => ({
          ...prev,
          connectionUptime: Date.now() - uptimeStartRef.current,
        }))
      }, 1000)
      
      return () => clearInterval(interval)
    }
  }, [connectionState.isConnected])

  // Auto-connect when userId changes
  useEffect(() => {
    if (autoConnect && userId && userId !== userIdRef.current) {
      disconnect()
      connect()
    }

    return () => {
      if (!autoConnect) disconnect()
    }
  }, [userId, autoConnect, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect()
  }, [disconnect])

  return {
    connectionState,
    syncStats,
    connect,
    disconnect,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCurrentUserId(): string {
  // This would get the current user ID from your auth system
  return 'current-user-id'
}

function getCurrentUserName(): string {
  // This would get the current user name from your auth system
  return 'Current User'
}

function getCurrentUserAvatar(): string | undefined {
  // This would get the current user avatar from your auth system
  return undefined
}

function getCurrentUserColor(): string {
  // Generate a consistent color for the user
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']
  const userId = getCurrentUserId()
  const hash = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  return colors[Math.abs(hash) % colors.length]
}
