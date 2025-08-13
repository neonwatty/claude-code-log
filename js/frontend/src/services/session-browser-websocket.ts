import { io, Socket } from 'socket.io-client';
import { SessionSummary, SessionDetail } from '../components/types/session-types';

export interface SessionBrowserWebSocketConfig {
  url?: string;
  enableReconnection?: boolean;
  maxReconnectionAttempts?: number;
  reconnectionDelay?: number;
  heartbeatInterval?: number;
  enableNotifications?: boolean;
  notificationPreferences?: NotificationPreferences;
  debug?: boolean;
}

export interface NotificationPreferences {
  newSessions?: boolean;
  sessionUpdates?: boolean;
  newMessages?: boolean;
  sessionStateChanges?: boolean;
  soundEnabled?: boolean;
  browserNotifications?: boolean;
  emailNotifications?: boolean;
  filters?: {
    sessionIds?: string[];
    messageTypes?: string[];
    keywords?: string[];
    excludeOwnMessages?: boolean;
  };
}

export interface SessionUpdate {
  sessionId: string;
  type: 'session-created' | 'session-updated' | 'session-completed' | 'session-error' | 'message-added' | 'message-updated';
  data: any;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  lastConnected?: Date;
  reconnectionAttempts: number;
  latency?: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';
}

export interface SessionBrowserWebSocketEvents {
  'connection-status-changed': (status: ConnectionStatus) => void;
  'session-update': (update: SessionUpdate) => void;
  'session-created': (session: SessionSummary) => void;
  'session-updated': (session: SessionSummary) => void;
  'session-completed': (sessionId: string, endTime: Date) => void;
  'session-error': (sessionId: string, error: string) => void;
  'message-added': (sessionId: string, message: any) => void;
  'message-updated': (sessionId: string, messageId: string, message: any) => void;
  'session-state-changed': (sessionId: string, state: string, metadata?: any) => void;
  'notification': (notification: NotificationData) => void;
  'bulk-updates': (updates: SessionUpdate[]) => void;
}

export interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  sessionId?: string;
  timestamp: Date;
  persistent?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: string;
  primary?: boolean;
}

/**
 * WebSocket service for real-time session browser updates and notifications
 * Extends the existing WebSocket infrastructure specifically for session browser needs
 */
export class SessionBrowserWebSocket {
  private socket: Socket | null = null;
  private config: Required<SessionBrowserWebSocketConfig>;
  private connectionStatus: ConnectionStatus;
  private eventHandlers = new Map<keyof SessionBrowserWebSocketEvents, Function[]>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private latencyCheck: { start: number; interval: NodeJS.Timeout | null } = { start: 0, interval: null };
  private subscribedSessions = new Set<string>();
  private notificationQueue: NotificationData[] = [];
  private isInitialized = false;

