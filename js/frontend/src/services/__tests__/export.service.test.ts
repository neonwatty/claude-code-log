import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ExportService } from "../export.service";
import type { ZodSession } from "@shared";

// Mock ZodSession for testing
const createMockSession = (id: string = "test-session-1"): ZodSession => ({
  id,
  cwd: "/test/project",
  firstTimestamp: "2024-01-01T10:00:00.000Z",
  lastTimestamp: "2024-01-01T11:00:00.000Z",
  totalUsage: {
    input_tokens: 1000,
    output_tokens: 500,
    cache_read_input_tokens: 200,
    cache_creation_input_tokens: 100,
  },
  entries: [
    {
      uuid: "entry-1",
      type: "user",
      timestamp: "2024-01-01T10:00:00.000Z",
      message: {
        content: [{ type: "text", text: "Hello, how can I help you today?" }],
      },
    },
    {
      uuid: "entry-2",
      type: "assistant",
      timestamp: "2024-01-01T10:01:00.000Z",
      message: {
        content: [{ type: "text", text: "I can help you with various tasks." }],
        usage: {
          input_tokens: 50,
          output_tokens: 25,
          cache_read_input_tokens: 10,
          cache_creation_input_tokens: 5,
        },
      },
    },
    {
      uuid: "entry-3",
      type: "system",
      timestamp: "2024-01-01T10:02:00.000Z",
      content: "System message",
    },
  ] as any[],
});

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(window.URL, "createObjectURL", {
  value: mockCreateObjectURL,
});
Object.defineProperty(window.URL, "revokeObjectURL", {
  value: mockRevokeObjectURL,
});

// Mock crypto.randomUUID
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => "test-uuid-" + Date.now(),
  },
});

