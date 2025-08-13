import { html, css, CSSResultGroup } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';

/**
 * Loading spinner component
 */
@customElement('loading-spinner')
export class LoadingSpinner extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }

      .spinner {
        width: var(--spinner-size, 24px);
        height: var(--spinner-size, 24px);
        border: 2px solid var(--color-border-light);
        border-top: 2px solid var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
          border-top-color: var(--color-primary);
        }
      }
    `,
  ];

  render() {
    return html`<div class="spinner" role="status" aria-label="Loading"></div>`;
  }
}

/**
 * Loading state component with message
 */
@customElement('loading-state')
export class LoadingState extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-xl);
        text-align: center;
      }

      .loading-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-md);
        max-width: 400px;
      }

      .loading-spinner {
        --spinner-size: 32px;
      }

      .loading-message {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        line-height: 1.5;
      }

      .loading-details {
        color: var(--color-text-muted);
        font-size: var(--font-size-xs);
        font-style: italic;
      }

      .loading-progress {
        width: 200px;
        height: 4px;
        background: var(--color-background-tertiary);
        border-radius: 2px;
        overflow: hidden;
        position: relative;
      }

      .progress-bar {
        height: 100%;
        background: var(--color-primary);
        border-radius: 2px;
        transition: width var(--transition-normal);
      }

      .progress-indeterminate {
        width: 30%;
        animation: progress-indeterminate 2s infinite;
      }

      @keyframes progress-indeterminate {
        0% { left: -30%; }
        100% { left: 100%; }
      }

      @media (prefers-reduced-motion: reduce) {
        .progress-indeterminate {
          animation: none;
          left: 0;
          width: 100%;
        }
      }
    `,
  ];

  @property({ type: String })
  message = 'Loading...';

  @property({ type: String })
  details?: string;

  @property({ type: Number })
  progress?: number; // 0-100, undefined for indeterminate

  render() {
    return html`
      <div class="loading-content">
        <loading-spinner class="loading-spinner"></loading-spinner>
        
        <div class="loading-message">${this.message}</div>
        
        ${this.details ? html`
          <div class="loading-details">${this.details}</div>
        ` : ''}

        <div class="loading-progress">
          <div class="progress-bar ${this.progress === undefined ? 'progress-indeterminate' : ''}" 
               style="width: ${this.progress ?? 0}%">
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Skeleton loader for session items
 */
@customElement('session-skeleton')
export class SessionSkeleton extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: var(--space-sm);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
        background: var(--color-background);
      }

      .skeleton-item {
        display: flex;
        gap: var(--space-sm);
        align-items: flex-start;
      }

      .skeleton-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--skeleton-color);
        flex-shrink: 0;
      }

      .skeleton-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .skeleton-line {
        height: 16px;
        border-radius: 8px;
        background: var(--skeleton-color);
        position: relative;
        overflow: hidden;
      }

      .skeleton-line.title {
        width: 70%;
      }

      .skeleton-line.subtitle {
        width: 50%;
        height: 12px;
      }

      .skeleton-line.metadata {
        width: 30%;
        height: 12px;
      }

      .skeleton-actions {
        display: flex;
        gap: var(--space-xs);
        margin-top: var(--space-xs);
      }

      .skeleton-button {
        width: 60px;
        height: 24px;
        border-radius: var(--border-radius-sm);
        background: var(--skeleton-color);
      }

      /* Skeleton shimmer animation */
      :host {
        --skeleton-color: var(--color-background-secondary);
      }

      .skeleton-line::after,
      .skeleton-avatar::after,
      .skeleton-button::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          var(--color-background-tertiary) 50%,
          transparent 100%
        );
        animation: skeleton-shimmer 1.5s infinite;
      }

      @keyframes skeleton-shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      @media (prefers-reduced-motion: reduce) {
        .skeleton-line::after,
        .skeleton-avatar::after,
        .skeleton-button::after {
          animation: none;
        }
      }
    `,
  ];

  @property({ type: Number })
  count = 1;

  render() {
    return html`
      ${Array.from({ length: this.count }, (_, i) => html`
        <div class="skeleton-item">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-content">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line subtitle"></div>
            <div class="skeleton-line metadata"></div>
            <div class="skeleton-actions">
              <div class="skeleton-button"></div>
              <div class="skeleton-button"></div>
            </div>
          </div>
        </div>
      `)}
    `;
  }
}

