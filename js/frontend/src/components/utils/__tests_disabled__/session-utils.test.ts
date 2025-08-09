import { assert } from '@open-wc/testing';
import { TranscriptEntry, TextContent, ToolUseContent, ToolResultContent, ThinkingContent } from '@app/shared';
import {
  createSessionSummary,
  processMessagesForDisplay,
  processMessageContent,
  extractMessageMetadata,
  extractToolUse,
  detectCodeBlocks,
  processMarkdown,
  generateSessionSummary,
  calculateSessionStats,
  filterEntriesByQuery,
  groupEntriesByTime,
  validateSessionData,
} from '../session-utils';

describe('SessionUtils', () => {
  const mockUserEntry: TranscriptEntry = {
    id: '1',
    type: 'user',
    timestamp: '2023-01-15T10:00:00Z',
    message: {
      role: 'user',
      content: 'Hello, can you help me with this code?',
    },
  };

  const mockAssistantEntry: TranscriptEntry = {
    id: '2',
    type: 'assistant',
    timestamp: '2023-01-15T10:01:00Z',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Sure! I can help you with that.',
        },
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'file-read',
          input: { path: '/test.js' },
        },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    },
  };

  const mockToolResultEntry: TranscriptEntry = {
    id: '3',
    type: 'assistant',
    timestamp: '2023-01-15T10:02:00Z',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: 'console.log("Hello, world!");',
          is_error: false,
        },
        {
          type: 'thinking',
          thinking: 'The user wants help with JavaScript code.',
        },
      ],
    },
  };

  describe('createSessionSummary', () => {
    it('should create session summary from entries', () => {
      const entries = [mockUserEntry, mockAssistantEntry, mockToolResultEntry];
      const summary = createSessionSummary(entries, 'session-123', '/project');

      assert.equal(summary.sessionId, 'session-123');
      assert.equal(summary.cwd, '/project');
      assert.equal(summary.messageCount, 3);
      assert.equal(summary.userMessageCount, 1);
      assert.equal(summary.assistantMessageCount, 2);
      assert.equal(summary.isActive, false);
      assert.exists(summary.startTime);
      assert.exists(summary.endTime);
      assert.exists(summary.duration);
    });

    it('should handle empty entries', () => {
      const summary = createSessionSummary([], 'empty-session', '/project');

      assert.equal(summary.messageCount, 0);
      assert.equal(summary.userMessageCount, 0);
      assert.equal(summary.assistantMessageCount, 0);
      assert.equal(summary.isActive, false);
    });

    it('should calculate token usage', () => {
      const entries = [mockAssistantEntry];
      const summary = createSessionSummary(entries, 'session-123', '/project');

      assert.exists(summary.tokenUsage);
      assert.equal(summary.tokenUsage?.inputTokens, 100);
      assert.equal(summary.tokenUsage?.outputTokens, 50);
      assert.equal(summary.tokenUsage?.totalTokens, 150);
    });
  });

  describe('processMessagesForDisplay', () => {
    it('should process entries into display format', () => {
      const entries = [mockUserEntry, mockAssistantEntry];
      const messages = processMessagesForDisplay(entries);

      assert.equal(messages.length, 2);
      assert.exists(messages[0].entry);
      assert.exists(messages[0].processedContent);
      assert.exists(messages[0].metadata);
    });
  });

  describe('processMessageContent', () => {
    it('should process user message content', () => {
      const content = processMessageContent(mockUserEntry);

      assert.equal(content.length, 1);
      assert.equal(content[0].type, 'text');
      assert.equal(content[0].content, 'Hello, can you help me with this code?');
    });

    it('should process assistant message content', () => {
      const content = processMessageContent(mockAssistantEntry);

      assert.equal(content.length, 2);
      assert.equal(content[0].type, 'text');
      assert.equal(content[1].type, 'tool_use');
      assert.equal(content[1].collapsible, true);
    });

    it('should process tool result content', () => {
      const content = processMessageContent(mockToolResultEntry);

      assert.equal(content.length, 2);
      assert.equal(content[0].type, 'tool_result');
      assert.equal(content[1].type, 'thinking');
      assert.equal(content[0].defaultCollapsed, true);
      assert.equal(content[1].defaultCollapsed, true);
    });
  });

  describe('extractMessageMetadata', () => {
    it('should extract metadata from user message', () => {
      const metadata = extractMessageMetadata(mockUserEntry, 0);

      assert.equal(metadata.index, 0);
      assert.equal(metadata.hasToolUse, false);
      assert.equal(metadata.hasThinking, false);
      assert.equal(metadata.hasErrors, false);
    });

    it('should extract metadata from assistant message', () => {
      const metadata = extractMessageMetadata(mockAssistantEntry, 1);

      assert.equal(metadata.index, 1);
      assert.equal(metadata.hasToolUse, true);
      assert.equal(metadata.hasThinking, false);
      assert.equal(metadata.tokenCount, 150);
    });

    it('should detect errors in tool results', () => {
      const errorEntry: TranscriptEntry = {
        id: '4',
        type: 'assistant',
        timestamp: '2023-01-15T10:03:00Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-1',
              content: 'Error: File not found',
              is_error: true,
            },
          ],
        },
      };

      const metadata = extractMessageMetadata(errorEntry, 2);
      assert.equal(metadata.hasErrors, true);
    });
  });

  describe('extractToolUse', () => {
    it('should extract tool use information', () => {
      const content = [
        {
          type: 'tool_use' as const,
          id: 'tool-1',
          name: 'file-read',
          input: { path: '/test.js' },
        },
        {
          type: 'tool_result' as const,
          tool_use_id: 'tool-1',
          content: 'File content',
          is_error: false,
        },
      ];

      const tools = extractToolUse(content);

      assert.equal(tools.length, 1);
      assert.equal(tools[0].name, 'file-read');
      assert.equal(tools[0].status, 'success');
      assert.equal(tools[0].result, 'File content');
    });

    it('should handle tool errors', () => {
      const content = [
        {
          type: 'tool_use' as const,
          id: 'tool-2',
          name: 'file-write',
          input: { path: '/readonly.txt', content: 'test' },
        },
        {
          type: 'tool_result' as const,
          tool_use_id: 'tool-2',
          content: 'Permission denied',
          is_error: true,
        },
      ];

      const tools = extractToolUse(content);

      assert.equal(tools.length, 1);
      assert.equal(tools[0].status, 'error');
      assert.equal(tools[0].error, 'Permission denied');
    });
  });

  describe('detectCodeBlocks', () => {
    it('should detect fenced code blocks', () => {
      const text = 'Here is some code:\n```javascript\nconsole.log("hello");\n```\nAnd some more text.';
      const blocks = detectCodeBlocks(text);

      assert.equal(blocks.length, 1);
      assert.equal(blocks[0].language, 'javascript');
      assert.equal(blocks[0].content, 'console.log("hello");');
    });

    it('should detect inline code blocks', () => {
      const text = 'Use the `console.log()` function to print output.';
      const blocks = detectCodeBlocks(text);

      assert.equal(blocks.length, 1);
      assert.equal(blocks[0].content, 'console.log()');
      assert.isUndefined(blocks[0].language);
    });

    it('should detect multiple code blocks', () => {
      const text = '```js\nconst a = 1;\n```\nSome text\n```python\nprint("hello")\n```';
      const blocks = detectCodeBlocks(text);

      assert.equal(blocks.length, 2);
      assert.equal(blocks[0].language, 'js');
      assert.equal(blocks[1].language, 'python');
    });
  });

  describe('processMarkdown', () => {
    it('should process bold text', () => {
      const markdown = 'This is **bold** text.';
      const processed = processMarkdown(markdown);
      assert.include(processed, '<strong>bold</strong>');
    });

    it('should process italic text', () => {
      const markdown = 'This is *italic* text.';
      const processed = processMarkdown(markdown);
      assert.include(processed, '<em>italic</em>');
    });

    it('should process links', () => {
      const markdown = 'Visit [Google](https://google.com) for search.';
      const processed = processMarkdown(markdown);
      assert.include(processed, '<a href="https://google.com" target="_blank" rel="noopener">Google</a>');
    });

    it('should convert line breaks', () => {
      const markdown = 'Line 1\nLine 2';
      const processed = processMarkdown(markdown);
      assert.include(processed, 'Line 1<br>Line 2');
    });
  });

  describe('generateSessionSummary', () => {
    it('should generate summary from first user message', () => {
      const entries = [mockUserEntry, mockAssistantEntry];
      const summary = generateSessionSummary(entries);
      
      assert.equal(summary, 'Hello, can you help me with this code?');
    });

    it('should handle empty entries', () => {
      const summary = generateSessionSummary([]);
      assert.equal(summary, 'Empty session');
    });

    it('should truncate long summaries', () => {
      const longMessage: TranscriptEntry = {
        ...mockUserEntry,
        message: {
          role: 'user',
          content: 'A'.repeat(250),
        },
      };
      
      const summary = generateSessionSummary([longMessage], 100);
      assert.isTrue(summary.length <= 100);
      assert.include(summary, '...');
    });
  });

  describe('calculateSessionStats', () => {
    it('should calculate session statistics', () => {
      const entries = [mockUserEntry, mockAssistantEntry, mockToolResultEntry];
      const stats = calculateSessionStats(entries);

      assert.equal(stats.totalMessages, 3);
      assert.equal(stats.totalTokens, 150);
      assert.equal(stats.totalTools, 1);
      assert.equal(stats.totalThinking, 1);
      assert.equal(stats.totalErrors, 0);
      assert.equal(stats.averageTokensPerMessage, 50);
    });
  });

  describe('filterEntriesByQuery', () => {
    it('should filter entries by text query', () => {
      const entries = [mockUserEntry, mockAssistantEntry];
      const filtered = filterEntriesByQuery(entries, 'help');

      assert.equal(filtered.length, 2); // Both contain "help"
    });

    it('should return all entries for empty query', () => {
      const entries = [mockUserEntry, mockAssistantEntry];
      const filtered = filterEntriesByQuery(entries, '');

      assert.equal(filtered.length, 2);
    });

    it('should be case insensitive', () => {
      const entries = [mockUserEntry];
      const filtered = filterEntriesByQuery(entries, 'HELLO');

      assert.equal(filtered.length, 1);
    });
  });

  describe('groupEntriesByTime', () => {
    it('should group entries by day', () => {
      const entries = [
        { ...mockUserEntry, timestamp: '2023-01-15T10:00:00Z' },
        { ...mockAssistantEntry, timestamp: '2023-01-15T14:00:00Z' },
        { ...mockToolResultEntry, timestamp: '2023-01-16T10:00:00Z' },
      ];

      const grouped = groupEntriesByTime(entries, 'day');

      assert.equal(grouped.length, 2);
      assert.equal(grouped[0].entries.length, 2);
      assert.equal(grouped[1].entries.length, 1);
    });

    it('should group entries by hour', () => {
      const entries = [
        { ...mockUserEntry, timestamp: '2023-01-15T10:30:00Z' },
        { ...mockAssistantEntry, timestamp: '2023-01-15T10:45:00Z' },
        { ...mockToolResultEntry, timestamp: '2023-01-15T11:00:00Z' },
      ];

      const grouped = groupEntriesByTime(entries, 'hour');

      assert.equal(grouped.length, 2);
      assert.equal(grouped[0].entries.length, 2);
      assert.equal(grouped[1].entries.length, 1);
    });
  });

  describe('validateSessionData', () => {
    it('should validate valid session data', () => {
      const sessionData = {
        sessionId: 'test-session',
        entries: [mockUserEntry, mockAssistantEntry],
      };

      const result = validateSessionData(sessionData);

      assert.equal(result.isValid, true);
      assert.equal(result.errors.length, 0);
    });

    it('should detect missing session ID', () => {
      const sessionData = {
        entries: [mockUserEntry],
      };

      const result = validateSessionData(sessionData);

      assert.equal(result.isValid, false);
      assert.include(result.errors[0], 'Session ID is required');
    });

    it('should detect invalid entries format', () => {
      const sessionData = {
        sessionId: 'test-session',
        entries: 'not-an-array',
      };

      const result = validateSessionData(sessionData);

      assert.equal(result.isValid, false);
      assert.include(result.errors[0], 'Entries must be an array');
    });

    it('should detect missing entry properties', () => {
      const sessionData = {
        sessionId: 'test-session',
        entries: [
          { id: '1' }, // Missing timestamp and type
        ],
      };

      const result = validateSessionData(sessionData);

      assert.equal(result.isValid, false);
      assert.isTrue(result.errors.length >= 2);
    });
  });
});