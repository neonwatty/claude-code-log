import { NotificationData, NotificationPreferences, SessionBrowserWebSocket } from './session-browser-websocket';
import { NotificationManager } from '../components/session-browser/notification-manager';
import { NotificationPreferencesComponent } from '../components/session-browser/notification-preferences';

export interface NotificationServiceConfig {
  enableBrowserNotifications?: boolean;
  enableSoundNotifications?: boolean;
  enableInAppNotifications?: boolean;
  persistentStorage?: boolean;
  debugMode?: boolean;
  managerPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxNotifications?: number;
  autoCloseDelay?: number;
}

export interface NotificationTemplate {
  id: string;
  title: string;
  message: string;
  type: NotificationData['type'];
  category: string;
  variables: string[];
}

export interface NotificationStats {
  totalSent: number;
  totalDismissed: number;
  totalInteracted: number;
  byType: Record<NotificationData['type'], number>;
  byCategory: Record<string, number>;
  averageDisplayTime: number;
  lastActivity: Date;
}

/**
 * Comprehensive notification service
 * Manages all notification types, preferences, and delivery methods
 */
export class NotificationService {
  private webSocketService: SessionBrowserWebSocket | null = null;
  private notificationManager: NotificationManager | null = null;
  private preferences: NotificationPreferences;
  private config: Required<NotificationServiceConfig>;
  private templates = new Map<string, NotificationTemplate>();
  private stats: NotificationStats;
  private isInitialized = false;

  constructor(config: NotificationServiceConfig = {}) {
    this.config = {
      enableBrowserNotifications: config.enableBrowserNotifications ?? true,
      enableSoundNotifications: config.enableSoundNotifications ?? false,
      enableInAppNotifications: config.enableInAppNotifications ?? true,
      persistentStorage: config.persistentStorage ?? true,
      debugMode: config.debugMode ?? false,
      managerPosition: config.managerPosition ?? 'top-right',
      maxNotifications: config.maxNotifications ?? 5,
      autoCloseDelay: config.autoCloseDelay ?? 5000,
    };

    this.preferences = this.loadPreferences();
    this.stats = this.loadStats();
    this.initializeTemplates();
  }

