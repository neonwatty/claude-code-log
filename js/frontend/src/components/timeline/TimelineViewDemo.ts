import { html, css, CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { SessionSummary } from '../types/session-types';
import './TimelineView';
import { TimelineFilter } from './TimelineView';

/**
 * Demo component for testing the TimelineView component
 */
@customElement('timeline-view-demo')
export class TimelineViewDemo extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: var(--space-lg);
        min-height: 100vh;
        background: var(--color-background);
      }

      .demo-container {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: var(--space-lg);
      }

      .demo-header {
        text-align: center;
        padding: var(--space-xl);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border);
      }

      .demo-title {
        margin: 0 0 var(--space-md) 0;
        font-size: var(--font-size-xxl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
      }

      .demo-description {
        color: var(--color-text-secondary);
        font-size: var(--font-size-lg);
        max-width: 600px;
        margin: 0 auto;
        line-height: 1.6;
      }

      .demo-controls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-md);
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border);
      }

      .control-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        min-width: 150px;
      }

      .control-label {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
      }

      .control-button {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: none;
        border-radius: var(--border-radius);
        padding: var(--space-sm) var(--space-md);
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        transition: all var(--transition-fast);
      }

      .control-button:hover {
        background: var(--color-primary-dark);
        transform: translateY(-1px);
      }

      .control-button:active {
        transform: translateY(0);
      }

      .control-button.secondary {
        background: var(--color-background);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
      }

      .control-button.secondary:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .timeline-container {
        height: 600px;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
        box-shadow: var(--shadow-md);
      }

      .event-log {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        max-height: 300px;
        overflow-y: auto;
      }

      .event-log-title {
        margin: 0 0 var(--space-sm) 0;
        font-size: var(--font-size-md);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }

      .event-item {
        padding: var(--space-xs) 0;
        border-bottom: 1px solid var(--color-border-light);
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        font-family: var(--font-mono);
      }

      .event-item:last-child {
        border-bottom: none;
      }

      .event-timestamp {
        color: var(--color-text-muted);
        margin-right: var(--space-sm);
      }

      .status-info {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--space-md);
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border);
      }

      .status-card {
        text-align: center;
        padding: var(--space-md);
        background: var(--color-background);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border-light);
      }

      .status-value {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        margin-bottom: var(--space-xs);
      }

      .status-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      @media (max-width: 768px) {
        .demo-controls {
          flex-direction: column;
        }

        .timeline-container {
          height: 400px;
        }

        .status-info {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @state()
  private sessions: SessionSummary[] = [];

  @state()
  private events: { timestamp: Date; event: string; data?: any }[] = [];

  @state()
  private isRealTimeEnabled = true;

  @state()
  private filter: TimelineFilter = {};

  private eventLogTimeout: number | null = null;

  render() {
    return html`
      <div class="demo-container">
        ${this.renderHeader()}
        ${this.renderControls()}
        ${this.renderStatusInfo()}
        ${this.renderTimeline()}
        ${this.renderEventLog()}
      </div>
    `;
  }

  private renderHeader() {
    return html`
      <div class="demo-header">
        <h1 class="demo-title">Interactive Timeline Component</h1>
        <p class="demo-description">
          A zoomable, filterable timeline view of sessions with real-time updates using GSTC library.
          Click and drag to navigate, use zoom controls, and filter by date ranges.
        </p>
      </div>
    `;
  }

  private renderControls() {
    return html`
      <div class="demo-controls">
        <div class="control-group">
          <label class="control-label">Sample Data</label>
          <button class="control-button" @click=${this.generateSampleData}>
            Generate Sample Sessions
          </button>
        </div>
        
        <div class="control-group">
          <label class="control-label">Real-time Updates</label>
          <button 
            class="control-button ${this.isRealTimeEnabled ? '' : 'secondary'}"
            @click=${this.toggleRealTime}
          >
            ${this.isRealTimeEnabled ? 'Disable' : 'Enable'} Real-time
          </button>
        </div>

        <div class="control-group">
          <label class="control-label">Actions</label>
          <button class="control-button secondary" @click=${this.addRandomSession}>
            Add Random Session
          </button>
        </div>

        <div class="control-group">
          <label class="control-label">Data Management</label>
          <button class="control-button secondary" @click=${this.clearSessions}>
            Clear All Sessions
          </button>
        </div>

        <div class="control-group">
          <label class="control-label">Events</label>
          <button class="control-button secondary" @click=${this.clearEvents}>
            Clear Event Log
          </button>
        </div>
      </div>
    `;
  }

  private renderStatusInfo() {
    const activeSessions = this.sessions.filter(s => s.isActive).length;
    const totalSessions = this.sessions.length;
    const totalMessages = this.sessions.reduce((sum, s) => sum + s.messageCount, 0);
    const averageMessages = totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0;

    return html`
      <div class="status-info">
        <div class="status-card">
          <div class="status-value">${totalSessions}</div>
          <div class="status-label">Total Sessions</div>
        </div>
        <div class="status-card">
          <div class="status-value">${activeSessions}</div>
          <div class="status-label">Active Sessions</div>
        </div>
        <div class="status-card">
          <div class="status-value">${totalMessages}</div>
          <div class="status-label">Total Messages</div>
        </div>
        <div class="status-card">
          <div class="status-value">${averageMessages}</div>
          <div class="status-label">Avg Messages/Session</div>
        </div>
      </div>
    `;
  }

  private renderTimeline() {
    return html`
      <div class="timeline-container">
        <timeline-view
          .sessions=${this.sessions}
          .filter=${this.filter}
          .realTime=${this.isRealTimeEnabled}
          title="Session Timeline Demo"
          @session-selected=${this.handleSessionSelected}
          @session-opened=${this.handleSessionOpened}
          @filter-changed=${this.handleFilterChanged}
          @timeline-initialized=${this.handleTimelineInitialized}
          @timeline-exported=${this.handleTimelineExported}
          @session-added=${this.handleSessionAdded}
          @session-updated=${this.handleSessionUpdated}
          @session-removed=${this.handleSessionRemoved}
          @retry-load-requested=${this.handleRetryLoad}
        ></timeline-view>
      </div>
    `;
  }

  private renderEventLog() {
    return html`
      <div class="event-log">
        <h3 class="event-log-title">Event Log (${this.events.length} events)</h3>
        ${this.events.slice(-10).reverse().map(event => html`
          <div class="event-item">
            <span class="event-timestamp">${event.timestamp.toLocaleTimeString()}</span>
            ${event.event}
            ${event.data ? html` - ${JSON.stringify(event.data, null, 0)}` : ''}
          </div>
        `)}
        ${this.events.length === 0 ? html`
          <div class="event-item">No events yet. Try interacting with the timeline...</div>
        ` : ''}
      </div>
    `;
  }

  private generateSampleData() {
    const sampleSessions: SessionSummary[] = [];
    const now = new Date();
    const startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago

    const workingDirs = [
      '/Users/dev/project-a',
      '/Users/dev/project-b',
      '/Users/dev/experiments',
      '/Users/dev/client-work',
      '/Users/dev/personal',
    ];

    const sessionTitles = [
      'Bug fixes and improvements',
      'Feature development',
      'Code review and refactoring',
      'Documentation updates',
      'Testing and debugging',
      'API integration',
      'Database optimization',
      'UI/UX improvements',
      'Performance tuning',
      'Security updates',
    ];

    for (let i = 0; i < 20; i++) {
      const startTime = new Date(startDate.getTime() + Math.random() * (now.getTime() - startDate.getTime()));
      const duration = Math.random() * 4 * 60 * 60 * 1000; // 0-4 hours
      const endTime = Math.random() > 0.3 ? new Date(startTime.getTime() + duration) : undefined; // 70% completed
      const messageCount = Math.floor(Math.random() * 50) + 5;

      sampleSessions.push({
        sessionId: `session-${i + 1}`,
        title: sessionTitles[Math.floor(Math.random() * sessionTitles.length)],
        cwd: workingDirs[Math.floor(Math.random() * workingDirs.length)],
        startTime,
        endTime,
        messageCount,
        userMessageCount: Math.floor(messageCount * 0.4),
        assistantMessageCount: Math.floor(messageCount * 0.6),
        duration: endTime ? endTime.getTime() - startTime.getTime() : undefined,
        isActive: !endTime,
        tags: this.generateRandomTags(),
        summary: `Session with ${messageCount} messages`,
        tokenUsage: {
          inputTokens: Math.floor(Math.random() * 10000) + 1000,
          outputTokens: Math.floor(Math.random() * 15000) + 2000,
          totalTokens: 0,
        },
      });

      // Calculate total tokens
      const session = sampleSessions[sampleSessions.length - 1];
      session.tokenUsage!.totalTokens = session.tokenUsage!.inputTokens + session.tokenUsage!.outputTokens;
    }

    this.sessions = sampleSessions;
    this.logEvent('Generated sample data', { count: sampleSessions.length });

    // Start real-time updates simulation if enabled
    if (this.isRealTimeEnabled) {
      this.startRealTimeSimulation();
    }
  }

  private generateRandomTags(): string[] {
    const allTags = ['frontend', 'backend', 'api', 'database', 'testing', 'bugfix', 'feature', 'refactor', 'docs'];
    const numTags = Math.floor(Math.random() * 3) + 1;
    const tags: string[] = [];
    
    for (let i = 0; i < numTags; i++) {
      const tag = allTags[Math.floor(Math.random() * allTags.length)];
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }
    
    return tags;
  }

  private addRandomSession() {
    const newSession: SessionSummary = {
      sessionId: `session-${Date.now()}`,
      title: 'New session',
      cwd: '/Users/dev/new-project',
      startTime: new Date(),
      messageCount: 1,
      userMessageCount: 1,
      assistantMessageCount: 0,
      isActive: true,
      tags: ['new'],
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 0,
        totalTokens: 100,
      },
    };

    this.sessions = [...this.sessions, newSession];
    this.logEvent('Added random session', { sessionId: newSession.sessionId });
  }

  private clearSessions() {
    this.sessions = [];
    this.logEvent('Cleared all sessions');
    this.stopRealTimeSimulation();
  }

  private clearEvents() {
    this.events = [];
  }

  private toggleRealTime() {
    this.isRealTimeEnabled = !this.isRealTimeEnabled;
    
    if (this.isRealTimeEnabled && this.sessions.length > 0) {
      this.startRealTimeSimulation();
    } else {
      this.stopRealTimeSimulation();
    }
    
    this.logEvent(`Real-time updates ${this.isRealTimeEnabled ? 'enabled' : 'disabled'}`);
  }

  private realTimeInterval: number | null = null;

  private startRealTimeSimulation() {
    this.stopRealTimeSimulation();
    
    this.realTimeInterval = window.setInterval(() => {
      if (this.sessions.length === 0) return;
      
      // Randomly update an active session
      const activeSessions = this.sessions.filter(s => s.isActive);
      if (activeSessions.length > 0) {
        const sessionToUpdate = activeSessions[Math.floor(Math.random() * activeSessions.length)];
        const index = this.sessions.findIndex(s => s.sessionId === sessionToUpdate.sessionId);
        
        if (index !== -1) {
          const updated = { ...this.sessions[index] };
          updated.messageCount += Math.floor(Math.random() * 3) + 1;
          updated.userMessageCount += Math.floor(Math.random() * 2);
          updated.assistantMessageCount = updated.messageCount - updated.userMessageCount;
          
          if (updated.tokenUsage) {
            updated.tokenUsage.inputTokens += Math.floor(Math.random() * 500) + 50;
            updated.tokenUsage.outputTokens += Math.floor(Math.random() * 800) + 100;
            updated.tokenUsage.totalTokens = updated.tokenUsage.inputTokens + updated.tokenUsage.outputTokens;
          }
          
          // Occasionally complete a session
          if (Math.random() < 0.1) {
            updated.isActive = false;
            updated.endTime = new Date();
            updated.duration = updated.endTime.getTime() - updated.startTime.getTime();
          }
          
          this.sessions = [
            ...this.sessions.slice(0, index),
            updated,
            ...this.sessions.slice(index + 1)
          ];
          
          this.logEvent('Session updated via real-time', { sessionId: updated.sessionId });
        }
      }
      
      // Occasionally add a new session
      if (Math.random() < 0.2) {
        this.addRandomSession();
      }
    }, 5000); // Update every 5 seconds
  }

  private stopRealTimeSimulation() {
    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
      this.realTimeInterval = null;
    }
  }

  private logEvent(event: string, data?: any) {
    this.events = [...this.events, {
      timestamp: new Date(),
      event,
      data,
    }];

    // Auto-scroll event log after a short delay
    if (this.eventLogTimeout) {
      clearTimeout(this.eventLogTimeout);
    }
    
    this.eventLogTimeout = window.setTimeout(() => {
      const eventLog = this.shadowRoot?.querySelector('.event-log');
      if (eventLog) {
        eventLog.scrollTop = eventLog.scrollHeight;
      }
    }, 100);
  }

  // Event handlers
  private handleSessionSelected(event: CustomEvent) {
    this.logEvent('Session selected', event.detail);
  }

  private handleSessionOpened(event: CustomEvent) {
    this.logEvent('Session opened', event.detail);
  }

  private handleFilterChanged(event: CustomEvent) {
    this.filter = event.detail.filter;
    this.logEvent('Filter changed', event.detail);
  }

  private handleTimelineInitialized(event: CustomEvent) {
    this.logEvent('Timeline initialized');
  }

  private handleTimelineExported(event: CustomEvent) {
    this.logEvent('Timeline exported');
  }

  private handleSessionAdded(event: CustomEvent) {
    this.logEvent('Session added to timeline', event.detail);
  }

  private handleSessionUpdated(event: CustomEvent) {
    this.logEvent('Session updated in timeline', event.detail);
  }

  private handleSessionRemoved(event: CustomEvent) {
    this.logEvent('Session removed from timeline', event.detail);
  }

  private handleRetryLoad(event: CustomEvent) {
    this.logEvent('Retry load requested');
    // In a real app, this would trigger a data reload
    setTimeout(() => {
      this.generateSampleData();
    }, 1000);
  }

  connectedCallback() {
    super.connectedCallback();
    
    // Generate initial sample data
    setTimeout(() => {
      this.generateSampleData();
    }, 500);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopRealTimeSimulation();
    
    if (this.eventLogTimeout) {
      clearTimeout(this.eventLogTimeout);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'timeline-view-demo': TimelineViewDemo;
  }
}