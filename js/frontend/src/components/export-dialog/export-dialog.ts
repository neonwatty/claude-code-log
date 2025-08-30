import { html, css, TemplateResult, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import type {
  IExportRequest,
  IExportResult,
  IExportStatus,
  IExportProgress,
  ExportFormat,
  IExportOptions,
} from "../../../../shared/src/schemas/export";

export interface ExportDialogState {
  isOpen: boolean;
  step: "configure" | "progress" | "complete" | "error";
  activeFormat: ExportFormat;
  showAdvancedOptions: boolean;
}

export interface ExportConfiguration {
  format: ExportFormat;
  includeMetadata: boolean;
  includeThinking: boolean;
  includeToolUse: boolean;
  includeImages: boolean;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  messageTypes: Set<string>;
  compressionLevel: number;
}

export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: Partial<ExportConfiguration>;
}

@customElement("export-dialog")
export class ExportDialog extends BaseComponent {
  @property({ type: Boolean, reflect: true })
  open = false;

  @property({ type: String })
  sessionId?: string;

  @property({ type: Array })
  sessionIds?: string[];

  @property({ type: String })
  projectName?: string;

  @state()
  private dialogState: ExportDialogState = {
    isOpen: false,
    step: "configure",
    activeFormat: "html",
    showAdvancedOptions: false,
  };

  @state()
  private exportConfig: ExportConfiguration = {
    format: "html",
    includeMetadata: true,
    includeThinking: true,
    includeToolUse: true,
    includeImages: true,
    messageTypes: new Set(["user", "assistant"]),
    compressionLevel: 0,
  };

  @state()
  private currentExport?: IExportStatus;

  @state()
  private exportProgress: IExportProgress = {
    stage: "preparing",
    progress: 0,
    message: "Preparing export...",
  };

  private pollInterval?: NodeJS.Timeout;

