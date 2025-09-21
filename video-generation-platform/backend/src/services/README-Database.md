# Database Service Integration Layer

Complete database service layer that interfaces with Supabase, handles all database operations, and provides real-time subscription capabilities for the Dynamic Video Content Generation Platform.

## 🏗 Architecture Overview

The database service layer consists of multiple specialized services:

- **DatabaseService**: Core database operations and connection management
- **VideoJobService**: High-level video job management operations  
- **DatabaseRepository**: Repository patterns for common queries
- **JobRepository**: Job-specific repository operations
- **AnalyticsRepository**: Analytics and reporting operations
- **SubscriptionRepository**: Real-time subscription management
- **CacheRepository**: Database cache management

## 📊 Database Schema

### Core Tables

- **jobs**: Main job tracking with AWS S3 integration and dual response system
- **elements**: Video composition elements with positioning and timing
- **storage_operations**: S3 operation tracking for monitoring
- **processing_timeline**: Step-by-step processing timeline with metrics
- **url_access_logs**: URL access analytics and monitoring
- **system_metrics**: Performance metrics collection

### Views

- **job_summary**: Comprehensive job data with related information
- **job_status_realtime**: Optimized for real-time status updates
- **active_jobs**: Currently active jobs with health indicators
- **daily_job_stats**: Daily aggregated statistics
- **storage_performance**: S3 operation performance metrics

## 🚀 Core Features

### ✅ Job Operations (CRUD)

```typescript
// Create job with validation
const jobResult = await DatabaseService.createJob({
  output_format: 'mp4',
  width: 1920,
  height: 1080,
  estimated_duration: 45,
  client_ip: req.ip,
  user_agent: req.get('User-Agent')
});

// Update job status with automatic timeline tracking
await DatabaseService.updateJobStatus({
  job_id: jobId,
  status: 'processing'
});

// Get job with caching
const job = await DatabaseService.getJob(jobId, true);

// List jobs with filtering and pagination
const jobs = await DatabaseService.listJobs(
  { status: ['pending', 'processing'] },
  { page: 1, limit: 20 }
);
```

### ✅ Element Management

```typescript
// Add element to job
const elementResult = await DatabaseService.addJobElement({
  job_id: jobId,
  type: 'video',
  source_url: 'https://example.com/video.mp4',
  element_order: 0,
  track: 0,
  x_position: '10%',
  y_position: '10%',
  width: '80%',
  height: '80%',
  fit_mode: 'contain'
});

// Update element processing status
await DatabaseService.updateElementStatus({
  element_id: elementId,
  downloaded: true,
  processed: true,
  local_path: '/tmp/video.mp4',
  source_size: 10485760
});

// Get all elements for job
const elements = await DatabaseService.getJobElements(jobId);
```

### ✅ Processing Timeline Management

```typescript
// Start processing step
const stepResult = await DatabaseService.startProcessingStep({
  job_id: jobId,
  step: 'download',
  step_order: 0,
  details: { source_count: 3 }
});

// Complete processing step with metrics
await DatabaseService.completeProcessingStep({
  timeline_id: stepResult.data!,
  success: true,
  progress: 75,
  details: { files_processed: 3 },
  cpu_usage: 45.2,
  memory_usage: 1073741824 // bytes
});

// Get complete timeline
const timeline = await DatabaseService.getProcessingTimeline(jobId);
```

### ✅ Storage Operations Tracking

```typescript
// Log S3 upload operation
await DatabaseService.logStorageOperation({
  job_id: jobId,
  operation: 'upload',
  bucket: 'my-video-bucket',
  key: 'videos/2024/01/15/video.mp4',
  region: 'us-east-1',
  success: true,
  file_size: 52428800,
  duration_ms: 3500,
  metadata: { content_type: 'video/mp4' }
});

// Get storage operations for monitoring
const operations = await DatabaseService.getStorageOperations({
  job_id: jobId,
  operation: 'upload',
  success: true
});
```

### ✅ Real-time Subscriptions

```typescript
// Subscribe to job status changes
const subscriptionId = DatabaseService.subscribeToJobStatusChanges(
  (notification) => {
    console.log('Job status changed:', notification.job_id, notification.new_status);
  },
  jobId // Optional: specific job ID
);

// Subscribe to processing timeline updates
const timelineSubscription = DatabaseService.subscribeToProcessingTimelineUpdates(
  (notification) => {
    console.log('Processing step:', notification.step, notification.progress_percentage);
  },
  jobId
);

// Unsubscribe when done
await DatabaseService.unsubscribe(subscriptionId);
```

