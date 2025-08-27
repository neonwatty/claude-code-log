/**
 * Zod schemas for content types - provides runtime validation for content blocks.
 */

import { z } from "zod";

// Base content schema with discriminated unions
export const TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const ToolUseContentSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.any()),
});

export const ToolResultContentSchema = z.object({
  type: z.literal("tool_result"),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.record(z.string(), z.any()))]),
  is_error: z.boolean().optional(),
});

export const ThinkingContentSchema = z.object({
  type: z.literal("thinking"),
  thinking: z.string(),
  signature: z.string().optional(),
});

export const ImageSourceSchema = z.object({
  type: z.literal("base64"),
  media_type: z.string(),
  data: z.string(),
});

export const ImageContentSchema = z.object({
  type: z.literal("image"),
  source: ImageSourceSchema,
});

// Discriminated union for all content types
export const ContentItemSchema = z.discriminatedUnion("type", [
  TextContentSchema,
  ToolUseContentSchema,
  ToolResultContentSchema,
  ThinkingContentSchema,
  ImageContentSchema,
]);

// Type inference helpers
export type ZodTextContent = z.infer<typeof TextContentSchema>;
export type ZodToolUseContent = z.infer<typeof ToolUseContentSchema>;
export type ZodToolResultContent = z.infer<typeof ToolResultContentSchema>;
export type ZodThinkingContent = z.infer<typeof ThinkingContentSchema>;
export type ZodImageContent = z.infer<typeof ImageContentSchema>;
export type ZodContentItem = z.infer<typeof ContentItemSchema>;
