/**
 * Connection Health Monitoring Demo Component
 * 
 * Demonstrates the WebSocket health monitoring and diagnostics system
 * with real-time connection quality metrics, alerts, and diagnostics.
 */

interface ConnectionMetrics {
  socketId: string;
  userId?: string;
  averageLatency: number;
  minimumLatency: number;
  maximumLatency: number;
  latencyVariance: number;
  packetsSent: number;
  packetsReceived: number;
  packetsLost: number;
  packetLossRate: number;
  bytesPerSecond: number;
  messagesPerSecond: number;
  averageMessageSize: number;
  reconnectCount: number;
  disconnectCount: number;
  uptime: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  networkCondition: 'optimal' | 'high-latency' | 'packet-loss' | 'low-bandwidth' | 'unstable' | 'offline';
  stabilityScore: number;
  firstConnected: string;
  lastUpdated: string;
}

interface HealthAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  socketId: string;
  userId?: string;
  message: string;
  details: any;
  timestamp: string;
  resolved?: boolean;
  resolvedAt?: string;
}

interface DiagnosticReport {
  socketId: string;
  userId?: string;
  timestamp: string;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  tests: Array<{
    testName: string;
    passed: boolean;
    value?: number;
    threshold?: number;
    message: string;
    suggestions?: string[];
  }>;
  recommendations: string[];
  estimatedBandwidth?: number;
  estimatedLatency?: number;
  networkType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
}