  /**
   * Initialize the notification service
   */
  async initialize(webSocketService?: SessionBrowserWebSocket): Promise<void> {
    if (this.isInitialized) return;

    this.debug('Initializing notification service...');

    // Setup WebSocket service
    if (webSocketService) {
      this.webSocketService = webSocketService;
      this.setupWebSocketListeners();
    }

    // Initialize notification manager
    if (this.config.enableInAppNotifications) {
      await this.initializeNotificationManager();
    }

    // Request browser notification permission if needed
    if (this.config.enableBrowserNotifications && this.preferences.browserNotifications) {
      await this.requestBrowserPermission();
    }

    this.isInitialized = true;
    this.debug('Notification service initialized');
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupWebSocketListeners(): void {
    if (!this.webSocketService) return;

    this.webSocketService.on('notification', (notification: NotificationData) => {
      this.handleNotification(notification);
    });

    this.webSocketService.on('session-update', (update) => {
      this.handleSessionUpdate(update);
    });

    this.webSocketService.on('connection-status-changed', (status) => {
      this.handleConnectionStatusChanged(status);
    });
  }

  /**
   * Initialize notification manager UI component
   */
  private async initializeNotificationManager(): Promise<void> {
    // Create notification manager element if not exists
    let manager = document.querySelector('notification-manager') as NotificationManager;
    
    if (!manager) {
      manager = document.createElement('notification-manager');
      document.body.appendChild(manager);
    }

    // Configure manager
    manager.updateConfig({
      position: this.config.managerPosition,
      maxNotifications: this.config.maxNotifications,
      autoCloseDelay: this.config.autoCloseDelay,
      enableSounds: this.preferences.soundEnabled,
      enableAnimations: true,
    });

    // Setup event listeners
    manager.addEventListener('notification-dismissed', (event: any) => {
      this.stats.totalDismissed++;
      this.saveStats();
      this.debug('Notification dismissed:', event.detail);
    });

    manager.addEventListener('notification-action', (event: any) => {
      this.stats.totalInteracted++;
      this.saveStats();
      this.handleNotificationAction(event.detail);
    });

    manager.addEventListener('navigate-to-session', (event: any) => {
      this.navigateToSession(event.detail.sessionId);
    });

    this.notificationManager = manager;
  }

  /**
   * Handle incoming notifications
   */
  private handleNotification(notification: NotificationData): void {
    this.debug('Received notification:', notification);

    // Check if notification should be shown based on preferences
    if (!this.shouldShowNotification(notification)) {
      this.debug('Notification filtered out by preferences');
      return;
    }

    // Update stats
    this.stats.totalSent++;
    this.stats.byType[notification.type] = (this.stats.byType[notification.type] || 0) + 1;
    this.stats.lastActivity = new Date();
    this.saveStats();

    // Show in-app notification
    if (this.config.enableInAppNotifications && this.notificationManager) {
      this.notificationManager.addNotification(notification);
    }

    // Show browser notification
    if (this.config.enableBrowserNotifications && this.preferences.browserNotifications) {
      this.showBrowserNotification(notification);
    }

    // Play sound
    if (this.config.enableSoundNotifications && this.preferences.soundEnabled) {
      this.playNotificationSound(notification.type);
    }

    this.debug('Notification processed:', notification.id);
  }

  /**
   * Handle session updates that may trigger notifications
   */
  private handleSessionUpdate(update: any): void {
    // Generate notifications for relevant session updates
    const notificationData: Partial<NotificationData> = {
      id: `session-update-${Date.now()}`,
      timestamp: new Date(),
      sessionId: update.sessionId,
    };

    switch (update.type) {
      case 'session-created':
        if (this.preferences.newSessions) {
          Object.assign(notificationData, {
            type: 'success' as const,
            title: 'New Session Created',
            message: `Session ${update.sessionId.substring(0, 8)} has been created`,
          });
          this.handleNotification(notificationData as NotificationData);
        }
        break;

      case 'session-updated':
        if (this.preferences.sessionUpdates) {
          Object.assign(notificationData, {
            type: 'info' as const,
            title: 'Session Updated',
            message: `Session ${update.sessionId.substring(0, 8)} has been updated`,
          });
          this.handleNotification(notificationData as NotificationData);
        }
        break;

      case 'message-added':
        if (this.preferences.newMessages) {
          Object.assign(notificationData, {
            type: 'info' as const,
            title: 'New Message',
            message: `New message in session ${update.sessionId.substring(0, 8)}`,
          });
          this.handleNotification(notificationData as NotificationData);
        }
        break;

      case 'session-error':
        Object.assign(notificationData, {
          type: 'error' as const,
          title: 'Session Error',
          message: `Error in session ${update.sessionId.substring(0, 8)}`,
          persistent: true,
        });
        this.handleNotification(notificationData as NotificationData);
        break;
    }
  }

  /**
   * Handle connection status changes
   */
  private handleConnectionStatusChanged(status: any): void {
    if (status.connected && status.reconnecting) {
      this.showNotification({
        id: `reconnected-${Date.now()}`,
        type: 'success',
        title: 'Connection Restored',
        message: 'Real-time updates are working again',
        timestamp: new Date(),
      });
    } else if (!status.connected && !status.connecting) {
      this.showNotification({
        id: `disconnected-${Date.now()}`,
        type: 'warning',
        title: 'Connection Lost',
        message: 'Real-time updates are temporarily unavailable',
        timestamp: new Date(),
        persistent: true,
      });
    }
  }

  /**
   * Check if notification should be shown based on preferences
   */
  private shouldShowNotification(notification: NotificationData): boolean {
    const { filters } = this.preferences;
    if (!filters) return true;

    // Session ID filter
    if (filters.sessionIds && filters.sessionIds.length > 0 && notification.sessionId) {
      if (!filters.sessionIds.includes(notification.sessionId)) return false;
    }

    // Message type filter (if applicable)
    if (filters.messageTypes && filters.messageTypes.length > 0) {
      // This would need to be enhanced based on message data structure
    }

    // Keyword filter
    if (filters.keywords && filters.keywords.length > 0) {
      const text = `${notification.title} ${notification.message}`.toLowerCase();
      const hasKeyword = filters.keywords.some(keyword => 
        text.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    return true;
  }

  /**
   * Show browser notification
   */
  private showBrowserNotification(notification: NotificationData): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    try {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.sessionId || notification.id,
        requireInteraction: notification.persistent,
        data: notification,
      });

      browserNotification.onclick = () => {
        if (notification.sessionId) {
          this.navigateToSession(notification.sessionId);
        }
        browserNotification.close();
      };

      // Auto-close non-persistent notifications
      if (!notification.persistent) {
        setTimeout(() => {
          browserNotification.close();
        }, this.config.autoCloseDelay);
      }
    } catch (error) {
      this.debug('Failed to show browser notification:', error);
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(type: NotificationData['type']): void {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      const frequencies = {
        info: 800,
        success: 1000,
        warning: 600,
        error: 400,
      };

      oscillator.frequency.value = frequencies[type];
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.05, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.3);
    } catch (error) {
      this.debug('Failed to play notification sound:', error);
    }
  }

