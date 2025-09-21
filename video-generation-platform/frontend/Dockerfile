# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    bash \
    git

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Development dependencies stage
FROM base AS dev-deps
RUN npm ci --include=dev --silent

# Production dependencies stage
FROM base AS prod-deps
RUN npm ci --only=production --silent && \
    npm cache clean --force

# Build stage
FROM dev-deps AS builder

# Copy configuration files
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY index.html ./

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Build arguments for environment variables
ARG VITE_API_BASE_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_AWS_S3_BUCKET
ARG VITE_APP_VERSION

# Set build environment variables
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_AWS_S3_BUCKET=${VITE_AWS_S3_BUCKET}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}

# Build the application
RUN npm run build

# Test stage (optional)
FROM builder AS tester
COPY .eslintrc.json ./
RUN npm run lint && npm run type-check

# Nginx production stage
FROM nginx:1.25-alpine AS runtime

# Install system dependencies for health checks and security
RUN apk add --no-cache \
    curl \
    bash \
    dumb-init \
    shadow

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Create application user and group
RUN groupadd -g 1001 appgroup && \
    useradd -r -u 1001 -g appgroup appuser

# Copy built application from builder stage
COPY --from=builder --chown=appuser:appgroup /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY --chown=appuser:appgroup nginx.conf /etc/nginx/nginx.conf

# Create a simple health check endpoint
RUN echo '<!DOCTYPE html><html><body><h1>OK</h1></body></html>' > /usr/share/nginx/html/health

# Create nginx directories and set permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R appuser:appgroup \
    /var/cache/nginx \
    /var/log/nginx \
    /var/run \
    /usr/share/nginx/html \
    /etc/nginx/conf.d

# Create PID file directory
RUN mkdir -p /tmp/nginx && \
    chown -R appuser:appgroup /tmp/nginx

# Set proper permissions for nginx
RUN chmod -R 755 /usr/share/nginx/html && \
    chmod 644 /etc/nginx/nginx.conf

# Switch to non-root user
USER appuser

# Environment variables
ENV NGINX_WORKER_PROCESSES=auto
ENV NGINX_WORKER_CONNECTIONS=1024
ENV NGINX_KEEPALIVE_TIMEOUT=65

# Expose ports
EXPOSE 80 443

# Health check configuration
HEALTHCHECK --interval=30s \
    --timeout=10s \
    --start-period=30s \
    --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Development stage with hot reload capability
FROM node:18-alpine AS development

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl bash

# Copy package files
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm ci --silent

# Copy configuration files
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY index.html ./
COPY .eslintrc.json ./

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Change ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose Vite dev server port
EXPOSE 5173

# Health check for development
HEALTHCHECK --interval=30s \
    --timeout=10s \
    --start-period=30s \
    --retries=3 \
    CMD curl -f http://localhost:5173 || exit 1

# Development server command
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Debug stage with additional tools
FROM runtime AS debug

USER root

# Install debugging tools
RUN apk add --no-cache \
    vim \
    htop \
    strace \
    tcpdump \
    net-tools

# Add debugging configuration
COPY nginx.debug.conf /etc/nginx/nginx.debug.conf

# Switch back to app user
USER appuser

# Override entrypoint for debugging
CMD ["nginx", "-c", "/etc/nginx/nginx.debug.conf", "-g", "daemon off;"]
