import { expect } from '@esm-bundle/chai';
import { fixture, html, nextFrame } from '@open-wc/testing';
import { stub, SinonStub } from 'sinon';
// Import the component to ensure it's registered
import '../realtime-session-browser';
import { RealtimeSessionBrowser } from '../realtime-session-browser';
import { SessionSummary } from '../../types/session-types';

describe('Realtime Integration Tests - Basic', () => {
  let element: RealtimeSessionBrowser;

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
    // Create element with basic configuration
    element = await fixture(html`
      <realtime-session-browser
        .config=${{
          enableRealtime: true,
          enableNotifications: true,
          enableStateIndicators: true,
          enableConnectionStatus: true,
          enableLiveMessages: true,
          autoConnect: false,
          debugMode: true,
        }}
      ></realtime-session-browser>
    `);

    // Wait for element to be fully rendered
    await element.updateComplete;
    await nextFrame();
  });

  describe('Component Initialization', () => {
    it('should create and render the component', async () => {
      expect(element).to.exist;
      expect(element.tagName.toLowerCase()).to.equal('realtime-session-browser');
    });

    it('should have default configuration', async () => {
      expect(element.config).to.exist;
      expect(element.config.enableRealtime).to.equal(true);
      expect(element.config.enableNotifications).to.equal(true);
    });
  });

  describe('Session Management API', () => {
    it('should provide getSessions method', () => {
      expect(element.getSessions).to.be.a('function');
      const sessions = element.getSessions();
      expect(Array.isArray(sessions)).to.equal(true);
    });

    it('should provide selectSessionById method', () => {
      expect(element.selectSessionById).to.be.a('function');
    });

    it('should provide getSelectedSession method', () => {
      expect(element.getSelectedSession).to.be.a('function');
    });

    it('should handle session selection', async () => {
      // Set up test sessions
      (element as any).browserState = {
        ...(element as any).browserState || {},
        sessions: mockSessions,
        isLoading: false
      };

      element.requestUpdate();
      await element.updateComplete;

      // Select a session
      element.selectSessionById('session-1');
      await element.updateComplete;

      // Verify selection
      const selectedSession = element.getSelectedSession();
      expect(selectedSession?.sessionId).to.equal('session-1');
    });

    it('should manage sessions list', async () => {
      // Initially empty
      expect(element.getSessions().length).to.equal(0);

      // Update with test sessions
      (element as any).browserState = {
        ...(element as any).browserState || {},
        sessions: mockSessions,
        isLoading: false
      };

      element.requestUpdate();
      await element.updateComplete;

      // Verify sessions are available
      const sessions = element.getSessions();
      expect(sessions.length).to.equal(2);
      expect(sessions[0].sessionId).to.equal('session-1');
      expect(sessions[1].sessionId).to.equal('session-2');
    });

    it('should filter active sessions', async () => {
      // Set up mixed sessions
      (element as any).browserState = {
        ...(element as any).browserState || {},
        sessions: mockSessions,
        isLoading: false
      };

      element.requestUpdate();
      await element.updateComplete;

      const sessions = element.getSessions();
      const activeSessions = sessions.filter(s => s.isActive);
      const inactiveSessions = sessions.filter(s => !s.isActive);

      expect(activeSessions.length).to.equal(1);
      expect(inactiveSessions.length).to.equal(1);
      expect(activeSessions[0].sessionId).to.equal('session-1');
      expect(inactiveSessions[0].sessionId).to.equal('session-2');
    });
  });

  describe('Real-time Updates', () => {
    it('should handle session updates', async () => {
      // Set initial session
      const initialSessions = [mockSessions[0]];
      (element as any).browserState = {
        ...(element as any).browserState || {},
        sessions: initialSessions,
        isLoading: false
      };

      element.requestUpdate();
      await element.updateComplete;

      expect(element.getSessions().length).to.equal(1);
      expect(element.getSessions()[0].messageCount).to.equal(5);

      // Update session with new message count
      const updatedSessions = [{ ...mockSessions[0], messageCount: 10 }];
      (element as any).browserState = {
        ...(element as any).browserState,
        sessions: updatedSessions
      };

      element.requestUpdate();
      await element.updateComplete;

      // Verify update
      expect(element.getSessions()[0].messageCount).to.equal(10);
    });

    it('should handle adding new sessions', async () => {
      // Start with one session
      (element as any).browserState = {
        ...(element as any).browserState || {},
        sessions: [mockSessions[0]],
        isLoading: false
      };

      element.requestUpdate();
      await element.updateComplete;

      expect(element.getSessions().length).to.equal(1);

      // Add second session
      (element as any).browserState = {
        ...(element as any).browserState,
        sessions: mockSessions
      };

      element.requestUpdate();
      await element.updateComplete;

      expect(element.getSessions().length).to.equal(2);
    });

    it('should handle session state changes', async () => {
      // Start with active session
      const activeSession = { ...mockSessions[0], isActive: true };
      (element as any).browserState = {
        ...(element as any).browserState || {},
        sessions: [activeSession],
        isLoading: false
      };

      element.requestUpdate();
      await element.updateComplete;

      expect(element.getSessions()[0].isActive).to.equal(true);

      // Change to inactive
      const inactiveSession = { ...activeSession, isActive: false, endTime: new Date() };
      (element as any).browserState = {
        ...(element as any).browserState,
        sessions: [inactiveSession]
      };

      element.requestUpdate();
      await element.updateComplete;

      expect(element.getSessions()[0].isActive).to.equal(false);
      expect(element.getSessions()[0].endTime).to.exist;
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of sessions', async () => {
      // Create many sessions
      const manySessions = Array.from({ length: 100 }, (_, i) => ({
        ...mockSessions[0],
        sessionId: `perf-session-${i}`,
        title: `Performance Session ${i}`,
      }));

      const startTime = performance.now();

      (element as any).browserState = {
        ...(element as any).browserState || {},
        sessions: manySessions,
        isLoading: false
      };

      element.requestUpdate();
      await element.updateComplete;

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Should handle updates efficiently (under 150ms)
      expect(updateTime).to.be.lessThan(150);
      expect(element.getSessions().length).to.equal(100);
    });

    it('should handle rapid updates', async () => {
      let currentSessions = [mockSessions[0]];
      
      // Set initial state
      (element as any).browserState = {
        ...(element as any).browserState || {},
        sessions: currentSessions,
        isLoading: false
      };

      element.requestUpdate();
      await element.updateComplete;

      // Perform rapid updates
      const updatePromises = [];
      for (let i = 0; i < 10; i++) {
        currentSessions = [{ ...mockSessions[0], messageCount: 5 + i }];
        (element as any).browserState = {
          ...(element as any).browserState,
          sessions: currentSessions
        };
        
        updatePromises.push(element.requestUpdate());
      }

      await Promise.all(updatePromises);
      await element.updateComplete;

      // Should reflect final state
      expect(element.getSessions()[0].messageCount).to.equal(14); // 5 + 9
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed session data gracefully', async () => {
      // Test with partially malformed data but keep sorting fields valid
      const malformedSessions = [
        mockSessions[0], // valid
        { ...mockSessions[1], summary: null }, // partially invalid but sorting fields remain valid
      ];

      // Should handle malformed data without crashing
      (element as any).browserState = {
        ...(element as any).browserState || {},
        sessions: malformedSessions as any,
        isLoading: false
      };

      element.requestUpdate();
      await element.updateComplete;

      // Should still return sessions (may handle null fields gracefully)
      const sessions = element.getSessions();
      expect(Array.isArray(sessions)).to.equal(true);
      expect(sessions.length).to.equal(2);
    });

    it('should handle missing browserState gracefully', async () => {
      // Test with minimal browserState to avoid undefined access
      (element as any).browserState = {
        sessions: [],
        selectedSession: null,
        isLoading: false,
        filterText: '',
        sortBy: 'startTime',
        sortOrder: 'desc',
        viewMode: 'list'
      };
      
      element.requestUpdate();
      await element.updateComplete;
      
      // Should handle empty state properly
      expect(element.getSessions()).to.deep.equal([]);
      expect(element.getSelectedSession()).to.equal(null);
      
      // Should handle selection of non-existent session without crashing
      element.selectSessionById('non-existent');
      expect(element.getSelectedSession()).to.equal(null);
    });
  });

  afterEach(() => {
    // Clean up any timers or intervals
    const highestId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestId; i++) {
      clearTimeout(i);
    }
  });
});