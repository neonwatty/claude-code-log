import { describe, it, expect } from 'vitest';
import {
  detectMessageType,
  detectAndParseMessage,
  detectMessageTypes,
  getMessageTypeStats,
  filterByMessageType,
  isUserMessage,
  isAssistantMessage,
  isSummaryMessage,
  isSystemMessage,
  classifyMessageContent,
  validateMessageSequence,
  summarizeDetectionResults,
  MESSAGE_TYPES,
  MessageType,
} from './message-detector';

// Test data helpers
function createValidUserMessage(overrides: Record<string, any> = {}) {
  return {
    type: 'user',
    timestamp: '2025-07-03T15:50:07.874717Z',
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd: '/tmp',
    sessionId: 'test',
    version: '1.0.0',
    uuid: 'test_001',
    message: {
      role: 'user',
      content: [{ type: 'text', text: 'Hello' }]
    },
    ...overrides,
  };
}

function createValidAssistantMessage(overrides: Record<string, any> = {}) {
  return {
    type: 'assistant',
    timestamp: '2025-07-03T15:52:07.874717Z',
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd: '/tmp',
    sessionId: 'test',
    version: '1.0.0',
    uuid: 'test_002',
    message: {
      id: 'test_002',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet-20240229',
      content: [{ type: 'text', text: 'Hi there' }],
      usage: { input_tokens: 10, output_tokens: 20 }
    },
    ...overrides,
  };
}

function createValidSummaryMessage(overrides: Record<string, any> = {}) {
  return {
    type: 'summary',
    summary: 'Test session summary',
    leafUuid: 'test_leaf',
    cwd: '/tmp',
    ...overrides,
  };
}

function createValidSystemMessage(overrides: Record<string, any> = {}) {
  return {
    type: 'system',
    timestamp: '2025-07-03T15:50:07.874717Z',
    parentUuid: null,
    isSidechain: false,
    userType: 'external',
    cwd: '/tmp',
    sessionId: 'test',
    version: '1.0.0',
    uuid: 'test_sys',
    content: 'System notification',
    level: 'info',
    ...overrides,
  };
}

