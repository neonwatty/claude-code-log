# WebSocket Message Protocol Documentation

## Overview

This directory contains the standardized WebSocket message protocol for real-time session updates in the Claude Code Log application. The protocol ensures type safety, runtime validation, and consistent communication between frontend and backend.

## Protocol Structure

### Base Message Format

All WebSocket messages follow this base structure:

```typescript
interface BaseMessage {
  type: MessageType; // Message type identifier
  timestamp: string; // ISO 8601 timestamp
  id: string; // Unique message ID (UUID)
}
```

### Message Types

The protocol defines four core message types for session management:

#### 1. SESSION_CREATED

Sent when a new session is created.

```typescript
interface SessionCreatedMessage {
  type: "SESSION_CREATED";
  timestamp: string;
  id: string;
  payload: {
    session: {
      sessionId: string;
      title?: string;
      createdAt?: string;
      updatedAt?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    };
  };
}
```

#### 2. SESSION_UPDATED

Sent when an existing session is modified.

```typescript
interface SessionUpdatedMessage {
  type: "SESSION_UPDATED";
  timestamp: string;
  id: string;
  payload: {
    session: SessionData;
    changes: {
      fields: string[]; // List of changed fields
      previousValues?: Partial<SessionData>; // Previous values for tracking
    };
  };
}
```

#### 3. SESSION_DELETED

Sent when a session is removed.

```typescript
interface SessionDeletedMessage {
  type: "SESSION_DELETED";
  timestamp: string;
  id: string;
  payload: {
    sessionId: string;
    deletedAt: string;
  };
}
```

#### 4. CACHE_INVALIDATED

Sent when caches need to be invalidated.

```typescript
interface CacheInvalidatedMessage {
  type: "CACHE_INVALIDATED";
  timestamp: string;
  id: string;
  payload: {
    scope: "all" | "session" | "specific";
    sessionIds?: string[]; // For specific invalidation
    reason: string;
  };
}
```

## Backend Implementation Reference

### Message Sending

When sending messages from the backend, ensure:

1. **Type Safety**: Use the TypeScript interfaces for message construction
2. **Unique IDs**: Generate UUID for each message
3. **Timestamp**: Use ISO 8601 format (`new Date().toISOString()`)
4. **Validation**: Validate message structure before sending

```typescript
// Example backend message creation
function createSessionCreatedMessage(
  session: SessionData,
): SessionCreatedMessage {
  return {
    type: "SESSION_CREATED",
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
    payload: { session },
  };
}
```

### Message Broadcasting

Consider these patterns for message broadcasting:

```typescript
// Broadcast to all connected clients
broadcastToAll(message);

// Broadcast to specific session subscribers
broadcastToSession(sessionId, message);

// Broadcast to project subscribers
broadcastToProject(projectPath, message);
```

### Error Handling

When message processing fails:

1. Log the error with context
2. Send an error response if applicable
3. Don't crash the WebSocket connection
4. Consider dead letter queuing for critical messages

```typescript
// Example error handling
try {
  await processMessage(message);
} catch (error) {
  console.error("Message processing failed:", {
    messageId: message.id,
    messageType: message.type,
    error: error.message,
  });

  // Optionally send error response
  sendErrorResponse(clientId, {
    originalMessageId: message.id,
    error: "Processing failed",
  });
}
```

## Frontend Usage

### Lit Component Integration

For Lit components, use the `WebSocketController` for reactive property updates:

```typescript
import { WebSocketController } from "./utils/websocket/websocket-controller";
import { BaseComponent } from "../components/base/base-component";

@customElement("my-component")
export class MyComponent extends BaseComponent {
  @property({ type: Array })
  sessions: SessionData[] = [];

  private webSocketController: WebSocketController;

  constructor() {
    super();
    this.webSocketController = new WebSocketController(this, undefined, {
      debug: true,
      debounceMs: 250,
      optimisticUpdates: true,
    });

    // Subscribe to session updates
    this.webSocketController.onSessionCreated((session) => {
      this.sessions = [...this.sessions, session];
    });
  }
}
```

### HOC Pattern Usage

Use the Higher Order Component pattern for simpler integration:

```typescript
import { withWebSocket } from "./utils/websocket/websocket-controller";

const WebSocketEnabledComponent = withWebSocket(BaseComponent, {
  debug: true,
  optimisticUpdates: true,
});

@customElement("enhanced-component")
export class EnhancedComponent extends WebSocketEnabledComponent {
  // Automatic WebSocket integration with this.webSocketController

  protected override firstUpdated() {
    this.webSocketController.onSessionCreated((session) => {
      this.updateFromWebSocket("sessions", [...this.sessions, session]);
    });
  }
}
```

### Manual Message Handling

For custom WebSocket handling, use the message utilities:

