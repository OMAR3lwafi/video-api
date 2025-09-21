# Video Generation Platform API Documentation

[![Documentation Status](https://img.shields.io/badge/docs-passing-brightgreen.svg)](https://docs.videogeneration.platform)
[![API Version](https://img.shields.io/badge/api-v1.0.0-blue.svg)](https://api.videogeneration.platform/api/v1/)
[![OpenAPI](https://img.shields.io/badge/openapi-3.0.3-green.svg)](./openapi/video-api.yaml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Complete API documentation system for the Video Generation Platform, featuring interactive documentation, auto-generated SDKs, comprehensive examples, and professional deployment infrastructure.

## 🚀 Quick Links

- **🌐 Live Documentation**: https://docs.videogeneration.platform
- **🔧 Interactive API Explorer**: https://docs.videogeneration.platform/swagger-ui/
- **📖 API Reference**: [Complete API Documentation](./examples/api-examples.md)
- **🛠️ TypeScript SDK**: [Client Library](./sdk-generator/README.md)
- **📦 API Collections**: [Postman & Insomnia](./collections/)

## 📋 Contents

- [Features](#-features)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Documentation Components](#-documentation-components)
- [Development](#-development)
- [Deployment](#-deployment)
- [API Versioning](#-api-versioning)
- [Contributing](#-contributing)
- [Support](#-support)

## ✨ Features

### 📚 Comprehensive Documentation
- **OpenAPI 3.0 Specification** - Complete API definition with examples
- **Interactive Swagger UI** - Try endpoints directly in your browser
- **Markdown Documentation** - Detailed guides and tutorials
- **Real-world Examples** - Copy-paste code samples for multiple languages

### 🛠️ Auto-Generated SDKs
- **TypeScript/JavaScript** - Full-featured client with TypeScript support
- **Python** - Async-compatible client library
- **Go** - High-performance client for enterprise applications
- **Java** - Enterprise-ready client with Spring Boot integration

### 📦 Developer Tools
- **Postman Collection** - Pre-configured requests for testing
- **Insomnia Collection** - REST client integration
- **OpenAPI Validation** - Request/response validation middleware
- **CLI Tools** - Automated documentation generation

### 🚀 Professional Infrastructure
- **Multi-platform Deployment** - GitHub Pages, AWS S3, Netlify
- **Version Management** - Semantic versioning with migration guides
- **CI/CD Integration** - Automated builds and deployments
- **Performance Monitoring** - Documentation analytics and health checks

## 📁 Project Structure

```
docs/
├── 📊 openapi/                    # OpenAPI 3.0 specification
│   └── video-api.yaml             # Complete API definition
├── 🌐 swagger-ui/                 # Interactive documentation
│   ├── index.html                 # Custom Swagger UI
│   └── assets/                    # UI customizations
├── 🛠️ sdk-generator/               # Client SDK generation
│   ├── generate-sdk.js            # SDK generator script
│   ├── package.json               # Generator dependencies
│   └── templates/                 # SDK templates
├── 📖 examples/                   # Usage examples & guides
│   ├── api-examples.md            # Comprehensive examples
│   ├── postman/                   # Postman examples
│   └── code-samples/              # Multi-language samples
├── 📦 collections/                # API client collections
│   ├── postman_collection.json   # Postman collection
│   └── insomnia_collection.json  # Insomnia collection
├── 🔧 scripts/                    # Automation scripts
│   ├── generate-docs.js           # Main documentation generator
│   ├── validate-spec.js           # OpenAPI validation
│   └── deploy.js                  # Deployment automation
├── 🧪 tests/                      # Documentation tests
│   ├── spec.test.js               # OpenAPI spec tests
│   ├── sdk.test.js                # SDK generation tests
│   └── examples.test.js           # Example validation tests
├── 📋 API_VERSIONING.md           # Versioning strategy
├── 🚀 DEPLOYMENT.md               # Deployment guide
├── 🤝 CONTRIBUTING.md             # Contribution guidelines
└── 📘 README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **npm 8+**
- **Git** for version control
- **Docker** (optional, for containerized deployment)

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/videogeneration/platform-docs.git
cd platform-docs/docs

# Install dependencies
npm install

# Install SDK generator dependencies
cd sdk-generator && npm install && cd ..
```

### 2. Generate Documentation

```bash
# Generate all documentation components
npm run build

# Generate without deployment
npm run build:no-deploy

# Start development server
npm run dev
```

### 3. View Documentation

```bash
# Serve documentation locally
npm run serve
# Open: http://localhost:8080

# Serve Swagger UI only
npm run serve:swagger
# Open: http://localhost:8081
```

## 📚 Documentation Components

### OpenAPI Specification

The heart of our documentation system:

```yaml
# openapi/video-api.yaml
openapi: 3.0.3
info:
  title: Dynamic Video Content Generation Platform API
  version: "1.0.0"
  description: |
    Professional API for dynamic video content generation...
```

**Features:**
- Complete endpoint definitions
- Request/response schemas with examples
- Authentication specifications
- Error response documentation
- Real-time update specifications

### Interactive Swagger UI

Custom-branded Swagger UI with enhanced features:

```javascript
// swagger-ui/index.html features:
- Environment detection (dev/staging/prod)
- Authentication helper
- Request correlation tracking
- Enhanced error handling
- Offline capability
```

**Customizations:**
- 🎨 Custom branding and styling
- 🔐 Authentication workflow
- 📊 Request tracking and analytics
- 🌐 Multi-environment support
- 📱 Responsive design

### Auto-Generated SDKs

Professional client libraries for multiple languages:

```typescript
// TypeScript SDK Example
import { VideoApiClient, VideoFormat } from '@videogeneration/api-client';

const client = new VideoApiClient({
  apiKey: process.env.VIDEO_API_KEY,
  timeout: 30000,
  retries: 3
});

const result = await client.videocreate({
  output_format: VideoFormat.MP4,
  width: 1920,
  height: 1080,
  elements: [...]
});
```

**SDK Features:**
- 🔒 Built-in authentication
- ⚡ Automatic retries and error handling
- 📊 Request/response logging
- 🛡️ Type safety (TypeScript)
- 🔄 Real-time job monitoring

## 🛠️ Development

### Local Development

```bash
# Watch for changes and rebuild
npm run watch

# Validate OpenAPI specification
npm run validate-spec

# Lint OpenAPI spec with Spectral
npm run lint-spec

# Run tests
npm test

# Generate SDK only
npm run generate-sdk
```

### Adding New Endpoints

1. **Update OpenAPI specification**:
   ```yaml
   # Add to openapi/video-api.yaml
   /api/v1/new-endpoint:
     post:
       summary: New endpoint
       # ... complete definition
   ```

2. **Add examples**:
   ```markdown
   <!-- Add to examples/api-examples.md -->
   ## New Endpoint Usage
   
   ```bash
   curl -X POST "https://api.videogeneration.platform/api/v1/new-endpoint"
   ```
   ```

3. **Regenerate documentation**:
   ```bash
   npm run build:no-deploy
   ```

### Validation and Testing

```bash
# Validate OpenAPI spec
npm run validate-spec

# Check for broken links
npm run check-links

# Test SDK generation
npm run generate-sdk && cd sdk-generator/generated-sdk && npm test

# Run Postman collection tests
npm run postman:validate
```

## 🚀 Deployment

### Supported Platforms

| Platform | URL | Status |
|----------|-----|--------|
| **GitHub Pages** | https://videogeneration.github.io/docs | ✅ Active |
| **AWS S3 + CloudFront** | https://docs.videogeneration.platform | ✅ Primary |
| **Netlify** | https://videogeneration-docs.netlify.app | ✅ Mirror |

### Environment Variables

```bash
# GitHub Pages deployment
DEPLOY_TO_GITHUB=true
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_PAGES_REPO=videogeneration/docs

# AWS S3 deployment
DEPLOY_TO_S3=true
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
S3_DOCS_BUCKET=docs.videogeneration.platform
CLOUDFRONT_DISTRIBUTION_ID=E1234567890ABC

# Netlify deployment
DEPLOY_TO_NETLIFY=true
NETLIFY_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NETLIFY_SITE_ID=12345678-1234-1234-1234-123456789012
```

### Deployment Commands

```bash
# Deploy to all configured platforms
npm run build

# Deploy to specific platforms
npm run build:github    # GitHub Pages only
npm run build:s3        # AWS S3 only
npm run build:netlify   # Netlify only

# Skip deployment step
npm run build:no-deploy
```

### CI/CD Integration

```yaml
# .github/workflows/docs.yml
name: Deploy Documentation
on:
  push:
    branches: [main]
    paths: ['docs/**', 'backend/src/**']

jobs:
  deploy-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
        working-directory: docs
      - run: npm run build
        working-directory: docs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## 📋 API Versioning

We follow **Semantic Versioning** with URL-based versioning:

### Version Format
```
https://api.videogeneration.platform/api/v{MAJOR}/
```

### Current Versions

| Version | Status | Support Until | Documentation |
|---------|--------|---------------|---------------|
| **v1.0.0** | ✅ Current | 2025-01-15 | [v1 Docs](https://docs.videogeneration.platform/v1/) |
| v0.9.x | ⚠️ Deprecated | 2024-06-15 | [Migration Guide](./API_VERSIONING.md) |

### Migration Support

```javascript
// Automated version detection
const client = new VideoApiClient({
  version: 'v1',  // Pin to specific version
  apiKey: 'your-key'
});

// Migration helper
await client.checkVersionStatus();  // Warns about deprecation
await client.upgradeVersion('v2');  // Automated upgrade
```

For detailed versioning information, see [API_VERSIONING.md](./API_VERSIONING.md).

## 🧪 Testing

### Test Suite

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:spec        # OpenAPI validation
npm run test:sdk         # SDK generation
npm run test:examples    # Example validation
npm run test:links       # Link checking

# Coverage report
npm run test:coverage
```

### Test Categories

- **📋 Specification Tests**: OpenAPI schema validation
- **🛠️ SDK Tests**: Generated client library testing  
- **📖 Example Tests**: Code sample validation
- **🔗 Link Tests**: Documentation link checking
- **⚡ Performance Tests**: Documentation build speed
- **🔒 Security Tests**: Credential scanning

### Quality Gates

All documentation changes must pass:
- ✅ OpenAPI specification validation
- ✅ SDK generation without errors
- ✅ All example code compilation
- ✅ Link validation
- ✅ Automated security scanning

## 🤝 Contributing

We welcome contributions to improve our documentation! See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

### Quick Contribution Guide

1. **Fork and clone** the repository
2. **Create a feature branch**: `git checkout -b feature/improve-examples`
3. **Make your changes** to OpenAPI spec, examples, or documentation
4. **Test your changes**: `npm test`
5. **Generate documentation**: `npm run build:no-deploy`
6. **Commit and push**: `git commit -m "Improve API examples"`
7. **Create pull request** with detailed description

### Documentation Standards

- **OpenAPI**: Follow OpenAPI 3.0.3 specification
- **Examples**: Include working code samples
- **Formatting**: Use Prettier for consistent formatting
- **Validation**: All schemas must validate successfully
- **Testing**: Include tests for new examples

## 📊 Analytics and Monitoring

### Documentation Analytics
- **Page views** and **user engagement**
- **API endpoint popularity**
- **SDK download statistics**
- **Error rate tracking**

### Performance Monitoring
- **Build time optimization**
- **Deployment success rates**
- **CDN cache hit rates**
- **Search functionality performance**

## 🆘 Support

### Getting Help

| Type | Contact | Response Time |
|------|---------|---------------|
| **General Questions** | api-support@videogeneration.platform | 24 hours |
| **Documentation Issues** | docs-support@videogeneration.platform | 12 hours |
| **SDK Problems** | sdk-support@videogeneration.platform | 24 hours |
| **Emergency Support** | priority-support@videogeneration.platform | 2 hours |

### Community Resources

- **📚 Documentation**: https://docs.videogeneration.platform
- **💬 Discord Community**: https://discord.gg/videogeneration
- **📱 Twitter**: [@videogenapi](https://twitter.com/videogenapi)
- **🐛 Issues**: [GitHub Issues](https://github.com/videogeneration/platform-docs/issues)
- **💡 Discussions**: [GitHub Discussions](https://github.com/videogeneration/platform-docs/discussions)

### Documentation Feedback

Help us improve! We track:
- 📊 **Page usefulness ratings**
- 💬 **User feedback and suggestions**
- 🐛 **Bug reports and corrections**
- ⭐ **Feature requests**

## 📄 License

This documentation system is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

The API itself is subject to the Video Generation Platform Terms of Service.

## 🙏 Acknowledgments

- **OpenAPI Initiative** for the OpenAPI specification
- **Swagger UI** for the interactive documentation framework
- **Community Contributors** for examples, bug reports, and improvements
- **Beta Users** for feedback and testing

---

<div align="center">

**Built with ❤️ by the Video Generation Platform Team**

[🌐 Website](https://videogeneration.platform) •
[📖 Documentation](https://docs.videogeneration.platform) •
[🔧 API](https://api.videogeneration.platform) •
[📧 Contact](mailto:team@videogeneration.platform)

</div>