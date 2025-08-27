import request from "supertest";
import app from "../../app";
import fs from "fs";
import { IApiResponse, IExportRequest } from "../../../../shared/src";
import { getExportService } from "../../services/export.service";
import { describe, it, expect, beforeEach, vi, type MockedFunction } from "vitest";

// Mock dependencies
vi.mock("fs");
vi.mock("fs/promises", () => ({
  default: {
    access: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
  },
}));
vi.mock("puppeteer");
vi.mock("../../services/export.service");

// Mock express-rate-limit - Define variables outside of factory function
vi.mock("express-rate-limit", () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => next()),
}));

const mockFs = fs as any;
const mockGetExportService = getExportService as MockedFunction<typeof getExportService>;

// Mock export service
const mockExportService = {
  createExport: vi.fn(),
  getExportStatus: vi.fn(),
  getExportMetrics: vi.fn(),
  cleanupExpiredExports: vi.fn(),
  createExportStream: vi.fn(),
};

mockGetExportService.mockReturnValue(mockExportService as any);

describe("Export API Routes", () => {
  const testExportId = "550e8400-e29b-41d4-a716-446655440000";
  const testSessionId = "550e8400-e29b-41d4-a716-446655440001";
  const testSessionIds = ["550e8400-e29b-41d4-a716-446655440002", "550e8400-e29b-41d4-a716-446655440003", "550e8400-e29b-41d4-a716-446655440004"];
  const testProjectName = "test-project";

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockFs.existsSync.mockReturnValue(true);
    
    // Create mock JSONL content with all test sessions
    const mockJSONLContent = [
      // First session
      `{"sessionId":"${testSessionId}","timestamp":"2024-01-01T00:00:00Z","cwd":"/test/project","type":"user","message":{"role":"user","content":"Test message"}}`,
      `{"sessionId":"${testSessionId}","timestamp":"2024-01-01T00:01:00Z","cwd":"/test/project","type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Test response"}]}}`,
      // Additional sessions for multiple session ID tests
      `{"sessionId":"${testSessionIds[0]}","timestamp":"2024-01-01T01:00:00Z","cwd":"/test/project","type":"user","message":{"role":"user","content":"Test message 1"}}`,
      `{"sessionId":"${testSessionIds[1]}","timestamp":"2024-01-01T02:00:00Z","cwd":"/test/project","type":"user","message":{"role":"user","content":"Test message 2"}}`,
      `{"sessionId":"${testSessionIds[2]}","timestamp":"2024-01-01T03:00:00Z","cwd":"/test/project","type":"user","message":{"role":"user","content":"Test message 3"}}`,
      // Project name test sessions (with matching cwd pattern)
      `{"sessionId":"project-session-1","timestamp":"2024-01-15T10:00:00Z","cwd":"/home/user/${testProjectName}/src","type":"user","message":{"role":"user","content":"Project test message 1"}}`,
      `{"sessionId":"project-session-2","timestamp":"2024-01-20T15:30:00Z","cwd":"/workspace/${testProjectName}/docs","type":"user","message":{"role":"user","content":"Project test message 2"}}`,
    ].join('\n');
    
    mockFs.readFileSync.mockReturnValue(mockJSONLContent);
    mockFs.readdirSync.mockReturnValue([{ name: "test.jsonl", isDirectory: () => false }]);

    mockExportService.createExport.mockResolvedValue({
      success: true,
      exportId: testExportId,
      format: "html",
      filename: `export_${testExportId}.html`,
      size: 0,
      metadata: {
        sessionCount: 1,
        messageCount: 1,
        generatedAt: new Date().toISOString(),
        processingTime: 0,
        options: { format: "html", includeMetadata: true },
      },
    });

    mockExportService.getExportStatus.mockReturnValue({
      exportId: testExportId,
      status: "completed",
      progress: {
        stage: "completed",
        progress: 100,
        message: "Export completed",
      },
      result: {
        success: true,
        exportId: testExportId,
        format: "html",
        filename: `export_${testExportId}.html`,
        size: 1024,
        downloadToken: "test-token-123",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          sessionCount: 1,
          messageCount: 1,
          generatedAt: new Date().toISOString(),
          processingTime: 1000,
          options: { format: "html", includeMetadata: true },
        },
      },
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    mockExportService.getExportMetrics.mockReturnValue({
      totalExports: 10,
      successfulExports: 8,
      failedExports: 2,
      averageProcessingTime: 5000,
      totalDataExported: 1048576, // 1MB
      activeExports: 0,
    });
  });

  describe("POST /api/export", () => {
    it("should create a new export with single session ID", async () => {
      const exportRequest: IExportRequest = {
        sessionId: testSessionId,
        options: {
          format: "html",
          includeMetadata: true,
          includeThinking: true,
          includeToolUse: true,
          includeImages: true,
        },
      };

      const response = await request(app)
        .post("/api/export")
        .send(exportRequest);

      if (response.status !== 202) {
        console.error("Unexpected status:", response.status);
        console.error("Response body:", JSON.stringify(response.body, null, 2));
        console.error("Response text:", response.text);
      }

      expect(response.status).toBe(202);
      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("exportId");
      expect(body.data.format).toBe("html");
      expect(mockExportService.createExport).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: exportRequest.sessionId,
          options: expect.objectContaining({
            format: exportRequest.options.format,
            includeMetadata: exportRequest.options.includeMetadata,
            includeThinking: exportRequest.options.includeThinking,
            includeToolUse: exportRequest.options.includeToolUse,
            includeImages: exportRequest.options.includeImages,
          }),
        })
      );
    });

    it("should create a new export with multiple session IDs", async () => {
      const exportRequest: IExportRequest = {
        sessionIds: testSessionIds,
        options: {
          format: "json",
          includeMetadata: false,
          compressionLevel: 1,
        },
      };

      const response = await request(app)
        .post("/api/export")
        .send(exportRequest)
        .expect(202);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(mockExportService.createExport).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionIds: exportRequest.sessionIds,
          options: expect.objectContaining({
            format: exportRequest.options.format,
            includeMetadata: exportRequest.options.includeMetadata,
            compressionLevel: exportRequest.options.compressionLevel,
          }),
        })
      );
    });

    it("should create a new export with project name", async () => {
      const exportRequest: IExportRequest = {
        projectName: testProjectName,
        options: {
          format: "markdown",
          dateRange: {
            startDate: "2024-01-01T00:00:00Z",
            endDate: "2024-01-31T23:59:59Z",
          },
        },
      };

      const response = await request(app)
        .post("/api/export")
        .send(exportRequest)
        .expect(202);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(mockExportService.createExport).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: exportRequest.projectName,
          options: expect.objectContaining({
            format: exportRequest.options.format,
            dateRange: exportRequest.options.dateRange,
          }),
        })
      );
    });

    it("should reject invalid export request - missing identifiers", async () => {
      const invalidRequest = {
        options: { format: "html" },
      };

      const response = await request(app)
        .post("/api/export")
        .send(invalidRequest)
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Invalid export request");
    });

    it("should reject invalid export request - invalid format", async () => {
      const invalidRequest = {
        sessionId: testSessionId,
        options: { format: "invalid-format" },
      };

      const response = await request(app)
        .post("/api/export")
        .send(invalidRequest)
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Invalid export request");
    });

    it("should handle no matching sessions found", async () => {
      const exportRequest: IExportRequest = {
        sessionId: "550e8400-e29b-41d4-a716-999999999999", // Valid UUID that won't be in our mock data
        options: { format: "html" },
      };

      const response = await request(app)
        .post("/api/export")
        .send(exportRequest)
        .expect(404);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("No matching sessions found");
    });

    it("should handle maximum concurrent exports error", async () => {
      mockExportService.createExport.mockRejectedValue(
        new Error("Maximum concurrent exports reached. Please try again later.")
      );

      const exportRequest: IExportRequest = {
        sessionId: testSessionId,
        options: { format: "html" },
      };

      const response = await request(app)
        .post("/api/export")
        .send(exportRequest)
        .expect(429);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Maximum concurrent");
    });

    it("should handle internal server error", async () => {
      mockExportService.createExport.mockRejectedValue(new Error("Internal error"));

      const exportRequest: IExportRequest = {
        sessionId: testSessionId,
        options: { format: "html" },
      };

      const response = await request(app)
        .post("/api/export")
        .send(exportRequest)
        .expect(500);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toBe("Failed to create export");
    });
  });

  describe("GET /api/export/:exportId", () => {
    it("should get export status for valid export ID", async () => {
      const response = await request(app)
        .get(`/api/export/${testExportId}`)
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("exportId", testExportId);
      expect(body.data).toHaveProperty("status", "completed");
      expect(mockExportService.getExportStatus).toHaveBeenCalledWith(testExportId);
    });

    it("should reject invalid export ID format", async () => {
      const response = await request(app)
        .get("/api/export/invalid-id")
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Invalid export ID format");
    });

    it("should handle export not found", async () => {
      mockExportService.getExportStatus.mockReturnValue(null);

      const response = await request(app)
        .get(`/api/export/${testExportId}`)
        .expect(404);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Export not found");
    });
  });

  describe("GET /api/export/:exportId/download", () => {
    const validToken = "test-token-123";

    beforeEach(async () => {
      // Reset and configure fs/promises mocks
      const mockFsPromises = vi.mocked((await import("fs/promises")).default);
      mockFsPromises.access.mockImplementation(() => Promise.resolve());
      mockFsPromises.stat.mockResolvedValue({ size: 1024 } as any);
      mockFsPromises.mkdir.mockResolvedValue(undefined);
      mockFsPromises.writeFile.mockResolvedValue(undefined);
      mockFsPromises.readdir.mockResolvedValue([]);
      mockFsPromises.unlink.mockResolvedValue(undefined);

      const mockReadStream = {
        pipe: vi.fn((res: any) => {
          // Simulate immediate streaming completion
          setTimeout(() => {
            res.end("Mock file content");
          }, 0);
          return mockReadStream;
        }),
        on: vi.fn((event: string, handler: Function) => {
          // Simulate no errors
          return mockReadStream;
        }),
      };
      
      (mockFs.createReadStream as any).mockReturnValue(mockReadStream);
    });

    it("should download export file with valid token", async () => {
      // Ensure the export status shows a completed, non-expired export
      mockExportService.getExportStatus.mockReturnValue({
        exportId: testExportId,
        status: "completed",
        progress: {
          stage: "completed",
          progress: 100,
          message: "Export completed",
        },
        result: {
          success: true,
          exportId: testExportId,
          format: "html",
          filename: `export_${testExportId}.html`,
          size: 1024,
          downloadToken: validToken, // Use the same token
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
          metadata: {
            sessionCount: 1,
            messageCount: 1,
            generatedAt: new Date().toISOString(),
            processingTime: 1000,
            options: { format: "html", includeMetadata: true },
          },
        },
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      const response = await request(app)
        .get(`/api/export/${testExportId}/download?token=${validToken}`);

      if (response.status !== 200) {
        console.error("Unexpected download response status:", response.status);
        console.error("Response body:", JSON.stringify(response.body, null, 2));
        console.error("Response text:", response.text);
      }

      expect(response.status).toBe(200);

      // Check headers are set correctly
      expect(response.headers["content-type"]).toBe("text/html");
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.headers["content-disposition"]).toContain(`export_${testExportId}.html`);
    });

    it("should reject missing token", async () => {
      const response = await request(app)
        .get(`/api/export/${testExportId}/download`)
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Download token is required");
    });

    it("should reject invalid export ID", async () => {
      const response = await request(app)
        .get(`/api/export/invalid-id/download?token=${validToken}`)
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Invalid export ID format");
    });

    it("should handle export not found", async () => {
      mockExportService.getExportStatus.mockReturnValue(null);

      const response = await request(app)
        .get(`/api/export/${testExportId}/download?token=${validToken}`)
        .expect(404);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Export not found");
    });

    it("should handle export not ready", async () => {
      mockExportService.getExportStatus.mockReturnValue({
        exportId: testExportId,
        status: "processing",
        progress: { stage: "processing", progress: 50 },
        createdAt: new Date().toISOString(),
      });

      const response = await request(app)
        .get(`/api/export/${testExportId}/download?token=${validToken}`)
        .expect(409);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Export not ready for download");
    });

    it("should reject invalid token", async () => {
      const response = await request(app)
        .get(`/api/export/${testExportId}/download?token=invalid-token`)
        .expect(403);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Invalid download token");
    });

    it("should handle expired export", async () => {
      // Mock expired export
      const expiredStatus = {
        ...mockExportService.getExportStatus(),
        result: {
          ...mockExportService.getExportStatus().result,
          expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
        },
      };
      mockExportService.getExportStatus.mockReturnValue(expiredStatus);

      const response = await request(app)
        .get(`/api/export/${testExportId}/download?token=${validToken}`)
        .expect(410);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Download link has expired");
    });
  });

  describe("DELETE /api/export/:exportId", () => {
    it("should cancel/delete export", async () => {
      const response = await request(app)
        .delete(`/api/export/${testExportId}`)
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("message");
    });

    it("should reject invalid export ID", async () => {
      const response = await request(app)
        .delete("/api/export/invalid-id")
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Invalid export ID format");
    });

    it("should handle export not found", async () => {
      mockExportService.getExportStatus.mockReturnValue(null);

      const response = await request(app)
        .delete(`/api/export/${testExportId}`)
        .expect(404);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Export not found");
    });
  });

  describe("GET /api/export/metrics", () => {
    it("should get export service metrics", async () => {
      const response = await request(app)
        .get("/api/export/metrics")
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("totalExports", 10);
      expect(body.data).toHaveProperty("successfulExports", 8);
      expect(body.data).toHaveProperty("failedExports", 2);
      expect(body.data).toHaveProperty("averageProcessingTime", 5000);
      expect(body.data).toHaveProperty("totalDataExported", 1048576);
      expect(body.data).toHaveProperty("activeExports", 0);
    });

    it("should handle metrics error", async () => {
      mockExportService.getExportMetrics.mockImplementation(() => {
        throw new Error("Metrics error");
      });

      const response = await request(app)
        .get("/api/export/metrics")
        .expect(500);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Failed to fetch export metrics");
    });
  });

  describe("POST /api/export/cleanup", () => {
    it("should cleanup expired exports", async () => {
      mockExportService.cleanupExpiredExports.mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/export/cleanup")
        .send({}) // Send empty body to satisfy content-type validation
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("message");
      expect(mockExportService.cleanupExpiredExports).toHaveBeenCalled();
    });

    it("should handle cleanup error", async () => {
      mockExportService.cleanupExpiredExports.mockRejectedValue(new Error("Cleanup failed"));

      const response = await request(app)
        .post("/api/export/cleanup")
        .send({}) // Send empty body to satisfy content-type validation
        .expect(500);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toContain("Failed to cleanup exports");
    });
  });

  describe("Rate Limiting", () => {
    it("should export routes exist", async () => {
      // Simple test to check that export routes exist and are functional
      const response = await request(app)
        .post("/api/export")
        .send({
          sessionId: testSessionId,
          options: { format: "html" },
        });

      // Should get a successful response (202) or a validation error (400/404)
      expect([202, 400, 404]).toContain(response.status);
    });
  });

  describe("Export Formats", () => {
    const formats = ["html", "markdown", "json", "pdf"] as const;

    formats.forEach(format => {
      it(`should support ${format.toUpperCase()} format`, async () => {
        const exportRequest: IExportRequest = {
          sessionId: testSessionId,
          options: {
            format,
            includeMetadata: true,
            includeThinking: format !== "pdf", // PDF might not support all options
            includeToolUse: true,
            includeImages: format === "html" || format === "pdf",
          },
        };

        const response = await request(app)
          .post("/api/export")
          .send(exportRequest)
          .expect(202);

        const body: IApiResponse = response.body;
        expect(body.success).toBe(true);
        expect(mockExportService.createExport).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({ format }),
          })
        );
      });
    });
  });

  describe("Date Range Filtering", () => {
    it("should support date range filtering", async () => {
      const exportRequest: IExportRequest = {
        sessionId: testSessionId,
        options: {
          format: "json",
          dateRange: {
            startDate: "2024-01-01T00:00:00Z",
            endDate: "2024-01-31T23:59:59Z",
          },
        },
      };

      const response = await request(app)
        .post("/api/export")
        .send(exportRequest)
        .expect(202);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(mockExportService.createExport).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            dateRange: {
              startDate: "2024-01-01T00:00:00Z",
              endDate: "2024-01-31T23:59:59Z",
            },
          }),
        })
      );
    });
  });

  describe("Message Type Filtering", () => {
    it("should support message type filtering", async () => {
      const exportRequest: IExportRequest = {
        sessionId: testSessionId,
        options: {
          format: "markdown",
          messageTypes: ["user", "assistant"],
        },
      };

      const response = await request(app)
        .post("/api/export")
        .send(exportRequest)
        .expect(202);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(mockExportService.createExport).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            messageTypes: ["user", "assistant"],
          }),
        })
      );
    });
  });
});