```typescript
import {
  deserializeMessage,
  isValidMessage,
  MessageHandlerRegistry,
  isSessionCreatedMessage,
} from "./utils/websocket/message-handlers";

// Create handler registry
const registry = new MessageHandlerRegistry();

// Register handlers
registry.register(MessageType.SESSION_CREATED, (message) => {
  if (isSessionCreatedMessage(message)) {
    updateSessionList(message.payload.session);
  }
});

// Process incoming messages
websocket.onmessage = (event) => {
  try {
    const message = deserializeMessage(event.data);
    if (isValidMessage(message)) {
      registry.processMessage(message);
    }
  } catch (error) {
    console.error("Failed to process message:", error);
  }
};
```

### WebSocket Controller Features

The `WebSocketController` provides several advanced features for Lit components:

#### Optimistic Updates

Perform optimistic UI updates that can be rolled back on failure:

```typescript
// Perform optimistic update
this.webSocketController.optimisticUpdate("sessions", newSessionsArray, 5000);

// Confirm the update (prevents rollback)
this.webSocketController.confirmOptimisticUpdate("sessions");

// Or let it rollback automatically after timeout
```

#### Debounced Updates

Prevent UI thrashing from rapid WebSocket messages:

```typescript
const controller = new WebSocketController(this, undefined, {
  debounceMs: 250, // Debounce updates for 250ms
});
```

#### Connection State Monitoring

Monitor WebSocket connection state in your components:

```typescript
const isConnected = this.webSocketController.isConnected();
const connectionState = this.webSocketController.getConnectionState();

// Render connection status
html`
  <div class="status ${isConnected ? "connected" : "disconnected"}">
    ${connectionState}
  </div>
`;
```

#### Efficient Change Detection

The controller automatically triggers Lit's reactive update cycle only when necessary, minimizing unnecessary re-renders.

### Type Guards

Use type guards for runtime type checking:

```typescript
import {
  isSessionCreatedMessage,
  isSessionUpdatedMessage,
  isSessionDeletedMessage,
  isCacheInvalidatedMessage,
} from "./utils/websocket/message-handlers";

function handleMessage(message: WebSocketMessage) {
  if (isSessionCreatedMessage(message)) {
    // TypeScript knows this is SessionCreatedMessage
    console.log("New session:", message.payload.session.sessionId);
  } else if (isSessionUpdatedMessage(message)) {
    // TypeScript knows this is SessionUpdatedMessage
    console.log("Updated fields:", message.payload.changes.fields);
  }
  // ... etc
}
```

## Migration Notes

### Legacy Message Types

Existing message types are preserved for backward compatibility:

- Legacy types use snake_case (e.g., `session_created`)
- New standardized types use SCREAMING_SNAKE_CASE (e.g., `SESSION_CREATED`)
- Both are supported during transition period

### Migration Strategy

1. **Phase 1**: Implement new protocol alongside existing
2. **Phase 2**: Update backend to send both formats
3. **Phase 3**: Update frontend to handle new format
4. **Phase 4**: Remove legacy format support

## Validation

### Runtime Validation

All messages are validated at runtime using:

```typescript
import { validateMessage } from "./utils/websocket/message-handlers";

const error = validateMessage(incomingData);
if (error) {
  console.error("Invalid message:", error);
  return;
}
```

### Schema Validation

Each message type has a defined schema in `MESSAGE_SCHEMAS` for:

- Required field validation
- Type checking
- Payload structure validation

## Security Considerations

1. **Input Validation**: Always validate incoming messages
2. **Size Limits**: Implement message size limits
3. **Rate Limiting**: Prevent message flooding
4. **Authentication**: Verify client permissions for message types
5. **Sanitization**: Sanitize user-provided data in messages

## Performance Considerations

1. **Message Batching**: Consider batching multiple updates
2. **Compression**: Use WebSocket compression for large payloads
3. **Selective Broadcasting**: Only send messages to interested clients
4. **Message Queuing**: Queue messages during reconnection
5. **Handler Optimization**: Keep message handlers lightweight

## Testing

### Unit Tests

Test message creation, validation, and handling:

```typescript
import { createBaseMessage, validateMessage } from "./message-handlers";

describe("Message Protocol", () => {
  it("should create valid base message", () => {
    const message = createBaseMessage(MessageType.SESSION_CREATED);
    expect(message.type).toBe("SESSION_CREATED");
    expect(message.timestamp).toBeDefined();
    expect(message.id).toBeDefined();
  });
});
```

### Integration Tests

Test full message flow from backend to frontend with real WebSocket connections.

## Debugging

Enable debug logging by setting `debug: true` in WebSocket configuration:

```typescript
const config = {
  url: "ws://localhost:8080",
  debug: true, // Enables detailed logging
};
```

Debug information includes:

- Message serialization/deserialization
- Validation results
- Handler execution timing
- Connection state changes
