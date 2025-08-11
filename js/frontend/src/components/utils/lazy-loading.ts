/**
 * Lazy loading utilities for components and content
 * Implements efficient loading strategies with proper accessibility support
 */

import { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Lazy loading strategy types
 */
export type LazyLoadingStrategy = 'intersection' | 'distance' | 'immediate' | 'manual';

/**
 * Configuration for lazy loading
 */
export interface LazyLoadingConfig {
  /** Loading strategy to use */
  strategy: LazyLoadingStrategy;
  /** Root margin for intersection observer (CSS margin format) */
  rootMargin: string;
  /** Intersection threshold (0-1) */
  threshold: number;
  /** Distance threshold for distance-based loading */
  distanceThreshold: number;
  /** Delay before loading in milliseconds */
  loadDelay: number;
  /** Maximum number of items to load at once */
  batchSize: number;
  /** Enable debug logging */
  debug: boolean;
}

/**
 * Lazy loadable item state
 */
export interface LazyLoadableItem<T = any> {
  /** Unique identifier */
  id: string;
  /** Item data */
  data: T;
  /** Loading state */
  state: 'pending' | 'loading' | 'loaded' | 'error';
  /** Error message if loading failed */
  error?: string;
  /** Priority for loading order */
  priority: number;
  /** Whether item is currently visible */
  isVisible: boolean;
  /** Distance from viewport */
  distance: number;
  /** Custom loading function */
  loader?: () => Promise<any>;
}

/**
 * Lazy loading controller for reactive components
 */
export class LazyLoadingController<T = any> implements ReactiveController {
  host: ReactiveControllerHost;
  private config: LazyLoadingConfig;
  private items = new Map<string, LazyLoadableItem<T>>();
  private intersectionObserver?: IntersectionObserver;
  private loadingQueue: string[] = [];
  private loadingPromises = new Map<string, Promise<any>>();
  private isProcessingQueue = false;
  private loadTimeoutId?: number;

  constructor(
    host: ReactiveControllerHost,
    config: Partial<LazyLoadingConfig> = {}
  ) {
    this.host = host;
    this.config = {
      strategy: 'intersection',
      rootMargin: '50px 0px',
      threshold: 0.1,
      distanceThreshold: 200,
      loadDelay: 0,
      batchSize: 3,
      debug: false,
      ...config,
    };

    host.addController(this);
  }

  hostConnected() {
    this.setupObservers();
  }

  hostDisconnected() {
    this.cleanup();
  }

  /**
   * Add item for lazy loading
   */
  addItem(
    id: string,
    data: T,
    options: {
      priority?: number;
      loader?: () => Promise<any>;
    } = {}
  ) {
    const item: LazyLoadableItem<T> = {
      id,
      data,
      state: 'pending',
      priority: options.priority || 0,
      isVisible: false,
      distance: Infinity,
      loader: options.loader,
    };

    this.items.set(id, item);
    
    if (this.config.strategy === 'immediate') {
      this.queueForLoading(id);
    }

    this.log(`Added item ${id} with priority ${item.priority}`);
  }

  /**
   * Remove item from lazy loading
   */
  removeItem(id: string) {
    this.items.delete(id);
    this.loadingPromises.delete(id);
    
    const queueIndex = this.loadingQueue.indexOf(id);
    if (queueIndex > -1) {
      this.loadingQueue.splice(queueIndex, 1);
    }

    this.log(`Removed item ${id}`);
  }

  /**
   * Get item state
   */
  getItem(id: string): LazyLoadableItem<T> | undefined {
    return this.items.get(id);
  }

  /**
   * Get all items with specific state
   */
  getItemsByState(state: LazyLoadableItem['state']): LazyLoadableItem<T>[] {
    return Array.from(this.items.values()).filter(item => item.state === state);
  }

  /**
   * Manually trigger loading for an item
   */
  loadItem(id: string): Promise<any> {
    const item = this.items.get(id);
    if (!item) {
      return Promise.reject(new Error(`Item ${id} not found`));
    }

    return this.executeLoad(id);
  }

  /**
   * Load all pending items
   */
  loadAll(): Promise<any[]> {
    const pendingItems = this.getItemsByState('pending');
    const promises = pendingItems.map(item => this.loadItem(item.id));
    return Promise.all(promises);
  }

  /**
   * Observe element for lazy loading
   */
  observeElement(element: Element, itemId: string) {
    if (!this.intersectionObserver) {
      // Fallback: load immediately if observer is not available
      this.queueForLoading(itemId);
      return;
    }

    element.setAttribute('data-lazy-item-id', itemId);
    this.intersectionObserver.observe(element);
    
    this.log(`Observing element for item ${itemId}`);
  }

  /**
   * Stop observing element
   */
  unobserveElement(element: Element) {
    if (!this.intersectionObserver) return;

    this.intersectionObserver.unobserve(element);
    element.removeAttribute('data-lazy-item-id');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LazyLoadingConfig>) {
    const oldStrategy = this.config.strategy;
    this.config = { ...this.config, ...config };

    if (oldStrategy !== this.config.strategy) {
      this.setupObservers();
    }
  }

  private setupObservers() {
    this.cleanup();

    if (this.config.strategy === 'intersection') {
      if (typeof IntersectionObserver === 'undefined') {
        console.warn('IntersectionObserver not available, switching to immediate loading strategy');
        this.config.strategy = 'immediate';
        return;
      }

      try {
        this.intersectionObserver = new IntersectionObserver(
          this.handleIntersection.bind(this),
          {
            rootMargin: this.config.rootMargin,
            threshold: this.config.threshold,
          }
        );
      } catch (error) {
        console.warn('Failed to create IntersectionObserver, switching to immediate loading:', error);
        this.config.strategy = 'immediate';
      }
    }
  }

  private handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      const itemId = entry.target.getAttribute('data-lazy-item-id');
      if (!itemId) return;

      const item = this.items.get(itemId);
      if (!item) return;

      const wasVisible = item.isVisible;
      item.isVisible = entry.isIntersecting;
      item.distance = entry.isIntersecting ? 0 : this.calculateDistance(entry);

      if (entry.isIntersecting && !wasVisible && item.state === 'pending') {
        this.queueForLoading(itemId);
        this.log(`Item ${itemId} became visible, queued for loading`);
      }
    });
  }

  private calculateDistance(entry: IntersectionObserverEntry): number {
    const rect = entry.boundingClientRect;
    const viewportHeight = window.innerHeight;
    
    if (rect.bottom < 0) {
      return Math.abs(rect.bottom); // Above viewport
    } else if (rect.top > viewportHeight) {
      return rect.top - viewportHeight; // Below viewport
    }
    
    return 0; // In viewport
  }

  private queueForLoading(itemId: string) {
    const item = this.items.get(itemId);
    if (!item || item.state !== 'pending') return;

    if (!this.loadingQueue.includes(itemId)) {
      this.loadingQueue.push(itemId);
      this.sortLoadingQueue();
      this.processLoadingQueue();
    }
  }

  private sortLoadingQueue() {
    this.loadingQueue.sort((a, b) => {
      const itemA = this.items.get(a);
      const itemB = this.items.get(b);
      
      if (!itemA || !itemB) return 0;

      // Priority first (higher priority first)
      if (itemA.priority !== itemB.priority) {
        return itemB.priority - itemA.priority;
      }

      // Then by visibility
      if (itemA.isVisible !== itemB.isVisible) {
        return itemA.isVisible ? -1 : 1;
      }

      // Finally by distance (closer first)
      return itemA.distance - itemB.distance;
    });
  }

  private async processLoadingQueue() {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    try {
      while (this.loadingQueue.length > 0) {
        // Process batch
        const batch = this.loadingQueue.splice(0, this.config.batchSize);
        const promises = batch.map(itemId => this.executeLoad(itemId));

        await Promise.allSettled(promises);

        // Apply load delay
        if (this.config.loadDelay > 0 && this.loadingQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.loadDelay));
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async executeLoad(itemId: string): Promise<any> {
    const item = this.items.get(itemId);
    if (!item) return;

    // Check if already loading
    const existingPromise = this.loadingPromises.get(itemId);
    if (existingPromise) return existingPromise;

    // Update state
    item.state = 'loading';
    this.host.requestUpdate();

    this.log(`Loading item ${itemId}`);

    // Create loading promise
    const promise = this.createLoadingPromise(item);
    this.loadingPromises.set(itemId, promise);

    try {
      const result = await promise;
      item.state = 'loaded';
      this.log(`Successfully loaded item ${itemId}`);
      return result;
    } catch (error) {
      item.state = 'error';
      item.error = error instanceof Error ? error.message : String(error);
      this.log(`Failed to load item ${itemId}: ${item.error}`);
      throw error;
    } finally {
      this.loadingPromises.delete(itemId);
      this.host.requestUpdate();
    }
  }

  private createLoadingPromise(item: LazyLoadableItem<T>): Promise<any> {
    if (item.loader) {
      return item.loader();
    }

    // Default loading behavior - simulate async operation
    return new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  private cleanup() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }

    if (this.loadTimeoutId) {
      clearTimeout(this.loadTimeoutId);
    }

    this.loadingPromises.clear();
    this.loadingQueue.length = 0;
  }

  private log(message: string) {
    if (this.config.debug) {
      console.log(`[LazyLoading] ${message}`);
    }
  }

  /**
   * Get loading statistics
   */
  getStats(): {
    total: number;
    pending: number;
    loading: number;
    loaded: number;
    errors: number;
    queueLength: number;
  } {
    const all = Array.from(this.items.values());
    
    return {
      total: all.length,
      pending: all.filter(item => item.state === 'pending').length,
      loading: all.filter(item => item.state === 'loading').length,
      loaded: all.filter(item => item.state === 'loaded').length,
      errors: all.filter(item => item.state === 'error').length,
      queueLength: this.loadingQueue.length,
    };
  }
}

