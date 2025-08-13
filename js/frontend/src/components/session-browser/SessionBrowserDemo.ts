import { html, css, CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { 
  SessionSummary, 
  SessionDetail,
  SessionFilter, 
  SessionSort 
} from '../types/session-types';
import './SessionBrowser';

/**
 * Demo component showcasing the SessionBrowser functionality
 */
@customElement('session-browser-demo')
export class SessionBrowserDemo extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        height: 100vh;
        background: var(--color-background);
      }

      .demo-container {
        height: 100%;
        padding: var(--space-md);
        box-sizing: border-box;
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
        max-width: 600px;
        margin: 0 auto;
        line-height: 1.5;
      }

      .demo-content {
        height: calc(100% - 120px);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .status-message {
        position: fixed;
        bottom: var(--space-lg);
        right: var(--space-lg);
        background: var(--color-primary);
        color: var(--color-text-inverse);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--border-radius);
        font-size: var(--font-size-sm);
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        transform: translateY(100px);
        opacity: 0;
        transition: all var(--transition-normal);
      }

      .status-message.visible {
        transform: translateY(0);
        opacity: 1;
      }
    `,
  ];

  @state()
  private sessions: SessionSummary[] = [];

  @state()
  private selectedSession: SessionDetail | null = null;

  @state()
  private loading = false;

  @state()
  private statusMessage = '';

  @state()
  private showStatus = false;

  render() {
    return html`
      <div class="demo-container">
        <header class="demo-header">
          <h1 class="demo-title">Session Browser Demo</h1>
          <p class="demo-description">
            Comprehensive visual browser interface for Claude Code sessions with 
            session listing, viewer, search/filtering, and real-time updates.
          </p>
        </header>

        <div class="demo-content">
          <session-browser
            .sessions=${this.sessions}
            .selectedSession=${this.selectedSession}
            .loading=${this.loading}
            .realTimeUpdates=${true}
            @session-selected=${this.handleSessionSelected}
            @session-details-requested=${this.handleSessionDetailsRequested}
            @filter-changed=${this.handleFilterChanged}
            @sort-changed=${this.handleSortChanged}
            @page-changed=${this.handlePageChanged}
            @branch-requested=${this.handleBranchRequested}
            @refresh-requested=${this.handleRefreshRequested}
            @error-occurred=${this.handleError}
          ></session-browser>
        </div>

        <div class="status-message ${this.showStatus ? 'visible' : ''}">
          ${this.statusMessage}
        </div>
      </div>
    `;
  }

  // Event handlers

  private handleSessionSelected(event: CustomEvent) {
    const { sessionId } = event.detail;
    this.showStatusMessage(`Selected session: ${sessionId}`);
  }

  private async handleSessionDetailsRequested(event: CustomEvent) {
    const { sessionId } = event.detail;
    
    try {
      this.loading = true;
      this.showStatusMessage(`Loading session details for: ${sessionId}`);
      
      // Simulate API call to load session details
      const sessionDetail = await this.loadSessionDetails(sessionId);
      this.selectedSession = sessionDetail;
      
      // Update the session browser
      const sessionBrowser = this.shadowRoot?.querySelector('session-browser') as any;
      sessionBrowser?.setSelectedSession(sessionDetail);
      
      this.showStatusMessage(`Loaded session: ${sessionDetail.title || sessionId}`);
      
    } catch (error) {
      this.showStatusMessage(`Error loading session: ${error}`);
    } finally {
      this.loading = false;
    }
  }

  private handleFilterChanged(event: CustomEvent) {
    const { filter } = event.detail;
    this.showStatusMessage(`Filters updated`);
    console.log('Filter changed:', filter);
  }

  private handleSortChanged(event: CustomEvent) {
    const { sort } = event.detail;
    this.showStatusMessage(`Sort changed to: ${sort.field} ${sort.direction}`);
    console.log('Sort changed:', sort);
  }

  private handlePageChanged(event: CustomEvent) {
    const { page, pageSize } = event.detail;
    this.showStatusMessage(`Page changed to: ${page + 1}`);
    console.log('Page changed:', { page, pageSize });
  }

  private handleBranchRequested(event: CustomEvent) {
    this.showStatusMessage(`Branch creation requested`);
    console.log('Branch requested:', event.detail);
  }

  private async handleRefreshRequested(event: CustomEvent) {
    this.showStatusMessage(`Refreshing sessions...`);
    await this.loadSessions();
  }

  private handleError(event: CustomEvent) {
    const { error } = event.detail;
    this.showStatusMessage(`Error: ${error}`);
    console.error('Session browser error:', error);
  }

  // Data loading methods

  private async loadSessions(): Promise<void> {
    try {
      this.loading = true;
      
      // Generate mock session data
      this.sessions = this.generateMockSessions();
      
      // Update the session browser
      const sessionBrowser = this.shadowRoot?.querySelector('session-browser') as any;
      sessionBrowser?.updateSessions(this.sessions);
      sessionBrowser?.setConnectionStatus('connected');
      
      this.showStatusMessage(`Loaded ${this.sessions.length} sessions`);
      
    } catch (error) {
      this.showStatusMessage(`Error loading sessions: ${error}`);
      console.error('Error loading sessions:', error);
    } finally {
      this.loading = false;
    }
  }

  private async loadSessionDetails(sessionId: string): Promise<SessionDetail> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    const session = this.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Generate mock detailed session data
    return {
      ...session,
      entries: this.generateMockEntries(session.messageCount),
      metadata: {
        version: '1.0.0',
        client: 'claude-code',
        environment: 'development'
      },
      referencedFiles: [
        '/src/components/SessionBrowser.ts',
        '/src/types/session-types.ts',
        '/package.json'
      ],
      toolsUsed: ['Read', 'Write', 'Bash', 'Edit'],
      errors: []
    };
  }

  private generateMockSessions(): SessionSummary[] {
    const sessions: SessionSummary[] = [];
    const projectPaths = [
      '/Users/dev/projects/claude-code-log',
      '/Users/dev/projects/session-browser',
      '/Users/dev/projects/web-components'
    ];
    
    const titles = [
      'Implementing Session Browser',
      'Bug Fix: Timeline Component',
      'Feature: Real-time Updates',
      'Refactor: Component Architecture',
      'Testing: Accessibility Features',
      'Documentation Updates',
      'Performance Optimization',
      'UI/UX Improvements'
    ];

    for (let i = 0; i < 25; i++) {
      const startTime = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const duration = Math.random() * 120 * 60 * 1000; // 0-2 hours
      const endTime = Math.random() > 0.2 ? new Date(startTime.getTime() + duration) : undefined;
      const messageCount = Math.floor(Math.random() * 50) + 5;
      const userMessages = Math.floor(messageCount * 0.4);
      
      sessions.push({
        sessionId: `session-${i + 1}`,
        title: titles[i % titles.length] + (i > 7 ? ` (${Math.floor(i / 8) + 1})` : ''),
        cwd: projectPaths[i % projectPaths.length],
        startTime,
        endTime,
        messageCount,
        userMessageCount: userMessages,
        assistantMessageCount: messageCount - userMessages,
        duration: endTime ? duration : undefined,
        isActive: !endTime && Math.random() > 0.7,
        tags: this.generateTags(),
        summary: `Session ${i + 1} summary with ${messageCount} messages`,
        tokenUsage: {
          inputTokens: Math.floor(Math.random() * 10000) + 1000,
          outputTokens: Math.floor(Math.random() * 15000) + 2000,
          totalTokens: 0
        },
        // Branch data
        parentSessionId: i > 10 && Math.random() > 0.7 ? `session-${Math.floor(Math.random() * 10) + 1}` : undefined,
        branchPoint: i > 10 && Math.random() > 0.7 ? Math.floor(Math.random() * 20) : undefined,
        branchTimestamp: i > 10 && Math.random() > 0.7 ? new Date(startTime.getTime() - 1000) : undefined
      });
      
      // Calculate total tokens
      sessions[i].tokenUsage!.totalTokens = 
        sessions[i].tokenUsage!.inputTokens + sessions[i].tokenUsage!.outputTokens;
    }

    return sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  private generateTags(): string[] {
    const allTags = ['bug-fix', 'feature', 'refactor', 'testing', 'docs', 'performance', 'ui/ux'];
    const count = Math.floor(Math.random() * 3) + 1;
    const tags: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const tag = allTags[Math.floor(Math.random() * allTags.length)];
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }
    
    return tags;
  }

  private generateMockEntries(count: number): any[] {
    const entries: any[] = [];
    const roles = ['user', 'assistant', 'system'];
    const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'LS'];
    
    for (let i = 0; i < count; i++) {
      const role = roles[Math.floor(Math.random() * roles.length)];
      const timestamp = new Date(Date.now() - (count - i) * 60000); // 1 minute apart
      
      let content: any;
      
      if (role === 'user') {
        content = [
          {
            type: 'text',
            text: this.generateUserMessage(i)
          }
        ];
      } else if (role === 'assistant') {
        content = [
          {
            type: 'text',
            text: this.generateAssistantMessage(i)
          }
        ];
        
        // Sometimes add tool use
        if (Math.random() > 0.6) {
          content.push({
            type: 'tool_use',
            id: `tool-${i}`,
            name: tools[Math.floor(Math.random() * tools.length)],
            input: { file_path: '/src/example.ts' }
          });
        }
      } else {
        content = `System message ${i + 1}`;
      }
      
      entries.push({
        role,
        content,
        timestamp: timestamp.toISOString(),
        tokenCount: Math.floor(Math.random() * 500) + 50,
        thinking: role === 'assistant' && Math.random() > 0.7 ? [`Thinking about step ${i + 1}`] : undefined
      });
    }
    
    return entries;
  }

  private generateUserMessage(index: number): string {
    const messages = [
      `Can you help me implement a session browser component?`,
      `I need to add filtering functionality to the session list.`,
      `How can I optimize the virtual scrolling performance?`,
      `Let's add real-time updates to the session viewer.`,
      `Can you explain how the branching system works?`,
      `I want to improve the accessibility of this component.`,
      `Help me debug this issue with message rendering.`,
      `Let's add keyboard shortcuts for navigation.`
    ];
    
    return messages[index % messages.length];
  }

  private generateAssistantMessage(index: number): string {
    const messages = [
      `I'll help you implement the session browser component. Let me start by creating the main component structure.`,
      `I can add filtering functionality to the session list. I'll implement search, date ranges, and tag-based filtering.`,
      `For virtual scrolling performance, I'll optimize the item rendering and add proper memoization.`,
      `I'll add real-time updates using WebSocket integration with proper reconnection handling.`,
      `The branching system allows creating alternative conversation paths from any message point.`,
      `I'll improve accessibility by adding proper ARIA labels, keyboard navigation, and screen reader support.`,
      `Let me debug the message rendering issue by examining the component structure.`,
      `I'll add keyboard shortcuts for common navigation actions like previous/next session and branching.`
    ];
    
    return messages[index % messages.length];
  }

  private showStatusMessage(message: string) {
    this.statusMessage = message;
    this.showStatus = true;
    
    // Hide after 3 seconds
    setTimeout(() => {
      this.showStatus = false;
    }, 3000);
  }

  protected firstUpdated() {
    // Load initial data
    this.loadSessions();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-browser-demo': SessionBrowserDemo;
  }
}