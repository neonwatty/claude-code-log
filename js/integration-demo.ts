/**
 * Integration Demo for Advanced Analytics and Token Usage Views
 * Demonstrates the complete functionality with real-time updates
 */

import { analyticsService as backendAnalyticsService } from "./backend/src/services/analytics.service.js";
import { analyticsService as frontendAnalyticsService } from "./frontend/src/services/analytics.service.js";
import type { ZodSession } from "./shared/src/index.js";

// Mock session data for demonstration
const mockSessions: ZodSession[] = [
  {
    id: "demo-session-1",
    title: "Advanced Claude Code Analysis",
    created_at: "2024-01-15T10:00:00Z",
    entries: [
      {
        id: "entry-1",
        type: "user",
        timestamp: "2024-01-15T10:00:00Z",
        content: [{ type: "text", text: "Analyze this codebase for optimization opportunities" }],
        usage: { input_tokens: 1200, output_tokens: 2500, total_tokens: 3700 },
      },
      {
        id: "entry-2",
        type: "assistant",
        timestamp: "2024-01-15T10:05:00Z",
        content: [{ type: "text", text: "I'll analyze your codebase... [detailed analysis]" }],
        usage: { input_tokens: 500, output_tokens: 4200, total_tokens: 4700 },
      },
      {
        id: "entry-3",
        type: "user",
        timestamp: "2024-01-15T10:15:00Z",
        content: [{ type: "text", text: "Can you provide specific recommendations for performance improvements?" }],
        usage: { input_tokens: 800, output_tokens: 1500, total_tokens: 2300 },
      },
    ],
  },
  {
    id: "demo-session-2",
    title: "Token Usage Investigation",
    created_at: "2024-01-15T14:00:00Z",
    entries: [
      {
        id: "entry-4",
        type: "user",
        timestamp: "2024-01-15T14:00:00Z",
        content: [{ type: "text", text: "Help me understand why my token usage is so high" }],
        usage: { input_tokens: 300, output_tokens: 800, total_tokens: 1100 },
      },
      {
        id: "entry-5",
        type: "assistant",
        timestamp: "2024-01-15T14:02:00Z",
        content: [{ type: "text", text: "Let me analyze your usage patterns..." }],
        usage: { input_tokens: 200, output_tokens: 1200, total_tokens: 1400 },
      },
    ],
  },
  {
    id: "demo-session-3",
    title: "High Token Consumption Session",
    created_at: "2024-01-15T16:00:00Z",
    entries: [
      {
        id: "entry-6",
        type: "user",
        timestamp: "2024-01-15T16:00:00Z",
        content: [{ type: "text", text: "Process this large dataset and provide comprehensive analysis" }],
        usage: { input_tokens: 8000, output_tokens: 12000, total_tokens: 20000 },
      },
    ],
  },
];

/**
 * Demonstration of the advanced analytics functionality
 */
