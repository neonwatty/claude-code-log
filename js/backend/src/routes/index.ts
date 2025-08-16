import { Router } from 'express';

const router = Router();

// API routes will be mounted here
// Example: router.use('/users', userRoutes);
// Example: router.use('/logs', logRoutes);

// Default API route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Claude Code Log API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

export default router;