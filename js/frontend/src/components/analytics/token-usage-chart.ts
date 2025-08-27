import { html, css, CSSResult } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component";
import * as d3 from "d3";

/**
 * Token consumption pattern data interface
 */
export interface TokenPattern {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessionId: string;
  messageType: "user" | "assistant";
}

/**
 * Chart configuration interface
 */
export interface ChartConfig {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  animationDuration: number;
}

/**
 * Token Usage Chart Component
 * Visualizes token consumption patterns over time using D3.js
 */
@customElement("token-usage-chart")
export class TokenUsageChart extends BaseComponent {
  @property({ type: Array })
  data: TokenPattern[] = [];

  @property({ type: String })
  chartType: "line" | "area" | "bar" | "scatter" = "area";

  @property({ type: String })
  timeRange: "hour" | "day" | "week" | "month" = "day";

  @property({ type: Boolean })
  showInputOutput = true;

  @property({ type: Boolean })
  realTimeUpdates = true;

  @property({ type: Number })
  width = 800;

  @property({ type: Number })
  height = 400;

  @state()
  private processedData: any[] = [];

  @state()
  private selectedDataPoint: TokenPattern | null = null;

  @query("#chart-container")
  private chartContainer!: HTMLElement;

  private svg: d3.Selection<SVGElement, unknown, null, undefined> | null = null;
  private tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null;

  private readonly config: ChartConfig = {
    width: 800,
    height: 400,
    margin: { top: 20, right: 80, bottom: 60, left: 80 },
    animationDuration: 300,
  };

