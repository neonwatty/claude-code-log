import { EventEmitter } from 'events';
import { TypedSocket } from '../types/websocket';

/**
 * Connection quality levels
 */
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

/**
 * Network condition types
 */
export type NetworkCondition = 'optimal' | 'high-latency' | 'packet-loss' | 'low-bandwidth' | 'unstable' | 'offline';

/**
 * Health monitoring event types
 */
export type HealthEventType = 
  | 'quality-changed'
  | 'network-condition-detected'
  | 'degradation-warning'
  | 'recovery-detected'
  | 'diagnostic-complete'
  | 'adaptive-adjustment'
  | 'health-alert';

/**
 * Connection metrics data
 */
export interface ConnectionMetrics {
  socketId: string;
  userId?: string;
  
  // Latency metrics
  averageLatency: number;
  minimumLatency: number;
  maximumLatency: number;
  latencyVariance: number;
  
  // Packet metrics
  packetsSent: number;
  packetsReceived: number;
  packetsLost: number;
  packetLossRate: number;
  
  // Throughput metrics
  bytesPerSecond: number;
  messagesPerSecond: number;
  averageMessageSize: number;
  
  // Connection stability
  reconnectCount: number;
  disconnectCount: number;
  uptime: number;
  lastDisconnect?: Date;
  
  // Quality assessment
  quality: ConnectionQuality;
  networkCondition: NetworkCondition;
  stabilityScore: number; // 0-100
  
  // Timestamps
  firstConnected: Date;
  lastUpdated: Date;
}

/**
 * Health monitoring configuration
 */
export interface HealthMonitorConfig {
  // Heartbeat settings
  baseHeartbeatInterval: number; // Base interval in ms
  minHeartbeatInterval: number;  // Minimum interval in ms
  maxHeartbeatInterval: number;  // Maximum interval in ms
  heartbeatTimeout: number;      // Timeout for heartbeat response
  
  // Quality thresholds
  excellentLatencyThreshold: number;
  goodLatencyThreshold: number;
  fairLatencyThreshold: number;
  poorLatencyThreshold: number;
  
  // Packet loss thresholds
  excellentPacketLossThreshold: number;
  goodPacketLossThreshold: number;
  fairPacketLossThreshold: number;
  poorPacketLossThreshold: number;
  
  // Adaptive behavior settings
  enableAdaptiveHeartbeat: boolean;
  enableQualityAdjustments: boolean;
  enableFallbackMechanisms: boolean;
  
  // Monitoring windows
  latencyWindow: number;        // Number of samples for latency calculation
  throughputWindow: number;     // Time window for throughput calculation
  stabilityWindow: number;      // Time window for stability assessment
  
  // Alert thresholds
  degradationAlertThreshold: number; // Quality drop to trigger alert
  recoveryAlertThreshold: number;    // Quality improvement to trigger alert
  
  // Diagnostic settings
  enableNetworkDiagnostics: boolean;
  diagnosticInterval: number;
  enablePerformanceMetrics: boolean;
}

/**
 * Health monitoring alert
 */
export interface HealthAlert {
  id: string;
  type: HealthEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  socketId: string;
  userId?: string;
  message: string;
  details: any;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

/**
 * Diagnostic test result
 */
export interface DiagnosticResult {
  testName: string;
  passed: boolean;
  value?: number;
  threshold?: number;
  message: string;
  suggestions?: string[];
}

/**
 * Network diagnostic report
 */
export interface NetworkDiagnosticReport {
  socketId: string;
  userId?: string;
  timestamp: Date;
  overallHealth: ConnectionQuality;
  tests: DiagnosticResult[];
  recommendations: string[];
  estimatedBandwidth?: number;
  estimatedLatency?: number;
  networkType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
}

/**
 * Comprehensive WebSocket health monitoring and diagnostics system
 */
export class WebSocketHealthMonitor extends EventEmitter {
  private config: HealthMonitorConfig;
  private connectionMetrics = new Map<string, ConnectionMetrics>();
  private latencyHistory = new Map<string, number[]>();
  private throughputHistory = new Map<string, Array<{ timestamp: number; bytes: number }>>();
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();
  private pingStartTimes = new Map<string, number>();
  private alerts = new Map<string, HealthAlert[]>();
  private diagnosticTimers = new Map<string, NodeJS.Timeout>();

