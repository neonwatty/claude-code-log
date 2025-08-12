import React, { useState, useEffect, useRef } from 'react';
import WebSocketBranchClient, { 
  BranchNotificationData, 
  BranchTreeUpdateData,
  BranchNotificationUtils 
} from '../services/websocket-branch-client';

interface BranchNotification {
  id: string;
  type: 'branch-created' | 'branch-tree-updated' | 'error';
  timestamp: Date;
  data: any;
  message: string;
}

const BranchNotificationDemo: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [notifications, setNotifications] = useState<BranchNotification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [userId] = useState(`user-${Math.random().toString(36).substring(2, 9)}`);
  
  const clientRef = useRef<WebSocketBranchClient | null>(null);

  useEffect(() => {
    // Initialize WebSocket client
    clientRef.current = new WebSocketBranchClient('http://localhost:3001');

    // Clean up on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  const addNotification = (
    type: BranchNotification['type'], 
    data: any, 
    message: string
  ) => {
    const notification: BranchNotification = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      timestamp: new Date(),
      data,
      message,
    };
    
    setNotifications(prev => [notification, ...prev].slice(0, 20)); // Keep last 20 notifications
  };

  const handleConnect = async () => {
    if (!clientRef.current || isConnected) return;

    try {
      setConnectionStatus('Connecting...');
      
      await clientRef.current.connect(userId, currentSessionId || undefined);
      
      // Set up event handlers
      clientRef.current.onBranchCreated((data: BranchNotificationData) => {
        const branchName = BranchNotificationUtils.getBranchName(data);
        const description = BranchNotificationUtils.getBranchDescription(data);
        const isAffected = BranchNotificationUtils.isSessionAffected(currentSessionId, data);
        
        addNotification(
          'branch-created',
          data,
          `🌿 New branch "${branchName}" created from session ${data.parentSessionId}. ${description} ${isAffected ? '(You are affected)' : ''}`
        );
      });

      clientRef.current.onBranchTreeUpdated((data: BranchTreeUpdateData) => {
        const isAffected = BranchNotificationUtils.isSessionAffectedByTreeUpdate(currentSessionId, data);
        addNotification(
          'branch-tree-updated',
          data,
          `🌳 Branch tree updated: ${data.branchData.childId} added to ${data.branchData.parentId} ${isAffected ? '(You are affected)' : ''}`
        );
      });

      clientRef.current.onError((error: any) => {
        addNotification('error', error, `❌ WebSocket error: ${error.message || error.code}`);
      });

      setIsConnected(true);
      setConnectionStatus('Connected');
      
      addNotification('branch-created', { userId }, `✅ Connected as ${userId}`);
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionStatus(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      addNotification('error', error, `❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDisconnect = () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      setIsConnected(false);
      setConnectionStatus('Disconnected');
      addNotification('branch-created', {}, '⏹️ Disconnected from WebSocket');
    }
  };

  const handleJoinSession = () => {
    if (clientRef.current && currentSessionId && isConnected) {
      clientRef.current.joinSession(currentSessionId);
      addNotification('branch-created', { sessionId: currentSessionId }, `🏠 Joined session: ${currentSessionId}`);
    }
  };

  const handleLeaveSession = () => {
    if (clientRef.current && currentSessionId && isConnected) {
      clientRef.current.leaveSession(currentSessionId);
      addNotification('branch-created', { sessionId: currentSessionId }, `🚪 Left session: ${currentSessionId}`);
    }
  };

  const handlePing = async () => {
    if (clientRef.current && isConnected) {
      try {
        const response = await clientRef.current.ping();
        addNotification('branch-created', { response }, `🏓 Ping successful: ${response}`);
      } catch (error) {
        addNotification('error', error, `❌ Ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: BranchNotification['type']) => {
    switch (type) {
      case 'branch-created': return '🌿';
      case 'branch-tree-updated': return '🌳';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const getNotificationColor = (type: BranchNotification['type']) => {
    switch (type) {
      case 'branch-created': return 'text-green-600 bg-green-50 border-green-200';
      case 'branch-tree-updated': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          WebSocket Branch Notifications Demo
        </h1>
        <p className="text-gray-600">
          Demonstrates real-time session branching notifications using WebSocket connections.
        </p>
      </div>

      {/* Connection Controls */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Connection Control</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <input
              type="text"
              value={userId}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session ID (optional)
            </label>
            <input
              type="text"
              value={currentSessionId}
              onChange={(e) => setCurrentSessionId(e.target.value)}
              placeholder="e.g., parent-session-123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={handleConnect}
            disabled={isConnected}
            className={`px-4 py-2 rounded-md font-medium ${
              isConnected
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Connect
          </button>
          
          <button
            onClick={handleDisconnect}
            disabled={!isConnected}
            className={`px-4 py-2 rounded-md font-medium ${
              !isConnected
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            Disconnect
          </button>
          
          <button
            onClick={handleJoinSession}
            disabled={!isConnected || !currentSessionId}
            className={`px-4 py-2 rounded-md font-medium ${
              !isConnected || !currentSessionId
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            Join Session
          </button>
          
          <button
            onClick={handleLeaveSession}
            disabled={!isConnected || !currentSessionId}
            className={`px-4 py-2 rounded-md font-medium ${
              !isConnected || !currentSessionId
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-yellow-600 text-white hover:bg-yellow-700'
            }`}
          >
            Leave Session
          </button>
          
          <button
            onClick={handlePing}
            disabled={!isConnected}
            className={`px-4 py-2 rounded-md font-medium ${
              !isConnected
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            Ping Server
          </button>
        </div>

        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-1 ${
              isConnected ? 'bg-green-400' : 'bg-red-400'
            }`}></span>
            {connectionStatus}
          </span>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Real-time Notifications</h2>
          <button
            onClick={clearNotifications}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear All
          </button>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No notifications yet. Connect and create some branches to see notifications!
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-6 py-4 border-l-4 ${getNotificationColor(notification.type)}`}
                >
                  <div className="flex items-start">
                    <span className="text-lg mr-3" role="img" aria-label={notification.type}>
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {notification.timestamp.toLocaleTimeString()}
                      </p>
                      {notification.data && Object.keys(notification.data).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-400 cursor-pointer">
                            Show data
                          </summary>
                          <pre className="text-xs text-gray-600 mt-1 bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(notification.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Test</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>Click "Connect" to establish WebSocket connection</li>
          <li>Enter a session ID (e.g., "parent-session-123") and click "Join Session"</li>
          <li>Use the API to create branches from that session:</li>
        </ol>
        <div className="mt-3 bg-blue-100 rounded p-3">
          <code className="text-xs text-blue-900">
            POST /api/sessions/parent-session-123/branch<br/>
            {JSON.stringify({
              branchPoint: 2,
              metadata: {
                branchName: "test-branch",
                branchReason: "Testing WebSocket notifications"
              },
              workingDirectory: "/test/project",
              directoryPath: "/test/jsonl"
            }, null, 2)}
          </code>
        </div>
        <p className="text-sm text-blue-800 mt-3">
          You should see real-time notifications appear above when branches are created!
        </p>
      </div>
    </div>
  );
};

export default BranchNotificationDemo;