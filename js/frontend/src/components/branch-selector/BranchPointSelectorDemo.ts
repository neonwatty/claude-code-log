import { html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { 
  SessionSummary,
  BranchPoint,
  BranchCreationRequest 
} from '../types/session-types';
import { 
  TranscriptEntry,
  AssistantMessage,
  UserMessage 
} from '@app/shared';
import './BranchPointSelector';

/**
 * Demo component for testing the BranchPointSelector
 */
@customElement('branch-point-selector-demo')
export class BranchPointSelectorDemo extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: var(--space-lg);
        max-width: 1200px;
        margin: 0 auto;
      }

      .demo-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-lg);
        align-items: start;
      }

      .demo-section {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
      }

      .demo-title {
        margin: 0 0 var(--space-md) 0;
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }

      .controls {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        margin-bottom: var(--space-md);
      }

      .control-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .control-label {
        font-weight: var(--font-weight-medium);
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
      }

      .button {
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
        color: var(--color-text-primary);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .button:hover {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
      }

      .button.primary {
        background: var(--color-primary);
        color: var(--color-background);
        border-color: var(--color-primary);
      }

      .button.primary:hover {
        background: var(--color-primary-dark);
      }

      .event-log {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        min-height: 200px;
        max-height: 400px;
        overflow-y: auto;
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
      }

      .event-entry {
        margin-bottom: var(--space-xs);
        padding: var(--space-xs);
        border-radius: var(--border-radius-sm);
      }

      .event-entry.selection {
        background: var(--color-primary-light);
        color: var(--color-primary-dark);
      }

      .event-timestamp {
        color: var(--color-text-muted);
        margin-right: var(--space-sm);
      }

      .selected-info {
        background: var(--color-success-light);
        color: var(--color-success-dark);
        padding: var(--space-md);
        border-radius: var(--border-radius);
        margin-bottom: var(--space-md);
      }

      .selected-info h4 {
        margin: 0 0 var(--space-sm) 0;
      }

      .selected-info p {
        margin: var(--space-xs) 0;
        font-size: var(--font-size-sm);
      }

      @media (max-width: 768px) {
        .demo-container {
          grid-template-columns: 1fr;
        }
      }
    `
  ];

  @state()
  private mockSession: SessionSummary = {
    sessionId: 'demo-session-123',
    cwd: '/demo/project',
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    messageCount: 6,
    userMessageCount: 3,
    assistantMessageCount: 3,
    isActive: false,
    parentSessionId: null,
    branchPoint: null,
    branchTimestamp: null,
  };

  @state()
  private mockEntries: TranscriptEntry[] = [];

  @state()
  private selectedBranchPoint?: BranchPoint;

  @state()
  private eventLog: string[] = [];

  /**
   * Initialize demo data
   */
  connectedCallback(): void {
    super.connectedCallback();
    this.generateMockData();
  }

  /**
   * Generate mock transcript entries for testing
   */
  private generateMockData(): void {
    const baseTime = Date.now() - 3600000; // 1 hour ago

    this.mockEntries = [
      {
        type: 'user',
        message: {
          role: 'user',
          content: 'Please help me implement a new feature for user authentication in my React app.'
        },
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/demo/project',
        sessionId: 'demo-session-123',
        version: '1.0.0',
        uuid: 'msg-1',
        timestamp: new Date(baseTime).toISOString(),
      },
      {
        type: 'assistant',
        message: {
          id: 'msg-2',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-sonnet',
          content: [
            {
              type: 'text',
              text: 'I\'d be happy to help you implement user authentication in React! Let\'s start by setting up a basic authentication system with JWT tokens. Here are the key components we\'ll need to implement...'
            }
          ]
        },
        parentUuid: null,
        isSidechain: false,
        userType: 'assistant',
        cwd: '/demo/project',
        sessionId: 'demo-session-123',
        version: '1.0.0',
        uuid: 'msg-2',
        timestamp: new Date(baseTime + 30000).toISOString(),
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: 'That sounds good, but I\'m specifically interested in using Firebase Auth instead of JWT. Can you show me how to integrate that?'
        },
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/demo/project',
        sessionId: 'demo-session-123',
        version: '1.0.0',
        uuid: 'msg-3',
        timestamp: new Date(baseTime + 120000).toISOString(),
      },
      {
        type: 'assistant',
        message: {
          id: 'msg-4',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-sonnet',
          content: [
            {
              type: 'text',
              text: 'Absolutely! Firebase Auth is a great choice for authentication. Let me show you how to integrate it with your React app. First, we\'ll need to install the Firebase SDK...'
            }
          ]
        },
        parentUuid: null,
        isSidechain: false,
        userType: 'assistant',
        cwd: '/demo/project',
        sessionId: 'demo-session-123',
        version: '1.0.0',
        uuid: 'msg-4',
        timestamp: new Date(baseTime + 150000).toISOString(),
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: 'Perfect! Can you also show me how to handle social login providers like Google and GitHub?'
        },
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/demo/project',
        sessionId: 'demo-session-123',
        version: '1.0.0',
        uuid: 'msg-5',
        timestamp: new Date(baseTime + 300000).toISOString(),
      },
      {
        type: 'assistant',
        message: {
          id: 'msg-6',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-sonnet',
          content: [
            {
              type: 'text',
              text: 'Definitely! Social login providers make the user experience much smoother. Here\'s how to add Google and GitHub authentication to your Firebase setup...'
            }
          ]
        },
        parentUuid: null,
        isSidechain: false,
        userType: 'assistant',
        cwd: '/demo/project',
        sessionId: 'demo-session-123',
        version: '1.0.0',
        uuid: 'msg-6',
        timestamp: new Date(baseTime + 330000).toISOString(),
      }
    ] as TranscriptEntry[];
  }

  /**
   * Handle branch point selection events
   */
  private handleBranchPointSelected(event: CustomEvent): void {
    const { sessionId, branchPoint } = event.detail;
    this.selectedBranchPoint = branchPoint;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] Branch point selected: Message ${branchPoint.messageIndex + 1}`;
    this.eventLog = [logEntry, ...this.eventLog.slice(0, 19)]; // Keep last 20 entries
  }

  /**
   * Clear the event log
   */
  private clearEventLog(): void {
    this.eventLog = [];
  }

  /**
   * Simulate branch creation
   */
  private simulateBranchCreation(): void {
    if (!this.selectedBranchPoint) {
      return;
    }

    const request: BranchCreationRequest = {
      parentSessionId: this.mockSession.sessionId,
      branchPoint: this.selectedBranchPoint.messageIndex,
      metadata: {
        branchName: 'Alternative approach',
        branchReason: 'Exploring different implementation'
      }
    };

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] Branch creation requested: ${JSON.stringify(request, null, 2)}`;
    this.eventLog = [logEntry, ...this.eventLog.slice(0, 19)];
  }

  /**
   * Generate new mock data
   */
  private generateNewData(): void {
    this.generateMockData();
    this.selectedBranchPoint = undefined;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] Generated new mock data with ${this.mockEntries.length} messages`;
    this.eventLog = [logEntry, ...this.eventLog.slice(0, 19)];
  }

  render(): TemplateResult {
    return html`
      <div class="demo-container">
        <div class="demo-section">
          <h2 class="demo-title">Branch Point Selector</h2>
          
          <div class="controls">
            <div class="control-group">
              <span class="control-label">Demo Controls:</span>
              <button class="button" @click=${this.generateNewData}>
                Generate New Data
              </button>
              <button class="button" @click=${this.clearEventLog}>
                Clear Event Log
              </button>
            </div>
          </div>

          ${this.selectedBranchPoint ? html`
            <div class="selected-info">
              <h4>Selected Branch Point</h4>
              <p><strong>Message Index:</strong> ${this.selectedBranchPoint.messageIndex + 1}</p>
              <p><strong>Timestamp:</strong> ${this.selectedBranchPoint.timestamp.toLocaleString()}</p>
              <p><strong>Preview:</strong> ${this.selectedBranchPoint.messagePreview}</p>
              <p><strong>Has Branches:</strong> ${this.selectedBranchPoint.hasBranches ? 'Yes' : 'No'}</p>
              <button class="button primary" @click=${this.simulateBranchCreation}>
                Create Branch
              </button>
            </div>
          ` : ''}

          <branch-point-selector
            .session=${this.mockSession}
            .entries=${this.mockEntries}
            @branch-point-selected=${this.handleBranchPointSelected}
          ></branch-point-selector>
        </div>

        <div class="demo-section">
          <h2 class="demo-title">Event Log</h2>
          <div class="event-log">
            ${this.eventLog.length ? this.eventLog.map((entry, index) => html`
              <div class="event-entry ${entry.includes('selected:') ? 'selection' : ''}">
                ${entry}
              </div>
            `) : html`
              <div class="event-entry">No events yet. Select a branch point to see events.</div>
            `}
          </div>
        </div>
      </div>
    `;
  }
}