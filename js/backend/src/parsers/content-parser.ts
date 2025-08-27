/**
 * Content parsing utilities for handling different message content types.
 * Provides functions to parse and validate content blocks in Claude transcript messages.
 */

import {
  IContentItem,
  ITextContent,
  IToolUseContent,
  IToolResultContent,
  IThinkingContent,
  IImageContent,
  IImageSource,
} from "../../../shared/src/interfaces";

/**
 * Parse a content item from raw JSON data.
 */
export function parseContentItem(itemData: any): IContentItem {
  if (!itemData || typeof itemData !== "object") {
    throw new Error("Content item must be an object");
  }

  const contentType = itemData.type;
  if (!contentType) {
    throw new Error("Content item missing type field");
  }

  switch (contentType) {
    case "text":
      return parseTextContent(itemData);
    case "tool_use":
      return parseToolUseContent(itemData);
    case "tool_result":
      return parseToolResultContent(itemData);
    case "thinking":
      return parseThinkingContent(itemData);
    case "image":
      return parseImageContent(itemData);
    default:
      // Fallback to text content for unknown types
      return {
        type: "text",
        text: String(itemData),
      } as ITextContent;
  }
}

/**
 * Parse text content item.
 */
export function parseTextContent(data: any): ITextContent {
  if (!data.text && data.text !== "") {
    throw new Error("Text content missing text field");
  }

  return {
    type: "text",
    text: String(data.text),
  };
}

/**
 * Parse tool use content item.
 */
export function parseToolUseContent(data: any): IToolUseContent {
  if (!data.id) {
    throw new Error("Tool use content missing id field");
  }
  if (!data.name) {
    throw new Error("Tool use content missing name field");
  }
  if (!data.input || typeof data.input !== "object") {
    throw new Error("Tool use content missing or invalid input field");
  }

  return {
    type: "tool_use",
    id: String(data.id),
    name: String(data.name),
    input: data.input,
  };
}

/**
 * Parse tool result content item.
 */
export function parseToolResultContent(data: any): IToolResultContent {
  if (!data.tool_use_id) {
    throw new Error("Tool result content missing tool_use_id field");
  }
  if (data.content === undefined || data.content === null) {
    throw new Error("Tool result content missing content field");
  }

  let content: string | Array<Record<string, any>>;
  if (typeof data.content === "string") {
    content = data.content;
  } else if (Array.isArray(data.content)) {
    content = data.content;
  } else {
    content = String(data.content);
  }

  return {
    type: "tool_result",
    tool_use_id: String(data.tool_use_id),
    content,
    is_error: data.is_error ? Boolean(data.is_error) : undefined,
  };
}

/**
 * Parse thinking content item.
 */
export function parseThinkingContent(data: any): IThinkingContent {
  if (!data.thinking && data.thinking !== "") {
    throw new Error("Thinking content missing thinking field");
  }

  return {
    type: "thinking",
    thinking: String(data.thinking),
    signature: data.signature ? String(data.signature) : undefined,
  };
}

/**
 * Parse image source.
 */
export function parseImageSource(data: any): IImageSource {
  if (!data.type || data.type !== "base64") {
    throw new Error('Image source must have type "base64"');
  }
  if (!data.media_type) {
    throw new Error("Image source missing media_type field");
  }
  if (!data.data) {
    throw new Error("Image source missing data field");
  }

  return {
    type: "base64",
    media_type: String(data.media_type),
    data: String(data.data),
  };
}

/**
 * Parse image content item.
 */
export function parseImageContent(data: any): IImageContent {
  if (!data.source || typeof data.source !== "object") {
    throw new Error("Image content missing or invalid source field");
  }

  return {
    type: "image",
    source: parseImageSource(data.source),
  };
}

/**
 * Parse message content, handling both string and array formats.
 */
export function parseMessageContent(contentData: any): string | IContentItem[] {
  if (typeof contentData === "string") {
    return contentData;
  }

  if (Array.isArray(contentData)) {
    return contentData.map(parseContentItem);
  }

  // Fallback to string representation
  return String(contentData);
}

/**
 * Type guard to check if content is a text content item.
 */
export function isTextContent(item: IContentItem): item is ITextContent {
  return item.type === "text";
}

/**
 * Type guard to check if content is a tool use content item.
 */
export function isToolUseContent(item: IContentItem): item is IToolUseContent {
  return item.type === "tool_use";
}

/**
 * Type guard to check if content is a tool result content item.
 */
export function isToolResultContent(
  item: IContentItem,
): item is IToolResultContent {
  return item.type === "tool_result";
}

/**
 * Type guard to check if content is a thinking content item.
 */
export function isThinkingContent(
  item: IContentItem,
): item is IThinkingContent {
  return item.type === "thinking";
}

/**
 * Type guard to check if content is an image content item.
 */
export function isImageContent(item: IContentItem): item is IImageContent {
  return item.type === "image";
}

/**
 * Extract all text from content items, filtering out non-text types.
 */
export function extractAllText(content: string | IContentItem[]): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const item of content) {
      if (isTextContent(item)) {
        textParts.push(item.text);
      }
      // Skip other content types for pure text extraction
    }
    return textParts.join("\n");
  }

  return "";
}

/**
 * Get summary of content types in a content array.
 */
export function getContentSummary(content: string | IContentItem[]): {
  totalItems: number;
  textItems: number;
  toolUseItems: number;
  toolResultItems: number;
  thinkingItems: number;
  imageItems: number;
  hasText: boolean;
} {
  if (typeof content === "string") {
    return {
      totalItems: 1,
      textItems: 1,
      toolUseItems: 0,
      toolResultItems: 0,
      thinkingItems: 0,
      imageItems: 0,
      hasText: content.length > 0,
    };
  }

  if (!Array.isArray(content)) {
    return {
      totalItems: 0,
      textItems: 0,
      toolUseItems: 0,
      toolResultItems: 0,
      thinkingItems: 0,
      imageItems: 0,
      hasText: false,
    };
  }

  const summary = {
    totalItems: content.length,
    textItems: 0,
    toolUseItems: 0,
    toolResultItems: 0,
    thinkingItems: 0,
    imageItems: 0,
    hasText: false,
  };

  for (const item of content) {
    switch (item.type) {
      case "text":
        summary.textItems++;
        if ((item as ITextContent).text.length > 0) {
          summary.hasText = true;
        }
        break;
      case "tool_use":
        summary.toolUseItems++;
        break;
      case "tool_result":
        summary.toolResultItems++;
        break;
      case "thinking":
        summary.thinkingItems++;
        break;
      case "image":
        summary.imageItems++;
        break;
    }
  }

  return summary;
}
