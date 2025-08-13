# Manual Testing Guide for Claude Code Log Application

Based on the codebase analysis, here's a comprehensive manual testing guide for the Claude Code Log application.

## 🚀 **Application Startup**

### **Prerequisites**
- Node.js ≥18.0.0 and npm ≥9.0.0
- Project uses npm workspaces (backend, frontend, shared)

### **Development Mode (Recommended for Testing)**
```bash
cd /Users/jeremywatt/Desktop/claude-code-log/js
npm install              # Install all dependencies
npm run dev             # Starts both backend and frontend concurrently
```

**What this does:**
- Backend runs on `http://localhost:3000`
- Frontend runs on `http://localhost:5173`
- Backend uses `tsx watch` for hot reload
- Frontend uses Vite dev server

### **Individual Component Startup**
```bash
# Backend only
npm run dev:backend

# Frontend only  
npm run dev:frontend
```

### **Production Build & Start**
```bash
npm run build:prod      # Production build
npm run start:prod      # Start production server
```

## 🔍 **Core Application Testing**

### **1. Health Check & Server Status**
- **Frontend:** Navigate to `http://localhost:5173`
- **Check:** Bottom status bar shows "Server Status: Server is healthy"
- **Backend API:** `GET http://localhost:3000/api/health`
  - Expected: `{"success": true, "data": {"status": "healthy"}}`

### **2. Frontend Navigation**
Navigate through all sections:
- **Home** (`#home`) - Welcome page
- **Messages** (`#messages`) - Message display demos
- **Tools** (`#tools`) - Tool use demonstrations  
- **Syntax** (`#syntax`) - Syntax highlighting demos
- **About** (`#about`) - Application info

### **3. Session Management (Task 14 Features)**
Test the real-time session status functionality:

**Session Creation:**
```bash
POST http://localhost:3000/api/sessions/parse
Content-Type: application/json
{
  "directoryPath": "/path/to/test/directory"
}
```

**Session Status Tracking:**
- Check WebSocket connection for real-time updates
- Test session branching endpoints
- Validate session status events

### **4. WebSocket Real-Time Features**
- **Connection:** Open browser DevTools → Network → WS
- **Expected:** WebSocket connection to `ws://localhost:3000`
- **Test Events:**
  - Session status changes
  - File monitoring events (if enabled)
  - Branch creation notifications

## 📡 **API Endpoints Testing**

### **Core Routes**
- **Health:** `GET /api/health`
- **Sessions:** `GET /api/sessions`, `POST /api/sessions/parse`
- **WebSocket:** `GET /api/websocket/*`
- **CLI Integration:** `POST /api/cli/*`
- **Analytics:** `POST /api/analytics/tokens`
- **File Monitoring:** `GET /api/file-monitoring/status`

### **Session Branching (Task 13 Features)**
- `POST /api/sessions/:id/branch` - Create branch
- `POST /api/sessions/:id/validate-branch-point` - Validate branch point
- `GET /api/sessions/:id/branches` - Get branches
- `GET /api/sessions/:id/branch-tree` - Get branch tree
- `DELETE /api/sessions/:id/branch` - Delete branch

**Example Branch Creation:**
```bash
POST http://localhost:3000/api/sessions/session-123/branch
Content-Type: application/json
{
  "branchPoint": 5,
  "metadata": {
    "branchName": "alternative-approach",
    "branchReason": "Exploring different solution"
  },
  "directoryPath": "/path/to/project"
}
```

### **Session Status APIs (Task 14 Features)**
- Real-time session status updates via WebSocket
- Session progress tracking
- Status change notifications
- Performance metrics monitoring

## 🧪 **Common Testing Workflows**

### **Workflow 1: Basic Application Verification**
1. Start application (`npm run dev`)
2. Navigate to `http://localhost:5173`
3. Verify server status shows "healthy"
4. Navigate through all tabs (Home, Messages, Tools, Syntax, About)
5. Check that all pages load without errors
6. Verify API health endpoint responds correctly

### **Workflow 2: Session Analysis & Management**
1. Start application
2. Create a test session via API:
   ```bash
   curl -X POST http://localhost:3000/api/sessions/parse \
     -H "Content-Type: application/json" \
     -d '{"directoryPath": "/path/to/test/directory"}'
   ```
3. Check real-time updates via WebSocket
4. Test session status tracking
5. Validate session metadata and progress indicators

### **Workflow 3: Session Branching**
1. Create a parent session
2. Validate branch point:
   ```bash
   curl -X POST http://localhost:3000/api/sessions/session-123/validate-branch-point \
     -H "Content-Type: application/json" \
     -d '{"branchPoint": 3, "directoryPath": "/test/path"}'
   ```
3. Create a branch from the session
4. Verify branch tree structure
5. Test branch deletion
6. Check WebSocket notifications for branch events

### **Workflow 4: Real-time Features Testing**
1. Open multiple browser tabs/windows
2. Connect to WebSocket endpoint
3. Trigger session status changes
4. Verify real-time updates across all clients
5. Test WebSocket reconnection handling
6. Monitor session progress indicators

### **Workflow 5: File System Integration**
1. Enable file monitoring via environment variables
2. Make file changes in watched directories
3. Verify WebSocket notifications
4. Check file system event processing
5. Test debouncing of file change events

## 🔧 **Environment Configuration**

