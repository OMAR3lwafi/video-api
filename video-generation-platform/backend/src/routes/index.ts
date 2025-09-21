import { Router } from 'express';
import healthRoutes from './health.routes';
import videoRoutes from './video.routes';
import { uploadRateLimiter } from '@/middlewares/rateLimiter';
import { validateBody } from '@/middlewares/validation';
import { videoCreateSchema } from '@/schemas/video.schema';
import { asyncHandler } from '@/utils/asyncHandler';
import { videoController } from '@/controllers/video.controller';

const router = Router();

// Mount route modules
router.use('/health', healthRoutes);
router.use('/video', videoRoutes);
// GET alias per API spec: /api/v1/videoresult/:jobId -> maps to /api/v1/video/result/:jobId
router.get('/videoresult/:jobId', (req, res, next) => {
  (videoRoutes as any).handle({ ...req, url: `/result/${req.params.jobId}`, originalUrl: req.originalUrl }, res, next);
});
// Alias per API spec: POST /api/v1/videocreate should call the same handler as /video/create
router.post(
  '/videocreate',
  uploadRateLimiter,
  validateBody(videoCreateSchema),
  asyncHandler(videoController.createVideo)
);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Dynamic Video Content Generation Platform API v1',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/v1/health',
      video: '/api/v1/video',
      videocreate: '/api/v1/videocreate',
      videoresult: '/api/v1/videoresult/:jobId'
    },
    documentation: 'https://docs.videogeneration.platform',
  });
});

export default router;
