import { z } from 'zod';

// Content Type Schemas
export const TextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const ToolUseContentSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.any()),
});

export const ToolResultContentSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.record(z.any()))]),
  is_error: z.boolean().optional(),
});

export const ThinkingContentSchema = z.object({
  type: z.literal('thinking'),
  thinking: z.string(),
  signature: z.string().optional(),
});

export const ImageSourceSchema = z.object({
  type: z.literal('base64'),
  media_type: z.string(),
  data: z.string(),
});

export const ImageContentSchema = z.object({
  type: z.literal('image'),
  source: ImageSourceSchema,
});

export const ContentItemSchema = z.discriminatedUnion('type', [
  TextContentSchema,
  ToolUseContentSchema,
  ToolResultContentSchema,
  ThinkingContentSchema,
  ImageContentSchema,
]);

// Usage and Analytics Schemas
export const UsageInfoSchema = z.object({
  input_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  service_tier: z.string().optional(),
  server_tool_use: z.record(z.any()).optional(),
});

// Message Schemas
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

// File and Tool Result Schemas
export const FileInfoSchema = z.object({
  filePath: z.string(),
  content: z.string(),
  numLines: z.number(),
  startLine: z.number(),
  totalLines: z.number(),
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

export const TodoItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['high', 'medium', 'low']),
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

// Transcript Entry Schemas
export const BaseTranscriptEntrySchema = z.object({
  parentUuid: z.string().nullable().optional(),
  isSidechain: z.boolean(),
  userType: z.string(),
  cwd: z.string(),
  sessionId: z.string(),
  version: z.string(),
  uuid: z.string(),
  timestamp: z.string(),
  isMeta: z.boolean().optional(),
});

export const UserTranscriptEntrySchema = BaseTranscriptEntrySchema.extend({
  type: z.literal('user'),
  message: UserMessageSchema,
  toolUseResult: ToolUseResultSchema.optional(),
});

export const AssistantTranscriptEntrySchema = BaseTranscriptEntrySchema.extend({
  type: z.literal('assistant'),
  message: AssistantMessageSchema,
  requestId: z.string().optional(),
});

export const SummaryTranscriptEntrySchema = z.object({
  type: z.literal('summary'),
  summary: z.string(),
  leafUuid: z.string(),
  cwd: z.string().optional(),
});

export const SystemTranscriptEntrySchema = BaseTranscriptEntrySchema.extend({
  type: z.literal('system'),
  content: z.string(),
  level: z.string().optional(),
});

export const TranscriptEntrySchema = z.discriminatedUnion('type', [
  UserTranscriptEntrySchema,
  AssistantTranscriptEntrySchema,
  SummaryTranscriptEntrySchema,
  SystemTranscriptEntrySchema,
]);

// Validation Functions
export function validateTranscriptEntry(data: unknown) {
  return TranscriptEntrySchema.safeParse(data);
}

export function validateContentItem(data: unknown) {
  return ContentItemSchema.safeParse(data);
}

export function validateUsageInfo(data: unknown) {
  return UsageInfoSchema.safeParse(data);
}

// Type Guards
export function isTranscriptEntry(data: unknown): data is z.infer<typeof TranscriptEntrySchema> {
  return TranscriptEntrySchema.safeParse(data).success;
}

export function isUserTranscriptEntry(data: unknown): data is z.infer<typeof UserTranscriptEntrySchema> {
  return UserTranscriptEntrySchema.safeParse(data).success;
}

export function isAssistantTranscriptEntry(data: unknown): data is z.infer<typeof AssistantTranscriptEntrySchema> {
  return AssistantTranscriptEntrySchema.safeParse(data).success;
}

export function isContentItem(data: unknown): data is z.infer<typeof ContentItemSchema> {
  return ContentItemSchema.safeParse(data).success;
}