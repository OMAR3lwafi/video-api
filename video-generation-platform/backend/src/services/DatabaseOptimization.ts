import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { MetricsCollector } from '../utils/MetricsCollector';
import cacheService from './CacheService';
import { performance } from 'perf_hooks';

interface QueryOptions {
  cache?: boolean;
  cacheTTL?: number;
  cacheNamespace?: string;
  timeout?: number;
  retries?: number;
  logSlowQueries?: boolean;
  useTransaction?: boolean;
}

interface PreparedStatement {
  name: string;
  text: string;
  values?: any[];
  lastUsed: number;
  useCount: number;
}

interface ConnectionPoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  maxUses?: number;
  allowExitOnIdle?: boolean;
}

interface DatabaseMetrics {
  totalQueries: number;
  slowQueries: number;
  failedQueries: number;
  avgQueryTime: number;
  cacheHits: number;
  cacheMisses: number;
  activeConnections: number;
  idleConnections: number;
  waitingCount: number;
}

interface OptimizationResult {
  query: string;
  executionTime: number;
  rowsAffected: number;
  cached: boolean;
  fromPreparedStatement: boolean;
}

export class DatabaseOptimizationService {
  private pool: Pool;
  private preparedStatements: Map<string, PreparedStatement>;
  private queryCache: Map<string, { result: any; timestamp: number; ttl: number }>;
  private metrics: DatabaseMetrics;
  private metricsCollector: MetricsCollector;
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly CACHE_DEFAULT_TTL = 300; // 5 minutes
  private readonly MAX_PREPARED_STATEMENTS = 100;
  private readonly QUERY_CACHE_MAX_SIZE = 500;

  // Pre-defined optimized queries
  private readonly OPTIMIZED_QUERIES = {
    // Video processing queries
    findVideoJob: `
      SELECT j.*, u.email as user_email
      FROM video_jobs j
      LEFT JOIN users u ON j.user_id = u.id
      WHERE j.id = $1
    `,

    findActiveJobs: `
      SELECT id, status, created_at, updated_at, processing_time
      FROM video_jobs
      WHERE status IN ('processing', 'queued')
      ORDER BY created_at ASC
      LIMIT $1
    `,

    updateJobStatus: `
      UPDATE video_jobs
      SET status = $2, updated_at = NOW(), progress = $3
      WHERE id = $1
      RETURNING *
    `,

    insertVideoMetadata: `
      INSERT INTO video_metadata (job_id, width, height, duration, file_size, format, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `,

    // User queries
    findUserByEmail: `
      SELECT id, email, created_at, last_login, preferences
      FROM users
      WHERE email = $1 AND deleted_at IS NULL
    `,

    updateUserLastLogin: `
      UPDATE users
      SET last_login = NOW()
      WHERE id = $1
    `,

    // System queries
    getSystemStats: `
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_jobs,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
        AVG(processing_time) FILTER (WHERE status = 'completed') as avg_processing_time,
        COUNT(DISTINCT user_id) as active_users
      FROM video_jobs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `,

    // Performance monitoring queries
    getSlowQueries: `
      SELECT query, mean_exec_time, calls, total_exec_time
      FROM pg_stat_statements
      WHERE mean_exec_time > $1
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `,

    getIndexUsage: `
      SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE idx_tup_read > 0
      ORDER BY idx_tup_read DESC
    `,

    getDatabaseSize: `
      SELECT pg_database_size(current_database()) as size_bytes,
             pg_size_pretty(pg_database_size(current_database())) as size_human
    `,
  };

  // Index optimization suggestions
  private readonly INDEX_SUGGESTIONS = [
    {
      table: 'video_jobs',
      columns: ['status', 'created_at'],
      type: 'btree',
      condition: "WHERE status IN ('processing', 'queued')",
      reason: 'Optimize active job queries',
    },
    {
      table: 'video_jobs',
      columns: ['user_id', 'status'],
      type: 'btree',
      reason: 'Optimize user job history queries',
    },
    {
      table: 'video_metadata',
      columns: ['job_id'],
      type: 'btree',
      reason: 'Foreign key optimization',
    },
    {
      table: 'users',
      columns: ['email'],
      type: 'btree',
      condition: "WHERE deleted_at IS NULL",
      reason: 'Optimize user lookup by email',
    },
    {
      table: 'video_jobs',
      columns: ['created_at'],
      type: 'btree',
      reason: 'Optimize time-based queries',
    },
  ];

