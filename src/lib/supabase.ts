/**
 * Supabase Client Configuration
 * Dynamic Video Content Generation Platform
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Database } from './database.types';

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// ============================================================================
// CLIENT INSTANCES
// ============================================================================

/**
 * Public Supabase client for browser/client-side operations
 * Uses anon key with RLS policies for security
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10, // Rate limit for real-time events
      },
    },
    db: {
      schema: 'public',
    },
  }
);

/**
 * Service role client for server-side operations
 * Bypasses RLS policies - use with caution
 */
export const supabaseAdmin: SupabaseClient<Database> = supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    })
  : supabase; // Fallback to regular client if service key not available

// ============================================================================
// REAL-TIME SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Active subscription channels registry
 */
const activeChannels = new Map<string, RealtimeChannel>();

/**
 * Subscribe to job status changes for real-time updates
 */
export function subscribeToJobStatus(
  jobId: string,
  callback: (payload: Database['public']['Tables']['jobs']['Row']) => void,
  errorCallback?: (error: Error) => void
): RealtimeChannel {
  const channelName = `job_status_${jobId}`;
  
  // Remove existing subscription if any
  if (activeChannels.has(channelName)) {
    activeChannels.get(channelName)?.unsubscribe();
    activeChannels.delete(channelName);
  }

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
            callback(payload.new as Database['public']['Tables']['jobs']['Row']);
          }
        } catch (error) {
          errorCallback?.(error as Error);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to job status updates for job: ${jobId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Failed to subscribe to job status updates for job: ${jobId}`);
        errorCallback?.(new Error(`Subscription failed for job: ${jobId}`));
      }
    });

  activeChannels.set(channelName, channel);
  return channel;
}

/**
 * Subscribe to processing timeline updates for a job
 */
export function subscribeToProcessingTimeline(
  jobId: string,
  callback: (payload: Database['public']['Tables']['processing_timeline']['Row']) => void,
  errorCallback?: (error: Error) => void
): RealtimeChannel {
  const channelName = `timeline_${jobId}`;
  
  // Remove existing subscription if any
  if (activeChannels.has(channelName)) {
    activeChannels.get(channelName)?.unsubscribe();
    activeChannels.delete(channelName);
  }

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
            callback(payload.new as Database['public']['Tables']['processing_timeline']['Row']);
          }
        } catch (error) {
          errorCallback?.(error as Error);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to timeline updates for job: ${jobId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Failed to subscribe to timeline updates for job: ${jobId}`);
        errorCallback?.(new Error(`Timeline subscription failed for job: ${jobId}`));
      }
    });

  activeChannels.set(channelName, channel);
  return channel;
}

/**
 * Subscribe to all active jobs for monitoring dashboard
 */
export function subscribeToActiveJobs(
  callback: (payload: any) => void,
  errorCallback?: (error: Error) => void
): RealtimeChannel {
  const channelName = 'active_jobs_monitor';
  
  // Remove existing subscription if any
  if (activeChannels.has(channelName)) {
    activeChannels.get(channelName)?.unsubscribe();
    activeChannels.delete(channelName);
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: 'status=in.(pending,processing)',
      },
      (payload) => {
        try {
          callback(payload);
        } catch (error) {
          errorCallback?.(error as Error);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Subscribed to active jobs monitoring');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Failed to subscribe to active jobs monitoring');
        errorCallback?.(new Error('Active jobs subscription failed'));
      }
    });

  activeChannels.set(channelName, channel);
  return channel;
}

/**
 * Unsubscribe from a specific channel
 */
export function unsubscribeFromChannel(channelName: string): void {
  const channel = activeChannels.get(channelName);
  if (channel) {
    channel.unsubscribe();
    activeChannels.delete(channelName);
    console.log(`Unsubscribed from channel: ${channelName}`);
  }
}

/**
 * Unsubscribe from all active channels
 */
export function unsubscribeFromAll(): void {
  activeChannels.forEach((channel, channelName) => {
    channel.unsubscribe();
    console.log(`Unsubscribed from channel: ${channelName}`);
  });
  activeChannels.clear();
}

// ============================================================================
// DATABASE OPERATION HELPERS
// ============================================================================

/**
 * Create a new job with validation
 */
export async function createJob(params: {
  output_format: string;
  width: number;
  height: number;
  estimated_duration?: number;
  client_ip?: string;
  user_agent?: string;
  request_metadata?: any;
}) {
  const { data, error } = await (supabase as any).rpc('create_job', {
    p_output_format: params.output_format,
    p_width: params.width,
    p_height: params.height,
    p_estimated_duration: params.estimated_duration,
    p_client_ip: params.client_ip,
    p_user_agent: params.user_agent,
    p_request_metadata: params.request_metadata,
  });

  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }

  return data;
}

