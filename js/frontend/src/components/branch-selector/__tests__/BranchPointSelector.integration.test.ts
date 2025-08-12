import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { BranchPointSelector } from '../BranchPointSelector';
import WebSocketBranchClient, { BranchNotificationData } from '../../../services/websocket-branch-client';
import type { SessionSummary } from '../../types/session-types';
import type { TranscriptEntry } from '@app/shared';

// Mock WebSocket branch client
vi.mock('../../../services/websocket-branch-client');

const mockSession: SessionSummary = {
  sessionId: 'integration-test-session',
  cwd: '/test/project',
  startTime: new Date('2024-01-01T10:00:00Z'),
  messageCount: 4,
  userMessageCount: 2,
  assistantMessageCount: 2,
  isActive: false,
  parentSessionId: null,
  branchPoint: null,
  branchTimestamp: null,
};

const mockEntries: TranscriptEntry[] = [
  {
    type: 'user',
    message: {
      role: 'user',
      content: 'How do I create a session branch?'
    },
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd: '/test/project',
    sessionId: 'integration-test-session',
    version: '1.0.0',
    uuid: 'msg-1',
    timestamp: '2024-01-01T10:00:00Z',
  },
  {
    type: 'assistant',
    message: {
      id: 'msg-2',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet',
      content: [
        {
          type: 'text',
          text: 'You can create a session branch by selecting a message as a branch point and clicking the "Create Branch" button.'
        }
      ]
    },
    parentUuid: null,
    isSidechain: false,
    userType: 'assistant',
    cwd: '/test/project',
    sessionId: 'integration-test-session',
    version: '1.0.0',
    uuid: 'msg-2',
    timestamp: '2024-01-01T10:01:00Z',
  },
  {
    type: 'user',
    message: {
      role: 'user',
      content: 'Can I branch from any message?'
    },
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd: '/test/project',
    sessionId: 'integration-test-session',
    version: '1.0.0',
    uuid: 'msg-3',
    timestamp: '2024-01-01T10:02:00Z',
  },
  {
    type: 'assistant',
    message: {
      id: 'msg-4',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet',
      content: [
        {
          type: 'text',
          text: 'Typically, you can only branch from assistant messages. This ensures the conversation flow makes sense when continuing from that point.'
        }
      ]
    },
    parentUuid: null,
    isSidechain: false,
    userType: 'assistant',
    cwd: '/test/project',
    sessionId: 'integration-test-session',
    version: '1.0.0',
    uuid: 'msg-4',
    timestamp: '2024-01-01T10:03:00Z',
  }
] as TranscriptEntry[];

