# Multi-stage Dockerfile for Video Orchestrator Service
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-dev \
    python3 \
    make \
    g++ \
    libc6-compat \
    curl \
    dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS builder

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY src ./src
COPY tests ./tests

# Build the application
RUN npm run build

# Run tests
RUN npm test

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    curl \
    dumb-init \
    tini

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S orchestrator -u 1001 -G nodejs

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/tmp/*

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy configuration files
COPY --chown=orchestrator:nodejs config ./config

# Create directories with correct permissions
RUN mkdir -p logs temp && \
    chown -R orchestrator:nodejs /app && \
    chmod -R 755 /app

# Switch to non-root user
USER orchestrator

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:9000/health || exit 1

# Expose port
EXPOSE 9000

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Labels for metadata
LABEL maintainer="Video Platform Team"
LABEL version="1.0.0"
LABEL description="Intelligent orchestrator service for dynamic video content generation platform"
LABEL org.opencontainers.image.title="Video Orchestrator"
LABEL org.opencontainers.image.description="Orchestrator service with AI-driven load balancing and resource management"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Video Platform"
