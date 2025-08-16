// Tests for Anthropic SDK compatibility adapters

import {
  convertUserMessageToAnthropic,
  convertAssistantMessageToAnthropic,
  convertAnthropicMessageParamToInternal,
  convertAnthropicMessageToInternal,
  convertUsageToAnthropic,
  convertUsageFromAnthropic,
  isAnthropicMessage,
  isAnthropicMessageParam
} from '../adapters/anthropic-message-adapter';

import {
  convertContentToAnthropic,
  convertContentFromAnthropic,
  convertContentItemToAnthropic,
  convertAnthropicContentToInternal,
  isAnthropicTextBlock,
  isAnthropicToolUseBlock
} from '../adapters/anthropic-content-adapter';

import {
  convertToolUseToAnthropic,
  convertAnthropicToolUseToInternal,
  createAutoToolChoice,
  createSpecificToolChoice,
  createAnthropicTool,
  isAutoToolChoice,
  isSpecificToolChoice,
  validateToolChoice
} from '../adapters/anthropic-tool-adapter';

import { 
  IUserMessage, 
  IAssistantMessage, 
  IContentItem, 
  IUsageInfo 
} from '../interfaces';

describe('Anthropic Message Adapter', () => {
  describe('convertUserMessageToAnthropic', () => {
    it('should convert simple string content', () => {
      const internal: IUserMessage = {
        role: 'user',
        content: 'Hello, Claude!'
      };

      const result = convertUserMessageToAnthropic(internal);

      expect(result).toEqual({
        role: 'user',
        content: 'Hello, Claude!'
      });
    });

    it('should convert content array', () => {
      const internal: IUserMessage = {
        role: 'user',
        content: [{
          type: 'text',
          text: 'Hello, Claude!'
        }]
      };

      const result = convertUserMessageToAnthropic(internal);

      expect(result.role).toBe('user');
      expect(Array.isArray(result.content)).toBe(true);
    });
  });

  describe('convertAssistantMessageToAnthropic', () => {
    it('should convert assistant message with usage', () => {
      const internal: IAssistantMessage = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: [{
          type: 'text',
          text: 'Hello! How can I help you?'
        }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20
        }
      };

      const result = convertAssistantMessageToAnthropic(internal);

      expect(result).toEqual({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: [{
          type: 'text',
          text: 'Hello! How can I help you?'
        }],
        stop_reason: 'end_turn',
        stop_sequence: undefined,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_input_tokens: undefined,
          cache_read_input_tokens: undefined,
          service_tier: undefined
        }
      });
    });
  });

  describe('usage conversion', () => {
    it('should convert usage to Anthropic format', () => {
      const internal: IUsageInfo = {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 5,
        service_tier: 'standard',
        server_tool_use: { someData: 'value' }
      };

      const result = convertUsageToAnthropic(internal);

      expect(result).toEqual({
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 5,
        service_tier: 'standard'
      });
    });

    it('should handle undefined usage', () => {
      const result = convertUsageToAnthropic(undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('type guards', () => {
    it('should identify Anthropic message format', () => {
      const anthropicMessage = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: []
      };

      expect(isAnthropicMessage(anthropicMessage)).toBe(true);
      expect(isAnthropicMessage({ id: 'test' })).toBe(false);
      expect(isAnthropicMessage(null)).toBe(false);
    });

    it('should identify Anthropic message param format', () => {
      const anthropicParam = {
        role: 'user',
        content: 'Hello'
      };

      expect(isAnthropicMessageParam(anthropicParam)).toBe(true);
      expect(isAnthropicMessageParam({ role: 'invalid' })).toBe(false);
      expect(isAnthropicMessageParam(null)).toBe(false);
    });
  });
});

describe('Anthropic Content Adapter', () => {
  describe('content item conversion', () => {
    it('should convert text content', () => {
      const internal: IContentItem = {
        type: 'text',
        text: 'Hello world'
      };

      const result = convertContentItemToAnthropic(internal);

      expect(result).toEqual({
        type: 'text',
        text: 'Hello world'
      });
    });

    it('should convert tool use content', () => {
      const internal: IContentItem = {
        type: 'tool_use',
        id: 'tool_123',
        name: 'search',
        input: { query: 'test' }
      };

      const result = convertContentItemToAnthropic(internal);

      expect(result).toEqual({
        type: 'tool_use',
        id: 'tool_123',
        name: 'search',
        input: { query: 'test' }
      });
    });

    it('should convert thinking content', () => {
      const internal: IContentItem = {
        type: 'thinking',
        thinking: 'Let me think about this...',
        signature: 'sig_123'
      };

      const result = convertContentItemToAnthropic(internal);

      expect(result).toEqual({
        type: 'thinking',
        thinking: 'Let me think about this...'
      });
    });
  });

  describe('content array conversion', () => {
    it('should convert mixed content array', () => {
      const internal: IContentItem[] = [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'tool_1', name: 'search', input: {} },
        { type: 'thinking', thinking: 'Thinking...', signature: 'sig' }
      ];

      const result = convertContentToAnthropic(internal);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ type: 'text', text: 'Hello' });
      expect(result[1]).toEqual({ type: 'tool_use', id: 'tool_1', name: 'search', input: {} });
      expect(result[2]).toEqual({ type: 'thinking', thinking: 'Thinking...' });
    });
  });

  describe('type guards', () => {
    it('should identify text blocks', () => {
      expect(isAnthropicTextBlock({ type: 'text', text: 'hello' })).toBe(true);
      expect(isAnthropicTextBlock({ type: 'tool_use' })).toBe(false);
      expect(isAnthropicTextBlock(null)).toBe(false);
    });

    it('should identify tool use blocks', () => {
      const toolUse = { type: 'tool_use', id: 'tool_1', name: 'search', input: {} };
      expect(isAnthropicToolUseBlock(toolUse)).toBe(true);
      expect(isAnthropicToolUseBlock({ type: 'text' })).toBe(false);
    });
  });
});