  constructor(config?: Partial<ConnectionPoolConfig>) {
    this.initializePool(config);
    this.preparedStatements = new Map();
    this.queryCache = new Map();
    this.metrics = {
      totalQueries: 0,
      slowQueries: 0,
      failedQueries: 0,
      avgQueryTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingCount: 0,
    };
    this.metricsCollector = new MetricsCollector();
    this.startMetricsCollection();
    this.startMaintenanceTasks();
  }

  private initializePool(config?: Partial<ConnectionPoolConfig>): void {
    const poolConfig: PoolConfig = {
      host: config?.host || process.env.DB_HOST || 'localhost',
      port: config?.port || parseInt(process.env.DB_PORT || '5432'),
      database: config?.database || process.env.DB_NAME || 'video_generation',
      user: config?.user || process.env.DB_USER || 'postgres',
      password: config?.password || process.env.DB_PASSWORD || 'postgres',

      // Connection pool configuration
      max: config?.max || parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      min: config?.min || parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
      idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config?.connectionTimeoutMillis || 10000,
      maxUses: config?.maxUses || 7500,
      allowExitOnIdle: config?.allowExitOnIdle || true,

      // SSL configuration
      ssl: config?.ssl || process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false,
      } : false,

      // Performance optimizations
      keepAlive: true,
      keepAliveInitialDelayMillis: 0,
      application_name: 'video_generation_api',

      // Query configuration
      query_timeout: 30000,
      statement_timeout: 30000,
      lock_timeout: 10000,
      idle_in_transaction_session_timeout: 60000,
    };

