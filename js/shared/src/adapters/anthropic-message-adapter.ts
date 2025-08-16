// Message conversion utilities between internal types and Anthropic SDK types

import { 
  IUserMessage, 
  IAssistantMessage, 
  IUsageInfo 
} from '../interfaces';
import { 
  AnthropicMessage, 
  AnthropicMessageParam, 
  AnthropicUsage,
  AnthropicMessageCreateParams
} from './types';
import { convertContentToAnthropic, convertContentFromAnthropic, convertContentFromAnthropicParam, convertContentToAnthropicParam } from './anthropic-content-adapter';

/**
 * Converts internal user message to Anthropic MessageParam format
 */
export function convertUserMessageToAnthropic(message: IUserMessage): AnthropicMessageParam {
  return {
    role: 'user',
    content: typeof message.content === 'string' 
      ? message.content 
      : convertContentToAnthropicParam(message.content)
  };
}

/**
 * Converts internal assistant message to Anthropic Message format
 */
export function convertAssistantMessageToAnthropic(message: IAssistantMessage): AnthropicMessage {
  return {
    id: message.id,
    type: 'message',
    role: 'assistant',
    model: message.model,
    content: convertContentToAnthropic(message.content),
    stop_reason: convertStopReason(message.stop_reason),
    stop_sequence: message.stop_sequence,
    usage: convertUsageToAnthropic(message.usage)
  };
}

/**
 * Converts Anthropic MessageParam to internal user message format
 */
export function convertAnthropicMessageParamToInternal(param: AnthropicMessageParam): IUserMessage {
  return {
    role: 'user',
    content: typeof param.content === 'string' 
      ? param.content 
      : convertContentFromAnthropicParam(param.content)
  };
}

/**
 * Converts Anthropic Message to internal assistant message format
 */
export function convertAnthropicMessageToInternal(message: AnthropicMessage): IAssistantMessage {
  return {
    id: message.id,
    type: 'message',
    role: 'assistant',
    model: message.model,
    content: convertContentFromAnthropic(message.content),
    stop_reason: message.stop_reason,
    stop_sequence: message.stop_sequence,
    usage: convertUsageFromAnthropic(message.usage)
  };
}

/**
 * Converts internal usage info to Anthropic usage format
 */
export function convertUsageToAnthropic(usage?: IUsageInfo): AnthropicUsage | undefined {
  if (!usage) return undefined;
  
  return {
    input_tokens: usage.input_tokens,
    cache_creation_input_tokens: usage.cache_creation_input_tokens,
    cache_read_input_tokens: usage.cache_read_input_tokens,
    output_tokens: usage.output_tokens,
    service_tier: usage.service_tier
  };
}

/**
 * Converts Anthropic usage to internal usage format
 */
export function convertUsageFromAnthropic(usage?: AnthropicUsage): IUsageInfo | undefined {
  if (!usage) return undefined;
  
  return {
    input_tokens: usage.input_tokens,
    cache_creation_input_tokens: usage.cache_creation_input_tokens,
    cache_read_input_tokens: usage.cache_read_input_tokens,
    output_tokens: usage.output_tokens,
    service_tier: usage.service_tier,
    server_tool_use: undefined // Not available in Anthropic format
  };
}

/**
 * Converts internal stop reason to Anthropic format
 */
function convertStopReason(stopReason?: string): AnthropicMessage['stop_reason'] {
  switch (stopReason) {
    case 'end_turn':
    case 'max_tokens':
    case 'stop_sequence':
    case 'tool_use':
      return stopReason;
    default:
      return undefined;
  }
}

/**
 * Type guard to check if a message is in Anthropic format
 */
export function isAnthropicMessage(message: any): message is AnthropicMessage {
  return message !== null &&
    message !== undefined &&
    typeof message === 'object' &&
    message.type === 'message' &&
    typeof message.id === 'string' &&
    message.role === 'assistant' &&
    typeof message.model === 'string' &&
    Array.isArray(message.content);
}

/**
 * Type guard to check if a message param is in Anthropic format
 */
export function isAnthropicMessageParam(param: any): param is AnthropicMessageParam {
  return param !== null &&
    param !== undefined &&
    typeof param === 'object' &&
    (param.role === 'user' || param.role === 'assistant') &&
    (typeof param.content === 'string' || Array.isArray(param.content));
}

/**
 * Converts message create params to internal format for processing
 */
export function convertAnthropicCreateParamsToInternal(params: AnthropicMessageCreateParams) {
  return {
    model: params.model,
    messages: params.messages.map(msg => convertAnthropicMessageParamToInternal(msg)),
    max_tokens: params.max_tokens,
    metadata: params.metadata,
    stop_sequences: params.stop_sequences,
    stream: params.stream,
    system: params.system,
    temperature: params.temperature,
    tool_choice: params.tool_choice,
    tools: params.tools,
    top_k: params.top_k,
    top_p: params.top_p
  };
}