describe('Message Type Detection', () => {
  describe('detectMessageType', () => {
    it('should detect valid user message', () => {
      const userData = createValidUserMessage();
      const result = detectMessageType(userData);

      expect(result.type).toBe('user');
      expect(result.isValid).toBe(true);
      expect(result.isSupported).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should detect valid assistant message', () => {
      const assistantData = createValidAssistantMessage();
      const result = detectMessageType(assistantData);

      expect(result.type).toBe('assistant');
      expect(result.isValid).toBe(true);
      expect(result.isSupported).toBe(true);
      expect(result.entry).toBeDefined();
    });

    it('should detect valid summary message', () => {
      const summaryData = createValidSummaryMessage();
      const result = detectMessageType(summaryData);

      expect(result.type).toBe('summary');
      expect(result.isValid).toBe(true);
      expect(result.isSupported).toBe(true);
      expect(result.entry).toBeDefined();
    });

    it('should detect valid system message', () => {
      const systemData = createValidSystemMessage();
      const result = detectMessageType(systemData);

      expect(result.type).toBe('system');
      expect(result.isValid).toBe(true);
      expect(result.isSupported).toBe(true);
      expect(result.entry).toBeDefined();
    });

    it('should handle unknown message type', () => {
      const unknownData = { type: 'unknown', someField: 'value' };
      const result = detectMessageType(unknownData);

      expect(result.type).toBe('unknown');
      expect(result.isValid).toBe(false);
      expect(result.isSupported).toBe(false);
      expect(result.entry).toBeUndefined();
      expect(result.errors).toBeDefined();
    });

    it('should handle invalid message structure', () => {
      const invalidData = createValidUserMessage();
      delete invalidData.timestamp; // Make it invalid
      
      const result = detectMessageType(invalidData);

      expect(result.type).toBe('user');
      expect(result.isValid).toBe(false);
      expect(result.isSupported).toBe(true);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should extract metadata correctly', () => {
      const userData = createValidUserMessage({
        toolUseResult: ['some', 'tool', 'result']
      });
      const result = detectMessageType(userData);

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.hasMessage).toBe(true);
      expect(result.metadata!.hasContent).toBe(true);
      expect(result.metadata!.hasToolUseResult).toBe(true);
      expect(result.metadata!.contentItemCount).toBe(1);
    });
  });

  describe('detectAndParseMessage', () => {
    it('should parse valid message successfully', () => {
      const userData = createValidUserMessage();
      const result = detectAndParseMessage(userData);

      expect(result.isValid).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry!.type).toBe('user');
    });

    it('should attempt parsing for known types even if validation fails', () => {
      // Create a message that might fail strict validation but could still be parsed
      const partialData = {
        type: 'user',
        timestamp: '2025-07-03T15:50:07.874717Z',
        sessionId: 'test',
        uuid: 'test_001',
        message: {
          role: 'user',
          content: 'Simple string content' // Not array format
        }
      };

      const result = detectAndParseMessage(partialData);
      // The result depends on how forgiving our parser is
      // At minimum, it should identify the type correctly
      expect(result.type).toBe('user');
    });
  });

  describe('detectMessageTypes', () => {
    it('should detect types for multiple messages', () => {
      const messages = [
        createValidUserMessage(),
        createValidAssistantMessage(),
        createValidSummaryMessage(),
        { type: 'unknown', data: 'test' }
      ];

      const results = detectMessageTypes(messages);

      expect(results).toHaveLength(4);
      expect(results[0].type).toBe('user');
      expect(results[1].type).toBe('assistant');
      expect(results[2].type).toBe('summary');
      expect(results[3].type).toBe('unknown');
    });
  });

  describe('getMessageTypeStats', () => {
    it('should calculate statistics correctly', () => {
      const results = [
        { type: 'user' as MessageType, isValid: true, isSupported: true },
        { type: 'user' as MessageType, isValid: true, isSupported: true },
        { type: 'assistant' as MessageType, isValid: true, isSupported: true },
        { type: 'summary' as MessageType, isValid: true, isSupported: true },
        { type: 'unknown' as MessageType, isValid: false, isSupported: false },
      ];

      const stats = getMessageTypeStats(results);

      expect(stats.total).toBe(5);
      expect(stats.validCount).toBe(4);
      expect(stats.invalidCount).toBe(1);
      expect(stats.byType.user).toBe(2);
      expect(stats.byType.assistant).toBe(1);
      expect(stats.byType.summary).toBe(1);
      expect(stats.byType.invalid).toBe(1);
    });
  });

  describe('Type Guards', () => {
    const userEntry = createValidUserMessage();
    const assistantEntry = createValidAssistantMessage();
    const summaryEntry = createValidSummaryMessage();
    const systemEntry = createValidSystemMessage();

    // Parse entries to get proper types
    const parsedUser = detectMessageType(userEntry).entry!;
    const parsedAssistant = detectMessageType(assistantEntry).entry!;
    const parsedSummary = detectMessageType(summaryEntry).entry!;
    const parsedSystem = detectMessageType(systemEntry).entry!;

    it('should correctly identify user messages', () => {
      expect(isUserMessage(parsedUser)).toBe(true);
      expect(isUserMessage(parsedAssistant)).toBe(false);
      expect(isUserMessage(parsedSummary)).toBe(false);
      expect(isUserMessage(parsedSystem)).toBe(false);
    });

    it('should correctly identify assistant messages', () => {
      expect(isAssistantMessage(parsedUser)).toBe(false);
      expect(isAssistantMessage(parsedAssistant)).toBe(true);
      expect(isAssistantMessage(parsedSummary)).toBe(false);
      expect(isAssistantMessage(parsedSystem)).toBe(false);
    });

    it('should correctly identify summary messages', () => {
      expect(isSummaryMessage(parsedUser)).toBe(false);
      expect(isSummaryMessage(parsedAssistant)).toBe(false);
      expect(isSummaryMessage(parsedSummary)).toBe(true);
      expect(isSummaryMessage(parsedSystem)).toBe(false);
    });

    it('should correctly identify system messages', () => {
      expect(isSystemMessage(parsedUser)).toBe(false);
      expect(isSystemMessage(parsedAssistant)).toBe(false);
      expect(isSystemMessage(parsedSummary)).toBe(false);
      expect(isSystemMessage(parsedSystem)).toBe(true);
    });
  });

  describe('classifyMessageContent', () => {
    it('should classify conversational user message', () => {
      const userEntry = detectMessageType(createValidUserMessage()).entry!;
      const classification = classifyMessageContent(userEntry);

      expect(classification.category).toBe('conversational');
      expect(classification.hasToolUse).toBe(false);
      expect(classification.hasThinking).toBe(false);
      expect(classification.hasImages).toBe(false);
      expect(classification.complexity).toBe('simple');
    });

    it('should classify tool use message', () => {
      const toolUseData = createValidUserMessage({
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'Please read this file' },
            { type: 'tool_use', id: 'tool_1', name: 'Read', input: { file: 'test.txt' } }
          ]
        }
      });
      
      const userEntry = detectMessageType(toolUseData).entry!;
      const classification = classifyMessageContent(userEntry);

      expect(classification.category).toBe('tool-use');
      expect(classification.hasToolUse).toBe(true);
      expect(classification.complexity).toBe('complex');
    });

    it('should classify assistant message with thinking', () => {
      const thinkingData = createValidAssistantMessage({
        message: {
          id: 'test_002',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-sonnet-20240229',
          content: [
            { type: 'thinking', thinking: 'Let me think about this...' },
            { type: 'text', text: 'Here is my response' }
          ]
        }
      });
      
      const assistantEntry = detectMessageType(thinkingData).entry!;
      const classification = classifyMessageContent(assistantEntry);

      expect(classification.hasThinking).toBe(true);
      expect(classification.complexity).toBe('moderate');
    });

    it('should classify message with images', () => {
      const imageData = createValidUserMessage({
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'Look at this image' },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'base64data' } }
          ]
        }
      });
      
      const userEntry = detectMessageType(imageData).entry!;
      const classification = classifyMessageContent(userEntry);

      expect(classification.hasImages).toBe(true);
      expect(classification.complexity).toBe('moderate');
    });

    it('should classify user message with tool use result', () => {
      const toolResultData = createValidUserMessage({
        toolUseResult: 'Tool execution completed successfully',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Please run this command' }]
        }
      });
      
      const detection = detectMessageType(toolResultData);
      // Use detectAndParseMessage if regular detection fails
      if (!detection.entry) {
        const parseDetection = detectAndParseMessage(toolResultData);
        if (parseDetection.entry) {
          const classification = classifyMessageContent(parseDetection.entry);
          expect(classification.hasToolUse).toBe(true);
          expect(classification.category).toBe('tool-use');
          return;
        }
      }
      
      const userEntry = detection.entry!;
      const classification = classifyMessageContent(userEntry);

      expect(classification.hasToolUse).toBe(true);
      expect(classification.category).toBe('tool-use');
    });

    it('should classify system message', () => {
      const systemEntry = detectMessageType(createValidSystemMessage()).entry!;
      const classification = classifyMessageContent(systemEntry);

      expect(classification.category).toBe('system-notification');
    });

    it('should classify summary message', () => {
      const summaryEntry = detectMessageType(createValidSummaryMessage()).entry!;
      const classification = classifyMessageContent(summaryEntry);

      expect(classification.category).toBe('meta');
    });
  });

  describe('validateMessageSequence', () => {
    it('should validate normal conversation sequence', () => {
      const entries = [
        detectMessageType(createValidUserMessage()).entry!,
        detectMessageType(createValidAssistantMessage()).entry!,
        detectMessageType(createValidUserMessage({ uuid: 'test_003' })).entry!,
      ];

      const validation = validateMessageSequence(entries);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect consecutive user messages', () => {
      const entries = [
        detectMessageType(createValidUserMessage()).entry!,
        detectMessageType(createValidUserMessage({ uuid: 'test_003' })).entry!,
      ];

      const validation = validateMessageSequence(entries);

      expect(validation.issues.some(issue => 
        issue.issue.includes('Consecutive user messages')
      )).toBe(true);
    });

    it('should detect assistant without user input', () => {
      const entries = [
        detectMessageType(createValidAssistantMessage()).entry!,
      ];

      const validation = validateMessageSequence(entries);

      expect(validation.issues.some(issue => 
        issue.issue.includes('Assistant message without prior user message')
      )).toBe(true);
    });

    it('should ignore summary and system messages in sequence validation', () => {
      const entries = [
        detectMessageType(createValidUserMessage()).entry!,
        detectMessageType(createValidSystemMessage()).entry!,
        detectMessageType(createValidAssistantMessage()).entry!,
        detectMessageType(createValidSummaryMessage()).entry!,
      ];

      const validation = validateMessageSequence(entries);

      expect(validation.isValid).toBe(true);
    });
  });

  describe('summarizeDetectionResults', () => {
    it('should create readable summary', () => {
      const results = [
        { type: 'user' as MessageType, isValid: true, isSupported: true },
        { type: 'assistant' as MessageType, isValid: true, isSupported: true },
        { type: 'unknown' as MessageType, isValid: false, isSupported: false },
      ];

      const summary = summarizeDetectionResults(results);

      expect(summary).toContain('Total messages: 3');
      expect(summary).toContain('Valid messages: 2');
      expect(summary).toContain('Invalid messages: 1');
      expect(summary).toContain('user: 1');
      expect(summary).toContain('assistant: 1');
    });
  });

  describe('Constants and Types', () => {
    it('should export message types correctly', () => {
      expect(MESSAGE_TYPES).toEqual(['user', 'assistant', 'summary', 'system']);
      expect(MESSAGE_TYPES).toHaveLength(4);
    });
  });
});