describe("ExportService", () => {
  let exportService: ExportService;
  let mockSession: ZodSession;

  beforeEach(() => {
    exportService = new ExportService();
    mockSession = createMockSession();

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", { value: localStorageMock });

    mockCreateObjectURL.mockReturnValue("blob:mock-url");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("exportSession", () => {
    it("should export session as JSON by default", async () => {
      const result = await exportService.exportSession(mockSession);

      expect(result.success).toBe(true);
      expect(result.exportFormat).toBe("json");
      expect(result.filename).toBe(`session-${mockSession.id}.json`);
      expect(result.recordCount).toBe(2); // Should exclude system message by default
      expect(result.downloadUrl).toBe("blob:mock-url");
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it("should export session as CSV", async () => {
      const result = await exportService.exportSession(mockSession, {
        format: "csv",
      });

      expect(result.success).toBe(true);
      expect(result.exportFormat).toBe("csv");
      expect(result.filename).toBe(`session-${mockSession.id}.csv`);
    });

    it("should export session as Markdown", async () => {
      const result = await exportService.exportSession(mockSession, {
        format: "markdown",
      });

      expect(result.success).toBe(true);
      expect(result.exportFormat).toBe("markdown");
      expect(result.filename).toBe(`session-${mockSession.id}.md`);
    });

    it("should export session as HTML", async () => {
      const result = await exportService.exportSession(mockSession, {
        format: "html",
      });

      expect(result.success).toBe(true);
      expect(result.exportFormat).toBe("html");
      expect(result.filename).toBe(`session-${mockSession.id}.html`);
    });

    it("should filter out system messages when not included", async () => {
      const result = await exportService.exportSession(mockSession, {
        includeSystemMessages: false,
      });

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(2); // Should exclude system message
    });

    it("should filter entries by date range", async () => {
      const result = await exportService.exportSession(mockSession, {
        filterByDateRange: {
          startDate: "2024-01-01T10:00:30.000Z",
          endDate: "2024-01-01T10:01:30.000Z",
        },
      });

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(1); // Should only include entry-2
    });

    it("should handle unsupported export format", async () => {
      const result = await exportService.exportSession(mockSession, {
        format: "pdf" as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("PDF export not yet implemented");
    });

    it("should include metadata when requested", async () => {
      const result = await exportService.exportSession(mockSession, {
        includeMetadata: true,
      });

      expect(result.success).toBe(true);
      // We can't easily test the blob content, but we can verify the export completed
    });

    it("should include usage stats when requested", async () => {
      const result = await exportService.exportSession(mockSession, {
        includeUsageStats: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("exportMultipleSessions", () => {
    it("should export multiple sessions as JSON", async () => {
      const session2 = createMockSession("test-session-2");
      const sessions = [mockSession, session2];

      const result = await exportService.exportMultipleSessions(sessions);

      expect(result.success).toBe(true);
      expect(result.exportFormat).toBe("json");
      expect(result.recordCount).toBe(6); // 3 entries per session * 2 sessions
    });

    it("should export multiple sessions as CSV", async () => {
      const session2 = createMockSession("test-session-2");
      const sessions = [mockSession, session2];

      const result = await exportService.exportMultipleSessions(sessions, {
        format: "csv",
      });

      expect(result.success).toBe(true);
      expect(result.exportFormat).toBe("csv");
    });

    it("should handle empty sessions array", async () => {
      const result = await exportService.exportMultipleSessions([]);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(0);
    });
  });

  describe("getExportStats", () => {
    it("should return initial stats", () => {
      const stats = exportService.getExportStats();

      expect(stats.totalExports).toBe(0);
      expect(stats.totalSizeExported).toBe(0);
      expect(stats.lastExportDate).toBeNull();
      expect(stats.exportsByFormat).toEqual({});
    });

    it("should track export statistics", async () => {
      await exportService.exportSession(mockSession, { format: "json" });
      await exportService.exportSession(mockSession, { format: "csv" });

      const stats = exportService.getExportStats();

      expect(stats.totalExports).toBe(2);
      expect(stats.exportsByFormat.json).toBe(1);
      expect(stats.exportsByFormat.csv).toBe(1);
      expect(stats.totalSizeExported).toBeGreaterThan(0);
    });
  });

  describe("getExportHistory", () => {
    it("should return empty history initially", () => {
      const history = exportService.getExportHistory();
      expect(history).toEqual([]);
    });

    it("should track export history", async () => {
      await exportService.exportSession(mockSession);

      const history = exportService.getExportHistory();
      expect(history).toHaveLength(1);
      expect(history[0].success).toBe(true);
      expect(history[0].exportFormat).toBe("json");
    });
  });

  describe("clearExportHistory", () => {
    it("should clear export history", async () => {
      await exportService.exportSession(mockSession);
      expect(exportService.getExportHistory()).toHaveLength(1);

      exportService.clearExportHistory();
      expect(exportService.getExportHistory()).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("should handle export errors gracefully", async () => {
      // Mock Blob constructor to throw an error
      const originalBlob = global.Blob;
      global.Blob = vi.fn(() => {
        throw new Error("Blob creation failed");
      }) as any;

      const result = await exportService.exportSession(mockSession);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Restore original Blob
      global.Blob = originalBlob;
    });
  });

  describe("content extraction", () => {
    it("should extract text from different content types", async () => {
      const sessionWithVariousContent = {
        ...mockSession,
        entries: [
          {
            uuid: "entry-1",
            type: "user",
            timestamp: "2024-01-01T10:00:00.000Z",
            message: {
              content: [
                { type: "text", text: "Regular text" },
                { type: "thinking", content: "Thinking content" },
                {
                  type: "tool_use",
                  name: "test_tool",
                  input: { param: "value" },
                },
                { type: "tool_result", content: "Tool output" },
              ],
            },
          },
          {
            uuid: "entry-2",
            type: "summary",
            timestamp: "2024-01-01T10:01:00.000Z",
            summary: "Summary content",
          },
        ],
      } as any;

      const result = await exportService.exportSession(
        sessionWithVariousContent,
      );

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(2);
    });
  });
});
