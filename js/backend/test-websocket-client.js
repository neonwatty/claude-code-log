// Simple WebSocket test client
const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  upgrade: true,
});

console.log('Connecting to WebSocket server...');

socket.on('connect', () => {
  console.log('✅ Connected to server with ID:', socket.id);
  
  // Test authentication
  socket.emit('authenticate', { 
    userId: 'test-user-123',
    sessionId: 'test-session-456'
  });
});

socket.on('authenticated', (data) => {
  console.log('✅ Authentication response:', data);
  
  // Test joining a session
  socket.emit('join-session', 'test-session-456');
  
  // Test ping
  socket.emit('ping', (response) => {
    console.log('✅ Ping response:', response);
  });
  
  // Test session update
  setTimeout(() => {
    console.log('📤 Sending session update...');
    socket.emit('session-update', {
      sessionId: 'test-session-456',
      update: {
        type: 'test-update',
        data: { message: 'Hello from test client!' },
        timestamp: new Date().toISOString()
      }
    });
  }, 1000);
  
  // Disconnect after 5 seconds
  setTimeout(() => {
    console.log('👋 Disconnecting...');
    socket.disconnect();
  }, 5000);
});

socket.on('user-joined', (data) => {
  console.log('👥 User joined session:', data);
});

socket.on('user-left', (data) => {
  console.log('👥 User left session:', data);
});

socket.on('session-updated', (data) => {
  console.log('📥 Session update received:', data);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  socket.disconnect();
  process.exit(0);
});