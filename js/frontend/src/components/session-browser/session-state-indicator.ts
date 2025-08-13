import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { baseStyles } from '../styles/theme';

export type SessionState = 
  | 'active' 
  | 'idle' 
  | 'processing' 
  | 'loading' 
  | 'error' 
  | 'completed' 
  | 'paused' 
  | 'connecting'
  | 'disconnected';

export interface SessionStateData {
  current: SessionState;
  previous?: SessionState;
  reason?: string;
  source?: 'user' | 'system' | 'file-change' | 'websocket' | 'api';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SessionProgressData {
  current: number;
  total: number;
  percentage: number;
  stage?: string;
  description?: string;
  estimatedTimeRemaining?: number;
}

export interface SessionStateIndicatorConfig {
  showLabel?: boolean;
  showProgress?: boolean;
  showTooltip?: boolean;
  enableAnimations?: boolean;
  enableSounds?: boolean;
  compactMode?: boolean;
  showTimestamp?: boolean;
  pulseOnChange?: boolean;
}

/**
 * Session state indicator component
 * Shows visual indicators for session states with smooth transitions and progress tracking
 */
@customElement('session-state-indicator')
export class SessionStateIndicator extends LitElement {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: var(--space-sm);
        font-family: var(--font-family);
      }

      .state-container {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        position: relative;
      }

