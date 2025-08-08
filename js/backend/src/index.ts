import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';
import { validateContentType } from './middleware/validation';
import config from './config/env';
import WebSocketService from './services/websocket';

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

// Make WebSocket service available to routes via app.locals
app.locals.webSocketService = webSocketService;

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing servers');
  
  // Close WebSocket connections first
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
});

export default app;
export { webSocketService };
