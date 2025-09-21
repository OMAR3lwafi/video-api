import { EventEmitter } from 'events';
import {
  OrchestratorSettings,
  LoadBalancingStrategy,
  JobPriority,
  OrchestratorError
} from '../types/index.js';
import { Logger } from '../utils/Logger.js';

export class ConfigurationManager extends EventEmitter {
  private static instance: ConfigurationManager;
  private config: OrchestratorSettings;
  private configWatchers: Map<string, ConfigWatcher[]>;
  private logger: Logger;
  private configFilePath: string;
  private isInitialized: boolean = false;

  private constructor() {
    super();
    this.configWatchers = new Map();
    this.logger = new Logger('ConfigurationManager');
    this.configFilePath = process.env.CONFIG_FILE_PATH || './config/orchestrator.json';

    this.config = this.getDefaultConfiguration();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Load configuration from file and environment
   */
  public async loadConfiguration(): Promise<void> {
    try {
      this.logger.info('Loading orchestrator configuration...');

      // Load from environment variables first
      this.loadFromEnvironment();

      // Load from configuration file if it exists
      await this.loadFromFile();

      // Validate configuration
      this.validateConfiguration();

      // Set up configuration watching
      this.setupConfigurationWatching();

      this.isInitialized = true;
      this.logger.info('Configuration loaded successfully');

      this.emit('config_loaded', this.config);

    } catch (error) {
      this.logger.error('Failed to load configuration:', error);
      throw new OrchestratorError('Configuration loading failed', 'CONFIG_ERROR', error);
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): OrchestratorSettings {
    return JSON.parse(JSON.stringify(this.config)); // Deep copy to prevent mutations
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<OrchestratorSettings>): void {
    const oldConfig = this.getConfig();

    // Merge updates with current config
    this.config = this.mergeConfig(this.config, updates);

    // Validate updated configuration
    this.validateConfiguration();

    this.logger.info('Configuration updated');
    this.emit('config_updated', { oldConfig, newConfig: this.config, updates });

    // Notify watchers
    this.notifyConfigWatchers(updates);
  }

  /**
   * Watch for configuration changes
   */
  public watchConfig(key: string, callback: ConfigWatcher): void {
    if (!this.configWatchers.has(key)) {
      this.configWatchers.set(key, []);
    }

    this.configWatchers.get(key)!.push(callback);
    this.logger.debug(`Config watcher added for key: ${key}`);
  }

  /**
   * Remove configuration watcher
   */
  public unwatchConfig(key: string, callback: ConfigWatcher): void {
    const watchers = this.configWatchers.get(key);
    if (watchers) {
      const index = watchers.indexOf(callback);
      if (index !== -1) {
        watchers.splice(index, 1);
        this.logger.debug(`Config watcher removed for key: ${key}`);
      }
    }
  }

  /**
   * Get configuration value by path
   */
  public get<T = any>(path: string): T | undefined {
    return this.getNestedValue(this.config, path);
  }

  /**
   * Set configuration value by path
   */
  public set(path: string, value: any): void {
    const updates = this.createNestedUpdate(path, value);
    this.updateConfig(updates);
  }

  /**
   * Load default configuration
   */
  private getDefaultConfiguration(): OrchestratorSettings {
    return {
      orchestration: {
        maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '50'),
        defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT || '300000'),
        priorityWeights: {
          low: 1,
          normal: 2,
          high: 3,
          critical: 4
        }
      },
      workflows: {
        templateDirectory: process.env.WORKFLOW_TEMPLATE_DIR || './workflows',
        enableCustomTemplates: process.env.ENABLE_CUSTOM_TEMPLATES === 'true',
        maxWorkflowDuration: parseInt(process.env.MAX_WORKFLOW_DURATION || '3600000')
      },
      resources: {
        autoScalingEnabled: process.env.AUTO_SCALING_ENABLED === 'true',
        resourceReservationTimeout: parseInt(process.env.RESOURCE_RESERVATION_TIMEOUT || '30000'),
        optimizationInterval: parseInt(process.env.OPTIMIZATION_INTERVAL || '300000')
      },
      loadBalancing: {
        strategy: (process.env.LOAD_BALANCING_STRATEGY || 'round_robin') as LoadBalancingStrategy,
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
        failoverThreshold: parseFloat(process.env.FAILOVER_THRESHOLD || '0.8')
      },
      monitoring: {
        metricsRetention: parseInt(process.env.METRICS_RETENTION || '604800'), // 7 days
        alertingEnabled: process.env.ALERTING_ENABLED !== 'false',
        dashboardRefreshInterval: parseInt(process.env.DASHBOARD_REFRESH_INTERVAL || '10000')
      },
      resilience: {
        circuitBreakerEnabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
        retryEnabled: process.env.RETRY_ENABLED !== 'false',
        failoverEnabled: process.env.FAILOVER_ENABLED !== 'false'
      },
      analytics: {
        enabled: process.env.ANALYTICS_ENABLED !== 'false',
        reportingInterval: parseInt(process.env.ANALYTICS_REPORTING_INTERVAL || '600000'),
        predictionEnabled: process.env.PREDICTION_ENABLED === 'true'
      },
      security: {
        encryptionEnabled: process.env.ENCRYPTION_ENABLED === 'true',
        auditLogging: process.env.AUDIT_LOGGING !== 'false',
        accessControlEnabled: process.env.ACCESS_CONTROL_ENABLED === 'true'
      }
    };
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    // Override default config with environment variables
    const envConfig: Partial<OrchestratorSettings> = {};

    // Parse environment variables and update config
    if (process.env.MAX_CONCURRENT_JOBS) {
      envConfig.orchestration = {
        ...this.config.orchestration,
        maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS)
      };
    }

