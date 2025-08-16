import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { IApiResponse } from '../../../shared/src';

// Validation result handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const response: IApiResponse = {
      success: false,
      error: 'Validation failed',
      data: {
        errors: errors.array()
      },
      timestamp: new Date().toISOString()
    };
    
    return res.status(400).json(response);
  }
  
  next();
};

// Common validation rules
export const sessionIdValidation = param('id')
  .isUUID()
  .withMessage('Session ID must be a valid UUID');

export const paginationValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
    .toInt(),
  query('project')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Project filter must be a non-empty string with max 255 characters')
];

export const sessionContinueValidation = [
  body('sessionId')
    .isUUID()
    .withMessage('Session ID must be a valid UUID'),
  body('message')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 10000 })
    .withMessage('Message must be a string with max 10000 characters')
];

export const projectPathValidation = param('path')
  .isString()
  .withMessage('Project path must be a string')
  .customSanitizer((value) => {
    // Decode URI component and sanitize path
    return decodeURIComponent(value).replace(/[<>:"|?*]/g, '');
  });

// File upload validation (for future use)
export const fileUploadValidation = [
  body('fileName')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('File name must be between 1 and 255 characters')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('File name contains invalid characters'),
  body('fileSize')
    .isInt({ min: 1, max: 10485760 }) // 10MB max
    .withMessage('File size must be between 1 byte and 10MB')
];

// WebSocket message validation
export const webSocketMessageValidation = {
  type: (value: any) => {
    const validTypes = [
      'heartbeat', 'pong', 'session_created', 'session_updated', 
      'session_deleted', 'project_updated', 'file_changed', 'error'
    ];
    return typeof value === 'string' && validTypes.includes(value);
  },
  
  timestamp: (value: any) => {
    return typeof value === 'string' && !isNaN(Date.parse(value));
  },
  
  data: (value: any) => {
    return value === undefined || (typeof value === 'object' && value !== null);
  }
};

// API key validation (for future authentication)
export const apiKeyValidation = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.get('X-API-Key') || req.query.apiKey;
  
  // For now, skip API key validation in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  if (!apiKey) {
    const response: IApiResponse = {
      success: false,
      error: 'API key required',
      timestamp: new Date().toISOString()
    };
    return res.status(401).json(response);
  }
  
  // Validate API key format
  if (typeof apiKey !== 'string' || apiKey.length < 32) {
    const response: IApiResponse = {
      success: false,
      error: 'Invalid API key format',
      timestamp: new Date().toISOString()
    };
    return res.status(401).json(response);
  }
  
  // TODO: Validate against stored API keys
  // For now, accept any properly formatted key
  next();
};

// Request content type validation
export const jsonContentTypeValidation = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !contentType.includes('application/json')) {
      const response: IApiResponse = {
        success: false,
        error: 'Content-Type must be application/json',
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }
  }
  
  next();
};

// IP address validation for rate limiting bypass
export const isWhitelistedIP = (ip: string): boolean => {
  const whitelistedIPs = [
    '127.0.0.1',
    '::1',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ];
  
  // Simple IP check - in production, use proper CIDR matching
  return whitelistedIPs.some(whitelistedIP => 
    ip === whitelistedIP || ip.startsWith(whitelistedIP.split('/')[0])
  );
};