/**
 * Virtual scrolling utilities for high-performance rendering of large lists
 * Implements efficient viewport-based rendering with proper accessibility support
 */

import { TemplateResult, html } from 'lit';
import { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Configuration for virtual scrolling
 */
export interface VirtualScrollConfig {
  /** Estimated height of each item in pixels */
  itemHeight: number;
  /** Number of items to render outside the viewport (buffer) */
  overscan: number;
  /** Container height in pixels */
  containerHeight: number;
  /** Threshold for intersection observer (0-1) */
  threshold: number;
}

/**
 * Virtual scroll item data
 */
export interface VirtualScrollItem<T = any> {
  /** Unique identifier for the item */
  id: string;
  /** Item data */
  data: T;
  /** Actual measured height (if available) */
  measuredHeight?: number;
  /** Index in the original list */
  index: number;
}

/**
 * Viewport information for virtual scrolling
 */
export interface VirtualScrollViewport {
  /** Start index of visible range */
  startIndex: number;
  /** End index of visible range */
  endIndex: number;
  /** Items currently in viewport */
  visibleItems: VirtualScrollItem[];
  /** Total content height */
  totalHeight: number;
  /** Offset before visible items */
  offsetBefore: number;
  /** Offset after visible items */
  offsetAfter: number;
}

/**
 * Reactive controller for virtual scrolling
 */
export class VirtualScrollController<T = any> implements ReactiveController {
  host: ReactiveControllerHost;
  private config: VirtualScrollConfig;
  private items: VirtualScrollItem<T>[] = [];
  private viewport: VirtualScrollViewport;
  private scrollContainer?: HTMLElement;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private itemHeights = new Map<string, number>();
  private scrollTop = 0;
  private isScrolling = false;
  private scrollTimeoutId?: number;

  constructor(
    host: ReactiveControllerHost,
    config: Partial<VirtualScrollConfig> = {}
  ) {
    this.host = host;
    this.config = {
      itemHeight: 60,
      overscan: 5,
      containerHeight: 400,
      threshold: 0.1,
      ...config,
    };

    this.viewport = {
      startIndex: 0,
      endIndex: 0,
      visibleItems: [],
      totalHeight: 0,
      offsetBefore: 0,
      offsetAfter: 0,
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
   * Update the data items
   */
  setItems(data: T[], getId: (item: T, index: number) => string) {
    this.items = data.map((item, index) => ({
      id: getId(item, index),
      data: item,
      index,
      measuredHeight: this.itemHeights.get(getId(item, index)),
    }));
    
    this.updateViewport();
    this.host.requestUpdate();
  }

  /**
   * Get current viewport state
   */
  getViewport(): VirtualScrollViewport {
    return { ...this.viewport };
  }

  /**
   * Set the scroll container element
   */
  setScrollContainer(container: HTMLElement) {
    if (this.scrollContainer === container) return;

    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    }

    this.scrollContainer = container;
    this.setupScrollListener();
    this.updateViewport();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VirtualScrollConfig>) {
    this.config = { ...this.config, ...config };
    this.updateViewport();
    this.host.requestUpdate();
  }

  /**
   * Record the actual height of an item
   */
  recordItemHeight(itemId: string, height: number) {
    const previousHeight = this.itemHeights.get(itemId);
    if (previousHeight !== height) {
      this.itemHeights.set(itemId, height);
      
      // Update the item's measured height
      const item = this.items.find(item => item.id === itemId);
      if (item) {
        item.measuredHeight = height;
      }
      
      // Debounce viewport updates to avoid excessive recalculation
      this.debounceViewportUpdate();
    }
  }

  /**
   * Scroll to a specific item
   */
  scrollToItem(itemId: string, behavior: ScrollBehavior = 'smooth') {
    const itemIndex = this.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1 || !this.scrollContainer) return;

    const offsetTop = this.calculateOffsetForIndex(itemIndex);
    this.scrollContainer.scrollTo({
      top: offsetTop,
      behavior,
    });
  }

  /**
   * Scroll to a specific index
   */
  scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth') {
    if (index < 0 || index >= this.items.length || !this.scrollContainer) return;

    const offsetTop = this.calculateOffsetForIndex(index);
    this.scrollContainer.scrollTo({
      top: offsetTop,
      behavior,
    });
  }

  private setupObservers() {
    // Check if IntersectionObserver is available
    if (typeof IntersectionObserver === 'undefined') {
      console.warn('IntersectionObserver not available, virtual scrolling will use estimated heights');
      return;
    }

    try {
      // Intersection observer for measuring item heights
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const itemId = entry.target.getAttribute('data-virtual-item-id');
              if (itemId) {
                const height = entry.boundingClientRect.height;
                this.recordItemHeight(itemId, height);
              }
            }
          });
        },
        {
          threshold: this.config.threshold,
          rootMargin: '50px 0px',
        }
      );
    } catch (error) {
      console.warn('Failed to create IntersectionObserver:', error);
    }
  }

  private setupScrollListener() {
    if (!this.scrollContainer) return;

    this.scrollContainer.addEventListener('scroll', this.handleScroll, {
      passive: true,
    });

    // Setup resize observer if available
    if (typeof ResizeObserver !== 'undefined') {
      try {
        if (this.resizeObserver) {
          this.resizeObserver.disconnect();
        }

        this.resizeObserver = new ResizeObserver(() => {
          this.updateContainerHeight();
          this.updateViewport();
        });

        this.resizeObserver.observe(this.scrollContainer);
      } catch (error) {
        console.warn('Failed to create ResizeObserver:', error);
      }
    } else {
      // Fallback: listen to window resize
      const handleResize = () => {
        this.updateContainerHeight();
        this.updateViewport();
      };
      window.addEventListener('resize', handleResize);
      
      // Store cleanup reference
      (this as any)._windowResizeCleanup = () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }

  private handleScroll = () => {
    if (!this.scrollContainer) return;

    this.scrollTop = this.scrollContainer.scrollTop;
    this.isScrolling = true;
    
    this.updateViewport();
    this.host.requestUpdate();

    // Clear previous timeout
    if (this.scrollTimeoutId) {
      clearTimeout(this.scrollTimeoutId);
    }

    // Set scroll end timeout
    this.scrollTimeoutId = window.setTimeout(() => {
      this.isScrolling = false;
      this.host.requestUpdate();
    }, 100);
  };

  private updateContainerHeight() {
    if (this.scrollContainer) {
      const height = this.scrollContainer.clientHeight;
      if (height !== this.config.containerHeight) {
        this.config.containerHeight = height;
      }
    }
  }

  private updateViewport() {
    const { itemHeight, overscan, containerHeight } = this.config;
    
    if (this.items.length === 0) {
      this.viewport = {
        startIndex: 0,
        endIndex: 0,
        visibleItems: [],
        totalHeight: 0,
        offsetBefore: 0,
        offsetAfter: 0,
      };
      return;
    }

    // Calculate total height
    const totalHeight = this.items.reduce((acc, item, index) => {
      return acc + (item.measuredHeight || itemHeight);
    }, 0);

    // Calculate visible range
    const startIndex = Math.max(
      0,
      Math.floor(this.scrollTop / itemHeight) - overscan
    );

    const visibleItemCount = Math.ceil(containerHeight / itemHeight) + overscan * 2;
    const endIndex = Math.min(
      this.items.length - 1,
      startIndex + visibleItemCount
    );

    // Get visible items
    const visibleItems = this.items.slice(startIndex, endIndex + 1);

    // Calculate offsets
    const offsetBefore = this.calculateOffsetForIndex(startIndex);
    const offsetAfter = totalHeight - this.calculateOffsetForIndex(endIndex + 1);

    this.viewport = {
      startIndex,
      endIndex,
      visibleItems,
      totalHeight,
      offsetBefore,
      offsetAfter,
    };
  }

  private calculateOffsetForIndex(index: number): number {
    let offset = 0;
    const { itemHeight } = this.config;
    
    for (let i = 0; i < index && i < this.items.length; i++) {
      const item = this.items[i];
      offset += item.measuredHeight || itemHeight;
    }
    
    return offset;
  }

  private debounceViewportUpdate = this.debounce(() => {
    this.updateViewport();
    this.host.requestUpdate();
  }, 16); // ~60fps

  private debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => func(...args), wait);
    };
  }

  private cleanup() {
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    if (this.scrollTimeoutId) {
      clearTimeout(this.scrollTimeoutId);
    }

    // Cleanup window resize listener fallback
    if ((this as any)._windowResizeCleanup) {
      (this as any)._windowResizeCleanup();
      delete (this as any)._windowResizeCleanup;
    }
  }

  /**
   * Get render templates for virtual scrolled content
   */
  renderVirtualizedList<R>(
    renderItem: (item: VirtualScrollItem<T>, index: number) => R
  ): {
    beforeSpacer: TemplateResult;
    items: R[];
    afterSpacer: TemplateResult;
    containerStyle: string;
  } {
    const { visibleItems, offsetBefore, offsetAfter } = this.viewport;

    return {
      beforeSpacer: html`
        <div 
          style="height: ${offsetBefore}px;"
          aria-hidden="true"
          data-virtual-spacer="before"
        ></div>
      `,
      items: visibleItems.map((item, index) => renderItem(item, index)),
      afterSpacer: html`
        <div 
          style="height: ${offsetAfter}px;"
          aria-hidden="true"
          data-virtual-spacer="after"
        ></div>
      `,
      containerStyle: `height: ${this.config.containerHeight}px; overflow-y: auto;`,
    };
  }

  /**
   * Create item observer for height measurement
   */
  observeItem(element: Element, itemId: string) {
    if (this.intersectionObserver) {
      element.setAttribute('data-virtual-item-id', itemId);
      this.intersectionObserver.observe(element);
    }
  }

  /**
   * Remove item observer
   */
  unobserveItem(element: Element) {
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(element);
      element.removeAttribute('data-virtual-item-id');
    }
  }

  /**
   * Get scroll state for accessibility announcements
   */
  getScrollState(): {
    isScrolling: boolean;
    scrollProgress: number; // 0-1
    itemsInView: number;
    totalItems: number;
  } {
    const scrollProgress = this.viewport.totalHeight > 0
      ? Math.min(1, (this.scrollTop + this.config.containerHeight) / this.viewport.totalHeight)
      : 0;

    return {
      isScrolling: this.isScrolling,
      scrollProgress,
      itemsInView: this.viewport.visibleItems.length,
      totalItems: this.items.length,
    };
  }
}

/**
 * Utility for creating virtual scroll configurations
 */
export function createVirtualScrollConfig(
  overrides: Partial<VirtualScrollConfig> = {}
): VirtualScrollConfig {
  return {
    itemHeight: 60,
    overscan: 5,
    containerHeight: 400,
    threshold: 0.1,
    ...overrides,
  };
}

/**
 * Hook-style function for using virtual scroll in components
 */
export function useVirtualScroll<T>(
  host: ReactiveControllerHost,
  config?: Partial<VirtualScrollConfig>
): VirtualScrollController<T> {
  return new VirtualScrollController<T>(host, config);
}