import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";

/**
 * Welcome screen component for user onboarding
 * Provides introduction and guides users to their first steps
 */
@customElement("welcome-screen")
export class WelcomeScreen extends BaseComponent {
  @property({ type: Boolean })
  visible = true;

  @property({ type: String })
  userName?: string;

  @state()
  private currentStep = 0;

  private steps = [
    {
      title: "Welcome to Claude Code Log",
      description: "Analyze and explore your Claude conversation transcripts with powerful visualization tools.",
      icon: "🎯",
    },
    {
      title: "Import Your Sessions",
      description: "Upload your Claude conversation JSONL files to start analyzing your interactions.",
      icon: "📁",
    },
    {
      title: "Explore Analytics",
      description: "View token usage patterns, session timelines, and detailed conversation insights.",
      icon: "📊",
    },
    {
      title: "Export & Share",
      description: "Export your analysis data in multiple formats for reports and further analysis.",
      icon: "🔄",
    },
  ];

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, var(--color-surface-secondary) 0%, var(--color-surface) 100%);
        z-index: 1000;
        overflow: auto;
      }

      :host([hidden]) {
        display: none !important;
      }

      .welcome-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: var(--spacing-xl);
        text-align: center;
      }

      .welcome-content {
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-xl);
        max-width: 600px;
        box-shadow: var(--shadow-lg);
        border: 1px solid var(--color-border-subtle);
      }

      .step-indicator {
        display: flex;
        justify-content: center;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-xl);
      }

      .step-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--color-border);
        transition: all 0.3s ease;
      }

      .step-dot.active {
        background: var(--color-accent);
        transform: scale(1.2);
      }

      .step-content {
        min-height: 300px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }

      .step-icon {
        font-size: 4rem;
        margin-bottom: var(--spacing-lg);
        animation: bounce 2s ease-in-out infinite;
      }

      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% {
          transform: translateY(0);
        }
        40% {
          transform: translateY(-10px);
        }
        60% {
          transform: translateY(-5px);
        }
      }

      .step-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        margin-bottom: var(--spacing-md);
        line-height: var(--line-height-tight);
      }

      .step-description {
        font-size: var(--font-size-lg);
        color: var(--color-text-secondary);
        line-height: var(--line-height-relaxed);
        margin-bottom: var(--spacing-xl);
      }

      .greeting {
        font-size: var(--font-size-lg);
        color: var(--color-text-secondary);
        margin-bottom: var(--spacing-lg);
      }

      .actions {
        display: flex;
        gap: var(--spacing-md);
        justify-content: center;
        align-items: center;
      }

      .btn {
        padding: var(--spacing-md) var(--spacing-lg);
        border: none;
        border-radius: var(--border-radius-md);
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-primary {
        background: var(--color-accent);
        color: var(--color-accent-text);
      }

      .btn-primary:hover:not(:disabled) {
        background: var(--color-accent-hover);
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
      }

      .btn-secondary {
        background: transparent;
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
      }

      .btn-secondary:hover:not(:disabled) {
        background: var(--color-surface-secondary);
        color: var(--color-text-primary);
        border-color: var(--color-border-hover);
      }

      .skip-link {
        position: absolute;
        top: var(--spacing-lg);
        right: var(--spacing-lg);
        color: var(--color-text-muted);
        text-decoration: none;
        font-size: var(--font-size-sm);
        transition: color 0.2s ease;
      }

      .skip-link:hover {
        color: var(--color-text-primary);
        text-decoration: underline;
      }

      @media (max-width: 768px) {
        .welcome-container {
          padding: var(--spacing-lg);
        }

        .welcome-content {
          padding: var(--spacing-lg);
        }

        .actions {
          flex-direction: column;
        }

        .btn {
          width: 100%;
          justify-content: center;
        }
      }
    `,
  ];

  private nextStep(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
    } else {
      this.startApp();
    }
  }

  private prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  private startApp(): void {
    this.emitEvent("onboarding-complete");
    this.visible = false;
  }

  private skipOnboarding(): void {
    this.emitEvent("onboarding-skipped");
    this.visible = false;
  }

  override render(): TemplateResult {
    if (!this.visible) return html``;

    const step = this.steps[this.currentStep];
    const isLastStep = this.currentStep === this.steps.length - 1;

    return html`
      <div class="welcome-container">
        <a href="#" class="skip-link" @click=${this.skipOnboarding}>
          Skip Tour
        </a>

        <div class="welcome-content">
          ${this.userName ? html`
            <div class="greeting">
              Hello${this.userName ? ` ${this.userName}` : ''}! 👋
            </div>
          ` : ''}

          <div class="step-indicator">
            ${this.steps.map((_, index) => html`
              <div class="step-dot ${index === this.currentStep ? 'active' : ''}"></div>
            `)}
          </div>

          <div class="step-content">
            <div class="step-icon">${step.icon}</div>
            <h1 class="step-title">${step.title}</h1>
            <p class="step-description">${step.description}</p>
          </div>

          <div class="actions">
            <button 
              class="btn btn-secondary" 
              @click=${this.prevStep}
              ?disabled=${this.currentStep === 0}
            >
              ← Previous
            </button>
            
            <button 
              class="btn btn-primary" 
              @click=${this.nextStep}
            >
              ${isLastStep ? "Get Started! 🚀" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}