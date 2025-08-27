import { Request, Response, NextFunction } from "express";
import { SessionData } from "express-session";

// Extend Request interface to include session
declare module "express-serve-static-core" {
  interface Request {
    session?: SessionData & {
      csrfToken?: string;
    };
  }
}
import crypto from "crypto";

// IP whitelist for production (can be configured via environment variables)
const ALLOWED_IPS = process.env.ALLOWED_IPS?.split(',') || [];
const BLOCKED_IPS = process.env.BLOCKED_IPS?.split(',') || [];

// Request signature validation for API security
export const requestSignatureValidation = (secret: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip validation in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    
    if (!signature || !timestamp) {
      res.status(401).json({
        success: false,
        error: 'Missing required security headers',
        errorCode: 'MISSING_SECURITY_HEADERS',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check timestamp is not too old (5 minutes)
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    if (now - requestTime > 300000) {
      res.status(401).json({
        success: false,
        error: 'Request timestamp too old',
        errorCode: 'EXPIRED_REQUEST',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate signature
    const body = JSON.stringify(req.body || {});
    const payload = `${req.method}:${req.originalUrl}:${timestamp}:${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      res.status(401).json({
        success: false,
        error: 'Invalid request signature',
        errorCode: 'INVALID_SIGNATURE',
        timestamp: new Date().toISOString()
      });
      return;
    }

    next();
  };
};

// IP filtering middleware
export const ipFilter = (req: Request, res: Response, next: NextFunction): void => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Check blocked IPs first
  if (BLOCKED_IPS.length > 0 && clientIP && BLOCKED_IPS.includes(clientIP)) {
    res.status(403).json({
      success: false,
      error: 'IP address blocked',
      errorCode: 'IP_BLOCKED',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // If whitelist is configured, only allow whitelisted IPs
  if (ALLOWED_IPS.length > 0 && clientIP && !ALLOWED_IPS.includes(clientIP)) {
    res.status(403).json({
      success: false,
      error: 'IP address not allowed',
      errorCode: 'IP_NOT_ALLOWED',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};

// Enhanced request validation
export const enhancedRequestValidation = (req: Request, res: Response, next: NextFunction): void => {
  // Check for suspicious user agents
  const userAgent = req.get('User-Agent') || '';
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i
  ];

  if (process.env.NODE_ENV === 'production' && suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    res.status(403).json({
      success: false,
      error: 'Automated requests not allowed',
      errorCode: 'AUTOMATED_REQUEST_BLOCKED',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Check for required headers in production
  if (process.env.NODE_ENV === 'production') {
    const requiredHeaders = ['user-agent', 'accept'];
    for (const header of requiredHeaders) {
      if (!req.get(header)) {
        res.status(400).json({
          success: false,
          error: `Missing required header: ${header}`,
          errorCode: 'MISSING_REQUIRED_HEADER',
          timestamp: new Date().toISOString()
        });
        return;
      }
    }
  }

  // Validate request method
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  if (!allowedMethods.includes(req.method)) {
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
      errorCode: 'METHOD_NOT_ALLOWED',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};

// Content validation middleware
export const contentValidation = (req: Request, res: Response, next: NextFunction): void => {
  // Validate JSON content for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        // Ensure body is valid JSON if Content-Type claims it is
        if (typeof req.body !== 'object') {
          res.status(400).json({
            success: false,
            error: 'Invalid JSON in request body',
            errorCode: 'INVALID_JSON',
            timestamp: new Date().toISOString()
          });
          return;
        }
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Malformed JSON in request body',
          errorCode: 'MALFORMED_JSON',
          timestamp: new Date().toISOString()
        });
        return;
      }
    }
  }

  next();
};

// Session security (if sessions are implemented)
export const sessionSecurity = (req: Request, res: Response, next: NextFunction): void => {
  // Add secure cookie settings for production
  if (process.env.NODE_ENV === 'production') {
    res.cookie('session-secure', 'true', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });
  }

  next();
};

// Anti-CSRF token validation
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF for GET requests and in development
  if (req.method === 'GET' || process.env.NODE_ENV === 'development') {
    return next();
  }

  const csrfToken = req.get('X-CSRF-Token') || req.body.csrfToken;
  const expectedToken = req.session?.csrfToken;

  if (!csrfToken || !expectedToken || csrfToken !== expectedToken) {
    res.status(403).json({
      success: false,
      error: 'Invalid or missing CSRF token',
      errorCode: 'CSRF_TOKEN_INVALID',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};

// Request fingerprinting for security analysis
export const requestFingerprinting = (req: Request, res: Response, next: NextFunction): void => {
  // Create a unique fingerprint for the request
  const fingerprint = crypto
    .createHash('sha256')
    .update([
      req.ip,
      req.get('User-Agent'),
      req.get('Accept-Language'),
      req.get('Accept-Encoding')
    ].join('|'))
    .digest('hex');

  // Add fingerprint to request for logging/analysis
  (req as any).fingerprint = fingerprint;

  // Log suspicious fingerprints (you could store these in a database)
  if (process.env.NODE_ENV === 'production') {
    console.log(`Request fingerprint: ${fingerprint}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// Rate limiting by user fingerprint
const fingerprintRateLimits = new Map<string, { count: number; resetTime: number }>();

export const fingerprintRateLimit = (maxRequests: number = 100, windowMs: number = 900000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const fingerprint = (req as any).fingerprint;
    if (!fingerprint) {
      return next();
    }

    const now = Date.now();
    const limit = fingerprintRateLimits.get(fingerprint);

    if (!limit || now > limit.resetTime) {
      // Reset or create new limit
      fingerprintRateLimits.set(fingerprint, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (limit.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded for this session',
        errorCode: 'FINGERPRINT_RATE_LIMITED',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Increment count
    limit.count++;
    fingerprintRateLimits.set(fingerprint, limit);
    
    next();
  };
};

// Security audit logging
export const securityAuditLog = (req: Request, res: Response, next: NextFunction): void => {
  // Log security-relevant events
  const securityLog = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.path,
    fingerprint: (req as any).fingerprint,
    headers: {
      referer: req.get('Referer'),
      origin: req.get('Origin'),
      'x-forwarded-for': req.get('X-Forwarded-For'),
    }
  };

  // Log in production for security analysis
  if (process.env.NODE_ENV === 'production') {
    console.log('[SECURITY AUDIT]', securityLog);
  }

  next();
};

// Production security check
export const productionSecurityCheck = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Ensure HTTPS in production
  if (!req.secure && req.get('X-Forwarded-Proto') !== 'https') {
    res.status(403).json({
      success: false,
      error: 'HTTPS required in production',
      errorCode: 'HTTPS_REQUIRED',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};