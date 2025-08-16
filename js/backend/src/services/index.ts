/**
 * Cache services index file for easier imports and testing
 */

export { CacheDirectoryService, getCacheDirectoryService } from './cache-directory.service';
export { FileModificationService, getFileModificationService } from './file-modification.service';
export { CacheValidationService, getCacheValidationService } from './cache-validation.service';
export { JsonlCacheBuilderService, getJsonlCacheBuilderService } from './jsonl-cache-builder.service';
export { CacheInvalidationService, getCacheInvalidationService } from './cache-invalidation.service';
export { CacheAggregationService, getCacheAggregationService } from './cache-aggregation.service';

// Re-export existing services
export { getFileMonitor, createFileMonitor, FileMonitor } from './fileMonitor';

// Types and interfaces
export type {
  CacheDirectoryInfo,
  CacheDirectoryEvent
} from './cache-directory.service';

export type {
  FileStats,
  FileModificationResult,
  BatchCheckResult,
  DirectoryTrackingOptions,
  FileModificationEvent
} from './file-modification.service';

export type {
  ValidationOptions,
  ValidationEvent,
  MigrationResult,
  ChecksumValidationResult
} from './cache-validation.service';

export type {
  CacheBuildOptions,
  CacheBuildResult,
  CacheBuildEvent,
  StreamingBuildProgress
} from './jsonl-cache-builder.service';

export type {
  InvalidationRule,
  InvalidationEvent,
  CacheUpdateResult,
  DependencyMap,
  CacheWarmingStrategy,
  ExpirationPolicy
} from './cache-invalidation.service';

export type {
  AggregatedStats,
  ProjectSummary,
  SessionSummary,
  TimeBasedAggregation,
  QueryOptions,
  AggregationEvent,
  CachePerformanceMetrics
} from './cache-aggregation.service';