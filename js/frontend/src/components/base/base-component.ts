import { LitElement, CSSResult, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { baseStyles } from '../../styles/shared/index.js';

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
  @property({ type: Boolean, reflect: true, attribute: 'dark-mode' })
  darkMode = false;

  /**
   * Common base styles that all components inherit
   * Now uses shared styles from the design system
   */
  static override styles: CSSResult[] = [
    baseStyles,
    css`
      :host {
        /* Component defaults */
        box-sizing: border-box;
        font-family: var(--font-family-mono);
        line-height: var(--line-height-relaxed);
        color: var(--color-text);
      }

      /* Component-specific utilities not covered by shared styles */
      .loading {
        opacity: 0.6;
        pointer-events: none;
      }

      .error {
        color: var(--color-message-system-error);
        background-color: var(--color-message-system-error-bg);
        padding: var(--spacing-sm);
        border-radius: var(--border-radius-sm);
        border-left: var(--color-message-system-error) 3px solid;
      }

      .hidden {
        display: none !important;
      }
    `
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
    errorMessage = 'An error occurred'
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
      })
    );
  }

  /**
   * Format timestamp for display
   */
  protected formatTimestamp(timestamp: string | Date): string {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleString();
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  protected formatRelativeTime(timestamp: string | Date): string {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
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
    return text.slice(0, maxLength - 3) + '...';
  }
}