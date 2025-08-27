import { expect, test, describe, beforeEach, vi, beforeAll } from "vitest";
import { fixture, html } from "@open-wc/testing";
import { UsageInsightsDashboard } from "../../src/components/analytics/usage-insights-dashboard";
import type { UsageInsights } from "../../src/components/analytics/usage-insights-dashboard";

// Mock WebSocket controller and service
vi.mock("../../src/utils/websocket/websocket-controller", () => ({
  WebSocketController: vi.fn().mockImplementation(() => ({
    isConnected: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock("../../src/services/websocket-service", () => ({
  getWebSocketService: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => false),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}));

// Ensure the custom element is properly registered
beforeAll(() => {
  try {
    customElements.define('usage-insights-dashboard', UsageInsightsDashboard);
  } catch (e) {
    // Already defined, which is fine in test context
    console.warn('Usage insights dashboard already defined:', e);
  }
});

describe("UsageInsightsDashboard", () => {
  let element: UsageInsightsDashboard;

  const mockInsights: UsageInsights = {
    totalTokensUsed: 125000,
    averageTokensPerSession: 5000,
    peakUsageHours: [
      { hour: 14, tokens: 15000 },
      { hour: 10, tokens: 12000 },
      { hour: 16, tokens: 11000 },
      { hour: 9, tokens: 8000 },
      { hour: 11, tokens: 7500 },
    ],
    topTokenConsumingSessions: [
      {
        sessionId: "session-1",
        title: "Large Analysis Session",
        tokens: 15000,
        duration: 3600000, // 1 hour
      },
      {
        sessionId: "session-2", 
        title: "Code Review Session",
        tokens: 12000,
        duration: 2400000, // 40 minutes
      },
      {
        sessionId: "session-3",
        title: "Research Session",
        tokens: 8500,
        duration: 1800000, // 30 minutes
      },
    ],
    tokenEfficiencyScore: 78,
    recommendations: [
      {
        type: "optimization",
        priority: "high",
        title: "Optimize High Token Usage Sessions",
        description: "You have sessions consuming excessive tokens. Consider breaking them into smaller interactions.",
        impact: "Could reduce token usage by 15-30%",
      },
      {
        type: "usage",
        priority: "medium",
        title: "Distribute Usage Throughout Day",
        description: "Your usage is heavily concentrated in specific hours. Spreading usage could improve performance.",
        impact: "Better system responsiveness during peak hours",
      },
      {
        type: "performance",
        priority: "low",
        title: "Cache Optimization",
        description: "Implement better caching strategies to reduce redundant processing.",
        impact: "Faster response times and reduced server load",
      },
    ],
    trends: {
      daily: [
        { date: "2024-01-15", tokens: 5000, sessions: 3 },
        { date: "2024-01-16", tokens: 7200, sessions: 4 },
        { date: "2024-01-17", tokens: 6100, sessions: 2 },
      ],
      weekly: [
        { week: "2024-W02", tokens: 35000, sessions: 15 },
        { week: "2024-W03", tokens: 42000, sessions: 18 },
      ],
      monthly: [
        { month: "2024-01", tokens: 125000, sessions: 45 },
      ],
    },
  };

  beforeEach(async () => {
    element = await fixture(html`
      <usage-insights-dashboard></usage-insights-dashboard>
    `);
    
    // Wait for the component to complete initialization
    await element.updateComplete;
  });

  // Helper to set up element with mock data
  const setupWithMockData = async () => {
    element.insights = mockInsights;
    await element.updateComplete;
    element.requestUpdate();
    await element.updateComplete;
  };

  test("should be defined", () => {
    expect(element).to.be.instanceOf(UsageInsightsDashboard);
  });

  test("should render with default properties", () => {
    expect(element.insights).to.be.null;
    expect(element.realTimeUpdates).to.be.true;
  });

  test("should show no data message when insights is null", () => {
    const noData = element.shadowRoot?.querySelector(".no-data");
    expect(noData).to.exist;
    expect(noData?.textContent).to.contain("No Usage Insights Available");
  });

  test("should render insights when data is provided", async () => {
    await setupWithMockData();

    const title = element.shadowRoot?.querySelector(".insights-title");
    expect(title?.textContent || "").to.contain("Usage Insights & Recommendations");
    
    const noData = element.shadowRoot?.querySelector(".no-data");
    expect(noData).to.not.exist;
  });

  test("should render efficiency score with correct styling", async () => {
    await setupWithMockData();

    const scoreCircle = element.shadowRoot?.querySelector(".score-circle");
    expect(scoreCircle).to.exist;
    expect(scoreCircle?.textContent?.trim()).to.equal("78");
    expect(scoreCircle?.classList.contains("good")).to.be.true;
  });

  test("should classify efficiency score correctly", () => {
    expect(element.getEfficiencyScoreClass(95)).to.equal("excellent");
    expect(element.getEfficiencyScoreClass(80)).to.equal("good");
    expect(element.getEfficiencyScoreClass(65)).to.equal("fair");
    expect(element.getEfficiencyScoreClass(45)).to.equal("poor");
  });

  test("should get efficiency score label correctly", () => {
    expect(element.getEfficiencyScoreLabel(95)).to.equal("Excellent");
    expect(element.getEfficiencyScoreLabel(80)).to.equal("Good");
    expect(element.getEfficiencyScoreLabel(65)).to.equal("Fair");
    expect(element.getEfficiencyScoreLabel(45)).to.equal("Needs Improvement");
  });

  test("should render peak usage hours", async () => {
    await setupWithMockData();

    const peakHoursList = element.shadowRoot?.querySelector(".peak-hours-list");
    expect(peakHoursList).to.exist;

    const hourItems = peakHoursList?.querySelectorAll(".peak-hour-item");
    expect(hourItems?.length).to.equal(5);

    const firstHour = hourItems?.[0];
    expect(firstHour?.textContent).to.contain("2:00 PM"); // hour 14
    expect(firstHour?.textContent).to.contain("15,000");
  });

  test("should format hour correctly", () => {
    expect(element.formatHour(0)).to.equal("12:00 AM");
    expect(element.formatHour(12)).to.equal("12:00 PM");
    expect(element.formatHour(14)).to.equal("2:00 PM");
    expect(element.formatHour(23)).to.equal("11:00 PM");
  });

  test("should render top token consuming sessions", async () => {
    await setupWithMockData();

    const sessionsList = element.shadowRoot?.querySelector(".top-sessions-list");
    expect(sessionsList).to.exist;

    const sessionItems = sessionsList?.querySelectorAll(".session-item");
    expect(sessionItems?.length).to.equal(3);

    const firstSession = sessionItems?.[0];
    expect(firstSession?.textContent).to.contain("Large Analysis Session");
    expect(firstSession?.textContent).to.contain("15,000");
  });

  test("should classify session usage correctly", () => {
    expect(element.getSessionUsageClass(15000, 15000)).to.equal("high-usage");
    expect(element.getSessionUsageClass(7500, 15000)).to.equal("medium-usage");
    expect(element.getSessionUsageClass(3000, 15000)).to.equal("low-usage");
  });

  test("should format duration correctly", () => {
    expect(element.formatDuration(60000)).to.contain("1m");
    expect(element.formatDuration(3600000)).to.contain("1h 0m");
    expect(element.formatDuration(3900000)).to.contain("1h 5m");
  });

  test("should render recommendations section", async () => {
    await setupWithMockData();

    const recommendationsSection = element.shadowRoot?.querySelector(".recommendations-section");
    expect(recommendationsSection).to.exist;

    const recommendationsList = element.shadowRoot?.querySelector(".recommendations-list");
    expect(recommendationsList).to.exist;

    const recommendations = recommendationsList?.querySelectorAll(".recommendation-item");
    expect(recommendations?.length).to.equal(3);
  });

  test("should render recommendation filters", async () => {
    await setupWithMockData();

    const filters = element.shadowRoot?.querySelectorAll(".filter-button");
    expect(filters?.length).to.equal(4); // all, optimization, usage, performance

    const filterTexts = Array.from(filters || []).map(btn => btn.textContent?.trim());
    expect(filterTexts).to.include.members(["all", "optimization", "usage", "performance"]);
  });

  test("should filter recommendations by type", async () => {
    element.insights = mockInsights;
    await element.updateComplete;

    // Test "all" filter
    let filtered = element.getFilteredRecommendations();
    expect(filtered.length).to.equal(3);

    // Test "optimization" filter
    element.selectedRecommendationFilter = "optimization";
    filtered = element.getFilteredRecommendations();
    expect(filtered.length).to.equal(1);
    expect(filtered[0].type).to.equal("optimization");

    // Test "usage" filter
    element.selectedRecommendationFilter = "usage";
    filtered = element.getFilteredRecommendations();
    expect(filtered.length).to.equal(1);
    expect(filtered[0].type).to.equal("usage");
  });

  test("should handle recommendation filter change", async () => {
    element.insights = mockInsights;
    await element.updateComplete;

    const optimizationFilter = Array.from(element.shadowRoot?.querySelectorAll(".filter-button") || [])
      .find(btn => btn.textContent?.trim() === "optimization") as HTMLElement;
    
    expect(optimizationFilter).to.exist;
    
    optimizationFilter.click();
    await element.updateComplete;

    expect(element.selectedRecommendationFilter).to.equal("optimization");
  });

  test("should render recommendation priority badges", async () => {
    element.insights = mockInsights;
    await element.updateComplete;

    const highPriorityBadge = element.shadowRoot?.querySelector(".priority-badge.high");
    expect(highPriorityBadge).to.exist;
    expect(highPriorityBadge?.textContent).to.contain("high");

    const mediumPriorityBadge = element.shadowRoot?.querySelector(".priority-badge.medium");
    expect(mediumPriorityBadge).to.exist;

    const lowPriorityBadge = element.shadowRoot?.querySelector(".priority-badge.low");
    expect(lowPriorityBadge).to.exist;
  });

  test("should render trends section", async () => {
    element.insights = mockInsights;
    await element.updateComplete;

    const trendsSection = element.shadowRoot?.querySelector(".trends-section");
    expect(trendsSection).to.exist;

    const trendSelector = trendsSection?.querySelector(".trend-selector");
    expect(trendSelector).to.exist;

    const trendButtons = trendSelector?.querySelectorAll(".trend-button");
    expect(trendButtons?.length).to.equal(3); // daily, weekly, monthly
  });

  test("should handle trend period change", async () => {
    element.insights = mockInsights;
    await element.updateComplete;

    const weeklyButton = Array.from(element.shadowRoot?.querySelectorAll(".trend-button") || [])
      .find(btn => btn.textContent?.trim() === "weekly") as HTMLElement;
    
    expect(weeklyButton).to.exist;
    
    weeklyButton.click();
    await element.updateComplete;

    expect(element.selectedTrendPeriod).to.equal("weekly");
    expect(weeklyButton.classList.contains("active")).to.be.true;
  });

  test("should handle session click to toggle expansion", async () => {
    element.insights = mockInsights;
    await element.updateComplete;

    const firstSession = element.shadowRoot?.querySelector(".session-item") as HTMLElement;
    expect(firstSession).to.exist;

    const sessionId = "session-1";
    expect(element.expandedSessions.has(sessionId)).to.be.false;

    firstSession.click();
    await element.updateComplete;

    expect(element.expandedSessions.has(sessionId)).to.be.true;

    // Click again to collapse
    firstSession.click();
    await element.updateComplete;

    expect(element.expandedSessions.has(sessionId)).to.be.false;
  });

  test("should handle WebSocket updates when realTimeUpdates is enabled", () => {
    const mockController = {
      isConnected: true,
      addEventListener: vi.fn(),
    };

    element.wsController = mockController as any;
    element.realTimeUpdates = true;
    
    element.setupWebSocketListeners();
    
    expect(mockController.addEventListener).toHaveBeenCalledWith("message", expect.any(Function));
  });

  test("should handle empty recommendations gracefully", async () => {
    element.insights = {
      ...mockInsights,
      recommendations: [],
    };
    await element.updateComplete;

    const noRecommendations = element.shadowRoot?.querySelector(".no-data");
    expect(noRecommendations?.textContent).to.contain("No recommendations available");
  });

  test("should handle empty trends gracefully", async () => {
    element.insights = {
      ...mockInsights,
      trends: {
        daily: [],
        weekly: [],
        monthly: [],
      },
    };
    await element.updateComplete;

    const trendChart = element.shadowRoot?.querySelector(".trend-chart");
    expect(trendChart?.textContent).to.contain("No trend data available");
  });

  test("should truncate long session titles", () => {
    const longTitle = "This is a very long session title that should be truncated";
    const truncated = element.truncateText(longTitle, 40);
    expect(truncated.length).to.be.lessThanOrEqual(40);
    expect(truncated).to.contain("...");
  });

  test("should not truncate short titles", () => {
    const shortTitle = "Short title";
    const result = element.truncateText(shortTitle, 40);
    expect(result).to.equal(shortTitle);
    expect(result).to.not.contain("...");
  });
});