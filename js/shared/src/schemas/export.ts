import { z } from "zod";
import { uuidSchema, timestampSchema } from "./messages";

// Export format schema
export const ExportFormatSchema = z.enum(["html", "markdown", "json", "pdf"]);
export type ZodExportFormat = z.infer<typeof ExportFormatSchema>;

// Export options schema
export const ExportOptionsSchema = z.object({
  format: ExportFormatSchema,
  includeMetadata: z.boolean().optional().default(true),
  includeThinking: z.boolean().optional().default(true),
  includeToolUse: z.boolean().optional().default(true),
  includeImages: z.boolean().optional().default(true),
  dateRange: z
    .object({
      startDate: timestampSchema.optional(),
      endDate: timestampSchema.optional(),
    })
    .optional(),
  messageTypes: z
    .array(z.enum(["user", "assistant", "summary", "system"]))
    .optional(),
  customTemplate: z.string().optional(),
  compressionLevel: z.number().min(0).max(9).optional().default(0),
});
export type ZodExportOptions = z.infer<typeof ExportOptionsSchema>;

// Export request schema
export const ExportRequestSchema = z
  .object({
    sessionId: uuidSchema.optional(),
    sessionIds: z.array(uuidSchema).optional(),
    messageIds: z.array(uuidSchema).optional(),
    projectName: z.string().optional(),
    options: ExportOptionsSchema,
  })
  .refine(
    (data) =>
      data.sessionId || 
      (data.sessionIds && data.sessionIds.length > 0) || 
      data.projectName,
    {
      message: "Must provide either sessionId, sessionIds, or projectName",
    }
  );
export type ZodExportRequest = z.infer<typeof ExportRequestSchema>;

// Export progress schema
export const ExportProgressSchema = z.object({
  stage: z.enum(["preparing", "processing", "generating", "streaming", "completed", "error"]),
  progress: z.number().min(0).max(100),
  currentItem: z.string().optional(),
  totalItems: z.number().optional(),
  processedItems: z.number().optional(),
  message: z.string().optional(),
  bytesProcessed: z.number().optional(),
  estimatedSize: z.number().optional(),
});
export type ZodExportProgress = z.infer<typeof ExportProgressSchema>;

// Export metadata schema
export const ExportMetadataSchema = z.object({
  sessionCount: z.number(),
  messageCount: z.number(),
  generatedAt: timestampSchema,
  processingTime: z.number(),
  options: ExportOptionsSchema,
});
export type ZodExportMetadata = z.infer<typeof ExportMetadataSchema>;

// Export result schema
export const ExportResultSchema = z.object({
  success: z.boolean(),
  exportId: uuidSchema,
  format: ExportFormatSchema,
  filename: z.string(),
  size: z.number(),
  url: z.string().optional(),
  downloadToken: z.string().optional(),
  expiresAt: timestampSchema.optional(),
  metadata: ExportMetadataSchema,
  error: z.string().optional(),
});
export type ZodExportResult = z.infer<typeof ExportResultSchema>;

// Export status schema
export const ExportStatusSchema = z.object({
  exportId: uuidSchema,
  status: z.enum(["pending", "processing", "completed", "failed", "expired"]),
  progress: ExportProgressSchema,
  result: ExportResultSchema.optional(),
  createdAt: timestampSchema,
  completedAt: timestampSchema.optional(),
  error: z.string().optional(),
});
export type ZodExportStatus = z.infer<typeof ExportStatusSchema>;

// Export metrics schema
export const ExportMetricsSchema = z.object({
  totalExports: z.number(),
  successfulExports: z.number(),
  failedExports: z.number(),
  averageProcessingTime: z.number(),
  totalDataExported: z.number(),
  activeExports: z.number(),
});
export type ZodExportMetrics = z.infer<typeof ExportMetricsSchema>;

// Download request schema
export const DownloadRequestSchema = z.object({
  exportId: uuidSchema,
  token: z.string(),
});
export type ZodDownloadRequest = z.infer<typeof DownloadRequestSchema>;

// Validation functions
export function validateExportOptions(data: unknown): ZodExportOptions {
  return ExportOptionsSchema.parse(data);
}

export function validateExportRequest(data: unknown): ZodExportRequest {
  return ExportRequestSchema.parse(data);
}

export function validateExportProgress(data: unknown): ZodExportProgress {
  return ExportProgressSchema.parse(data);
}

export function validateExportResult(data: unknown): ZodExportResult {
  return ExportResultSchema.parse(data);
}

export function validateExportStatus(data: unknown): ZodExportStatus {
  return ExportStatusSchema.parse(data);
}

export function validateDownloadRequest(data: unknown): ZodDownloadRequest {
  return DownloadRequestSchema.parse(data);
}

// Safe validation functions (returns validation result)
export function safeValidateExportRequest(data: unknown) {
  return ExportRequestSchema.safeParse(data);
}

export function safeValidateExportOptions(data: unknown) {
  return ExportOptionsSchema.safeParse(data);
}

export function safeValidateDownloadRequest(data: unknown) {
  return DownloadRequestSchema.safeParse(data);
}