    try {
      this.pool = new Pool(poolConfig);

      this.pool.on('connect', (client: PoolClient) => {
        logger.info('New database client connected');
        this.setupClientOptimizations(client);
      });

      this.pool.on('error', (err: Error) => {
        logger.error('Database pool error:', err);
        this.metrics.failedQueries++;
      });

      this.pool.on('acquire', () => {
        this.updateConnectionMetrics();
      });

      this.pool.on('release', () => {
        this.updateConnectionMetrics();
      });

      logger.info('Database connection pool initialized');
    } catch (error) {
      logger.error('Failed to initialize database pool:', error);
      throw error;
    }
  }

  private async setupClientOptimizations(client: PoolClient): Promise<void> {
    try {
      // Set optimal PostgreSQL parameters for this session
      await client.query(`
        SET work_mem = '16MB';
        SET maintenance_work_mem = '256MB';
        SET effective_cache_size = '1GB';
        SET random_page_cost = 1.1;
        SET seq_page_cost = 1.0;
        SET cpu_tuple_cost = 0.01;
        SET cpu_index_tuple_cost = 0.005;
        SET cpu_operator_cost = 0.0025;
      `);
    } catch (error) {
      logger.warn('Failed to set client optimizations:', error);
    }
  }

  /**
   * Execute optimized query with caching and performance tracking
   */
  async query<T = any>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T> & { optimizationResult: OptimizationResult }> {
    const startTime = performance.now();
    const queryHash = this.generateQueryHash(text, params);

    try {
      // Check cache first if caching is enabled
      if (options.cache) {
        const cached = await this.getCachedQuery<T>(queryHash, options);
        if (cached) {
          this.metrics.cacheHits++;
          return {
            ...cached,
            optimizationResult: {
              query: text,
              executionTime: performance.now() - startTime,
              rowsAffected: cached.rowCount || 0,
              cached: true,
              fromPreparedStatement: false,
            },
          };
        }
        this.metrics.cacheMisses++;
      }

      // Try to use prepared statement
      const preparedResult = await this.executeWithPreparedStatement<T>(
        text,
        params,
        options
      );

      if (preparedResult) {
        const executionTime = performance.now() - startTime;

        // Cache result if caching is enabled
        if (options.cache) {
          await this.cacheQuery(queryHash, preparedResult, options);
        }

        // Record metrics
        this.recordQueryMetrics(executionTime, text);

        return {
          ...preparedResult,
          optimizationResult: {
            query: text,
            executionTime,
            rowsAffected: preparedResult.rowCount || 0,
            cached: false,
            fromPreparedStatement: true,
          },
        };
      }

      // Fallback to direct query execution
      const result = await this.executeDirectQuery<T>(text, params, options);
      const executionTime = performance.now() - startTime;

      // Cache result if caching is enabled
      if (options.cache) {
        await this.cacheQuery(queryHash, result, options);
      }

      // Record metrics
      this.recordQueryMetrics(executionTime, text);

      return {
        ...result,
        optimizationResult: {
          query: text,
          executionTime,
          rowsAffected: result.rowCount || 0,
          cached: false,
          fromPreparedStatement: false,
        },
      };

    } catch (error) {
      this.metrics.failedQueries++;
      const executionTime = performance.now() - startTime;
      this.recordQueryMetrics(executionTime, text, error);
      throw error;
    }
  }

  /**
   * Execute transaction with optimization
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Set transaction-specific optimizations
      await client.query(`
        SET LOCAL synchronous_commit = OFF;
        SET LOCAL checkpoint_segments = 32;
      `);

      const result = await callback(client);
      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk insert with optimization
   */
  async bulkInsert<T = any>(
    table: string,
    columns: string[],
    data: any[][],
    options: { batchSize?: number; onConflict?: string } = {}
  ): Promise<QueryResult<T>> {
    const batchSize = options.batchSize || 1000;
    const results: QueryResult<T>[] = [];

    // Process data in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const values: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Build parameterized query
      for (const row of batch) {
        const rowPlaceholders = row.map(() => `$${paramIndex++}`);
        values.push(`(${rowPlaceholders.join(', ')})`);
        params.push(...row);
      }

      const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${values.join(', ')}
        ${options.onConflict ? `ON CONFLICT ${options.onConflict}` : ''}
        RETURNING *
      `;

      const result = await this.query<T>(query, params);
      results.push(result);
    }

    // Combine results
    const combinedResult: QueryResult<T> = {
      command: 'INSERT',
      rowCount: results.reduce((sum, r) => sum + (r.rowCount || 0), 0),
      oid: results[0]?.oid || 0,
      fields: results[0]?.fields || [],
      rows: results.flatMap(r => r.rows),
    };

    return combinedResult;
  }

  /**
   * Execute optimized pre-defined queries
   */
  async executeOptimizedQuery<T = any>(
    queryName: keyof typeof this.OPTIMIZED_QUERIES,
    params?: any[],
    options?: QueryOptions
  ): Promise<QueryResult<T> & { optimizationResult: OptimizationResult }> {
    const queryText = this.OPTIMIZED_QUERIES[queryName];
    if (!queryText) {
      throw new Error(`Unknown optimized query: ${queryName}`);
    }

    return this.query<T>(queryText, params, {
      cache: true,
      cacheTTL: 300,
      cacheNamespace: 'optimized_queries',
      ...options,
    });
  }

  /**
   * Analyze and optimize database performance
   */
  async performAnalysis(): Promise<{
    slowQueries: any[];
    indexUsage: any[];
    tableStats: any[];
    recommendations: string[];
  }> {
    try {
      // Get slow queries
      const slowQueries = await this.query(
        this.OPTIMIZED_QUERIES.getSlowQueries,
        [this.SLOW_QUERY_THRESHOLD]
      );

      // Get index usage statistics
      const indexUsage = await this.query(this.OPTIMIZED_QUERIES.getIndexUsage);

      // Get table statistics
      const tableStats = await this.query(`
        SELECT
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_tup_hot_upd as hot_updates,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `);

      // Generate recommendations
      const recommendations = await this.generateOptimizationRecommendations(
        slowQueries.rows,
        indexUsage.rows,
        tableStats.rows
      );

      return {
        slowQueries: slowQueries.rows,
        indexUsage: indexUsage.rows,
        tableStats: tableStats.rows,
        recommendations,
      };
    } catch (error) {
      logger.error('Database analysis failed:', error);
      throw error;
    }
  }

  /**
   * Create recommended indexes
   */
  async createRecommendedIndexes(): Promise<string[]> {
    const createdIndexes: string[] = [];

    for (const suggestion of this.INDEX_SUGGESTIONS) {
      try {
        const indexName = `idx_${suggestion.table}_${suggestion.columns.join('_')}`;
        const columnsStr = suggestion.columns.join(', ');

        let createIndexQuery = `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
          ON ${suggestion.table}
          USING ${suggestion.type} (${columnsStr})
        `;

        if (suggestion.condition) {
          createIndexQuery += ` ${suggestion.condition}`;
        }

        await this.query(createIndexQuery);
        createdIndexes.push(indexName);

        logger.info(`Created index: ${indexName} - ${suggestion.reason}`);
      } catch (error) {
        logger.warn(`Failed to create index for ${suggestion.table}:`, error);
      }
    }

    return createdIndexes;
  }

  /**
   * Get database performance metrics
   */
  getMetrics(): DatabaseMetrics & {
    poolStats: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    };
  } {
    return {
      ...this.metrics,
      poolStats: {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      },
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    try {
      const startTime = performance.now();

      // Test basic connectivity
      const result = await this.query('SELECT NOW() as current_time, version() as version');
      const responseTime = performance.now() - startTime;

      // Check database size
      const sizeResult = await this.query(this.OPTIMIZED_QUERIES.getDatabaseSize);

      // Get connection pool status
      const poolStats = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      };

      return {
        status: responseTime < 1000 ? 'healthy' : 'unhealthy',
        details: {
          responseTime: `${responseTime.toFixed(2)}ms`,
          currentTime: result.rows[0].current_time,
          version: result.rows[0].version.split(' ').slice(0, 2).join(' '),
          databaseSize: sizeResult.rows[0].size_human,
          poolStats,
          metrics: this.metrics,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          poolConnected: false,
        },
      };
    }
  }

  // Private methods

  private generateQueryHash(text: string, params?: any[]): string {
    const content = text + (params ? JSON.stringify(params) : '');
    return createHash('md5').update(content).digest('hex');
  }

  private async getCachedQuery<T>(
    hash: string,
    options: QueryOptions
  ): Promise<QueryResult<T> | null> {
    const cacheKey = `query:${hash}`;
    const namespace = options.cacheNamespace || 'db_queries';
    const ttl = options.cacheTTL || this.CACHE_DEFAULT_TTL;

    return await cacheService.get<QueryResult<T>>(cacheKey, {
      namespace,
      ttl,
    });
  }

  private async cacheQuery<T>(
    hash: string,
    result: QueryResult<T>,
    options: QueryOptions
  ): Promise<void> {
    const cacheKey = `query:${hash}`;
    const namespace = options.cacheNamespace || 'db_queries';
    const ttl = options.cacheTTL || this.CACHE_DEFAULT_TTL;

    await cacheService.set(cacheKey, result, {
      namespace,
      ttl,
      compress: true,
    });
  }

  private async executeWithPreparedStatement<T>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T> | null> {
    const statementHash = createHash('md5').update(text).digest('hex');

    // Check if we have this prepared statement
    let statement = this.preparedStatements.get(statementHash);

    if (!statement) {
      // Create new prepared statement if we have room
      if (this.preparedStatements.size < this.MAX_PREPARED_STATEMENTS) {
        const name = `stmt_${statementHash.substring(0, 8)}`;
        statement = {
          name,
          text,
          values: params,
          lastUsed: Date.now(),
          useCount: 0,
        };
        this.preparedStatements.set(statementHash, statement);
      } else {
        return null; // No room for new prepared statements
      }
    }

    try {
      // Update usage statistics
      statement.lastUsed = Date.now();
      statement.useCount++;

      // Execute prepared statement
      const client = await this.pool.connect();
      try {
        const result = await client.query({
          name: statement.name,
          text: statement.text,
          values: params,
        });
        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      // Remove failed prepared statement
      this.preparedStatements.delete(statementHash);
      return null;
    }
  }

  private async executeDirectQuery<T>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const timeout = options.timeout || 30000;
    const retries = options.retries || 0;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const client = await this.pool.connect();
        try {
          // Set query timeout
          await client.query(`SET statement_timeout = ${timeout}`);

          const result = await client.query(text, params);
          return result;
        } finally {
          client.release();
        }
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    throw new Error('Query execution failed after all retries');
  }

  private recordQueryMetrics(executionTime: number, query: string, error?: Error): void {
    this.metrics.totalQueries++;

    if (error) {
      this.metrics.failedQueries++;
    }

    if (executionTime > this.SLOW_QUERY_THRESHOLD) {
      this.metrics.slowQueries++;

      if (!error) {
        logger.warn('Slow query detected:', {
          executionTime: `${executionTime.toFixed(2)}ms`,
          query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        });
      }
    }

    // Update average query time
    this.metrics.avgQueryTime =
      ((this.metrics.avgQueryTime * (this.metrics.totalQueries - 1)) + executionTime) /
      this.metrics.totalQueries;

    // Send metrics to collector
    this.metricsCollector.recordDatabaseQuery({
      executionTime,
      success: !error,
      slow: executionTime > this.SLOW_QUERY_THRESHOLD,
    });
  }

  private updateConnectionMetrics(): void {
    this.metrics.activeConnections = this.pool.totalCount - this.pool.idleCount;
    this.metrics.idleConnections = this.pool.idleCount;
    this.metrics.waitingCount = this.pool.waitingCount;
  }

  private async generateOptimizationRecommendations(
    slowQueries: any[],
    indexUsage: any[],
    tableStats: any[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Analyze slow queries
    if (slowQueries.length > 0) {
      recommendations.push(
        `Found ${slowQueries.length} slow queries. Consider optimizing queries with execution time > ${this.SLOW_QUERY_THRESHOLD}ms.`
      );
    }

    // Analyze index usage
    const unusedIndexes = indexUsage.filter(idx => idx.idx_tup_read === 0);
    if (unusedIndexes.length > 0) {
      recommendations.push(
        `Found ${unusedIndexes.length} unused indexes that could be dropped to improve write performance.`
      );
    }

    // Analyze table statistics
    for (const table of tableStats) {
      const deadTupleRatio = table.dead_tuples / (table.live_tuples || 1);
      if (deadTupleRatio > 0.1) {
        recommendations.push(
          `Table ${table.tablename} has ${(deadTupleRatio * 100).toFixed(1)}% dead tuples. Consider running VACUUM.`
        );
      }

      if (!table.last_analyze || Date.now() - new Date(table.last_analyze).getTime() > 7 * 24 * 60 * 60 * 1000) {
        recommendations.push(
          `Table ${table.tablename} hasn't been analyzed recently. Consider running ANALYZE.`
        );
      }
    }

    // Connection pool recommendations
    const poolUtilization = (this.pool.totalCount - this.pool.idleCount) / this.pool.totalCount;
    if (poolUtilization > 0.8) {
      recommendations.push(
        'Connection pool utilization is high (>80%). Consider increasing pool size or optimizing query performance.'
      );
    }

    return recommendations;
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateConnectionMetrics();

      // Log metrics periodically
      logger.debug('Database metrics:', this.getMetrics());
    }, 60000); // Every minute
  }

  private startMaintenanceTasks(): void {
    // Clean up old prepared statements
    setInterval(() => {
      const now = Date.now();
      const oldStatements: string[] = [];

      for (const [hash, statement] of this.preparedStatements.entries()) {
        // Remove statements not used in the last hour
        if (now - statement.lastUsed > 3600000) {
          oldStatements.push(hash);
        }
      }

      oldStatements.forEach(hash => this.preparedStatements.delete(hash));

      if (oldStatements.length > 0) {
        logger.debug(`Cleaned up ${oldStatements.length} old prepared statements`);
      }
    }, 300000); // Every 5 minutes

    // Clean up query cache
    setInterval(() => {
      if (this.queryCache.size > this.QUERY_CACHE_MAX_SIZE) {
        const entries = Array.from(this.queryCache.entries());
        entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);

        const toRemove = Math.floor(this.queryCache.size * 0.2); // Remove 20%
        for (let i = 0; i < toRemove; i++) {
          this.queryCache.delete(entries[i][0]);
        }
      }
    }, 600000); // Every 10 minutes
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('Database pool closed');
    } catch (error) {
      logger.error('Error closing database pool:', error);
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseOptimizationService();
export default databaseService;
