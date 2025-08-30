import { html, css } from "lit";
import { property, state } from "lit/decorators.js";
import { BaseComponent } from "./components/base/base-component.js";
import { User, LogEntry } from "@shared";
import type { ZodSession } from "../../shared/src/schemas/index.js";

// Import routing and navigation
import { Router, getRouter } from "./utils/router.js";
import type { NavigationSection } from "./components/navigation/app-navigation.js";
import "./components/navigation/app-navigation.js";

// Import views
import "./components/views/dashboard-view.js";
import "./components/views/sessions-view.js";
import "./components/views/analytics-view.js";

// Import connection management components
import "./components/connection-status/connection-status.js";
import "./components/connection-indicator/connection-indicator.js";
import "./components/toast-notifications/toast-notifications.js";
import "./components/toast-notifications/mobile-toast.js";
import "./components/error-boundary/error-boundary.js";
import {
  ConnectionManager,
  getConnectionManager,
} from "./services/connection-manager.js";
import { getAccessibilityService } from "./services/accessibility-service.js";
import type {
  ConnectionStatistics,
  ConnectionDebugInfo,
} from "./utils/websocket/connection-state.js";
import { ConnectionState } from "./utils/websocket/connection-state.js";

export class AppMain extends BaseComponent {
  @property({ type: Array })
  users: User[] = [];

  @property({ type: Array })
  logs: LogEntry[] = [];

  @state()
  private sessions: ZodSession[] = [];

  @state()
  private currentSection: NavigationSection = 'dashboard';

  @state()
  private selectedSessionId: string | null = null;

  @state()
  private isMobileView = false;

  // Connection state management
  @state()
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  @state()
  private connectionStatistics: ConnectionStatistics = {
    uptime: 0,
    reconnectionCount: 0,
    lastConnectTime: null,
    lastDisconnectTime: null,
    averageLatency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    totalDataSent: 0,
    totalDataReceived: 0,
    connectionQuality: "unknown",
  };

  @state()
  private connectionDebugInfo: ConnectionDebugInfo | null = null;

