import { Router, Request, Response } from 'express';
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