#!/usr/bin/env node

/**
 * TypeScript SDK Generator for Video API
 * Generates client SDK from OpenAPI specification
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Configuration
const CONFIG = {
  openApiSpecPath: '../openapi/video-api.yaml',
  outputDir: './generated-sdk',
  packageName: '@videogeneration/api-client',
  packageVersion: '1.0.0',
  clientName: 'VideoApiClient',
  baseUrl: 'https://api.videogeneration.platform/api/v1'
};

// Template for the main client class
const CLIENT_TEMPLATE = `import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  apiKey?: string;
  bearerToken?: string;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
}

export interface RequestConfig extends AxiosRequestConfig {
  correlationId?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  correlationId?: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  correlationId?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public correlationId?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export class VideoApiClient {
  private client: AxiosInstance;
  private config: Required<ApiClientConfig>;

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL || '${CONFIG.baseUrl}',
      timeout: config.timeout || 30000,
      apiKey: config.apiKey || '',
      bearerToken: config.bearerToken || '',
      headers: config.headers || {},
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '${CONFIG.packageName}@${CONFIG.packageVersion}',
        ...this.config.headers,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use((config) => {
      // Add correlation ID
      if (!config.headers['X-Correlation-ID']) {
        config.headers['X-Correlation-ID'] = 'req_' + Math.random().toString(36).substr(2, 9);
      }

      // Add authentication
      if (this.config.bearerToken) {
        config.headers.Authorization = \`Bearer \${this.config.bearerToken}\`;
      } else if (this.config.apiKey) {
        config.headers['X-API-Key'] = this.config.apiKey;
      }

      // Add client info
      config.headers['X-Client-SDK'] = '${CONFIG.packageName}@${CONFIG.packageVersion}';

      return config;
    });

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        const correlationId = config.headers['X-Correlation-ID'];

        // Retry logic for 5xx errors
        if (
          error.response?.status >= 500 &&
          config.__retryCount < this.config.retries
        ) {
          config.__retryCount = (config.__retryCount || 0) + 1;

          await new Promise(resolve =>
            setTimeout(resolve, this.config.retryDelay * config.__retryCount)
          );

          return this.client(config);
        }

        // Transform error
        const apiError = error.response?.data;
        throw new ApiClientError(
          apiError?.message || error.message,
          error.response?.status || 0,
          correlationId,
          apiError?.details
        );
      }
    );
  }

  // Utility methods
  public setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  public setBearerToken(token: string): void {
    this.config.bearerToken = token;
  }

  public setBaseURL(baseURL: string): void {
    this.config.baseURL = baseURL;
    this.client.defaults.baseURL = baseURL;
  }

  private async request<T>(config: RequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.request(config);
    return response.data;
  }

  // Generated API methods will be inserted here
  {{API_METHODS}}
}

export default VideoApiClient;
`;

// Template for type definitions
const TYPES_TEMPLATE = `// Auto-generated TypeScript types from OpenAPI specification

{{GENERATED_TYPES}}
`;

// Template for individual API method
const METHOD_TEMPLATE = `
  /**
   * {{DESCRIPTION}}
   * {{SUMMARY}}
   */
  public async {{METHOD_NAME}}({{PARAMETERS}}): Promise<{{RETURN_TYPE}}> {
    return this.request<{{RETURN_TYPE}}>({
      method: '{{HTTP_METHOD}}',
      url: '{{URL}}',
      {{REQUEST_CONFIG}}
    });
  }
