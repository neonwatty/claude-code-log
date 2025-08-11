import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  LazyLoadingController,
  useLazyLoading,
  createLazyLoadingConfig,
  ComponentLazyLoader,
  createImageLazyLoader,
  LazyLoadingStrategy,
  LazyLoadableItem
} from '../lazy-loading';
import { setupBrowserAPIMocks, cleanupBrowserAPIMocks, MockIntersectionObserver } from '../../__tests__/test-setup';

// Test component for lazy loading
@customElement('test-lazy-component')
class TestLazyComponent extends LitElement {
  private lazyLoader = useLazyLoading(this, { strategy: 'intersection' });

  addTestItem(id: string, data: any, loader?: () => Promise<any>) {
    this.lazyLoader.addItem(id, data, { loader });
  }

  getItemState(id: string) {
    return this.lazyLoader.getItem(id);
  }

  getStats() {
    return this.lazyLoader.getStats();
  }

  render() {
    return html`<div class="lazy-container">Lazy Loading Test</div>`;
  }
}

describe('LazyLoadingController', () => {
  let controller: LazyLoadingController;
  let mockHost: any;

  beforeEach(() => {
    setupBrowserAPIMocks();
    
    mockHost = {
      addController: vi.fn(),
      removeController: vi.fn(),
      requestUpdate: vi.fn(),
    };

    controller = new LazyLoadingController(mockHost);
  });

  afterEach(() => {
    controller.hostDisconnected();
    cleanupBrowserAPIMocks();
  });

  describe('Configuration', () => {
    it('should create with default configuration', () => {
      expect(controller).toBeDefined();
      const stats = controller.getStats();
      expect(stats.total).toBe(0);
    });

    it('should create with custom configuration', () => {
      const customConfig = createLazyLoadingConfig({
        strategy: 'immediate',
        batchSize: 10,
        loadDelay: 500,
      });
      
      const customController = new LazyLoadingController(mockHost, customConfig);
      expect(customController).toBeDefined();
    });

    it('should update configuration', () => {
      controller.updateConfig({
        strategy: 'immediate',
        batchSize: 5,
      });
      
      // Should not throw and should accept the new config
      expect(controller).toBeDefined();
    });
  });

  describe('Item Management', () => {
    it('should add items for lazy loading', () => {
      controller.addItem('item1', { name: 'Test Item 1' });
      controller.addItem('item2', { name: 'Test Item 2' }, { priority: 1 });

      const stats = controller.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);

      const item1 = controller.getItem('item1');
      expect(item1?.state).toBe('pending');
      expect(item1?.priority).toBe(0);

      const item2 = controller.getItem('item2');
      expect(item2?.priority).toBe(1);
    });

    it('should remove items', () => {
      controller.addItem('item1', { name: 'Test Item 1' });
      controller.addItem('item2', { name: 'Test Item 2' });

      controller.removeItem('item1');

      const stats = controller.getStats();
      expect(stats.total).toBe(1);
      expect(controller.getItem('item1')).toBeUndefined();
      expect(controller.getItem('item2')).toBeDefined();
    });

    it('should get items by state', () => {
      controller.addItem('pending1', { name: 'Pending 1' });
      controller.addItem('pending2', { name: 'Pending 2' });

      const pendingItems = controller.getItemsByState('pending');
      expect(pendingItems).toHaveLength(2);

      const loadingItems = controller.getItemsByState('loading');
      expect(loadingItems).toHaveLength(0);
    });
  });

  describe('Loading Strategies', () => {
    it('should handle immediate loading strategy', async () => {
      controller.updateConfig({ strategy: 'immediate' });
      
      const mockLoader = vi.fn().mockResolvedValue('loaded');
      controller.addItem('item1', { name: 'Test' }, { loader: mockLoader });

      // Should start loading immediately
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockLoader).toHaveBeenCalled();
    });

    it('should handle intersection loading strategy', () => {
      controller.updateConfig({ strategy: 'intersection' });
      
      const element = document.createElement('div');
      controller.addItem('item1', { name: 'Test' });
      controller.observeElement(element, 'item1');

      expect(element.getAttribute('data-lazy-item-id')).toBe('item1');
    });

    it('should handle manual loading strategy', async () => {
      controller.updateConfig({ strategy: 'manual' });
      
      const mockLoader = vi.fn().mockResolvedValue('loaded');
      controller.addItem('item1', { name: 'Test' }, { loader: mockLoader });

      // Should not load automatically
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockLoader).not.toHaveBeenCalled();

      // Should load when manually triggered
      await controller.loadItem('item1');
      expect(mockLoader).toHaveBeenCalled();
    });
  });

  describe('Loading Process', () => {
    it('should load items with custom loader', async () => {
      const mockLoader = vi.fn().mockResolvedValue({ result: 'success' });
      
      controller.addItem('item1', { name: 'Test' }, { loader: mockLoader });
      
      const result = await controller.loadItem('item1');
      
      expect(mockLoader).toHaveBeenCalled();
      expect(result).toEqual({ result: 'success' });
      
      const item = controller.getItem('item1');
      expect(item?.state).toBe('loaded');
    });

    it('should handle loading errors', async () => {
      const mockLoader = vi.fn().mockRejectedValue(new Error('Load failed'));
      
      controller.addItem('item1', { name: 'Test' }, { loader: mockLoader });
      
      await expect(controller.loadItem('item1')).rejects.toThrow('Load failed');
      
      const item = controller.getItem('item1');
      expect(item?.state).toBe('error');
      expect(item?.error).toBe('Load failed');
    });

    it('should load all pending items', async () => {
      const mockLoader1 = vi.fn().mockResolvedValue('result1');
      const mockLoader2 = vi.fn().mockResolvedValue('result2');
      
      controller.addItem('item1', { name: 'Test 1' }, { loader: mockLoader1 });
      controller.addItem('item2', { name: 'Test 2' }, { loader: mockLoader2 });
      
      const results = await controller.loadAll();
      
      expect(results).toHaveLength(2);
      expect(mockLoader1).toHaveBeenCalled();
      expect(mockLoader2).toHaveBeenCalled();
    });

    it('should respect batch size and load delay', async () => {
      controller.updateConfig({ 
        strategy: 'immediate',
        batchSize: 1,
        loadDelay: 100,
      });

      const loader1 = vi.fn().mockResolvedValue('result1');
      const loader2 = vi.fn().mockResolvedValue('result2');
      
      controller.addItem('item1', { name: 'Test 1' }, { loader: loader1 });
      controller.addItem('item2', { name: 'Test 2' }, { loader: loader2 });

      // First item should load quickly
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(loader1).toHaveBeenCalled();
      expect(loader2).not.toHaveBeenCalled();

      // Second item should load after delay
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(loader2).toHaveBeenCalled();
    });
  });

  describe('Intersection Observer Integration', () => {
    let mockElement: HTMLElement;

    beforeEach(() => {
      mockElement = document.createElement('div');
      document.body.appendChild(mockElement);
    });

    afterEach(() => {
      if (mockElement.parentNode) {
        mockElement.parentNode.removeChild(mockElement);
      }
    });

    it('should observe elements for intersection', () => {
      controller.addItem('item1', { name: 'Test' });
      controller.observeElement(mockElement, 'item1');

      expect(mockElement.getAttribute('data-lazy-item-id')).toBe('item1');
    });

    it('should unobserve elements', () => {
      controller.addItem('item1', { name: 'Test' });
      controller.observeElement(mockElement, 'item1');
      controller.unobserveElement(mockElement);

      expect(mockElement.hasAttribute('data-lazy-item-id')).toBe(false);
    });

    it('should handle missing IntersectionObserver gracefully', () => {
      // Mock missing IntersectionObserver
      const originalIO = global.IntersectionObserver;
      delete (global as any).IntersectionObserver;

      const controller2 = new LazyLoadingController(mockHost);
      controller2.hostConnected();

      // Should fallback to immediate loading
      expect(controller2).toBeDefined();

      // Restore
      global.IntersectionObserver = originalIO;
    });
  });

  describe('Priority and Sorting', () => {
    it('should prioritize items by priority and visibility', async () => {
      const loadOrder: string[] = [];
      
      const createLoader = (id: string) => vi.fn().mockImplementation(async () => {
        loadOrder.push(id);
        return `result-${id}`;
      });

      controller.updateConfig({ strategy: 'immediate', batchSize: 1, loadDelay: 50 });
      
      controller.addItem('low-priority', { name: 'Low' }, { 
        priority: 0, 
        loader: createLoader('low-priority')
      });
      
      controller.addItem('high-priority', { name: 'High' }, { 
        priority: 10, 
        loader: createLoader('high-priority')
      });

      // Wait for loading to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // High priority should load first
      expect(loadOrder[0]).toBe('high-priority');
      expect(loadOrder[1]).toBe('low-priority');
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      const mockLoader = vi.fn().mockResolvedValue('result');
      
      controller.addItem('item1', { name: 'Test 1' });
      controller.addItem('item2', { name: 'Test 2' }, { loader: mockLoader });
      
      let stats = controller.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.loading).toBe(0);
      expect(stats.loaded).toBe(0);
      expect(stats.errors).toBe(0);

      // Load one item
      await controller.loadItem('item2');
      
      stats = controller.getStats();
      expect(stats.pending).toBe(1);
      expect(stats.loaded).toBe(1);
    });
  });
});

