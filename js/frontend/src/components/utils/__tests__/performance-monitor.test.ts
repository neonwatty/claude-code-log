import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  PerformanceMonitor, 
  ComponentMonitor, 
  performanceMonitor,
  monitored,
  measureRender,
  getPerformanceReport,
  PerformanceMetrics,
  PerformanceRecommendation
} from '../performance-monitor';
import { setupBrowserAPIMocks, cleanupBrowserAPIMocks } from '../../__tests__/test-setup';

// Test component for monitoring
@monitored('test-component')
class TestComponent {
  connectedCallback() {}
  disconnectedCallback() {}
  updated(changedProperties: any) {}
}

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    setupBrowserAPIMocks();
    monitor = PerformanceMonitor.getInstance();
  });

  afterEach(() => {
    cleanupBrowserAPIMocks();
  });

  describe('Instance Management', () => {
    it('should be a singleton', () => {
      const instance1 = PerformanceMonitor.getInstance();
      const instance2 = PerformanceMonitor.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should start monitoring components', () => {
      const componentMonitor = monitor.startMonitoring('test-component');
      
      expect(componentMonitor).toBeInstanceOf(ComponentMonitor);
    });
  });

  describe('Metrics Recording', () => {
    it('should record performance metrics', () => {
      const metrics: PerformanceMetrics = {
        componentId: 'test-component',
        renderTime: 15.5,
        updateTime: 8.2,
        domNodeCount: 25,
        scriptTime: 12.1,
        styleRecalculations: 3,
        layoutCount: 2,
        timestamp: Date.now(),
      };

      monitor.recordMetrics(metrics);
      
      const storedMetrics = monitor.getMetrics('test-component');
      expect(storedMetrics).toHaveLength(1);
      expect(storedMetrics[0]).toEqual(metrics);
    });

    it('should limit stored metrics per component', () => {
      const baseMetrics = {
        componentId: 'test-component',
        renderTime: 10,
        updateTime: 5,
        domNodeCount: 20,
        scriptTime: 8,
        styleRecalculations: 2,
        layoutCount: 1,
        timestamp: Date.now(),
      };

      // Record more than the limit (assume limit is 100)
      for (let i = 0; i < 105; i++) {
        monitor.recordMetrics({
          ...baseMetrics,
          timestamp: Date.now() + i,
        });
      }

      const storedMetrics = monitor.getMetrics('test-component');
      expect(storedMetrics.length).toBeLessThanOrEqual(100);
    });

    it('should get metrics for non-existent component', () => {
      const metrics = monitor.getMetrics('non-existent');
      expect(metrics).toHaveLength(0);
    });
  });

  describe('Performance Recommendations', () => {
    it('should generate recommendations for slow render times', () => {
      const slowMetrics: PerformanceMetrics = {
        componentId: 'slow-component',
        renderTime: 50, // Above threshold
        updateTime: 5,
        domNodeCount: 100,
        scriptTime: 8,
        styleRecalculations: 2,
        layoutCount: 1,
        timestamp: Date.now(),
      };

      monitor.recordMetrics(slowMetrics);
      const recommendations = monitor.getRecommendations('slow-component');
      
      const renderRecommendation = recommendations.find(r => r.metric === 'renderTime');
      expect(renderRecommendation).toBeDefined();
      expect(renderRecommendation?.type).toBe('virtualization');
      expect(renderRecommendation?.currentValue).toBe(50);
    });

    it('should generate recommendations for high DOM node count', () => {
      const heavyMetrics: PerformanceMetrics = {
        componentId: 'heavy-component',
        renderTime: 10,
        updateTime: 5,
        domNodeCount: 2000, // Above threshold
        scriptTime: 8,
        styleRecalculations: 2,
        layoutCount: 1,
        timestamp: Date.now(),
      };

      monitor.recordMetrics(heavyMetrics);
      const recommendations = monitor.getRecommendations('heavy-component');
      
      const domRecommendation = recommendations.find(r => r.metric === 'domNodeCount');
      expect(domRecommendation).toBeDefined();
      expect(domRecommendation?.type).toBe('virtualization');
    });

    it('should generate recommendations for excessive style recalculations', () => {
      const styleHeavyMetrics: PerformanceMetrics = {
        componentId: 'style-heavy-component',
        renderTime: 10,
        updateTime: 5,
        domNodeCount: 100,
        scriptTime: 8,
        styleRecalculations: 20, // Above threshold
        layoutCount: 1,
        timestamp: Date.now(),
      };

      monitor.recordMetrics(styleHeavyMetrics);
      const recommendations = monitor.getRecommendations('style-heavy-component');
      
      const styleRecommendation = recommendations.find(r => r.metric === 'styleRecalculations');
      expect(styleRecommendation).toBeDefined();
      expect(styleRecommendation?.type).toBe('memoization');
    });

    it('should generate recommendations for memory growth', () => {
      const baseTime = Date.now();
      
      // Simulate memory growth over time
      for (let i = 0; i < 15; i++) {
        monitor.recordMetrics({
          componentId: 'memory-leak-component',
          renderTime: 10,
          updateTime: 5,
          domNodeCount: 100,
          scriptTime: 8,
          styleRecalculations: 2,
          layoutCount: 1,
          timestamp: baseTime + i * 1000,
          memoryUsage: 1024 * 1024 + i * 2 * 1024 * 1024, // Growing memory
        });
      }

      const recommendations = monitor.getRecommendations('memory-leak-component');
      const memoryRecommendation = recommendations.find(r => r.metric === 'memoryUsage');
      
      expect(memoryRecommendation).toBeDefined();
      expect(memoryRecommendation?.type).toBe('memory');
    });

    it('should generate recommendations for frequent updates', () => {
      const currentTime = Date.now();
      
      // Record many updates in short time
      for (let i = 0; i < 25; i++) {
        monitor.recordMetrics({
          componentId: 'frequent-update-component',
          renderTime: 10,
          updateTime: 5,
          domNodeCount: 100,
          scriptTime: 8,
          styleRecalculations: 2,
          layoutCount: 1,
          timestamp: currentTime + i * 10, // Very frequent updates
        });
      }

      const recommendations = monitor.getRecommendations('frequent-update-component');
      const updateRecommendation = recommendations.find(r => r.metric === 'updateFrequency');
      
      expect(updateRecommendation).toBeDefined();
      expect(updateRecommendation?.type).toBe('debouncing');
    });
  });

  describe('Performance Summary', () => {
    it('should provide performance summary', () => {
      // Record metrics for multiple components
      monitor.recordMetrics({
        componentId: 'component-a',
        renderTime: 15,
        updateTime: 5,
        domNodeCount: 100,
        scriptTime: 8,
        styleRecalculations: 2,
        layoutCount: 1,
        timestamp: Date.now(),
      });

      monitor.recordMetrics({
        componentId: 'component-b',
        renderTime: 25,
        updateTime: 10,
        domNodeCount: 150,
        scriptTime: 12,
        styleRecalculations: 3,
        layoutCount: 2,
        timestamp: Date.now(),
      });

      const summary = monitor.getSummary();
      
      expect(summary.totalComponents).toBe(2);
      expect(summary.totalMetrics).toBe(2);
      expect(summary.averageRenderTime).toBe(20); // (15 + 25) / 2
      expect(summary.slowestComponent).toBe('component-b');
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });
  });
});