  private readonly DEFAULT_CONFIG: HealthMonitorConfig = {
    baseHeartbeatInterval: 15000,
    minHeartbeatInterval: 5000,
    maxHeartbeatInterval: 60000,
    heartbeatTimeout: 30000,
    
    excellentLatencyThreshold: 50,   // < 50ms
    goodLatencyThreshold: 150,       // < 150ms
    fairLatencyThreshold: 300,       // < 300ms
    poorLatencyThreshold: 1000,      // < 1000ms
    
    excellentPacketLossThreshold: 0.01, // < 1%
    goodPacketLossThreshold: 0.05,      // < 5%
    fairPacketLossThreshold: 0.10,      // < 10%
    poorPacketLossThreshold: 0.20,      // < 20%
    
    enableAdaptiveHeartbeat: true,
    enableQualityAdjustments: true,
    enableFallbackMechanisms: true,
    
    latencyWindow: 20,
    throughputWindow: 60000, // 1 minute
    stabilityWindow: 300000, // 5 minutes
    
    degradationAlertThreshold: 2, // Quality levels
    recoveryAlertThreshold: 2,
    
    enableNetworkDiagnostics: true,
    diagnosticInterval: 120000, // 2 minutes
    enablePerformanceMetrics: true,
  };

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    super();
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Starts monitoring a WebSocket connection
   */
  public startMonitoring(socket: TypedSocket): void {
    const socketId = socket.id;
    
    // Initialize metrics for this connection
    const metrics: ConnectionMetrics = {
      socketId,
      userId: socket.data.userId,
      averageLatency: 0,
      minimumLatency: Infinity,
      maximumLatency: 0,
      latencyVariance: 0,
      packetsSent: 0,
      packetsReceived: 0,
      packetsLost: 0,
      packetLossRate: 0,
      bytesPerSecond: 0,
      messagesPerSecond: 0,
      averageMessageSize: 0,
      reconnectCount: socket.data.reconnectCount || 0,
      disconnectCount: 0,
      uptime: 0,
      quality: 'excellent',
      networkCondition: 'optimal',
      stabilityScore: 100,
      firstConnected: socket.data.connectedAt,
      lastUpdated: new Date(),
    };

    this.connectionMetrics.set(socketId, metrics);
    this.latencyHistory.set(socketId, []);
    this.throughputHistory.set(socketId, []);
    this.alerts.set(socketId, []);

    // Start adaptive heartbeat monitoring
    this.startAdaptiveHeartbeat(socket);

    // Start network diagnostics
    if (this.config.enableNetworkDiagnostics) {
      this.startNetworkDiagnostics(socket);
    }

    // Monitor message events for throughput
    this.monitorMessageThroughput(socket);

    console.log(`Health monitoring started for socket ${socketId}`);
  }

  /**
   * Stops monitoring a WebSocket connection
   */
  public stopMonitoring(socketId: string): void {
    // Clear intervals
    const heartbeatInterval = this.heartbeatIntervals.get(socketId);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      this.heartbeatIntervals.delete(socketId);
    }

    const diagnosticTimer = this.diagnosticTimers.get(socketId);
    if (diagnosticTimer) {
      clearInterval(diagnosticTimer);
      this.diagnosticTimers.delete(socketId);
    }

    // Clean up data (keep some for historical analysis)
    this.pingStartTimes.delete(socketId);
    
    // Mark final metrics
    const metrics = this.connectionMetrics.get(socketId);
    if (metrics) {
      metrics.disconnectCount++;
      metrics.lastDisconnect = new Date();
      metrics.uptime = Date.now() - metrics.firstConnected.getTime();
    }

    console.log(`Health monitoring stopped for socket ${socketId}`);
  }

