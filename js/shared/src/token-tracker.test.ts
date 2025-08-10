import { describe, it, expect } from 'vitest';
import {
  extractTokenUsage,
  aggregateUsage,
  calculateCost,
  trackSessionUsage,
  trackProjectUsage,
  generateUsageTimeline,
  analyzeUsageByType,
  addCostEstimates,
  formatUsage,
  generateUsageReport,
  DEFAULT_MODEL_PRICING,
  type ExtendedUsageInfo,
  type ModelPricing,
} from './token-tracker';
import { detectMessageType } from './message-detector';
import { type ToolUseContent, type ThinkingContent } from './index';

// Test data helpers
function createAssistantMessage(usage: any, overrides: Record<string, any> = {}) {
  return {
    type: 'assistant',
    timestamp: '2025-07-03T15:52:07.874717Z',
    parentUuid: undefined,
    isSidechain: false,
    userType: 'human',
    cwd: '/tmp',
    sessionId: 'test_session',
    version: '1.0.0',
    uuid: 'test_002',
    message: {
      id: 'test_002',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet-20240229',
      content: [{ type: 'text', text: 'Hi there' }],
      usage,
    },
    ...overrides,
  };
}

function createUserMessage(overrides: Record<string, any> = {}) {
  return {
    type: 'user',
    timestamp: '2025-07-03T15:50:07.874717Z',
    parentUuid: undefined,
    isSidechain: false,
    userType: 'human',
    cwd: '/tmp',
    sessionId: 'test_session',
    version: '1.0.0',
    uuid: 'test_001',
    message: {
      role: 'user',
      content: [{ type: 'text', text: 'Hello' }]
    },
    ...overrides,
  };
}

