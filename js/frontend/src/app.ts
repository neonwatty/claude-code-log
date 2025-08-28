import { html, css } from "lit";
import { property, state } from "lit/decorators.js";
import { BaseComponent } from "./components/base/base-component.js";
import { User, LogEntry } from "@shared/types";

// Import connection management components
import "./components/connection-status/connection-status.js";
import "./components/connection-indicator/connection-indicator.js";
import "./components/statistics-dashboard/statistics-dashboard.js";
import "./components/session-card/session-card.js";
import "./components/toast-notifications/toast-notifications.js";
import "./components/session-list/session-list.js";
import "./components/session-detail/session-detail.js";
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
  private sessions: any[] = [];

  @state()
  private selectedSessionId: string | null = null;

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
  private toastNotifications: Element | null = null; // Will be set after first render

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        padding: var(--spacing-md);
        background: var(--color-background);
        min-height: 100vh;
        max-width: 1200px;
        margin: 0 auto;
      }

      .main-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-xl);
        padding: var(--spacing-xl) var(--spacing-lg);
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        box-shadow: var(--shadow-neumorphic);
        border: 1px solid var(--color-border-light);
        position: relative;
        overflow: hidden;
      }

      .main-header::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
        opacity: 0.8;
      }

      .app-title {
        font-size: 2.2em;
        font-weight: var(--font-weight-bold);
        color: var(--color-text-header);
        margin: 0;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        letter-spacing: -0.02em;
      }

      .title-section {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }

      .app-subtitle {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        font-weight: var(--font-weight-normal);
        margin: 0;
        font-family: var(--font-family-sans);
      }

      .header-controls {
        display: flex;
        gap: var(--spacing-md);
        align-items: center;
      }


      /* Main content sections */
      .main-content {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xl);
      }

      .section-divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--color-border-light), transparent);
        margin: var(--spacing-lg) 0;
        opacity: 0.5;
      }

      /* Loading and state styles */
      .card.loading {
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-xl);
        text-align: center;
        box-shadow: var(--shadow-neumorphic);
        border: 1px solid var(--color-border-light);
        position: relative;
        overflow: hidden;
      }

      .card.loading::before {
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

      .card.loading p {
        margin: 0;
        color: var(--color-text-muted);
        font-weight: var(--font-weight-medium);
        font-size: var(--font-size-lg);
        position: relative;
        z-index: 1;
      }

      /* Empty state styling */
      .empty-state {
        text-align: center;
        padding: var(--spacing-xxl);
        color: var(--color-text-muted);
        font-style: italic;
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        border: 2px dashed var(--color-border-medium);
      }

      .empty-state-icon {
        font-size: 3em;
        margin-bottom: var(--spacing-md);
        opacity: 0.5;
      }

      .action-button {
        padding: var(--spacing-sm) var(--spacing-md);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        transition: all var(--transition-fast);
        min-height: 40px;
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .action-button:hover {
        background: var(--color-surface-hover);
        transform: var(--transform-hover);
        box-shadow: var(--shadow-md);
      }

      .action-button:disabled {
        opacity: var(--opacity-disabled);
        cursor: not-allowed;
        transform: none;
      }

      .action-button.primary {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .action-button.primary:hover:not(:disabled) {
        background: var(--color-primary-hover);
        border-color: var(--color-primary-hover);
      }

      /* Responsive design */
      @media (max-width: 768px) {
        :host {
          padding: var(--spacing-sm);
        }

        .main-header {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-md);
          padding: var(--spacing-lg);
        }

        .app-title {
          font-size: 1.8em;
        }

        .header-controls {
          width: 100%;
          justify-content: flex-end;
        }
      }

      @media (max-width: 480px) {
        .main-header {
          padding: var(--spacing-md);
        }

        .app-title {
          font-size: 1.6em;
        }

        .title-section {
          width: 100%;
        }

        .header-controls {
          justify-content: center;
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
      <!-- Enhanced app header with integrated connection status -->
      <header class="main-header">
        <div class="title-section">
          <h1 class="app-title">Claude Code Log</h1>
          <p class="app-subtitle">Real-time session visualization and analysis</p>
        </div>
        <div class="header-controls">
          <connection-indicator
            .connectionState=${this.connectionState}
            .statistics=${this.connectionStatistics}
            @connection-action=${this.handleConnectionAction}
          ></connection-indicator>
        </div>
      </header>

      <main class="main-content">
        <!-- Enhanced statistics dashboard -->
        <statistics-dashboard
          .userCount=${this.users.length}
          .logEntryCount=${this.logs.length}
          .isDarkMode=${this.darkMode}
          .connectionStats=${this.connectionStatistics}
        ></statistics-dashboard>

        ${this.isLoading
          ? html`
              <div class="card loading">
                <p>Loading application...</p>
              </div>
            `
          : ""}

        <!-- Session List -->
        ${this.sessions.length > 0
          ? html`
              <div class="section-divider"></div>
              <session-list 
                .sessions=${this.sessions}
                @session-selected=${this.handleSessionSelected}
              ></session-list>
            `
          : !this.isLoading ? html`
              <div class="section-divider"></div>
              <div class="empty-state">
                <div class="empty-state-icon">📂</div>
                <h3>No Sessions Found</h3>
                <p>No Claude Code sessions have been loaded yet. Sessions will appear here when available.</p>
              </div>
            ` : ""}

        <!-- Session Detail -->
        ${this.selectedSessionId
          ? html`
              <div class="section-divider"></div>
              <session-detail 
                .sessionId=${this.selectedSessionId}
                .session=${this.sessions.find(s => s.id === this.selectedSessionId)}
              ></session-detail>
            `
          : ""}
      </main>


      <!-- Toast notifications container -->
      <toast-notifications
        @connection-retry-requested=${this.handleRetryFromToast}
      ></toast-notifications>
    `;
  }

  override connectedCallback() {
    super.connectedCallback();

    // Register service worker for offline support
    this.registerServiceWorker();

    // Initialize connection management
    this.initializeConnectionManagement();

    // Load real session data from API
    this.loadSessionData();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();

    // Clean up connection management
    if (this.connectionManager) {
      this.connectionManager.destroy();
    }
  }

  private async initializeConnectionManagement() {
    try {
      this.connectionManager = getConnectionManager();

      // Initialize with demo WebSocket config (would normally come from environment)
      await this.connectionManager.initialize({
        url: "ws://localhost:3002/ws", // Backend WebSocket server
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
    this.selectedSessionId = event.detail.sessionId;
    console.log('Selected session:', event.detail.sessionId);
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
    await this.handleAsyncOperation(async () => {
      try {
        // Load real session data from backend API
        const response = await fetch('http://localhost:3002/api/sessions');
        if (!response.ok) {
          throw new Error(`Failed to fetch sessions: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success && result.data?.sessions) {
          // Store sessions for session list component
          this.sessions = result.data.sessions;
          
          // Convert session data to display format
          const sessions = result.data.sessions;
          
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
          this.logs = sessions.flatMap((session: any) => 
            session.entries?.map((entry: any, index: number) => ({
              id: `${session.id}_${index}`,
              userId: "real_user",
              message: entry.type === 'user' ? entry.message?.content?.[0]?.text || 'User message' 
                      : entry.message?.content?.[0]?.text || 'Assistant message',
              timestamp: entry.timestamp,
              level: entry.type === 'user' ? 'info' : 'response',
              sessionId: session.id,
              cwd: session.cwd
            })) || []
          );

          console.log(`✅ Loaded ${sessions.length} sessions with ${this.logs.length} total entries`);
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
