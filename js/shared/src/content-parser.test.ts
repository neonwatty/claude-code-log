import { describe, it, expect } from 'vitest';
import {
  extractTextContent,
  extractThinkingContent,
  analyzeContentTypes,
  parseTextContent,
  parseToolUseContent,
  parseToolResultContent,
  parseThinkingContent,
  parseImageContent,
  parseContentItem,
  parseMessageContent,
  parseTranscriptEntry,
  extractCommandInfo,
  formatContentForDisplay,
  type ParsedContent,
  type ParsedMessage,
} from './content-parser';
import { detectMessageType } from './message-detector';

describe('Content Parser', () => {
  describe('extractTextContent', () => {
    it('should extract text from string content', () => {
      const content = 'Hello world';
      const result = extractTextContent(content);
      expect(result).toBe('Hello world');
    });

    it('should extract text from array of content items', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'World' },
        { type: 'thinking', thinking: 'Should skip this' },
        { type: 'tool_use', id: 'test', name: 'TestTool', input: {} },
      ] as any[];

      const result = extractTextContent(content);
      expect(result).toBe('Hello\nWorld');
    });

    it('should handle empty and null content', () => {
      expect(extractTextContent('')).toBe('');
      expect(extractTextContent([])).toBe('');
    });
  });

  describe('extractThinkingContent', () => {
    it('should extract thinking content from array', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'thinking', thinking: 'Let me think about this...' },
        { type: 'thinking', thinking: 'Another thought' },
      ] as any[];

      const result = extractThinkingContent(content);
      expect(result).toEqual(['Let me think about this...', 'Another thought']);
    });

    it('should return empty array for non-array content', () => {
      expect(extractThinkingContent('string content')).toEqual([]);
      expect(extractThinkingContent([])).toEqual([]);
    });
  });

  describe('analyzeContentTypes', () => {
    it('should analyze string content', () => {
      const result = analyzeContentTypes('Hello world');
      expect(result).toEqual({
        hasText: true,
        hasToolUse: false,
        hasToolResult: false,
        hasThinking: false,
        hasImages: false,
        toolCount: 0,
        imageCount: 0,
      });
    });

    it('should analyze complex content array', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'tool1', name: 'TestTool', input: {} },
        { type: 'tool_use', id: 'tool2', name: 'AnotherTool', input: {} },
        { type: 'thinking', thinking: 'Thinking...' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'base64data' } },
        { type: 'tool_result', tool_use_id: 'tool1', content: 'Result' },
      ] as any[];

      const result = analyzeContentTypes(content);
      expect(result).toEqual({
        hasText: true,
        hasToolUse: true,
        hasToolResult: true,
        hasThinking: true,
        hasImages: true,
        toolCount: 2,
        imageCount: 1,
      });
    });
  });

  describe('parseTextContent', () => {
    it('should parse basic text content', () => {
      const result = parseTextContent('Hello world');
      expect(result).toEqual({
        type: 'markdown',
        content: 'Hello world',
        metadata: {
          hasLongContent: false,
          previewText: undefined,
        },
      });
    });

    it('should handle long text with preview', () => {
      const longText = 'A'.repeat(300);
      const result = parseTextContent(longText, { maxPreviewLength: 100 });
      expect(result.metadata?.hasLongContent).toBe(true);
      expect(result.metadata?.previewText).toBe('A'.repeat(100) + '...');
    });

    it('should disable markdown when requested', () => {
      const result = parseTextContent('Hello', { enableMarkdown: false });
      expect(result.type).toBe('text');
    });
  });

  describe('parseToolUseContent', () => {
    it('should parse basic tool use', () => {
      const toolUse = {
        type: 'tool_use',
        id: 'test_123',
        name: 'TestTool',
        input: { param1: 'value1', param2: 42 },
      } as any;

      const result = parseToolUseContent(toolUse);
      expect(result.type).toBe('tool_use');
      expect(result.metadata?.toolName).toBe('TestTool');
      expect(result.metadata?.toolId).toBe('test_123');
      expect(result.content).toContain('"param1": "value1"');
      expect(result.content).toContain('"param2": 42');
    });

    it('should handle TodoWrite specially', () => {
      const todoWrite = {
        type: 'tool_use',
        id: 'todo_123',
        name: 'TodoWrite',
        input: {
          todos: [
            { content: 'Task 1', status: 'completed' },
            { content: 'Task 2', status: 'in_progress' },
            { content: 'Task 3', status: 'pending' },
          ],
        },
      } as any;

      const result = parseToolUseContent(todoWrite);
      expect(result.content).toContain('Todo List:');
      expect(result.content).toContain('✅ Task 1');
      expect(result.content).toContain('🔄 Task 2');
      expect(result.content).toContain('⭕ Task 3');
    });

    it('should handle empty TodoWrite', () => {
      const emptyTodo = {
        type: 'tool_use',
        id: 'todo_empty',
        name: 'TodoWrite',
        input: { todos: [] },
      } as any;

      const result = parseToolUseContent(emptyTodo);
      expect(result.content).toBe('Todo List: (empty)');
    });
  });

  describe('parseToolResultContent', () => {
    it('should parse string tool result', () => {
      const toolResult = {
        type: 'tool_result',
        tool_use_id: 'tool_123',
        content: 'This is the result',
        is_error: false,
      } as any;

      const result = parseToolResultContent(toolResult);
      expect(result.type).toBe('tool_result');
      expect(result.content).toBe('This is the result');
      expect(result.metadata?.toolId).toBe('tool_123');
      expect(result.metadata?.isError).toBe(false);
    });

    it('should parse structured tool result', () => {
      const toolResult = {
        type: 'tool_result',
        tool_use_id: 'tool_456',
        content: [
          { type: 'text', text: 'First part' },
          { type: 'text', text: 'Second part' },
          { type: 'other', data: 'ignored' },
        ],
        is_error: true,
      } as any;

      const result = parseToolResultContent(toolResult);
      expect(result.content).toBe('First part\nSecond part\n[object Object]');
      expect(result.metadata?.isError).toBe(true);
    });
  });

  describe('parseThinkingContent', () => {
    it('should parse thinking content', () => {
      const thinking = {
        type: 'thinking',
        thinking: '  Let me think about this carefully...  ',
        signature: 'optional_sig',
      } as any;

      const result = parseThinkingContent(thinking);
      expect(result.type).toBe('thinking');
      expect(result.content).toBe('Let me think about this carefully...');
    });

    it('should handle long thinking content', () => {
      const longThinking = 'A'.repeat(300);
      const thinking = { type: 'thinking', thinking: longThinking } as any;
      
      const result = parseThinkingContent(thinking, { maxPreviewLength: 100 });
      expect(result.metadata?.hasLongContent).toBe(true);
      expect(result.metadata?.previewText).toBe('A'.repeat(100) + '...');
    });
  });

  describe('parseImageContent', () => {
    it('should parse image content', () => {
      const image = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        },
      } as any;

      const result = parseImageContent(image);
      expect(result.type).toBe('image');
      expect(result.content).toContain('data:image/png;base64,');
      expect(result.metadata?.mediaType).toBe('image/png');
    });
  });

  describe('parseContentItem', () => {
    it('should parse different content item types', () => {
      const items = [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'test', name: 'Test', input: {} },
        { type: 'thinking', thinking: 'Hmm...' },
      ];

      items.forEach((item, i) => {
        const result = parseContentItem(item as any);
        switch (i) {
          case 0:
            expect(result.type).toBe('markdown');
            break;
          case 1:
            expect(result.type).toBe('tool_use');
            break;
          case 2:
            expect(result.type).toBe('thinking');
            break;
        }
      });
    });

    it('should handle unknown content types', () => {
      const unknownItem = { type: 'unknown', data: 'test' } as any;
      const result = parseContentItem(unknownItem);
      expect(result.type).toBe('text');
      expect(result.content).toContain('unknown');
    });
  });

  describe('parseMessageContent', () => {
    it('should parse string content', () => {
      const result = parseMessageContent('Hello world');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('markdown');
      expect(result[0].content).toBe('Hello world');
    });

    it('should parse array content', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'test', name: 'Test', input: {} },
      ] as any[];

      const result = parseMessageContent(content);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('markdown');
      expect(result[1].type).toBe('tool_use');
    });
  });

  describe('parseTranscriptEntry', () => {
    it('should parse user message entry', () => {
      const userEntry = {
        type: 'user',
        timestamp: '2025-07-03T15:50:00Z',
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/tmp',
        sessionId: 'session1',
        version: '1.0.0',
        uuid: 'user_123',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Hello Assistant!' }],
        },
      };

      const detectionResult = detectMessageType(userEntry);
      expect(detectionResult.isValid).toBe(true);
      
      const result = parseTranscriptEntry(detectionResult.entry!);
      expect(result.messageType).toBe('user');
      expect(result.displayType).toBe('🤷 User');
      expect(result.cssClass).toBe('user');
      expect(result.parsedContent).toHaveLength(1);
      expect(result.parsedContent[0].content).toBe('Hello Assistant!');
      expect(result.hasToolUse).toBe(false);
      expect(result.hasThinking).toBe(false);
    });

    it('should parse assistant message with tools and thinking', () => {
      const assistantEntry = {
        type: 'assistant',
        timestamp: '2025-07-03T15:51:00Z',
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/tmp',
        sessionId: 'session1',
        version: '1.0.0',
        uuid: 'assistant_123',
        message: {
          id: 'assistant_123',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-sonnet-20240229',
          content: [
            { type: 'thinking', thinking: 'Let me help with this...' },
            { type: 'text', text: 'I will use a tool to help you.' },
            { type: 'tool_use', id: 'tool_1', name: 'Read', input: { file_path: '/test.txt' } },
          ],
          usage: {
            input_tokens: 100,
            output_tokens: 200,
          },
        },
      };

      const detectionResult = detectMessageType(assistantEntry);
      expect(detectionResult.isValid).toBe(true);
      
      const result = parseTranscriptEntry(detectionResult.entry!);
      expect(result.messageType).toBe('assistant');
      expect(result.hasToolUse).toBe(true);
      expect(result.hasThinking).toBe(true);
      expect(result.tokenUsage?.total_tokens).toBe(300);
      expect(result.parsedContent).toHaveLength(3);
    });

    it('should parse system message', () => {
      const systemEntry = {
        type: 'system',
        timestamp: '2025-07-03T15:52:00Z',
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/tmp',
        sessionId: 'session1',
        version: '1.0.0',
        uuid: 'system_123',
        content: 'System notification message',
        level: 'info',
      };

      const detectionResult = detectMessageType(systemEntry);
      expect(detectionResult.isValid).toBe(true);
      
      const result = parseTranscriptEntry(detectionResult.entry!);
      expect(result.messageType).toBe('system');
      expect(result.displayType).toBe('⚙️ System');
      expect(result.parsedContent[0].content).toBe('System notification message');
    });

    it('should parse sidechain messages', () => {
      const sidechainEntry = {
        type: 'assistant',
        timestamp: '2025-07-03T15:53:00Z',
        parentUuid: null,
        isSidechain: true, // This makes it a sidechain message
        userType: 'human',
        cwd: '/tmp',
        sessionId: 'session1',
        version: '1.0.0',
        uuid: 'sidechain_123',
        message: {
          id: 'sidechain_123',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-sonnet-20240229',
          content: [{ type: 'text', text: 'Sidechain response' }],
        },
      };

      const detectionResult = detectMessageType(sidechainEntry);
      expect(detectionResult.isValid).toBe(true);
      
      const result = parseTranscriptEntry(detectionResult.entry!);
      expect(result.displayType).toBe('🔗 Sub-assistant');
      expect(result.cssClass).toBe('assistant sidechain');
    });

    it('should include raw content when requested', () => {
      const userEntry = {
        type: 'user',
        timestamp: '2025-07-03T15:50:00Z',
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/tmp',
        sessionId: 'session1',
        version: '1.0.0',
        uuid: 'user_123',
        message: {
          role: 'user',
          content: 'Test content',
        },
      };

      const detectionResult = detectMessageType(userEntry);
      const result = parseTranscriptEntry(detectionResult.entry!, { includeRawContent: true });
      expect(result.rawContent).toBe('Test content');
    });
  });

  describe('extractCommandInfo', () => {
    it('should extract command information', () => {
      const content = `
        <command-name>init</command-name>
        <command-args>--verbose</command-args>
        <command-contents>
          Initializing project...
          Done!
        </command-contents>
      `;

      const result = extractCommandInfo(content);
      expect(result.isCommand).toBe(true);
      expect(result.commandName).toBe('init');
      expect(result.commandArgs).toBe('--verbose');
      expect(result.commandContents).toContain('Initializing project...');
    });

    it('should handle non-command content', () => {
      const content = 'This is just regular system content';
      const result = extractCommandInfo(content);
      expect(result.isCommand).toBe(false);
      expect(result.commandName).toBe('');
    });

    it('should handle partial command info', () => {
      const content = '<command-name>test</command-name>';
      const result = extractCommandInfo(content);
      expect(result.isCommand).toBe(true);
      expect(result.commandName).toBe('test');
      expect(result.commandArgs).toBeUndefined();
      expect(result.commandContents).toBeUndefined();
    });
  });

  describe('formatContentForDisplay', () => {
    const sampleContent: ParsedContent[] = [
      {
        type: 'text',
        content: 'Hello world',
        metadata: {},
      },
      {
        type: 'tool_use',
        content: '{"param": "value"}',
        metadata: { toolName: 'TestTool', toolId: 'test_123' },
      },
      {
        type: 'thinking',
        content: 'Let me think...',
        metadata: {},
      },
      {
        type: 'image',
        content: 'data:image/png;base64,xyz',
        metadata: { mediaType: 'image/png' },
      },
    ];

    it('should format content for preview', () => {
      const result = formatContentForDisplay(sampleContent, 'preview');
      expect(result).toBe('Hello world');
    });

    it('should format content for text display', () => {
      const result = formatContentForDisplay(sampleContent, 'text');
      expect(result).toContain('Hello world');
      expect(result).toContain('[Tool: TestTool]');
      expect(result).toContain('[Thinking] Let me think...');
      expect(result).toContain('[Image: image/png]');
    });

    it('should handle long preview text', () => {
      const longContent: ParsedContent[] = [
        {
          type: 'text',
          content: 'A'.repeat(150),
          metadata: {},
        },
      ];

      const result = formatContentForDisplay(longContent, 'preview');
      expect(result).toHaveLength(103); // 100 + '...'
      expect(result.endsWith('...')).toBe(true);
    });
  });
});