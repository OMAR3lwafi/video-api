# Video Orchestrator Service

Intelligent orchestrator service for the Dynamic Video Content Generation Platform with advanced workflow management, resource optimization, and AI-driven load balancing.

## Overview

The Video Orchestrator Service is the central coordination system that manages video processing workflows, resource allocation, load balancing, and system health across the entire video generation platform. It provides intelligent job analysis, predictive resource management, and resilient operation patterns.

## Key Features

### 🧠 Intelligent Orchestration
- **AI-Driven Job Analysis**: Automatic complexity assessment and resource requirement prediction
- **Dual Response System**: Immediate processing (≤30s) vs async processing (>30s)
- **Smart Strategy Selection**: Automatic workflow template selection based on job characteristics

### 🔄 Advanced Workflow Engine
- **Multiple Templates**: Quick sync, balanced async, resource-intensive, and distributed processing
- **Parallel Execution**: Steps can run in parallel where possible
- **Automatic Retry**: Configurable retry policies with exponential backoff
- **Rollback Support**: Automatic cleanup and rollback on failures

### ⚖️ Intelligent Load Balancing
- **Multiple Strategies**: Round robin, weighted, least connections, AI-driven, performance-based
- **Service Discovery**: Automatic service registration and health monitoring
- **Performance Metrics**: Real-time tracking of service performance and capacity

### 📊 Resource Management
- **Predictive Allocation**: ML-driven resource requirement prediction
- **Auto-scaling**: Dynamic resource scaling based on demand
- **Optimization Engine**: Continuous resource usage optimization
- **Multi-node Support**: Distributed resource allocation across cluster nodes

### 🛡️ Resilience & Recovery
- **Circuit Breakers**: Prevent cascade failures with configurable thresholds
- **Retry Mechanisms**: Intelligent retry with backoff strategies
- **Failover Support**: Automatic failover to backup services
- **Health Monitoring**: Comprehensive health checks and recovery procedures

### 📈 Analytics & Monitoring
- **Performance Analytics**: System-wide performance analysis and insights
- **Predictive Analytics**: Demand forecasting and capacity planning
- **Real-time Metrics**: Live system metrics and alerting
- **Optimization Recommendations**: AI-generated optimization suggestions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Master Orchestrator                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Workflow   │  │  Resource   │  │    Load Balancer    │  │
│  │   Engine    │  │  Manager    │  │     Manager         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Health    │  │ Analytics   │  │     Event Bus       │  │
│  │   Monitor   │  │   Engine    │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │Configuration│  │ Resilience  │                           │
│  │   Manager   │  │   Manager   │                           │
│  └─────────────┘  └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- FFmpeg

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd orchestrator

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start dependencies with Docker Compose
docker-compose up -d redis postgres prometheus grafana

# Run database migrations
npm run migrate

# Start in development mode
npm run dev
```

### Docker Development

```bash
# Start all services
docker-compose up --build

# View logs
docker-compose logs -f orchestrator-master

# Scale workers
docker-compose up --scale orchestrator-worker=3
```

### Production Deployment

```bash
# Build production image
docker build -t video-orchestrator:latest .

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Or deploy to Kubernetes
kubectl apply -f k8s/
```

## Configuration

The orchestrator uses a hierarchical configuration system:

1. Default configuration (in code)
2. Configuration file (`config/orchestrator.json`)
3. Environment variables (highest priority)

### Key Environment Variables

```bash
# Server Configuration
PORT=9000
NODE_ENV=production
LOG_LEVEL=info

# Orchestration Settings
MAX_CONCURRENT_JOBS=50
DEFAULT_TIMEOUT=300000
LOAD_BALANCING_STRATEGY=ai_driven

# Database Configuration
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://redis:6379

# AWS Configuration
AWS_REGION=us-east-1
S3_BUCKET=video-results

