#USE @/'VIDEO API EDITOR'/PRD folder as your refrence . 


# AI Coding Agent â€” Operating Standard for Dynamic Video Content Generation Platform (v1.0)

## 0) Project Profile
- **Product goal**: Dynamic Video Content Generation Platform with intelligent dual response system, AWS S3 storage, real-time progress tracking, and advanced orchestration.
- **Runtime targets**: Linux x86_64; Docker; CPU-optimized for FFmpeg processing; optional GPU acceleration.
- **Primary stack**: Node.js 18+ + TypeScript + Express.js (Backend), React 18 + TypeScript + Tailwind (Frontend), Supabase PostgreSQL (Database).
- **Storage/I/O**: AWS S3 with public URLs; Supabase PostgreSQL for job tracking and real-time subscriptions.
- **Deployment**: Docker containers with orchestration; backend port 3000, frontend port 80/443.
- **Max job size/time**: Video inputs up to 10 minutes; processing â‰¤30 seconds (quick) or â‰¤10 minutes (async); elements up to 10 per job.
- **Core features**: Dual response system, real-time status updates, multi-element video composition, intelligent orchestration.

â¸»

## 1) Mission & Principles
- **Ship working software**: Every answer must include runnable code, exact commands, Docker configs, and test methods.
- **Minimize questions**: Ask only if critically blocked; otherwise state assumptions and proceed with implementation.
- **Deterministic outputs**: Pin all versions; avoid "latest" tags; use specific dependency versions.
- **Modular architecture**: Separate concerns clearly (Backend API, Frontend UI, Database, Orchestrator, Storage).
- **12-factor compliance**: All configuration via environment variables; no secrets in code or git.
- **Real-time capable**: Support WebSocket/subscription patterns for live updates.

â¸»

## 2) Required Response Format (every task)
1. **Overview** â€“ what you'll build and why (2â€“5 lines).
2. **Assumptions & Constraints** â€“ explicit defaults and technical decisions.
3. **Plan** â€“ numbered steps from high-level to concrete implementation.
4. **Code & Files** â€“ organized by component:
   - **Backend**: API routes, services, middleware, types
   - **Frontend**: Components, pages, hooks, stores  
   - **Database**: Migrations, schemas, functions
   - **Infrastructure**: Docker, configs, deployment
   - Each file as: `// path/to/file.ext` followed by complete code block
5. **Dependencies** â€“ exact package versions and installation commands.
6. **Run & Test** â€“ step-by-step commands for local development and Docker.
7. **Validation** â€“ specific tests for functionality, integration, and performance.
8. **Integration Points** â€“ how this connects with other system components.
9. **Next Steps** â€“ logical increments and follow-up tasks.

â¸»

## 3) Quality Bars (Definition of Done)
- **Builds cleanly**: No TypeScript errors, lint passes (ESLint + Prettier).
- **Tested functionality**: Unit tests for logic, integration tests for APIs, component tests for UI.
- **Database integration**: Migrations work, real-time subscriptions functional.
- **API compliance**: Follows REST conventions, proper HTTP codes, consistent error format.
- **Frontend standards**: Responsive design, loading states, error boundaries, accessibility basics.
- **Documentation**: README with setup, env vars, API endpoints, component usage.
- **Security**: Input validation, no secrets in code, CORS configured, rate limiting.
- **Docker ready**: Multi-stage builds, health checks, proper networking, volume mounts.
- **Real-time capable**: WebSocket connections, subscription management, graceful reconnection.

â¸»

## 4) Coding Standards

### Backend (Node.js + TypeScript)
- **TypeScript**: `strict: true`, ES2022 modules, path aliases with `@/` prefix.
- **API Framework**: Express.js with middleware stack (CORS, Helmet, compression, validation).
- **Validation**: Zod schemas for all inputs; reject invalid early with detailed errors.
- **Error handling**: Structured error responses with HTTP codes and machine-readable format.
- **Logging**: Winston with JSON format, correlation IDs, no sensitive data.
- **Database**: Supabase client with typed queries, transaction support, real-time subscriptions.
- **File structure**: Controllers â†’ Services â†’ Database layers with clear separation.

### Frontend (React + TypeScript)
- **TypeScript**: Strict mode, explicit interfaces, proper component typing.
- **Components**: Functional components with hooks, proper prop validation.
- **State**: Zustand for global state, React Query for server state, local state for UI.
- **Styling**: Tailwind CSS with component variants, responsive design patterns.
- **Forms**: React Hook Form with Zod validation, proper error handling.
- **Real-time**: Supabase subscriptions with connection management and reconnection logic.
- **File structure**: Pages â†’ Components â†’ Hooks â†’ Services â†’ Types.

### Database (PostgreSQL + Supabase)
- **Migrations**: Version-controlled SQL files with rollback capability.
- **Tables**: Proper constraints, indexes, foreign keys, enum types.
- **Functions**: PL/pgSQL for complex operations, proper error handling.
- **Triggers**: Automatic timestamp updates, status validation, audit trails.
- **RLS**: Row-level security policies for data protection.
- **Real-time**: Configured subscriptions with proper filtering.

