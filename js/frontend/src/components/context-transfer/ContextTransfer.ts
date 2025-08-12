import { html, css, CSSResultGroup, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { 
  AriaRoles, 
  AriaAttributes, 
  announce, 
  generateId 
} from '../utils/accessibility';

/**
 * Context transfer options
 */
export interface ContextTransferOptions {
  includeAllEntries?: boolean;
  maxEntries?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  messageRange?: {
    start: number;
    end: number;
  };
  includeTokenUsage?: boolean;
  includeFiles?: boolean;
  includeTools?: boolean;
  includePreferences?: boolean;
  compress?: boolean;
  contextType?: 'full' | 'partial' | 'recent' | 'range';
}

/**
 * Transfer state information
 */
export interface TransferState {
  id?: string;
  packageId?: string;
  sessionId?: string;
  state: 'idle' | 'preparing' | 'ready' | 'transferring' | 'completed' | 'failed';
  progress: number;
  error?: string;
  stats?: {
    preparationTimeMs?: number;
    transferTimeMs?: number;
    packageSize?: number;
    compressionRatio?: number;
    entriesIncluded?: number;
    totalEntries?: number;
  };
}

/**
 * Context Transfer Component
 * 
 * Provides UI for users to prepare and initiate context transfers to Claude Code CLI
 */
@customElement('context-transfer')
export class ContextTransfer extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        max-width: 100%;
      }

      .context-transfer-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-lg);
        padding: var(--space-lg);
        background: var(--color-background-primary);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius-lg);
      }

      .transfer-header {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .transfer-title {
        margin: 0;
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
      }

      .transfer-description {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        line-height: 1.5;
      }

      .session-selection {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .form-label {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }

      .form-input {
        padding: var(--space-sm);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
        font-size: var(--font-size-sm);
        background: var(--color-background-secondary);
        color: var(--color-text-primary);
        transition: border-color 0.2s ease;
      }

      .form-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary-alpha-20);
      }

      .form-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .options-section {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .options-title {
        font-size: var(--font-size-md);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0;
      }

      .options-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: var(--space-md);
      }

      .option-card {
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
      }

      .checkbox-group {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        margin-bottom: var(--space-sm);
      }

      .checkbox-input {
        margin: 0;
      }

      .checkbox-label {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        cursor: pointer;
      }

      .option-description {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        margin: 0;
      }

      .range-inputs {
        display: flex;
        gap: var(--space-sm);
        align-items: center;
      }

      .range-inputs .form-input {
        flex: 1;
        min-width: 0;
      }

      .range-separator {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }

      .transfer-actions {
        display: flex;
        gap: var(--space-md);
        justify-content: flex-start;
        align-items: center;
        flex-wrap: wrap;
      }

      .transfer-button {
        padding: var(--space-sm) var(--space-md);
        border: none;
        border-radius: var(--border-radius);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .transfer-button.primary {
        background: var(--color-primary);
        color: var(--color-white);
      }

      .transfer-button.primary:hover:not(:disabled) {
        background: var(--color-primary-dark);
      }

      .transfer-button.secondary {
        background: var(--color-background-secondary);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border-light);
      }

      .transfer-button.secondary:hover:not(:disabled) {
        background: var(--color-background-tertiary);
      }

      .transfer-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .transfer-status {
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
      }

      .status-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-sm);
      }

      .status-title {
        font-size: var(--font-size-md);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0;
      }

      .status-badge {
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius-sm);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        text-transform: uppercase;
      }

      .status-badge.idle {
        background: var(--color-gray-100);
        color: var(--color-gray-600);
      }

      .status-badge.preparing {
        background: var(--color-blue-100);
        color: var(--color-blue-600);
      }

      .status-badge.ready {
        background: var(--color-green-100);
        color: var(--color-green-600);
      }

      .status-badge.transferring {
        background: var(--color-yellow-100);
        color: var(--color-yellow-600);
      }

      .status-badge.completed {
        background: var(--color-green-100);
        color: var(--color-green-600);
      }

      .status-badge.failed {
        background: var(--color-red-100);
        color: var(--color-red-600);
      }

      .progress-bar {
        width: 100%;
        height: 8px;
        background: var(--color-background-tertiary);
        border-radius: var(--border-radius-sm);
        overflow: hidden;
        margin: var(--space-sm) 0;
      }

      .progress-fill {
        height: 100%;
        background: var(--color-primary);
        transition: width 0.3s ease;
      }

      .status-details {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--space-sm);
        margin-top: var(--space-sm);
      }

      .stat-item {
        display: flex;
        justify-content: space-between;
        padding: var(--space-xs) 0;
        border-bottom: 1px solid var(--color-border-light);
      }

      .stat-label {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }

      .stat-value {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }

      .error-message {
        padding: var(--space-sm);
        background: var(--color-red-50);
        border: 1px solid var(--color-red-200);
        border-radius: var(--border-radius);
        color: var(--color-red-700);
        font-size: var(--font-size-sm);
      }

      .cli-instructions {
        margin-top: var(--space-lg);
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
      }

      .instructions-title {
        font-size: var(--font-size-md);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-sm) 0;
      }

      .code-block {
        background: var(--color-background-tertiary);
        padding: var(--space-sm);
        border-radius: var(--border-radius-sm);
        font-family: var(--font-family-mono);
        font-size: var(--font-size-xs);
        color: var(--color-text-primary);
        overflow-x: auto;
      }

      @media (max-width: 768px) {
        .context-transfer-container {
          padding: var(--space-md);
        }

        .options-grid {
          grid-template-columns: 1fr;
        }

        .transfer-actions {
          flex-direction: column;
          align-items: stretch;
        }

        .range-inputs {
          flex-direction: column;
        }
      }
    `
  ];

  /**
   * Session file path to transfer
   */
  @property({ type: String, attribute: 'session-path' })
  sessionPath = '';

  /**
   * Current transfer state
   */
  @state()
  private transferState: TransferState = {
    state: 'idle',
    progress: 0,
  };

  /**
   * Current transfer options
   */
  @state()
  private options: ContextTransferOptions = {
    includeAllEntries: true,
    includeTokenUsage: true,
    includeFiles: true,
    includeTools: true,
    includePreferences: true,
    compress: true,
    contextType: 'full',
  };

  /**
   * WebSocket connection for real-time updates
   */
  private socket?: any; // Would be properly typed with Socket.IO types

  /**
   * Form elements
   */
  @query('#session-path-input')
  private sessionPathInput?: HTMLInputElement;

  /**
   * Component ID for accessibility
   */
  private componentId = generateId('context-transfer');

  connectedCallback(): void {
    super.connectedCallback();
    this.setupWebSocket();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  /**
   * Sets up WebSocket connection for real-time transfer updates
   */
  private setupWebSocket(): void {
    // In a real implementation, this would set up Socket.IO client
    // For now, we'll simulate the connection
    console.log('Setting up WebSocket connection for context transfer');
    
    // Simulate WebSocket events
    this.socket = {
      on: (event: string, callback: (data: any) => void) => {
        console.log(`Registered listener for ${event}`);
      },
      emit: (event: string, ...args: any[]) => {
        console.log(`Emitted ${event}`, args);
      },
      disconnect: () => {
        console.log('WebSocket disconnected');
      }
    };
  }

  /**
   * Handles form submission to prepare context
   */
  private async handlePrepareContext(event: Event): Promise<void> {
    event.preventDefault();
    
    if (!this.sessionPath) {
      this.error = 'Please select a session file';
      return;
    }

    this.loading = true;
    this.error = null;
    this.transferState = { state: 'preparing', progress: 0 };

    try {
      // Emit context preparation request via WebSocket
      this.socket?.emit('context-prepare', this.sessionPath, this.options, (result: any) => {
        if (result.success) {
          this.transferState = {
            state: 'ready',
            progress: 0,
            id: result.transferId,
            packageId: result.packageId,
          };
          announce('Context prepared successfully and ready for transfer');
        } else {
          this.transferState = { state: 'failed', progress: 0, error: result.error };
          this.error = result.error;
        }
        this.loading = false;
      });

      // Listen for context preparation events
      this.socket?.on('context-prepared', (data: any) => {
        this.transferState = {
          ...this.transferState,
          state: 'ready',
          packageId: data.packageId,
          sessionId: data.sessionId,
          stats: data.stats,
        };
      });

    } catch (error) {
      this.transferState = { state: 'failed', progress: 0, error: error instanceof Error ? error.message : 'Unknown error' };
      this.error = error instanceof Error ? error.message : 'Failed to prepare context';
      this.loading = false;
    }
  }

  /**
   * Handles transfer initiation
   */
  private async handleInitiateTransfer(): Promise<void> {
    if (!this.transferState.packageId) {
      this.error = 'No package available for transfer';
      return;
    }

    this.transferState = { ...this.transferState, state: 'transferring', progress: 0 };

    try {
      // Emit transfer initiation request
      this.socket?.emit('context-transfer-initiate', this.transferState.packageId, (result: any) => {
        if (!result.success) {
          this.transferState = { ...this.transferState, state: 'failed', error: result.error };
          this.error = result.error;
        }
      });

      // Listen for transfer events
      this.socket?.on('context-transfer-progress', (data: any) => {
        this.transferState = { ...this.transferState, progress: data.progress };
      });

      this.socket?.on('context-transfer-completed', (data: any) => {
        this.transferState = { ...this.transferState, state: 'completed', progress: 100 };
        announce('Context transfer completed successfully');
      });

      this.socket?.on('context-transfer-failed', (data: any) => {
        this.transferState = { ...this.transferState, state: 'failed', error: data.error };
        this.error = data.error;
      });

    } catch (error) {
      this.transferState = { ...this.transferState, state: 'failed', error: error instanceof Error ? error.message : 'Unknown error' };
      this.error = error instanceof Error ? error.message : 'Failed to initiate transfer';
    }
  }

  /**
   * Handles option changes
   */
  private handleOptionChange(option: keyof ContextTransferOptions, value: any): void {
    this.options = { ...this.options, [option]: value };
  }

  /**
   * Handles session path input
   */
  private handleSessionPathChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.sessionPath = input.value;
  }

  /**
   * Resets the transfer state
   */
  private handleReset(): void {
    this.transferState = { state: 'idle', progress: 0 };
    this.error = null;
    this.sessionPath = '';
    if (this.sessionPathInput) {
      this.sessionPathInput.value = '';
    }
  }

  /**
   * Renders the session selection section
   */
  private renderSessionSelection() {
    return html`
      <div class="session-selection">
        <div class="form-group">
          <label for="${this.componentId}-session-path" class="form-label">
            Session File Path
          </label>
          <input
            id="${this.componentId}-session-path"
            class="form-input"
            type="text"
            placeholder="/path/to/session.jsonl"
            .value=${this.sessionPath}
            @input=${this.handleSessionPathChange}
            ?disabled=${this.loading || this.transferState.state === 'transferring'}
            aria-describedby="${this.componentId}-session-help"
          />
          <p id="${this.componentId}-session-help" class="option-description">
            Enter the full path to the Claude Code session file you want to transfer
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Renders the transfer options
   */
  private renderOptions() {
    return html`
      <div class="options-section">
        <h3 class="options-title">Transfer Options</h3>
        <div class="options-grid">
          <!-- Content Options -->
          <div class="option-card">
            <div class="checkbox-group">
              <input
                id="${this.componentId}-include-all"
                class="checkbox-input"
                type="checkbox"
                .checked=${this.options.includeAllEntries}
                @change=${(e: Event) => this.handleOptionChange('includeAllEntries', (e.target as HTMLInputElement).checked)}
                ?disabled=${this.loading}
              />
              <label for="${this.componentId}-include-all" class="checkbox-label">
                Include All Entries
              </label>
            </div>
            <p class="option-description">
              Include all conversation entries in the context transfer
            </p>
            
            ${!this.options.includeAllEntries ? html`
              <div class="form-group" style="margin-top: var(--space-sm);">
                <label class="form-label">Maximum Entries</label>
                <input
                  class="form-input"
                  type="number"
                  min="1"
                  max="10000"
                  .value=${this.options.maxEntries || 1000}
                  @input=${(e: Event) => this.handleOptionChange('maxEntries', parseInt((e.target as HTMLInputElement).value))}
                  ?disabled=${this.loading}
                />
              </div>
            ` : nothing}
          </div>

          <!-- Data Inclusions -->
          <div class="option-card">
            <div class="checkbox-group">
              <input
                id="${this.componentId}-include-tokens"
                class="checkbox-input"
                type="checkbox"
                .checked=${this.options.includeTokenUsage}
                @change=${(e: Event) => this.handleOptionChange('includeTokenUsage', (e.target as HTMLInputElement).checked)}
                ?disabled=${this.loading}
              />
              <label for="${this.componentId}-include-tokens" class="checkbox-label">
                Include Token Usage
              </label>
            </div>
            <div class="checkbox-group">
              <input
                id="${this.componentId}-include-files"
                class="checkbox-input"
                type="checkbox"
                .checked=${this.options.includeFiles}
                @change=${(e: Event) => this.handleOptionChange('includeFiles', (e.target as HTMLInputElement).checked)}
                ?disabled=${this.loading}
              />
              <label for="${this.componentId}-include-files" class="checkbox-label">
                Include File References
              </label>
            </div>
            <div class="checkbox-group">
              <input
                id="${this.componentId}-include-tools"
                class="checkbox-input"
                type="checkbox"
                .checked=${this.options.includeTools}
                @change=${(e: Event) => this.handleOptionChange('includeTools', (e.target as HTMLInputElement).checked)}
                ?disabled=${this.loading}
              />
              <label for="${this.componentId}-include-tools" class="checkbox-label">
                Include Tool Usage
              </label>
            </div>
            <p class="option-description">
              Additional context information to include
            </p>
          </div>

          <!-- Transfer Settings -->
          <div class="option-card">
            <div class="checkbox-group">
              <input
                id="${this.componentId}-compress"
                class="checkbox-input"
                type="checkbox"
                .checked=${this.options.compress}
                @change=${(e: Event) => this.handleOptionChange('compress', (e.target as HTMLInputElement).checked)}
                ?disabled=${this.loading}
              />
              <label for="${this.componentId}-compress" class="checkbox-label">
                Compress Data
              </label>
            </div>
            <p class="option-description">
              Compress the context data for faster transfer
            </p>
          </div>

          <!-- Message Range -->
          <div class="option-card">
            <label class="form-label">Message Range (Optional)</label>
            <div class="range-inputs">
              <input
                class="form-input"
                type="number"
                placeholder="Start"
                min="0"
                .value=${this.options.messageRange?.start || ''}
                @input=${(e: Event) => {
                  const start = parseInt((e.target as HTMLInputElement).value);
                  const range = this.options.messageRange || { start: 0, end: 0 };
                  this.handleOptionChange('messageRange', { ...range, start });
                }}
                ?disabled=${this.loading}
              />
              <span class="range-separator">to</span>
              <input
                class="form-input"
                type="number"
                placeholder="End"
                min="0"
                .value=${this.options.messageRange?.end || ''}
                @input=${(e: Event) => {
                  const end = parseInt((e.target as HTMLInputElement).value);
                  const range = this.options.messageRange || { start: 0, end: 0 };
                  this.handleOptionChange('messageRange', { ...range, end });
                }}
                ?disabled=${this.loading}
              />
            </div>
            <p class="option-description">
              Transfer only a specific range of messages
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the transfer status
   */
  private renderTransferStatus() {
    if (this.transferState.state === 'idle') {
      return nothing;
    }

    return html`
      <div class="transfer-status">
        <div class="status-header">
          <h3 class="status-title">Transfer Status</h3>
          <span class="status-badge ${this.transferState.state}">${this.transferState.state}</span>
        </div>

        ${this.transferState.state === 'transferring' || this.transferState.progress > 0 ? html`
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${this.transferState.progress}%"></div>
          </div>
        ` : nothing}

        <div class="status-details">
          ${this.transferState.state === 'preparing' ? 'Analyzing session and preparing context...' : ''}
          ${this.transferState.state === 'ready' ? 'Context prepared and ready for transfer to CLI' : ''}
          ${this.transferState.state === 'transferring' ? `Transferring context... ${Math.round(this.transferState.progress)}%` : ''}
          ${this.transferState.state === 'completed' ? 'Context transfer completed successfully!' : ''}
          ${this.transferState.state === 'failed' ? `Transfer failed: ${this.transferState.error}` : ''}
        </div>

        ${this.transferState.stats ? html`
          <div class="stats-grid">
            ${this.transferState.stats.entriesIncluded ? html`
              <div class="stat-item">
                <span class="stat-label">Entries Included</span>
                <span class="stat-value">${this.transferState.stats.entriesIncluded}</span>
              </div>
            ` : nothing}
            ${this.transferState.stats.packageSize ? html`
              <div class="stat-item">
                <span class="stat-label">Package Size</span>
                <span class="stat-value">${this.formatBytes(this.transferState.stats.packageSize)}</span>
              </div>
            ` : nothing}
            ${this.transferState.stats.preparationTimeMs ? html`
              <div class="stat-item">
                <span class="stat-label">Preparation Time</span>
                <span class="stat-value">${this.transferState.stats.preparationTimeMs}ms</span>
              </div>
            ` : nothing}
          </div>
        ` : nothing}

        ${this.transferState.state === 'ready' ? this.renderCLIInstructions() : nothing}
      </div>
    `;
  }

  /**
   * Renders CLI usage instructions
   */
  private renderCLIInstructions() {
    return html`
      <div class="cli-instructions">
        <h4 class="instructions-title">Use in Claude Code CLI</h4>
        <p>Your context is ready! Start Claude Code CLI and run:</p>
        <div class="code-block">
          claude --load-context ${this.transferState.packageId}
        </div>
      </div>
    `;
  }

  /**
   * Renders the action buttons
   */
  private renderActions() {
    const canPrepare = this.sessionPath && this.transferState.state === 'idle';
    const canTransfer = this.transferState.state === 'ready';
    const canReset = this.transferState.state !== 'transferring' && this.transferState.state !== 'preparing';

    return html`
      <div class="transfer-actions">
        ${canPrepare ? html`
          <button
            class="transfer-button primary"
            @click=${this.handlePrepareContext}
            ?disabled=${this.loading}
            aria-describedby="${this.componentId}-prepare-help"
          >
            ${this.loading ? 'Preparing...' : 'Prepare Context'}
          </button>
          <p id="${this.componentId}-prepare-help" class="option-description">
            Analyze the session and prepare context for transfer
          </p>
        ` : nothing}

        ${canTransfer ? html`
          <button
            class="transfer-button primary"
            @click=${this.handleInitiateTransfer}
            aria-describedby="${this.componentId}-transfer-help"
          >
            Initiate Transfer
          </button>
          <p id="${this.componentId}-transfer-help" class="option-description">
            Start transferring context to Claude Code CLI
          </p>
        ` : nothing}

        ${canReset ? html`
          <button
            class="transfer-button secondary"
            @click=${this.handleReset}
          >
            Reset
          </button>
        ` : nothing}
      </div>
    `;
  }

  /**
   * Formats bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  render() {
    const containerClasses = {
      'context-transfer-container': true,
      'loading': this.loading,
    };

    return html`
      <div class=${classMap(containerClasses)} role="main" aria-labelledby="${this.componentId}-title">
        <div class="transfer-header">
          <h2 id="${this.componentId}-title" class="transfer-title">
            Context Transfer to Claude Code CLI
          </h2>
          <p class="transfer-description">
            Prepare and transfer your session context to Claude Code CLI for seamless continuation of your work.
          </p>
        </div>

        ${this.renderSessionSelection()}
        ${this.renderOptions()}
        ${this.error ? html`<div class="error-message" role="alert">${this.error}</div>` : nothing}
        ${this.renderTransferStatus()}
        ${this.renderActions()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'context-transfer': ContextTransfer;
  }
}