import { Request, Response, NextFunction } from "express";
import { performance } from "perf_hooks";
import { LRUCache } from "lru-cache";

// Response caching with LRU cache
const responseCache = new LRUCache<string, {
  data: any;
  headers: Record<string, string>;
  timestamp: number;
  etag: string;
}>({
  max: 500, // Maximum 500 cached responses
  ttl: 1000 * 60 * 5, // 5 minute TTL
});

// Static file caching headers
export const staticFileCache = (req: Request, res: Response, next: NextFunction): void => {
  const isStaticFile = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/.test(req.path);
  
  if (isStaticFile) {
    // Set cache headers for static files
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    res.setHeader('Expires', new Date(Date.now() + 31536000 * 1000).toUTCString());
  }
  
  next();
};

// ETag generation and validation
export const etagMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;
  
  res.send = function(body: any) {
    // Generate simple ETag based on content
    const etag = generateETag(body);
    
    if (etag) {
      res.setHeader('ETag', etag);
      
      // Check if client has matching ETag
      const clientETag = req.headers['if-none-match'];
      if (clientETag && clientETag === etag) {
        res.status(304).end();
        return res;
      }
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

// Response caching middleware for cacheable endpoints
export const responseCacheMiddleware = (cacheTTL: number = 300000) => { // 5 minutes default
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for certain paths
    const skipCache = ['/health', '/api/sessions/active', '/ws'].some(path => 
      req.path.startsWith(path)
    );
    
    if (skipCache) {
      return next();
    }

    const cacheKey = `${req.method}:${req.originalUrl}`;
    const cached = responseCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < cacheTTL) {
      // Serve from cache
      Object.entries(cached.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('ETag', cached.etag);
      
      // Check client ETag
      if (req.headers['if-none-match'] === cached.etag) {
        res.status(304).end();
        return;
      }
      
      res.json(cached.data);
      return;
    }

    // Override res.json to cache response
    const originalJson = res.json;
    res.json = function(body: any) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const etag = generateETag(body);
        const headers = {
          'Content-Type': 'application/json',
          'X-Cache': 'MISS',
          'ETag': etag
        };
        
        responseCache.set(cacheKey, {
          data: body,
          headers,
          timestamp: Date.now(),
          etag
        });
        
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      
      return originalJson.call(this, body);
    };
    
    next();
  };
};

// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  
  // Add performance metrics to response headers (only in development)
  if (process.env.NODE_ENV === 'development') {
    const originalSend = res.send;
    const originalJson = res.json;
    
    const addPerfHeaders = () => {
      const duration = performance.now() - startTime;
      const endMemory = process.memoryUsage();
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
      res.setHeader('X-Memory-Delta', `${memoryDelta} bytes`);
      res.setHeader('X-Process-Memory', `${endMemory.heapUsed} bytes`);
    };
    
    res.send = function(body: any) {
      addPerfHeaders();
      return originalSend.call(this, body);
    };
    
    res.json = function(body: any) {
      addPerfHeaders();
      return originalJson.call(this, body);
    };
  }
  
  next();
};

// Compression configuration for different content types
export const compressionConfig = {
  // Only compress responses above 1KB
  threshold: 1024,
  
  // Compression level (1-9, higher = better compression but slower)
  level: process.env.NODE_ENV === 'production' ? 6 : 1,
  
  // Custom filter for compressible content
  filter: (req: Request, res: Response): boolean => {
    // Don't compress if client doesn't accept gzip
    if (!req.headers['accept-encoding']?.includes('gzip')) {
      return false;
    }
    
    // Don't compress already compressed files
    const contentType = res.getHeader('Content-Type') as string;
    if (contentType?.includes('image/') || contentType?.includes('video/')) {
      return false;
    }
    
    // Compress text-based content
    return /json|text|javascript|css|xml|svg/.test(contentType || '');
  }
};

// Response optimization middleware
export const responseOptimization = (req: Request, res: Response, next: NextFunction): void => {
  // Remove unnecessary headers in production
  if (process.env.NODE_ENV === 'production') {
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
  }
  
  // Add performance hints
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DNS-Prefetch-Control', 'on');
  
  // Enable HTTP/2 server push hints (if supported)
  if (req.httpVersion === '2.0') {
    res.setHeader('Link', '</css/main.css>; rel=preload; as=style, </js/main.js>; rel=preload; as=script');
  }
  
  next();
};

// Keep-alive configuration for production
export const keepAliveConfig = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=5, max=1000');
  }
  
  next();
};

// Helper function to generate ETags
function generateETag(body: any): string {
  const content = typeof body === 'string' ? body : JSON.stringify(body);
  const hash = require('crypto')
    .createHash('md5')
    .update(content)
    .digest('hex');
  return `"${hash}"`;
}

// Memory usage optimization
export const memoryOptimization = (req: Request, res: Response, next: NextFunction): void => {
  // Force garbage collection in development (not recommended for production)
  if (process.env.NODE_ENV === 'development' && global.gc) {
    // Run GC after every 100 requests
    if (Math.random() < 0.01) {
      global.gc();
    }
  }
  
  next();
};

// Request timeout middleware
export const requestTimeout = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          errorCode: 'REQUEST_TIMEOUT',
          timestamp: new Date().toISOString()
        });
      }
    }, timeout);
    
    // Clear timeout when response is finished
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    
    next();
  };
};