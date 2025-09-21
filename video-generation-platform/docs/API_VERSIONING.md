# API Versioning Strategy and Migration Guide

## Overview

The Video Generation Platform API follows a comprehensive versioning strategy to ensure backward compatibility while enabling continuous improvement and evolution of the platform.

## Versioning Strategy

### Version Format

We use **Semantic Versioning (SemVer)** with the format `MAJOR.MINOR.PATCH`:

- **MAJOR**: Breaking changes that require client updates
- **MINOR**: New features that are backward compatible
- **PATCH**: Bug fixes and minor improvements

### URL Structure

```
https://api.videogeneration.platform/api/v{MAJOR}/
```

**Examples:**
- `https://api.videogeneration.platform/api/v1/` (Current)
- `https://api.videogeneration.platform/api/v2/` (Future)

### Header-Based Versioning (Optional)

Clients can also specify the API version using headers:

```http
Accept: application/vnd.videogeneration.v1+json
API-Version: v1.2.3
```

## Current Version: v1.0.0

### Release Information
- **Release Date**: 2024-01-15
- **Status**: Stable
- **Support Until**: 2025-01-15 (minimum 1 year)

### Core Endpoints
- `/api/v1/videocreate` - Video creation endpoint
- `/api/v1/videoresult/{jobId}` - Job status retrieval
- `/api/v1/video/*` - Video management endpoints
- `/api/v1/health` - Health check endpoints

## Backward Compatibility Policy

### Support Timeline

| Version | Status | Support Level | End of Life |
|---------|--------|---------------|-------------|
| v1.x.x  | Current | Full Support | TBD |
| v0.9.x  | Deprecated | Security Only | 2024-06-15 |

### Compatibility Guarantees

#### What We Guarantee (No Breaking Changes)
✅ **Endpoint URLs** - Existing endpoints will continue to work  
✅ **Request/Response Schemas** - Existing fields will not be removed  
✅ **HTTP Methods** - Supported methods will remain the same  
✅ **Status Codes** - Success/error codes will not change meaning  
✅ **Authentication** - Current auth methods will continue to work  

#### What May Change (Non-Breaking)
⚠️ **New Fields** - Response objects may include additional fields  
⚠️ **New Endpoints** - New functionality via new endpoints  
⚠️ **Enhanced Validation** - Stricter input validation (with warnings)  
⚠️ **Performance Improvements** - Response times and optimizations  

#### What Will Cause Version Bumps (Breaking Changes)
❌ **Field Removal** - Removing response fields → MAJOR version  
❌ **Schema Changes** - Changing field types/formats → MAJOR version  
❌ **Endpoint Removal** - Removing endpoints → MAJOR version  
❌ **Auth Changes** - Changing authentication → MAJOR version  

## Version Migration Guide

### Migrating from v0.9.x to v1.0.0

#### Breaking Changes

1. **Authentication Header Change**
   ```diff
   - X-Auth-Token: your-token
   + X-API-Key: your-api-key
   ```

2. **Job Status Response Format**
   ```diff
   {
   - "state": "processing",
   + "status": "processing",
     "job_id": "job_123",
   - "percent_complete": 45,
   + "progress": "45%"
   }
   ```

3. **Video Element Structure**
   ```diff
   {
     "id": "element1",
     "type": "video",
     "source": "https://example.com/video.mp4",
     "track": 0,
   - "position": { "x": 0.5, "y": 0.1 },
   + "x": "50%",
   + "y": "10%"
   }
   ```

#### Migration Steps

1. **Update Authentication**
   ```javascript
   // Old v0.9
   const headers = {
     'X-Auth-Token': 'your-token'
   };
   
   // New v1.0
   const headers = {
     'X-API-Key': 'your-api-key'
   };
   ```

2. **Update Status Polling**
   ```javascript
   // Old v0.9
   function checkJobStatus(jobId) {
     return fetch(`/api/v0.9/job/${jobId}/status`)
       .then(res => res.json())
       .then(data => {
         console.log(`Job state: ${data.state}`);
         console.log(`Progress: ${data.percent_complete}%`);
       });
   }
   
   // New v1.0
   function checkJobStatus(jobId) {
     return fetch(`/api/v1/videoresult/${jobId}`)
       .then(res => res.json())
       .then(data => {
         console.log(`Job status: ${data.status}`);
         console.log(`Progress: ${data.progress}`);
       });
   }
   ```