  static override styles = [
    BaseComponent.styles,
    css`
      :host {
        --dialog-width: 600px;
        --dialog-max-height: 80vh;
        --border-radius: 12px;
        --box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      }

      .dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease, visibility 0.2s ease;
      }

      :host([open]) .dialog-overlay {
        opacity: 1;
        visibility: visible;
      }

      .dialog {
        background: var(--color-bg);
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow);
        width: min(var(--dialog-width), 90vw);
        max-height: var(--dialog-max-height);
        overflow: hidden;
        transform: scale(0.95);
        transition: transform 0.2s ease;
      }

      :host([open]) .dialog {
        transform: scale(1);
      }

      .dialog-header {
        padding: 24px 24px 0;
        border-bottom: 1px solid var(--color-border);
        margin-bottom: 24px;
      }

      .dialog-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--color-text);
        margin: 0 0 8px 0;
      }

      .dialog-subtitle {
        color: var(--color-text-muted);
        font-size: 0.875rem;
        margin: 0;
      }

      .dialog-content {
        padding: 0 24px;
        overflow-y: auto;
        max-height: calc(var(--dialog-max-height) - 200px);
      }

      .dialog-footer {
        padding: 24px;
        border-top: 1px solid var(--color-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }

      .close-button {
        position: absolute;
        top: 16px;
        right: 16px;
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .close-button:hover {
        background: var(--color-hover);
        color: var(--color-text);
      }

      /* Format Selection */
      .format-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }

      .format-option {
        border: 2px solid var(--color-border);
        border-radius: 8px;
        padding: 16px 12px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        background: var(--color-bg);
        position: relative;
      }

      .format-option:hover {
        border-color: var(--color-primary);
        background: var(--color-hover);
      }

      .format-option.active {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
      }

      .format-icon {
        font-size: 2rem;
        margin-bottom: 8px;
        display: block;
      }

      .format-name {
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: 4px;
      }

      .format-description {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        line-height: 1.3;
      }

      /* Options */
      .options-section {
        margin-bottom: 24px;
      }

      .section-title {
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .toggle-advanced {
        background: none;
        border: none;
        color: var(--color-primary);
        cursor: pointer;
        font-size: 0.875rem;
        padding: 4px;
        border-radius: 4px;
        transition: background 0.2s ease;
      }

      .toggle-advanced:hover {
        background: var(--color-primary-light);
      }

      .checkbox-group {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .checkbox-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px;
        border-radius: 6px;
        transition: background 0.2s ease;
      }

      .checkbox-item:hover {
        background: var(--color-hover);
      }

      .checkbox-item input[type="checkbox"] {
        margin: 2px 0 0 0;
      }

      .checkbox-label {
        flex: 1;
      }

      .checkbox-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text);
        margin-bottom: 2px;
      }

      .checkbox-description {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        line-height: 1.3;
      }

      /* Advanced Options */
      .advanced-options {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--color-border);
      }

      .date-range {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 16px;
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text);
      }

      .form-input {
        padding: 8px 12px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.875rem;
        transition: border-color 0.2s ease;
      }

      .form-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary-light);
      }

      /* Progress View */
      .progress-container {
        text-align: center;
        padding: 40px 20px;
      }

      .progress-icon {
        font-size: 3rem;
        color: var(--color-primary);
        margin-bottom: 16px;
        animation: spin 2s linear infinite;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .progress-bar-container {
        width: 100%;
        height: 8px;
        background: var(--color-border);
        border-radius: 4px;
        overflow: hidden;
        margin: 16px 0;
      }

      .progress-bar {
        height: 100%;
        background: var(--color-primary);
        transition: width 0.3s ease;
        border-radius: 4px;
      }

      .progress-text {
        font-size: 0.875rem;
        color: var(--color-text-muted);
        margin-top: 8px;
      }

      .progress-details {
        margin-top: 16px;
        padding: 16px;
        background: var(--color-hover);
        border-radius: 8px;
        text-align: left;
      }

      /* Complete View */
      .complete-container {
        text-align: center;
        padding: 40px 20px;
      }

      .success-icon {
        font-size: 4rem;
        color: var(--color-success);
        margin-bottom: 16px;
      }

      .download-info {
        background: var(--color-hover);
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        text-align: left;
      }

      .download-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        font-size: 0.875rem;
        color: var(--color-text-muted);
      }

      /* Buttons */
      .btn {
        padding: 10px 20px;
        border-radius: 6px;
        border: 1px solid transparent;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .btn-primary {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .btn-primary:hover {
        background: var(--color-primary-dark);
        border-color: var(--color-primary-dark);
      }

      .btn-secondary {
        background: var(--color-bg);
        color: var(--color-text);
        border-color: var(--color-border);
      }

      .btn-secondary:hover {
        background: var(--color-hover);
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Error state */
      .error-container {
        text-align: center;
        padding: 40px 20px;
      }

      .error-icon {
        font-size: 3rem;
        color: var(--color-error);
        margin-bottom: 16px;
      }

      .error-message {
        color: var(--color-error);
        font-weight: 500;
        margin-bottom: 8px;
      }

      .error-details {
        color: var(--color-text-muted);
        font-size: 0.875rem;
        margin-bottom: 20px;
      }
    `,
  ];

  private readonly formatPresets: ExportPreset[] = [
    {
      id: "html",
      name: "HTML",
      description: "Interactive web page with full styling",
      icon: "🌐",
      config: { format: "html" },
    },
    {
      id: "markdown",
      name: "Markdown",
      description: "Portable text format for documentation",
      icon: "📝",
      config: { format: "markdown" },
    },
    {
      id: "json",
      name: "JSON",
      description: "Structured data for analysis",
      icon: "🔧",
      config: { format: "json" },
    },
    {
      id: "pdf",
      name: "PDF",
      description: "Professional document for sharing",
      icon: "📄",
      config: { format: "pdf" },
    },
  ];

  protected safeRender(): TemplateResult {
    if (!this.open) return html``;

    return html`
      <div class="dialog-overlay" @click=${this.handleOverlayClick}>
        <div class="dialog" @click=${this.stopPropagation}>
          <button class="close-button" @click=${this.close}>✕</button>
          
          <div class="dialog-header">
            <h2 class="dialog-title">Export Sessions</h2>
            <p class="dialog-subtitle">
              ${this.getSubtitle()}
            </p>
          </div>

          <div class="dialog-content">
            ${this.renderContent()}
          </div>

          <div class="dialog-footer">
            ${this.renderFooter()}
          </div>
        </div>
      </div>
    `;
  }

