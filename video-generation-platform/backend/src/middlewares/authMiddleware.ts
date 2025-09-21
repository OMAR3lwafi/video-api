import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { SecurityLogger } from '../services/SecurityLogger';
import { AuthenticationError, ValidationError } from '../errors';
import { User, UserRole, PERMISSIONS, ROLE_PERMISSIONS, JWTPayload } from '../types/auth';
import { logger } from '../config/monitoring';

export class AuthMiddleware {
  private authService: AuthService;
  private securityLogger: SecurityLogger;

  constructor() {
    this.authService = new AuthService();
    this.securityLogger = new SecurityLogger();
  }

  /**
   * Middleware to authenticate JWT tokens
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        await this.logUnauthorizedAccess(req, 'Missing authorization header');
        throw new AuthenticationError('Authorization header is required');
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        await this.logUnauthorizedAccess(req, 'Invalid authorization header format');
        throw new AuthenticationError('Invalid authorization header format');
      }

      const token = parts[1];
      if (!token) {
        await this.logUnauthorizedAccess(req, 'Missing token');
        throw new AuthenticationError('Token is required');
      }

      // Verify JWT token
      const payload: JWTPayload = await this.authService.verifyAccessToken(token);
      
      // TODO: Fetch user from database using payload.userId
      // For now, create a mock user object from JWT payload
      const user: User = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        failedLoginAttempts: 0
      };

      // Check if user is active
      if (!user.isActive) {
        await this.logUnauthorizedAccess(req, 'Inactive user account', user.id);
        throw new AuthenticationError('Account is inactive');
      }

      // Attach user to request
      req.user = user;

      // Log successful authentication
      await this.securityLogger.logAuthSuccess(
        user.id,
        this.authService.extractIpAddress(req),
        this.authService.extractUserAgent(req),
        {
          correlationId: req.correlationId,
          endpoint: req.originalUrl,
          method: req.method
        }
      );

      next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
          timestamp: new Date().toISOString(),
          correlationId: req.correlationId
        });
      } else {
        logger.error('Authentication middleware error:', error);
        res.status(500).json({
          error: 'InternalServerError',
          message: 'Authentication failed',
          timestamp: new Date().toISOString(),
          correlationId: req.correlationId
        });
      }
    }
  };

  /**
   * Middleware to authorize based on user roles
   */
  authorize = (requiredRoles: UserRole[]) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AuthenticationError('User not authenticated');
        }

        const userRole = req.user.role;
        
        if (!requiredRoles.includes(userRole)) {
          await this.logUnauthorizedAccess(
            req, 
            `Insufficient role permissions. Required: ${requiredRoles.join(', ')}, User has: ${userRole}`,
            req.user.id
          );
          
          throw new AuthenticationError('Insufficient permissions');
        }

        next();
      } catch (error) {
        if (error instanceof AuthenticationError) {
          res.status(403).json({
            error: 'Forbidden',
            message: error.message,
            timestamp: new Date().toISOString(),
            correlationId: req.correlationId
          });
        } else {
          logger.error('Authorization middleware error:', error);
          res.status(500).json({
            error: 'InternalServerError',
            message: 'Authorization failed',
            timestamp: new Date().toISOString(),
            correlationId: req.correlationId
          });
        }
      }
    };
  };

  /**
   * Middleware to check specific permissions
   */
  requirePermission = (permission: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AuthenticationError('User not authenticated');
        }

        const userPermissions = ROLE_PERMISSIONS[req.user.role];
        
        if (!userPermissions.includes(permission)) {
          await this.logUnauthorizedAccess(
            req,
            `Missing required permission: ${permission}`,
            req.user.id
          );
          
          throw new AuthenticationError(`Permission required: ${permission}`);
        }

        next();
      } catch (error) {
        if (error instanceof AuthenticationError) {
          res.status(403).json({
            error: 'Forbidden',
            message: error.message,
            timestamp: new Date().toISOString(),
            correlationId: req.correlationId
          });
        } else {
          logger.error('Permission middleware error:', error);
          res.status(500).json({
            error: 'InternalServerError',
            message: 'Permission check failed',
            timestamp: new Date().toISOString(),
            correlationId: req.correlationId
          });
        }
      }
    };
  };

  /**
   * Optional authentication middleware (doesn't fail if no token)
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return next();
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return next();
      }

      const token = parts[1];
      if (!token) {
        return next();
      }

      try {
        const payload: JWTPayload = await this.authService.verifyAccessToken(token);
        
        // TODO: Fetch user from database
        const user: User = {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          failedLoginAttempts: 0
        };

        if (user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Silently ignore token errors for optional auth
        logger.debug('Optional auth token verification failed:', error);
      }

      next();
    } catch (error) {
      logger.error('Optional auth middleware error:', error);
      next(); // Continue without authentication
    }
  };

  /**
   * Middleware to check if user owns the resource
   */
  requireOwnership = (resourceIdParam: string = 'id') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AuthenticationError('User not authenticated');
        }

        // Admin users can access any resource
        if (req.user.role === UserRole.ADMIN) {
          return next();
        }

        const resourceId = req.params[resourceIdParam];
        
        if (!resourceId) {
          throw new AuthenticationError('Resource ID is required');
        }
        
        // TODO: Implement resource ownership check based on your data model
        // This is a placeholder implementation
        const isOwner = await this.checkResourceOwnership(req.user.id, resourceId);
        
        if (!isOwner) {
          await this.logUnauthorizedAccess(
            req,
            `User does not own resource: ${resourceId}`,
            req.user.id
          );
          
          throw new AuthenticationError('You do not have access to this resource');
        }

        next();
      } catch (error) {
        if (error instanceof AuthenticationError) {
          res.status(403).json({
            error: 'Forbidden',
            message: error.message,
            timestamp: new Date().toISOString(),
            correlationId: req.correlationId
          });
        } else {
          logger.error('Ownership middleware error:', error);
          res.status(500).json({
            error: 'InternalServerError',
            message: 'Ownership check failed',
            timestamp: new Date().toISOString(),
            correlationId: req.correlationId
          });
        }
      }
    };
  };

  /**
   * API Key authentication middleware
   */
  authenticateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        throw new AuthenticationError('API key is required');
      }

      // TODO: Validate API key against database
      const isValidApiKey = await this.validateApiKey(apiKey);
      
      if (!isValidApiKey) {
        await this.logUnauthorizedAccess(req, 'Invalid API key');
        throw new AuthenticationError('Invalid API key');
      }

      // TODO: Get user associated with API key
      // For now, create a service account user
      req.user = {
        id: 'api-key-user',
        email: 'api@service.com',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        failedLoginAttempts: 0
      };

      next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
          timestamp: new Date().toISOString(),
          correlationId: req.correlationId
        });
      } else {
        logger.error('API key authentication error:', error);
        res.status(500).json({
          error: 'InternalServerError',
          message: 'API key authentication failed',
          timestamp: new Date().toISOString(),
          correlationId: req.correlationId
        });
      }
    }
  };

  /**
   * Log unauthorized access attempts
   */
  private async logUnauthorizedAccess(req: Request, reason: string, userId?: string): Promise<void> {
    await this.securityLogger.logUnauthorizedAccess(
      userId,
      this.authService.extractIpAddress(req),
      this.authService.extractUserAgent(req),
      req.originalUrl,
      req.method
    );
  }

  /**
   * Check if user owns a resource (placeholder implementation)
   */
  private async checkResourceOwnership(userId: string, resourceId: string): Promise<boolean> {
    // TODO: Implement actual ownership check based on your data model
    // This could involve checking database records, etc.
    return true; // Placeholder
  }

  /**
   * Validate API key (placeholder implementation)
   */
  private async validateApiKey(apiKey: string): Promise<boolean> {
    // TODO: Implement actual API key validation
    // Check against database, validate format, check expiration, etc.
    return apiKey.startsWith('vp_'); // Placeholder validation
  }
}

// Create singleton instance
const authMiddleware = new AuthMiddleware();

// Export middleware functions
export const authenticate = authMiddleware.authenticate;
export const authorize = authMiddleware.authorize;
export const requirePermission = authMiddleware.requirePermission;
export const optionalAuth = authMiddleware.optionalAuth;
export const requireOwnership = authMiddleware.requireOwnership;
export const authenticateApiKey = authMiddleware.authenticateApiKey;