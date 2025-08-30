import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";

interface QuickStartStep {
  id: string;
  title: string;
  description: string;
  action?: string;
  completed?: boolean;
  optional?: boolean;
}

/**
 * Quick start guide component for step-by-step user guidance
 * Provides contextual help for first-time users
 */
@customElement("quick-start-guide")
export class QuickStartGuide extends BaseComponent {
  @property({ type: Boolean })
  visible = false;

  @state()
  private steps: QuickStartStep[] = [
    {
      id: "install",
      title: "✅ Installation Complete",
      description: "Great! You've successfully set up Claude Code Log.",
      completed: true,
    },
    {
      id: "import-session",
      title: "📁 Import Your First Session",
      description: "Upload a Claude conversation JSONL file to get started with analysis.",
      action: "import-file",
      completed: false,
    },
    {
      id: "explore-analytics",
      title: "📊 Explore Analytics Dashboard",
      description: "View token usage patterns and conversation insights.",
      action: "view-analytics",
      completed: false,
    },
    {
      id: "customize-view",
      title: "🎨 Customize Your View",
      description: "Filter sessions, adjust timeline views, and personalize your experience.",
      action: "customize-settings",
      completed: false,
      optional: true,
    },
    {
      id: "export-data",
      title: "🔄 Export Your Analysis",
      description: "Save your insights in multiple formats for further use.",
      action: "export-data",
      completed: false,
      optional: true,
    },
  ];

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-lg);
        box-shadow: var(--shadow-md);
        max-width: 400px;
        position: relative;
      }

      :host([hidden]) {
        display: none !important;
      }

      .guide-header {
        padding: var(--spacing-lg);
        border-bottom: 1px solid var(--color-border-subtle);
        background: var(--color-surface-secondary);
        border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
      }

      .guide-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        margin: 0 0 var(--spacing-xs) 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .guide-subtitle {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: 0;
        line-height: var(--line-height-relaxed);
      }

      .progress-bar {
        margin-top: var(--spacing-sm);
        height: 4px;
        background: var(--color-border-subtle);
        border-radius: 2px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: var(--color-accent);
        transition: width 0.3s ease;
        border-radius: 2px;
      }

      .guide-content {
        max-height: 400px;
        overflow-y: auto;
        padding: var(--spacing-md);
      }

      .step-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .step-item {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-md);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-xs);
        border-radius: var(--border-radius-md);
        transition: all 0.2s ease;
        position: relative;
      }

      .step-item:hover {
        background: var(--color-surface-secondary);
      }

      .step-item.completed {
        background: var(--color-message-assistant-bg);
        border: 1px solid var(--color-message-assistant-border);
      }

      .step-item.optional {
        opacity: 0.8;
      }

      .step-indicator {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-bold);
        flex-shrink: 0;
        margin-top: 2px;
      }

      .step-indicator.completed {
        background: var(--color-message-assistant);
        color: var(--color-message-assistant-text);
      }

      .step-indicator.pending {
        background: var(--color-border);
        color: var(--color-text-muted);
        border: 2px solid var(--color-accent);
      }

      .step-indicator.optional {
        background: var(--color-surface-tertiary);
        color: var(--color-text-muted);
        border: 1px dashed var(--color-border);
      }

      .step-content {
        flex: 1;
        min-width: 0;
      }

      .step-title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0 0 var(--spacing-xs) 0;
        line-height: var(--line-height-tight);
      }

      .step-description {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: 0 0 var(--spacing-sm) 0;
        line-height: var(--line-height-relaxed);
      }

      .step-action {
        padding: var(--spacing-xs) var(--spacing-sm);
        background: var(--color-accent);
        color: var(--color-accent-text);
        border: none;
        border-radius: var(--border-radius-sm);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .step-action:hover {
        background: var(--color-accent-hover);
        transform: translateY(-1px);
        box-shadow: var(--shadow-sm);
      }

      .guide-actions {
        padding: var(--spacing-md) var(--spacing-lg);
        border-top: 1px solid var(--color-border-subtle);
        display: flex;
        gap: var(--spacing-sm);
        align-items: center;
      }

      .btn-text {
        background: none;
        border: none;
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
        cursor: pointer;
        padding: var(--spacing-xs);
        border-radius: var(--border-radius-sm);
        transition: color 0.2s ease;
      }

      .btn-text:hover {
        color: var(--color-text-primary);
        background: var(--color-surface-secondary);
      }

      .close-btn {
        position: absolute;
        top: var(--spacing-md);
        right: var(--spacing-md);
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: var(--spacing-xs);
        border-radius: var(--border-radius-sm);
        font-size: var(--font-size-lg);
        line-height: 1;
        transition: all 0.2s ease;
      }

      .close-btn:hover {
        color: var(--color-text-primary);
        background: var(--color-surface-tertiary);
      }

      .completion-celebration {
        text-align: center;
        padding: var(--spacing-xl);
      }

      .celebration-icon {
        font-size: 3rem;
        margin-bottom: var(--spacing-md);
        animation: celebrate 0.6s ease-in-out;
      }

      @keyframes celebrate {
        0% { transform: scale(0); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }

      .celebration-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        margin: 0 0 var(--spacing-sm) 0;
      }

      .celebration-message {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: 0;
        line-height: var(--line-height-relaxed);
      }

      @media (max-width: 768px) {
        :host {
          max-width: 100%;
          border-radius: 0;
        }

        .guide-header {
          border-radius: 0;
        }
      }
    `,
  ];

  private get completedSteps(): number {
    return this.steps.filter(step => step.completed && !step.optional).length;
  }

  private get totalRequiredSteps(): number {
    return this.steps.filter(step => !step.optional).length;
  }

  private get progress(): number {
    return (this.completedSteps / this.totalRequiredSteps) * 100;
  }

  private get isComplete(): boolean {
    return this.completedSteps === this.totalRequiredSteps;
  }

  private handleStepAction(stepId: string, action: string): void {
    this.emitEvent("step-action", { stepId, action });
  }

  private markStepCompleted(stepId: string): void {
    this.steps = this.steps.map(step =>
      step.id === stepId ? { ...step, completed: true } : step
    );
  }

  private closeGuide(): void {
    this.visible = false;
    this.emitEvent("guide-closed");
  }

  private resetGuide(): void {
    this.steps = this.steps.map(step => ({
      ...step,
      completed: step.id === "install"
    }));
    this.emitEvent("guide-reset");
  }

  protected safeRender(): TemplateResult {
    if (!this.visible) return html``;

    if (this.isComplete) {
      return html`
        <div class="completion-celebration">
          <div class="celebration-icon">🎉</div>
          <h3 class="celebration-title">Congratulations!</h3>
          <p class="celebration-message">
            You've completed the quick start guide. You're now ready to analyze your Claude conversations like a pro!
          </p>
        </div>
        <div class="guide-actions">
          <button class="btn-text" @click=${this.resetGuide}>Start Over</button>
          <button class="btn-text" @click=${this.closeGuide}>Close</button>
        </div>
      `;
    }

    return html`
      <div class="guide-header">
        <button class="close-btn" @click=${this.closeGuide}>×</button>
        <h2 class="guide-title">
          🚀 Quick Start Guide
        </h2>
        <p class="guide-subtitle">
          Get up and running in just a few steps
        </p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${this.progress}%"></div>
        </div>
      </div>

      <div class="guide-content">
        <ul class="step-list">
          ${this.steps.map(step => html`
            <li class="step-item ${step.completed ? 'completed' : ''} ${step.optional ? 'optional' : ''}">
              <div class="step-indicator ${step.completed ? 'completed' : step.optional ? 'optional' : 'pending'}">
                ${step.completed ? '✓' : step.optional ? '?' : this.steps.indexOf(step) + 1}
              </div>
              <div class="step-content">
                <h3 class="step-title">${step.title}</h3>
                <p class="step-description">${step.description}</p>
                ${step.action && !step.completed ? html`
                  <button 
                    class="step-action" 
                    @click=${() => this.handleStepAction(step.id, step.action!)}
                  >
                    ${step.action.replace('-', ' ')}
                  </button>
                ` : ''}
              </div>
            </li>
          `)}
        </ul>
      </div>

      <div class="guide-actions">
        <button class="btn-text" @click=${this.closeGuide}>Hide Guide</button>
        <button class="btn-text" @click=${this.resetGuide}>Reset</button>
      </div>
    `;
  }

  // Public API for parent components
  public completeStep(stepId: string): void {
    this.markStepCompleted(stepId);
  }

  public show(): void {
    this.visible = true;
  }

  public hide(): void {
    this.visible = false;
  }
}