import { describe, it, expect } from 'vitest';
import {
  parseTimestamp,
  formatTimestamp,
  parseContentItem,
  parseMessageContent,
  parseTranscriptEntry,
  normalizeUsageInfo,
  calculateTotalUsage,
  groupEntriesBySession,
  getSessionTimeRange,
  serializeToJsonl,
  parseJsonlString,
  extractTextFromContent,
  getToolUsesFromContent,
  safeParseTranscriptEntry,
  extractSessionSummary,
  getSessionMetadata,
} from './utils';
import { TranscriptEntry, UserTranscriptEntry, AssistantTranscriptEntry } from './index';

describe('Utility Functions', () => {
  describe('Timestamp Utilities', () => {
    it('should parse ISO timestamps correctly', () => {
      const timestamp = '2024-01-01T12:00:00Z';
      const parsed = parseTimestamp(timestamp);
      
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getUTCFullYear()).toBe(2024);
      expect(parsed?.getUTCMonth()).toBe(0); // January is 0
      expect(parsed?.getUTCDate()).toBe(1);
    });

    it('should handle invalid timestamps gracefully', () => {
      expect(parseTimestamp('invalid-date')).toBeNull();
      expect(parseTimestamp('')).toBeNull();
    });

    it('should format timestamps correctly', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const formatted = formatTimestamp(date);
      
      expect(formatted).toBe('2024-01-01T12:00:00.000Z');
    });
  });

  describe('Content Parsing', () => {
    it('should parse text content', () => {
      const textData = { type: 'text', text: 'Hello world' };
      const parsed = parseContentItem(textData);
      
      expect(parsed.type).toBe('text');
      expect((parsed as any).text).toBe('Hello world');
    });

    it('should parse tool use content', () => {
      const toolData = {
        type: 'tool_use',
        id: 'tool_123',
        name: 'Read',
        input: { file_path: '/test.txt' }
      };
      const parsed = parseContentItem(toolData);
      
      expect(parsed.type).toBe('tool_use');
      expect((parsed as any).name).toBe('Read');
    });

    it('should handle unknown content types with fallback', () => {
      const unknownData = { type: 'unknown', someField: 'value' };
      const parsed = parseContentItem(unknownData);
      
      expect(parsed.type).toBe('text');
      expect((parsed as any).text).toContain('unknown');
    });

    it('should parse mixed content arrays', () => {
      const mixedContent = [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: '1', name: 'Test', input: {} }
      ];
      const parsed = parseMessageContent(mixedContent);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect((parsed as any[]).length).toBe(2);
      expect((parsed as any[])[0].type).toBe('text');
      expect((parsed as any[])[1].type).toBe('tool_use');
    });

    it('should handle string content', () => {
      const stringContent = 'Simple string message';
      const parsed = parseMessageContent(stringContent);
      
      expect(typeof parsed).toBe('string');
      expect(parsed).toBe('Simple string message');
    });
  });

  describe('Transcript Entry Parsing', () => {
    it('should parse valid user transcript entry', () => {
      const userData = {
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

      const parsed = parseTranscriptEntry(userData);
      expect(parsed).toBeDefined();
      expect(parsed?.type).toBe('user');
    });

    it('should parse valid assistant transcript entry', () => {
      const assistantData = {
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
          content: [{ type: 'text', text: 'Hello!' }]
        }
      };

      const parsed = parseTranscriptEntry(assistantData);
      expect(parsed).toBeDefined();
      expect(parsed?.type).toBe('assistant');
    });

    it('should return null for invalid entries', () => {
      const invalidData = { type: 'invalid', incomplete: true };
      const parsed = parseTranscriptEntry(invalidData);
      
      expect(parsed).toBeNull();
    });
  });

  describe('Usage Calculation', () => {
    it('should calculate total usage across entries', () => {
      const entries: TranscriptEntry[] = [
        {
          type: 'assistant',
          parentUuid: undefined,
          isSidechain: false,
          userType: 'assistant',
          cwd: '/project',
          sessionId: 'session_1',
          version: '1.0.0',
          uuid: 'uuid_1',
          timestamp: '2024-01-01T00:00:00Z',
          message: {
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-5-sonnet',
            content: [],
            usage: { input_tokens: 100, output_tokens: 50 }
          }
        } as AssistantTranscriptEntry,
        {
          type: 'assistant',
          parentUuid: undefined,
          isSidechain: false,
          userType: 'assistant',
          cwd: '/project',
          sessionId: 'session_1',
          version: '1.0.0',
          uuid: 'uuid_2',
          timestamp: '2024-01-01T00:01:00Z',
          message: {
            id: 'msg_2',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-5-sonnet',
            content: [],
            usage: { input_tokens: 75, output_tokens: 25 }
          }
        } as AssistantTranscriptEntry,
      ];

      const total = calculateTotalUsage(entries);
      expect(total.input_tokens).toBe(175);
      expect(total.output_tokens).toBe(75);
    });
  });

  describe('Session Management', () => {
    it('should group entries by session', () => {
      const entries: TranscriptEntry[] = [
        {
          type: 'user',
          sessionId: 'session_1',
          uuid: 'uuid_1',
          timestamp: '2024-01-01T00:00:00Z',
        } as UserTranscriptEntry,
        {
          type: 'user',
          sessionId: 'session_2',
          uuid: 'uuid_2',
          timestamp: '2024-01-01T00:01:00Z',
        } as UserTranscriptEntry,
        {
          type: 'user',
          sessionId: 'session_1',
          uuid: 'uuid_3',
          timestamp: '2024-01-01T00:02:00Z',
        } as UserTranscriptEntry,
      ];

      const grouped = groupEntriesBySession(entries);
      
      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['session_1']).toHaveLength(2);
      expect(grouped['session_2']).toHaveLength(1);
    });

    it('should calculate session time range', () => {
      const entries: TranscriptEntry[] = [
        {
          type: 'user',
          timestamp: '2024-01-01T10:00:00Z',
        } as UserTranscriptEntry,
        {
          type: 'assistant',
          timestamp: '2024-01-01T10:05:00Z',
        } as AssistantTranscriptEntry,
        {
          type: 'user',
          timestamp: '2024-01-01T10:02:00Z',
        } as UserTranscriptEntry,
      ];

      const timeRange = getSessionTimeRange(entries);
      
      expect(timeRange.start).toBeInstanceOf(Date);
      expect(timeRange.end).toBeInstanceOf(Date);
      expect(timeRange.start?.getTime()).toBeLessThan(timeRange.end?.getTime() || 0);
    });
  });

  describe('Data Serialization', () => {
    it('should serialize entries to JSONL format', () => {
      const entries: TranscriptEntry[] = [
        {
          type: 'summary',
          summary: 'Test summary',
          leafUuid: 'uuid_1',
        },
      ];

      const jsonl = serializeToJsonl(entries);
      const lines = jsonl.split('\n');
      
      expect(lines).toHaveLength(1);
      expect(() => JSON.parse(lines[0])).not.toThrow();
    });

    it('should parse JSONL string back to entries', () => {
      const jsonlData = `{"type":"summary","summary":"Test","leafUuid":"uuid_1"}
{"type":"summary","summary":"Test 2","leafUuid":"uuid_2"}`;

      const entries = parseJsonlString(jsonlData);
      
      expect(entries).toHaveLength(2);
      expect(entries[0].type).toBe('summary');
      expect(entries[1].type).toBe('summary');
    });
  });

  describe('Content Analysis', () => {
    it('should extract text from content arrays', () => {
      const content = [
        { type: 'text', text: 'Hello' } as any,
        { type: 'tool_use', id: '1', name: 'Test', input: {} } as any,
        { type: 'text', text: 'World' } as any,
      ];

      const text = extractTextFromContent(content);
      expect(text).toBe('Hello World');
    });

    it('should extract text from string content', () => {
      const content = 'Simple string message';
      const text = extractTextFromContent(content);
      
      expect(text).toBe('Simple string message');
    });

    it('should filter tool uses from content', () => {
      const content = [
        { type: 'text', text: 'Hello' } as any,
        { type: 'tool_use', id: '1', name: 'Read', input: {} } as any,
        { type: 'tool_use', id: '2', name: 'Write', input: {} } as any,
      ];

      const toolUses = getToolUsesFromContent(content);
      expect(toolUses).toHaveLength(2);
      expect(toolUses[0].name).toBe('Read');
      expect(toolUses[1].name).toBe('Write');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSONL gracefully', () => {
      const malformedJsonl = `{"type":"user","incomplete":true
{"type":"summary","summary":"Valid entry","leafUuid":"uuid_1"}
invalid json line`;

      const entries = parseJsonlString(malformedJsonl);
      
      // Should parse the one valid entry
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('summary');
    });

    it('should provide detailed validation errors', () => {
      const invalidData = { type: 'user', incomplete: true };
      const result = safeParseTranscriptEntry(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.details).toBeDefined();
    });
  });
});