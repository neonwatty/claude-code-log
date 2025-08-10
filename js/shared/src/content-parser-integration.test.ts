import { describe, it, expect } from 'vitest';
import { JsonlParser } from './jsonl-parser';
import { parseTranscriptEntries } from './content-parser';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('Content Parser Integration', () => {
  it('should parse real JSONL transcript data', async () => {
    // Use test data files
    const testDataDir = '/Users/jeremywatt/Desktop/claude-code-log/python/test/test_data';
    
    try {
      // Check if test data exists
      await fs.access(testDataDir);
    } catch {
      console.log('Skipping integration test - test data not available');
      return;
    }

    const testFiles = await fs.readdir(testDataDir);
    const jsonlFiles = testFiles.filter(f => f.endsWith('.jsonl') && f !== 'edge_cases.jsonl'); // Skip malformed edge_cases file
    
    if (jsonlFiles.length === 0) {
      console.log('No valid JSONL files found in test data directory');
      return;
    }

    const testFile = join(testDataDir, jsonlFiles[0]);
    console.log(`Testing with file: ${jsonlFiles[0]}`);

    const parser = new JsonlParser();
    const parseResult = await parser.parseFile(testFile);


    expect(parseResult.entries.length).toBeGreaterThan(0);
    expect(parseResult.errors.length).toBeLessThanOrEqual(parseResult.totalLines);

    // Parse content for all entries
    const parsedMessages = parseTranscriptEntries(parseResult.entries, {
      includeRawContent: true,
      extractToolInfo: true,
    });

    console.log(`Parsed ${parsedMessages.length} messages`);

    // Analyze the parsed content
    const stats = {
      totalMessages: parsedMessages.length,
      messageTypes: {} as Record<string, number>,
      contentTypes: {
        hasText: 0,
        hasToolUse: 0,
        hasThinking: 0,
        hasImages: 0,
      },
      totalTokens: 0,
    };

    parsedMessages.forEach(msg => {
      // Count message types
      stats.messageTypes[msg.messageType] = (stats.messageTypes[msg.messageType] || 0) + 1;

      // Count content types
      if (msg.parsedContent.some(pc => pc.type === 'text' || pc.type === 'markdown')) {
        stats.contentTypes.hasText++;
      }
      if (msg.hasToolUse) {
        stats.contentTypes.hasToolUse++;
      }
      if (msg.hasThinking) {
        stats.contentTypes.hasThinking++;
      }
      if (msg.hasImages) {
        stats.contentTypes.hasImages++;
      }

      // Count tokens
      if (msg.tokenUsage) {
        stats.totalTokens += msg.tokenUsage.total_tokens;
      }
    });

    console.log('Integration test statistics:');
    console.log('- Message types:', stats.messageTypes);
    console.log('- Content analysis:', stats.contentTypes);
    console.log('- Total tokens:', stats.totalTokens);

    // Basic validation
    expect(stats.totalMessages).toBeGreaterThan(0);
    expect(stats.messageTypes.user || 0).toBeGreaterThan(0);
    expect(stats.contentTypes.hasText).toBeGreaterThan(0);

    // Test specific parsing functionality
    const userMessages = parsedMessages.filter(m => m.messageType === 'user');
    if (userMessages.length > 0) {
      const firstUser = userMessages[0];
      expect(firstUser.displayType).toContain('User');
      expect(firstUser.parsedContent.length).toBeGreaterThan(0);
    }

    const assistantMessages = parsedMessages.filter(m => m.messageType === 'assistant');
    if (assistantMessages.length > 0) {
      const firstAssistant = assistantMessages[0];
      expect(firstAssistant.displayType).toContain('Assistant');
      expect(firstAssistant.parsedContent.length).toBeGreaterThan(0);
    }

    // Test tool use detection if present
    const toolUseMessages = parsedMessages.filter(m => m.hasToolUse);
    if (toolUseMessages.length > 0) {
      const toolMsg = toolUseMessages[0];
      const toolContent = toolMsg.parsedContent.find(pc => pc.type === 'tool_use');
      expect(toolContent).toBeDefined();
      expect(toolContent?.metadata?.toolName).toBeDefined();
    }

    // Test thinking content if present
    const thinkingMessages = parsedMessages.filter(m => m.hasThinking);
    if (thinkingMessages.length > 0) {
      const thinkingMsg = thinkingMessages[0];
      const thinkingContent = thinkingMsg.parsedContent.find(pc => pc.type === 'thinking');
      expect(thinkingContent).toBeDefined();
    }
  });

  it('should handle edge cases in real data', async () => {
    // Test edge case handling with various content types
    const testEntries = [
      // Empty content
      {
        type: 'user',
        timestamp: '2025-07-03T15:50:00Z',
        parentUuid: undefined,
        isSidechain: false,
        userType: 'human',
        cwd: '/tmp',
        sessionId: 'session1',
        version: '1.0.0',
        uuid: 'user_empty',
        message: {
          role: 'user',
          content: [],
        },
      },
      // Mixed content with all types
      {
        type: 'assistant',
        timestamp: '2025-07-03T15:51:00Z',
        parentUuid: undefined,
        isSidechain: false,
        userType: 'human',
        cwd: '/tmp',
        sessionId: 'session1',
        version: '1.0.0',
        uuid: 'assistant_mixed',
        message: {
          id: 'assistant_mixed',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-sonnet-20240229',
          content: [
            { type: 'thinking', thinking: 'Let me analyze this request...' },
            { type: 'text', text: 'I\'ll help you with that.' },
            { 
              type: 'tool_use', 
              id: 'read_123', 
              name: 'Read', 
              input: { file_path: '/test.txt' }
            },
          ],
        },
      },
    ];

    // Convert to TranscriptEntry objects using message detector
    const { detectMessageType } = await import('./message-detector');
    const validEntries = testEntries
      .map(entry => detectMessageType(entry).entry)
      .filter(e => e) as any[];

    const parsedMessages = parseTranscriptEntries(validEntries);

    // Should handle empty content gracefully
    const emptyContentMsg = parsedMessages.find(m => m.messageType === 'user');
    expect(emptyContentMsg).toBeDefined();
    expect(emptyContentMsg?.parsedContent.length).toBe(0);

    // Should parse mixed content correctly
    const mixedContentMsg = parsedMessages.find(m => m.messageType === 'assistant');
    expect(mixedContentMsg).toBeDefined();
    expect(mixedContentMsg?.hasThinking).toBe(true);
    expect(mixedContentMsg?.hasToolUse).toBe(true);
    expect(mixedContentMsg?.parsedContent.length).toBe(3);

    // Check specific content types
    const thinkingItem = mixedContentMsg?.parsedContent.find(pc => pc.type === 'thinking');
    expect(thinkingItem?.content).toContain('analyze this request');

    const toolUseItem = mixedContentMsg?.parsedContent.find(pc => pc.type === 'tool_use');
    expect(toolUseItem?.metadata?.toolName).toBe('Read');
    expect(toolUseItem?.metadata?.toolId).toBe('read_123');
  });
});