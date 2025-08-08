import { describe, it, expect } from 'vitest';
import { User, ApiResponse, API_ENDPOINTS } from './index';

describe('Shared Types and Interfaces', () => {
  describe('TypeScript Compilation', () => {
    it('should export User interface', () => {
      const user: User = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(user).toBeDefined();
      expect(user.id).toBe('123');
      expect(user.email).toBe('test@example.com');
    });

    it('should export ApiResponse interface', () => {
      const response: ApiResponse<string> = {
        success: true,
        data: 'test data',
        message: 'Success',
      };

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBe('test data');
    });

    it('should export API_ENDPOINTS constants', () => {
      expect(API_ENDPOINTS).toBeDefined();
      expect(API_ENDPOINTS.users).toBe('/api/users');
      expect(API_ENDPOINTS.auth).toBe('/api/auth');
      expect(API_ENDPOINTS.health).toBe('/api/health');
    });
  });

  describe('Type Safety', () => {
    it('should enforce User interface properties', () => {
      const validUser: User = {
        id: '456',
        email: 'valid@example.com',
        name: 'Valid User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(validUser.id).toBeTypeOf('string');
      expect(validUser.email).toBeTypeOf('string');
      expect(validUser.name).toBeTypeOf('string');
      expect(validUser.createdAt).toBeInstanceOf(Date);
      expect(validUser.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle optional ApiResponse properties', () => {
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Something went wrong',
      };

      expect(errorResponse.data).toBeUndefined();
      expect(errorResponse.message).toBeUndefined();
      expect(errorResponse.error).toBeDefined();
    });
  });
});
