import { html, css, CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import './SearchFilterComponent';
import type { TagFilter, SearchFilterConfig } from './SearchFilterComponent';
import type { Message } from './FilterEngine';

/**
 * Demo component for SearchFilterComponent
 * Shows all the advanced filtering capabilities
 */
@customElement('search-filter-demo')
export class SearchFilterDemo extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: var(--space-lg);
        background: var(--color-background);
        min-height: 100vh;
      }

      .demo-container {
        max-width: 1400px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: var(--space-xl);
        height: calc(100vh - 4rem);
      }

      .demo-sidebar {
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .demo-content {
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        padding: var(--space-lg);
        overflow: auto;
      }

      .demo-header {
        padding: var(--space-lg);
        border-bottom: 1px solid var(--color-border);
        text-align: center;
      }

      .demo-title {
        margin: 0 0 var(--space-md) 0;
        font-size: var(--font-size-xxl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
      }

      .demo-description {
        margin: 0;
        color: var(--color-text-secondary);
        line-height: 1.5;
      }

      .demo-controls {
        padding: var(--space-md);
        border-bottom: 1px solid var(--color-border);
        background: var(--color-background-tertiary);
      }

      .control-group {
        margin-bottom: var(--space-md);
      }

      .control-label {
        display: block;
        margin-bottom: var(--space-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
      }

      .control-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        margin-right: var(--space-xs);
        margin-bottom: var(--space-xs);
        cursor: pointer;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        transition: all var(--transition-fast);
      }

      .control-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .control-button.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .results-display {
        margin-top: var(--space-lg);
      }

      .results-header {
        margin-bottom: var(--space-md);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .results-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0;
      }

      .results-stats {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .message-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .message-item {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        transition: all var(--transition-fast);
      }

      .message-item:hover {
        border-color: var(--color-primary);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .message-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-sm);
      }

      .message-role {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        font-weight: var(--font-weight-semibold);
        font-size: var(--font-size-sm);
      }

      .message-role.user { color: var(--color-success); }
      .message-role.assistant { color: var(--color-primary); }
      .message-role.system { color: var(--color-warning); }
      .message-role.error { color: var(--color-error); }

      .message-timestamp {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }

      .message-content {
        color: var(--color-text-primary);
        line-height: 1.5;
        white-space: pre-wrap;
        max-height: 200px;
        overflow-y: auto;
      }

      .message-metadata {
        margin-top: var(--space-sm);
        padding-top: var(--space-sm);
        border-top: 1px solid var(--color-border-light);
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        display: flex;
        gap: var(--space-md);
      }

      .no-results {
        text-align: center;
        padding: var(--space-xxl);
        color: var(--color-text-muted);
      }

      .no-results-icon {
        font-size: 4rem;
        margin-bottom: var(--space-md);
        opacity: 0.5;
      }

      @media (max-width: 1024px) {
        .demo-container {
          grid-template-columns: 1fr;
          grid-template-rows: auto 1fr;
          gap: var(--space-lg);
        }
      }
    `,
  ];

  @state()
  private sampleData: Message[] = [];

  @state()
  private filteredData: Message[] = [];

  @state()
  private tagFilters: TagFilter[] = [];

  @state()
  private searchConfig: SearchFilterConfig = {
    showAdvancedSearch: true,
    showRegexOption: true,
    showFuzzySearch: true,
    showDatePicker: true,
    showTagFilters: true,
    showSessionFilters: true,
    enableQueryBuilder: true,
    enableSearchHistory: true,
    persistFilters: true,
    maxSearchHistory: 15,
  };

  @state()
  private currentStats = {
    totalResults: 0,
    searchTime: 0,
    filtersActive: 0,
  };

  connectedCallback() {
    super.connectedCallback();
    this.generateSampleData();
    this.initializeTagFilters();
    this.filteredData = this.sampleData;
    this.currentStats.totalResults = this.sampleData.length;
  }

  render() {
    return html`
      <div class="demo-container">
        <div class="demo-sidebar">
          ${this.renderDemoHeader()}
          ${this.renderDemoControls()}
          <search-filter-component
            .config=${this.searchConfig}
            .data=${this.sampleData}
            .tagFilters=${this.tagFilters}
            @search-executed=${this.handleSearchExecuted}
            @export-requested=${this.handleExportRequested}
            @search-saved=${this.handleSearchSaved}
          ></search-filter-component>
        </div>
        
        <div class="demo-content">
          ${this.renderResults()}
        </div>
      </div>
    `;
  }

  private renderDemoHeader() {
    return html`
      <div class="demo-header">
        <h1 class="demo-title">🔍 Advanced Search & Filter Demo</h1>
        <p class="demo-description">
          Comprehensive search and filtering system with full-text search, 
          date ranges, tag-based filtering, and advanced query builder capabilities.
        </p>
      </div>
    `;
  }

  private renderDemoControls() {
    return html`
      <div class="demo-controls">
        <div class="control-group">
          <label class="control-label">Sample Data Sets</label>
          <button class="control-button" @click=${() => this.loadDataSet('mixed')}>
            Mixed Messages (${this.sampleData.length})
          </button>
          <button class="control-button" @click=${() => this.loadDataSet('large')}>
            Large Dataset (1000+)
          </button>
          <button class="control-button" @click=${() => this.loadDataSet('errors')}>
            Error Messages Only
          </button>
        </div>

        <div class="control-group">
          <label class="control-label">Feature Toggles</label>
          <button 
            class="control-button ${this.searchConfig.showAdvancedSearch ? 'active' : ''}"
            @click=${() => this.toggleFeature('showAdvancedSearch')}
          >
            Advanced Search
          </button>
          <button 
            class="control-button ${this.searchConfig.showRegexOption ? 'active' : ''}"
            @click=${() => this.toggleFeature('showRegexOption')}
          >
            Regex Support
          </button>
          <button 
            class="control-button ${this.searchConfig.showFuzzySearch ? 'active' : ''}"
            @click=${() => this.toggleFeature('showFuzzySearch')}
          >
            Fuzzy Search
          </button>
          <button 
            class="control-button ${this.searchConfig.enableQueryBuilder ? 'active' : ''}"
            @click=${() => this.toggleFeature('enableQueryBuilder')}
          >
            Query Builder
          </button>
        </div>

        <div class="control-group">
          <label class="control-label">Quick Actions</label>
          <button class="control-button" @click=${this.addSampleMessage}>
            ➕ Add Message
          </button>
          <button class="control-button" @click=${this.clearAllData}>
            🗑️ Clear Data
          </button>
          <button class="control-button" @click=${this.exportCurrentResults}>
            📤 Export Results
          </button>
        </div>
      </div>
    `;
  }

  private renderResults() {
    return html`
      <div class="results-display">
        <div class="results-header">
          <h2 class="results-title">Search Results</h2>
          <div class="results-stats">
            ${this.currentStats.totalResults.toLocaleString()} results
            ${this.currentStats.searchTime > 0 ? html`
              • ${this.currentStats.searchTime}ms
            ` : ''}
            ${this.currentStats.filtersActive > 0 ? html`
              • ${this.currentStats.filtersActive} filters active
            ` : ''}
          </div>
        </div>

        ${this.filteredData.length > 0 ? html`
          <div class="message-list">
            ${this.filteredData.slice(0, 50).map(message => this.renderMessage(message))}
            ${this.filteredData.length > 50 ? html`
              <div class="message-item" style="text-align: center; font-style: italic;">
                ... and ${this.filteredData.length - 50} more results
              </div>
            ` : ''}
          </div>
        ` : html`
          <div class="no-results">
            <div class="no-results-icon">🔍</div>
            <div>No results found</div>
            <div style="margin-top: var(--space-sm); font-size: var(--font-size-sm);">
              Try adjusting your search terms or filters
            </div>
          </div>
        `}
      </div>
    `;
  }

  private renderMessage(message: Message) {
    const roleIcons = {
      user: '👤',
      assistant: '🤖',
      system: '⚙️',
      error: '❌',
    };

    return html`
      <div class="message-item">
        <div class="message-header">
          <div class="message-role ${message.role}">
            ${roleIcons[message.role as keyof typeof roleIcons] || '💬'}
            ${message.role || 'unknown'}
          </div>
          <div class="message-timestamp">
            ${message.timestamp ? this.formatTimestamp(message.timestamp) : 'Unknown time'}
          </div>
        </div>
        
        <div class="message-content">
          ${message.content || message.error || 'No content'}
        </div>
        
        <div class="message-metadata">
          ${message.sessionId ? html`<span>Session: ${message.sessionId}</span>` : ''}
          ${message.tool_name ? html`<span>Tool: ${message.tool_name}</span>` : ''}
          ${message.tokens ? html`<span>Tokens: ${message.tokens}</span>` : ''}
          ${message.id ? html`<span>ID: ${message.id}</span>` : ''}
        </div>
      </div>
    `;
  }

  // Event Handlers

  private handleSearchExecuted = (event: CustomEvent) => {
    const { results, totalResults, performance, filters } = event.detail;
    this.filteredData = results;
    this.currentStats = {
      totalResults,
      searchTime: performance?.duration || 0,
      filtersActive: this.countActiveFilters(filters),
    };
  };

  private handleExportRequested = (event: CustomEvent) => {
    const { data, format, filename } = event.detail;
    this.downloadData(data, filename, format);
  };

  private handleSearchSaved = (event: CustomEvent) => {
    const { presetId, query, results } = event.detail;
    console.log('Search saved:', { presetId, query, results });
    // Could show a toast notification here
  };

  // Demo Control Methods

  private loadDataSet(type: string) {
    switch (type) {
      case 'mixed':
        this.generateSampleData();
        break;
      case 'large':
        this.generateLargeDataSet();
        break;
      case 'errors':
        this.generateErrorMessages();
        break;
    }
    this.filteredData = this.sampleData;
    this.currentStats.totalResults = this.sampleData.length;
  }

  private toggleFeature(feature: keyof SearchFilterConfig) {
    this.searchConfig = {
      ...this.searchConfig,
      [feature]: !this.searchConfig[feature],
    };
  }

  private addSampleMessage() {
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      role: ['user', 'assistant', 'system'][Math.floor(Math.random() * 3)] as any,
      content: `Sample message added at ${new Date().toLocaleTimeString()}`,
      timestamp: new Date(),
      sessionId: `session_${Math.floor(Math.random() * 10) + 1}`,
      tokens: Math.floor(Math.random() * 100) + 10,
    };

    this.sampleData = [newMessage, ...this.sampleData];
    this.filteredData = this.sampleData;
    this.currentStats.totalResults = this.sampleData.length;
  }

  private clearAllData() {
    this.sampleData = [];
    this.filteredData = [];
    this.currentStats.totalResults = 0;
  }

  private exportCurrentResults() {
    this.downloadData(this.filteredData, 'search-results.json', 'json');
  }

  // Data Generation Methods

  private generateSampleData() {
    const roles: Array<'user' | 'assistant' | 'system' | 'error'> = ['user', 'assistant', 'system', 'error'];
    const sampleContents = [
      'Hello, I need help with my code.',
      'I can help you with that. What programming language are you using?',
      'System initialization complete.',
      'Error: Cannot connect to database.',
      'How do I implement a search feature?',
      'Here\'s how you can implement search functionality...',
      'User session started.',
      'Failed to load configuration file.',
      'What are the best practices for React components?',
      'For React best practices, consider these points...',
      'Memory usage: 85% - Warning threshold reached.',
      'Syntax error in line 42: unexpected token.',
      'Can you explain async/await in JavaScript?',
      'Async/await is a syntactic sugar for promises...',
      'Backup completed successfully.',
      'Network timeout error occurred.',
    ];

    const toolNames = ['search-api', 'database-connector', 'file-processor', 'auth-service', 'cache-manager'];

    this.sampleData = Array.from({ length: 100 }, (_, i) => {
      const role = roles[Math.floor(Math.random() * roles.length)];
      const isError = role === 'error';
      
      return {
        id: `msg_${1000 + i}`,
        role,
        content: isError ? undefined : sampleContents[Math.floor(Math.random() * sampleContents.length)],
        error: isError ? 'Sample error message for testing filters' : undefined,
        tool_name: Math.random() > 0.7 ? toolNames[Math.floor(Math.random() * toolNames.length)] : undefined,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Last 30 days
        sessionId: `session_${Math.floor(Math.random() * 20) + 1}`,
        tokens: Math.floor(Math.random() * 200) + 10,
        metadata: {
          source: Math.random() > 0.5 ? 'web' : 'api',
          priority: Math.random() > 0.7 ? 'high' : 'normal',
        },
      } as Message;
    });
  }

  private generateLargeDataSet() {
    this.generateSampleData();
    // Multiply the dataset
    const multiplier = 15;
    const original = [...this.sampleData];
    
    for (let i = 1; i < multiplier; i++) {
      const batch = original.map(msg => ({
        ...msg,
        id: `${msg.id}_${i}`,
        timestamp: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Last year
        sessionId: `session_${Math.floor(Math.random() * 100) + 1}`,
      }));
      this.sampleData.push(...batch);
    }
  }

  private generateErrorMessages() {
    const errorMessages = [
      'Connection timeout after 30 seconds',
      'Invalid API key provided',
      'Database query failed: table not found',
      'Memory allocation error: out of bounds',
      'File not found: config.json',
      'Parse error: malformed JSON',
      'Authentication failed: invalid credentials',
      'Rate limit exceeded: try again later',
      'Server error: internal processing failed',
      'Network unreachable: check connection',
    ];

    this.sampleData = Array.from({ length: 50 }, (_, i) => ({
      id: `error_${i}`,
      role: 'error' as const,
      error: errorMessages[Math.floor(Math.random() * errorMessages.length)],
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Last week
      sessionId: `session_${Math.floor(Math.random() * 10) + 1}`,
      metadata: {
        errorCode: Math.floor(Math.random() * 500) + 400,
        severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
      },
    }));
  }

  private initializeTagFilters() {
    this.tagFilters = [
      { id: 'web', name: 'Web', color: '#007bff', isActive: false },
      { id: 'api', name: 'API', color: '#28a745', isActive: false },
      { id: 'database', name: 'Database', color: '#dc3545', isActive: false },
      { id: 'auth', name: 'Authentication', color: '#fd7e14', isActive: false },
      { id: 'performance', name: 'Performance', color: '#6610f2', isActive: false },
      { id: 'security', name: 'Security', color: '#e83e8c', isActive: false },
      { id: 'debugging', name: 'Debugging', color: '#20c997', isActive: false },
      { id: 'integration', name: 'Integration', color: '#6c757d', isActive: false },
    ];
  }

  // Utility Methods

  private countActiveFilters(filters: any): number {
    let count = 0;
    if (filters.searchQuery) count++;
    if (filters.messageTypes && filters.messageTypes.length < 4) count++;
    if (filters.dateRange && (filters.dateRange.start || filters.dateRange.end)) count++;
    if (filters.sessionIds && filters.sessionIds.length > 0) count++;
    return count;
  }

  private formatTimestamp(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private downloadData(data: any, filename: string, format: string) {
    let content: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
    } else if (format === 'csv') {
      // Simple CSV conversion
      const headers = Object.keys(data[0] || {});
      const rows = data.map((item: any) => 
        headers.map(header => 
          typeof item[header] === 'object' 
            ? JSON.stringify(item[header]) 
            : String(item[header] || '')
        ).join(',')
      );
      content = [headers.join(','), ...rows].join('\n');
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'search-filter-demo': SearchFilterDemo;
  }
}