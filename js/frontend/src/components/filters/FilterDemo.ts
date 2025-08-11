import { html, css, CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { SessionSummary } from '../types/session-types';
import '../session-list/SessionList';

/**
 * Demo component to showcase filter integration with SessionList
 */
@customElement('filter-demo')
export class FilterDemo extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: var(--space-lg);
        max-width: 1200px;
        margin: 0 auto;
      }

      .demo-header {
        margin-bottom: var(--space-lg);
        text-align: center;
      }

      .demo-title {
        font-size: var(--font-size-xxl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-sm) 0;
      }

      .demo-description {
        font-size: var(--font-size-lg);
        color: var(--color-text-secondary);
        margin: 0;
      }

      .demo-content {
        display: grid;
        gap: var(--space-lg);
      }

      .stats-panel {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--space-md);
      }

      .stat-item {
        text-align: center;
      }

      .stat-value {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-primary);
        display: block;
      }

      .stat-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin-top: var(--space-xs);
      }

      .session-list-wrapper {
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
        background: var(--color-background);
      }

      .performance-info {
        background: var(--color-background-tertiary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-sm);
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        text-align: center;
        margin-top: var(--space-md);
      }
    `,
  ];

  @state()
  private mockSessions: SessionSummary[] = [];

  @state()
  private performanceStats = {
    totalSessions: 0,
    filteredSessions: 0,
    cacheHitRate: 0,
    lastFilterTime: 0,
  };

  constructor() {
    super();
    this.generateMockSessions();
  }

  render() {
    return html`
      <div class="demo-header">
        <h1 class="demo-title">Filter System Demo</h1>
        <p class="demo-description">
          Interactive demo showcasing the advanced filtering and search capabilities
        </p>
      </div>

      <div class="demo-content">
        <div class="stats-panel">
          <div class="stat-item">
            <span class="stat-value">${this.mockSessions.length}</span>
            <div class="stat-label">Total Sessions</div>
          </div>
          <div class="stat-item">
            <span class="stat-value">${this.performanceStats.filteredSessions}</span>
            <div class="stat-label">Filtered Results</div>
          </div>
          <div class="stat-item">
            <span class="stat-value">${(this.performanceStats.cacheHitRate * 100).toFixed(1)}%</span>
            <div class="stat-label">Cache Hit Rate</div>
          </div>
          <div class="stat-item">
            <span class="stat-value">${this.performanceStats.lastFilterTime.toFixed(1)}ms</span>
            <div class="stat-label">Last Filter Time</div>
          </div>
        </div>

        <div class="session-list-wrapper">
          <session-list
            .sessions=${this.mockSessions}
            .showFilters=${true}
            .filterable=${true}
            .searchable=${true}
            .paginated=${true}
            .title=${"Demo Sessions"}
            @filter-changed=${this.handleFilterChanged}
            @session-selected=${this.handleSessionSelected}
          ></session-list>
        </div>

        <div class="performance-info">
          💡 This demo showcases reactive filtering, fuzzy search, date range filtering, 
          message type filtering, and performance optimization with caching.
        </div>
      </div>
    `;
  }

  private generateMockSessions() {
    const sessionTypes = ['development', 'debugging', 'testing', 'research', 'documentation'];
    const workingDirs = [
      '/projects/web-app',
      '/projects/api-server', 
      '/projects/mobile-app',
      '/projects/data-pipeline',
      '/projects/analytics'
    ];
    const tags = ['frontend', 'backend', 'database', 'api', 'ui', 'performance', 'bug-fix', 'feature'];

    this.mockSessions = Array.from({ length: 150 }, (_, i) => {
      const startTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days
      const duration = Math.random() * 4 * 60 * 60 * 1000; // Up to 4 hours
      const endTime = new Date(startTime.getTime() + duration);
      const isActive = Math.random() < 0.1; // 10% chance of being active
      
      const sessionType = sessionTypes[Math.floor(Math.random() * sessionTypes.length)];
      const workingDir = workingDirs[Math.floor(Math.random() * workingDirs.length)];
      const sessionTags = tags
        .filter(() => Math.random() < 0.4) // 40% chance for each tag
        .slice(0, 3); // Max 3 tags per session

      return {
        sessionId: `session-${i.toString().padStart(3, '0')}-${Date.now().toString(36)}`,
        title: `${sessionType} Session ${i + 1}`,
        summary: `Working on ${sessionType} tasks in ${workingDir.split('/').pop()}. ${
          isActive ? 'Currently active session.' : 'Completed session.'
        }`,
        startTime,
        endTime: isActive ? undefined : endTime,
        duration: isActive ? undefined : Math.floor(duration / 1000),
        messageCount: Math.floor(Math.random() * 200) + 10,
        isActive,
        cwd: workingDir,
        tags: sessionTags,
        model: ['claude-3-5-sonnet', 'gpt-4', 'claude-3-haiku'][Math.floor(Math.random() * 3)],
        tokenCount: Math.floor(Math.random() * 50000) + 1000,
        cost: parseFloat((Math.random() * 10).toFixed(2)),
      } as SessionSummary;
    });
  }

  private handleFilterChanged = (event: CustomEvent) => {
    console.log('Filter changed:', event.detail);
    
    // Mock performance update (in real app this would come from FilterController)
    this.performanceStats = {
      ...this.performanceStats,
      filteredSessions: Math.floor(Math.random() * this.mockSessions.length),
      cacheHitRate: Math.random(),
      lastFilterTime: Math.random() * 50 + 5, // 5-55ms
    };
  };

  private handleSessionSelected = (event: CustomEvent) => {
    console.log('Session selected:', event.detail);
    
    // Show a simple notification
    const session = this.mockSessions.find(s => s.sessionId === event.detail.sessionId);
    if (session) {
      alert(`Selected session: ${session.title}\nMessages: ${session.messageCount}\nDuration: ${session.duration ? Math.floor(session.duration / 60) : '?'} minutes`);
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'filter-demo': FilterDemo;
  }
}