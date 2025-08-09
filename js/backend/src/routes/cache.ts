import { Router } from 'express';
import { cacheManagement } from '../middleware/cache';

const router = Router();

/**
 * GET /api/cache/stats
 * Get cache statistics
 */
router.get('/stats', cacheManagement.getStats);

/**
 * GET /api/cache/entries
 * Get all cache entries for debugging
 */
router.get('/entries', cacheManagement.getEntries);

/**
 * DELETE /api/cache
 * Clear entire cache
 */
router.delete('/', cacheManagement.clearCache);

/**
 * DELETE /api/cache/:key
 * Delete specific cache entry
 */
router.delete('/:key', cacheManagement.deleteEntry);

/**
 * POST /api/cache/cleanup
 * Cleanup expired cache entries
 */
router.post('/cleanup', cacheManagement.cleanup);

export default router;