â¸»

## 5) Security & Secrets
- **Environment variables**: All secrets via env vars, documented in `.env.example`.
- **AWS credentials**: Use IAM roles or explicit credentials, never commit keys.
- **Database security**: Connection strings in env vars, RLS enabled, parameterized queries.
- **API security**: Input validation, rate limiting, CORS configuration, security headers.
- **File uploads**: Type validation, size limits, virus scanning consideration.
- **Real-time security**: Subscription authentication, proper channel isolation.
- **Frontend security**: CSP headers, XSS protection, secure cookie settings.

â¸»

## 6) Performance & Reliability
- **Video processing**: FFmpeg with proper codec settings, progress reporting, timeout handling.
- **Database**: Query optimization, connection pooling, proper indexing strategy.
- **API performance**: Response caching, request compression, pagination for large datasets.
- **Frontend optimization**: Code splitting, lazy loading, image optimization, CDN usage.
- **Real-time efficiency**: Connection pooling, subscription batching, graceful degradation.
- **Resource management**: Memory limits, temp file cleanup, processing queues.
- **Error recovery**: Circuit breakers, retry logic with exponential backoff, graceful degradation.

â¸»

## 7) Testing Standards
- **Backend**: Unit tests (services, utilities), integration tests (API endpoints), database tests (migrations, functions).
- **Frontend**: Component tests (React Testing Library), integration tests (user flows), E2E tests (Playwright).
- **API testing**: Request/response validation, error scenarios, rate limiting, authentication.
- **Real-time testing**: WebSocket connections, subscription updates, reconnection scenarios.
- **Performance testing**: Load testing for API endpoints, video processing benchmarks.
- **Security testing**: Input validation, SQL injection prevention, XSS protection.

â¸»

## 8) Docker & Containerization
- **Multi-stage builds**: Separate build and runtime stages, optimized layer caching.
- **Base images**: Node 18-alpine for backend, nginx:alpine for frontend, official postgres for database.
- **Port configuration**: Backend 3000, Frontend 80, Database 5432, Orchestrator 9000.
- **Health checks**: HTTP endpoints for all services, dependency checks.
- **Volumes**: Persistent data, temp file mounts, configuration files.
- **Networking**: Internal service discovery, proper security groups.
- **Environment**: Production-ready configs, resource limits, restart policies.

```dockerfile
# Example multi-stage backend Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1
CMD ["npm", "start"]
```

â¸»

## 9) Development & Deployment
- **Local development**: Docker Compose for all services, hot reload, development databases.
- **Environment management**: Separate configs for dev/staging/prod, secret management.
- **Database migrations**: Automated migration on startup, rollback procedures.
- **Static assets**: CDN integration, proper caching headers, compression.
- **Monitoring**: Health checks, metrics collection, error tracking, performance monitoring.
- **Backup strategy**: Database backups, S3 lifecycle policies, disaster recovery procedures.

â¸»

## 10) API Contract Standards

### Video Processing API
```typescript
// POST /api/v1/videocreate
interface VideoCreateRequest {
  output_format: 'mp4' | 'mov' | 'avi';
  width: number;
  height: number;
  elements: VideoElement[];
}

interface VideoElement {
  id: string;
  type: 'video' | 'image';
  source: string; // URL
  track: number;
  x?: string; // percentage
  y?: string; // percentage
  width?: string; // percentage
  height?: string; // percentage;
  fit_mode?: 'auto' | 'contain' | 'cover' | 'fill';
}

// Immediate Response (â‰¤30 seconds)
interface ImmediateResponse {
  status: 'completed';
  processing_time: string;
  result_url: string; // AWS S3 public URL
  job_id: string;
  file_size: string;
  message: string;
}

// Async Response (>30 seconds)
interface AsyncResponse {
  status: 'processing';
  job_id: string;
  message: string;
  estimated_completion: string;
  status_check_endpoint: string;
}
```

### Job Status API
```typescript
// GET /api/v1/videoresult/{job_id}
interface JobStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  job_id: string;
  progress?: string; // percentage
  current_step?: string;
  message: string;
  result_url?: string; // when completed
  file_size?: string;
  duration?: string;
  processing_time?: string;
  error?: string; // when failed
}
```

### Health Check
```typescript
// GET /health
interface HealthResponse {
  ok: boolean;
  timestamp: string;
  version: string;
  services: {
    database: 'healthy' | 'unhealthy';
    s3: 'healthy' | 'unhealthy';
    ffmpeg: 'healthy' | 'unhealthy';
  };
}
```

â¸»

## 11) Documentation Requirements

### README Structure
```markdown
# Dynamic Video Content Generation Platform

## Quick Start
- Prerequisites (Node.js 18+, Docker, AWS credentials)
- Local development setup
- Docker development environment
- Production deployment

## Environment Variables
- Complete .env.example with descriptions
- Required vs optional variables
- Security considerations

## API Documentation
- All endpoints with examples
- Request/response schemas
- Error codes and handling
- Rate limiting information

## Frontend Usage
- Component documentation
- State management patterns
- Real-time integration
- Deployment procedures

## Architecture
- System overview diagram
- Component interactions
- Data flow explanations
- Performance considerations

## Troubleshooting
- Common issues and solutions
- Log analysis guidance
- Performance debugging
- Security considerations
```

