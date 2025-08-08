# WebSocket Event System Documentation

## Overview

The WebSocket Event System is a comprehensive real-time event management solution built on top of Socket.IO. It provides structured event types, filtering, subscription management, history tracking, and event replay functionality.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client        │◄──►│  WebSocketService│◄──►│  EventManager   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        ▼
         │                        │               ┌─────────────────┐
         │                        │               │   Middleware    │
         │                        │               │   Pipeline      │
         │                        │               └─────────────────┘
         │                        ▼                        │
         │               ┌─────────────────┐               ▼
         │               │ ConnectionManager│      ┌─────────────────┐
         │               └─────────────────┘      │  Event History  │
         │                                        │   & Replay      │
         ▼                                        └─────────────────┘
┌─────────────────┐
│   REST API      │
│   Endpoints     │
└─────────────────┘
```

## Event Types

### File Events
- `file:created` - New file created
- `file:modified` - File content changed
- `file:deleted` - File removed
- `file:renamed` - File name changed
- `file:moved` - File moved to different location
- `file:executed` - File executed (scripts, programs)

### User Action Events
- `user:joined` - User joined session/room
- `user:left` - User left session/room
- `user:typing` - User is typing
- `user:idle` - User became idle
- `user:active` - User became active

### Session Events
- `session:created` - New collaboration session created
- `session:updated` - Session settings/metadata changed
- `session:deleted` - Session removed
- `session:shared` - Session shared with other users

### Code Events
- `code:changed` - Code content modified
- `code:saved` - Code saved to file
- `code:executed` - Code executed
- `code:error` - Code execution error

### Message Events
- `message:sent` - New message posted
- `message:edited` - Message content changed
- `message:deleted` - Message removed

### System Events
- `system:notification` - System notification
- `system:error` - System error occurred
- `system:maintenance` - System maintenance mode

### Custom Events
- `custom:event` - Application-specific events

## Event Structure

All events implement the `BaseEvent` interface:

```typescript
interface BaseEvent {
  id: string;           // Unique event identifier
  type: EventType;      // Event type (see above)
  timestamp: string;    // ISO timestamp
  userId?: string;      // User who triggered the event
  sessionId?: string;   // Associated session
  metadata?: Record<string, any>; // Additional context
}
```

### Example Events

#### File Event
```typescript
{
  id: "uuid-here",
  type: "file:created",
  timestamp: "2025-01-15T10:30:00Z",
  userId: "user123",
  sessionId: "session456",
  data: {
    filePath: "/src/components/Button.tsx",
    fileName: "Button.tsx",
    fileSize: 1024,
    mimeType: "text/typescript"
  }
}
```

#### User Action Event
```typescript
{
  id: "uuid-here",
  type: "user:joined",
  timestamp: "2025-01-15T10:30:00Z",
  userId: "user123",
  sessionId: "session456",
  data: {
    userId: "user123",
    userName: "Alice",
    action: "joined_session",
    target: "session456"
  }
}
```

## WebSocket API

### Client-to-Server Events

#### Event Subscription
```typescript
// Subscribe to events with filter
socket.emit('subscribe-events', filter, (subscriptionId) => {
  console.log('Subscribed with ID:', subscriptionId);
});

// Unsubscribe from events
socket.emit('unsubscribe-events', subscriptionId);
```

#### Publishing Events
```typescript
// Publish a new event
socket.emit('publish-event', {
  type: 'code:changed',
  data: {
    filePath: '/src/app.js',
    language: 'javascript',
    changes: {
      startLine: 10,
      endLine: 15,
      content: 'updated code here'
    }
  }
});
```

#### Event History & Replay
```typescript
// Request event history
socket.emit('request-event-history', filter, page, pageSize, (history) => {
  console.log('Event history:', history);
});

// Request event replay
socket.emit('request-event-replay', filter, startTime);
```

### Server-to-Client Events

#### Receiving Events
```typescript
// Listen for application events
socket.on('app-event', (event) => {
  console.log('New event:', event);
});

// Listen for global event summaries
socket.on('app-event-global', (summary) => {
  console.log('Global event:', summary);
});

// Event replay events
socket.on('event-replay-start', ({ count }) => {
  console.log(`Starting replay of ${count} events`);
});

socket.on('event-replay-end', () => {
  console.log('Event replay completed');
});
```

## Event Filtering

### Filter Options
```typescript
interface EventFilter {
  types?: EventType[];      // Filter by event types
  userId?: string;          // Filter by user
  sessionId?: string;       // Filter by session
  filePath?: string;        // Filter by file path
  tags?: string[];          // Filter by tags
  dateRange?: {             // Filter by date range
    start: Date;
    end: Date;
  };
}
```

### Example Filters
```typescript
// File events only
const fileFilter = {
  types: ['file:created', 'file:modified', 'file:deleted']
};

// User-specific events
const userFilter = {
  userId: 'user123'
};

