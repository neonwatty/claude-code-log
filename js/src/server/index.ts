import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});

// Environment variables
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-eval'"],
        connectSrc: ["'self'", 'ws://localhost:3001', 'http://localhost:3001'],
      },
    },
  })
);
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
    credentials: true,
  })
);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (in production, serve the built client)
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client')));
}

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '1.0.0',
  });
});

// API routes placeholder
app.get('/api/sessions', (req, res) => {
  res.json({
    message: 'Sessions endpoint - to be implemented',
    data: [],
  });
});

// WebSocket connection handling
io.on('connection', socket => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Placeholder for real-time updates
  socket.on('join-session', (sessionId: string) => {
    socket.join(`session-${sessionId}`);
    console.log(`Client ${socket.id} joined session ${sessionId}`);
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 handler
app.use('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    // In production, serve the SPA
    if (NODE_ENV === 'production') {
      res.sendFile(path.join(__dirname, '../client/index.html'));
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${NODE_ENV}`);

  if (NODE_ENV === 'development') {
    console.log(`🔗 Frontend dev server: http://localhost:3000`);
    console.log(`📡 WebSocket server: ws://localhost:${PORT}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;
