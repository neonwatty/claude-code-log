// @ts-nocheck
/**
 * Working demo for session list components
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme';
import './SessionListWorking';

@customElement('session-list-working-demo')
export class SessionListWorkingDemo extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: var(--space-md);
        min-height: 100vh;
        background: var(--color-background-secondary);
      }

      .demo-container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .demo-header {
        text-align: center;
        margin-bottom: var(--space-xl);
      }

      .demo-title {
        font-size: var(--font-size-xxl);
        margin-bottom: var(--space-sm);
        color: var(--color-text-primary);
      }

      .demo-description {
        color: var(--color-text-secondary);
        font-size: var(--font-size-lg);
      }

      .demo-actions {
        display: flex;
        gap: var(--space-sm);
        margin-bottom: var(--space-lg);
        justify-content: center;
        flex-wrap: wrap;
      }

      .demo-button {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: none;
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--border-radius);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: all var(--transition-fast);
      }

      .demo-button:hover {
        background: var(--color-primary-hover);
        transform: translateY(-1px);
      }

      .demo-button.secondary {
        background: var(--color-secondary);
      }

      .demo-button.secondary:hover {
        background: var(--color-secondary-hover);
      }

      .selected-session {
        margin-top: var(--space-lg);
        padding: var(--space-md);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
      }

      .selected-session h3 {
        margin-top: 0;
        color: var(--color-primary);
      }

      .session-details {
        font-family: var(--font-family-mono);
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        white-space: pre-wrap;
      }
    `,
  ];

  sessions = [];
  selectedSession = null;

  connectedCallback() {
    super.connectedCallback();
    this.generateMockSessions();
  }

  render() {
    return html`
      <div class="demo-container">
        <header class="demo-header">
          <h1 class="demo-title">Session List Component Demo (Working)</h1>
          <p class="demo-description">
            This demo shows the working session list with TypeScript compatibility fixes
          </p>
        </header>

        <div class="demo-actions">
          <button class="demo-button" @click=${this.generateMockSessions}>
            🔄 Generate New Sessions
          </button>
          <button class="demo-button secondary" @click=${this.addRandomSession}>
            ➕ Add Random Session  
          </button>
          <button class="demo-button secondary" @click=${this.clearSessions}>
            🗑️ Clear All
          </button>
        </div>

        <session-list-working
          .sessions=${this.sessions}
          .selectedSessionId=${this.selectedSession?.sessionId}
          title="Claude Code Sessions (Working Version)"
          @session-selected=${this.handleSessionSelected}
        ></session-list-working>

        ${this.selectedSession ? this.renderSelectedSession() : ''}
      </div>
    `;
  }

  private renderSelectedSession() {
    return html`
      <div class="selected-session">
        <h3>Selected Session</h3>
        <div class="session-details">${JSON.stringify(this.selectedSession, null, 2)}</div>
      </div>
    `;
  }

  private generateMockSessions() {
    const projectPaths = [
      '/Users/dev/my-app',
      '/Users/dev/project-alpha', 
      '/Users/dev/web-dashboard',
      '/Users/dev/api-service',
      '/Users/dev/mobile-app',
    ];

    const taskTypes = [
      'Bug fix',
      'Feature development',
      'Code review', 
      'Refactoring',
      'Testing',
      'Documentation',
    ];

    this.sessions = Array.from({ length: 15 }, (_, i) => {
      const startTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const messageCount = Math.floor(Math.random() * 50) + 5;
      const userMessages = Math.floor(messageCount * 0.4);
      const assistantMessages = messageCount - userMessages;
      const isActive = Math.random() < 0.1;

      return {
        sessionId: `session-${Date.now()}-${i}`,
        title: `${taskTypes[Math.floor(Math.random() * taskTypes.length)]} #${i + 1}`,
        cwd: projectPaths[Math.floor(Math.random() * projectPaths.length)],
        startTime,
        messageCount,
        userMessageCount: userMessages,
        assistantMessageCount: assistantMessages,
        isActive,
        summary: 'Working on session list components with TypeScript compatibility fixes.',
        tokenUsage: {
          inputTokens: Math.floor(Math.random() * 10000) + 1000,
          outputTokens: Math.floor(Math.random() * 8000) + 500,
          totalTokens: 0,
        },
      };
    }).map(session => {
      if (session.tokenUsage) {
        session.tokenUsage.totalTokens = session.tokenUsage.inputTokens + session.tokenUsage.outputTokens;
      }
      return session;
    });

    this.requestUpdate();
  }

  private addRandomSession() {
    const newSession = {
      sessionId: `session-${Date.now()}`,
      title: `New Session ${this.sessions.length + 1}`,
      cwd: '/Users/dev/new-project',
      startTime: new Date(),
      messageCount: Math.floor(Math.random() * 20) + 5,
      userMessageCount: Math.floor(Math.random() * 10) + 2,
      assistantMessageCount: Math.floor(Math.random() * 10) + 3,
      isActive: true,
      summary: 'Newly created session for testing purposes.',
    };

    this.sessions = [newSession, ...this.sessions];
    this.requestUpdate();
  }

  private clearSessions() {
    this.sessions = [];
    this.selectedSession = null;
    this.requestUpdate();
  }

  private handleSessionSelected(event) {
    this.selectedSession = event.detail.session;
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-list-working-demo': SessionListWorkingDemo;
  }
}