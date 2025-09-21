import { Router } from 'express';
import { videoController } from '../controllers/video.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { uploadRateLimiter, rateLimiterMiddleware as statusRateLimiter } from '../middlewares/rateLimiter';
import { validateBody, validateParams } from '../middlewares/validation';
import { videoCreateSchema, jobIdSchema } from '../schemas/video.schema';

const router = Router();

/**
 * POST /api/v1/video/create
 * Create a new video processing job
 */
router.post(
  '/create',
  uploadRateLimiter,
  validateBody(videoCreateSchema),
  asyncHandler(videoController.createVideo)
);

// Alias is mounted at root router to expose /api/v1/videocreate

/**
 * GET /api/v1/video/result/:jobId
 * Get video processing job status and result
 */
router.get(
  '/result/:jobId',
  statusRateLimiter,
  validateParams(jobIdSchema),
  asyncHandler(videoController.getJobStatus)
);

/**
 * DELETE /api/v1/video/job/:jobId
 * Cancel a video processing job
 */
router.delete(
  '/job/:jobId',
  validateParams(jobIdSchema),
  asyncHandler(videoController.cancelJob)
);

/**
 * GET /api/v1/video/jobs
 * List user's video processing jobs (with pagination)
 */
router.get('/jobs', asyncHandler(videoController.listJobs));

/**
 * GET /api/v1/video/job/:jobId/details
 * Get detailed job information with timeline
 */
router.get(
  '/job/:jobId/details',
  validateParams(jobIdSchema),
  asyncHandler(videoController.getJobDetails)
);

/**
 * GET /api/v1/video/job/:jobId/subscribe
 * Subscribe to job status updates via Server-Sent Events
 */
router.get(
  '/job/:jobId/subscribe',
  validateParams(jobIdSchema),
  asyncHandler(videoController.subscribeToJob)
);

export default router;
