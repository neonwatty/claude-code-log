import { Router } from 'express';
import { ApiResponse, ErrorCode } from '@app/shared';
import { AppError } from '../middleware/errorHandler';

const router = Router();

router.post('/login', (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError(400, 'Email and password are required'));
  }

  const response: ApiResponse = {
    success: true,
    data: {
      token: 'placeholder-jwt-token',
      user: {
        id: '1',
        email,
        name: 'Demo User',
      },
    },
    message: 'Login successful',
  };
  res.json(response);
});

router.post('/logout', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: 'Logout successful',
  };
  res.json(response);
});

router.post('/register', (req, res, next) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return next(new AppError(400, 'Email, password and name are required'));
  }

  const response: ApiResponse = {
    success: true,
    data: {
      user: {
        id: Date.now().toString(),
        email,
        name,
        createdAt: new Date(),
      },
    },
    message: 'Registration successful',
  };
  res.status(201).json(response);
});

router.get('/me', (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      id: '1',
      email: 'demo@example.com',
      name: 'Demo User',
      createdAt: new Date(),
    },
  };
  res.json(response);
});

export default router;