export class ConnectionHealthDemo {
  private container: HTMLElement;
  private socket: any; // WebSocket connection
  private metricsElement: HTMLElement;
  private alertsElement: HTMLElement;
  private diagnosticsElement: HTMLElement;
  private statisticsElement: HTMLElement;
  private currentMetrics: ConnectionMetrics | null = null;
  private alerts: HealthAlert[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(container: HTMLElement, socket: any) {
    this.container = container;
    this.socket = socket;
    this.init();
    this.setupEventListeners();
    this.startPeriodicUpdates();
  }

  private init(): void {
    this.container.innerHTML = `
      <div class="connection-health-demo">
        <header class="health-header">
          <h2>🔗 WebSocket Connection Health Monitor</h2>
          <div class="health-actions">
            <button id="refresh-health" class="btn btn-primary">🔄 Refresh</button>
            <button id="run-diagnostic" class="btn btn-secondary">🔍 Run Diagnostic</button>
            <button id="export-data" class="btn btn-outline">📊 Export Data</button>
          </div>
        </header>

        <div class="health-dashboard">
          <!-- Connection Quality Overview -->
          <div class="health-section">
            <h3>📊 Connection Quality</h3>
            <div id="connection-metrics" class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Quality</div>
                <div class="metric-value" id="quality-value">Checking...</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Latency</div>
                <div class="metric-value" id="latency-value">-- ms</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Packet Loss</div>
                <div class="metric-value" id="packet-loss-value">-- %</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Stability</div>
                <div class="metric-value" id="stability-value">-- / 100</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Network</div>
                <div class="metric-value" id="network-condition-value">--</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Uptime</div>
                <div class="metric-value" id="uptime-value">--</div>
              </div>
            </div>
          </div>

          <!-- Detailed Metrics -->
          <div class="health-section">
            <h3>📈 Detailed Metrics</h3>
            <div id="detailed-metrics" class="detailed-metrics">
              <div class="metrics-row">
                <div class="metric-detail">
                  <span class="metric-name">Average Latency:</span>
                  <span class="metric-data" id="avg-latency">-- ms</span>
                </div>
                <div class="metric-detail">
                  <span class="metric-name">Min/Max Latency:</span>
                  <span class="metric-data" id="latency-range">-- / -- ms</span>
                </div>
              </div>
              <div class="metrics-row">
                <div class="metric-detail">
                  <span class="metric-name">Packets Sent/Received:</span>
                  <span class="metric-data" id="packet-stats">-- / --</span>
                </div>
                <div class="metric-detail">
                  <span class="metric-name">Throughput:</span>
                  <span class="metric-data" id="throughput">-- KB/s</span>
                </div>
              </div>
              <div class="metrics-row">
                <div class="metric-detail">
                  <span class="metric-name">Reconnections:</span>
                  <span class="metric-data" id="reconnect-count">--</span>
                </div>
                <div class="metric-detail">
                  <span class="metric-name">Messages/sec:</span>
                  <span class="metric-data" id="message-rate">--</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Health Alerts -->
          <div class="health-section">
            <h3>⚠️ Health Alerts</h3>
            <div id="health-alerts" class="alerts-container">
              <div class="no-alerts">No active health alerts</div>
            </div>
          </div>

          <!-- Network Diagnostics -->
          <div class="health-section">
            <h3>🔬 Network Diagnostics</h3>
            <div id="diagnostics-results" class="diagnostics-container">
              <div class="no-diagnostics">Click "Run Diagnostic" to perform network tests</div>
            </div>
          </div>

          <!-- Statistics -->
          <div class="health-section">
            <h3>📊 System Statistics</h3>
            <div id="system-statistics" class="statistics-container">
              <div class="stats-loading">Loading statistics...</div>
            </div>
          </div>
        </div>

        <!-- Connection Quality Indicator -->
        <div class="quality-indicator" id="quality-indicator">
          <div class="quality-icon">🔗</div>
          <div class="quality-text">Checking connection...</div>
        </div>
      </div>
    `;

    this.metricsElement = this.container.querySelector('#connection-metrics')!;
    this.alertsElement = this.container.querySelector('#health-alerts')!;
    this.diagnosticsElement = this.container.querySelector('#diagnostics-results')!;
    this.statisticsElement = this.container.querySelector('#system-statistics')!;

    this.setupButtonListeners();
  }

  private setupButtonListeners(): void {
    this.container.querySelector('#refresh-health')?.addEventListener('click', () => {
      this.refreshHealthData();
    });

    this.container.querySelector('#run-diagnostic')?.addEventListener('click', () => {
      this.runDiagnostic();
    });

    this.container.querySelector('#export-data')?.addEventListener('click', () => {
      this.exportHealthData();
    });
  }

  private setupEventListeners(): void {
    // Listen for real-time health events
    this.socket.on('connection-quality-changed', (data: any) => {
      this.handleQualityChange(data);
    });

    this.socket.on('connection-degradation-warning', (data: any) => {
      this.handleDegradationWarning(data);
    });

    this.socket.on('connection-recovery-detected', (data: any) => {
      this.handleRecoveryDetected(data);
    });

    this.socket.on('health-diagnostic-complete', (data: any) => {
      this.displayDiagnosticResults(data.report);
    });

    this.socket.on('health-alert', (data: any) => {
      this.addHealthAlert(data);
    });

    this.socket.on('network-condition-changed', (data: any) => {
      this.handleNetworkConditionChange(data);
    });

    this.socket.on('adaptive-adjustment-applied', (data: any) => {
      this.handleAdaptiveAdjustment(data);
    });
  }

  private startPeriodicUpdates(): void {
    this.refreshHealthData();
    this.updateInterval = setInterval(() => {
      this.refreshHealthData();
    }, 5000); // Update every 5 seconds
  }

  private refreshHealthData(): void {
    // Get connection health metrics
    this.socket.emit('get-connection-health', (metrics: ConnectionMetrics) => {
      this.currentMetrics = metrics;
      this.updateMetricsDisplay(metrics);
    });

    // Get health alerts
    this.socket.emit('get-health-alerts', (alerts: HealthAlert[]) => {
      this.alerts = alerts;
      this.updateAlertsDisplay(alerts);
    });

    // Get system statistics
    this.socket.emit('get-health-statistics', (stats: any) => {
      this.updateStatisticsDisplay(stats);
    });
  }

  private updateMetricsDisplay(metrics: ConnectionMetrics): void {
    if (!metrics) return;

    // Update quality indicator
    const qualityIndicator = this.container.querySelector('#quality-indicator')!;
    const qualityIcon = qualityIndicator.querySelector('.quality-icon')!;
    const qualityText = qualityIndicator.querySelector('.quality-text')!;

    const qualityConfig = this.getQualityConfig(metrics.quality);
    qualityIcon.textContent = qualityConfig.icon;
    qualityText.textContent = `${qualityConfig.text} (${metrics.quality})`;
    qualityIndicator.className = `quality-indicator quality-${metrics.quality}`;

    // Update metric cards
    this.updateElement('quality-value', metrics.quality.toUpperCase());
    this.updateElement('latency-value', `${Math.round(metrics.averageLatency)} ms`);
    this.updateElement('packet-loss-value', `${(metrics.packetLossRate * 100).toFixed(2)}%`);
    this.updateElement('stability-value', `${metrics.stabilityScore} / 100`);
    this.updateElement('network-condition-value', metrics.networkCondition);
    this.updateElement('uptime-value', this.formatUptime(metrics.uptime));

    // Update detailed metrics
    this.updateElement('avg-latency', `${Math.round(metrics.averageLatency)} ms`);
    this.updateElement('latency-range', `${Math.round(metrics.minimumLatency)} / ${Math.round(metrics.maximumLatency)} ms`);
    this.updateElement('packet-stats', `${metrics.packetsSent} / ${metrics.packetsReceived}`);
    this.updateElement('throughput', `${(metrics.bytesPerSecond / 1024).toFixed(2)} KB/s`);
    this.updateElement('reconnect-count', metrics.reconnectCount.toString());
    this.updateElement('message-rate', metrics.messagesPerSecond.toFixed(1));
  }

  private getQualityConfig(quality: string): { icon: string; text: string } {
    const configs = {
      excellent: { icon: '🟢', text: 'Excellent Connection' },
      good: { icon: '🟡', text: 'Good Connection' },
      fair: { icon: '🟠', text: 'Fair Connection' },
      poor: { icon: '🔴', text: 'Poor Connection' },
      critical: { icon: '❌', text: 'Critical Issues' },
    };
    return configs[quality as keyof typeof configs] || { icon: '❓', text: 'Unknown' };
  }

  private updateAlertsDisplay(alerts: HealthAlert[]): void {
    if (alerts.length === 0) {
      this.alertsElement.innerHTML = '<div class="no-alerts">No active health alerts</div>';
      return;
    }

    const alertsHtml = alerts.map(alert => `
      <div class="alert alert-${alert.severity}" data-alert-id="${alert.id}">
        <div class="alert-header">
          <span class="alert-type">${this.getAlertIcon(alert.severity)} ${alert.type}</span>
          <span class="alert-time">${this.formatTime(alert.timestamp)}</span>
          ${!alert.resolved ? `<button class="btn-resolve" onclick="window.resolveAlert('${alert.id}')">Resolve</button>` : ''}
        </div>
        <div class="alert-message">${alert.message}</div>
        ${alert.resolved ? `<div class="alert-resolved">✓ Resolved at ${this.formatTime(alert.resolvedAt!)}</div>` : ''}
      </div>
    `).join('');

    this.alertsElement.innerHTML = alertsHtml;
  }

  private getAlertIcon(severity: string): string {
    const icons = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🚨',
      critical: '💥',
    };
    return icons[severity as keyof typeof icons] || '❓';
  }

