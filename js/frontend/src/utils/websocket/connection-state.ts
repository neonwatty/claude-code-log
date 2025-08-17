/**
 * WebSocket Connection State Management
 * Provides enums, utilities, and types for managing connection states
 */

export enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

export interface ConnectionStatistics {
  uptime: number;
  reconnectionCount: number;
  lastConnectTime: number | null;
  lastDisconnectTime: number | null;
  averageLatency: number;
  messagesSent: number;
  messagesReceived: number;
  totalDataSent: number;
  totalDataReceived: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
}

export interface ConnectionStateEvent {
  previousState: ConnectionState;
  currentState: ConnectionState;
  timestamp: number;
  reason?: string;
  error?: Error;
}

export interface ConnectionDebugInfo {
  url: string;
  protocols: string[];
  readyState: number;
  bufferedAmount: number;
  extensions: string;
  protocol: string;
  binaryType: string;
  statistics: ConnectionStatistics;
  lastHeartbeat: number | null;
  lastPong: number | null;
  reconnectionAttempts: number;
  maxReconnectionAttempts: number;
}

/**
 * Get display properties for connection state
 */
export function getConnectionStateDisplay(state: ConnectionState): {
  label: string;
  icon: string;
  color: string;
  severity: 'success' | 'warning' | 'error' | 'info';
} {
  switch (state) {
    case ConnectionState.CONNECTED:
      return {
        label: 'Connected',
        icon: '🟢',
        color: 'var(--color-success)',
        severity: 'success'
      };
    case ConnectionState.CONNECTING:
      return {
        label: 'Connecting',
        icon: '🟡',
        color: 'var(--color-warning)',
        severity: 'info'
      };
    case ConnectionState.RECONNECTING:
      return {
        label: 'Reconnecting',
        icon: '🔄',
        color: 'var(--color-warning)',
        severity: 'warning'
      };
    case ConnectionState.DISCONNECTED:
      return {
        label: 'Disconnected',
        icon: '🔴',
        color: 'var(--color-error)',
        severity: 'error'
      };
    case ConnectionState.ERROR:
      return {
        label: 'Error',
        icon: '❌',
        color: 'var(--color-error)',
        severity: 'error'
      };
    default:
      return {
        label: 'Unknown',
        icon: '❓',
        color: 'var(--color-text-muted)',
        severity: 'info'
      };
  }
}

/**
 * Calculate connection quality based on statistics
 */
export function calculateConnectionQuality(stats: Partial<ConnectionStatistics>): ConnectionStatistics['connectionQuality'] {
  const { averageLatency = 0, reconnectionCount = 0, uptime = 0 } = stats;
  
  // No connection time means unknown quality
  if (uptime === 0) return 'unknown';
  
  // High reconnection rate indicates poor quality
  const reconnectionRate = reconnectionCount / (uptime / 60000); // per minute
  if (reconnectionRate > 0.5) return 'poor';
  
  // Latency-based quality assessment
  if (averageLatency === 0) return 'unknown';
  if (averageLatency < 50) return 'excellent';
  if (averageLatency < 150) return 'good';
  if (averageLatency < 300) return 'fair';
  
  return 'poor';
}

/**
 * Format uptime duration for display
 */
export function formatUptime(uptimeMs: number): string {
  if (uptimeMs === 0) return '0s';
  
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Format data size for display
 */
export function formatDataSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get accessibility announcement for state change
 */
export function getStateChangeAnnouncement(event: ConnectionStateEvent): string {
  const { currentState, previousState, reason } = event;
  const stateDisplay = getConnectionStateDisplay(currentState);
  
  let announcement = `WebSocket connection state changed to ${stateDisplay.label}`;
  
  if (reason) {
    announcement += ` due to ${reason}`;
  }
  
  // Add contextual information
  switch (currentState) {
    case ConnectionState.CONNECTED:
      announcement += '. Real-time updates are now available.';
      break;
    case ConnectionState.CONNECTING:
      announcement += '. Attempting to establish connection.';
      break;
    case ConnectionState.RECONNECTING:
      announcement += '. Attempting to restore connection.';
      break;
    case ConnectionState.DISCONNECTED:
      announcement += '. Real-time updates are not available.';
      break;
    case ConnectionState.ERROR:
      announcement += '. Connection error occurred.';
      break;
  }
  
  return announcement;
}