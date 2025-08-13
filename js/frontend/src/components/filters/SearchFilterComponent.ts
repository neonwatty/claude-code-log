import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { FilterController, FilterState, FilterPreset } from './FilterController';
import { FilterEngine, SearchOptions, SearchMatch } from './FilterEngine';
import './FilterPanel';
import './SearchHighlighter';

export interface SearchFilterConfig {
  showAdvancedSearch?: boolean;
  showRegexOption?: boolean;
  showFuzzySearch?: boolean;
  showDatePicker?: boolean;
  showTagFilters?: boolean;
  showSessionFilters?: boolean;
  enableQueryBuilder?: boolean;
  enableSearchHistory?: boolean;
  persistFilters?: boolean;
  maxSearchHistory?: number;
}

export interface SearchQuery {
  text: string;
  fields: string[];
  options: SearchOptions;
  timestamp: Date;
}

export interface TagFilter {
  id: string;
  name: string;
  color: string;
  count?: number;
  isActive: boolean;
}

/**
 * Advanced Search and Filtering Component
 * Comprehensive search capabilities with full-text search, date ranges, and tag-based filtering
 */
@customElement('search-filter-component')
export class SearchFilterComponent extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .search-filter-container {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .search-header {
        background: var(--color-background-secondary);
        padding: var(--space-lg);
        border-bottom: 1px solid var(--color-border);
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .search-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0;
      }

      .title-text {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .search-controls {
        display: flex;
        gap: var(--space-sm);
        align-items: center;
        flex-wrap: wrap;
      }

      .toggle-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .toggle-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
        color: var(--color-text-primary);
      }

      .toggle-button.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .main-search-section {
        padding: var(--space-lg);
        border-bottom: 1px solid var(--color-border-light);
      }

      .search-input-container {
        position: relative;
        margin-bottom: var(--space-md);
      }

      .search-input {
        width: 100%;
        padding: var(--space-md) var(--space-xl) var(--space-md) 3rem;
        border: 2px solid var(--color-border);
        border-radius: var(--border-radius-lg);
        font-size: var(--font-size-lg);
        background: var(--color-background);
        color: var(--color-text-primary);
        transition: all var(--transition-fast);
        box-sizing: border-box;
      }

