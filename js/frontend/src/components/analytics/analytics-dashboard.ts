import { html, css, CSSResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component";
import { analyticsService, UsageStatistics, PerformanceMetrics } from "../../services/analytics.service";
import { WebSocketController } from "../../utils/websocket/websocket-controller";

/**
 * Analytics Dashboard Component
 * Provides comprehensive analytics overview with real-time updates
 */
@customElement("analytics-dashboard")
export class AnalyticsDashboard extends BaseComponent {
  @property({ type: String })
  timeRange: "today" | "week" | "month" | "year" | "all" = "week";

  @property({ type: Boolean })
  realTimeUpdates = true;

  @state()
  private usageStats: UsageStatistics | null = null;

  @state()
  private performanceMetrics: PerformanceMetrics | null = null;

  @state()
  private refreshInterval: number | null = null;

  private wsController = new WebSocketController(this);

  static override styles: CSSResult[] = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        padding: var(--spacing-lg);
      }

      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-lg);
      }

      .dashboard-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0;
      }

      .time-range-selector {
        display: flex;
        gap: var(--spacing-sm);
        align-items: center;
      }

      .time-range-button {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border);
        background: var(--color-bg-secondary);
        color: var(--color-text);
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: all var(--transition-base);
      }

      .time-range-button:hover {
        background: var(--color-bg-tertiary);
        border-color: var(--color-border-hover);
      }

      .time-range-button.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: var(--spacing-lg);
      }

      .analytics-card {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-lg);
        box-shadow: var(--shadow-sm);
      }

      .card-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0 0 var(--spacing-md) 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .card-icon {
        width: 20px;
        height: 20px;
        opacity: 0.8;
      }

      .metric-value {
        font-size: var(--font-size-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        margin: var(--spacing-sm) 0;
      }

      .metric-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .metric-change {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        margin-top: var(--spacing-xs);
      }

      .metric-change.positive {
        color: var(--color-success);
      }

      .metric-change.negative {
        color: var(--color-error);
      }

      .metric-change.neutral {
        color: var(--color-text-secondary);
      }

      .feature-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .feature-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-sm) 0;
        border-bottom: 1px solid var(--color-border-subtle);
      }

      .feature-item:last-child {
        border-bottom: none;
      }

      .feature-name {
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
        text-transform: capitalize;
        font-size: var(--font-size-sm);
      }

      .feature-count {
        font-weight: var(--font-weight-semibold);
        color: var(--color-primary);
        font-size: var(--font-size-sm);
      }

      .refresh-indicator {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .refresh-indicator.active {
        color: var(--color-success);
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-text-secondary);
        transition: background-color var(--transition-base);
      }

      .status-dot.connected {
        background: var(--color-success);
      }

      .performance-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-md);
      }

      .performance-metric {
        text-align: center;
      }

      .performance-value {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        display: block;
      }

      .performance-unit {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.initializeAnalytics();
    this.setupRealTimeUpdates();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup();
  }

  private async initializeAnalytics(): Promise<void> {
    await this.handleAsyncOperation(async () => {
      this.usageStats = analyticsService.getUsageStatistics();
      this.performanceMetrics = analyticsService.getPerformanceMetrics();
      
      // Track page view after initialization
      analyticsService.trackPageView("analytics-dashboard");
    }, "Failed to load analytics data");
  }

  private setupRealTimeUpdates(): void {
    if (this.realTimeUpdates) {
      // Set up periodic refresh
      this.refreshInterval = window.setInterval(() => {
        this.refreshAnalytics();
      }, 30000); // Refresh every 30 seconds

      // Set up WebSocket listener for analytics events
      if (this.wsController.isConnected) {
        this.wsController.addEventListener("analyticsUpdate", this.handleAnalyticsUpdate.bind(this));
      }
    }
  }

  private handleAnalyticsUpdate(event: CustomEvent): void {
    // Handle real-time analytics updates from WebSocket
    this.refreshAnalytics();
  }

  private refreshAnalytics(): void {
    this.usageStats = analyticsService.getUsageStatistics();
    this.performanceMetrics = analyticsService.getPerformanceMetrics();
    this.requestUpdate();
  }

  public cleanup(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private handleTimeRangeChange(range: typeof this.timeRange): void {
    this.timeRange = range;
    analyticsService.trackEvent("filter_applied", { filterType: "timeRange", value: range });
    this.refreshAnalytics();
  }

  public formatDuration(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  public formatTokenCount(count: number): string {
    return count.toLocaleString();
  }

  public formatPerformanceTime(milliseconds: number): string {
    if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
    return `${(milliseconds / 1000).toFixed(1)}s`;
  }

  override render() {
    return html`
      <div class="dashboard-header">
        <h2 class="dashboard-title">Analytics Dashboard</h2>
        <div class="time-range-selector">
          <div class="refresh-indicator ${this.realTimeUpdates ? 'active' : ''}">
            <div class="status-dot ${this.wsController.isConnected ? 'connected' : ''}"></div>
            ${this.realTimeUpdates ? 'Live Updates' : 'Static View'}
          </div>
          ${this.renderTimeRangeButtons()}
        </div>
      </div>

      ${this.isLoading ? html`
        <div class="loading-indicator">Loading analytics data...</div>
      ` : ''}

      ${this.error ? html`
        <div class="error">${this.error}</div>
      ` : ''}

      ${this.usageStats && this.performanceMetrics ? html`
        <div class="dashboard-grid">
          ${this.renderOverviewCard()}
          ${this.renderTokenUsageCard()}
          ${this.renderPerformanceCard()}
          ${this.renderFeatureUsageCard()}
        </div>
      ` : ''}
    `;
  }

  private renderTimeRangeButtons() {
    const timeRanges: Array<{ value: typeof this.timeRange; label: string }> = [
      { value: "today", label: "Today" },
      { value: "week", label: "Week" },
      { value: "month", label: "Month" },
      { value: "year", label: "Year" },
      { value: "all", label: "All Time" },
    ];

    return timeRanges.map(range => html`
      <button
        class="time-range-button ${range.value === this.timeRange ? 'active' : ''}"
        @click=${() => this.handleTimeRangeChange(range.value)}
      >
        ${range.label}
      </button>
    `);
  }

  private renderOverviewCard() {
    if (!this.usageStats) return '';

    return html`
      <div class="analytics-card">
        <h3 class="card-title">
          <span class="card-icon">📊</span>
          Usage Overview
        </h3>
        <div class="metric-value">${this.usageStats.totalSessions.toLocaleString()}</div>
        <div class="metric-label">Total Sessions</div>
        <div class="metric-change neutral">
          ${this.formatDuration(this.usageStats.timeSpentInApp)} active time
        </div>
      </div>
    `;
  }

  private renderTokenUsageCard() {
    if (!this.usageStats) return '';

    return html`
      <div class="analytics-card">
        <h3 class="card-title">
          <span class="card-icon">🎯</span>
          Token Usage
        </h3>
        <div class="metric-value">${this.formatTokenCount(this.usageStats.totalTokens)}</div>
        <div class="metric-label">Total Tokens</div>
        <div class="metric-change positive">
          Avg: ${Math.round(this.usageStats.totalTokens / Math.max(this.usageStats.totalSessions, 1))} per session
        </div>
      </div>
    `;
  }

  private renderPerformanceCard() {
    if (!this.performanceMetrics) return '';

    return html`
      <div class="analytics-card">
        <h3 class="card-title">
          <span class="card-icon">⚡</span>
          Performance
        </h3>
        <div class="performance-grid">
          <div class="performance-metric">
            <span class="performance-value">
              ${this.formatPerformanceTime(this.performanceMetrics.averageSearchTime)}
            </span>
            <span class="performance-unit">Avg Search</span>
          </div>
          <div class="performance-metric">
            <span class="performance-value">
              ${this.performanceMetrics.cacheHitRate.toFixed(1)}%
            </span>
            <span class="performance-unit">Cache Hit</span>
          </div>
          <div class="performance-metric">
            <span class="performance-value">
              ${this.formatPerformanceTime(this.performanceMetrics.averagePageLoadTime)}
            </span>
            <span class="performance-unit">Page Load</span>
          </div>
          <div class="performance-metric">
            <span class="performance-value">
              ${this.performanceMetrics.errorRate.toFixed(2)}%
            </span>
            <span class="performance-unit">Error Rate</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderFeatureUsageCard() {
    if (!this.usageStats || !this.usageStats.mostUsedFeatures.length) return '';

    return html`
      <div class="analytics-card">
        <h3 class="card-title">
          <span class="card-icon">🔧</span>
          Top Features
        </h3>
        <ul class="feature-list">
          ${this.usageStats.mostUsedFeatures.slice(0, 5).map(feature => html`
            <li class="feature-item">
              <span class="feature-name">${feature.feature.replace('_', ' ')}</span>
              <span class="feature-count">${feature.count.toLocaleString()}</span>
            </li>
          `)}
        </ul>
      </div>
    `;
  }
}