  private connectionManager: ConnectionManager | null = null;
  private toastNotifications: Element | null = null;
  private router: Router | null = null;

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        background: var(--color-background);
        min-height: 100vh;
        font-family: var(--font-family-sans);
      }

      .app-container {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      .app-header {
        position: sticky;
        top: 0;
        z-index: 100;
        background: var(--color-background);
        border-bottom: 1px solid var(--color-border-light);
        padding: var(--spacing-sm) var(--spacing-md);
      }

      .header-controls {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-sm);
      }

      .app-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .view-container {
        flex: 1;
        overflow: auto;
      }

      /* Loading state */
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(var(--color-background-rgb), 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .loading-card {
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-xl);
        text-align: center;
        box-shadow: var(--shadow-neumorphic);
        border: 1px solid var(--color-border-light);
        position: relative;
        overflow: hidden;
        min-width: 300px;
      }

      .loading-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
        animation: loading-shimmer 1.5s infinite;
      }

      @keyframes loading-shimmer {
        0% { left: -100%; }
        100% { left: 100%; }
      }

      .loading-text {
        margin: 0;
        color: var(--color-text-muted);
        font-weight: var(--font-weight-medium);
        font-size: var(--font-size-lg);
        position: relative;
        z-index: 1;
      }

      /* Mobile adjustments */
      @media (max-width: 768px) {
        .app-header {
          padding: var(--spacing-xs) var(--spacing-sm);
        }
        
        .header-controls {
          margin-bottom: var(--spacing-xs);
        }

        /* Add padding for mobile navigation */
        :host([mobile-view]) .app-content {
          padding-bottom: 80px;
        }
      }
    `,
  ];

  override render() {
    if (this.error) {
      return html`
        <div class="error">
          <h2>Error</h2>
          <p>${this.error}</p>
        </div>
      `;
    }

    return html`
      <div class="app-container">
        <header class="app-header">
          <div class="header-controls">
            <connection-indicator
              .connectionState=${this.connectionState}
              .statistics=${this.connectionStatistics}
              @connection-action=${this.handleConnectionAction}
            ></connection-indicator>
          </div>
          
          <app-navigation
            .activeSection=${this.currentSection}
            .mobileView=${this.isMobileView}
            @navigation-change=${this.handleNavigationChange}
          ></app-navigation>
        </header>

        <main class="app-content">
          <!-- Debug Panel -->
          <div style="background: #f0f0f0; padding: 10px; margin: 10px; border-radius: 5px; font-family: monospace; font-size: 12px;">
            <strong>🔍 Debug Info:</strong><br>
            Sessions: ${this.sessions.length} | Logs: ${this.logs.length} | Current Section: ${this.currentSection}<br>
            <button @click=${this.handleDebugLoadData} style="margin: 5px; padding: 5px 10px; cursor: pointer;">
              🔄 Manual Load Data
            </button>
            <button @click=${this.handleDebugShowData} style="margin: 5px; padding: 5px 10px; cursor: pointer;">
              📊 Show Data
            </button>
          </div>
          
          <div class="view-container">
            ${this.renderCurrentView()}
          </div>
        </main>

        <!-- Toast notifications container -->
        <toast-notifications
          @connection-retry-requested=${this.handleRetryFromToast}
        ></toast-notifications>

        ${this.isLoading ? html`
          <div class="loading-overlay">
            <div class="loading-card">
              <p class="loading-text">Loading application...</p>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderCurrentView() {
    switch (this.currentSection) {
      case 'dashboard':
        return html`
          <error-boundary 
            fallback-message="Dashboard temporarily unavailable"
            @error-retry=${this.handleErrorRetry}
          >
            <dashboard-view
              .users=${this.users}
              .logs=${this.logs}
              .connectionStats=${this.connectionStatistics}
              .isDarkMode=${this.darkMode}
              @navigate-requested=${this.handleViewNavigation}
            ></dashboard-view>
          </error-boundary>
        `;
      
      case 'sessions':
        return html`
          <error-boundary 
            fallback-message="Sessions view temporarily unavailable"
            @error-retry=${this.handleErrorRetry}
          >
            <sessions-view
              .sessions=${this.sessions}
              @session-selected=${this.handleSessionSelected}
              @session-detail-requested=${this.handleSessionDetailRequested}
              @session-list-requested=${this.handleSessionListRequested}
              @sessions-export-requested=${this.handleSessionsExport}
              @sessions-refresh-requested=${this.handleSessionsRefresh}
            ></sessions-view>
          </error-boundary>
        `;
      
      case 'analytics':
        return html`
          <error-boundary 
            fallback-message="Analytics view temporarily unavailable"
            @error-retry=${this.handleErrorRetry}
          >
            <analytics-view
              .sessions=${this.sessions}
              .users=${this.users}
              .logs=${this.logs}
              @analytics-export-requested=${this.handleAnalyticsExport}
            ></analytics-view>
          </error-boundary>
        `;
      
      default:
        return this.renderCurrentView();
    }
  }

  override connectedCallback() {
    super.connectedCallback();
    console.log('🎆 AppMain component connected!');
    console.log('🔍 Current sessions count:', this.sessions.length);
    console.log('🔍 Current logs count:', this.logs.length);

    // Initialize router
    this.initializeRouter();

    // Check mobile view
    this.checkMobileView();
    window.addEventListener('resize', () => this.checkMobileView());

    // Register service worker for offline support
    this.registerServiceWorker();

    // Initialize connection management
    this.initializeConnectionManagement();

    // Load real session data from API
    console.log('🚀 About to call loadSessionData...');
    this.loadSessionData().then(() => {
      console.log('💯 LoadSessionData completed');
    }).catch(error => {
      console.error('😨 LoadSessionData failed:', error);
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();

    // Clean up connection management
    if (this.connectionManager) {
      this.connectionManager.destroy();
    }

    // Clean up event listeners
    window.removeEventListener('resize', () => this.checkMobileView());
  }

  private initializeRouter(): void {
    this.router = getRouter();
    
    // Register routes
    this.router.addRoute('/', () => this.navigateToSection('dashboard'));
    this.router.addRoute('/dashboard', () => this.navigateToSection('dashboard'));
    this.router.addRoute('/sessions', () => this.navigateToSection('sessions'));
    this.router.addRoute('/sessions/:id', (params) => {
      this.navigateToSection('sessions');
      this.selectedSessionId = params.id || null;
    });
    this.router.addRoute('/analytics', () => this.navigateToSection('analytics'));
  }

  private checkMobileView(): void {
    this.isMobileView = window.innerWidth <= 768;
    // Update mobile-view attribute for CSS
    if (this.isMobileView) {
      this.setAttribute('mobile-view', '');
    } else {
      this.removeAttribute('mobile-view');
    }
  }

  private navigateToSection(section: NavigationSection): void {
    if (this.currentSection !== section) {
      this.currentSection = section;
      // Clear selected session when navigating away from sessions
      if (section !== 'sessions') {
        this.selectedSessionId = null;
      }
    }
  }

  private handleNavigationChange(event: CustomEvent): void {
    const { section } = event.detail;
    
    // Navigate to the appropriate route
    switch (section) {
      case 'dashboard':
        this.router?.navigate('/');
        break;
      case 'sessions':
        this.router?.navigate('/sessions');
        break;
      case 'analytics':
        this.router?.navigate('/analytics');
        break;
    }
  }

  private handleViewNavigation(event: CustomEvent): void {
    const { section } = event.detail;
    this.handleNavigationChange(new CustomEvent('navigation-change', { detail: { section } }));
  }

  private handleSessionDetailRequested(event: CustomEvent): void {
    const { sessionId } = event.detail;
    this.router?.navigate(`/sessions/${sessionId}`);
  }

  private handleSessionListRequested(): void {
    this.router?.navigate('/sessions');
    this.selectedSessionId = null;
  }

  private handleSessionsExport(event: CustomEvent): void {
    const { sessions } = event.detail;
    console.log('Exporting sessions:', sessions.length);
    // TODO: Implement actual export functionality
  }

  private handleSessionsRefresh(): void {
    console.log('Refreshing sessions...');
    this.loadSessionData();
  }

  private handleAnalyticsExport(event: CustomEvent): void {
    const { timeRange, data } = event.detail;
    console.log('Exporting analytics report:', timeRange, data);
    // TODO: Implement actual analytics export
  }

  private handleErrorRetry(event: CustomEvent): void {
    const { retryCount } = event.detail;
    console.log(`Error retry attempt ${retryCount}`);
    
    // Refresh data on retry
    this.loadSessionData();
  }

  private async handleDebugLoadData(): Promise<void> {
    console.log('🔧 Manual debug load triggered!');
    await this.loadSessionData();
  }

  private handleDebugShowData(): void {
    console.log('📊 Debug Data:');
    console.log('Sessions:', this.sessions);
    console.log('Logs:', this.logs);
    console.log('Users:', this.users);
    alert(`Sessions: ${this.sessions.length}, Logs: ${this.logs.length}, Users: ${this.users.length}`);
  }

  private async initializeConnectionManagement() {
    try {
      this.connectionManager = getConnectionManager();

      // Initialize with demo WebSocket config (would normally come from environment)
      await this.connectionManager.initialize({
        url: "ws://localhost:3001/ws", // Backend WebSocket server
        reconnectInterval: 1000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000,
        debug: true,
      });

      // Set up event listeners
      this.setupConnectionEventHandlers();

      // Get initial state
      this.updateConnectionState();

      // Auto-connect for demo purposes (in real app, user would initiate)
      setTimeout(() => {
        this.connectionManager?.connect();
      }, 1000);
    } catch (error) {
      console.error("Failed to initialize connection management:", error);
      this.setError("Failed to initialize connection management");
    }
  }

  private setupConnectionEventHandlers() {
    if (!this.connectionManager) return;

    // Listen for connection state changes
    this.connectionManager.on("state-changed", (event) => {
      this.handleConnectionStateChange(event);
    });

    // Listen for statistics updates
    this.connectionManager.on("statistics-updated", (statistics) => {
      this.connectionStatistics = statistics;
    });

    // Listen for debug info updates
    this.connectionManager.on("debug-info-updated", (debugInfo) => {
      this.connectionDebugInfo = debugInfo;
    });
  }

  private handleConnectionStateChange(event: { currentState: ConnectionState; reason?: string }) {
    this.connectionState = event.currentState;

    // Update accessibility announcements
    const a11yService = getAccessibilityService();
    a11yService.announceConnectionState(event.currentState, event.reason);

    // Show toast notification
    this.showConnectionToast(event);
  }

  private showConnectionToast(event: { currentState: ConnectionState; reason?: string }) {
    // Get toast notifications component
    if (!this.toastNotifications) {
      this.toastNotifications = this.shadowRoot?.querySelector(
        "toast-notifications",
      );
    }

    if (this.toastNotifications) {
      this.toastNotifications.showConnectionStateToast(event);
    }
  }

  private updateConnectionState() {
    if (this.connectionManager) {
      this.connectionState = this.connectionManager.getConnectionState();
      this.connectionStatistics = this.connectionManager.getStatistics();
      this.connectionDebugInfo = this.connectionManager.getDebugInfo();
    }
  }

  private handleConnectClick() {
    if (!this.connectionManager) return;

    if (this.connectionState === ConnectionState.CONNECTED) {
      this.connectionManager.disconnect();
    } else {
      this.connectionManager.connect();
    }
  }

  private handleReconnectClick() {
    if (this.connectionManager) {
      this.connectionManager.forceReconnect();
    }
  }

  private handleConnectionAction(event: CustomEvent) {
    const { action } = event.detail;
    
    switch (action) {
      case 'connect':
        this.handleConnectClick();
        break;
      case 'disconnect':
        this.handleConnectClick(); // This toggles between connect/disconnect
        break;
      case 'reconnect':
        this.handleReconnectClick();
        break;
      default:
        console.warn('Unknown connection action:', action);
    }
  }

  private handleRetryFromToast() {
    this.handleReconnectClick();
  }

  private handleSessionSelected(event: CustomEvent) {
    const { sessionId } = event.detail;
    this.selectedSessionId = sessionId;
    console.log('Selected session:', sessionId);
    
    // Update URL to reflect selection
    if (this.router && sessionId) {
      this.router.navigate(`/sessions/${sessionId}`);
    }
  }

  private handleDebugPanelToggled(event: CustomEvent) {
    console.log("Debug panel toggled:", event.detail.visible);
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/src/sw.js', {
          scope: '/src/'
        });

        console.log('Service Worker registered:', registration.scope);

        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Show update notification
                this.showServiceWorkerUpdateToast();
              }
            });
          }
        });

        // Listen for service worker messages
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event);
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    } else {
      console.log('Service Workers are not supported in this browser');
    }
  }

  private showServiceWorkerUpdateToast() {
    if (this.toastNotifications) {
      this.toastNotifications.showToast({
        type: 'info',
        message: 'A new version of the app is available.',
        action: {
          label: 'Refresh',
          callback: () => window.location.reload()
        },
        persistent: true
      });
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent) {
    const { type, payload } = event.data;
    
    switch (type) {
      case 'OFFLINE_STATUS':
        console.log('Offline status updated:', payload);
        break;
      case 'CACHE_UPDATED':
        console.log('Cache updated:', payload);
        break;
      default:
        console.log('Unknown service worker message:', type, payload);
    }
  }

  private async loadSessionData() {
    console.log('🔍 Starting to load session data...');
    await this.handleAsyncOperation(async () => {
      try {
        console.log('📡 Making API request to load sessions...');
        // Load real session data from backend API
        const response = await fetch('http://localhost:3001/api/sessions');
        if (!response.ok) {
          throw new Error(`Failed to fetch sessions: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success && result.data?.sessions) {
          // Store sessions as ZodSession type
          this.sessions = result.data.sessions as ZodSession[];
          
          // Update user count based on unique session entries
          this.users = [
            {
              id: "real_user",
              name: "Claude Code User",
              email: "user@claude.ai",
              createdAt: new Date().toISOString(),
            },
          ];

          // Convert session entries to log entries for display
          this.logs = this.sessions.flatMap((session: ZodSession) => 
            session.entries?.map((entry, index: number) => ({
              id: `${session.id}_${index}`,
              userId: "real_user",
              message: entry.type === 'user' 
                ? (entry.message?.content?.[0]?.type === 'text' 
                   ? entry.message.content[0].text 
                   : 'User message')
                : (entry.message?.content?.[0]?.type === 'text'
                   ? entry.message.content[0].text
                   : 'Assistant message'),
              timestamp: entry.timestamp,
              level: entry.type === 'user' ? 'info' : 'response',
              sessionId: session.id,
              cwd: session.cwd
            })) || []
          );

          console.log(`✅ Loaded ${this.sessions.length} sessions with ${this.logs.length} total entries`);
          console.log('📢 Sessions loaded successfully, triggering re-render...');
          this.requestUpdate();
        } else {
          throw new Error('Invalid API response format');
        }
      } catch (error) {
        console.error('Failed to load session data:', error);
        // Fallback to demo data on error
        this.users = [
          {
            id: "1",
            name: "Demo User (Offline)",
            email: "demo@example.com",
            createdAt: new Date().toISOString(),
          },
        ];

        this.logs = [
          {
            id: "1",
            userId: "1",
            message: "Failed to load real sessions - showing demo data",
            timestamp: new Date().toISOString(),
            level: "error",
          },
        ];
      }
    }, "Failed to load session data");
  }
}

// Simple test to verify shared types import works
const testUser: User = {
  id: "1",
  name: "Test User",
  email: "test@example.com",
  createdAt: new Date().toISOString(),
};

console.log("Test user:", testUser);

// Register the custom element
customElements.define("app-main", AppMain);