3. **Update Video Element Positioning**
   ```javascript
   // Old v0.9
   const elements = [{
     id: 'logo',
     type: 'image',
     source: 'https://example.com/logo.png',
     track: 1,
     position: { x: 0.8, y: 0.1, width: 0.15, height: 0.15 }
   }];
   
   // New v1.0
   const elements = [{
     id: 'logo',
     type: 'image',
     source: 'https://example.com/logo.png',
     track: 1,
     x: '80%',
     y: '10%',
     width: '15%',
     height: '15%'
   }];
   ```

## Version Detection

### Automatic Detection

The API automatically detects the version from the URL path:

```javascript
// v1 API
fetch('https://api.videogeneration.platform/api/v1/videocreate', options)

// Future v2 API
fetch('https://api.videogeneration.platform/api/v2/videocreate', options)
```

### Version Information Endpoint

Get current version information:

```http
GET /api/v1/
```

**Response:**
```json
{
  "message": "Dynamic Video Content Generation Platform API v1",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "endpoints": {
    "health": "/api/v1/health",
    "video": "/api/v1/video",
    "videocreate": "/api/v1/videocreate",
    "videoresult": "/api/v1/videoresult/:jobId"
  },
  "documentation": "https://docs.videogeneration.platform",
  "deprecation": null,
  "sunset": null
}
```

## Future Roadmap

### v1.1.0 (Planned: Q2 2024)
**Type**: Minor Release (Backward Compatible)

**New Features:**
- Real-time progress via WebSockets
- Batch video processing endpoints
- Enhanced error details with suggestions
- Video templates support

**Example New Endpoint:**
```http
POST /api/v1/video/batch
Content-Type: application/json

{
  "jobs": [
    { "id": "job1", "template": "template_id", "variables": {...} },
    { "id": "job2", "template": "template_id", "variables": {...} }
  ]
}
```

### v1.2.0 (Planned: Q3 2024)
**Type**: Minor Release (Backward Compatible)

**New Features:**
- AI-powered video enhancement
- Custom codec support
- Advanced scheduling options

### v2.0.0 (Planned: 2025)
**Type**: Major Release (Breaking Changes)

**Planned Breaking Changes:**
- Unified authentication with OAuth 2.0
- Restructured response formats for consistency
- New video element schema with advanced positioning
- Deprecated endpoints removal

## Client Implementation Recommendations

### Version Pinning

**Recommended:** Pin to specific major version in production
```javascript
const API_BASE = 'https://api.videogeneration.platform/api/v1';
```

**Not Recommended:** Using latest or unversioned endpoints
```javascript
// Avoid this - may break with updates
const API_BASE = 'https://api.videogeneration.platform/api/latest';
```

### Error Handling

Always handle version-related errors:

```javascript
async function makeApiCall(endpoint, data) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle version deprecation warnings
      if (response.headers.get('X-API-Deprecated')) {
        console.warn('API version deprecated:', response.headers.get('X-API-Deprecated'));
      }
      
      throw new Error(error.message);
    }

    return response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

### Version Upgrade Preparation

```javascript
class VideoApiClient {
  constructor(version = 'v1') {
    this.version = version;
    this.baseUrl = `https://api.videogeneration.platform/api/${version}`;
  }

  async checkVersionStatus() {
    const response = await fetch(`${this.baseUrl}/`);
    const info = await response.json();
    
    if (info.deprecation) {
      console.warn(`API ${this.version} is deprecated:`, info.deprecation);
      console.warn(`Sunset date:`, info.sunset);
    }
    
    return info;
  }

