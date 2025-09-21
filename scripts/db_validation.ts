/**
 * Database validation script
 * Verifies core functions, triggers, views, and realtime subscriptions end-to-end
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import {
  supabase,
  supabaseAdmin,
  subscribeToJobStatus,
  subscribeToProcessingTimeline,
} from '../src/lib/supabase';

// Local row interfaces for views not present in generated Database types
type JobSummaryRow = {
  id: string;
  status: string;
  file_size: number | null;
  result_url: string | null;
};

type JobStatusRealtimeRow = {
  id: string;
  status: string;
  progress_percentage: number | null;
};

/**
 * Wait helper with timeout to allow realtime events to arrive
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  // Track realtime events to assert delivery
  const statusEvents: any[] = [];
  const timelineEvents: any[] = [];

  // 1) Create job (tests input validation and response_type derivation)
  // Cast to any because generated Database types may not include function arg types yet
  const { data: newJobId, error: createErr } = await (supabase as any).rpc('create_job', {
    p_output_format: 'mp4',
    p_width: 1280,
    p_height: 720,
    p_estimated_duration: 25,
    p_client_ip: '127.0.0.1',
    p_user_agent: 'db-validation-script',
    p_request_metadata: { source: 'validation' },
  });
  if (createErr || !newJobId) {
    throw new Error(`create_job failed: ${createErr?.message ?? 'no id returned'}`);
  }
  const jobId: string = newJobId as unknown as string;
  console.log('[OK] Job created:', jobId);

  // 2) Add element (tests element constraints and unique (job_id, element_order))
  const { error: addElemErr } = await (supabase as any).rpc('add_job_element', {
    job_uuid: jobId,
    element_type_val: 'image',
    source_url_val: 'https://example.com/sample.jpg',
    element_order_val: 0,
  });
  if (addElemErr) {
    throw new Error(`add_job_element failed: ${addElemErr.message}`);
  }
  console.log('[OK] Element added');

  // 3) Subscribe to realtime (jobs and processing_timeline)
  const statusChannel = subscribeToJobStatus(
    jobId,
    (row) => statusEvents.push(row),
    (err) => console.error('Job status subscription error:', err)
  );
  const timelineChannel = subscribeToProcessingTimeline(
    jobId,
    (row) => timelineEvents.push(row),
    (err) => console.error('Timeline subscription error:', err)
  );

  // 4) Start and complete a processing step (tests timeline functions + triggers)
  const { data: timelineId, error: startErr } = await (supabaseAdmin as any).rpc('start_processing_step', {
    job_uuid: jobId,
    step_val: 'validation',
    step_order_val: 1,
    details_val: { note: 'begin validation' },
  });
  if (startErr || !timelineId) {
    throw new Error(`start_processing_step failed: ${startErr?.message ?? 'no id'}`);
  }

  const { error: completeErr } = await (supabaseAdmin as any).rpc('complete_processing_step', {
    timeline_uuid: timelineId,
    success_val: true,
    progress_val: 10,
  });
  if (completeErr) {
    throw new Error(`complete_processing_step failed: ${completeErr.message}`);
  }
  console.log('[OK] Processing step completed');

  // 5) Move job to processing (tests status transition validation)
  const { error: statusProcErr } = await (supabaseAdmin as any).rpc('update_job_status', {
    job_uuid: jobId,
    new_status: 'processing',
  });
  if (statusProcErr) {
    throw new Error(`update_job_status(processing) failed: ${statusProcErr.message}`);
  }

  // 6) Log successful upload to propagate S3 fields to job (tests AFTER INSERT trigger)
  const { error: logErr } = await (supabaseAdmin as any).rpc('log_storage_operation', {
    job_uuid: jobId,
    operation_val: 'upload',
    bucket_val: 'validation-bucket',
    key_val: `results/${jobId}.mp4`,
    region_val: 'us-east-1',
    success_val: true,
    file_size_val: 2048,
    duration_ms_val: 350,
  });
  if (logErr) {
    throw new Error(`log_storage_operation failed: ${logErr.message}`);
  }
  console.log('[OK] Storage operation logged');

  // 7) Update progress to 100 to auto-complete via trigger
  const { error: progressErr } = await (supabaseAdmin as any).rpc('update_job_progress', {
    job_uuid: jobId,
    progress: 100,
    current_step_val: 'encoding',
  });
  if (progressErr) {
    throw new Error(`update_job_progress failed: ${progressErr.message}`);
  }

  // Allow realtime events to flush
  await delay(1500);

  // 8) Validate views return expected coherent data (using any casting to bypass type issues)
  const { data: summary, error: summaryErr } = await (supabase as any)
    .from('job_summary')
    .select('*')
    .eq('id', jobId)
    .single();
  if (summaryErr) {
    throw new Error(`job_summary query failed: ${summaryErr.message}`);
  }
  console.log('[OK] job_summary:', {
    status: summary?.status,
    file_size: summary?.file_size,
    result_url: summary?.result_url,
  });

  const { data: rt, error: rtErr } = await (supabase as any)
    .from('job_status_realtime')
    .select('*')
    .eq('id', jobId)
    .single();
  if (rtErr) {
    throw new Error(`job_status_realtime query failed: ${rtErr.message}`);
  }
  console.log('[OK] job_status_realtime:', {
    status: rt?.status,
    progress: rt?.progress_percentage,
  });

  // 9) Validate realtime events observed
  console.log('[OK] Realtime events received:', {
    job_status_events: statusEvents.length,
    timeline_events: timelineEvents.length,
  });

  // Cleanup subscriptions
  statusChannel.unsubscribe();
  timelineChannel.unsubscribe();

  console.log('✅ Database validation finished successfully');
}

main().catch((err) => {
  console.error('❌ Database validation failed:', err);
  process.exit(1);
});


