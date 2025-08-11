import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { 
  VirtualScrollController, 
  useVirtualScroll, 
  createVirtualScrollConfig,
  VirtualScrollConfig,
  VirtualScrollItem
} from '../virtual-scroll';
import { setupBrowserAPIMocks, cleanupBrowserAPIMocks, MockIntersectionObserver } from '../../__tests__/test-setup';

// Test component for virtual scrolling
@customElement('test-virtual-list')
class TestVirtualList extends LitElement {
  private virtualScroll = useVirtualScroll(this, { itemHeight: 50, containerHeight: 200 });

  setTestData(data: any[]) {
    this.virtualScroll.setItems(data, (item, index) => `item-${index}`);
  }

  getViewport() {
    return this.virtualScroll.getViewport();
  }

  render() {
    const viewport = this.virtualScroll.getViewport();
    const virtualContent = this.virtualScroll.renderVirtualizedList(
      (item) => html`<div class="test-item">${item.data}</div>`
    );

    return html`
      <div class="container" style="${virtualContent.containerStyle}">
        ${virtualContent.beforeSpacer}
        ${virtualContent.items}
        ${virtualContent.afterSpacer}
      </div>
    `;
  }
}

describe('VirtualScrollController', () => {
  let controller: VirtualScrollController;
  let mockHost: any;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    setupBrowserAPIMocks();
    
    mockHost = {
      addController: vi.fn(),
      removeController: vi.fn(),
      requestUpdate: vi.fn(),
    };

    controller = new VirtualScrollController(mockHost);
    
    // Create mock container
    mockContainer = document.createElement('div');
    mockContainer.style.height = '200px';
    mockContainer.style.overflow = 'auto';
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    controller.hostDisconnected();
    if (mockContainer.parentNode) {
      mockContainer.parentNode.removeChild(mockContainer);
    }
    cleanupBrowserAPIMocks();
  });

  describe('Configuration', () => {
    it('should create with default configuration', () => {
      expect(controller).toBeDefined();
      const viewport = controller.getViewport();
      expect(viewport.totalHeight).toBe(0);
      expect(viewport.visibleItems).toHaveLength(0);
    });

    it('should create with custom configuration', () => {
      const customConfig = createVirtualScrollConfig({
        itemHeight: 100,
        overscan: 10,
        containerHeight: 500,
      });
      
      const customController = new VirtualScrollController(mockHost, customConfig);
      expect(customController).toBeDefined();
    });

    it('should update configuration', () => {
      const newConfig = { itemHeight: 80, overscan: 2 };
      controller.updateConfig(newConfig);
      expect(controller).toBeDefined();
    });
  });

  describe('Item Management', () => {
    const testData = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
      { id: 4, name: 'Item 4' },
      { id: 5, name: 'Item 5' },
    ];

    it('should set items and update viewport', () => {
      controller.setItems(testData, (item) => `item-${item.id}`);
      
      const viewport = controller.getViewport();
      expect(viewport.totalHeight).toBeGreaterThan(0);
      expect(viewport.visibleItems.length).toBeGreaterThan(0);
    });

    it('should handle empty items array', () => {
      controller.setItems([], () => '');
      
      const viewport = controller.getViewport();
      expect(viewport.totalHeight).toBe(0);
      expect(viewport.visibleItems).toHaveLength(0);
      expect(viewport.startIndex).toBe(0);
      expect(viewport.endIndex).toBe(0);
    });

    it('should record item heights', () => {
      controller.setItems(testData, (item) => `item-${item.id}`);
      
      // Record height for first item
      controller.recordItemHeight('item-1', 75);
      
      // Should trigger viewport update
      expect(mockHost.requestUpdate).toHaveBeenCalled();
    });

    it('should handle duplicate height recordings', () => {
      controller.setItems(testData, (item) => `item-${item.id}`);
      
      // Record same height multiple times
      controller.recordItemHeight('item-1', 50);
      controller.recordItemHeight('item-1', 50);
      
      // Should only trigger update once (after debounce)
      expect(controller).toBeDefined();
    });
  });

  describe('Scrolling', () => {
    const largeTestData = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
    }));

    beforeEach(() => {
      controller.setItems(largeTestData, (item) => `item-${item.id}`);
      controller.setScrollContainer(mockContainer);
    });

    it('should handle scroll events', () => {
      // Simulate scroll
      mockContainer.scrollTop = 100;
      mockContainer.dispatchEvent(new Event('scroll'));

      // Should update viewport
      const viewport = controller.getViewport();
      expect(viewport.offsetBefore).toBeGreaterThan(0);
    });

    it('should scroll to specific item', () => {
      const scrollToSpy = vi.spyOn(mockContainer, 'scrollTo');
      
      controller.scrollToItem('item-10');
      
      expect(scrollToSpy).toHaveBeenCalledWith({
        top: expect.any(Number),
        behavior: 'smooth',
      });
    });

    it('should scroll to specific index', () => {
      const scrollToSpy = vi.spyOn(mockContainer, 'scrollTo');
      
      controller.scrollToIndex(20);
      
      expect(scrollToSpy).toHaveBeenCalledWith({
        top: expect.any(Number),
        behavior: 'smooth',
      });
    });

    it('should handle invalid scroll targets', () => {
      const scrollToSpy = vi.spyOn(mockContainer, 'scrollTo');
      
      controller.scrollToItem('non-existent-item');
      controller.scrollToIndex(-1);
      controller.scrollToIndex(1000);
      
      expect(scrollToSpy).not.toHaveBeenCalled();
    });
  });

  describe('Virtualized Rendering', () => {
    const testData = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
    }));

    beforeEach(() => {
      controller.setItems(testData, (item) => `item-${item.id}`);
    });

    it('should render virtualized list', () => {
      const renderResult = controller.renderVirtualizedList((item) => 
        html`<div class="item">${item.data.name}</div>`
      );

      expect(renderResult.items.length).toBeGreaterThan(0);
      expect(renderResult.beforeSpacer).toBeDefined();
      expect(renderResult.afterSpacer).toBeDefined();
      expect(renderResult.containerStyle).toContain('height');
    });

    it('should handle empty virtualized list', () => {
      controller.setItems([], () => '');
      
      const renderResult = controller.renderVirtualizedList((item) => 
        html`<div class="item">${item.data}</div>`
      );

      expect(renderResult.items).toHaveLength(0);
    });
  });

  describe('Intersection Observer Integration', () => {
    let mockObserver: MockIntersectionObserver;

    beforeEach(() => {
      // Get reference to the created observer
      const IntersectionObserverConstructor = global.IntersectionObserver as any;
      mockObserver = new IntersectionObserverConstructor(() => {});
      
      controller.hostConnected();
    });

    it('should observe items for height measurement', () => {
      const testElement = document.createElement('div');
      
      controller.observeItem(testElement, 'test-item');
      
      expect(testElement.getAttribute('data-virtual-item-id')).toBe('test-item');
    });

    it('should unobserve items', () => {
      const testElement = document.createElement('div');
      
      controller.observeItem(testElement, 'test-item');
      controller.unobserveItem(testElement);
      
      expect(testElement.hasAttribute('data-virtual-item-id')).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        value: `Value ${i}`,
      }));

      const startTime = performance.now();
      controller.setItems(largeData, (item) => `item-${item.id}`);
      const endTime = performance.now();

      // Should complete in reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      
      const viewport = controller.getViewport();
      expect(viewport.visibleItems.length).toBeLessThan(largeData.length);
    });

    it('should provide scroll state information', () => {
      controller.setItems(Array.from({ length: 100 }, (_, i) => ({ id: i })), 
        (item) => `item-${item.id}`);
      
      const scrollState = controller.getScrollState();
      
      expect(scrollState).toHaveProperty('isScrolling');
      expect(scrollState).toHaveProperty('scrollProgress');
      expect(scrollState).toHaveProperty('itemsInView');
      expect(scrollState).toHaveProperty('totalItems');
      expect(scrollState.totalItems).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing scroll container gracefully', () => {
      expect(() => {
        controller.setScrollContainer(null as any);
      }).not.toThrow();
    });

    it('should handle missing IntersectionObserver gracefully', () => {
      // Mock missing IntersectionObserver
      const originalIO = global.IntersectionObserver;
      delete (global as any).IntersectionObserver;

      const controller2 = new VirtualScrollController(mockHost);
      controller2.hostConnected();

      expect(controller2).toBeDefined();

      // Restore
      global.IntersectionObserver = originalIO;
    });

    it('should handle ResizeObserver errors gracefully', () => {
      // Mock ResizeObserver that throws
      const originalRO = global.ResizeObserver;
      global.ResizeObserver = vi.fn(() => {
        throw new Error('ResizeObserver error');
      }) as any;

      expect(() => {
        controller.setScrollContainer(mockContainer);
      }).not.toThrow();

      // Restore
      global.ResizeObserver = originalRO;
    });
  });
});

describe('VirtualScroll Utility Functions', () => {
  it('should create virtual scroll config with defaults', () => {
    const config = createVirtualScrollConfig();
    
    expect(config).toHaveProperty('itemHeight', 60);
    expect(config).toHaveProperty('overscan', 5);
    expect(config).toHaveProperty('containerHeight', 400);
    expect(config).toHaveProperty('threshold', 0.1);
  });

  it('should create virtual scroll config with overrides', () => {
    const config = createVirtualScrollConfig({
      itemHeight: 100,
      overscan: 10,
    });
    
    expect(config.itemHeight).toBe(100);
    expect(config.overscan).toBe(10);
    expect(config.containerHeight).toBe(400); // default preserved
  });

  it('should create virtual scroll controller with useVirtualScroll', () => {
    const mockHost = {
      addController: vi.fn(),
      removeController: vi.fn(),
      requestUpdate: vi.fn(),
    };

    const controller = useVirtualScroll(mockHost, { itemHeight: 75 });
    
    expect(controller).toBeInstanceOf(VirtualScrollController);
    expect(mockHost.addController).toHaveBeenCalledWith(controller);
  });
});

declare global {
  interface HTMLElementTagNameMap {
    'test-virtual-list': TestVirtualList;
  }
}