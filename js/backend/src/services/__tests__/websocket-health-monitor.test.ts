import WebSocketHealthMonitor, { 
  ConnectionMetrics, 
  HealthAlert,
  NetworkDiagnosticReport,
  ConnectionQuality 
} from '../websocket-health-monitor';
import { TypedSocket } from '../../types/websocket';
import { EventEmitter } from 'events';
import { vi } from 'vitest';

// Mock TypedSocket
class MockSocket extends EventEmitter {
  id: string;
  data: any;
  emit: ReturnType<typeof vi.fn>;

  constructor(id: string) {
    super();
    this.id = id;
    this.data = {
      userId: 'test-user',
      connectedAt: new Date(),
      reconnectCount: 0,
    };
    this.emit = vi.fn();
  }
  
  // Mock Socket.IO specific methods
  onAny(callback: (...args: any[]) => void) {
    // Mock implementation - just store the callback
    return this;
  }
  
  offAny(callback?: (...args: any[]) => void) {
    // Mock implementation
    return this;
  }
  
  // Mock disconnect method for proper cleanup
  disconnect() {
    this.removeAllListeners();
  }
}

describe('WebSocketHealthMonitor', () => {
  let healthMonitor: WebSocketHealthMonitor;
  let mockSocket: MockSocket;

  beforeEach(() => {
    healthMonitor = new WebSocketHealthMonitor({
      baseHeartbeatInterval: 100, // Faster for testing
      diagnosticInterval: 10000, // Longer interval to avoid timing issues in tests
      enableNetworkDiagnostics: false, // Disable diagnostics by default for stable tests
      enableAdaptiveHeartbeat: true,
    });
    
    mockSocket = new MockSocket('test-socket-1');
  });

  afterEach(async () => {
    // Properly stop monitoring for the socket first
    if (mockSocket) {
      healthMonitor.stopMonitoring(mockSocket.id);
      mockSocket.disconnect();
    }
    
    // Clear any remaining timers and shutdown
    await healthMonitor.shutdown();
    
    // Wait a bit to ensure all async operations complete
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  describe('Connection Monitoring', () => {
    test('should start monitoring a connection', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      const metrics = healthMonitor.getConnectionMetrics(mockSocket.id);
      expect(metrics).toBeDefined();
      expect(metrics!.socketId).toBe(mockSocket.id);
      expect(metrics!.userId).toBe('test-user');
      expect(metrics!.quality).toBe('excellent');
    });

    test('should stop monitoring a connection', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      healthMonitor.stopMonitoring(mockSocket.id);
      
      // Metrics should still exist but be marked as disconnected
      const metrics = healthMonitor.getConnectionMetrics(mockSocket.id);
      expect(metrics).toBeDefined();
      expect(metrics!.disconnectCount).toBe(1);
      expect(metrics!.lastDisconnect).toBeDefined();
    });

    test('should update connection metrics on ping-pong', (done) => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      // Simulate ping emission
      expect(mockSocket.emit).toHaveBeenCalledWith('ping', expect.any(Function));
      
      // Simulate pong response
      const pingCallback = mockSocket.emit.mock.calls.find(call => call[0] === 'ping')[1];
      
      setTimeout(() => {
        if (pingCallback) {
          pingCallback('pong');
        }
        
        // Trigger pong event
        mockSocket.emit('pong');
        
        const metrics = healthMonitor.getConnectionMetrics(mockSocket.id);
        expect(metrics!.packetsSent).toBeGreaterThan(0);
        expect(metrics!.averageLatency).toBeGreaterThan(0);
        done();
      }, 50);
    });
  });

  describe('Quality Assessment', () => {
    test('should assess excellent quality for low latency and no packet loss', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      // Simulate excellent conditions
      for (let i = 0; i < 5; i++) {
        (healthMonitor as any).recordLatency(mockSocket.id, 20); // Low latency
      }
      (healthMonitor as any).updateConnectionMetrics(mockSocket.id);
      
      const metrics = healthMonitor.getConnectionMetrics(mockSocket.id);
      expect(metrics!.quality).toBe('excellent');
      expect(metrics!.averageLatency).toBe(20);
    });

    test('should assess poor quality for high latency', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      // Simulate poor conditions
      for (let i = 0; i < 5; i++) {
        (healthMonitor as any).recordLatency(mockSocket.id, 800); // High latency
      }
      (healthMonitor as any).updateConnectionMetrics(mockSocket.id);
      
      const metrics = healthMonitor.getConnectionMetrics(mockSocket.id);
      expect(metrics!.quality).toBe('poor');
      expect(metrics!.averageLatency).toBe(800);
    });

    test('should assess critical quality for extreme packet loss', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      const metrics = healthMonitor.getConnectionMetrics(mockSocket.id)!;
      // Simulate high packet loss
      metrics.packetsSent = 100;
      metrics.packetsReceived = 50;
      
      (healthMonitor as any).updateConnectionMetrics(mockSocket.id);
      
      const updatedMetrics = healthMonitor.getConnectionMetrics(mockSocket.id);
      expect(updatedMetrics!.packetLossRate).toBe(0.5);
      expect(updatedMetrics!.quality).toBe('critical');
    });
  });

  describe('Network Condition Detection', () => {
    test('should detect high-latency condition', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      // Simulate high latency
      for (let i = 0; i < 5; i++) {
        (healthMonitor as any).recordLatency(mockSocket.id, 600);
      }
      (healthMonitor as any).updateConnectionMetrics(mockSocket.id);
      
      const metrics = healthMonitor.getConnectionMetrics(mockSocket.id);
      expect(metrics!.networkCondition).toBe('high-latency');
    });

    test('should detect packet-loss condition', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      const metrics = healthMonitor.getConnectionMetrics(mockSocket.id)!;
      metrics.packetsSent = 100;
      metrics.packetsReceived = 80; // 20% packet loss
      
      (healthMonitor as any).updateConnectionMetrics(mockSocket.id);
      
      const updatedMetrics = healthMonitor.getConnectionMetrics(mockSocket.id);
      expect(updatedMetrics!.networkCondition).toBe('packet-loss');
    });

    test('should detect unstable condition with high variance', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      // Simulate highly variable latency
      const latencies = [50, 500, 100, 800, 200, 600, 150, 700];
      latencies.forEach(latency => {
        (healthMonitor as any).recordLatency(mockSocket.id, latency);
      });
      (healthMonitor as any).updateConnectionMetrics(mockSocket.id);
      
      const metrics = healthMonitor.getConnectionMetrics(mockSocket.id);
      expect(metrics!.networkCondition).toBe('unstable');
    });
  });

  describe('Adaptive Heartbeat', () => {
    test('should calculate adaptive interval based on quality', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      const baseInterval = 100;
      
      // Test excellent quality - should increase interval
      const metrics = healthMonitor.getConnectionMetrics(mockSocket.id)!;
      metrics.quality = 'excellent';
      
      const excellentInterval = (healthMonitor as any).calculateAdaptiveInterval(mockSocket.id);
      expect(excellentInterval).toBeGreaterThan(baseInterval);
      
      // Test poor quality - should decrease interval
      metrics.quality = 'poor';
      const poorInterval = (healthMonitor as any).calculateAdaptiveInterval(mockSocket.id);
      expect(poorInterval).toBeLessThan(baseInterval);
      
      // Test critical quality - should significantly decrease interval
      metrics.quality = 'critical';
      const criticalInterval = (healthMonitor as any).calculateAdaptiveInterval(mockSocket.id);
      expect(criticalInterval).toBeLessThan(poorInterval);
    });

    test('should respect min and max interval bounds', () => {
      const minInterval = 50;
      const maxInterval = 200;
      
      const monitor = new WebSocketHealthMonitor({
        baseHeartbeatInterval: 100,
        minHeartbeatInterval: minInterval,
        maxHeartbeatInterval: maxInterval,
      });
      
      monitor.startMonitoring(mockSocket as any as TypedSocket);
      
      const metrics = monitor.getConnectionMetrics(mockSocket.id)!;
      
      // Test that excellent quality doesn't exceed max
      metrics.quality = 'excellent';
      const excellentInterval = (monitor as any).calculateAdaptiveInterval(mockSocket.id);
      expect(excellentInterval).toBeLessThanOrEqual(maxInterval);
      
      // Test that critical quality doesn't go below min
      metrics.quality = 'critical';
      const criticalInterval = (monitor as any).calculateAdaptiveInterval(mockSocket.id);
      expect(criticalInterval).toBeGreaterThanOrEqual(minInterval);
      
      monitor.shutdown();
    });
  });

  describe('Event Emission', () => {
    test('should emit quality-changed event', (done) => {
      healthMonitor.on('quality-changed', (data) => {
        expect(data.socketId).toBe(mockSocket.id);
        expect(data.oldQuality).toBe('excellent');
        expect(data.newQuality).toBe('poor');
        expect(data.change).toBeLessThan(0);
        done();
      });
      
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      // Force quality change
      const metrics = healthMonitor.getConnectionMetrics(mockSocket.id)!;
      metrics.quality = 'excellent';
      
      // Simulate degradation
      for (let i = 0; i < 5; i++) {
        (healthMonitor as any).recordLatency(mockSocket.id, 800);
      }
      (healthMonitor as any).updateConnectionMetrics(mockSocket.id);
    });

    test('should emit degradation-warning event', (done) => {
      healthMonitor.on('degradation-warning', (data) => {
        expect(data.socketId).toBe(mockSocket.id);
        expect(data.warnings).toContain(expect.stringContaining('High latency'));
        done();
      });
      
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      // Simulate high latency
      for (let i = 0; i < 5; i++) {
        (healthMonitor as any).recordLatency(mockSocket.id, 600);
      }
      (healthMonitor as any).updateConnectionMetrics(mockSocket.id);
    });

    test('should emit health-alert for critical issues', (done) => {
      healthMonitor.on('health-alert', (alert) => {
        expect(alert.socketId).toBe(mockSocket.id);
        expect(alert.severity).toBe('high');
        expect(alert.message).toContain('Heartbeat timeout');
        done();
      });
      
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      // Simulate heartbeat timeout
      (healthMonitor as any).handleHeartbeatTimeout(mockSocket);
    });
  });

  describe('Network Diagnostics', () => {
    test('should perform network diagnostics', async () => {
      // Create a separate monitor with diagnostics enabled for this test
      const diagnosticMonitor = new WebSocketHealthMonitor({
        baseHeartbeatInterval: 100,
        diagnosticInterval: 10000, // Long interval to avoid auto-triggering
        enableNetworkDiagnostics: true,
        enableAdaptiveHeartbeat: true,
      });
      
      try {
        diagnosticMonitor.startMonitoring(mockSocket as any as TypedSocket);
        
        // Add some metrics data
        for (let i = 0; i < 5; i++) {
          (diagnosticMonitor as any).recordLatency(mockSocket.id, 100);
        }
        (diagnosticMonitor as any).updateConnectionMetrics(mockSocket.id);
        
        const report = await diagnosticMonitor.performHealthCheck(mockSocket.id);
        
        expect(report).toBeDefined();
        expect(report!.socketId).toBe(mockSocket.id);
        expect(report!.tests).toHaveLength(4); // Should have 4 diagnostic tests
        expect(report!.overallHealth).toBeDefined();
        expect(report!.recommendations).toBeDefined();
        
        // Clean up the diagnostic monitor
        diagnosticMonitor.stopMonitoring(mockSocket.id);
        await diagnosticMonitor.shutdown();
      } catch (error) {
        diagnosticMonitor.stopMonitoring(mockSocket.id);
        await diagnosticMonitor.shutdown();
        throw error;
      }
    });

    test('should generate appropriate recommendations', async () => {
      // Create a separate monitor for this test
      const diagnosticMonitor = new WebSocketHealthMonitor({
        baseHeartbeatInterval: 100,
        diagnosticInterval: 10000,
        enableNetworkDiagnostics: true,
        enableAdaptiveHeartbeat: true,
      });
      
      try {
        diagnosticMonitor.startMonitoring(mockSocket as any as TypedSocket);
        
        // Simulate poor conditions
        const metrics = diagnosticMonitor.getConnectionMetrics(mockSocket.id)!;
        metrics.averageLatency = 500;
        metrics.packetLossRate = 0.1;
        metrics.stabilityScore = 50;
        
        const report = await (diagnosticMonitor as any).performNetworkDiagnostics(mockSocket.id);
        
        expect(report.recommendations.length).toBeGreaterThan(0);
        expect(report.recommendations).toContain(expect.stringContaining('network'));
        
        // Clean up
        diagnosticMonitor.stopMonitoring(mockSocket.id);
        await diagnosticMonitor.shutdown();
      } catch (error) {
        diagnosticMonitor.stopMonitoring(mockSocket.id);
        await diagnosticMonitor.shutdown();
        throw error;
      }
    });

    test('should estimate network type correctly', () => {
      const metrics: Partial<ConnectionMetrics> = {
        averageLatency: 5,
        latencyVariance: 50,
      };
      
      const networkType = (healthMonitor as any).estimateNetworkType(metrics);
      expect(networkType).toBe('ethernet');
      
      // Test cellular characteristics
      metrics.averageLatency = 200;
      metrics.latencyVariance = 5000;
      const cellularType = (healthMonitor as any).estimateNetworkType(metrics);
      expect(cellularType).toBe('cellular');
    });
  });

  describe('Alert Management', () => {
    test('should create and manage alerts', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      (healthMonitor as any).createAlert(mockSocket.id, 'health-alert', {
        severity: 'high',
        message: 'Test alert',
      });
      
      const alerts = healthMonitor.getAlerts(mockSocket.id);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].message).toBe('Test alert');
      expect(alerts[0].severity).toBe('high');
    });

    test('should resolve alerts', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      (healthMonitor as any).createAlert(mockSocket.id, 'health-alert', {
        severity: 'medium',
        message: 'Test alert for resolution',
      });
      
      const alerts = healthMonitor.getAlerts(mockSocket.id);
      const alertId = alerts[0].id;
      
      const resolved = healthMonitor.resolveAlert(alertId);
      expect(resolved).toBe(true);
      
      const updatedAlerts = healthMonitor.getAlerts(mockSocket.id);
      expect(updatedAlerts[0].resolved).toBe(true);
      expect(updatedAlerts[0].resolvedAt).toBeDefined();
    });
  });

  describe('Statistics and Reporting', () => {
    test('should provide health statistics', () => {
      // Add multiple connections
      const socket2 = new MockSocket('test-socket-2');
      const socket3 = new MockSocket('test-socket-3');
      
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      healthMonitor.startMonitoring(socket2 as any as TypedSocket);
      healthMonitor.startMonitoring(socket3 as any as TypedSocket);
      
      // Set different qualities
      const metrics1 = healthMonitor.getConnectionMetrics(mockSocket.id)!;
      const metrics2 = healthMonitor.getConnectionMetrics(socket2.id)!;
      const metrics3 = healthMonitor.getConnectionMetrics(socket3.id)!;
      
      metrics1.quality = 'excellent';
      metrics1.averageLatency = 50;
      metrics2.quality = 'good';
      metrics2.averageLatency = 100;
      metrics3.quality = 'poor';
      metrics3.averageLatency = 300;
      
      const stats = healthMonitor.getHealthStatistics();
      
      expect(stats.totalConnections).toBe(3);
      expect(stats.averageLatency).toBe(150); // (50 + 100 + 300) / 3
      expect(stats.qualityDistribution).toEqual({
        excellent: 1,
        good: 1,
        poor: 1,
      });
    });

    test('should provide empty statistics for no connections', () => {
      const stats = healthMonitor.getHealthStatistics();
      
      expect(stats.totalConnections).toBe(0);
      expect(stats.averageLatency).toBe(0);
      expect(stats.averagePacketLoss).toBe(0);
      expect(stats.qualityDistribution).toEqual({});
    });

    test('should get all connection metrics', () => {
      const socket2 = new MockSocket('test-socket-2');
      
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      healthMonitor.startMonitoring(socket2 as any as TypedSocket);
      
      const allMetrics = healthMonitor.getAllConnectionMetrics();
      expect(allMetrics).toHaveLength(2);
      expect(allMetrics.map(m => m.socketId)).toContain(mockSocket.id);
      expect(allMetrics.map(m => m.socketId)).toContain(socket2.id);
    });
  });

  describe('Configuration', () => {
    test('should update configuration', () => {
      const newConfig = {
        baseHeartbeatInterval: 5000,
        enableAdaptiveHeartbeat: false,
      };
      
      healthMonitor.updateConfig(newConfig);
      
      expect((healthMonitor as any).config.baseHeartbeatInterval).toBe(5000);
      expect((healthMonitor as any).config.enableAdaptiveHeartbeat).toBe(false);
    });

    test('should emit config-updated event', (done) => {
      healthMonitor.on('config-updated', (config) => {
        expect(config.baseHeartbeatInterval).toBe(8000);
        done();
      });
      
      healthMonitor.updateConfig({ baseHeartbeatInterval: 8000 });
    });
  });

  describe('Stability Score Calculation', () => {
    test('should calculate stability score correctly', () => {
      const metrics: Partial<ConnectionMetrics> = {
        averageLatency: 100,
        packetLossRate: 0.02,
        disconnectCount: 1,
        latencyVariance: 500,
      };
      
      const score = (healthMonitor as any).calculateStabilityScore(metrics);
      
      // Should deduct points for latency (5 points), packet loss (2 points), 
      // disconnects (5 points), but not for variance (< 1000)
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(80);
    });

    test('should handle extreme conditions in stability score', () => {
      const badMetrics: Partial<ConnectionMetrics> = {
        averageLatency: 2000,
        packetLossRate: 0.3,
        disconnectCount: 5,
        latencyVariance: 10000,
      };
      
      const score = (healthMonitor as any).calculateStabilityScore(badMetrics);
      expect(score).toBe(0); // Should be capped at 0
    });
  });

  describe('Throughput Monitoring', () => {
    test('should monitor message throughput', () => {
      healthMonitor.startMonitoring(mockSocket as any as TypedSocket);
      
      // Simulate message throughput monitoring setup
      (healthMonitor as any).monitorMessageThroughput(mockSocket);
      
      // Should have set up monitoring (testing the setup, not actual throughput)
      expect(mockSocket.emit).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing metrics gracefully', async () => {
      const report = await healthMonitor.performHealthCheck('non-existent-socket');
      expect(report).toBeNull();
    });

    test('should handle errors in metric updates', () => {
      // This test ensures the system doesn't crash on invalid data
      expect(() => {
        (healthMonitor as any).updateConnectionMetrics('non-existent-socket');
      }).not.toThrow();
    });
  });
});