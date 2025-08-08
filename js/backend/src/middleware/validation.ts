import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    if (!req.is('application/json')) {
      throw new AppError(400, 'Content-Type must be application/json');
    }
  }
  next();
};