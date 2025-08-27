/**
 * Performance Monitoring Utilities
 * Provides performance tracking and optimization tools
 */

export interface PerformanceEntry {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  type: 'render' | 'network' | 'computation' | 'user-interaction';
  metadata?: Record<string, any>;
}

export interface PerformanceThresholds {
  render: number; // ms
  network: number; // ms
  computation: number; // ms
  userInteraction: number; // ms
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;
  private entries: PerformanceEntry[] = [];
  private activeTimers = new Map<string, number>();
  private thresholds: PerformanceThresholds = {
    render: 16, // 60fps target
    network: 1000, // 1 second
    computation: 50, // 50ms for heavy computation
    userInteraction: 100, // 100ms for interactions
  };

  private constructor() {
    this.setupPerformanceObserver();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing a performance entry
   */
  public startTimer(name: string, type: PerformanceEntry['type'], metadata?: Record<string, any>): void {
    const startTime = performance.now();
    this.activeTimers.set(name, startTime);
    
    // Store metadata for later use
    if (metadata) {
      this.activeTimers.set(`${name}_metadata`, metadata as any);
    }
  }

  /**
   * End timing and record the entry
   */
  public endTimer(name: string): PerformanceEntry | null {
    const endTime = performance.now();
    const startTime = this.activeTimers.get(name);
    
    if (!startTime) {
      console.warn(`No timer found for: ${name}`);
      return null;
    }

    const metadata = this.activeTimers.get(`${name}_metadata`) as Record<string, any>;
    const duration = endTime - startTime;
    
    const entry: PerformanceEntry = {
      name,
      startTime,
      endTime,
      duration,
      type: this.inferType(name),
      metadata,
    };

    this.entries.push(entry);
    this.activeTimers.delete(name);
    if (metadata) {
      this.activeTimers.delete(`${name}_metadata`);
    }

    this.checkThreshold(entry);
    return entry;
  }

  /**
   * Measure a function execution time
   */
  public async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    type: PerformanceEntry['type'] = 'computation'
  ): Promise<T> {
    this.startTimer(name, type);
    try {
      const result = await fn();
      this.endTimer(name);
      return result;
    } catch (error) {
      this.endTimer(name);
      throw error;
    }
  }

  /**
   * Measure synchronous function execution time
   */
  public measure<T>(
    name: string,
    fn: () => T,
    type: PerformanceEntry['type'] = 'computation'
  ): T {
    this.startTimer(name, type);
    try {
      const result = fn();
      this.endTimer(name);
      return result;
    } catch (error) {
      this.endTimer(name);
      throw error;
    }
  }

  /**
   * Get performance entries with optional filtering
   */
  public getEntries(
    type?: PerformanceEntry['type'],
    name?: string,
    limit?: number
  ): PerformanceEntry[] {
    let filtered = this.entries;

    if (type) {
      filtered = filtered.filter(entry => entry.type === type);
    }

    if (name) {
      filtered = filtered.filter(entry => entry.name.includes(name));
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * Get performance statistics
   */
  public getStats(type?: PerformanceEntry['type']): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } {
    const entries = this.getEntries(type);
    
    if (entries.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, p95: 0 };
    }

    const durations = entries.map(e => e.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, val) => acc + val, 0);
    const p95Index = Math.floor(durations.length * 0.95);

    return {
      count: entries.length,
      average: sum / entries.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p95: durations[p95Index],
    };
  }

  /**
   * Set performance thresholds
   */
  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Clear all performance entries
   */
  public clear(): void {
    this.entries = [];
  }

  /**
   * Setup native performance observer for additional metrics
   */
  private setupPerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            this.entries.push({
              name: 'LCP',
              startTime: entry.startTime,
              endTime: entry.startTime + entry.duration,
              duration: entry.duration,
              type: 'render',
              metadata: { entryType: entry.entryType },
            });
          }
        }
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }
  }

  /**
   * Infer performance entry type from name
   */
  private inferType(name: string): PerformanceEntry['type'] {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('render') || lowerName.includes('paint') || lowerName.includes('draw')) {
      return 'render';
    }
    
    if (lowerName.includes('fetch') || lowerName.includes('request') || lowerName.includes('load')) {
      return 'network';
    }
    
    if (lowerName.includes('click') || lowerName.includes('input') || lowerName.includes('interaction')) {
      return 'user-interaction';
    }
    
    return 'computation';
  }

  /**
   * Check if entry exceeds thresholds and warn
   */
  private checkThreshold(entry: PerformanceEntry): void {
    const threshold = this.thresholds[entry.type];
    
    if (entry.duration > threshold) {
      console.warn(
        `Performance threshold exceeded for ${entry.name}: ${entry.duration.toFixed(2)}ms (threshold: ${threshold}ms)`
      );
    }
  }
}

/**
 * Convenience function to get the performance monitor instance
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  return PerformanceMonitor.getInstance();
}

/**
 * Performance decorator for class methods
 */
export function measurePerformance(type: PerformanceEntry['type'] = 'computation') {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const monitor = getPerformanceMonitor();
      const name = `${_target.constructor.name}.${_propertyName}`;
      
      if (originalMethod.constructor.name === 'AsyncFunction') {
        return monitor.measureAsync(name, () => originalMethod.apply(this, args), type);
      } else {
        return monitor.measure(name, () => originalMethod.apply(this, args), type);
      }
    };

    return descriptor;
  };
}