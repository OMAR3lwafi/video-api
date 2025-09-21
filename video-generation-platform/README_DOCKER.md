# Video Generation Platform - Docker Containerization

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Services](#services)
5. [Configuration](#configuration)
6. [Deployment Scenarios](#deployment-scenarios)
7. [Container Management](#container-management)
8. [Monitoring & Observability](#monitoring--observability)
9. [Security](#security)
10. [Scaling & Performance](#scaling--performance)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)
13. [Examples](#examples)

## Overview

This document provides comprehensive guidance for deploying and managing the Video Generation Platform using Docker containers. The platform features a complete containerized architecture with multi-service orchestration, advanced monitoring, auto-scaling capabilities, and production-ready security configurations.

### Key Features

- **Multi-Stage Dockerfiles** - Optimized builds for development and production
- **Service Orchestration** - Complete Docker Compose configurations
- **Auto-Scaling** - Intelligent resource management and scaling
- **Comprehensive Monitoring** - Prometheus, Grafana, and logging integration  
- **Security Hardened** - Non-root containers, network isolation, secrets management
- **Development Ready** - Hot reload, debugging, and development tools
- **Production Optimized** - Load balancing, SSL termination, backup strategies

### Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer (Traefik)                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────────────┐
│                 External Network                                │
│  ┌──────────────┐   │   ┌──────────────┐   ┌──────────────────┐ │
│  │   Frontend   │───┼───│   Backend    │───│   Orchestrator   │ │
│  │   (Nginx)    │   │   │  (Node.js)   │   │   (Node.js)      │ │
│  └──────────────┘   │   └──────────────┘   └──────────────────┘ │
└─────────────────────┼───────────────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────────────┐
│                Internal Network                                 │
│  ┌──────────────┐   │   ┌──────────────┐   ┌──────────────────┐ │
│  │  PostgreSQL  │───┼───│    Redis     │───│   Monitoring     │ │
│  │  (Database)  │   │   │   (Cache)    │   │ (Prometheus)     │ │
│  └──────────────┘   │   └──────────────┘   └──────────────────┘ │
└─────────────────────┼───────────────────────────────────────────┘
                      │
                  Persistent
                   Storage
```

## Quick Start

### Prerequisites

- **Docker Engine** 20.10+ 
- **Docker Compose** 2.0+
- **System Requirements:**
  - 4GB+ RAM (8GB+ recommended for production)
  - 10GB+ available disk space
  - Multi-core CPU (4+ cores recommended)

### Development Environment (5-Minute Setup)

```bash
# 1. Clone the repository
git clone <your-repository-url>
cd video-generation-platform

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your configuration (see Configuration section)

# 3. Start development environment with monitoring
./scripts/start-containers.sh -e development -m -o

# 4. Verify deployment
curl http://localhost:3000/health
curl http://localhost:5173  # Frontend dev server

# 5. Access services
# Frontend (dev):  http://localhost:5173
# Backend API:      http://localhost:3000
# Grafana:          http://localhost:3001 (admin/admin)
# Prometheus:       http://localhost:9090
# MinIO Console:    http://localhost:9002 (minioadmin/minioadmin)
```

### Production Deployment

```bash
# 1. Configure production environment
cp .env.example .env
# Set production values for all variables

# 2. Deploy production stack
./scripts/start-containers.sh -e production -f docker-compose.prod.yml -m

# 3. Verify deployment
./scripts/validate-docker-setup.sh --quick

# 4. Enable monitoring
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# 5. Set up auto-scaling
./scripts/manage-resources.sh auto-scale --max-replicas 5
```

## Services

### Core Services

#### Backend API
- **Image**: Custom Node.js/Express application
- **Port**: 3000 (internal), configurable external
- **Purpose**: REST API server, video processing orchestration
- **Health Check**: `/health` endpoint
- **Scaling**: Horizontal (stateless)

```yaml
backend:
  build: ./backend
  ports: ["3000:3000"]
  environment:
    - NODE_ENV=production
    - MAX_CONCURRENT_JOBS=10
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    interval: 30s
    timeout: 15s
    retries: 5
```

#### Frontend
- **Image**: Custom React/Vite + Nginx
- **Port**: 80/443 (HTTP/HTTPS)
- **Purpose**: User interface, static file serving
- **Health Check**: Nginx status
- **Scaling**: Horizontal (stateless)

```yaml
frontend:
  build: ./frontend
  ports: ["80:80", "443:443"]
  environment:
    - VITE_API_BASE_URL=http://localhost:3000/api/v1
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:80/health"]
```

#### Orchestrator
- **Image**: Custom Node.js workflow engine
- **Port**: 9000
- **Purpose**: Advanced workflow management, job queuing
- **Health Check**: `/health` endpoint
- **Scaling**: Horizontal with leader election

#### Database (PostgreSQL)
- **Image**: postgres:15-alpine
- **Port**: 5432
- **Purpose**: Primary data storage
- **Health Check**: pg_isready
- **Scaling**: Single instance with backup/restore

#### Redis
- **Image**: redis:7-alpine
- **Port**: 6379
- **Purpose**: Caching, session storage, job queuing
- **Health Check**: Redis ping
- **Scaling**: Single instance with persistence

### Monitoring Services

#### Prometheus
- **Image**: prom/prometheus
- **Port**: 9090
- **Purpose**: Metrics collection and storage
- **Retention**: Configurable (default: 15 days)

#### Grafana
- **Image**: grafana/grafana
- **Port**: 3001
- **Purpose**: Metrics visualization and dashboards
- **Default Login**: admin/admin (change immediately)

#### Node Exporter
- **Image**: prom/node-exporter
- **Port**: 9100
- **Purpose**: System metrics collection

#### cAdvisor
- **Image**: gcr.io/cadvisor/cadvisor
- **Port**: 8080
- **Purpose**: Container metrics collection

### Optional Services

#### MinIO (Development)
- **Image**: minio/minio
- **Ports**: 9001 (API), 9002 (Console)
- **Purpose**: S3-compatible storage for development
- **Default Login**: minioadmin/minioadmin

#### Traefik (Production)
- **Image**: traefik:v3.0
- **Ports**: 80, 443, 8080 (dashboard)
- **Purpose**: Load balancing, SSL termination
- **Features**: Automatic SSL certificates (Let's Encrypt)

## Configuration

### Environment Variables

The platform uses a comprehensive `.env` file for configuration. Copy `.env.example` to `.env` and customize:

#### Essential Configuration

```bash
# Environment
NODE_ENV=production
ENVIRONMENT=production

# Database
DB_NAME=video_generation
DB_USER=postgres
DB_PASSWORD=your-secure-password

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# Security
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
SESSION_SECRET=your-session-secret
REDIS_PASSWORD=your-redis-password

# API Configuration
CORS_ORIGINS=https://yourdomain.com
IMMEDIATE_RESPONSE_THRESHOLD=30000
MAX_CONCURRENT_JOBS=10
```

#### Resource Limits

```bash
# Backend Resources
BACKEND_CPU_LIMIT=2.0
BACKEND_MEMORY_LIMIT=1G
BACKEND_REPLICAS=2

# Frontend Resources
FRONTEND_CPU_LIMIT=1.0
FRONTEND_MEMORY_LIMIT=512M
FRONTEND_REPLICAS=2

# Database Resources
DB_CPU_LIMIT=2.0
DB_MEMORY_LIMIT=2G
```

#### Monitoring Configuration

```bash
# Prometheus
PROMETHEUS_RETENTION_TIME=15d
PROMETHEUS_RETENTION_SIZE=5GB

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your-secure-password

# Metrics
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
```

### Docker Compose Files

#### docker-compose.yml (Main)
- Production-ready configuration
- Resource limits and health checks
- Named volumes for persistence
- Internal networking

#### docker-compose.dev.yml (Development)
- Hot reload for development
- Volume mounts for source code
- Debug ports exposed
- Development tools included

#### docker-compose.prod.yml (Production)
- Full monitoring stack
- SSL/TLS configuration
- Load balancing with Traefik
- Backup and recovery services

## Deployment Scenarios

### Local Development

```bash
# Start with hot reload
./scripts/start-containers.sh -e development

# Or with specific services
docker-compose -f docker-compose.dev.yml up backend redis database

# With debugging
docker-compose -f docker-compose.dev.yml up --build backend
# Debug port available at localhost:9229
```

### Staging Environment

```bash
# Production-like environment without SSL
./scripts/start-containers.sh -e production --compose-file docker-compose.yml

# With monitoring
./scripts/start-containers.sh -e production -m
```

### Production Deployment

```bash
# Full production stack
./scripts/start-containers.sh -e production -f docker-compose.prod.yml -m

# With automatic SSL
# Set DOMAIN and ACME_EMAIL in .env
docker-compose -f docker-compose.prod.yml up -d traefik

# Enable auto-scaling
./scripts/manage-resources.sh auto-scale --max-replicas 10
```

### Cloud Deployment

#### AWS ECS/Fargate
```bash
# Build and push images
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml push

# Use AWS CLI or CDK for ECS deployment
```

#### Docker Swarm
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml video-platform

# Scale services
docker service scale video-platform_backend=3
```

#### Kubernetes
```bash
# Convert compose to k8s manifests
kompose convert -f docker-compose.prod.yml

# Deploy to cluster
kubectl apply -f ./
```

## Container Management

### Management Scripts

The platform includes comprehensive management scripts in the `scripts/` directory:

#### Start Containers Script

```bash
./scripts/start-containers.sh [OPTIONS]

Options:
  -e, --environment ENV       Environment (development|production)
  -f, --compose-file FILE     Docker Compose file
  -m, --monitoring            Include monitoring services
  -o, --optional              Include optional services (MinIO)
  -t, --timeout SECONDS       Health check timeout
  --dry-run                   Show what would be done

Examples:
  # Development with monitoring
  ./scripts/start-containers.sh -e development -m
  
  # Production deployment
  ./scripts/start-containers.sh -e production -f docker-compose.prod.yml
  
  # Quick start with all services
  ./scripts/start-containers.sh -m -o
```

#### Stop Containers Script

```bash
./scripts/stop-containers.sh [OPTIONS]

Options:
  --force                     Force shutdown
  --cleanup-volumes          Remove volumes (DATA LOSS!)
  --cleanup-networks         Remove networks
  --backup                   Backup database before shutdown

Examples:
  # Graceful shutdown
  ./scripts/stop-containers.sh
  
  # Backup then shutdown
  ./scripts/stop-containers.sh --backup
  
  # Force shutdown with cleanup
  ./scripts/stop-containers.sh --force --cleanup-volumes
```

#### Resource Management Script

```bash
./scripts/manage-resources.sh [COMMAND] [OPTIONS]

Commands:
  scale SERVICE REPLICAS      Scale a service to N replicas
  auto-scale                  Enable automatic scaling
  monitor                     Real-time resource monitoring
  optimize                    Analyze and optimize resources
  stats                       Show current resource usage
  cleanup                     Clean up unused Docker resources

Examples:
  # Scale backend to 5 replicas
  ./scripts/manage-resources.sh scale backend 5
  
  # Enable auto-scaling
  ./scripts/manage-resources.sh auto-scale --max-replicas 10
  
  # Monitor resources
  ./scripts/manage-resources.sh monitor --interval 30
  
  # Clean up unused resources
  ./scripts/manage-resources.sh cleanup
```

#### Validation Script

```bash
./scripts/validate-docker-setup.sh [OPTIONS]

Options:
  --quick                     Quick validation
  --full                      Comprehensive testing
  --compose-file FILE         Test specific file
  --services SERVICES         Test specific services

Examples:
  # Quick validation
  ./scripts/validate-docker-setup.sh --quick
  
  # Full validation with load testing
  ./scripts/validate-docker-setup.sh --full
  
  # Validate specific configuration
  ./scripts/validate-docker-setup.sh --compose-file docker-compose.dev.yml
```

### Manual Container Operations

#### Basic Operations

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs --tail=100 database

# Execute commands in containers
docker-compose exec backend bash
docker-compose exec database psql -U postgres

# Restart services
docker-compose restart backend
docker-compose restart
```

#### Health Checks

```bash
# Check health status
docker-compose ps

# Detailed health information
docker inspect $(docker-compose ps -q backend) --format='{{.State.Health}}'

# Test endpoints directly
curl -f http://localhost:3000/health
curl -f http://localhost:80/health
```

#### Resource Monitoring

```bash
# Real-time resource usage
docker stats

# Container resource limits
docker inspect $(docker-compose ps -q backend) --format='{{.HostConfig.Memory}}'

# Disk usage
docker system df
docker volume ls
```

## Monitoring & Observability

### Metrics Collection

The platform provides comprehensive metrics collection through Prometheus:

#### Application Metrics
- API request rates and response times
- Video processing job statistics
- Database connection pool usage
- Redis cache hit rates

#### System Metrics
- CPU, memory, and disk usage
- Network traffic and connections
- Container resource utilization
- Docker daemon metrics

#### Business Metrics
- User registration and activity
- Video processing success rates
- Storage usage and costs
- Feature usage statistics

### Dashboards

Grafana provides pre-configured dashboards:

#### System Overview Dashboard
- Infrastructure health at a glance
- Resource utilization trends
- Service availability status
- Alert summaries

#### Application Performance Dashboard
- API performance metrics
- Database query performance
- Cache effectiveness
- User experience metrics

#### Video Processing Dashboard
- Job queue statistics
- Processing times and success rates
- Resource usage during processing
- Error rates and types

### Alerting

Configure alerts for critical conditions:

```yaml
# Example alert rules in Prometheus
groups:
- name: video-platform-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    annotations:
      summary: High error rate detected
      
  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 1m
    annotations:
      summary: Database is down
```

### Log Management

#### Development Logging
```bash
# View all logs
docker-compose logs -f

# Filter by service
docker-compose logs -f backend

# Search logs
docker-compose logs backend | grep ERROR

# Follow new logs only
docker-compose logs -f --tail=0 backend
```

#### Production Logging

In production, logs are centralized using Loki and Promtail:

- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Log Rotation**: Automatic cleanup of old logs
- **Search and Filtering**: Full-text search capabilities

## Security

### Container Security

#### Non-Root Containers
All services run as non-root users:

```dockerfile
# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Switch to non-root user
USER appuser
```

#### Security Scanning
```bash
# Scan images for vulnerabilities
docker scout quickview
docker scout cves --only-severity critical,high

# Security validation
./scripts/validate-docker-setup.sh --full
```

#### Network Security
- **Network Isolation**: Separate internal/external networks
- **Port Exposure**: Minimal external port exposure
- **Service Discovery**: Internal DNS resolution
- **Firewall Rules**: Container-level access controls

### Secrets Management

#### Environment Variables
```bash
# Sensitive data via environment
JWT_SECRET=your-secret-key
DB_PASSWORD=your-db-password
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

#### Docker Secrets (Swarm)
```bash
# Create secrets
echo "my-secret-password" | docker secret create db_password -

# Use in compose file
secrets:
  - db_password
```

#### External Secret Managers
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Kubernetes Secrets

### SSL/TLS Configuration

#### Development SSL
```bash
# Generate self-signed certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

#### Production SSL (Traefik + Let's Encrypt)
```yaml
# Automatic SSL certificates
labels:
  - "traefik.http.routers.frontend.rule=Host(`yourdomain.com`)"
  - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
```

## Scaling & Performance

### Horizontal Scaling

#### Automatic Scaling
```bash
# Enable auto-scaling based on CPU/memory
./scripts/manage-resources.sh auto-scale \
  --max-replicas 10 \
  --cpu-threshold 70 \
  --memory-threshold 80

# Monitor scaling decisions
./scripts/manage-resources.sh monitor --interval 10
```

#### Manual Scaling
```bash
# Scale individual services
./scripts/manage-resources.sh scale backend 5
./scripts/manage-resources.sh scale frontend 3

# Using docker-compose
docker-compose up -d --scale backend=5 --scale frontend=3
```

### Performance Optimization

#### Database Optimization
```sql
-- Connection pooling
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB

-- Query optimization
CREATE INDEX CONCURRENTLY idx_jobs_status ON jobs(status);
CREATE INDEX CONCURRENTLY idx_jobs_created_at ON jobs(created_at);
```

#### Redis Optimization
```conf
# Memory optimization
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
```

#### Application Optimization
```javascript
// Connection pooling
const pool = new Pool({
  host: 'database',
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000
});

// Caching
const cached = await redis.get(`video:${id}`);
if (cached) return JSON.parse(cached);
```

### Load Testing

```bash
# API load testing with Apache Bench
ab -n 1000 -c 10 http://localhost:3000/health

# Video processing load test
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/v1/videocreate \
    -H "Content-Type: application/json" \
    -d @test-video-request.json &
done
```

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check container status
docker-compose ps

# View startup logs
docker-compose logs backend

# Check resource limits
docker stats

# Verify configuration
docker-compose config

# Test health check
curl -f http://localhost:3000/health
```

#### Out of Memory

```bash
# Check memory usage
docker stats
free -h

# Scale down services
./scripts/manage-resources.sh scale backend 1

# Clean up unused resources
./scripts/manage-resources.sh cleanup
docker system prune -f
```

#### Database Connection Issues

```bash
# Test database connectivity
docker-compose exec backend ping database

# Check database status
docker-compose exec database pg_isready -U postgres

# View database logs
docker-compose logs database

# Manual connection test
docker-compose exec database psql -U postgres -c "SELECT 1;"
```

#### Performance Issues

```bash
# Check resource usage
./scripts/manage-resources.sh stats

# Monitor in real-time
./scripts/manage-resources.sh monitor

# Generate performance report
./scripts/manage-resources.sh report

# Optimize configuration
./scripts/manage-resources.sh optimize
```

### Debugging

#### Enable Debug Mode

```bash
# Development debugging
docker-compose -f docker-compose.dev.yml up backend
# Debug port: localhost:9229

# Production debugging (careful!)
docker-compose -f docker-compose.yml build --target debug backend
```

#### Container Shell Access

```bash
# Backend container
docker-compose exec backend bash

# Database queries
docker-compose exec database psql -U postgres -d video_generation

# Redis CLI
docker-compose exec redis redis-cli
```

#### Log Analysis

```bash
# Search for errors
docker-compose logs backend | grep -i error

# Filter by timestamp
docker-compose logs --since 1h backend

# Follow logs in real-time
docker-compose logs -f --tail=100 backend

# Export logs
docker-compose logs > platform-logs.txt
```

## Best Practices

### Development

1. **Use Development Compose File**
   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

2. **Volume Mounts for Source Code**
   ```yaml
   volumes:
     - ./backend/src:/app/src
     - ./frontend/src:/app/src
   ```

3. **Environment Separation**
   ```bash
   # Different .env files
   .env.development
   .env.staging  
   .env.production
   ```

4. **Health Check Everything**
   ```yaml
   healthcheck:
     test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
     interval: 30s
     timeout: 10s
     retries: 3
   ```

### Production

1. **Resource Limits**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2.0'
         memory: 1G
       reservations:
         cpus: '0.5'
         memory: 512M
   ```

2. **Security Hardening**
   ```yaml
   # Non-root users
   USER appuser
   
   # Read-only root filesystem
   read_only: true
   ```

3. **Backup Strategy**
   ```bash
   # Automated database backups
   ./scripts/stop-containers.sh --backup
   
   # External backup storage
   aws s3 sync ./backups/ s3://your-backup-bucket/
   ```

4. **Monitoring**
   ```bash
   # Always enable monitoring in production
   docker-compose -f docker-compose.prod.yml --profile monitoring up -d
   ```

### Performance

1. **Multi-Stage Builds**
   ```dockerfile
   FROM node:18-alpine AS builder
   # Build stage
   
   FROM node:18-alpine AS runtime
   # Optimized runtime
   ```

2. **Layer Optimization**
   ```dockerfile
   # Copy package files first for better caching
   COPY package*.json ./
   RUN npm ci --only=production
   
   # Copy source code last
   COPY . .
   ```

3. **Resource Monitoring**
   ```bash
   # Regular resource checks
   ./scripts/manage-resources.sh stats
   
   # Auto-scaling setup
   ./scripts/manage-resources.sh auto-scale
   ```

## Examples

### Complete Development Setup

```bash
#!/bin/bash
# Development setup script

# Clone and setup
git clone <repository-url>
cd video-generation-platform

# Configure environment
cp .env.example .env
sed -i 's/NODE_ENV=production/NODE_ENV=development/' .env
sed -i 's/DB_PASSWORD=.*/DB_PASSWORD=devpassword/' .env

# Start development stack
./scripts/start-containers.sh -e development -m -o

# Verify setup
sleep 30
curl http://localhost:3000/health
curl http://localhost:5173

echo "Development environment ready!"
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:3000"
echo "Grafana: http://localhost:3001 (admin/admin)"
```

### Production Deployment

```bash
#!/bin/bash
# Production deployment script

# Environment setup
export DOMAIN="yourdomain.com"
export ACME_EMAIL="admin@yourdomain.com"

# Configure production environment
cp .env.example .env
# Set production values...

# Deploy production stack
./scripts/start-containers.sh -e production -f docker-compose.prod.yml -m

# Wait for services to be ready
sleep 60

# Validate deployment
./scripts/validate-docker-setup.sh --quick

# Enable auto-scaling
./scripts/manage-resources.sh auto-scale --max-replicas 10

# Set up monitoring alerts
# Configure Grafana dashboards
# Set up backup schedule

echo "Production deployment complete!"
echo "Frontend: https://$DOMAIN"
echo "Monitoring: https://grafana.$DOMAIN"
```

### Backup and Recovery

```bash
#!/bin/bash
# Backup script

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Database backup
docker-compose exec -T database pg_dumpall -U postgres > "$BACKUP_DIR/database.sql"

# Redis backup
docker-compose exec -T redis redis-cli BGSAVE
docker cp $(docker-compose ps -q redis):/data/dump.rdb "$BACKUP_DIR/redis.rdb"

# Configuration backup
cp .env "$BACKUP_DIR/"
cp -r ./monitoring/grafana/dashboards "$BACKUP_DIR/"

# Upload to S3
aws s3 sync "$BACKUP_DIR" s3://your-backup-bucket/backups/$(basename "$BACKUP_DIR")

echo "Backup completed: $BACKUP_DIR"
```

### Health Check Script

```bash
#!/bin/bash
# Health check monitoring

SERVICES=("backend" "frontend" "database" "redis")
FAILED_SERVICES=()

for service in "${SERVICES[@]}"; do
    if ! docker-compose ps "$service" | grep -q "Up"; then
        FAILED_SERVICES+=("$service")
    fi
done

if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
    echo "✅ All services healthy"
    exit 0
else
    echo "❌ Failed services: ${FAILED_SERVICES[*]}"
    
    # Auto-recovery attempt
    for service in "${FAILED_SERVICES[@]}"; do
        echo "Attempting to restart $service..."
        docker-compose restart "$service"
    done
    
    exit 1
fi
```

---

## Support

For additional help and support:

1. **Documentation**: Check the `/docs` directory for detailed guides
2. **Validation**: Run `./scripts/validate-docker-setup.sh --full` for comprehensive testing
3. **Monitoring**: Use Grafana dashboards for real-time insights
4. **Logs**: Check container logs with `docker-compose logs [service]`
5. **Community**: Join our community discussions and contribute improvements

## Contributing

When contributing to the Docker setup:

1. Test with both development and production configurations
2. Update documentation for any new features
3. Ensure security best practices are followed
4. Run the validation script before submitting changes
5. Update the CHANGELOG.md with your changes

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Compatibility**: Docker 20.10+, Docker Compose 2.0+