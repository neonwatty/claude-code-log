// Content block conversion utilities between internal types and Anthropic SDK types

import { IContentItem } from '../interfaces';
import { 
  AnthropicContentBlock, 
  AnthropicContentBlockParam,
  AnthropicTextBlock,
  AnthropicTextBlockParam,
  AnthropicImageBlockParam,
  AnthropicToolUseBlock,
  AnthropicToolUseBlockParam,
  AnthropicToolResultBlockParam,
  AnthropicThinkingBlock,
  AnthropicThinkingBlockParam,
  AnthropicCacheControl
} from './types';

/**
 * Converts internal content array to Anthropic content block format
 */
export function convertContentToAnthropic(content: IContentItem[]): AnthropicContentBlock[] {
  return content.map(convertContentItemToAnthropic).filter(Boolean) as AnthropicContentBlock[];
}

/**
 * Converts internal content array to Anthropic content block param format
 */
export function convertContentToAnthropicParam(content: IContentItem[]): AnthropicContentBlockParam[] {
  return content.map(convertContentItemToAnthropicParam).filter(Boolean) as AnthropicContentBlockParam[];
}

/**
 * Converts Anthropic content blocks to internal content format
 */
export function convertContentFromAnthropic(content: AnthropicContentBlock[]): IContentItem[] {
  return content.map(convertAnthropicContentToInternal);
}

/**
 * Converts Anthropic content block params to internal content format
 */
export function convertContentFromAnthropicParam(content: AnthropicContentBlockParam[]): IContentItem[] {
  return content.map(convertAnthropicContentParamToInternal);
}

/**
 * Converts a single internal content item to Anthropic content block
 */
export function convertContentItemToAnthropic(item: IContentItem): AnthropicContentBlock | null {
  switch (item.type) {
    case 'text':
      return {
        type: 'text',
        text: item.text
      } as AnthropicTextBlock;
      
    case 'tool_use':
      return {
        type: 'tool_use',
        id: item.id,
        name: item.name,
        input: item.input
      } as AnthropicToolUseBlock;
      
    case 'thinking':
      return {
        type: 'thinking',
        thinking: item.thinking
      } as AnthropicThinkingBlock;
      
    case 'tool_result':
    case 'image':
      // These types don't have direct Anthropic content block equivalents
      // They are only used in params
      return null;
      
    default:
      return null;
  }
}

/**
 * Converts a single internal content item to Anthropic content block param
 */
export function convertContentItemToAnthropicParam(item: IContentItem): AnthropicContentBlockParam | null {
  switch (item.type) {
    case 'text':
      return {
        type: 'text',
        text: item.text,
        cache_control: undefined // Can be added if needed
      } as AnthropicTextBlockParam;
      
    case 'tool_use':
      return {
        type: 'tool_use',
        id: item.id,
        name: item.name,
        input: item.input,
        cache_control: undefined
      } as AnthropicToolUseBlockParam;
      
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: item.tool_use_id,
        content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content),
        is_error: item.is_error,
        cache_control: undefined
      } as AnthropicToolResultBlockParam;
      
    case 'thinking':
      return {
        type: 'thinking',
        thinking: item.thinking,
        cache_control: undefined
      } as AnthropicThinkingBlockParam;
      
    case 'image':
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: item.source.media_type as any,
          data: item.source.data
        },
        cache_control: undefined
      } as AnthropicImageBlockParam;
      
    default:
      return null;
  }
}

/**
 * Converts Anthropic content block to internal content item
 */
export function convertAnthropicContentToInternal(block: AnthropicContentBlock): IContentItem {
  switch (block.type) {
    case 'text':
      return {
        type: 'text',
        text: block.text
      };
      
    case 'tool_use':
      return {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input
      };
      
    case 'thinking':
      return {
        type: 'thinking',
        thinking: block.thinking,
        signature: undefined // Not provided in Anthropic format
      };
      
    default:
      throw new Error(`Unsupported Anthropic content block type: ${(block as any).type}`);
  }
}

/**
 * Converts Anthropic content block param to internal content item
 */
export function convertAnthropicContentParamToInternal(param: AnthropicContentBlockParam): IContentItem {
  switch (param.type) {
    case 'text':
      return {
        type: 'text',
        text: param.text
      };
      
    case 'tool_use':
      return {
        type: 'tool_use',
        id: param.id,
        name: param.name,
        input: param.input
      };
      
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: param.tool_use_id,
        content: param.content || '',
        is_error: param.is_error
      };
      
    case 'thinking':
      return {
        type: 'thinking',
        thinking: param.thinking,
        signature: undefined
      };
      
    case 'image':
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: param.source.media_type,
          data: param.source.data
        }
      };
      
    default:
      throw new Error(`Unsupported Anthropic content param type: ${(param as any).type}`);
  }
}

/**
 * Type guards for Anthropic content types
 */
export function isAnthropicTextBlock(block: any): block is AnthropicTextBlock {
  return block !== null &&
    block !== undefined &&
    typeof block === 'object' &&
    block.type === 'text' && 
    typeof block.text === 'string';
}

export function isAnthropicToolUseBlock(block: any): block is AnthropicToolUseBlock {
  return block !== null &&
    block !== undefined &&
    typeof block === 'object' &&
    block.type === 'tool_use' && 
    typeof block.id === 'string' && 
    typeof block.name === 'string';
}

export function isAnthropicThinkingBlock(block: any): block is AnthropicThinkingBlock {
  return block !== null &&
    block !== undefined &&
    typeof block === 'object' &&
    block.type === 'thinking' && 
    typeof block.thinking === 'string';
}

/**
 * Creates cache control object for Anthropic content
 */
export function createCacheControl(): AnthropicCacheControl {
  return { type: 'ephemeral' };
}

/**
 * Adds cache control to content block param if not present
 */
export function addCacheControlToParam<T extends AnthropicContentBlockParam>(
  param: T, 
  addControl: boolean = false
): T {
  if (addControl && !param.cache_control) {
    return {
      ...param,
      cache_control: createCacheControl()
    };
  }
  return param;
}