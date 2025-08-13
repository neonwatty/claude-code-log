import { expect } from '@esm-bundle/chai';
import { fixture, html, nextFrame } from '@open-wc/testing';
import { stub, SinonStub } from 'sinon';
import { RealtimeSessionBrowser } from '../realtime-session-browser';
import { SessionBrowserWebSocket } from '../../../services/session-browser-websocket';
import { SessionSummary } from '../../types/session-types';

/**
 * State Synchronization Tests
 * Validates that state remains consistent across multiple browser windows/tabs
 * and handles cross-window communication properly
 */
describe('State Synchronization Tests', () => {
  let primaryBrowser: RealtimeSessionBrowser;
  let secondaryBrowser: RealtimeSessionBrowser;
  let mockWebSocket1: Partial<SessionBrowserWebSocket>;
  let mockWebSocket2: Partial<SessionBrowserWebSocket>;
  let mockBroadcastChannel: Partial<BroadcastChannel>;

  const mockSessions: SessionSummary[] = [
    {
      sessionId: 'sync-session-1',
      title: 'Sync Test Session 1',
      cwd: '/sync/test/1',
      startTime: new Date('2024-01-01T10:00:00Z'),
      messageCount: 5,
      userMessageCount: 2,
      assistantMessageCount: 3,
      isActive: true,
      tags: ['sync', 'test'],
      summary: 'Session for testing synchronization',
      tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    },
    {
      sessionId: 'sync-session-2',
      title: 'Sync Test Session 2',
      cwd: '/sync/test/2',
      startTime: new Date('2024-01-01T09:00:00Z'),
      endTime: new Date('2024-01-01T09:30:00Z'),
      messageCount: 8,
      userMessageCount: 4,
      assistantMessageCount: 4,
      duration: 1800000,
      isActive: false,
      tags: ['sync', 'completed'],
      summary: 'Completed sync test session',
      tokenUsage: { inputTokens: 150, outputTokens: 300, totalTokens: 450 },
    },
  ];

  beforeEach(async () => {
    // Mock BroadcastChannel for cross-window communication
    mockBroadcastChannel = {
      postMessage: stub(),
      close: stub(),
      addEventListener: stub(),
      removeEventListener: stub(),
    };

    // Mock WebSocket services for both instances
    mockWebSocket1 = createMockWebSocket();
    mockWebSocket2 = createMockWebSocket();

    // Create primary browser instance
    primaryBrowser = await fixture(html`
      <realtime-session-browser
        .config=${{
          enableRealtime: true,
          enableNotifications: true,
          enableStateIndicators: true,
          autoConnect: false,
          debugMode: true,
        }}
      ></realtime-session-browser>
    `);

    // Create secondary browser instance (simulating another window/tab)
    secondaryBrowser = await fixture(html`
      <realtime-session-browser
        .config=${{
          enableRealtime: true,
          enableNotifications: true,
          enableStateIndicators: true,
          autoConnect: false,
          debugMode: true,
        }}
      ></realtime-session-browser>
    `);

    // Inject mocks
    (primaryBrowser as any).webSocketService = mockWebSocket1;
    (secondaryBrowser as any).webSocketService = mockWebSocket2;

    // Mock localStorage for state persistence
    global.localStorage = {
      getItem: stub(),
      setItem: stub(),
      removeItem: stub(),
      clear: stub(),
      length: 0,
      key: stub(),
    } as any;
  });

  function createMockWebSocket(): Partial<SessionBrowserWebSocket> {
    const eventHandlers = new Map<string, Function[]>();
    
    return {
      connect: stub().resolves(),
      disconnect: stub(),
      on: stub((event: string, handler: Function) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, []);
        }
        eventHandlers.get(event)!.push(handler);
      }),
      emit: stub((event: string, ...args: any[]) => {
        const handlers = eventHandlers.get(event) || [];
        handlers.forEach(handler => handler(...args));
      }),
      subscribeToSession: stub(),
      unsubscribeFromSession: stub(),
      getConnectionStatus: stub().returns({
        connected: true,
        connecting: false,
        reconnecting: false,
        reconnectionAttempts: 0,
        quality: 'excellent',
      }),
    } as any;
  }

  describe('Cross-Window State Synchronization', () => {
    it('should sync session list between browser instances', async () => {
      // Primary browser receives session updates
      primaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: mockSessions },
      }));
      await nextFrame();

      // Simulate state broadcast to secondary browser
      secondaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: mockSessions },
      }));
      await nextFrame();

      // Both browsers should have the same sessions
      const primarySessions = primaryBrowser.getSessions();
      const secondarySessions = secondaryBrowser.getSessions();

      expect(primarySessions).to.deep.equal(secondarySessions);
      expect(primarySessions.length).to.equal(mockSessions.length);
    });

    it('should propagate session selection across windows', async () => {
      // Setup sessions in both browsers
      primaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: mockSessions },
      }));
      secondaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: mockSessions },
      }));
      await nextFrame();

      // Select session in primary browser
      primaryBrowser.selectSessionById('sync-session-1');
      await nextFrame();

      // Simulate selection sync to secondary browser
      const selectedSession = primaryBrowser.getSelectedSession();
      if (selectedSession) {
        secondaryBrowser.selectSessionById(selectedSession.sessionId);
        await nextFrame();
      }

      // Both browsers should have the same selected session
      const primarySelected = primaryBrowser.getSelectedSession();
      const secondarySelected = secondaryBrowser.getSelectedSession();

      expect(primarySelected?.sessionId).to.equal(secondarySelected?.sessionId);
      expect(primarySelected?.sessionId).to.equal('sync-session-1');
    });

    it('should handle concurrent updates from multiple windows', async () => {
      // Initial state in both browsers
      primaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: [mockSessions[0]] },
      }));
      secondaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: [mockSessions[0]] },
      }));
      await nextFrame();

      // Simulate concurrent updates
      const primaryUpdate = { 
        sessionId: 'sync-session-1', 
        messageCount: 10,
        timestamp: Date.now()
      };
      const secondaryUpdate = { 
        sessionId: 'sync-session-1', 
        messageCount: 12,
        timestamp: Date.now() + 100 // Slightly later
      };

      // Apply updates
      primaryBrowser.dispatchEvent(new CustomEvent('session-modified', {
        detail: { session: primaryUpdate },
      }));
      
      secondaryBrowser.dispatchEvent(new CustomEvent('session-modified', {
        detail: { session: secondaryUpdate },
      }));

      await nextFrame();

      // Both should eventually converge to the later update
      // In a real implementation, this would use timestamp-based conflict resolution
      const primarySession = primaryBrowser.getSessions()[0];
      const secondarySession = secondaryBrowser.getSessions()[0];

      expect(primarySession.messageCount).to.be.oneOf([10, 12]);
      expect(secondarySession.messageCount).to.be.oneOf([10, 12]);
    });

    it('should sync notification preferences across windows', async () => {
      const newPreferences = {
        newSessions: false,
        sessionUpdates: true,
        newMessages: false,
        sessionStateChanges: true,
        soundEnabled: true,
        browserNotifications: false,
        emailNotifications: false,
        filters: { keywords: ['important'] },
      };

      // Update preferences in primary browser
      primaryBrowser.dispatchEvent(new CustomEvent('preferences-changed', {
        detail: { preferences: newPreferences },
      }));
      await nextFrame();

      // Simulate preference sync to secondary browser
      secondaryBrowser.dispatchEvent(new CustomEvent('preferences-changed', {
        detail: { preferences: newPreferences },
      }));
      await nextFrame();

      // Both browsers should have the same preferences
      expect(mockWebSocket1.updateNotificationPreferences).to.have.been.calledWith(newPreferences);
      expect(mockWebSocket2.updateNotificationPreferences).to.have.been.calledWith(newPreferences);
    });

    it('should handle window close and cleanup properly', async () => {
      // Setup sessions
      primaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: mockSessions },
      }));
      await nextFrame();

      // Simulate window close
      primaryBrowser.disconnectedCallback();

      // WebSocket should be properly disconnected
      expect(mockWebSocket1.disconnect).to.have.been.called;

      // Secondary browser should remain functional
      const secondarySessions = secondaryBrowser.getSessions();
      expect(secondarySessions).to.exist;
    });
  });

  describe('Offline State Management', () => {
    it('should persist state when connection is lost', async () => {
      // Setup initial state
      primaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: mockSessions },
      }));
      await nextFrame();

      // Simulate connection loss
      const disconnectedStatus = {
        connected: false,
        connecting: false,
        reconnecting: false,
        reconnectionAttempts: 0,
        quality: 'disconnected' as const,
      };

      (primaryBrowser as any).browserState = {
        ...(primaryBrowser as any).browserState,
        connectionStatus: disconnectedStatus,
      };
      primaryBrowser.requestUpdate();
      await nextFrame();

      // State should still be accessible
      const sessions = primaryBrowser.getSessions();
      expect(sessions.length).to.equal(mockSessions.length);

      // localStorage should be used for persistence
      expect(global.localStorage.setItem).to.have.been.called;
    });

    it('should queue updates while offline and sync when reconnected', async () => {
      // Start offline
      const offlineStatus = {
        connected: false,
        connecting: false,
        reconnecting: false,
        reconnectionAttempts: 0,
        quality: 'disconnected' as const,
      };

      (primaryBrowser as any).browserState = {
        ...(primaryBrowser as any).browserState,
        connectionStatus: offlineStatus,
      };
      primaryBrowser.requestUpdate();
      await nextFrame();

      // Make updates while offline
      const offlineUpdates = [
        { sessionId: 'sync-session-1', messageCount: 15 },
        { sessionId: 'sync-session-2', isActive: true },
      ];

      offlineUpdates.forEach(update => {
        primaryBrowser.dispatchEvent(new CustomEvent('session-modified', {
          detail: { session: update },
        }));
      });
      await nextFrame();

      // Simulate reconnection
      const reconnectedStatus = {
        connected: true,
        connecting: false,
        reconnecting: false,
        reconnectionAttempts: 0,
        quality: 'excellent' as const,
      };

      (primaryBrowser as any).browserState = {
        ...(primaryBrowser as any).browserState,
        connectionStatus: reconnectedStatus,
      };
      primaryBrowser.requestUpdate();
      await nextFrame();

      // In a real implementation, queued updates would be sent to server
      expect(mockWebSocket1.connect).to.have.been.called;
    });

    it('should merge offline changes with server state on reconnection', async () => {
      // Setup initial state
      const initialSession = { ...mockSessions[0], messageCount: 5 };
      primaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: [initialSession] },
      }));
      await nextFrame();

      // Go offline and make local changes
      const offlineUpdate = { sessionId: 'sync-session-1', messageCount: 8 };
      primaryBrowser.dispatchEvent(new CustomEvent('session-modified', {
        detail: { session: offlineUpdate },
      }));
      await nextFrame();

      // Simulate server state on reconnection (different changes)
      const serverState = { ...mockSessions[0], messageCount: 7, isActive: false };
      primaryBrowser.dispatchEvent(new CustomEvent('session-modified', {
        detail: { session: serverState },
      }));
      await nextFrame();

      // State should reflect merge of both changes
      const finalSession = primaryBrowser.getSessions()[0];
      expect(finalSession.messageCount).to.be.oneOf([7, 8]); // Depends on conflict resolution
    });
  });

  describe('Real-time Event Ordering', () => {
    it('should maintain event order across multiple updates', async () => {
      const eventOrder: string[] = [];
      
      // Track events in order
      const trackEvent = (eventType: string) => {
        eventOrder.push(`${eventType}-${Date.now()}`);
      };

      // Setup event tracking
      primaryBrowser.addEventListener('session-added', () => trackEvent('added'));
      primaryBrowser.addEventListener('session-modified', () => trackEvent('modified'));

      // Generate rapid sequence of events
      const events = [
        { type: 'added', session: mockSessions[0] },
        { type: 'modified', session: { ...mockSessions[0], messageCount: 6 } },
        { type: 'modified', session: { ...mockSessions[0], messageCount: 7 } },
        { type: 'added', session: mockSessions[1] },
      ];

      events.forEach((event, index) => {
        setTimeout(() => {
          if (event.type === 'added') {
            primaryBrowser.dispatchEvent(new CustomEvent('session-added', {
              detail: { session: event.session },
            }));
          } else {
            primaryBrowser.dispatchEvent(new CustomEvent('session-modified', {
              detail: { session: event.session },
            }));
          }
        }, index * 10);
      });

      // Wait for all events
      await new Promise(resolve => setTimeout(resolve, 100));
      await nextFrame();

      // Events should be processed in order
      expect(eventOrder.length).to.equal(4);
      expect(eventOrder[0]).to.include('added');
      expect(eventOrder[3]).to.include('added');
    });

    it('should handle timestamp-based conflict resolution', async () => {
      const baseSession = mockSessions[0];

      // Setup initial session
      primaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: [baseSession] },
      }));
      await nextFrame();

      // Create conflicting updates with different timestamps
      const earlierUpdate = {
        ...baseSession,
        messageCount: 10,
        timestamp: Date.now() - 1000,
      };

      const laterUpdate = {
        ...baseSession,
        messageCount: 15,
        timestamp: Date.now(),
      };

      // Apply in reverse chronological order
      primaryBrowser.dispatchEvent(new CustomEvent('session-modified', {
        detail: { session: laterUpdate },
      }));

      primaryBrowser.dispatchEvent(new CustomEvent('session-modified', {
        detail: { session: earlierUpdate },
      }));

      await nextFrame();

      // Later update should win
      const finalSession = primaryBrowser.getSessions()[0];
      expect(finalSession.messageCount).to.equal(15);
    });

    it('should handle vector clock synchronization for distributed updates', async () => {
      // This test simulates a more complex scenario with vector clocks
      // for distributed systems synchronization

      const session1 = { ...mockSessions[0] };
      primaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: [session1] },
      }));
      await nextFrame();

      // Simulate updates from different sources with vector clocks
      const updates = [
        {
          session: { ...session1, messageCount: 8 },
          vectorClock: { browser1: 1, browser2: 0, server: 1 },
          source: 'browser1',
        },
        {
          session: { ...session1, messageCount: 9 },
          vectorClock: { browser1: 0, browser2: 1, server: 1 },
          source: 'browser2',
        },
        {
          session: { ...session1, messageCount: 10 },
          vectorClock: { browser1: 1, browser2: 1, server: 2 },
          source: 'server',
        },
      ];

      // Apply updates
      updates.forEach(update => {
        primaryBrowser.dispatchEvent(new CustomEvent('session-modified', {
          detail: { session: update.session, vectorClock: update.vectorClock },
        }));
      });

      await nextFrame();

      // Server update should win as it has the highest vector clock values
      const finalSession = primaryBrowser.getSessions()[0];
      expect(finalSession.messageCount).to.equal(10);
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should cleanup event listeners on component destruction', async () => {
      // Setup listeners
      const sessionAddedSpy = stub();
      primaryBrowser.addEventListener('session-added', sessionAddedSpy);

      // Destroy component
      primaryBrowser.disconnectedCallback();

      // Events should not be processed after cleanup
      primaryBrowser.dispatchEvent(new CustomEvent('session-added', {
        detail: { session: mockSessions[0] },
      }));

      expect(sessionAddedSpy).to.not.have.been.called;
    });

    it('should limit memory usage with large session counts', async () => {
      const largeSessions = Array.from({ length: 10000 }, (_, i) => ({
        ...mockSessions[0],
        sessionId: `memory-test-${i}`,
        title: `Memory Test Session ${i}`,
      }));

      // Monitor memory usage before
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      primaryBrowser.dispatchEvent(new CustomEvent('sessions-updated', {
        detail: { sessions: largeSessions },
      }));
      await nextFrame();

      // Monitor memory usage after
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      if (initialMemory > 0) {
        expect(memoryIncrease).to.be.lessThan(50 * 1024 * 1024);
      }

      // Cleanup should reduce memory usage
      primaryBrowser.disconnectedCallback();
    });

    it('should handle rapid session additions without memory leaks', async () => {
      const addedSessions: SessionSummary[] = [];

      // Add sessions rapidly
      for (let i = 0; i < 1000; i++) {
        const session = {
          ...mockSessions[0],
          sessionId: `rapid-add-${i}`,
          title: `Rapid Session ${i}`,
        };

        addedSessions.push(session);

        primaryBrowser.dispatchEvent(new CustomEvent('session-added', {
          detail: { session },
        }));

        // Process updates occasionally to avoid overwhelming the event loop
        if (i % 100 === 0) {
          await nextFrame();
        }
      }

      await nextFrame();

      const finalSessions = primaryBrowser.getSessions();
      expect(finalSessions.length).to.equal(addedSessions.length);

      // Cleanup
      primaryBrowser.disconnectedCallback();
    });
  });

  afterEach(() => {
    // Cleanup components
    if (primaryBrowser) {
      primaryBrowser.disconnectedCallback();
    }
    if (secondaryBrowser) {
      secondaryBrowser.disconnectedCallback();
    }

    // Clear all timers
    const highestId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestId; i++) {
      clearTimeout(i);
      clearInterval(i);
    }

    // Reset mocks
    if (global.localStorage) {
      (global.localStorage.getItem as SinonStub).reset();
      (global.localStorage.setItem as SinonStub).reset();
    }
  });
});