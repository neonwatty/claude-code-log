/**
 * Performance monitoring utilities for components
 * Provides runtime performance tracking and optimization recommendations
 */

/**
 * Performance metrics collected during monitoring
 */
export interface PerformanceMetrics {
  /** Component render time in milliseconds */
  renderTime: number;
  /** Update time for property changes */
  updateTime: number;
  /** Memory usage in bytes (if available) */
  memoryUsage?: number;
  /** Number of DOM nodes created */
  domNodeCount: number;
  /** Time spent in JavaScript execution */
  scriptTime: number;
  /** Number of style recalculations */
  styleRecalculations: number;
  /** Number of layout operations */
  layoutCount: number;
  /** Timestamp when metrics were collected */
  timestamp: number;
  /** Component identifier */
  componentId: string;
}

/**
 * Performance thresholds for optimization recommendations
 */
export interface PerformanceThresholds {
  maxRenderTime: number;
  maxUpdateTime: number;
  maxMemoryGrowth: number;
  maxDomNodes: number;
  maxStyleRecalculations: number;
  maxLayoutCount: number;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitorConfig {
  /** Enable detailed monitoring (has performance overhead) */
  detailed: boolean;
  /** Sampling interval in milliseconds */
  sampleInterval: number;
  /** Maximum number of metrics to keep in memory */
  maxMetrics: number;
  /** Thresholds for performance warnings */
  thresholds: PerformanceThresholds;
  /** Enable console logging of performance issues */
  logIssues: boolean;
}

/**
 * Performance optimization recommendation
 */
export interface PerformanceRecommendation {
  /** Type of optimization */
  type: 'virtualization' | 'lazy-loading' | 'memoization' | 'debouncing' | 'memory' | 'dom';
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable description */
  description: string;
  /** Specific metric that triggered the recommendation */
  metric: string;
  /** Current value of the problematic metric */
  currentValue: number;
  /** Recommended threshold */
  recommendedValue: number;
  /** Suggested implementation approach */
  suggestion: string;
}

/**
 * Performance monitor class for tracking component performance
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private config: PerformanceMonitorConfig;
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private intervalId?: number;

  private constructor(config?: Partial<PerformanceMonitorConfig>) {
    this.config = {
      detailed: false,
      sampleInterval: 1000,
      maxMetrics: 100,
      thresholds: {
        maxRenderTime: 16, // 60fps target
        maxUpdateTime: 8,
        maxMemoryGrowth: 10 * 1024 * 1024, // 10MB
        maxDomNodes: 1000,
        maxStyleRecalculations: 10,
        maxLayoutCount: 5,
      },
      logIssues: true,
      ...config,
    };

    this.setupGlobalMonitoring();
  }

  static getInstance(config?: Partial<PerformanceMonitorConfig>): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(config);
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start monitoring a component
   */
  startMonitoring(componentId: string): ComponentMonitor {
    return new ComponentMonitor(componentId, this);
  }

  /**
   * Record performance metrics for a component
   */
  recordMetrics(metrics: PerformanceMetrics) {
    const componentMetrics = this.metrics.get(metrics.componentId) || [];
    componentMetrics.push(metrics);

    // Limit stored metrics
    if (componentMetrics.length > this.config.maxMetrics) {
      componentMetrics.shift();
    }

    this.metrics.set(metrics.componentId, componentMetrics);

    // Check for performance issues
    this.checkPerformanceThresholds(metrics);
  }

  /**
   * Get performance metrics for a component
   */
  getMetrics(componentId: string): PerformanceMetrics[] {
    return this.metrics.get(componentId) || [];
  }

