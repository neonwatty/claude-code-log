import { describe, it, expect } from 'vitest';
import { 
  User, 
  ApiResponse, 
  API_ENDPOINTS, 
  TranscriptEntry,
  UserTranscriptEntry,
  AssistantTranscriptEntry,
  UsageInfo,
  TextContent,
  ToolUseContent
} from './index';

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

  describe('Transcript Data Models', () => {
    it('should create valid TextContent', () => {
      const textContent: TextContent = {
        type: 'text',
        text: 'Hello world'
      };

      expect(textContent.type).toBe('text');
      expect(textContent.text).toBe('Hello world');
    });

    it('should create valid ToolUseContent', () => {
      const toolUse: ToolUseContent = {
        type: 'tool_use',
        id: 'tool_123',
        name: 'Read',
        input: { file_path: '/test/file.txt' }
      };

      expect(toolUse.type).toBe('tool_use');
      expect(toolUse.id).toBe('tool_123');
      expect(toolUse.name).toBe('Read');
      expect(toolUse.input).toEqual({ file_path: '/test/file.txt' });
    });

    it('should create valid UsageInfo', () => {
      const usage: UsageInfo = {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 5
      };

      expect(usage.input_tokens).toBe(100);
      expect(usage.output_tokens).toBe(50);
      expect(usage.cache_creation_input_tokens).toBe(10);
      expect(usage.cache_read_input_tokens).toBe(5);
    });

    it('should create valid UserTranscriptEntry', () => {
      const userEntry: UserTranscriptEntry = {
        type: 'user',
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/project',
        sessionId: 'session_123',
        version: '1.0.0',
        uuid: 'uuid_123',
        timestamp: '2024-01-01T00:00:00Z',
        message: {
          role: 'user',
          content: 'Hello Claude'
        }
      };

      expect(userEntry.type).toBe('user');
      expect(userEntry.message.role).toBe('user');
      expect(userEntry.message.content).toBe('Hello Claude');
    });

    it('should create valid AssistantTranscriptEntry', () => {
      const assistantEntry: AssistantTranscriptEntry = {
        type: 'assistant',
        parentUuid: null,
        isSidechain: false,
        userType: 'assistant',
        cwd: '/project',
        sessionId: 'session_123',
        version: '1.0.0',
        uuid: 'uuid_456',
        timestamp: '2024-01-01T00:00:01Z',
        message: {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [{
            type: 'text',
            text: 'Hello! How can I help you?'
          }]
        }
      };

      expect(assistantEntry.type).toBe('assistant');
      expect(assistantEntry.message.role).toBe('assistant');
      expect(assistantEntry.message.content).toHaveLength(1);
      expect(assistantEntry.message.content[0].type).toBe('text');
    });
  });
});