/**
 * Get job summary with all related data
 */
export async function getJobSummary(jobId: string) {
  const { data, error } = await supabase
    .from('job_summary')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error(`Failed to get job summary: ${error.message}`);
  }

  return data;
}

/**
 * Get real-time job status
 */
export async function getJobStatus(jobId: string) {
  const { data, error } = await supabase
    .from('job_status_realtime')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error(`Failed to get job status: ${error.message}`);
  }

  return data;
}

/**
 * Add element to job
 */
export async function addJobElement(params: {
  job_id: string;
  type: string;
  source_url: string;
  element_order: number;
  track?: number;
  x_position?: string;
  y_position?: string;
  width?: string;
  height?: string;
  fit_mode?: string;
  start_time?: number;
  end_time?: number;
  metadata?: any;
}) {
  const { data, error } = await (supabase as any).rpc('add_job_element', {
    job_uuid: params.job_id,
    element_type_val: params.type,
    source_url_val: params.source_url,
    element_order_val: params.element_order,
    track_val: params.track,
    x_pos: params.x_position,
    y_pos: params.y_position,
    width_val: params.width,
    height_val: params.height,
    fit_mode_val: params.fit_mode,
    start_time_val: params.start_time,
    end_time_val: params.end_time,
    metadata_val: params.metadata,
  });

  if (error) {
    throw new Error(`Failed to add job element: ${error.message}`);
  }

  return data;
}

/**
 * Update job status (service role required)
 */
export async function updateJobStatus(
  jobId: string,
  status: string,
  errorMessage?: string,
  errorCode?: string
) {
  const { data, error } = await (supabaseAdmin as any).rpc('update_job_status', {
    job_uuid: jobId,
    new_status: status,
    error_msg: errorMessage,
    error_code_val: errorCode,
  });

  if (error) {
    throw new Error(`Failed to update job status: ${error.message}`);
  }

  return data;
}

/**
 * Get job statistics for analytics
 */
export async function getJobStatistics(
  startDate?: string,
  endDate?: string
) {
  const { data, error } = await (supabase as any).rpc('get_job_statistics', {
    start_date: startDate,
    end_date: endDate,
  });

  if (error) {
    throw new Error(`Failed to get job statistics: ${error.message}`);
  }

  return data;
}

/**
 * Get system health status
 */
export async function getSystemHealth() {
  const { data, error } = await supabase
    .from('system_health')
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to get system health: ${error.message}`);
  }

  return data;
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('count')
      .limit(1);

    return !error;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Test auth functions
 */
export async function testAuthFunctions(): Promise<{
  userRole: string | null;
  isAdmin: boolean | null;
  clientIp: string | null;
}> {
  try {
    const { data: userRole } = await (supabase as any).rpc('get_current_user_role');
    const { data: isAdmin } = await (supabase as any).rpc('is_admin_user');
    const { data: clientIp } = await (supabase as any).rpc('get_client_ip');

    return {
      userRole,
      isAdmin,
      clientIp,
    };
  } catch (error) {
    console.error('Auth functions test failed:', error);
    return {
      userRole: null,
      isAdmin: null,
      clientIp: null,
    };
  }
}

/**
 * Health check for Supabase connection
 */
export async function healthCheck(): Promise<{
  database: boolean;
  realtime: boolean;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  
  // Test database connection
  const databaseHealth = await testConnection();
  
  // Test realtime connection
  let realtimeHealth = false;
  try {
    const testChannel = supabase.channel('health_check');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Realtime connection timeout'));
      }, 5000);

      testChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          realtimeHealth = true;
          resolve(true);
        } else if (status === 'CHANNEL_ERROR') {
          clearTimeout(timeout);
          reject(new Error('Realtime connection failed'));
        }
      });
    });
    
    testChannel.unsubscribe();
  } catch (error) {
    console.error('Realtime health check failed:', error);
    realtimeHealth = false;
  }

  return {
    database: databaseHealth,
    realtime: realtimeHealth,
    timestamp,
  };
}

// ============================================================================
// CLEANUP ON MODULE UNLOAD
// ============================================================================

// Clean up subscriptions when the module is unloaded
// Only run this in browser environment
// Note: Commented out for Node.js compatibility during validation
// if (typeof window !== 'undefined') {
//   window.addEventListener('beforeunload', () => {
//     unsubscribeFromAll();
//   });
// }

// Export types for TypeScript support
export type { Database } from './database.types';
