export interface DatabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export interface AWSConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
}

export interface SecurityConfig {
  corsOrigin: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

export interface ProcessingConfig {
  maxFileSizeMB: number;
  timeoutMs: number;
  quickThresholdMs: number;
  ffmpegPath?: string;
  ffprobePath?: string;
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'simple';
}
