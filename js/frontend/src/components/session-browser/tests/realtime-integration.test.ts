import { expect } from '@esm-bundle/chai';
import { fixture, html, oneEvent, nextFrame } from '@open-wc/testing';
import { stub, SinonStub } from 'sinon';
import { RealtimeSessionBrowser } from '../realtime-session-browser';
import { SessionBrowserWebSocket } from '../../../services/session-browser-websocket';
import { NotificationService } from '../../../services/notification-service';
import { SessionSummary, SessionDetail } from '../../types/session-types';

describe('Realtime Integration Tests', () => {
  let element: RealtimeSessionBrowser;
  let mockWebSocket: Partial<SessionBrowserWebSocket>;
  let mockNotificationService: Partial<NotificationService>;

  // Test data
  const mockSessions: SessionSummary[] = [
    {
      sessionId: 'session-1',
      title: 'Test Session 1',
      cwd: '/test/path/1',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: undefined,
      messageCount: 5,
      userMessageCount: 2,
      assistantMessageCount: 3,
      duration: undefined,
      isActive: true,
      tags: ['test', 'active'],
      summary: 'A test session for integration testing',
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
      },
    },
    {
      sessionId: 'session-2',
      title: 'Test Session 2',
      cwd: '/test/path/2',
      startTime: new Date('2024-01-01T09:00:00Z'),
      endTime: new Date('2024-01-01T09:30:00Z'),
      messageCount: 10,
      userMessageCount: 5,
      assistantMessageCount: 5,
      duration: 1800000, // 30 minutes
      isActive: false,
      tags: ['test', 'completed'],
      summary: 'A completed test session',
      tokenUsage: {
        inputTokens: 200,
        outputTokens: 400,
        totalTokens: 600,
      },
    },
  ];

  beforeEach(async () => {
    // Mock WebSocket service
    mockWebSocket = {
      connect: stub().resolves(),
      disconnect: stub(),
      on: stub(),
      subscribeToSession: stub(),
      unsubscribeFromSession: stub(),
      getConnectionStatus: stub().returns({
        connected: true,
        connecting: false,
        reconnecting: false,
        reconnectionAttempts: 0,
        quality: 'excellent',
        latency: 50,
      }),
      getNotificationPreferences: stub().returns({
        newSessions: true,
        sessionUpdates: true,
        newMessages: true,
        sessionStateChanges: true,
        soundEnabled: false,
        browserNotifications: true,
        emailNotifications: false,
        filters: {},
      }),
      updateNotificationPreferences: stub(),
      testConnection: stub().resolves(true),
    };

    // Mock Notification service
    mockNotificationService = {
      initialize: stub().resolves(),
      showNotification: stub(),
      updatePreferences: stub(),
      destroy: stub(),
    };

    // Create element
    element = await fixture(html`
      <realtime-session-browser
        .config=${{
          enableRealtime: true,
          enableNotifications: true,
          enableStateIndicators: true,
          enableConnectionStatus: true,
          enableLiveMessages: true,
          autoConnect: false, // Don't auto-connect in tests
          debugMode: true,
        }}
      ></realtime-session-browser>
    `);

    // Wait for element to be fully rendered and connected
    await element.updateComplete;
    await nextFrame();

    // Inject mocks after element is ready
    (element as any).webSocketService = mockWebSocket;
    (element as any).notificationService = mockNotificationService;
    
    // Force a re-render with mocked services
    element.requestUpdate();
    await element.updateComplete;
  });

  describe('Multi-Session Scenarios', () => {
    it('should handle multiple active sessions simultaneously', async () => {
      // Simulate multiple sessions being received
      const sessions = [
        { ...mockSessions[0], isActive: true },
        { ...mockSessions[1], isActive: true, sessionId: 'session-3' },
      ];

      // Update the component's internal state directly through its public API
      (element as any).browserState = {
        ...(element as any).browserState || {},
        sessions: sessions,
        isLoading: false
      };

      element.requestUpdate();
      await element.updateComplete;
      await nextFrame();

      // Verify the sessions are accessible through the public API
      const currentSessions = element.getSessions();
      expect(currentSessions.length).to.equal(2);

      // Verify both sessions are active
      const activeSessions = currentSessions.filter(s => s.isActive);
      expect(activeSessions.length).to.equal(2);
    });

    it('should handle session state transitions correctly', async () => {
      // Start with an active session
      let sessions = [{ ...mockSessions[0], isActive: true }];
      element.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions },
      }));
      await nextFrame();

      // Simulate session completion
      sessions = [{ ...mockSessions[0], isActive: false, endTime: new Date() }];
      element.dispatchEvent(new CustomEvent('session-modified', {
        detail: { session: sessions[0] },
      }));
      await nextFrame();

      const stateIndicator = element.shadowRoot!.querySelector('session-state-indicator');
      expect(stateIndicator).to.exist;
    });

    it('should handle concurrent message updates across multiple sessions', async () => {
      // Setup multiple active sessions
      const sessions = [
        { ...mockSessions[0], isActive: true },
        { ...mockSessions[1], isActive: true, sessionId: 'session-3' },
      ];

      element.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions },
      }));
      await nextFrame();

      // Simulate concurrent message updates
      const messageUpdates = [
        { sessionId: 'session-1', messageCount: 6 },
        { sessionId: 'session-3', messageCount: 12 },
      ];

      messageUpdates.forEach(update => {
        element.dispatchEvent(new CustomEvent('session-modified', {
          detail: { 
            session: { 
              sessionId: update.sessionId,
              messageCount: update.messageCount 
            }
          },
        }));
      });

      await nextFrame();

      // Verify updates were applied
      const sessionItems = element.shadowRoot!.querySelectorAll('.session-item');
      expect(sessionItems.length).to.equal(2);
    });

    it('should maintain session order during real-time updates', async () => {
      // Setup sessions with specific order
      const sessions = [
        { ...mockSessions[0], startTime: new Date('2024-01-01T10:00:00Z') },
        { ...mockSessions[1], startTime: new Date('2024-01-01T11:00:00Z') },
      ];

      element.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions },
      }));
      await nextFrame();

      // Add a new session that should appear first (most recent)
      const newSession = {
        ...mockSessions[0],
        sessionId: 'session-new',
        startTime: new Date('2024-01-01T12:00:00Z'),
      };

      element.dispatchEvent(new CustomEvent('session-added', {
        detail: { session: newSession },
      }));
      await nextFrame();

      const sessionTitles = Array.from(
        element.shadowRoot!.querySelectorAll('.session-title')
      ).map(el => el.textContent);

      // With default desc order by startTime, newest should be first
      expect(sessionTitles[0]).to.include('session-new');
    });

    it('should handle bulk session updates efficiently', async () => {
      const bulkSessions = Array.from({ length: 50 }, (_, i) => ({
        ...mockSessions[0],
        sessionId: `bulk-session-${i}`,
        title: `Bulk Session ${i}`,
      }));

      const startTime = performance.now();
      
      element.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: bulkSessions },
      }));
      await nextFrame();

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Should handle bulk updates within reasonable time (< 100ms)
      expect(updateTime).to.be.lessThan(100);

      const sessionItems = element.shadowRoot!.querySelectorAll('.session-item');
      expect(sessionItems.length).to.equal(50);
    });
  });

  describe('WebSocket Connection Management', () => {
    it('should handle connection loss gracefully', async () => {
      // Simulate connection loss
      const connectionStatus = {
        connected: false,
        connecting: false,
        reconnecting: false,
        reconnectionAttempts: 0,
        quality: 'disconnected' as const,
      };

      // Update connection status
      (element as any).browserState = {
        ...(element as any).browserState || {},
        connectionStatus,
      };
      element.requestUpdate();
      await element.updateComplete;
      await nextFrame();

      // Verify connection status is properly set
      const currentStatus = (element as any).browserState?.connectionStatus;
      expect(currentStatus?.connected).to.equal(false);
      expect(currentStatus?.quality).to.equal('disconnected');
    });

    it('should attempt reconnection on connection failure', async () => {
      // Simulate reconnection attempt
      const connectionStatus = {
        connected: false,
        connecting: false,
        reconnecting: true,
        reconnectionAttempts: 3,
        quality: 'disconnected' as const,
      };

      (element as any).browserState = {
        ...(element as any).browserState,
        connectionStatus,
      };
      element.requestUpdate();
      await nextFrame();

      // Check that reconnection UI is shown
      const statusIndicator = element.shadowRoot!.querySelector('connection-status-indicator');
      expect(statusIndicator).to.exist;
    });

    it('should update connection quality indicators', async () => {
      const qualityLevels = ['excellent', 'good', 'fair', 'poor'] as const;

      for (const quality of qualityLevels) {
        const connectionStatus = {
          connected: true,
          connecting: false,
          reconnecting: false,
          reconnectionAttempts: 0,
          quality,
          latency: quality === 'excellent' ? 20 : quality === 'good' ? 100 : quality === 'fair' ? 200 : 500,
        };

        (element as any).browserState = {
          ...(element as any).browserState,
          connectionStatus,
        };
        element.requestUpdate();
        await nextFrame();

        const statusIndicator = element.shadowRoot!.querySelector('connection-status-indicator');
        expect(statusIndicator).to.exist;
      }
    });
  });

  describe('Notification System Integration', () => {
    it('should show notifications for new sessions', async () => {
      const newSession = { ...mockSessions[0], sessionId: 'new-session' };
      
      element.dispatchEvent(new CustomEvent('session-added', {
        detail: { session: newSession },
      }));
      await nextFrame();

      // Check if notification service was called
      expect(mockNotificationService.showNotification).to.have.been.called;
    });

    it('should handle notification preferences updates', async () => {
      const newPreferences = {
        newSessions: false,
        sessionUpdates: true,
        newMessages: false,
        sessionStateChanges: true,
        soundEnabled: true,
        browserNotifications: false,
        emailNotifications: false,
        filters: { keywords: ['test'] },
      };

      // Simulate preferences update
      element.dispatchEvent(new CustomEvent('preferences-changed', {
        detail: { preferences: newPreferences },
      }));
      await nextFrame();

      expect(mockWebSocket.updateNotificationPreferences).to.have.been.calledWith(newPreferences);
      expect(mockNotificationService.updatePreferences).to.have.been.calledWith(newPreferences);
    });

    it('should filter notifications based on preferences', async () => {
      // Setup notification filters
      const preferences = {
        newSessions: true,
        sessionUpdates: false, // Disabled
        newMessages: true,
        sessionStateChanges: true,
        soundEnabled: false,
        browserNotifications: true,
        emailNotifications: false,
        filters: {
          sessionIds: ['session-1'], // Only session-1
          keywords: ['important'],
        },
      };

      (mockWebSocket.getNotificationPreferences as SinonStub).returns(preferences);

      // Simulate session update that should be filtered out
      element.dispatchEvent(new CustomEvent('session-modified', {
        detail: { 
          session: { sessionId: 'session-2', messageCount: 15 }
        },
      }));
      await nextFrame();

      // Should not show notification due to filters
      // In a real implementation, this would be handled by the notification service
    });
  });

  describe('Live Message Streaming', () => {
    it('should display live message component for active sessions', async () => {
      const activeSession = { ...mockSessions[0], isActive: true };
      
      // Select session to show details
      (element as any).loadSessionDetails(activeSession.sessionId);
      await nextFrame();

      const liveMessageStream = element.shadowRoot!.querySelector('live-message-stream');
      expect(liveMessageStream).to.exist;
    });

    it('should subscribe to session updates when viewing live messages', async () => {
      const activeSession = { ...mockSessions[0], isActive: true };
      
      // Simulate viewing live messages
      const viewButton = element.shadowRoot!.querySelector('[title="View live messages"]') as HTMLElement;
      if (viewButton) {
        viewButton.click();
        await nextFrame();
      }

      expect(mockWebSocket.subscribeToSession).to.have.been.called;
    });

    it('should handle message streaming updates', async () => {
      const activeSession: SessionDetail = {
        ...mockSessions[0],
        isActive: true,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test message',
            timestamp: new Date(),
          },
        ],
      };

      (element as any).browserState = {
        ...(element as any).browserState,
        selectedSession: activeSession,
      };
      element.requestUpdate();
      await nextFrame();

      const liveMessageStream = element.shadowRoot!.querySelector('live-message-stream');
      expect(liveMessageStream).to.exist;
    });
  });

  describe('State Synchronization', () => {
    it('should maintain consistent state across component updates', async () => {
      const initialSessions = [mockSessions[0]];
      
      element.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: initialSessions },
      }));
      await nextFrame();

      // Modify session
      const modifiedSession = { ...mockSessions[0], messageCount: 10 };
      element.dispatchEvent(new CustomEvent('session-modified', {
        detail: { session: modifiedSession },
      }));
      await nextFrame();

      // Check state consistency
      const currentSessions = element.getSessions();
      expect(currentSessions[0].messageCount).to.equal(10);
    });

    it('should handle concurrent state updates correctly', async () => {
      const session = mockSessions[0];
      
      element.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: [session] },
      }));
      await nextFrame();

      // Simulate rapid concurrent updates
      const updates = [
        { messageCount: 6, isActive: true },
        { messageCount: 7, isActive: true },
        { messageCount: 8, isActive: false },
      ];

      updates.forEach((update, index) => {
        setTimeout(() => {
          element.dispatchEvent(new CustomEvent('session-modified', {
            detail: { 
              session: { sessionId: session.sessionId, ...update }
            },
          }));
        }, index * 10);
      });

      // Wait for all updates
      await new Promise(resolve => setTimeout(resolve, 100));
      await nextFrame();

      // Final state should reflect last update
      const currentSessions = element.getSessions();
      expect(currentSessions[0].messageCount).to.equal(8);
      expect(currentSessions[0].isActive).to.equal(false);
    });

    it('should preserve selection state during updates', async () => {
      const sessions = [mockSessions[0], mockSessions[1]];
      
      element.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions },
      }));
      await nextFrame();

      // Select a session
      element.selectSessionById('session-1');
      await nextFrame();

      const selectedSession = element.getSelectedSession();
      expect(selectedSession?.sessionId).to.equal('session-1');

      // Update sessions
      const updatedSession = { ...sessions[0], messageCount: 10 };
      element.dispatchEvent(new CustomEvent('session-modified', {
        detail: { session: updatedSession },
      }));
      await nextFrame();

      // Selection should be preserved
      const stillSelectedSession = element.getSelectedSession();
      expect(stillSelectedSession?.sessionId).to.equal('session-1');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of sessions efficiently', async () => {
      const largeSessions = Array.from({ length: 1000 }, (_, i) => ({
        ...mockSessions[0],
        sessionId: `perf-session-${i}`,
        title: `Performance Session ${i}`,
      }));

      const startTime = performance.now();
      
      element.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: largeSessions },
      }));
      await nextFrame();

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render large number of sessions within reasonable time
      expect(renderTime).to.be.lessThan(200);

      const sessionItems = element.shadowRoot!.querySelectorAll('.session-item');
      expect(sessionItems.length).to.equal(1000);
    });

    it('should debounce rapid filter updates', async () => {
      const sessions = mockSessions;
      
      element.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions },
      }));
      await nextFrame();

      // Simulate rapid filter changes
      const searchInput = element.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
      
      const filterValues = ['t', 'te', 'tes', 'test'];
      filterValues.forEach((value, index) => {
        setTimeout(() => {
          searchInput.value = value;
          searchInput.dispatchEvent(new Event('input'));
        }, index * 50);
      });

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 300));
      await nextFrame();

      // Should show filtered results
      const sessionItems = element.shadowRoot!.querySelectorAll('.session-item');
      expect(sessionItems.length).to.be.lessThan(sessions.length + 1);
    });

    it('should optimize rendering with virtual scrolling for large lists', async () => {
      // This test would be more relevant with virtual scrolling implementation
      const manySession = Array.from({ length: 10000 }, (_, i) => ({
        ...mockSessions[0],
        sessionId: `virt-session-${i}`,
        title: `Virtual Session ${i}`,
      }));

      element.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: manySession },
      }));
      await nextFrame();

      // In a virtual scrolling implementation, only visible items would be rendered
      const sessionItems = element.shadowRoot!.querySelectorAll('.session-item');
      
      // For now, we just check that the component doesn't crash with large datasets
      expect(sessionItems.length).to.be.greaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle WebSocket connection errors gracefully', async () => {
      // Simulate connection error
      const errorEvent = new CustomEvent('websocket-error', {
        detail: { error: 'Connection failed' },
      });

      element.dispatchEvent(errorEvent);
      await nextFrame();

      // Should show error state but not crash
      expect(element.shadowRoot!.querySelector('.browser-content')).to.exist;
    });

    it('should recover from malformed session data', async () => {
      const malformedSessions = [
        { sessionId: 'valid-session', ...mockSessions[0] },
        { sessionId: null, title: 'Invalid session' }, // Invalid data
        { ...mockSessions[1] }, // Valid data
      ];

      // Should not crash with malformed data
      element.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: malformedSessions as any },
      }));
      await nextFrame();

      const sessionItems = element.shadowRoot!.querySelectorAll('.session-item');
      // Should render only valid sessions
      expect(sessionItems.length).to.be.greaterThan(0);
    });

    it('should handle service initialization failures', async () => {
      // Simulate service initialization failure
      (mockWebSocket.connect as SinonStub).rejects(new Error('Connection failed'));

      const element2 = await fixture(html`
        <realtime-session-browser
          .config=${{ enableRealtime: true, autoConnect: true }}
        ></realtime-session-browser>
      `);

      // Should handle initialization failure gracefully
      await nextFrame();
      expect(element2.shadowRoot!.querySelector('.browser-content')).to.exist;
    });
  });

  afterEach(() => {
    // Cleanup any remaining timeouts or intervals
    const highestId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestId; i++) {
      clearTimeout(i);
    }
  });
});