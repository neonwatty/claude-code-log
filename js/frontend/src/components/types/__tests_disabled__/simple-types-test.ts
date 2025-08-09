/**
 * Simple test to verify TypeScript interfaces compile and work correctly
 */
import {
  SessionSummary,
  SessionDetail,
  ProcessedContent,
  ToolUseDisplay,
  SessionFilter,
  ComponentConfig,
  ThemeVariant,
  DisplayMode,
} from '../session-types';

// Simple test runner
function test(description: string, testFn: () => void | boolean) {
  try {
    const result = testFn();
    if (result === false) {
      throw new Error('Test returned false');
    }
    console.log(`✓ ${description}`);
    return true;
  } catch (error) {
    console.error(`✗ ${description}: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

function runTypesTests() {
  console.log('Running session-types tests...\n');
  
  let passed = 0;
  let total = 0;

  // Test 1: SessionSummary interface works
  total++;
  if (test('should create SessionSummary objects', () => {
    const sessionSummary: SessionSummary = {
      sessionId: 'session-123',
      cwd: '/path/to/project',
      startTime: new Date(),
      messageCount: 10,
      userMessageCount: 5,
      assistantMessageCount: 5,
      isActive: true,
    };

    return sessionSummary.sessionId === 'session-123' &&
           sessionSummary.messageCount === 10 &&
           sessionSummary.isActive === true;
  })) passed++;

  // Test 2: SessionSummary with optional properties
  total++;
  if (test('should support optional properties in SessionSummary', () => {
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

    return sessionSummary.title === 'Test Session' &&
           sessionSummary.tags?.length === 2 &&
           sessionSummary.tokenUsage?.totalTokens === 1800;
  })) passed++;

  // Test 3: ProcessedContent different types
  total++;
  if (test('should support different ProcessedContent types', () => {
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

    return textContent.type === 'text' &&
           codeContent.language === 'javascript' &&
           toolContent.collapsible === true;
  })) passed++;

  // Test 4: ToolUseDisplay status tracking
  total++;
  if (test('should track tool execution status', () => {
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

    return pendingTool.status === 'pending' &&
           successTool.result === 'File content' &&
           errorTool.error === 'File not found';
  })) passed++;

  // Test 5: SessionFilter supports various options
  total++;
  if (test('should support various filtering options', () => {
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

    return filter.query === 'authentication' &&
           filter.tags?.[0] === 'development' &&
           filter.messageCountRange?.min === 10;
  })) passed++;

  // Test 6: ThemeVariant type works
  total++;
  if (test('should work with ThemeVariant type', () => {
    const lightTheme: ThemeVariant = 'light';
    const darkTheme: ThemeVariant = 'dark';
    const autoTheme: ThemeVariant = 'auto';

    return lightTheme === 'light' &&
           darkTheme === 'dark' &&
           autoTheme === 'auto';
  })) passed++;

  // Test 7: DisplayMode type works
  total++;
  if (test('should work with DisplayMode type', () => {
    const compact: DisplayMode = 'compact';
    const detailed: DisplayMode = 'detailed';
    const minimal: DisplayMode = 'minimal';

    return compact === 'compact' &&
           detailed === 'detailed' &&
           minimal === 'minimal';
  })) passed++;

  // Test 8: ComponentConfig comprehensive configuration
  total++;
  if (test('should provide comprehensive configuration', () => {
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

    return config.displayMode === 'detailed' &&
           config.theme === 'dark' &&
           config.syntaxHighlight.tabSize === 2 &&
           config.markdown.linkify === true;
  })) passed++;

  // Test 9: Type guards work with discriminated unions
  total++;
  if (test('should work with discriminated unions', () => {
    const textContent: ProcessedContent = {
      type: 'text',
      content: 'Hello',
    };

    const toolContent: ProcessedContent = {
      type: 'tool_use',
      content: { type: 'tool_use', id: '1', name: 'test', input: {} },
    };

    let textContentWorks = false;
    let toolContentWorks = false;

    if (textContent.type === 'text') {
      textContentWorks = typeof textContent.content === 'string';
    }

    if (toolContent.type === 'tool_use') {
      toolContentWorks = typeof toolContent.content === 'object';
    }

    return textContentWorks && toolContentWorks;
  })) passed++;

  // Test 10: SessionDetail extends SessionSummary
  total++;
  if (test('should extend SessionSummary with SessionDetail', () => {
    const sessionDetail: SessionDetail = {
      // SessionSummary properties
      sessionId: 'session-123',
      cwd: '/project',
      startTime: new Date(),
      messageCount: 5,
      userMessageCount: 2,
      assistantMessageCount: 3,
      isActive: true,
      
      // Additional SessionDetail properties
      entries: [],
      metadata: { version: '1.0' },
      referencedFiles: ['/file1.ts', '/file2.ts'],
      toolsUsed: ['file-read', 'file-write'],
      errors: []
    };

    return sessionDetail.sessionId === 'session-123' &&
           Array.isArray(sessionDetail.entries) &&
           sessionDetail.referencedFiles?.length === 2;
  })) passed++;

  console.log(`\nTest Results: ${passed}/${total} tests passed`);
  return passed === total;
}

// Run tests if this file is executed directly
if (typeof module !== 'undefined' && require.main === module) {
  runTypesTests();
}

export { runTypesTests };