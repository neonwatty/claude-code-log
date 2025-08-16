import { Request, Response } from 'express';
import { User } from '@shared/types';

// Extend Express Request interface to include user information
declare global {
  namespace Express {
    interface Request {
      user?: User;
      requestId?: string;
      startTime?: number;
    }
  }
}

// Custom request/response types for type safety
export interface AuthenticatedRequest extends Request {
  user: User;
}

export interface TypedRequest<T = any> extends Request {
  body: T;
}

export interface TypedResponse<T = any> extends Response {
  json: (body: T) => this;
}

// Common error types
export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

// Middleware types
export type AsyncMiddleware = (
  req: Request,
  res: Response,
  next: (error?: any) => void
) => Promise<void>;

export type ErrorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: (error?: any) => void
) => void;