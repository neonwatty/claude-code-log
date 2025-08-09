import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';
import { validateContentType } from './middleware/validation';
import config from './config/env';
import WebSocketService from './services/websocket';
import FileSystemMonitor from './services/fileSystemMonitor';

const app = express();
const httpServer = createServer(app);

// Global middleware
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);
app.use(validateContentType);

// API routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize WebSocket service
const webSocketService = new WebSocketService(httpServer);

// Initialize File System Monitor if enabled
let fileSystemMonitor: FileSystemMonitor | null = null;
if (config.fileMonitoring?.enabled && config.fileMonitoring.watchPaths && config.fileMonitoring.watchPaths.length > 0) {
  fileSystemMonitor = new FileSystemMonitor({
    watchPaths: config.fileMonitoring.watchPaths,
    debounceMs: config.fileMonitoring.debounceMs,
    webSocketService,
  });
  
  // Start monitoring
  fileSystemMonitor.start().catch(error => {
    console.error('Failed to start file system monitor:', error);
  });
}

// Make services available to routes via app.locals
app.locals.webSocketService = webSocketService;
app.locals.fileSystemMonitor = fileSystemMonitor;

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing servers');
  
  // Stop file system monitor first
  if (fileSystemMonitor) {
    await fileSystemMonitor.stop();
  }
  
  // Close WebSocket connections
  await webSocketService.close();
  
  // Then close HTTP server
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
});

httpServer.listen(config.port, () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
  console.log(`🔌 WebSocket server initialized`);
  if (fileSystemMonitor) {
    const status = fileSystemMonitor.getStatus();
    console.log(`📁 File system monitor active, watching ${status.watchPaths.length} paths`);
  }
});

export default app;
export { webSocketService, fileSystemMonitor };
