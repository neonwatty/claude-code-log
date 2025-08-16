/**
 * Zod schemas for transcript entries - provides runtime validation for JSONL transcript data.
 */

import { z } from 'zod';
import { UserMessageSchema, AssistantMessageSchema, ToolUseResultSchema, timestampSchema } from './messages';

// Base transcript entry schema
export const BaseTranscriptEntrySchema = z.object({
  parentUuid: z.string().nullable().optional(),
  isSidechain: z.boolean(),
  userType: z.string(),
  cwd: z.string(),
  sessionId: z.string(),
  version: z.string(),
  uuid: z.string(),
  timestamp: timestampSchema,
  isMeta: z.boolean().optional(),
});

// User transcript entry schema
export const UserTranscriptEntrySchema = BaseTranscriptEntrySchema.extend({
  type: z.literal('user'),
  message: UserMessageSchema,
  toolUseResult: ToolUseResultSchema.optional(),
});

// Assistant transcript entry schema
export const AssistantTranscriptEntrySchema = BaseTranscriptEntrySchema.extend({
  type: z.literal('assistant'),
  message: AssistantMessageSchema,
  requestId: z.string().optional(),
});

// Summary transcript entry schema
export const SummaryTranscriptEntrySchema = z.object({
  type: z.literal('summary'),
  summary: z.string(),
  leafUuid: z.string(),
  cwd: z.string().optional(),
});

// System transcript entry schema
export const SystemTranscriptEntrySchema = BaseTranscriptEntrySchema.extend({
  type: z.literal('system'),
  content: z.string(),
  level: z.string().optional(), // 'warning', 'info', 'error'
});

// Discriminated union for all transcript entry types
export const TranscriptEntrySchema = z.discriminatedUnion('type', [
  UserTranscriptEntrySchema,
  AssistantTranscriptEntrySchema,
  SummaryTranscriptEntrySchema,
  SystemTranscriptEntrySchema,
]);

// Session and project schemas
export const SessionSchema = z.object({
  id: z.string(),
  entries: z.array(TranscriptEntrySchema),
  firstTimestamp: z.string(),
  lastTimestamp: z.string(),
  totalUsage: z.object({
    input_tokens: z.number().int().nonnegative().optional(),
    cache_creation_input_tokens: z.number().int().nonnegative().optional(),
    cache_read_input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional(),
    service_tier: z.string().optional(),
    server_tool_use: z.record(z.string(), z.any()).optional(),
  }),
  cwd: z.string(),
  summary: z.string().optional(),
});

export const ProjectSchema = z.object({
  name: z.string(),
  path: z.string(),
  sessions: z.array(SessionSchema),
  totalMessages: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

// API response schema
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
});

// Type inference helpers
export type ZodBaseTranscriptEntry = z.infer<typeof BaseTranscriptEntrySchema>;
export type ZodUserTranscriptEntry = z.infer<typeof UserTranscriptEntrySchema>;
export type ZodAssistantTranscriptEntry = z.infer<typeof AssistantTranscriptEntrySchema>;
export type ZodSummaryTranscriptEntry = z.infer<typeof SummaryTranscriptEntrySchema>;
export type ZodSystemTranscriptEntry = z.infer<typeof SystemTranscriptEntrySchema>;
export type ZodTranscriptEntry = z.infer<typeof TranscriptEntrySchema>;
export type ZodSession = z.infer<typeof SessionSchema>;
export type ZodProject = z.infer<typeof ProjectSchema>;
export type ZodApiResponse = z.infer<typeof ApiResponseSchema>;