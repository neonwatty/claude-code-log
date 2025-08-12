import { randomUUID } from 'crypto';
import { Server as SocketIOServer } from 'socket.io';
import {
  AppEvent,
  EventType,
  EventFilter,
  EventSubscription,
  EventHistory,
  BaseEvent,
  FileEvent,
  UserActionEvent,
  SessionEvent,
  SessionStatusEvent,
  SessionStatusData,
  SessionStatusSubscription,
  CodeEvent,
  MessageEvent,
  SystemEvent,
  CustomEvent,
  TypedSocket
} from '../types/websocket';

export interface EventMiddleware {
  (event: AppEvent, socket?: TypedSocket): Promise<boolean>;
}

export class EventManager {
  private eventHistory: AppEvent[] = [];
  private subscriptions: Map<string, EventSubscription> = new Map();
  private sessionStatusSubscriptions: Map<string, SessionStatusSubscription> = new Map();
  private middleware: EventMiddleware[] = [];
  private maxHistorySize: number = 10000;

  constructor(
    private io: SocketIOServer,
    maxHistorySize?: number
  ) {
    if (maxHistorySize) {
      this.maxHistorySize = maxHistorySize;
    }
  }

  // Event creation factory methods
  public createFileEvent(
    type: FileEvent['type'],
    data: FileEvent['data'],
    metadata?: { userId?: string; sessionId?: string; [key: string]: any }
  ): FileEvent {
    return {
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      metadata: metadata && { ...metadata, userId: undefined, sessionId: undefined },
      data
    };
  }

  public createUserActionEvent(
    type: UserActionEvent['type'],
    data: UserActionEvent['data'],
    metadata?: { userId?: string; sessionId?: string; [key: string]: any }
  ): UserActionEvent {
    return {
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      metadata: metadata && { ...metadata, userId: undefined, sessionId: undefined },
      data
    };
  }

  public createSessionEvent(
    type: SessionEvent['type'],
    data: SessionEvent['data'],
    metadata?: { userId?: string; sessionId?: string; [key: string]: any }
  ): SessionEvent {
    return {
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      metadata: metadata && { ...metadata, userId: undefined, sessionId: undefined },
      data
    };
  }

  public createCodeEvent(
    type: CodeEvent['type'],
    data: CodeEvent['data'],
    metadata?: { userId?: string; sessionId?: string; [key: string]: any }
  ): CodeEvent {
    return {
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      metadata: metadata && { ...metadata, userId: undefined, sessionId: undefined },
      data
    };
  }

  public createMessageEvent(
    type: MessageEvent['type'],
    data: MessageEvent['data'],
    metadata?: { userId?: string; sessionId?: string; [key: string]: any }
  ): MessageEvent {
    return {
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      metadata: metadata && { ...metadata, userId: undefined, sessionId: undefined },
      data
    };
  }

  public createSystemEvent(
    type: SystemEvent['type'],
    data: SystemEvent['data'],
    metadata?: { userId?: string; sessionId?: string; [key: string]: any }
  ): SystemEvent {
    return {
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      metadata: metadata && { ...metadata, userId: undefined, sessionId: undefined },
      data
    };
  }

  public createCustomEvent(
    data: CustomEvent['data'],
    metadata?: { userId?: string; sessionId?: string; [key: string]: any }
  ): CustomEvent {
    return {
      id: randomUUID(),
      type: 'custom:event',
      timestamp: new Date().toISOString(),
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      metadata: metadata && { ...metadata, userId: undefined, sessionId: undefined },
      data
    };
  }

  public createSessionStatusEvent(
    type: SessionStatusEvent['type'],
    data: SessionStatusEvent['data'],
    metadata?: { userId?: string; sessionId?: string; [key: string]: any }
  ): SessionStatusEvent {
    return {
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      userId: metadata?.userId,
      sessionId: metadata?.sessionId || data.sessionId,
      metadata: metadata && { ...metadata, userId: undefined, sessionId: undefined },
      data
    };
  }

