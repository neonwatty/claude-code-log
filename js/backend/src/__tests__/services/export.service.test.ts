import fs from "fs/promises";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ExportService, getExportService } from "../../services/export.service";
import {
  IExportRequest,
  ISession,
  ExportFormat,
} from "../../../../shared/src";

// Mock dependencies
vi.mock("fs/promises");
vi.mock("puppeteer");
vi.mock("marked");

const mockFs = fs as any;

// Mock puppeteer
const mockPuppeteer = {
  launch: vi.fn(),
  newPage: vi.fn(),
  setContent: vi.fn(),
  pdf: vi.fn(),
  close: vi.fn(),
};

// Mock puppeteer for dynamic imports
vi.doMock("puppeteer", () => ({
  default: mockPuppeteer,
  launch: mockPuppeteer.launch,
}));

describe("ExportService", () => {
  let exportService: ExportService;
  
  const testSession: ISession = {
    id: "test-session-123",
    entries: [
      {
        type: "user",
        timestamp: "2024-01-01T00:00:00Z",
        sessionId: "test-session-123",
        cwd: "/test/project",
        version: "1.0.0",
        uuid: "user-entry-1",
        parentUuid: undefined,
        isSidechain: false,
        userType: "test",
        message: {
          role: "user",
          content: "Hello, how are you?",
        },
      },
      {
        type: "assistant",
        timestamp: "2024-01-01T00:01:00Z",
        sessionId: "test-session-123",
        cwd: "/test/project",
        version: "1.0.0",
        uuid: "assistant-entry-1",
        parentUuid: "user-entry-1",
        isSidechain: false,
        userType: "test",
        message: {
          id: "msg-1",
          type: "message",
          role: "assistant",
          model: "claude-3",
          content: [
            { type: "text", text: "I'm doing well, thank you!" },
          ],
          usage: {
            input_tokens: 15,
            output_tokens: 10,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        },
      },
      {
        type: "user",
        timestamp: "2024-01-01T00:02:00Z",
        sessionId: "test-session-123",
        cwd: "/test/project",
        version: "1.0.0",
        uuid: "user-entry-2",
        parentUuid: "assistant-entry-1",
        isSidechain: false,
        userType: "test",
        message: {
          role: "user",
          content: [
            { type: "text", text: "Can you help me with a coding problem?" },
            { type: "tool_use", id: "tool-1", name: "read_file", input: { path: "test.js" } },
          ],
        },
      },
      {
        type: "assistant",
        timestamp: "2024-01-01T00:03:00Z",
        sessionId: "test-session-123",
        cwd: "/test/project",
        version: "1.0.0",
        uuid: "assistant-entry-2",
        parentUuid: "user-entry-2",
        isSidechain: false,
        userType: "test",
        message: {
          id: "msg-2",
          type: "message",
          role: "assistant",
          model: "claude-3",
          content: [
            { type: "thinking", thinking: "The user wants help with coding." },
            { type: "text", text: "Of course! I'd be happy to help you with your coding problem." },
            { type: "tool_result", tool_use_id: "tool-1", content: "console.log('Hello World');" },
          ],
          usage: {
            input_tokens: 25,
            output_tokens: 20,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 5,
          },
        },
      },
    ],
    firstTimestamp: "2024-01-01T00:00:00Z",
    lastTimestamp: "2024-01-01T00:03:00Z",
    cwd: "/test/project",
    totalUsage: {
      input_tokens: 40,
      output_tokens: 30,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 5,
    },
    summary: "Test conversation about coding help",
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ size: 1024 });
    mockFs.readdir.mockResolvedValue([]);
    mockFs.unlink.mockResolvedValue(undefined);

    // Setup Puppeteer mocks
    const mockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from("mock pdf content")),
    };
    
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };
    
    mockPuppeteer.launch.mockResolvedValue(mockBrowser);

    // Get fresh instance for each test
    exportService = new ExportService();
    
    // Mock the collectSessionData method
    (exportService as any).collectSessionData = vi.fn().mockResolvedValue([testSession]);
  });

  afterEach(async () => {
    await exportService.shutdown();
  });

  describe("Export Creation", () => {
    it("should create HTML export successfully", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: {
          format: "html",
          includeMetadata: true,
          includeThinking: true,
          includeToolUse: true,
          includeImages: true,
        },
      };

      const result = await exportService.createExport(exportRequest);

      expect(result.success).toBe(true);
      expect(result.format).toBe("html");
      expect(result.filename).toMatch(/export_.*\.html/);
      expect(result.exportId).toBeDefined();
      expect(result.metadata.sessionCount).toBe(0); // Will be updated during processing
    });

    it("should create Markdown export successfully", async () => {
      const exportRequest: IExportRequest = {
        sessionIds: ["test-session-123"],
        options: {
          format: "markdown",
          includeMetadata: false,
          includeThinking: false,
          includeToolUse: true,
        },
      };

      const result = await exportService.createExport(exportRequest);

      expect(result.success).toBe(true);
      expect(result.format).toBe("markdown");
      expect(result.filename).toMatch(/export_.*\.md/);
    });

    it("should create JSON export successfully", async () => {
      const exportRequest: IExportRequest = {
        projectName: "test-project",
        options: {
          format: "json",
          compressionLevel: 1,
          messageTypes: ["user", "assistant"],
        },
      };

      const result = await exportService.createExport(exportRequest);

      expect(result.success).toBe(true);
      expect(result.format).toBe("json");
      expect(result.filename).toMatch(/export_.*\.json/);
    });

    it("should create PDF export successfully", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: {
          format: "pdf",
          includeMetadata: true,
          includeImages: false,
        },
      };

      const result = await exportService.createExport(exportRequest);
      
      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.success).toBe(true);
      expect(result.format).toBe("pdf");
      expect(result.filename).toMatch(/export_.*\.pdf/);

      // Verify Puppeteer was called
      expect(mockPuppeteer.launch).toHaveBeenCalled();
    });

    it("should validate export request", async () => {
      const invalidRequest = {
        options: { format: "html" as ExportFormat },
      } as IExportRequest;

      await expect(exportService.createExport(invalidRequest)).rejects.toThrow("Invalid export request");
    });

    it("should handle maximum concurrent exports", async () => {
      // Create exports up to the limit
      const promises = Array.from({ length: 5 }, (_, i) => 
        exportService.createExport({
          sessionId: `session-${i}`,
          options: { format: "html" },
        })
      );

      // Some should fail due to concurrent limit
      const results = await Promise.allSettled(promises);
      const rejectedResults = results.filter(result => result.status === "rejected");
      
      expect(rejectedResults.length).toBeGreaterThan(0);
      expect(rejectedResults[0].reason.message).toContain("Maximum concurrent");
    });
  });

  describe("Export Status Management", () => {
    it("should track export status", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: { format: "html" },
      };

      const result = await exportService.createExport(exportRequest);
      const status = exportService.getExportStatus(result.exportId);

      expect(status).toBeDefined();
      expect(status!.exportId).toBe(result.exportId);
      expect(status!.status).toBe("pending");
    });

    it("should return null for non-existent export", () => {
      const status = exportService.getExportStatus("non-existent-id");
      expect(status).toBeNull();
    });
  });

  describe("Export Processing", () => {
    it("should process HTML export with all content types", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: {
          format: "html",
          includeMetadata: true,
          includeThinking: true,
          includeToolUse: true,
          includeImages: true,
        },
      };

      const result = await exportService.createExport(exportRequest);
      
      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that writeFile was called with HTML content
      expect(mockFs.writeFile).toHaveBeenCalled();
      const writeCall = mockFs.writeFile.mock.calls[0];
      const htmlContent = writeCall[1];
      
      expect(htmlContent).toContain("<!DOCTYPE html>");
      expect(htmlContent).toContain("Claude Code Log Export");
      expect(htmlContent).toContain("test-session-123");
    });

    it("should process Markdown export with proper formatting", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: {
          format: "markdown",
          includeMetadata: true,
          includeThinking: true,
          includeToolUse: true,
        },
      };

      const result = await exportService.createExport(exportRequest);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFs.writeFile).toHaveBeenCalled();
      const writeCall = mockFs.writeFile.mock.calls[0];
      const markdownContent = writeCall[1];
      
      expect(markdownContent).toContain("# Claude Code Log Export");
      expect(markdownContent).toContain("## Session: test-session-123");
      expect(markdownContent).toContain("### USER");
      expect(markdownContent).toContain("### ASSISTANT");
    });

    it("should process JSON export with structured data", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: {
          format: "json",
          compressionLevel: 0,
        },
      };

      const result = await exportService.createExport(exportRequest);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFs.writeFile).toHaveBeenCalled();
      const writeCall = mockFs.writeFile.mock.calls[0];
      const jsonContent = writeCall[1];
      
      expect(() => JSON.parse(jsonContent)).not.toThrow();
      const parsedData = JSON.parse(jsonContent);
      expect(parsedData.metadata).toBeDefined();
      expect(parsedData.sessions).toBeDefined();
      expect(parsedData.metadata.format).toBe("json");
    });

    it("should handle PDF export with Puppeteer", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: { format: "pdf" },
      };

      const result = await exportService.createExport(exportRequest);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockPuppeteer.launch).toHaveBeenCalledWith({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    });
  });

  describe("Content Filtering", () => {
    it("should filter content based on options", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: {
          format: "html",
          includeMetadata: false,
          includeThinking: false,
          includeToolUse: false,
          includeImages: false,
        },
      };

      const result = await exportService.createExport(exportRequest);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const writeCall = mockFs.writeFile.mock.calls[0];
      const htmlContent = writeCall[1];
      
      // Should not contain thinking or tool use content (check for actual content, not CSS class names)
      expect(htmlContent).not.toContain("The user wants help");
      expect(htmlContent).not.toContain("<div class=\"thinking\">");
      expect(htmlContent).not.toContain("<div class=\"tool-use\">");
    });

    it("should filter by message types", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: {
          format: "json",
          messageTypes: ["user"],
        },
      };

      const result = await exportService.createExport(exportRequest);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const writeCall = mockFs.writeFile.mock.calls[0];
      const jsonContent = writeCall[1];
      const parsedData = JSON.parse(jsonContent);
      
      // Should only contain user messages
      const allEntries = parsedData.sessions.flatMap((s: any) => s.entries);
      const userEntries = allEntries.filter((e: any) => e.type === "user");
      const assistantEntries = allEntries.filter((e: any) => e.type === "assistant");
      
      expect(userEntries.length).toBeGreaterThan(0);
      expect(assistantEntries.length).toBe(0);
    });

    it("should filter by date range", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: {
          format: "json",
          dateRange: {
            startDate: "2024-01-01T00:01:30Z",
            endDate: "2024-01-01T00:02:30Z",
          },
        },
      };

      // Mock sessions with different timestamps
      const sessionsWithDifferentDates = [
        { ...testSession, firstTimestamp: "2024-01-01T00:00:30Z", lastTimestamp: "2024-01-01T00:01:00Z" }, // Before range
        { ...testSession, id: "session-2", firstTimestamp: "2024-01-01T00:02:00Z", lastTimestamp: "2024-01-01T00:02:30Z" }, // In range
        { ...testSession, id: "session-3", firstTimestamp: "2024-01-01T00:03:00Z", lastTimestamp: "2024-01-01T00:03:30Z" }, // After range
      ];
      
      (exportService as any).collectSessionData = vi.fn().mockResolvedValue(sessionsWithDifferentDates);

      const result = await exportService.createExport(exportRequest);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const writeCall = mockFs.writeFile.mock.calls[0];
      const jsonContent = writeCall[1];
      const parsedData = JSON.parse(jsonContent);
      
      // Should only contain sessions within the date range
      expect(parsedData.sessions.length).toBe(1);
      expect(parsedData.sessions[0].id).toBe("session-2");
    });
  });

  describe("Error Handling", () => {
    it("should handle file system errors during HTML export", async () => {
      mockFs.writeFile.mockRejectedValue(new Error("File system error"));

      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: { format: "html" },
      };

      const result = await exportService.createExport(exportRequest);
      
      // Wait for processing to fail
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const status = exportService.getExportStatus(result.exportId);
      expect(status?.status).toBe("failed");
      expect(status?.error).toContain("File system error");
    });

    it("should handle Puppeteer errors during PDF export", async () => {
      mockPuppeteer.launch.mockRejectedValue(new Error("Puppeteer launch failed"));

      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: { format: "pdf" },
      };

      const result = await exportService.createExport(exportRequest);
      
      // Wait for processing to fail
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const status = exportService.getExportStatus(result.exportId);
      expect(status?.status).toBe("failed");
    });

    it("should handle invalid session data", async () => {
      (exportService as any).collectSessionData = vi.fn().mockResolvedValue([]);

      const exportRequest: IExportRequest = {
        sessionId: "non-existent-session",
        options: { format: "html" },
      };

      const result = await exportService.createExport(exportRequest);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still create export but with empty data
      const status = exportService.getExportStatus(result.exportId);
      expect(status).toBeDefined();
    });
  });

  describe("Metrics", () => {
    it("should track export metrics", async () => {
      const initialMetrics = exportService.getExportMetrics();
      expect(initialMetrics.totalExports).toBe(0);
      expect(initialMetrics.successfulExports).toBe(0);
      expect(initialMetrics.failedExports).toBe(0);

      // Create a successful export
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: { format: "html" },
      };

      await exportService.createExport(exportRequest);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const finalMetrics = exportService.getExportMetrics();
      expect(finalMetrics.totalExports).toBe(1);
      expect(finalMetrics.successfulExports).toBe(1);
    });

    it("should track failed export metrics", async () => {
      mockFs.writeFile.mockRejectedValue(new Error("Write failed"));

      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: { format: "html" },
      };

      await exportService.createExport(exportRequest);
      
      // Wait for processing to fail
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const metrics = exportService.getExportMetrics();
      expect(metrics.totalExports).toBe(1);
      expect(metrics.failedExports).toBe(1);
      expect(metrics.successfulExports).toBe(0);
    });
  });

  describe("Cleanup", () => {
    it("should cleanup expired exports", async () => {
      // Create an export first, then mock an expired job to trigger file cleanup
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: { format: "html" },
      };
      
      const result = await exportService.createExport(exportRequest);
      
      // Mock an expired job by directly manipulating the job manager
      const jobManager = (exportService as any).jobManager;
      const expiredJob = jobManager.getJob(result.exportId);
      if (expiredJob) {
        expiredJob.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
        expiredJob.status = "completed";
        expiredJob.completedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      }
      
      await exportService.cleanupExpiredExports();
      
      // Should call readdir when there are expired files to clean up
      expect(mockFs.readdir).toHaveBeenCalled();
    });

    it("should handle cleanup errors gracefully", async () => {
      mockFs.readdir.mockRejectedValue(new Error("Cleanup failed"));
      
      // Should not throw
      await expect(exportService.cleanupExpiredExports()).resolves.not.toThrow();
    });
  });

  describe("Utility Functions", () => {
    it("should format file extensions correctly", () => {
      const formats: Array<[ExportFormat, string]> = [
        ["html", "html"],
        ["markdown", "md"],
        ["json", "json"],
        ["pdf", "pdf"],
      ];

      formats.forEach(([format, expectedExt]) => {
        const extension = (exportService as any).getFileExtension(format);
        expect(extension).toBe(expectedExt);
      });
    });

    it("should escape HTML content properly", () => {
      const testString = '<script>alert("xss")</script> & "quotes"';
      const escaped = (exportService as any).escapeHtml(testString);
      
      expect(escaped).not.toContain("<script>");
      expect(escaped).toContain("&lt;");
      expect(escaped).toContain("&gt;");
      expect(escaped).toContain("&amp;");
      expect(escaped).toContain("&quot;");
    });

    it("should generate secure download tokens", () => {
      const token1 = (exportService as any).generateDownloadToken("export-1");
      const token2 = (exportService as any).generateDownloadToken("export-2");
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(10);
    });
  });

  describe("Singleton Pattern", () => {
    it("should return same instance", () => {
      const instance1 = getExportService();
      const instance2 = getExportService();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe("Memory Management", () => {
    it("should handle shutdown gracefully", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "test-session-123",
        options: { format: "html" },
      };

      await exportService.createExport(exportRequest);
      
      // Should shutdown without errors
      await expect(exportService.shutdown()).resolves.not.toThrow();
    });
  });
});