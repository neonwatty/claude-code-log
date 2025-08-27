/**
 * Services module exports
 */

export { WebSocketService, getWebSocketService } from "./websocket-service";
export { ConnectionManager, getConnectionManager } from "./connection-manager";
export {
  AccessibilityService,
  getAccessibilityService,
} from "./accessibility-service";
export {
  ClaudeIntegrationService,
  getClaudeIntegrationService,
  isProcessActive,
  isProcessFinished,
  getProcessStateLabel,
} from "./claude-integration.service";
export { SearchService, searchService } from "./search.service";
export { ExportService, exportService } from "./export.service";
export { PreferencesService, preferencesService } from "./preferences.service";
export { AnalyticsService, analyticsService } from "./analytics.service";
export { OfflineService, offlineService } from "./offline.service";

export type { IWebSocketConfig } from "../types/websocket";
export type { ConnectionManagerEvents } from "./connection-manager";
export type { AccessibilityAnnouncement } from "./accessibility-service";
export type {
  ClaudeIntegrationServiceConfig,
  ClaudeIntegrationEventMap,
} from "./claude-integration.service";
export type {
  SearchResult,
  SearchOptions,
  SearchField,
} from "./search.service";
export type {
  ExportFormat,
  ExportOptions,
  ExportResult,
  ExportStats,
} from "./export.service";
export type {
  UserPreferences,
  ThemeMode,
  DisplayDensity,
  DateFormat,
  PreferenceChangeEvent,
} from "./preferences.service";
export type {
  AnalyticsEvent,
  AnalyticsEventType,
  UsageStatistics,
  PerformanceMetrics,
  FeatureUsage,
} from "./analytics.service";
export type {
  OfflineConfig,
  SyncResult,
  StorageQuota,
  OfflineDataEntry,
  SyncStatus,
} from "./offline.service";
