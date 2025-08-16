import { Request, Response, NextFunction } from 'express';
import { isAppError, isOperationalError, getErrorResponse, InternalServerError } from '../utils/errors';
import { IApiResponse } from '../../../shared/src';

// Global error handler middleware
export const globalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error details
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Handle known application errors
  if (isAppError(error)) {
    const errorResponse = getErrorResponse(error);
    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Handle validation errors from express-validator
  if (error.name === 'ValidationError') {
    const response: IApiResponse = {
      success: false,
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
      details: error.message
    };
    res.status(400).json(response);
    return;
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && 'body' in error) {
    const response: IApiResponse = {
      success: false,
      error: 'Invalid JSON in request body',
      errorCode: 'INVALID_INPUT',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  // Handle rate limiting errors
  if (error.message === 'Too many requests') {
    const response: IApiResponse = {
      success: false,
      error: 'Rate limit exceeded',
      errorCode: 'RATE_LIMITED',
      timestamp: new Date().toISOString()
    };
    res.status(429).json(response);
    return;
  }

  // Handle CORS errors
  if (error.message === 'Not allowed by CORS') {
    const response: IApiResponse = {
      success: false,
      error: 'Origin not allowed by CORS policy',
      errorCode: 'FORBIDDEN',
      timestamp: new Date().toISOString()
    };
    res.status(403).json(response);
    return;
  }

  // Handle unexpected errors
  const internalError = new InternalServerError(
    process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : error.message,
    { originalError: error.message, stack: error.stack }
  );

  const errorResponse = getErrorResponse(internalError);
  res.status(internalError.statusCode).json(errorResponse);
};

// Async error wrapper - wraps async route handlers to catch errors
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  const response: IApiResponse = {
    success: false,
    error: `Route ${req.originalUrl} not found`,
    errorCode: 'NOT_FOUND',
    timestamp: new Date().toISOString()
  };
  res.status(404).json(response);
};

// Handle uncaught exceptions
export const handleUncaughtException = (error: Error): void => {
  console.error('Uncaught Exception:', error);
  
  // Log critical error
  console.error('CRITICAL: Uncaught Exception detected', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Graceful shutdown
  process.exit(1);
};

// Handle unhandled promise rejections
export const handleUnhandledRejection = (reason: any, promise: Promise<any>): void => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
  
  // Log critical error
  console.error('CRITICAL: Unhandled Promise Rejection detected', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    timestamp: new Date().toISOString()
  });

  // For operational errors, we can continue
  if (isOperationalError(reason)) {
    console.log('Operational error detected, continuing...');
    return;
  }

  // For programming errors, shut down gracefully
  console.log('Programming error detected, shutting down...');
  process.exit(1);
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log request
  console.log(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    
    // Log response
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode}`, {
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      success: body?.success ?? 'unknown',
      timestamp: new Date().toISOString()
    });

    return originalJson.call(this, body);
  };

  next();
};

// Health check error handler
export const healthCheckHandler = (req: Request, res: Response): void => {
  try {
    const response: IApiResponse = {
      success: true,
      data: { 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
      },
      timestamp: new Date().toISOString()
    };
    res.json(response);
  } catch (error) {
    const response: IApiResponse = {
      success: false,
      error: 'Health check failed',
      errorCode: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
};