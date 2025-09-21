import { Request, Response, NextFunction } from 'express';
import { OpenAPIV3 } from 'openapi-types';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ApiError } from '@/types/api';

// Custom AJV instance with enhanced validation
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  coerceTypes: true,
  removeAdditional: true,
  useDefaults: true,
  formats: {
    // Custom format for percentage strings
    percentage: /^\d+(\.\d+)?%$/,
    // Custom format for job IDs
    'job-id': /^job_[a-zA-Z0-9]+$/,
  }
});

// Add standard formats (date, uri, email, etc.)
addFormats(ajv);

// OpenAPI specification cache
let openApiSpec: OpenAPIV3.Document | null = null;
let compiledValidators: Map<string, Ajv.ValidateFunction> = new Map();

/**
 * Load and parse OpenAPI specification
 */
function loadOpenApiSpec(): OpenAPIV3.Document {
  if (openApiSpec) {
    return openApiSpec;
  }

  try {
    const specPath = path.resolve(__dirname, '../../../docs/openapi/video-api.yaml');
    const specContent = fs.readFileSync(specPath, 'utf8');
    openApiSpec = yaml.load(specContent) as OpenAPIV3.Document;

    console.log('✅ Loaded OpenAPI specification for validation');
    return openApiSpec;
  } catch (error) {
    console.error('❌ Failed to load OpenAPI specification:', error);
    throw new Error('OpenAPI specification not found or invalid');
  }
}

/**
 * Convert OpenAPI parameter to JSON Schema
 */
function parameterToSchema(parameter: OpenAPIV3.ParameterObject): object {
  return {
    type: 'object',
    properties: {
      [parameter.name]: parameter.schema || { type: 'string' }
    },
    required: parameter.required ? [parameter.name] : []
  };
}

/**
 * Convert OpenAPI request body to JSON Schema
 */
function requestBodyToSchema(requestBody: OpenAPIV3.RequestBodyObject): object | null {
  const content = requestBody.content;
  const jsonContent = content['application/json'];

  if (jsonContent && jsonContent.schema) {
    return jsonContent.schema as object;
  }

  return null;
}

/**
 * Resolve OpenAPI schema references
 */
function resolveSchemaRef(schema: any, spec: OpenAPIV3.Document): object {
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/', '').split('/');
    let resolved = spec as any;

    for (const segment of refPath) {
      resolved = resolved[segment];
      if (!resolved) {
        throw new Error(`Invalid schema reference: ${schema.$ref}`);
      }
    }

    return resolved;
  }

  // Recursively resolve nested references
  if (typeof schema === 'object' && schema !== null) {
    const resolvedSchema: any = Array.isArray(schema) ? [] : {};

    for (const key in schema) {
      if (schema[key] && typeof schema[key] === 'object') {
        resolvedSchema[key] = resolveSchemaRef(schema[key], spec);
      } else {
        resolvedSchema[key] = schema[key];
      }
    }

    return resolvedSchema;
  }

  return schema;
}

/**
 * Get validator for specific operation
 */
function getValidator(method: string, path: string, validationType: 'params' | 'query' | 'body'): Ajv.ValidateFunction | null {
  const validatorKey = `${method.toUpperCase()}:${path}:${validationType}`;

  if (compiledValidators.has(validatorKey)) {
    return compiledValidators.get(validatorKey)!;
  }

  const spec = loadOpenApiSpec();
  const pathItem = spec.paths?.[path];

  if (!pathItem) {
    return null;
  }

  const operation = pathItem[method.toLowerCase() as keyof OpenAPIV3.PathItemObject] as OpenAPIV3.OperationObject;

  if (!operation) {
    return null;
  }

  let schema: object | null = null;

  try {
    switch (validationType) {
      case 'params':
        const pathParams = operation.parameters?.filter(
          (p): p is OpenAPIV3.ParameterObject =>
            'in' in p && p.in === 'path'
        ) || [];

        if (pathParams.length > 0) {
          const properties: any = {};
          const required: string[] = [];

          pathParams.forEach(param => {
            properties[param.name] = resolveSchemaRef(param.schema || { type: 'string' }, spec);
            if (param.required) {
              required.push(param.name);
            }
          });

          schema = {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined
          };
        }
        break;

      case 'query':
        const queryParams = operation.parameters?.filter(
          (p): p is OpenAPIV3.ParameterObject =>
            'in' in p && p.in === 'query'
        ) || [];

        if (queryParams.length > 0) {
          const properties: any = {};
          const required: string[] = [];

          queryParams.forEach(param => {
            properties[param.name] = resolveSchemaRef(param.schema || { type: 'string' }, spec);
            if (param.required) {
              required.push(param.name);
            }
          });

          schema = {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined
          };
        }
        break;

      case 'body':
        if (operation.requestBody && 'content' in operation.requestBody) {
          const requestBodySchema = requestBodyToSchema(operation.requestBody);
          if (requestBodySchema) {
            schema = resolveSchemaRef(requestBodySchema, spec);
          }
        }
        break;
    }

    if (schema) {
      const validator = ajv.compile(schema);
      compiledValidators.set(validatorKey, validator);
      return validator;
    }
  } catch (error) {
    console.error(`Failed to compile validator for ${validatorKey}:`, error);
  }

  return null;
}

/**
 * Format validation errors
 */
