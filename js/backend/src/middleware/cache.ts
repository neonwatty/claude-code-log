import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

/**
 * Cache entry structure
 */
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  headers?: Record<string, string>;
  statusCode?: number;
}

/**
 * Cache configuration options
 */
interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  skipCache?: (req: Request) => boolean;
  vary?: string[]; // Headers to vary cache by
}

/**
 * In-memory cache implementation
 */
class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Generate cache key from request
   */
  private generateKey(req: Request, keyGenerator?: (req: Request) => string): string {
    if (keyGenerator) {
      return keyGenerator(req);
    }

    // Default key generation based on method, path, query, and body
    const keyData = {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
    };

    const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
    return createHash('sha256').update(keyString).digest('hex').substring(0, 16);
  }

  /**
   * Check if cache entry is valid
   */
  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Get cached entry
   */
  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }

    if (!this.isValid(entry)) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry;
  }

  /**
   * Set cache entry
   */
  set(key: string, data: any, ttl: number, headers?: Record<string, string>, statusCode?: number): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
      headers,
      statusCode,
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
    memoryUsage: number;
  } {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;
    
    // Estimate memory usage (rough calculation)
    let memoryUsage = 0;
    this.cache.forEach(entry => {
      memoryUsage += JSON.stringify(entry.data).length * 2; // Rough estimate
    });

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: Math.round(memoryUsage / 1024), // KB
    };
  }

  /**
   * Get cache entries for debugging
   */
  getEntries(): Array<{ key: string; timestamp: number; ttl: number; isValid: boolean; age: number }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      isValid: this.isValid(entry),
      age: Date.now() - entry.timestamp,
    }));
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    let removedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }
}

// Global cache instance
const globalCache = new MemoryCache(2000); // Increased size for API data

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const removed = globalCache.cleanup();
  if (removed > 0) {
    console.log(`Cache cleanup: removed ${removed} expired entries`);
  }
}, 5 * 60 * 1000);

/**
 * Response caching middleware
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes default
    keyGenerator,
    condition = () => true,
    skipCache = () => false,
    vary = [],
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for certain conditions
    if (skipCache(req) || !condition(req, res)) {
      return next();
    }

    // Only cache GET requests by default
    if (req.method !== 'GET' && !keyGenerator) {
      return next();
    }

    // Generate cache key
    const cacheKey = globalCache['generateKey'](req, keyGenerator);

    // Try to get cached response
    const cachedEntry = globalCache.get(cacheKey);
    if (cachedEntry) {
      // Set cached headers if available
      if (cachedEntry.headers) {
        Object.entries(cachedEntry.headers).forEach(([key, value]) => {
          res.set(key, value);
        });
      }

      // Add cache hit header
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', cacheKey);

      // Send cached response
      return res.status(cachedEntry.statusCode || 200).json(cachedEntry.data);
    }

    // Cache miss - intercept response
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    let statusCode = 200;

    // Override status method to capture status code
    res.status = function(code: number) {
      statusCode = code;
      return originalStatus(code);
    };

    // Override json method to cache response
    res.json = function(data: any) {
      // Only cache successful responses
      if (statusCode >= 200 && statusCode < 300) {
        // Capture response headers to vary by
        const varyHeaders: Record<string, string> = {};
        vary.forEach(header => {
          const value = res.get(header);
          if (value) {
            varyHeaders[header] = value;
          }
        });

        // Cache the response
        globalCache.set(cacheKey, data, ttl, varyHeaders, statusCode);

        // Add cache miss header
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Cache configuration for different route types
 */
export const cacheConfigs = {
  // Short cache for frequently changing data
  short: cacheMiddleware({
    ttl: 2 * 60 * 1000, // 2 minutes
    condition: (req, res) => req.method === 'GET' || req.method === 'POST',
  }),

  // Medium cache for semi-static data
  medium: cacheMiddleware({
    ttl: 10 * 60 * 1000, // 10 minutes
    condition: (req, res) => req.method === 'GET' || req.method === 'POST',
  }),

  // Long cache for static data
  long: cacheMiddleware({
    ttl: 30 * 60 * 1000, // 30 minutes
    condition: (req, res) => req.method === 'GET' || req.method === 'POST',
  }),

  // Session-specific cache
  session: cacheMiddleware({
    ttl: 5 * 60 * 1000, // 5 minutes
    keyGenerator: (req: Request) => {
      const keyData = {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        sessionId: req.body?.sessionId || req.query?.sessionId || 'no-session',
      };
      const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
      return createHash('sha256').update(keyString).digest('hex').substring(0, 16);
    },
  }),

  // Analytics cache with longer TTL
  analytics: cacheMiddleware({
    ttl: 15 * 60 * 1000, // 15 minutes
    keyGenerator: (req: Request) => {
      const keyData = {
        method: req.method,
        path: req.path,
        body: req.body?.directoryPath || req.query?.directoryPath || 'no-directory',
        criteria: req.body?.criteria || {},
      };
      const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
      return createHash('sha256').update(keyString).digest('hex').substring(0, 16);
    },
  }),

  // No cache for real-time data
  none: (req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  },
};

/**
 * Cache management endpoints
 */
export const cacheManagement = {
  /**
   * Get cache statistics
   */
  getStats: (req: Request, res: Response) => {
    try {
      const stats = globalCache.getStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get cache statistics',
      });
    }
  },

  /**
   * Get cache entries for debugging
   */
  getEntries: (req: Request, res: Response) => {
    try {
      const entries = globalCache.getEntries();
      res.json({
        success: true,
        data: entries,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get cache entries',
      });
    }
  },

  /**
   * Clear entire cache
   */
  clearCache: (req: Request, res: Response) => {
    try {
      globalCache.clear();
      res.json({
        success: true,
        message: 'Cache cleared successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache',
      });
    }
  },

  /**
   * Delete specific cache entry
   */
  deleteEntry: (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const deleted = globalCache.delete(key);
      
      if (deleted) {
        res.json({
          success: true,
          message: `Cache entry ${key} deleted successfully`,
        });
      } else {
        res.status(404).json({
          success: false,
          error: `Cache entry ${key} not found`,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete cache entry',
      });
    }
  },

  /**
   * Cleanup expired entries
   */
  cleanup: (req: Request, res: Response) => {
    try {
      const removed = globalCache.cleanup();
      res.json({
        success: true,
        message: `Cleaned up ${removed} expired cache entries`,
        removedCount: removed,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup cache',
      });
    }
  },
};

export default globalCache;