  private updateStatisticsDisplay(stats: any): void {
    if (!stats) return;

    const statsHtml = `
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">Total Connections</div>
          <div class="stat-value">${stats.totalConnections}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Average Latency</div>
          <div class="stat-value">${stats.averageLatency} ms</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Average Packet Loss</div>
          <div class="stat-value">${stats.averagePacketLoss}%</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Total Alerts</div>
          <div class="stat-value">${stats.totalAlerts}</div>
        </div>
      </div>
      <div class="quality-distribution">
        <h4>Quality Distribution</h4>
        ${this.renderQualityDistribution(stats.qualityDistribution)}
      </div>
      <div class="network-distribution">
        <h4>Network Conditions</h4>
        ${this.renderNetworkDistribution(stats.networkConditionDistribution)}
      </div>
    `;

    this.statisticsElement.innerHTML = statsHtml;
  }

  private renderQualityDistribution(distribution: Record<string, number>): string {
    if (!distribution || Object.keys(distribution).length === 0) {
      return '<div class="no-data">No quality data available</div>';
    }

    return Object.entries(distribution).map(([quality, count]) => `
      <div class="distribution-item">
        <span class="distribution-label">${quality}</span>
        <span class="distribution-count">${count}</span>
        <div class="distribution-bar">
          <div class="distribution-fill quality-${quality}" style="width: ${(count / Math.max(...Object.values(distribution)) * 100)}%"></div>
        </div>
      </div>
    `).join('');
  }

  private renderNetworkDistribution(distribution: Record<string, number>): string {
    if (!distribution || Object.keys(distribution).length === 0) {
      return '<div class="no-data">No network condition data available</div>';
    }

    return Object.entries(distribution).map(([condition, count]) => `
      <div class="distribution-item">
        <span class="distribution-label">${condition}</span>
        <span class="distribution-count">${count}</span>
        <div class="distribution-bar">
          <div class="distribution-fill condition-${condition}" style="width: ${(count / Math.max(...Object.values(distribution)) * 100)}%"></div>
        </div>
      </div>
    `).join('');
  }

  private runDiagnostic(): void {
    this.diagnosticsElement.innerHTML = '<div class="diagnostics-loading">🔍 Running network diagnostics...</div>';
    
    this.socket.emit('run-health-diagnostic', (report: DiagnosticReport) => {
      this.displayDiagnosticResults(report);
    });
  }

