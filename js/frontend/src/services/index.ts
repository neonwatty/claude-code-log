/**
 * Services module exports
 */

export { WebSocketService, getWebSocketService } from './websocket-service';
export { ConnectionManager, getConnectionManager } from './connection-manager';
export { AccessibilityService, getAccessibilityService } from './accessibility-service';
export type { IWebSocketConfig } from '../types/websocket';
export type { ConnectionManagerEvents } from './connection-manager';
export type { AccessibilityAnnouncement } from './accessibility-service';