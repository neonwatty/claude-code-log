import { describe, it, expect } from 'vitest';
import {
  User,
  ApiResponse,
  ErrorCode,
  HTTP_STATUS,
  isApiError,
  isUser,
  PaginatedResponse,
  SearchParams,
} from '@app/shared';

describe('Shared Types', () => {
  it('should create a valid User object', () => {
    const user: User = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(isUser(user)).toBe(true);
    expect(user.email).toBe('test@example.com');
  });

  it('should create a valid ApiResponse', () => {
    const response: ApiResponse<User> = {
      success: true,
      data: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  it('should use ErrorCode enum', () => {
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
  });

  it('should use HTTP_STATUS constants', () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
  });

  it('should validate error objects with type guard', () => {
    const error = {
      code: ErrorCode.NOT_FOUND,
      message: 'Resource not found',
      timestamp: new Date(),
    };

    expect(isApiError(error)).toBe(true);
  });

  it('should create PaginatedResponse', () => {
    const paginated: PaginatedResponse<User> = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    };

    expect(paginated.page).toBe(1);
    expect(paginated.pageSize).toBe(10);
  });

  it('should create SearchParams', () => {
    const params: SearchParams = {
      query: 'test',
      page: 1,
      pageSize: 20,
      sortBy: 'name',
      sortOrder: 'asc',
      filters: { active: true },
    };

    expect(params.query).toBe('test');
    expect(params.sortOrder).toBe('asc');
  });
});