  private renderContent(): TemplateResult {
    switch (this.dialogState.step) {
      case "configure":
        return this.renderConfigureStep();
      case "progress":
        return this.renderProgressStep();
      case "complete":
        return this.renderCompleteStep();
      case "error":
        return this.renderErrorStep();
      default:
        return html``;
    }
  }

  private renderConfigureStep(): TemplateResult {
    return html`
      <!-- Format Selection -->
      <div class="options-section">
        <h3 class="section-title">Export Format</h3>
        <div class="format-grid">
          ${this.formatPresets.map(preset => html`
            <div
              class="format-option ${preset.id === this.exportConfig.format ? 'active' : ''}"
              @click=${() => this.selectFormat(preset.config.format!)}
            >
              <span class="format-icon">${preset.icon}</span>
              <div class="format-name">${preset.name}</div>
              <div class="format-description">${preset.description}</div>
            </div>
          `)}
        </div>
      </div>

      <!-- Basic Options -->
      <div class="options-section">
        <h3 class="section-title">
          Include Content
          <button 
            class="toggle-advanced" 
            @click=${this.toggleAdvancedOptions}
          >
            ${this.dialogState.showAdvancedOptions ? 'Hide Advanced' : 'Show Advanced'}
          </button>
        </h3>
        
        <div class="checkbox-group">
          <div class="checkbox-item">
            <input 
              type="checkbox" 
              id="include-metadata" 
              .checked=${this.exportConfig.includeMetadata}
              @change=${this.handleMetadataChange}
            >
            <label class="checkbox-label" for="include-metadata">
              <div class="checkbox-title">Metadata</div>
              <div class="checkbox-description">Timestamps, token usage, session info</div>
            </label>
          </div>

          <div class="checkbox-item">
            <input 
              type="checkbox" 
              id="include-thinking" 
              .checked=${this.exportConfig.includeThinking}
              @change=${this.handleThinkingChange}
            >
            <label class="checkbox-label" for="include-thinking">
              <div class="checkbox-title">Thinking</div>
              <div class="checkbox-description">Claude's internal reasoning</div>
            </label>
          </div>

          <div class="checkbox-item">
            <input 
              type="checkbox" 
              id="include-tool-use" 
              .checked=${this.exportConfig.includeToolUse}
              @change=${this.handleToolUseChange}
            >
            <label class="checkbox-label" for="include-tool-use">
              <div class="checkbox-title">Tool Usage</div>
              <div class="checkbox-description">Tool calls and results</div>
            </label>
          </div>

          <div class="checkbox-item">
            <input 
              type="checkbox" 
              id="include-images" 
              .checked=${this.exportConfig.includeImages}
              @change=${this.handleImagesChange}
            >
            <label class="checkbox-label" for="include-images">
              <div class="checkbox-title">Images</div>
              <div class="checkbox-description">Embedded images and screenshots</div>
            </label>
          </div>
        </div>

        ${this.dialogState.showAdvancedOptions ? this.renderAdvancedOptions() : ''}
      </div>
    `;
  }