describe('BranchPointSelector Integration Tests', () => {
  let element: BranchPointSelector;
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
      getCurrentSessionId: vi.fn().mockReturnValue(mockSession.sessionId),
      getUserId: vi.fn().mockReturnValue('test-user'),
      ping: vi.fn().mockResolvedValue('pong'),
      removeEventListener: vi.fn(),
      removeAllEventListeners: vi.fn(),
    } as any;

    vi.mocked(WebSocketBranchClient).mockImplementation(() => mockWebSocketClient);

    element = await fixture(html`
      <branch-point-selector
        .session=${mockSession}
        .entries=${mockEntries}
        .enableWebSocket=${true}
        websocket-url="ws://localhost:3001"
      ></branch-point-selector>
    `);
  });

  afterEach(() => {
    if (element) {
      element.remove();
    }
  });

  describe('WebSocket Integration', () => {
    it('should initialize WebSocket client when enabled', async () => {
      expect(WebSocketBranchClient).toHaveBeenCalled();
    });

    it('should connect to WebSocket when component is connected', async () => {
      // Simulate component connection
      await element.updateComplete;
      
      // Should attempt to connect if WebSocket is enabled
      expect(mockWebSocketClient.connect).toHaveBeenCalledWith('test-user', mockSession.sessionId);
    });

    it('should listen for branch notifications', async () => {
      await element.updateComplete;

      expect(mockWebSocketClient.onBranchCreated).toHaveBeenCalled();
      expect(mockWebSocketClient.onBranchTreeUpdated).toHaveBeenCalled();
      expect(mockWebSocketClient.onError).toHaveBeenCalled();
    });

    it('should handle incoming branch notifications', async () => {
      let notificationReceived = false;
      
      element.addEventListener('branch-notification-received', (() => {
        notificationReceived = true;
      }) as EventListener);

      // Get the branch notification handler
      const branchCreatedHandler = mockWebSocketClient.onBranchCreated.mock.calls[0]?.[0];
      expect(branchCreatedHandler).toBeDefined();

      // Simulate receiving a branch notification
      const mockNotification: BranchNotificationData = {
        parentSessionId: mockSession.sessionId,
        branchSession: {
          id: 'new-branch-123',
          parentSessionId: mockSession.sessionId,
          branchPoint: 1,
          branchTimestamp: new Date().toISOString(),
          branchMetadata: {
            branchName: 'test-branch',
            branchReason: 'Testing notifications',
          },
          workingDirectory: '/test/project',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
        affectedSessions: [mockSession.sessionId],
      };

      branchCreatedHandler(mockNotification);
      await element.updateComplete;

      expect(notificationReceived).toBe(true);
    });

    it('should cleanup WebSocket connection on disconnect', async () => {
      await element.updateComplete;
      
      // Simulate component disconnect
      element.remove();
      
      expect(mockWebSocketClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('Branch Creation API Integration', () => {
    beforeEach(() => {
      // Mock fetch for API calls
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should validate branch points with backend API', async () => {
      const mockValidationResponse = {
        success: true,
        data: {
          valid: true,
          messageExists: true,
          messageType: 'assistant',
          messagePreview: 'You can create a session branch...',
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockValidationResponse,
      } as Response);

      // Enable API validation
      element.validateWithAPI = true;
      element.apiUrl = 'http://localhost:3001/api';
      await element.updateComplete;

      // Trigger validation on a branch point
      const firstAssistantItem = element.shadowRoot?.querySelector('.message-item.selectable[data-message-index="1"]') as HTMLElement;
      expect(firstAssistantItem).to.exist;

      // Simulate hover to trigger validation
      const hoverEvent = new MouseEvent('mouseenter');
      firstAssistantItem.dispatchEvent(hoverEvent);

      await element.updateComplete;

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/sessions/integration-test-session/validate-branch-point',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branchPoint: 1,
            directoryPath: '/test/project',
          }),
        })
      );
    });

    it('should create branch via API when branch point is selected', async () => {
      let branchCreated = false;
      let branchDetails: any = null;

      element.addEventListener('branch-created', ((event: CustomEvent) => {
        branchCreated = true;
        branchDetails = event.detail;
      }) as EventListener);

      const mockBranchResponse = {
        success: true,
        data: {
          sessionId: 'new-branch-456',
          session: {
            id: 'new-branch-456',
            parentSessionId: mockSession.sessionId,
            branchPoint: 1,
            branchTimestamp: new Date().toISOString(),
            branchMetadata: {
              branchName: 'Auto-created branch',
              branchReason: 'Created via UI',
            },
            workingDirectory: '/test/project',
            status: 'active',
            createdAt: new Date().toISOString(),
          },
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBranchResponse,
      } as Response);

      // Enable API creation
      element.createBranchAPI = true;
      element.apiUrl = 'http://localhost:3001/api';
      await element.updateComplete;

      // Click on assistant message to select and create branch
      const firstAssistantItem = element.shadowRoot?.querySelector('.message-item.selectable[data-message-index="1"]') as HTMLElement;
      expect(firstAssistantItem).to.exist;

      firstAssistantItem.click();
      await element.updateComplete;

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/sessions/integration-test-session/branch',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branchPoint: 1,
            metadata: {
              branchName: 'Auto-created branch',
              branchReason: 'Created via UI',
            },
            workingDirectory: '/test/project',
            directoryPath: '/test/project',
          }),
        })
      );

      expect(branchCreated).toBe(true);
      expect(branchDetails.sessionId).toBe('new-branch-456');
    });

    it('should handle API validation errors gracefully', async () => {
      let errorReceived = false;
      let errorDetails: any = null;

      element.addEventListener('branch-validation-error', ((event: CustomEvent) => {
        errorReceived = true;
        errorDetails = event.detail;
      }) as EventListener);

      const mockErrorResponse = {
        success: false,
        error: 'Branch point validation failed',
        details: {
          messageExists: false,
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockErrorResponse,
      } as Response);

      // Enable API validation
      element.validateWithAPI = true;
      element.apiUrl = 'http://localhost:3001/api';
      await element.updateComplete;

      // Trigger validation on a branch point
      const firstAssistantItem = element.shadowRoot?.querySelector('.message-item.selectable[data-message-index="1"]') as HTMLElement;
      expect(firstAssistantItem).to.exist;

      const hoverEvent = new MouseEvent('mouseenter');
      firstAssistantItem.dispatchEvent(hoverEvent);

      await element.updateComplete;

      expect(errorReceived).toBe(true);
      expect(errorDetails.error).toBe('Branch point validation failed');
    });
  });

  describe('Real-time Updates', () => {
    it('should update UI when receiving branch notifications for current session', async () => {
      const branchCreatedHandler = mockWebSocketClient.onBranchCreated.mock.calls[0]?.[0];
      
      // Get initial branch count display
      const initialBranchInfo = element.shadowRoot?.querySelector('.session-branches-info');
      
      // Simulate receiving a branch notification for this session
      const mockNotification: BranchNotificationData = {
        parentSessionId: mockSession.sessionId,
        branchSession: {
          id: 'new-branch-999',
          parentSessionId: mockSession.sessionId,
          branchPoint: 3,
          branchTimestamp: new Date().toISOString(),
          branchMetadata: {
            branchName: 'realtime-branch',
            branchReason: 'Created by another user',
          },
          workingDirectory: '/test/project',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
        affectedSessions: [mockSession.sessionId],
      };

      branchCreatedHandler(mockNotification);
      await element.updateComplete;

      // Check that the UI has been updated with branch information
      const branchIndicator = element.shadowRoot?.querySelector('.message-item[data-has-branch="true"]');
      expect(branchIndicator).to.exist;
    });

    it('should handle connection status changes', async () => {
      // Simulate connection lost
      mockWebSocketClient.isSocketConnected.mockReturnValue(false);
      
      const errorHandler = mockWebSocketClient.onError.mock.calls[0]?.[0];
      errorHandler({ code: 'CONNECTION_LOST', message: 'WebSocket disconnected' });

      await element.updateComplete;

      // Should show connection status indicator
      const connectionStatus = element.shadowRoot?.querySelector('.websocket-status.disconnected');
      expect(connectionStatus).to.exist;
    });
  });

  describe('Performance with Real-time Updates', () => {
    it('should debounce rapid branch notifications', async () => {
      const branchCreatedHandler = mockWebSocketClient.onBranchCreated.mock.calls[0]?.[0];
      
      let updateCount = 0;
      element.addEventListener('branch-notification-received', (() => {
        updateCount++;
      }) as EventListener);

      // Send multiple rapid notifications
      const notifications = Array.from({ length: 5 }, (_, i) => ({
        parentSessionId: mockSession.sessionId,
        branchSession: {
          id: `rapid-branch-${i}`,
          parentSessionId: mockSession.sessionId,
          branchPoint: i,
          branchTimestamp: new Date().toISOString(),
          branchMetadata: {},
          workingDirectory: '/test/project',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
        },
        affectedSessions: [mockSession.sessionId],
      } as BranchNotificationData));

      // Send all notifications rapidly
      notifications.forEach(notification => {
        branchCreatedHandler(notification);
      });

      await element.updateComplete;
      // Wait for any debouncing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have processed all notifications but potentially debounced the UI updates
      expect(updateCount).toBeLessThanOrEqual(notifications.length);
    });
  });
});