# Feature Flags
AUTO_SCALING_ENABLED=true
CIRCUIT_BREAKER_ENABLED=true
ANALYTICS_ENABLED=true
PREDICTION_ENABLED=true
```

### Configuration File Structure

```json
{
  "orchestration": {
    "maxConcurrentJobs": 50,
    "defaultTimeout": 300000,
    "priorityWeights": {
      "low": 1,
      "normal": 2,
      "high": 3,
      "critical": 4
    }
  },
  "loadBalancing": {
    "strategy": "ai_driven",
    "healthCheckInterval": 30000,
    "failoverThreshold": 0.8
  },
  "resources": {
    "autoScalingEnabled": true,
    "resourceReservationTimeout": 30000,
    "optimizationInterval": 300000
  },
  "resilience": {
    "circuitBreakerEnabled": true,
    "retryEnabled": true,
    "failoverEnabled": true
  }
}
```

## API Documentation

### Core Endpoints

#### POST /api/v1/orchestrate
Orchestrate a video processing job.

**Request:**
```json
{
  "id": "job_12345",
  "output_format": "mp4",
  "width": 1920,
  "height": 1080,
  "elements": [
    {
      "id": "element_1",
      "type": "video",
      "source": "https://example.com/video.mp4",
      "track": 1,
      "x": "0%",
      "y": "0%",
      "width": "100%",
      "height": "100%"
    }
  ],
  "priority": "normal"
}
```

**Response (Immediate):**
```json
{
  "jobId": "job_12345",
  "orchestrationId": "orch_1234567890",
  "status": "immediate",
  "result_url": "https://s3.amazonaws.com/bucket/result.mp4",
  "processing_time": "25000ms",
  "file_size": "50MB",
  "message": "Job completed successfully"
}
```

**Response (Async):**
```json
{
  "jobId": "job_12345",
  "orchestrationId": "orch_1234567890",
  "status": "queued",
  "message": "Job queued for processing",
  "estimated_completion": "2023-12-01T10:30:00Z",
  "workflow_id": "wf_1234567890",
  "resource_allocation_id": "res_1234567890"
}
```

#### GET /api/v1/jobs/{jobId}/status
Get job processing status.

**Response:**
```json
{
  "status": "processing",
  "job_id": "job_12345",
  "progress": "75%",
  "current_step": "video_processing",
  "message": "Processing video elements",
  "estimated_completion": "2023-12-01T10:30:00Z"
}
```

#### GET /api/v1/analytics
Get system analytics and performance metrics.

**Response:**
```json
{
  "timestamp": "2023-12-01T10:00:00Z",
  "period": "10 minutes",
  "performanceMetrics": {
    "totalJobs": 150,
    "successfulJobs": 145,
    "failedJobs": 5,
    "averageProcessingTime": 45000,
    "throughput": 15,
    "resourceEfficiency": 0.85
  },
  "predictions": {
    "demandForecast": {
      "period": "next 30 days",
      "predictedJobCount": 4500,
      "confidence": 0.85
    }
  },
  "recommendations": [
    {
      "type": "resource_optimization",
      "priority": "high",
      "title": "Optimize CPU allocation",
      "expectedImpact": "Reduce costs by 15-20%"
    }
  ]
}
```

### Management Endpoints

- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /api/v1/config` - Get configuration
- `PUT /api/v1/config` - Update configuration
- `GET /api/v1/services` - List registered services
- `GET /api/v1/workflows` - List active workflows
- `GET /api/v1/resources` - Get resource utilization

## Workflow Templates

### Quick Sync (≤30 seconds)
- **Use Case**: Simple jobs with minimal processing
- **Steps**: Validate → Allocate → Download → Process → Upload → Update → Cleanup
- **Timeout**: 60 seconds total
- **Retry**: 1 attempt with 1s backoff

### Balanced Async (≤15 minutes)
- **Use Case**: Moderate complexity jobs
- **Steps**: Validate → Create Record → Queue → Allocate → Download → Analyze → Process → QA → Upload → Update → Notify → Cleanup
- **Timeout**: 15 minutes total
- **Retry**: 3 attempts with exponential backoff

### Resource Intensive (≤45 minutes)
- **Use Case**: Complex jobs requiring significant resources
- **Features**: GPU support, high-performance storage, advanced effects
- **Timeout**: 45 minutes total
- **Retry**: 2 attempts with extended backoff

### Distributed (≤90 minutes)
- **Use Case**: Enterprise-scale jobs
- **Features**: Kubernetes cluster, distributed processing, result merging
- **Timeout**: 90 minutes total
- **Retry**: 2 attempts with intelligent partitioning

## Load Balancing Strategies

### Round Robin
Simple sequential selection of services.

### Weighted
Selection based on service capacity and current load.

### Least Connections
Routes to service with fewest active connections.

### Performance Based
Routes based on historical performance metrics and current resource utilization.

### AI Driven
Uses machine learning models to predict optimal service selection based on:
- Job characteristics
- Service performance history
- Current system state
- Resource requirements

## Monitoring & Observability

### Metrics Collection
- **Prometheus**: System and application metrics
- **Grafana**: Real-time dashboards and alerting
- **Custom Metrics**: Job processing, resource utilization, performance

### Logging
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: Debug, Info, Warn, Error, Fatal
- **Log Rotation**: Daily rotation with retention policies
- **Centralized**: ELK stack integration support