  /**
   * Get performance recommendations for a component
   */
  getRecommendations(componentId: string): PerformanceRecommendation[] {
    const metrics = this.getMetrics(componentId);
    if (metrics.length === 0) return [];

    const latest = metrics[metrics.length - 1];
    const recommendations: PerformanceRecommendation[] = [];

    // Check render time
    if (latest.renderTime > this.config.thresholds.maxRenderTime) {
      recommendations.push({
        type: 'virtualization',
        severity: latest.renderTime > this.config.thresholds.maxRenderTime * 2 ? 'high' : 'medium',
        description: 'Component render time exceeds recommended threshold',
        metric: 'renderTime',
        currentValue: latest.renderTime,
        recommendedValue: this.config.thresholds.maxRenderTime,
        suggestion: 'Consider implementing virtual scrolling for large lists or lazy loading for heavy content',
      });
    }

    // Check DOM node count
    if (latest.domNodeCount > this.config.thresholds.maxDomNodes) {
      recommendations.push({
        type: 'virtualization',
        severity: latest.domNodeCount > this.config.thresholds.maxDomNodes * 2 ? 'high' : 'medium',
        description: 'Component creates too many DOM nodes',
        metric: 'domNodeCount',
        currentValue: latest.domNodeCount,
        recommendedValue: this.config.thresholds.maxDomNodes,
        suggestion: 'Implement virtual scrolling or pagination to reduce DOM node count',
      });
    }

    // Check style recalculations
    if (latest.styleRecalculations > this.config.thresholds.maxStyleRecalculations) {
      recommendations.push({
        type: 'memoization',
        severity: 'medium',
        description: 'Excessive style recalculations detected',
        metric: 'styleRecalculations',
        currentValue: latest.styleRecalculations,
        recommendedValue: this.config.thresholds.maxStyleRecalculations,
        suggestion: 'Use CSS containment, avoid frequent style changes, or memoize computed styles',
      });
    }

    // Check memory usage trend
    if (metrics.length > 10) {
      const memoryGrowth = this.calculateMemoryGrowth(metrics);
      if (memoryGrowth > this.config.thresholds.maxMemoryGrowth) {
        recommendations.push({
          type: 'memory',
          severity: 'high',
          description: 'Memory usage is growing over time',
          metric: 'memoryUsage',
          currentValue: memoryGrowth,
          recommendedValue: this.config.thresholds.maxMemoryGrowth,
          suggestion: 'Check for memory leaks, implement cleanup in disconnectedCallback, or use weak references',
        });
      }
    }

    // Check update frequency
    const recentUpdates = metrics.filter(m => Date.now() - m.timestamp < 1000);
    if (recentUpdates.length > 20) {
      recommendations.push({
        type: 'debouncing',
        severity: 'medium',
        description: 'Component is updating too frequently',
        metric: 'updateFrequency',
        currentValue: recentUpdates.length,
        recommendedValue: 10,
        suggestion: 'Implement debouncing for rapid property changes or batch updates',
      });
    }

    return recommendations;
  }

  /**
   * Get performance summary for all monitored components
   */
  getSummary(): {
    totalComponents: number;
    totalMetrics: number;
    averageRenderTime: number;
    slowestComponent: string | null;
    recommendations: PerformanceRecommendation[];
  } {
    let totalMetrics = 0;
    let totalRenderTime = 0;
    let slowestTime = 0;
    let slowestComponent: string | null = null;
    const allRecommendations: PerformanceRecommendation[] = [];

    for (const [componentId, metrics] of this.metrics) {
      totalMetrics += metrics.length;
      
      const avgRenderTime = metrics.reduce((sum, m) => sum + m.renderTime, 0) / metrics.length;
      totalRenderTime += avgRenderTime;

      if (avgRenderTime > slowestTime) {
        slowestTime = avgRenderTime;
        slowestComponent = componentId;
      }

      allRecommendations.push(...this.getRecommendations(componentId));
    }

    return {
      totalComponents: this.metrics.size,
      totalMetrics,
      averageRenderTime: totalRenderTime / this.metrics.size || 0,
      slowestComponent,
      recommendations: allRecommendations,
    };
  }

  private setupGlobalMonitoring() {
    if (!this.config.detailed || typeof PerformanceObserver === 'undefined') {
      return;
    }

    // Monitor paint and layout metrics
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'measure' && entry.name.startsWith('component-')) {
            // Custom component measurements
            this.handleComponentMeasure(entry);
          }
        });
      });

      observer.observe({ type: 'measure', buffered: true });
      this.observers.set('global', observer);
    } catch (error) {
      console.warn('Performance monitoring not supported:', error);
    }

    // Setup periodic sampling
    this.intervalId = window.setInterval(() => {
      this.sampleGlobalMetrics();
    }, this.config.sampleInterval);
  }

  private handleComponentMeasure(entry: PerformanceEntry) {
    const componentId = entry.name.replace('component-', '').split('-')[0];
    const metrics = this.metrics.get(componentId);
    
    if (metrics && metrics.length > 0) {
      const latest = metrics[metrics.length - 1];
      latest.renderTime = entry.duration;
    }
  }

  private sampleGlobalMetrics() {
    // Sample memory usage
    const memory = (performance as any).memory;
    if (memory) {
      // Update memory usage for recent metrics
      for (const [componentId, metrics] of this.metrics) {
        if (metrics.length > 0) {
          const latest = metrics[metrics.length - 1];
          if (Date.now() - latest.timestamp < this.config.sampleInterval * 2) {
            latest.memoryUsage = memory.usedJSHeapSize;
          }
        }
      }
    }
  }

  private checkPerformanceThresholds(metrics: PerformanceMetrics) {
    if (!this.config.logIssues) return;

    const issues: string[] = [];

    if (metrics.renderTime > this.config.thresholds.maxRenderTime) {
      issues.push(`Slow render: ${metrics.renderTime.toFixed(2)}ms`);
    }

    if (metrics.domNodeCount > this.config.thresholds.maxDomNodes) {
      issues.push(`High DOM node count: ${metrics.domNodeCount}`);
    }

    if (issues.length > 0) {
      console.warn(`Performance issues in ${metrics.componentId}:`, issues.join(', '));
    }
  }

  private calculateMemoryGrowth(metrics: PerformanceMetrics[]): number {
    const withMemory = metrics.filter(m => m.memoryUsage !== undefined);
    if (withMemory.length < 2) return 0;

    const first = withMemory[0].memoryUsage!;
    const last = withMemory[withMemory.length - 1].memoryUsage!;
    return last - first;
  }

  /**
   * Clean up monitoring resources
   */
  destroy() {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.metrics.clear();
  }
}