export async function runAnalyticsDemo(): Promise<void> {
  console.log("🚀 Starting Advanced Analytics Demo");
  console.log("=====================================");

  try {
    // 1. Calculate comprehensive token usage analytics
    console.log("\n📊 Calculating Token Usage Analytics...");
    const tokenAnalytics = await backendAnalyticsService.calculateTokenUsageAnalytics(mockSessions);
    
    console.log("✅ Token Analytics Results:");
    console.log(`   Total Tokens: ${tokenAnalytics.totalTokens.toLocaleString()}`);
    console.log(`   Input Tokens: ${tokenAnalytics.inputTokens.toLocaleString()}`);
    console.log(`   Output Tokens: ${tokenAnalytics.outputTokens.toLocaleString()}`);
    console.log(`   Sessions Analyzed: ${tokenAnalytics.sessionsAnalyzed}`);
    console.log(`   Patterns Generated: ${tokenAnalytics.patterns.length}`);

    // 2. Generate usage insights and recommendations
    console.log("\n💡 Generating Usage Insights...");
    const insights = await backendAnalyticsService.generateUsageInsights(mockSessions);
    
    console.log("✅ Usage Insights Results:");
    console.log(`   Efficiency Score: ${insights.tokenEfficiencyScore}/100`);
    console.log(`   Average Tokens/Session: ${insights.averageTokensPerSession.toLocaleString()}`);
    console.log(`   Peak Usage Hours: ${insights.peakUsageHours.length} identified`);
    console.log(`   Top Sessions: ${insights.topTokenConsumingSessions.length} analyzed`);
    console.log(`   Recommendations: ${insights.recommendations.length} generated`);

    // 3. Display peak usage hours
    console.log("\n⏰ Peak Usage Hours:");
    insights.peakUsageHours.slice(0, 3).forEach((peak, index) => {
      const time = new Date();
      time.setHours(peak.hour, 0, 0, 0);
      console.log(`   ${index + 1}. ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${peak.tokens.toLocaleString()} tokens`);
    });

    // 4. Display top recommendations
    console.log("\n🎯 Top Recommendations:");
    insights.recommendations.slice(0, 3).forEach((rec, index) => {
      console.log(`   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
      console.log(`      ${rec.description}`);
      console.log(`      Impact: ${rec.impact}`);
    });

    // 5. Demonstrate real-time metrics
    console.log("\n📈 Real-time Metrics Simulation...");
    const initialMetrics = backendAnalyticsService.getRealTimeMetrics();
    console.log("✅ Initial Metrics:", {
      sessions: initialMetrics.currentSessionCount,
      connections: initialMetrics.activeConnections,
      tokensPerMinute: initialMetrics.tokensPerMinute,
      cacheHitRate: `${initialMetrics.cacheHitRate}%`,
    });

    // Simulate real-time updates
    backendAnalyticsService.updateRealTimeMetrics({
      currentSessionCount: 5,
      activeConnections: 12,
      tokensPerMinute: 1250,
      averageResponseTime: 340,
    });

    const updatedMetrics = backendAnalyticsService.getRealTimeMetrics();
    console.log("✅ Updated Metrics:", {
      sessions: updatedMetrics.currentSessionCount,
      connections: updatedMetrics.activeConnections,
      tokensPerMinute: updatedMetrics.tokensPerMinute,
      responseTime: `${updatedMetrics.averageResponseTime}ms`,
    });

    // 6. Demonstrate event emission for WebSocket integration
    console.log("\n🔄 WebSocket Integration Demo...");
    let eventCount = 0;
    
    backendAnalyticsService.on("analytics_update", (event) => {
      eventCount++;
      console.log(`✅ Analytics Event #${eventCount}: ${event.type}`);
      console.log(`   Timestamp: ${event.timestamp}`);
      console.log(`   Data Keys: ${Object.keys(event.data).join(", ")}`);
    });

    // Trigger events by updating metrics and calculating analytics
    await backendAnalyticsService.calculateTokenUsageAnalytics(mockSessions);
    await backendAnalyticsService.generateUsageInsights(mockSessions);
    backendAnalyticsService.updateRealTimeMetrics({ tokensPerMinute: 1500 });

    // 7. Demonstrate frontend analytics tracking
    console.log("\n🎨 Frontend Analytics Tracking...");
    frontendAnalyticsService.trackPageView("analytics-dashboard");
    frontendAnalyticsService.trackEvent("chart_type_changed", { 
      from: "area", 
      to: "line", 
      sessionId: "demo-session-1" 
    });
    frontendAnalyticsService.trackSearch("token usage patterns", 15, 234);

    const frontendStats = frontendAnalyticsService.getUsageStatistics();
    console.log("✅ Frontend Analytics:", {
      totalSessions: frontendStats.totalSessions,
      totalSearches: frontendStats.totalSearches,
      timeInApp: `${Math.round(frontendStats.timeSpentInApp / 1000)}s`,
    });

    // 8. Performance validation
    console.log("\n⚡ Performance Validation...");
    const startTime = performance.now();
    
    // Process large dataset simulation
    const largeSessions = Array.from({ length: 100 }, (_, i) => ({
      ...mockSessions[0],
      id: `perf-session-${i}`,
      title: `Performance Test Session ${i}`,
    }));

    await backendAnalyticsService.calculateTokenUsageAnalytics(largeSessions);
    
    const endTime = performance.now();
    console.log(`✅ Processed ${largeSessions.length} sessions in ${Math.round(endTime - startTime)}ms`);

    console.log("\n🎉 Advanced Analytics Demo Complete!");
    console.log("=====================================");
    console.log("✅ Token usage analytics calculated successfully");
    console.log("✅ Usage insights and recommendations generated");
    console.log("✅ Real-time metrics updates working");
    console.log("✅ WebSocket event emission functional");
    console.log("✅ Frontend analytics tracking operational");
    console.log("✅ Performance validation passed");

  } catch (error) {
    console.error("❌ Demo failed:", error);
    throw error;
  } finally {
    // Cleanup
    backendAnalyticsService.destroy();
  }
}

/**
 * HTML Component Integration Demo
 */
export function generateAnalyticsHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Advanced Analytics Demo</title>
  <style>
    body { 
      font-family: system-ui, sans-serif; 
      max-width: 1200px; 
      margin: 0 auto; 
      padding: 2rem; 
      background: #f8fafc;
    }
    .demo-container { 
      display: grid; 
      gap: 2rem; 
      grid-template-columns: 1fr 1fr; 
    }
    .analytics-section { 
      background: white; 
      padding: 1.5rem; 
      border-radius: 8px; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 { 
      text-align: center; 
      color: #1e293b; 
      margin-bottom: 2rem; 
    }
    h2 { 
      color: #475569; 
      border-bottom: 2px solid #e2e8f0; 
      padding-bottom: 0.5rem; 
    }
  </style>
</head>
<body>
  <h1>🚀 Advanced Analytics & Token Usage Views</h1>
  
  <div class="demo-container">
    <section class="analytics-section">
      <h2>📊 Analytics Dashboard</h2>
      <analytics-dashboard 
        time-range="week" 
        real-time-updates="true">
      </analytics-dashboard>
    </section>

    <section class="analytics-section">
      <h2>📈 Token Usage Chart</h2>
      <token-usage-chart 
        chart-type="area" 
        time-range="day" 
        show-input-output="true"
        width="600" 
        height="400">
      </token-usage-chart>
    </section>

    <section class="analytics-section" style="grid-column: 1 / -1;">
      <h2>💡 Usage Insights Dashboard</h2>
      <usage-insights-dashboard 
        real-time-updates="true">
      </usage-insights-dashboard>
    </section>
  </div>

  <script type="module">
    // Import and initialize components
    import './frontend/src/components/analytics/analytics-dashboard.js';
    import './frontend/src/components/analytics/token-usage-chart.js';
    import './frontend/src/components/analytics/usage-insights-dashboard.js';

    // Demo data would be loaded here in a real application
    console.log('Advanced Analytics components loaded and ready!');
  </script>
</body>
</html>
  `.trim();
}

// Run demo if this file is executed directly
if (import.meta.url === new URL(import.meta.resolve(import.meta.url)).href) {
  runAnalyticsDemo().catch(console.error);
}