  /**
   * Handle notification action
   */
  private handleNotificationAction(detail: any): void {
    const { notificationId, action, actionLabel } = detail;
    
    this.debug('Notification action:', { notificationId, action, actionLabel });

    // Handle different action types
    switch (action) {
      case 'navigate-to-session':
        if (detail.sessionId) {
          this.navigateToSession(detail.sessionId);
        }
        break;
      case 'dismiss':
        // Already handled by manager
        break;
      case 'snooze':
        this.snoozeNotification(notificationId);
        break;
      default:
        this.debug('Unknown notification action:', action);
    }
  }

  /**
   * Navigate to session (emit event for parent application to handle)
   */
  private navigateToSession(sessionId: string): void {
    window.dispatchEvent(new CustomEvent('navigate-to-session', {
      detail: { sessionId }
    }));
  }

  /**
   * Snooze a notification
   */
  private snoozeNotification(notificationId: string, delayMs: number = 300000): void {
    // Remove from manager
    if (this.notificationManager) {
      this.notificationManager.removeNotification(notificationId);
    }

    // Re-show after delay
    setTimeout(() => {
      // This would need to be implemented based on how notifications are stored
      this.debug('Snoozed notification would reappear now:', notificationId);
    }, delayMs);
  }

  /**
   * Request browser notification permission
   */
  private async requestBrowserPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      this.debug('Browser notifications not supported');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.debug('Browser notification permission:', permission);
      return permission;
    }

    return Notification.permission;
  }

  /**
   * Load preferences from storage
   */
  private loadPreferences(): NotificationPreferences {
    if (!this.config.persistentStorage) {
      return this.getDefaultPreferences();
    }

    try {
      const stored = localStorage.getItem('notification-service-preferences');
      if (stored) {
        return { ...this.getDefaultPreferences(), ...JSON.parse(stored) };
      }
    } catch (error) {
      this.debug('Failed to load preferences:', error);
    }

    return this.getDefaultPreferences();
  }

  /**
   * Save preferences to storage
   */
  private savePreferences(): void {
    if (!this.config.persistentStorage) return;

    try {
      localStorage.setItem('notification-service-preferences', JSON.stringify(this.preferences));
    } catch (error) {
      this.debug('Failed to save preferences:', error);
    }
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): NotificationPreferences {
    return {
      newSessions: true,
      sessionUpdates: true,
      newMessages: true,
      sessionStateChanges: true,
      soundEnabled: false,
      browserNotifications: true,
      emailNotifications: false,
      filters: {
        sessionIds: [],
        messageTypes: [],
        keywords: [],
        excludeOwnMessages: true,
      },
    };
  }

  /**
   * Load stats from storage
   */
  private loadStats(): NotificationStats {
    if (!this.config.persistentStorage) {
      return this.getDefaultStats();
    }

    try {
      const stored = localStorage.getItem('notification-service-stats');
      if (stored) {
        const stats = JSON.parse(stored);
        // Convert lastActivity back to Date
        if (stats.lastActivity) {
          stats.lastActivity = new Date(stats.lastActivity);
        }
        return stats;
      }
    } catch (error) {
      this.debug('Failed to load stats:', error);
    }

    return this.getDefaultStats();
  }

  /**
   * Save stats to storage
   */
  private saveStats(): void {
    if (!this.config.persistentStorage) return;

    try {
      localStorage.setItem('notification-service-stats', JSON.stringify(this.stats));
    } catch (error) {
      this.debug('Failed to save stats:', error);
    }
  }

  /**
   * Get default stats
   */
  private getDefaultStats(): NotificationStats {
    return {
      totalSent: 0,
      totalDismissed: 0,
      totalInteracted: 0,
      byType: { info: 0, success: 0, warning: 0, error: 0 },
      byCategory: {},
      averageDisplayTime: 0,
      lastActivity: new Date(),
    };
  }

  /**
   * Initialize notification templates
   */
  private initializeTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'session-created',
        title: 'New Session Created',
        message: 'Session {{sessionId}} has been created',
        type: 'success',
        category: 'session',
        variables: ['sessionId'],
      },
      {
        id: 'message-added',
        title: 'New Message',
        message: 'New {{messageType}} message in session {{sessionId}}',
        type: 'info',
        category: 'message',
        variables: ['messageType', 'sessionId'],
      },
      {
        id: 'session-error',
        title: 'Session Error',
        message: 'Error in session {{sessionId}}: {{errorMessage}}',
        type: 'error',
        category: 'error',
        variables: ['sessionId', 'errorMessage'],
      },
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Debug logging
   */
  private debug(...args: any[]): void {
    if (this.config.debugMode) {
      console.log('[NotificationService]', ...args);
    }
  }

  // Public API

  /**
   * Show a notification manually
   */
  showNotification(notification: NotificationData): void {
    this.handleNotification(notification);
  }

  /**
   * Show notification from template
   */
  showTemplateNotification(templateId: string, variables: Record<string, string>, overrides?: Partial<NotificationData>): void {
    const template = this.templates.get(templateId);
    if (!template) {
      this.debug('Template not found:', templateId);
      return;
    }

    let title = template.title;
    let message = template.message;

    // Replace template variables
    template.variables.forEach(variable => {
      if (variables[variable]) {
        title = title.replace(new RegExp(`{{${variable}}}`, 'g'), variables[variable]);
        message = message.replace(new RegExp(`{{${variable}}}`, 'g'), variables[variable]);
      }
    });

    const notification: NotificationData = {
      id: `template-${templateId}-${Date.now()}`,
      type: template.type,
      title,
      message,
      timestamp: new Date(),
      ...overrides,
    };

    this.showNotification(notification);
  }

  /**
   * Update preferences
   */
  updatePreferences(preferences: Partial<NotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
    this.savePreferences();

    // Update WebSocket service preferences
    if (this.webSocketService) {
      this.webSocketService.updateNotificationPreferences(this.preferences);
    }

    // Update notification manager
    if (this.notificationManager) {
      this.notificationManager.updateConfig({
        enableSounds: this.preferences.soundEnabled,
      });
    }

    this.debug('Preferences updated:', this.preferences);
  }

  /**
   * Get current preferences
   */
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Get notification stats
   */
  getStats(): NotificationStats {
    return { ...this.stats };
  }

  /**
   * Clear notification history
   */
  clearHistory(): void {
    if (this.notificationManager) {
      this.notificationManager.clearAllNotifications();
    }
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = this.getDefaultStats();
    this.saveStats();
  }

  /**
   * Add custom notification template
   */
  addTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get notification manager instance
   */
  getNotificationManager(): NotificationManager | null {
    return this.notificationManager;
  }

  /**
   * Check if browser notifications are supported and permitted
   */
  isBrowserNotificationAvailable(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  /**
   * Destroy the service and cleanup
   */
  destroy(): void {
    if (this.notificationManager) {
      this.notificationManager.clearAllNotifications();
      this.notificationManager.remove();
    }

    this.isInitialized = false;
    this.debug('Notification service destroyed');
  }
}

// Export default instance
export const notificationService = new NotificationService();
export default NotificationService;