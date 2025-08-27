# API Documentation

This document provides comprehensive information about the Claude Code Log backend API endpoints, WebSocket protocol, and integration patterns.

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: Configured via environment variables

## Authentication

Currently, the API operates in development mode without authentication. For production deployment, implement proper authentication mechanisms.

## Core Endpoints

### Health Check

**GET** `/health`

Returns server status and basic information.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-08-27T12:00:00Z",
  "version": "1.0.0"
}
```

### Sessions API

**GET** `/api/sessions`

Retrieve all available session data.

**Query Parameters:**
- `limit` (optional): Maximum number of sessions to return
- `offset` (optional): Number of sessions to skip
- `sortBy` (optional): Sort field (`createdAt`, `tokenCount`)
- `sortOrder` (optional): Sort order (`asc`, `desc`)

**Response:**
```json
{
  "sessions": [...],
  "total": 42,
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**GET** `/api/sessions/:id`

Retrieve specific session details.

**Response:**
```json
{
  "id": "session-123",
  "title": "Claude Conversation",
  "createdAt": "2024-08-27T12:00:00Z",
  "tokenCount": 1500,
  "messages": [...],
  "analytics": {...}
}
```

### Analytics API

**GET** `/api/analytics/overview`

Get high-level analytics overview.

**Response:**
```json
{
  "totalSessions": 42,
  "totalTokens": 150000,
  "averageSessionLength": 3571,
  "timeRange": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-08-27T12:00:00Z"
  }
}
```

### Export API

**POST** `/api/export`

Export session data in various formats.

**Request Body:**
```json
{
  "sessionIds": ["session-1", "session-2"],
  "format": "json|csv|html",
  "includeAnalytics": true
}
```

**Response:**
- For JSON/CSV: Returns data directly
- For HTML: Returns rendered HTML content

## WebSocket API

### Connection

Connect to WebSocket at `/ws` for real-time updates.

**Connection URL:** `ws://localhost:3001/ws`

### Message Types

#### Session Updates
```json
{
  "type": "session_update",
  "data": {
    "sessionId": "session-123",
    "change": "created|updated|deleted",
    "session": {...}
  }
}
```

#### Analytics Updates
```json
{
  "type": "analytics_update", 
  "data": {
    "overview": {...},
    "updatedAt": "2024-08-27T12:00:00Z"
  }
}
```

#### Connection Status
```json
{
  "type": "connection_status",
  "data": {
    "status": "connected|disconnected",
    "clientId": "client-abc123",
    "connectedAt": "2024-08-27T12:00:00Z"
  }
}
```

## Error Handling

### HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid session ID format",
    "details": {
      "field": "sessionId",
      "value": "invalid-id"
    }
  }
}
```

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Standard endpoints**: 100 requests per minute per IP
- **Export endpoints**: 10 requests per minute per IP
- **WebSocket connections**: 5 connections per IP

Exceeding limits returns `429 Too Many Requests`.

## CORS Configuration

CORS is configured to allow requests from:
- `http://localhost:5173` (development frontend)
- Production frontend URLs (configured via environment)

## Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin request protection
- **Compression**: Response compression
- **Input validation**: Request parameter validation
- **Error sanitization**: Sensitive information filtering

## SDK Integration

### JavaScript/TypeScript

```javascript
import { ClaudeCodeLogClient } from '@claude-code-log/client';

const client = new ClaudeCodeLogClient({
  baseURL: 'http://localhost:3001',
  apiKey: 'your-api-key' // If authentication is enabled
});

// Get sessions
const sessions = await client.getSessions();

// Connect to WebSocket
client.connectWebSocket((message) => {
  console.log('WebSocket message:', message);
});
```

## Environment Configuration

```bash
# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=claude_code_log

# WebSocket Configuration
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_CONNECTIONS=100

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Examples

See the [examples directory](../examples/) for detailed implementation examples and integration patterns.