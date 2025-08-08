import { Router } from 'express';
import healthRoutes from './health';
import userRoutes from './users';
import authRoutes from './auth';
import taskRoutes from './tasks';

const router = Router();

router.use('/health', healthRoutes);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);

export default router;
