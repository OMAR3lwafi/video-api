import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config';
import { logger } from '../config/monitoring';
import { SecurityLogger } from '../services/SecurityLogger';
import { ValidationError } from '../errors';
import { fileUploadSchema } from '../schemas/auth.schema';
import { SecuritySeverity } from '../types/auth';

const securityLogger = new SecurityLogger();

// Allowed MIME types for different file categories
const ALLOWED_MIME_TYPES = {
  images: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff'
  ],
  videos: [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/webm',
    'video/mkv',
    'video/m4v'
  ],
  audio: [
    'audio/mp3',
    'audio/wav',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
    'audio/m4a'
  ]
};

// Dangerous file extensions that should never be allowed
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
  '.php', '.asp', '.aspx', '.jsp', '.sh', '.ps1', '.py', '.rb', '.pl',
  '.cgi', '.htaccess', '.htpasswd', '.ini', '.cfg', '.conf'
];

// Magic number signatures for file type validation
const FILE_SIGNATURES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'video/mp4': [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp
  'video/avi': [0x52, 0x49, 0x46, 0x46], // RIFF
  'audio/mp3': [0x49, 0x44, 0x33], // ID3
  'audio/wav': [0x52, 0x49, 0x46, 0x46] // RIFF
};

/**
 * Configure multer for secure file uploads
 */
const storage = multer.memoryStorage(); // Store in memory for security scanning

const upload = multer({
  storage,
  limits: {
    fileSize: config.processing.maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
    files: 10, // Maximum 10 files per request
    fields: 20, // Maximum 20 form fields
    fieldNameSize: 100, // Maximum field name size
    fieldSize: 1024 * 1024 // Maximum field value size (1MB)
  },
  fileFilter: (req, file, cb) => {
    try {
      // Basic filename validation
      if (!file.originalname || file.originalname.length > 255) {
        return cb(new ValidationError('Invalid filename'));
      }

      // Check for dangerous extensions
      const ext = path.extname(file.originalname).toLowerCase();
      if (DANGEROUS_EXTENSIONS.includes(ext)) {
        return cb(new ValidationError(`File extension ${ext} is not allowed`));
      }

      // Check for path traversal attempts in filename
      if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
        return cb(new ValidationError('Invalid filename format'));
      }

      // Basic MIME type validation
      const allAllowedTypes = [
        ...ALLOWED_MIME_TYPES.images,
        ...ALLOWED_MIME_TYPES.videos,
        ...ALLOWED_MIME_TYPES.audio
      ];

      if (!allAllowedTypes.includes(file.mimetype)) {
        return cb(new ValidationError(`File type ${file.mimetype} is not allowed`));
      }

      cb(null, true);
    } catch (error) {
      cb(error instanceof Error ? error : new Error('File validation failed'));
    }
  }
});

/**
 * Validate file type using magic numbers
 */
async function validateFileSignature(buffer: Buffer, expectedMimeType: string): Promise<boolean> {
  try {
    // Use file-type library for accurate detection
    const fileType = await fileTypeFromBuffer(buffer);
    
    if (!fileType) {
      return false;
    }

    // Check if detected type matches expected type
    const detectedMime = fileType.mime;
    
    // Handle common MIME type variations
    const mimeTypeMap: { [key: string]: string[] } = {
      'image/jpeg': ['image/jpeg', 'image/jpg'],
      'video/quicktime': ['video/mov', 'video/quicktime'],
      'audio/mpeg': ['audio/mp3', 'audio/mpeg']
    };

    const acceptableMimes = mimeTypeMap[detectedMime] || [detectedMime];
    return acceptableMimes.includes(expectedMimeType);
  } catch (error) {
    logger.error('File signature validation error:', error);
    return false;
  }
}

/**
 * Scan file for malicious content (basic implementation)
 */
async function scanFileForMalware(buffer: Buffer, filename: string): Promise<{ isSafe: boolean; reason?: string }> {
  try {
    // Check for suspicious patterns in file content
    const content = buffer.toString('binary');
    
    // Look for script tags and executable patterns
    const suspiciousPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /vbscript:/i,
      /onload\s*=/i,
      /onerror\s*=/i,
      /eval\s*\(/i,
      /document\.write/i,
      /window\.location/i,
      /%3Cscript/i, // URL encoded script tag
      /MZ\x90\x00\x03/, // PE executable header
      /\x7fELF/, // ELF executable header
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        return {
          isSafe: false,
          reason: `Suspicious pattern detected: ${pattern.source}`
        };
      }
    }

    // Check for embedded executables in images/videos
    if (content.includes('MZ') && content.includes('This program cannot be run in DOS mode')) {
      return {
        isSafe: false,
        reason: 'Embedded executable detected'
      };
    }

    // Check file size vs content ratio for potential zip bombs
    if (buffer.length > 0) {
      const compressionRatio = content.length / buffer.length;
      if (compressionRatio > 100) {
        return {
          isSafe: false,
          reason: 'Suspicious compression ratio - potential zip bomb'
        };
      }
    }

    return { isSafe: true };
  } catch (error) {
    logger.error('Malware scanning error:', error);
    return {
      isSafe: false,
      reason: 'Malware scanning failed'
    };
  }
}

/**
 * Generate secure filename
 */
function generateSecureFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `${timestamp}_${randomBytes}${ext}`;
}

/**
 * File upload security middleware
 */
