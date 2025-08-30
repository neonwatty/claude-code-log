import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";

export interface MobileToast {
  id: string;
  title: string;
  message: string;
  type: "success" | "warning" | "error" | "info";
  duration?: number;
  persistent?: boolean;
  dismissible?: boolean;
  actions?: MobileToastAction[];
}

export interface MobileToastAction {
  label: string;
  action: () => void;
  primary?: boolean;
}

@customElement("mobile-toast")
export class MobileToastComponent extends BaseComponent {
  @property({ type: Object })
  toast: MobileToast | null = null;

  @property({ type: Boolean, attribute: "is-mobile" })
  isMobile = false;

  @state()
  private isVisible = false;

  @state()
  private isRemoving = false;

  private autoHideTimer: number | null = null;
  private touchStartY = 0;
  private touchEndY = 0;

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        pointer-events: none;
      }

      .mobile-toast {
        pointer-events: auto;
        position: fixed;
        left: var(--spacing-sm);
        right: var(--spacing-sm);
        background: var(--color-surface);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius-lg);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        padding: var(--spacing-md);
        transform: translateY(-100%);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 10000;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      /* Desktop positioning - top right */
      @media (min-width: 769px) {
        .mobile-toast {
          position: fixed;
          top: var(--spacing-lg);
          right: var(--spacing-lg);
          left: auto;
          width: 400px;
          transform: translateX(100%);
        }

        .mobile-toast.visible {
          transform: translateX(0);
        }

        .mobile-toast.removing {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      /* Mobile positioning - top of screen */
      @media (max-width: 768px) {
        .mobile-toast {
          top: 0;
          left: 0;
          right: 0;
          border-radius: 0 0 var(--border-radius-lg) var(--border-radius-lg);
          padding: calc(var(--spacing-md) + env(safe-area-inset-top)) var(--spacing-md) var(--spacing-md);
        }

        .mobile-toast.visible {
          transform: translateY(0);
        }

        .mobile-toast.removing {
          transform: translateY(-100%);
          opacity: 0;
        }
      }

      .toast-border {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
      }

      .toast-border.success { background: var(--color-success); }
      .toast-border.warning { background: var(--color-warning); }
      .toast-border.error { background: var(--color-error); }
      .toast-border.info { background: var(--color-primary); }

      .toast-header {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-sm);
      }

      .toast-icon {
        font-size: 1.3em;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .toast-icon.success { color: var(--color-success); }
      .toast-icon.warning { color: var(--color-warning); }
      .toast-icon.error { color: var(--color-error); }
      .toast-icon.info { color: var(--color-primary); }

      .toast-content {
        flex: 1;
        min-width: 0;
      }

      .toast-title {
        font-weight: var(--font-weight-semibold);
        font-size: var(--font-size-md);
        margin: 0 0 var(--spacing-xs) 0;
        color: var(--color-text);
        line-height: 1.3;
      }

      .toast-message {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        line-height: 1.4;
        margin: 0;
        word-wrap: break-word;
      }

      .toast-actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-md);
        flex-wrap: wrap;
      }

      .toast-action {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-sm);
        background: var(--color-surface-hover);
        color: var(--color-text);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition: all var(--transition-fast);
        flex: 1;
        text-align: center;
        min-height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .toast-action:hover {
        background: var(--color-surface-active);
        transform: var(--transform-hover);
      }

      .toast-action.primary {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .toast-action.primary:hover {
        background: var(--color-primary-hover);
        border-color: var(--color-primary-hover);
      }

      .toast-dismiss {
        position: absolute;
        top: var(--spacing-sm);
        right: var(--spacing-sm);
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: var(--color-text-muted);
        cursor: pointer;
        border-radius: var(--border-radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-size-lg);
        transition: all var(--transition-fast);
      }

      .toast-dismiss:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
      }

      .toast-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: var(--color-primary);
        border-radius: 0 0 var(--border-radius-lg) var(--border-radius-lg);
        transform-origin: left;
        animation: progressBar linear forwards;
      }

      @keyframes progressBar {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
      }

      /* Swipe indicator for mobile */
      .swipe-indicator {
        position: absolute;
        top: var(--spacing-xs);
        left: 50%;
        transform: translateX(-50%);
        width: 36px;
        height: 4px;
        background: var(--color-border-medium);
        border-radius: 2px;
        opacity: 0.5;
      }

      @media (min-width: 769px) {
        .swipe-indicator {
          display: none;
        }
      }

      /* Touch feedback */
      .mobile-toast.dragging {
        transition: none;
      }
    `
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.toast) {
      this.show();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearAutoHideTimer();
  }

  public show(): void {
    if (!this.toast) return;

    // Show with slight delay for animation
    requestAnimationFrame(() => {
      this.isVisible = true;
      
      // Set up auto-hide timer
      if (!this.toast!.persistent && this.toast!.duration) {
        this.setupAutoHide(this.toast!.duration);
      } else if (!this.toast!.persistent && !this.toast!.duration) {
        // Default duration based on type
        const defaultDuration = this.toast!.type === 'error' ? 8000 : 5000;
        this.setupAutoHide(defaultDuration);
      }
    });
  }

  public hide(): void {
    this.clearAutoHideTimer();
    this.isRemoving = true;
    
    // Wait for animation then remove
    setTimeout(() => {
      this.isVisible = false;
      this.isRemoving = false;
      this.emitEvent('toast-hidden', { toast: this.toast });
    }, 300);
  }

  private setupAutoHide(duration: number): void {
    this.clearAutoHideTimer();
    this.autoHideTimer = window.setTimeout(() => {
      this.hide();
    }, duration);
  }

  private clearAutoHideTimer(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }

  private handleDismiss(): void {
    this.emitEvent('toast-dismissed', { toast: this.toast });
    this.hide();
  }

  private handleActionClick(action: MobileToastAction): void {
    action.action();
    this.emitEvent('toast-action-clicked', { toast: this.toast, action });
    
    // Hide toast after action unless persistent
    if (!this.toast?.persistent) {
      this.hide();
    }
  }

  private handleTouchStart(event: TouchEvent): void {
    if (!this.isMobile) return;
    
    this.touchStartY = event.touches[0].clientY;
    this.classList.add('dragging');
  }

  private handleTouchMove(event: TouchEvent): void {
    if (!this.isMobile) return;
    
    const touchY = event.touches[0].clientY;
    const deltaY = touchY - this.touchStartY;
    
    // Only allow upward swipe to dismiss
    if (deltaY < 0) {
      const element = this.shadowRoot?.querySelector('.mobile-toast') as HTMLElement;
      if (element) {
        element.style.transform = `translateY(${deltaY}px)`;
      }
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (!this.isMobile) return;
    
    this.classList.remove('dragging');
    this.touchEndY = event.changedTouches[0].clientY;
    const deltaY = this.touchEndY - this.touchStartY;
    
    const element = this.shadowRoot?.querySelector('.mobile-toast') as HTMLElement;
    if (element) {
      element.style.transform = '';
    }
    
    // If swiped up enough, dismiss
    if (deltaY < -50) {
      this.handleDismiss();
    }
  }

  private getToastIcon(type: MobileToast['type']): string {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  }

  protected safeRender(): TemplateResult {
    if (!this.toast || !this.isVisible) {
      return html``;
    }

    const { toast } = this;

    return html`
      <div 
        class="mobile-toast ${this.isVisible ? 'visible' : ''} ${this.isRemoving ? 'removing' : ''}"
        @touchstart=${this.handleTouchStart}
        @touchmove=${this.handleTouchMove}
        @touchend=${this.handleTouchEnd}
        role="alert"
        aria-live="polite"
      >
        <div class="toast-border ${toast.type}"></div>
        
        ${this.isMobile ? html`<div class="swipe-indicator"></div>` : ''}
        
        ${(toast.dismissible !== false) ? html`
          <button 
            class="toast-dismiss"
            @click=${this.handleDismiss}
            aria-label="Dismiss notification"
            title="Dismiss"
          >
            ✕
          </button>
        ` : ''}

        <div class="toast-header">
          <span class="toast-icon ${toast.type}">
            ${this.getToastIcon(toast.type)}
          </span>
          <div class="toast-content">
            <h4 class="toast-title">${toast.title}</h4>
            <p class="toast-message">${toast.message}</p>
          </div>
        </div>

        ${toast.actions && toast.actions.length > 0 ? html`
          <div class="toast-actions">
            ${toast.actions.map(action => html`
              <button
                class="toast-action ${action.primary ? 'primary' : ''}"
                @click=${() => this.handleActionClick(action)}
              >
                ${action.label}
              </button>
            `)}
          </div>
        ` : ''}

        ${toast.duration && !toast.persistent ? html`
          <div 
            class="toast-progress"
            style="animation-duration: ${toast.duration}ms"
          ></div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mobile-toast": MobileToastComponent;
  }
}