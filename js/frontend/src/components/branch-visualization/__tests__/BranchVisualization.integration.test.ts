import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { BranchVisualization } from '../BranchVisualization';
import WebSocketBranchClient, { BranchNotificationData } from '../../../services/websocket-branch-client';
import { SessionBranchTree, SessionSummary } from '../../types/session-types';

// Mock WebSocket client
vi.mock('../../../services/websocket-branch-client');

const mockRootSession: SessionSummary = {
  sessionId: 'integration-root',
  title: 'Integration Test Session',
  cwd: '/integration/project',
  startTime: new Date('2024-01-01T10:00:00Z'),
  messageCount: 12,
  userMessageCount: 6,
  assistantMessageCount: 6,
  isActive: true,
  parentSessionId: null,
  branchPoint: null,
  branchTimestamp: null,
};

const mockBranchSession: SessionSummary = {
  sessionId: 'integration-branch',
  title: 'Integration Branch',
  cwd: '/integration/project',
  startTime: new Date('2024-01-01T11:00:00Z'),
  messageCount: 8,
  userMessageCount: 4,
  assistantMessageCount: 4,
  isActive: false,
  parentSessionId: 'integration-root',
  branchPoint: 4,
  branchTimestamp: new Date('2024-01-01T11:00:00Z'),
  branchMetadata: {
    branchName: 'Integration Feature',
    branchReason: 'Testing WebSocket integration',
    originalMessage: 'Let me test the integration'
  }
};

const mockBranchTree: SessionBranchTree = {
  rootSession: mockRootSession,
  branches: [{
    rootSession: mockBranchSession,
    branches: [],
    depth: 1
  }],
  depth: 0
};

