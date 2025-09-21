# Dynamic Video Content Generation Platform - Backend API

A production-ready Express.js backend with TypeScript for the Dynamic Video Content Generation Platform, featuring comprehensive middleware, error handling, logging, and API structure.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Docker (optional, for containerized development)
- Supabase account and project
- AWS S3 bucket and credentials

### Local Development Setup

1. **Clone and install dependencies:**
```bash
cd backend
npm install
```

2. **Environment configuration:**
```bash
cp env.example .env
# Edit .env with your configuration values
```

3. **Start development server:**
```bash
npm run dev
```

The server will start on `http://localhost:3000` with hot reloading enabled.

### Docker Development

```bash
# Build and run with docker-compose
docker-compose up --build

# Or build and run individually
docker build -t video-generation-backend .
docker run -p 3000:3000 --env-file .env video-generation-backend
```

## 📋 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `AWS_S3_BUCKET` | AWS S3 bucket name | `my-video-bucket` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `AWS_REGION` | `us-east-1` | AWS region |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `LOG_LEVEL` | `info` | Logging level |
| `LOG_FORMAT` | `json` | Log format (json/simple) |

## 🛠 API Documentation

### Health Check Endpoints

- `GET /health` - Basic health check
- `GET /api/v1/health` - Detailed health check
- `GET /api/v1/health/ready` - Readiness probe (K8s)
- `GET /api/v1/health/live` - Liveness probe (K8s)

### Video Processing Endpoints

- `POST /api/v1/video/create` - Create video processing job
- `GET /api/v1/video/result/:jobId` - Get job status
- `DELETE /api/v1/video/job/:jobId` - Cancel job
- `GET /api/v1/video/jobs` - List jobs (with pagination)

### Request/Response Examples

#### Create Video Job
```bash
curl -X POST http://localhost:3000/api/v1/video/create \
  -H "Content-Type: application/json" \
  -d '{
    "output_format": "mp4",
    "width": 1920,
    "height": 1080,
    "elements": [
      {
        "id": "bg-video",
        "type": "video",
        "source": "https://example.com/background.mp4",
        "track": 0,
        "fit_mode": "cover"
      }
    ]
  }'
```

#### Immediate Response (≤30s processing)
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "processing_time": "15.2s",
    "result_url": "https://s3.amazonaws.com/bucket/videos/job_123.mp4",
    "job_id": "job_123",
    "file_size": "2.5MB",
    "message": "Video processing completed successfully"
  }
}
```

#### Async Response (>30s processing)
```json
{
  "success": true,
  "data": {
    "status": "processing",
    "job_id": "job_456",
    "message": "Video processing started",
    "estimated_completion": "2024-01-01T12:30:00Z",
    "status_check_endpoint": "/api/v1/video/result/job_456"
  }
}
```

## 🏗 Architecture

### Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration management
│   ├── controllers/      # Route controllers
│   ├── errors/          # Custom error classes
│   ├── middlewares/     # Express middleware
│   ├── routes/          # API routes
│   ├── schemas/         # Validation schemas (Zod)
│   ├── services/        # Business logic services
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── tests/               # Test files
├── dist/               # Compiled JavaScript (generated)
└── logs/               # Log files (generated)
```

### Key Features

- **TypeScript**: Strict mode with comprehensive type safety
- **Express.js**: Fast, unopinionated web framework
- **Zod**: Runtime type validation and schema definition
- **Winston**: Structured logging with correlation IDs
- **Helmet**: Security middleware stack
- **Rate Limiting**: Configurable rate limiting and slow-down
- **CORS**: Flexible cross-origin resource sharing
- **Error Handling**: Comprehensive error handling with custom classes
- **Health Checks**: Kubernetes-ready health check endpoints
- **Graceful Shutdown**: Proper cleanup on termination signals

### Middleware Stack

1. **Security** (Helmet) - Security headers and policies
2. **CORS** - Cross-origin resource sharing
3. **Compression** - Response compression
4. **Rate Limiting** - Request rate limiting
5. **Request Logging** - Structured request/response logging
6. **Body Parsing** - JSON and URL-encoded body parsing
7. **Validation** - Zod schema validation
8. **Error Handling** - Global error handling (last)

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- Unit tests for services and utilities
- Integration tests for API endpoints
- Health check endpoint tests
- Error handling tests

## 📊 Monitoring & Logging

### Logging

- **Structured JSON logging** in production
- **Correlation IDs** for request tracking
- **Log levels**: error, warn, info, debug
- **Log rotation** and file management
- **Request/response logging** with timing

### Health Monitoring

- **Health check endpoints** for monitoring
- **Service status checks** (database, S3, FFmpeg)
- **Uptime tracking**
- **Performance metrics**

## 🔒 Security

### Security Features

- **Helmet.js** - Security headers and policies
- **CORS** - Configurable cross-origin policies
- **Rate Limiting** - Request rate limiting per IP
- **Input Validation** - Comprehensive request validation
- **Error Sanitization** - Safe error responses
- **No Secrets in Code** - Environment-based configuration

### Security Headers

- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- Referrer Policy
- And more...

## 🚀 Deployment

### Production Build

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

### Docker Deployment

```bash
# Build production image
docker build -t video-generation-backend .

# Run with environment file
docker run -p 3000:3000 --env-file .env video-generation-backend
```

### Environment-Specific Configurations

- **Development**: Hot reloading, detailed logging, permissive CORS
- **Production**: Optimized build, structured logging, strict security
- **Testing**: Mock services, isolated environment

## 📝 Development Guidelines

### Code Standards

- **TypeScript strict mode** - Full type safety
- **ESLint + Prettier** - Code formatting and linting
- **Conventional commits** - Standardized commit messages
- **Error handling** - Comprehensive error handling
- **Testing** - Unit and integration test coverage
- **Documentation** - JSDoc comments for complex functions

### Adding New Endpoints

1. Create validation schema in `src/schemas/`
2. Add controller method in `src/controllers/`
3. Define route in `src/routes/`
4. Add tests in `tests/`
5. Update documentation

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify Supabase credentials
   - Check network connectivity
   - Ensure database is accessible

2. **S3 Upload Errors**
   - Verify AWS credentials and permissions
   - Check bucket name and region
   - Ensure bucket has proper CORS configuration

3. **Rate Limiting Issues**
   - Adjust rate limit configuration
   - Check IP forwarding setup
   - Review proxy configuration

### Debug Mode

```bash
# Start with debug logging
LOG_LEVEL=debug npm run dev

# Start with Node.js inspector
npm run dev:debug
```

### Log Analysis

```bash
# View error logs
tail -f logs/error.log

# View all logs
tail -f logs/combined.log

# Search logs for correlation ID
grep "correlation-id-here" logs/combined.log
```

## 📚 Next Steps

1. **Video Processing Service** - Implement FFmpeg integration
2. **S3 Storage Service** - Add file upload and management
3. **Job Queue System** - Add background job processing
4. **Authentication** - Implement user authentication
5. **WebSocket Support** - Add real-time job status updates
6. **Metrics Collection** - Add Prometheus metrics
7. **API Documentation** - Generate OpenAPI/Swagger docs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the coding standards
4. Add tests for new functionality
5. Update documentation
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
