import { Router } from 'express';
import { ApiResponse, User, ErrorCode, HTTP_STATUS } from '@app/shared';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const users: User[] = [];

router.get('/', (req, res) => {
  const response: ApiResponse<User[]> = {
    success: true,
    data: users,
  };
  res.json(response);
});

router.get('/:id', (req, res, next) => {
  const user = users.find((u) => u.id === req.params.id);

  if (!user) {
    return next(new AppError(404, 'User not found'));
  }

  const response: ApiResponse<User> = {
    success: true,
    data: user,
  };
  res.json(response);
});

router.post('/', (req, res, next) => {
  const { email, name } = req.body;

  if (!email || !name) {
    return next(new AppError(400, 'Email and name are required'));
  }

  const newUser: User = {
    id: Date.now().toString(),
    email,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  users.push(newUser);

  const response: ApiResponse<User> = {
    success: true,
    data: newUser,
    message: 'User created successfully',
  };
  res.status(201).json(response);
});

router.put('/:id', (req, res, next) => {
  const userIndex = users.findIndex((u) => u.id === req.params.id);

  if (userIndex === -1) {
    return next(new AppError(404, 'User not found'));
  }

  const { email, name } = req.body;

  if (email) users[userIndex].email = email;
  if (name) users[userIndex].name = name;
  users[userIndex].updatedAt = new Date();

  const response: ApiResponse<User> = {
    success: true,
    data: users[userIndex],
    message: 'User updated successfully',
  };
  res.json(response);
});

router.delete('/:id', (req, res, next) => {
  const userIndex = users.findIndex((u) => u.id === req.params.id);

  if (userIndex === -1) {
    return next(new AppError(404, 'User not found'));
  }

  users.splice(userIndex, 1);

  const response: ApiResponse = {
    success: true,
    message: 'User deleted successfully',
  };
  res.json(response);
});

export default router;