      .search-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
      }

      .search-input:placeholder-shown {
        font-style: italic;
      }

      .search-icon {
        position: absolute;
        left: var(--space-md);
        top: 50%;
        transform: translateY(-50%);
        font-size: var(--font-size-xl);
        color: var(--color-text-muted);
        pointer-events: none;
      }

      .search-actions {
        position: absolute;
        right: var(--space-md);
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        gap: var(--space-xs);
      }

      .search-action-button {
        background: var(--color-background-tertiary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs);
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
      }

      .search-action-button:hover {
        background: var(--color-background);
        color: var(--color-text-primary);
        border-color: var(--color-primary);
      }

      .search-action-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .search-options-bar {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        align-items: center;
        padding: var(--space-sm) 0;
      }

      .search-option-chip {
        background: var(--color-background-tertiary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-full);
        padding: var(--space-xs) var(--space-sm);
        font-size: var(--font-size-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
        user-select: none;
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .search-option-chip.active {
        background: var(--color-primary-light);
        color: var(--color-primary-dark);
        border-color: var(--color-primary);
      }

      .search-option-chip:hover:not(.active) {
        border-color: var(--color-primary);
        background: rgba(13, 110, 253, 0.05);
      }

      .results-section {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .results-header {
        padding: var(--space-md) var(--space-lg);
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border-light);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .results-count {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .performance-indicator {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        padding: var(--space-xs) var(--space-sm);
        background: var(--color-background-tertiary);
        border-radius: var(--border-radius-full);
      }

      .results-actions {
        display: flex;
        gap: var(--space-sm);
        align-items: center;
      }

      .filter-content {
        flex: 1;
        overflow: auto;
        padding: var(--space-md);
      }

      .query-builder {
        background: var(--color-background-tertiary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        margin-bottom: var(--space-md);
      }

      .query-builder-header {
        display: flex;
        align-items: center;
        justify-content: between;
        margin-bottom: var(--space-md);
        font-weight: var(--font-weight-semibold);
      }

      .query-conditions {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .condition-row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm);
        background: var(--color-background);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border-light);
      }

      .condition-select,
      .condition-input {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
        color: var(--color-text-primary);
      }

      .condition-remove {
        background: var(--color-error);
        color: white;
        border: none;
        border-radius: var(--border-radius);
        padding: var(--space-xs);
        cursor: pointer;
        font-size: var(--font-size-xs);
      }

      .search-history {
        background: var(--color-background-secondary);
        border-top: 1px solid var(--color-border);
        padding: var(--space-md);
      }

      .history-header {
        display: flex;
        align-items: center;
        justify-content: between;
        margin-bottom: var(--space-sm);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
      }

      .history-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        max-height: 120px;
        overflow-y: auto;
      }

      .history-item {
        display: flex;
        align-items: center;
        justify-content: between;
        padding: var(--space-xs) var(--space-sm);
        background: var(--color-background);
        border-radius: var(--border-radius);
        cursor: pointer;
        transition: background var(--transition-fast);
        font-size: var(--font-size-sm);
      }

      .history-item:hover {
        background: var(--color-background-tertiary);
      }

      .history-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .history-timestamp {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        margin-left: var(--space-sm);
      }

      .tag-filters-section {
        padding: var(--space-md) var(--space-lg);
        border-top: 1px solid var(--color-border-light);
      }

      .tag-filters-header {
        display: flex;
        align-items: center;
        justify-content: between;
        margin-bottom: var(--space-md);
      }

      .tag-filters-title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }

      .tag-filters-grid {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
      }

      .tag-filter-chip {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-full);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: var(--font-size-sm);
        user-select: none;
      }

      .tag-filter-chip.active {
        border-color: var(--tag-color, var(--color-primary));
        background: var(--tag-color, var(--color-primary));
        color: white;
      }

      .tag-filter-chip:hover:not(.active) {
        border-color: var(--tag-color, var(--color-primary));
        background: rgba(var(--tag-color-rgb, 13, 110, 253), 0.1);
      }

      .tag-color-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--tag-color, var(--color-primary));
      }

      .tag-count {
        font-size: var(--font-size-xs);
        opacity: 0.8;
      }

      /* Pagination Controls */
      .pagination-section {
        padding: var(--space-md) var(--space-lg);
        background: var(--color-background-secondary);
        border-top: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        justify-content: between;
      }

      .pagination-info {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .pagination-controls {
        display: flex;
        gap: var(--space-sm);
        align-items: center;
      }

      .pagination-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        transition: all var(--transition-fast);
      }

      .pagination-button:hover:not(:disabled) {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .pagination-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .pagination-button.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .search-header {
          padding: var(--space-md);
        }

        .search-controls {
          justify-content: center;
        }

        .search-options-bar {
          justify-content: center;
        }

        .results-header {
          flex-direction: column;
          gap: var(--space-sm);
          align-items: stretch;
        }

        .condition-row {
          flex-direction: column;
          align-items: stretch;
        }
      }

      /* Keyboard Navigation */
      .search-input:focus + .search-actions .search-action-button {
        border-color: var(--color-primary);
      }

      /* Accessibility */
      .sr-only {
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }

      /* High contrast mode */
      @media (prefers-contrast: high) {
        .search-input,
        .toggle-button,
        .search-option-chip,
        .tag-filter-chip {
          border-width: 2px;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        * {
          transition-duration: 0.01ms !important;
        }
      }
    `,
  ];

  /**
   * Configuration options for the search filter component
   */
  @property({ type: Object })
  config: SearchFilterConfig = {
    showAdvancedSearch: true,
    showRegexOption: true,
    showFuzzySearch: true,
    showDatePicker: true,
    showTagFilters: true,
    showSessionFilters: true,
    enableQueryBuilder: true,
    enableSearchHistory: true,
    persistFilters: true,
    maxSearchHistory: 10,
  };

  /**
   * Array of data to filter
   */
  @property({ type: Array })
  data: any[] = [];

  /**
   * Tag filters available for filtering
   */
  @property({ type: Array })
  tagFilters: TagFilter[] = [];

  /**
   * Current search options
   */
  @property({ type: Object })
  searchOptions: SearchOptions = {
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    fuzzyThreshold: 0.7,
  };

  /**
   * Pagination settings
   */
  @property({ type: Object })
  pagination = {
    page: 0,
    pageSize: 50,
    total: 0,
  };

  @state()
  private filterController!: FilterController;

  @state()
  private showAdvancedOptions = false;

  @state()
  private showQueryBuilder = false;

  @state()
  private searchHistory: SearchQuery[] = [];

  @state()
  private lastSearchResults: any = null;

  @state()
  private searchPerformance: any = null;

  @state()
  private queryBuilderConditions: Array<{
    field: string;
    operator: string;
    value: string;
    id: string;
  }> = [];

  @query('.search-input')
  private searchInput!: HTMLInputElement;

  @query('filter-panel')
  private filterPanel!: any;

  connectedCallback() {
    super.connectedCallback();
    
    // Initialize filter controller
    this.filterController = new FilterController(this);
    
    // Load search history from localStorage
    this.loadSearchHistory();
    
    // Initialize tag filters with counts
    this.updateTagFilterCounts();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Save current state if persistence is enabled
    if (this.config.persistFilters) {
      this.saveSearchHistory();
    }
  }

  render() {
    if (!this.filterController) {
      return html`<div>Loading search filters...</div>`;
    }

    return html`
      <div class="search-filter-container">
        ${this.renderHeader()}
        ${this.renderMainSearch()}
        ${this.showQueryBuilder ? this.renderQueryBuilder() : ''}
        ${this.renderResults()}
        ${this.config.showTagFilters ? this.renderTagFilters() : ''}
        ${this.renderPagination()}
        ${this.config.enableSearchHistory ? this.renderSearchHistory() : ''}
      </div>
    `;
  }

  private renderHeader() {
    const activeFilters = this.filterController.activeFilterCount;
    
    return html`
      <div class="search-header">
        <div class="search-title">
          <h2 class="title-text">
            🔍 Advanced Search & Filters
            ${activeFilters > 0 ? html`
              <span class="active-filter-count" title="${activeFilters} active filters">
                ${activeFilters}
              </span>
            ` : ''}
          </h2>
        </div>
        
        <div class="search-controls">
          <button 
            class="toggle-button ${this.showAdvancedOptions ? 'active' : ''}"
            @click=${this.toggleAdvancedOptions}
            title="Toggle advanced search options"
          >
            ⚙️ Advanced
          </button>
          
          ${this.config.enableQueryBuilder ? html`
            <button 
              class="toggle-button ${this.showQueryBuilder ? 'active' : ''}"
              @click=${this.toggleQueryBuilder}
              title="Toggle query builder"
            >
              🔧 Query Builder
            </button>
          ` : ''}
          
          ${activeFilters > 0 ? html`
            <button 
              class="toggle-button"
              @click=${this.clearAllFilters}
              title="Clear all filters"
            >
              🗑️ Clear All
            </button>
          ` : ''}
          
          <button 
            class="toggle-button"
            @click=${this.executeSearch}
            title="Execute search"
          >
            🚀 Search
          </button>
        </div>
      </div>
    `;
  }

  private renderMainSearch() {
    return html`
      <div class="main-search-section">
        <div class="search-input-container">
          <div class="search-icon" aria-hidden="true">🔍</div>
          <input
            class="search-input"
            type="search"
            placeholder="Search messages, content, tool names, errors..."
            .value=${this.filterController.state.searchQuery}
            @input=${this.handleSearchInput}
            @keydown=${this.handleSearchKeydown}
            aria-label="Search query"
            autocomplete="off"
            spellcheck="false"
          />
          <div class="search-actions">
            ${this.filterController.state.searchQuery ? html`
              <button 
                class="search-action-button"
                @click=${this.clearSearch}
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            ` : ''}
            <button 
              class="search-action-button"
              @click=${this.executeSearch}
              title="Execute search"
              aria-label="Execute search"
            >
              ↵
            </button>
          </div>
        </div>

        ${this.showAdvancedOptions ? this.renderAdvancedOptions() : ''}
      </div>
    `;
  }

  private renderAdvancedOptions() {
    return html`
      <div class="search-options-bar">
        ${this.config.showRegexOption ? html`
          <div 
            class="search-option-chip ${this.searchOptions.regex ? 'active' : ''}"
            @click=${() => this.toggleSearchOption('regex')}
            role="button"
            tabindex="0"
            aria-pressed="${this.searchOptions.regex}"
            title="Use regular expressions"
          >
            .* Regex
          </div>
        ` : ''}

        <div 
          class="search-option-chip ${this.searchOptions.caseSensitive ? 'active' : ''}"
          @click=${() => this.toggleSearchOption('caseSensitive')}
          role="button"
          tabindex="0"
          aria-pressed="${this.searchOptions.caseSensitive}"
          title="Case sensitive search"
        >
          Aa Case Sensitive
        </div>

        <div 
          class="search-option-chip ${this.searchOptions.wholeWord ? 'active' : ''}"
          @click=${() => this.toggleSearchOption('wholeWord')}
          role="button"
          tabindex="0"
          aria-pressed="${this.searchOptions.wholeWord}"
          title="Match whole words only"
        >
          🔤 Whole Word
        </div>

        ${this.config.showFuzzySearch ? html`
          <div 
            class="search-option-chip ${(this.searchOptions.fuzzyThreshold || 0) < 1 ? 'active' : ''}"
            @click=${() => this.toggleFuzzySearch()}
            role="button"
            tabindex="0"
            title="Fuzzy search (approximate matching)"
          >
            🎯 Fuzzy (${Math.round((this.searchOptions.fuzzyThreshold || 0.7) * 100)}%)
          </div>
        ` : ''}

        <div class="search-option-chip">
          Search in: ${this.filterController.state.searchFields.join(', ')}
        </div>
      </div>
    `;
  }

  private renderQueryBuilder() {
    return html`
      <div class="query-builder">
        <div class="query-builder-header">
          <span>Query Builder</span>
          <button 
            class="toggle-button"
            @click=${this.addQueryCondition}
            title="Add condition"
          >
            ➕ Add Condition
          </button>
        </div>
        
        <div class="query-conditions">
          ${this.queryBuilderConditions.map(condition => this.renderQueryCondition(condition))}
        </div>
      </div>
    `;
  }

  private renderQueryCondition(condition: any) {
    return html`
      <div class="condition-row">
        <select 
          class="condition-select"
          .value=${condition.field}
          @change=${(e: Event) => this.updateCondition(condition.id, 'field', (e.target as HTMLSelectElement).value)}
        >
          <option value="content">Content</option>
          <option value="role">Role</option>
          <option value="toolName">Tool Name</option>
          <option value="error">Error</option>
          <option value="sessionId">Session ID</option>
        </select>
        
        <select 
          class="condition-select"
          .value=${condition.operator}
          @change=${(e: Event) => this.updateCondition(condition.id, 'operator', (e.target as HTMLSelectElement).value)}
        >
          <option value="contains">contains</option>
          <option value="equals">equals</option>
          <option value="startsWith">starts with</option>
          <option value="endsWith">ends with</option>
          <option value="regex">matches regex</option>
        </select>
        
        <input 
          class="condition-input"
          type="text"
          .value=${condition.value}
          @input=${(e: Event) => this.updateCondition(condition.id, 'value', (e.target as HTMLInputElement).value)}
          placeholder="Enter value..."
        />
        
        <button 
          class="condition-remove"
          @click=${() => this.removeQueryCondition(condition.id)}
          title="Remove condition"
        >
          ✕
        </button>
      </div>
    `;
  }

  private renderResults() {
    const results = this.lastSearchResults || { items: this.data, totalCount: this.data.length, filteredCount: this.data.length };
    
    return html`
      <div class="results-section">
        <div class="results-header">
          <div class="results-count">
            <span>
              ${results.filteredCount.toLocaleString()} of ${results.totalCount.toLocaleString()} items
            </span>
            ${this.searchPerformance ? html`
              <span class="performance-indicator">
                ${this.searchPerformance.duration.toFixed(1)}ms
              </span>
            ` : ''}
          </div>
          
          <div class="results-actions">
            <button class="toggle-button" @click=${this.exportResults} title="Export results">
              📤 Export
            </button>
            <button class="toggle-button" @click=${this.saveCurrentSearch} title="Save search">
              💾 Save
            </button>
          </div>
        </div>
        
        <div class="filter-content">
          <filter-panel
            .filterController=${this.filterController}
            .showAdvanced=${this.showAdvancedOptions}
            .collapsible=${true}
            .collapsed=${false}
          ></filter-panel>
        </div>
      </div>
    `;
  }

  private renderTagFilters() {
    if (!this.tagFilters.length) return '';
    
    return html`
      <div class="tag-filters-section">
        <div class="tag-filters-header">
          <h3 class="tag-filters-title">Filter by Tags</h3>
          <button 
            class="toggle-button"
            @click=${this.clearTagFilters}
            title="Clear tag filters"
            ?disabled=${!this.tagFilters.some(tag => tag.isActive)}
          >
            Clear Tags
          </button>
        </div>
        
        <div class="tag-filters-grid">
          ${this.tagFilters.map(tag => this.renderTagFilter(tag))}
        </div>
      </div>
    `;
  }

  private renderTagFilter(tag: TagFilter) {
    return html`
      <div 
        class="tag-filter-chip ${tag.isActive ? 'active' : ''}"
        style="--tag-color: ${tag.color}; --tag-color-rgb: ${this.hexToRgb(tag.color)}"
        @click=${() => this.toggleTagFilter(tag.id)}
        role="button"
        tabindex="0"
        aria-pressed="${tag.isActive}"
        title="Filter by ${tag.name}"
      >
        <div class="tag-color-indicator"></div>
        <span>${tag.name}</span>
        ${tag.count !== undefined ? html`
          <span class="tag-count">(${tag.count})</span>
        ` : ''}
      </div>
    `;
  }

  private renderPagination() {
    const { page, pageSize, total } = this.pagination;
    const totalPages = Math.ceil(total / pageSize);
    const startItem = page * pageSize + 1;
    const endItem = Math.min((page + 1) * pageSize, total);

    if (totalPages <= 1) return '';

    return html`
      <div class="pagination-section">
        <div class="pagination-info">
          Showing ${startItem}-${endItem} of ${total.toLocaleString()}
        </div>
        
        <div class="pagination-controls">
          <button 
            class="pagination-button"
            @click=${() => this.changePage(0)}
            ?disabled=${page === 0}
            title="First page"
          >
            ⏮️
          </button>
          
          <button 
            class="pagination-button"
            @click=${() => this.changePage(page - 1)}
            ?disabled=${page === 0}
            title="Previous page"
          >
            ◀️
          </button>
          
          ${this.renderPageNumbers(page, totalPages)}
          
          <button 
            class="pagination-button"
            @click=${() => this.changePage(page + 1)}
            ?disabled=${page >= totalPages - 1}
            title="Next page"
          >
            ▶️
          </button>
          
          <button 
            class="pagination-button"
            @click=${() => this.changePage(totalPages - 1)}
            ?disabled=${page >= totalPages - 1}
            title="Last page"
          >
            ⏭️
          </button>
        </div>
      </div>
    `;
  }

  private renderPageNumbers(currentPage: number, totalPages: number) {
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(0, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(html`
        <button 
          class="pagination-button ${i === currentPage ? 'active' : ''}"
          @click=${() => this.changePage(i)}
          title="Page ${i + 1}"
        >
          ${i + 1}
        </button>
      `);
    }

    return pages;
  }

  private renderSearchHistory() {
    if (!this.searchHistory.length) return '';
    
    return html`
      <div class="search-history">
        <div class="history-header">
          <span>🕰️ Recent Searches</span>
          <button 
            class="toggle-button"
            @click=${this.clearSearchHistory}
            title="Clear search history"
          >
            Clear History
          </button>
        </div>
        
        <div class="history-list">
          ${this.searchHistory.slice(0, this.config.maxSearchHistory).map(query => this.renderHistoryItem(query))}
        </div>
      </div>
    `;
  }

  private renderHistoryItem(query: SearchQuery) {
    return html`
      <div class="history-item" @click=${() => this.applyHistoryQuery(query)}>
        <span class="history-text">${query.text}</span>
        <span class="history-timestamp">${this.formatTimestamp(query.timestamp)}</span>
      </div>
    `;
  }

  // Event Handlers

  private handleSearchInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    this.filterController.setSearchQuery(input.value);
  };

  private handleSearchKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.executeSearch();
    } else if (event.key === 'Escape') {
      this.clearSearch();
    }
  };

  private toggleAdvancedOptions = () => {
    this.showAdvancedOptions = !this.showAdvancedOptions;
  };

  private toggleQueryBuilder = () => {
    this.showQueryBuilder = !this.showQueryBuilder;
  };

  private toggleSearchOption = (option: keyof SearchOptions) => {
    this.searchOptions = {
      ...this.searchOptions,
      [option]: !this.searchOptions[option],
    };
    this.requestUpdate();
  };

  private toggleFuzzySearch = () => {
    const current = this.searchOptions.fuzzyThreshold || 0.7;
    this.searchOptions = {
      ...this.searchOptions,
      fuzzyThreshold: current < 1 ? 1 : 0.7,
    };
    this.requestUpdate();
  };

  private clearSearch = () => {
    this.filterController.clearSearch();
    this.searchInput?.focus();
  };

  private clearAllFilters = () => {
    this.filterController.clearAllFilters();
    this.tagFilters.forEach(tag => tag.isActive = false);
    this.queryBuilderConditions = [];
    this.executeSearch();
  };

  private executeSearch = () => {
    const state = this.filterController.state;
    
    // Add to search history
    if (state.searchQuery && this.config.enableSearchHistory) {
      this.addToSearchHistory({
        text: state.searchQuery,
        fields: state.searchFields,
        options: { ...this.searchOptions },
        timestamp: new Date(),
      });
    }

    // Filter the data
    const results = this.filterController.filterMessages(this.data, this.searchOptions);
    
    this.lastSearchResults = results;
    this.searchPerformance = results.performance;
    this.pagination = {
      ...this.pagination,
      total: results.filteredCount,
      page: 0,
    };

    // Emit search event
    this.emitEvent('search-executed', {
      query: state.searchQuery,
      results: results.items,
      totalResults: results.filteredCount,
      performance: results.performance,
      filters: state,
    });

    this.requestUpdate();
  };

  private addQueryCondition = () => {
    this.queryBuilderConditions = [
      ...this.queryBuilderConditions,
      {
        id: `condition_${Date.now()}`,
        field: 'content',
        operator: 'contains',
        value: '',
      },
    ];
  };

  private removeQueryCondition = (id: string) => {
    this.queryBuilderConditions = this.queryBuilderConditions.filter(c => c.id !== id);
  };

  private updateCondition = (id: string, field: string, value: string) => {
    this.queryBuilderConditions = this.queryBuilderConditions.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    );
  };

  private toggleTagFilter = (tagId: string) => {
    const tag = this.tagFilters.find(t => t.id === tagId);
    if (tag) {
      tag.isActive = !tag.isActive;
      this.executeSearch();
    }
  };

  private clearTagFilters = () => {
    this.tagFilters.forEach(tag => tag.isActive = false);
    this.executeSearch();
  };

  private changePage = (page: number) => {
    this.pagination = { ...this.pagination, page };
    this.emitEvent('page-changed', { page });
    this.requestUpdate();
  };

  private addToSearchHistory = (query: SearchQuery) => {
    // Remove duplicate if exists
    const filtered = this.searchHistory.filter(q => q.text !== query.text);
    
    // Add new query at the beginning
    this.searchHistory = [query, ...filtered].slice(0, this.config.maxSearchHistory || 10);
    
    if (this.config.persistFilters) {
      this.saveSearchHistory();
    }
  };

  private applyHistoryQuery = (query: SearchQuery) => {
    this.filterController.setSearchQuery(query.text, 0);
    this.filterController.setSearchFields(query.fields);
    this.searchOptions = { ...query.options };
    this.executeSearch();
  };

  private clearSearchHistory = () => {
    this.searchHistory = [];
    if (this.config.persistFilters) {
      this.saveSearchHistory();
    }
  };

  private saveCurrentSearch = () => {
    const state = this.filterController.state;
    if (state.searchQuery) {
      const preset = this.filterController.addPreset(
        `Search: ${state.searchQuery.substring(0, 30)}...`,
        `Saved search query with ${this.lastSearchResults?.filteredCount || 0} results`
      );
      
      this.emitEvent('search-saved', {
        presetId: preset,
        query: state.searchQuery,
        results: this.lastSearchResults?.filteredCount || 0,
      });
    }
  };

  private exportResults = () => {
    const results = this.lastSearchResults?.items || this.data;
    
    this.emitEvent('export-requested', {
      data: results,
      format: 'json', // Could be made configurable
      filename: `search-results-${new Date().toISOString().split('T')[0]}.json`,
    });
  };

  // Utility Methods

  private updateTagFilterCounts = () => {
    // This would typically count occurrences in the data
    this.tagFilters.forEach(tag => {
      tag.count = this.data.filter(item => 
        item.tags && item.tags.includes(tag.id)
      ).length;
    });
  };

  private formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return date.toLocaleDateString();
  };

  private hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '13, 110, 253';
  };

  private saveSearchHistory = () => {
    try {
      localStorage.setItem('search-filter-history', JSON.stringify(this.searchHistory));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  };

  private loadSearchHistory = () => {
    try {
      const saved = localStorage.getItem('search-filter-history');
      if (saved) {
        this.searchHistory = JSON.parse(saved).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
      this.searchHistory = [];
    }
  };

  // Public API

  /**
   * Set the data to be filtered
   */
  setData(data: any[]) {
    this.data = data;
    this.updateTagFilterCounts();
    this.executeSearch();
  }

  /**
   * Set tag filters
   */
  setTagFilters(tags: TagFilter[]) {
    this.tagFilters = tags;
    this.updateTagFilterCounts();
  }

  /**
   * Get current search results
   */
  getCurrentResults() {
    return this.lastSearchResults;
  }

  /**
   * Get search matches for highlighting
   */
  getSearchMatches(): Map<string, SearchMatch[]> | undefined {
    return this.filterController.getSearchMatches();
  }

  /**
   * Apply a saved filter preset
   */
  applyPreset(presetId: string) {
    this.filterController.applyPreset(presetId);
    this.executeSearch();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'search-filter-component': SearchFilterComponent;
  }
}