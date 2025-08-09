import { assert } from '@open-wc/testing';
import {
  SessionSummary,
  SessionDetail,
  MessageDisplay,
  ProcessedContent,
  MessageMetadata,
  ToolUseDisplay,
  SessionFilter,
  SessionSort,
  PaginationOptions,
  ComponentEvents,
  SyntaxHighlightConfig,
  MarkdownConfig,
  PerformanceConfig,
  AccessibilityConfig,
  ComponentConfig
} from '../session-types';

describe('SessionTypes', () => {
  describe('SessionSummary', () => {
    it('should have required properties', () => {
      const sessionSummary: SessionSummary = {
        sessionId: 'session-123',
        cwd: '/path/to/project',
        startTime: new Date(),
        messageCount: 10,
        userMessageCount: 5,
        assistantMessageCount: 5,
        isActive: true,
      };

      assert.equal(sessionSummary.sessionId, 'session-123');
      assert.equal(sessionSummary.cwd, '/path/to/project');
      assert.equal(sessionSummary.messageCount, 10);
      assert.equal(sessionSummary.isActive, true);
    });

    it('should have optional properties', () => {
      const sessionSummary: SessionSummary = {
        sessionId: 'session-123',
        cwd: '/path/to/project',
        startTime: new Date(),
        endTime: new Date(),
        messageCount: 10,
        userMessageCount: 5,
        assistantMessageCount: 5,
        duration: 30000,
        isActive: false,
        title: 'Test Session',
        tags: ['development', 'debugging'],
        summary: 'Working on authentication feature',
        tokenUsage: {
          inputTokens: 1000,
          outputTokens: 800,
          totalTokens: 1800,
        },
      };

      assert.equal(sessionSummary.title, 'Test Session');
      assert.deepEqual(sessionSummary.tags, ['development', 'debugging']);
      assert.equal(sessionSummary.tokenUsage?.totalTokens, 1800);
    });
  });

  describe('ProcessedContent', () => {
    it('should support different content types', () => {
      const textContent: ProcessedContent = {
        type: 'text',
        content: 'Hello world',
      };

      const codeContent: ProcessedContent = {
        type: 'code',
        content: 'console.log("hello");',
        language: 'javascript',
        collapsible: false,
      };

      const toolContent: ProcessedContent = {
        type: 'tool_use',
        content: { type: 'tool_use', id: '1', name: 'test', input: {} },
        collapsible: true,
        defaultCollapsed: false,
      };

      assert.equal(textContent.type, 'text');
      assert.equal(codeContent.language, 'javascript');
      assert.equal(toolContent.collapsible, true);
    });
  });

  describe('ToolUseDisplay', () => {
    it('should track tool execution status', () => {
      const pendingTool: ToolUseDisplay = {
        name: 'file-read',
        parameters: { path: '/test.txt' },
        status: 'pending',
      };

      const successTool: ToolUseDisplay = {
        name: 'file-read',
        parameters: { path: '/test.txt' },
        result: 'File content',
        status: 'success',
        duration: 150,
      };

      const errorTool: ToolUseDisplay = {
        name: 'file-read',
        parameters: { path: '/nonexistent.txt' },
        status: 'error',
        error: 'File not found',
      };

      assert.equal(pendingTool.status, 'pending');
      assert.equal(successTool.result, 'File content');
      assert.equal(errorTool.error, 'File not found');
    });
  });

  describe('SessionFilter', () => {
    it('should support various filtering options', () => {
      const filter: SessionFilter = {
        query: 'authentication',
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31'),
        },
        tags: ['development'],
        cwd: '/project',
        messageCountRange: {
          min: 10,
          max: 100,
        },
        durationRange: {
          min: 5,
          max: 60,
        },
        activeOnly: false,
        errorsOnly: false,
      };

      assert.equal(filter.query, 'authentication');
      assert.deepEqual(filter.tags, ['development']);
      assert.equal(filter.messageCountRange?.min, 10);
    });
  });

  describe('SessionSort', () => {
    it('should support different sort fields and directions', () => {
      const sortByTime: SessionSort = {
        field: 'startTime',
        direction: 'desc',
      };

      const sortByMessages: SessionSort = {
        field: 'messageCount',
        direction: 'asc',
      };

      assert.equal(sortByTime.field, 'startTime');
      assert.equal(sortByMessages.direction, 'asc');
    });
  });

  describe('PaginationOptions', () => {
    it('should track pagination state', () => {
      const pagination: PaginationOptions = {
        page: 2,
        pageSize: 20,
        totalItems: 150,
        hasNextPage: true,
        hasPrevPage: true,
      };

      assert.equal(pagination.page, 2);
      assert.equal(pagination.totalItems, 150);
      assert.equal(pagination.hasNextPage, true);
    });
  });

  describe('ComponentConfig', () => {
    it('should provide comprehensive configuration', () => {
      const config: ComponentConfig = {
        displayMode: 'detailed',
        theme: 'dark',
        syntaxHighlight: {
          theme: 'vs-dark',
          languages: ['javascript', 'typescript', 'python'],
          lineNumbers: true,
          wordWrap: false,
          tabSize: 2,
        },
        markdown: {
          html: false,
          linkify: true,
          typographer: true,
          highlight: true,
          tables: true,
          taskLists: true,
        },
        performance: {
          virtualScrollThreshold: 100,
          lazyLoadThreshold: 50,
          lazyImages: true,
          searchDebounceMs: 300,
          initialRenderLimit: 20,
        },
        accessibility: {
          announcements: true,
          keyboardNavigation: true,
          highContrast: false,
          reducedMotion: false,
          focusManagement: true,
        },
      };

      assert.equal(config.displayMode, 'detailed');
      assert.equal(config.theme, 'dark');
      assert.equal(config.syntaxHighlight.tabSize, 2);
      assert.equal(config.markdown.linkify, true);
      assert.equal(config.performance.virtualScrollThreshold, 100);
      assert.equal(config.accessibility.keyboardNavigation, true);
    });
  });

  describe('Type Guards', () => {
    it('should work with discriminated unions', () => {
      const textContent: ProcessedContent = {
        type: 'text',
        content: 'Hello',
      };

      const toolContent: ProcessedContent = {
        type: 'tool_use',
        content: { type: 'tool_use', id: '1', name: 'test', input: {} },
      };

      if (textContent.type === 'text') {
        assert.typeOf(textContent.content, 'string');
      }

      if (toolContent.type === 'tool_use') {
        assert.typeOf(toolContent.content, 'object');
      }
    });
  });

  describe('Event Types', () => {
    it('should define component event structure', () => {
      // This is more of a compile-time check, but we can verify the structure
      type SessionSelectedEvent = ComponentEvents['session-selected'];
      type MessageSelectedEvent = ComponentEvents['message-selected'];
      type FilterChangedEvent = ComponentEvents['filter-changed'];

      const sessionSelected: SessionSelectedEvent = {
        sessionId: 'test',
        session: {
          sessionId: 'test',
          cwd: '/path',
          startTime: new Date(),
          messageCount: 5,
          userMessageCount: 2,
          assistantMessageCount: 3,
          isActive: true,
        },
      };

      assert.equal(sessionSelected.sessionId, 'test');
      assert.equal(sessionSelected.session.messageCount, 5);
    });
  });
});