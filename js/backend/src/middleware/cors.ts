import cors from 'cors';
import { Request } from 'express';

// Development origins
const developmentOrigins = [
  'http://localhost:5173',
  'http://localhost:5174', 
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

// Production origins (to be configured)
const productionOrigins = [
  'https://your-production-domain.com',
  'https://claude-code-log.app'
];

// Get allowed origins based on environment
const getAllowedOrigins = (): string[] => {
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  
  if (isDevelopment) {
    return developmentOrigins;
  }
  
  // In production, use environment variable or default production origins
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }
  
  return productionOrigins;
};

// Dynamic origin validation
const originValidator = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  const allowedOrigins = getAllowedOrigins();
  
  // Allow requests with no origin (mobile apps, curl, etc.)
  if (!origin) {
    return callback(null, true);
  }
  
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  
  // In development/test, be more permissive
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    // Allow localhost/127.0.0.1 with any port
    if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
      return callback(null, true);
    }
  }
  
  console.warn(`CORS blocked origin: ${origin}`);
  callback(new Error('Not allowed by CORS'), false);
};

// Main CORS configuration
export const corsConfig = cors({
  origin: originValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-API-Key',
    'X-Client-Version'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-API-Version',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  maxAge: 86400 // 24 hours - cache preflight responses
});

// WebSocket CORS validation
export const validateWebSocketOrigin = (origin: string | undefined): boolean => {
  if (!origin) {
    return true; // Allow requests with no origin
  }
  
  const allowedOrigins = getAllowedOrigins();
  
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  
  // In development/test, be more permissive
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
      return true;
    }
  }
  
  return false;
};

// Preflight handler for complex requests
export const handlePreflight = (req: Request, res: any) => {
  const origin = req.get('Origin');
  const method = req.get('Access-Control-Request-Method');
  const headers = req.get('Access-Control-Request-Headers');
  
  if (origin && validateWebSocketOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (method) {
      res.header('Access-Control-Allow-Methods', method);
    }
    
    if (headers) {
      res.header('Access-Control-Allow-Headers', headers);
    }
    
    res.header('Access-Control-Max-Age', '86400');
    res.sendStatus(200);
  } else {
    res.sendStatus(403);
  }
};

// Utility to check if origin is allowed
export const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true;
  
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin) || 
    ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && 
     !!origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/));
};