/**
 * Performance optimization utilities
 * Provides debouncing, throttling, and memoization functions
 */

export type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
};

export type ThrottledFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

export type MemoizedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): ReturnType<T>;
  cache: Map<string, ReturnType<T>>;
  clear: () => void;
};

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  immediate = false
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = function (this: any, ...args: Parameters<T>) {
    lastArgs = args;
    
    const callNow = immediate && !timeoutId;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (!immediate && lastArgs) {
        fn.apply(this, lastArgs);
      }
    }, delay);

    if (callNow) {
      fn.apply(this, args);
    }
  } as DebouncedFunction<T>;

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  debounced.flush = function (this: any) {
    if (timeoutId && lastArgs) {
      fn.apply(this, lastArgs);
      debounced.cancel();
    }
  };

  return debounced;
}

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): ThrottledFunction<T> {
  const { leading = true, trailing = true } = options;
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: any = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttled = function (this: any, ...args: Parameters<T>) {
    lastArgs = args;
    lastThis = this;

    if (!inThrottle) {
      if (leading) {
        fn.apply(this, args);
      }
      
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
        
        if (trailing && lastArgs) {
          fn.apply(lastThis, lastArgs);
          lastArgs = null;
          lastThis = null;
        }
      }, limit);
    }
  } as ThrottledFunction<T>;

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    inThrottle = false;
    lastArgs = null;
    lastThis = null;
  };

  return throttled;
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string,
  maxCacheSize = 100
): MemoizedFunction<T> {
  const cache = new Map<string, ReturnType<T>>();

  const generateKey = keyGenerator || ((...args: Parameters<T>) => JSON.stringify(args));

  const memoized = function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = generateKey(...args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn.apply(this, args);
    
    // Implement LRU cache behavior
    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(key, result);
    return result;
  } as MemoizedFunction<T>;

  memoized.cache = cache;
  memoized.clear = () => cache.clear();

  return memoized;
}

/**
 * Create a batched function that collects calls and executes them together
 */
export function batch<T>(
  fn: (items: T[]) => void,
  delay = 0,
  maxBatchSize = 50
): (item: T) => void {
  let batch: T[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const processBatch = () => {
    if (batch.length > 0) {
      fn([...batch]);
      batch = [];
    }
    timeoutId = null;
  };

  return (item: T) => {
    batch.push(item);

    if (batch.length >= maxBatchSize) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      processBatch();
    } else if (!timeoutId) {
      timeoutId = setTimeout(processBatch, delay);
    }
  };
}

/**
 * Create a rate-limited function that ensures minimum time between calls
 */
export function rateLimit<T extends (...args: any[]) => any>(
  fn: T,
  minInterval: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let lastCallTime = 0;
  let pending: Promise<ReturnType<T>> | null = null;

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= minInterval) {
      lastCallTime = now;
      return fn(...args);
    }

    if (pending) {
      return pending;
    }

    const waitTime = minInterval - timeSinceLastCall;
    pending = new Promise((resolve) => {
      setTimeout(() => {
        lastCallTime = Date.now();
        resolve(fn(...args));
        pending = null;
      }, waitTime);
    });

    return pending;
  };
}

/**
 * Create a cache with TTL (Time To Live)
 */
export class TTLCache<K, V> {
  private cache = new Map<K, { value: V; expiry: number }>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 60000) {
    this.defaultTTL = defaultTTL;
  }

  set(key: K, value: V, ttl?: number): void {
    const expiry = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { value, expiry });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    // Clean expired entries before returning size
    this.cleanup();
    return this.cache.size;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Request idle callback polyfill
 */
export function requestIdleCallback(
  callback: (deadline: { timeRemaining: () => number; didTimeout: boolean }) => void,
  options: { timeout?: number } = {}
): number {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }

  // Polyfill
  const start = Date.now();
  return setTimeout(() => {
    callback({
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      didTimeout: false,
    });
  }, 1) as any;
}

/**
 * Cancel idle callback
 */
export function cancelIdleCallback(id: number): void {
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Execute function during idle time
 */
export function runWhenIdle<T>(
  fn: () => T,
  timeout = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = requestIdleCallback(
      (deadline) => {
        try {
          if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
            resolve(fn());
          } else {
            // Reschedule if no time remaining
            runWhenIdle(fn, timeout).then(resolve).catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      },
      { timeout }
    );
  });
}