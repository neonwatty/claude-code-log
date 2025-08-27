import { expect, test, describe, beforeEach, vi, beforeAll } from "vitest";
import { fixture, html } from "@open-wc/testing";
import { TokenUsageChart } from "../../src/components/analytics/token-usage-chart";
import type { TokenPattern } from "../../src/components/analytics/token-usage-chart";

// Mock D3.js - export functions directly since component uses import * as d3
vi.mock("d3", () => ({
  select: vi.fn(() => ({
    selectAll: vi.fn(() => ({
      remove: vi.fn(),
    })),
    append: vi.fn(() => ({
      attr: vi.fn().mockReturnThis(),
      style: vi.fn().mockReturnThis(),
      text: vi.fn().mockReturnThis(),
      call: vi.fn().mockReturnThis(),
      datum: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
    })),
  })),
  scaleTime: vi.fn(() => ({
    domain: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    invert: vi.fn(),
  })),
  scaleLinear: vi.fn(() => ({
    domain: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    nice: vi.fn().mockReturnThis(),
  })),
  extent: vi.fn(() => [new Date("2024-01-01"), new Date("2024-01-02")]),
  max: vi.fn(() => 1000),
  sum: vi.fn(() => 500),
  group: vi.fn(() => new Map()),
  axisBottom: vi.fn(() => ({
    tickFormat: vi.fn().mockReturnThis(),
    tickSize: vi.fn().mockReturnThis(),
  })),
  axisLeft: vi.fn(() => ({
    tickFormat: vi.fn().mockReturnThis(),
    tickSize: vi.fn().mockReturnThis(),
  })),
  timeFormat: vi.fn(() => vi.fn()),
  format: vi.fn(() => vi.fn()),
  area: vi.fn(() => ({
    x: vi.fn().mockReturnThis(),
    y0: vi.fn().mockReturnThis(),
    y1: vi.fn().mockReturnThis(),
    curve: vi.fn().mockReturnThis(),
  })),
  line: vi.fn(() => ({
    x: vi.fn().mockReturnThis(),
    y: vi.fn().mockReturnThis(),
    curve: vi.fn().mockReturnThis(),
  })),
  curveMonotoneX: {},
  pointer: vi.fn(() => [100, 200]),
}));

// Ensure the custom element is properly registered
beforeAll(() => {
  try {
    customElements.define('token-usage-chart', TokenUsageChart);
  } catch (e) {
    // Already defined, which is fine in test context
    console.warn('Token usage chart already defined:', e);
  }
});

