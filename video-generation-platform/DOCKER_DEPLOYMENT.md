# Docker Deployment Guide - Video Generation Platform

## Overview

This document provides comprehensive guidance for deploying the Video Generation Platform using Docker containers with multi-service orchestration, networking, and production-ready configuration.

## Architecture

The platform consists of the following containerized services:

### Core Services
- **Backend API** - Node.js/Express REST API server
- **Frontend** - React/Vite application served via Nginx
- **Orchestrator** - Advanced workflow management service
- **Database** - PostgreSQL database with optimized configuration
- **Redis** - Job queuing and caching layer

### Monitoring Services
- **Prometheus** - Metrics collection and monitoring
- **Grafana** - Visualization and dashboards
- **Node Exporter** - System metrics collection
- **cAdvisor** - Container metrics collection

### Optional Services
- **MinIO** - S3-compatible storage for development
- **Traefik** - Load balancer and SSL termination (production)
- **Loki/Promtail** - Log aggregation (production)

## Docker Configurations

### Available Docker Compose Files

1. **docker-compose.yml** - Main configuration (production-ready)
2. **docker-compose.dev.yml** - Development environment with hot reload
3. **docker-compose.prod.yml** - Production environment with full monitoring

### Multi-Stage Dockerfiles

Each service uses optimized multi-stage builds:

#### Backend Dockerfile Stages
- `base` - System dependencies and common setup
- `dev-deps` - Development dependencies
- `prod-deps` - Production dependencies only  
- `builder` - TypeScript compilation
- `tester` - Test execution (optional)
- `runtime` - Optimized production runtime
- `debug` - Debug-enabled runtime

#### Frontend Dockerfile Stages
- `base` - Node.js and system dependencies
- `dev-deps` - Development dependencies
- `builder` - Vite build process
- `runtime` - Nginx production server
- `development` - Hot reload development server
- `debug` - Debug-enabled server

#### Orchestrator Dockerfile Stages
- `base` - Common dependencies
- `builder` - Build stage
- `runtime` - Production runtime
- `development` - Development with hot reload
- `debug` - Debug mode
- `monitoring` - With additional monitoring tools

## Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available
- 10GB+ disk space

### Development Environment

```bash
# Clone and setup
git clone <repository>
cd video-generation-platform

# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env

# Start development environment
./scripts/start-containers.sh -e development -m -o

# Or using Docker Compose directly
docker-compose -f docker-compose.dev.yml up -d

# Access services
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
# Grafana: http://localhost:3001
```

### Production Environment

```bash
# Production deployment
./scripts/start-containers.sh -e production -f docker-compose.prod.yml -m

# Or using Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Verify deployment
docker-compose -f docker-compose.prod.yml ps
```

## Environment Configuration

### Required Environment Variables

Create a `.env` file from `.env.example` and configure:

#### Database Configuration
```env
DB_NAME=video_generation
DB_USER=postgres
DB_PASSWORD=your-secure-password
```

#### AWS S3 Configuration
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
```

#### Security Settings
```env
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
SESSION_SECRET=your-session-secret
REDIS_PASSWORD=your-redis-password
```

#### Service Configuration
```env
NODE_ENV=production
CORS_ORIGINS=https://yourdomain.com
IMMEDIATE_RESPONSE_THRESHOLD=30000
MAX_CONCURRENT_JOBS=10
```

### Environment-Specific Overrides

Different environments can use different configurations:

- **Development**: `docker-compose.dev.yml` - Hot reload, debugging enabled
- **Production**: `docker-compose.prod.yml` - Optimized, monitoring, security

## Container Management Scripts

### Start Containers Script

```bash
./scripts/start-containers.sh [OPTIONS]

Options:
  -e, --environment ENV       Environment (development|production)
  -f, --compose-file FILE     Docker Compose file
  -t, --timeout SECONDS       Health check timeout [default: 300]
  -m, --monitoring            Include monitoring services
  -o, --optional              Include optional services (MinIO)
  --dry-run                   Show what would be done
```

### Stop Containers Script

```bash
./scripts/stop-containers.sh [OPTIONS]

Options:
  --force                     Force shutdown without graceful termination
  --cleanup-volumes          Remove named volumes (WARNING: Data loss!)
  --cleanup-networks         Remove custom networks
  --backup                   Backup database before shutdown
```

### Resource Management Script

```bash
./scripts/manage-resources.sh [COMMAND] [OPTIONS]

Commands:
  scale SERVICE REPLICAS      Scale a service
  auto-scale                  Enable automatic scaling
  monitor                     Real-time resource monitoring
  optimize                    Optimize resource allocation
  stats                       Show resource statistics
  cleanup                     Clean up unused resources
