# Dynamic Video Content Generation Platform - Database Documentation

This directory contains the complete database schema, migrations, and configuration for the Dynamic Video Content Generation Platform.

## 📋 Table of Contents

- [Overview](#overview)
- [Database Schema](#database-schema)
- [Migration Files](#migration-files)
- [Setup Instructions](#setup-instructions)
- [Real-time Subscriptions](#real-time-subscriptions)
- [Security & RLS](#security--rls)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The database is built on **Supabase PostgreSQL** with comprehensive features:

- **6 core tables** with proper relationships and constraints
- **Custom enum types** for consistent data validation
- **20+ database functions** for job management and analytics
- **Comprehensive triggers** for validation and real-time updates
- **10+ optimized views** for queries and analytics
- **Row Level Security (RLS)** policies for data protection
- **Real-time subscriptions** for live updates
- **Performance indexes** for optimal query speed

## 📊 Database Schema

### Core Tables

| Table | Purpose | Key Features |
|-------|---------|-------------|
| `jobs` | Main job tracking | Dual response system, AWS S3 integration, progress tracking |
| `elements` | Video composition elements | Positioning, timing, processing status |
| `storage_operations` | S3 operation tracking | Upload/download monitoring, performance metrics |
| `processing_timeline` | Step-by-step processing | Detailed timeline, resource usage, error tracking |
| `url_access_logs` | URL access analytics | Download tracking, geolocation, performance |
| `system_metrics` | Performance monitoring | Metrics collection, alerting, analytics |

### Custom Enum Types

```sql
-- Job status with comprehensive states
job_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'timeout'

-- Element types for video composition
element_type: 'video' | 'image' | 'audio' | 'text' | 'overlay'

-- Fit modes for element positioning
fit_mode: 'auto' | 'contain' | 'cover' | 'fill' | 'stretch'

-- Processing steps for timeline tracking
processing_step: 'validation' | 'download' | 'processing' | 'composition' | 'encoding' | 'upload' | 'cleanup'

-- Storage operation types
storage_operation: 'upload' | 'download' | 'delete' | 'access'

-- Response types for dual response system
response_type: 'immediate' | 'async'
```

### Key Relationships

```
jobs (1) ←→ (many) elements
jobs (1) ←→ (many) storage_operations  
jobs (1) ←→ (many) processing_timeline
jobs (1) ←→ (many) url_access_logs
```

## 📁 Migration Files

### Migration Order

1. **`001_initial_schema.sql`** - Tables, enums, indexes, constraints
2. **`002_functions.sql`** - Database functions for job management and analytics  
3. **`003_triggers.sql`** - Validation triggers and real-time notifications
4. **`004_views.sql`** - Optimized views for queries and analytics
5. **`005_rls_policies.sql`** - Row Level Security policies and auth functions

### Master Scripts

- **`migrate.sql`** - Execute all migrations with verification
- **`rollback.sql`** - Complete rollback script for emergencies

## 🚀 Setup Instructions

### 1. Prerequisites

```bash
# Supabase CLI (recommended)
npm install -g @supabase/cli

# Or PostgreSQL client
brew install postgresql  # macOS
sudo apt-get install postgresql-client  # Ubuntu
```

### 2. Environment Setup

```bash
# Copy environment template
cp env.example .env.local

# Configure your Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### 3. Database Migration

#### Option A: Supabase Dashboard (Recommended)

```bash
# 1. Go to your Supabase project dashboard
# 2. Navigate to SQL Editor  
# 3. Run each migration file in exact order:

# Step 1: Copy and paste content from 001_initial_schema.sql
# Step 2: Copy and paste content from 002_functions.sql
# Step 3: Copy and paste content from 003_triggers.sql
# Step 4: Copy and paste content from 004_views.sql
# Step 5: Copy and paste content from 005_rls_policies.sql

# Step 6: Run verification queries from supabase-deploy.sql
```

#### Option B: Supabase CLI

```bash
# Initialize and link project
supabase init
supabase link --project-ref your-project-id

# Deploy individual files (recommended)
supabase db push --file migrations/001_initial_schema.sql
supabase db push --file migrations/002_functions.sql
supabase db push --file migrations/003_triggers.sql
supabase db push --file migrations/004_views.sql
supabase db push --file migrations/005_rls_policies.sql

# Or use automated script
./database/deploy.sh
```

#### Option C: Direct PostgreSQL (psql)

```bash
# Connect to your database
export DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Run deployment script
./database/deploy.sh

# Or manually execute each file
psql $DATABASE_URL -f database/migrations/001_initial_schema.sql
psql $DATABASE_URL -f database/migrations/002_functions.sql
psql $DATABASE_URL -f database/migrations/003_triggers.sql
psql $DATABASE_URL -f database/migrations/004_views.sql
psql $DATABASE_URL -f database/migrations/005_rls_policies.sql
```

#### ⚠️ Important Notes

- **The `migrate.sql` file is now corrected** with proper PostgreSQL syntax (explicit array types, renamed variables)
- **For Supabase**: Still recommended to use individual migration files or dashboard copy/paste
- **For psql**: You can now use `migrate.sql` for verification queries after running individual migrations
- **Always run migrations in order**: 001 → 002 → 003 → 004 → 005
- **Each migration file is self-contained** and can be run independently
- **Use `supabase-deploy.sql`** for verification queries in Supabase dashboard

### 4. Verification

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables WHERE schemaname = 'public';

-- Test database functions
SELECT create_job('mp4', 1920, 1080, 25, '127.0.0.1'::inet, 'test-agent', '{}');
```

## 📡 Real-time Subscriptions

### Job Status Updates

```typescript
import { subscribeToJobStatus } from '@/lib/supabase';

// Subscribe to job status changes
const channel = subscribeToJobStatus(
  jobId,
  (job) => {
    console.log('Job updated:', job.status, job.progress_percentage);
    // Update UI with new status
  },
  (error) => {
    console.error('Subscription error:', error);
  }
);

// Cleanup
channel.unsubscribe();
```

### Processing Timeline

```typescript
import { subscribeToProcessingTimeline } from '@/lib/supabase';

// Subscribe to processing steps
const channel = subscribeToProcessingTimeline(
  jobId,
  (timeline) => {
    console.log('Processing step:', timeline.step, timeline.success);
    // Update progress UI
  }
);
```

### Active Jobs Monitoring

```typescript
import { subscribeToActiveJobs } from '@/lib/supabase';

// Monitor all active jobs (admin only)
const channel = subscribeToActiveJobs((payload) => {
  console.log('Active job change:', payload);
  // Update dashboard
});
```

## 🔒 Security & RLS

### Row Level Security Policies

The database implements comprehensive RLS policies:

**Jobs Table:**
- ✅ Anonymous users can create jobs (public API)
- ✅ Users can view jobs from their IP address
- ✅ Service accounts have full access
- ✅ Admins have full access

**Elements Table:**
- ✅ Users can add elements to their jobs
- ✅ Users can view elements for their jobs  
- ✅ Service accounts can update processing status

**Storage Operations:**
- ✅ Service accounts can log operations
- ✅ Users can view operations for their jobs

**Processing Timeline:**
- ✅ Service accounts can manage timeline
- ✅ Users can view timeline for their jobs

### Authentication Roles

```sql
-- Role hierarchy
'anon'           -- Anonymous public access
'authenticated'  -- Logged-in users  
'service_account' -- Backend services
'admin'          -- Full system access
```

### Security Functions

```sql
-- Check user permissions
SELECT auth.user_role();
SELECT auth.is_admin();
SELECT auth.can_subscribe_to_job('job-uuid');

-- Rate limiting
SELECT check_rate_limit('client-ip', 100, '1 hour'::interval);

-- Audit logging
SELECT log_security_event('unauthorized_access', '{"details": "..."}');
```

## ⚡ Performance Optimization

### Indexes

All tables have optimized indexes for:
- Primary key lookups
- Foreign key relationships  
- RLS policy filters
- Common query patterns
- Real-time subscription filters

### Query Optimization

**Use Views for Complex Queries:**
```sql
-- Instead of complex JOINs, use optimized views
SELECT * FROM job_summary WHERE id = 'job-uuid';
SELECT * FROM active_jobs WHERE processing_health = 'stalled';
```

**Leverage Database Functions:**
```sql  
-- Use functions for complex operations
SELECT get_job_statistics('2024-01-01', '2024-01-31');
SELECT calculate_job_progress('job-uuid');
```

### Performance Monitoring

```sql
-- Monitor query performance
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats WHERE schemaname = 'public';

-- Monitor real-time connections
SELECT * FROM pg_stat_activity WHERE application_name LIKE '%supabase%';
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Migration Failures

```bash
# Check migration status
supabase migration list

# Reset database (development only)
supabase db reset

# Manual rollback
psql -f database/rollback.sql
```

#### 2. RLS Policy Issues

```sql
-- Disable RLS temporarily for debugging
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;

-- Check policy details
SELECT * FROM pg_policies WHERE tablename = 'jobs';

-- Test policy functions
SELECT auth.user_role(), auth.client_ip();
```

#### 3. Real-time Subscription Issues

```typescript
// Check connection status
const { data, error } = await supabase
  .from('jobs')
  .select('count')
  .limit(1);

console.log('Database connection:', !error);

// Test real-time
const testChannel = supabase.channel('test');
testChannel.subscribe((status) => {
  console.log('Realtime status:', status);
});
```

#### 4. Performance Issues

```sql
-- Analyze table statistics
ANALYZE jobs;
ANALYZE elements;

-- Check slow queries
SELECT query, total_time, calls, mean_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC;

-- Update table statistics
VACUUM ANALYZE;
```

### Database Maintenance

```sql
-- Clean up old data (admin only)
SELECT cleanup_old_jobs(30);  -- Remove jobs older than 30 days
SELECT cleanup_old_metrics(7); -- Remove metrics older than 7 days

-- Update statistics
SELECT enforce_data_retention();

-- Monitor database size
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Health Checks

```typescript
import { healthCheck } from '@/lib/supabase';

// Check system health
const health = await healthCheck();
console.log('Database:', health.database);
console.log('Realtime:', health.realtime);
```

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Real-time Subscriptions Guide](https://supabase.com/docs/guides/realtime)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## 🆘 Support

For database-related issues:

1. Check the troubleshooting section above
2. Review Supabase project logs
3. Examine PostgreSQL error logs
4. Test with minimal reproduction case
5. Check RLS policies and permissions

---

**Database Version:** 1.0.0  
**Last Updated:** 2024  
**PostgreSQL Version:** 15+  
**Supabase Compatible:** ✅