  constructor(config: SessionBrowserWebSocketConfig = {}) {
    this.config = {
      url: config.url || (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}` : 'ws://localhost:3001'),
      enableReconnection: config.enableReconnection ?? true,
      maxReconnectionAttempts: config.maxReconnectionAttempts ?? 10,
      reconnectionDelay: config.reconnectionDelay ?? 1000,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      enableNotifications: config.enableNotifications ?? true,
      notificationPreferences: {
        newSessions: true,
        sessionUpdates: true,
        newMessages: true,
        sessionStateChanges: true,
        soundEnabled: false,
        browserNotifications: true,
        emailNotifications: false,
        filters: {},
        ...config.notificationPreferences,
      },
      debug: config.debug ?? false,
    };

    this.connectionStatus = {
      connected: false,
      connecting: false,
      reconnecting: false,
      reconnectionAttempts: 0,
      quality: 'disconnected',
    };

    this.loadNotificationPreferences();
  }

  /**
   * Initialize and connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      this.debug('Already connected');
      return;
    }

    this.updateConnectionStatus({
      connecting: true,
      reconnecting: this.connectionStatus.reconnectionAttempts > 0,
    });

    try {
      this.socket = io(this.config.url, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        autoConnect: true,
        reconnection: this.config.enableReconnection,
        reconnectionAttempts: this.config.maxReconnectionAttempts,
        reconnectionDelay: this.config.reconnectionDelay,
        reconnectionDelayMax: this.config.reconnectionDelay * 10,
        maxHttpBufferSize: 1e6, // 1MB buffer
        pingTimeout: 60000,
        pingInterval: 25000,
      });

      this.setupSocketListeners();
      this.isInitialized = true;

      this.debug('WebSocket connection initiated');
    } catch (error) {
      this.debug('Connection failed:', error);
      this.updateConnectionStatus({
        connecting: false,
        connected: false,
        reconnecting: false,
      });
      throw error;
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.latencyCheck.interval) {
      clearInterval(this.latencyCheck.interval);
      this.latencyCheck.interval = null;
    }

    this.updateConnectionStatus({
      connected: false,
      connecting: false,
      reconnecting: false,
      quality: 'disconnected',
    });

    this.debug('Disconnected from WebSocket');
  }

  /**
   * Subscribe to real-time updates for specific sessions
   */
  subscribeToSession(sessionId: string): void {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }

    if (this.subscribedSessions.has(sessionId)) {
      this.debug(`Already subscribed to session: ${sessionId}`);
      return;
    }

    this.socket.emit('join-session', sessionId);
    this.subscribedSessions.add(sessionId);
    
    this.debug(`Subscribed to session: ${sessionId}`);
  }

  /**
   * Unsubscribe from session updates
   */
  unsubscribeFromSession(sessionId: string): void {
    if (!this.socket) {
      this.debug('WebSocket not connected, removing from local subscription list');
      this.subscribedSessions.delete(sessionId);
      return;
    }

    this.socket.emit('leave-session', sessionId);
    this.subscribedSessions.delete(sessionId);
    
    this.debug(`Unsubscribed from session: ${sessionId}`);
  }

  /**
   * Subscribe to multiple sessions at once
   */
  subscribeToSessions(sessionIds: string[]): void {
    sessionIds.forEach(sessionId => this.subscribeToSession(sessionId));
  }

  /**
   * Get list of currently subscribed sessions
   */
  getSubscribedSessions(): string[] {
    return Array.from(this.subscribedSessions);
  }

  /**
   * Update notification preferences
   */
  updateNotificationPreferences(preferences: Partial<NotificationPreferences>): void {
    this.config.notificationPreferences = {
      ...this.config.notificationPreferences,
      ...preferences,
    };
    
    this.saveNotificationPreferences();
    
    // Send updated preferences to server
    if (this.socket?.connected) {
      this.socket.emit('update-notification-preferences', this.config.notificationPreferences);
    }
  }

  /**
   * Get current notification preferences
   */
  getNotificationPreferences(): NotificationPreferences {
    return { ...this.config.notificationPreferences };
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): any {
    if (!this.socket) return null;

    return {
      id: this.socket.id,
      connected: this.socket.connected,
      transport: this.socket.io.engine?.transport?.name,
      upgrades: this.socket.io.engine?.transport?.upgradesTo,
      ping: this.connectionStatus.latency,
      reconnectionAttempts: this.connectionStatus.reconnectionAttempts,
      subscribedSessions: this.subscribedSessions.size,
      notificationQueue: this.notificationQueue.length,
    };
  }

  /**
   * Manually trigger connection health check
   */
  checkConnectionHealth(): void {
    if (!this.socket?.connected) {
      this.updateConnectionStatus({ quality: 'disconnected' });
      return;
    }

    const start = Date.now();
    this.latencyCheck.start = start;

    this.socket.emit('ping', (response: string) => {
      const latency = Date.now() - start;
      
      let quality: ConnectionStatus['quality'] = 'excellent';
      if (latency > 1000) quality = 'poor';
      else if (latency > 500) quality = 'fair';
      else if (latency > 200) quality = 'good';

      this.updateConnectionStatus({ latency, quality });
    });
  }

  /**
   * Force reconnection
   */
  forceReconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      setTimeout(() => {
        this.socket?.connect();
      }, 1000);
    }
  }

  /**
   * Add event listener
   */
  on<K extends keyof SessionBrowserWebSocketEvents>(event: K, handler: SessionBrowserWebSocketEvents[K]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof SessionBrowserWebSocketEvents>(event: K, handler: SessionBrowserWebSocketEvents[K]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Remove all event listeners for an event
   */
  removeAllListeners<K extends keyof SessionBrowserWebSocketEvents>(event?: K): void {
    if (event) {
      this.eventHandlers.delete(event);
    } else {
      this.eventHandlers.clear();
    }
  }

  /**
   * Emit event to registered handlers
   */
  private emit<K extends keyof SessionBrowserWebSocketEvents>(event: K, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.debug('Connected to WebSocket server');
      this.updateConnectionStatus({
        connected: true,
        connecting: false,
        reconnecting: false,
        lastConnected: new Date(),
        reconnectionAttempts: 0,
        quality: 'good',
      });

      // Re-subscribe to sessions after reconnection
      if (this.subscribedSessions.size > 0) {
        this.debug(`Re-subscribing to ${this.subscribedSessions.size} sessions`);
        this.subscribedSessions.forEach(sessionId => {
          this.socket!.emit('join-session', sessionId);
        });
      }

      // Send notification preferences
      this.socket.emit('update-notification-preferences', this.config.notificationPreferences);

      // Start heartbeat and health monitoring
      this.startHeartbeat();
      this.startLatencyMonitoring();
    });

    this.socket.on('disconnect', (reason: string) => {
      this.debug('Disconnected from WebSocket server:', reason);
      this.updateConnectionStatus({
        connected: false,
        connecting: false,
        quality: 'disconnected',
      });

      this.stopHeartbeat();
      this.stopLatencyMonitoring();
    });

    this.socket.on('connect_error', (error: Error) => {
      this.debug('Connection error:', error);
      this.updateConnectionStatus({
        connecting: false,
        connected: false,
        reconnecting: true,
        reconnectionAttempts: this.connectionStatus.reconnectionAttempts + 1,
      });
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      this.debug(`Reconnected after ${attemptNumber} attempts`);
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      this.debug(`Reconnection attempt ${attemptNumber}`);
      this.updateConnectionStatus({
        reconnecting: true,
        reconnectionAttempts: attemptNumber,
      });
    });

    // Session update events
    this.socket.on('session-updated', (data: any) => {
      const update: SessionUpdate = {
        sessionId: data.sessionId || data.session?.id,
        type: 'session-updated',
        data: data.session || data,
        timestamp: new Date(data.timestamp || Date.now()),
        userId: data.userId,
        metadata: data.metadata,
      };
      
      this.emit('session-update', update);
      this.emit('session-updated', data.session || data);
      
      this.processNotification(update);
    });

    this.socket.on('session-created', (session: SessionSummary) => {
      const update: SessionUpdate = {
        sessionId: session.sessionId,
        type: 'session-created',
        data: session,
        timestamp: new Date(),
      };
      
      this.emit('session-update', update);
      this.emit('session-created', session);
      
      this.processNotification(update);
    });

    this.socket.on('session-completed', (data: { sessionId: string; endTime: string }) => {
      const update: SessionUpdate = {
        sessionId: data.sessionId,
        type: 'session-completed',
        data,
        timestamp: new Date(data.endTime),
      };
      
      this.emit('session-update', update);
      this.emit('session-completed', data.sessionId, new Date(data.endTime));
      
      this.processNotification(update);
    });

    this.socket.on('session-error', (data: { sessionId: string; error: string }) => {
      const update: SessionUpdate = {
        sessionId: data.sessionId,
        type: 'session-error',
        data,
        timestamp: new Date(),
      };
      
      this.emit('session-update', update);
      this.emit('session-error', data.sessionId, data.error);
      
      this.processNotification(update);
    });

    this.socket.on('message-added', (data: { sessionId: string; message: any }) => {
      const update: SessionUpdate = {
        sessionId: data.sessionId,
        type: 'message-added',
        data: data.message,
        timestamp: new Date(data.message.timestamp || Date.now()),
        userId: data.message.userId,
      };
      
      this.emit('session-update', update);
      this.emit('message-added', data.sessionId, data.message);
      
      this.processNotification(update);
    });

    this.socket.on('message-updated', (data: { sessionId: string; messageId: string; message: any }) => {
      const update: SessionUpdate = {
        sessionId: data.sessionId,
        type: 'message-updated',
        data: data.message,
        timestamp: new Date(),
      };
      
      this.emit('session-update', update);
      this.emit('message-updated', data.sessionId, data.messageId, data.message);
      
      this.processNotification(update);
    });

    this.socket.on('session-state-changed', (data: { sessionId: string; state: string; metadata?: any }) => {
      this.emit('session-state-changed', data.sessionId, data.state, data.metadata);
      
      if (this.config.notificationPreferences.sessionStateChanges) {
        const notification: NotificationData = {
          id: `state-${data.sessionId}-${Date.now()}`,
          type: data.state === 'error' ? 'error' : 'info',
          title: 'Session State Changed',
          message: `Session ${data.sessionId.substring(0, 8)} is now ${data.state}`,
          sessionId: data.sessionId,
          timestamp: new Date(),
        };
        
        this.emit('notification', notification);
      }
    });

    // Bulk updates for efficiency
    this.socket.on('bulk-session-updates', (updates: any[]) => {
      const sessionUpdates = updates.map(update => ({
        sessionId: update.sessionId,
        type: update.type || 'session-updated',
        data: update.data,
        timestamp: new Date(update.timestamp || Date.now()),
        userId: update.userId,
        metadata: update.metadata,
      }));
      
      this.emit('bulk-updates', sessionUpdates);
      
      // Process individual updates too
      sessionUpdates.forEach(update => {
        this.emit('session-update', update);
        this.processNotification(update);
      });
    });

    // Pong response for latency measurement
    this.socket.on('pong', () => {
      if (this.latencyCheck.start > 0) {
        const latency = Date.now() - this.latencyCheck.start;
        this.latencyCheck.start = 0;
        
        let quality: ConnectionStatus['quality'] = 'excellent';
        if (latency > 1000) quality = 'poor';
        else if (latency > 500) quality = 'fair';
        else if (latency > 200) quality = 'good';

        this.updateConnectionStatus({ latency, quality });
      }
    });

    // Server-initiated notifications
    this.socket.on('notification', (notification: NotificationData) => {
      this.emit('notification', notification);
    });
  }

  /**
   * Process and filter notifications based on preferences
   */
  private processNotification(update: SessionUpdate): void {
    if (!this.config.enableNotifications) return;

    const prefs = this.config.notificationPreferences;
    let shouldNotify = false;
    let title = '';
    let message = '';
    let type: NotificationData['type'] = 'info';

    // Check if this type of notification is enabled
    switch (update.type) {
      case 'session-created':
        shouldNotify = prefs.newSessions!;
        title = 'New Session Created';
        message = `Session ${update.sessionId.substring(0, 8)} was created`;
        type = 'success';
        break;
      case 'session-updated':
        shouldNotify = prefs.sessionUpdates!;
        title = 'Session Updated';
        message = `Session ${update.sessionId.substring(0, 8)} was updated`;
        type = 'info';
        break;
      case 'message-added':
        shouldNotify = prefs.newMessages!;
        title = 'New Message';
        message = `New message in session ${update.sessionId.substring(0, 8)}`;
        type = 'info';
        break;
      case 'session-error':
        shouldNotify = true; // Always notify for errors
        title = 'Session Error';
        message = `Error in session ${update.sessionId.substring(0, 8)}`;
        type = 'error';
        break;
    }

    if (!shouldNotify) return;

    // Apply filters
    if (prefs.filters) {
      // Session ID filter
      if (prefs.filters.sessionIds && !prefs.filters.sessionIds.includes(update.sessionId)) {
        return;
      }

      // Message type filter
      if (prefs.filters.messageTypes && update.data?.role && !prefs.filters.messageTypes.includes(update.data.role)) {
        return;
      }

      // Keyword filter
      if (prefs.filters.keywords && update.data?.content) {
        const hasKeyword = prefs.filters.keywords.some(keyword => 
          update.data.content.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!hasKeyword) return;
      }

      // Exclude own messages
      if (prefs.filters.excludeOwnMessages && update.userId === this.getCurrentUserId()) {
        return;
      }
    }

    const notification: NotificationData = {
      id: `${update.type}-${update.sessionId}-${Date.now()}`,
      type,
      title,
      message,
      sessionId: update.sessionId,
      timestamp: update.timestamp,
      persistent: type === 'error',
    };

    this.emit('notification', notification);

    // Show browser notification if enabled
    if (prefs.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: update.sessionId,
      });
    }

    // Play sound if enabled
    if (prefs.soundEnabled) {
      this.playNotificationSound(type);
    }
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat');
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Start latency monitoring
   */
  private startLatencyMonitoring(): void {
    if (this.latencyCheck.interval) {
      clearInterval(this.latencyCheck.interval);
    }

    this.latencyCheck.interval = setInterval(() => {
      this.checkConnectionHealth();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop latency monitoring
   */
  private stopLatencyMonitoring(): void {
    if (this.latencyCheck.interval) {
      clearInterval(this.latencyCheck.interval);
      this.latencyCheck.interval = null;
    }
  }

  /**
   * Update connection status and emit event
   */
  private updateConnectionStatus(updates: Partial<ConnectionStatus>): void {
    const previousStatus = { ...this.connectionStatus };
    this.connectionStatus = { ...this.connectionStatus, ...updates };
    
    // Only emit if status actually changed
    if (JSON.stringify(previousStatus) !== JSON.stringify(this.connectionStatus)) {
      this.emit('connection-status-changed', this.connectionStatus);
    }
  }

  /**
   * Load notification preferences from localStorage
   */
  private loadNotificationPreferences(): void {
    try {
      const saved = localStorage.getItem('session-browser-notification-preferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.config.notificationPreferences = {
          ...this.config.notificationPreferences,
          ...preferences,
        };
      }
    } catch (error) {
      this.debug('Failed to load notification preferences:', error);
    }
  }

  /**
   * Save notification preferences to localStorage
   */
  private saveNotificationPreferences(): void {
    try {
      localStorage.setItem(
        'session-browser-notification-preferences',
        JSON.stringify(this.config.notificationPreferences)
      );
    } catch (error) {
      this.debug('Failed to save notification preferences:', error);
    }
  }

  /**
   * Get current user ID (to be implemented based on auth system)
   */
  private getCurrentUserId(): string | undefined {
    // This should be implemented based on your authentication system
    return undefined;
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(type: NotificationData['type']): void {
    try {
      // Create a simple audio notification
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      // Different frequencies for different notification types
      const frequencies = {
        info: 800,
        success: 1000,
        warning: 600,
        error: 400,
      };

      oscillator.frequency.value = frequencies[type];
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.5);
    } catch (error) {
      this.debug('Failed to play notification sound:', error);
    }
  }

  /**
   * Debug logging
   */
  private debug(...args: any[]): void {
    if (this.config.debug) {
      console.log('[SessionBrowserWebSocket]', ...args);
    }
  }

  /**
   * Request browser notification permission
   */
  static async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission;
    }

    return Notification.permission;
  }

  /**
   * Test connection with server
   */
  async testConnection(): Promise<boolean> {
    if (!this.socket?.connected) {
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);
      
      this.socket!.emit('ping', (response: string) => {
        clearTimeout(timeout);
        resolve(response === 'pong');
      });
    });
  }

  /**
   * Cleanup and destroy the service
   */
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
    this.subscribedSessions.clear();
    this.notificationQueue.length = 0;
  }
}

// Default export
export default SessionBrowserWebSocket;