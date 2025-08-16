/**
 * Zod schemas for message types - provides runtime validation for user and assistant messages.
 */

import { z } from 'zod';
import { ContentItemSchema } from './content';

// Custom validators
export const timestampSchema = z.string().refine(
  (val) => {
    try {
      const date = new Date(val);
      return !isNaN(date.getTime());
    } catch {
      return false;
    }
  },
  { message: 'Invalid timestamp format' }
);

export const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Invalid UUID format'
);

// Usage info schema
export const UsageInfoSchema = z.object({
  input_tokens: z.number().int().nonnegative().optional(),
  cache_creation_input_tokens: z.number().int().nonnegative().optional(),
  cache_read_input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  service_tier: z.string().optional(),
  server_tool_use: z.record(z.string(), z.any()).optional(),
});

// Todo item schema
export const TodoItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['high', 'medium', 'low']),
});

// Message schemas
export const UserMessageSchema = z.object({
  role: z.literal('user'),
  content: z.union([z.string(), z.array(ContentItemSchema)]),
});

export const AssistantMessageSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  model: z.string(),
  content: z.array(ContentItemSchema),
  stop_reason: z.string().optional(),
  stop_sequence: z.string().optional(),
  usage: UsageInfoSchema.optional(),
});

// File and command result schemas
export const FileInfoSchema = z.object({
  filePath: z.string(),
  content: z.string(),
  numLines: z.number().int().nonnegative(),
  startLine: z.number().int().nonnegative(),
  totalLines: z.number().int().nonnegative(),
});

export const FileReadResultSchema = z.object({
  type: z.literal('text'),
  file: FileInfoSchema,
});

export const CommandResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  interrupted: z.boolean(),
  isImage: z.boolean(),
});

export const TodoResultSchema = z.object({
  oldTodos: z.array(TodoItemSchema),
  newTodos: z.array(TodoItemSchema),
});

export const EditResultSchema = z.object({
  oldString: z.string().optional(),
  newString: z.string().optional(),
  replaceAll: z.boolean().optional(),
  originalFile: z.string().optional(),
  structuredPatch: z.any().optional(),
  userModified: z.boolean().optional(),
});

export const ToolUseResultSchema = z.union([
  z.string(),
  z.array(TodoItemSchema),
  FileReadResultSchema,
  CommandResultSchema,
  TodoResultSchema,
  EditResultSchema,
  z.array(ContentItemSchema),
]);

// Type inference helpers
export type ZodUsageInfo = z.infer<typeof UsageInfoSchema>;
export type ZodTodoItem = z.infer<typeof TodoItemSchema>;
export type ZodUserMessage = z.infer<typeof UserMessageSchema>;
export type ZodAssistantMessage = z.infer<typeof AssistantMessageSchema>;
export type ZodFileInfo = z.infer<typeof FileInfoSchema>;
export type ZodFileReadResult = z.infer<typeof FileReadResultSchema>;
export type ZodCommandResult = z.infer<typeof CommandResultSchema>;
export type ZodTodoResult = z.infer<typeof TodoResultSchema>;
export type ZodEditResult = z.infer<typeof EditResultSchema>;
export type ZodToolUseResult = z.infer<typeof ToolUseResultSchema>;