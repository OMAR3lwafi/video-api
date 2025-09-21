/**
 * Orchestrator Service Entry Point
 * Dynamic Video Content Generation Platform
 */

import express from 'express';
import winston from 'winston';
import { MasterOrchestrator } from './services/MasterOrchestrator';
import { ConfigurationManager } from './services/ConfigurationManager';
import { VideoJobRequest } from './types';

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize orchestrator components
let masterOrchestrator: MasterOrchestrator;
let configManager: ConfigurationManager;

async function initializeOrchestrator() {
  try {
    logger.info('Starting Orchestrator Service...');
    
    // Initialize configuration manager
    configManager = new ConfigurationManager(logger);
    await configManager.initialize();
    
    // Initialize master orchestrator
    masterOrchestrator = new MasterOrchestrator(logger, configManager);
    await masterOrchestrator.initialize();
    
    logger.info('Orchestrator Service initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize Orchestrator Service:', error);
    process.exit(1);
  }
}

// API Routes
app.post('/api/v1/orchestrate', async (req, res) => {
  try {
    const jobRequest: VideoJobRequest = req.body;
    
    // Validate request
    if (!jobRequest.id || !jobRequest.elements || jobRequest.elements.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Missing required fields: id, elements'
      });
    }
    
    // Orchestrate job
    const result = await masterOrchestrator.orchestrateVideoJob(jobRequest);
    
    res.json(result);
    
  } catch (error) {
    logger.error('Orchestration failed:', error);
    res.status(500).json({
      error: 'Orchestration failed',
      message: error.message
    });
  }
});

app.get('/api/v1/orchestration/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const status = await masterOrchestrator.getOrchestrationStatus(id);
    res.json(status);
    
  } catch (error) {
    logger.error('Failed to get orchestration status:', error);
    res.status(404).json({
      error: 'Orchestration not found',
      message: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      orchestrator: 'healthy',
      configuration: 'healthy'
    }
  });
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  
  if (masterOrchestrator) {
    await masterOrchestrator.shutdown();
  }
  
  if (configManager) {
    await configManager.shutdown();
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  
  if (masterOrchestrator) {
    await masterOrchestrator.shutdown();
  }
  
  if (configManager) {
    await configManager.shutdown();
  }
  
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 9000;

async function startServer() {
  await initializeOrchestrator();
  
  app.listen(PORT, () => {
    logger.info(`Orchestrator Service listening on port ${PORT}`);
  });
}

startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});