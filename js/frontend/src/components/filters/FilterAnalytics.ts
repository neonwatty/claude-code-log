import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { FilterController } from './FilterController';

export interface AnalyticsData {
  filterUsage: { [key: string]: number };
  performance: {
    cacheHitRate: number;
    cacheSize: number;
    totalQueries: number;
    cacheHits: number;
  };
  searchMetrics: {
    totalSearches: number;
    averageResultCount: number;
    popularSearchTerms: { term: string; count: number }[];
    searchPerformance: { term: string; avgTime: number }[];
  };
  userBehavior: {
    mostUsedFilters: { filter: string; count: number }[];
    filterCombinations: { combination: string[]; count: number }[];
    sessionDuration: number;
    filtersPerSession: number;
  };
}

/**
 * Analytics dashboard for filter usage and performance metrics
 */
@customElement('filter-analytics')
export class FilterAnalytics extends BaseComponent {
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

      .analytics-container {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .analytics-header {
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border);
        padding: var(--space-md);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .analytics-title {
        margin: 0;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }

      .refresh-button {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: none;
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        font-size: var(--font-size-sm);
        cursor: pointer;
        transition: background var(--transition-fast);
      }

      .refresh-button:hover {
        background: var(--color-primary-dark);
      }

      .analytics-content {
        padding: var(--space-md);
        flex: 1;
        overflow-y: auto;
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--space-md);
        margin-bottom: var(--space-lg);
      }

      .metric-card {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
      }

