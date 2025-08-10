/**
 * Global test setup for comprehensive cleanup and process management
 */

import { vi, afterAll, beforeAll } from 'vitest';

// Track active resources for cleanup
const activeResources = new Set<() => Promise<void>>();

// Add resource for cleanup tracking
export function trackResource(cleanup: () => Promise<void>) {
  activeResources.add(cleanup);
}

// Remove resource from tracking
export function untrackResource(cleanup: () => Promise<void>) {
  activeResources.delete(cleanup);
}

beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Increase max listeners to prevent memory warnings
  process.setMaxListeners(50);
  
  // Handle unhandled rejections in tests
  process.on('unhandledRejection', (reason, promise) => {
    console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.warn('Uncaught Exception:', error);
  });
});

afterAll(async () => {
  console.log('Running global test cleanup...');
  
  // Clean up all tracked resources
  const cleanupPromises = Array.from(activeResources).map(cleanup => 
    cleanup().catch(error => {
      console.warn('Resource cleanup failed:', error);
    })
  );
  
  await Promise.all(cleanupPromises);
  activeResources.clear();
  
  // Clear all timers
  vi.clearAllTimers();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Remove all listeners to prevent memory leaks
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');
  
  console.log('Global test cleanup completed');
});

// Track timeout for cleanup but don't force exit (Vitest handles this)
const forceExitTimer = setTimeout(() => {
  console.warn('Tests are taking longer than expected, but Vitest will handle cleanup...');
  // Remove process.exit(1) call - let Vitest handle test lifecycle
}, 60000); // 1 minute

// Clear the force exit timer when tests complete
afterAll(() => {
  clearTimeout(forceExitTimer);
  // Remove process.exit(0) call - let Vitest handle test completion naturally
});