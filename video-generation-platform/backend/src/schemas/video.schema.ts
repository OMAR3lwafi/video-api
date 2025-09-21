import { z } from 'zod';

// Video element schema
export const videoElementSchema = z.object({
  id: z.string().min(1, 'Element ID is required'),
  type: z.enum(['video', 'image'], {
    errorMap: () => ({ message: 'Element type must be either "video" or "image"' }),
  }),
  source: z.string().url('Element source must be a valid URL'),
  track: z.number().int().min(0, 'Track must be a non-negative integer'),
  x: z.string().regex(/^\d+(\.\d+)?%$/, 'X position must be a percentage (e.g., "50%")').optional(),
  y: z.string().regex(/^\d+(\.\d+)?%$/, 'Y position must be a percentage (e.g., "50%")').optional(),
  width: z.string().regex(/^\d+(\.\d+)?%$/, 'Width must be a percentage (e.g., "100%")').optional(),
  height: z.string().regex(/^\d+(\.\d+)?%$/, 'Height must be a percentage (e.g., "100%")').optional(),
  fit_mode: z.enum(['auto', 'contain', 'cover', 'fill'], {
    errorMap: () => ({ message: 'Fit mode must be one of: auto, contain, cover, fill' }),
  }).optional(),
});

// Video creation request schema
export const videoCreateSchema = z.object({
  output_format: z.enum(['mp4', 'mov', 'avi'], {
    errorMap: () => ({ message: 'Output format must be one of: mp4, mov, avi' }),
  }),
  width: z.number().int().min(1).max(7680, 'Width must be between 1 and 7680 pixels'),
  height: z.number().int().min(1).max(4320, 'Height must be between 1 and 4320 pixels'),
  elements: z.array(videoElementSchema)
    .min(1, 'At least one element is required')
    .max(10, 'Maximum 10 elements allowed per video'),
}).refine((data) => {
  // Validate aspect ratio is reasonable
  const aspectRatio = data.width / data.height;
  return aspectRatio >= 0.1 && aspectRatio <= 10;
}, {
  message: 'Invalid aspect ratio. Width to height ratio must be between 0.1 and 10',
});

// Job ID parameter schema
export const jobIdSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
});

// Query parameters for job listing
export const jobListQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20'),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
  sort: z.enum(['created_at', 'updated_at', 'status']).optional().default('created_at'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Common validation schemas
export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20'),
});

// Export types
export type VideoElement = z.infer<typeof videoElementSchema>;
export type VideoCreateRequest = z.infer<typeof videoCreateSchema>;
export type JobIdParams = z.infer<typeof jobIdSchema>;
export type JobListQuery = z.infer<typeof jobListQuerySchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