  private renderAdvancedOptions(): TemplateResult {
    return html`
      <div class="advanced-options">
        <!-- Date Range -->
        <div class="date-range">
          <div class="form-field">
            <label class="form-label" for="start-date">Start Date</label>
            <input 
              type="datetime-local" 
              id="start-date" 
              class="form-input"
              .value=${this.exportConfig.dateRange?.startDate || ''}
              @change=${this.handleStartDateChange}
            >
          </div>
          <div class="form-field">
            <label class="form-label" for="end-date">End Date</label>
            <input 
              type="datetime-local" 
              id="end-date" 
              class="form-input"
              .value=${this.exportConfig.dateRange?.endDate || ''}
              @change=${this.handleEndDateChange}
            >
          </div>
        </div>

        <!-- Compression Level (for JSON) -->
        ${this.exportConfig.format === 'json' ? html`
          <div class="form-field">
            <label class="form-label" for="compression">Compression Level</label>
            <select 
              id="compression" 
              class="form-input"
              .value=${this.exportConfig.compressionLevel.toString()}
              @change=${this.handleCompressionChange}
            >
              <option value="0">None (Pretty-printed)</option>
              <option value="1">Minimal (Compressed)</option>
            </select>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderProgressStep(): TemplateResult {
    return html`
      <div class="progress-container">
        <div class="progress-icon">⚙️</div>
        <h3>Exporting Your Data</h3>
        <div class="progress-bar-container">
          <div 
            class="progress-bar" 
            style="width: ${this.exportProgress.progress}%"
          ></div>
        </div>
        <div class="progress-text">${this.exportProgress.progress}% complete</div>
        
        ${this.exportProgress.message ? html`
          <div class="progress-details">
            <strong>Status:</strong> ${this.exportProgress.message}<br>
            ${this.exportProgress.processedItems !== undefined && this.exportProgress.totalItems !== undefined ? html`
              <strong>Progress:</strong> ${this.exportProgress.processedItems} / ${this.exportProgress.totalItems} items<br>
            ` : ''}
            ${this.exportProgress.bytesProcessed ? html`
              <strong>Data processed:</strong> ${this.formatBytes(this.exportProgress.bytesProcessed)}<br>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderCompleteStep(): TemplateResult {
    if (!this.currentExport?.result) return html``;

    const result = this.currentExport.result;
    return html`
      <div class="complete-container">
        <div class="success-icon">✅</div>
        <h3>Export Complete!</h3>
        <p>Your ${result.format.toUpperCase()} export has been generated successfully.</p>
        
        <div class="download-info">
          <div class="download-meta">
            <div><strong>Format:</strong> ${result.format.toUpperCase()}</div>
            <div><strong>Size:</strong> ${this.formatBytes(result.size)}</div>
            <div><strong>Sessions:</strong> ${result.metadata.sessionCount}</div>
            <div><strong>Messages:</strong> ${result.metadata.messageCount}</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderErrorStep(): TemplateResult {
    return html`
      <div class="error-container">
        <div class="error-icon">❌</div>
        <h3 class="error-message">Export Failed</h3>
        <p class="error-details">
          ${this.currentExport?.error || "An unexpected error occurred during export."}
        </p>
      </div>
    `;
  }

  private renderFooter(): TemplateResult {
    switch (this.dialogState.step) {
      case "configure":
        return html`
          <button class="btn btn-secondary" @click=${this.close}>Cancel</button>
          <button class="btn btn-primary" @click=${this.startExport}>
            Start Export
          </button>
        `;
      
      case "progress":
        return html`
          <button class="btn btn-secondary" @click=${this.cancelExport}>Cancel</button>
          <div>Exporting...</div>
        `;
      
      case "complete":
        return html`
          <button class="btn btn-secondary" @click=${this.close}>Close</button>
          <button class="btn btn-primary" @click=${this.downloadExport}>
            📥 Download
          </button>
        `;
      
      case "error":
        return html`
          <button class="btn btn-secondary" @click=${this.close}>Close</button>
          <button class="btn btn-primary" @click=${this.retryExport}>
            Try Again
          </button>
        `;
      
      default:
        return html``;
    }
  }

  private getSubtitle(): string {
    if (this.sessionId) {
      return `Exporting single session: ${this.sessionId}`;
    } else if (this.sessionIds?.length) {
      return `Exporting ${this.sessionIds.length} selected sessions`;
    } else if (this.projectName) {
      return `Exporting all sessions from project: ${this.projectName}`;
    }
    return "Configure your export options below";
  }

  // Event Handlers
  private handleOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeDialog();
    }
  }

  private stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  private selectFormat(format: ExportFormat): void {
    this.exportConfig = { ...this.exportConfig, format };
    this.dialogState = { ...this.dialogState, activeFormat: format };
    this.requestUpdate();
  }

  private toggleAdvancedOptions(): void {
    this.dialogState = { 
      ...this.dialogState, 
      showAdvancedOptions: !this.dialogState.showAdvancedOptions 
    };
  }

  private handleMetadataChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.exportConfig = { ...this.exportConfig, includeMetadata: target.checked };
  }

