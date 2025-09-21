import { Request } from 'express';
import { User } from './auth';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      startTime?: number;
      user?: User;
      requestId?: string;
      dbQueries?: Array<{
        query: string;
        params?: any;
        executionTime: number;
        timestamp: number;
      }>;
      dbQueryStartTime?: number;
      dbQueryTotalTime?: number;
      dbQueryCount?: number;
      cacheHit?: boolean;
      trackDbQuery?: (query: string, params?: any) => {
        end: () => void;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: User;
}

export interface RequestWithCorrelationId extends Request {
  correlationId: string;
  startTime: number;
}
