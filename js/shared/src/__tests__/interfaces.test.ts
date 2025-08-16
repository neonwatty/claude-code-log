import {
  ITodoItem,
  IUsageInfo,
  IApiResponse,
  IUserMessage,
  IAssistantMessage
} from '../interfaces';

describe('Shared Interfaces', () => {
  describe('ITodoItem', () => {
    it('should accept valid todo item', () => {
      const todo: ITodoItem = {
        id: 'test-1',
        content: 'Test todo item',
        status: 'pending',
        priority: 'high'
      };
      
      expect(todo.id).toBe('test-1');
      expect(todo.status).toBe('pending');
      expect(todo.priority).toBe('high');
    });
  });

  describe('IUsageInfo', () => {
    it('should accept optional usage fields', () => {
      const usage: IUsageInfo = {
        input_tokens: 100,
        output_tokens: 50
      };
      
      expect(usage.input_tokens).toBe(100);
      expect(usage.output_tokens).toBe(50);
    });

    it('should accept all optional fields', () => {
      const usage: IUsageInfo = {
        input_tokens: 100,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 30,
        output_tokens: 50,
        service_tier: 'premium'
      };
      
      expect(usage.cache_creation_input_tokens).toBe(20);
      expect(usage.service_tier).toBe('premium');
    });
  });

  describe('IApiResponse', () => {
    it('should accept successful response', () => {
      const response: IApiResponse = {
        success: true,
        data: { test: 'data' },
        timestamp: new Date().toISOString()
      };
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ test: 'data' });
    });

    it('should accept error response', () => {
      const response: IApiResponse = {
        success: false,
        error: 'Something went wrong',
        timestamp: new Date().toISOString()
      };
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
    });
  });

  describe('Message Interfaces', () => {
    it('should accept user message with string content', () => {
      const message: IUserMessage = {
        role: 'user',
        content: 'Hello, world!'
      };
      
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
    });

    it('should accept assistant message with required fields', () => {
      const message: IAssistantMessage = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-sonnet',
        content: [{
          type: 'text',
          text: 'Hello!'
        }]
      };
      
      expect(message.id).toBe('msg-123');
      expect(message.role).toBe('assistant');
      expect(message.content).toHaveLength(1);
    });
  });

  describe('Type Safety', () => {
    it('should enforce todo status enum', () => {
      const validStatuses: ITodoItem['status'][] = ['pending', 'in_progress', 'completed'];
      
      validStatuses.forEach(status => {
        const todo: ITodoItem = {
          id: 'test',
          content: 'test',
          status,
          priority: 'medium'
        };
        expect(['pending', 'in_progress', 'completed']).toContain(todo.status);
      });
    });

    it('should enforce todo priority enum', () => {
      const validPriorities: ITodoItem['priority'][] = ['high', 'medium', 'low'];
      
      validPriorities.forEach(priority => {
        const todo: ITodoItem = {
          id: 'test',
          content: 'test',
          status: 'pending',
          priority
        };
        expect(['high', 'medium', 'low']).toContain(todo.priority);
      });
    });
  });
});