describe("TokenUsageChart", () => {
  let element: TokenUsageChart;

  const mockData: TokenPattern[] = [
    {
      timestamp: "2024-01-15T10:00:00Z",
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      sessionId: "session-1",
      messageType: "user",
    },
    {
      timestamp: "2024-01-15T11:00:00Z",
      inputTokens: 150,
      outputTokens: 250,
      totalTokens: 400,
      sessionId: "session-1",
      messageType: "assistant",
    },
    {
      timestamp: "2024-01-15T12:00:00Z",
      inputTokens: 80,
      outputTokens: 180,
      totalTokens: 260,
      sessionId: "session-2",
      messageType: "user",
    },
  ];

  beforeEach(async () => {
    element = await fixture(html`
      <token-usage-chart></token-usage-chart>
    `);
    
    // Wait for the component to complete initialization
    await element.updateComplete;
  });

  test("should be defined", () => {
    expect(element).to.be.instanceOf(TokenUsageChart);
  });

  test("should render with default properties", () => {
    expect(element.data).to.deep.equal([]);
    expect(element.chartType).to.equal("area");
    expect(element.timeRange).to.equal("day");
    expect(element.showInputOutput).to.equal(true);
    expect(element.realTimeUpdates).to.equal(true);
    expect(element.width).to.equal(800);
    expect(element.height).to.equal(400);
  });

  test("should render chart header with title", () => {
    const title = element.shadowRoot?.querySelector(".chart-title");
    expect(title?.textContent).to.contain("Token Usage Patterns");
  });

  test("should render chart type selector", () => {
    // Look for select element that contains area option
    const selects = element.shadowRoot?.querySelectorAll("select");
    const chartTypeSelect = Array.from(selects || []).find(select => 
      select.querySelector("option[value='area']")
    ) as HTMLSelectElement;
    
    expect(chartTypeSelect).to.exist;
    
    const options = Array.from(chartTypeSelect?.options || []).map(option => option.value);
    expect(options).to.include.members(["area", "line", "bar", "scatter"]);
  });

  test("should render time range selector", () => {
    const selects = element.shadowRoot?.querySelectorAll("select");
    expect(selects?.length).to.be.greaterThanOrEqual(2);
    
    const timeRangeSelect = Array.from(selects || []).find(select => 
      select.querySelector("option[value='day']")
    );
    expect(timeRangeSelect).to.exist;
  });

  test("should render input/output toggle", () => {
    const checkbox = element.shadowRoot?.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(checkbox).to.exist;
    expect(checkbox.checked).to.be.true;
  });

  test("should show no data message when data is empty", () => {
    const noDataElement = element.shadowRoot?.querySelector(".no-data");
    expect(noDataElement).to.exist;
    expect(noDataElement?.textContent).to.contain("No token usage data available");
  });

  test("should process data correctly", async () => {
    element.data = mockData;
    await element.updateComplete;

    // Should have processed the data and created chart container
    const chartContainer = element.shadowRoot?.querySelector("#chart-container");
    expect(chartContainer).to.exist;
  });

  test("should handle chart type change", async () => {
    const select = element.shadowRoot?.querySelector("select") as HTMLSelectElement;
    expect(select).to.exist;

    // Change to line chart
    select.value = "line";
    select.dispatchEvent(new Event("change"));
    await element.updateComplete;

    expect(element.chartType).to.equal("line");
  });

  test("should handle time range change", async () => {
    const selects = element.shadowRoot?.querySelectorAll("select");
    const timeRangeSelect = Array.from(selects || []).find(select => 
      select.querySelector("option[value='hour']")
    ) as HTMLSelectElement;
    
    expect(timeRangeSelect).to.exist;

    timeRangeSelect.value = "hour";
    timeRangeSelect.dispatchEvent(new Event("change"));
    await element.updateComplete;

    expect(element.timeRange).to.equal("hour");
  });

  test("should handle input/output toggle", async () => {
    const checkbox = element.shadowRoot?.querySelector("input[type='checkbox']") as HTMLInputElement;
    
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));
    await element.updateComplete;

    expect(element.showInputOutput).to.be.false;
  });

  test("should show legend when showInputOutput is true", async () => {
    element.data = mockData;
    element.showInputOutput = true;
    await element.updateComplete;

    const legend = element.shadowRoot?.querySelector(".legend");
    expect(legend).to.exist;

    const legendItems = legend?.querySelectorAll(".legend-item");
    expect(legendItems?.length).to.equal(3); // Input, Output, Total
  });

  test("should hide legend when showInputOutput is false", async () => {
    element.data = mockData;
    element.showInputOutput = false;
    await element.updateComplete;

    const legend = element.shadowRoot?.querySelector(".legend");
    expect(legend).to.not.exist;
  });

  test("should format time correctly for different ranges", () => {
    element.timeRange = "hour";
    const hourFormat = element.getTimeFormat();
    expect(typeof hourFormat).to.equal("function");

    element.timeRange = "day";
    const dayFormat = element.getTimeFormat();
    expect(typeof dayFormat).to.equal("function");

    element.timeRange = "week";
    const weekFormat = element.getTimeFormat();
    expect(typeof weekFormat).to.equal("function");

    element.timeRange = "month";
    const monthFormat = element.getTimeFormat();
    expect(typeof monthFormat).to.equal("function");
  });

  test("should get correct axis time format", () => {
    element.timeRange = "hour";
    expect(element.getAxisTimeFormat()).to.equal("%H:%M");

    element.timeRange = "day";
    expect(element.getAxisTimeFormat()).to.equal("%m/%d");

    element.timeRange = "week";
    expect(element.getAxisTimeFormat()).to.equal("%m/%d");

    element.timeRange = "month";
    expect(element.getAxisTimeFormat()).to.equal("%b %Y");
  });

  test("should update chart when data changes", async () => {
    // Start with no data
    expect(element.data).to.deep.equal([]);

    // Add data
    element.data = mockData;
    await element.updateComplete;

    // Chart should no longer show no-data message
    const noDataElement = element.shadowRoot?.querySelector(".no-data");
    expect(noDataElement).to.not.exist;

    const chartContainer = element.shadowRoot?.querySelector("#chart-container");
    expect(chartContainer).to.exist;
  });

  test("should update chart when dimensions change", async () => {
    element.data = mockData;
    element.width = 600;
    element.height = 300;
    await element.updateComplete;

    expect(element.width).to.equal(600);
    expect(element.height).to.equal(300);
  });

  test("should emit data-point-selected event", async () => {
    element.data = mockData;
    
    let selectedData: TokenPattern | null = null;
    element.addEventListener("data-point-selected", (event: CustomEvent) => {
      selectedData = event.detail;
    });

    // Simulate data point click
    element.handleDataPointClick(mockData[0]);

    expect(selectedData).to.deep.equal(mockData[0]);
    expect(element.selectedDataPoint).to.deep.equal(mockData[0]);
  });

  test("should process data by time range correctly", async () => {
    element.data = mockData;
    element.timeRange = "day";
    
    element.processData();
    await element.updateComplete;

    // Data should be processed correctly
    expect(element.data).to.be.an("array");
    expect(element.data.length).to.equal(3);
  });

  test("should handle different chart types", async () => {
    element.data = mockData;

    // Test area chart
    element.chartType = "area";
    await element.updateComplete;
    expect(element.chartType).to.equal("area");

    // Test line chart
    element.chartType = "line";
    await element.updateComplete;
    expect(element.chartType).to.equal("line");

    // Test bar chart
    element.chartType = "bar";
    await element.updateComplete;
    expect(element.chartType).to.equal("bar");

    // Test scatter chart
    element.chartType = "scatter";
    await element.updateComplete;
    expect(element.chartType).to.equal("scatter");
  });

  test("should handle tooltip display", async () => {
    element.data = mockData;
    await element.updateComplete;

    // Simulate tooltip show
    const mockEvent = new MouseEvent("mouseover", {
      clientX: 100,
      clientY: 200,
    });

    // Test that showTooltip method doesn't throw and can be called
    expect(() => element.showTooltip(mockEvent, mockData[0])).to.not.throw();
    
    // Test that method exists and is callable
    expect(typeof element.showTooltip).to.equal('function');
  });

  test("should update configuration when width/height change", () => {
    element.width = 1000;
    element.height = 500;
    
    element.updateConfig();
    
    // Check that the properties were set correctly
    expect(element.width).to.equal(1000);
    expect(element.height).to.equal(500);
  });
});