  // Event validation
  private validateEvent(event: AppEvent): boolean {
    if (!event.id || !event.type || !event.timestamp) {
      return false;
    }

    // Validate timestamp format
    if (isNaN(Date.parse(event.timestamp))) {
      return false;
    }

    // Type-specific validation
    switch (event.type) {
      case 'file:created':
      case 'file:modified':
      case 'file:deleted':
      case 'file:renamed':
      case 'file:moved':
        return this.validateFileEvent(event as FileEvent);
      
      case 'user:joined':
      case 'user:left':
      case 'user:typing':
      case 'user:idle':
      case 'user:active':
        return this.validateUserActionEvent(event as UserActionEvent);
      
      case 'session:created':
      case 'session:updated':
      case 'session:deleted':
      case 'session:shared':
        return this.validateSessionEvent(event as SessionEvent);
      
      case 'session:status-changed':
      case 'session:progress-updated':
      case 'session:metadata-changed':
      case 'session:performance-updated':
      case 'session:error-occurred':
      case 'session:warning-issued':
        return this.validateSessionStatusEvent(event as SessionStatusEvent);
      
      case 'code:changed':
      case 'code:saved':
      case 'code:executed':
      case 'code:error':
        return this.validateCodeEvent(event as CodeEvent);
      
      case 'message:sent':
      case 'message:edited':
      case 'message:deleted':
        return this.validateMessageEvent(event as MessageEvent);
      
      case 'system:notification':
      case 'system:error':
      case 'system:maintenance':
        return this.validateSystemEvent(event as SystemEvent);
      
      case 'custom:event':
        return this.validateCustomEvent(event as CustomEvent);
      
      default:
        return false;
    }
  }

  private validateFileEvent(event: FileEvent): boolean {
    return !!(event.data?.filePath && event.data?.fileName);
  }

  private validateUserActionEvent(event: UserActionEvent): boolean {
    return !!(event.data?.userId && event.data?.action);
  }

  private validateSessionEvent(event: SessionEvent): boolean {
    return !!(event.data?.sessionId);
  }

  private validateSessionStatusEvent(event: SessionStatusEvent): boolean {
    return !!(event.data?.sessionId);
  }

  private validateCodeEvent(event: CodeEvent): boolean {
    return !!(event.data?.filePath);
  }

  private validateMessageEvent(event: MessageEvent): boolean {
    return !!(event.data?.messageId && event.data?.content);
  }

  private validateSystemEvent(event: SystemEvent): boolean {
    return !!(event.data?.level && event.data?.title && event.data?.message);
  }

  private validateCustomEvent(event: CustomEvent): boolean {
    return !!(event.data?.eventName);
  }

  // Middleware management
  public addMiddleware(middleware: EventMiddleware): void {
    this.middleware.push(middleware);
  }

  public removeMiddleware(middleware: EventMiddleware): void {
    const index = this.middleware.indexOf(middleware);
    if (index > -1) {
      this.middleware.splice(index, 1);
    }
  }

  // Event publishing
  public async publishEvent(event: AppEvent, socket?: TypedSocket): Promise<boolean> {
    // Validate event
    if (!this.validateEvent(event)) {
      console.warn('Invalid event rejected:', event);
      return false;
    }

    // Run middleware
    for (const middleware of this.middleware) {
      try {
        const result = await middleware(event, socket);
        if (!result) {
          console.log('Event blocked by middleware:', event.type);
          return false;
        }
      } catch (error) {
        console.error('Middleware error:', error);
        return false;
      }
    }

    // Add to history
    this.addToHistory(event);

    // Broadcast event based on type and context
    this.broadcastEvent(event);

    return true;
  }

  // Session status-specific broadcasting
  public async broadcastSessionStatus(sessionId: string, statusData: SessionStatusEvent['data']): Promise<boolean> {
    const event = this.createSessionStatusEvent('session:status-changed', statusData);
    
    // Broadcast to session status subscribers
    const sessionSubscriptions = this.getSessionStatusSubscriptions(sessionId);
    sessionSubscriptions.forEach(subscription => {
      const socket = this.io.sockets.sockets.get(subscription.socketId);
      if (socket) {
        socket.emit('session-status-changed' as any, statusData);
      }
    });

    // Also publish as regular event for general event subscribers
    return await this.publishEvent(event);
  }

