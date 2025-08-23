/**
 * Services module exports
 */

export { WebSocketService, getWebSocketService } from './websocket-service';
export { ConnectionManager, getConnectionManager } from './connection-manager';
export { AccessibilityService, getAccessibilityService } from './accessibility-service';
export { ClaudeIntegrationService, getClaudeIntegrationService, isProcessActive, isProcessFinished, getProcessStateLabel } from './claude-integration.service';
export type { IWebSocketConfig } from '../types/websocket';
export type { ConnectionManagerEvents } from './connection-manager';
export type { AccessibilityAnnouncement } from './accessibility-service';
export type { ClaudeIntegrationServiceConfig, ClaudeIntegrationEventMap } from './claude-integration.service';