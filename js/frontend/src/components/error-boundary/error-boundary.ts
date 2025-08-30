import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";

export interface ErrorInfo {
  error: Error;
  timestamp: string;
  component?: string;
  context?: string;
}

@customElement("error-boundary")
export class ErrorBoundary extends BaseComponent {
  @property({ type: Boolean, attribute: "show-details" })
  showDetails = false;

  @property({ type: Boolean, attribute: "recoverable" })
  recoverable = true;

  @property({ type: String, attribute: "fallback-message" })
  fallbackMessage = "Something went wrong";

  @state()
  private errorInfo: ErrorInfo | null = null;

  @state()
  private hasError = false;

  @state()
  private retryCount = 0;

  private readonly maxRetries = 3;

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
      }

      .error-boundary {
        background: var(--color-surface);
        border: 2px solid var(--color-error);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-lg);
        margin: var(--spacing-md) 0;
        box-shadow: var(--shadow-md);
      }

      .error-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
      }

      .error-icon {
        font-size: 1.5em;
        color: var(--color-error);
      }

      .error-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-error);
        margin: 0;
      }

      .error-message {
        color: var(--color-text);
        margin: 0 0 var(--spacing-md) 0;
        line-height: 1.5;
      }

      .error-actions {
        display: flex;
        gap: var(--spacing-sm);
        flex-wrap: wrap;
      }

      .error-button {
        padding: var(--spacing-sm) var(--spacing-md);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .error-button:hover {
        background: var(--color-surface-hover);
        transform: var(--transform-hover);
      }

      .error-button.primary {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .error-button.primary:hover {
        background: var(--color-primary-hover);
        border-color: var(--color-primary-hover);
      }

      .error-details {
        margin-top: var(--spacing-md);
        padding: var(--spacing-md);
        background: var(--color-surface-hover);
        border-radius: var(--border-radius-md);
        border-left: 4px solid var(--color-error);
      }

      .error-details-title {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0 0 var(--spacing-xs) 0;
      }

      .error-details-content {
        font-family: var(--font-family-mono);
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        background: var(--color-background);
        padding: var(--spacing-sm);
        border-radius: var(--border-radius-sm);
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 200px;
        overflow-y: auto;
        line-height: 1.4;
      }

      .error-context {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        margin-top: var(--spacing-sm);
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .error-boundary {
          padding: var(--spacing-md);
        }

        .error-actions {
          flex-direction: column;
        }

        .error-button {
          justify-content: center;
        }
      }
    `
  ];

  // Method to catch and handle errors
  public captureError(error: Error, component?: string, context?: string): void {
    console.error('Error captured by ErrorBoundary:', error);
    
    this.errorInfo = {
      error,
      timestamp: new Date().toISOString(),
      component,
      context
    };
    
    this.hasError = true;
    
    // Emit error event for parent components
    this.emitEvent('error-captured', { 
      error, 
      component, 
      context, 
      timestamp: this.errorInfo.timestamp 
    });
  }

  private handleRetry(): void {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.hasError = false;
      this.errorInfo = null;
      
      // Emit retry event
      this.emitEvent('error-retry', { 
        retryCount: this.retryCount,
        maxRetries: this.maxRetries
      });
    }
  }

  private handleReset(): void {
    this.hasError = false;
    this.errorInfo = null;
    this.retryCount = 0;
    
    // Emit reset event
    this.emitEvent('error-reset');
  }

  private handleReload(): void {
    window.location.reload();
  }

  private toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }

  private formatErrorMessage(error: Error): string {
    let message = error.message || 'An unknown error occurred';
    
    // Add context-specific messaging
    if (error.name === 'NetworkError' || message.includes('fetch')) {
      message = 'Network connection error. Please check your internet connection and try again.';
    } else if (error.name === 'TypeError' && message.includes('Failed to fetch')) {
      message = 'Unable to connect to the server. The service may be temporarily unavailable.';
    } else if (error.name === 'SyntaxError') {
      message = 'Data format error. The server returned invalid data.';
    }
    
    return message;
  }

  protected safeRender(): TemplateResult {
    if (!this.hasError) {
      return html`<slot></slot>`;
    }

    const error = this.errorInfo?.error;
    const canRetry = this.recoverable && this.retryCount < this.maxRetries;
    
    return html`
      <div class="error-boundary">
        <div class="error-header">
          <span class="error-icon">⚠️</span>
          <h3 class="error-title">${this.fallbackMessage}</h3>
        </div>
        
        <p class="error-message">
          ${error ? this.formatErrorMessage(error) : 'An unexpected error occurred.'}
        </p>

        <div class="error-actions">
          ${canRetry ? html`
            <button 
              class="error-button primary"
              @click=${this.handleRetry}
            >
              <span>🔄</span>
              Retry ${this.retryCount > 0 ? `(${this.retryCount}/${this.maxRetries})` : ''}
            </button>
          ` : ''}
          
          <button 
            class="error-button"
            @click=${this.handleReset}
          >
            <span>🔧</span>
            Reset Component
          </button>
          
          <button 
            class="error-button"
            @click=${this.handleReload}
          >
            <span>⟳</span>
            Reload Page
          </button>
          
          ${this.errorInfo ? html`
            <button 
              class="error-button"
              @click=${this.toggleDetails}
            >
              <span>${this.showDetails ? '👁️' : '🔍'}</span>
              ${this.showDetails ? 'Hide' : 'Show'} Details
            </button>
          ` : ''}
        </div>

        ${this.showDetails && this.errorInfo ? html`
          <div class="error-details">
            <h4 class="error-details-title">Error Details</h4>
            <div class="error-details-content">
${error?.stack || error?.message || 'No stack trace available'}
            </div>
            <div class="error-context">
              ${this.errorInfo.component ? `Component: ${this.errorInfo.component}` : ''}
              ${this.errorInfo.context ? ` | Context: ${this.errorInfo.context}` : ''}
              | Time: ${new Date(this.errorInfo.timestamp).toLocaleString()}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "error-boundary": ErrorBoundary;
  }
}