export const fileUploadSecurity = (fieldName: string = 'file', maxFiles: number = 1) => {
  const uploadHandler = maxFiles === 1 ? upload.single(fieldName) : upload.array(fieldName, maxFiles);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Apply multer upload
      uploadHandler(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            let message = 'File upload error';
            
            switch (err.code) {
              case 'LIMIT_FILE_SIZE':
                message = `File size exceeds ${config.processing.maxFileSizeMB}MB limit`;
                break;
              case 'LIMIT_FILE_COUNT':
                message = `Too many files. Maximum ${maxFiles} files allowed`;
                break;
              case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected file field';
                break;
              case 'LIMIT_FIELD_COUNT':
                message = 'Too many form fields';
                break;
              default:
                message = err.message;
            }

            await securityLogger.logFileUploadBlocked(
              req.user?.id,
              req.ip || 'unknown',
              req.get('User-Agent') || 'unknown',
              'unknown',
              message
            );

            return res.status(400).json({
              error: 'FileUploadError',
              message,
              timestamp: new Date().toISOString(),
              correlationId: req.correlationId
            });
          }

          return next(err);
        }

        // Process uploaded files
        const files = req.files as Express.Multer.File[] || (req.file ? [req.file] : []);
        
        if (files.length === 0) {
          return next();
        }

        // Validate each file
        for (const file of files) {
          try {
            // Validate with Zod schema
            const validationResult = fileUploadSchema.safeParse({
              filename: file.originalname,
              mimeType: file.mimetype,
              size: file.size
            });

            if (!validationResult.success) {
              const errors = validationResult.error.errors.map(e => e.message).join(', ');
              
              await securityLogger.logFileUploadBlocked(
                req.user?.id,
                req.ip || 'unknown',
                req.get('User-Agent') || 'unknown',
                file.originalname,
                `Validation failed: ${errors}`
              );

              return res.status(400).json({
                error: 'FileValidationError',
                message: `File validation failed: ${errors}`,
                filename: file.originalname,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
              });
            }

            // Validate file signature
            const isValidSignature = await validateFileSignature(file.buffer, file.mimetype);
            if (!isValidSignature) {
              await securityLogger.logFileUploadBlocked(
                req.user?.id,
                req.ip || 'unknown',
                req.get('User-Agent') || 'unknown',
                file.originalname,
                'File signature mismatch - potential file type spoofing'
              );

              return res.status(400).json({
                error: 'FileTypeError',
                message: 'File type validation failed - file signature does not match extension',
                filename: file.originalname,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
              });
            }

            // Scan for malware
            const scanResult = await scanFileForMalware(file.buffer, file.originalname);
            if (!scanResult.isSafe) {
              await securityLogger.logFileUploadBlocked(
                req.user?.id,
                req.ip || 'unknown',
                req.get('User-Agent') || 'unknown',
                file.originalname,
                `Malware detected: ${scanResult.reason}`
              );

              // Log as critical security event
              await securityLogger.logSuspiciousActivity(
                `Malware upload attempt detected`,
                req.ip || 'unknown',
                req.get('User-Agent') || 'unknown',
                SecuritySeverity.CRITICAL,
                {
                  filename: file.originalname,
                  reason: scanResult.reason,
                  userId: req.user?.id,
                  correlationId: req.correlationId
                }
              );

              return res.status(400).json({
                error: 'MalwareDetected',
                message: 'File contains suspicious content and cannot be uploaded',
                filename: file.originalname,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
              });
            }

            // Generate secure filename
            const secureFilename = generateSecureFilename(file.originalname);
            
            // Add security metadata to file object
            (file as any).secureFilename = secureFilename;
            (file as any).validated = true;
            (file as any).uploadTimestamp = new Date().toISOString();
            (file as any).uploadedBy = req.user?.id;

            logger.info('File upload validated successfully', {
              originalName: file.originalname,
              secureFilename,
              size: file.size,
              mimetype: file.mimetype,
              userId: req.user?.id,
              correlationId: req.correlationId
            });
          } catch (error) {
            logger.error('File validation error:', error);
            
            await securityLogger.logFileUploadBlocked(
              req.user?.id,
              req.ip || 'unknown',
              req.get('User-Agent') || 'unknown',
              file.originalname,
              `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );

            return res.status(500).json({
              error: 'FileValidationError',
              message: 'File validation failed due to internal error',
              filename: file.originalname,
              timestamp: new Date().toISOString(),
              correlationId: req.correlationId
            });
          }
        }

        next();
      });
      
      return; // Add explicit return to satisfy TypeScript
    } catch (error) {
      logger.error('File upload security middleware error:', error);
      next(error);
      return; // Add explicit return to satisfy TypeScript
    }
  };
};

/**
 * File download security middleware
 */
export const fileDownloadSecurity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate file path to prevent directory traversal
    const filePath = req.params.filePath || req.query.path as string;
    
    if (!filePath) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'File path is required',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
    }

    // Check for path traversal attempts
    if (filePath.includes('..') || filePath.includes('/') || filePath.includes('\\')) {
      await securityLogger.logSuspiciousActivity(
        'Path traversal attempt in file download',
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        SecuritySeverity.HIGH,
        {
          filePath,
          userId: req.user?.id,
          correlationId: req.correlationId
        }
      );

      return res.status(400).json({
        error: 'InvalidPath',
        message: 'Invalid file path',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
    }

    // Set secure headers for file downloads
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    next();
  } catch (error) {
    logger.error('File download security middleware error:', error);
    next(error);
  }
};

/**
 * Clean up temporary files
 */
export const cleanupTempFiles = async (files: Express.Multer.File[]) => {
  for (const file of files) {
    try {
      if (file.path) {
        await fs.unlink(file.path);
        logger.debug('Temporary file cleaned up', { path: file.path });
      }
    } catch (error) {
      logger.warn('Failed to cleanup temporary file', { 
        path: file.path, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
};