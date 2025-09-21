/**
 * Configuration Manager - Dynamic Configuration Management
 * Dynamic Video Content Generation Platform
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import {
  ConfigurationSchema,
  ValidationRule,
  ConfigurationUpdate
} from '../types';

export class ConfigurationManager extends EventEmitter {
  private logger: Logger;
  private configuration: Map<string, any> = new Map();
  private schemas: Map<string, ConfigurationSchema> = new Map();
  private watchers: Map<string, fsSync.FSWatcher> = new Map();
  private updateHistory: ConfigurationUpdate[] = [];
  
  private isInitialized: boolean = false;
  private configPath: string;
  private maxHistorySize: number = 100;

  constructor(logger: Logger, configPath: string = './config') {
    super();
    this.logger = logger;
    this.configPath = configPath;
  }

  /**
   * Initialize the configuration manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Configuration Manager...');
      
      // Initialize default schemas
      this.initializeDefaultSchemas();
      
      // Load configuration from environment and files
      await this.loadConfiguration();
      
      // Setup file watchers for dynamic updates
      await this.setupFileWatchers();
      
      this.isInitialized = true;
      this.logger.info('Configuration Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Configuration Manager:', error);
      throw error;
    }
  }

  /**
   * Get configuration value
   */
  get<T = any>(key: string, defaultValue?: T): T | undefined {
    const value = this.configuration.get(key);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set configuration value
   */
  async set(key: string, value: any, source: 'api' | 'file' | 'environment' | 'database' = 'api'): Promise<void> {
    try {
      // Validate against schema if exists
      const schema = this.getSchemaForKey(key);
      if (schema) {
        this.validateValue(key, value, schema);
      }
      
      const oldValue = this.configuration.get(key);
      this.configuration.set(key, value);
      
      // Record update
      const update: ConfigurationUpdate = {
        key,
        value,
        source,
        timestamp: new Date()
      };
      
      this.addToHistory(update);
      
      // Emit change event
      this.emit('configurationChanged', {
        key,
        oldValue,
        newValue: value,
        source
      });
      
      this.logger.debug(`Configuration updated: ${key} = ${JSON.stringify(value)}`);
      
    } catch (error) {
      this.logger.error(`Failed to set configuration ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple configuration values
   */
  getMultiple(keys: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const key of keys) {
      result[key] = this.configuration.get(key);
    }
    
    return result;
  }

  /**
   * Set multiple configuration values
   */
  async setMultiple(values: Record<string, any>, source: 'api' | 'file' | 'environment' | 'database' = 'api'): Promise<void> {
    const promises = Object.entries(values).map(([key, value]) => 
      this.set(key, value, source)
    );
    
    await Promise.all(promises);
  }

  /**
   * Check if configuration key exists
   */
  has(key: string): boolean {
    return this.configuration.has(key);
  }

  /**
   * Delete configuration key
   */
  async delete(key: string): Promise<void> {
    if (this.configuration.has(key)) {
      const oldValue = this.configuration.get(key);
      this.configuration.delete(key);
      
      // Record deletion
      const update: ConfigurationUpdate = {
        key,
        value: undefined,
        source: 'api',
        timestamp: new Date()
      };
      
      this.addToHistory(update);
      
      // Emit change event
      this.emit('configurationChanged', {
        key,
        oldValue,
        newValue: undefined,
        source: 'api'
      });
      
      this.logger.debug(`Configuration deleted: ${key}`);
    }
  }

  /**
   * Get all configuration keys
   */
  getKeys(): string[] {
    return Array.from(this.configuration.keys());
  }

  /**
   * Get all configuration as object
   */
  getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of this.configuration) {
      result[key] = value;
    }
    
    return result;
  }

  /**
   * Register configuration schema
   */
  registerSchema(prefix: string, schema: ConfigurationSchema): void {
    this.schemas.set(prefix, schema);
    this.logger.debug(`Registered schema for prefix: ${prefix}`);
  }

  /**
   * Validate configuration against schema
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const [prefix, schema] of this.schemas) {
      for (const [key, definition] of Object.entries(schema)) {
        const fullKey = `${prefix}.${key}`;
        const value = this.configuration.get(fullKey);
        
        try {
          this.validateValue(fullKey, value, { [key]: definition });
        } catch (error) {
          errors.push(`${fullKey}: ${error.message}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Load configuration from various sources
   */
  private async loadConfiguration(): Promise<void> {
    // Load from environment variables
    await this.loadFromEnvironment();
    
    // Load from configuration files
    await this.loadFromFiles();
    
    this.logger.info(`Loaded ${this.configuration.size} configuration values`);
  }

  /**
   * Load configuration from environment variables
   */
  private async loadFromEnvironment(): Promise<void> {
    const envPrefix = 'ORCHESTRATOR_';
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(envPrefix)) {
        const configKey = key.substring(envPrefix.length).toLowerCase().replace(/_/g, '.');
        
        // Try to parse as JSON, fallback to string
        let parsedValue: any = value;
        try {
          parsedValue = JSON.parse(value!);
        } catch {
          // Keep as string
        }
        
        await this.set(configKey, parsedValue, 'environment');
      }
    }
  }

  /**
   * Load configuration from files
   */
  private async loadFromFiles(): Promise<void> {
    try {
      const configFiles = ['config.json', 'config.local.json'];
      
      for (const filename of configFiles) {
        const filePath = path.join(this.configPath, filename);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const config = JSON.parse(content);
          
          await this.setMultiple(config, 'file');
          this.logger.debug(`Loaded configuration from ${filename}`);
          
        } catch (error) {
          if (error.code !== 'ENOENT') {
            this.logger.warn(`Failed to load configuration from ${filename}:`, error.message);
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load configuration from files:', error.message);
    }
  }

  /**
   * Setup file watchers for dynamic configuration updates
   */
  private async setupFileWatchers(): Promise<void> {
    try {
      const configFiles = ['config.json', 'config.local.json'];
      
      for (const filename of configFiles) {
        const filePath = path.join(this.configPath, filename);
        
        try {
          // Check if file exists
          await fs.access(filePath);
          
          // Setup watcher using synchronous fs.watchFile
          const watcher = fsSync.watchFile(filePath, { interval: 1000 }, async () => {
            this.logger.info(`Configuration file ${filename} changed, reloading...`);
            
            try {
              const content = await fs.readFile(filePath, 'utf-8');
              const config = JSON.parse(content);
              
              await this.setMultiple(config, 'file');
              this.logger.info(`Reloaded configuration from ${filename}`);
              
            } catch (error) {
              this.logger.error(`Failed to reload configuration from ${filename}:`, error);
            }
          });
          
          // Store a dummy watcher object since watchFile doesn't return FSWatcher
          this.watchers.set(filename, { close: () => fsSync.unwatchFile(filePath) } as any);
          this.logger.debug(`Setup file watcher for ${filename}`);
          
        } catch (error) {
          // File doesn't exist, skip watcher
        }
      }
    } catch (error) {
      this.logger.warn('Failed to setup file watchers:', error.message);
    }
  }

  /**
   * Initialize default configuration schemas
   */
  private initializeDefaultSchemas(): void {
    // Orchestrator schema
    this.registerSchema('orchestrator', {
      'max_concurrent_jobs': {
        type: 'number',
        required: false,
        default: 10,
        validation: [{ type: 'min', value: 1 }, { type: 'max', value: 100 }],
        description: 'Maximum number of concurrent jobs'
      },
      'job_timeout': {
        type: 'number',
        required: false,
        default: 600000,
        validation: [{ type: 'min', value: 10000 }],
        description: 'Default job timeout in milliseconds'
      },
      'enable_metrics': {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Enable metrics collection'
      }
    });

    // Circuit breaker schema
    this.registerSchema('circuit_breaker', {
      'failure_threshold': {
        type: 'number',
        required: false,
        default: 5,
        validation: [{ type: 'min', value: 1 }, { type: 'max', value: 20 }],
        description: 'Number of failures before opening circuit'
      },
      'recovery_timeout': {
        type: 'number',
        required: false,
        default: 60000,
        validation: [{ type: 'min', value: 5000 }],
        description: 'Recovery timeout in milliseconds'
      }
    });

    // Resource management schema
    this.registerSchema('resources', {
      'max_cpu_cores': {
        type: 'number',
        required: false,
        default: 8,
        validation: [{ type: 'min', value: 1 }, { type: 'max', value: 64 }],
        description: 'Maximum CPU cores to allocate'
      },
      'max_memory_gb': {
        type: 'number',
        required: false,
        default: 16,
        validation: [{ type: 'min', value: 1 }, { type: 'max', value: 256 }],
        description: 'Maximum memory in GB to allocate'
      }
    });

    this.logger.debug('Default configuration schemas initialized');
  }

  /**
   * Get schema for configuration key
   */
  private getSchemaForKey(key: string): ConfigurationSchema | null {
    for (const [prefix, schema] of this.schemas) {
      if (key.startsWith(prefix + '.')) {
        return schema;
      }
    }
    return null;
  }

  /**
   * Validate value against schema
   */
  private validateValue(key: string, value: any, schema: ConfigurationSchema): void {
    const keyParts = key.split('.');
    const fieldName = keyParts[keyParts.length - 1];
    const definition = schema[fieldName];
    
    if (!definition) {
      return; // No schema definition, skip validation
    }

    // Check required
    if (definition.required && (value === undefined || value === null)) {
      throw new Error(`Required configuration ${key} is missing`);
    }

    // Use default if value is undefined
    if (value === undefined && definition.default !== undefined) {
      return; // Will use default value
    }

    // Type validation
    if (value !== undefined && !this.validateType(value, definition.type)) {
      throw new Error(`Configuration ${key} must be of type ${definition.type}`);
    }

    // Custom validations
    if (definition.validation && value !== undefined) {
      for (const rule of definition.validation) {
        this.validateRule(key, value, rule);
      }
    }
  }

  /**
   * Validate value type
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Validate value against rule
   */
  private validateRule(key: string, value: any, rule: ValidationRule): void {
    switch (rule.type) {
      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          throw new Error(rule.message || `${key} must be at least ${rule.value}`);
        }
        break;
      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          throw new Error(rule.message || `${key} must be at most ${rule.value}`);
        }
        break;
      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
          throw new Error(rule.message || `${key} does not match required pattern`);
        }
        break;
      case 'enum':
        if (!Array.isArray(rule.value) || !rule.value.includes(value)) {
          throw new Error(rule.message || `${key} must be one of: ${rule.value.join(', ')}`);
        }
        break;
      case 'custom':
        if (typeof rule.value === 'function' && !rule.value(value)) {
          throw new Error(rule.message || `${key} failed custom validation`);
        }
        break;
    }
  }

  /**
   * Add update to history
   */
  private addToHistory(update: ConfigurationUpdate): void {
    this.updateHistory.push(update);
    
    // Trim history if too large
    if (this.updateHistory.length > this.maxHistorySize) {
      this.updateHistory = this.updateHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get configuration update history
   */
  getUpdateHistory(limit?: number): ConfigurationUpdate[] {
    const history = [...this.updateHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Export configuration to file
   */
  async exportConfiguration(filePath: string): Promise<void> {
    try {
      const config = this.getAll();
      const content = JSON.stringify(config, null, 2);
      
      await fs.writeFile(filePath, content, 'utf-8');
      this.logger.info(`Configuration exported to ${filePath}`);
      
    } catch (error) {
      this.logger.error(`Failed to export configuration to ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Import configuration from file
   */
  async importConfiguration(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content);
      
      await this.setMultiple(config, 'file');
      this.logger.info(`Configuration imported from ${filePath}`);
      
    } catch (error) {
      this.logger.error(`Failed to import configuration from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get configuration statistics
   */
  getStats(): any {
    return {
      totalKeys: this.configuration.size,
      schemas: this.schemas.size,
      watchers: this.watchers.size,
      updateHistory: this.updateHistory.length,
      lastUpdate: this.updateHistory.length > 0 ? 
        this.updateHistory[this.updateHistory.length - 1].timestamp : null
    };
  }

  /**
   * Shutdown configuration manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Configuration Manager...');
    
    try {
      // Close file watchers
      for (const [filename, watcher] of this.watchers) {
        watcher.close();
        this.logger.debug(`Closed file watcher for ${filename}`);
      }
      
      // Clear data structures
      this.configuration.clear();
      this.schemas.clear();
      this.watchers.clear();
      this.updateHistory = [];
      
      this.isInitialized = false;
      this.logger.info('Configuration Manager shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during configuration manager shutdown:', error);
      throw error;
    }
  }
}