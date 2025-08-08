import { Router } from 'express';
import { ApiResponse } from '@app/shared';

const router = Router();

router.get('/', (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    },
  };
  res.json(response);
});

export default router;
