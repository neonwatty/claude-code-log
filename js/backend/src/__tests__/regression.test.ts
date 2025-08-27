/**
 * Regression tests for known parsing issues
 * Tests specific edge cases and bugs that have been discovered and fixed
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  parseJsonlLine,
  parseTranscriptEntry,
  loadTranscript,
} from "../parsers/jsonl-parser";

describe("Regression Tests for Known Parsing Issues", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "regression-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Issue #1: Malformed content field in tool_result", () => {
    test("handles tool_result with typo in content field", () => {
      // Based on actual data from edge_cases.jsonl line 10 with "contenst" typo
      const malformedToolResult = {
        type: "user",
        uuid: "edge_010",
        timestamp: "2025-06-14T11:03:01Z",
        sessionId: "edge_cases",
        parentUuid: null,
        isSidechain: false,
        userType: "human",
        cwd: "/tmp",
        version: "1.0.0",
        toolUseResult: "File created successfully at: /tmp/complex_example.py",
        message: {
          role: "user",
          contenst: [
            {
              // typo: "contenst" instead of "content"
              type: "tool_result",
              tool_use_id: "tool_edge_002",
              content: "File created successfully at: /tmp/complex_example.py",
              is_error: false,
            },
          ],
        },
      };

      // Should handle gracefully even with typo
      expect(() => parseTranscriptEntry(malformedToolResult)).not.toThrow();
      const result = parseTranscriptEntry(malformedToolResult);
      expect(result.type).toBe("user");
    });
  });

  describe("Issue #2: Mixed content array with various types", () => {
    test("handles content array with text, tool_use, and thinking content", () => {
      const mixedContentEntry = {
        type: "assistant",
        uuid: "mixed-content-test",
        timestamp: "2025-01-15T10:30:00.000Z",
        sessionId: "mixed-session",
        parentUuid: "user-123",
        isSidechain: false,
        userType: "assistant",
        cwd: "/test",
        version: "1.0.0",
        message: {
          id: "msg-mixed",
          type: "message",
          role: "assistant",
          model: "claude-3-sonnet",
          content: [
            { type: "text", text: "Let me think about this..." },
            {
              type: "thinking",
              thinking: "I need to analyze the user request carefully.",
              signature: "sig_123",
            },
            { type: "text", text: "I'll use a tool to help." },
            {
              type: "tool_use",
              id: "tool_123",
              name: "Calculator",
              input: { expression: "2 + 2" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 50, output_tokens: 25 },
        },
      };

      expect(() => parseTranscriptEntry(mixedContentEntry)).not.toThrow();
      const result = parseTranscriptEntry(mixedContentEntry);
      expect(result.type).toBe("assistant");

      if (
        result.type === "assistant" &&
        Array.isArray(result.message.content)
      ) {
        expect(result.message.content).toHaveLength(4);
        expect(result.message.content[0].type).toBe("text");
        expect(result.message.content[1].type).toBe("thinking");
        expect(result.message.content[2].type).toBe("text");
        expect(result.message.content[3].type).toBe("tool_use");
      }
    });
  });

  describe("Issue #3: Tool use with complex nested input objects", () => {
    test("handles tool use with deeply nested input parameters", () => {
      const complexToolUse = {
        type: "assistant",
        uuid: "complex-tool-test",
        timestamp: "2025-01-15T10:30:00.000Z",
        sessionId: "complex-session",
        message: {
          id: "msg-complex",
          type: "message",
          role: "assistant",
          model: "claude-3-sonnet",
          content: [
            {
              type: "tool_use",
              id: "tool_complex_001",
              name: "ComplexTool",
              input: {
                config: {
                  nested: {
                    deeply: {
                      params: {
                        array: [1, 2, 3, { key: "value" }],
                        boolean: true,
                        null_value: null,
                        special_chars: "quotes\"and'backslashes\\and\nnewlines",
                        unicode: "🚀 emojis and 中文 characters",
                      },
                    },
                  },
                },
                metadata: {
                  version: "1.0.0",
                  tags: ["test", "complex", "nested"],
                },
              },
            },
          ],
          stop_reason: "tool_use",
        },
      };

      expect(() => parseTranscriptEntry(complexToolUse)).not.toThrow();
      const result = parseTranscriptEntry(complexToolUse);
      expect(result.type).toBe("assistant");

      if (
        result.type === "assistant" &&
        Array.isArray(result.message.content)
      ) {
        const toolUse = result.message.content[0];
        if (toolUse.type === "tool_use" && "input" in toolUse) {
          expect(toolUse.input.config.nested.deeply.params.array).toEqual([
            1,
            2,
            3,
            { key: "value" },
          ]);
          expect(toolUse.input.config.nested.deeply.params.unicode).toBe(
            "🚀 emojis and 中文 characters",
          );
        }
      }
    });
  });

  describe("Issue #4: Timestamp edge cases", () => {
    test("handles various valid ISO 8601 timestamp formats", () => {
      const timestampFormats = [
        "2025-01-15T10:30:00.000Z",
        "2025-01-15T10:30:00Z",
        "2025-01-15T10:30:00.000+00:00",
        "2025-01-15T10:30:00-05:00",
        "2025-01-15T10:30:00.123456Z", // microseconds
        "2025-12-31T23:59:59.999Z", // end of year
        "2025-01-01T00:00:00.000Z", // start of year
      ];

      timestampFormats.forEach((timestamp) => {
        const entry = {
          type: "user",
          uuid: "timestamp-test",
          timestamp,
          sessionId: "timestamp-session",
          message: { role: "user", content: "Test timestamp" },
        };

        expect(() => parseTranscriptEntry(entry)).not.toThrow();
        const result = parseTranscriptEntry(entry);
        expect(result.type).toBe("user");
        if (result.type === "user") {
          expect(result.timestamp).toBe(timestamp);
        }
      });
    });

    test("handles various timestamp formats (parser is lenient)", () => {
      // The current parser doesn't validate timestamp format, only existence
      const timestampVariations = [
        "2025-01-15T10:30:00.000Z", // valid ISO format
        "2025-01-15", // date only
        "not-a-date", // invalid format
        "", // empty string (will fail required field check)
      ];

      timestampVariations.forEach((timestamp) => {
        const entry = {
          type: "user",
          uuid: "timestamp-test",
          timestamp,
          sessionId: "timestamp-session",
          message: { role: "user", content: "Test timestamp" },
        };

        if (timestamp === "") {
          // Empty timestamp should fail required field check
          expect(() => parseTranscriptEntry(entry)).toThrow();
        } else {
          // Parser accepts any non-empty timestamp
          expect(() => parseTranscriptEntry(entry)).not.toThrow();
        }
      });
    });
  });

  describe("Issue #5: Large JSON objects causing memory issues", () => {
    test("handles very large content without excessive memory usage", () => {
      const largeContent = "A".repeat(1000000); // 1MB of text

      const largeEntry = {
        type: "user",
        uuid: "large-content-test",
        timestamp: "2025-01-15T10:30:00.000Z",
        sessionId: "large-session",
        message: { role: "user", content: largeContent },
      };

      const startMemory = process.memoryUsage?.().heapUsed || 0;

      expect(() => parseTranscriptEntry(largeEntry)).not.toThrow();
      const result = parseTranscriptEntry(largeEntry);

      const endMemory = process.memoryUsage?.().heapUsed || 0;
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB

      expect(result.type).toBe("user");
      expect(memoryIncrease).toBeLessThan(10); // Should not increase memory by more than 10MB
    });

    test("handles arrays with many content items efficiently", () => {
      const manyContentItems = Array.from({ length: 1000 }, (_, i) => ({
        type: "text",
        text: `Content item ${i} with some text to make it realistic`,
      }));

      const entry = {
        type: "assistant",
        uuid: "many-items-test",
        timestamp: "2025-01-15T10:30:00.000Z",
        sessionId: "many-items-session",
        message: {
          id: "msg-many",
          type: "message",
          role: "assistant",
          model: "claude-3-sonnet",
          content: manyContentItems,
        },
      };

      expect(() => parseTranscriptEntry(entry)).not.toThrow();
      const result = parseTranscriptEntry(entry);
      expect(result.type).toBe("assistant");

      if (
        result.type === "assistant" &&
        Array.isArray(result.message.content)
      ) {
        expect(result.message.content).toHaveLength(1000);
      }
    });
  });

  describe("Issue #6: Special characters in content causing JSON parse errors", () => {
    test("handles escaped special characters correctly", () => {
      const specialContent =
        "Text with \"quotes\", 'single quotes', \\backslashes\\, \nnewlines\n, \ttabs\t, and unicode: 🚀 emoji";

      const entry = {
        type: "user",
        uuid: "special-chars-test",
        timestamp: "2025-01-15T10:30:00.000Z",
        sessionId: "special-session",
        message: { role: "user", content: specialContent },
      };

      const jsonLine = JSON.stringify(entry);
      const result = parseJsonlLine(jsonLine, 1);

      expect(result).not.toHaveProperty("error");
      if (!("error" in result)) {
        expect(result.type).toBe("user");
        if (result.type === "user") {
          expect(result.message.content).toBe(specialContent);
        }
      }
    });

    test("handles null bytes and control characters", () => {
      const controlCharsContent =
        "Text with\x00null\x01control\x02chars\x03and\x1Fmore";

      const entry = {
        type: "user",
        uuid: "control-chars-test",
        timestamp: "2025-01-15T10:30:00.000Z",
        sessionId: "control-session",
        message: { role: "user", content: controlCharsContent },
      };

      // Should handle gracefully, even if control chars are preserved or filtered
      expect(() => parseTranscriptEntry(entry)).not.toThrow();
    });
  });

  describe("Issue #7: Summary entries with missing or invalid leafUuid", () => {
    test("validates summary entries properly", () => {
      const validSummary = {
        type: "summary",
        summary: "User asked about TypeScript and got helpful response",
        leafUuid: "assistant-msg-123",
        timestamp: "2025-01-15T10:30:00.000Z",
      };

      expect(() => parseTranscriptEntry(validSummary)).not.toThrow();
      const result = parseTranscriptEntry(validSummary);
      expect(result.type).toBe("summary");
    });

    test("rejects summary with missing leafUuid", () => {
      const invalidSummary = {
        type: "summary",
        summary: "User asked about TypeScript",
        timestamp: "2025-01-15T10:30:00.000Z",
        // missing leafUuid
      };

      expect(() => parseTranscriptEntry(invalidSummary)).toThrow();
    });

    test("rejects summary with empty summary text", () => {
      const invalidSummary = {
        type: "summary",
        summary: "", // empty summary
        leafUuid: "assistant-msg-123",
        timestamp: "2025-01-15T10:30:00.000Z",
      };

      expect(() => parseTranscriptEntry(invalidSummary)).toThrow();
    });
  });

  describe("Issue #8: File loading with mixed line endings", () => {
    test("handles files with CRLF line endings", () => {
      const contentWithCRLF = [
        JSON.stringify({
          type: "user",
          uuid: "crlf-1",
          timestamp: "2025-01-15T10:30:00.000Z",
          sessionId: "crlf-session",
          message: { role: "user", content: "First message" },
        }),
        JSON.stringify({
          type: "user",
          uuid: "crlf-2",
          timestamp: "2025-01-15T10:30:30.000Z",
          sessionId: "crlf-session",
          message: { role: "user", content: "Second message" },
        }),
      ].join("\r\n"); // CRLF line endings

      const filePath = path.join(tempDir, "crlf-test.jsonl");
      fs.writeFileSync(filePath, contentWithCRLF);

      const result = loadTranscript(filePath, { silent: true });

      expect(result.entries).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    test("handles files with mixed line endings", () => {
      const line1 = JSON.stringify({
        type: "user",
        uuid: "mixed-1",
        timestamp: "2025-01-15T10:30:00.000Z",
        sessionId: "mixed-session",
        message: { role: "user", content: "LF ending" },
      });

      const line2 = JSON.stringify({
        type: "user",
        uuid: "mixed-2",
        timestamp: "2025-01-15T10:30:30.000Z",
        sessionId: "mixed-session",
        message: { role: "user", content: "CRLF ending" },
      });

      const mixedContent = line1 + "\n" + line2 + "\r\n"; // Mixed LF and CRLF

      const filePath = path.join(tempDir, "mixed-endings.jsonl");
      fs.writeFileSync(filePath, mixedContent);

      const result = loadTranscript(filePath, { silent: true });

      expect(result.entries).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Issue #9: Performance regression with deeply nested objects", () => {
    test("parses deeply nested tool inputs without timeout", () => {
      // Create a deeply nested object (10 levels deep)
      let nestedObject: any = { value: "deep" };
      for (let i = 0; i < 10; i++) {
        nestedObject = { level: i, nested: nestedObject };
      }

      const entry = {
        type: "assistant",
        uuid: "nested-test",
        timestamp: "2025-01-15T10:30:00.000Z",
        sessionId: "nested-session",
        message: {
          id: "msg-nested",
          type: "message",
          role: "assistant",
          model: "claude-3-sonnet",
          content: [
            {
              type: "tool_use",
              id: "tool_nested",
              name: "DeepTool",
              input: nestedObject,
            },
          ],
        },
      };

      const startTime = process.hrtime.bigint();
      expect(() => parseTranscriptEntry(entry)).not.toThrow();
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1_000_000;
      expect(durationMs).toBeLessThan(100); // Should parse in < 100ms
    });
  });

  describe("Issue #10: File reading with BOM (Byte Order Mark)", () => {
    test("handles UTF-8 BOM at start of file", () => {
      const contentWithBOM =
        "\uFEFF" +
        JSON.stringify({
          type: "user",
          uuid: "bom-test",
          timestamp: "2025-01-15T10:30:00.000Z",
          sessionId: "bom-session",
          message: { role: "user", content: "Message with BOM" },
        });

      const filePath = path.join(tempDir, "bom-test.jsonl");
      fs.writeFileSync(filePath, contentWithBOM, "utf8");

      const result = loadTranscript(filePath, { silent: true });

      expect(result.entries).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.entries[0].type).toBe("user");
    });
  });
});
