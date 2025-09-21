import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../config/monitoring';
import { 
  User, 
  UserRole, 
  JWTPayload, 
  AuthTokens, 
  LoginRequest, 
  RegisterRequest,
  SecurityEvent,
  SecurityEventType,
  SecuritySeverity
} from '../types/auth';
import { AuthenticationError, ValidationError } from '../errors';
import { SecurityLogger } from './SecurityLogger';

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly saltRounds: number;
  private readonly securityLogger: SecurityLogger;

  constructor() {
    this.jwtSecret = config.auth.jwtSecret;
    this.jwtRefreshSecret = config.auth.jwtRefreshSecret;
    this.accessTokenExpiry = config.auth.accessTokenExpiry;
    this.refreshTokenExpiry = config.auth.refreshTokenExpiry;
    this.saltRounds = config.auth.saltRounds;
    this.securityLogger = new SecurityLogger();

    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error('JWT secrets must be configured');
    }
  }

  /**
   * Generate JWT access and refresh tokens
   */
  async generateTokens(user: User): Promise<AuthTokens> {
    try {
      const jti = crypto.randomUUID();
      
      const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: user.id,
        email: user.email,
        role: user.role,
        jti
      };

      const accessToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.accessTokenExpiry,
        issuer: 'video-platform',
        audience: 'video-platform-users'
      });

      const refreshToken = jwt.sign(
        { userId: user.id, jti },
        this.jwtRefreshSecret,
        {
          expiresIn: this.refreshTokenExpiry,
          issuer: 'video-platform',
          audience: 'video-platform-users'
        }
      );

      // Calculate expiry time in seconds
      const decoded = jwt.decode(accessToken) as JWTPayload;
      const expiresIn = decoded.exp - decoded.iat;

      return {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: 'Bearer'
      };
    } catch (error) {
      logger.error('Error generating tokens:', error);
      throw new AuthenticationError('Failed to generate authentication tokens');
    }
  }

  /**
   * Verify JWT access token
   */
  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        issuer: 'video-platform',
        audience: 'video-platform-users'
      }) as JWTPayload;

      // Check if token is blacklisted (implement token blacklist if needed)
      // await this.checkTokenBlacklist(payload.jti);

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expired');
      }
      throw new AuthenticationError('Token verification failed');
    }
  }

  /**
   * Verify JWT refresh token
   */
  async verifyRefreshToken(token: string): Promise<{ userId: string; jti: string }> {
    try {
      const payload = jwt.verify(token, this.jwtRefreshSecret, {
        issuer: 'video-platform',
        audience: 'video-platform-users'
      }) as { userId: string; jti: string };

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid refresh token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Refresh token expired');
      }
      throw new AuthenticationError('Refresh token verification failed');
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      logger.error('Error hashing password:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Error verifying password:', error);
      return false;
    }
  }

  /**
   * Generate secure random token for password reset
   */
  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate secure API key
   */
  generateApiKey(): string {
    const prefix = 'vp_';
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `${prefix}${randomBytes}`;
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
      errors.push('Password must be less than 128 characters long');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common passwords (basic implementation)
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if account is locked due to failed login attempts
   */
  isAccountLocked(user: User): boolean {
    if (!user.lockedUntil) {
      return false;
    }
    
    return new Date() < user.lockedUntil;
  }

  /**
   * Calculate account lock duration based on failed attempts
   */
  calculateLockDuration(failedAttempts: number): number {
    // Progressive lockout: 5min, 15min, 30min, 1hr, 2hr, 4hr, 8hr, 24hr
    const lockoutMinutes = [5, 15, 30, 60, 120, 240, 480, 1440];
    const index = Math.min(failedAttempts - 3, lockoutMinutes.length - 1);
    return lockoutMinutes[index] * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    type: SecurityEventType,
    severity: SecuritySeverity,
    description: string,
    metadata: {
      userId?: string;
      ipAddress: string;
      userAgent: string;
      correlationId?: string;
      [key: string]: any;
    }
  ): Promise<void> {
    const event: Omit<SecurityEvent, 'id' | 'timestamp'> = {
      userId: metadata.userId,
      type,
      severity,
      description,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata
    };

    await this.securityLogger.logEvent(event);
  }

  /**
   * Extract IP address from request
   */
  extractIpAddress(req: any): string {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           'unknown';
  }

  /**
   * Extract user agent from request
   */
  extractUserAgent(req: any): string {
    return req.get('User-Agent') || 'unknown';
  }

  /**
   * Sanitize user data for logging (remove sensitive information)
   */
  sanitizeUserForLogging(user: User): Partial<User> {
    const { id, email, role, isActive, createdAt, lastLoginAt } = user;
    return { id, email, role, isActive, createdAt, lastLoginAt };
  }

  /**
   * Generate correlation ID for request tracking
   */
  generateCorrelationId(): string {
    return crypto.randomUUID();
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Rate limit key generator for authentication endpoints
   */
  generateRateLimitKey(ip: string, email?: string): string {
    if (email) {
      return `auth:${ip}:${email}`;
    }
    return `auth:${ip}`;
  }
}