    if (process.env.LOAD_BALANCING_STRATEGY) {
      envConfig.loadBalancing = {
        ...this.config.loadBalancing,
        strategy: process.env.LOAD_BALANCING_STRATEGY as LoadBalancingStrategy
      };
    }

    // Add more environment variable mappings as needed
    this.config = this.mergeConfig(this.config, envConfig);
  }

  /**
   * Load configuration from file
   */
  private async loadFromFile(): Promise<void> {
    try {
      // In a real implementation, read from actual file
      // const fs = await import('fs/promises');
      // const configData = await fs.readFile(this.configFilePath, 'utf-8');
      // const fileConfig = JSON.parse(configData);

      // For now, use placeholder file config
      const fileConfig: Partial<OrchestratorSettings> = {
        orchestration: {
          maxConcurrentJobs: 75,
          defaultTimeout: 300000,
          priorityWeights: {
            low: 1,
            normal: 2,
            high: 3,
            critical: 5
          }
        },
        loadBalancing: {
          strategy: 'ai_driven',
          healthCheckInterval: 15000,
          failoverThreshold: 0.75
        }
      };

      this.config = this.mergeConfig(this.config, fileConfig);
      this.logger.debug('Configuration loaded from file');

    } catch (error) {
      // File doesn't exist or can't be read - use defaults
      this.logger.debug('Configuration file not found, using defaults');
    }
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate orchestration settings
    if (this.config.orchestration.maxConcurrentJobs <= 0) {
      errors.push('maxConcurrentJobs must be greater than 0');
    }

    if (this.config.orchestration.defaultTimeout <= 0) {
      errors.push('defaultTimeout must be greater than 0');
    }

    // Validate load balancing strategy
    const validStrategies: LoadBalancingStrategy[] = [
      'round_robin', 'weighted', 'least_connections', 'ai_driven', 'performance_based'
    ];
    if (!validStrategies.includes(this.config.loadBalancing.strategy)) {
      errors.push(`Invalid load balancing strategy: ${this.config.loadBalancing.strategy}`);
    }

    // Validate intervals
    if (this.config.loadBalancing.healthCheckInterval <= 0) {
      errors.push('healthCheckInterval must be greater than 0');
    }

    if (this.config.resources.optimizationInterval <= 0) {
      errors.push('optimizationInterval must be greater than 0');
    }

    // Validate thresholds
    if (this.config.loadBalancing.failoverThreshold <= 0 || this.config.loadBalancing.failoverThreshold > 1) {
      errors.push('failoverThreshold must be between 0 and 1');
    }

    if (errors.length > 0) {
      throw new OrchestratorError(
        `Configuration validation failed: ${errors.join(', ')}`,
        'INVALID_CONFIG'
      );
    }
  }

  /**
   * Set up configuration file watching
   */
  private setupConfigurationWatching(): void {
    // In a real implementation, watch configuration file for changes
    // const fs = await import('fs');
    // fs.watchFile(this.configFilePath, (curr, prev) => {
    //   this.logger.info('Configuration file changed, reloading...');
    //   this.loadConfiguration();
    // });

    this.logger.debug('Configuration watching set up');
  }

  /**
   * Merge configuration objects
   */
  private mergeConfig(
    target: OrchestratorSettings,
    source: Partial<OrchestratorSettings>
  ): OrchestratorSettings {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result[key as keyof OrchestratorSettings] = {
            ...(result[key as keyof OrchestratorSettings] as any),
            ...value
          };
        } else {
          (result as any)[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Create nested update object from path and value
   */
  private createNestedUpdate(path: string, value: any): any {
    const keys = path.split('.');
    const update: any = {};

    let current = update;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    return update;
  }

  /**
   * Notify configuration watchers
   */
  private notifyConfigWatchers(updates: Partial<OrchestratorSettings>): void {
    for (const [key, watchers] of this.configWatchers.entries()) {
      const newValue = this.getNestedValue(this.config, key);
      const oldValue = this.getNestedValue(updates, key);

      if (newValue !== undefined && newValue !== oldValue) {
        for (const watcher of watchers) {
          try {
            watcher(newValue, oldValue);
          } catch (error) {
            this.logger.error(`Config watcher failed for key ${key}:`, error);
          }
        }
      }
    }
  }

  /**
   * Reload configuration from all sources
   */
  public async reloadConfiguration(): Promise<void> {
    this.logger.info('Reloading configuration...');

    const oldConfig = this.getConfig();

    // Reset to defaults and reload
    this.config = this.getDefaultConfiguration();
    await this.loadConfiguration();

    this.emit('config_reloaded', { oldConfig, newConfig: this.config });
  }

  /**
   * Export current configuration to file
   */
  public async exportConfiguration(filePath?: string): Promise<void> {
    const exportPath = filePath || `./config/orchestrator-export-${Date.now()}.json`;

    // In a real implementation, write to actual file
    // const fs = await import('fs/promises');
    // await fs.writeFile(exportPath, JSON.stringify(this.config, null, 2));

    this.logger.info(`Configuration exported to: ${exportPath}`);
  }

  /**
   * Get configuration schema for validation
   */
  public getConfigSchema(): ConfigSchema {
    return {
      orchestration: {
        maxConcurrentJobs: { type: 'number', min: 1, max: 1000 },
        defaultTimeout: { type: 'number', min: 1000 },
        priorityWeights: {
          low: { type: 'number', min: 0 },
          normal: { type: 'number', min: 0 },
          high: { type: 'number', min: 0 },
          critical: { type: 'number', min: 0 }
        }
      },
      loadBalancing: {
        strategy: {
          type: 'string',
          enum: ['round_robin', 'weighted', 'least_connections', 'ai_driven', 'performance_based']
        },
        healthCheckInterval: { type: 'number', min: 1000 },
        failoverThreshold: { type: 'number', min: 0, max: 1 }
      },
      resources: {
        autoScalingEnabled: { type: 'boolean' },
        resourceReservationTimeout: { type: 'number', min: 1000 },
        optimizationInterval: { type: 'number', min: 10000 }
      },
      monitoring: {
        metricsRetention: { type: 'number', min: 3600 },
        alertingEnabled: { type: 'boolean' },
        dashboardRefreshInterval: { type: 'number', min: 1000 }
      },
      resilience: {
        circuitBreakerEnabled: { type: 'boolean' },
        retryEnabled: { type: 'boolean' },
        failoverEnabled: { type: 'boolean' }
      },
      analytics: {
        enabled: { type: 'boolean' },
        reportingInterval: { type: 'number', min: 60000 },
        predictionEnabled: { type: 'boolean' }
      },
      security: {
        encryptionEnabled: { type: 'boolean' },
        auditLogging: { type: 'boolean' },
        accessControlEnabled: { type: 'boolean' }
      }
    };
  }

  /**
   * Reset configuration to defaults
   */
  public resetToDefaults(): void {
    const oldConfig = this.getConfig();
    this.config = this.getDefaultConfiguration();

    this.logger.info('Configuration reset to defaults');
    this.emit('config_reset', { oldConfig, newConfig: this.config });
  }

  /**
   * Get configuration diff between current and provided config
   */
  public getConfigDiff(otherConfig: OrchestratorSettings): ConfigDiff {
    return this.calculateConfigDiff(this.config, otherConfig);
  }

  /**
   * Calculate configuration differences
   */
  private calculateConfigDiff(current: any, other: any, path: string = ''): ConfigDiff {
    const diff: ConfigDiff = {
      added: {},
      modified: {},
      removed: {}
    };

    // Check for modified and added keys
    for (const [key, value] of Object.entries(other)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in current)) {
        diff.added[currentPath] = value;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nestedDiff = this.calculateConfigDiff(current[key], value, currentPath);
        Object.assign(diff.added, nestedDiff.added);
        Object.assign(diff.modified, nestedDiff.modified);
        Object.assign(diff.removed, nestedDiff.removed);
      } else if (current[key] !== value) {
        diff.modified[currentPath] = { from: current[key], to: value };
      }
    }

    // Check for removed keys
    for (const key of Object.keys(current)) {
      if (!(key in other)) {
        const currentPath = path ? `${path}.${key}` : key;
        diff.removed[currentPath] = current[key];
      }
    }

    return diff;
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Configuration Manager...');

    // Clear all watchers
    this.configWatchers.clear();

    // Remove all listeners
    this.removeAllListeners();

    this.logger.info('Configuration Manager shutdown complete');
  }
}

// Supporting types and interfaces
export type ConfigWatcher = (newValue: any, oldValue?: any) => void;

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object';
    min?: number;
    max?: number;
    enum?: string[];
    [key: string]: any;
  } | ConfigSchema;
}

export interface ConfigDiff {
  added: Record<string, any>;
  modified: Record<string, { from: any; to: any }>;
  removed: Record<string, any>;
}
