import compression from 'compression';

/**
 * Response compression middleware
 */
export const compressionMiddleware = compression({
  // Compression level (1-9, where 9 is best compression but slowest)
  level: 6,

  // Minimum response size to compress (in bytes)
  threshold: 1024,

  // Function to decide if response should be compressed
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Don't compress images, videos, or already compressed content
    const contentType = res.getHeader('Content-Type') as string;
    if (contentType) {
      if (contentType.startsWith('image/') || 
          contentType.startsWith('video/') ||
          contentType.startsWith('audio/') ||
          contentType.includes('zip') ||
          contentType.includes('gzip') ||
          contentType.includes('compress')) {
        return false;
      }
    }

    // Use compression for other content types
    return compression.filter(req, res);
  },

  // Memory level (1-9, affects memory usage vs speed trade-off)
  memLevel: 8,

  // Window size (affects compression ratio vs memory usage)
  windowBits: 15,

  // Compression strategy (use default zlib strategy)
  // strategy: compression.constants.Z_DEFAULT_STRATEGY,
});
