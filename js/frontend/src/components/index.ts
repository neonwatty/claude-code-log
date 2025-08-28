/**
 * Main components export file
 * Exports all components for easy importing throughout the application
 */

// Base components
export * from "./base/index.js";

// UI Components will be exported here as they are created
export * from "./session-list/index.js";
export * from "./session-detail/index.js";
export * from "./session-continuation/index.js";
export * from "./message-card/index.js";
export * from "./filter-bar/index.js";
export * from "./timeline/index.js";
export * from "./project-dashboard/index.js";
export * from "./export-dialog/index.js";

// Connection and notification components
export * from "./connection-status/index.js";
export * from "./connection-indicator/index.js";
export * from "./statistics-dashboard/index.js";
export * from "./session-card/index.js";
export * from "./toast-notifications/index.js";

// Analytics components
export * from "./analytics/index.js";

// Onboarding components
export * from "./onboarding/index.js";

/**
 * Component registration function
 * Call this to register all custom elements
 */
export function registerComponents(): void {
  // Components will be registered here as they are created
  console.log("Components registration system ready");
}
