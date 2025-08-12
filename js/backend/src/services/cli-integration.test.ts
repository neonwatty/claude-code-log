import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CLIIntegration from './cli-integration';
import { CLIProcessConfig } from '../types/websocket';

// Mock all dependencies
vi.mock('./process-manager');
vi.mock('./stream-handler');
vi.mock('./session-state');
vi.mock('./input-handler');

describe('CLIIntegration', () => {
  let cliIntegration: CLIIntegration;

  beforeEach(() => {
    cliIntegration = new CLIIntegration();
  });

  afterEach(async () => {
    await cliIntegration.shutdown();
  });

  describe('spawnProcess', () => {
    it('should spawn a new CLI process with session', async () => {
      const config: CLIProcessConfig = {
        command: 'claude',
        args: ['--help'],
        cwd: '/tmp',
        env: { TEST: 'value' },
      };

      // Mock the internal calls
      const mockProcessManager = (cliIntegration as any).processManager;
      const mockSessionManager = (cliIntegration as any).sessionManager;
      const mockStreamHandler = (cliIntegration as any).streamHandler;
      const mockInputHandler = (cliIntegration as any).inputHandler;

      mockSessionManager.createSession = vi.fn().mockResolvedValue('session-123');
      mockProcessManager.spawn = vi.fn().mockResolvedValue('process-456');
      mockProcessManager.getProcessStdin = vi.fn().mockReturnValue({});
      mockSessionManager.associateProcess = vi.fn().mockResolvedValue(true);
      mockSessionManager.addCommandToHistory = vi.fn().mockResolvedValue(true);
      mockStreamHandler.createStreamHandlers = vi.fn().mockReturnValue({});
      mockInputHandler.registerProcess = vi.fn();

      const processId = await cliIntegration.spawnProcess(config);

      expect(processId).toBe('process-456');
      expect(mockProcessManager.spawn).toHaveBeenCalledWith({
        command: 'claude',
        args: ['--help'],
        cwd: '/tmp',
        env: { TEST: 'value' },
        timeout: undefined,
      });
      expect(mockSessionManager.createSession).toHaveBeenCalledWith({
        workingDirectory: '/tmp',
        environment: { TEST: 'value' },
      });
      expect(mockSessionManager.associateProcess).toHaveBeenCalledWith('session-123', 'process-456');
    });

    it('should use existing session if provided', async () => {
      const config: CLIProcessConfig = {
        command: 'claude',
        args: ['--help'],
      };

      const mockProcessManager = (cliIntegration as any).processManager;
      const mockSessionManager = (cliIntegration as any).sessionManager;
      const mockStreamHandler = (cliIntegration as any).streamHandler;
      const mockInputHandler = (cliIntegration as any).inputHandler;

      mockProcessManager.spawn = vi.fn().mockResolvedValue('process-456');
      mockProcessManager.getProcessStdin = vi.fn().mockReturnValue({});
      mockSessionManager.associateProcess = vi.fn().mockResolvedValue(true);
      mockSessionManager.addCommandToHistory = vi.fn().mockResolvedValue(true);
      mockStreamHandler.createStreamHandlers = vi.fn().mockReturnValue({});
      mockInputHandler.registerProcess = vi.fn();

      const processId = await cliIntegration.spawnProcess(config, 'existing-session-123');

      expect(processId).toBe('process-456');
      expect(mockSessionManager.associateProcess).toHaveBeenCalledWith('existing-session-123', 'process-456');
      expect(mockSessionManager.createSession).not.toHaveBeenCalled();
    });

    it('should handle spawn errors', async () => {
      const config: CLIProcessConfig = {
        command: 'invalid-command',
      };

      const mockProcessManager = (cliIntegration as any).processManager;
      mockProcessManager.spawn = vi.fn().mockRejectedValue(new Error('Command not found'));

      await expect(cliIntegration.spawnProcess(config)).rejects.toThrow(
        'Failed to spawn CLI process: Command not found'
      );
    });
  });

  describe('terminateProcess', () => {
    it('should terminate process and suspend session', async () => {
      const processId = 'process-123';
      
      const mockProcessManager = (cliIntegration as any).processManager;
      const mockSessionManager = (cliIntegration as any).sessionManager;

      mockSessionManager.getSessionByProcess = vi.fn().mockReturnValue('session-456');
      mockProcessManager.terminate = vi.fn().mockResolvedValue(true);
      mockSessionManager.suspendSession = vi.fn().mockResolvedValue(true);

      const result = await cliIntegration.terminateProcess(processId);

      expect(result).toBe(true);
      expect(mockProcessManager.terminate).toHaveBeenCalledWith(processId, undefined);
      expect(mockSessionManager.suspendSession).toHaveBeenCalledWith('session-456');
    });

    it('should handle custom signal', async () => {
      const processId = 'process-123';
      
      const mockProcessManager = (cliIntegration as any).processManager;
      mockProcessManager.terminate = vi.fn().mockResolvedValue(true);

      await cliIntegration.terminateProcess(processId, 'SIGKILL');

      expect(mockProcessManager.terminate).toHaveBeenCalledWith(processId, 'SIGKILL');
    });

    it('should return false on termination failure', async () => {
      const processId = 'process-123';
      
      const mockProcessManager = (cliIntegration as any).processManager;
      mockProcessManager.terminate = vi.fn().mockResolvedValue(false);

      const result = await cliIntegration.terminateProcess(processId);

      expect(result).toBe(false);
    });
  });

  describe('sendInput', () => {
    it('should send input through InputHandler', async () => {
      const processId = 'process-123';
      const inputData = 'test command';

      const mockInputHandler = (cliIntegration as any).inputHandler;
      const mockSessionManager = (cliIntegration as any).sessionManager;

      mockInputHandler.queueInput = vi.fn().mockResolvedValue('input-456');
      mockSessionManager.getSessionByProcess = vi.fn().mockReturnValue('session-789');
      mockSessionManager.addCommandToHistory = vi.fn().mockResolvedValue(true);

      const result = await cliIntegration.sendInput(processId, inputData);

      expect(result).toBe(true);
      expect(mockInputHandler.queueInput).toHaveBeenCalledWith(processId, inputData, undefined);
      expect(mockSessionManager.addCommandToHistory).toHaveBeenCalledWith('session-789', 'INPUT: test command');
    });

    it('should handle input options', async () => {
      const processId = 'process-123';
      const inputData = 'urgent command';
      const options = { priority: 10, skipQueue: true };

      const mockInputHandler = (cliIntegration as any).inputHandler;
      const mockSessionManager = (cliIntegration as any).sessionManager;

      mockInputHandler.queueInput = vi.fn().mockResolvedValue('input-456');
      mockSessionManager.getSessionByProcess = vi.fn().mockReturnValue('session-789');
      mockSessionManager.addCommandToHistory = vi.fn().mockResolvedValue(true);

      const result = await cliIntegration.sendInput(processId, inputData, options);

      expect(result).toBe(true);
      expect(mockInputHandler.queueInput).toHaveBeenCalledWith(processId, inputData, options);
    });

    it('should return false on input failure', async () => {
      const processId = 'process-123';
      
      const mockInputHandler = (cliIntegration as any).inputHandler;
      mockInputHandler.queueInput = vi.fn().mockRejectedValue(new Error('Input failed'));

      const result = await cliIntegration.sendInput(processId, 'test');

      expect(result).toBe(false);
    });
  });

  describe('sendSpecialSequence', () => {
    it('should send special sequence through InputHandler', async () => {
      const processId = 'process-123';

      const mockInputHandler = (cliIntegration as any).inputHandler;
      const mockSessionManager = (cliIntegration as any).sessionManager;

      mockInputHandler.sendSpecialSequence = vi.fn().mockResolvedValue('input-456');
      mockSessionManager.getSessionByProcess = vi.fn().mockReturnValue('session-789');
      mockSessionManager.addCommandToHistory = vi.fn().mockResolvedValue(true);

      const result = await cliIntegration.sendSpecialSequence(processId, 'CTRL_C');

      expect(result).toBe(true);
      expect(mockInputHandler.sendSpecialSequence).toHaveBeenCalledWith(processId, 'CTRL_C');
      expect(mockSessionManager.addCommandToHistory).toHaveBeenCalledWith('session-789', 'SPECIAL: CTRL_C');
    });
  });

  describe('getProcessInfo', () => {
    it('should return converted process info', () => {
      const mockProcessManager = (cliIntegration as any).processManager;
      mockProcessManager.getProcessInfo = vi.fn().mockReturnValue({
        id: 'process-123',
        pid: 456,
        command: 'claude',
        args: ['--help'],
        status: 'running',
        startedAt: new Date('2024-01-01'),
        stoppedAt: undefined,
        exitCode: undefined,
        signal: undefined,
        error: undefined,
      });

      const processInfo = cliIntegration.getProcessInfo('process-123');

      expect(processInfo).toEqual({
        id: 'process-123',
        pid: 456,
        command: 'claude',
        args: ['--help'],
        status: 'running',
        startedAt: '2024-01-01T00:00:00.000Z',
        stoppedAt: undefined,
        exitCode: undefined,
        signal: undefined,
        error: undefined,
      });
    });

    it('should return null for non-existent process', () => {
      const mockProcessManager = (cliIntegration as any).processManager;
      mockProcessManager.getProcessInfo = vi.fn().mockReturnValue(undefined);

      const processInfo = cliIntegration.getProcessInfo('non-existent');

      expect(processInfo).toBeNull();
    });
  });

  describe('getAllProcesses', () => {
    it('should return all converted process info', () => {
      const mockProcessManager = (cliIntegration as any).processManager;
      mockProcessManager.getAllProcesses = vi.fn().mockReturnValue([
        {
          id: 'process-123',
          command: 'claude',
          args: [],
          status: 'running',
          startedAt: new Date('2024-01-01'),
        },
        {
          id: 'process-456',
          command: 'echo',
          args: ['hello'],
          status: 'stopped',
          startedAt: new Date('2024-01-02'),
          stoppedAt: new Date('2024-01-02'),
          exitCode: 0,
        },
      ]);

      const processes = cliIntegration.getAllProcesses();

      expect(processes).toHaveLength(2);
      expect(processes[0].id).toBe('process-123');
      expect(processes[1].id).toBe('process-456');
      expect(processes[1].exitCode).toBe(0);
    });
  });

  describe('isProcessRunning', () => {
    it('should delegate to ProcessManager', () => {
      const mockProcessManager = (cliIntegration as any).processManager;
      mockProcessManager.isProcessRunning = vi.fn().mockReturnValue(true);

      const result = cliIntegration.isProcessRunning('process-123');

      expect(result).toBe(true);
      expect(mockProcessManager.isProcessRunning).toHaveBeenCalledWith('process-123');
    });
  });

  describe('input handler integration', () => {
    it('should delegate isInteractiveMode to InputHandler', () => {
      const mockInputHandler = (cliIntegration as any).inputHandler;
      mockInputHandler.isInteractiveMode = vi.fn().mockReturnValue(true);

      const result = cliIntegration.isInteractiveMode('process-123');

      expect(result).toBe(true);
      expect(mockInputHandler.isInteractiveMode).toHaveBeenCalledWith('process-123');
    });

    it('should delegate getInputQueue to InputHandler', () => {
      const mockQueue = [{ id: 'input-1', data: 'test', timestamp: new Date() }];
      const mockInputHandler = (cliIntegration as any).inputHandler;
      mockInputHandler.getInputQueue = vi.fn().mockReturnValue(mockQueue);

      const result = cliIntegration.getInputQueue('process-123');

      expect(result).toBe(mockQueue);
      expect(mockInputHandler.getInputQueue).toHaveBeenCalledWith('process-123');
    });

    it('should delegate clearInputQueue to InputHandler', () => {
      const mockInputHandler = (cliIntegration as any).inputHandler;
      mockInputHandler.clearInputQueue = vi.fn().mockReturnValue(5);

      const result = cliIntegration.clearInputQueue('process-123');

      expect(result).toBe(5);
      expect(mockInputHandler.clearInputQueue).toHaveBeenCalledWith('process-123');
    });
  });

  describe('getStats', () => {
    it('should return combined statistics', () => {
      const mockProcessManager = (cliIntegration as any).processManager;
      const mockSessionManager = (cliIntegration as any).sessionManager;

      mockProcessManager.getStats = vi.fn().mockReturnValue({
        total: 5,
        running: 3,
        stopped: 2,
        error: 0,
        timeout: 0,
      });

      mockSessionManager.getStats = vi.fn().mockReturnValue({
        total: 4,
        active: 3,
        suspended: 1,
        withProcesses: 3,
      });

      const stats = cliIntegration.getStats();

      expect(stats.processes.total).toBe(5);
      expect(stats.sessions.total).toBe(4);
      expect(stats.integration.totalManagedProcesses).toBe(5);
      expect(stats.integration.activeIntegrations).toBe(3);
    });
  });

  describe('cleanup and recovery', () => {
    it('should delegate cleanup to SessionManager', async () => {
      const mockSessionManager = (cliIntegration as any).sessionManager;
      mockSessionManager.cleanupExpiredSessions = vi.fn().mockResolvedValue({
        expiredSessions: 2,
        orphanedProcesses: 1,
      });

      const result = await cliIntegration.cleanup();

      expect(result.expiredSessions).toBe(2);
      expect(result.orphanedProcesses).toBe(1);
    });

    it('should delegate recovery to SessionManager', async () => {
      const mockSessionManager = (cliIntegration as any).sessionManager;
      mockSessionManager.recoverSessions = vi.fn().mockResolvedValue({
        recovered: 3,
        failed: 1,
      });

      const result = await cliIntegration.recoverSessions();

      expect(result.recovered).toBe(3);
      expect(result.failed).toBe(1);
    });
  });

  describe('event handling', () => {
    it('should emit events when process starts', async () => {
      const eventPromise = new Promise((resolve) => {
        cliIntegration.once('process-started', (processId, processInfo) => {
          resolve({ processId, processInfo });
        });
      });

      const mockProcessManager = (cliIntegration as any).processManager;
      const processInfo = {
        id: 'process-123',
        command: 'claude',
        args: [],
        status: 'running',
        startedAt: new Date(),
      };

      // Simulate process-started event
      mockProcessManager.emit('process-started', processInfo);

      const { processId, processInfo: emittedInfo } = await eventPromise as any;
      expect(processId).toBe('process-123');
      expect(emittedInfo.id).toBe('process-123');
    });

    it('should handle interactive mode detection', () => {
      const mockStreamHandler = (cliIntegration as any).streamHandler;
      const mockInputHandler = (cliIntegration as any).inputHandler;

      mockInputHandler.detectInteractiveMode = vi.fn().mockReturnValue(true);

      const parsedOutput = {
        type: 'stdout' as const,
        content: 'Continue? [y/n]',
        timestamp: new Date(),
        parsed: {},
      };

      // Simulate parsed-output event
      mockStreamHandler.emit('parsed-output', 'process-123', parsedOutput);

      expect(mockInputHandler.detectInteractiveMode).toHaveBeenCalledWith('process-123', 'Continue? [y/n]');
    });
  });

  describe('shutdown', () => {
    it('should shutdown all components', async () => {
      const mockProcessManager = (cliIntegration as any).processManager;
      const mockSessionManager = (cliIntegration as any).sessionManager;
      const mockInputHandler = (cliIntegration as any).inputHandler;

      mockProcessManager.shutdown = vi.fn().mockResolvedValue(undefined);
      mockSessionManager.shutdown = vi.fn().mockResolvedValue(undefined);
      mockInputHandler.shutdown = vi.fn().mockResolvedValue(undefined);

      await cliIntegration.shutdown();

      expect(mockProcessManager.shutdown).toHaveBeenCalled();
      expect(mockSessionManager.shutdown).toHaveBeenCalled();
      expect(mockInputHandler.shutdown).toHaveBeenCalled();
    });
  });
});