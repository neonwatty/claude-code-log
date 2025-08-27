/**
 * Performance utilities index
 */

export {
  PerformanceMonitor,
  getPerformanceMonitor,
  measurePerformance,
  type PerformanceEntry,
  type PerformanceThresholds,
} from './performance-monitor.js';

export {
  IntersectionObserverManager,
  type IntersectionObserverConfig,
  type IntersectionCallback,
} from './intersection-observer.js';

export {
  debounce,
  throttle,
  memoize,
  type DebouncedFunction,
  type ThrottledFunction,
  type MemoizedFunction,
} from './optimization-utils.js';