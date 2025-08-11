import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { FilterController, FilterState, FilterPreset } from './FilterController';

// Material Design icons as text (for simplicity)
const ICONS = {
  search: '🔍',
  clear: '✕',
  calendar: '📅',
  filter: '🔽',
  user: '👤',
  assistant: '🤖',
  system: '⚙️',
  error: '❌',
  preset: '⭐',
  save: '💾',
  delete: '🗑️',
  expand: '🔽',
  collapse: '🔼',
};

/**
 * Filter panel component with Material Design styling
 * Provides UI for all filter types including search, message types, date range, etc.
 */
@customElement('filter-panel')
export class FilterPanel extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
      }

      .filter-panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .filter-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: var(--space-sm);
        border-bottom: 1px solid var(--color-border);
      }

      .filter-title {
        margin: 0;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .filter-actions {
        display: flex;
        gap: var(--space-sm);
        align-items: center;
      }

      .action-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .action-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .action-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .action-button.danger {
        border-color: var(--color-error);
        color: var(--color-error);
      }

      .action-button.danger:hover {
        background: rgba(220, 53, 69, 0.1);
      }

      .active-filter-count {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-radius: var(--border-radius-full);
        padding: 2px 6px;
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        min-width: 18px;
        text-align: center;
      }

      .filter-section {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        padding: var(--space-xs);
        border-radius: var(--border-radius);
        transition: background var(--transition-fast);
      }

      .section-header:hover {
        background: var(--color-background-tertiary);
      }

      .section-title {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        font-size: var(--font-size-base);
      }

      .section-toggle {
        color: var(--color-text-muted);
        transition: transform var(--transition-fast);
      }

      .section-toggle.expanded {
        transform: rotate(180deg);
      }

      .section-content {
        padding-left: var(--space-md);
        overflow: hidden;
        transition: all var(--transition-normal);
      }

      .section-content.collapsed {
        max-height: 0;
        padding-top: 0;
        padding-bottom: 0;
      }

      /* Search Section */
      .search-container {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .search-input-wrapper {
        position: relative;
      }

      .search-input {
        width: 100%;
        padding: var(--space-sm) var(--space-xl) var(--space-sm) var(--space-xl);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        font-size: var(--font-size-base);
        background: var(--color-background);
        color: var(--color-text-primary);
        transition: all var(--transition-fast);
        box-sizing: border-box;
      }

      .search-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
      }

      .search-icon {
        position: absolute;
        left: var(--space-sm);
        top: 50%;
        transform: translateY(-50%);
        color: var(--color-text-muted);
        pointer-events: none;
      }

      .search-clear {
        position: absolute;
        right: var(--space-sm);
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-muted);
        padding: var(--space-xs);
        border-radius: var(--border-radius);
        transition: all var(--transition-fast);
      }

      .search-clear:hover {
        color: var(--color-text-primary);
        background: var(--color-background-tertiary);
      }

      .search-fields {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }

      .search-field-chip {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-full);
        padding: var(--space-xs) var(--space-sm);
        font-size: var(--font-size-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
        user-select: none;
      }

      .search-field-chip.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .search-field-chip:hover:not(.active) {
        border-color: var(--color-primary);
        background: rgba(13, 110, 253, 0.1);
      }

      /* Message Type Filters */
      .message-type-filters {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
      }

      .message-type-chip {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: var(--font-size-sm);
        user-select: none;
      }

      .message-type-chip.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .message-type-chip:hover:not(.active) {
        border-color: var(--color-primary);
        background: rgba(13, 110, 253, 0.1);
      }

      .message-type-chip.user.active { background: #28a745; border-color: #28a745; }
      .message-type-chip.assistant.active { background: #007bff; border-color: #007bff; }
      .message-type-chip.system.active { background: #6f42c1; border-color: #6f42c1; }
      .message-type-chip.error.active { background: #dc3545; border-color: #dc3545; }

      /* Date Range */
      .date-range-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .date-inputs {
        display: flex;
        gap: var(--space-sm);
      }

      .date-input-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .date-input-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-medium);
      }

      .date-input {
        padding: var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
        transition: border-color var(--transition-fast);
      }

      .date-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
      }

      .date-presets {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }

      .date-preset {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-full);
        padding: var(--space-xs) var(--space-sm);
        font-size: var(--font-size-xs);
        cursor: pointer;
        transition: all var(--transition-fast);
        user-select: none;
      }

      .date-preset:hover {
        border-color: var(--color-primary);
        background: rgba(13, 110, 253, 0.1);
      }

      /* Presets Section */
      .presets-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .preset-item {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-sm);
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: all var(--transition-fast);
        cursor: pointer;
      }

      .preset-item:hover {
        border-color: var(--color-primary);
        background: rgba(13, 110, 253, 0.05);
      }

      .preset-item.active {
        border-color: var(--color-primary);
        background: rgba(13, 110, 253, 0.1);
      }

      .preset-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
      }

      .preset-name {
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
      }

      .preset-description {
        color: var(--color-text-secondary);
        font-size: var(--font-size-xs);
      }

      .preset-actions {
        display: flex;
        gap: var(--space-xs);
        opacity: 0;
        transition: opacity var(--transition-fast);
      }

      .preset-item:hover .preset-actions {
        opacity: 1;
      }

      .preset-action {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-muted);
        padding: var(--space-xs);
        border-radius: var(--border-radius);
        transition: all var(--transition-fast);
        font-size: var(--font-size-sm);
      }

      .preset-action:hover {
        color: var(--color-text-primary);
        background: var(--color-background-tertiary);
      }

      .preset-action.danger:hover {
        color: var(--color-error);
        background: rgba(220, 53, 69, 0.1);
      }

      /* Save Preset Form */
      .save-preset-form {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-sm);
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .form-input {
        padding: var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
      }

      .form-input:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      .form-actions {
        display: flex;
        gap: var(--space-sm);
        justify-content: flex-end;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .date-inputs {
          flex-direction: column;
        }

        .message-type-filters {
          justify-content: center;
        }

        .filter-actions {
          flex-wrap: wrap;
        }
      }

      /* Keyboard Navigation */
      .filter-section:focus-within .section-header {
        background: var(--color-background-tertiary);
      }

      /* Accessibility */
      .sr-only {
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }
    `,
  ];

  /**
   * Filter controller instance
   */
  @property({ type: Object })
  filterController!: FilterController;

  /**
   * Whether to show advanced filters
   */
  @property({ type: Boolean })
  showAdvanced = false;

  /**
   * Whether the panel is collapsible
   */
  @property({ type: Boolean })
  collapsible = true;

  /**
   * Whether the panel is initially collapsed
   */
  @property({ type: Boolean })
  collapsed = false;

  @state()
  private expandedSections = new Set(['search', 'messageTypes']);

  @state()
  private showSavePresetForm = false;

  @state()
  private presetFormData = { name: '', description: '' };

  @query('.search-input')
  private searchInput!: HTMLInputElement;

  render() {
    if (!this.filterController) {
      return html`<div>Filter controller not provided</div>`;
    }

    const state = this.filterController.state;
    const activeCount = this.filterController.activeFilterCount;

    return html`
      <div class="filter-panel">
        ${this.renderHeader(activeCount)}
        ${!this.collapsed ? this.renderContent(state) : ''}
      </div>
    `;
  }

  private renderHeader(activeCount: number) {
    return html`
      <div class="filter-header">
        <h3 class="filter-title">
          ${ICONS.filter} Filters
          ${activeCount > 0 ? html`
            <span class="active-filter-count">${activeCount}</span>
          ` : ''}
        </h3>
        <div class="filter-actions">
          ${activeCount > 0 ? html`
            <button 
              class="action-button danger" 
              @click=${this.clearAllFilters}
              title="Clear all filters"
            >
              ${ICONS.clear} Clear All
            </button>
          ` : ''}
          ${this.collapsible ? html`
            <button 
              class="action-button"
              @click=${this.toggleCollapse}
              title="${this.collapsed ? 'Expand' : 'Collapse'} filter panel"
              aria-expanded="${!this.collapsed}"
            >
              ${this.collapsed ? ICONS.expand : ICONS.collapse}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderContent(state: FilterState) {
    return html`
      <div class="filter-content">
        ${this.renderSearchSection(state)}
        ${this.renderMessageTypesSection(state)}
        ${this.renderDateRangeSection(state)}
        ${this.showAdvanced ? this.renderPresetsSection() : ''}
      </div>
    `;
  }

  private renderSearchSection(state: FilterState) {
    const isExpanded = this.expandedSections.has('search');
    
    return html`
      <div class="filter-section">
        <div 
          class="section-header" 
          @click=${() => this.toggleSection('search')}
          role="button"
          tabindex="0"
          aria-expanded="${isExpanded}"
        >
          <div class="section-title">
            ${ICONS.search} Search
          </div>
          <div class="section-toggle ${isExpanded ? 'expanded' : ''}">
            ${ICONS.expand}
          </div>
        </div>
        <div class="section-content ${isExpanded ? '' : 'collapsed'}">
          <div class="search-container">
            <div class="search-input-wrapper">
              <div class="search-icon" aria-hidden="true">${ICONS.search}</div>
              <input
                class="search-input"
                type="search"
                placeholder="Search messages..."
                .value=${state.searchQuery}
                @input=${this.handleSearchInput}
                @keydown=${this.handleSearchKeydown}
                aria-label="Search messages"
              />
              ${state.searchQuery ? html`
                <button 
                  class="search-clear"
                  @click=${this.clearSearch}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  ${ICONS.clear}
                </button>
              ` : ''}
            </div>
            <div class="search-fields">
              <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                Search in:
              </span>
              ${this.renderSearchFieldChips(state.searchFields)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderSearchFieldChips(activeFields: string[]) {
    const fields = [
      { id: 'content', label: 'Content' },
      { id: 'role', label: 'Role' },
      { id: 'toolName', label: 'Tool Name' },
      { id: 'error', label: 'Errors' },
    ];

    return fields.map(field => html`
      <div 
        class="search-field-chip ${activeFields.includes(field.id) ? 'active' : ''}"
        @click=${() => this.toggleSearchField(field.id as any)}
        role="button"
        tabindex="0"
        aria-pressed="${activeFields.includes(field.id)}"
      >
        ${field.label}
      </div>
    `);
  }

  private renderMessageTypesSection(state: FilterState) {
    const isExpanded = this.expandedSections.has('messageTypes');
    
    return html`
      <div class="filter-section">
        <div 
          class="section-header" 
          @click=${() => this.toggleSection('messageTypes')}
          role="button"
          tabindex="0"
          aria-expanded="${isExpanded}"
        >
          <div class="section-title">
            ${ICONS.filter} Message Types
          </div>
          <div class="section-toggle ${isExpanded ? 'expanded' : ''}">
            ${ICONS.expand}
          </div>
        </div>
        <div class="section-content ${isExpanded ? '' : 'collapsed'}">
          <div class="message-type-filters">
            ${this.renderMessageTypeChip('user', ICONS.user, 'User', state.messageTypes)}
            ${this.renderMessageTypeChip('assistant', ICONS.assistant, 'Assistant', state.messageTypes)}
            ${this.renderMessageTypeChip('system', ICONS.system, 'System', state.messageTypes)}
            ${this.renderMessageTypeChip('error', ICONS.error, 'Errors', state.messageTypes)}
          </div>
        </div>
      </div>
    `;
  }

  private renderMessageTypeChip(
    type: 'user' | 'assistant' | 'system' | 'error',
    icon: string,
    label: string,
    activeTypes: string[]
  ) {
    const isActive = activeTypes.includes(type);
    
    return html`
      <div 
        class="message-type-chip ${type} ${isActive ? 'active' : ''}"
        @click=${() => this.toggleMessageType(type)}
        role="button"
        tabindex="0"
        aria-pressed="${isActive}"
        title="${isActive ? 'Hide' : 'Show'} ${label.toLowerCase()} messages"
      >
        <span aria-hidden="true">${icon}</span>
        ${label}
      </div>
    `;
  }

  private renderDateRangeSection(state: FilterState) {
    const isExpanded = this.expandedSections.has('dateRange');
    
    return html`
      <div class="filter-section">
        <div 
          class="section-header" 
          @click=${() => this.toggleSection('dateRange')}
          role="button"
          tabindex="0"
          aria-expanded="${isExpanded}"
        >
          <div class="section-title">
            ${ICONS.calendar} Date Range
          </div>
          <div class="section-toggle ${isExpanded ? 'expanded' : ''}">
            ${ICONS.expand}
          </div>
        </div>
        <div class="section-content ${isExpanded ? '' : 'collapsed'}">
          <div class="date-range-container">
            <div class="date-inputs">
              <div class="date-input-wrapper">
                <label class="date-input-label" for="start-date">Start Date</label>
                <input
                  id="start-date"
                  class="date-input"
                  type="date"
                  .value=${state.dateRange.start ? this.formatDateForInput(state.dateRange.start) : ''}
                  @change=${this.handleStartDateChange}
                />
              </div>
              <div class="date-input-wrapper">
                <label class="date-input-label" for="end-date">End Date</label>
                <input
                  id="end-date"
                  class="date-input"
                  type="date"
                  .value=${state.dateRange.end ? this.formatDateForInput(state.dateRange.end) : ''}
                  @change=${this.handleEndDateChange}
                />
              </div>
            </div>
            <div class="date-presets">
              ${this.renderDatePresets()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderDatePresets() {
    const presets = [
      { label: 'Today', days: 0 },
      { label: 'Last 7 days', days: 7 },
      { label: 'Last 30 days', days: 30 },
      { label: 'Last 90 days', days: 90 },
    ];

    return presets.map(preset => html`
      <div 
        class="date-preset"
        @click=${() => this.applyDatePreset(preset.days)}
        role="button"
        tabindex="0"
      >
        ${preset.label}
      </div>
    `);
  }

  private renderPresetsSection() {
    const isExpanded = this.expandedSections.has('presets');
    const presets = this.filterController.presets;
    
    return html`
      <div class="filter-section">
        <div 
          class="section-header" 
          @click=${() => this.toggleSection('presets')}
          role="button"
          tabindex="0"
          aria-expanded="${isExpanded}"
        >
          <div class="section-title">
            ${ICONS.preset} Presets
          </div>
          <div class="section-toggle ${isExpanded ? 'expanded' : ''}">
            ${ICONS.expand}
          </div>
        </div>
        <div class="section-content ${isExpanded ? '' : 'collapsed'}">
          <div class="presets-container">
            <button 
              class="action-button"
              @click=${this.toggleSavePresetForm}
              style="align-self: flex-start;"
            >
              ${ICONS.save} Save Current as Preset
            </button>
            
            ${this.showSavePresetForm ? this.renderSavePresetForm() : ''}
            
            ${presets.map(preset => this.renderPresetItem(preset))}
          </div>
        </div>
      </div>
    `;
  }

  private renderPresetItem(preset: FilterPreset) {
    return html`
      <div class="preset-item" @click=${() => this.applyPreset(preset.id)}>
        <div class="preset-info">
          <div class="preset-name">${preset.name}</div>
          <div class="preset-description">${preset.description}</div>
        </div>
        <div class="preset-actions">
          ${!preset.isDefault ? html`
            <button 
              class="preset-action danger"
              @click=${(e: Event) => this.deletePreset(e, preset.id)}
              title="Delete preset"
              aria-label="Delete ${preset.name} preset"
            >
              ${ICONS.delete}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderSavePresetForm() {
    return html`
      <div class="save-preset-form">
        <input
          class="form-input"
          type="text"
          placeholder="Preset name..."
          .value=${this.presetFormData.name}
          @input=${(e: Event) => this.presetFormData.name = (e.target as HTMLInputElement).value}
        />
        <input
          class="form-input"
          type="text"
          placeholder="Description (optional)..."
          .value=${this.presetFormData.description}
          @input=${(e: Event) => this.presetFormData.description = (e.target as HTMLInputElement).value}
        />
        <div class="form-actions">
          <button class="action-button" @click=${this.cancelSavePreset}>Cancel</button>
          <button class="action-button" @click=${this.savePreset} ?disabled=${!this.presetFormData.name}>
            Save
          </button>
        </div>
      </div>
    `;
  }

  // Event Handlers

  private handleSearchInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    this.filterController.setSearchQuery(input.value);
  };

  private handleSearchKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.clearSearch();
    } else if (event.key === 'Enter') {
      // Trigger immediate search without debounce
      this.filterController.setSearchQuery(this.searchInput.value, 0);
    }
  };

  private clearSearch = () => {
    this.filterController.clearSearch();
    this.searchInput.focus();
  };

  private toggleSearchField = (field: 'content' | 'role' | 'toolName' | 'error') => {
    const current = this.filterController.state.searchFields;
    const updated = current.includes(field) 
      ? current.filter(f => f !== field)
      : [...current, field];
    this.filterController.setSearchFields(updated);
  };

  private toggleMessageType = (type: 'user' | 'assistant' | 'system' | 'error') => {
    this.filterController.toggleMessageType(type);
  };

  private handleStartDateChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const date = input.value ? new Date(input.value) : null;
    this.filterController.setStartDate(date);
  };

  private handleEndDateChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const date = input.value ? new Date(input.value) : null;
    this.filterController.setEndDate(date);
  };

  private applyDatePreset = (days: number) => {
    const now = new Date();
    const start = days === 0 ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const end = days === 0 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : null;
    this.filterController.setDateRange(start, end);
  };

  private applyPreset = (presetId: string) => {
    this.filterController.applyPreset(presetId);
  };

  private toggleSavePresetForm = () => {
    this.showSavePresetForm = !this.showSavePresetForm;
    if (!this.showSavePresetForm) {
      this.presetFormData = { name: '', description: '' };
    }
  };

  private savePreset = () => {
    if (this.presetFormData.name.trim()) {
      this.filterController.addPreset(
        this.presetFormData.name.trim(),
        this.presetFormData.description.trim() || 'Custom filter preset'
      );
      this.toggleSavePresetForm();
    }
  };

  private cancelSavePreset = () => {
    this.toggleSavePresetForm();
  };

  private deletePreset = (event: Event, presetId: string) => {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this preset?')) {
      this.filterController.removePreset(presetId);
    }
  };

  private clearAllFilters = () => {
    this.filterController.clearAllFilters();
  };

  private toggleCollapse = () => {
    this.collapsed = !this.collapsed;
    this.emitEvent('panel-toggled', { collapsed: this.collapsed });
  };

  private toggleSection = (section: string) => {
    if (this.expandedSections.has(section)) {
      this.expandedSections.delete(section);
    } else {
      this.expandedSections.add(section);
    }
    this.requestUpdate();
  };

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // Keyboard navigation support
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.handleKeydown);
  }

  private handleKeydown = (event: KeyboardEvent) => {
    // Handle Ctrl/Cmd + F to focus search
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      event.preventDefault();
      this.searchInput?.focus();
      this.searchInput?.select();
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'filter-panel': FilterPanel;
  }
}