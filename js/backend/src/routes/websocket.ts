import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import WebSocketService from '../services/websocket';

const router = Router();

// Get WebSocket connection statistics
router.get('/stats', (req: Request, res: Response) => {
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  const basicStats = {
    connectedClients: webSocketService.getConnectedClients(),
    timestamp: new Date().toISOString(),
  };

  const enhancedStats = webSocketService.getConnectionStats();

  const stats = {
    ...basicStats,
    enhanced: {
      totalConnections: enhancedStats.totalConnections,
      activeConnections: enhancedStats.activeConnections,
      averageConnectionDuration: enhancedStats.averageConnectionDuration,
      totalReconnects: enhancedStats.totalReconnects,
      heartbeatStats: enhancedStats.heartbeatStats,
      connectionsPerUser: Object.fromEntries(enhancedStats.connectionsPerUser),
      connectionsPerIP: Object.fromEntries(enhancedStats.connectionsPerIP),
    },
  };

  res.json(stats);
});

// Get clients in a specific session
router.get('/session/:sessionId/clients', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  try {
    const clients = await webSocketService.getSessionClients(sessionId);
    res.json({
      sessionId,
      clientCount: clients.length,
      clients: clients,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session clients' });
  }
});

// Broadcast message to a session (for testing)
router.post('/session/:sessionId/broadcast', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { event, data } = req.body;
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  if (!event) {
    return res.status(400).json({ error: 'Event name is required' });
  }

  webSocketService.broadcastToSession(sessionId, event, data);
  
  res.json({
    success: true,
    message: `Broadcasted '${event}' to session '${sessionId}'`,
    timestamp: new Date().toISOString(),
  });
});

// Broadcast message to a user (for testing)
router.post('/user/:userId/broadcast', (req: Request, res: Response) => {
  const { userId } = req.params;
  const { event, data } = req.body;
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  if (!event) {
    return res.status(400).json({ error: 'Event name is required' });
  }

  webSocketService.broadcastToUser(userId, event, data);
  
  res.json({
    success: true,
    message: `Broadcasted '${event}' to user '${userId}'`,
    timestamp: new Date().toISOString(),
  });
});

// Broadcast message to all connected clients (for testing)
router.post('/broadcast', (req: Request, res: Response) => {
  const { event, data } = req.body;
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  if (!event) {
    return res.status(400).json({ error: 'Event name is required' });
  }

  webSocketService.broadcastToAll(event, data);
  
  res.json({
    success: true,
    message: `Broadcasted '${event}' to all connected clients`,
    connectedClients: webSocketService.getConnectedClients(),
    timestamp: new Date().toISOString(),
  });
});

// Get connection info for a specific socket
router.get('/connection/:socketId', (req: Request, res: Response) => {
  const { socketId } = req.params;
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  const connectionInfo = webSocketService.getConnectionInfo(socketId);
  
  if (!connectionInfo) {
    return res.status(404).json({ error: 'Connection not found' });
  }

  res.json(connectionInfo);
});

// Get all connections for a user
router.get('/user/:userId/connections', (req: Request, res: Response) => {
  const { userId } = req.params;
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  const connections = webSocketService.getUserConnections(userId);
  
  res.json({
    userId,
    connectionCount: connections.length,
    connections,
  });
});

// Get all connections from an IP
router.get('/ip/:ipAddress/connections', (req: Request, res: Response) => {
  const { ipAddress } = req.params;
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  // Decode IP address if it was URL encoded
  const decodedIP = decodeURIComponent(ipAddress);
  const connections = webSocketService.getIPConnections(decodedIP);
  
  res.json({
    ipAddress: decodedIP,
    connectionCount: connections.length,
    connections,
  });
});

// Event system endpoints

// Get event statistics
router.get('/events/stats', (req: Request, res: Response) => {
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  const stats = webSocketService.getEventStats();
  
  // Convert Map to object for JSON serialization
  const serializedStats = {
    ...stats,
    eventsByType: Object.fromEntries(stats.eventsByType)
  };

  res.json(serializedStats);
});

// Get event history
router.get('/events/history', (req: Request, res: Response) => {
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  const { 
    types, 
    userId, 
    sessionId, 
    filePath, 
    tags,
    page = 1, 
    pageSize = 50 
  } = req.query;

  const filter: any = {};
  
  if (types) {
    filter.types = (types as string).split(',');
  }
  if (userId) filter.userId = userId;
  if (sessionId) filter.sessionId = sessionId;
  if (filePath) filter.filePath = filePath;
  if (tags) {
    filter.tags = (tags as string).split(',');
  }

  const history = webSocketService.getEventHistory(
    Object.keys(filter).length > 0 ? filter : undefined,
    parseInt(page as string) || 1,
    parseInt(pageSize as string) || 50
  );

  res.json(history);
});

// Publish an event via REST API (for testing/integration)
router.post('/events/publish', async (req: Request, res: Response) => {
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  const { type, data, userId, sessionId, metadata } = req.body;

  if (!type || !data) {
    return res.status(400).json({ error: 'Event type and data are required' });
  }

  const event = {
    type,
    data,
    userId,
    sessionId,
    metadata,
    id: randomUUID(),
    timestamp: new Date().toISOString()
  };

  try {
    const published = await webSocketService.publishEvent(event);
    
    if (published) {
      res.json({
        success: true,
        message: 'Event published successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Event validation failed'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to publish event'
    });
  }
});

// Clean up old events
router.delete('/events/cleanup', (req: Request, res: Response) => {
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  const { olderThan } = req.body;
  
  if (!olderThan) {
    return res.status(400).json({ error: 'olderThan date is required' });
  }

  const cutoffDate = new Date(olderThan);
  if (isNaN(cutoffDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  const removedCount = webSocketService.cleanupEventHistory(cutoffDate);

  res.json({
    success: true,
    message: `Cleaned up ${removedCount} old events`,
    removedCount
  });
});

// Update connection limits
router.put('/limits', (req: Request, res: Response) => {
  const webSocketService = req.app.locals.webSocketService as WebSocketService;
  
  if (!webSocketService) {
    return res.status(500).json({ error: 'WebSocket service not available' });
  }

  const { 
    maxConnectionsPerUser, 
    maxConnectionsPerIP, 
    maxGlobalConnections,
    rateLimitWindow,
    maxEventsPerWindow 
  } = req.body;

  const limits: any = {};
  if (typeof maxConnectionsPerUser === 'number') limits.maxConnectionsPerUser = maxConnectionsPerUser;
  if (typeof maxConnectionsPerIP === 'number') limits.maxConnectionsPerIP = maxConnectionsPerIP;
  if (typeof maxGlobalConnections === 'number') limits.maxGlobalConnections = maxGlobalConnections;
  if (typeof rateLimitWindow === 'number') limits.rateLimitWindow = rateLimitWindow;
  if (typeof maxEventsPerWindow === 'number') limits.maxEventsPerWindow = maxEventsPerWindow;

  webSocketService.updateConnectionLimits(limits);

  res.json({
    success: true,
    message: 'Connection limits updated',
    updatedLimits: limits,
  });
});

export default router;