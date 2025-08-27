import { FileMonitor } from "../../services/fileMonitor";
import fs from "fs";
import chokidar from "chokidar";

import type { Mocked } from "vitest";

// Mock dependencies
vi.mock("fs");
vi.mock("chokidar");
vi.mock("../../websocket/server");

const mockFs = fs as Mocked<typeof fs>;
const mockChokidar = chokidar as Mocked<typeof chokidar>;

// Mock WebSocket manager
const mockWebSocketManager = {
  broadcastFileChanged: vi.fn(),
  broadcastSessionCreated: vi.fn(),
  broadcastSessionUpdated: vi.fn(),
  broadcastSessionDeleted: vi.fn(),
};

vi.mock("../../websocket/server", () => ({
  getWebSocketManager: () => mockWebSocketManager,
}));

describe("FileMonitor", () => {
  let fileMonitor: FileMonitor;
  let mockWatcher: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock watcher
    mockWatcher = {
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockChokidar.watch = vi.fn().mockReturnValue(mockWatcher);
    mockFs.existsSync.mockReturnValue(true);

    fileMonitor = new FileMonitor();
  });

  afterEach(() => {
    if (fileMonitor) {
      fileMonitor.stop();
    }
  });

  describe("Initialization and Configuration", () => {
    it("should initialize with correct default settings", () => {
      expect(fileMonitor.getStatus().isActive).toBe(false);
      expect(fileMonitor.getStatus().watcherCount).toBe(0);
    });

    it("should start monitoring with default paths", () => {
      fileMonitor.start();

      expect(fileMonitor.getStatus().isActive).toBe(true);
      expect(mockChokidar.watch).toHaveBeenCalled();
    });

    it("should start monitoring with custom paths", () => {
      const customPaths = ["/custom/path1", "/custom/path2"];
      mockFs.existsSync.mockImplementation((path) =>
        customPaths.includes(path.toString()),
      );

      fileMonitor.start(customPaths);

      expect(mockChokidar.watch).toHaveBeenCalledTimes(2);
      expect(fileMonitor.getStatus().isActive).toBe(true);
    });

    it("should handle non-existent paths gracefully", () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        fileMonitor.start(["/nonexistent/path"]);
      }).not.toThrow();

      expect(fileMonitor.getStatus().watcherCount).toBe(0);
    });

    it("should prevent multiple start calls", () => {
      fileMonitor.start();
      fileMonitor.start(); // Second call

      expect(fileMonitor.getStatus().isActive).toBe(true);
      // Should only create watchers once
    });
  });

  describe("File Change Detection", () => {
    beforeEach(() => {
      fileMonitor.start(["/test/path"]);
    });

    it("should detect file creation events", async () => {
      const addHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "add",
      )[1];

      addHandler("test.jsonl");

      // Wait for debounce delay (1000ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledWith(
        expect.stringContaining("test.jsonl"),
        "created",
      );
    });

    it("should detect file modification events", async () => {
      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];

      changeHandler("test.jsonl");

      // Wait for debounce delay (1000ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledWith(
        expect.stringContaining("test.jsonl"),
        "modified",
      );
    });

    it("should detect file deletion events", async () => {
      const unlinkHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "unlink",
      )[1];

      unlinkHandler("test.jsonl");

      // Wait for debounce delay (1000ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledWith(
        expect.stringContaining("test.jsonl"),
        "deleted",
      );
    });

    it("should debounce rapid file changes", async () => {
      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];

      // Trigger multiple rapid changes
      changeHandler("test.jsonl");
      changeHandler("test.jsonl");
      changeHandler("test.jsonl");

      // Wait less than debounce delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(mockWebSocketManager.broadcastFileChanged).not.toHaveBeenCalled();

      // Wait for debounce to complete
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Should only fire once
      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  describe("JSONL File Parsing", () => {
    beforeEach(() => {
      fileMonitor.start(["/test/path"]);
    });

    it("should parse JSONL content and detect new sessions", async () => {
      const testJsonlContent = JSON.stringify({
        sessionId: "new-session-123",
        timestamp: "2024-01-01T00:00:00Z",
        cwd: "/test/project",
        type: "user",
        message: { role: "user", content: "Hello" },
      });

      mockFs.readFileSync.mockReturnValue(testJsonlContent);

      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];
      changeHandler("test.jsonl");

      // Wait for debounce delay
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(mockWebSocketManager.broadcastSessionCreated).toHaveBeenCalledWith(
        "new-session-123",
        "/test/project",
      );
    });

    it("should detect session updates for existing sessions", async () => {
      const testJsonlContent = [
        {
          sessionId: "existing-session-456",
          timestamp: "2024-01-01T00:00:00Z",
          cwd: "/test/project",
          type: "user",
          message: { role: "user", content: "First message" },
        },
        {
          sessionId: "existing-session-456",
          timestamp: "2024-01-01T00:01:00Z",
          cwd: "/test/project",
          type: "assistant",
          message: { role: "assistant", content: "Response" },
        },
      ]
        .map((entry) => JSON.stringify(entry))
        .join("\n");

      mockFs.readFileSync.mockReturnValue(testJsonlContent);

      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];
      changeHandler("test.jsonl");

      // Wait for debounce delay
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(mockWebSocketManager.broadcastSessionUpdated).toHaveBeenCalledWith(
        "existing-session-456",
        "/test/project",
        2,
      );
    });

    it("should handle corrupted JSONL lines gracefully", async () => {
      const testJsonlContent = [
        '{"valid": "json", "sessionId": "test-123", "cwd": "/test"}',
        "invalid-json-line",
        '{"another": "valid", "sessionId": "test-456", "cwd": "/test"}',
      ].join("\n");

      mockFs.readFileSync.mockReturnValue(testJsonlContent);

      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];
      changeHandler("test.jsonl");

      // Wait for debounce delay
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should still process valid lines
      expect(
        mockWebSocketManager.broadcastSessionCreated,
      ).toHaveBeenCalledTimes(2);
    });

    it("should handle empty JSONL files", async () => {
      mockFs.readFileSync.mockReturnValue("");

      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];
      changeHandler("test.jsonl");

      // Wait for debounce delay
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(
        mockWebSocketManager.broadcastSessionCreated,
      ).not.toHaveBeenCalled();
      expect(
        mockWebSocketManager.broadcastSessionUpdated,
      ).not.toHaveBeenCalled();
    });

    it("should handle file read errors", async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("File read error");
      });

      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];

      expect(() => {
        changeHandler("test.jsonl");
      }).not.toThrow();

      // Wait for debounce delay to ensure async processing completes
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });
  });

  describe("File State Tracking", () => {
    beforeEach(() => {
      fileMonitor.start(["/test/path"]);
    });

    it("should track file modifications to prevent duplicate events", async () => {
      const testStats = {
        size: 1024,
        mtime: new Date("2024-01-01T00:00:00Z"),
      };

      mockFs.statSync.mockReturnValue(testStats as any);

      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];

      // First change
      changeHandler("test.jsonl");
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Same file state - should not trigger again
      changeHandler("test.jsonl");
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledTimes(
        1,
      );
    });

    it("should detect actual file changes when stats differ", async () => {
      mockFs.statSync
        .mockReturnValueOnce({
          size: 1024,
          mtime: new Date("2024-01-01T00:00:00Z"),
        } as any)
        .mockReturnValueOnce({
          size: 2048,
          mtime: new Date("2024-01-01T00:01:00Z"),
        } as any);

      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];

      // First change
      changeHandler("test.jsonl");
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // File actually changed
      changeHandler("test.jsonl");
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledTimes(
        2,
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle watcher errors gracefully", () => {
      fileMonitor.start(["/test/path"]);

      const errorHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "error",
      )[1];

      expect(() => {
        errorHandler(new Error("Watcher error"));
      }).not.toThrow();
    });

    it("should handle chokidar initialization errors", () => {
      mockChokidar.watch.mockImplementation(() => {
        throw new Error("Chokidar initialization failed");
      });

      expect(() => {
        fileMonitor.start(["/test/path"]);
      }).not.toThrow();

      expect(fileMonitor.getStatus().watcherCount).toBe(0);
    });
  });

  describe("Cleanup and Shutdown", () => {
    it("should stop monitoring and clean up watchers", async () => {
      fileMonitor.start(["/test/path"]);

      expect(fileMonitor.getStatus().isActive).toBe(true);

      fileMonitor.stop();

      expect(fileMonitor.getStatus().isActive).toBe(false);
      expect(fileMonitor.getStatus().watcherCount).toBe(0);
      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it("should clear all debounce timers on stop", async () => {
      fileMonitor.start(["/test/path"]);

      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];
      changeHandler("test.jsonl");

      // Stop before debounce completes
      fileMonitor.stop();

      // Wait longer than debounce delay
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Should not fire after stop
      expect(mockWebSocketManager.broadcastFileChanged).not.toHaveBeenCalled();
    });

    it("should handle stop when not started", () => {
      expect(() => {
        fileMonitor.stop();
      }).not.toThrow();
    });

    it("should handle watcher close errors", async () => {
      mockWatcher.close.mockRejectedValue(new Error("Close failed"));

      fileMonitor.start(["/test/path"]);

      expect(() => {
        fileMonitor.stop();
      }).not.toThrow();
    });
  });

  describe("Status Reporting", () => {
    it("should report correct status when inactive", () => {
      const status = fileMonitor.getStatus();

      expect(status.isActive).toBe(false);
      expect(status.watcherCount).toBe(0);
      expect(status.monitoredFiles).toBe(0);
    });

    it("should report correct status when active", () => {
      fileMonitor.start(["/test/path1", "/test/path2"]);

      const status = fileMonitor.getStatus();

      expect(status.isActive).toBe(true);
      expect(status.watcherCount).toBe(2);
    });

    it("should track monitored files count", async () => {
      fileMonitor.start(["/test/path"]);

      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];

      mockFs.statSync.mockReturnValue({ size: 1024, mtime: new Date() } as any);

      changeHandler("file1.jsonl");
      changeHandler("file2.jsonl");
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const status = fileMonitor.getStatus();
      expect(status.monitoredFiles).toBe(2);
    });
  });

  describe("Event Emission", () => {
    it("should emit fileChanged events", async () => {
      let eventReceived = false;
      let receivedEvent: any;

      fileMonitor.on("fileChanged", (event) => {
        eventReceived = true;
        receivedEvent = event;
      });

      fileMonitor.start(["/test/path"]);

      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];
      changeHandler("test.jsonl");

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(eventReceived).toBe(true);
      expect(receivedEvent.type).toBe("modified");
      expect(receivedEvent.filePath).toContain("test.jsonl");
      expect(receivedEvent.timestamp).toBeDefined();
    });

    it("should emit sessionChanged events", async () => {
      let eventReceived = false;
      let receivedEvent: any;

      const testJsonlContent = JSON.stringify({
        sessionId: "test-session-789",
        timestamp: "2024-01-01T00:00:00Z",
        cwd: "/test/project",
        type: "user",
      });

      mockFs.readFileSync.mockReturnValue(testJsonlContent);

      fileMonitor.on("sessionChanged", (event) => {
        eventReceived = true;
        receivedEvent = event;
      });

      fileMonitor.start(["/test/path"]);

      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === "change",
      )[1];
      changeHandler("test.jsonl");

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(eventReceived).toBe(true);
      expect(receivedEvent.type).toBe("session_created");
      expect(receivedEvent.sessionId).toBe("test-session-789");
      expect(receivedEvent.cwd).toBe("/test/project");
    });
  });
});