  // Event broadcasting
  private broadcastEvent(event: AppEvent): void {
    const eventName = `event:${event.type}`;
    
    // Broadcast to all subscribers
    const relevantSubscriptions = this.getRelevantSubscriptions(event);
    
    relevantSubscriptions.forEach(subscription => {
      const socket = this.io.sockets.sockets.get(subscription.socketId);
      if (socket) {
        socket.emit('app-event' as any, event);
      }
    });

    // Note: Room-based broadcasting is disabled to maintain subscription filtering
    // If needed, clients should subscribe to events rather than relying on room membership

    // Broadcast to global event stream (for debugging/monitoring)
    this.io.emit('app-event-global' as any, {
      type: event.type,
      id: event.id,
      timestamp: event.timestamp,
      userId: event.userId,
      sessionId: event.sessionId
    });
  }

  // Event subscription management
  public subscribe(socketId: string, filter: EventFilter): string {
    const subscription: EventSubscription = {
      id: randomUUID(),
      socketId,
      filter,
      createdAt: new Date(),
      active: true
    };

    this.subscriptions.set(subscription.id, subscription);
    console.log(`Created subscription ${subscription.id} for socket ${socketId}`);
    
    return subscription.id;
  }

  public unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.subscriptions.delete(subscriptionId);
      console.log(`Removed subscription ${subscriptionId}`);
      return true;
    }
    return false;
  }

  public unsubscribeSocket(socketId: string): number {
    let removed = 0;
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.socketId === socketId) {
        this.subscriptions.delete(id);
        removed++;
      }
    }
    console.log(`Removed ${removed} subscriptions for socket ${socketId}`);
    return removed;
  }

  // Session status subscription management
  public subscribeToSessionStatus(
    socketId: string,
    sessionId: string,
    filters?: SessionStatusSubscription['filters']
  ): string {
    const subscription: SessionStatusSubscription = {
      id: randomUUID(),
      sessionId,
      socketId,
      createdAt: new Date(),
      active: true,
      filters
    };

    this.sessionStatusSubscriptions.set(subscription.id, subscription);
    console.log(`Created session status subscription ${subscription.id} for session ${sessionId} on socket ${socketId}`);
    
    return subscription.id;
  }

  public unsubscribeFromSessionStatus(subscriptionId: string): boolean {
    const subscription = this.sessionStatusSubscriptions.get(subscriptionId);
    if (subscription) {
      this.sessionStatusSubscriptions.delete(subscriptionId);
      console.log(`Removed session status subscription ${subscriptionId}`);
      return true;
    }
    return false;
  }

  public unsubscribeSocketFromSessionStatus(socketId: string): number {
    let removed = 0;
    for (const [id, subscription] of this.sessionStatusSubscriptions.entries()) {
      if (subscription.socketId === socketId) {
        this.sessionStatusSubscriptions.delete(id);
        removed++;
      }
    }
    console.log(`Removed ${removed} session status subscriptions for socket ${socketId}`);
    return removed;
  }

  private getSessionStatusSubscriptions(sessionId: string): SessionStatusSubscription[] {
    const subscriptions: SessionStatusSubscription[] = [];
    
    for (const subscription of this.sessionStatusSubscriptions.values()) {
      if (subscription.active && subscription.sessionId === sessionId) {
        subscriptions.push(subscription);
      }
    }
    
    return subscriptions;
  }

  // Get subscriptions that match an event
  private getRelevantSubscriptions(event: AppEvent): EventSubscription[] {
    const relevantSubscriptions: EventSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      if (!subscription.active) continue;
      
      if (this.eventMatchesFilter(event, subscription.filter)) {
        relevantSubscriptions.push(subscription);
      }
    }

    return relevantSubscriptions;
  }

  // Event filtering
  private eventMatchesFilter(event: AppEvent, filter: EventFilter): boolean {
    // Check event types
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(event.type)) {
        return false;
      }
    }

    // Check user ID
    if (filter.userId && event.userId !== filter.userId) {
      return false;
    }

    // Check session ID
    if (filter.sessionId && event.sessionId !== filter.sessionId) {
      return false;
    }

    // Check file path (for file events)
    if (filter.filePath) {
      const eventData = event.data as any;
      // Only apply filter to events that actually have filePath
      if (eventData && eventData.filePath) {
        if (eventData.filePath !== filter.filePath) {
          return false;
        }
      } else {
        // If event doesn't have filePath but filter requires it, exclude the event
        return false;
      }
    }

    // Check date range
    if (filter.dateRange) {
      const eventTime = new Date(event.timestamp);
      if (eventTime < filter.dateRange.start || eventTime > filter.dateRange.end) {
        return false;
      }
    }

    // Check tags (if implemented in metadata)
    if (filter.tags && filter.tags.length > 0) {
      const eventTags = event.metadata?.tags as string[] || [];
      const hasMatchingTag = filter.tags.some(tag => eventTags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  }

  // Event history management
  private addToHistory(event: AppEvent): void {
    this.eventHistory.push(event);

    // Maintain history size limit
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  public getEventHistory(
    filter?: EventFilter,
    page: number = 1,
    pageSize: number = 50
  ): EventHistory {
    let filteredEvents = this.eventHistory;

    // Apply filter if provided
    if (filter) {
      filteredEvents = this.eventHistory.filter(event => 
        this.eventMatchesFilter(event, filter)
      );
    }

    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

    return {
      events: paginatedEvents,
      totalCount: filteredEvents.length,
      page,
      pageSize,
      hasMore: endIndex < filteredEvents.length
    };
  }

  // Event replay functionality
  public async replayEvents(
    socketId: string,
    filter?: EventFilter,
    startTime?: Date
  ): Promise<number> {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) {
      return 0;
    }

    let eventsToReplay = this.eventHistory;

    // Apply filters
    if (filter) {
      eventsToReplay = eventsToReplay.filter(event => 
        this.eventMatchesFilter(event, filter)
      );
    }

    if (startTime) {
      eventsToReplay = eventsToReplay.filter(event => 
        new Date(event.timestamp) >= startTime
      );
    }

    // Sort chronologically for replay
    eventsToReplay.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Emit replay events
    socket.emit('event-replay-start' as any, { count: eventsToReplay.length });
    
    for (const event of eventsToReplay) {
      socket.emit('app-event' as any, event);
    }
    
    socket.emit('event-replay-end' as any);

    console.log(`Replayed ${eventsToReplay.length} events to socket ${socketId}`);
    return eventsToReplay.length;
  }

  // Statistics and monitoring
  public getEventStats() {
    const stats = {
      totalEvents: this.eventHistory.length,
      activeSubscriptions: this.subscriptions.size,
      activeSessionStatusSubscriptions: this.sessionStatusSubscriptions.size,
      eventsByType: new Map<EventType, number>(),
      recentActivity: this.getRecentActivity(),
      historySize: this.eventHistory.length,
      maxHistorySize: this.maxHistorySize,
      sessionStatusSubscriptionsBySession: new Map<string, number>()
    };

    // Count events by type
    for (const event of this.eventHistory) {
      const count = stats.eventsByType.get(event.type) || 0;
      stats.eventsByType.set(event.type, count + 1);
    }

    // Count session status subscriptions by session
    for (const subscription of this.sessionStatusSubscriptions.values()) {
      const count = stats.sessionStatusSubscriptionsBySession.get(subscription.sessionId) || 0;
      stats.sessionStatusSubscriptionsBySession.set(subscription.sessionId, count + 1);
    }

    return stats;
  }

  private getRecentActivity(minutes: number = 5): AppEvent[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.eventHistory.filter(event => 
      new Date(event.timestamp) >= cutoff
    );
  }

  // Cleanup methods
  public cleanupHistory(olderThan: Date): number {
    const initialLength = this.eventHistory.length;
    this.eventHistory = this.eventHistory.filter(event => 
      new Date(event.timestamp) >= olderThan
    );
    const removed = initialLength - this.eventHistory.length;
    console.log(`Cleaned up ${removed} old events from history`);
    return removed;
  }

  public cleanupInactiveSubscriptions(): number {
    let removed = 0;
    
    // Clean up regular subscriptions
    for (const [id, subscription] of this.subscriptions.entries()) {
      const socket = this.io.sockets.sockets.get(subscription.socketId);
      if (!socket) {
        this.subscriptions.delete(id);
        removed++;
      }
    }
    
    // Clean up session status subscriptions
    for (const [id, subscription] of this.sessionStatusSubscriptions.entries()) {
      const socket = this.io.sockets.sockets.get(subscription.socketId);
      if (!socket) {
        this.sessionStatusSubscriptions.delete(id);
        removed++;
      }
    }
    
    console.log(`Cleaned up ${removed} inactive subscriptions`);
    return removed;
  }
}