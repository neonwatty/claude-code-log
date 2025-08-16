import { LitElement, CSSResult, css } from 'lit';
import { property, state } from 'lit/decorators.js';

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
   */
  static override styles: CSSResult[] = [css`
    :host {
      /* CSS Custom Properties for theming - matching Python template styles */
      --color-primary: #2196f3;
      --color-secondary: #9c27b0;
      --color-success: #4caf50;
      --color-warning: #ff9800;
      --color-error: #f44336;
      --color-info: #2196f3;
      --color-tool-use: #e91e63;
      --color-tool-result: #4caf50;
      --color-thinking: #9e9e9e;
      --color-image: #ff5722;
      --color-text: #333;
      --color-text-muted: #666;
      --color-text-light: #555;

      /* Background and surface colors */
      --color-background: linear-gradient(90deg, #f3d6d2, #f1dcce, #f0e4ca, #eeecc7, #e3ecc3, #d5eac0, #c6e8bd, #b9e6bc, #b6e3c5, #b3e1cf);
      --color-surface: #ffffff66;
      --color-surface-hover: #ffffff88;
      --color-surface-active: #ffffffaa;

      /* Shadow and border colors */
      --color-shadow-light: #eeeeee44;
      --color-shadow-dark: #00000011;
      --color-shadow-hover-light: #eeeeee66;
      --color-shadow-hover-dark: #00000022;
      --color-border-light: #ffffff66;
      --color-border-dark: #00000017;

      /* Typography */
      --font-family-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Droid Sans Mono', 'Source Code Pro', 'Ubuntu Mono', 'Cascadia Code', 'Menlo', 'Consolas', monospace;
      --font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --line-height: 1.5;

      /* Spacing */
      --spacing-xs: 4px;
      --spacing-sm: 8px;
      --spacing-md: 16px;
      --spacing-lg: 24px;
      --spacing-xl: 32px;

      /* Border radius */
      --border-radius-sm: 3px;
      --border-radius-md: 8px;
      --border-radius-lg: 12px;

      /* Transitions */
      --transition-fast: 0.2s ease;
      --transition-normal: 0.3s ease;

      /* Z-index scale */
      --z-dropdown: 100;
      --z-sticky: 200;
      --z-modal: 1000;
      --z-floating: 1100;

      /* Component defaults */
      box-sizing: border-box;
      font-family: var(--font-family-mono);
      line-height: var(--line-height);
      color: var(--color-text);
    }

    :host([dark-mode]) {
      /* Dark mode overrides */
      --color-background: linear-gradient(90deg, #2a1f1d, #2e2320, #322722, #362b25, #3a2f28, #3e332b, #42372e, #463b31, #4a3f34, #4e4337);
      --color-surface: #ffffff11;
      --color-surface-hover: #ffffff22;
      --color-surface-active: #ffffff33;
      --color-text: #e0e0e0;
      --color-text-muted: #aaa;
      --color-text-light: #ccc;
    }

    /* Common utility classes */
    .card {
      background-color: var(--color-surface);
      border-radius: var(--border-radius-md);
      padding: var(--spacing-md);
      box-shadow: -7px -7px 10px var(--color-shadow-light), 7px 7px 10px var(--color-shadow-dark);
      border-left: var(--color-border-light) 1px solid;
      border-top: var(--color-border-light) 1px solid;
      border-bottom: var(--color-border-dark) 1px solid;
      border-right: var(--color-border-dark) 1px solid;
      transition: all var(--transition-fast);
    }

    .card:hover {
      box-shadow: -10px -10px 15px var(--color-shadow-hover-light), 10px 10px 15px var(--color-shadow-hover-dark);
      transform: translateY(-1px);
    }

    .header {
      font-weight: 600;
      margin-bottom: var(--spacing-sm);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
    }

    .timestamp {
      font-size: 0.85em;
      color: var(--color-text-muted);
      font-weight: normal;
    }

    .loading {
      opacity: 0.6;
      pointer-events: none;
    }

    .error {
      color: var(--color-error);
      background-color: #ffebee88;
      padding: var(--spacing-sm);
      border-radius: var(--border-radius-sm);
      border-left: var(--color-error) 3px solid;
    }

    .hidden {
      display: none !important;
    }

    /* Code styling */
    code {
      background-color: #f5f5f5;
      padding: 2px 4px;
      border-radius: var(--border-radius-sm);
      font-family: var(--font-family-mono);
      font-size: 0.9em;
    }

    pre {
      background-color: #12121212;
      padding: 10px;
      border-radius: var(--border-radius-sm);
      white-space: pre-wrap;
      word-wrap: break-word;
      word-break: break-word;
      font-family: var(--font-family-mono);
      line-height: var(--line-height);
      overflow-x: auto;
    }
  `];

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