/**
 * Component lazy loading utility
 */
export class ComponentLazyLoader {
  private static componentCache = new Map<string, Promise<any>>();
  
  /**
   * Lazy load a component module
   */
  static async loadComponent(
    componentName: string,
    importFn: () => Promise<any>
  ): Promise<any> {
    // Check cache first
    const cached = this.componentCache.get(componentName);
    if (cached) {
      return cached;
    }

    // Create loading promise
    const promise = importFn().then(module => {
      console.log(`Lazy loaded component: ${componentName}`);
      return module;
    });

    this.componentCache.set(componentName, promise);
    return promise;
  }

  /**
   * Preload components
   */
  static preloadComponents(components: Array<{name: string, importFn: () => Promise<any>}>) {
    components.forEach(({ name, importFn }) => {
      if (!this.componentCache.has(name)) {
        this.loadComponent(name, importFn);
      }
    });
  }

  /**
   * Clear component cache
   */
  static clearCache() {
    this.componentCache.clear();
  }
}

/**
 * Image lazy loading utility
 */
export function createImageLazyLoader(): {
  loadImage: (src: string, options?: { timeout?: number }) => Promise<HTMLImageElement>;
} {
  const imageCache = new Map<string, Promise<HTMLImageElement>>();

  return {
    loadImage: (src: string, options: { timeout?: number } = {}) => {
      // Check cache
      const cached = imageCache.get(src);
      if (cached) {
        return cached;
      }

      // Create loading promise
      const promise = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        const timeout = options.timeout || 10000;

        const timeoutId = setTimeout(() => {
          reject(new Error(`Image load timeout: ${src}`));
        }, timeout);

        img.onload = () => {
          clearTimeout(timeoutId);
          resolve(img);
        };

        img.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error(`Failed to load image: ${src}`));
        };

        img.src = src;
      });

      imageCache.set(src, promise);
      return promise;
    },
  };
}

/**
 * Utility for creating lazy loading configurations
 */
export function createLazyLoadingConfig(
  overrides: Partial<LazyLoadingConfig> = {}
): LazyLoadingConfig {
  return {
    strategy: 'intersection',
    rootMargin: '50px 0px',
    threshold: 0.1,
    distanceThreshold: 200,
    loadDelay: 0,
    batchSize: 3,
    debug: false,
    ...overrides,
  };
}

/**
 * Hook-style function for using lazy loading in components
 */
export function useLazyLoading<T>(
  host: ReactiveControllerHost,
  config?: Partial<LazyLoadingConfig>
): LazyLoadingController<T> {
  return new LazyLoadingController<T>(host, config);
}