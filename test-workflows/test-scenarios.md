# Test Scenarios for Claude Code Log Web App

This document outlines specific test scenarios for validating the functional user flows based on completed tasks 1-4.

## 🚀 Quick Start Testing

### Prerequisites
```bash
cd js
npm install
npm run build
```

### Start Services
```bash
# Terminal 1: Backend API Server
npm run dev:backend

# Terminal 2: WebSocket Server (if separate)
# WebSocket runs on same Express server

# Terminal 3: Frontend (when Task 5 complete)
npm run dev:frontend
```

## 📊 Test Scenario 1: Session Data API

### Objective
Verify that session data can be retrieved through REST API endpoints.

### Test Steps
```bash
# 1. Verify server is running
curl http://localhost:3000/health

# 2. Test sessions list endpoint
curl -i http://localhost:3000/api/sessions

# Expected: HTTP 200, JSON array of session objects
# Verify: Response includes session IDs, timestamps, message counts

# 3. Test pagination
curl "http://localhost:3000/api/sessions?limit=5&offset=0"

# Expected: Limited results with pagination metadata

# 4. Test individual session retrieval
SESSION_ID="[replace-with-actual-id]"
curl -i "http://localhost:3000/api/sessions/$SESSION_ID"

# Expected: HTTP 200, detailed session object with messages array
```

### Validation Criteria
- [ ] Sessions endpoint returns valid JSON
- [ ] Session objects contain required fields (id, created_at, messages)
- [ ] Pagination works correctly
- [ ] Individual session retrieval includes full message history
- [ ] Error handling for invalid session IDs (HTTP 404)

## 🏗️ Test Scenario 2: Project-Based Filtering

### Objective
Verify project-based organization and filtering capabilities.

### Test Steps
```bash
# 1. Get all projects
curl -i http://localhost:3000/api/projects

# Expected: HTTP 200, array of unique project identifiers
# Verify: Projects correspond to actual session data

# 2. Filter sessions by project (if implemented)
PROJECT_NAME="[replace-with-actual-project]"
curl "http://localhost:3000/api/sessions?project=$PROJECT_NAME"

# Expected: Only sessions from specified project
```

### Validation Criteria
- [ ] Projects endpoint returns unique project list
- [ ] Project names match session metadata
- [ ] Project filtering returns correct subset of sessions
- [ ] Empty projects are handled gracefully

## 🔄 Test Scenario 3: Real-Time WebSocket Updates

### Objective
Verify file system monitoring triggers WebSocket broadcasts.

### Test Setup
```bash
# Install WebSocket client for testing
npm install -g wscat

# Connect to WebSocket server
wscat -c ws://localhost:3001
```

### Test Steps
```bash
# In Terminal 1: Connect WebSocket client
wscat -c ws://localhost:3001

# In Terminal 2: Simulate file system changes
# Create test session file
mkdir -p test-sessions
echo '{"type": "user", "content": "test message", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' > test-sessions/new-session.jsonl

# Expected in Terminal 1: WebSocket message about session creation

# Modify existing file
echo '{"type": "assistant", "content": "response", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' >> test-sessions/new-session.jsonl

# Expected in Terminal 1: WebSocket message about session update

# Delete file
rm test-sessions/new-session.jsonl

# Expected in Terminal 1: WebSocket message about session deletion
```

### Validation Criteria
- [ ] WebSocket connection establishes successfully
- [ ] File creation triggers SESSION_CREATED message
- [ ] File modification triggers SESSION_UPDATED message
- [ ] File deletion triggers SESSION_DELETED message
- [ ] Messages include relevant session metadata
- [ ] Multiple clients receive same broadcast messages

## 🏎️ Test Scenario 4: Cache Performance

### Objective
Verify caching system improves performance and handles invalidation correctly.

### Test Steps
```bash
# 1. Cold cache performance test
time curl -s http://localhost:3000/api/sessions > /dev/null

# Record initial response time

# 2. Warm cache performance test
time curl -s http://localhost:3000/api/sessions > /dev/null

# Expected: Significantly faster response time

# 3. Cache invalidation test
# Modify a session file
echo '{"type": "system", "content": "cache test", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' >> existing-session.jsonl

# 4. Verify cache rebuilds
time curl -s http://localhost:3000/api/sessions > /dev/null

# Expected: Slightly slower (cache rebuild) but still faster than cold
```

### Performance Benchmarks
```bash
# Create performance test script
cat > test-performance.sh << 'EOF'
#!/bin/bash
echo "Testing API performance..."

# Cold cache
echo "Cold cache test:"
time curl -s http://localhost:3000/api/sessions > /dev/null

# Warm cache (5 requests)
echo "Warm cache tests:"
for i in {1..5}; do
  time curl -s http://localhost:3000/api/sessions > /dev/null
done

# Large session test
echo "Large session test:"
time curl -s "http://localhost:3000/api/sessions?limit=1000" > /dev/null
EOF

chmod +x test-performance.sh
./test-performance.sh
```

