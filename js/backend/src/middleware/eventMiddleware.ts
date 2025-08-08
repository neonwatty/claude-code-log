import { AppEvent, TypedSocket } from '../types/websocket';
import { EventMiddleware } from '../services/eventManager';

// Rate limiting middleware for events
export const eventRateLimitMiddleware: EventMiddleware = async (
  event: AppEvent,
  socket?: TypedSocket
): Promise<boolean> => {
  // Skip rate limiting for system events
  if (event.type.startsWith('system:')) {
    return true;
  }

  // For now, just log the event - could implement sophisticated rate limiting
  if (socket) {
    console.log(`Event rate check for ${event.type} from ${socket.id}`);
  }

  return true;
};

// Content filtering middleware
export const contentFilterMiddleware: EventMiddleware = async (
  event: AppEvent
): Promise<boolean> => {
  // Filter profanity or sensitive content in message events
  if (event.type.startsWith('message:') && 'data' in event && 'content' in event.data) {
    const content = event.data.content as string;
    const forbiddenWords = ['spam', 'hack', 'exploit']; // Simple example
    
    if (forbiddenWords.some(word => content.toLowerCase().includes(word))) {
      console.log(`Content filtered: Event ${event.id} blocked for inappropriate content`);
      return false;
    }
  }

  return true;
};

// User permission middleware
export const userPermissionMiddleware: EventMiddleware = async (
  event: AppEvent,
  socket?: TypedSocket
): Promise<boolean> => {
  // Only authenticated users can create certain events
  const restrictedEvents = ['file:deleted', 'session:deleted', 'system:maintenance'];
  
  if (restrictedEvents.includes(event.type)) {
    if (!event.userId || !socket?.data?.userId) {
      console.log(`Permission denied: Event ${event.type} requires authentication`);
      return false;
    }

    // Could add role-based permissions here
    // For example, only admins can create system events
    if (event.type.startsWith('system:')) {
      // Simple example - in real app, check user roles from database
      const isAdmin = event.userId === 'admin' || socket?.data?.userId === 'admin';
      if (!isAdmin) {
        console.log(`Permission denied: System events require admin role`);
        return false;
      }
    }
  }

  return true;
};

// Event enrichment middleware
export const eventEnrichmentMiddleware: EventMiddleware = async (
  event: AppEvent,
  socket?: TypedSocket
): Promise<boolean> => {
  // Add additional context to events
  if (!event.metadata) {
    event.metadata = {};
  }

  // Add socket information if available
  if (socket) {
    event.metadata.socketId = socket.id;
    event.metadata.ipAddress = socket.data.ipAddress;
    event.metadata.userAgent = socket.data.userAgent;
    event.metadata.connectionId = socket.data.connectionId;
  }

  // Add server timestamp
  event.metadata.serverTimestamp = new Date().toISOString();

  // Add event source
  event.metadata.source = socket ? 'websocket' : 'rest_api';

  return true;
};

// Audit logging middleware
export const auditLogMiddleware: EventMiddleware = async (
  event: AppEvent,
  socket?: TypedSocket
): Promise<boolean> => {
  // Log important events for auditing
  const auditableEvents = [
    'file:deleted', 
    'session:deleted', 
    'user:joined', 
    'user:left',
    'system:maintenance',
    'system:error'
  ];

  if (auditableEvents.includes(event.type)) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      eventId: event.id,
      eventType: event.type,
      userId: event.userId,
      sessionId: event.sessionId,
      socketId: socket?.id,
      ipAddress: socket?.data?.ipAddress,
      data: event.data
    };

    console.log('AUDIT LOG:', JSON.stringify(auditEntry, null, 2));
    
    // In production, you would save this to a secure audit log database
    // await saveAuditLog(auditEntry);
  }

  return true;
};

// File event validation middleware
export const fileEventValidationMiddleware: EventMiddleware = async (
  event: AppEvent
): Promise<boolean> => {
  if (event.type.startsWith('file:')) {
    const fileEvent = event as any; // Type assertion for file events
    
    if (!fileEvent.data?.filePath) {
      console.log(`Invalid file event: Missing filePath`);
      return false;
    }

    // Validate file paths
    const filePath = fileEvent.data.filePath;
    
    // Block access to sensitive directories
    const restrictedPaths = ['/etc/', '/root/', '/home/', '..', '~'];
    if (restrictedPaths.some(path => filePath.includes(path))) {
      console.log(`Security violation: Access to restricted path ${filePath}`);
      return false;
    }

    // Validate file extensions for certain operations
    if (event.type === 'file:executed') {
      const allowedExecutableExtensions = ['.js', '.ts', '.py', '.sh'];
      const extension = filePath.substring(filePath.lastIndexOf('.'));
      
      if (!allowedExecutableExtensions.includes(extension)) {
        console.log(`Security violation: Execution of ${extension} files not allowed`);
        return false;
      }
    }
  }

  return true;
};

// Session event validation middleware
export const sessionEventValidationMiddleware: EventMiddleware = async (
  event: AppEvent,
  socket?: TypedSocket
): Promise<boolean> => {
  if (event.type.startsWith('session:')) {
    const sessionEvent = event as any;
    
    if (!sessionEvent.data?.sessionId) {
      console.log(`Invalid session event: Missing sessionId`);
      return false;
    }

    // Validate session permissions
    if (socket && socket.data.sessionId !== sessionEvent.data.sessionId) {
      // User trying to manipulate a session they're not part of
      console.log(`Permission denied: User not authorized for session ${sessionEvent.data.sessionId}`);
      return false;
    }
  }

  return true;
};

// Error handling middleware (should be last)
export const errorHandlingMiddleware: EventMiddleware = async (
  event: AppEvent,
  socket?: TypedSocket
): Promise<boolean> => {
  try {
    // Validate event structure
    if (!event.id || !event.type || !event.timestamp) {
      console.error(`Malformed event:`, event);
      return false;
    }

    // Check for potential security issues
    const dataString = JSON.stringify(event.data);
    if (dataString.length > 50000) {
      console.log(`Event data too large: ${dataString.length} characters`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in event processing:', error);
    return false;
  }
};

// Export all middleware as an array for easy setup
export const defaultEventMiddleware = [
  eventEnrichmentMiddleware,    // Add metadata first
  errorHandlingMiddleware,      // Validate structure
  userPermissionMiddleware,     // Check permissions
  fileEventValidationMiddleware, // Validate file events
  sessionEventValidationMiddleware, // Validate session events
  contentFilterMiddleware,      // Filter content
  eventRateLimitMiddleware,     // Rate limiting
  auditLogMiddleware           // Audit logging (last)
];

// Development middleware (more permissive)
export const developmentEventMiddleware = [
  eventEnrichmentMiddleware,
  errorHandlingMiddleware,
  auditLogMiddleware
];

// Production middleware (strict security)
export const productionEventMiddleware = [
  eventEnrichmentMiddleware,
  errorHandlingMiddleware,
  userPermissionMiddleware,
  fileEventValidationMiddleware,
  sessionEventValidationMiddleware,
  contentFilterMiddleware,
  eventRateLimitMiddleware,
  auditLogMiddleware
];