  /**
   * Starts adaptive heartbeat monitoring
   */
  private startAdaptiveHeartbeat(socket: TypedSocket): void {
    const socketId = socket.id;
    let currentInterval = this.config.baseHeartbeatInterval;

    const sendHeartbeat = () => {
      const startTime = Date.now();
      this.pingStartTimes.set(socketId, startTime);
      
      socket.emit('ping', (response: string) => {
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        this.recordLatency(socketId, latency);
        this.updateConnectionMetrics(socketId);
        
        // Adjust heartbeat interval based on quality
        if (this.config.enableAdaptiveHeartbeat) {
          currentInterval = this.calculateAdaptiveInterval(socketId);
        }
      });

      // Update packet sent count
      const metrics = this.connectionMetrics.get(socketId);
      if (metrics) {
        metrics.packetsSent++;
      }
    };

    const scheduleNextHeartbeat = () => {
      const interval = setTimeout(() => {
        const metrics = this.connectionMetrics.get(socketId);
        if (!metrics) {
          return; // Connection was removed
        }

        // Check for heartbeat timeout
        const lastPingTime = this.pingStartTimes.get(socketId);
        if (lastPingTime && Date.now() - lastPingTime > this.config.heartbeatTimeout) {
          this.handleHeartbeatTimeout(socket);
          return;
        }

        sendHeartbeat();
        scheduleNextHeartbeat();
      }, currentInterval);

      this.heartbeatIntervals.set(socketId, interval);
    };

    // Start the heartbeat cycle
    sendHeartbeat();
    scheduleNextHeartbeat();

    // Handle heartbeat responses
    socket.on('pong', () => {
      const endTime = Date.now();
      const startTime = this.pingStartTimes.get(socketId);
      
      if (startTime) {
        const latency = endTime - startTime;
        this.recordLatency(socketId, latency);
        this.updateConnectionMetrics(socketId);
        this.pingStartTimes.delete(socketId);
        
        // Update packet received count
        const metrics = this.connectionMetrics.get(socketId);
        if (metrics) {
          metrics.packetsReceived++;
        }
      }
    });
  }

  /**
   * Calculates adaptive heartbeat interval based on connection quality
   */
  private calculateAdaptiveInterval(socketId: string): number {
    const metrics = this.connectionMetrics.get(socketId);
    if (!metrics) return this.config.baseHeartbeatInterval;

    let multiplier = 1;

    switch (metrics.quality) {
      case 'excellent':
        multiplier = 1.5; // Longer intervals for excellent connections
        break;
      case 'good':
        multiplier = 1.2;
        break;
      case 'fair':
        multiplier = 1.0;
        break;
      case 'poor':
        multiplier = 0.7; // Shorter intervals for poor connections
        break;
      case 'critical':
        multiplier = 0.5;
        break;
    }

    const adaptiveInterval = this.config.baseHeartbeatInterval * multiplier;
    return Math.max(
      this.config.minHeartbeatInterval,
      Math.min(this.config.maxHeartbeatInterval, adaptiveInterval)
    );
  }

  /**
   * Records latency measurement
   */
  private recordLatency(socketId: string, latency: number): void {
    const history = this.latencyHistory.get(socketId);
    if (!history) return;

    history.push(latency);
    
    // Keep only recent measurements within the window
    if (history.length > this.config.latencyWindow) {
      history.splice(0, history.length - this.config.latencyWindow);
    }

    this.latencyHistory.set(socketId, history);
  }

  /**
   * Updates connection metrics based on current data
   */
  private updateConnectionMetrics(socketId: string): void {
    const metrics = this.connectionMetrics.get(socketId);
    const latencyHistory = this.latencyHistory.get(socketId);
    
    if (!metrics || !latencyHistory || latencyHistory.length === 0) return;

    // Calculate latency statistics
    const sum = latencyHistory.reduce((a, b) => a + b, 0);
    metrics.averageLatency = sum / latencyHistory.length;
    metrics.minimumLatency = Math.min(metrics.minimumLatency, Math.min(...latencyHistory));
    metrics.maximumLatency = Math.max(metrics.maximumLatency, Math.max(...latencyHistory));
    
    // Calculate latency variance
    const mean = metrics.averageLatency;
    const variance = latencyHistory.reduce((acc, latency) => acc + Math.pow(latency - mean, 2), 0) / latencyHistory.length;
    metrics.latencyVariance = variance;

    // Calculate packet loss rate
    if (metrics.packetsSent > 0) {
      metrics.packetsLost = metrics.packetsSent - metrics.packetsReceived;
      metrics.packetLossRate = metrics.packetsLost / metrics.packetsSent;
    }

    // Update uptime
    metrics.uptime = Date.now() - metrics.firstConnected.getTime();

    // Assess connection quality
    const previousQuality = metrics.quality;
    metrics.quality = this.assessConnectionQuality(metrics);
    metrics.networkCondition = this.detectNetworkCondition(metrics);
    metrics.stabilityScore = this.calculateStabilityScore(metrics);
    metrics.lastUpdated = new Date();

    // Check for quality changes and emit events
    if (previousQuality !== metrics.quality) {
      this.handleQualityChange(socketId, previousQuality, metrics.quality);
    }

    // Check for degradation warnings
    this.checkForDegradationWarnings(socketId, metrics);
  }

