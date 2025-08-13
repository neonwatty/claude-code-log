import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Router } from '@vaadin/router';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { SessionSummary, SessionDetail } from '../types/session-types';

/**
 * URL route parameters
 */
export interface RouteParams {
  sessionId?: string;
  messageIndex?: string;
  branchId?: string;
  action?: string;
}

/**
 * Route configuration
 */
export interface RouteConfig {
  path: string;
  component: string;
  name: string;
  title?: string;
}

/**
 * Session browser router component
 * Handles deep linking and navigation state management
 */
@customElement('session-router')
export class SessionRouter extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .router-container {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .route-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-xl);
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
      }

      .route-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-xl);
        color: var(--color-danger);
        text-align: center;
      }

      .error-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        margin: 0 0 var(--space-sm) 0;
      }

      .error-message {
        color: var(--color-text-secondary);
        margin-bottom: var(--space-lg);
        max-width: 400px;
      }

      .error-actions {
        display: flex;
        gap: var(--space-sm);
      }

      .route-button {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: none;
        border-radius: var(--border-radius);
        padding: var(--space-sm) var(--space-md);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: background-color var(--transition-fast);
      }

      .route-button:hover {
        background: var(--color-primary-dark);
      }

      .route-button.secondary {
        background: var(--color-background);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
      }

      .route-button.secondary:hover {
        background: var(--color-background-secondary);
      }
    `,
  ];

  /**
   * Available sessions for routing
   */
  @property({ type: Array })
  sessions: SessionSummary[] = [];

  /**
   * Base path for the router
   */
  @property({ type: String })
  basePath = '/sessions';

  /**
   * Whether the router is configured
   */
  @state()
  private routerConfigured = false;

  /**
   * Current route parameters
   */
  @state()
  private currentParams: RouteParams = {};

  /**
   * Current route loading state
   */
  @state()
  private isLoading = false;

  /**
   * Current route error
   */
  @state()
  private routeError: string | null = null;

  private router?: Router;

  render() {
    return html`
      <div class="router-container">
        <div id="router-outlet"></div>
        ${this.renderRouteState()}
      </div>
    `;
  }

  private renderRouteState() {
    if (this.isLoading) {
      return html`
        <div class="route-loading">
          <div>Loading...</div>
        </div>
      `;
    }

    if (this.routeError) {
      return html`
        <div class="route-error">
          <h2 class="error-title">Navigation Error</h2>
          <div class="error-message">${this.routeError}</div>
          <div class="error-actions">
            <button 
              class="route-button"
              @click=${this.goHome}
            >
              Go to Sessions
            </button>
            <button 
              class="route-button secondary"
              @click=${this.goBack}
            >
              Go Back
            </button>
          </div>
        </div>
      `;
    }

    return '';
  }

  firstUpdated() {
    super.firstUpdated();
    this.setupRouter();
  }

  private setupRouter() {
    const outlet = this.shadowRoot?.getElementById('router-outlet');
    if (!outlet || this.routerConfigured) return;

    this.router = new Router(outlet);

    // Define routes
    this.router.setRoutes([
      {
        path: `${this.basePath}`,
        name: 'sessions-home',
        action: () => this.handleRoute({})
      },
      {
        path: `${this.basePath}/session/:sessionId`,
        name: 'session-detail',
        action: (context: any) => this.handleRoute({
          sessionId: context.params.sessionId
        })
      },
      {
        path: `${this.basePath}/session/:sessionId/message/:messageIndex`,
        name: 'session-message',
        action: (context: any) => this.handleRoute({
          sessionId: context.params.sessionId,
          messageIndex: context.params.messageIndex
        })
      },
      {
        path: `${this.basePath}/session/:sessionId/branch/:branchId`,
        name: 'session-branch',
        action: (context: any) => this.handleRoute({
          sessionId: context.params.sessionId,
          branchId: context.params.branchId
        })
      },
      {
        path: `${this.basePath}/session/:sessionId/:action`,
        name: 'session-action',
        action: (context: any) => this.handleRoute({
          sessionId: context.params.sessionId,
          action: context.params.action
        })
      },
      {
        path: `${this.basePath}/(.*)*`,
        name: 'sessions-fallback',
        action: () => this.handleRoute({})
      }
    ]);

    this.routerConfigured = true;
    this.emitEvent('router-ready', {});
  }

  private cleanupRouter() {
    if (this.router) {
      // Router cleanup would go here if needed
      this.routerConfigured = false;
    }
  }

  private async handleRoute(params: RouteParams) {
    this.isLoading = true;
    this.routeError = null;
    this.currentParams = params;

    try {
      // Validate route parameters
      await this.validateRoute(params);

      // Update document title
      this.updateDocumentTitle(params);

      // Emit navigation event
      this.emitEvent('route-changed', { params });

      // Handle specific route logic
      await this.processRoute(params);

    } catch (error) {
      console.error('Route handling error:', error);
      this.routeError = error instanceof Error ? error.message : 'Navigation failed';
    } finally {
      this.isLoading = false;
    }
  }

  private async validateRoute(params: RouteParams): Promise<void> {
    // Validate session exists
    if (params.sessionId) {
      const session = this.sessions.find(s => s.sessionId === params.sessionId);
      if (!session) {
        throw new Error(`Session "${params.sessionId}" not found`);
      }
    }

    // Validate message index
    if (params.messageIndex) {
      const messageIndex = parseInt(params.messageIndex);
      if (isNaN(messageIndex) || messageIndex < 0) {
        throw new Error(`Invalid message index: ${params.messageIndex}`);
      }
    }

    // Validate action
    if (params.action) {
      const validActions = ['edit', 'export', 'share', 'delete', 'archive', 'branch', 'compare'];
      if (!validActions.includes(params.action)) {
        throw new Error(`Invalid action: ${params.action}`);
      }
    }
  }

  private updateDocumentTitle(params: RouteParams) {
    let title = 'Claude Code Sessions';

    if (params.sessionId) {
      const session = this.sessions.find(s => s.sessionId === params.sessionId);
      if (session) {
        title = session.title || `Session ${session.sessionId}`;
        
        if (params.messageIndex) {
          title += ` - Message ${params.messageIndex}`;
        } else if (params.branchId) {
          title += ` - Branch ${params.branchId}`;
        } else if (params.action) {
          title += ` - ${this.capitalizeAction(params.action)}`;
        }
      }
    }

    document.title = title;
  }

  private async processRoute(params: RouteParams) {
    // Additional route-specific processing can go here
    // For example, preloading session data, updating UI state, etc.
    
    if (params.sessionId && params.messageIndex) {
      // Preload message data
      this.emitEvent('message-focus-requested', {
        sessionId: params.sessionId,
        messageIndex: parseInt(params.messageIndex)
      });
    }

    if (params.action) {
      // Handle action routes
      this.emitEvent('session-action-requested', {
        sessionId: params.sessionId,
        action: params.action
      });
    }
  }

  // Public navigation methods

  /**
   * Navigate to the sessions home page
   */
  public navigateToHome() {
    this.router?.go(`${this.basePath}`);
  }

  /**
   * Navigate to a specific session
   */
  public navigateToSession(sessionId: string, options: {
    messageIndex?: number;
    branchId?: string;
    action?: string;
    replace?: boolean;
  } = {}) {
    let path = `${this.basePath}/session/${sessionId}`;

    if (options.messageIndex !== undefined) {
      path += `/message/${options.messageIndex}`;
    } else if (options.branchId) {
      path += `/branch/${options.branchId}`;
    } else if (options.action) {
      path += `/${options.action}`;
    }

    if (options.replace) {
      window.history.replaceState({}, '', path);
      this.handleRoute(this.parsePathParams(path));
    } else {
      this.router?.go(path);
    }
  }

  /**
   * Navigate to a specific message in a session
   */
  public navigateToMessage(sessionId: string, messageIndex: number, replace = false) {
    this.navigateToSession(sessionId, { messageIndex, replace });
  }

  /**
   * Navigate to a specific branch
   */
  public navigateToBranch(sessionId: string, branchId: string, replace = false) {
    this.navigateToSession(sessionId, { branchId, replace });
  }

  /**
   * Navigate to a session action
   */
  public navigateToAction(sessionId: string, action: string, replace = false) {
    this.navigateToSession(sessionId, { action, replace });
  }

  /**
   * Go back in browser history
   */
  public goBack() {
    window.history.back();
  }

  /**
   * Go forward in browser history
   */
  public goForward() {
    window.history.forward();
  }

  /**
   * Go to home page
   */
  public goHome() {
    this.navigateToHome();
  }

  /**
   * Get current route parameters
   */
  public getCurrentParams(): RouteParams {
    return { ...this.currentParams };
  }

  /**
   * Get current URL
   */
  public getCurrentUrl(): string {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  /**
   * Build URL for session
   */
  public buildSessionUrl(sessionId: string, options: {
    messageIndex?: number;
    branchId?: string;
    action?: string;
  } = {}): string {
    let path = `${this.basePath}/session/${sessionId}`;

    if (options.messageIndex !== undefined) {
      path += `/message/${options.messageIndex}`;
    } else if (options.branchId) {
      path += `/branch/${options.branchId}`;
    } else if (options.action) {
      path += `/${options.action}`;
    }

    return path;
  }

  /**
   * Parse URL parameters from path
   */
  private parsePathParams(path: string): RouteParams {
    const params: RouteParams = {};
    
    // Simple regex parsing for our routes
    const sessionMatch = path.match(/\/session\/([^\/]+)/);
    if (sessionMatch) {
      params.sessionId = sessionMatch[1];
    }

    const messageMatch = path.match(/\/message\/(\d+)/);
    if (messageMatch) {
      params.messageIndex = messageMatch[1];
    }

    const branchMatch = path.match(/\/branch\/([^\/]+)/);
    if (branchMatch) {
      params.branchId = branchMatch[1];
    }

    const actionMatch = path.match(/\/([^\/]+)$/);
    if (actionMatch && !messageMatch && !branchMatch) {
      const action = actionMatch[1];
      const validActions = ['edit', 'export', 'share', 'delete', 'archive', 'branch', 'compare'];
      if (validActions.includes(action)) {
        params.action = action;
      }
    }

    return params;
  }

  /**
   * Capitalize action name for display
   */
  private capitalizeAction(action: string): string {
    return action.charAt(0).toUpperCase() + action.slice(1);
  }

  /**
   * Handle browser back/forward navigation
   */
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('popstate', this.handlePopState);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('popstate', this.handlePopState);
    this.cleanupRouter();
  }

  private handlePopState = () => {
    // Re-parse current URL and update state
    const params = this.parsePathParams(window.location.pathname);
    this.handleRoute(params);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'session-router': SessionRouter;
  }
}