/**
 * Component-specific performance monitor
 */
export class ComponentMonitor {
  private componentId: string;
  private monitor: PerformanceMonitor;
  private startTimes: Map<string, number> = new Map();
  private domNodeCount = 0;

  constructor(componentId: string, monitor: PerformanceMonitor) {
    this.componentId = componentId;
    this.monitor = monitor;
  }

  /**
   * Start measuring a performance operation
   */
  startMeasure(operation: string) {
    this.startTimes.set(operation, performance.now());
    
    // Create performance mark for detailed monitoring
    if (typeof performance.mark === 'function') {
      performance.mark(`${this.componentId}-${operation}-start`);
    }
  }

  /**
   * End measuring a performance operation
   */
  endMeasure(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (startTime === undefined) {
      console.warn(`No start time found for operation: ${operation}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(operation);

    // Create performance measure for detailed monitoring
    if (typeof performance.measure === 'function') {
      try {
        performance.measure(
          `component-${this.componentId}-${operation}`,
          `${this.componentId}-${operation}-start`
        );
      } catch (error) {
        // Ignore measure errors
      }
    }

    return duration;
  }

  /**
   * Record DOM node count
   */
  recordDOMNodes(count: number) {
    this.domNodeCount = count;
  }

  /**
   * Create and record performance metrics
   */
  recordMetrics(additionalData: Partial<PerformanceMetrics> = {}) {
    const metrics: PerformanceMetrics = {
      componentId: this.componentId,
      renderTime: 0,
      updateTime: 0,
      domNodeCount: this.domNodeCount,
      scriptTime: 0,
      styleRecalculations: 0,
      layoutCount: 0,
      timestamp: Date.now(),
      ...additionalData,
    };

    this.monitor.recordMetrics(metrics);
  }

  /**
   * Get recommendations for this component
   */
  getRecommendations(): PerformanceRecommendation[] {
    return this.monitor.getRecommendations(this.componentId);
  }
}

/**
 * Utility decorator for automatic performance monitoring
 */
export function monitored(componentId?: string) {
  return function<T extends { new (...args: any[]): any }>(constructor: T) {
    return class extends constructor {
      private performanceMonitor: ComponentMonitor;

      constructor(...args: any[]) {
        super(...args);
        
        const id = componentId || constructor.name.toLowerCase();
        this.performanceMonitor = PerformanceMonitor.getInstance().startMonitoring(id);
      }

      connectedCallback() {
        this.performanceMonitor.startMeasure('connected');
        super.connectedCallback?.();
        this.performanceMonitor.endMeasure('connected');
      }

      disconnectedCallback() {
        this.performanceMonitor.startMeasure('disconnected');
        super.disconnectedCallback?.();
        this.performanceMonitor.endMeasure('disconnected');
      }

      updated(changedProperties: any) {
        this.performanceMonitor.startMeasure('update');
        super.updated?.(changedProperties);
        
        const updateTime = this.performanceMonitor.endMeasure('update');
        
        // Count DOM nodes
        const nodeCount = this.shadowRoot?.childElementCount || 0;
        this.performanceMonitor.recordDOMNodes(nodeCount);
        
        // Record metrics
        this.performanceMonitor.recordMetrics({
          updateTime,
          renderTime: 0, // Will be measured separately
        });
      }
    };
  };
}

/**
 * Global performance monitoring instance
 */
export const performanceMonitor = PerformanceMonitor.getInstance();

/**
 * Utility for measuring render performance
 */
export function measureRender<T>(
  componentId: string,
  renderFn: () => T
): T {
  const monitor = performanceMonitor.startMonitoring(componentId);
  monitor.startMeasure('render');
  
  const result = renderFn();
  
  const renderTime = monitor.endMeasure('render');
  monitor.recordMetrics({ renderTime });
  
  return result;
}

/**
 * Get performance report for all monitored components
 */
export function getPerformanceReport(): {
  summary: ReturnType<PerformanceMonitor['getSummary']>;
  recommendations: PerformanceRecommendation[];
  componentDetails: Array<{
    componentId: string;
    metrics: PerformanceMetrics[];
    recommendations: PerformanceRecommendation[];
  }>;
} {
  const summary = performanceMonitor.getSummary();
  
  const componentDetails: Array<{
    componentId: string;
    metrics: PerformanceMetrics[];
    recommendations: PerformanceRecommendation[];
  }> = [];

  // Get details for each monitored component
  const allMetrics = (performanceMonitor as any).metrics as Map<string, PerformanceMetrics[]>;
  for (const [componentId] of allMetrics) {
    componentDetails.push({
      componentId,
      metrics: performanceMonitor.getMetrics(componentId),
      recommendations: performanceMonitor.getRecommendations(componentId),
    });
  }

  return {
    summary,
    recommendations: summary.recommendations,
    componentDetails,
  };
}