### ✅ Transaction Handling

```typescript
// Execute operations in transaction
const result = await DatabaseService.executeTransaction(async (client) => {
  // Multiple operations that must succeed together
  const job = await client.from('jobs').insert({...}).single();
  const elements = await client.from('elements').insert([...]);
  return { job, elements };
});
```

### ✅ Query Optimization and Caching

```typescript
// Cached queries (automatic)
const job = await DatabaseService.getJob(jobId, true); // useCache = true

// Cache management
DatabaseService.clearCache();
DatabaseService.invalidateCache('job:123');
const stats = DatabaseService.getCacheStats();
```

### ✅ Health Checking

```typescript
// Comprehensive health check
const health = await DatabaseService.healthCheck();
console.log(health.status); // 'healthy' | 'degraded' | 'unhealthy'
console.log(health.checks); // { connection, read_operations, write_operations, real_time }
```

## 🔧 Repository Patterns

### Job Repository

```typescript
// Find jobs by status
const activeJobs = await JobRepository.findActive({ limit: 50 });

// Find jobs by client IP
const userJobs = await JobRepository.findByClientIp('192.168.1.100');

// Find jobs in date range
const recentJobs = await JobRepository.findByDateRange(
  '2024-01-01T00:00:00Z',
  '2024-01-31T23:59:59Z'
);

// Get job with full details
const jobDetails = await JobRepository.getJobWithDetails(jobId);
```

### Analytics Repository

```typescript
// Get system statistics
const systemStats = await AnalyticsRepository.getSystemStats();

// Get processing performance metrics
const perfMetrics = await AnalyticsRepository.getProcessingMetrics(
  '2024-01-01T00:00:00Z',
  '2024-01-31T23:59:59Z'
);
```

### Subscription Repository

```typescript
// Subscribe to specific job
const subId = SubscriptionRepository.subscribeToJob(jobId, (notification) => {
  // Handle job updates
});

// Subscribe to all jobs
const allSubId = SubscriptionRepository.subscribeToAllJobs((notification) => {
  // Handle all job updates
});

// Unsubscribe
await SubscriptionRepository.unsubscribe(jobId);
await SubscriptionRepository.unsubscribeAll();
```

## 🔒 Security Features

### Row Level Security (RLS)

- **IP-based access control**: Users can only access jobs from their IP
- **Service account bypass**: Service accounts have full access
- **Admin privileges**: Admins can access all data
- **Automatic audit logging**: Security events are logged

### Data Protection

- **Input validation**: All parameters validated before database operations
- **SQL injection prevention**: Parameterized queries and RLS policies
- **Rate limiting**: Built-in rate limiting with security event logging
- **Data retention**: Automatic cleanup of old data

## 📈 Performance Features

### Caching Strategy

- **In-memory cache**: Fast access to frequently requested data
- **Cache invalidation**: Automatic cache invalidation on updates
- **Cache warming**: Pre-load frequently accessed data
- **Cache statistics**: Monitor cache hit rates and performance

### Query Optimization

- **Optimized indexes**: Strategic indexes for common query patterns
- **View-based queries**: Pre-optimized views for complex queries
- **Connection pooling**: Efficient connection management
- **Query performance monitoring**: Track slow queries and optimize

### Real-time Performance

- **Efficient subscriptions**: Optimized real-time subscription handling
- **Batch notifications**: Reduce notification overhead
- **Connection management**: Proper cleanup and resource management

## 🔧 Configuration

### Environment Variables

```bash
# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cache Configuration (optional)
CACHE_TTL_SECONDS=300
CACHE_MAX_SIZE=1000

# Real-time Configuration (optional)
REALTIME_EVENTS_PER_SECOND=10
```

### Database Functions Required

The service requires these database functions to be deployed:

- `create_job()` - Job creation with validation
- `update_job_status()` - Status updates with transition validation
- `add_job_element()` - Element creation with constraints
- `start_processing_step()` - Timeline step initiation
- `complete_processing_step()` - Timeline step completion
- `log_storage_operation()` - S3 operation logging

## 📊 Monitoring and Analytics

### Built-in Metrics

- **Job processing statistics**: Success rates, processing times, throughput
- **Storage operation metrics**: Upload/download performance and success rates
- **System health indicators**: Connection status, error rates, performance
- **Real-time subscription metrics**: Active subscriptions, notification rates

### Health Monitoring

