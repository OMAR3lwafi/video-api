/**
 * Validation utilities and schemas
 * Zod schemas for form validation and data validation
 */

import { z } from 'zod'

/**
 * Common validation schemas
 */
export const commonSchemas = {
  email: z.string().email('Please enter a valid email address'),
  url: z.string().url('Please enter a valid URL'),
  uuid: z.string().uuid('Please enter a valid UUID'),
  positiveNumber: z.number().positive('Must be a positive number'),
  nonEmptyString: z.string().min(1, 'This field is required'),
  optionalString: z.string().optional(),
}

/**
 * File validation schemas
 */
export const fileSchemas = {
  imageFile: z.object({
    type: z.string().refine(
      (type) => type.startsWith('image/'),
      'File must be an image'
    ),
    size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
    name: z.string().min(1, 'File name is required'),
  }),
  
  videoFile: z.object({
    type: z.string().refine(
      (type) => type.startsWith('video/'),
      'File must be a video'
    ),
    size: z.number().max(100 * 1024 * 1024, 'File size must be less than 100MB'),
    name: z.string().min(1, 'File name is required'),
  }),
  
  mediaFile: z.object({
    type: z.string().refine(
      (type) => type.startsWith('image/') || type.startsWith('video/'),
      'File must be an image or video'
    ),
    size: z.number().max(100 * 1024 * 1024, 'File size must be less than 100MB'),
    name: z.string().min(1, 'File name is required'),
  }),
}

/**
 * Video creation form schema
 */
export const videoCreationSchema = z.object({
  // Basic settings
  name: z.string().min(1, 'Project name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  
  // Video settings
  dimensions: z.object({
    width: z.number().min(100).max(4096),
    height: z.number().min(100).max(4096),
  }),
  
  duration: z.number().min(1).max(600), // 1 second to 10 minutes
  fps: z.number().int().min(15).max(60),
  
  outputFormat: z.enum(['mp4', 'mov', 'avi']),
  quality: z.enum(['low', 'medium', 'high', 'ultra']),
  
  // Background
  backgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  
  // Elements
  elements: z.array(z.object({
    id: z.string(),
    type: z.enum(['video', 'image']),
    source: z.string().url(),
    track: z.number().int().min(0),
    x: z.string().optional(),
    y: z.string().optional(),
    width: z.string().optional(),
    height: z.string().optional(),
    fit_mode: z.enum(['auto', 'contain', 'cover', 'fill']).optional(),
  })).max(10, 'Maximum 10 elements allowed'),
})

/**
 * Video element schema
 */
export const videoElementSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['video', 'image']),
  source: z.string().url('Please enter a valid URL'),
  track: z.number().int().min(0, 'Track must be 0 or greater'),
  
  // Position (percentages)
  x: z.string()
    .regex(/^\d+(\.\d+)?%?$/, 'Invalid position format')
    .optional(),
  y: z.string()
    .regex(/^\d+(\.\d+)?%?$/, 'Invalid position format')
    .optional(),
  
  // Size (percentages)
  width: z.string()
    .regex(/^\d+(\.\d+)?%?$/, 'Invalid size format')
    .optional(),
  height: z.string()
    .regex(/^\d+(\.\d+)?%?$/, 'Invalid size format')
    .optional(),
  
  // Fit mode
  fit_mode: z.enum(['auto', 'contain', 'cover', 'fill']).optional(),
  
  // Timing
  duration: z.number().positive().optional(),
  start_time: z.number().min(0).optional(),
  end_time: z.number().positive().optional(),
  
  // Effects
  opacity: z.number().min(0).max(1).optional(),
  rotation: z.number().min(-360).max(360).optional(),
  z_index: z.number().int().optional(),
})

/**
 * User profile schema
 */
export const userProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: commonSchemas.email,
  avatar: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    notifications: z.boolean(),
    autoSave: z.boolean(),
    previewQuality: z.enum(['low', 'medium', 'high']),
  }).optional(),
})

/**
 * Project settings schema
 */
export const projectSettingsSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).max(10).optional(),
  isPublic: z.boolean().optional(),
  allowCollaboration: z.boolean().optional(),
})

/**
 * Search/filter schema
 */
export const searchFilterSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['all', 'pending', 'processing', 'completed', 'failed']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'name', 'duration']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
})

/**
 * Upload validation schema
 */
export const uploadSchema = z.object({
  files: z.array(fileSchemas.mediaFile).min(1, 'At least one file is required'),
  destination: z.string().optional(),
  overwrite: z.boolean().optional(),
})

/**
 * Validation helper functions
 */
export const validators = {
  /**
   * Validate file type
   */
  isValidFileType: (file: File, allowedTypes: string[]): boolean => {
    return allowedTypes.some(type => file.type.startsWith(type))
  },
  
  /**
   * Validate file size
   */
  isValidFileSize: (file: File, maxSizeBytes: number): boolean => {
    return file.size <= maxSizeBytes
  },
  
  /**
   * Validate image dimensions
   */
  validateImageDimensions: (
    file: File,
    maxWidth?: number,
    maxHeight?: number
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const valid = (!maxWidth || img.width <= maxWidth) && 
                     (!maxHeight || img.height <= maxHeight)
        resolve(valid)
      }
      img.onerror = () => resolve(false)
      img.src = URL.createObjectURL(file)
    })
  },
  
  /**
   * Validate video duration
   */
  validateVideoDuration: (file: File, maxDurationSeconds: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.onloadedmetadata = () => {
        resolve(video.duration <= maxDurationSeconds)
      }
      video.onerror = () => resolve(false)
      video.src = URL.createObjectURL(file)
    })
  },
  
  /**
   * Validate URL accessibility
   */
  validateUrlAccessibility: async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  },
  
  /**
   * Validate color format
   */
  isValidColor: (color: string): boolean => {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    const rgbRegex = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/
    const rgbaRegex = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/
    
    return hexRegex.test(color) || rgbRegex.test(color) || rgbaRegex.test(color)
  },
  
  /**
   * Validate percentage string
   */
  isValidPercentage: (value: string): boolean => {
    const regex = /^\d+(\.\d+)?%?$/
    if (!regex.test(value)) return false
    
    const num = parseFloat(value.replace('%', ''))
    return num >= 0 && num <= 100
  },
  
  /**
   * Validate aspect ratio
   */
  isValidAspectRatio: (width: number, height: number): boolean => {
    return width > 0 && height > 0 && width <= 4096 && height <= 4096
  },
  
  /**
   * Validate frame rate
   */
  isValidFrameRate: (fps: number): boolean => {
    return fps >= 15 && fps <= 120 && Number.isInteger(fps)
  },
}

/**
 * Error message formatters
 */
export const errorMessages = {
  required: (field: string) => `${field} is required`,
  invalid: (field: string) => `${field} is invalid`,
  tooLong: (field: string, max: number) => `${field} must be less than ${max} characters`,
  tooShort: (field: string, min: number) => `${field} must be at least ${min} characters`,
  tooLarge: (field: string, max: string) => `${field} must be smaller than ${max}`,
  tooSmall: (field: string, min: string) => `${field} must be larger than ${min}`,
  invalidFormat: (field: string, format: string) => `${field} must be in ${format} format`,
  invalidType: (field: string, type: string) => `${field} must be a ${type}`,
  invalidRange: (field: string, min: number, max: number) => 
    `${field} must be between ${min} and ${max}`,
}

/**
 * Custom validation rules
 */
export const customValidators = {
  strongPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    
  phoneNumber: z.string()
    .regex(/^\+?[\d\s-()]+$/, 'Invalid phone number format'),
    
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug must be less than 50 characters'),
}
