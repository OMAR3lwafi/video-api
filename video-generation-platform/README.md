# Dynamic Video Content Generation Platform

A full-stack application for creating custom video content by combining multiple media elements with precise positioning and automatic fitting.

## Architecture Components

- **Backend API**: Node.js + Express + TypeScript + FFmpeg
- **Frontend Interface**: React + TypeScript + Tailwind CSS
- **Database Layer**: Supabase PostgreSQL with real-time subscriptions
- **Storage**: AWS S3 with public URL generation
- **Orchestrator**: Resource management and workflow orchestration
- **Infrastructure**: Docker containerization

## Key Features

- Dual Response System (≤30s immediate or >30s async)
- Real-time Status Updates via Supabase subscriptions
- Intelligent FFmpeg Video Processing
- AWS S3 Cloud Storage Integration
- Advanced Resource Orchestration
- Production-ready Containerization

## Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd video-generation-platform

# Development with Docker
docker-compose up --build

# Local development
npm run dev:all
```

## Environment Setup

Copy `.env.example` files in each component directory and configure:
- AWS credentials for S3 storage
- Supabase connection details
- FFmpeg processing settings

## Documentation

- [Backend API Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)
- [Database Schema](./database/README.md)
- [Docker Deployment](./docker/README.md)

## License

MIT License
