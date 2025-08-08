import { Router } from 'express';
import healthRoutes from './health';
import userRoutes from './users';
import authRoutes from './auth';
import taskRoutes from './tasks';
import websocketRoutes from './websocket';

const router = Router();

router.use('/health', healthRoutes);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);
router.use('/websocket', websocketRoutes);

export default router;
