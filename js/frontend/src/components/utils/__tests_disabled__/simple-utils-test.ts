/**
 * Simple test to verify session-utils functionality without testing framework
 */
import { 
  createSessionSummary, 
  detectCodeBlocks, 
  processMarkdown, 
  calculateSessionStats,
  validateSessionData 
} from '../session-utils';

// Mock data that matches the actual TranscriptEntry structure
const mockUserEntry = {
  type: 'user' as const,
  timestamp: '2023-01-15T10:00:00Z',
  message: {
    role: 'user' as const,
    content: 'Hello, can you help me with this code?',
  },
  uuid: 'uuid-1',
  isSidechain: false,
  userType: 'user',
  cwd: '/project',
  sessionId: 'session-123',
};

const mockAssistantEntry = {
  type: 'assistant' as const,
  timestamp: '2023-01-15T10:01:00Z',
  message: {
    role: 'assistant' as const,
    content: [
      {
        type: 'text' as const,
        text: 'Sure! I can help you with that.',
      },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  },
  uuid: 'uuid-2',
  isSidechain: false,
  userType: 'assistant',
  cwd: '/project',
  sessionId: 'session-123',
};

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

function runUtilsTests() {
  console.log('Running session-utils tests...\n');
  
  let passed = 0;
  let total = 0;

  // Test 1: Create session summary from entries
  total++;
  if (test('should create session summary from entries', () => {
    const entries = [mockUserEntry, mockAssistantEntry];
    const summary = createSessionSummary(entries, 'session-123', '/project');
    
    return summary.sessionId === 'session-123' &&
           summary.cwd === '/project' &&
           summary.messageCount === 2 &&
           summary.userMessageCount === 1 &&
           summary.assistantMessageCount === 1;
  })) passed++;

  // Test 2: Handle empty entries
  total++;
  if (test('should handle empty entries', () => {
    const summary = createSessionSummary([], 'empty-session', '/project');
    
    return summary.messageCount === 0 &&
           summary.userMessageCount === 0 &&
           summary.assistantMessageCount === 0;
  })) passed++;

  // Test 3: Detect fenced code blocks
  total++;
  if (test('should detect fenced code blocks', () => {
    const text = 'Here is some code:\n```javascript\nconsole.log("hello");\n```\nAnd some more text.';
    const blocks = detectCodeBlocks(text);
    
    return blocks.length === 1 &&
           blocks[0].language === 'javascript' &&
           blocks[0].content === 'console.log("hello");';
  })) passed++;

  // Test 4: Detect inline code blocks
  total++;
  if (test('should detect inline code blocks', () => {
    const text = 'Use the `console.log()` function to print output.';
    const blocks = detectCodeBlocks(text);
    
    return blocks.length === 1 &&
           blocks[0].content === 'console.log()' &&
           blocks[0].language === undefined;
  })) passed++;

  // Test 5: Process markdown bold text
  total++;
  if (test('should process bold text', () => {
    const markdown = 'This is **bold** text.';
    const processed = processMarkdown(markdown);
    
    return processed.includes('<strong>bold</strong>');
  })) passed++;

  // Test 6: Process markdown italic text
  total++;
  if (test('should process italic text', () => {
    const markdown = 'This is *italic* text.';
    const processed = processMarkdown(markdown);
    
    return processed.includes('<em>italic</em>');
  })) passed++;

  // Test 7: Process markdown links
  total++;
  if (test('should process links', () => {
    const markdown = 'Visit [Google](https://google.com) for search.';
    const processed = processMarkdown(markdown);
    
    return processed.includes('<a href="https://google.com"') &&
           processed.includes('target="_blank"') &&
           processed.includes('rel="noopener"');
  })) passed++;

  // Test 8: Calculate session statistics
  total++;
  if (test('should calculate session statistics', () => {
    const entries = [mockUserEntry, mockAssistantEntry];
    const stats = calculateSessionStats(entries);
    
    return stats.totalMessages === 2 &&
           stats.totalTokens === 150 &&
           stats.averageTokensPerMessage === 75;
  })) passed++;

  // Test 9: Validate valid session data
  total++;
  if (test('should validate valid session data', () => {
    const sessionData = {
      sessionId: 'test-session',
      entries: [mockUserEntry, mockAssistantEntry],
    };
    
    const result = validateSessionData(sessionData);
    
    return result.isValid === true && result.errors.length === 0;
  })) passed++;

  // Test 10: Detect missing session ID
  total++;
  if (test('should detect missing session ID', () => {
    const sessionData = {
      entries: [mockUserEntry],
    };
    
    const result = validateSessionData(sessionData);
    
    return result.isValid === false &&
           result.errors.some(error => error.includes('Session ID is required'));
  })) passed++;

  console.log(`\nTest Results: ${passed}/${total} tests passed`);
  return passed === total;
}

// Run tests if this file is executed directly
if (typeof module !== 'undefined' && require.main === module) {
  runUtilsTests();
}

export { runUtilsTests };