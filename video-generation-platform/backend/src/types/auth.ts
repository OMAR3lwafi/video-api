export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  PREMIUM = 'premium',
  GUEST = 'guest'
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
  jti: string; // JWT ID for token blacklisting
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface SecurityEvent {
  id: string;
  userId?: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  description: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export enum SecurityEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_TOKEN = 'invalid_token',
  TOKEN_EXPIRED = 'token_expired',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  FILE_UPLOAD_BLOCKED = 'file_upload_blocked',
  MALICIOUS_REQUEST = 'malicious_request'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  correlationId: string;
}

export interface RolePermissions {
  [UserRole.ADMIN]: string[];
  [UserRole.PREMIUM]: string[];
  [UserRole.USER]: string[];
  [UserRole.GUEST]: string[];
}

export const PERMISSIONS = {
  // Video operations
  CREATE_VIDEO: 'video:create',
  VIEW_VIDEO: 'video:view',
  DELETE_VIDEO: 'video:delete',
  DOWNLOAD_VIDEO: 'video:download',
  
  // Job operations
  VIEW_JOBS: 'jobs:view',
  CANCEL_JOB: 'jobs:cancel',
  VIEW_ALL_JOBS: 'jobs:view_all',
  
  // Admin operations
  MANAGE_USERS: 'admin:users',
  VIEW_ANALYTICS: 'admin:analytics',
  MANAGE_SYSTEM: 'admin:system',
  
  // File operations
  UPLOAD_FILE: 'file:upload',
  UPLOAD_LARGE_FILE: 'file:upload_large',
} as const;

export const ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.ADMIN]: Object.values(PERMISSIONS),
  [UserRole.PREMIUM]: [
    PERMISSIONS.CREATE_VIDEO,
    PERMISSIONS.VIEW_VIDEO,
    PERMISSIONS.DELETE_VIDEO,
    PERMISSIONS.DOWNLOAD_VIDEO,
    PERMISSIONS.VIEW_JOBS,
    PERMISSIONS.CANCEL_JOB,
    PERMISSIONS.UPLOAD_FILE,
    PERMISSIONS.UPLOAD_LARGE_FILE,
  ],
  [UserRole.USER]: [
    PERMISSIONS.CREATE_VIDEO,
    PERMISSIONS.VIEW_VIDEO,
    PERMISSIONS.DELETE_VIDEO,
    PERMISSIONS.DOWNLOAD_VIDEO,
    PERMISSIONS.VIEW_JOBS,
    PERMISSIONS.CANCEL_JOB,
    PERMISSIONS.UPLOAD_FILE,
  ],
  [UserRole.GUEST]: [
    PERMISSIONS.VIEW_VIDEO,
  ],
};