      .state-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        position: relative;
        transition: all var(--transition-medium);
        flex-shrink: 0;
        box-shadow: 0 0 0 2px transparent;
      }

      .state-indicator.large {
        width: 16px;
        height: 16px;
      }

      .state-indicator.active {
        background: var(--color-success);
        box-shadow: 0 0 0 2px var(--color-success-light);
      }

      .state-indicator.idle {
        background: var(--color-warning);
      }

      .state-indicator.processing {
        background: var(--color-primary);
        animation: processing-pulse 2s infinite;
      }

      .state-indicator.loading {
        background: var(--color-info);
        animation: loading-spin 1s linear infinite;
      }

      .state-indicator.error {
        background: var(--color-error);
        animation: error-blink 1s infinite;
      }

      .state-indicator.completed {
        background: var(--color-success);
        position: relative;
      }

      .state-indicator.completed::after {
        content: '✓';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 8px;
        font-weight: bold;
      }

      .state-indicator.paused {
        background: var(--color-secondary);
        position: relative;
      }

      .state-indicator.paused::after {
        content: '⏸';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 6px;
      }

      .state-indicator.connecting {
        background: var(--color-info);
        animation: connecting-dots 1.5s infinite;
      }

      .state-indicator.disconnected {
        background: var(--color-text-muted);
        opacity: 0.5;
      }

      .state-indicator.pulse {
        animation: state-change-pulse 0.5s ease-out;
      }

      .state-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-medium);
        text-transform: capitalize;
        transition: color var(--transition-fast);
      }

      .state-label.active {
        color: var(--color-success);
      }

      .state-label.error {
        color: var(--color-error);
      }

      .state-label.processing {
        color: var(--color-primary);
      }

      .state-details {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        margin-top: 2px;
      }

      .progress-container {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        margin-left: var(--space-sm);
      }

      .progress-bar {
        width: 60px;
        height: 4px;
        background: var(--color-background-tertiary);
        border-radius: 2px;
        overflow: hidden;
        position: relative;
      }

      .progress-fill {
        height: 100%;
        background: var(--color-primary);
        transition: width var(--transition-medium);
        border-radius: 2px;
      }

      .progress-fill.processing {
        background: linear-gradient(
          90deg,
          var(--color-primary) 0%,
          var(--color-primary-light) 50%,
          var(--color-primary) 100%
        );
        animation: progress-shimmer 2s infinite;
      }

      .progress-text {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        font-family: var(--font-family-mono);
        min-width: 35px;
        text-align: right;
      }

      .tooltip {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: var(--color-background-inverse);
        color: var(--color-text-inverse);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius);
        font-size: var(--font-size-xs);
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity var(--transition-fast);
        z-index: 1000;
        margin-bottom: var(--space-xs);
      }

      .tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-top-color: var(--color-background-inverse);
      }

      .state-container:hover .tooltip {
        opacity: 1;
      }

      .compact .state-indicator {
        width: 8px;
        height: 8px;
      }

      .compact .state-label {
        display: none;
      }

      .compact .progress-bar {
        width: 40px;
        height: 2px;
      }

      .timestamp {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        font-family: var(--font-family-mono);
        opacity: 0.7;
      }

      .state-history {
        display: flex;
        align-items: center;
        gap: 2px;
        margin-left: var(--space-xs);
      }

      .history-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--color-text-muted);
        opacity: 0.3;
        transition: all var(--transition-fast);
      }

      .history-dot.recent {
        opacity: 0.6;
        transform: scale(1.2);
      }

      .transition-indicator {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: transparent;
        border: 2px solid var(--color-primary);
        opacity: 0;
        animation: transition-expand 0.6s ease-out;
      }

      @keyframes processing-pulse {
        0%, 100% {
          box-shadow: 0 0 0 0 rgba(var(--color-primary-rgb), 0.7);
        }
        50% {
          box-shadow: 0 0 0 8px rgba(var(--color-primary-rgb), 0);
        }
      }

      @keyframes loading-spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      @keyframes error-blink {
        0%, 50% {
          opacity: 1;
        }
        51%, 100% {
          opacity: 0.3;
        }
      }

      @keyframes connecting-dots {
        0%, 20% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
        100% {
          opacity: 1;
        }
      }

      @keyframes state-change-pulse {
        0% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.3);
        }
        100% {
          transform: scale(1);
        }
      }

      @keyframes progress-shimmer {
        0% {
          background-position: -100% 0;
        }
        100% {
          background-position: 100% 0;
        }
      }

      @keyframes transition-expand {
        0% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(0.5);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(2);
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
        }

        .state-indicator,
        .progress-fill {
          transition: none;
        }
      }

      /* Dark mode adjustments */
      @media (prefers-color-scheme: dark) {
        .tooltip {
          background: var(--color-background-secondary);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
        }
        
        .tooltip::after {
          border-top-color: var(--color-background-secondary);
        }
      }
    `,
  ];

  @property({ type: Object })
  stateData: SessionStateData = {
    current: 'idle',
    timestamp: new Date(),
  };

  @property({ type: Object })
  progressData: SessionProgressData | null = null;

  @property({ type: Object })
  config: SessionStateIndicatorConfig = {
    showLabel: true,
    showProgress: true,
    showTooltip: true,
    enableAnimations: true,
    enableSounds: false,
    compactMode: false,
    showTimestamp: false,
    pulseOnChange: true,
  };

  @state()
  private showTransition = false;

  @state()
  private stateHistory: SessionState[] = [];

  @state()
  private isPulsing = false;

  private transitionTimeout: NodeJS.Timeout | null = null;

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);

    if (changedProperties.has('stateData')) {
      const oldState = changedProperties.get('stateData');
      if (oldState && oldState.current !== this.stateData.current) {
        this.handleStateChange(oldState.current, this.stateData.current);
      }
    }
  }

  render() {
    const containerClasses = classMap({
      'state-container': true,
      'compact': this.config.compactMode || false,
    });

    const indicatorClasses = classMap({
      'state-indicator': true,
      [this.stateData.current]: true,
      'large': !this.config.compactMode,
      'pulse': this.isPulsing,
    });

    const labelClasses = classMap({
      'state-label': true,
      [this.stateData.current]: true,
    });

    return html`
      <div class="${containerClasses}">
        <div class="${indicatorClasses}">
          ${this.showTransition ? html`<div class="transition-indicator"></div>` : ''}
        </div>

        ${this.config.showLabel && !this.config.compactMode ? html`
          <div class="label-container">
            <div class="${labelClasses}">
              ${this.formatStateName(this.stateData.current)}
            </div>
            ${this.stateData.reason ? html`
              <div class="state-details">${this.stateData.reason}</div>
            ` : ''}
          </div>
        ` : ''}

        ${this.config.showProgress && this.progressData ? this.renderProgress() : ''}

        ${this.config.showTimestamp ? html`
          <div class="timestamp">${this.formatTimestamp(this.stateData.timestamp)}</div>
        ` : ''}

        ${this.config.showTooltip ? this.renderTooltip() : ''}

        ${this.stateHistory.length > 1 ? this.renderStateHistory() : ''}
      </div>
    `;
  }

  private renderProgress() {
    if (!this.progressData) return '';

    const progressClasses = classMap({
      'progress-fill': true,
      'processing': this.stateData.current === 'processing',
    });

    return html`
      <div class="progress-container">
        <div class="progress-bar">
          <div 
            class="${progressClasses}" 
            style="width: ${this.progressData.percentage}%"
          ></div>
        </div>
        <div class="progress-text">
          ${this.progressData.percentage.toFixed(0)}%
        </div>
      </div>
    `;
  }

  private renderTooltip() {
    const tooltipContent = this.generateTooltipContent();
    
    return html`
      <div class="tooltip">
        ${tooltipContent}
      </div>
    `;
  }

  private renderStateHistory() {
    return html`
      <div class="state-history">
        ${this.stateHistory.slice(-5).map((state, index) => html`
          <div class="history-dot ${index >= this.stateHistory.length - 2 ? 'recent' : ''}"></div>
        `)}
      </div>
    `;
  }

  private handleStateChange(previousState: SessionState, currentState: SessionState) {
    // Update history
    if (!this.stateHistory.includes(previousState)) {
      this.stateHistory.push(previousState);
    }

    // Show transition animation
    if (this.config.enableAnimations) {
      this.showTransition = true;
      
      if (this.transitionTimeout) {
        clearTimeout(this.transitionTimeout);
      }
      
      this.transitionTimeout = setTimeout(() => {
        this.showTransition = false;
        this.requestUpdate();
      }, 600);
    }

    // Pulse effect
    if (this.config.pulseOnChange) {
      this.isPulsing = true;
      setTimeout(() => {
        this.isPulsing = false;
        this.requestUpdate();
      }, 500);
    }

    // Play sound
    if (this.config.enableSounds) {
      this.playStateChangeSound(currentState);
    }

    // Emit state change event
    this.dispatchEvent(new CustomEvent('state-changed', {
      detail: {
        previous: previousState,
        current: currentState,
        stateData: this.stateData,
        progressData: this.progressData,
      },
      bubbles: true,
    }));
  }

  private formatStateName(state: SessionState): string {
    const stateNames: Record<SessionState, string> = {
      active: 'Active',
      idle: 'Idle',
      processing: 'Processing',
      loading: 'Loading',
      error: 'Error',
      completed: 'Completed',
      paused: 'Paused',
      connecting: 'Connecting',
      disconnected: 'Disconnected',
    };

    return stateNames[state] || state;
  }

  private formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return timestamp.toLocaleTimeString();
  }

  private generateTooltipContent(): string {
    const parts: string[] = [];

    parts.push(`Status: ${this.formatStateName(this.stateData.current)}`);

    if (this.stateData.reason) {
      parts.push(`Reason: ${this.stateData.reason}`);
    }

    if (this.stateData.source) {
      parts.push(`Source: ${this.stateData.source}`);
    }

    if (this.progressData) {
      parts.push(`Progress: ${this.progressData.percentage.toFixed(1)}%`);
      
      if (this.progressData.stage) {
        parts.push(`Stage: ${this.progressData.stage}`);
      }

      if (this.progressData.estimatedTimeRemaining) {
        const remainingMin = Math.ceil(this.progressData.estimatedTimeRemaining / 60000);
        parts.push(`ETA: ${remainingMin}m`);
      }
    }

    parts.push(`Updated: ${this.formatTimestamp(this.stateData.timestamp)}`);

    return parts.join(' • ');
  }

  private playStateChangeSound(state: SessionState) {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      // Different frequencies for different states
      const frequencies: Record<SessionState, number> = {
        active: 800,
        idle: 600,
        processing: 1000,
        loading: 900,
        error: 300,
        completed: 1200,
        paused: 500,
        connecting: 700,
        disconnected: 400,
      };

      oscillator.frequency.value = frequencies[state] || 600;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.05, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.2);
    } catch (error) {
      console.error('Failed to play state change sound:', error);
    }
  }

  // Public API

  /**
   * Update the session state
   */
  updateState(stateData: Partial<SessionStateData>) {
    const previousState = this.stateData.current;
    this.stateData = {
      ...this.stateData,
      ...stateData,
      timestamp: stateData.timestamp || new Date(),
    };

    if (stateData.current && stateData.current !== previousState) {
      this.handleStateChange(previousState, stateData.current);
    }
  }

  /**
   * Update progress data
   */
  updateProgress(progressData: Partial<SessionProgressData>) {
    this.progressData = this.progressData 
      ? { ...this.progressData, ...progressData }
      : { current: 0, total: 100, percentage: 0, ...progressData };
  }

  /**
   * Clear progress data
   */
  clearProgress() {
    this.progressData = null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SessionStateIndicatorConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current state
   */
  getCurrentState(): SessionState {
    return this.stateData.current;
  }

  /**
   * Get state history
   */
  getStateHistory(): SessionState[] {
    return [...this.stateHistory];
  }

  /**
   * Reset state history
   */
  resetHistory() {
    this.stateHistory = [];
  }

  /**
   * Force pulse animation
   */
  pulse() {
    if (!this.config.enableAnimations) return;
    
    this.isPulsing = true;
    setTimeout(() => {
      this.isPulsing = false;
      this.requestUpdate();
    }, 500);
  }

  /**
   * Check if state is considered "active"
   */
  isActiveState(): boolean {
    return ['active', 'processing', 'loading'].includes(this.stateData.current);
  }

  /**
   * Check if state indicates an error
   */
  isErrorState(): boolean {
    return this.stateData.current === 'error';
  }

  /**
   * Check if state indicates completion
   */
  isCompletedState(): boolean {
    return this.stateData.current === 'completed';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-state-indicator': SessionStateIndicator;
  }
}