import { html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/base-component.js';

export interface FilterCriteria {
  searchTerm: string;
  messageTypes: Set<string>;
  sessionStatus: Set<string>;
  dateRange: {
    from?: Date;
    to?: Date;
  };
  hasContent?: boolean;
  tokenRange?: {
    min?: number;
    max?: number;
  };
}

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  criteria: Partial<FilterCriteria>;
  icon?: string;
}

export interface FilterBarState {
  isVisible: boolean;
  isAdvancedExpanded: boolean;
  activePreset: string | null;
}

export interface MessageTypeCounts {
  [key: string]: number;
}

@customElement('filter-bar')
export class FilterBar extends BaseComponent {
  @property({ type: Boolean, attribute: 'is-visible' })
  isVisible = false;

  @property({ type: Boolean, attribute: 'sticky' })
  sticky = true;

  @property({ type: Object })
  messageCounts: MessageTypeCounts = {};

  @property({ type: Object })
  filters: FilterCriteria = {
    searchTerm: '',
    messageTypes: new Set(['user', 'assistant', 'system', 'tool_use', 'tool_result', 'thinking', 'image', 'sidechain']),
    sessionStatus: new Set(['pending', 'in-progress', 'done']),
    dateRange: {},
  };

  @state()
  private filterState: FilterBarState = {
    isVisible: false,
    isAdvancedExpanded: false,
    activePreset: null,
  };

  @state()
  private debounceTimeout: number | null = null;

  private readonly messageTypeLabels: Record<string, { label: string; icon: string }> = {
    user: { label: 'User', icon: '🤷' },
    assistant: { label: 'Assistant', icon: '🤖' },
    system: { label: 'System', icon: '⚙️' },
    tool_use: { label: 'Tool Use', icon: '🛠️' },
    tool_result: { label: 'Tool Results', icon: '🧰' },
    thinking: { label: 'Thinking', icon: '💭' },
    image: { label: 'Images', icon: '🖼️' },
    sidechain: { label: 'Sub-assistant', icon: '🔗' },
  };

  private readonly sessionStatusLabels: Record<string, { label: string; icon: string }> = {
    pending: { label: 'Pending', icon: '⏳' },
    'in-progress': { label: 'In Progress', icon: '🔄' },
    done: { label: 'Completed', icon: '✅' },
    deferred: { label: 'Deferred', icon: '⏸️' },
    cancelled: { label: 'Cancelled', icon: '❌' },
  };

