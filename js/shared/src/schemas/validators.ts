/**
 * Validation utilities and functions for runtime type checking.
 * Provides convenient validation functions with detailed error reporting.
 */

import { z } from "zod";
import {
  ContentItemSchema,
  TranscriptEntrySchema,
  UserTranscriptEntrySchema,
  AssistantTranscriptEntrySchema,
  SummaryTranscriptEntrySchema,
  SystemTranscriptEntrySchema,
  SessionSchema,
  ProjectSchema,
  UsageInfoSchema,
  TodoItemSchema,
} from "./index";

// Validation result types
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export interface ValidationOptions {
  strict?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

/**
 * Generic validation function with detailed error reporting.
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options: ValidationOptions = {},
): ValidationResult<T> {
  const { strict = true, stripUnknown = false, abortEarly = false } = options;

  try {
    let processedSchema = schema;

    if (stripUnknown && schema instanceof z.ZodObject) {
      processedSchema = schema.strip() as z.ZodSchema<T>;
    } else if (strict && schema instanceof z.ZodObject) {
      processedSchema = schema.strict() as z.ZodSchema<T>;
    }

    const result = processedSchema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      const errors = result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? ` at ${issue.path.join(".")}` : "";
        return `${issue.message}${path}`;
      });
      return {
        success: false,
        errors: abortEarly ? [errors[0]] : errors,
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [
        `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

/**
 * Validate content item with detailed error reporting.
 */
export function validateContentItem(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<z.infer<typeof ContentItemSchema>> {
  return validateData(ContentItemSchema, data, options);
}

/**
 * Validate transcript entry with type-specific validation.
 */
export function validateTranscriptEntry(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<z.infer<typeof TranscriptEntrySchema>> {
  return validateData(TranscriptEntrySchema, data, options);
}

/**
 * Validate user transcript entry.
 */
export function validateUserTranscriptEntry(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<z.infer<typeof UserTranscriptEntrySchema>> {
  return validateData(UserTranscriptEntrySchema, data, options);
}

/**
 * Validate assistant transcript entry.
 */
export function validateAssistantTranscriptEntry(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<z.infer<typeof AssistantTranscriptEntrySchema>> {
  return validateData(AssistantTranscriptEntrySchema, data, options);
}

/**
 * Validate summary transcript entry.
 */
export function validateSummaryTranscriptEntry(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<z.infer<typeof SummaryTranscriptEntrySchema>> {
  return validateData(SummaryTranscriptEntrySchema, data, options);
}

/**
 * Validate system transcript entry.
 */
export function validateSystemTranscriptEntry(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<z.infer<typeof SystemTranscriptEntrySchema>> {
  return validateData(SystemTranscriptEntrySchema, data, options);
}

/**
 * Validate session data.
 */
export function validateSession(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<z.infer<typeof SessionSchema>> {
  return validateData(SessionSchema, data, options);
}

/**
 * Validate project data.
 */
export function validateProject(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<z.infer<typeof ProjectSchema>> {
  return validateData(ProjectSchema, data, options);
}

/**
 * Validate usage info.
 */
export function validateUsageInfo(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<z.infer<typeof UsageInfoSchema>> {
  return validateData(UsageInfoSchema, data, options);
}

/**
 * Validate todo item.
 */
export function validateTodoItem(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<z.infer<typeof TodoItemSchema>> {
  return validateData(TodoItemSchema, data, options);
}

/**
 * Validate array of transcript entries.
 */
export function validateTranscriptEntries(
  data: unknown,
  options?: ValidationOptions,
): ValidationResult<z.infer<typeof TranscriptEntrySchema>[]> {
  return validateData(z.array(TranscriptEntrySchema), data, options);
}

/**
 * Batch validation function for multiple entries.
 */
export function validateBatch<T>(
  schema: z.ZodSchema<T>,
  dataArray: unknown[],
  options?: ValidationOptions,
): {
  validEntries: T[];
  invalidEntries: Array<{ index: number; data: unknown; errors: string[] }>;
} {
  const validEntries: T[] = [];
  const invalidEntries: Array<{
    index: number;
    data: unknown;
    errors: string[];
  }> = [];

  dataArray.forEach((item, index) => {
    const result = validateData(schema, item, options);
    if (result.success && result.data) {
      validEntries.push(result.data);
    } else {
      invalidEntries.push({
        index,
        data: item,
        errors: result.errors || ["Unknown validation error"],
      });
    }
  });

  return { validEntries, invalidEntries };
}

/**
 * Create a validation middleware function for Express.js.
 */
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    const result = validateData(schema, req.body);
    if (result.success) {
      req.validatedData = result.data;
      next();
    } else {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: result.errors,
      });
    }
  };
}

/**
 * Performance-optimized validation for production use.
 */
export function fastValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): T | null {
  try {
    return schema.parse(data);
  } catch {
    return null;
  }
}

/**
 * Check if data matches schema without detailed errors (for performance).
 */
export function isValid<T>(schema: z.ZodSchema<T>, data: unknown): data is T {
  return schema.safeParse(data).success;
}
