import { LitElement, CSSResultGroup } from 'lit';
import { property, state } from 'lit/decorators.js';

/**
 * Base component class that provides common functionality for all session view components.
 * Extends LitElement with shared patterns, utilities, and styling approaches.
 */
export abstract class BaseComponent extends LitElement {
  /**
   * Loading state for async operations
   */
  @state()
  protected loading = false;

  /**
   * Error state for displaying error messages
   */
  @state()
  protected error: string | null = null;

  /**
   * Accessibility role for the component
   */
  @property({ type: String, reflect: true })
  role = 'region';

  /**
   * ARIA label for accessibility
   */
  @property({ type: String, attribute: 'aria-label' })
  ariaLabel?: string;

  /**
   * Whether the component should use dark theme
   */
  @property({ type: Boolean, attribute: 'dark-theme' })
  darkTheme = false;

  /**
   * Base styles shared across all components
   * Individual components should override this and include these base styles
   */
  static get baseStyles(): CSSResultGroup {
    return [];
  }

  /**
   * Lifecycle: Called when component is connected to DOM
   */
  connectedCallback(): void {
    super.connectedCallback();
    this.setupEventListeners();
    this.onConnected();
  }

  /**
   * Lifecycle: Called when component is disconnected from DOM
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupEventListeners();
    this.onDisconnected();
  }

  /**
   * Override point for components to set up event listeners
   */
  protected setupEventListeners(): void {
    // Override in subclasses if needed
  }

  /**
   * Override point for components to clean up event listeners
   */
  protected cleanupEventListeners(): void {
    // Override in subclasses if needed
  }

  /**
   * Override point for component initialization logic
   */
  protected onConnected(): void {
    // Override in subclasses if needed
  }

  /**
   * Override point for component cleanup logic
   */
  protected onDisconnected(): void {
    // Override in subclasses if needed
  }

  /**
   * Sets loading state and optionally clears errors
   * @param loading - Loading state
   * @param clearError - Whether to clear existing errors
   */
  protected setLoading(loading: boolean, clearError = true): void {
    this.loading = loading;
    if (clearError && loading) {
      this.error = null;
    }
  }

  /**
   * Sets error state and clears loading
   * @param error - Error message or Error object
   */
  protected setError(error: string | Error | null): void {
    this.error = error instanceof Error ? error.message : error;
    this.loading = false;
  }

  /**
   * Clears both loading and error states
   */
  protected clearStates(): void {
    this.loading = false;
    this.error = null;
  }

  /**
   * Emits a custom event with proper typing and bubbling
   * @param eventName - Name of the event
   * @param detail - Event detail data
   * @param options - Event options
   */
  protected emitEvent<T = any>(
    eventName: string,
    detail?: T,
    options: { bubbles?: boolean; composed?: boolean; cancelable?: boolean } = {}
  ): boolean {
    const event = new CustomEvent(eventName, {
      bubbles: options.bubbles ?? true,
      composed: options.composed ?? true,
      cancelable: options.cancelable ?? false,
      detail,
    });
    return this.dispatchEvent(event);
  }

  /**
   * Safe async operation wrapper with error handling and loading states
   * @param operation - Async operation to perform
   * @param errorMessage - Custom error message prefix
   */
  protected async safeAsyncOperation<T>(
    operation: () => Promise<T>,
    errorMessage = 'Operation failed'
  ): Promise<T | null> {
    try {
      this.setLoading(true);
      const result = await operation();
      this.clearStates();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setError(`${errorMessage}: ${message}`);
      console.error(`${this.tagName} - ${errorMessage}:`, error);
      return null;
    }
  }

  /**
   * Debounced function execution utility
   * @param func - Function to debounce
   * @param delay - Delay in milliseconds
   */
  protected debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Throttled function execution utility
   * @param func - Function to throttle
   * @param delay - Delay in milliseconds
   */
  protected throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func.apply(this, args);
      }
    };
  }

  /**
   * Focus management utility - focuses the first focusable element
   */
  protected focusFirstElement(): void {
    const focusableElements = this.shadowRoot?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements?.[0] as HTMLElement;
    firstElement?.focus();
  }

  /**
   * Scroll into view utility with smooth scrolling
   */
  protected scrollIntoViewSmooth(behavior: ScrollBehavior = 'smooth'): void {
    super.scrollIntoView({ behavior, block: 'nearest', inline: 'nearest' });
  }

  /**
   * Format date utility for consistent date display
   * @param date - Date to format
   * @param options - Intl.DateTimeFormat options
   */
  protected formatDate(
    date: Date | string,
    options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
  }

  /**
   * Sanitize HTML content to prevent XSS
   * @param html - HTML string to sanitize
   */
  protected sanitizeHTML(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Keyboard event handler for common keyboard interactions
   * @param event - Keyboard event
   */
  protected handleKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        this.handleEscape(event);
        break;
      case 'Enter':
        if (event.ctrlKey || event.metaKey) {
          this.handleCtrlEnter(event);
        } else {
          this.handleEnter(event);
        }
        break;
      case 'Tab':
        this.handleTab(event);
        break;
      default:
        // Let subclasses handle other keys
        this.handleOtherKeys(event);
    }
  }

  /**
   * Override point for Escape key handling
   * @param event - Keyboard event
   */
  protected handleEscape(event: KeyboardEvent): void {
    // Override in subclasses if needed
  }

  /**
   * Override point for Enter key handling
   * @param event - Keyboard event
   */
  protected handleEnter(event: KeyboardEvent): void {
    // Override in subclasses if needed
  }

  /**
   * Override point for Ctrl+Enter key handling
   * @param event - Keyboard event
   */
  protected handleCtrlEnter(event: KeyboardEvent): void {
    // Override in subclasses if needed
  }

  /**
   * Override point for Tab key handling
   * @param event - Keyboard event
   */
  protected handleTab(event: KeyboardEvent): void {
    // Override in subclasses if needed
  }

  /**
   * Override point for other key handling
   * @param event - Keyboard event
   */
  protected handleOtherKeys(event: KeyboardEvent): void {
    // Override in subclasses if needed
  }

  /**
   * Update accessibility attributes based on component state
   */
  protected updateAccessibility(): void {
    // Set aria-busy for loading states
    this.setAttribute('aria-busy', this.loading.toString());
    
    // Set aria-invalid for error states
    if (this.error) {
      this.setAttribute('aria-invalid', 'true');
    } else {
      this.removeAttribute('aria-invalid');
    }
  }

  /**
   * Called after every render to update accessibility
   */
  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
    
    // Update accessibility when loading or error state changes
    if (changedProperties.has('loading') || changedProperties.has('error')) {
      this.updateAccessibility();
    }
  }
}