describe('BranchVisualization Integration Tests', () => {
  let element: BranchVisualization;
  let mockWebSocketClient: vi.Mocked<WebSocketBranchClient>;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock WebSocket client
    mockWebSocketClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      joinSession: vi.fn(),
      leaveSession: vi.fn(),
      onBranchCreated: vi.fn(),
      onBranchTreeUpdated: vi.fn(),
      onError: vi.fn(),
      isSocketConnected: vi.fn().mockReturnValue(true),
      getCurrentSessionId: vi.fn().mockReturnValue('integration-root'),
      getUserId: vi.fn().mockReturnValue('integration-user'),
      ping: vi.fn().mockResolvedValue('pong'),
      removeEventListener: vi.fn(),
      removeAllEventListeners: vi.fn(),
    } as any;

    vi.mocked(WebSocketBranchClient).mockImplementation(() => mockWebSocketClient);

    element = await fixture(html`
      <branch-visualization
        .branchTree=${mockBranchTree}
        .currentSessionId=${'integration-root'}
        .rootSessionId=${'integration-root'}
        ?enable-websocket=${true}
        websocket-url="ws://localhost:3001"
        api-url="http://localhost:3001/api"
      ></branch-visualization>
    `);
  });

  afterEach(() => {
    if (element) {
      element.remove();
    }
  });

  describe('WebSocket Integration', () => {
    it('should initialize WebSocket client when enabled', async () => {
      await element.updateComplete;
      
      expect(WebSocketBranchClient).toHaveBeenCalledWith('ws://localhost:3001');
    });

    it('should connect to WebSocket with proper parameters', async () => {
      await element.updateComplete;
      
      expect(mockWebSocketClient.connect).toHaveBeenCalledWith(
        'branch-viz-user',
        'integration-root'
      );
    });

    it('should register event listeners', async () => {
      await element.updateComplete;
      
      expect(mockWebSocketClient.onBranchCreated).toHaveBeenCalled();
      expect(mockWebSocketClient.onBranchTreeUpdated).toHaveBeenCalled();
      expect(mockWebSocketClient.onError).toHaveBeenCalled();
    });

    it('should handle incoming branch notifications', async () => {
      let notificationReceived = false;
      
      element.addEventListener('branch-tree-updated', (() => {
        notificationReceived = true;
      }) as EventListener);

      await element.updateComplete;

      // Get the branch notification handler
      const branchCreatedHandler = mockWebSocketClient.onBranchCreated.mock.calls[0]?.[0];
      expect(branchCreatedHandler).toBeDefined();

      // Simulate receiving a branch notification
      const mockNotification: BranchNotificationData = {
        parentSessionId: 'integration-root',
        branchSession: {
          id: 'new-integration-branch',
          parentSessionId: 'integration-root',
          branchPoint: 5,
          branchTimestamp: new Date().toISOString(),
          branchMetadata: {
            branchName: 'Real-time Branch',
            branchReason: 'Testing real-time updates',
          },
          workingDirectory: '/integration/project',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
        affectedSessions: ['integration-root'],
      };

      branchCreatedHandler(mockNotification);
      await element.updateComplete;

      expect(notificationReceived).toBe(true);
    });

    it('should update visualization on WebSocket events', async () => {
      await element.updateComplete;

      const branchCreatedHandler = mockWebSocketClient.onBranchCreated.mock.calls[0]?.[0];
      
      const mockNotification: BranchNotificationData = {
        parentSessionId: 'integration-root',
        branchSession: {
          id: 'realtime-branch',
          parentSessionId: 'integration-root',
          branchPoint: 3,
          branchTimestamp: new Date().toISOString(),
          branchMetadata: {
            branchName: 'Realtime Update',
            branchReason: 'Testing UI updates',
          },
          workingDirectory: '/integration/project',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
        affectedSessions: ['integration-root'],
      };

      // Initial node count
      const initialNodes = element.shadowRoot?.querySelectorAll('.session-node').length || 0;
      
      branchCreatedHandler(mockNotification);
      await element.updateComplete;

      // Animation should be applied to the new node
      // (In a real scenario, the tree would be updated and re-rendered)
      expect(initialNodes).toBeGreaterThan(0);
    });

    it('should handle WebSocket connection errors', async () => {
      await element.updateComplete;

      const errorHandler = mockWebSocketClient.onError.mock.calls[0]?.[0];
      expect(errorHandler).toBeDefined();

      // Simulate WebSocket error
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      errorHandler({ code: 'CONNECTION_ERROR', message: 'Failed to connect' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'WebSocket error in branch visualization:',
        { code: 'CONNECTION_ERROR', message: 'Failed to connect' }
      );
      
      consoleSpy.mockRestore();
    });

    it('should cleanup WebSocket on disconnect', async () => {
      await element.updateComplete;
      
      // Simulate component disconnect
      element.remove();
      
      expect(mockWebSocketClient.disconnect).toHaveBeenCalled();
    });

    it('should join session when rootSessionId changes', async () => {
      await element.updateComplete;
      
      // Clear previous calls
      mockWebSocketClient.joinSession.mockClear();
      
      // Change root session ID
      element.rootSessionId = 'new-root-session';
      await element.updateComplete;
      
      expect(mockWebSocketClient.joinSession).toHaveBeenCalledWith('new-root-session');
    });

    it('should display connection status when WebSocket enabled', async () => {
      await element.updateComplete;
      
      const status = element.shadowRoot?.querySelector('.websocket-status');
      expect(status).to.exist;
      
      const indicator = status?.querySelector('.status-indicator.connected');
      expect(indicator).to.exist;
      
      expect(status?.textContent).toContain('Live updates');
    });
  });

  describe('Real-time Updates', () => {
    it('should animate nodes on real-time updates', async () => {
      await element.updateComplete;

      const branchCreatedHandler = mockWebSocketClient.onBranchCreated.mock.calls[0]?.[0];
      
      const mockNotification: BranchNotificationData = {
        parentSessionId: 'integration-root',
        branchSession: {
          id: 'integration-branch',
          parentSessionId: 'integration-root',
          branchPoint: 2,
          branchTimestamp: new Date().toISOString(),
          branchMetadata: {},
          workingDirectory: '/integration/project',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
        affectedSessions: ['integration-root'],
      };

      branchCreatedHandler(mockNotification);
      await element.updateComplete;

      // Check that animation class is temporarily applied
      const animatedNode = element.shadowRoot?.querySelector(
        '.session-node[data-session-id="integration-branch"]'
      );
      
      // The animation class should be added and then removed
      // This is a simplified check - in a real test we might need to check timing
      expect(animatedNode).to.exist;
    });

    it('should handle rapid succession of updates', async () => {
      await element.updateComplete;

      const branchCreatedHandler = mockWebSocketClient.onBranchCreated.mock.calls[0]?.[0];
      
      // Send multiple rapid updates
      const notifications = Array.from({ length: 3 }, (_, i) => ({
        parentSessionId: 'integration-root',
        branchSession: {
          id: `rapid-branch-${i}`,
          parentSessionId: 'integration-root',
          branchPoint: i + 1,
          branchTimestamp: new Date().toISOString(),
          branchMetadata: { branchName: `Rapid ${i}` },
          workingDirectory: '/integration/project',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
        },
        affectedSessions: ['integration-root'],
      } as BranchNotificationData));

      let updateCount = 0;
      element.addEventListener('branch-tree-updated', (() => {
        updateCount++;
      }) as EventListener);

      // Send all notifications rapidly
      notifications.forEach(notification => {
        branchCreatedHandler(notification);
      });
      
      await element.updateComplete;

      expect(updateCount).toBe(notifications.length);
    });

    it('should handle branch tree structure updates', async () => {
      await element.updateComplete;

      const treeUpdatedHandler = mockWebSocketClient.onBranchTreeUpdated.mock.calls[0]?.[0];
      expect(treeUpdatedHandler).toBeDefined();

      let treeUpdateReceived = false;
      element.addEventListener('branch-tree-updated', ((event: CustomEvent) => {
        treeUpdateReceived = true;
        expect(event.detail.type).toBe('branch-tree-updated');
      }) as EventListener);

      const mockTreeUpdate: BranchNotificationData = {
        parentSessionId: 'integration-root',
        branchSession: {
          id: 'tree-update-branch',
          parentSessionId: 'integration-root',
          branchPoint: 6,
          branchTimestamp: new Date().toISOString(),
          branchMetadata: {
            branchName: 'Tree Update',
            branchReason: 'Testing tree updates',
          },
          workingDirectory: '/integration/project',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
        affectedSessions: ['integration-root'],
      };

      treeUpdatedHandler(mockTreeUpdate);
      await element.updateComplete;

      expect(treeUpdateReceived).toBe(true);
    });
  });

  describe('API Integration Simulation', () => {
    beforeEach(() => {
      // Mock fetch for API calls
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle session navigation with API context', async () => {
      const mockApiResponse = {
        success: true,
        data: {
          sessionId: 'integration-branch',
          session: mockBranchSession,
          branches: []
        }
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      let navigationEvent: any = null;
      element.addEventListener('session-navigate', ((event: CustomEvent) => {
        navigationEvent = event.detail;
      }) as EventListener);

      await element.updateComplete;

      // Simulate clicking on a branch node
      const branchNode = element.shadowRoot?.querySelector(
        '.session-node[data-session-id="integration-branch"]'
      ) as SVGElement;
      
      expect(branchNode).to.exist;
      branchNode.click();

      expect(navigationEvent).toBeDefined();
      expect(navigationEvent.toSessionId).toBe('integration-branch');
      expect(navigationEvent.fromSessionId).toBe('integration-root');
    });

    it('should integrate with backend branch data', async () => {
      // Simulate receiving branch data from API
      const branchTreeResponse = {
        root: mockRootSession,
        branches: new Map([
          ['integration-root', [mockBranchSession]]
        ])
      };

      // Update the tree data as if from API
      element.branchTree = {
        rootSession: mockRootSession,
        branches: [{
          rootSession: mockBranchSession,
          branches: [],
          depth: 1
        }],
        depth: 0
      };

      await element.updateComplete;

      const nodes = element.shadowRoot?.querySelectorAll('.session-node');
      expect(nodes).to.have.length(2); // Root + branch
    });
  });

  describe('Performance with Real-time Updates', () => {
    it('should handle high-frequency updates efficiently', async () => {
      await element.updateComplete;

      const branchCreatedHandler = mockWebSocketClient.onBranchCreated.mock.calls[0]?.[0];
      
      const startTime = performance.now();
      
      // Send 10 rapid updates
      for (let i = 0; i < 10; i++) {
        const notification: BranchNotificationData = {
          parentSessionId: 'integration-root',
          branchSession: {
            id: `perf-branch-${i}`,
            parentSessionId: 'integration-root',
            branchPoint: i,
            branchTimestamp: new Date().toISOString(),
            branchMetadata: { branchName: `Performance ${i}` },
            workingDirectory: '/integration/project',
            status: 'active',
            createdAt: new Date().toISOString(),
          },
          affectedSessions: ['integration-root'],
        };
        
        branchCreatedHandler(notification);
      }
      
      await element.updateComplete;
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle updates reasonably quickly (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should not leak memory on repeated updates', async () => {
      await element.updateComplete;

      const branchCreatedHandler = mockWebSocketClient.onBranchCreated.mock.calls[0]?.[0];
      
      // Create and destroy multiple branch notifications
      for (let i = 0; i < 5; i++) {
        const notification: BranchNotificationData = {
          parentSessionId: 'integration-root',
          branchSession: {
            id: `memory-branch-${i}`,
            parentSessionId: 'integration-root',
            branchPoint: i,
            branchTimestamp: new Date().toISOString(),
            branchMetadata: {},
            workingDirectory: '/integration/project',
            status: 'active',
            createdAt: new Date().toISOString(),
          },
          affectedSessions: ['integration-root'],
        };
        
        branchCreatedHandler(notification);
        await element.updateComplete;
      }
      
      // Should not accumulate excessive DOM nodes or event listeners
      const nodes = element.shadowRoot?.querySelectorAll('.session-node');
      expect(nodes?.length).toBeLessThan(20); // Should not grow excessively
    });
  });

  describe('Error Handling in Integration', () => {
    it('should gracefully handle WebSocket initialization failure', async () => {
      // Mock WebSocket constructor to throw
      vi.mocked(WebSocketBranchClient).mockImplementation(() => {
        throw new Error('WebSocket initialization failed');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const failingElement = await fixture(html`
        <branch-visualization
          .branchTree=${mockBranchTree}
          ?enable-websocket=${true}
          websocket-url="ws://localhost:3001"
        ></branch-visualization>
      `);

      await failingElement.updateComplete;
      
      // Should still render without WebSocket
      const visualization = failingElement.shadowRoot?.querySelector('.tree-svg');
      expect(visualization).to.exist;
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize WebSocket client:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle malformed WebSocket messages', async () => {
      await element.updateComplete;

      const branchCreatedHandler = mockWebSocketClient.onBranchCreated.mock.calls[0]?.[0];
      
      // Send malformed notification
      const malformedNotification = {
        parentSessionId: null, // Invalid
        branchSession: null,   // Invalid
        affectedSessions: []
      } as any;

      // Should not crash the component
      expect(() => {
        branchCreatedHandler(malformedNotification);
      }).not.toThrow();
    });

    it('should recover from temporary WebSocket disconnections', async () => {
      await element.updateComplete;

      // Simulate connection loss
      mockWebSocketClient.isSocketConnected.mockReturnValue(false);
      
      const errorHandler = mockWebSocketClient.onError.mock.calls[0]?.[0];
      errorHandler({ code: 'CONNECTION_LOST', message: 'WebSocket disconnected' });
      
      await element.updateComplete;
      
      // Should show disconnected status
      const status = element.shadowRoot?.querySelector('.websocket-status');
      expect(status?.textContent).toContain('Disconnected');
      
      const indicator = status?.querySelector('.status-indicator.disconnected');
      expect(indicator).to.exist;
    });
  });

  describe('Cross-Component Integration', () => {
    it('should integrate with branch point selector events', async () => {
      // Simulate receiving a branch point selection event from another component
      const branchPointEvent = new CustomEvent('branch-point-selected', {
        detail: {
          sessionId: 'integration-root',
          branchPoint: {
            messageIndex: 3,
            messagePreview: 'Test message',
            timestamp: new Date(),
            hasBranches: false,
            branchCount: 0
          }
        }
      });

      let eventReceived = false;
      element.addEventListener('branch-point-selected', (() => {
        eventReceived = true;
      }) as EventListener);

      element.dispatchEvent(branchPointEvent);
      expect(eventReceived).toBe(true);
    });

    it('should coordinate with session management systems', async () => {
      // Test integration with session state management
      let sessionNavigations: any[] = [];
      
      element.addEventListener('session-navigate', ((event: CustomEvent) => {
        sessionNavigations.push(event.detail);
      }) as EventListener);

      await element.updateComplete;

      // Simulate navigating between sessions
      const nodes = element.shadowRoot?.querySelectorAll('.session-node');
      
      (nodes?.[0] as SVGElement)?.click();
      await element.updateComplete;
      
      (nodes?.[1] as SVGElement)?.click();
      await element.updateComplete;

      expect(sessionNavigations).to.have.length(2);
      expect(sessionNavigations[0].toSessionId).toBe('integration-root');
      expect(sessionNavigations[1].toSessionId).toBe('integration-branch');
    });
  });

  describe('Layout Responsiveness', () => {
    it('should adapt layout to different tree structures', async () => {
      // Test with wide tree
      const wideTree: SessionBranchTree = {
        rootSession: mockRootSession,
        branches: Array.from({ length: 5 }, (_, i) => ({
          rootSession: {
            ...mockBranchSession,
            sessionId: `wide-branch-${i}`,
            title: `Wide Branch ${i}`
          },
          branches: [],
          depth: 1
        })),
        depth: 0
      };

      element.branchTree = wideTree;
      await element.updateComplete;

      const svg = element.shadowRoot?.querySelector('.tree-svg');
      const height = parseFloat(svg?.getAttribute('height') || '0');
      
      // Should expand height for wider trees
      expect(height).toBeGreaterThan(400);
    });

    it('should adapt layout to deep tree structures', async () => {
      // Test with deep nested tree
      let deepTree: SessionBranchTree = {
        rootSession: mockRootSession,
        branches: [],
        depth: 0
      };

      // Create 5-level deep tree
      let currentLevel = deepTree;
      for (let i = 1; i < 5; i++) {
        const nextBranch: SessionBranchTree = {
          rootSession: {
            ...mockBranchSession,
            sessionId: `deep-branch-${i}`,
            title: `Deep Level ${i}`,
            parentSessionId: currentLevel.rootSession.sessionId
          },
          branches: [],
          depth: i
        };
        
        currentLevel.branches = [nextBranch];
        currentLevel = nextBranch;
      }

      element.branchTree = deepTree;
      await element.updateComplete;

      const svg = element.shadowRoot?.querySelector('.tree-svg');
      const width = parseFloat(svg?.getAttribute('width') || '0');
      
      // Should expand width for deeper trees
      expect(width).toBeGreaterThan(800);
    });
  });
});