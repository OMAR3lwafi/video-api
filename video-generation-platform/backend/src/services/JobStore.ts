import { JobRecord, JobStore } from '@/types/jobs';

/**
 * In-memory JobStore implementation as a default fallback when Redis is not used.
 * Not persistent; suitable for development and single-instance deployments.
 */
export class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, JobRecord>();

  save(job: JobRecord): void {
    this.jobs.set(job.id, job);
  }

  get(jobId: string): JobRecord | undefined {
    return this.jobs.get(jobId);
  }

  update(jobId: string, patch: Partial<JobRecord>): JobRecord | undefined {
    const existing = this.jobs.get(jobId);
    if (!existing) return undefined;
    const updated: JobRecord = { ...existing, ...patch, updatedAt: Date.now() };
    this.jobs.set(jobId, updated);
    return updated;
  }

  list(limit: number = 50): JobRecord[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
}



