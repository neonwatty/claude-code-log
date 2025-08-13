// Session Browser Navigation System
// Comprehensive navigation system with breadcrumbs, session management, routing, and accessibility

// Main comprehensive navigation system
export { ComprehensiveNavigationSystem } from './comprehensive-navigation-system';

// Core navigation components
export { SessionNavigation } from './navigation/SessionNavigation';
export { SessionManagementActions } from './session-management-actions';
export { SessionRouter, type RouteParams } from './session-router';

// State management
export { 
  SessionStateManager, 
  sessionStateManager, 
  withStateManager,
  type SessionBrowserUIState,
  type StateChangeListener 
} from './session-state-manager';

// Loading states and error handling
export { 
  LoadingSpinner,
  LoadingState,
  SessionSkeleton,
  ErrorBoundary 
} from './loading-states';

// Accessibility enhancements
export {
  ScreenReaderAnnouncements,
  SkipLinks,
  KeyboardNavigationHelp,
  FocusManager
} from './accessibility-enhancements';

// Existing session browser components
export { SessionBrowser } from './SessionBrowser';
export { RealtimeSessionBrowser } from './realtime-session-browser';

// Re-export session viewer
export { SessionViewer } from './viewer/SessionViewer';