  private displayDiagnosticResults(report: DiagnosticReport): void {
    const testsHtml = report.tests.map(test => `
      <div class="diagnostic-test ${test.passed ? 'test-passed' : 'test-failed'}">
        <div class="test-header">
          <span class="test-icon">${test.passed ? '✅' : '❌'}</span>
          <span class="test-name">${test.testName}</span>
          <span class="test-result">${test.passed ? 'PASS' : 'FAIL'}</span>
        </div>
        <div class="test-details">
          <div class="test-message">${test.message}</div>
          ${test.value !== undefined ? `<div class="test-value">Value: ${test.value} ${test.threshold !== undefined ? `(Threshold: ${test.threshold})` : ''}</div>` : ''}
          ${test.suggestions && test.suggestions.length > 0 ? `
            <div class="test-suggestions">
              <strong>Suggestions:</strong>
              <ul>${test.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

    const diagnosticsHtml = `
      <div class="diagnostic-report">
        <div class="diagnostic-header">
          <h4>🔬 Network Diagnostic Report</h4>
          <div class="diagnostic-meta">
            <span class="report-time">📅 ${this.formatTime(report.timestamp)}</span>
            <span class="overall-health quality-${report.overallHealth}">
              ${this.getQualityConfig(report.overallHealth).icon} Overall: ${report.overallHealth.toUpperCase()}
            </span>
          </div>
        </div>
        
        <div class="diagnostic-summary">
          <div class="summary-item">
            <span class="summary-label">Network Type:</span>
            <span class="summary-value">${report.networkType || 'Unknown'}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Estimated Bandwidth:</span>
            <span class="summary-value">${report.estimatedBandwidth ? `${(report.estimatedBandwidth / 1000000).toFixed(2)} Mbps` : 'Unknown'}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Estimated Latency:</span>
            <span class="summary-value">${report.estimatedLatency ? `${Math.round(report.estimatedLatency)} ms` : 'Unknown'}</span>
          </div>
        </div>

        <div class="diagnostic-tests">
          <h5>Test Results</h5>
          ${testsHtml}
        </div>

        ${report.recommendations.length > 0 ? `
          <div class="diagnostic-recommendations">
            <h5>💡 Recommendations</h5>
            <ul>
              ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;

    this.diagnosticsElement.innerHTML = diagnosticsHtml;
  }

  private handleQualityChange(data: any): void {
    this.showNotification(`Connection quality changed from ${data.oldQuality} to ${data.newQuality}`, 
                         data.change > 0 ? 'success' : 'warning');
    this.refreshHealthData();
  }

  private handleDegradationWarning(data: any): void {
    this.showNotification(`Connection degraded: ${data.warnings.join(', ')}`, 'warning');
    this.refreshHealthData();
  }

  private handleRecoveryDetected(data: any): void {
    this.showNotification(`Connection recovered! Quality improved to ${data.quality}`, 'success');
    this.refreshHealthData();
  }

  private handleNetworkConditionChange(data: any): void {
    this.showNotification(`Network condition changed to: ${data.condition}`, 'info');
  }

  private handleAdaptiveAdjustment(data: any): void {
    this.showNotification(`Adaptive adjustment: ${data.adjustment} (${data.reason})`, 'info');
  }

  private addHealthAlert(alertData: any): void {
    this.alerts.push(alertData);
    this.updateAlertsDisplay(this.alerts);
    this.showNotification(`Health alert: ${alertData.message}`, alertData.severity);
  }

  private showNotification(message: string, type: string = 'info'): void {
    // Create a simple notification system
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  private exportHealthData(): void {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: this.currentMetrics,
      alerts: this.alerts,
      systemInfo: {
        userAgent: navigator.userAgent,
        connectionType: (navigator as any).connection?.effectiveType,
        onLine: navigator.onLine,
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `connection-health-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private updateElement(id: string, content: string): void {
    const element = this.container.querySelector(`#${id}`);
    if (element) {
      element.textContent = content;
    }
  }

  private formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  public destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    // Remove socket listeners
    this.socket.off('connection-quality-changed');
    this.socket.off('connection-degradation-warning');
    this.socket.off('connection-recovery-detected');
    this.socket.off('health-diagnostic-complete');
    this.socket.off('health-alert');
    this.socket.off('network-condition-changed');
    this.socket.off('adaptive-adjustment-applied');
  }
}

// Global function for resolving alerts
(window as any).resolveAlert = (alertId: string) => {
  // This would be connected to the actual socket instance
  console.log('Resolving alert:', alertId);
};

export default ConnectionHealthDemo;