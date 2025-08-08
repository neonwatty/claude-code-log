import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@app/shared';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: err.message,
    };
    return res.status(err.statusCode).json(response);
  }

  console.error('Unexpected error:', err);
  const response: ApiResponse = {
    success: false,
    error: 'Internal server error',
  };
  res.status(500).json(response);
};

export const notFoundHandler = (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: `Route ${req.originalUrl} not found`,
  };
  res.status(404).json(response);
};
