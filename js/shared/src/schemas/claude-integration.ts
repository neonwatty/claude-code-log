import { z } from 'zod';

/**
 * Claude Code CLI Integration Schema
 * Defines interfaces for Claude Code CLI process management and session continuation
 */

// Claude Code Process State
export const ClaudeProcessStateSchema = z.enum([
  'idle',
  'starting',
  'running',
  'stopping',
  'stopped',
  'error'
]);

export type ClaudeProcessState = z.infer<typeof ClaudeProcessStateSchema>;

// Allowed Claude Code commands (security whitelist)
export const ALLOWED_CLAUDE_COMMANDS = [
  '--continue-session',
  '--help',
  '--version',
  'help',
  'version',
] as const;

// Claude Code Command
export const ClaudeCommandSchema = z.object({
  command: z.enum(ALLOWED_CLAUDE_COMMANDS),
  args: z.array(z.string()).default([]),
  workingDirectory: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeout: z.number().positive().optional().default(30000), // 30 seconds default
});

export type ClaudeCommand = z.infer<typeof ClaudeCommandSchema>;

// Claude Code Process Status
export const ClaudeProcessStatusSchema = z.object({
  processId: z.string(),
  state: ClaudeProcessStateSchema,
  pid: z.number().optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  lastActivity: z.date().optional(),
  exitCode: z.number().optional(),
  signal: z.string().optional(),
  error: z.string().optional(),
});

export type ClaudeProcessStatus = z.infer<typeof ClaudeProcessStatusSchema>;

// Session Continuation Request
export const SessionContinuationRequestSchema = z.object({
  sessionId: z.string(),
  sessionPath: z.string().optional(), // Made optional since it can be auto-discovered
  command: z.string().optional(),
  workingDirectory: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export type SessionContinuationRequest = z.infer<typeof SessionContinuationRequestSchema>;

// Session Continuation Response
export const SessionContinuationResponseSchema = z.object({
  success: z.boolean(),
  processId: z.string(),
  message: z.string(),
  claudeProcessUrl: z.string().optional(),
  error: z.string().optional(),
});

export type SessionContinuationResponse = z.infer<typeof SessionContinuationResponseSchema>;

// Claude Code Output
export const ClaudeOutputSchema = z.object({
  processId: z.string(),
  type: z.enum(['stdout', 'stderr']),
  data: z.string(),
  timestamp: z.date(),
});

export type ClaudeOutput = z.infer<typeof ClaudeOutputSchema>;

// Process Event
export const ClaudeProcessEventSchema = z.object({
  processId: z.string(),
  event: z.enum(['start', 'data', 'error', 'exit', 'close']),
  data: z.any().optional(),
  timestamp: z.date(),
});

export type ClaudeProcessEvent = z.infer<typeof ClaudeProcessEventSchema>;

// Service Configuration
export const ClaudeIntegrationConfigSchema = z.object({
  claudeExecutablePath: z.string().default('claude'),
  maxProcesses: z.number().positive().default(5),
  processTimeout: z.number().positive().default(300000), // 5 minutes default
  outputBufferSize: z.number().positive().default(1024 * 1024), // 1MB default
  cleanupInterval: z.number().positive().default(60000), // 1 minute default
});

export type ClaudeIntegrationConfig = z.infer<typeof ClaudeIntegrationConfigSchema>;

// Error Types
export const ClaudeIntegrationErrorSchema = z.object({
  code: z.enum([
    'PROCESS_START_FAILED',
    'PROCESS_TIMEOUT',
    'PROCESS_NOT_FOUND',
    'INVALID_COMMAND',
    'SESSION_NOT_FOUND',
    'MAX_PROCESSES_REACHED',
    'INVALID_WORKING_DIRECTORY',
    'CLAUDE_NOT_INSTALLED'
  ]),
  message: z.string(),
  processId: z.string().optional(),
  details: z.any().optional(),
});

export type ClaudeIntegrationError = z.infer<typeof ClaudeIntegrationErrorSchema>;

// Session Context Schemas

// Session Context Data - extracted information from a session
export const SessionContextDataSchema = z.object({
  sessionId: z.string(),
  projectPath: z.string(),
  keyTopics: z.array(z.string()),
  codePatterns: z.object({
    modifiedFiles: z.array(z.string()),
    commonPatterns: z.array(z.string()),
  }),
  projectContext: z.object({
    projectType: z.string().nullable(),
    mainLanguages: z.array(z.string()),
    frameworks: z.array(z.string()),
    workingDirectory: z.string(),
  }),
  sessionStats: z.object({
    totalMessages: z.number(),
    userMessages: z.number(),
    assistantMessages: z.number(),
    toolUses: z.number(),
    totalTokens: z.number(),
    duration: z.number(),
    lastActivity: z.string(),
  }),
  conversationSummary: z.string(),
  recentContext: z.string(),
});

export type SessionContextData = z.infer<typeof SessionContextDataSchema>;

// Claude Context Configuration
export const ClaudeContextConfigSchema = z.object({
  workingDirectory: z.string().optional(),
  includeGuidelines: z.boolean().optional().default(true),
  additionalInstructions: z.string().optional(),
  maxContextFiles: z.number().optional().default(50),
  excludePatterns: z.array(z.string()).optional(),
});

export type ClaudeContextConfig = z.infer<typeof ClaudeContextConfigSchema>;

// Context Preparation Result
export const ContextPreparationResultSchema = z.object({
  success: z.boolean(),
  contextData: SessionContextDataSchema.optional(),
  claudeMdPath: z.string().optional(),
  claudeMdContent: z.string().optional(),
  workingDirectory: z.string().optional(),
  relevantFiles: z.array(z.string()).optional(),
  processingTimeMs: z.number().optional(),
  error: z.string().optional(),
});

export type ContextPreparationResult = z.infer<typeof ContextPreparationResultSchema>;

// Context Transfer Data
export const ContextTransferDataSchema = z.object({
  sessionId: z.string(),
  transferTime: z.string(),
  targetPath: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed']),
  error: z.string().optional(),
});

export type ContextTransferData = z.infer<typeof ContextTransferDataSchema>;

// Extended Session Continuation Request with context preparation
export const SessionContinuationWithContextRequestSchema = SessionContinuationRequestSchema.extend({
  prepareContext: z.boolean().optional().default(false),
  contextConfig: ClaudeContextConfigSchema.optional(),
  useExistingClaudeMd: z.boolean().optional().default(false),
});

export type SessionContinuationWithContextRequest = z.infer<typeof SessionContinuationWithContextRequestSchema>;

// Context Preparation Request
export const ContextPreparationRequestSchema = z.object({
  sessionId: z.string(),
  workingDirectory: z.string().optional(),
  config: ClaudeContextConfigSchema.optional(),
  generateOnly: z.boolean().optional().default(false), // Only generate CLAUDE.md, don't start process
});

export type ContextPreparationRequest = z.infer<typeof ContextPreparationRequestSchema>;