describe('Token Tracker', () => {
  describe('extractTokenUsage', () => {
    it('should extract basic token usage', () => {
      const usage = {
        input_tokens: 100,
        output_tokens: 200,
        cache_creation_input_tokens: 50,
        cache_read_input_tokens: 25,
      };
      
      const assistantData = createAssistantMessage(usage);
      const assistantEntry = detectMessageType(assistantData).entry!;
      
      const result = extractTokenUsage(assistantEntry as any);
      
      expect(result.input_tokens).toBe(100);
      expect(result.output_tokens).toBe(200);
      expect(result.cache_creation_input_tokens).toBe(50);
      expect(result.cache_read_input_tokens).toBe(25);
      expect(result.total_tokens).toBe(300);
      expect(result.cache_hit_ratio).toBeCloseTo(0.33, 2); // 25/75
    });

    it('should handle missing usage data', () => {
      const assistantData = createAssistantMessage(undefined);
      const assistantEntry = detectMessageType(assistantData).entry!;
      
      const result = extractTokenUsage(assistantEntry as any);
      
      expect(result.input_tokens).toBe(0);
      expect(result.output_tokens).toBe(0);
      expect(result.total_tokens).toBe(0);
    });

    it('should handle partial usage data', () => {
      const usage = {
        input_tokens: 100,
        output_tokens: 200,
        // Missing cache fields
      };
      
      const assistantData = createAssistantMessage(usage);
      const assistantEntry = detectMessageType(assistantData).entry!;
      
      const result = extractTokenUsage(assistantEntry as any);
      
      expect(result.input_tokens).toBe(100);
      expect(result.output_tokens).toBe(200);
      expect(result.cache_creation_input_tokens).toBe(0);
      expect(result.cache_read_input_tokens).toBe(0);
      expect(result.total_tokens).toBe(300);
      expect(result.cache_hit_ratio).toBe(0);
    });
  });

  describe('aggregateUsage', () => {
    it('should aggregate multiple usage objects', () => {
      const usages: ExtendedUsageInfo[] = [
        {
          input_tokens: 100,
          output_tokens: 200,
          cache_creation_input_tokens: 50,
          cache_read_input_tokens: 25,
          total_tokens: 300,
        },
        {
          input_tokens: 150,
          output_tokens: 100,
          cache_creation_input_tokens: 30,
          cache_read_input_tokens: 20,
          total_tokens: 250,
        }
      ];
      
      const result = aggregateUsage(usages);
      
      expect(result.input_tokens).toBe(250);
      expect(result.output_tokens).toBe(300);
      expect(result.cache_creation_input_tokens).toBe(80);
      expect(result.cache_read_input_tokens).toBe(45);
      expect(result.total_tokens).toBe(550);
      expect(result.cache_hit_ratio).toBeCloseTo(0.36, 2); // 45/125
    });

    it('should handle empty usage arrays', () => {
      const result = aggregateUsage([]);
      
      expect(result.input_tokens).toBe(0);
      expect(result.output_tokens).toBe(0);
      expect(result.total_tokens).toBe(0);
      expect(result.cache_hit_ratio).toBe(0);
    });
  });

  describe('calculateCost', () => {
    const testPricing: ModelPricing = {
      modelName: 'test-model',
      inputTokenPrice: 3.00, // $3 per 1M tokens
      outputTokenPrice: 15.00, // $15 per 1M tokens
      cacheCreationPrice: 3.75,
      cacheReadPrice: 0.30,
    };

    it('should calculate cost correctly', () => {
      const usage: ExtendedUsageInfo = {
        input_tokens: 1000, // $0.003
        output_tokens: 2000, // $0.030
        cache_creation_input_tokens: 500, // $0.001875
        cache_read_input_tokens: 1000, // $0.0003
        total_tokens: 3000,
      };
      
      const cost = calculateCost(usage, testPricing);
      
      expect(cost).toBeCloseTo(0.035175, 6);
    });

    it('should handle zero tokens', () => {
      const usage: ExtendedUsageInfo = {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        total_tokens: 0,
      };
      
      const cost = calculateCost(usage, testPricing);
      
      expect(cost).toBe(0);
    });
  });

  describe('trackSessionUsage', () => {
    it('should track usage for a session with multiple messages', () => {
      const userMsg = createUserMessage();
      const assistantMsg1 = createAssistantMessage({
        input_tokens: 100,
        output_tokens: 150,
      });
      const assistantMsg2 = createAssistantMessage({
        input_tokens: 80,
        output_tokens: 120,
      }, { uuid: 'test_003' });
      
      // Parse entries
      const entries = [
        detectMessageType(userMsg).entry!,
        detectMessageType(assistantMsg1).entry!,
        detectMessageType(assistantMsg2).entry!,
      ];
      
      const result = trackSessionUsage(entries);
      
      expect(result.sessionId).toBe('test_session');
      expect(result.messageCount).toBe(3);
      expect(result.assistantMessageCount).toBe(2);
      expect(result.usage.input_tokens).toBe(180);
      expect(result.usage.output_tokens).toBe(270);
      expect(result.usage.total_tokens).toBe(450);
      expect(result.timeRange.start).toBeDefined();
      expect(result.timeRange.end).toBeDefined();
    });

    it('should handle session with no assistant messages', () => {
      const userMsg1 = createUserMessage();
      const userMsg2 = createUserMessage({ uuid: 'test_003' });
      
      const entries = [
        detectMessageType(userMsg1).entry!,
        detectMessageType(userMsg2).entry!,
      ];
      
      const result = trackSessionUsage(entries);
      
      expect(result.assistantMessageCount).toBe(0);
      expect(result.usage.total_tokens).toBe(0);
    });
  });

  describe('trackProjectUsage', () => {
    it('should track usage across multiple sessions', () => {
      // Session 1
      const session1Messages = [
        createUserMessage({ sessionId: 'session_1' }),
        createAssistantMessage({
          input_tokens: 100,
          output_tokens: 150,
        }, { sessionId: 'session_1' }),
      ];
      
      // Session 2
      const session2Messages = [
        createUserMessage({ sessionId: 'session_2', uuid: 'test_004' }),
        createAssistantMessage({
          input_tokens: 200,
          output_tokens: 300,
        }, { sessionId: 'session_2', uuid: 'test_005' }),
      ];
      
      const allEntries = [
        ...session1Messages.map(msg => detectMessageType(msg).entry!),
        ...session2Messages.map(msg => detectMessageType(msg).entry!),
      ];
      
      const result = trackProjectUsage(allEntries);
      
      expect(result.totalSessions).toBe(2);
      expect(result.totalMessages).toBe(4);
      expect(result.totalAssistantMessages).toBe(2);
      expect(result.usage.input_tokens).toBe(300);
      expect(result.usage.output_tokens).toBe(450);
      expect(result.usage.total_tokens).toBe(750);
      expect(result.averageTokensPerMessage).toBe(187.5);
      expect(result.averageTokensPerSession).toBe(375);
      expect(result.sessionUsages).toHaveLength(2);
    });
  });

  describe('generateUsageTimeline', () => {
    it('should generate chronological timeline of token usage', () => {
      const messages = [
        createUserMessage(),
        createAssistantMessage({
          input_tokens: 100,
          output_tokens: 150,
        }, { timestamp: '2025-07-03T15:52:00.000Z' }),
        createAssistantMessage({
          input_tokens: 80,
          output_tokens: 120,
        }, { 
          timestamp: '2025-07-03T15:53:00.000Z',
          uuid: 'test_003'
        }),
      ];
      
      const entries = messages.map(msg => detectMessageType(msg).entry!);
      const timeline = generateUsageTimeline(entries);
      
      expect(timeline).toHaveLength(2);
      expect(timeline[0].messageUsage.input_tokens).toBe(100);
      expect(timeline[0].cumulativeUsage.total_tokens).toBe(250);
      expect(timeline[1].messageUsage.input_tokens).toBe(80);
      expect(timeline[1].cumulativeUsage.total_tokens).toBe(450);
      
      // Should be sorted by timestamp
      expect(timeline[0].timestamp.getTime()).toBeLessThan(timeline[1].timestamp.getTime());
    });
  });

  describe('analyzeUsageByType', () => {
    it('should categorize usage by message content type', () => {
      const conversationalMsg = createAssistantMessage({
        input_tokens: 100,
        output_tokens: 150,
      });
      
      const toolUseMsg = createAssistantMessage({
        input_tokens: 200,
        output_tokens: 250,
      });
      // Update the message content while preserving usage
      toolUseMsg.message = {
        ...toolUseMsg.message,
        id: 'tool_msg',
        content: [
          { type: 'text', text: 'Let me use a tool' },
          { type: 'tool_use', id: 'tool1', name: 'Read', input: {} }
        ] as any[],
      };
      
      const thinkingMsg = createAssistantMessage({
        input_tokens: 150,
        output_tokens: 100,
      });
      // Update the message content while preserving usage
      thinkingMsg.message = {
        ...thinkingMsg.message,
        id: 'thinking_msg',
        content: [
          { type: 'thinking', thinking: 'Let me think...' },
          { type: 'text', text: 'Here is my response' }
        ] as any[],
      };
      
      const entries = [
        detectMessageType(conversationalMsg).entry!,
        detectMessageType(toolUseMsg).entry!,
        detectMessageType(thinkingMsg).entry!,
      ];
      
      const result = analyzeUsageByType(entries);
      
      // First message: 100 + 150 = 250 tokens
      // Second message: 200 + 250 = 450 tokens
      // Third message: 150 + 100 = 250 tokens
      // Total: 250 + 450 + 250 = 950 tokens
      expect(result.assistant.total_tokens).toBe(950); // All messages
      expect(result.conversational.total_tokens).toBe(250); // Only conversational
      expect(result.toolUse.total_tokens).toBe(450); // Only tool use  
      expect(result.thinking.total_tokens).toBe(250); // Only thinking
    });
  });

  describe('addCostEstimates', () => {
    it('should add cost estimates with default pricing', () => {
      const usage: ExtendedUsageInfo = {
        input_tokens: 1000,
        output_tokens: 2000,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 1000,
        total_tokens: 3000,
      };
      
      const result = addCostEstimates(usage, 'claude-3-sonnet-20240229');
      
      expect(result.estimated_cost).toBeDefined();
      expect(result.estimated_cost).toBeGreaterThan(0);
    });

    it('should use custom pricing when provided', () => {
      const usage: ExtendedUsageInfo = {
        input_tokens: 1000,
        output_tokens: 1000,
        total_tokens: 2000,
      };
      
      const customPricing: ModelPricing = {
        modelName: 'custom',
        inputTokenPrice: 1.0,
        outputTokenPrice: 2.0,
      };
      
      const result = addCostEstimates(usage, undefined, customPricing);
      
      expect(result.estimated_cost).toBe(0.003); // (1000 * 1 + 1000 * 2) / 1M
    });
  });

  describe('formatUsage', () => {
    it('should format usage for display', () => {
      const usage: ExtendedUsageInfo = {
        input_tokens: 1000,
        output_tokens: 2000,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 250,
        total_tokens: 3000,
        cache_hit_ratio: 0.33,
        estimated_cost: 0.045,
      };
      
      const formatted = formatUsage(usage);
      
      expect(formatted).toContain('Input: 1,000');
      expect(formatted).toContain('Output: 2,000');
      expect(formatted).toContain('Cache Creation: 500');
      expect(formatted).toContain('Cache Read: 250');
      expect(formatted).toContain('Total: 3,000');
      expect(formatted).toContain('Cache Hit Ratio: 33.0%');
      expect(formatted).toContain('Estimated Cost: $0.0450');
    });
  });

  describe('generateUsageReport', () => {
    it('should generate comprehensive usage report', () => {
      const projectUsage = trackProjectUsage([
        detectMessageType(createUserMessage()).entry!,
        detectMessageType(createAssistantMessage({
          input_tokens: 100,
          output_tokens: 200,
        })).entry!,
      ]);
      
      const report = generateUsageReport(projectUsage);
      
      expect(report).toContain('# Token Usage Report');
      expect(report).toContain('## Project Overview');
      expect(report).toContain('## Total Usage');
      expect(report).toContain('## Session Breakdown');
      expect(report).toContain('Total Sessions: 1');
      expect(report).toContain('Total Messages: 2');
    });
  });

  describe('DEFAULT_MODEL_PRICING', () => {
    it('should have pricing for common models', () => {
      expect(DEFAULT_MODEL_PRICING['claude-3-5-sonnet-20241022']).toBeDefined();
      expect(DEFAULT_MODEL_PRICING['claude-3-sonnet-20240229']).toBeDefined();
      expect(DEFAULT_MODEL_PRICING['claude-3-haiku-20240307']).toBeDefined();
      
      const pricing = DEFAULT_MODEL_PRICING['claude-3-5-sonnet-20241022'];
      expect(pricing.inputTokenPrice).toBeGreaterThan(0);
      expect(pricing.outputTokenPrice).toBeGreaterThan(0);
    });
  });
});