```

## Service Scaling

### Manual Scaling

```bash
# Scale backend to 3 replicas
./scripts/manage-resources.sh scale backend 3

# Scale using docker-compose
docker-compose -f docker-compose.yml up -d --scale backend=3
```

### Auto-Scaling

```bash
# Enable auto-scaling with monitoring
./scripts/manage-resources.sh auto-scale --max-replicas 5 --cpu-threshold 80

# Monitor resources continuously
./scripts/manage-resources.sh monitor --interval 30
```

### Resource Limits

Configure in `.env` file:

```env
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

## Networking

### Network Architecture

```
Internet
    ↓
[Traefik] (Load Balancer/SSL)
    ↓
video-generation-external (Bridge Network)
    ↓
[Frontend] ←→ [Backend] ←→ [Orchestrator]
    ↓              ↓              ↓
video-generation-internal (Bridge Network)
    ↓              ↓              ↓
[Database] ←→ [Redis] ←→ [Monitoring]
```

### Service Discovery

Services communicate using internal DNS names:
- `backend:3000` - Backend API
- `database:5432` - PostgreSQL
- `redis:6379` - Redis cache
- `prometheus:9090` - Metrics

### Port Mapping

**Development:**
- Frontend: `5173` (Vite dev server)
- Backend: `3000` (API server)
- Database: `5432` (PostgreSQL)
- Redis: `6379`
- Grafana: `3001`

**Production:**
- Frontend: `80/443` (Nginx)
- Backend: `127.0.0.1:3000` (Internal only)
- Services: Internal networking only

## Persistent Storage

### Volume Configuration

```yaml
volumes:
  redis-data:              # Redis persistence
  postgres-data:           # Database data
  postgres-backups:        # Database backups
  prometheus-data:         # Metrics data
  grafana-data:           # Dashboard data
  backend-logs:           # Application logs
  backend-uploads:        # File uploads
```

### Backup Strategy

```bash
# Manual backup
./scripts/stop-containers.sh --backup

# Automated backups (production)
# Configured via environment variables:
BACKUP_SCHEDULE=@daily
BACKUP_KEEP_DAYS=7
BACKUP_KEEP_WEEKS=4
```

## Monitoring and Observability

### Prometheus Metrics

Access metrics at `http://localhost:9090`

Available metrics:
- System resource usage
- Container performance
- Application-specific metrics
- Custom business metrics

### Grafana Dashboards

Access dashboards at `http://localhost:3001`

Pre-configured dashboards:
- System Overview
- Container Metrics
- Application Performance
- Video Processing Stats

### Log Aggregation

**Development:**
```bash
# View logs
docker-compose logs -f backend

# Follow specific service
docker-compose logs -f --tail=100 backend
```

**Production:**
- Centralized logging with Loki
- Log shipping via Promtail
- Structured JSON logging

### Health Checks

All services include comprehensive health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 15s
  retries: 5
  start_period: 60s
```

## Security

### Container Security

1. **Non-root Users**: All containers run as non-root users
2. **Read-only Filesystems**: Where possible
3. **Security Contexts**: Proper user/group settings
4. **Secrets Management**: Via environment variables
5. **Network Isolation**: Internal/external network separation

### Production Security

```yaml
# Secure headers
- "traefik.http.middlewares.secure-headers.headers.forcestsheader=true"
- "traefik.http.middlewares.secure-headers.headers.sslredirect=true"

# Authentication
- "traefik.http.routers.api.middlewares=auth"
- "traefik.http.middlewares.auth.basicauth.users=${TRAEFIK_AUTH}"
```

### SSL/TLS Configuration

```env
# Domain and SSL
DOMAIN=yourdomain.com
ACME_EMAIL=admin@yourdomain.com

# Let's Encrypt automatic certificates
TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_EMAIL=${ACME_EMAIL}
```

## Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs service-name

# Check health status
docker-compose ps

# Verify configuration
docker-compose config
```

#### Out of Memory
```bash
# Check resource usage
docker stats

# Scale down services
./scripts/manage-resources.sh scale backend 1

# Clean up resources
./scripts/manage-resources.sh cleanup
```

#### Database Connection Issues
```bash
# Test database connectivity
docker-compose exec backend psql $DATABASE_URL

# Check database health
docker-compose exec database pg_isready

# Restart database
docker-compose restart database
```

### Debugging

#### Enable Debug Mode
```bash
# Build debug image
docker-compose -f docker-compose.dev.yml build --target debug backend

# Run with debugging
docker-compose -f docker-compose.dev.yml up backend
```

#### Access Container Shell
```bash
# Backend container
docker-compose exec backend bash

# Database container
docker-compose exec database psql -U postgres
```

### Performance Issues

