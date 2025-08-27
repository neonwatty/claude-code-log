/**
 * Tests for JSONL parser functionality.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  parseJsonlLine,
  parseTranscriptEntry,
  extractTextContent,
  parseTimestamp,
  loadTranscript,
  findJsonlFiles,
} from "../parsers/jsonl-parser";
import { ITextContent } from "../../../shared/src/interfaces";

describe("JSONL Parser", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jsonl-parser-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("parseTimestamp", () => {
    test("should parse ISO timestamp with Z suffix", () => {
      const timestamp = "2025-01-15T10:30:00.000Z";
      const result = parseTimestamp(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(timestamp);
    });

    test("should parse ISO timestamp with explicit timezone", () => {
      const timestamp = "2025-01-15T10:30:00.000+00:00";
      const result = parseTimestamp(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-01-15T10:30:00.000Z");
    });

    test("should return null for invalid timestamp", () => {
      const result = parseTimestamp("invalid-timestamp");
      expect(result).toBeNull();
    });
  });

  describe("extractTextContent", () => {
    test("should extract text from string content", () => {
      const content = "Hello, world!";
      const result = extractTextContent(content);
      expect(result).toBe("Hello, world!");
    });

    test("should extract text from array content", () => {
      const content: ITextContent[] = [
        { type: "text", text: "First part" },
        { type: "text", text: "Second part" },
      ];
      const result = extractTextContent(content);
      expect(result).toBe("First part\nSecond part");
    });

    test("should skip thinking content", () => {
      const content = [
        { type: "text", text: "Visible text" } as ITextContent,
        { type: "thinking", thinking: "Hidden thinking" } as any,
        { type: "text", text: "More visible text" } as ITextContent,
      ];
      const result = extractTextContent(content);
      expect(result).toBe("Visible text\nMore visible text");
    });

    test("should handle null/undefined content", () => {
      expect(extractTextContent(null)).toBe("");
      expect(extractTextContent(undefined)).toBe("");
    });
  });

  describe("parseTranscriptEntry", () => {
    test("should parse user transcript entry", () => {
      const data = {
        type: "user",
        uuid: "user-uuid-123",
        timestamp: "2025-01-15T10:30:00.000Z",
        sessionId: "session-123",
        parentUuid: null,
        isSidechain: false,
        userType: "human",
        cwd: "/test/path",
        version: "1.0.0",
        message: {
          role: "user",
          content: "Hello, Claude!",
        },
      };

      const result = parseTranscriptEntry(data);
      expect(result.type).toBe("user");
      if ("uuid" in result) {
        expect(result.uuid).toBe("user-uuid-123");
      }
      if ("sessionId" in result) {
        expect(result.sessionId).toBe("session-123");
      }
    });

    test("should parse assistant transcript entry", () => {
      const data = {
        type: "assistant",
        uuid: "assistant-uuid-123",
        timestamp: "2025-01-15T10:30:00.000Z",
        sessionId: "session-123",
        parentUuid: "user-uuid-123",
        isSidechain: false,
        userType: "assistant",
        cwd: "/test/path",
        version: "1.0.0",
        message: {
          id: "msg-123",
          type: "message",
          role: "assistant",
          model: "claude-3-sonnet",
          content: [{ type: "text", text: "Hello! How can I help you today?" }],
        },
      };

      const result = parseTranscriptEntry(data);
      expect(result.type).toBe("assistant");
      if ("uuid" in result) {
        expect(result.uuid).toBe("assistant-uuid-123");
      }
    });

    test("should parse summary transcript entry", () => {
      const data = {
        type: "summary",
        summary: "User asked for help with TypeScript",
        leafUuid: "assistant-uuid-123",
        cwd: "/test/path",
      };

      const result = parseTranscriptEntry(data);
      expect(result.type).toBe("summary");
      if (result.type === "summary") {
        expect(result.summary).toBe("User asked for help with TypeScript");
        expect(result.leafUuid).toBe("assistant-uuid-123");
      }
    });

    test("should throw error for unknown entry type", () => {
      const data = {
        type: "unknown",
        uuid: "test-uuid",
      };

      expect(() => parseTranscriptEntry(data)).toThrow(
        "Unknown transcript entry type: unknown",
      );
    });

    test("should throw error for missing required fields", () => {
      const data = {
        type: "user",
        // missing uuid, timestamp, sessionId
      };

      expect(() => parseTranscriptEntry(data)).toThrow(
        "Entry missing required fields",
      );
    });
  });

  describe("parseJsonlLine", () => {
    test("should parse valid JSONL line", () => {
      const line = JSON.stringify({
        type: "user",
        uuid: "test-uuid",
        timestamp: "2025-01-15T10:30:00.000Z",
        sessionId: "session-123",
        parentUuid: null,
        isSidechain: false,
        userType: "human",
        cwd: "/test/path",
        version: "1.0.0",
        message: {
          role: "user",
          content: "Test message",
        },
      });

      const result = parseJsonlLine(line, 1);
      expect(result).toHaveProperty("type", "user");
      expect(result).toHaveProperty("uuid", "test-uuid");
    });

    test("should return error for invalid JSON", () => {
      const line = "{ invalid json }";
      const result = parseJsonlLine(line, 1);

      expect(result).toHaveProperty("lineNumber", 1);
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("line");
    });

    test("should return error for empty line", () => {
      const result = parseJsonlLine("   ", 1);

      expect(result).toHaveProperty("lineNumber", 1);
      expect(result).toHaveProperty("error", "Empty line");
    });
  });

  describe("file operations", () => {
    test("should find JSONL files in directory", () => {
      // Create test files
      fs.writeFileSync(path.join(tempDir, "transcript1.jsonl"), "");
      fs.writeFileSync(path.join(tempDir, "transcript2.jsonl"), "");
      fs.writeFileSync(path.join(tempDir, "compressed.jsonl.gz"), "");
      fs.writeFileSync(path.join(tempDir, "not-jsonl.txt"), "");

      const files = findJsonlFiles(tempDir);

      expect(files).toHaveLength(3);
      expect(files).toContain(path.join(tempDir, "transcript1.jsonl"));
      expect(files).toContain(path.join(tempDir, "transcript2.jsonl"));
      expect(files).toContain(path.join(tempDir, "compressed.jsonl.gz"));
      expect(files).not.toContain(path.join(tempDir, "not-jsonl.txt"));
    });

    test("should load transcript from file", () => {
      const content = [
        JSON.stringify({
          type: "user",
          uuid: "user-1",
          timestamp: "2025-01-15T10:30:00.000Z",
          sessionId: "session-123",
          parentUuid: null,
          isSidechain: false,
          userType: "human",
          cwd: "/test",
          version: "1.0.0",
          message: { role: "user", content: "Hello" },
        }),
        JSON.stringify({
          type: "assistant",
          uuid: "assistant-1",
          timestamp: "2025-01-15T10:31:00.000Z",
          sessionId: "session-123",
          parentUuid: "user-1",
          isSidechain: false,
          userType: "assistant",
          cwd: "/test",
          version: "1.0.0",
          message: {
            id: "msg-1",
            type: "message",
            role: "assistant",
            model: "claude-3-sonnet",
            content: [{ type: "text", text: "Hi there!" }],
          },
        }),
      ].join("\n");

      const filePath = path.join(tempDir, "test.jsonl");
      fs.writeFileSync(filePath, content);

      const result = loadTranscript(filePath, { silent: true });

      expect(result.entries).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.entries[0].type).toBe("user");
      expect(result.entries[1].type).toBe("assistant");
    });

    test("should handle malformed lines gracefully", () => {
      const content = [
        JSON.stringify({
          type: "user",
          uuid: "user-1",
          timestamp: "2025-01-15T10:30:00.000Z",
          sessionId: "session-123",
          parentUuid: null,
          isSidechain: false,
          userType: "human",
          cwd: "/test",
          version: "1.0.0",
          message: { role: "user", content: "Hello" },
        }),
        "{ invalid json }",
        JSON.stringify({
          type: "assistant",
          uuid: "assistant-1",
          timestamp: "2025-01-15T10:31:00.000Z",
          sessionId: "session-123",
          parentUuid: "user-1",
          isSidechain: false,
          userType: "assistant",
          cwd: "/test",
          version: "1.0.0",
          message: {
            id: "msg-1",
            type: "message",
            role: "assistant",
            model: "claude-3-sonnet",
            content: [{ type: "text", text: "Hi there!" }],
          },
        }),
      ].join("\n");

      const filePath = path.join(tempDir, "test-with-errors.jsonl");
      fs.writeFileSync(filePath, content);

      const result = loadTranscript(filePath, {
        silent: true,
        skipMalformed: true,
      });

      expect(result.entries).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].lineNumber).toBe(2);
    });
  });
});