### Tracing
- **Distributed Tracing**: Jaeger integration
- **Request Correlation**: End-to-end request tracking
- **Performance Profiling**: Operation timing and bottleneck identification

### Health Checks
- **System Resources**: CPU, memory, disk, network
- **External Services**: Database, Redis, S3
- **Processing Services**: FFmpeg, worker availability
- **Circuit Breakers**: Service availability and failure rates

## Development

### Project Structure
```
orchestrator/
├── src/
│   ├── core/                 # Core orchestrator logic
│   │   └── MasterOrchestrator.ts
│   ├── services/             # Service components
│   │   ├── WorkflowEngine.ts
│   │   ├── ResourceManager.ts
│   │   ├── LoadBalancerManager.ts
│   │   ├── HealthCheckEngine.ts
│   │   ├── AnalyticsEngine.ts
│   │   ├── EventBus.ts
│   │   ├── ConfigurationManager.ts
│   │   └── ResilienceManager.ts
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/                # Utility functions
│   │   └── Logger.ts
│   └── index.ts              # Main entry point
├── tests/                    # Test files
├── config/                   # Configuration files
├── monitoring/               # Monitoring configs
├── k8s/                      # Kubernetes manifests
├── docker-compose.yml        # Docker development
└── Dockerfile               # Container build
```

### Scripts
```bash
# Development
npm run dev              # Start development server
npm run build           # Build TypeScript
npm run test            # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix linting issues
npm run format          # Format code with Prettier

# Docker
npm run docker:build    # Build Docker image
npm run docker:run      # Run Docker container
npm run health-check    # Check service health
```

### Testing Strategy
- **Unit Tests**: Individual components and functions
- **Integration Tests**: API endpoints and service interactions
- **End-to-End Tests**: Complete workflow execution
- **Performance Tests**: Load testing and benchmarking
- **Chaos Testing**: Resilience and recovery testing

### Code Quality
- **TypeScript**: Strict mode with comprehensive type checking
- **ESLint**: Code linting with custom rules
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks
- **Conventional Commits**: Standardized commit messages

## Deployment

### Local Development
Use Docker Compose for local development with all dependencies.

### Staging Environment
Kubernetes deployment with horizontal pod autoscaling and resource limits.

### Production Environment
- **High Availability**: Multiple replicas with load balancing
- **Auto-scaling**: Based on CPU/memory usage and job queue length
- **Monitoring**: Comprehensive metrics and alerting
- **Security**: Network policies, secrets management, RBAC

### Kubernetes Manifests
```yaml
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orchestrator-master
spec:
  replicas: 3
  selector:
    matchLabels:
      app: orchestrator-master
  template:
    spec:
      containers:
      - name: orchestrator
        image: videogen/orchestrator:latest
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
```

## Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check memory metrics
curl http://localhost:9000/api/v1/resources

# Restart with increased memory limit
docker-compose up --scale orchestrator-master=0
docker-compose up --scale orchestrator-master=1
```

#### Circuit Breaker Open
```bash
# Check circuit breaker status
curl http://localhost:9000/api/v1/health

# Reset circuit breaker
curl -X POST http://localhost:9000/api/v1/circuit-breaker/reset
```

#### Job Processing Delays
```bash
# Check job queue
curl http://localhost:9000/api/v1/analytics

# Scale workers
docker-compose up --scale orchestrator-worker=5
```

### Logs Analysis
```bash
# View real-time logs
docker-compose logs -f orchestrator-master

# Search for errors
docker-compose logs orchestrator-master | grep ERROR

# Filter by correlation ID
docker-compose logs orchestrator-master | grep "correlation_id_123"
```

### Performance Debugging
- Check resource utilization metrics
- Analyze workflow execution times
- Review load balancing distribution
- Examine circuit breaker states

## Security

### Authentication & Authorization
- API key authentication
- Role-based access control
- Service-to-service authentication

### Data Protection
- Encryption at rest and in transit
- Secure credential management
- Network security policies

### Compliance
- Audit logging
- Data retention policies
- GDPR compliance features

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Follow conventional commit format
- Ensure all CI checks pass

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [Internal Wiki](https://wiki.company.com/orchestrator)
- **Issues**: [GitHub Issues](https://github.com/company/video-platform/issues)
- **Slack**: #video-platform-support
- **Email**: video-platform-team@company.com

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

## Roadmap

- [ ] Machine Learning model integration for better job analysis
- [ ] Advanced caching strategies
- [ ] Multi-region deployment support
- [ ] Real-time collaboration features
- [ ] Enhanced security features
- [ ] Performance optimization improvements

---

Built with ❤️ by the Video Platform Team