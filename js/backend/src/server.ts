import app from "./app";
import { createServer } from "http";
import { getWebSocketManager } from "./websocket/server";
import { getFileMonitor } from "./services/fileMonitor";
import { getMonitoringService } from "./services/monitoring.service";
import {
  handleUncaughtException,
  handleUnhandledRejection,
} from "./middleware/errorHandler";

// Handle uncaught exceptions and unhandled rejections
process.on("uncaughtException", handleUncaughtException);
process.on("unhandledRejection", handleUnhandledRejection);

const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = createServer(app);

// Start WebSocket server attached to HTTP server
const wsManager = getWebSocketManager();

// Start file monitor
const fileMonitor = getFileMonitor();

// Start monitoring service
const monitoring = getMonitoringService();

server.listen(PORT, async () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

  try {
    await wsManager.start(0, server); // 0 means use the same port as HTTP server
    console.log(`🔌 WebSocket server started at ws://localhost:${PORT}/ws`);

    // Start file monitoring
    fileMonitor.start();
    console.log(`📁 File monitor started for JSONL files`);

    // Start monitoring - TEMPORARILY DISABLED due to memory leak
    // monitoring.start();
    console.log(`📊 System monitoring disabled temporarily`);
  } catch (error) {
    console.error("Failed to start WebSocket server:", error);
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  monitoring.stop();
  fileMonitor.stop();
  await wsManager.stop();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  monitoring.stop();
  fileMonitor.stop();
  await wsManager.stop();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