Create `.env` file in `/js` directory:
```env
# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info

# Optional Features
FILE_MONITORING_ENABLED=true
FILE_MONITORING_PATHS=/path/to/watch,/another/path
FILE_MONITORING_DEBOUNCE=300

# Production Only (required in production)
JWT_SECRET=your-secret-here
DATABASE_URL=your-db-url-here
```

### **Environment Variables Reference**
- `PORT`: Backend server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)
- `CORS_ORIGIN`: Frontend URL for CORS (default: http://localhost:5173)
- `LOG_LEVEL`: Logging verbosity (info/debug/warn/error)
- `FILE_MONITORING_ENABLED`: Enable file system monitoring (true/false)
- `FILE_MONITORING_PATHS`: Comma-separated paths to watch
- `FILE_MONITORING_DEBOUNCE`: Debounce delay in milliseconds

## 🔍 **WebSocket Testing**

### **Connection Testing**
1. Open browser DevTools → Network → WS tab
2. Connect to application
3. Verify WebSocket connection establishes
4. Check connection URL: `ws://localhost:3000`

### **Event Testing**
```javascript
// In browser console - connect to WebSocket
const socket = io('http://localhost:3000');

// Listen for session events
socket.on('session-status-changed', (data) => {
  console.log('Session status:', data);
});

// Listen for branch events
socket.on('session-branched', (data) => {
  console.log('Branch created:', data);
});

// Test authentication
socket.emit('authenticate', {
  userId: 'test-user',
  sessionId: 'test-session'
});
```

## 🐛 **Troubleshooting & Common Issues**

### **Port Conflicts**
- **Backend:** Change `PORT` in .env file
- **Frontend:** Modify `vite.config.ts` port setting
- **Check:** `lsof -i :3000` and `lsof -i :5173`

### **CORS Issues**
- Update `CORS_ORIGIN` in .env to match frontend URL
- Check frontend is connecting to correct backend URL
- Verify no proxy configuration conflicts

### **WebSocket Connection Failures**
- Verify both HTTP server and WebSocket are running
- Check browser network tab for connection status
- Ensure firewall allows connections on specified ports
- Check for proxy/VPN interference

### **Module Resolution Errors**
- Run `npm run clean` to clear build artifacts
- Delete `node_modules` and reinstall: `npm run install:clean`
- Check workspace dependencies are linked properly
- Verify TypeScript paths configuration

### **Build/Start Failures**
- Check Node.js version: `node --version` (must be ≥18.0.0)
- Verify npm version: `npm --version` (must be ≥9.0.0)
- Clear TypeScript cache: `npm run typecheck`
- Check for compilation errors: `npm run build`

## 📋 **Test Validation Checklist**

### **Basic Functionality**
- [ ] Application starts without errors
- [ ] Frontend loads and displays correctly  
- [ ] Backend health endpoint responds
- [ ] All navigation pages work
- [ ] Server status indicator shows "healthy"

### **API Testing**
- [ ] Health endpoint returns success
- [ ] Session creation/parsing works
- [ ] Session listing endpoint responds
- [ ] Analytics endpoints function
- [ ] CLI integration endpoints work

### **WebSocket Features**
- [ ] WebSocket connection establishes
- [ ] Real-time events are received
- [ ] Multiple client connections work
- [ ] Connection recovery after disconnect

### **Session Management (Task 14)**
- [ ] Session status tracking works
- [ ] Real-time status updates function
- [ ] Progress indicators update correctly
- [ ] Session metadata changes propagate
- [ ] Performance metrics are tracked

### **Session Branching (Task 13)**
- [ ] Branch point validation works
- [ ] Branch creation succeeds
- [ ] Branch tree structure is correct
- [ ] Branch deletion functions
- [ ] WebSocket branch notifications work

### **File Monitoring**
- [ ] File system monitoring starts (if enabled)
- [ ] File change events are detected
- [ ] WebSocket notifications for file changes
- [ ] Debouncing prevents spam events

### **Error Handling**
- [ ] Graceful handling of network errors
- [ ] Proper error messages displayed
- [ ] WebSocket reconnection works
- [ ] API validation errors are handled

## 🚀 **Performance Testing**

### **Load Testing**
- Test with multiple concurrent WebSocket connections
- Monitor memory usage during extended sessions
- Test session creation with large directories
- Verify file monitoring with many file changes

### **Memory & Resource Monitoring**
```bash
# Monitor backend process
top -p $(pgrep -f "tsx watch")

# Check memory usage
ps aux | grep node

# Monitor open files/connections
lsof -p $(pgrep -f "tsx watch")
```

## 📝 **Additional Testing Tools**

### **API Testing with curl**
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test session creation
curl -X POST http://localhost:3000/api/sessions/parse \
  -H "Content-Type: application/json" \
  -d '{"directoryPath": "/test/path"}'

# Test with authentication headers
curl -H "Authorization: Bearer your-token" \
  http://localhost:3000/api/sessions
```

### **WebSocket Testing with wscat**
```bash
# Install wscat globally
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000

# Send authentication
{"type": "authenticate", "data": {"userId": "test", "sessionId": "test"}}
```

---

This guide provides comprehensive testing procedures for all implemented features, including the recently completed Task 13 (Session Branching) and Task 14 (Real-time Session Status Updates). Use this as a reference for manual testing, debugging, and validation of the application functionality.