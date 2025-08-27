import { EventEmitter } from "events";
import { performance } from "perf_hooks";

export interface MetricsData {
  timestamp: string;
  cpu: number;
  memory: NodeJS.MemoryUsage;
  uptime: number;
  activeConnections: number;
  requestsPerMinute: number;
  errorRate: number;
  responseTimeP95: number;
}

export interface Alert {
  id: string;
  level: "info" | "warning" | "error" | "critical";
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

class MonitoringService extends EventEmitter {
  private metrics: MetricsData[] = [];
  private alerts: Alert[] = [];
  private requestTimes: number[] = [];
  private errorCount = 0;
  private requestCount = 0;
  private activeConnections = 0;
  private isCollecting = false;
  private collectionInterval?: NodeJS.Timeout;
  private readonly maxMetricsHistory = 1000;
  private readonly maxAlertsHistory = 100;
  private readonly metricsIntervalMs = 5000; // 5 seconds

  constructor() {
    super();
    this.setupProcessMonitoring();
  }

  start(): void {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, this.metricsIntervalMs);

    console.log("🔍 Monitoring service started");
  }

  stop(): void {
    if (!this.isCollecting) return;

    this.isCollecting = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }

    console.log("⏹️ Monitoring service stopped");
  }

  // Request performance tracking
  recordRequest(responseTime: number, success: boolean): void {
    this.requestCount++;
    this.requestTimes.push(responseTime);

    if (!success) {
      this.errorCount++;
    }

    // Keep only recent request times for P95 calculation
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000);
    }

    // Alert on high error rate
    const recentRequests = Math.min(this.requestCount, 100);
    const recentErrors = Math.min(this.errorCount, recentRequests);
    const errorRate = recentErrors / recentRequests;

    if (errorRate > 0.1) { // More than 10% error rate
      this.createAlert({
        level: "warning",
        message: `High error rate detected: ${(errorRate * 100).toFixed(1)}%`,
        metadata: { errorRate, recentErrors, recentRequests }
      });
    }

    // Alert on slow response times
    if (responseTime > 5000) { // More than 5 seconds
      this.createAlert({
        level: "warning",
        message: `Slow response time detected: ${responseTime}ms`,
        metadata: { responseTime }
      });
    }
  }

  // Connection tracking
  recordConnectionChange(delta: number): void {
    this.activeConnections += delta;
    
    // Alert on too many connections
    if (this.activeConnections > 1000) {
      this.createAlert({
        level: "error",
        message: `High connection count: ${this.activeConnections}`,
        metadata: { activeConnections: this.activeConnections }
      });
    }
  }

  // Get current metrics
  getCurrentMetrics(): MetricsData {
    return {
      timestamp: new Date().toISOString(),
      cpu: this.getCpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      activeConnections: this.activeConnections,
      requestsPerMinute: this.getRequestsPerMinute(),
      errorRate: this.getErrorRate(),
      responseTimeP95: this.getResponseTimePercentile(95)
    };
  }

  // Get metrics history
  getMetricsHistory(limit?: number): MetricsData[] {
    const sliceLimit = limit || this.metrics.length;
    return this.metrics.slice(-sliceLimit);
  }

  // Get alerts
  getAlerts(level?: Alert["level"]): Alert[] {
    if (level) {
      return this.alerts.filter(alert => alert.level === level);
    }
    return [...this.alerts];
  }

  // Get system health summary
  getHealthSummary(): {
    status: "healthy" | "degraded" | "unhealthy";
    metrics: MetricsData;
    alerts: { critical: number; error: number; warning: number; info: number };
  } {
    const metrics = this.getCurrentMetrics();
    const alertCounts = {
      critical: this.alerts.filter(a => a.level === "critical").length,
      error: this.alerts.filter(a => a.level === "error").length,
      warning: this.alerts.filter(a => a.level === "warning").length,
      info: this.alerts.filter(a => a.level === "info").length
    };

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    
    if (alertCounts.critical > 0 || alertCounts.error > 5) {
      status = "unhealthy";
    } else if (alertCounts.warning > 10 || metrics.errorRate > 0.05) {
      status = "degraded";
    }

    return { status, metrics, alerts: alertCounts };
  }

  private collectMetrics(): void {
    const metrics = this.getCurrentMetrics();
    this.metrics.push(metrics);

    // Trim old metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Check for resource alerts
    this.checkResourceAlerts(metrics);

    // Emit metrics event
    this.emit("metrics", metrics);
  }

  private checkResourceAlerts(metrics: MetricsData): void {
    // Memory usage alert
    const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      this.createAlert({
        level: "critical",
        message: `Critical memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        metadata: { memoryUsage: metrics.memory }
      });
    } else if (memoryUsagePercent > 80) {
      this.createAlert({
        level: "warning",
        message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        metadata: { memoryUsage: metrics.memory }
      });
    }

    // CPU usage alert (approximated)
    if (metrics.cpu > 90) {
      this.createAlert({
        level: "critical",
        message: `Critical CPU usage: ${metrics.cpu.toFixed(1)}%`,
        metadata: { cpu: metrics.cpu }
      });
    } else if (metrics.cpu > 80) {
      this.createAlert({
        level: "warning",
        message: `High CPU usage: ${metrics.cpu.toFixed(1)}%`,
        metadata: { cpu: metrics.cpu }
      });
    }
  }

  private createAlert(alert: Omit<Alert, "id" | "timestamp">): void {
    const newAlert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...alert
    };

    this.alerts.push(newAlert);

    // Trim old alerts
    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts = this.alerts.slice(-this.maxAlertsHistory);
    }

    // Emit alert event
    this.emit("alert", newAlert);

    // Log critical and error alerts immediately
    if (alert.level === "critical" || alert.level === "error") {
      console.error(`🚨 [${alert.level.toUpperCase()}] ${alert.message}`, alert.metadata);
    }
  }

  private getCpuUsage(): number {
    // Simple CPU usage approximation based on event loop lag
    const start = performance.now();
    setImmediate(() => {
      const lag = performance.now() - start;
      // Convert lag to approximate CPU percentage (this is a rough estimation)
      return Math.min(lag * 2, 100);
    });
    return 0; // Will be updated by the setImmediate callback
  }

  private getRequestsPerMinute(): number {
    // Calculate requests per minute based on recent activity
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // This is a simplified calculation - in production, you'd want to track timestamps
    return Math.round(this.requestCount / (process.uptime() / 60));
  }

  private getErrorRate(): number {
    if (this.requestCount === 0) return 0;
    return this.errorCount / this.requestCount;
  }

  private getResponseTimePercentile(percentile: number): number {
    if (this.requestTimes.length === 0) return 0;
    
    const sorted = [...this.requestTimes].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  private setupProcessMonitoring(): void {
    // Monitor process warnings
    process.on("warning", (warning) => {
      this.createAlert({
        level: "warning",
        message: `Process warning: ${warning.message}`,
        metadata: { 
          name: warning.name,
          stack: warning.stack 
        }
      });
    });

    // Monitor event loop lag
    let start = process.hrtime();
    setInterval(() => {
      const delta = process.hrtime(start);
      const nanosec = delta[0] * 1e9 + delta[1];
      const millisec = nanosec / 1e6;
      const lag = millisec - 1000; // Expected interval is 1000ms

      if (lag > 100) { // More than 100ms lag
        this.createAlert({
          level: "warning",
          message: `High event loop lag detected: ${lag.toFixed(2)}ms`,
          metadata: { lag }
        });
      }

      start = process.hrtime();
    }, 1000);
  }
}

// Singleton instance
let monitoringService: MonitoringService;

export const getMonitoringService = (): MonitoringService => {
  if (!monitoringService) {
    monitoringService = new MonitoringService();
  }
  return monitoringService;
};

export default MonitoringService;