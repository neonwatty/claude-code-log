// Constants and enums used across the application

export const MESSAGE_TYPES = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
  SUMMARY: "summary",
} as const;

export const CONTENT_TYPES = {
  TEXT: "text",
  TOOL_USE: "tool_use",
  TOOL_RESULT: "tool_result",
  THINKING: "thinking",
  IMAGE: "image",
} as const;

export const TODO_STATUSES = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;

export const TODO_PRIORITIES = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export const SYSTEM_LOG_LEVELS = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  DEBUG: "debug",
} as const;

// API endpoints configuration
export const API_ENDPOINTS = {
  SESSIONS: "/api/sessions",
  TRANSCRIPTS: "/api/transcripts",
  PROJECTS: "/api/projects",
  HEALTH: "/health",
} as const;

// Default pagination settings
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 50,
  MAX_LIMIT: 1000,
} as const;

// Token usage display formats
export const TOKEN_DISPLAY_FORMAT = {
  SHORT: "short", // "1.2K"
  FULL: "full", // "1,234"
  DETAILED: "detailed", // "Input: 1,234 | Output: 567"
} as const;

// Date formats used throughout the application
export const DATE_FORMATS = {
  ISO: "YYYY-MM-DDTHH:mm:ss.SSSZ",
  DISPLAY: "MMM D, YYYY HH:mm",
  SHORT: "MMM D",
  TIME_ONLY: "HH:mm:ss",
} as const;

// File size limits
export const FILE_LIMITS = {
  MAX_UPLOAD_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_CONTENT_LENGTH: 1000000, // 1M characters
} as const;

// Claude Code specific constants
export const CLAUDE_CONFIG = {
  PROJECT_PATH: "~/.claude/projects",
  SESSION_FILE_EXTENSION: ".jsonl",
  DEFAULT_PROJECT_NAME: "default",
} as const;
