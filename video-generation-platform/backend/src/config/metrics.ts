
import { Counter, Gauge, Histogram, Summary } from 'prom-client';

// Counter for total video creation requests
export const videoCreationRequests = new Counter({
  name: 'video_creation_requests_total',
  help: 'Total number of video creation requests',
});

// Gauge for jobs in progress
export const jobsInProgress = new Gauge({
  name: 'jobs_in_progress',
  help: 'Number of jobs currently in progress',
});

// Histogram for video processing duration
export const videoProcessingDuration = new Histogram({
  name: 'video_processing_duration_seconds',
  help: 'Histogram of video processing duration in seconds',
  buckets: [1, 5, 10, 30, 60, 120, 300, 600], // Buckets from 1 second to 10 minutes
});

// Summary for video processing duration
export const videoProcessingSummary = new Summary({
  name: 'video_processing_duration_summary_seconds',
  help: 'Summary of video processing duration in seconds',
  percentiles: [0.5, 0.9, 0.95, 0.99], // 50th, 90th, 95th, and 99th percentiles
});
