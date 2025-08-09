import { Router } from 'express';
import healthRoutes from './health';
import userRoutes from './users';
import authRoutes from './auth';
import taskRoutes from './tasks';
import websocketRoutes from './websocket';
import sessionsRoutes from './sessions';
import analyticsRoutes from './analytics';
import messagesRoutes from './messages';
import cacheRoutes from './cache';
import { cacheConfigs } from '../middleware/cache';

const router = Router();

// Routes without caching
router.use('/health', healthRoutes);
router.use('/websocket', websocketRoutes);
router.use('/cache', cacheRoutes);

// Routes with short caching (2 minutes) - frequently changing data
router.use('/users', cacheConfigs.short, userRoutes);
router.use('/auth', cacheConfigs.none, authRoutes); // No caching for auth
router.use('/tasks', cacheConfigs.short, taskRoutes);

// Routes with medium caching (10 minutes) - semi-static data
router.use('/sessions', cacheConfigs.session, sessionsRoutes);
router.use('/messages', cacheConfigs.medium, messagesRoutes);

// Routes with long caching (15 minutes) - analytics data
router.use('/analytics', cacheConfigs.analytics, analyticsRoutes);

export default router;