  /**
   * Assesses connection quality based on metrics
   */
  private assessConnectionQuality(metrics: ConnectionMetrics): ConnectionQuality {
    const latency = metrics.averageLatency;
    const packetLoss = metrics.packetLossRate;

    // Critical conditions
    if (packetLoss > this.config.poorPacketLossThreshold || latency > this.config.poorLatencyThreshold) {
      return 'critical';
    }

    // Poor conditions
    if (packetLoss > this.config.fairPacketLossThreshold || latency > this.config.fairLatencyThreshold) {
      return 'poor';
    }

    // Fair conditions
    if (packetLoss > this.config.goodPacketLossThreshold || latency > this.config.goodLatencyThreshold) {
      return 'fair';
    }

    // Good conditions
    if (packetLoss > this.config.excellentPacketLossThreshold || latency > this.config.excellentLatencyThreshold) {
      return 'good';
    }

    // Excellent conditions
    return 'excellent';
  }

  /**
   * Detects network condition based on metrics
   */
  private detectNetworkCondition(metrics: ConnectionMetrics): NetworkCondition {
    const latency = metrics.averageLatency;
    const packetLoss = metrics.packetLossRate;
    const variance = metrics.latencyVariance;

    // High variance indicates unstable connection
    if (variance > 10000) { // High variance threshold
      return 'unstable';
    }

    // High packet loss
    if (packetLoss > 0.15) {
      return 'packet-loss';
    }

    // High latency
    if (latency > 500) {
      return 'high-latency';
    }

    // Low throughput (if metrics available)
    if (metrics.bytesPerSecond < 1000) {
      return 'low-bandwidth';
    }

    return 'optimal';
  }

