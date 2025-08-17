// Tool conversion utilities between internal types and Anthropic SDK types

import { IToolUseContent, IToolResultContent } from '../interfaces';
import { 
  AnthropicTool,
  AnthropicToolChoice,
  AnthropicToolUseBlock,
  AnthropicToolUseBlockParam,
  AnthropicToolResultBlockParam,
  AnthropicToolChoiceAuto,
  AnthropicToolChoiceAny,
  AnthropicToolChoiceNone,
  AnthropicToolChoiceTool
} from './types';

/**
 * Converts internal tool use content to Anthropic tool use block
 */
export function convertToolUseToAnthropic(toolUse: IToolUseContent): AnthropicToolUseBlock {
  return {
    type: 'tool_use',
    id: toolUse.id,
    name: toolUse.name,
    input: toolUse.input
  };
}

/**
 * Converts internal tool use content to Anthropic tool use block param
 */
export function convertToolUseToAnthropicParam(toolUse: IToolUseContent): AnthropicToolUseBlockParam {
  return {
    type: 'tool_use',
    id: toolUse.id,
    name: toolUse.name,
    input: toolUse.input,
    cache_control: undefined
  };
}

/**
 * Converts internal tool result content to Anthropic tool result param
 */
export function convertToolResultToAnthropicParam(toolResult: IToolResultContent): AnthropicToolResultBlockParam {
  return {
    type: 'tool_result',
    tool_use_id: toolResult.tool_use_id,
    content: typeof toolResult.content === 'string' 
      ? toolResult.content 
      : JSON.stringify(toolResult.content),
    is_error: toolResult.is_error,
    cache_control: undefined
  };
}

/**
 * Converts Anthropic tool use block to internal tool use content
 */
export function convertAnthropicToolUseToInternal(toolUse: AnthropicToolUseBlock): IToolUseContent {
  return {
    type: 'tool_use',
    id: toolUse.id,
    name: toolUse.name,
    input: toolUse.input
  };
}

/**
 * Converts Anthropic tool result param to internal tool result content
 */
export function convertAnthropicToolResultToInternal(toolResult: AnthropicToolResultBlockParam): IToolResultContent {
  return {
    type: 'tool_result',
    tool_use_id: toolResult.tool_use_id,
    content: toolResult.content || '',
    is_error: toolResult.is_error
  };
}

/**
 * Creates an auto tool choice (model decides)
 */
export function createAutoToolChoice(): AnthropicToolChoiceAuto {
  return { type: 'auto' };
}

/**
 * Creates an any tool choice (model must use a tool)
 */
export function createAnyToolChoice(): AnthropicToolChoiceAny {
  return { type: 'any' };
}

/**
 * Creates a none tool choice (model cannot use tools)
 */
export function createNoneToolChoice(): AnthropicToolChoiceNone {
  return { type: 'none' };
}

/**
 * Creates a specific tool choice (model must use the specified tool)
 */
export function createSpecificToolChoice(toolName: string): AnthropicToolChoiceTool {
  return { 
    type: 'tool',
    name: toolName 
  };
}

/**
 * Creates an Anthropic tool definition
 */
export function createAnthropicTool(
  name: string,
  description: string,
  inputSchema: Record<string, any>,
  withCacheControl: boolean = false
): AnthropicTool {
  return {
    name,
    description,
    input_schema: inputSchema,
    cache_control: withCacheControl ? { type: 'ephemeral' } : undefined
  };
}

/**
 * Type guards for tool choice types
 */
export function isAutoToolChoice(choice: AnthropicToolChoice): choice is AnthropicToolChoiceAuto {
  return choice.type === 'auto';
}

export function isAnyToolChoice(choice: AnthropicToolChoice): choice is AnthropicToolChoiceAny {
  return choice.type === 'any';
}

export function isNoneToolChoice(choice: AnthropicToolChoice): choice is AnthropicToolChoiceNone {
  return choice.type === 'none';
}

export function isSpecificToolChoice(choice: AnthropicToolChoice): choice is AnthropicToolChoiceTool {
  return choice.type === 'tool';
}

/**
 * Type guards for tool use and result blocks
 */
export function isAnthropicToolUse(block: any): block is AnthropicToolUseBlock {
  return block && 
    block.type === 'tool_use' && 
    typeof block.id === 'string' && 
    typeof block.name === 'string' &&
    typeof block.input === 'object';
}

export function isAnthropicToolResult(param: any): param is AnthropicToolResultBlockParam {
  return param && 
    param.type === 'tool_result' && 
    typeof param.tool_use_id === 'string';
}

/**
 * Validates tool choice configuration
 */
export function validateToolChoice(choice: AnthropicToolChoice, availableTools: AnthropicTool[]): boolean {
  if (isSpecificToolChoice(choice)) {
    return availableTools.some(tool => tool.name === choice.name);
  }
  return true; // auto, any, none are always valid
}

/**
 * Extracts tool names from tool definitions
 */
export function getToolNames(tools: AnthropicTool[]): string[] {
  return tools.map(tool => tool.name);
}

/**
 * Finds a tool definition by name
 */
export function findToolByName(tools: AnthropicTool[], name: string): AnthropicTool | undefined {
  return tools.find(tool => tool.name === name);
}

/**
 * Creates a basic JSON schema for a tool with string parameters
 */
export function createBasicToolSchema(parameters: string[]): Record<string, any> {
  const properties: Record<string, any> = {};
  
  parameters.forEach(param => {
    properties[param] = {
      type: 'string',
      description: `The ${param} parameter`
    };
  });
  
  return {
    type: 'object',
    properties,
    required: parameters
  };
}

/**
 * Validates that a tool use input matches the tool schema
 */
export function validateToolInput(tool: AnthropicTool, input: Record<string, any>): boolean {
  const schema = tool.input_schema;
  if (!schema || !schema.required) return true;
  
  // Basic validation - check that all required fields are present
  const requiredFields = schema.required;
  return requiredFields.every((field: string) => Object.prototype.hasOwnProperty.call(input, field));
}