  private handleThinkingChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.exportConfig = { ...this.exportConfig, includeThinking: target.checked };
  }

  private handleToolUseChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.exportConfig = { ...this.exportConfig, includeToolUse: target.checked };
  }

  private handleImagesChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.exportConfig = { ...this.exportConfig, includeImages: target.checked };
  }

  private handleStartDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.exportConfig = {
      ...this.exportConfig,
      dateRange: {
        ...this.exportConfig.dateRange,
        startDate: target.value,
      },
    };
  }

  private handleEndDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.exportConfig = {
      ...this.exportConfig,
      dateRange: {
        ...this.exportConfig.dateRange,
        endDate: target.value,
      },
    };
  }

  private handleCompressionChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.exportConfig = { 
      ...this.exportConfig, 
      compressionLevel: parseInt(target.value, 10) 
    };
  }

  // Export Operations
  private async startExport(): Promise<void> {
    this.dialogState = { ...this.dialogState, step: "progress" };
    this.exportProgress = {
      stage: "preparing",
      progress: 0,
      message: "Preparing export...",
    };

    try {
      const exportOptions: IExportOptions = {
        format: this.exportConfig.format,
        includeMetadata: this.exportConfig.includeMetadata,
        includeThinking: this.exportConfig.includeThinking,
        includeToolUse: this.exportConfig.includeToolUse,
        includeImages: this.exportConfig.includeImages,
        dateRange: this.exportConfig.dateRange,
        messageTypes: Array.from(this.exportConfig.messageTypes) as any,
        compressionLevel: this.exportConfig.compressionLevel,
      };

      const exportRequest: IExportRequest = {
        sessionId: this.sessionId,
        sessionIds: this.sessionIds,
        projectName: this.projectName,
        options: exportOptions,
      };

      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(exportRequest),
      });

      const result = await response.json();

      if (result.success) {
        this.currentExport = {
          exportId: result.data.exportId,
          status: "processing",
          progress: this.exportProgress,
          createdAt: new Date().toISOString(),
        };
        this.startPolling();
      } else {
        throw new Error(result.error || "Failed to start export");
      }
    } catch (error) {
      console.error("Export failed:", error);
      this.currentExport = {
        exportId: "",
        status: "failed",
        progress: this.exportProgress,
        createdAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
      this.dialogState = { ...this.dialogState, step: "error" };
    }
  }

  private startPolling(): void {
    if (!this.currentExport) return;

    this.pollInterval = setInterval(async () => {
      if (!this.currentExport) return;

      try {
        const response = await fetch(`/api/export/${this.currentExport.exportId}`);
        const result = await response.json();

        if (result.success) {
          this.currentExport = result.data;
          this.exportProgress = result.data.progress;

          if (result.data.status === "completed") {
            this.stopPolling();
            this.dialogState = { ...this.dialogState, step: "complete" };
          } else if (result.data.status === "failed") {
            this.stopPolling();
            this.dialogState = { ...this.dialogState, step: "error" };
          }

          this.requestUpdate();
        }
      } catch (error) {
        console.error("Failed to poll export status:", error);
        this.stopPolling();
        this.dialogState = { ...this.dialogState, step: "error" };
      }
    }, 1000); // Poll every second
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  private async downloadExport(): Promise<void> {
    if (!this.currentExport?.result?.downloadToken) return;

    const url = `/api/export/${this.currentExport.exportId}/download?token=${this.currentExport.result.downloadToken}`;
    
    // Create a temporary link and click it to trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = this.currentExport.result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Close dialog after download
    setTimeout(() => this.closeDialog(), 1000);
  }

  private cancelExport(): void {
    this.stopPolling();
    // Could implement actual cancellation API call here
    this.closeDialog();
  }

  private retryExport(): void {
    this.currentExport = undefined;
    this.dialogState = { ...this.dialogState, step: "configure" };
  }

  // Utility Methods
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Public API
  public showDialog(): void {
    this.open = true;
    this.dialogState = { ...this.dialogState, isOpen: true, step: "configure" };
    this.requestUpdate();
  }

  public closeDialog(): void {
    this.stopPolling();
    this.open = false;
    this.dialogState = { ...this.dialogState, isOpen: false };
    this.currentExport = undefined;
    this.exportProgress = {
      stage: "preparing",
      progress: 0,
      message: "Preparing export...",
    };
    this.requestUpdate();
    
    // Dispatch close event
    this.dispatchEvent(new CustomEvent("dialog-close"));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopPolling();
  }
}