  /**
   * Calculates stability score (0-100)
   */
  private calculateStabilityScore(metrics: ConnectionMetrics): number {
    let score = 100;

    // Deduct points for high latency
    if (metrics.averageLatency > this.config.excellentLatencyThreshold) {
      score -= Math.min(50, (metrics.averageLatency - this.config.excellentLatencyThreshold) / 10);
    }

    // Deduct points for packet loss
    score -= Math.min(30, metrics.packetLossRate * 100);

    // Deduct points for disconnections
    score -= Math.min(20, metrics.disconnectCount * 5);

    // Deduct points for high latency variance (instability)
    if (metrics.latencyVariance > 1000) {
      score -= Math.min(20, metrics.latencyVariance / 1000);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Handles quality change events
   */
  private handleQualityChange(socketId: string, oldQuality: ConnectionQuality, newQuality: ConnectionQuality): void {
    const metrics = this.connectionMetrics.get(socketId);
    if (!metrics) return;

    const qualityLevels = ['critical', 'poor', 'fair', 'good', 'excellent'];
    const oldLevel = qualityLevels.indexOf(oldQuality);
    const newLevel = qualityLevels.indexOf(newQuality);
    const change = newLevel - oldLevel;

    this.emit('quality-changed', {
      socketId,
      userId: metrics.userId,
      oldQuality,
      newQuality,
      change,
      metrics,
    });

    // Create alert for significant changes
    if (Math.abs(change) >= this.config.degradationAlertThreshold) {
      const alertType = change > 0 ? 'recovery-detected' : 'degradation-warning';
      this.createAlert(socketId, alertType, {
        oldQuality,
        newQuality,
        change,
        message: change > 0 
          ? `Connection quality improved from ${oldQuality} to ${newQuality}`
          : `Connection quality degraded from ${oldQuality} to ${newQuality}`,
      });
    }
  }

  /**
   * Checks for degradation warnings
   */
  private checkForDegradationWarnings(socketId: string, metrics: ConnectionMetrics): void {
    const warnings: string[] = [];

    if (metrics.averageLatency > this.config.fairLatencyThreshold) {
      warnings.push(`High latency detected: ${Math.round(metrics.averageLatency)}ms`);
    }

    if (metrics.packetLossRate > this.config.fairPacketLossThreshold) {
      warnings.push(`High packet loss detected: ${Math.round(metrics.packetLossRate * 100)}%`);
    }

    if (metrics.latencyVariance > 5000) {
      warnings.push(`Unstable connection detected: high latency variance`);
    }

    if (warnings.length > 0) {
      this.emit('degradation-warning', {
        socketId,
        userId: metrics.userId,
        warnings,
        metrics,
      });
    }
  }

  /**
   * Handles heartbeat timeout
   */
  private handleHeartbeatTimeout(socket: TypedSocket): void {
    const socketId = socket.id;
    const metrics = this.connectionMetrics.get(socketId);
    
    this.createAlert(socketId, 'health-alert', {
      severity: 'high',
      message: 'Heartbeat timeout - connection may be lost',
      reconnectRequired: true,
    });

    // Trigger reconnection
    socket.emit('reconnect-required', {
      reason: 'Heartbeat timeout',
      delay: 1000,
    });

    // Update metrics
    if (metrics) {
      metrics.packetsLost++;
      metrics.quality = 'critical';
    }
  }

  /**
   * Monitors message throughput
   */
  private monitorMessageThroughput(socket: TypedSocket): void {
    const socketId = socket.id;
    let messageCount = 0;
    let byteCount = 0;

    // Monitor outgoing messages
    const originalEmit = socket.emit.bind(socket);
    socket.emit = function(event: string, ...args: any[]) {
      messageCount++;
      byteCount += JSON.stringify(args).length;
      return originalEmit(event, ...args);
    };

    // Monitor incoming messages
    socket.onAny(() => {
      messageCount++;
      // Approximate size - actual implementation might need more precise measurement
      byteCount += 100; // Average message size estimate
    });

    // Calculate throughput periodically
    setInterval(() => {
      const metrics = this.connectionMetrics.get(socketId);
      if (!metrics) return;

      const timeWindow = this.config.throughputWindow / 1000; // Convert to seconds
      metrics.messagesPerSecond = messageCount / timeWindow;
      metrics.bytesPerSecond = byteCount / timeWindow;
      metrics.averageMessageSize = messageCount > 0 ? byteCount / messageCount : 0;

      // Update throughput history
      const history = this.throughputHistory.get(socketId) || [];
      history.push({ timestamp: Date.now(), bytes: byteCount });
      
      // Keep only recent history
      const cutoff = Date.now() - this.config.throughputWindow;
      const recentHistory = history.filter(entry => entry.timestamp > cutoff);
      this.throughputHistory.set(socketId, recentHistory);

      // Reset counters
      messageCount = 0;
      byteCount = 0;
    }, this.config.throughputWindow);
  }

  /**
   * Starts network diagnostics
   */
  private startNetworkDiagnostics(socket: TypedSocket): void {
    const socketId = socket.id;

    const runDiagnostics = async () => {
      const report = await this.performNetworkDiagnostics(socketId);
      
      this.emit('diagnostic-complete', {
        socketId,
        userId: socket.data.userId,
        report,
      });

      // Create alerts for critical issues
      const criticalTests = report.tests.filter(test => !test.passed && test.testName.includes('critical'));
      if (criticalTests.length > 0) {
        this.createAlert(socketId, 'health-alert', {
          severity: 'critical',
          message: 'Critical network issues detected',
          diagnosticReport: report,
        });
      }
    };

    // Run initial diagnostics
    setTimeout(runDiagnostics, 5000); // Wait 5 seconds after connection

    // Schedule periodic diagnostics
    const diagnosticTimer = setInterval(runDiagnostics, this.config.diagnosticInterval);
    this.diagnosticTimers.set(socketId, diagnosticTimer);
  }

  /**
   * Performs comprehensive network diagnostics
   */
  private async performNetworkDiagnostics(socketId: string): Promise<NetworkDiagnosticReport> {
    const metrics = this.connectionMetrics.get(socketId);
    if (!metrics) {
      throw new Error(`No metrics found for socket ${socketId}`);
    }

    const tests: DiagnosticResult[] = [];

    // Latency test
    tests.push({
      testName: 'Average Latency',
      passed: metrics.averageLatency < this.config.goodLatencyThreshold,
      value: metrics.averageLatency,
      threshold: this.config.goodLatencyThreshold,
      message: `Average latency is ${Math.round(metrics.averageLatency)}ms`,
      suggestions: metrics.averageLatency > this.config.goodLatencyThreshold 
        ? ['Check network connection', 'Move closer to router', 'Switch to wired connection']
        : [],
    });

    // Packet loss test
    tests.push({
      testName: 'Packet Loss Rate',
      passed: metrics.packetLossRate < this.config.goodPacketLossThreshold,
      value: metrics.packetLossRate * 100,
      threshold: this.config.goodPacketLossThreshold * 100,
      message: `Packet loss rate is ${Math.round(metrics.packetLossRate * 100)}%`,
      suggestions: metrics.packetLossRate > this.config.goodPacketLossThreshold
        ? ['Check network stability', 'Restart router', 'Contact ISP if persistent']
        : [],
    });

    // Stability test
    tests.push({
      testName: 'Connection Stability',
      passed: metrics.stabilityScore > 80,
      value: metrics.stabilityScore,
      threshold: 80,
      message: `Connection stability score is ${metrics.stabilityScore}/100`,
      suggestions: metrics.stabilityScore < 80
        ? ['Reduce network interference', 'Check for background downloads', 'Update network drivers']
        : [],
    });

    // Latency variance test (jitter)
    tests.push({
      testName: 'Latency Consistency',
      passed: metrics.latencyVariance < 2500,
      value: Math.sqrt(metrics.latencyVariance),
      threshold: 50,
      message: `Latency jitter is ${Math.round(Math.sqrt(metrics.latencyVariance))}ms`,
      suggestions: Math.sqrt(metrics.latencyVariance) > 50
        ? ['Check for network congestion', 'Use QoS settings', 'Reduce concurrent connections']
        : [],
    });

    // Overall health assessment
    const passedTests = tests.filter(test => test.passed).length;
    const overallHealth = this.assessOverallHealth(passedTests, tests.length);

    // Generate recommendations
    const recommendations = this.generateRecommendations(tests, metrics);

    return {
      socketId,
      userId: metrics.userId,
      timestamp: new Date(),
      overallHealth,
      tests,
      recommendations,
      estimatedBandwidth: metrics.bytesPerSecond * 8, // Convert to bits per second
      estimatedLatency: metrics.averageLatency,
      networkType: this.estimateNetworkType(metrics),
    };
  }

  /**
   * Assesses overall health based on test results
   */
  private assessOverallHealth(passedTests: number, totalTests: number): ConnectionQuality {
    const ratio = passedTests / totalTests;
    
    if (ratio >= 0.9) return 'excellent';
    if (ratio >= 0.75) return 'good';
    if (ratio >= 0.5) return 'fair';
    if (ratio >= 0.25) return 'poor';
    return 'critical';
  }

  /**
   * Generates recommendations based on test results
   */
  private generateRecommendations(tests: DiagnosticResult[], metrics: ConnectionMetrics): string[] {
    const recommendations = new Set<string>();

    // Collect suggestions from failed tests
    tests.forEach(test => {
      if (!test.passed && test.suggestions) {
        test.suggestions.forEach(suggestion => recommendations.add(suggestion));
      }
    });

    // Add general recommendations based on overall condition
    if (metrics.quality === 'poor' || metrics.quality === 'critical') {
      recommendations.add('Consider using a wired connection instead of WiFi');
      recommendations.add('Close unnecessary applications using network');
      recommendations.add('Contact your network administrator');
    }

    if (metrics.reconnectCount > 3) {
      recommendations.add('Check for intermittent connectivity issues');
      recommendations.add('Update browser to the latest version');
    }

    return Array.from(recommendations);
  }

  /**
   * Estimates network type based on metrics
   */
  private estimateNetworkType(metrics: ConnectionMetrics): 'wifi' | 'cellular' | 'ethernet' | 'unknown' {
    // This is a rough estimation based on typical characteristics
    if (metrics.averageLatency < 10 && metrics.latencyVariance < 100) {
      return 'ethernet'; // Very low latency and stable
    }
    
    if (metrics.averageLatency > 100 && metrics.latencyVariance > 2500) {
      return 'cellular'; // Higher latency and more variable
    }
    
    if (metrics.averageLatency < 50 && metrics.latencyVariance < 1000) {
      return 'wifi'; // Moderate latency, relatively stable
    }
    
    return 'unknown';
  }

  /**
   * Creates a health alert
   */
  private createAlert(socketId: string, type: HealthEventType, details: any): void {
    const alert: HealthAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: details.severity || 'medium',
      socketId,
      userId: details.userId,
      message: details.message || `Health alert: ${type}`,
      details,
      timestamp: new Date(),
    };

    const socketAlerts = this.alerts.get(socketId) || [];
    socketAlerts.push(alert);
    this.alerts.set(socketId, socketAlerts);

    this.emit(type, alert);
  }

  /**
   * Gets connection metrics for a socket
   */
  public getConnectionMetrics(socketId: string): ConnectionMetrics | undefined {
    return this.connectionMetrics.get(socketId);
  }

  /**
   * Gets all connection metrics
   */
  public getAllConnectionMetrics(): ConnectionMetrics[] {
    return Array.from(this.connectionMetrics.values());
  }

  /**
   * Gets alerts for a socket
   */
  public getAlerts(socketId: string): HealthAlert[] {
    return this.alerts.get(socketId) || [];
  }

  /**
   * Gets all alerts
   */
  public getAllAlerts(): HealthAlert[] {
    const allAlerts: HealthAlert[] = [];
    for (const alerts of this.alerts.values()) {
      allAlerts.push(...alerts);
    }
    return allAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Resolves an alert
   */
  public resolveAlert(alertId: string): boolean {
    for (const alerts of this.alerts.values()) {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        alert.resolved = true;
        alert.resolvedAt = new Date();
        return true;
      }
    }
    return false;
  }

  /**
   * Gets health statistics
   */
  public getHealthStatistics() {
    const allMetrics = this.getAllConnectionMetrics();
    const totalConnections = allMetrics.length;
    
    if (totalConnections === 0) {
      return {
        totalConnections: 0,
        averageLatency: 0,
        averagePacketLoss: 0,
        qualityDistribution: {},
        networkConditionDistribution: {},
        totalAlerts: 0,
      };
    }

    const averageLatency = allMetrics.reduce((sum, m) => sum + m.averageLatency, 0) / totalConnections;
    const averagePacketLoss = allMetrics.reduce((sum, m) => sum + m.packetLossRate, 0) / totalConnections;

    const qualityDistribution = allMetrics.reduce((acc, m) => {
      acc[m.quality] = (acc[m.quality] || 0) + 1;
      return acc;
    }, {} as Record<ConnectionQuality, number>);

    const networkConditionDistribution = allMetrics.reduce((acc, m) => {
      acc[m.networkCondition] = (acc[m.networkCondition] || 0) + 1;
      return acc;
    }, {} as Record<NetworkCondition, number>);

    const totalAlerts = this.getAllAlerts().length;

    return {
      totalConnections,
      averageLatency: Math.round(averageLatency),
      averagePacketLoss: Math.round(averagePacketLoss * 10000) / 100, // Percentage with 2 decimals
      qualityDistribution,
      networkConditionDistribution,
      totalAlerts,
    };
  }

  /**
   * Updates monitor configuration
   */
  public updateConfig(newConfig: Partial<HealthMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }

  /**
   * Performs manual health check for a connection
   */
  public async performHealthCheck(socketId: string): Promise<NetworkDiagnosticReport | null> {
    if (!this.connectionMetrics.has(socketId)) {
      return null;
    }

    return this.performNetworkDiagnostics(socketId);
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    // Clear all intervals
    for (const interval of this.heartbeatIntervals.values()) {
      clearInterval(interval);
    }
    
    for (const timer of this.diagnosticTimers.values()) {
      clearInterval(timer);
    }

    // Clear all data
    this.connectionMetrics.clear();
    this.latencyHistory.clear();
    this.throughputHistory.clear();
    this.heartbeatIntervals.clear();
    this.pingStartTimes.clear();
    this.alerts.clear();
    this.diagnosticTimers.clear();

    this.removeAllListeners();
    console.log('WebSocketHealthMonitor shutdown complete');
  }
}

export default WebSocketHealthMonitor;