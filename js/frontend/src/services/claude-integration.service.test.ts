import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { ClaudeIntegrationService, getClaudeIntegrationService } from './claude-integration.service';
import type {
  SessionContinuationRequest,
  SessionContinuationResponse,
  ClaudeProcessStatus,
  ClaudeOutput,
  ContextPreparationRequest,
  ContextPreparationResult
} from '../../../../shared/src/schemas/claude-integration';
import type { ZodSession } from '../../../../shared/src/schemas/index';

// Mock WebSocket service
const mockWebSocketService = {
  on: vi.fn(() => vi.fn()), // Returns unsubscriber function
  off: vi.fn(),
  once: vi.fn(() => vi.fn()),
  getInstance: vi.fn(() => mockWebSocketService),
};

// Mock the WebSocket service module
vi.mock('./websocket-service', () => ({
  getWebSocketService: () => mockWebSocketService,
}));

// Mock fetch
const mockFetch = vi.fn() as Mock;
global.fetch = mockFetch;

// Test data
const mockSession: ZodSession = {
  id: 'test-session-123',
  projectPath: '/test/project',
  cwd: '/test/project',
  firstTimestamp: '2023-01-01T00:00:00.000Z',
  lastTimestamp: '2023-01-01T01:00:00.000Z',
  totalUsage: {
    input_tokens: 1000,
    output_tokens: 500,
    cache_creation_input_tokens: 200,
    cache_read_input_tokens: 100
  },
  entries: []
};

const mockProcessStatus: ClaudeProcessStatus = {
  processId: 'test-process-123',
  state: 'running',
  pid: 12345,
  startTime: new Date('2023-01-01T00:00:00.000Z'),
  lastActivity: new Date('2023-01-01T00:01:00.000Z'),
};

const mockContinuationRequest: SessionContinuationRequest = {
  sessionId: 'test-session-123',
  sessionPath: '/path/to/session.jsonl',
  workingDirectory: '/test/project',
};