      .metric-title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-sm) 0;
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .metric-icon {
        font-size: var(--font-size-lg);
      }

      .metric-value {
        font-size: var(--font-size-xxl);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        margin: var(--space-sm) 0;
      }

      .metric-description {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: 0;
      }

      .metric-trend {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        padding: 2px 6px;
        border-radius: var(--border-radius-full);
        margin-top: var(--space-xs);
        display: inline-block;
      }

      .metric-trend.positive {
        background: var(--color-success-light);
        color: var(--color-success-dark);
      }

      .metric-trend.negative {
        background: var(--color-error-light);
        color: var(--color-error-dark);
      }

      .metric-trend.neutral {
        background: var(--color-background-tertiary);
        color: var(--color-text-muted);
      }

      .charts-section {
        margin-bottom: var(--space-lg);
      }

      .section-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-md) 0;
      }

      .chart-container {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        margin-bottom: var(--space-md);
      }

      .chart-title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-md) 0;
      }

      .bar-chart {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .bar-item {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .bar-label {
        min-width: 120px;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .bar-visual {
        flex: 1;
        height: 20px;
        background: var(--color-background-tertiary);
        border-radius: var(--border-radius);
        position: relative;
        overflow: hidden;
      }

      .bar-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light));
        border-radius: var(--border-radius);
        transition: width var(--transition-normal);
        position: relative;
      }

      .bar-fill::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2));
        border-radius: var(--border-radius);
      }

      .bar-value {
        min-width: 40px;
        text-align: right;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }

      .pie-chart {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-md);
        align-items: center;
      }

      .pie-visual {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: conic-gradient(
          var(--color-primary) 0deg,
          var(--color-primary) var(--percentage, 0deg),
          var(--color-background-tertiary) var(--percentage, 0deg)
        );
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      .pie-center {
        width: 60px;
        height: 60px;
        background: var(--color-background);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }

      .pie-legend {
        flex: 1;
        min-width: 200px;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: var(--space-xs);
      }

      .legend-color {
        width: 12px;
        height: 12px;
        border-radius: 2px;
      }

      .legend-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .legend-value {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin-left: auto;
      }

      .insights-section {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
      }

      .insight-item {
        display: flex;
        align-items: flex-start;
        gap: var(--space-sm);
        margin-bottom: var(--space-sm);
        padding-bottom: var(--space-sm);
        border-bottom: 1px solid var(--color-border);
      }

      .insight-item:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
      }

      .insight-icon {
        font-size: var(--font-size-base);
        margin-top: 2px;
      }

      .insight-content {
        flex: 1;
      }

      .insight-title {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-xs) 0;
      }

      .insight-description {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: 0;
        line-height: 1.4;
      }

      .empty-state {
        text-align: center;
        padding: var(--space-xxl);
        color: var(--color-text-muted);
      }

      .empty-state-icon {
        font-size: 3rem;
        margin-bottom: var(--space-md);
      }

      @media (max-width: 768px) {
        .metrics-grid {
          grid-template-columns: 1fr;
        }
        
        .pie-chart {
          justify-content: center;
        }
      }
    `,
  ];

  /**
   * Filter controller to get analytics from
   */
  @property({ type: Object })
  filterController?: FilterController;

  /**
   * Whether to auto-refresh analytics data
   */
  @property({ type: Boolean })
  autoRefresh = false;

  /**
   * Auto-refresh interval in milliseconds
   */
  @property({ type: Number })
  refreshInterval = 30000; // 30 seconds

  @state()
  private analyticsData: AnalyticsData | null = null;

  @state()
  private loading = false;

  @state()
  private lastRefresh: Date | null = null;

  private refreshTimer: number | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.refreshAnalytics();
    
    if (this.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopAutoRefresh();
  }

  render() {
    if (this.loading && !this.analyticsData) {
      return this.renderLoadingState();
    }

    if (!this.analyticsData) {
      return this.renderEmptyState();
    }

    return html`
      <div class="analytics-container">
        ${this.renderHeader()}
        ${this.renderContent()}
      </div>
    `;
  }

  private renderHeader() {
    return html`
      <div class="analytics-header">
        <h2 class="analytics-title">📊 Filter Analytics</h2>
        <button 
          class="refresh-button" 
          @click=${this.refreshAnalytics}
          ?disabled=${this.loading}
        >
          ${this.loading ? '⟳' : '🔄'} Refresh
        </button>
      </div>
    `;
  }

  private renderContent() {
    if (!this.analyticsData) return '';

    return html`
      <div class="analytics-content">
        ${this.renderMetricsGrid()}
        ${this.renderCharts()}
        ${this.renderInsights()}
      </div>
    `;
  }

  private renderMetricsGrid() {
    const data = this.analyticsData!;
    
    return html`
      <div class="metrics-grid">
        <div class="metric-card">
          <h3 class="metric-title">
            <span class="metric-icon">🎯</span>
            Cache Hit Rate
          </h3>
          <div class="metric-value">${(data.performance.cacheHitRate * 100).toFixed(1)}%</div>
          <p class="metric-description">
            ${data.performance.cacheHits} hits out of ${data.performance.totalQueries} queries
          </p>
          <span class="metric-trend ${this.getCacheTrend()}">
            ${this.getCacheTrendText()}
          </span>
        </div>

        <div class="metric-card">
          <h3 class="metric-title">
            <span class="metric-icon">🔍</span>
            Total Searches
          </h3>
          <div class="metric-value">${data.searchMetrics.totalSearches}</div>
          <p class="metric-description">
            Average ${data.searchMetrics.averageResultCount} results per search
          </p>
        </div>

        <div class="metric-card">
          <h3 class="metric-title">
            <span class="metric-icon">⚡</span>
            Performance
          </h3>
          <div class="metric-value">${data.performance.cacheSize}</div>
          <p class="metric-description">
            Cache entries, ${this.getAverageSearchTime()}ms avg search time
          </p>
        </div>

        <div class="metric-card">
          <h3 class="metric-title">
            <span class="metric-icon">👤</span>
            Session Metrics
          </h3>
          <div class="metric-value">${data.userBehavior.filtersPerSession.toFixed(1)}</div>
          <p class="metric-description">
            Average filters per session, ${Math.round(data.userBehavior.sessionDuration / 60)}min session
          </p>
        </div>
      </div>
    `;
  }

  private renderCharts() {
    const data = this.analyticsData!;
    
    return html`
      <div class="charts-section">
        <h2 class="section-title">Usage Patterns</h2>
        
        <div class="chart-container">
          <h3 class="chart-title">Most Used Filters</h3>
          <div class="bar-chart">
            ${data.userBehavior.mostUsedFilters.slice(0, 5).map(item => {
              const maxCount = Math.max(...data.userBehavior.mostUsedFilters.map(f => f.count));
              const percentage = (item.count / maxCount) * 100;
              
              return html`
                <div class="bar-item">
                  <div class="bar-label">${item.filter}</div>
                  <div class="bar-visual">
                    <div class="bar-fill" style="width: ${percentage}%"></div>
                  </div>
                  <div class="bar-value">${item.count}</div>
                </div>
              `;
            })}
          </div>
        </div>

        <div class="chart-container">
          <h3 class="chart-title">Popular Search Terms</h3>
          <div class="bar-chart">
            ${data.searchMetrics.popularSearchTerms.slice(0, 5).map(item => {
              const maxCount = Math.max(...data.searchMetrics.popularSearchTerms.map(t => t.count));
              const percentage = (item.count / maxCount) * 100;
              
              return html`
                <div class="bar-item">
                  <div class="bar-label">"${item.term}"</div>
                  <div class="bar-visual">
                    <div class="bar-fill" style="width: ${percentage}%"></div>
                  </div>
                  <div class="bar-value">${item.count}</div>
                </div>
              `;
            })}
          </div>
        </div>

        <div class="chart-container">
          <h3 class="chart-title">Filter Type Distribution</h3>
          <div class="pie-chart">
            <div class="pie-visual" style="--percentage: ${this.getFilterDistributionPercentage()}deg">
              <div class="pie-center">${Object.keys(data.filterUsage).length}</div>
            </div>
            <div class="pie-legend">
              ${Object.entries(data.filterUsage).slice(0, 5).map((entry, index) => {
                const colors = ['var(--color-primary)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-info)', 'var(--color-secondary)'];
                return html`
                  <div class="legend-item">
                    <div class="legend-color" style="background-color: ${colors[index % colors.length]}"></div>
                    <div class="legend-label">${entry[0]}</div>
                    <div class="legend-value">${entry[1]}</div>
                  </div>
                `;
              })}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderInsights() {
    const insights = this.generateInsights();
    
    return html`
      <div class="insights-section">
        <h2 class="section-title">📈 Insights & Recommendations</h2>
        ${insights.map(insight => html`
          <div class="insight-item">
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-content">
              <h4 class="insight-title">${insight.title}</h4>
              <p class="insight-description">${insight.description}</p>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private renderLoadingState() {
    return html`
      <div class="analytics-container">
        <div class="analytics-header">
          <h2 class="analytics-title">📊 Filter Analytics</h2>
          <span>Loading...</span>
        </div>
        <div class="analytics-content">
          <div class="empty-state">
            <div class="empty-state-icon">⟳</div>
            <div>Loading analytics data...</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="analytics-container">
        <div class="analytics-header">
          <h2 class="analytics-title">📊 Filter Analytics</h2>
          <button class="refresh-button" @click=${this.refreshAnalytics}>
            🔄 Load Data
          </button>
        </div>
        <div class="analytics-content">
          <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <div>No analytics data available</div>
            <div style="font-size: var(--font-size-sm); margin-top: var(--space-sm);">
              Start using filters to see analytics
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private async refreshAnalytics() {
    this.loading = true;
    
    try {
      // Simulate loading time for demo
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.analyticsData = this.generateMockAnalytics();
      this.lastRefresh = new Date();
      
      this.emitEvent('analytics-refreshed', { data: this.analyticsData });
    } finally {
      this.loading = false;
    }
  }

  private generateMockAnalytics(): AnalyticsData {
    return {
      filterUsage: {
        'search': Math.floor(Math.random() * 100) + 50,
        'messageType_user': Math.floor(Math.random() * 50) + 20,
        'messageType_assistant': Math.floor(Math.random() * 50) + 20,
        'dateRange': Math.floor(Math.random() * 30) + 10,
        'preset_recent': Math.floor(Math.random() * 25) + 5,
        'clearAll': Math.floor(Math.random() * 15) + 3,
      },
      performance: {
        cacheHitRate: Math.random() * 0.4 + 0.6, // 60-100%
        cacheSize: Math.floor(Math.random() * 100) + 50,
        totalQueries: Math.floor(Math.random() * 500) + 200,
        cacheHits: 0, // Will be calculated
      },
      searchMetrics: {
        totalSearches: Math.floor(Math.random() * 200) + 100,
        averageResultCount: Math.floor(Math.random() * 20) + 5,
        popularSearchTerms: [
          { term: 'error', count: Math.floor(Math.random() * 50) + 20 },
          { term: 'function', count: Math.floor(Math.random() * 40) + 15 },
          { term: 'component', count: Math.floor(Math.random() * 35) + 10 },
          { term: 'api', count: Math.floor(Math.random() * 30) + 8 },
          { term: 'test', count: Math.floor(Math.random() * 25) + 5 },
        ].sort((a, b) => b.count - a.count),
        searchPerformance: [
          { term: 'simple', avgTime: Math.random() * 10 + 5 },
          { term: 'complex', avgTime: Math.random() * 30 + 15 },
          { term: 'fuzzy', avgTime: Math.random() * 50 + 25 },
        ],
      },
      userBehavior: {
        mostUsedFilters: [
          { filter: 'Search Query', count: Math.floor(Math.random() * 80) + 40 },
          { filter: 'Message Types', count: Math.floor(Math.random() * 60) + 30 },
          { filter: 'Date Range', count: Math.floor(Math.random() * 40) + 20 },
          { filter: 'Presets', count: Math.floor(Math.random() * 30) + 15 },
          { filter: 'Clear All', count: Math.floor(Math.random() * 20) + 10 },
        ].sort((a, b) => b.count - a.count),
        filterCombinations: [
          { combination: ['search', 'messageType'], count: 25 },
          { combination: ['dateRange', 'search'], count: 18 },
          { combination: ['messageType', 'dateRange'], count: 12 },
        ],
        sessionDuration: Math.random() * 1800 + 300, // 5-35 minutes
        filtersPerSession: Math.random() * 5 + 2, // 2-7 filters per session
      },
    };
  }

  private generateInsights() {
    if (!this.analyticsData) return [];

    const insights = [];
    const data = this.analyticsData;

    // Cache performance insight
    if (data.performance.cacheHitRate < 0.7) {
      insights.push({
        icon: '⚠️',
        title: 'Low Cache Hit Rate',
        description: `Current cache hit rate is ${(data.performance.cacheHitRate * 100).toFixed(1)}%. Consider optimizing search patterns or increasing cache size.`
      });
    } else {
      insights.push({
        icon: '✅',
        title: 'Excellent Cache Performance',
        description: `High cache hit rate of ${(data.performance.cacheHitRate * 100).toFixed(1)}% indicates efficient filtering patterns.`
      });
    }

    // Search patterns insight
    const topSearchTerm = data.searchMetrics.popularSearchTerms[0];
    if (topSearchTerm) {
      insights.push({
        icon: '🔍',
        title: 'Popular Search Pattern',
        description: `"${topSearchTerm.term}" is your most searched term with ${topSearchTerm.count} searches. Consider adding it as a preset filter.`
      });
    }

    // Filter usage insight
    const mostUsedFilter = data.userBehavior.mostUsedFilters[0];
    if (mostUsedFilter && mostUsedFilter.count > 50) {
      insights.push({
        icon: '🎯',
        title: 'Heavy Filter Usage',
        description: `${mostUsedFilter.filter} is heavily used (${mostUsedFilter.count} times). Consider creating keyboard shortcuts for quick access.`
      });
    }

    // Session behavior insight
    if (data.userBehavior.filtersPerSession > 4) {
      insights.push({
        icon: '🔧',
        title: 'Complex Filter Workflows',
        description: `You use ${data.userBehavior.filtersPerSession.toFixed(1)} filters per session on average. Consider creating preset combinations for common workflows.`
      });
    }

    return insights;
  }

  private getCacheTrend(): string {
    if (!this.analyticsData) return 'neutral';
    
    const rate = this.analyticsData.performance.cacheHitRate;
    if (rate > 0.8) return 'positive';
    if (rate < 0.6) return 'negative';
    return 'neutral';
  }

  private getCacheTrendText(): string {
    const trend = this.getCacheTrend();
    switch (trend) {
      case 'positive': return '↗️ Excellent';
      case 'negative': return '↘️ Needs attention';
      default: return '→ Stable';
    }
  }

  private getAverageSearchTime(): number {
    if (!this.analyticsData) return 0;
    
    const times = this.analyticsData.searchMetrics.searchPerformance.map(s => s.avgTime);
    return times.length > 0 ? Math.round(times.reduce((a, b) => a + b) / times.length) : 0;
  }

  private getFilterDistributionPercentage(): number {
    if (!this.analyticsData) return 0;
    
    const total = Object.values(this.analyticsData.filterUsage).reduce((a, b) => a + b, 0);
    const searchUsage = this.analyticsData.filterUsage.search || 0;
    
    return total > 0 ? (searchUsage / total) * 360 : 0;
  }

  private startAutoRefresh() {
    this.stopAutoRefresh();
    this.refreshTimer = window.setInterval(() => {
      this.refreshAnalytics();
    }, this.refreshInterval);
  }

  private stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    
    if (changedProperties.has('autoRefresh')) {
      if (this.autoRefresh) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'filter-analytics': FilterAnalytics;
  }
}