#### Resource Monitoring
```bash
# Real-time monitoring
./scripts/manage-resources.sh monitor

# Resource statistics
./scripts/manage-resources.sh stats

# Generate report
./scripts/manage-resources.sh report
```

#### Optimization
```bash
# Analyze and optimize
./scripts/manage-resources.sh optimize

# Clean up unused resources
docker system prune -f
docker volume prune -f
```

## Production Deployment

### Infrastructure Requirements

**Minimum Production Setup:**
- 4 CPU cores
- 8GB RAM
- 50GB SSD storage
- Load balancer with SSL termination

**Recommended Production Setup:**
- 8+ CPU cores
- 16GB+ RAM
- 100GB+ SSD storage
- CDN for static assets
- External database (RDS/CloudSQL)
- External Redis (ElastiCache/MemoryStore)

### Deployment Checklist

1. **Environment Setup**
   - [ ] Configure production `.env` file
   - [ ] Set up external services (S3, Database, Redis)
   - [ ] Configure domain and SSL certificates

2. **Security Configuration**
   - [ ] Change all default passwords
   - [ ] Configure JWT secrets
   - [ ] Set up proper CORS origins
   - [ ] Enable rate limiting

3. **Monitoring Setup**
   - [ ] Configure Prometheus retention
   - [ ] Set up Grafana dashboards
   - [ ] Configure alerting
   - [ ] Set up log aggregation

4. **Scaling Configuration**
   - [ ] Set resource limits
   - [ ] Configure auto-scaling parameters
   - [ ] Test scaling scenarios

5. **Backup Strategy**
   - [ ] Configure automated backups
   - [ ] Test backup restoration
   - [ ] Set up off-site backup storage

### Deployment Commands

```bash
# Production deployment
git clone <repository>
cd video-generation-platform

# Configure environment
cp .env.example .env
# Edit .env with production values

# Deploy with monitoring
./scripts/start-containers.sh \
  -e production \
  -f docker-compose.prod.yml \
  -m -o

# Verify deployment
docker-compose -f docker-compose.prod.yml ps
curl -f http://localhost/health

# Enable monitoring
docker-compose -f docker-compose.prod.yml \
  --profile monitoring up -d

# Set up auto-scaling
./scripts/manage-resources.sh auto-scale \
  --max-replicas 5 \
  --cpu-threshold 70
```

### CI/CD Integration

#### GitHub Actions Example
```yaml
name: Deploy Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        run: |
          docker-compose -f docker-compose.prod.yml pull
          ./scripts/start-containers.sh -e production -f docker-compose.prod.yml
          
      - name: Health check
        run: |
          sleep 60
          curl -f http://localhost/health
```

### Maintenance

#### Regular Maintenance Tasks
```bash
# Weekly: Clean up unused resources
docker system prune -f
./scripts/manage-resources.sh cleanup

# Monthly: Update images
docker-compose pull
docker-compose up -d

# Daily: Check resource usage
./scripts/manage-resources.sh stats

# Monitor logs for errors
docker-compose logs --since 1h | grep ERROR
```

#### Updates and Rollbacks
```bash
# Update to new version
docker-compose pull
docker-compose up -d

# Rollback if needed
docker-compose down
docker-compose up -d --scale backend=1
# Test and gradually scale up
```

## Best Practices

### Development
1. Use `docker-compose.dev.yml` for development
2. Enable hot reload for faster development
3. Use volume mounts for source code
4. Keep container logs accessible

### Production
1. Use multi-stage builds for smaller images
2. Run containers as non-root users
3. Implement comprehensive health checks
4. Use secrets management
5. Monitor resource usage continuously
6. Implement automated backups
7. Use SSL/TLS for all communications

### Performance
1. Set appropriate resource limits
2. Use Redis for caching
3. Implement connection pooling
4. Optimize database queries
5. Use CDN for static assets
6. Enable gzip compression

### Security
1. Regular security updates
2. Network segmentation
3. Principle of least privilege
4. Secrets rotation
5. Security scanning of images
6. Regular backups and disaster recovery testing

## Support and Documentation

### Additional Resources
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Production Best Practices](https://docs.docker.com/develop/dev-best-practices/)

### Getting Help
1. Check container logs: `docker-compose logs [service]`
2. Verify health status: `docker-compose ps`
3. Test connectivity: `docker-compose exec [service] ping [target]`
4. Resource usage: `docker stats`

### Contribution
When contributing Docker-related changes:
1. Test with both development and production configurations
2. Update documentation
3. Verify security implications
4. Test scaling scenarios
5. Update environment variable examples

## Changelog

### v1.0.0 - Initial Release
- Multi-service Docker Compose setup
- Development and production configurations
- Container management scripts
- Auto-scaling capabilities
- Comprehensive monitoring
- Production security hardening