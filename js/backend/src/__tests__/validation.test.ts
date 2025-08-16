/**
 * Tests for validation and error handling in JSONL parser
 * Ensures robust handling of malformed data and edge cases
 */

import { describe, test, expect } from '@jest/globals';
import { parseJsonlLine, parseTranscriptEntry } from '../parsers/jsonl-parser';

describe('JSONL Parser Validation and Error Handling', () => {
  describe('parseJsonlLine error handling', () => {
    test('handles completely invalid JSON', () => {
      const invalidLines = [
        'not json at all',
        '{ incomplete json',
        '{ "key": }',
        '{ "key": "value" "missing_comma": true }',
        'null',
        'undefined',
        '""',
        '[]',
        'true',
        '42'
      ];

      invalidLines.forEach((line, index) => {
        const result = parseJsonlLine(line, index + 1);
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('lineNumber', index + 1);
        expect(result).toHaveProperty('line', line);
      });
    });

    test('handles empty and whitespace-only lines', () => {
      const emptyLines = ['', '   ', '\t', '\n', '   \t\n  '];

      emptyLines.forEach((line, index) => {
        const result = parseJsonlLine(line, index + 1);
        expect(result).toHaveProperty('error', 'Empty line');
        expect(result).toHaveProperty('lineNumber', index + 1);
      });
    });

    test('handles extremely large JSON objects', () => {
      const largeObject = {
        type: 'user',
        uuid: 'large-uuid',
        timestamp: '2025-01-15T10:30:00.000Z',
        sessionId: 'session-large',
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/test',
        version: '1.0.0',
        message: {
          role: 'user',
          content: 'x'.repeat(1000000) // 1MB of text
        }
      };

      const line = JSON.stringify(largeObject);
      const result = parseJsonlLine(line, 1);
      
      // Should still parse successfully, just be slow
      expect(result).not.toHaveProperty('error');
      if (!('error' in result)) {
        expect(result.type).toBe('user');
      }
    });

    test('handles JSON with special characters and unicode', () => {
      const specialChars = {
        type: 'user',
        uuid: 'unicode-test',
        timestamp: '2025-01-15T10:30:00.000Z',
        sessionId: 'session-unicode',
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/test',
        version: '1.0.0',
        message: {
          role: 'user',
          content: 'Testing unicode: 🚀 emoji, "quotes", \'single quotes\', \\backslashes\\, \nnewlines\n, \ttabs\t, and null\0chars'
        }
      };

      const line = JSON.stringify(specialChars);
      const result = parseJsonlLine(line, 1);
      
      expect(result).not.toHaveProperty('error');
      if (!('error' in result)) {
        expect(result.type).toBe('user');
      }
    });
  });

  describe('parseTranscriptEntry validation', () => {
    test('rejects entries with missing required fields', () => {
      const incompleteEntries = [
        { type: 'user' }, // missing uuid, timestamp, sessionId
        { type: 'user', uuid: 'test' }, // missing timestamp, sessionId
        { type: 'user', uuid: 'test', timestamp: '2025-01-15T10:30:00.000Z' }, // missing sessionId
        { type: 'assistant', uuid: 'test' }, // missing timestamp, sessionId
        { type: 'summary' }, // missing summary and leafUuid
        { type: 'summary', summary: 'test' }, // missing leafUuid
      ];

      incompleteEntries.forEach(entry => {
        expect(() => parseTranscriptEntry(entry)).toThrow();
      });
    });

    test('handles entries with various field types', () => {
      // The current parser is lenient with field types, only checking existence
      const entriesWithVariousTypes = [
        {
          type: 'user',
          uuid: 123, // number instead of string - parser accepts this
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session-123',
          message: { role: 'user', content: 'test' }
        },
        {
          type: 'user',
          uuid: 'test',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session-123',
          message: { role: 'user', content: 'test' }
        }
      ];

      entriesWithVariousTypes.forEach(entry => {
        expect(() => parseTranscriptEntry(entry)).not.toThrow();
      });
    });

    test('rejects unknown entry types', () => {
      const unknownTypes = [
        { type: 'unknown', uuid: 'test', timestamp: '2025-01-15T10:30:00.000Z', sessionId: 'session' },
        { type: 'invalid', uuid: 'test', timestamp: '2025-01-15T10:30:00.000Z', sessionId: 'session' },
        { type: '', uuid: 'test', timestamp: '2025-01-15T10:30:00.000Z', sessionId: 'session' },
        { type: null, uuid: 'test', timestamp: '2025-01-15T10:30:00.000Z', sessionId: 'session' }
      ];

      unknownTypes.forEach(entry => {
        expect(() => parseTranscriptEntry(entry)).toThrow(/Unknown transcript entry type/);
      });
    });

    test('validates user message structure', () => {
      const messageWithoutMessageField = {
        type: 'user',
        uuid: 'test',
        timestamp: '2025-01-15T10:30:00.000Z',
        sessionId: 'session'
        // missing message field entirely
      };

      expect(() => parseTranscriptEntry(messageWithoutMessageField)).toThrow();
      
      // Parser is lenient about message content structure
      const userMessageWithContent = {
        type: 'user',
        uuid: 'test',
        timestamp: '2025-01-15T10:30:00.000Z',
        sessionId: 'session',
        message: { role: 'user', content: 'test' }
      };

      expect(() => parseTranscriptEntry(userMessageWithContent)).not.toThrow();
    });

    test('validates assistant message structure', () => {
      const messageWithoutMessageField = {
        type: 'assistant',
        uuid: 'test',
        timestamp: '2025-01-15T10:30:00.000Z',
        sessionId: 'session'
        // missing message field entirely
      };

      expect(() => parseTranscriptEntry(messageWithoutMessageField)).toThrow();
      
      // Parser is lenient about message content structure
      const assistantMessageWithContent = {
        type: 'assistant',
        uuid: 'test',
        timestamp: '2025-01-15T10:30:00.000Z',
        sessionId: 'session',
        message: {
          id: 'msg-123',
          type: 'message', 
          role: 'assistant',
          model: 'claude-3-sonnet',
          content: [{ type: 'text', text: 'test' }]
        }
      };

      expect(() => parseTranscriptEntry(assistantMessageWithContent)).not.toThrow();
    });

    test('accepts valid entries with all required fields', () => {
      const validEntries = [
        {
          type: 'user',
          uuid: 'user-123',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session-123',
          parentUuid: null,
          isSidechain: false,
          userType: 'human',
          cwd: '/test',
          version: '1.0.0',
          message: {
            role: 'user',
            content: 'Hello Claude!'
          }
        },
        {
          type: 'assistant',
          uuid: 'assistant-123',
          timestamp: '2025-01-15T10:31:00.000Z',
          sessionId: 'session-123',
          parentUuid: 'user-123',
          isSidechain: false,
          userType: 'assistant',
          cwd: '/test',
          version: '1.0.0',
          message: {
            id: 'msg-123',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-sonnet',
            content: [
              { type: 'text', text: 'Hello! How can I help?' }
            ],
            stop_reason: 'end_turn',
            usage: {
              input_tokens: 10,
              output_tokens: 15
            }
          }
        },
        {
          type: 'summary',
          summary: 'User greeted Claude and got a response',
          leafUuid: 'assistant-123',
          timestamp: '2025-01-15T10:32:00.000Z'
        }
      ];

      validEntries.forEach(entry => {
        expect(() => parseTranscriptEntry(entry)).not.toThrow();
        const result = parseTranscriptEntry(entry);
        expect(result.type).toBe(entry.type);
      });
    });
  });

  describe('content validation', () => {
    test('handles various content formats', () => {
      const contentVariations = [
        // String content
        {
          type: 'user',
          uuid: 'user-1',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session',
          message: { role: 'user', content: 'Simple string content' }
        },
        // Array content with text
        {
          type: 'user',
          uuid: 'user-2',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Array with text content' }]
          }
        },
        // Array content with tool_result
        {
          type: 'user',
          uuid: 'user-3',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session',
          message: {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: 'tool-123',
              content: 'Tool execution result',
              is_error: false
            }]
          }
        }
      ];

      contentVariations.forEach(entry => {
        expect(() => parseTranscriptEntry(entry)).not.toThrow();
      });
    });

    test('handles malformed content gracefully', () => {
      const malformedContentEntries = [
        {
          type: 'user',
          uuid: 'user-1',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session',
          message: { role: 'user', content: null }
        },
        {
          type: 'user',
          uuid: 'user-2',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session',
          message: { role: 'user', content: undefined }
        },
        {
          type: 'user',
          uuid: 'user-3',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session',
          message: { role: 'user', content: [] }
        }
      ];

      // These should not throw, but content might be empty
      malformedContentEntries.forEach(entry => {
        expect(() => parseTranscriptEntry(entry)).not.toThrow();
      });
    });
  });

  describe('timestamp validation', () => {
    test('accepts valid ISO 8601 timestamps', () => {
      const validTimestamps = [
        '2025-01-15T10:30:00.000Z',
        '2025-01-15T10:30:00Z',
        '2025-01-15T10:30:00.000+00:00',
        '2025-01-15T10:30:00-05:00',
        '2025-12-31T23:59:59.999Z'
      ];

      validTimestamps.forEach(timestamp => {
        const entry = {
          type: 'user',
          uuid: 'test',
          timestamp,
          sessionId: 'session',
          message: { role: 'user', content: 'test' }
        };

        expect(() => parseTranscriptEntry(entry)).not.toThrow();
      });
    });

    test('handles various timestamp formats', () => {
      // The current parser doesn't validate timestamp format, only existence
      const timestampVariations = [
        '2025-01-15T10:30:00.000Z',  // valid ISO format
        '2025-01-15',                // date only
        'not-a-date',                // invalid format
        ''                           // empty string (will fail required field check)
      ];

      timestampVariations.forEach((timestamp, index) => {
        const entry = {
          type: 'user',
          uuid: 'timestamp-test',
          timestamp,
          sessionId: 'timestamp-session',
          message: { role: 'user', content: 'Test timestamp' }
        };

        if (timestamp === '') {
          // Empty timestamp should fail required field check
          expect(() => parseTranscriptEntry(entry)).toThrow();
        } else {
          // Parser accepts any non-empty timestamp
          expect(() => parseTranscriptEntry(entry)).not.toThrow();
        }
      });
    });
  });

  describe('usage validation', () => {
    test('accepts valid usage information', () => {
      const validUsageEntries = [
        {
          input_tokens: 100,
          output_tokens: 50
        },
        {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 10,
          cache_read_input_tokens: 5
        },
        {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          service_tier: 'standard'
        }
      ];

      validUsageEntries.forEach(usage => {
        const entry = {
          type: 'assistant',
          uuid: 'test',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session',
          message: {
            id: 'msg-1',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-sonnet',
            content: [{ type: 'text', text: 'test' }],
            usage
          }
        };

        expect(() => parseTranscriptEntry(entry)).not.toThrow();
      });
    });

    test('handles missing or malformed usage gracefully', () => {
      const entriesWithBadUsage = [
        // Missing usage (should be fine)
        {
          type: 'assistant',
          uuid: 'test-1',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session',
          message: {
            id: 'msg-1',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-sonnet',
            content: [{ type: 'text', text: 'test' }]
          }
        },
        // Usage with negative numbers (might be handled)
        {
          type: 'assistant',
          uuid: 'test-2',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'session',
          message: {
            id: 'msg-2',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-sonnet',
            content: [{ type: 'text', text: 'test' }],
            usage: {
              input_tokens: -1,
              output_tokens: 50
            }
          }
        }
      ];

      entriesWithBadUsage.forEach(entry => {
        // Should not throw, but usage might be ignored or corrected
        expect(() => parseTranscriptEntry(entry)).not.toThrow();
      });
    });
  });
});