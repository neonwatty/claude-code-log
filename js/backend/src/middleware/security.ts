import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

// Enhanced helmet configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for dashboard integration
  frameguard: { action: "deny" }, // Explicitly set X-Frame-Options to DENY
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Rate limiting configuration
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: "Too many requests from this IP, please try again later",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true, // Enable standard RateLimit-* headers
  legacyHeaders: true, // Enable legacy X-RateLimit-* headers for backwards compatibility
  // Skip rate limiting for health checks
  skip: (req: Request) => req.path === "/health",
  // Ensure headers are always set even when not limiting
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// Stricter rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit auth attempts
  message: {
    success: false,
    error: "Too many authentication attempts, please try again later",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// WebSocket connection rate limiting
export const wsRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit WebSocket connections per IP
  message: "Too many WebSocket connection attempts",
  standardHeaders: true,
  legacyHeaders: false,
});

// Security headers for API responses
export const apiSecurityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Add custom security headers
  res.setHeader("X-API-Version", "1.0.0");
  res.setHeader("X-Powered-By-Claude-Code-Log", "true");

  // Remove Express version header
  res.removeHeader("X-Powered-By");

  next();
};

// Request sanitization middleware
export const sanitizeRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Basic request sanitization
    if (req.body) {
      // Use WeakSet to detect circular references
      const seen = new WeakSet();

      const sanitizeValue = (value: any, depth = 0): any => {
        // Prevent infinite recursion
        if (depth > 10) {
          return value;
        }

        if (typeof value === "string") {
          // Check if the string is only a script tag
          const isOnlyScript = /^<script\b[^>]*>.*?<\/script>$/gi.test(value);

          return (
            value
              // Handle script tags: if it's only a script tag, preserve content; otherwise remove completely
              .replace(/<script\b[^>]*>(.*?)<\/script>/gi, (match, content) => {
                return isOnlyScript ? content : "";
              })
              // Replace javascript: protocols by removing the javascript: part
              .replace(/javascript:\s*/gi, "")
              // Remove event handlers from HTML attributes
              .replace(
                /<([^>]*)\s+on\w+\s*=\s*["']?[^"']*["']?([^>]*)>/gi,
                "<$1$2>",
              )
              // Remove standalone event handlers like "onload=bad()"
              .replace(/^on\w+\s*=\s*["']?([^"']*)["']?$/gi, "$1")
          );
        }

        if (Array.isArray(value)) {
          return value
            .map((item) => sanitizeValue(item, depth + 1))
            .filter((item) => item !== "" && item != null);
        }

        if (typeof value === "object" && value !== null) {
          // Check for circular reference
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);

          const sanitized: any = {};
          for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
              const sanitizedValue = sanitizeValue(value[key], depth + 1);
              if (sanitizedValue !== "") {
                sanitized[key] = sanitizedValue;
              }
            }
          }
          return sanitized;
        }

        return value;
      };

      req.body = sanitizeValue(req.body);
    }

    next();
  } catch (error) {
    console.error("Sanitization error:", error);
    // Don't throw 500 for circular references, just proceed
    next();
  }
};

// Request size limiting
export const requestSizeLimit = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const contentLength = parseInt(req.get("content-length") || "0", 10);
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  if (contentLength > MAX_SIZE) {
    return res.status(413).json({
      success: false,
      error: "Request payload too large",
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

// Environment-specific security configuration
export const getSecurityConfig = () => {
  const isDevelopment = process.env.NODE_ENV === "development";

  return {
    helmet: isDevelopment
      ? helmet({
          contentSecurityPolicy: false, // Disable CSP in development for easier debugging
        })
      : securityHeaders,

    rateLimit: isDevelopment
      ? {
          windowMs: 15 * 60 * 1000,
          max: 10000, // More lenient in development
          skip: () => true, // Skip rate limiting in development
        }
      : undefined,
  };
};
