/**
 * Cache utilities for Claude Code Log backend.
 * 
 * This module provides TypeScript interfaces and utilities for working with
 * the Claude Code Log cache system, maintaining compatibility with the Python
 * cache implementation.
 */

// Export all cache-related types and interfaces
export type {
  CachedFileInfo,
  SessionCacheData,
  ProjectCache,
  CacheStats,
  CacheManagerConfig,
  CacheLoadOptions,
  CacheValidationResult,
} from './types';

// Note: Cache manager implementation will be added in future tasks
// export { CacheManager } from './manager';

/**
 * Current cache format version.
 * 
 * This should match the version used by the Python implementation
 * to ensure compatibility between cache files.
 */
export const CACHE_FORMAT_VERSION = '1.0.0';

/**
 * Default cache directory name.
 */
export const DEFAULT_CACHE_DIR = 'cache';

/**
 * Cache index filename.
 */
export const CACHE_INDEX_FILENAME = 'index.json';

/**
 * Special timestamp key for entries without timestamps.
 */
export const NO_TIMESTAMP_KEY = '_no_timestamp';