describe('ComponentMonitor', () => {
  let monitor: PerformanceMonitor;
  let componentMonitor: ComponentMonitor;

  beforeEach(() => {
    setupBrowserAPIMocks();
    monitor = PerformanceMonitor.getInstance();
    componentMonitor = monitor.startMonitoring('test-component');
  });

  afterEach(() => {
    cleanupBrowserAPIMocks();
  });

  describe('Performance Measurement', () => {
    it('should measure operation duration', () => {
      componentMonitor.startMeasure('render');
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Wait 10ms
      }
      
      const duration = componentMonitor.endMeasure('render');
      
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be reasonable
    });

    it('should handle missing start measurement', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const duration = componentMonitor.endMeasure('non-existent-operation');
      
      expect(duration).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should record DOM node count', () => {
      componentMonitor.recordDOMNodes(150);
      componentMonitor.recordMetrics({ renderTime: 10 });
      
      const metrics = monitor.getMetrics('test-component');
      expect(metrics[0].domNodeCount).toBe(150);
    });

    it('should record custom metrics', () => {
      componentMonitor.recordMetrics({
        renderTime: 12.5,
        updateTime: 6.2,
        styleRecalculations: 3,
      });
      
      const metrics = monitor.getMetrics('test-component');
      expect(metrics[0].renderTime).toBe(12.5);
      expect(metrics[0].updateTime).toBe(6.2);
      expect(metrics[0].styleRecalculations).toBe(3);
    });
  });

  describe('Performance Marks and Measures', () => {
    it('should create performance marks', () => {
      const markSpy = vi.spyOn(performance, 'mark');
      
      componentMonitor.startMeasure('test-operation');
      
      expect(markSpy).toHaveBeenCalledWith('test-component-test-operation-start');
    });

    it('should create performance measures', () => {
      const measureSpy = vi.spyOn(performance, 'measure');
      
      componentMonitor.startMeasure('test-operation');
      componentMonitor.endMeasure('test-operation');
      
      expect(measureSpy).toHaveBeenCalledWith(
        'component-test-component-test-operation',
        'test-component-test-operation-start'
      );
    });

    it('should handle performance API errors gracefully', () => {
      const measureSpy = vi.spyOn(performance, 'measure').mockImplementation(() => {
        throw new Error('Performance API error');
      });
      
      expect(() => {
        componentMonitor.startMeasure('test-operation');
        componentMonitor.endMeasure('test-operation');
      }).not.toThrow();
      
      measureSpy.mockRestore();
    });
  });

  describe('Recommendations', () => {
    it('should get component-specific recommendations', () => {
      // Record slow metrics
      componentMonitor.recordMetrics({
        renderTime: 30, // Slow render
        updateTime: 5,
        domNodeCount: 100,
      });
      
      const recommendations = componentMonitor.getRecommendations();
      
      expect(Array.isArray(recommendations)).toBe(true);
      const renderRecommendation = recommendations.find(r => r.metric === 'renderTime');
      expect(renderRecommendation).toBeDefined();
    });
  });
});

