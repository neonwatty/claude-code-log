import { html, css, CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import './ContextTransfer';

/**
 * Demo component for Context Transfer
 * Shows the context transfer component in various states
 */
@customElement('context-transfer-demo')
export class ContextTransferDemo extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        max-width: 100%;
        padding: var(--space-lg);
      }

      .demo-container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .demo-header {
        margin-bottom: var(--space-xl);
        text-align: center;
      }

      .demo-title {
        font-size: var(--font-size-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-md) 0;
      }

      .demo-description {
        font-size: var(--font-size-lg);
        color: var(--color-text-secondary);
        line-height: 1.6;
        margin: 0;
      }

      .demo-section {
        margin-bottom: var(--space-xl);
        padding: var(--space-lg);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius-lg);
        border: 1px solid var(--color-border-light);
      }

      .section-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-md) 0;
      }

      .section-description {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: 0 0 var(--space-lg) 0;
        line-height: 1.5;
      }

      .demo-controls {
        display: flex;
        gap: var(--space-md);
        margin-bottom: var(--space-lg);
        flex-wrap: wrap;
      }

      .demo-button {
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
        background: var(--color-background-primary);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .demo-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .demo-button.active {
        background: var(--color-primary);
        color: var(--color-white);
        border-color: var(--color-primary);
      }

      .context-transfer {
        width: 100%;
      }

      .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: var(--space-lg);
        margin-top: var(--space-xl);
      }

      .feature-card {
        padding: var(--space-lg);
        background: var(--color-background-primary);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
      }

      .feature-icon {
        font-size: var(--font-size-2xl);
        margin-bottom: var(--space-md);
      }

      .feature-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-sm) 0;
      }

      .feature-description {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        line-height: 1.5;
        margin: 0;
      }

      @media (max-width: 768px) {
        :host {
          padding: var(--space-md);
        }

        .demo-controls {
          flex-direction: column;
        }

        .features-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ];

  @state()
  private selectedDemo = 'basic';

  private demos = [
    { id: 'basic', label: 'Basic Usage', sessionPath: '' },
    { id: 'with-path', label: 'With Session Path', sessionPath: '/Users/example/Documents/claude-sessions/session-2024-01-15.jsonl' },
    { id: 'project-context', label: 'Project Context', sessionPath: '/Users/example/Projects/my-app/claude-sessions/latest.jsonl' },
  ];

  private handleDemoChange(demoId: string): void {
    this.selectedDemo = demoId;
  }

  private renderDemoControls() {
    return html`
      <div class="demo-controls">
        ${this.demos.map(demo => html`
          <button
            class="demo-button ${demo.id === this.selectedDemo ? 'active' : ''}"
            @click=${() => this.handleDemoChange(demo.id)}
          >
            ${demo.label}
          </button>
        `)}
      </div>
    `;
  }

  private renderContextTransfer() {
    const selectedDemo = this.demos.find(d => d.id === this.selectedDemo);
    const sessionPath = selectedDemo?.sessionPath || '';

    return html`
      <context-transfer
        .sessionPath=${sessionPath}
      ></context-transfer>
    `;
  }

  private renderFeatures() {
    return html`
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">🔄</div>
          <h3 class="feature-title">Seamless Context Transfer</h3>
          <p class="feature-description">
            Transfer your complete session context to Claude Code CLI with just a few clicks.
            Includes conversation history, file references, and tool usage.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3 class="feature-title">Real-time Progress</h3>
          <p class="feature-description">
            Monitor the context preparation and transfer process with real-time progress updates
            and status notifications via WebSocket connections.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🎛️</div>
          <h3 class="feature-title">Flexible Options</h3>
          <p class="feature-description">
            Customize what gets transferred with granular options for content inclusion,
            data compression, and context scope.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🔒</div>
          <h3 class="feature-title">Secure & Reliable</h3>
          <p class="feature-description">
            Context packages are encrypted, checksummed, and have automatic expiration
            to ensure security and data integrity.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3 class="feature-title">Transfer Analytics</h3>
          <p class="feature-description">
            Get detailed statistics about your context transfer including package size,
            compression ratios, and transfer performance metrics.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🎯</div>
          <h3 class="feature-title">CLI Integration</h3>
          <p class="feature-description">
            Direct integration with Claude Code CLI for immediate context loading
            with simple command-line instructions.
          </p>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="demo-container">
        <div class="demo-header">
          <h1 class="demo-title">Context Transfer Component</h1>
          <p class="demo-description">
            Interactive component for transferring Claude Code session context to the CLI.
            Try different scenarios and see how the component adapts to various states.
          </p>
        </div>

        <div class="demo-section">
          <h2 class="section-title">Interactive Demo</h2>
          <p class="section-description">
            Select different demo scenarios to see how the context transfer component
            behaves with various session paths and configurations.
          </p>
          
          ${this.renderDemoControls()}
          ${this.renderContextTransfer()}
        </div>

        <div class="demo-section">
          <h2 class="section-title">Key Features</h2>
          <p class="section-description">
            The Context Transfer component provides a comprehensive solution for moving
            your Claude Code session context between the web interface and CLI.
          </p>
          ${this.renderFeatures()}
        </div>

        <div class="demo-section">
          <h2 class="section-title">Usage Instructions</h2>
          <p class="section-description">
            To use the context transfer in your application:
          </p>
          <ol style="color: var(--color-text-secondary); font-size: var(--font-size-sm); line-height: 1.6;">
            <li>Select the session file you want to transfer</li>
            <li>Configure transfer options based on your needs</li>
            <li>Click "Prepare Context" to analyze and package the session</li>
            <li>Once ready, initiate the transfer to make it available to Claude Code CLI</li>
            <li>Use the provided CLI command to load the context in your terminal</li>
          </ol>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'context-transfer-demo': ContextTransferDemo;
  }
}