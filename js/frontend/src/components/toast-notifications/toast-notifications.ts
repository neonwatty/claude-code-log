/**
 * Toast Notifications Component
 * Displays temporary notifications for connection state changes and other events
 */

import { html, css, CSSResult } from "lit";
import { state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import {
  ConnectionState,
  getConnectionStateDisplay,
  getStateChangeAnnouncement,
} from "../../utils/websocket/connection-state.js";
import type { ConnectionStateEvent } from "../../utils/websocket/connection-state.js";

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: "success" | "warning" | "error" | "info";
  duration?: number;
  persistent?: boolean;
  actions?: ToastAction[];
}

export interface ToastAction {
  label: string;
  action: () => void;
  primary?: boolean;
}

export class ToastNotificationsComponent extends BaseComponent {
  @state()
  private toasts: Toast[] = [];

  private toastCounter = 0;
  private ariaAnnouncer: HTMLElement | null = null;

  static override styles: CSSResult[] = [
    ...BaseComponent.styles,
    css`
      :host {
        position: fixed;
        top: var(--spacing-lg);
        right: var(--spacing-lg);
        z-index: 9999;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
        max-width: 400px;
      }

      .toast {
        pointer-events: auto;
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-md);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideIn 0.3s ease-out;
        position: relative;
        overflow: hidden;
      }

      .toast.removing {
        animation: slideOut 0.3s ease-out forwards;
      }

      .toast-header {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-xs);
      }

      .toast-icon {
        font-size: 1.2em;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .toast-content {
        flex: 1;
        min-width: 0;
      }

      .toast-title {
        font-weight: 600;
        font-size: 0.9em;
        margin: 0 0 var(--spacing-xs) 0;
        color: var(--color-text);
      }

      .toast-message {
        font-size: 0.85em;
        color: var(--color-text-muted);
        line-height: 1.4;
        margin: 0;
      }

      .toast-close {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: var(--spacing-xs);
        margin: -var(--spacing-xs);
        border-radius: var(--border-radius-sm);
        font-size: 1.1em;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .toast-close:hover {
        background: var(--color-background-hover);
        color: var(--color-text);
      }

      .toast-actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-sm);
        justify-content: flex-end;
      }

      .toast-action {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        background: var(--color-background);
        color: var(--color-text);
        font-size: 0.8em;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .toast-action:hover {
        background: var(--color-background-hover);
      }

      .toast-action.primary {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .toast-action.primary:hover {
        background: var(--color-primary-hover);
      }

      /* Progress bar for timed toasts */
      .toast-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: var(--color-primary);
        transition: width linear;
      }

      /* Toast type styles */
      .toast.success {
        border-left: 4px solid var(--color-success);
      }

      .toast.warning {
        border-left: 4px solid var(--color-warning);
      }

      .toast.error {
        border-left: 4px solid var(--color-error);
      }

      .toast.info {
        border-left: 4px solid var(--color-info, var(--color-primary));
      }

      /* Icons for different toast types */
      .toast.success .toast-icon {
        color: var(--color-success);
      }
      .toast.warning .toast-icon {
        color: var(--color-warning);
      }
      .toast.error .toast-icon {
        color: var(--color-error);
      }
      .toast.info .toast-icon {
        color: var(--color-info, var(--color-primary));
      }

      /* Animations */
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
          max-height: 200px;
          margin-bottom: var(--spacing-sm);
        }
        to {
          transform: translateX(100%);
          opacity: 0;
          max-height: 0;
          margin-bottom: 0;
          padding-top: 0;
          padding-bottom: 0;
        }
      }

      /* Accessibility */
      .sr-announcer {
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        :host {
          top: var(--spacing-sm);
          right: var(--spacing-sm);
          left: var(--spacing-sm);
          max-width: none;
        }

        .toast {
          padding: var(--spacing-sm);
        }

        .toast-title {
          font-size: 0.85em;
        }

        .toast-message {
          font-size: 0.8em;
        }
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    this.createAriaAnnouncer();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeAriaAnnouncer();
  }

  private createAriaAnnouncer() {
    this.ariaAnnouncer = document.createElement("div");
    this.ariaAnnouncer.className = "sr-announcer";
    this.ariaAnnouncer.setAttribute("aria-live", "polite");
    this.ariaAnnouncer.setAttribute("aria-atomic", "true");
    document.body.appendChild(this.ariaAnnouncer);
  }

  private removeAriaAnnouncer() {
    if (this.ariaAnnouncer) {
      document.body.removeChild(this.ariaAnnouncer);
      this.ariaAnnouncer = null;
    }
  }

  /**
   * Show a toast notification
   */
  public showToast(toast: Omit<Toast, "id">): string {
    const id = `toast-${++this.toastCounter}`;
    const newToast: Toast = {
      id,
      duration: 5000, // Default 5 seconds
      persistent: false,
      ...toast,
    };

    this.toasts = [...this.toasts, newToast];
    this.announceToast(newToast);

    // Auto-remove after duration unless persistent
    if (!newToast.persistent && newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, newToast.duration);
    }

    return id;
  }

  /**
   * Remove a toast notification
   */
  public removeToast(id: string) {
    const toastElement = this.shadowRoot?.querySelector(
      `[data-toast-id="${id}"]`,
    ) as HTMLElement;
    if (toastElement) {
      toastElement.classList.add("removing");
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, 300); // Match animation duration
    }
  }

  /**
   * Clear all toast notifications
   */
  public clearAllToasts() {
    this.toasts.forEach((toast) => this.removeToast(toast.id));
  }

  /**
   * Show connection state change notification
   */
  public showConnectionStateToast(event: ConnectionStateEvent) {
    const stateDisplay = getConnectionStateDisplay(event.currentState);
    const announcement = getStateChangeAnnouncement(event);

    let type: Toast["type"];
    switch (event.currentState) {
      case ConnectionState.CONNECTED:
        type = "success";
        break;
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        type = "info";
        break;
      case ConnectionState.ERROR:
        type = "error";
        break;
      default:
        type = "warning";
    }

    const actions: ToastAction[] = [];

    // Add retry action for error states
    if (
      event.currentState === ConnectionState.ERROR ||
      event.currentState === ConnectionState.DISCONNECTED
    ) {
      actions.push({
        label: "Retry",
        action: () => {
          this.emitEvent("connection-retry-requested");
        },
        primary: true,
      });
    }

    this.showToast({
      title: `Connection ${stateDisplay.label}`,
      message: event.reason || announcement,
      type,
      duration: type === "error" ? 0 : 4000, // Error toasts persist
      persistent: type === "error",
      actions: actions.length > 0 ? actions : undefined,
    });
  }

  private announceToast(toast: Toast) {
    if (this.ariaAnnouncer) {
      this.ariaAnnouncer.textContent = `${toast.title}. ${toast.message}`;
    }
  }

  private getToastIcon(type: Toast["type"]): string {
    switch (type) {
      case "success":
        return "✅";
      case "warning":
        return "⚠️";
      case "error":
        return "❌";
      case "info":
        return "ℹ️";
      default:
        return "ℹ️";
    }
  }

  private handleToastAction(action: ToastAction, toastId: string) {
    action.action();
    this.removeToast(toastId);
  }

  override render() {
    return html`
      ${this.toasts.map(
        (toast) => html`
          <div
            class="toast ${toast.type}"
            data-toast-id="${toast.id}"
            role="alert"
            aria-labelledby="toast-title-${toast.id}"
            aria-describedby="toast-message-${toast.id}"
          >
            <div class="toast-header">
              <span class="toast-icon" role="img" aria-hidden="true">
                ${this.getToastIcon(toast.type)}
              </span>
              <div class="toast-content">
                <h3 class="toast-title" id="toast-title-${toast.id}">
                  ${toast.title}
                </h3>
                <p class="toast-message" id="toast-message-${toast.id}">
                  ${toast.message}
                </p>
              </div>
              <button
                class="toast-close"
                @click=${() => this.removeToast(toast.id)}
                aria-label="Close notification"
                title="Close"
              >
                ✕
              </button>
            </div>

            ${toast.actions && toast.actions.length > 0
              ? html`
                  <div class="toast-actions">
                    ${toast.actions.map(
                      (action) => html`
                        <button
                          class="toast-action ${action.primary
                            ? "primary"
                            : ""}"
                          @click=${() =>
                            this.handleToastAction(action, toast.id)}
                        >
                          ${action.label}
                        </button>
                      `,
                    )}
                  </div>
                `
              : ""}
            ${!toast.persistent && toast.duration
              ? html`
                  <div
                    class="toast-progress"
                    style="animation-duration: ${toast.duration}ms; width: 0%"
                  ></div>
                `
              : ""}
          </div>
        `,
      )}
    `;
  }
}

// Register the custom element
customElements.define("toast-notifications", ToastNotificationsComponent);
