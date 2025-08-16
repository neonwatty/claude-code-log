import { html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { BaseComponent } from './components/base/base-component.js';
import { User, LogEntry } from '@shared/types';

export class AppMain extends BaseComponent {
  @property({ type: Array })
  users: User[] = [];

  @property({ type: Array })
  logs: LogEntry[] = [];

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
      <h1 class="main-header">Claude Code Log</h1>
      
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
        </div>
      </div>

      ${this.isLoading ? html`
        <div class="card loading">
          <p>Loading application...</p>
        </div>
      ` : ''}

      <div class="welcome-text">
        Welcome to Claude Code Log - Session visualization and analysis
      </div>
    `;
  }

  override connectedCallback() {
    super.connectedCallback();
    
    // Demo data loading simulation
    this.loadDemoData();
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