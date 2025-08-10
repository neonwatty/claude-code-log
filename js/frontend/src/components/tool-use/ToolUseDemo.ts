import { html, css, CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { 
  ToolUseContent,
  ToolResultContent,
  ThinkingContent
} from '@app/shared';
import { ToolUseDisplay, ToolStatus } from './ToolUse';
import './ToolUse';
import './ThinkingDisplay';

/**
 * Demo component for testing ToolUse and ThinkingDisplay components
 */
@customElement('tool-use-demo')
export class ToolUseDemo extends BaseComponent {
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
        display: flex;
        flex-direction: column;
        gap: var(--space-lg);
      }

      .demo-section {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .demo-header {
        background: var(--color-background-secondary);
        padding: var(--space-md);
        border-bottom: 1px solid var(--color-border);
      }

      .demo-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        color: var(--color-text-primary);
      }

      .demo-description {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin-top: var(--space-xs);
      }

      .demo-content {
        padding: var(--space-md);
      }

      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        margin-bottom: var(--space-lg);
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border);
      }

      .control-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .control-label {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .control-buttons {
        display: flex;
        gap: var(--space-xs);
      }

      .control-button {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: none;
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: all var(--transition-fast);
      }

      .control-button:hover {
        background: var(--color-primary-dark);
      }

      .control-button.active {
        background: var(--color-success);
      }

      .control-button.secondary {
        background: var(--color-background-tertiary);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
      }

      .control-button.secondary:hover {
        background: var(--color-background-secondary);
      }

      .status-indicators {
        display: flex;
        gap: var(--space-sm);
        flex-wrap: wrap;
      }

      .status-button {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
        cursor: pointer;
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        transition: all var(--transition-fast);
      }

      .status-button.pending {
        border-color: var(--color-warning);
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
      }

      .status-button.executing {
        border-color: var(--color-info);
        background: var(--color-info-light);
        color: var(--color-info-dark);
      }

      .status-button.success {
        border-color: var(--color-success);
        background: var(--color-success-light);
        color: var(--color-success-dark);
      }

      .status-button.error {
        border-color: var(--color-error);
        background: var(--color-error-light);
        color: var(--color-error-dark);
      }

      .status-button.timeout {
        border-color: var(--color-warning);
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
      }

      .status-button.active {
        box-shadow: 0 0 0 2px currentColor;
      }

      .demo-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-md);
      }

      @media (min-width: 768px) {
        .demo-grid.two-columns {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ];

  @state()
  private compact = false;

  @state()
  private currentStatus: ToolStatus = 'success';

  @state()
  private showThinking = true;

  render() {
    return html`
      <div class="demo-container">
        ${this.renderControls()}
        ${this.renderFileToolDemo()}
        ${this.renderBashToolDemo()}
        ${this.renderErrorToolDemo()}
        ${this.renderComplexToolDemo()}
        ${this.renderThinkingDemo()}
        ${this.renderCombinedDemo()}
      </div>
    `;
  }

  private renderControls() {
    return html`
      <div class="controls">
        <div class="control-group">
          <div class="control-label">Display Mode</div>
          <div class="control-buttons">
            <button 
              class="control-button ${!this.compact ? 'active' : ''}"
              @click=${() => this.compact = false}
            >
              Detailed
            </button>
            <button 
              class="control-button ${this.compact ? 'active' : ''}"
              @click=${() => this.compact = true}
            >
              Compact
            </button>
          </div>
        </div>

        <div class="control-group">
          <div class="control-label">Tool Status</div>
          <div class="status-indicators">
            ${(['pending', 'executing', 'success', 'error', 'timeout'] as ToolStatus[]).map(status => html`
              <button 
                class="status-button ${status} ${this.currentStatus === status ? 'active' : ''}"
                @click=${() => this.currentStatus = status}
              >
                ${status}
              </button>
            `)}
          </div>
        </div>

        <div class="control-group">
          <div class="control-label">Content</div>
          <div class="control-buttons">
            <button 
              class="control-button ${this.showThinking ? 'active' : 'secondary'}"
              @click=${() => this.showThinking = !this.showThinking}
            >
              Show Thinking
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderFileToolDemo() {
    const toolUse: ToolUseContent = {
      type: 'tool_use',
      id: 'tool-1',
      name: 'Write',
      input: {
        file_path: '/demo/project/src/components/Button.tsx',
        content: 'import React from "react";\n\ninterface ButtonProps {\n  children: React.ReactNode;\n  onClick?: () => void;\n  variant?: "primary" | "secondary";\n  disabled?: boolean;\n}\n\nexport const Button: React.FC<ButtonProps> = ({\n  children,\n  onClick,\n  variant = "primary",\n  disabled = false\n}) => {\n  return (\n    <button\n      className={`btn btn-${variant} ${disabled ? "disabled" : ""}`}\n      onClick={onClick}\n      disabled={disabled}\n    >\n      {children}\n    </button>\n  );\n};\n\nexport default Button;'
      }
    };

    const toolResult: ToolResultContent = {
      type: 'tool_result',
      tool_use_id: 'tool-1',
      content: 'File created successfully at /demo/project/src/components/Button.tsx',
      is_error: false
    };

    const toolDisplay: ToolUseDisplay = {
      toolUse,
      result: toolResult,
      status: this.currentStatus,
      startTime: new Date(Date.now() - 2500),
      endTime: new Date(),
      duration: 2500,
      showDetails: true,
      showResult: true
    };

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h3 class="demo-title">File Creation Tool</h3>
          <p class="demo-description">
            Tool that creates a new React component file with TypeScript interfaces
          </p>
        </div>
        <div class="demo-content">
          <tool-use
            .toolDisplay=${toolDisplay}
            .compact=${this.compact}
            .collapsible=${true}
            .defaultCollapsed=${false}
          ></tool-use>
        </div>
      </div>
    `;
  }

  private renderBashToolDemo() {
    const toolUse: ToolUseContent = {
      type: 'tool_use',
      id: 'tool-2',
      name: 'Bash',
      input: {
        command: 'npm install react react-dom @types/react @types/react-dom',
        description: 'Install React and TypeScript dependencies'
      }
    };

    const toolResult: ToolResultContent = {
      type: 'tool_result',
      tool_use_id: 'tool-2',
      content: 'added 847 packages, and audited 848 packages in 12s\n\n102 packages are looking for funding\n  run `npm fund` for details\n\nfound 0 vulnerabilities',
      is_error: false
    };

    const toolDisplay: ToolUseDisplay = {
      toolUse,
      result: toolResult,
      status: this.currentStatus,
      startTime: new Date(Date.now() - 12000),
      endTime: new Date(),
      duration: 12000,
      showDetails: true,
      showResult: true
    };

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h3 class="demo-title">Command Execution Tool</h3>
          <p class="demo-description">
            Tool that executes shell commands and captures output
          </p>
        </div>
        <div class="demo-content">
          <tool-use
            .toolDisplay=${toolDisplay}
            .compact=${this.compact}
            .collapsible=${true}
            .defaultCollapsed=${false}
          ></tool-use>
        </div>
      </div>
    `;
  }

  private renderErrorToolDemo() {
    const toolUse: ToolUseContent = {
      type: 'tool_use',
      id: 'tool-3',
      name: 'Read',
      input: {
        file_path: '/non/existent/file.txt'
      }
    };

    const toolResult: ToolResultContent = {
      type: 'tool_result',
      tool_use_id: 'tool-3',
      content: 'Error: ENOENT: no such file or directory, open \'/non/existent/file.txt\'',
      is_error: true
    };

    const toolDisplay: ToolUseDisplay = {
      toolUse,
      result: toolResult,
      status: 'error',
      startTime: new Date(Date.now() - 500),
      endTime: new Date(),
      duration: 500,
      showDetails: true,
      showResult: true
    };

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h3 class="demo-title">Error Handling</h3>
          <p class="demo-description">
            Tool that encounters an error and displays error information
          </p>
        </div>
        <div class="demo-content">
          <tool-use
            .toolDisplay=${toolDisplay}
            .compact=${this.compact}
            .collapsible=${true}
            .defaultCollapsed=${false}
          ></tool-use>
        </div>
      </div>
    `;
  }

  private renderComplexToolDemo() {
    const toolUse: ToolUseContent = {
      type: 'tool_use',
      id: 'tool-4',
      name: 'WebSearch',
      input: {
        query: 'React performance optimization best practices 2024',
        max_results: 10,
        include_domains: ['react.dev', 'web.dev', 'developer.mozilla.org'],
        filters: {
          date_range: 'past_year',
          content_type: 'article'
        }
      }
    };

    const searchResults = {
      results: [
        {
          title: 'React Performance Optimization Guide',
          url: 'https://react.dev/learn/render-and-commit#performance',
          snippet: 'Learn how to optimize React applications using memo, useMemo, useCallback...',
          relevance: 0.95
        },
        {
          title: 'Web.dev React Performance',
          url: 'https://web.dev/react/',
          snippet: 'Comprehensive guide to React performance optimization techniques...',
          relevance: 0.88
        }
      ],
      total_results: 2,
      search_time: 1.2
    };

    const toolResult: ToolResultContent = {
      type: 'tool_result',
      tool_use_id: 'tool-4',
      content: JSON.stringify(searchResults, null, 2),
      is_error: false
    };

    const toolDisplay: ToolUseDisplay = {
      toolUse,
      result: toolResult,
      status: this.currentStatus,
      startTime: new Date(Date.now() - 1200),
      endTime: new Date(),
      duration: 1200,
      showDetails: true,
      showResult: true
    };

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h3 class="demo-title">Complex Tool Parameters</h3>
          <p class="demo-description">
            Tool with nested parameters and structured JSON output
          </p>
        </div>
        <div class="demo-content">
          <tool-use
            .toolDisplay=${toolDisplay}
            .compact=${this.compact}
            .collapsible=${true}
            .defaultCollapsed=${false}
          ></tool-use>
        </div>
      </div>
    `;
  }

  private renderThinkingDemo() {
    if (!this.showThinking) return '';

    const thinkingContent: ThinkingContent = {
      type: 'thinking',
      thinking: 'The user is asking about React performance optimization. I need to consider several key areas:\n\n1. **Rendering Performance**:\n   - Use React.memo() to prevent unnecessary re-renders\n   - Implement useMemo() for expensive calculations\n   - Use useCallback() to memoize event handlers\n   - Consider virtualization for large lists\n\n2. **Bundle Size Optimization**:\n   - Code splitting with React.lazy() and Suspense\n   - Tree shaking to remove unused code\n   - Dynamic imports for route-based splitting\n\n3. **State Management**:\n   - Keep state as local as possible\n   - Use state colocation patterns\n   - Consider using useReducer for complex state\n\n4. **Network Performance**:\n   - Implement proper loading states\n   - Use React Query or SWR for data fetching\n   - Preload critical resources\n\nI should search for the most current best practices and provide concrete examples the user can implement.',
      signature: 'thinking_2024_12_10_15_30_45_abc123'
    };

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h3 class="demo-title">Thinking Content</h3>
          <p class="demo-description">
            Display of internal reasoning and thought process
          </p>
        </div>
        <div class="demo-content">
          <thinking-display
            .thinkingContent=${thinkingContent}
            .compact=${this.compact}
            .collapsible=${true}
            .defaultCollapsed=${true}
            .truncateThreshold=${300}
          ></thinking-display>
        </div>
      </div>
    `;
  }

  private renderCombinedDemo() {
    const tools = [
      {
        toolUse: {
          type: 'tool_use' as const,
          id: 'combo-1',
          name: 'Edit',
          input: { file_path: '/demo/App.tsx', old_string: 'const App = () => {', new_string: 'const App: React.FC = () => {' }
        },
        result: {
          type: 'tool_result' as const,
          tool_use_id: 'combo-1',
          content: 'File successfully updated',
          is_error: false
        },
        status: 'success' as ToolStatus,
        duration: 150
      },
      {
        toolUse: {
          type: 'tool_use' as const,
          id: 'combo-2',
          name: 'Bash',
          input: { command: 'npm run typecheck' }
        },
        result: {
          type: 'tool_result' as const,
          tool_use_id: 'combo-2',
          content: 'No TypeScript errors found.',
          is_error: false
        },
        status: 'success' as ToolStatus,
        duration: 3200
      },
      {
        toolUse: {
          type: 'tool_use' as const,
          id: 'combo-3',
          name: 'Bash',
          input: { command: 'npm run test' }
        },
        result: {
          type: 'tool_result' as const,
          tool_use_id: 'combo-3',
          content: 'Test failed: Expected 3 to equal 4',
          is_error: true
        },
        status: 'error' as ToolStatus,
        duration: 1800
      }
    ];

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h3 class="demo-title">Multiple Tool Sequence</h3>
          <p class="demo-description">
            A sequence of related tool executions showing different outcomes
          </p>
        </div>
        <div class="demo-content">
          <div class="demo-grid">
            ${tools.map(tool => html`
              <tool-use
                .toolDisplay=${{
                  toolUse: tool.toolUse,
                  result: tool.result,
                  status: tool.status,
                  duration: tool.duration,
                  showDetails: true,
                  showResult: true
                } as ToolUseDisplay}
                .compact=${this.compact}
                .collapsible=${true}
                .defaultCollapsed=${true}
              ></tool-use>
            `)}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tool-use-demo': ToolUseDemo;
  }
}