â¸»

## 12) Git & CI/CD
- **Commits**: Conventional commits with clear scope (feat, fix, docs, refactor).
- **Branches**: Feature branches, PR reviews, protected main branch.
- **CI Pipeline**: Lint â†’ Type check â†’ Test â†’ Build â†’ Security scan â†’ Deploy.
- **Versioning**: Semantic versioning (vX.Y.Z), automated changelog generation.
- **Deployment**: Automated deployment to staging, manual promotion to production.
- **Rollback**: Quick rollback procedures, database migration rollback capability.

â¸»

## 13) Don'ts (Hard Rules)
- **No pseudo-code**: Always provide complete, runnable implementations.
- **No TODOs**: Address immediately or document as explicit next steps.
- **No hardcoded values**: All configuration via environment variables.
- **No secrets**: Never commit credentials, tokens, or sensitive data.
- **No single points of failure**: Design for redundancy and graceful degradation.
- **No blocking operations**: Use async patterns, timeouts, and cancellation.
- **No global state**: Maintain stateless services where possible.

â¸»

## 14) Task-End Checklists

### A. Technical Validation
- [ ] TypeScript compiles without errors
- [ ] All linting rules pass (ESLint + Prettier)
- [ ] Unit tests pass with >80% coverage
- [ ] Integration tests validate API contracts
- [ ] Docker images build and run successfully
- [ ] Health checks respond correctly
- [ ] Database migrations apply cleanly

### B. Functional Validation
- [ ] Video processing works with sample files
- [ ] Dual response system triggers correctly (â‰¤30s vs >30s)
- [ ] Real-time status updates functional
- [ ] S3 upload and public URL generation works
- [ ] Frontend UI responsive and accessible
- [ ] Error handling graceful with user feedback
- [ ] Job tracking and history functional

### C. Integration Validation
- [ ] Backend API integrates with database
- [ ] Frontend communicates with backend APIs
- [ ] Real-time subscriptions work end-to-end
- [ ] AWS S3 operations successful
- [ ] Docker containers communicate properly
- [ ] Orchestrator manages resources effectively
- [ ] Monitoring and logging operational

### D. Security Validation
- [ ] Input validation rejects malicious input
- [ ] No secrets exposed in code or logs
- [ ] CORS configured appropriately
- [ ] Rate limiting functional
- [ ] SQL injection protection verified
- [ ] File upload security implemented
- [ ] Authentication/authorization working

### E. Performance Validation
- [ ] API response times <200ms for simple requests
- [ ] Video processing completes within time limits
- [ ] Database queries optimized with proper indexes
- [ ] Frontend loads quickly with proper caching
- [ ] Real-time updates low latency (<1s)
- [ ] Resource usage within acceptable limits
- [ ] Concurrent request handling validated

â¸»

## 15) Response Template Example

```markdown
## Overview
Implement the video creation API endpoint with dual response system and S3 integration for the Dynamic Video Content Generation Platform.

## Assumptions & Constraints
- Node.js 18+, Express.js, TypeScript strict mode
- Supabase PostgreSQL for job tracking
- AWS S3 for video storage with public URLs
- FFmpeg for video processing
- Processing time threshold: 30 seconds for immediate response

## Plan
1. Create VideoController with input validation
2. Implement processing time estimation logic
3. Add dual response paths (sync/async)
4. Integrate S3 upload service
5. Set up job tracking with database
6. Add comprehensive error handling
7. Create Docker configuration
8. Add tests and documentation

## Code & Files

### Backend
// src/controllers/VideoController.ts
[complete implementation]

// src/services/VideoProcessor.ts  
[complete implementation]

// src/services/S3StorageService.ts
[complete implementation]

### Infrastructure
// Dockerfile
[complete multi-stage build]

// docker-compose.yml
[complete service configuration]

## Dependencies
```bash
npm install express @types/express cors helmet compression
npm install fluent-ffmpeg @types/fluent-ffmpeg
npm install aws-sdk zod winston
npm install --save-dev jest @types/jest supertest
```

## Run & Test
```bash
# Local development
npm install
npm run dev

# Docker development
docker-compose up --build

# Run tests
npm test

# Production build
docker build -t video-platform-api .
docker run -p 3000:3000 video-platform-api
```

## Validation
- Verify immediate response for simple jobs (single image overlay)
- Test async response for complex jobs (multiple video elements)
- Confirm S3 upload and public URL generation
- Validate job tracking and status updates
- Test error handling for invalid inputs and processing failures

## Integration Points
- Database service for job tracking and real-time updates
- S3 service for file storage and public URL generation
- Frontend components for dual response handling
- Orchestrator service for resource management

## Next Steps
- Add job queue management for async processing
- Implement real-time status updates via WebSocket
- Add video processing progress tracking
- Create job cancellation functionality
```

This operating standard provides comprehensive guidelines for building the complete Dynamic Video Content Generation Platform while maintaining code quality, security, and performance standards throughout development.