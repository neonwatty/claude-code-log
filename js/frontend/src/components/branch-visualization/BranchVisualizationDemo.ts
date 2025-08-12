import { html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { SessionBranchTree, SessionSummary } from '../types/session-types';
import './BranchVisualization';

/**
 * Demo component showcasing the BranchVisualization component with sample data.
 * Provides various test scenarios and interactive controls.
 */
@customElement('branch-visualization-demo')
export class BranchVisualizationDemo extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: var(--space-lg);
        max-width: 1200px;
        margin: 0 auto;
      }

      .demo-section {
        margin-bottom: var(--space-xl);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .demo-header {
        background: var(--color-background-secondary);
        padding: var(--space-md);
        border-bottom: 1px solid var(--color-border-light);
      }

      .demo-title {
        margin: 0 0 var(--space-xs) 0;
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }

      .demo-description {
        margin: 0;
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
      }

      .demo-content {
        padding: var(--space-md);
      }

      .controls {
        display: flex;
        gap: var(--space-md);
        flex-wrap: wrap;
        margin-bottom: var(--space-md);
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
      }

      .control-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .control-label {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
      }

      .control-button {
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: var(--border-radius);
        padding: var(--space-sm) var(--space-md);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: background-color var(--transition-fast);
      }

      .control-button:hover {
        background: var(--color-primary-dark);
      }

      .control-button:disabled {
        background: var(--color-muted);
        cursor: not-allowed;
      }

      .control-button.secondary {
        background: var(--color-secondary);
      }

      .control-button.secondary:hover {
        background: var(--color-secondary-dark);
      }

      .control-select {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
        color: var(--color-text-primary);
      }

      .visualization-container {
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .events-log {
        max-height: 200px;
        overflow-y: auto;
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
        padding: var(--space-sm);
        font-family: var(--font-family-mono);
        font-size: var(--font-size-sm);
        margin-top: var(--space-md);
      }

      .event-entry {
        margin: var(--space-xs) 0;
        padding: var(--space-xs);
        background: var(--color-background);
        border-radius: var(--border-radius-sm);
        border-left: 3px solid var(--color-info);
      }

      .event-entry.navigation {
        border-left-color: var(--color-primary);
      }

      .event-entry.websocket {
        border-left-color: var(--color-success);
      }

      .event-timestamp {
        color: var(--color-text-muted);
        font-size: var(--font-size-xs);
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--space-md);
        margin-top: var(--space-md);
      }

      .stat {
        text-align: center;
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
      }

      .stat-value {
        display: block;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-medium);
        color: var(--color-primary);
        margin-bottom: var(--space-xs);
      }

      .stat-label {
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
      }
    `
  ];

  @state()
  private selectedScenario: string = 'complex';

  @state()
  private currentSessionId: string | null = null;

  @state()
  private branchTree: SessionBranchTree | null = null;

  @state()
  private events: EventLogEntry[] = [];

  @state()
  private websocketEnabled = false;

  private scenarios: Record<string, SessionBranchTree> = {
    simple: this.createSimpleScenario(),
    complex: this.createComplexScenario(),
    deep: this.createDeepScenario(),
    wide: this.createWideScenario(),
    empty: this.createEmptyScenario()
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.branchTree = this.scenarios[this.selectedScenario];
    this.currentSessionId = this.branchTree?.rootSession.sessionId || null;
  }

  private createSimpleScenario(): SessionBranchTree {
    const rootSession: SessionSummary = {
      sessionId: 'root-simple',
      title: 'Main Session',
      cwd: '/project',
      startTime: new Date('2024-01-01T10:00:00Z'),
      messageCount: 8,
      userMessageCount: 4,
      assistantMessageCount: 4,
      isActive: true,
      parentSessionId: null,
      branchPoint: null,
      branchTimestamp: null
    };

    const branch1Session: SessionSummary = {
      sessionId: 'branch-1-simple',
      title: 'Alternative Approach',
      cwd: '/project',
      startTime: new Date('2024-01-01T10:30:00Z'),
      messageCount: 5,
      userMessageCount: 2,
      assistantMessageCount: 3,
      isActive: false,
      parentSessionId: 'root-simple',
      branchPoint: 2,
      branchTimestamp: new Date('2024-01-01T10:30:00Z'),
      branchMetadata: {
        branchName: 'Alt Approach',
        branchReason: 'Trying different solution'
      }
    };

    return {
      rootSession,
      branches: [{
        rootSession: branch1Session,
        branches: [],
        depth: 1
      }],
      depth: 0
    };
  }

  private createComplexScenario(): SessionBranchTree {
    const rootSession: SessionSummary = {
      sessionId: 'root-complex',
      title: 'Complex Development Session',
      cwd: '/complex-project',
      startTime: new Date('2024-01-01T09:00:00Z'),
      messageCount: 15,
      userMessageCount: 8,
      assistantMessageCount: 7,
      isActive: false,
      parentSessionId: null,
      branchPoint: null,
      branchTimestamp: null
    };

    const featureBranch: SessionSummary = {
      sessionId: 'feature-branch',
      title: 'Feature Implementation',
      cwd: '/complex-project',
      startTime: new Date('2024-01-01T10:00:00Z'),
      messageCount: 12,
      userMessageCount: 6,
      assistantMessageCount: 6,
      isActive: true,
      parentSessionId: 'root-complex',
      branchPoint: 4,
      branchTimestamp: new Date('2024-01-01T10:00:00Z'),
      branchMetadata: {
        branchName: 'New Feature',
        branchReason: 'Implementing user authentication'
      }
    };

    const bugfixBranch: SessionSummary = {
      sessionId: 'bugfix-branch',
      title: 'Bug Fix Session',
      cwd: '/complex-project',
      startTime: new Date('2024-01-01T11:00:00Z'),
      messageCount: 8,
      userMessageCount: 3,
      assistantMessageCount: 5,
      isActive: false,
      parentSessionId: 'root-complex',
      branchPoint: 7,
      branchTimestamp: new Date('2024-01-01T11:00:00Z'),
      branchMetadata: {
        branchName: 'Login Fix',
        branchReason: 'Fixing authentication bug'
      }
    };

    const experimentalBranch: SessionSummary = {
      sessionId: 'experimental-branch',
      title: 'Experimental Approach',
      cwd: '/complex-project',
      startTime: new Date('2024-01-01T12:00:00Z'),
      messageCount: 6,
      userMessageCount: 3,
      assistantMessageCount: 3,
      isActive: false,
      parentSessionId: 'feature-branch',
      branchPoint: 3,
      branchTimestamp: new Date('2024-01-01T12:00:00Z'),
      branchMetadata: {
        branchName: 'JWT Experiment',
        branchReason: 'Testing JWT implementation'
      }
    };

    return {
      rootSession,
      branches: [
        {
          rootSession: featureBranch,
          branches: [{
            rootSession: experimentalBranch,
            branches: [],
            depth: 2
          }],
          depth: 1
        },
        {
          rootSession: bugfixBranch,
          branches: [],
          depth: 1
        }
      ],
      depth: 0
    };
  }

  private createDeepScenario(): SessionBranchTree {
    // Create a deep nested tree (5 levels)
    const sessions: SessionSummary[] = [];
    for (let i = 0; i < 5; i++) {
      sessions.push({
        sessionId: `deep-session-${i}`,
        title: `Level ${i} Session`,
        cwd: `/deep-project/level-${i}`,
        startTime: new Date(`2024-01-01T${10 + i}:00:00Z`),
        messageCount: 10 - i,
        userMessageCount: Math.ceil((10 - i) / 2),
        assistantMessageCount: Math.floor((10 - i) / 2),
        isActive: i === 0,
        parentSessionId: i > 0 ? `deep-session-${i - 1}` : null,
        branchPoint: i > 0 ? i : null,
        branchTimestamp: i > 0 ? new Date(`2024-01-01T${10 + i}:00:00Z`) : null,
        branchMetadata: i > 0 ? {
          branchName: `Deep Level ${i}`,
          branchReason: `Exploring option ${i}`
        } : undefined
      });
    }

    // Build nested structure
    let currentTree: SessionBranchTree = {
      rootSession: sessions[4],
      branches: [],
      depth: 4
    };

    for (let i = 3; i >= 0; i--) {
      currentTree = {
        rootSession: sessions[i],
        branches: [currentTree],
        depth: i
      };
    }

    return currentTree;
  }

  private createWideScenario(): SessionBranchTree {
    const rootSession: SessionSummary = {
      sessionId: 'wide-root',
      title: 'Multi-Branch Session',
      cwd: '/wide-project',
      startTime: new Date('2024-01-01T08:00:00Z'),
      messageCount: 20,
      userMessageCount: 10,
      assistantMessageCount: 10,
      isActive: false,
      parentSessionId: null,
      branchPoint: null,
      branchTimestamp: null
    };

    const branches: SessionBranchTree[] = [];
    const branchNames = ['API', 'UI', 'Database', 'Testing', 'Docs'];
    
    for (let i = 0; i < 5; i++) {
      branches.push({
        rootSession: {
          sessionId: `wide-branch-${i}`,
          title: `${branchNames[i]} Development`,
          cwd: `/wide-project/${branchNames[i].toLowerCase()}`,
          startTime: new Date(`2024-01-01T${9 + i}:00:00Z`),
          messageCount: 8 + i,
          userMessageCount: 4 + Math.floor(i / 2),
          assistantMessageCount: 4 + Math.ceil(i / 2),
          isActive: i === 2,
          parentSessionId: 'wide-root',
          branchPoint: 3 + i,
          branchTimestamp: new Date(`2024-01-01T${9 + i}:00:00Z`),
          branchMetadata: {
            branchName: branchNames[i],
            branchReason: `Working on ${branchNames[i].toLowerCase()} component`
          }
        },
        branches: [],
        depth: 1
      });
    }

    return {
      rootSession,
      branches,
      depth: 0
    };
  }

  private createEmptyScenario(): SessionBranchTree {
    return {
      rootSession: {
        sessionId: 'empty-root',
        title: 'Single Session',
        cwd: '/empty-project',
        startTime: new Date('2024-01-01T12:00:00Z'),
        messageCount: 3,
        userMessageCount: 2,
        assistantMessageCount: 1,
        isActive: true,
        parentSessionId: null,
        branchPoint: null,
        branchTimestamp: null
      },
      branches: [],
      depth: 0
    };
  }

  private handleScenarioChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedScenario = select.value;
    this.branchTree = this.scenarios[this.selectedScenario];
    this.currentSessionId = this.branchTree?.rootSession.sessionId || null;
    this.addEvent('scenario', `Switched to ${this.selectedScenario} scenario`);
  }

  private handleSessionNavigate(event: CustomEvent): void {
    const { fromSessionId, toSessionId } = event.detail;
    this.currentSessionId = toSessionId;
    this.addEvent('navigation', `Navigated from ${fromSessionId || 'none'} to ${toSessionId}`);
  }

  private handleBranchTreeUpdate(event: CustomEvent): void {
    const { type, data } = event.detail;
    this.addEvent('websocket', `Branch tree update: ${type}`, data);
  }

  private handleToggleWebSocket(): void {
    this.websocketEnabled = !this.websocketEnabled;
    this.addEvent('websocket', `WebSocket ${this.websocketEnabled ? 'enabled' : 'disabled'}`);
  }

  private handleClearEvents(): void {
    this.events = [];
  }

  private handleAddMockBranch(): void {
    if (!this.branchTree || !this.currentSessionId) return;

    const mockBranch: SessionSummary = {
      sessionId: `mock-${Date.now()}`,
      title: 'Mock Branch',
      cwd: this.branchTree.rootSession.cwd,
      startTime: new Date(),
      messageCount: 3,
      userMessageCount: 2,
      assistantMessageCount: 1,
      isActive: true,
      parentSessionId: this.currentSessionId,
      branchPoint: 2,
      branchTimestamp: new Date(),
      branchMetadata: {
        branchName: 'Mock Branch',
        branchReason: 'Testing branch creation'
      }
    };

    // Simulate adding branch to tree (in real app this would come from backend)
    this.addEvent('mock', `Added mock branch: ${mockBranch.sessionId}`);
  }

  private addEvent(type: string, message: string, data?: any): void {
    this.events = [
      {
        timestamp: new Date(),
        type,
        message,
        data
      },
      ...this.events.slice(0, 99) // Keep only last 100 events
    ];
  }

  private getTreeStats(): TreeStats {
    if (!this.branchTree) {
      return { totalSessions: 0, maxDepth: 0, activeSessions: 0 };
    }

    return this.calculateTreeStats(this.branchTree, 0);
  }

  private calculateTreeStats(tree: SessionBranchTree, depth: number): TreeStats {
    const stats: TreeStats = {
      totalSessions: 1,
      maxDepth: depth,
      activeSessions: tree.rootSession.isActive ? 1 : 0
    };

    for (const branch of tree.branches) {
      const branchStats = this.calculateTreeStats(branch, depth + 1);
      stats.totalSessions += branchStats.totalSessions;
      stats.maxDepth = Math.max(stats.maxDepth, branchStats.maxDepth);
      stats.activeSessions += branchStats.activeSessions;
    }

    return stats;
  }

  render(): TemplateResult {
    const stats = this.getTreeStats();

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h1 class="demo-title">Branch Visualization Demo</h1>
          <p class="demo-description">
            Interactive demonstration of the session branch tree visualization component.
            Test different scenarios and explore features.
          </p>
        </div>
        <div class="demo-content">
          <div class="controls">
            <div class="control-group">
              <label class="control-label">Scenario</label>
              <select 
                class="control-select" 
                .value=${this.selectedScenario}
                @change=${this.handleScenarioChange}
              >
                <option value="simple">Simple (2 sessions)</option>
                <option value="complex">Complex (4 sessions)</option>
                <option value="deep">Deep (5 levels)</option>
                <option value="wide">Wide (6 branches)</option>
                <option value="empty">Empty (1 session)</option>
              </select>
            </div>
            <div class="control-group">
              <label class="control-label">Actions</label>
              <div style="display: flex; gap: var(--space-xs);">
                <button 
                  class="control-button secondary"
                  @click=${this.handleToggleWebSocket}
                >
                  ${this.websocketEnabled ? 'Disable' : 'Enable'} WebSocket
                </button>
                <button 
                  class="control-button secondary"
                  @click=${this.handleAddMockBranch}
                  ?disabled=${!this.currentSessionId}
                >
                  Add Mock Branch
                </button>
                <button 
                  class="control-button secondary"
                  @click=${this.handleClearEvents}
                >
                  Clear Events
                </button>
              </div>
            </div>
          </div>

          <div class="visualization-container">
            <branch-visualization
              .branchTree=${this.branchTree}
              .currentSessionId=${this.currentSessionId}
              .rootSessionId=${this.branchTree?.rootSession.sessionId}
              ?enable-websocket=${this.websocketEnabled}
              websocket-url="ws://localhost:3001"
              api-url="http://localhost:3001/api"
              @session-navigate=${this.handleSessionNavigate}
              @branch-tree-updated=${this.handleBranchTreeUpdate}
            ></branch-visualization>
          </div>

          <div class="stats">
            <div class="stat">
              <span class="stat-value">${stats.totalSessions}</span>
              <span class="stat-label">Total Sessions</span>
            </div>
            <div class="stat">
              <span class="stat-value">${stats.maxDepth}</span>
              <span class="stat-label">Max Depth</span>
            </div>
            <div class="stat">
              <span class="stat-value">${stats.activeSessions}</span>
              <span class="stat-label">Active Sessions</span>
            </div>
            <div class="stat">
              <span class="stat-value">${this.currentSessionId?.slice(0, 8) || 'None'}</span>
              <span class="stat-label">Current Session</span>
            </div>
          </div>

          ${this.events.length > 0 ? html`
            <div class="events-log" role="log" aria-label="Event log">
              ${this.events.map(event => html`
                <div class="event-entry ${event.type}">
                  <div class="event-timestamp">
                    ${event.timestamp.toLocaleTimeString()}
                  </div>
                  <div>${event.message}</div>
                  ${event.data ? html`<div><pre>${JSON.stringify(event.data, null, 2)}</pre></div>` : ''}
                </div>
              `)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

interface EventLogEntry {
  timestamp: Date;
  type: string;
  message: string;
  data?: any;
}

interface TreeStats {
  totalSessions: number;
  maxDepth: number;
  activeSessions: number;
}

declare global {
  interface HTMLElementTagNameMap {
    'branch-visualization-demo': BranchVisualizationDemo;
  }
}