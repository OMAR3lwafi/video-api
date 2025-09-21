import { z } from 'zod';

// UUID validation schema
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
});

// Query pagination schema (for query parameters)
export const queryPaginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20'),
});

// Sort schema
export const sortSchema = z.object({
  field: z.string().min(1, 'Sort field is required'),
  order: z.enum(['asc', 'desc'], {
    errorMap: () => ({ message: 'Sort order must be either "asc" or "desc"' }),
  }).default('asc'),
});

// Date range schema
export const dateRangeSchema = z.object({
  from: z.string().datetime('Invalid from date format').optional(),
  to: z.string().datetime('Invalid to date format').optional(),
}).refine((data) => {
  if (data.from && data.to) {
    return new Date(data.from) <= new Date(data.to);
  }
  return true;
}, {
  message: 'From date must be before or equal to to date',
});

// File upload validation
export const fileUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  mimetype: z.string().min(1, 'MIME type is required'),
  size: z.number().int().min(1, 'File size must be greater than 0'),
});

// URL validation schema
export const urlSchema = z.string().url('Invalid URL format');

// Email validation schema
export const emailSchema = z.string().email('Invalid email format');

// Phone number validation schema (international format)
export const phoneSchema = z.string().regex(
  /^\+[1-9]\d{1,14}$/,
  'Phone number must be in international format (+1234567890)'
);

// Password validation schema
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character');

// Color validation schema (hex format)
export const colorSchema = z.string().regex(
  /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  'Color must be in hex format (#RRGGBB or #RGB)'
);

// Percentage validation schema
export const percentageSchema = z.string().regex(
  /^\d+(\.\d+)?%$/,
  'Value must be a percentage (e.g., "50%", "25.5%")'
);

// Positive number schema
export const positiveNumberSchema = z.number().positive('Value must be positive');

// Non-negative number schema
export const nonNegativeNumberSchema = z.number().min(0, 'Value must be non-negative');

// String with minimum length
export const nonEmptyStringSchema = z.string().min(1, 'Value cannot be empty');

// Enum validation helper
export const createEnumSchema = <T extends readonly [string, ...string[]]>(
  values: T,
  errorMessage?: string
) => {
  return z.enum(values, {
    errorMap: () => ({ 
      message: errorMessage || `Value must be one of: ${values.join(', ')}` 
    }),
  });
};

// Export types
export type Pagination = z.infer<typeof paginationSchema>;
export type QueryPagination = z.infer<typeof queryPaginationSchema>;
export type Sort = z.infer<typeof sortSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;