  // Graceful upgrade method
  async upgradeVersion(newVersion) {
    const testClient = new VideoApiClient(newVersion);
    
    try {
      await testClient.checkVersionStatus();
      this.version = newVersion;
      this.baseUrl = `https://api.videogeneration.platform/api/${newVersion}`;
      console.log(`Successfully upgraded to API ${newVersion}`);
    } catch (error) {
      console.error(`Failed to upgrade to API ${newVersion}:`, error);
      throw error;
    }
  }
}
```

## Deprecation Process

### Deprecation Timeline

1. **Announcement** (6 months before sunset)
   - Email notifications to registered developers
   - Documentation updates with migration guides
   - Response headers indicating deprecation

2. **Warning Phase** (3 months before sunset)
   - API responses include deprecation warnings
   - Increased communication frequency
   - Migration assistance available

3. **Sunset** (End of support)
   - API version stops responding
   - All requests return 410 Gone with migration info

### Deprecation Headers

When an API version is deprecated, responses include:

```http
X-API-Deprecated: true
X-API-Sunset: 2024-12-31T23:59:59Z
X-API-Migration-Guide: https://docs.videogeneration.platform/migration/v1-to-v2
Warning: 299 - "API version v1 is deprecated. Please migrate to v2 by 2024-12-31"
```

## Testing Strategy

### Multi-Version Testing

```javascript
describe('API Versioning', () => {
  const versions = ['v1', 'v2'];
  
  versions.forEach(version => {
    describe(`API ${version}`, () => {
      it('should create video successfully', async () => {
        const client = new VideoApiClient(version);
        const result = await client.createVideo(testData[version]);
        expect(result.status).toBe('completed');
      });
    });
  });
});
```

### Contract Testing

```javascript
// Ensure backward compatibility
describe('Backward Compatibility', () => {
  it('v1 response should include all required v0.9 fields', async () => {
    const v1Response = await fetch('/api/v1/videoresult/job_123');
    const data = await v1Response.json();
    
    // Ensure v1 includes fields that v0.9 clients expect
    expect(data).toHaveProperty('job_id');
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('message');
  });
});
```

## Documentation Versioning

### Version-Specific Documentation

- **v1 Docs**: https://docs.videogeneration.platform/v1/
- **v2 Docs**: https://docs.videogeneration.platform/v2/
- **Latest**: https://docs.videogeneration.platform/ (redirects to current stable)

### OpenAPI Specifications

```
docs/
├── openapi/
│   ├── v1.0.0/
│   │   ├── video-api.yaml
│   │   └── changelog.md
│   ├── v1.1.0/
│   │   ├── video-api.yaml
│   │   └── changelog.md
│   └── v2.0.0/
│       ├── video-api.yaml
│       └── changelog.md
```

## SDK Versioning

### Version Alignment

SDKs follow the same versioning as the API:

```bash
npm install @videogeneration/api-client@^1.0.0  # For API v1
npm install @videogeneration/api-client@^2.0.0  # For API v2
```

### SDK Migration

```javascript
// SDK handles version differences internally
import { VideoApiClient } from '@videogeneration/api-client';

const client = new VideoApiClient({
  version: 'v1',  // Specify API version
  apiKey: 'your-key'
});

// SDK translates to appropriate API version
await client.createVideo(videoData);
```

## Monitoring and Analytics

### Version Usage Metrics

We track API version usage to inform deprecation decisions:

- Request volume per version
- Error rates per version  
- Client distribution across versions
- Migration success rates

### Health Checks

Version-specific health endpoints:

```http
GET /api/v1/health
GET /api/v2/health
```

## Support and Communication

### Version-Specific Support

- **v1.x**: Full support including new features
- **v0.9.x**: Security updates only
- **Deprecated**: No active support

### Communication Channels

- **Email**: api-updates@videogeneration.platform
- **Slack**: #api-updates channel
- **GitHub**: Release notifications
- **Documentation**: Migration guides and changelogs

### Getting Help

- **General Support**: api-support@videogeneration.platform
- **Migration Help**: migration-support@videogeneration.platform
- **Emergency**: priority-support@videogeneration.platform

---

## Summary

Our versioning strategy prioritizes:

1. **Stability** - Predictable, long-term support for each major version
2. **Clarity** - Clear communication about changes and timelines  
3. **Migration Support** - Comprehensive guides and assistance
4. **Flexibility** - Multiple versioning methods (URL, headers)
5. **Monitoring** - Track usage and success metrics

This approach ensures that our API can evolve while maintaining the reliability that our users depend on.

For questions about versioning or migration assistance, contact our API team at api-support@videogeneration.platform.