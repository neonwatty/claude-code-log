import { LitElement, CSSResult, css } from "lit";
import { property, state } from "lit/decorators.js";
import { baseStyles } from "../../styles/shared/index.js";

/**
 * Base component that all application components inherit from
 * Provides common functionality, theming, and lifecycle management
 */
export abstract class BaseComponent extends LitElement {
  /**
   * Loading state for async operations
   */
  @state()
  protected isLoading = false;

  /**
   * Error state for error handling
   */
  @state()
  protected error: string | null = null;

  /**
   * Dark mode preference
   */
  @property({ type: Boolean, reflect: true, attribute: "dark-mode" })
  darkMode = false;

  // Track event listeners and cleanup functions for memory management
  private cleanup: Array<() => void> = [];
  private renderAttempts = 0;
  private maxRenderAttempts = 5;

  /**
   * Modern base styles that all components inherit
   * Clean, accessible, and mobile-first design
   */
  static override styles: CSSResult[] = [
    baseStyles,
    css`
      :host {
        /* Modern component defaults - TESTING */
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Inter", "Helvetica Neue", Arial, sans-serif;
        line-height: 1.5;
        color: #0f172a;
        background: #f0f9ff;
      }

      /* Modern utility classes */
      .loading {
        opacity: var(--opacity-disabled);
        pointer-events: none;
        cursor: progress;
        transition: opacity var(--transition-medium);
      }

      .error {
        color: var(--color-error);
        background-color: var(--color-error-bg);
        padding: var(--spacing-3) var(--spacing-4);
        border-radius: var(--radius-lg);
        border: 1px solid var(--color-error);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
      }

      .success {
        color: var(--color-success);
        background-color: var(--color-success-bg);
        padding: var(--spacing-3) var(--spacing-4);
        border-radius: var(--radius-lg);
        border: 1px solid var(--color-success);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
      }

      .warning {
        color: var(--color-warning);
        background-color: var(--color-warning-bg);
        padding: var(--spacing-3) var(--spacing-4);
        border-radius: var(--radius-lg);
        border: 1px solid var(--color-warning);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
      }

      .hidden {
        display: none !important;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      /* Modern focus styles */
      .focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
    `,
  ];

  /**
   * Set loading state and re-render
   */
  protected setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  /**
   * Set error state and re-render
   */
  protected setError(error: string | null): void {
    this.error = error;
  }

  /**
   * Clear error state
   */
  protected clearError(): void {
    this.error = null;
  }

  /**
   * Handle async operations with loading and error states
   */
  protected async handleAsyncOperation<T>(
    operation: () => Promise<T>,
    errorMessage = "An error occurred",
  ): Promise<T | null> {
    this.setLoading(true);
    this.clearError();

    try {
      const result = await operation();
      return result;
    } catch (error) {
      console.error(errorMessage, error);
      this.setError(error instanceof Error ? error.message : errorMessage);
      return null;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Emit a custom event with typed detail
   */
  protected emitEvent<T>(eventName: string, detail?: T): void {
    this.dispatchEvent(
      new CustomEvent(eventName, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Format timestamp for display
   */
  protected formatTimestamp(timestamp: string | Date): string {
    const date =
      typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return date.toLocaleString();
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  protected formatRelativeTime(timestamp: string | Date): string {
    const date =
      typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    return this.formatTimestamp(date);
  }

  /**
   * Format token count with thousand separators
   */
  protected formatTokenCount(count: number): string {
    return count.toLocaleString();
  }

  /**
   * Truncate text to specified length with ellipsis
   */
  protected truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
  }

  /**
   * Override connectedCallback to initialize cleanup tracking
   */
  override connectedCallback() {
    super.connectedCallback();
    this.cleanup = [];
    this.renderAttempts = 0;
  }

  /**
   * Override disconnectedCallback to ensure proper cleanup
   */
  override disconnectedCallback() {
    super.disconnectedCallback();
    this.performCleanup();
  }

  /**
   * Perform all registered cleanup operations
   */
  private performCleanup(): void {
    this.cleanup.forEach((cleanupFn) => {
      try {
        cleanupFn();
      } catch (error) {
        console.warn('Cleanup function failed:', error);
      }
    });
    this.cleanup = [];
  }

  /**
   * Register a cleanup function to be called on disconnect
   */
  protected addCleanup(cleanupFn: () => void): void {
    this.cleanup.push(cleanupFn);
  }

  /**
   * Safe render with error protection and DOM validation
   */
  protected render() {
    // Check if component is still connected to DOM
    if (!this.isConnected) {
      return '';
    }

    try {
      this.renderAttempts++;
      
      // Prevent infinite render loops
      if (this.renderAttempts > this.maxRenderAttempts) {
        console.warn(`${this.constructor.name}: Maximum render attempts exceeded`);
        return '';
      }
      
      const result = this.safeRender();
      this.renderAttempts = 0; // Reset on successful render
      return result;
    } catch (error) {
      console.error(`${this.constructor.name}: Render error:`, error);
      return this.renderError(error);
    }
  }

  /**
   * Override this method in child components instead of render()
   */
  protected abstract safeRender(): any;

  /**
   * Render error fallback
   */
  protected renderError(error: any): any {
    return '';
  }

  /**
   * Add safe event listener with automatic cleanup
   */
  protected addEventListenerWithCleanup(
    target: EventTarget,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(event, handler, options);
    this.addCleanup(() => {
      target.removeEventListener(event, handler, options);
    });
  }

  /**
   * Safe setTimeout with automatic cleanup
   */
  protected setSafeTimeout(callback: () => void, delay: number): number {
    const timeoutId = setTimeout(callback, delay);
    this.addCleanup(() => clearTimeout(timeoutId));
    return timeoutId;
  }

  /**
   * Safe setInterval with automatic cleanup
   */
  protected setSafeInterval(callback: () => void, delay: number): number {
    const intervalId = setInterval(callback, delay);
    this.addCleanup(() => clearInterval(intervalId));
    return intervalId;
  }
}
