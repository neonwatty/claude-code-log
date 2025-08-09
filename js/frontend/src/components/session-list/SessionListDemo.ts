import { html, css, CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { SessionSummary, SessionFilter, SessionSort, PaginationOptions } from '../types/session-types';
import './SessionList';

/**
 * Demo component to test SessionList functionality
 */
@customElement('session-list-demo')
export class SessionListDemo extends BaseComponent {
  static styles: CSSResultGroup = [
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

  @state()
  private sessions: SessionSummary[] = [];

  @state()
  private selectedSession: SessionSummary | null = null;

  @state()
  private currentFilter: SessionFilter = {};

  @state()
  private currentSort: SessionSort = { field: 'startTime', direction: 'desc' };

  @state()
  private currentPagination: PaginationOptions = {
    page: 0,
    pageSize: 10,
    totalItems: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  connectedCallback() {
    super.connectedCallback();
    this.generateMockSessions();
  }

  render() {
    return html`
      <div class="demo-container">
        <header class="demo-header">
          <h1 class="demo-title">Session List Component Demo</h1>
          <p class="demo-description">
            Interactive demo showcasing session list functionality with filtering, sorting, and pagination
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

        <session-list
          .sessions=${this.sessions}
          .filter=${this.currentFilter}
          .sort=${this.currentSort}
          .pagination=${this.currentPagination}
          .selectedSessionId=${this.selectedSession?.sessionId}
          title="Claude Code Sessions"
          searchable
          filterable
          paginated
          @session-selected=${this.handleSessionSelected}
          @filter-changed=${this.handleFilterChanged}
          @sort-changed=${this.handleSortChanged}
          @page-changed=${this.handlePageChanged}
        ></session-list>

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
      '/Users/dev/data-processor',
      '/Users/dev/ml-pipeline',
      '/Users/dev/docs-site',
    ];

    const taskTypes = [
      'Bug fix',
      'Feature development',
      'Code review',
      'Refactoring',
      'Testing',
      'Documentation',
      'Debugging',
      'Performance optimization',
    ];

    const tags = [
      'react', 'typescript', 'node.js', 'python', 'testing', 
      'bug-fix', 'feature', 'refactor', 'documentation', 'review'
    ];

    this.sessions = Array.from({ length: 25 }, (_, i) => {
      const startTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const duration = Math.random() * 3600000; // 0-1 hour
      const endTime = new Date(startTime.getTime() + duration);
      const messageCount = Math.floor(Math.random() * 50) + 5;
      const userMessages = Math.floor(messageCount * 0.4);
      const assistantMessages = messageCount - userMessages;
      const isActive = Math.random() < 0.1; // 10% chance

      return {
        sessionId: `session-${Date.now()}-${i}`,
        title: `${taskTypes[Math.floor(Math.random() * taskTypes.length)]} #${i + 1}`,
        cwd: projectPaths[Math.floor(Math.random() * projectPaths.length)],
        startTime,
        endTime: isActive ? undefined : endTime,
        messageCount,
        userMessageCount: userMessages,
        assistantMessageCount: assistantMessages,
        duration: isActive ? undefined : duration,
        isActive,
        tags: this.getRandomTags(tags),
        summary: this.generateRandomSummary(),
        tokenUsage: {
          inputTokens: Math.floor(Math.random() * 10000) + 1000,
          outputTokens: Math.floor(Math.random() * 8000) + 500,
          totalTokens: 0, // Will be calculated
        },
      };
    }).map(session => {
      if (session.tokenUsage) {
        session.tokenUsage.totalTokens = session.tokenUsage.inputTokens + session.tokenUsage.outputTokens;
      }
      return session;
    });

    this.updatePagination();
  }

  private getRandomTags(availableTags: string[]): string[] {
    const numTags = Math.floor(Math.random() * 4) + 1;
    const shuffled = [...availableTags].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numTags);
  }

  private generateRandomSummary(): string {
    const summaries = [
      'Working on user authentication system with JWT tokens and role-based access control.',
      'Implementing responsive design for the dashboard with CSS Grid and Flexbox layouts.',
      'Debugging memory leaks in React components and optimizing render performance.',
      'Setting up CI/CD pipeline with GitHub Actions and automated testing workflows.',
      'Refactoring legacy code to TypeScript with proper type definitions and error handling.',
      'Creating API documentation with OpenAPI specs and interactive examples.',
      'Optimizing database queries and implementing caching strategies for better performance.',
      'Building custom React hooks for state management and API data fetching.',
    ];
    
    return summaries[Math.floor(Math.random() * summaries.length)];
  }

  private addRandomSession() {
    const newSession: SessionSummary = {
      sessionId: `session-${Date.now()}`,
      title: `New Session ${this.sessions.length + 1}`,
      cwd: '/Users/dev/new-project',
      startTime: new Date(),
      messageCount: Math.floor(Math.random() * 20) + 5,
      userMessageCount: Math.floor(Math.random() * 10) + 2,
      assistantMessageCount: Math.floor(Math.random() * 10) + 3,
      isActive: true,
      tags: ['new', 'development'],
      summary: 'Newly created session for testing purposes.',
    };

    this.sessions = [newSession, ...this.sessions];
    this.updatePagination();
  }

  private clearSessions() {
    this.sessions = [];
    this.selectedSession = null;
    this.updatePagination();
  }

  private handleSessionSelected(event: CustomEvent) {
    this.selectedSession = event.detail.session;
  }

  private handleFilterChanged(event: CustomEvent) {
    this.currentFilter = event.detail.filter;
  }

  private handleSortChanged(event: CustomEvent) {
    this.currentSort = event.detail.sort;
  }

  private handlePageChanged(event: CustomEvent) {
    this.currentPagination = {
      ...this.currentPagination,
      page: event.detail.page,
      pageSize: event.detail.pageSize,
    };
    this.updatePagination();
  }

  private updatePagination() {
    const totalItems = this.sessions.length;
    const totalPages = Math.ceil(totalItems / this.currentPagination.pageSize);
    
    this.currentPagination = {
      ...this.currentPagination,
      totalItems,
      hasNextPage: this.currentPagination.page < totalPages - 1,
      hasPrevPage: this.currentPagination.page > 0,
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-list-demo': SessionListDemo;
  }
}