  static override styles: CSSResult[] = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        width: 100%;
      }

      .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-md);
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-lg);
      }

      .chart-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0;
      }

      .chart-controls {
        display: flex;
        gap: var(--spacing-sm);
        align-items: center;
      }

      .chart-control-group {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }

      .control-label {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: var(--font-weight-medium);
      }

      .chart-select {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border);
        background: var(--color-bg-primary);
        color: var(--color-text);
        border-radius: var(--border-radius-sm);
        font-size: var(--font-size-sm);
      }

      .chart-container {
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-md);
        overflow: hidden;
        position: relative;
      }

      .chart-svg {
        width: 100%;
        height: auto;
        display: block;
      }

      .tooltip {
        position: absolute;
        pointer-events: none;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-sm);
        font-size: var(--font-size-sm);
        color: var(--color-text);
        box-shadow: var(--shadow-lg);
        opacity: 0;
        transition: opacity var(--transition-fast);
        z-index: 1000;
      }

      .tooltip.visible {
        opacity: 1;
      }

      .tooltip-title {
        font-weight: var(--font-weight-semibold);
        margin-bottom: var(--spacing-xs);
        color: var(--color-primary);
      }

      .tooltip-content {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }

      .tooltip-row {
        display: flex;
        justify-content: space-between;
        gap: var(--spacing-sm);
      }

      .metric-label {
        color: var(--color-text-secondary);
      }

      .metric-value {
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
      }

      .metric-value.input {
        color: var(--color-success);
      }

      .metric-value.output {
        color: var(--color-primary);
      }

      .metric-value.total {
        color: var(--color-info);
      }

      .no-data {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: var(--color-text-secondary);
        font-size: var(--font-size-lg);
      }

      .legend {
        display: flex;
        gap: var(--spacing-md);
        justify-content: center;
        margin-top: var(--spacing-sm);
        padding: var(--spacing-sm);
        background: var(--color-bg-tertiary);
        border-radius: var(--border-radius-sm);
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        font-size: var(--font-size-sm);
      }

      .legend-color {
        width: 12px;
        height: 12px;
        border-radius: 2px;
      }

      /* D3 chart styles */
      .axis {
        color: var(--color-text-secondary);
      }

      .axis text {
        fill: var(--color-text-secondary);
        font-size: 11px;
      }

      .axis path,
      .axis line {
        stroke: var(--color-border);
        shape-rendering: crispEdges;
      }

      .grid line {
        stroke: var(--color-border-subtle);
        stroke-opacity: 0.5;
        shape-rendering: crispEdges;
      }

      .area-input {
        fill: var(--color-success);
        fill-opacity: 0.3;
        stroke: var(--color-success);
        stroke-width: 2;
      }

      .area-output {
        fill: var(--color-primary);
        fill-opacity: 0.3;
        stroke: var(--color-primary);
        stroke-width: 2;
      }

      .line-total {
        fill: none;
        stroke: var(--color-info);
        stroke-width: 2;
      }

      .dot {
        fill: var(--color-bg-primary);
        stroke-width: 2;
        cursor: pointer;
        transition: all var(--transition-base);
      }

      .dot:hover {
        r: 6;
        stroke-width: 3;
      }

      .dot.user {
        stroke: var(--color-success);
      }

      .dot.assistant {
        stroke: var(--color-primary);
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateConfig();
  }

  override updated(changedProperties: Map<string | number | symbol, unknown>): void {
    super.updated(changedProperties);

    if (changedProperties.has("data") || 
        changedProperties.has("chartType") || 
        changedProperties.has("timeRange") ||
        changedProperties.has("width") ||
        changedProperties.has("height")) {
      this.processData();
      this.renderChart();
    }
  }

  public updateConfig(): void {
    this.config.width = this.width;
    this.config.height = this.height;
  }

  public processData(): void {
    if (!this.data || this.data.length === 0) {
      this.processedData = [];
      return;
    }

    // Group data by time interval based on timeRange
    const timeFormat = this.getTimeFormat();
    const groupedData = d3.group(this.data, d => {
      const date = new Date(d.timestamp);
      return timeFormat(date);
    });

    // Aggregate data for each time interval
    this.processedData = Array.from(groupedData.entries()).map(([key, values]) => {
      const inputTokens = d3.sum(values, d => d.inputTokens);
      const outputTokens = d3.sum(values, d => d.outputTokens);
      const totalTokens = d3.sum(values, d => d.totalTokens);

      return {
        time: key,
        date: new Date(values[0].timestamp), // Use first item's timestamp for sorting
        inputTokens,
        outputTokens,
        totalTokens,
        count: values.length,
        sessions: new Set(values.map(d => d.sessionId)).size,
        rawData: values,
      };
    }).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public getTimeFormat(): (date: Date) => string {
    switch (this.timeRange) {
      case "hour":
        return d3.timeFormat("%Y-%m-%d %H:00");
      case "day":
        return d3.timeFormat("%Y-%m-%d");
      case "week":
        return d3.timeFormat("%Y-W%U");
      case "month":
        return d3.timeFormat("%Y-%m");
      default:
        return d3.timeFormat("%Y-%m-%d");
    }
  }

  private renderChart(): void {
    if (!this.chartContainer) return;

    // Clear existing chart
    d3.select(this.chartContainer).selectAll("*").remove();

    if (this.processedData.length === 0) {
      return; // No data to render
    }

    // Create tooltip
    this.tooltip = d3.select(this.chartContainer)
      .append("div")
      .attr("class", "tooltip");

    // Set up dimensions
    const { width, height, margin } = this.config;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create SVG
    this.svg = d3.select(this.chartContainer)
      .append("svg")
      .attr("class", "chart-svg")
      .attr("width", width)
      .attr("height", height);

    const g = this.svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(this.processedData, d => d.date) as [Date, Date])
      .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(this.processedData, d => d.totalTokens) as number])
      .nice()
      .range([chartHeight, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d3.timeFormat(this.getAxisTimeFormat()));

    const yAxis = d3.axisLeft(yScale)
      .tickFormat(d3.format(".2s"));

    // Add grid
    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale)
        .tickSize(-chartHeight)
        .tickFormat(() => ""));

    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(yScale)
        .tickSize(-chartWidth)
        .tickFormat(() => ""));

    // Render chart based on type
    switch (this.chartType) {
      case "area":
        this.renderAreaChart(g, xScale, yScale, chartHeight);
        break;
      case "line":
        this.renderLineChart(g, xScale, yScale);
        break;
      case "bar":
        this.renderBarChart(g, xScale, yScale, chartHeight);
        break;
      case "scatter":
        this.renderScatterChart(g, xScale, yScale);
        break;
    }

    // Add axes
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(xAxis);

    g.append("g")
      .attr("class", "axis")
      .call(yAxis);

    // Add axis labels
    g.append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (chartHeight / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "12px")
      .text("Token Count");

    g.append("text")
      .attr("class", "axis-label")
      .attr("transform", `translate(${chartWidth / 2}, ${chartHeight + margin.bottom - 10})`)
      .style("text-anchor", "middle")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "12px")
      .text("Time");
  }

  public getAxisTimeFormat(): string {
    switch (this.timeRange) {
      case "hour":
        return "%H:%M";
      case "day":
        return "%m/%d";
      case "week":
        return "%m/%d";
      case "month":
        return "%b %Y";
      default:
        return "%m/%d";
    }
  }

  private renderAreaChart(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleTime<number, number, never>,
    yScale: d3.ScaleLinear<number, number, never>,
    chartHeight: number,
  ): void {
    if (!this.showInputOutput) {
      // Show only total tokens
      const area = d3.area<any>()
        .x(d => xScale(d.date))
        .y0(chartHeight)
        .y1(d => yScale(d.totalTokens))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(this.processedData)
        .attr("class", "area-total")
        .attr("d", area)
        .style("fill", "var(--color-primary)")
        .style("fill-opacity", 0.3)
        .style("stroke", "var(--color-primary)")
        .style("stroke-width", 2);
    } else {
      // Show stacked input/output
      const stackedData = this.processedData.map(d => ({
        ...d,
        inputCumulative: d.inputTokens,
        outputCumulative: d.inputTokens + d.outputTokens,
      }));

      // Input area
      const inputArea = d3.area<any>()
        .x(d => xScale(d.date))
        .y0(chartHeight)
        .y1(d => yScale(d.inputTokens))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(stackedData)
        .attr("class", "area-input")
        .attr("d", inputArea);

      // Output area (stacked on top)
      const outputArea = d3.area<any>()
        .x(d => xScale(d.date))
        .y0(d => yScale(d.inputTokens))
        .y1(d => yScale(d.totalTokens))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(stackedData)
        .attr("class", "area-output")
        .attr("d", outputArea);
    }

    this.addInteractivity(g, xScale, yScale);
  }

  private renderLineChart(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleTime<number, number, never>,
    yScale: d3.ScaleLinear<number, number, never>,
  ): void {
    const line = d3.line<any>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.totalTokens))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(this.processedData)
      .attr("class", "line-total")
      .attr("d", line);

    if (this.showInputOutput) {
      const inputLine = d3.line<any>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.inputTokens))
        .curve(d3.curveMonotoneX);

      const outputLine = d3.line<any>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.outputTokens))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(this.processedData)
        .attr("class", "line-input")
        .attr("d", inputLine)
        .style("fill", "none")
        .style("stroke", "var(--color-success)")
        .style("stroke-width", 2)
        .style("stroke-dasharray", "3,3");

      g.append("path")
        .datum(this.processedData)
        .attr("class", "line-output")
        .attr("d", outputLine)
        .style("fill", "none")
        .style("stroke", "var(--color-primary)")
        .style("stroke-width", 2)
        .style("stroke-dasharray", "3,3");
    }

    this.addInteractivity(g, xScale, yScale);
  }

  private renderBarChart(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleTime<number, number, never>,
    yScale: d3.ScaleLinear<number, number, never>,
    chartHeight: number,
  ): void {
    const bandwidth = (xScale.range()[1] - xScale.range()[0]) / this.processedData.length * 0.8;

    if (!this.showInputOutput) {
      g.selectAll(".bar-total")
        .data(this.processedData)
        .enter().append("rect")
        .attr("class", "bar-total")
        .attr("x", d => xScale(d.date) - bandwidth / 2)
        .attr("y", d => yScale(d.totalTokens))
        .attr("width", bandwidth)
        .attr("height", d => chartHeight - yScale(d.totalTokens))
        .style("fill", "var(--color-primary)")
        .style("fill-opacity", 0.7);
    } else {
      // Stacked bars
      g.selectAll(".bar-input")
        .data(this.processedData)
        .enter().append("rect")
        .attr("class", "bar-input")
        .attr("x", d => xScale(d.date) - bandwidth / 2)
        .attr("y", d => yScale(d.inputTokens))
        .attr("width", bandwidth)
        .attr("height", d => chartHeight - yScale(d.inputTokens))
        .style("fill", "var(--color-success)");

      g.selectAll(".bar-output")
        .data(this.processedData)
        .enter().append("rect")
        .attr("class", "bar-output")
        .attr("x", d => xScale(d.date) - bandwidth / 2)
        .attr("y", d => yScale(d.totalTokens))
        .attr("width", bandwidth)
        .attr("height", d => yScale(d.inputTokens) - yScale(d.totalTokens))
        .style("fill", "var(--color-primary)");
    }

    this.addInteractivity(g, xScale, yScale);
  }

  private renderScatterChart(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleTime<number, number, never>,
    yScale: d3.ScaleLinear<number, number, never>,
  ): void {
    // Render individual data points from original data
    g.selectAll(".dot")
      .data(this.data)
      .enter().append("circle")
      .attr("class", d => `dot ${d.messageType}`)
      .attr("cx", d => xScale(new Date(d.timestamp)))
      .attr("cy", d => yScale(d.totalTokens))
      .attr("r", 4)
      .on("mouseover", (event, d) => this.showTooltip(event, d))
      .on("mouseout", () => this.hideTooltip())
      .on("click", (event, d) => this.handleDataPointClick(d));
  }

  private addInteractivity(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleTime<number, number, never>,
    yScale: d3.ScaleLinear<number, number, never>,
  ): void {
    // Add invisible overlay for hover interactions
    const { config } = this;
    const chartWidth = config.width - config.margin.left - config.margin.right;
    const chartHeight = config.height - config.margin.top - config.margin.bottom;

    g.append("rect")
      .attr("class", "overlay")
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("mousemove", (event) => this.handleChartHover(event, xScale, yScale))
      .on("mouseout", () => this.hideTooltip());
  }

  private handleChartHover(
    event: MouseEvent,
    xScale: d3.ScaleTime<number, number, never>,
    yScale: d3.ScaleLinear<number, number, never>,
  ): void {
    const [mouseX] = d3.pointer(event);
    const date = xScale.invert(mouseX);

    // Find closest data point
    const closestData = this.processedData.reduce((prev, curr) => {
      return Math.abs(curr.date.getTime() - date.getTime()) < Math.abs(prev.date.getTime() - date.getTime()) 
        ? curr : prev;
    });

    this.showTooltipForProcessedData(event, closestData);
  }

  private showTooltip(event: MouseEvent, data: TokenPattern): void {
    if (!this.tooltip) return;

    this.tooltip
      .style("opacity", 1)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 10) + "px")
      .html(`
        <div class="tooltip-title">${new Date(data.timestamp).toLocaleString()}</div>
        <div class="tooltip-content">
          <div class="tooltip-row">
            <span class="metric-label">Total Tokens:</span>
            <span class="metric-value total">${this.formatTokenCount(data.totalTokens)}</span>
          </div>
          <div class="tooltip-row">
            <span class="metric-label">Input:</span>
            <span class="metric-value input">${this.formatTokenCount(data.inputTokens)}</span>
          </div>
          <div class="tooltip-row">
            <span class="metric-label">Output:</span>
            <span class="metric-value output">${this.formatTokenCount(data.outputTokens)}</span>
          </div>
          <div class="tooltip-row">
            <span class="metric-label">Type:</span>
            <span class="metric-value">${data.messageType}</span>
          </div>
          <div class="tooltip-row">
            <span class="metric-label">Session:</span>
            <span class="metric-value">${data.sessionId.slice(0, 8)}...</span>
          </div>
        </div>
      `);
  }

  private showTooltipForProcessedData(event: MouseEvent, data: any): void {
    if (!this.tooltip) return;

    this.tooltip
      .style("opacity", 1)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 10) + "px")
      .html(`
        <div class="tooltip-title">${data.time}</div>
        <div class="tooltip-content">
          <div class="tooltip-row">
            <span class="metric-label">Total Tokens:</span>
            <span class="metric-value total">${this.formatTokenCount(data.totalTokens)}</span>
          </div>
          <div class="tooltip-row">
            <span class="metric-label">Input:</span>
            <span class="metric-value input">${this.formatTokenCount(data.inputTokens)}</span>
          </div>
          <div class="tooltip-row">
            <span class="metric-label">Output:</span>
            <span class="metric-value output">${this.formatTokenCount(data.outputTokens)}</span>
          </div>
          <div class="tooltip-row">
            <span class="metric-label">Messages:</span>
            <span class="metric-value">${data.count}</span>
          </div>
          <div class="tooltip-row">
            <span class="metric-label">Sessions:</span>
            <span class="metric-value">${data.sessions}</span>
          </div>
        </div>
      `);
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.style("opacity", 0);
    }
  }

  public formatTokenCount(count: number): string {
    return count.toLocaleString();
  }

  public handleDataPointClick(data: TokenPattern): void {
    this.selectedDataPoint = data;
    this.emitEvent("data-point-selected", data);
  }

  private handleChartTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.chartType = target.value as typeof this.chartType;
  }

  private handleTimeRangeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.timeRange = target.value as typeof this.timeRange;
  }

  private handleToggleInputOutput(): void {
    this.showInputOutput = !this.showInputOutput;
  }

  override render() {
    return html`
      <div class="chart-header">
        <h3 class="chart-title">Token Usage Patterns</h3>
        <div class="chart-controls">
          <div class="chart-control-group">
            <label class="control-label">Chart Type</label>
            <select 
              class="chart-select" 
              .value=${this.chartType}
              @change=${this.handleChartTypeChange}
            >
              <option value="area">Area Chart</option>
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
              <option value="scatter">Scatter Plot</option>
            </select>
          </div>
          <div class="chart-control-group">
            <label class="control-label">Time Range</label>
            <select 
              class="chart-select" 
              .value=${this.timeRange}
              @change=${this.handleTimeRangeChange}
            >
              <option value="hour">Hourly</option>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
          <div class="chart-control-group">
            <label class="control-label">Split I/O</label>
            <input 
              type="checkbox" 
              .checked=${this.showInputOutput}
              @change=${this.handleToggleInputOutput}
            >
          </div>
        </div>
      </div>

      <div class="chart-container">
        ${this.data.length === 0 ? html`
          <div class="no-data">No token usage data available</div>
        ` : html`
          <div id="chart-container"></div>
          ${this.showInputOutput ? html`
            <div class="legend">
              <div class="legend-item">
                <div class="legend-color" style="background: var(--color-success);"></div>
                <span>Input Tokens</span>
              </div>
              <div class="legend-item">
                <div class="legend-color" style="background: var(--color-primary);"></div>
                <span>Output Tokens</span>
              </div>
              <div class="legend-item">
                <div class="legend-color" style="background: var(--color-info);"></div>
                <span>Total Tokens</span>
              </div>
            </div>
          ` : ''}
        `}
      </div>
    `;
  }
}