`;

class SDKGenerator {
  constructor() {
    this.spec = null;
    this.generatedTypes = new Set();
    this.apiMethods = [];
  }

  async generate() {
    console.log('🚀 Starting SDK generation...');

    try {
      await this.loadOpenApiSpec();
      await this.generateTypes();
      await this.generateApiMethods();
      await this.generateClientFile();
      await this.generatePackageJson();
      await this.generateReadme();
      await this.generateExamples();

      console.log('✅ SDK generation completed successfully!');
      console.log(\`📁 Output directory: \${path.resolve(CONFIG.outputDir)}\`);
    } catch (error) {
      console.error('❌ SDK generation failed:', error);
      process.exit(1);
    }
  }

  async loadOpenApiSpec() {
    console.log('📖 Loading OpenAPI specification...');

    const specPath = path.resolve(__dirname, CONFIG.openApiSpecPath);
    const specContent = fs.readFileSync(specPath, 'utf8');
    this.spec = yaml.load(specContent);

    console.log(\`✅ Loaded OpenAPI spec: \${this.spec.info.title} v\${this.spec.info.version}\`);
  }

  async generateTypes() {
    console.log('🔧 Generating TypeScript types...');

    const components = this.spec.components || {};
    const schemas = components.schemas || {};

    let typeDefinitions = '';

    // Generate interfaces from schemas
    for (const [name, schema] of Object.entries(schemas)) {
      typeDefinitions += this.generateTypeFromSchema(name, schema);
    }

    // Generate enum types
    typeDefinitions += this.generateEnumTypes();

    // Write types file
    const typesContent = TYPES_TEMPLATE.replace('{{GENERATED_TYPES}}', typeDefinitions);

    this.ensureOutputDir();
    fs.writeFileSync(
      path.join(CONFIG.outputDir, 'types.ts'),
      typesContent
    );

    console.log(\`✅ Generated \${Object.keys(schemas).length} type definitions\`);
  }

  generateTypeFromSchema(name, schema) {
    if (schema.allOf) {
      return this.generateAllOfType(name, schema);
    }

    if (schema.type === 'object') {
      return this.generateObjectType(name, schema);
    }

    if (schema.enum) {
      return this.generateEnumType(name, schema);
    }

    return '';
  }

  generateObjectType(name, schema) {
    const properties = schema.properties || {};
    const required = schema.required || [];

    let typeDefinition = \`export interface \${name} {\n\`;

    for (const [propName, propSchema] of Object.entries(properties)) {
      const isRequired = required.includes(propName);
      const isOptional = !isRequired;
      const propType = this.getTypeScriptType(propSchema);
      const description = propSchema.description || '';

      if (description) {
        typeDefinition += \`  /** \${description} */\n\`;
      }

      typeDefinition += \`  \${propName}\${isOptional ? '?' : ''}: \${propType};\n\`;
    }

    typeDefinition += '}\n\n';
    return typeDefinition;
  }

  generateAllOfType(name, schema) {
    const allOfRefs = schema.allOf.map(item => {
      if (item.$ref) {
        return this.getTypeFromRef(item.$ref);
      }
      if (item.type === 'object') {
        return this.generateInlineObjectType(item);
      }
      return 'unknown';
    });

    return \`export interface \${name} extends \${allOfRefs.join(', ')} {}\n\n\`;
  }

  generateEnumType(name, schema) {
    const enumValues = schema.enum.map(value => \`  '\${value}' = '\${value}'\`).join(',\n');
    return \`export enum \${name} {\n\${enumValues}\n}\n\n\`;
  }

  generateEnumTypes() {
    // Generate common enum types
    return \`
export enum VideoFormat {
  MP4 = 'mp4',
  MOV = 'mov',
  AVI = 'avi'
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum ElementType {
  VIDEO = 'video',
  IMAGE = 'image'
}

export enum FitMode {
  AUTO = 'auto',
  CONTAIN = 'contain',
  COVER = 'cover',
  FILL = 'fill'
}

export enum ServiceStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded'
}
\`;
  }

  async generateApiMethods() {
    console.log('🔧 Generating API methods...');

    const paths = this.spec.paths || {};
    let methodCount = 0;

    for (const [pathUrl, pathItem] of Object.entries(paths)) {
      for (const [httpMethod, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(httpMethod)) {
          this.apiMethods.push(this.generateMethod(pathUrl, httpMethod, operation));
          methodCount++;
        }
      }
    }

    console.log(\`✅ Generated \${methodCount} API methods\`);
  }

  generateMethod(pathUrl, httpMethod, operation) {
    const operationId = operation.operationId || this.generateOperationId(pathUrl, httpMethod);
    const methodName = this.toCamelCase(operationId);
    const description = operation.description || operation.summary || '';
    const summary = operation.summary || '';

    // Generate parameters
    const parameters = this.generateMethodParameters(operation);
    const returnType = this.generateReturnType(operation);
    const requestConfig = this.generateRequestConfig(pathUrl, operation, httpMethod);

    return METHOD_TEMPLATE
      .replace('{{METHOD_NAME}}', methodName)
      .replace('{{DESCRIPTION}}', description)
      .replace('{{SUMMARY}}', summary)
      .replace('{{PARAMETERS}}', parameters)
      .replace('{{RETURN_TYPE}}', returnType)
      .replace('{{HTTP_METHOD}}', httpMethod.toUpperCase())
      .replace('{{URL}}', this.convertPathToTemplate(pathUrl))
      .replace('{{REQUEST_CONFIG}}', requestConfig);
  }

  generateMethodParameters(operation) {
    const parameters = [];

    // Path parameters
    if (operation.parameters) {
      const pathParams = operation.parameters.filter(p => p.in === 'path');
      pathParams.forEach(param => {
        const type = this.getTypeScriptType(param.schema);
        parameters.push(\`\${param.name}: \${type}\`);
      });
    }

    // Request body
    if (operation.requestBody) {
      const contentType = Object.keys(operation.requestBody.content)[0];
      const schema = operation.requestBody.content[contentType]?.schema;
      if (schema) {
        const type = this.getTypeScriptType(schema);
        parameters.push(\`data: \${type}\`);
      }
    }

    // Query parameters
    if (operation.parameters) {
      const queryParams = operation.parameters.filter(p => p.in === 'query');
      if (queryParams.length > 0) {
        const queryType = this.generateQueryParamsType(queryParams);
        parameters.push(\`params?: \${queryType}\`);
      }
    }

    // Options parameter
    parameters.push('options?: RequestConfig');

    return parameters.join(', ');
  }

  generateRequestConfig(pathUrl, operation, httpMethod) {
    const config = [];

    // Add data for POST/PUT/PATCH
    if (['post', 'put', 'patch'].includes(httpMethod)) {
      config.push('data');
    }

    // Add params for query parameters
    if (operation.parameters?.some(p => p.in === 'query')) {
      config.push('params');
    }

    // Add options spread
    config.push('...options');

    return config.length > 0 ? config.join(',\n      ') : '';
  }

  generateReturnType(operation) {
    const responses = operation.responses || {};
    const successResponse = responses['200'] || responses['201'] || responses['202'];

    if (successResponse?.content?.['application/json']?.schema) {
      return this.getTypeScriptType(successResponse.content['application/json'].schema);
    }

    return 'any';
  }

  getTypeScriptType(schema) {
    if (!schema) return 'any';

    if (schema.$ref) {
      return this.getTypeFromRef(schema.$ref);
    }

    if (schema.type === 'string') {
      if (schema.enum) {
        return schema.enum.map(v => \`'\${v}'\`).join(' | ');
      }
      return 'string';
    }

    if (schema.type === 'number' || schema.type === 'integer') {
      return 'number';
    }

    if (schema.type === 'boolean') {
      return 'boolean';
    }

    if (schema.type === 'array') {
      const itemType = this.getTypeScriptType(schema.items);
      return \`\${itemType}[]\`;
    }

    if (schema.type === 'object') {
      return 'Record<string, any>';
    }

    return 'any';
  }

  getTypeFromRef(ref) {
    const parts = ref.split('/');
    return parts[parts.length - 1];
  }

  async generateClientFile() {
    console.log('🔧 Generating client file...');

    const apiMethodsCode = this.apiMethods.join('\n');
    const clientContent = CLIENT_TEMPLATE.replace('{{API_METHODS}}', apiMethodsCode);

    this.ensureOutputDir();
    fs.writeFileSync(
      path.join(CONFIG.outputDir, 'client.ts'),
      clientContent
    );

    console.log('✅ Generated client file');
  }

  async generatePackageJson() {
    console.log('🔧 Generating package.json...');

    const packageJson = {
      name: CONFIG.packageName,
      version: CONFIG.packageVersion,
      description: 'TypeScript client SDK for Video Generation Platform API',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      scripts: {
        build: 'tsc',
        'build:watch': 'tsc --watch',
        'lint': 'eslint src/**/*.ts',
        'lint:fix': 'eslint src/**/*.ts --fix',
        'test': 'jest',
        'test:watch': 'jest --watch',
        'prepublishOnly': 'npm run build'
      },
      keywords: ['video', 'api', 'client', 'sdk', 'typescript'],
      author: 'Video Generation Platform Team',
      license: 'MIT',
      dependencies: {
        axios: '^1.6.0'
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
        'eslint': '^8.0.0',
        '@typescript-eslint/eslint-plugin': '^6.0.0',
        '@typescript-eslint/parser': '^6.0.0',
        'jest': '^29.0.0',
        '@types/jest': '^29.0.0',
        'ts-jest': '^29.0.0'
      },
      repository: {
        type: 'git',
        url: 'https://github.com/videogeneration/platform-sdk'
      },
      bugs: {
        url: 'https://github.com/videogeneration/platform-sdk/issues'
      },
      homepage: 'https://docs.videogeneration.platform'
    };

    fs.writeFileSync(
      path.join(CONFIG.outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    console.log('✅ Generated package.json');
  }

  async generateReadme() {
    console.log('🔧 Generating README...');

    const readme = \`# \${CONFIG.packageName}

TypeScript client SDK for the Video Generation Platform API.

## Installation

\\\`\\\`\\\`bash
npm install \${CONFIG.packageName}
\\\`\\\`\\\`

## Quick Start

\\\`\\\`\\\`typescript
import { VideoApiClient } from '\${CONFIG.packageName}';

// Initialize with API key
const client = new VideoApiClient({
  apiKey: 'your-api-key'
});

// Or with Bearer token
const client = new VideoApiClient({
  bearerToken: 'your-jwt-token'
});

// Create a video
const result = await client.videocreate({
  output_format: 'mp4',
  width: 1920,
  height: 1080,
  elements: [
    {
      id: 'background',
      type: 'video',
      source: 'https://example.com/video.mp4',
      track: 0
    }
  ]
});

console.log('Video created:', result);
\\\`\\\`\\\`

## Configuration

\\\`\\\`\\\`typescript
const client = new VideoApiClient({
  baseURL: 'https://api.videogeneration.platform/api/v1', // Custom base URL
  timeout: 30000, // Request timeout in ms
  retries: 3, // Number of retries for 5xx errors
  retryDelay: 1000, // Delay between retries in ms
  headers: { // Additional headers
    'X-Custom-Header': 'value'
  }
});
\\\`\\\`\\\`

## API Methods

### Video Processing

- \\\`videocreate(data)\\\` - Create a new video
- \\\`videoresult(jobId)\\\` - Get video processing result
- \\\`videoCreate(data)\\\` - Alternative video creation endpoint

### Job Management

- \\\`videoJobs(params?)\\\` - List video processing jobs
- \\\`videoJobDetails(jobId)\\\` - Get detailed job information
- \\\`videoJobCancel(jobId)\\\` - Cancel a processing job
- \\\`videoJobSubscribe(jobId)\\\` - Subscribe to job updates (SSE)

### Health Checks

- \\\`health()\\\` - Basic health check
- \\\`healthDetailed()\\\` - Detailed health with service status
- \\\`healthReady()\\\` - Readiness probe
- \\\`healthLive()\\\` - Liveness probe

## Error Handling

\\\`\\\`\\\`typescript
import { ApiClientError } from '\${CONFIG.packageName}';

try {
  const result = await client.videocreate(data);
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error('API Error:', {
      message: error.message,
      statusCode: error.statusCode,
      correlationId: error.correlationId,
      details: error.details
    });
  }
}
\\\`\\\`\\\`

## Types

All API types are exported and can be imported:

\\\`\\\`\\\`typescript
import {
  VideoCreateRequest,
  VideoElement,
  JobStatusResponse,
  VideoFormat,
  JobStatus
} from '\${CONFIG.packageName}';
\\\`\\\`\\\`

## Real-time Updates

For real-time job status updates:

\\\`\\\`\\\`typescript
// Note: SSE support requires additional handling
const eventSource = new EventSource(
  \\\`\\\${client.baseURL}/video/job/\\\${jobId}/subscribe\\\`,
  {
    headers: {
      'Authorization': \\\`Bearer \\\${token}\\\`
    }
  }
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Job update:', data);
};
\\\`\\\`\\\`

## License

MIT

## Support

- 📖 [Documentation](https://docs.videogeneration.platform)
- 🐛 [Issues](https://github.com/videogeneration/platform-sdk/issues)
- 📧 [Support](mailto:api-support@videogeneration.platform)
\`;

    fs.writeFileSync(path.join(CONFIG.outputDir, 'README.md'), readme);
    console.log('✅ Generated README');
  }

  async generateExamples() {
    console.log('🔧 Generating examples...');

    const examplesDir = path.join(CONFIG.outputDir, 'examples');
    this.ensureDir(examplesDir);

    // Basic usage example
    const basicExample = \`import { VideoApiClient } from '\${CONFIG.packageName}';

async function basicVideoCreation() {
  const client = new VideoApiClient({
    apiKey: process.env.VIDEO_API_KEY
  });

  try {
    // Create a simple video with image overlay
    const result = await client.videocreate({
      output_format: 'mp4',
      width: 1920,
      height: 1080,
      elements: [
        {
          id: 'background',
          type: 'video',
          source: 'https://example.com/background.mp4',
          track: 0
        },
        {
          id: 'logo',
          type: 'image',
          source: 'https://example.com/logo.png',
          track: 1,
          x: '80%',
          y: '10%',
          width: '15%',
          height: '15%',
          fit_mode: 'contain'
        }
      ]
    });

    console.log('Video created successfully:', result);
  } catch (error) {
    console.error('Failed to create video:', error);
  }
}

basicVideoCreation();
\`;

    fs.writeFileSync(path.join(examplesDir, 'basic-usage.ts'), basicExample);

    // Async job monitoring example
    const asyncExample = \`import { VideoApiClient, JobStatus } from '\${CONFIG.packageName}';

async function createAndMonitorVideo() {
  const client = new VideoApiClient({
    bearerToken: process.env.VIDEO_JWT_TOKEN
  });

  try {
    // Create a complex video (likely to be async)
    const result = await client.videocreate({
      output_format: 'mp4',
      width: 3840,
      height: 2160,
      elements: [
        // Multiple elements for complex processing
        {
          id: 'main_video',
          type: 'video',
          source: 'https://example.com/main-4k.mp4',
          track: 0
        },
        {
          id: 'pip_video',
          type: 'video',
          source: 'https://example.com/speaker.mp4',
          track: 1,
          x: '70%',
          y: '70%',
          width: '25%',
          height: '25%'
        }
        // ... more elements
      ]
    });

    if (result.status === 'processing') {
      console.log('Video processing started:', result.job_id);

      // Monitor job status
      await monitorJob(client, result.job_id);
    } else {
      console.log('Video completed immediately:', result.result_url);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function monitorJob(client: VideoApiClient, jobId: string) {
  const maxAttempts = 60; // 10 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const status = await client.videoresult(jobId);

      console.log(\\\`Job \\\${jobId}: \\\${status.status} (\\\${status.progress || '0%'})\\\`);

      if (status.current_step) {
        console.log(\\\`Current step: \\\${status.current_step}\\\`);
      }

      if (status.status === JobStatus.COMPLETED) {
        console.log('✅ Video completed:', status.result_url);
        return status;
      } else if (status.status === JobStatus.FAILED) {
        console.error('❌ Video processing failed:', status.error);
        return status;
      }

      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
      attempts++;
    } catch (error) {
      console.error('Error checking job status:', error);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.warn('Job monitoring timed out');
}

createAndMonitorVideo();
\`;

    fs.writeFileSync(path.join(examplesDir, 'async-monitoring.ts'), asyncExample);

    console.log('✅ Generated examples');
  }

  // Utility methods
  ensureOutputDir() {
    this.ensureDir(CONFIG.outputDir);
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  toCamelCase(str) {
    return str
      .replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
      .replace(/^./, char => char.toLowerCase());
  }

  generateOperationId(path, method) {
    const cleanPath = path
      .replace(/^\//, '')
      .replace(/\{([^}]+)\}/g, 'By$1')
      .replace(/\//g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '');

    return method + cleanPath;
  }

  convertPathToTemplate(path) {
    return path.replace(/\{([^}]+)\}/g, '\${$1}');
  }

  generateQueryParamsType(queryParams) {
    const props = queryParams.map(param => {
      const type = this.getTypeScriptType(param.schema);
      const optional = !param.required ? '?' : '';
      return \`\${param.name}\${optional}: \${type}\`;
    });

    return \`{ \${props.join('; ')} }\`;
  }

  generateInlineObjectType(schema) {
    const properties = schema.properties || {};
    const props = Object.entries(properties).map(([name, prop]) => {
      const type = this.getTypeScriptType(prop);
      return \`\${name}: \${type}\`;
    });

    return \`{ \${props.join('; ')} }\`;
  }
}

// Main execution
if (require.main === module) {
  const generator = new SDKGenerator();
  generator.generate().catch(console.error);
}

module.exports = SDKGenerator;
