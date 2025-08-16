// Anthropic SDK compatible types - based on official SDK types

export interface AnthropicMessageParam {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlockParam[];
}

export interface AnthropicMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: AnthropicContentBlock[];
  stop_reason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage?: AnthropicUsage;
}

export interface AnthropicUsage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  service_tier?: string;
}

// Content block types
export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicTextBlockParam {
  type: 'text';
  text: string;
  cache_control?: AnthropicCacheControl;
}

export interface AnthropicImageBlockParam {
  type: 'image';
  source: AnthropicImageSource;
  cache_control?: AnthropicCacheControl;
}

export interface AnthropicImageSource {
  type: 'base64';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface AnthropicToolUseBlockParam {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
  cache_control?: AnthropicCacheControl;
}

export interface AnthropicToolResultBlockParam {
  type: 'tool_result';
  tool_use_id: string;
  content?: string | Array<AnthropicContentBlockParam>;
  is_error?: boolean;
  cache_control?: AnthropicCacheControl;
}

export interface AnthropicThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export interface AnthropicThinkingBlockParam {
  type: 'thinking';
  thinking: string;
  cache_control?: AnthropicCacheControl;
}

export interface AnthropicCacheControl {
  type: 'ephemeral';
}

export type AnthropicContentBlock = 
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicThinkingBlock;

export type AnthropicContentBlockParam = 
  | AnthropicTextBlockParam
  | AnthropicImageBlockParam
  | AnthropicToolUseBlockParam
  | AnthropicToolResultBlockParam
  | AnthropicThinkingBlockParam;

// Tool choice types
export interface AnthropicToolChoiceAuto {
  type: 'auto';
}

export interface AnthropicToolChoiceAny {
  type: 'any';
}

export interface AnthropicToolChoiceNone {
  type: 'none';
}

export interface AnthropicToolChoiceTool {
  type: 'tool';
  name: string;
}

export type AnthropicToolChoice = 
  | AnthropicToolChoiceAuto
  | AnthropicToolChoiceAny
  | AnthropicToolChoiceNone
  | AnthropicToolChoiceTool;

// Tool definition types
export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, any>;
  cache_control?: AnthropicCacheControl;
}

// Message creation parameters
export interface AnthropicMessageCreateParams {
  model: string;
  messages: AnthropicMessageParam[];
  max_tokens: number;
  metadata?: Record<string, any>;
  stop_sequences?: string[];
  stream?: boolean;
  system?: string | AnthropicContentBlockParam[];
  temperature?: number;
  tool_choice?: AnthropicToolChoice;
  tools?: AnthropicTool[];
  top_k?: number;
  top_p?: number;
}

// Response types
export interface AnthropicApiResponse<T = any> {
  data?: T;
  error?: AnthropicApiError;
}

export interface AnthropicApiError {
  type: string;
  message: string;
  details?: Record<string, any>;
}