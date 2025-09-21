export { MasterOrchestrator } from '../core/MasterOrchestrator.js';
export { WorkflowEngine } from './WorkflowEngine.js';
export { ResourceManager } from './ResourceManager.js';
export { LoadBalancerManager } from './LoadBalancerManager.js';
export { HealthCheckEngine } from './HealthCheckEngine.js';
export { AnalyticsEngine } from './AnalyticsEngine.js';
export { EventBus } from './EventBus.js';
export { ConfigurationManager } from './ConfigurationManager.js';
export { ResilienceManager } from './ResilienceManager.js';

// Health Check Engine
import { EventEmitter } from 'events';
import {
  HealthCheckResult,
  SystemHealthReport,
  HealthStatus,
  HealthSummary,
  ResourceUtilization,
  OrchestratorError
} from '../types/index.js';
import { Logger } from '../utils/Logger.js';
import { ConfigurationManager } from './ConfigurationManager.js';

export class HealthCheckEngine extends EventEmitter {
  private healthCheckers: Map<string, HealthChecker>;
  private healthStatus: Map<string, HealthCheckResult>;
  private alertManager: AlertManager;
  private recoveryManager: RecoveryManager;
  private logger: Logger;
  private configManager: ConfigurationManager;
  private checkInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.healthCheckers = new Map();
    this.healthStatus = new Map();
    this.alertManager = new AlertManager();
    this.recoveryManager = new RecoveryManager();
    this.logger = new Logger('HealthCheckEngine');
    this.configManager = ConfigurationManager.getInstance();
  }

  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Health Check Engine...');

      // Initialize health checkers
