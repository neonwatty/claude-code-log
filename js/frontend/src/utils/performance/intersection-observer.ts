/**
 * Intersection Observer Manager
 * Provides efficient viewport intersection detection
 */

export interface IntersectionObserverConfig {
  root?: Element | Document | null;
  rootMargin?: string;
  threshold?: number | number[];
}

export type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;

interface ObserverEntry {
  observer: IntersectionObserver;
  elements: Set<Element>;
  callback: IntersectionCallback;
}

export class IntersectionObserverManager {
  private static instance: IntersectionObserverManager | null = null;
  private observers = new Map<string, ObserverEntry>();

  private constructor() {}

  public static getInstance(): IntersectionObserverManager {
    if (!IntersectionObserverManager.instance) {
      IntersectionObserverManager.instance = new IntersectionObserverManager();
    }
    return IntersectionObserverManager.instance;
  }

  /**
   * Observe an element for intersection changes
   */
  public observe(
    element: Element,
    callback: IntersectionCallback,
    config: IntersectionObserverConfig = {}
  ): string {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported');
      return '';
    }

    const configKey = this.getConfigKey(config);
    let observerEntry = this.observers.get(configKey);

    if (!observerEntry) {
      // Create new observer for this configuration
      const observer = new IntersectionObserver(callback, config);
      observerEntry = {
        observer,
        elements: new Set(),
        callback,
      };
      this.observers.set(configKey, observerEntry);
    }

    // Add element to observer
    observerEntry.observer.observe(element);
    observerEntry.elements.add(element);

    return configKey;
  }

  /**
   * Stop observing an element
   */
  public unobserve(element: Element, observerId?: string): void {
    if (observerId) {
      const observerEntry = this.observers.get(observerId);
      if (observerEntry) {
        observerEntry.observer.unobserve(element);
        observerEntry.elements.delete(element);

        // Clean up observer if no elements left
        if (observerEntry.elements.size === 0) {
          observerEntry.observer.disconnect();
          this.observers.delete(observerId);
        }
      }
    } else {
      // Unobserve from all observers
      for (const [id, observerEntry] of this.observers) {
        if (observerEntry.elements.has(element)) {
          observerEntry.observer.unobserve(element);
          observerEntry.elements.delete(element);

          // Clean up observer if no elements left
          if (observerEntry.elements.size === 0) {
            observerEntry.observer.disconnect();
            this.observers.delete(id);
          }
        }
      }
    }
  }

  /**
   * Create a lazy loading observer for images
   */
  public createLazyLoader(
    rootMargin = '50px',
    threshold = 0.1
  ): (img: HTMLImageElement) => void {
    const callback: IntersectionCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          const srcset = img.dataset.srcset;

          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
          }

          if (srcset) {
            img.srcset = srcset;
            img.removeAttribute('data-srcset');
          }

          img.classList.remove('lazy');
          img.classList.add('loaded');
          this.unobserve(img);
        }
      });
    };

    return (img: HTMLImageElement) => {
      this.observe(img, callback, { rootMargin, threshold });
    };
  }

  /**
   * Create an infinite scroll observer
   */
  public createInfiniteScroll(
    onLoadMore: () => void,
    rootMargin = '100px'
  ): (sentinel: Element) => void {
    const callback: IntersectionCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      });
    };

    return (sentinel: Element) => {
      this.observe(sentinel, callback, { rootMargin });
    };
  }

  /**
   * Create a visibility tracker for analytics
   */
  public createVisibilityTracker(
    onVisible: (element: Element, visibilityRatio: number) => void,
    threshold: number[] = [0.25, 0.5, 0.75, 1.0]
  ): (element: Element) => void {
    const callback: IntersectionCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          onVisible(entry.target, entry.intersectionRatio);
        }
      });
    };

    return (element: Element) => {
      this.observe(element, callback, { threshold });
    };
  }

  /**
   * Create animation trigger observer
   */
  public createAnimationTrigger(
    onEnterViewport: (element: Element) => void,
    rootMargin = '0px'
  ): (element: Element) => void {
    const callback: IntersectionCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          onEnterViewport(entry.target);
          this.unobserve(entry.target);
        }
      });
    };

    return (element: Element) => {
      this.observe(element, callback, { rootMargin });
    };
  }

  /**
   * Disconnect all observers
   */
  public disconnectAll(): void {
    for (const observerEntry of this.observers.values()) {
      observerEntry.observer.disconnect();
    }
    this.observers.clear();
  }

  /**
   * Get configuration key for observer reuse
   */
  private getConfigKey(config: IntersectionObserverConfig): string {
    const { root, rootMargin = '0px', threshold = 0 } = config;
    const rootKey = root ? 'custom-root' : 'viewport';
    const thresholdKey = Array.isArray(threshold) ? threshold.join(',') : threshold.toString();
    return `${rootKey}-${rootMargin}-${thresholdKey}`;
  }

  /**
   * Get current observer count (for debugging)
   */
  public getObserverCount(): number {
    return this.observers.size;
  }

  /**
   * Get total observed elements count (for debugging)
   */
  public getObservedElementsCount(): number {
    let total = 0;
    for (const observerEntry of this.observers.values()) {
      total += observerEntry.elements.size;
    }
    return total;
  }
}

// Convenience functions
export function createLazyLoader(rootMargin?: string, threshold?: number) {
  return IntersectionObserverManager.getInstance().createLazyLoader(rootMargin, threshold);
}

export function createInfiniteScroll(onLoadMore: () => void, rootMargin?: string) {
  return IntersectionObserverManager.getInstance().createInfiniteScroll(onLoadMore, rootMargin);
}

export function createVisibilityTracker(
  onVisible: (element: Element, visibilityRatio: number) => void,
  threshold?: number[]
) {
  return IntersectionObserverManager.getInstance().createVisibilityTracker(onVisible, threshold);
}

export function createAnimationTrigger(
  onEnterViewport: (element: Element) => void,
  rootMargin?: string
) {
  return IntersectionObserverManager.getInstance().createAnimationTrigger(onEnterViewport, rootMargin);
}