describe('Monitored Decorator', () => {
  it('should automatically monitor component lifecycle', () => {
    const MonitoredComponent = monitored('decorated-component')(TestComponent);
    const instance = new MonitoredComponent();
    
    expect(instance).toBeInstanceOf(TestComponent);
    expect((instance as any).performanceMonitor).toBeDefined();
  });

  it('should measure connected callback', () => {
    const MonitoredComponent = monitored('decorated-component')(TestComponent);
    const instance = new MonitoredComponent();
    
    const measureSpy = vi.spyOn((instance as any).performanceMonitor, 'startMeasure');
    
    instance.connectedCallback();
    
    expect(measureSpy).toHaveBeenCalledWith('connected');
  });

  it('should measure updated callback', () => {
    const MonitoredComponent = monitored('decorated-component')(TestComponent);
    const instance = new MonitoredComponent();
    
    const measureSpy = vi.spyOn((instance as any).performanceMonitor, 'startMeasure');
    
    instance.updated(new Map());
    
    expect(measureSpy).toHaveBeenCalledWith('update');
  });

  it('should use component name as default ID', () => {
    const MonitoredComponent = monitored()(TestComponent);
    const instance = new MonitoredComponent();
    
    // Should use class name as component ID
    expect((instance as any).performanceMonitor).toBeDefined();
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    setupBrowserAPIMocks();
  });

  afterEach(() => {
    cleanupBrowserAPIMocks();
  });

  describe('measureRender', () => {
    it('should measure render function performance', () => {
      const renderFn = vi.fn().mockReturnValue('rendered');
      
      const result = measureRender('test-render', renderFn);
      
      expect(result).toBe('rendered');
      expect(renderFn).toHaveBeenCalled();
      
      // Should record metrics
      const metrics = performanceMonitor.getMetrics('test-render');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].renderTime).toBeGreaterThan(0);
    });

    it('should handle render function errors', () => {
      const renderFn = vi.fn().mockImplementation(() => {
        throw new Error('Render error');
      });
      
      expect(() => {
        measureRender('error-render', renderFn);
      }).toThrow('Render error');
    });
  });

  describe('getPerformanceReport', () => {
    it('should generate comprehensive performance report', () => {
      // Record some metrics
      performanceMonitor.recordMetrics({
        componentId: 'report-component',
        renderTime: 20,
        updateTime: 8,
        domNodeCount: 200,
        scriptTime: 12,
        styleRecalculations: 4,
        layoutCount: 2,
        timestamp: Date.now(),
      });
      
      const report = getPerformanceReport();
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('componentDetails');
      
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.componentDetails)).toBe(true);
      
      const componentDetail = report.componentDetails.find(
        c => c.componentId === 'report-component'
      );
      expect(componentDetail).toBeDefined();
      expect(componentDetail?.metrics).toHaveLength(1);
    });

    it('should handle empty performance data', () => {
      const report = getPerformanceReport();
      
      expect(report.summary.totalComponents).toBe(0);
      expect(report.recommendations).toHaveLength(0);
      expect(report.componentDetails).toHaveLength(0);
    });
  });
});

describe('Performance Monitor Integration', () => {
  beforeEach(() => {
    setupBrowserAPIMocks();
  });

  afterEach(() => {
    cleanupBrowserAPIMocks();
  });

  it('should handle missing PerformanceObserver gracefully', () => {
    const originalPO = global.PerformanceObserver;
    delete (global as any).PerformanceObserver;
    
    expect(() => {
      PerformanceMonitor.getInstance({ detailed: true });
    }).not.toThrow();
    
    global.PerformanceObserver = originalPO;
  });

  it('should handle performance memory API availability', () => {
    const originalMemory = (performance as any).memory;
    delete (performance as any).memory;
    
    const monitor = PerformanceMonitor.getInstance();
    
    // Should work without memory API
    monitor.recordMetrics({
      componentId: 'no-memory-api',
      renderTime: 10,
      updateTime: 5,
      domNodeCount: 100,
      scriptTime: 8,
      styleRecalculations: 2,
      layoutCount: 1,
      timestamp: Date.now(),
    });
    
    const metrics = monitor.getMetrics('no-memory-api');
    expect(metrics).toHaveLength(1);
    
    // Restore
    (performance as any).memory = originalMemory;
  });

  it('should cleanup resources properly', () => {
    const monitor = PerformanceMonitor.getInstance();
    
    expect(() => {
      monitor.destroy();
    }).not.toThrow();
  });
});