describe('Anthropic Tool Adapter', () => {
  describe('tool choice creation', () => {
    it('should create auto tool choice', () => {
      const choice = createAutoToolChoice();
      expect(choice).toEqual({ type: 'auto' });
      expect(isAutoToolChoice(choice)).toBe(true);
    });

    it('should create specific tool choice', () => {
      const choice = createSpecificToolChoice('search');
      expect(choice).toEqual({ type: 'tool', name: 'search' });
      expect(isSpecificToolChoice(choice)).toBe(true);
    });
  });

  describe('tool definition creation', () => {
    it('should create Anthropic tool definition', () => {
      const tool = createAnthropicTool(
        'search',
        'Search for information',
        {
          type: 'object',
          properties: {
            query: { type: 'string' }
          },
          required: ['query']
        }
      );

      expect(tool).toEqual({
        name: 'search',
        description: 'Search for information',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string' }
          },
          required: ['query']
        },
        cache_control: undefined
      });
    });
  });

  describe('tool choice validation', () => {
    it('should validate tool choice against available tools', () => {
      const tools = [
        createAnthropicTool('search', 'Search tool', {}),
        createAnthropicTool('calculator', 'Calculator tool', {})
      ];

      const validChoice = createSpecificToolChoice('search');
      const invalidChoice = createSpecificToolChoice('nonexistent');
      const autoChoice = createAutoToolChoice();

      expect(validateToolChoice(validChoice, tools)).toBe(true);
      expect(validateToolChoice(invalidChoice, tools)).toBe(false);
      expect(validateToolChoice(autoChoice, tools)).toBe(true);
    });
  });

  describe('tool use conversion', () => {
    it('should convert internal tool use to Anthropic format', () => {
      const internal: IContentItem = {
        type: 'tool_use',
        id: 'tool_123',
        name: 'search',
        input: { query: 'test query' }
      };

      const result = convertToolUseToAnthropic(internal as any);

      expect(result).toEqual({
        type: 'tool_use',
        id: 'tool_123',
        name: 'search',
        input: { query: 'test query' }
      });
    });

    it('should convert Anthropic tool use to internal format', () => {
      const anthropic = {
        type: 'tool_use' as const,
        id: 'tool_123',
        name: 'search',
        input: { query: 'test query' }
      };

      const result = convertAnthropicToolUseToInternal(anthropic);

      expect(result).toEqual({
        type: 'tool_use',
        id: 'tool_123',
        name: 'search',
        input: { query: 'test query' }
      });
    });
  });
});