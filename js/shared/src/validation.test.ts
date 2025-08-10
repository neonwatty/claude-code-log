import { describe, it, expect } from 'vitest';
import {
  validateTranscriptEntry,
  validateContentItem,
  validateUsageInfo,
  isTranscriptEntry,
  isUserTranscriptEntry,
  isAssistantTranscriptEntry,
  isContentItem,
  TextContentSchema,
  ToolUseContentSchema,
  ToolResultContentSchema,
  UsageInfoSchema,
  TranscriptEntrySchema,
} from './validation';

describe('Validation Schemas', () => {
  describe('Content Type Validation', () => {
    it('should validate TextContent correctly', () => {
      const validText = { type: 'text', text: 'Hello world' };
      const invalidText = { type: 'text', text: 123 };

      expect(TextContentSchema.safeParse(validText).success).toBe(true);
      expect(TextContentSchema.safeParse(invalidText).success).toBe(false);
    });

    it('should validate ToolUseContent correctly', () => {
      const validToolUse = {
        type: 'tool_use',
        id: 'tool_123',
        name: 'Read',
        input: { file_path: '/test.txt' }
      };
      const invalidToolUse = {
        type: 'tool_use',
        id: 'tool_123'
        // missing name and input
      };

      expect(ToolUseContentSchema.safeParse(validToolUse).success).toBe(true);
      expect(ToolUseContentSchema.safeParse(invalidToolUse).success).toBe(false);
    });

    it('should validate ToolResultContent correctly', () => {
      const validResult = {
        type: 'tool_result',
        tool_use_id: 'tool_123',
        content: 'File content here',
        is_error: false
      };
      const invalidResult = {
        type: 'tool_result'
        // missing tool_use_id and content
      };

      expect(ToolResultContentSchema.safeParse(validResult).success).toBe(true);
      expect(ToolResultContentSchema.safeParse(invalidResult).success).toBe(false);
    });
  });

  describe('Usage Info Validation', () => {
    it('should validate complete UsageInfo', () => {
      const validUsage = {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 5,
        service_tier: 'standard'
      };

      const result = UsageInfoSchema.safeParse(validUsage);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.input_tokens).toBe(100);
        expect(result.data.output_tokens).toBe(50);
      }
    });

    it('should validate partial UsageInfo with optional fields', () => {
      const partialUsage = {
        input_tokens: 100,
        output_tokens: 50
      };

      const result = UsageInfoSchema.safeParse(partialUsage);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UsageInfo', () => {
      const invalidUsage = {
        input_tokens: 'not-a-number',
        output_tokens: 50
      };

      expect(UsageInfoSchema.safeParse(invalidUsage).success).toBe(false);
    });
  });

  describe('Transcript Entry Validation', () => {
    it('should validate UserTranscriptEntry', () => {
      const validUserEntry = {
        type: 'user',
        parentUuid: undefined,
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

      const result = validateTranscriptEntry(validUserEntry);
      expect(result.success).toBe(true);
      expect(isUserTranscriptEntry(validUserEntry)).toBe(true);
    });

    it('should validate AssistantTranscriptEntry', () => {
      const validAssistantEntry = {
        type: 'assistant',
        parentUuid: undefined,
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
          }],
          usage: {
            input_tokens: 10,
            output_tokens: 15
          }
        }
      };

      const result = validateTranscriptEntry(validAssistantEntry);
      expect(result.success).toBe(true);
      expect(isAssistantTranscriptEntry(validAssistantEntry)).toBe(true);
    });

    it('should reject invalid transcript entries', () => {
      const invalidEntry = {
        type: 'invalid_type',
        message: 'This should fail'
      };

      const result = validateTranscriptEntry(invalidEntry);
      expect(result.success).toBe(false);
      expect(isTranscriptEntry(invalidEntry)).toBe(false);
    });

    it('should handle complex content arrays', () => {
      const entryWithComplexContent = {
        type: 'assistant',
        parentUuid: undefined,
        isSidechain: false,
        userType: 'assistant',
        cwd: '/project',
        sessionId: 'session_123',
        version: '1.0.0',
        uuid: 'uuid_789',
        timestamp: '2024-01-01T00:00:02Z',
        message: {
          id: 'msg_456',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [
            {
              type: 'text',
              text: "I'll help you with that file."
            },
            {
              type: 'tool_use',
              id: 'tool_789',
              name: 'Read',
              input: { file_path: '/test/file.txt' }
            }
          ]
        }
      };

      const result = validateTranscriptEntry(entryWithComplexContent);
      expect(result.success).toBe(true);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify content item types', () => {
      const textContent = { type: 'text', text: 'Hello' };
      const toolUse = { type: 'tool_use', id: '1', name: 'Test', input: {} };
      const invalidContent = { type: 'invalid', data: 'test' };

      expect(isContentItem(textContent)).toBe(true);
      expect(isContentItem(toolUse)).toBe(true);
      expect(isContentItem(invalidContent)).toBe(false);
    });

    it('should handle edge cases in validation', () => {
      expect(isTranscriptEntry(null)).toBe(false);
      expect(isTranscriptEntry(undefined)).toBe(false);
      expect(isTranscriptEntry({})).toBe(false);
      expect(isTranscriptEntry('string')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should provide detailed error information', () => {
      const invalidEntry = {
        type: 'user',
        message: {
          role: 'user',
          content: 123 // should be string or array
        }
        // missing required fields
      };

      const result = TranscriptEntrySchema.safeParse(invalidEntry);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toBeDefined();
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });
});