### Validation Criteria
- [ ] Warm cache responses are significantly faster than cold
- [ ] Cache invalidation works when files are modified
- [ ] Large session lists perform acceptably
- [ ] Memory usage remains stable during testing
- [ ] Cache cleanup occurs for deleted sessions

## 🔍 Test Scenario 5: Data Parsing and Validation

### Objective
Verify JSONL parsing, content block handling, and data validation.

### Test Data Setup
```bash
# Create test JSONL with various content types
cat > test-complex-session.jsonl << 'EOF'
{"type": "user", "content": [{"type": "text", "text": "Hello Claude"}], "timestamp": "2025-01-01T10:00:00.000Z"}
{"type": "assistant", "content": [{"type": "text", "text": "Hello! How can I help you today?"}], "timestamp": "2025-01-01T10:00:01.000Z"}
{"type": "user", "content": [{"type": "text", "text": "Can you help me with code?"}, {"type": "tool_use", "id": "test-tool", "name": "code_execution", "input": {"code": "print('hello')"}}], "timestamp": "2025-01-01T10:00:02.000Z"}
{"type": "assistant", "content": [{"type": "tool_result", "tool_use_id": "test-tool", "content": [{"type": "text", "text": "hello"}]}], "timestamp": "2025-01-01T10:00:03.000Z"}
EOF
```

### Test Steps
```bash
# 1. Test complex content parsing
curl "http://localhost:3000/api/sessions/[session-id-for-test-file]"

# Expected: Proper parsing of text, tool_use, and tool_result content

# 2. Test malformed JSONL handling
echo 'invalid json line' >> test-complex-session.jsonl
curl "http://localhost:3000/api/sessions/[session-id-for-test-file]"

# Expected: Graceful error handling, valid lines still parsed

# 3. Test large file streaming
# Create large test file
for i in {1..1000}; do
  echo '{"type": "user", "content": [{"type": "text", "text": "Message '$i'"}], "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' >> large-session.jsonl
done

# Test parsing performance
time curl "http://localhost:3000/api/sessions/[large-session-id]"
```

### Validation Criteria
- [ ] Complex content blocks parse correctly
- [ ] Tool use and tool results maintain structure
- [ ] Malformed JSON lines are skipped gracefully
- [ ] Large files stream efficiently without memory issues
- [ ] TypeScript types enforce data structure consistency
- [ ] Zod validation catches invalid data

## 🔧 Test Scenario 6: Error Handling and Edge Cases

### Objective
Verify robust error handling across all components.

### Test Steps
```bash
# 1. Test non-existent endpoints
curl -i http://localhost:3000/api/nonexistent

# Expected: HTTP 404

# 2. Test invalid session IDs
curl -i http://localhost:3000/api/sessions/invalid-id

# Expected: HTTP 404 with error message

# 3. Test malformed requests
curl -X POST -H "Content-Type: application/json" \
  -d '{"invalid": json}' \
  http://localhost:3000/api/sessions/continue

# Expected: HTTP 400 with validation error

# 4. Test server error handling
# (Requires deliberately causing server error)

# 5. Test CORS headers
curl -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS \
  http://localhost:3000/api/sessions

# Expected: Proper CORS headers
```

### Validation Criteria
- [ ] Appropriate HTTP status codes for all error conditions
- [ ] Error responses include helpful messages
- [ ] CORS configuration allows frontend access
- [ ] Input validation rejects malformed data
- [ ] Server remains stable under error conditions

## 📈 Continuous Testing

### Automated Test Suite
```bash
# Run all backend tests
cd js
npm test

# Run specific test suites
npm run test:backend
npm run test:integration
npm run test:performance
```

### Monitoring During Development
```bash
# Monitor file system changes
find . -name "*.jsonl" | entr -r curl -s http://localhost:3000/api/sessions > /dev/null

# Monitor server logs
tail -f js/backend/logs/app.log

# Monitor WebSocket connections
# Use browser dev tools or wscat for real-time monitoring
```

## 🎯 Success Metrics

### Performance Targets
- [ ] API responses < 200ms for cached data
- [ ] API responses < 1s for uncached data
- [ ] WebSocket message delivery < 100ms
- [ ] Cache invalidation < 500ms
- [ ] Large file parsing (1MB+) < 5s

### Reliability Targets
- [ ] 99.9% API endpoint availability
- [ ] Zero data corruption during cache operations
- [ ] Graceful handling of all malformed input
- [ ] Stable memory usage over 24h operation
- [ ] Complete session data integrity

### Compatibility Targets
- [ ] 100% compatibility with Python-generated cache files
- [ ] Support for all Claude Code message types
- [ ] Backward compatibility with legacy JSONL formats
- [ ] Cross-platform operation (macOS, Linux, Windows)