describe('ComponentLazyLoader', () => {
  beforeEach(() => {
    ComponentLazyLoader.clearCache();
  });

  afterEach(() => {
    ComponentLazyLoader.clearCache();
  });

  it('should lazy load components', async () => {
    const mockImport = vi.fn().mockResolvedValue({ default: 'MockComponent' });
    
    const result = await ComponentLazyLoader.loadComponent('test-component', mockImport);
    
    expect(mockImport).toHaveBeenCalled();
    expect(result).toEqual({ default: 'MockComponent' });
  });

  it('should cache loaded components', async () => {
    const mockImport = vi.fn().mockResolvedValue({ default: 'MockComponent' });
    
    await ComponentLazyLoader.loadComponent('test-component', mockImport);
    await ComponentLazyLoader.loadComponent('test-component', mockImport);
    
    // Should only call import once due to caching
    expect(mockImport).toHaveBeenCalledTimes(1);
  });

  it('should preload multiple components', () => {
    const mockImport1 = vi.fn().mockResolvedValue({ default: 'Component1' });
    const mockImport2 = vi.fn().mockResolvedValue({ default: 'Component2' });
    
    ComponentLazyLoader.preloadComponents([
      { name: 'comp1', importFn: mockImport1 },
      { name: 'comp2', importFn: mockImport2 },
    ]);
    
    expect(mockImport1).toHaveBeenCalled();
    expect(mockImport2).toHaveBeenCalled();
  });

  it('should clear component cache', async () => {
    const mockImport = vi.fn().mockResolvedValue({ default: 'MockComponent' });
    
    await ComponentLazyLoader.loadComponent('test-component', mockImport);
    ComponentLazyLoader.clearCache();
    await ComponentLazyLoader.loadComponent('test-component', mockImport);
    
    // Should call import twice after cache clear
    expect(mockImport).toHaveBeenCalledTimes(2);
  });
});

