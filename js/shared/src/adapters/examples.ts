// Example usage of Anthropic SDK compatibility adapters

import { IUserMessage, IAssistantMessage, IContentItem } from "../interfaces";

import {
  AnthropicMessageCreateParams,
  AnthropicMessage,
  AnthropicTool,
} from "./types";

import {
  convertUserMessageToAnthropic,
  convertAssistantMessageToAnthropic,
  convertAnthropicMessageToInternal,
  convertAnthropicCreateParamsToInternal,
} from "./anthropic-message-adapter";

import {
  convertContentToAnthropicParam,
  convertContentFromAnthropicParam,
} from "./anthropic-content-adapter";

import {
  createAnthropicTool,
  createAutoToolChoice,
  createSpecificToolChoice,
  validateToolChoice,
} from "./anthropic-tool-adapter";

/**
 * Example: Converting internal messages to Anthropic format for API calls
 */
export function exampleConvertToAnthropicAPI() {
  // Create an internal user message
  const userMessage: IUserMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text: "Hello, can you help me search for information about TypeScript?",
      },
      {
        type: "tool_use",
        id: "tool_search_123",
        name: "web_search",
        input: { query: "TypeScript programming language" },
      },
    ],
  };

  // Convert to Anthropic format for API call
  const anthropicParam = convertUserMessageToAnthropic(userMessage);

  console.log("Converted to Anthropic MessageParam:", anthropicParam);

  return anthropicParam;
}

/**
 * Example: Converting Anthropic API response back to internal format
 */
export function exampleConvertFromAnthropicAPI() {
  // Simulated Anthropic API response
  const anthropicResponse: AnthropicMessage = {
    id: "msg_01234567890",
    type: "message",
    role: "assistant",
    model: "claude-3-5-sonnet-20241022",
    content: [
      {
        type: "text",
        text: "I'll help you search for information about TypeScript. Let me search for that now.",
      },
      {
        type: "tool_use",
        id: "tool_search_456",
        name: "web_search",
        input: { query: "TypeScript programming language features" },
      },
    ],
    stop_reason: "tool_use",
    usage: {
      input_tokens: 150,
      output_tokens: 75,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 20,
    },
  };

  // Convert back to internal format
  const internalMessage = convertAnthropicMessageToInternal(anthropicResponse);

  console.log("Converted to internal format:", internalMessage);

  return internalMessage;
}

/**
 * Example: Creating tool definitions and choices
 */
export function exampleToolConfiguration() {
  // Create tool definitions
  const searchTool = createAnthropicTool(
    "web_search",
    "Search for information on the web",
    {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to execute",
        },
        num_results: {
          type: "number",
          description: "Number of results to return (optional)",
          default: 5,
        },
      },
      required: ["query"],
    },
  );

  const calculatorTool = createAnthropicTool(
    "calculator",
    "Perform mathematical calculations",
    {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Mathematical expression to evaluate",
        },
      },
      required: ["expression"],
    },
  );

  const tools: AnthropicTool[] = [searchTool, calculatorTool];

  // Create different tool choice strategies
  const autoChoice = createAutoToolChoice(); // Model decides
  const specificChoice = createSpecificToolChoice("web_search"); // Must use search

  // Validate tool choices
  const isValidAuto = validateToolChoice(autoChoice, tools);
  const isValidSpecific = validateToolChoice(specificChoice, tools);

  console.log("Tool configuration example:", {
    tools,
    choices: { autoChoice, specificChoice },
    validation: { isValidAuto, isValidSpecific },
  });

  return { tools, autoChoice, specificChoice };
}

/**
 * Example: Full API request preparation
 */
export function examplePrepareAnthropicRequest() {
  const { tools, autoChoice } = exampleToolConfiguration();

  // Prepare a complete Anthropic API request
  const requestParams: AnthropicMessageCreateParams = {
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content:
          "Can you search for the latest news about AI and then calculate the percentage growth mentioned in the articles?",
      },
    ],
    tools,
    tool_choice: autoChoice,
    temperature: 0.7,
    system:
      "You are a helpful assistant that can search the web and perform calculations.",
  };

  console.log("Prepared Anthropic API request:", requestParams);

  // Convert back to internal format if needed for processing
  const internalParams = convertAnthropicCreateParamsToInternal(requestParams);

  return { requestParams, internalParams };
}

/**
 * Example: Handling mixed content with images and tools
 */
export function exampleMixedContent() {
  const mixedContent: IContentItem[] = [
    {
      type: "text",
      text: "Here is an image and I want to analyze it:",
    },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      },
    },
    {
      type: "tool_result",
      tool_use_id: "tool_previous_123",
      content: "Analysis complete: The image shows a 1x1 red pixel.",
      is_error: false,
    },
    {
      type: "thinking",
      thinking:
        "I need to process this image analysis result and provide a summary.",
      signature: "analysis_sig_456",
    },
  ];

  // Convert to Anthropic format (suitable for message params)
  const anthropicContent = convertContentToAnthropicParam(mixedContent);

  // Convert back to internal format
  const backToInternal = convertContentFromAnthropicParam(anthropicContent);

  console.log("Mixed content conversion example:", {
    original: mixedContent,
    anthropic: anthropicContent,
    converted: backToInternal,
  });

  return { mixedContent, anthropicContent, backToInternal };
}

/**
 * Example: Backward compatibility with existing code
 */
export function exampleBackwardCompatibility() {
  // Existing internal message format
  const existingMessage: IAssistantMessage = {
    id: "legacy_msg_123",
    type: "message",
    role: "assistant",
    model: "claude-3-5-sonnet-20241022",
    content: [
      {
        type: "text",
        text: "This message was created with the internal format.",
      },
    ],
    usage: {
      input_tokens: 25,
      output_tokens: 15,
      server_tool_use: { legacy_data: "preserved" },
    },
  };

  // Convert to Anthropic format for API compatibility
  const anthropicMessage = convertAssistantMessageToAnthropic(existingMessage);

  // Convert back to internal format
  const backToInternal = convertAnthropicMessageToInternal(anthropicMessage);

  console.log("Backward compatibility example:", {
    original: existingMessage,
    anthropic: anthropicMessage,
    converted: backToInternal,
    preservedData: backToInternal.usage?.server_tool_use, // Note: this will be undefined due to format differences
  });

  return { existingMessage, anthropicMessage, backToInternal };
}