describe('ClaudeIntegrationService', () => {
  let service: ClaudeIntegrationService;

  beforeEach(() => {
    // Clear any existing instance
    if ((ClaudeIntegrationService as any).instance) {
      (ClaudeIntegrationService as any).instance = null;
    }
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup default fetch mock
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    
    service = ClaudeIntegrationService.getInstance({
      debug: false,
      enableWebSocketUpdates: true,
    });
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Singleton Pattern', () => {
    it('should create a singleton instance', () => {
      const instance1 = ClaudeIntegrationService.getInstance();
      const instance2 = ClaudeIntegrationService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ClaudeIntegrationService);
    });

    it('should use the convenience getter', () => {
      const instance1 = getClaudeIntegrationService();
      const instance2 = ClaudeIntegrationService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should update configuration when provided', () => {
      const config = { apiBaseUrl: '/custom-api', debug: true };
      const instance = ClaudeIntegrationService.getInstance(config);
      
      expect(instance).toBeDefined();
      expect((instance as any).config.apiBaseUrl).toBe('/custom-api');
      expect((instance as any).config.debug).toBe(true);
    });
  });

  describe('Session Continuation', () => {
    it('should continue a session successfully', async () => {
      const mockResponse: SessionContinuationResponse = {
        success: true,
        processId: 'test-process-123',
        message: 'Session continuation started',
        claudeProcessUrl: '/api/processes/test-process-123',
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.continueSession(mockContinuationRequest);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/continue',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockContinuationRequest),
        })
      );

      // Check that process status is cached
      const cachedStatus = service.getCachedProcessStatus('test-process-123');
      expect(cachedStatus).toBeDefined();
      expect(cachedStatus?.state).toBe('starting');
    });

    it('should handle session continuation failure', async () => {
      const mockResponse: SessionContinuationResponse = {
        success: false,
        processId: '',
        message: 'Failed to continue session',
        error: 'Session file not found',
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.continueSession(mockContinuationRequest);

      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session file not found');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.continueSession(mockContinuationRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        })
      );

      const result = await service.continueSession(mockContinuationRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 404: Not Found');
    });

    it('should handle request timeout', async () => {
      // Create a service with shorter timeout for testing
      service.destroy();
      service = ClaudeIntegrationService.getInstance({ 
        requestTimeout: 100 // 100ms timeout for testing
      });

      // Mock fetch to simulate AbortError which happens on timeout
      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Request timeout');
            error.name = 'AbortError';
            reject(error);
          }, 50);
        });
      });

      const result = await service.continueSession(mockContinuationRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 15000);
  });

  describe('Session Continuation with Context', () => {
    it('should continue session with context successfully', async () => {
      const contextRequest = {
        ...mockContinuationRequest,
        prepareContext: true,
        contextConfig: { includeGuidelines: true },
      };

      const mockResponse: SessionContinuationResponse = {
        success: true,
        processId: 'test-process-456',
        message: 'Session continuation with context started',
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.continueSessionWithContext(contextRequest, mockSession);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/continue-with-context',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(contextRequest),
        })
      );
    });
  });

  describe('Context Preparation', () => {
    it('should prepare session context successfully', async () => {
      const contextRequest: ContextPreparationRequest = {
        sessionId: 'test-session-123',
        workingDirectory: '/test/project',
      };

      const mockResponse: ContextPreparationResult = {
        success: true,
        claudeMdPath: '/test/project/CLAUDE.md',
        workingDirectory: '/test/project',
        processingTimeMs: 1500,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.prepareSessionContext(contextRequest, mockSession);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/prepare-context',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ ...contextRequest, session: mockSession }),
        })
      );
    });

    it('should handle context preparation failure', async () => {
      const contextRequest: ContextPreparationRequest = {
        sessionId: 'test-session-123',
        workingDirectory: '/test/project',
      };

      const mockResponse: ContextPreparationResult = {
        success: false,
        error: 'Failed to extract session data',
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.prepareSessionContext(contextRequest, mockSession);

      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('Process Management', () => {
    it('should get process status from cache', async () => {
      // Add status to cache
      (service as any).processes.set('cached-process', mockProcessStatus);

      const status = await service.getProcessStatus('cached-process');

      expect(status).toEqual(mockProcessStatus);
      expect(mockFetch).not.toHaveBeenCalled(); // Should use cache
    });

    it('should fetch process status from API when not cached', async () => {
      // Convert dates to strings as they would be in JSON response
      const mockProcessStatusAsJson = {
        ...mockProcessStatus,
        startTime: mockProcessStatus.startTime?.toISOString(),
        lastActivity: mockProcessStatus.lastActivity?.toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockProcessStatusAsJson), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const status = await service.getProcessStatus('test-process-123');

      expect(status).toEqual(mockProcessStatusAsJson);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/processes/test-process-123',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should get all process statuses', async () => {
      // Convert dates to strings as they would be in JSON response
      const allStatuses = [{
        ...mockProcessStatus,
        startTime: mockProcessStatus.startTime?.toISOString(),
        lastActivity: mockProcessStatus.lastActivity?.toISOString(),
      }];

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(allStatuses), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const statuses = await service.getAllProcessStatus();

      expect(statuses).toEqual(allStatuses);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/processes',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should send input to process', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.sendInput('test-process-123', 'test input');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/processes/test-process-123/input',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ input: 'test input' }),
        })
      );
    });

    it('should stop process', async () => {
      // Add process to cache first
      (service as any).processes.set('test-process-123', mockProcessStatus);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.stopProcess('test-process-123');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/processes/test-process-123/stop',
        expect.objectContaining({ method: 'POST' })
      );

      // Check that cached status is updated
      const updatedStatus = service.getCachedProcessStatus('test-process-123');
      expect(updatedStatus?.state).toBe('stopping');
    });
  });

  describe('Event System', () => {
    it('should support event subscription and emission', () => {
      const handler = vi.fn();
      const unsubscriber = service.on('process:status', handler);

      // Manually emit event for testing
      (service as any).eventEmitter.emit('process:status', mockProcessStatus);

      expect(handler).toHaveBeenCalledWith(mockProcessStatus);

      // Test unsubscription
      unsubscriber();
      (service as any).eventEmitter.emit('process:status', mockProcessStatus);

      expect(handler).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should support once event subscription', () => {
      const handler = vi.fn();
      service.once('session:continued', handler);

      // Emit event twice
      (service as any).eventEmitter.emit('session:continued', { sessionId: 'test', processId: 'test' });
      (service as any).eventEmitter.emit('session:continued', { sessionId: 'test', processId: 'test' });

      expect(handler).toHaveBeenCalledTimes(1); // Should only be called once
    });

    it('should support event unsubscription', () => {
      const handler = vi.fn();
      service.on('error', handler);
      service.off('error', handler);

      // Emit event
      (service as any).eventEmitter.emit('error', { code: 'PROCESS_START_FAILED', message: 'Test error' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket Integration', () => {
    it('should setup WebSocket listeners on initialization', () => {
      expect(mockWebSocketService.on).toHaveBeenCalled();
      
      // Should have set up listeners for different message types
      const callArgs = mockWebSocketService.on.mock.calls;
      expect(callArgs.some(args => args[0] === 'message')).toBe(true);
    });

    it('should handle WebSocket process status updates', () => {
      const handler = vi.fn();
      service.on('process:status', handler);

      // Get the message handlers registered with WebSocket service
      const messageHandlers = mockWebSocketService.on.mock.calls
        .filter(call => call[0] === 'message')
        .map(call => call[1]);

      expect(messageHandlers.length).toBeGreaterThan(0);

      // Simulate WebSocket message by calling all message handlers
      const message = {
        type: 'claude_process_status',
        data: mockProcessStatus,
      };

      messageHandlers.forEach(messageHandler => messageHandler(message));

      expect(handler).toHaveBeenCalledWith(mockProcessStatus);
      
      // Check that status is cached
      const cachedStatus = service.getCachedProcessStatus(mockProcessStatus.processId);
      expect(cachedStatus).toEqual(mockProcessStatus);
    });

    it('should handle WebSocket process output updates', () => {
      const handler = vi.fn();
      service.on('process:output', handler);

      const mockOutput: ClaudeOutput = {
        processId: 'test-process-123',
        type: 'stdout',
        data: 'Hello, world!',
        timestamp: new Date(),
      };

      // Get the message handlers registered with WebSocket service
      const messageHandlers = mockWebSocketService.on.mock.calls
        .filter(call => call[0] === 'message')
        .map(call => call[1]);

      // Simulate WebSocket message by calling all message handlers
      const message = {
        type: 'claude_process_output',
        data: mockOutput,
      };

      messageHandlers.forEach(messageHandler => messageHandler(message));

      expect(handler).toHaveBeenCalledWith(mockOutput);
    });

    it('should handle WebSocket process error updates', () => {
      const handler = vi.fn();
      service.on('process:error', handler);

      const mockError = {
        processId: 'test-process-123',
        error: 'Process crashed',
      };

      // Get the message handlers registered with WebSocket service
      const messageHandlers = mockWebSocketService.on.mock.calls
        .filter(call => call[0] === 'message')
        .map(call => call[1]);

      // Simulate WebSocket message by calling all message handlers
      const message = {
        type: 'claude_process_error',
        data: mockError,
      };

      messageHandlers.forEach(messageHandler => messageHandler(message));

      expect(handler).toHaveBeenCalledWith(mockError);
    });
  });

  describe('Cache Management', () => {
    it('should cache process status', () => {
      (service as any).processes.set('test-process', mockProcessStatus);

      const cached = service.getCachedProcessStatus('test-process');
      expect(cached).toEqual(mockProcessStatus);
    });

    it('should return all cached processes', () => {
      (service as any).processes.set('process-1', { ...mockProcessStatus, processId: 'process-1' });
      (service as any).processes.set('process-2', { ...mockProcessStatus, processId: 'process-2' });

      const cached = service.getCachedProcesses();
      expect(cached).toHaveLength(2);
      expect(cached.find(p => p.processId === 'process-1')).toBeDefined();
      expect(cached.find(p => p.processId === 'process-2')).toBeDefined();
    });

    it('should clear process cache', () => {
      (service as any).processes.set('test-process', mockProcessStatus);
      service.clearProcessCache();

      const cached = service.getCachedProcesses();
      expect(cached).toHaveLength(0);
    });

    it('should check if process is running', () => {
      (service as any).processes.set('running-process', { ...mockProcessStatus, state: 'running' });
      (service as any).processes.set('stopped-process', { ...mockProcessStatus, state: 'stopped' });

      expect(service.isProcessRunning('running-process')).toBe(true);
      expect(service.isProcessRunning('stopped-process')).toBe(false);
      expect(service.isProcessRunning('non-existent')).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    it('should get session context data', async () => {
      const mockContextData: ContextPreparationResult = {
        success: true,
        contextData: {
          sessionId: 'test-session-123',
          projectPath: '/test/project',
          keyTopics: ['authentication', 'database'],
          codePatterns: {
            modifiedFiles: ['app.ts', 'auth.ts'],
            commonPatterns: ['async/await', 'error handling'],
          },
          projectContext: {
            projectType: 'node.js',
            mainLanguages: ['typescript'],
            frameworks: ['express'],
            workingDirectory: '/test/project',
          },
          sessionStats: {
            totalMessages: 10,
            userMessages: 5,
            assistantMessages: 5,
            toolUses: 3,
            totalTokens: 1500,
            duration: 3600,
            lastActivity: '2023-01-01T01:00:00.000Z',
          },
          conversationSummary: 'Working on authentication system',
          recentContext: 'Recent work on login flow',
        },
        processingTimeMs: 1200,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockContextData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.getSessionContextData('test-session-123', mockSession);

      expect(result).toEqual(mockContextData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/context-data',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sessionId: 'test-session-123', session: mockSession }),
        })
      );
    });
  });

  describe('Service Lifecycle', () => {
    it('should destroy service and clean up resources', () => {
      // Add some data to cache
      (service as any).processes.set('test-process', mockProcessStatus);

      // Mock unsubscriber functions
      const unsubscriber1 = vi.fn();
      const unsubscriber2 = vi.fn();
      (service as any).webSocketUnsubscribers = [unsubscriber1, unsubscriber2];

      service.destroy();

      // Check cleanup
      expect(unsubscriber1).toHaveBeenCalled();
      expect(unsubscriber2).toHaveBeenCalled();
      expect(service.getCachedProcesses()).toHaveLength(0);
      expect((ClaudeIntegrationService as any).instance).toBe(null);
    });

    it('should handle service creation without WebSocket updates', () => {
      // Create new service without WebSocket updates
      if ((ClaudeIntegrationService as any).instance) {
        (ClaudeIntegrationService as any).instance = null;
      }

      const serviceWithoutWS = ClaudeIntegrationService.getInstance({
        enableWebSocketUpdates: false,
      });

      expect(serviceWithoutWS).toBeDefined();
      
      serviceWithoutWS.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('invalid json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.continueSession(mockContinuationRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected token');
    });

    it('should handle network failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const result = await service.getAllProcessStatus();

      expect(result).toEqual([]);
    });
  });
});

// Test utility functions
describe('Utility Functions', () => {
  let isProcessActive: typeof import('./claude-integration.service').isProcessActive;
  let isProcessFinished: typeof import('./claude-integration.service').isProcessFinished;
  let getProcessStateLabel: typeof import('./claude-integration.service').getProcessStateLabel;

  beforeEach(async () => {
    const module = await import('./claude-integration.service');
    isProcessActive = module.isProcessActive;
    isProcessFinished = module.isProcessFinished;
    getProcessStateLabel = module.getProcessStateLabel;
  });

  describe('isProcessActive', () => {
    it('should return true for active states', () => {
      expect(isProcessActive('starting')).toBe(true);
      expect(isProcessActive('running')).toBe(true);
    });

    it('should return false for inactive states', () => {
      expect(isProcessActive('idle')).toBe(false);
      expect(isProcessActive('stopped')).toBe(false);
      expect(isProcessActive('error')).toBe(false);
      expect(isProcessActive('stopping')).toBe(false);
    });
  });

  describe('isProcessFinished', () => {
    it('should return true for finished states', () => {
      expect(isProcessFinished('stopped')).toBe(true);
      expect(isProcessFinished('error')).toBe(true);
    });

    it('should return false for non-finished states', () => {
      expect(isProcessFinished('idle')).toBe(false);
      expect(isProcessFinished('starting')).toBe(false);
      expect(isProcessFinished('running')).toBe(false);
      expect(isProcessFinished('stopping')).toBe(false);
    });
  });

  describe('getProcessStateLabel', () => {
    it('should return correct labels for all states', () => {
      expect(getProcessStateLabel('idle')).toBe('⚪ Ready');
      expect(getProcessStateLabel('starting')).toBe('🟡 Starting...');
      expect(getProcessStateLabel('running')).toBe('🟢 Running');
      expect(getProcessStateLabel('stopping')).toBe('🟡 Stopping...');
      expect(getProcessStateLabel('stopped')).toBe('⚫ Stopped');
      expect(getProcessStateLabel('error')).toBe('🔴 Error');
    });

    it('should return unknown label for invalid state', () => {
      expect(getProcessStateLabel('invalid' as any)).toBe('❓ Unknown');
    });
  });
});