```typescript
// Get comprehensive health status
const health = await DatabaseService.healthCheck();

// Check specific components
console.log(health.checks.connection);      // Database connectivity
console.log(health.checks.read_operations); // Read query performance
console.log(health.checks.write_operations);// Write query performance
console.log(health.checks.real_time);       // Real-time subscriptions
```

## 🧪 Testing

### Unit Tests

```bash
# Run database service tests
npm test -- DatabaseService.test.ts

# Run with coverage
npm run test:coverage -- DatabaseService.test.ts
```

### Integration Tests

The test suite covers:

- Job CRUD operations
- Element management
- Processing timeline tracking
- Storage operation logging
- Real-time subscriptions
- Error handling scenarios
- Cache functionality
- Transaction handling

## 🚀 Usage Examples

### Complete Video Job Workflow

```typescript
// 1. Create video job with elements
const jobResult = await VideoJobService.createVideoJob({
  request: videoRequest,
  estimated_duration: 45,
  client_ip: req.ip,
  user_agent: req.get('User-Agent'),
  response_type: 'async'
});

const jobId = jobResult.data!.job.id;

// 2. Start processing timeline
const stepId = await VideoJobService.startProcessingStep(jobId, 'download', 0);

// 3. Update progress during processing
await DatabaseService.updateJobProgress({
  job_id: jobId,
  progress: 25,
  current_step: 'download'
});

// 4. Complete processing step
await VideoJobService.completeProcessingStep(stepId.data!, true, 50);

// 5. Log S3 upload
await VideoJobService.logStorageOperation(
  jobId,
  'upload',
  'my-bucket',
  'videos/output.mp4',
  true,
  { file_size: 10485760, duration_ms: 2500 }
);

// 6. Complete job
await VideoJobService.updateJobStatus(jobId, 'completed');
```

### Real-time Status Updates

```typescript
// Subscribe to job updates
const subscriptionId = SubscriptionRepository.subscribeToJob(jobId, (notification) => {
  // Send to frontend via WebSocket
  websocket.send(JSON.stringify({
    type: 'job_update',
    data: notification
  }));
});

// Subscribe to processing timeline
const timelineSubId = SubscriptionRepository.subscribeToProcessingUpdates(jobId, (update) => {
  // Send detailed progress to frontend
  websocket.send(JSON.stringify({
    type: 'processing_update',
    data: update
  }));
});
```

## 🔄 Migration and Deployment

### Required Migrations

1. `001_initial_schema.sql` - Core tables and indexes
2. `002_functions.sql` - Database functions
3. `003_triggers.sql` - Automatic triggers
4. `004_views.sql` - Optimized views
5. `005_rls_policies.sql` - Security policies
6. `006_transaction_functions.sql` - Transaction management

### Deployment Checklist

- [ ] All migrations applied to database
- [ ] Environment variables configured
- [ ] Service role key has proper permissions
- [ ] Real-time subscriptions enabled in Supabase
- [ ] Row Level Security policies active
- [ ] Database health check passing

## 🎯 Integration Points

### With Video Processing

- Automatic job creation and tracking
- Progress updates during FFmpeg processing
- Storage operation logging for S3 uploads
- Error tracking and retry logic

### With API Controllers

- Standardized response formatting
- Proper error handling and HTTP status codes
- Real-time subscription endpoints
- Comprehensive job status retrieval

### With Background Workers

- Job queue integration
- Processing timeline tracking
- Resource usage monitoring
- Automatic cleanup and maintenance

## 🔍 Troubleshooting

### Common Issues

1. **Connection Errors**: Check Supabase URL and keys
2. **Permission Errors**: Verify service role key permissions
3. **Migration Errors**: Ensure all migrations are applied
4. **Cache Issues**: Clear cache and check TTL settings
5. **Subscription Errors**: Verify real-time is enabled in Supabase

### Debug Commands

```typescript
// Check database health
const health = await DatabaseService.healthCheck();
console.log(health);

// Verify schema
const schema = await verifyDatabaseSchema();
console.log(schema);

// Check cache stats
const cacheStats = DatabaseService.getCacheStats();
console.log(cacheStats);

// List active subscriptions
const subCount = SubscriptionRepository.getActiveSubscriptionsCount();
console.log('Active subscriptions:', subCount);
```

## 📚 API Reference

See the comprehensive TypeScript interfaces in:
- `/types/database.ts` - All database types and interfaces
- `/services/DatabaseService.ts` - Core database operations
- `/services/VideoJobService.ts` - Video-specific operations
- `/services/DatabaseRepository.ts` - Repository patterns

The database service layer provides a complete, production-ready interface to Supabase with comprehensive error handling, caching, real-time capabilities, and performance optimization.