function formatValidationErrors(errors: Ajv.ErrorObject[]): Array<{ field: string; message: string; value?: any }> {
  return errors.map(error => ({
    field: error.instancePath ? error.instancePath.replace(/^\//, '') : error.schemaPath.split('/').pop() || 'unknown',
    message: error.message || 'Validation failed',
    value: error.data
  }));
}

/**
 * OpenAPI validation middleware factory
 */
export function createOpenApiValidator(options: {
  validateParams?: boolean;
  validateQuery?: boolean;
  validateBody?: boolean;
  skipValidation?: (req: Request) => boolean;
} = {}) {
  const {
    validateParams = true,
    validateQuery = true,
    validateBody = true,
    skipValidation = () => false
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip validation if specified
    if (skipValidation(req)) {
      return next();
    }

    try {
      const method = req.method.toLowerCase();
      const path = req.route?.path || req.path;
      const errors: Array<{ field: string; message: string; value?: any }> = [];

      // Convert Express path to OpenAPI path format
      const openApiPath = path.replace(/:([^/]+)/g, '{$1}');

      // Validate path parameters
      if (validateParams && Object.keys(req.params).length > 0) {
        const paramsValidator = getValidator(method, openApiPath, 'params');
        if (paramsValidator && !paramsValidator(req.params)) {
          const paramErrors = formatValidationErrors(paramsValidator.errors || []);
          errors.push(...paramErrors);
        }
      }

      // Validate query parameters
      if (validateQuery && Object.keys(req.query).length > 0) {
        const queryValidator = getValidator(method, openApiPath, 'query');
        if (queryValidator && !queryValidator(req.query)) {
          const queryErrors = formatValidationErrors(queryValidator.errors || []);
          errors.push(...queryErrors);
        }
      }

      // Validate request body
      if (validateBody && req.body && Object.keys(req.body).length > 0) {
        const bodyValidator = getValidator(method, openApiPath, 'body');
        if (bodyValidator && !bodyValidator(req.body)) {
          const bodyErrors = formatValidationErrors(bodyValidator.errors || []);
          errors.push(...bodyErrors);
        }
      }

      // If there are validation errors, return 400
      if (errors.length > 0) {
        const apiError: ApiError = {
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          correlationId: req.headers['x-correlation-id'] as string,
          details: errors
        };

        return res.status(400).json(apiError);
      }

      next();
    } catch (error) {
      console.error('OpenAPI validation middleware error:', error);

      // In case of validation setup errors, log but don't block requests
      console.warn('Validation middleware failed, allowing request to proceed');
      next();
    }
  };
}

/**
 * Middleware to validate responses against OpenAPI spec (development only)
 */
export function createResponseValidator() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') {
      return next();
    }

    const originalSend = res.send;
    const originalJson = res.json;

    // Intercept res.json()
    res.json = function(body: any) {
      validateResponse(req, res, body);
      return originalJson.call(this, body);
    };

    // Intercept res.send()
    res.send = function(body: any) {
      if (res.getHeader('content-type')?.toString().includes('application/json')) {
        try {
          const jsonBody = typeof body === 'string' ? JSON.parse(body) : body;
          validateResponse(req, res, jsonBody);
        } catch (e) {
          // Not valid JSON, skip validation
        }
      }
      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Validate response against OpenAPI specification
 */
function validateResponse(req: Request, res: Response, body: any): void {
  try {
    const method = req.method.toLowerCase();
    const path = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();

    const spec = loadOpenApiSpec();
    const openApiPath = path.replace(/:([^/]+)/g, '{$1}');
    const pathItem = spec.paths?.[openApiPath];

    if (!pathItem) {
      return;
    }

    const operation = pathItem[method as keyof OpenAPIV3.PathItemObject] as OpenAPIV3.OperationObject;

    if (!operation?.responses) {
      return;
    }

    const response = operation.responses[statusCode] || operation.responses['default'];

    if (!response || !('content' in response)) {
      return;
    }

    const jsonContent = response.content?.['application/json'];

    if (!jsonContent?.schema) {
      return;
    }

    const schema = resolveSchemaRef(jsonContent.schema, spec);
    const validator = ajv.compile(schema);

    if (!validator(body)) {
      console.warn(`⚠️ Response validation failed for ${method.toUpperCase()} ${path}:`, {
        statusCode,
        errors: validator.errors,
        body
      });
    }
  } catch (error) {
    console.warn('Response validation error:', error);
  }
}

/**
 * Middleware to add OpenAPI validation to specific routes
 */
export const validateRequest = createOpenApiValidator();

/**
 * Middleware for parameter validation only
 */
export const validateParams = createOpenApiValidator({
  validateParams: true,
  validateQuery: false,
  validateBody: false
});

/**
 * Middleware for query parameter validation only
 */
export const validateQuery = createOpenApiValidator({
  validateParams: false,
  validateQuery: true,
  validateBody: false
});

/**
 * Middleware for request body validation only
 */
export const validateBody = createOpenApiValidator({
  validateParams: false,
  validateQuery: false,
  validateBody: true
});

/**
 * Utility function to clear validator cache (useful for hot reloading)
 */
export function clearValidatorCache(): void {
  compiledValidators.clear();
  openApiSpec = null;
  console.log('OpenAPI validator cache cleared');
}

/**
 * Health check for OpenAPI validation system
 */
export function validateOpenApiSystem(): boolean {
  try {
    loadOpenApiSpec();
    return true;
  } catch (error) {
    console.error('OpenAPI validation system health check failed:', error);
    return false;
  }
}

export default {
  validateRequest,
  validateParams,
  validateQuery,
  validateBody,
  createOpenApiValidator,
  createResponseValidator,
  clearValidatorCache,
  validateOpenApiSystem
};