/**
 * Error boundary component
 */
@customElement('error-boundary')
export class ErrorBoundary extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-xl);
        text-align: center;
        border: 1px solid var(--color-danger-light);
        border-radius: var(--border-radius);
        background: var(--color-danger-light);
        color: var(--color-danger-dark);
        margin: var(--space-sm);
      }

      .error-icon {
        font-size: 48px;
        margin-bottom: var(--space-md);
        opacity: 0.7;
      }

      .error-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        margin: 0 0 var(--space-sm) 0;
        color: var(--color-danger-dark);
      }

      .error-message {
        color: var(--color-text-secondary);
        margin-bottom: var(--space-lg);
        max-width: 500px;
        line-height: 1.5;
      }

      .error-details {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-sm);
        margin-bottom: var(--space-lg);
        font-family: var(--font-family-mono);
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        max-width: 100%;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .error-actions {
        display: flex;
        gap: var(--space-sm);
        flex-wrap: wrap;
        justify-content: center;
      }

      .error-button {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: none;
        border-radius: var(--border-radius);
        padding: var(--space-sm) var(--space-md);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .error-button:hover {
        background: var(--color-primary-dark);
      }

      .error-button.secondary {
        background: var(--color-background);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
      }

      .error-button.secondary:hover {
        background: var(--color-background-secondary);
      }

      .collapsible-details {
        margin-bottom: var(--space-lg);
      }

      .details-toggle {
        background: none;
        border: none;
        color: var(--color-primary);
        cursor: pointer;
        font-size: var(--font-size-sm);
        text-decoration: underline;
        padding: 0;
      }

      .details-toggle:hover {
        color: var(--color-primary-dark);
      }
    `,
  ];

  @property({ type: String })
  title = 'Something went wrong';

  @property({ type: String })
  message = 'An unexpected error occurred. Please try again.';

  @property({ type: String })
  error?: string;

  @property({ type: Boolean })
  showDetails = false;

  @property({ type: Boolean })
  showRetry = true;

  @property({ type: Boolean })
  showReload = false;

  render() {
    return html`
      <div class="error-container" role="alert">
        <div class="error-icon">⚠️</div>
        
        <h2 class="error-title">${this.title}</h2>
        
        <div class="error-message">${this.message}</div>

        ${this.error ? html`
          <div class="collapsible-details">
            <button 
              class="details-toggle"
              @click=${this.toggleDetails}
              aria-expanded="${this.showDetails}"
            >
              ${this.showDetails ? 'Hide' : 'Show'} Details
            </button>
            
            ${this.showDetails ? html`
              <div class="error-details">${this.error}</div>
            ` : ''}
          </div>
        ` : ''}

        <div class="error-actions">
          ${this.showRetry ? html`
            <button 
              class="error-button"
              @click=${this.handleRetry}
            >
              🔄 Try Again
            </button>
          ` : ''}

          ${this.showReload ? html`
            <button 
              class="error-button secondary"
              @click=${this.handleReload}
            >
              🔃 Reload Page
            </button>
          ` : ''}

          <button 
            class="error-button secondary"
            @click=${this.handleGoBack}
          >
            ← Go Back
          </button>
        </div>
      </div>
    `;
  }

  private toggleDetails() {
    this.showDetails = !this.showDetails;
  }

  private handleRetry() {
    this.emitEvent('error-retry', {});
  }

  private handleReload() {
    window.location.reload();
  }

  private handleGoBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.emitEvent('error-navigate-home', {});
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'loading-spinner': LoadingSpinner;
    'loading-state': LoadingState;
    'session-skeleton': SessionSkeleton;
    'error-boundary': ErrorBoundary;
  }
}