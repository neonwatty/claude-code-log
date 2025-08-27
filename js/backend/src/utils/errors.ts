// Custom error classes for the Claude Code Log API

export enum ErrorCode {
  // Client errors (4xx)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  CONFLICT = "CONFLICT",
  RATE_LIMITED = "RATE_LIMITED",
  INVALID_INPUT = "INVALID_INPUT",

  // Server errors (5xx)
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  FILE_SYSTEM_ERROR = "FILE_SYSTEM_ERROR",
  WEBSOCKET_ERROR = "WEBSOCKET_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
}

export abstract class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number,
    errorCode: ErrorCode,
    isOperational = true,
    details?: any,
  ) {
    super(message);

    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 Bad Request
export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: any) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, true, details);
  }
}

export class InvalidInputError extends AppError {
  constructor(message = "Invalid input provided", details?: any) {
    super(message, 400, ErrorCode.INVALID_INPUT, true, details);
  }
}

// 401 Unauthorized
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", details?: any) {
    super(message, 401, ErrorCode.UNAUTHORIZED, true, details);
  }
}

// 403 Forbidden
export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden", details?: any) {
    super(message, 403, ErrorCode.FORBIDDEN, true, details);
  }
}

// 404 Not Found
export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: any) {
    super(message, 404, ErrorCode.NOT_FOUND, true, details);
  }
}

export class SessionNotFoundError extends NotFoundError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, { sessionId });
  }
}

export class ProjectNotFoundError extends NotFoundError {
  constructor(projectPath: string) {
    super(`Project not found: ${projectPath}`, { projectPath });
  }
}

// 409 Conflict
export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details?: any) {
    super(message, 409, ErrorCode.CONFLICT, true, details);
  }
}

// 429 Too Many Requests
export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded", details?: any) {
    super(message, 429, ErrorCode.RATE_LIMITED, true, details);
  }
}

// 500 Internal Server Error
export class InternalServerError extends AppError {
  constructor(message = "Internal server error", details?: any) {
    super(message, 500, ErrorCode.INTERNAL_SERVER_ERROR, false, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Database operation failed", details?: any) {
    super(message, 500, ErrorCode.DATABASE_ERROR, false, details);
  }
}

export class FileSystemError extends AppError {
  constructor(message = "File system operation failed", details?: any) {
    super(message, 500, ErrorCode.FILE_SYSTEM_ERROR, false, details);
  }
}

export class WebSocketError extends AppError {
  constructor(message = "WebSocket operation failed", details?: any) {
    super(message, 500, ErrorCode.WEBSOCKET_ERROR, false, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = "External service error", details?: any) {
    super(message, 500, ErrorCode.EXTERNAL_SERVICE_ERROR, false, details);
  }
}

// Error factory function
export const createError = (
  type:
    | "validation"
    | "notFound"
    | "unauthorized"
    | "forbidden"
    | "conflict"
    | "rateLimit"
    | "internal",
  message?: string,
  details?: any,
): AppError => {
  switch (type) {
    case "validation":
      return new ValidationError(message, details);
    case "notFound":
      return new NotFoundError(message, details);
    case "unauthorized":
      return new UnauthorizedError(message, details);
    case "forbidden":
      return new ForbiddenError(message, details);
    case "conflict":
      return new ConflictError(message, details);
    case "rateLimit":
      return new RateLimitError(message, details);
    case "internal":
    default:
      return new InternalServerError(message, details);
  }
};

// Utility functions
export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError;
};

export const isOperationalError = (error: any): boolean => {
  return isAppError(error) && error.isOperational;
};

export const getErrorResponse = (error: AppError) => {
  return {
    success: false,
    error: error.message,
    errorCode: error.errorCode,
    timestamp: error.timestamp,
    ...(error.details && { details: error.details }),
  };
};
