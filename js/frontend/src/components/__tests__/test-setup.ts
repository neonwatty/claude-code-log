/**
 * Test setup utilities and mocks for browser APIs
 */

// Mock IntersectionObserver
export class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];

  private callbacks: IntersectionObserverCallback[] = [];
  private observedElements = new Set<Element>();

  constructor(private callback: IntersectionObserverCallback) {
    this.callbacks.push(callback);
  }

  observe(target: Element): void {
    this.observedElements.add(target);
  }

  unobserve(target: Element): void {
    this.observedElements.delete(target);
  }

  disconnect(): void {
    this.observedElements.clear();
    this.callbacks.length = 0;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  // Test utility methods
  mockIntersection(target: Element, isIntersecting: boolean) {
    if (!this.observedElements.has(target)) return;

    const entry: Partial<IntersectionObserverEntry> = {
      target,
      isIntersecting,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: isIntersecting ? target.getBoundingClientRect() : {
        x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON: () => ({})
      },
      rootBounds: null,
      time: Date.now(),
    };

    this.callback([entry as IntersectionObserverEntry], this);
  }

  mockMultipleIntersections(entries: Array<{ element: Element; isIntersecting: boolean }>) {
    const mockEntries: IntersectionObserverEntry[] = entries.map(({ element, isIntersecting }) => ({
      target: element,
      isIntersecting,
      boundingClientRect: element.getBoundingClientRect(),
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: isIntersecting ? element.getBoundingClientRect() : {
        x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON: () => ({})
      },
      rootBounds: null,
      time: Date.now(),
    } as IntersectionObserverEntry));

    this.callback(mockEntries, this);
  }
}

// Mock ResizeObserver
export class MockResizeObserver implements ResizeObserver {
  private callbacks: ResizeObserverCallback[] = [];
  private observedElements = new Set<Element>();

  constructor(private callback: ResizeObserverCallback) {
    this.callbacks.push(callback);
  }

  observe(target: Element): void {
    this.observedElements.add(target);
  }

  unobserve(target: Element): void {
    this.observedElements.delete(target);
  }

  disconnect(): void {
    this.observedElements.clear();
    this.callbacks.length = 0;
  }

  // Test utility methods
  mockResize(target: Element, contentRect: Partial<DOMRectReadOnly> = {}) {
    if (!this.observedElements.has(target)) return;

    const entry: Partial<ResizeObserverEntry> = {
      target,
      contentRect: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        top: 0,
        right: 100,
        bottom: 100,
        left: 0,
        toJSON: () => ({}),
        ...contentRect,
      } as DOMRectReadOnly,
      borderBoxSize: [{
        blockSize: contentRect.height || 100,
        inlineSize: contentRect.width || 100,
      }] as ReadonlyArray<ResizeObserverSize>,
      contentBoxSize: [{
        blockSize: contentRect.height || 100,
        inlineSize: contentRect.width || 100,
      }] as ReadonlyArray<ResizeObserverSize>,
      devicePixelContentBoxSize: [{
        blockSize: contentRect.height || 100,
        inlineSize: contentRect.width || 100,
      }] as ReadonlyArray<ResizeObserverSize>,
    };

    this.callback([entry as ResizeObserverEntry], this);
  }
}

// Mock requestIdleCallback
export function mockRequestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): number {
  return window.setTimeout(() => {
    const deadline: IdleDeadline = {
      didTimeout: false,
      timeRemaining: () => 50, // Mock 50ms remaining
    };
    callback(deadline);
  }, 0);
}

export function mockCancelIdleCallback(id: number): void {
  clearTimeout(id);
}

// Performance API mocks
export function mockPerformanceNow(): number {
  return Date.now() + Math.random();
}

export function mockPerformanceMark(name: string): void {
  // No-op for tests
}

export function mockPerformanceMeasure(name: string, startMark?: string): void {
  // No-op for tests
}

// Setup all mocks
export function setupBrowserAPIMocks() {
  // Mock IntersectionObserver
  if (!global.IntersectionObserver) {
    global.IntersectionObserver = MockIntersectionObserver as any;
  }

  // Mock ResizeObserver
  if (!global.ResizeObserver) {
    global.ResizeObserver = MockResizeObserver as any;
  }

  // Mock requestIdleCallback
  if (!global.requestIdleCallback) {
    global.requestIdleCallback = mockRequestIdleCallback;
    global.cancelIdleCallback = mockCancelIdleCallback;
  }

  // Mock performance methods
  if (global.performance) {
    if (!global.performance.mark) {
      global.performance.mark = mockPerformanceMark;
    }
    if (!global.performance.measure) {
      global.performance.measure = mockPerformanceMeasure;
    }
    if (!global.performance.now) {
      global.performance.now = mockPerformanceNow;
    }
  }

  // Mock memory API
  if (global.performance && !(global.performance as any).memory) {
    (global.performance as any).memory = {
      usedJSHeapSize: 1024 * 1024, // 1MB
      totalJSHeapSize: 2 * 1024 * 1024, // 2MB
      jsHeapSizeLimit: 4 * 1024 * 1024, // 4MB
    };
  }
}

// Cleanup mocks
export function cleanupBrowserAPIMocks() {
  // Reset to original implementations if they existed
  delete (global as any).IntersectionObserver;
  delete (global as any).ResizeObserver;
  delete (global as any).requestIdleCallback;
  delete (global as any).cancelIdleCallback;
}