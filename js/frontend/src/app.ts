import { html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { BaseComponent } from './components/base/base-component.js';
import { User, LogEntry } from '@shared/types';

// Import connection management components
import './components/connection-status/connection-status.js';
import './components/toast-notifications/toast-notifications.js';
import { ConnectionManager, getConnectionManager } from './services/connection-manager.js';
import { getAccessibilityService } from './services/accessibility-service.js';
import type { 
  ConnectionStatistics, 
  ConnectionDebugInfo 
} from './utils/websocket/connection-state.js';
import { ConnectionState } from './utils/websocket/connection-state.js';

export class AppMain extends BaseComponent {
  @property({ type: Array })
  users: User[] = [];

  @property({ type: Array })
  logs: LogEntry[] = [];

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
    connectionQuality: 'unknown'
  };

  @state()
  private connectionDebugInfo: ConnectionDebugInfo | null = null;

  private connectionManager: ConnectionManager | null = null;
  private toastNotifications: any = null; // Will be set after first render

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
        text-align: center;
        color: #2c3e50;
        margin-bottom: var(--spacing-lg);
        font-size: 1.8em;
      }

      .stats-card {
        margin-bottom: var(--spacing-lg);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
      }

      .stat-item {
        text-align: center;
        padding: var(--spacing-md);
      }

      .stat-value {
        font-size: 2em;
        font-weight: bold;
        color: var(--color-primary);
        margin-bottom: var(--spacing-xs);
      }

      .stat-label {
        color: var(--color-text-muted);
        font-size: 0.9em;
      }

      .welcome-text {
        text-align: center;
        color: var(--color-text-muted);
        font-style: italic;
        margin-top: var(--spacing-lg);
      }

      /* Connection status header */
      .app-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-md);
        padding: var(--spacing-sm);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius-sm);
        border: 1px solid var(--color-border);
      }

      .app-title {
        font-size: 1.2em;
        font-weight: 600;
        color: var(--color-text);
        margin: 0;
      }

      .connection-controls {
        display: flex;
        gap: var(--spacing-sm);
        align-items: center;
      }

      .connection-button {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        background: var(--color-background);
        color: var(--color-text);
        cursor: pointer;
        font-size: 0.85em;
        transition: all 0.2s ease;
      }

      .connection-button:hover {
        background: var(--color-background-hover);
      }

      .connection-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `
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
      <!-- App header with connection status -->
      <div class="app-header">
        <h1 class="app-title">Claude Code Log</h1>
        <div class="connection-controls">
          <connection-status
            .connectionState=${this.connectionState}
            .statistics=${this.connectionStatistics}
            .debugInfo=${this.connectionDebugInfo}
            @debug-panel-toggled=${this.handleDebugPanelToggled}
          ></connection-status>
          
          <button 
            class="connection-button"
            @click=${this.handleConnectClick}
            ?disabled=${this.connectionState === ConnectionState.CONNECTING}
          >
            ${this.connectionState === ConnectionState.CONNECTED ? 'Disconnect' : 'Connect'}
          </button>
          
          <button 
            class="connection-button"
            @click=${this.handleReconnectClick}
            ?disabled=${this.connectionState === ConnectionState.CONNECTING}
          >
            Reconnect
          </button>
        </div>
      </div>
      
      <div class="stats-card card">
        <div class="header">
          <span>Application Statistics</span>
          <span class="timestamp">${this.formatTimestamp(new Date())}</span>
        </div>
        
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${this.users.length}</div>
            <div class="stat-label">Users</div>
          </div>
          
          <div class="stat-item">
            <div class="stat-value">${this.logs.length}</div>
            <div class="stat-label">Log Entries</div>
          </div>
          
          <div class="stat-item">
            <div class="stat-value">${this.darkMode ? '🌙' : '☀️'}</div>
            <div class="stat-label">Theme</div>
          </div>
          
          <!-- Connection statistics -->
          <div class="stat-item">
            <div class="stat-value">${this.connectionStatistics.messagesSent}</div>
            <div class="stat-label">Messages Sent</div>
          </div>
          
          <div class="stat-item">
            <div class="stat-value">${this.connectionStatistics.messagesReceived}</div>
            <div class="stat-label">Messages Received</div>
          </div>
          
          <div class="stat-item">
            <div class="stat-value">${this.connectionStatistics.reconnectionCount}</div>
            <div class="stat-label">Reconnections</div>
          </div>
        </div>
      </div>

      ${this.isLoading ? html`
        <div class="card loading">
          <p>Loading application...</p>
        </div>
      ` : ''}

      <div class="welcome-text">
        Welcome to Claude Code Log - Real-time session visualization and analysis
        <br>
        <small>Connection Status: ${this.connectionState} | Quality: ${this.connectionStatistics.connectionQuality}</small>
      </div>

      <!-- Toast notifications container -->
      <toast-notifications @connection-retry-requested=${this.handleRetryFromToast}></toast-notifications>
    `;
  }

  override connectedCallback() {
    super.connectedCallback();
    
    // Initialize connection management
    this.initializeConnectionManagement();
    
    // Demo data loading simulation
    this.loadDemoData();
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
        url: 'ws://localhost:8080', // Demo URL - would be environment specific
        reconnectInterval: 1000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000,
        debug: true
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
      console.error('Failed to initialize connection management:', error);
      this.setError('Failed to initialize connection management');
    }
  }

  private setupConnectionEventHandlers() {
    if (!this.connectionManager) return;

    // Listen for connection state changes
    this.connectionManager.on('state-changed', (event) => {
      this.handleConnectionStateChange(event);
    });

    // Listen for statistics updates
    this.connectionManager.on('statistics-updated', (statistics) => {
      this.connectionStatistics = statistics;
    });

    // Listen for debug info updates
    this.connectionManager.on('debug-info-updated', (debugInfo) => {
      this.connectionDebugInfo = debugInfo;
    });
  }

  private handleConnectionStateChange(event: any) {
    this.connectionState = event.currentState;
    
    // Update accessibility announcements
    const a11yService = getAccessibilityService();
    a11yService.announceConnectionState(event.currentState, event.reason);

    // Show toast notification
    this.showConnectionToast(event);
  }

  private showConnectionToast(event: any) {
    // Get toast notifications component
    if (!this.toastNotifications) {
      this.toastNotifications = this.shadowRoot?.querySelector('toast-notifications');
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

  private handleRetryFromToast() {
    this.handleReconnectClick();
  }

  private handleDebugPanelToggled(event: CustomEvent) {
    console.log('Debug panel toggled:', event.detail.visible);
  }

  private async loadDemoData() {
    await this.handleAsyncOperation(async () => {
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add some demo data
      this.users = [
        {
          id: '1',
          name: 'Demo User',
          email: 'demo@example.com',
          createdAt: new Date().toISOString()
        }
      ];
      
      this.logs = [
        {
          id: '1',
          userId: '1',
          message: 'Application initialized',
          timestamp: new Date().toISOString(),
          level: 'info'
        }
      ];
    }, 'Failed to load demo data');
  }
}

// Simple test to verify shared types import works
const testUser: User = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  createdAt: new Date().toISOString()
};

console.log('Test user:', testUser);

// Register the custom element
customElements.define('app-main', AppMain);