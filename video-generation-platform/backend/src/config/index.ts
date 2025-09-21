import { z } from 'zod';

// Environment validation schema
const configSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),
  
  // Database configuration
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),
  
  // AWS S3 configuration
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().min(1, 'AWS S3 bucket name is required'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS access key ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS secret access key is required'),
  
  // Security configuration
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // Authentication configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.string().transform(Number).default('12'),
  PASSWORD_RESET_EXPIRY_HOURS: z.string().transform(Number).default('1'),
  MAX_LOGIN_ATTEMPTS: z.string().transform(Number).default('5'),
  
  // Processing configuration
  MAX_FILE_SIZE_MB: z.string().transform(Number).default('500'),
  PROCESSING_TIMEOUT_MS: z.string().transform(Number).default('600000'), // 10 minutes
  QUICK_PROCESSING_THRESHOLD_MS: z.string().transform(Number).default('30000'), // 30 seconds
  MAX_CONCURRENT_JOBS: z.string().transform(Number).default('2'),
  REDIS_URL: z.string().optional(),
  
  // Logging configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
  
  // FFmpeg configuration
  FFMPEG_PATH: z.string().optional(),
  FFPROBE_PATH: z.string().optional(),
  
  // Application configuration
  APP_VERSION: z.string().default('1.0.0'),
});

type ConfigType = z.infer<typeof configSchema>;

class ConfigManager {
  private _config: ConfigType | null = null;

  get config(): ConfigType {
    if (!this._config) {
      this._config = this.validateConfig();
    }
    return this._config;
  }

  private validateConfig(): ConfigType {
    try {
      const rawConfig = {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        HOST: process.env.HOST,
        
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        
        AWS_REGION: process.env.AWS_REGION,
        AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        
        CORS_ORIGIN: process.env.CORS_ORIGIN,
        RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
        RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
        
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY,
        JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY,
        BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS,
        PASSWORD_RESET_EXPIRY_HOURS: process.env.PASSWORD_RESET_EXPIRY_HOURS,
        MAX_LOGIN_ATTEMPTS: process.env.MAX_LOGIN_ATTEMPTS,
        
        MAX_FILE_SIZE_MB: process.env.MAX_FILE_SIZE_MB,
        PROCESSING_TIMEOUT_MS: process.env.PROCESSING_TIMEOUT_MS,
        QUICK_PROCESSING_THRESHOLD_MS: process.env.QUICK_PROCESSING_THRESHOLD_MS,
        
        LOG_LEVEL: process.env.LOG_LEVEL,
        LOG_FORMAT: process.env.LOG_FORMAT,
        
        FFMPEG_PATH: process.env.FFMPEG_PATH,
        FFPROBE_PATH: process.env.FFPROBE_PATH,
        
        APP_VERSION: process.env.APP_VERSION,
      };

      return configSchema.parse(rawConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const missingFields = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        throw new Error(`Configuration validation failed:\n${missingFields.join('\n')}`);
      }
      throw error;
    }
  }

  // Helper methods for commonly used config groups
  get database() {
    return {
      url: this.config.SUPABASE_URL,
      anonKey: this.config.SUPABASE_ANON_KEY,
      serviceRoleKey: this.config.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  get aws() {
    return {
      region: this.config.AWS_REGION,
      bucket: this.config.AWS_S3_BUCKET,
      accessKeyId: this.config.AWS_ACCESS_KEY_ID,
      secretAccessKey: this.config.AWS_SECRET_ACCESS_KEY,
    };
  }

  get server() {
    return {
      port: this.config.PORT,
      host: this.config.HOST,
      nodeEnv: this.config.NODE_ENV,
      isDevelopment: this.config.NODE_ENV === 'development',
      isProduction: this.config.NODE_ENV === 'production',
      isTest: this.config.NODE_ENV === 'test',
    };
  }

  get security() {
    return {
      corsOrigin: this.config.CORS_ORIGIN,
      rateLimitWindowMs: this.config.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: this.config.RATE_LIMIT_MAX_REQUESTS,
    };
  }

  get auth() {
    return {
      jwtSecret: this.config.JWT_SECRET,
      jwtRefreshSecret: this.config.JWT_REFRESH_SECRET,
      accessTokenExpiry: this.config.JWT_ACCESS_EXPIRY,
      refreshTokenExpiry: this.config.JWT_REFRESH_EXPIRY,
      saltRounds: this.config.BCRYPT_SALT_ROUNDS,
      passwordResetExpiryHours: this.config.PASSWORD_RESET_EXPIRY_HOURS,
      maxLoginAttempts: this.config.MAX_LOGIN_ATTEMPTS,
    };
  }

  get processing() {
    return {
      maxFileSizeMB: this.config.MAX_FILE_SIZE_MB,
      timeoutMs: this.config.PROCESSING_TIMEOUT_MS,
      quickThresholdMs: this.config.QUICK_PROCESSING_THRESHOLD_MS,
      ffmpegPath: this.config.FFMPEG_PATH,
      ffprobePath: this.config.FFPROBE_PATH,
      maxConcurrentJobs: this.config.MAX_CONCURRENT_JOBS,
    };
  }

  get queue() {
    return {
      redisUrl: this.config.REDIS_URL,
      maxConcurrentJobs: this.config.MAX_CONCURRENT_JOBS,
    };
  }

  get logging() {
    return {
      level: this.config.LOG_LEVEL,
      format: this.config.LOG_FORMAT,
    };
  }

  get appVersion() {
    return this.config.APP_VERSION;
  }
}

const configManager = new ConfigManager();

// Export the config object for easy access
export const config = {
  ...configManager.server,
  database: configManager.database,
  aws: configManager.aws,
  security: configManager.security,
  auth: configManager.auth,
  processing: configManager.processing,
  logging: configManager.logging,
  appVersion: configManager.appVersion,
};

// Export the full config for advanced use cases
export const fullConfig = configManager.config;

// Export types
export type { ConfigType };
