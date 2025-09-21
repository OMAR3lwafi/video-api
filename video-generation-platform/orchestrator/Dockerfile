# Multi-stage build for orchestrator service optimization
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    bash \
    make \
    g++ \
    python3 \
    py3-pip \
    git \
    dumb-init \
    tini

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

# Build TypeScript application
RUN npm run build

# Test stage (optional)
FROM builder AS tester
COPY tests/ ./tests/
COPY jest.config.js ./
RUN npm run test:ci || true

# Production runtime stage
FROM node:18-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache \
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
    /app/logs \
    /app/temp \
    /app/queue-data && \
    chown -R appuser:appgroup \
    /app/logs \
    /app/temp \
    /app/queue-data

# Set environment variables
ENV NODE_ENV=production \
    PORT=9000 \
    MAX_CONCURRENT_JOBS=10 \
    JOB_TIMEOUT=1800000 \
    HEALTH_CHECK_INTERVAL=30000

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 9000

# Health check configuration
HEALTHCHECK --interval=30s \
    --timeout=10s \
    --start-period=40s \
    --retries=3 \
    CMD curl -f http://localhost:9000/health || exit 1

# Use tini as PID 1 to handle signals properly
ENTRYPOINT ["tini", "--"]

# Start the orchestrator service
CMD ["node", "dist/server.js"]

# Development stage with hot reload
FROM base AS development

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci --silent

# Copy configuration files
COPY tsconfig*.json ./

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Change ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 9000

# Health check for development
HEALTHCHECK --interval=30s \
    --timeout=10s \
    --start-period=30s \
    --retries=3 \
    CMD curl -f http://localhost:9000/health || exit 1

# Development server command with TypeScript watching
CMD ["npm", "run", "dev"]

# Debug stage with additional tools
FROM runtime AS debug

USER root

# Install debugging tools
RUN apk add --no-cache \
    git \
    vim \
    htop \
    strace \
    tcpdump \
    net-tools \
    lsof

# Switch back to app user
USER appuser

# Override command for debugging
CMD ["node", "--inspect=0.0.0.0:9229", "dist/server.js"]

# Monitoring stage with additional metrics tools
FROM runtime AS monitoring

USER root

# Install monitoring tools
RUN apk add --no-cache \
    prometheus-node-exporter \
    grafana-agent

# Copy monitoring configuration
COPY monitoring/ ./monitoring/

# Switch back to app user
USER appuser

# Expose additional ports for monitoring
EXPOSE 9000 9100 3100

# Start with monitoring
CMD ["sh", "-c", "node dist/server.js & node-exporter & wait"]
