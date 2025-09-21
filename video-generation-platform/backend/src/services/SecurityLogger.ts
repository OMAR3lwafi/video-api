import { logger } from '../config/monitoring';
import { SecurityEvent, SecurityEventType, SecuritySeverity } from '../types/auth';

export class SecurityLogger {
  /**
   * Log a security event
   */
  async logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date()
    };

    // Log to Winston logger with appropriate level based on severity
    const logLevel = this.getLogLevel(event.severity);
    
    logger.log(logLevel, 'Security Event', {
      eventId: securityEvent.id,
      type: securityEvent.type,
      severity: securityEvent.severity,
      description: securityEvent.description,
      userId: securityEvent.userId,
      ipAddress: securityEvent.ipAddress,
      userAgent: securityEvent.userAgent,
      metadata: securityEvent.metadata,
      timestamp: securityEvent.timestamp.toISOString(),
      category: 'security'
    });

    // For high/critical events, also log to error level for alerting
    if (event.severity === SecuritySeverity.HIGH || event.severity === SecuritySeverity.CRITICAL) {
      logger.error('Critical Security Event', {
        eventId: securityEvent.id,
        type: securityEvent.type,
        severity: securityEvent.severity,
        description: securityEvent.description,
        userId: securityEvent.userId,
        ipAddress: securityEvent.ipAddress,
        metadata: securityEvent.metadata,
        alert: true
      });
    }

    // Store in database for security monitoring (implement if needed)
    // await this.storeSecurityEvent(securityEvent);
  }

  /**
   * Log authentication success
   */
  async logAuthSuccess(userId: string, ipAddress: string, userAgent: string, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent({
      userId,
      type: SecurityEventType.LOGIN_SUCCESS,
      severity: SecuritySeverity.LOW,
      description: 'User successfully authenticated',
      ipAddress,
      userAgent,
      metadata: {
        ...metadata,
        loginTime: new Date().toISOString()
      }
    });
  }

  /**
   * Log authentication failure
   */
  async logAuthFailure(email: string, ipAddress: string, userAgent: string, reason: string, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.LOGIN_FAILED,
      severity: SecuritySeverity.MEDIUM,
      description: `Authentication failed: ${reason}`,
      ipAddress,
      userAgent,
      metadata: {
        email,
        reason,
        ...metadata,
        failureTime: new Date().toISOString()
      }
    });
  }

  /**
   * Log account lockout
   */
  async logAccountLocked(userId: string, ipAddress: string, userAgent: string, lockDuration: number): Promise<void> {
    await this.logEvent({
      userId,
      type: SecurityEventType.ACCOUNT_LOCKED,
      severity: SecuritySeverity.HIGH,
      description: 'Account locked due to multiple failed login attempts',
      ipAddress,
      userAgent,
      metadata: {
        lockDurationMs: lockDuration,
        lockUntil: new Date(Date.now() + lockDuration).toISOString()
      }
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    description: string, 
    ipAddress: string, 
    userAgent: string, 
    severity: SecuritySeverity = SecuritySeverity.MEDIUM,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity,
      description,
      ipAddress,
      userAgent,
      metadata: {
        ...metadata,
        detectionTime: new Date().toISOString()
      }
    });
  }

  /**
   * Log rate limit exceeded
   */
  async logRateLimitExceeded(ipAddress: string, userAgent: string, endpoint: string, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecuritySeverity.MEDIUM,
      description: `Rate limit exceeded for endpoint: ${endpoint}`,
      ipAddress,
      userAgent,
      metadata: {
        endpoint,
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log invalid token usage
   */
  async logInvalidToken(ipAddress: string, userAgent: string, tokenType: string, reason: string): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.INVALID_TOKEN,
      severity: SecuritySeverity.MEDIUM,
      description: `Invalid ${tokenType} token: ${reason}`,
      ipAddress,
      userAgent,
      metadata: {
        tokenType,
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log unauthorized access attempt
   */
  async logUnauthorizedAccess(
    userId: string | undefined, 
    ipAddress: string, 
    userAgent: string, 
    resource: string, 
    action: string
  ): Promise<void> {
    await this.logEvent({
      ...(userId && { userId }),
      type: SecurityEventType.UNAUTHORIZED_ACCESS,
      severity: SecuritySeverity.HIGH,
      description: `Unauthorized access attempt to ${resource}`,
      ipAddress,
      userAgent,
      metadata: {
        resource,
        action,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log malicious request
   */
  async logMaliciousRequest(
    ipAddress: string, 
    userAgent: string, 
    requestData: any, 
    reason: string
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.MALICIOUS_REQUEST,
      severity: SecuritySeverity.HIGH,
      description: `Malicious request detected: ${reason}`,
      ipAddress,
      userAgent,
      metadata: {
        reason,
        requestData: this.sanitizeRequestData(requestData),
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log file upload security event
   */
  async logFileUploadBlocked(
    userId: string | undefined,
    ipAddress: string,
    userAgent: string,
    filename: string,
    reason: string
  ): Promise<void> {
    await this.logEvent({
      ...(userId && { userId }),
      type: SecurityEventType.FILE_UPLOAD_BLOCKED,
      severity: SecuritySeverity.HIGH,
      description: `File upload blocked: ${reason}`,
      ipAddress,
      userAgent,
      metadata: {
        filename,
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Map security severity to log level
   */
  private getLogLevel(severity: SecuritySeverity): string {
    switch (severity) {
      case SecuritySeverity.LOW:
        return 'info';
      case SecuritySeverity.MEDIUM:
        return 'warn';
      case SecuritySeverity.HIGH:
      case SecuritySeverity.CRITICAL:
        return 'error';
      default:
        return 'info';
    }
  }

  /**
   * Sanitize request data for logging (remove sensitive information)
   */
  private sanitizeRequestData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeRequestData(sanitized[key]);
      }
    }

    return sanitized;
  }
}