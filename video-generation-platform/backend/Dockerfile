# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install system dependencies and FFmpeg
RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-dev \
    curl \
    bash \
    make \
    g++ \
    python3 \
    py3-pip \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig*.json ./

# Development dependencies stage
FROM base AS dev-deps
RUN npm ci --include=dev --silent

# Production dependencies stage
FROM base AS prod-deps
RUN npm ci --only=production --silent && \
    npm cache clean --force

# Build stage
FROM dev-deps AS builder

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# Build TypeScript application
RUN npm run build

# Test stage (optional)
FROM builder AS tester
COPY tests/ ./tests/
COPY jest.config.js ./
RUN npm run test:ci

# Production runtime stage
FROM node:18-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    curl \
    bash \
    dumb-init \
    tini

# Create application user and group
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Create application directory
WORKDIR /app

# Copy production dependencies
COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Create necessary directories with proper permissions
RUN mkdir -p \
    /tmp/video-processing \
    /app/logs \
    /app/uploads \
    /app/temp && \
    chown -R appuser:appgroup \
    /tmp/video-processing \
    /app/logs \
    /app/uploads \
    /app/temp

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe \
    TEMP_DIR=/tmp/video-processing

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s \
    --timeout=10s \
    --start-period=40s \
    --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use tini as PID 1 to handle signals properly
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# Production with development tools (for debugging)
FROM runtime AS debug

USER root

# Install development tools
RUN apk add --no-cache \
    git \
    vim \
    htop \
    strace

# Switch back to app user
USER appuser

# Override command for debugging
CMD ["node", "--inspect=0.0.0.0:9229", "dist/server.js"]
