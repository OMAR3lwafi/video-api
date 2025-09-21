import { z } from 'zod';
import validator from 'validator';
import { UserRole } from '../types/auth';

// Custom validators
const emailValidator = z.string()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .refine((email) => validator.isEmail(email), {
    message: 'Invalid email format'
  })
  .refine((email) => !validator.contains(email, '..'), {
    message: 'Email cannot contain consecutive dots'
  });

const passwordValidator = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be less than 128 characters long')
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain at least one lowercase letter'
  })
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain at least one uppercase letter'
  })
  .refine((password) => /\d/.test(password), {
    message: 'Password must contain at least one number'
  })
  .refine((password) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password), {
    message: 'Password must contain at least one special character'
  })
  .refine((password) => {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    return !commonPasswords.includes(password.toLowerCase());
  }, {
    message: 'Password is too common'
  });

const ipAddressValidator = z.string()
  .refine((ip) => validator.isIP(ip), {
    message: 'Invalid IP address format'
  });

const uuidValidator = z.string()
  .refine((uuid) => validator.isUUID(uuid), {
    message: 'Invalid UUID format'
  });

// Authentication schemas
export const loginSchema = z.object({
  email: emailValidator,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false)
});

export const registerSchema = z.object({
  email: emailValidator,
  password: passwordValidator,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions'
  })
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

export const passwordResetRequestSchema = z.object({
  email: emailValidator
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordValidator,
  confirmPassword: z.string().min(1, 'Password confirmation is required')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordValidator,
  confirmPassword: z.string().min(1, 'Password confirmation is required')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword']
});

// User management schemas
export const userIdSchema = z.object({
  userId: uuidValidator
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole)
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean()
});

// Security event schemas
export const securityEventQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional().default('20'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  type: z.string().optional(),
  userId: uuidValidator.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  ipAddress: ipAddressValidator.optional()
});

// File upload security schemas
export const fileUploadSchema = z.object({
  filename: z.string()
    .min(1, 'Filename is required')
    .max(255, 'Filename is too long')
    .refine((filename) => {
      // Check for dangerous file extensions
      const dangerousExtensions = [
        '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js',
        '.jar', '.php', '.asp', '.aspx', '.jsp', '.sh', '.ps1'
      ];
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      return !dangerousExtensions.includes(ext);
    }, {
      message: 'File type not allowed'
    })
    .refine((filename) => {
      // Check for path traversal attempts
      return !filename.includes('..') && !filename.includes('/') && !filename.includes('\\');
    }, {
      message: 'Invalid filename format'
    }),
  
  mimeType: z.string()
    .refine((mimeType) => {
      const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv',
        'audio/mp3', 'audio/wav', 'audio/aac'
      ];
      return allowedMimeTypes.includes(mimeType);
    }, {
      message: 'File type not allowed'
    }),
  
  size: z.number()
    .min(1, 'File cannot be empty')
    .max(500 * 1024 * 1024, 'File size exceeds 500MB limit') // 500MB
});

// API key schemas
export const apiKeySchema = z.object({
  name: z.string()
    .min(1, 'API key name is required')
    .max(100, 'API key name is too long')
    .refine((name) => /^[a-zA-Z0-9\s\-_]+$/.test(name), {
      message: 'API key name can only contain letters, numbers, spaces, hyphens, and underscores'
    }),
  
  permissions: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional()
});

// Rate limiting schemas
export const rateLimitConfigSchema = z.object({
  windowMs: z.number().min(1000).max(24 * 60 * 60 * 1000), // 1 second to 24 hours
  maxRequests: z.number().min(1).max(10000),
  skipSuccessfulRequests: z.boolean().optional().default(false),
  skipFailedRequests: z.boolean().optional().default(false)
});

// Input sanitization schemas
export const sanitizedStringSchema = z.string()
  .transform((str) => {
    // Remove null bytes
    str = str.replace(/\0/g, '');
    
    // Trim whitespace
    str = str.trim();
    
    // Remove control characters except newlines and tabs
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return str;
  });

export const sanitizedHtmlSchema = z.string()
  .transform((html) => {
    // Basic HTML sanitization - remove script tags and dangerous attributes
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/on\w+="[^"]*"/gi, ''); // Remove event handlers
    html = html.replace(/javascript:/gi, ''); // Remove javascript: URLs
    
    return html;
  });

// Request validation schemas
export const correlationIdSchema = z.object({
  correlationId: uuidValidator.optional()
});

export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional().default('20'),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

// Security headers validation
export const securityHeadersSchema = z.object({
  'x-forwarded-for': z.string().optional(),
  'x-real-ip': z.string().optional(),
  'user-agent': z.string().max(1000).optional(),
  'referer': z.string().url().optional(),
  'origin': z.string().url().optional()
});

// Export type inference helpers
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type ApiKeyInput = z.infer<typeof apiKeySchema>;
export type SecurityEventQuery = z.infer<typeof securityEventQuerySchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;