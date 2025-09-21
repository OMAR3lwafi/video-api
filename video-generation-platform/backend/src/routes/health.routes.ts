import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * GET /api/v1/health
 * Basic health check endpoint
 */
router.get('/', asyncHandler(healthController.basicHealthCheck));

/**
 * GET /api/v1/health/detailed
 * Detailed health check with all services
 */
router.get('/detailed', asyncHandler(healthController.detailedHealthCheck));

/**
 * GET /api/v1/health/ready
 * Readiness probe for container orchestration
 */
router.get('/ready', asyncHandler(healthController.readinessCheck));

/**
 * GET /api/v1/health/live
 * Liveness probe for container orchestration
 */
router.get('/live', asyncHandler(healthController.livenessCheck));

export default router;