// Session events in date range
const sessionFilter = {
  types: ['session:created', 'session:updated'],
  dateRange: {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31')
  }
};
```

## REST API Endpoints

### Event Statistics
```http
GET /api/websocket/events/stats
```
Returns event system statistics including total events, events by type, and recent activity.

### Event History
```http
GET /api/websocket/events/history?types=file:created,file:modified&userId=user123&page=1&pageSize=50
```
Query parameters:
- `types` - Comma-separated event types
- `userId` - Filter by user ID
- `sessionId` - Filter by session ID
- `filePath` - Filter by file path
- `tags` - Comma-separated tags
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 50)

### Publish Event
```http
POST /api/websocket/events/publish
Content-Type: application/json

{
  "type": "system:notification",
  "data": {
    "level": "info",
    "title": "System Update",
    "message": "System will restart in 5 minutes"
  },
  "userId": "admin",
  "metadata": {
    "priority": "high"
  }
}
```

### Cleanup Old Events
```http
DELETE /api/websocket/events/cleanup
Content-Type: application/json

{
  "olderThan": "2025-01-01T00:00:00Z"
}
```

## Event Middleware

The system supports middleware for event processing. Middleware functions run in sequence and can:
- Validate events
- Filter/block events
- Transform event data
- Add metadata
- Log events

### Built-in Middleware

1. **Event Enrichment** - Adds metadata like socket info, server timestamp
2. **Rate Limiting** - Prevents event spam
3. **User Permissions** - Enforces user-based access control
4. **Content Filtering** - Filters inappropriate content
5. **File Validation** - Validates file operations
6. **Audit Logging** - Logs important events
7. **Error Handling** - Validates event structure

### Custom Middleware Example
```typescript
const customMiddleware: EventMiddleware = async (event, socket) => {
  // Add custom validation logic
  if (event.type === 'file:deleted' && !event.userId) {
    console.log('Blocked: File deletion requires authentication');
    return false; // Block event
  }
  
  // Add custom metadata
  if (!event.metadata) event.metadata = {};
  event.metadata.processed = true;
  
  return true; // Allow event
};

// Add to WebSocket service
webSocketService.addEventMiddleware(customMiddleware);
```

## Usage Examples

### Basic Event Subscription
```typescript
// Client-side
const socket = io();

// Subscribe to all file events
socket.emit('subscribe-events', {
  types: ['file:created', 'file:modified', 'file:deleted']
}, (subscriptionId) => {
  console.log('Subscribed to file events');
});

// Listen for events
socket.on('app-event', (event) => {
  if (event.type.startsWith('file:')) {
    console.log('File event:', event);
    updateFileUI(event);
  }
});
```

### Real-time Collaboration
```typescript
// Track user actions in a session
socket.emit('subscribe-events', {
  types: ['user:joined', 'user:left', 'user:typing'],
  sessionId: currentSessionId
}, (subscriptionId) => {
  console.log('Subscribed to user events');
});

socket.on('app-event', (event) => {
  switch (event.type) {
    case 'user:joined':
      showUserJoined(event.data.userId);
      break;
    case 'user:left':
      showUserLeft(event.data.userId);
      break;
    case 'user:typing':
      showUserTyping(event.data.userId);
      break;
  }
});
```

### Event History Replay
```typescript
// Replay events from the last hour
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

socket.emit('request-event-replay', {
  types: ['code:changed', 'file:modified'],
  sessionId: currentSessionId
}, oneHourAgo.toISOString());

socket.on('event-replay-start', ({ count }) => {
  console.log(`Replaying ${count} events`);
});

socket.on('app-event', (event) => {
  // Process replayed events
  applyEventToEditor(event);
});

socket.on('event-replay-end', () => {
  console.log('Replay completed');
});
```

### Publishing Custom Events
```typescript
// Publish a custom application event
socket.emit('publish-event', {
  type: 'custom:event',
  data: {
    eventName: 'user_achievement',
    payload: {
      achievement: 'first_contribution',
      points: 100,
      badge: 'contributor'
    }
  }
});
```

## Configuration

### Environment Variables
- `MAX_EVENT_HISTORY_SIZE` - Maximum events to keep in memory (default: 10000)
- `EVENT_CLEANUP_INTERVAL` - Interval for cleaning up old events (default: 1 hour)

### Middleware Configuration
```typescript
// Development - permissive
webSocketService.addEventMiddleware(developmentEventMiddleware);

// Production - strict security
webSocketService.addEventMiddleware(productionEventMiddleware);

// Custom configuration
const customMiddleware = [
  eventEnrichmentMiddleware,
  customValidationMiddleware,
  auditLogMiddleware
];
```

## Performance Considerations

1. **Event History Size** - Configure appropriate history limits
2. **Subscription Filtering** - Use specific filters to reduce network traffic  
3. **Middleware Performance** - Keep middleware functions lightweight
4. **Rate Limiting** - Implement appropriate rate limits for event publishing
5. **Memory Usage** - Regular cleanup of old events and inactive subscriptions

## Security

1. **Authentication Required** - Event publishing requires authentication
2. **Permission Checks** - Middleware validates user permissions
3. **Content Filtering** - Automatic filtering of inappropriate content  
4. **Rate Limiting** - Protection against event spam
5. **Audit Logging** - All important events are logged
6. **Input Validation** - All event data is validated

## Monitoring

The system provides comprehensive monitoring through:
- Event statistics (total events, events by type)
- Connection statistics
- Rate limiting metrics
- Audit logs
- Real-time event stream monitoring

Access monitoring data via REST endpoints or WebSocket events.