describe('Image Lazy Loader', () => {
  let imageLoader: ReturnType<typeof createImageLazyLoader>;

  beforeEach(() => {
    imageLoader = createImageLazyLoader();
    
    // Mock Image constructor
    global.Image = class MockImage extends EventTarget {
      src: string = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      
      constructor() {
        super();
      }
      
      set srcValue(value: string) {
        this.src = value;
        // Simulate successful load
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    } as any;
  });

  it('should load images successfully', async () => {
    const promise = imageLoader.loadImage('test.jpg');
    
    // Resolve the image load
    await new Promise(resolve => setTimeout(resolve, 20));
    
    const img = await promise;
    expect(img).toBeInstanceOf(Image);
  });

  it('should handle image load timeout', async () => {
    const promise = imageLoader.loadImage('slow-image.jpg', { timeout: 50 });
    
    await expect(promise).rejects.toThrow('Image load timeout');
  });

  it('should cache loaded images', async () => {
    const img1 = await imageLoader.loadImage('test.jpg');
    const img2 = await imageLoader.loadImage('test.jpg');
    
    // Should return the same cached promise result
    expect(img1).toBe(img2);
  });
});

describe('Lazy Loading Utility Functions', () => {
  it('should create lazy loading config with defaults', () => {
    const config = createLazyLoadingConfig();
    
    expect(config.strategy).toBe('intersection');
    expect(config.rootMargin).toBe('50px 0px');
    expect(config.threshold).toBe(0.1);
    expect(config.batchSize).toBe(3);
    expect(config.debug).toBe(false);
  });

  it('should create lazy loading config with overrides', () => {
    const config = createLazyLoadingConfig({
      strategy: 'immediate',
      batchSize: 10,
      debug: true,
    });
    
    expect(config.strategy).toBe('immediate');
    expect(config.batchSize).toBe(10);
    expect(config.debug).toBe(true);
    expect(config.rootMargin).toBe('50px 0px'); // default preserved
  });

  it('should create lazy loading controller with useLazyLoading', () => {
    const mockHost = {
      addController: vi.fn(),
      removeController: vi.fn(),
      requestUpdate: vi.fn(),
    };

    const controller = useLazyLoading(mockHost, { batchSize: 5 });
    
    expect(controller).toBeInstanceOf(LazyLoadingController);
    expect(mockHost.addController).toHaveBeenCalledWith(controller);
  });
});

declare global {
  interface HTMLElementTagNameMap {
    'test-lazy-component': TestLazyComponent;
  }
}