  private readonly filterPresets: FilterPreset[] = [
    {
      id: 'all',
      name: 'All Messages',
      description: 'Show all message types',
      icon: '📋',
      criteria: {
        messageTypes: new Set(['user', 'assistant', 'system', 'tool_use', 'tool_result', 'thinking', 'image', 'sidechain']),
      }
    },
    {
      id: 'conversation',
      name: 'Conversation Only',
      description: 'Show user and assistant messages only',
      icon: '💬',
      criteria: {
        messageTypes: new Set(['user', 'assistant']),
      }
    },
    {
      id: 'tools',
      name: 'Tool Usage',
      description: 'Show tool use and result messages',
      icon: '🔧',
      criteria: {
        messageTypes: new Set(['tool_use', 'tool_result']),
      }
    },
    {
      id: 'errors',
      name: 'Errors & Issues',
      description: 'Show system errors and tool failures',
      icon: '⚠️',
      criteria: {
        messageTypes: new Set(['system']),
      }
    },
    {
      id: 'recent',
      name: 'Recent (24h)',
      description: 'Show messages from last 24 hours',
      icon: '🕐',
      criteria: {
        dateRange: {
          from: new Date(Date.now() - 24 * 60 * 60 * 1000),
          to: new Date(),
        }
      }
    },
  ];

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        font-family: var(--font-family-mono);
      }

      .filter-bar-container {
        background-color: var(--color-surface);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-md);
        box-shadow: -7px -7px 10px var(--color-shadow-light), 7px 7px 10px var(--color-shadow-dark);
        border-left: var(--color-border-light) 1px solid;
        border-top: var(--color-border-light) 1px solid;
        border-bottom: var(--color-border-dark) 1px solid;
        border-right: var(--color-border-dark) 1px solid;
        backdrop-filter: blur(8px);
        transition: all var(--transition-fast);
      }

      .filter-bar-container.sticky {
        position: sticky;
        top: 0;
        z-index: var(--z-sticky);
      }

      .filter-bar-container.hidden {
        display: none;
      }

      .filter-header {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-md);
      }

      .filter-label {
        white-space: nowrap;
      }

      .filter-label h3 {
        margin: 0;
        font-size: 1em;
        color: var(--color-text);
        font-weight: 600;
      }

      .filter-search {
        flex: 1;
        display: flex;
        gap: var(--spacing-sm);
        align-items: center;
      }

      .search-input {
        flex: 1;
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: 0.9em;
        transition: border-color var(--transition-fast);
      }

      .search-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary)33;
      }

      .search-input::placeholder {
        color: var(--color-text-muted);
      }

      .filter-actions {
        display: flex;
        gap: var(--spacing-xs);
        white-space: nowrap;
      }

      .filter-action-btn {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text-muted);
        font-size: 0.75em;
        cursor: pointer;
        transition: all var(--transition-fast);
        font-family: var(--font-family-mono);
      }

      .filter-action-btn:hover {
        background-color: var(--color-surface-hover);
        color: var(--color-text);
      }

      .filter-presets {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-md);
      }

      .filter-preset {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-lg);
        background-color: transparent;
        color: var(--color-text-muted);
        font-size: 0.8em;
        cursor: pointer;
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        white-space: nowrap;
      }

      .filter-preset:hover {
        background-color: var(--color-surface-hover);
        color: var(--color-text);
        transform: translateY(-1px);
      }

      .filter-preset.active {
        background-color: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .filter-toggles {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
      }

      .filter-section-title {
        font-size: 0.9em;
        font-weight: 600;
        color: var(--color-text);
        margin-right: var(--spacing-sm);
        white-space: nowrap;
      }

      .filter-toggle {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-lg);
        background-color: transparent;
        color: var(--color-text-muted);
        font-size: 0.85em;
        font-weight: 500;
        cursor: pointer;
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        white-space: nowrap;
      }

      .filter-toggle:hover {
        background-color: var(--color-surface-hover);
        transform: translateY(-1px);
      }

      .filter-toggle.active {
        background-color: var(--color-surface-active);
        color: var(--color-text);
        border-color: var(--color-primary);
      }

      .filter-toggle.active:hover {
        background-color: var(--color-surface-hover);
      }

      .filter-count {
        opacity: 0.7;
        font-size: 0.9em;
        margin-left: 2px;
      }

      .filter-toggle.active .filter-count {
        opacity: 1;
      }

      .advanced-section {
        border-top: 1px solid var(--color-border-dark);
        padding-top: var(--spacing-md);
        margin-top: var(--spacing-md);
      }

      .advanced-toggle {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        cursor: pointer;
        font-size: 0.9em;
        color: var(--color-text-muted);
        margin-bottom: var(--spacing-md);
        transition: color var(--transition-fast);
      }

      .advanced-toggle:hover {
        color: var(--color-text);
      }

      .advanced-content {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: var(--spacing-md);
      }

      .filter-group {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }

      .filter-group-title {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: var(--spacing-xs);
      }

      .date-range-inputs {
        display: flex;
        gap: var(--spacing-sm);
        align-items: center;
      }

      .date-input {
        flex: 1;
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: 0.85em;
      }

      .date-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary)33;
      }

      .token-range-inputs {
        display: flex;
        gap: var(--spacing-sm);
        align-items: center;
      }

      .token-input {
        flex: 1;
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: 0.85em;
      }

      .token-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary)33;
      }

      .expand-icon {
        transition: transform var(--transition-fast);
      }

      .expand-icon.expanded {
        transform: rotate(180deg);
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .filter-header {
          grid-template-columns: 1fr;
          gap: var(--spacing-sm);
        }

        .filter-search {
          flex-direction: column;
          align-items: stretch;
        }

        .filter-toggles {
          justify-content: center;
        }

        .advanced-content {
          grid-template-columns: 1fr;
        }

        .date-range-inputs,
        .token-range-inputs {
          flex-direction: column;
        }
      }

      /* Loading and empty states */
      .filter-bar-container.loading {
        opacity: 0.6;
        pointer-events: none;
      }

      .empty-state {
        text-align: center;
        padding: var(--spacing-lg);
        color: var(--color-text-muted);
        font-style: italic;
      }

      /* Animation for toggle visibility */
      @keyframes slideDown {
        from {
          opacity: 0;
          max-height: 0;
        }
        to {
          opacity: 1;
          max-height: 500px;
        }
      }

      @keyframes slideUp {
        from {
          opacity: 1;
          max-height: 500px;
        }
        to {
          opacity: 0;
          max-height: 0;
        }
      }

      .advanced-content.expanding {
        animation: slideDown 0.3s ease-out;
      }

      .advanced-content.collapsing {
        animation: slideUp 0.3s ease-out;
      }
    `
  ];

  protected override willUpdate(): void {
    // Sync visibility state
    this.filterState = {
      ...this.filterState,
      isVisible: this.isVisible
    };
  }

  private debouncedEmitFilterChange(newFilters: FilterCriteria): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = window.setTimeout(() => {
      this.emitFilterChange(newFilters);
      this.debounceTimeout = null;
    }, 300);
  }

  private emitFilterChange(newFilters: FilterCriteria): void {
    this.filters = newFilters;
    this.emitEvent('filter-change', { filters: newFilters });
  }

  private handleSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newFilters = {
      ...this.filters,
      searchTerm: target.value
    };
    this.debouncedEmitFilterChange(newFilters);
  }

  private handleMessageTypeToggle(messageType: string): void {
    const newTypes = new Set(this.filters.messageTypes);
    if (newTypes.has(messageType)) {
      newTypes.delete(messageType);
    } else {
      newTypes.add(messageType);
    }

    const newFilters = {
      ...this.filters,
      messageTypes: newTypes
    };
    this.emitFilterChange(newFilters);
    this.filterState = { ...this.filterState, activePreset: null };
  }

  private handleSessionStatusToggle(status: string): void {
    const newStatuses = new Set(this.filters.sessionStatus);
    if (newStatuses.has(status)) {
      newStatuses.delete(status);
    } else {
      newStatuses.add(status);
    }

    const newFilters = {
      ...this.filters,
      sessionStatus: newStatuses
    };
    this.emitFilterChange(newFilters);
  }

  private handlePresetClick(preset: FilterPreset): void {
    const newFilters = {
      ...this.filters,
      ...preset.criteria
    };
    this.emitFilterChange(newFilters);
    this.filterState = { ...this.filterState, activePreset: preset.id };
  }

  private handleSelectAll(): void {
    const newFilters = {
      ...this.filters,
      messageTypes: new Set(Object.keys(this.messageTypeLabels))
    };
    this.emitFilterChange(newFilters);
    this.filterState = { ...this.filterState, activePreset: 'all' };
  }

  private handleSelectNone(): void {
    const newFilters = {
      ...this.filters,
      messageTypes: new Set<string>()
    };
    this.emitFilterChange(newFilters);
    this.filterState = { ...this.filterState, activePreset: null };
  }

  private handleClearFilters(): void {
    const newFilters: FilterCriteria = {
      searchTerm: '',
      messageTypes: new Set(Object.keys(this.messageTypeLabels)),
      sessionStatus: new Set(['pending', 'in-progress', 'done']),
      dateRange: {},
    };
    this.emitFilterChange(newFilters);
    this.filterState = { ...this.filterState, activePreset: 'all' };
  }

  private handleDateFromChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newFilters = {
      ...this.filters,
      dateRange: {
        ...this.filters.dateRange,
        from: target.value ? new Date(target.value) : undefined
      }
    };
    this.emitFilterChange(newFilters);
  }

  private handleDateToChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newFilters = {
      ...this.filters,
      dateRange: {
        ...this.filters.dateRange,
        to: target.value ? new Date(target.value) : undefined
      }
    };
    this.emitFilterChange(newFilters);
  }

  private handleTokenMinChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newFilters = {
      ...this.filters,
      tokenRange: {
        ...this.filters.tokenRange,
        min: target.value ? parseInt(target.value, 10) : undefined
      }
    };
    this.emitFilterChange(newFilters);
  }

  private handleTokenMaxChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newFilters = {
      ...this.filters,
      tokenRange: {
        ...this.filters.tokenRange,
        max: target.value ? parseInt(target.value, 10) : undefined
      }
    };
    this.emitFilterChange(newFilters);
  }

  private toggleAdvanced(): void {
    this.filterState = {
      ...this.filterState,
      isAdvancedExpanded: !this.filterState.isAdvancedExpanded
    };
  }

  private formatDateForInput(date?: Date): string {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  }

  protected override render(): TemplateResult {
    if (!this.filterState.isVisible) {
      return html``;
    }

    return html`
      <div class="filter-bar-container ${this.sticky ? 'sticky' : ''}">
        <!-- Basic Filter Header -->
        <div class="filter-header">
          <div class="filter-label">
            <h3>Filter:</h3>
          </div>
          
          <div class="filter-search">
            <input
              type="text"
              class="search-input"
              placeholder="Search sessions..."
              .value=${this.filters.searchTerm}
              @input=${this.handleSearchInput}
            />
          </div>

          <div class="filter-actions">
            <button class="filter-action-btn" @click=${this.handleSelectAll}>All</button>
            <button class="filter-action-btn" @click=${this.handleSelectNone}>None</button>
            <button class="filter-action-btn" @click=${this.handleClearFilters}>Clear</button>
          </div>
        </div>

        <!-- Filter Presets -->
        <div class="filter-presets">
          ${this.filterPresets.map(preset => html`
            <button
              class="filter-preset ${this.filterState.activePreset === preset.id ? 'active' : ''}"
              @click=${() => this.handlePresetClick(preset)}
              title="${preset.description}"
            >
              <span>${preset.icon}</span>
              <span>${preset.name}</span>
            </button>
          `)}
        </div>

        <!-- Message Type Filters -->
        <div class="filter-toggles">
          <span class="filter-section-title">Message Types:</span>
          ${Object.entries(this.messageTypeLabels).map(([type, config]) => {
            const count = this.messageCounts[type] || 0;
            const isActive = this.filters.messageTypes.has(type);
            const isVisible = count > 0;
            
            return isVisible ? html`
              <button
                class="filter-toggle ${isActive ? 'active' : ''}"
                @click=${() => this.handleMessageTypeToggle(type)}
                data-type="${type}"
              >
                <span>${config.icon}</span>
                <span>${config.label}</span>
                <span class="filter-count">(${count})</span>
              </button>
            ` : '';
          })}
        </div>

        <!-- Advanced Filters -->
        <div class="advanced-section">
          <div class="advanced-toggle" @click=${this.toggleAdvanced}>
            <span>Advanced Filters</span>
            <span class="expand-icon ${this.filterState.isAdvancedExpanded ? 'expanded' : ''}">▼</span>
          </div>

          ${this.filterState.isAdvancedExpanded ? html`
            <div class="advanced-content">
              <!-- Date Range Filter -->
              <div class="filter-group">
                <div class="filter-group-title">Date Range</div>
                <div class="date-range-inputs">
                  <input
                    type="date"
                    class="date-input"
                    placeholder="From"
                    .value=${this.formatDateForInput(this.filters.dateRange?.from)}
                    @change=${this.handleDateFromChange}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    class="date-input"
                    placeholder="To"
                    .value=${this.formatDateForInput(this.filters.dateRange?.to)}
                    @change=${this.handleDateToChange}
                  />
                </div>
              </div>

              <!-- Token Range Filter -->
              <div class="filter-group">
                <div class="filter-group-title">Token Range</div>
                <div class="token-range-inputs">
                  <input
                    type="number"
                    class="token-input"
                    placeholder="Min tokens"
                    min="0"
                    .value=${this.filters.tokenRange?.min?.toString() || ''}
                    @change=${this.handleTokenMinChange}
                  />
                  <span>to</span>
                  <input
                    type="number"
                    class="token-input"
                    placeholder="Max tokens"
                    min="0"
                    .value=${this.filters.tokenRange?.max?.toString() || ''}
                    @change=${this.handleTokenMaxChange}
                  />
                </div>
              </div>

              <!-- Session Status Filter -->
              <div class="filter-group">
                <div class="filter-group-title">Session Status</div>
                <div class="filter-toggles">
                  ${Object.entries(this.sessionStatusLabels).map(([status, config]) => html`
                    <button
                      class="filter-toggle ${this.filters.sessionStatus.has(status) ? 'active' : ''}"
                      @click=${() => this.handleSessionStatusToggle(status)}
                    >
                      <span>${config.icon}</span>
                      <span>${config.label}</span>
                    </button>
                  `)}
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'filter-bar': FilterBar;
  }
}