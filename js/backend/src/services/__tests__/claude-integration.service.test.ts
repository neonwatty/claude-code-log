import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import { ClaudeIntegrationService } from '../claude-integration.service.js';
import {
  ClaudeCommand,
  ClaudeIntegrationConfig,
  SessionContinuationRequest,
} from '../../../../shared/src/schemas/claude-integration.js';

// Mock child_process
vi.mock('child_process');
const mockSpawn = spawn as MockedFunction<typeof spawn>;

// Mock fs/promises
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

// Mock child process
class MockChildProcess extends EventEmitter {
  pid = 12345;
  stdin = {
    write: vi.fn().mockReturnValue(true),
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn().mockReturnValue(true);
}

describe('ClaudeIntegrationService', () => {
  let service: ClaudeIntegrationService;
  let mockChildProcess: MockChildProcess;
  let processRegistry: Map<string, MockChildProcess>;
  
  // Helper function to mock a successful Claude availability check + process spawn
  const mockSuccessfulSpawn = () => {
    const checkProcess = new MockChildProcess();
    const actualProcess = new MockChildProcess();
    
    mockSpawn
      .mockReturnValueOnce(checkProcess as any)  // Availability check
      .mockReturnValueOnce(actualProcess as any); // Actual process
    
    // Trigger availability check success immediately on next tick
    setImmediate(() => checkProcess.emit('close', 0));
    
    // Update global mockChildProcess to match the actual process
    mockChildProcess = actualProcess;
    
    return { checkProcess, actualProcess };
  };
  
  // Helper function to mock a failing Claude availability check
  const mockFailedAvailabilityCheck = (error: Error) => {
    const checkProcess = new MockChildProcess();
    mockSpawn.mockReturnValueOnce(checkProcess as any);
    setImmediate(() => checkProcess.emit('error', error));
    return checkProcess;
  };
  
  beforeEach(() => {
    // Reset all mocks completely
    vi.clearAllMocks();
    vi.resetAllMocks();
    
    // Create mock child process and registry
    mockChildProcess = new MockChildProcess();
    processRegistry = new Map();
    
    // Mock fs.access to succeed by default
    mockFs.access.mockResolvedValue(undefined);
    
    // Reset spawn mock to default implementation
    mockSpawn.mockReset();
    
    // Create service with test config
    const config: Partial<ClaudeIntegrationConfig> = {
      maxProcesses: 2,
      processTimeout: 1000, // 1 second for testing
      cleanupInterval: 100, // 100ms for testing
    };
    
    service = new ClaudeIntegrationService(config);
  });

  afterEach(async () => {
    // Clean up service
    await service.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new ClaudeIntegrationService();
      expect(defaultService).toBeInstanceOf(ClaudeIntegrationService);
      expect(defaultService).toBeInstanceOf(EventEmitter);
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: Partial<ClaudeIntegrationConfig> = {
        maxProcesses: 10,
        claudeExecutablePath: 'custom-claude',
      };
      
      const customService = new ClaudeIntegrationService(customConfig);
      expect(customService).toBeInstanceOf(ClaudeIntegrationService);
    });
  });

  describe('startProcess', () => {
    it('should start a Claude process successfully', async () => {
      const { actualProcess } = mockSuccessfulSpawn();

      const command: ClaudeCommand = {
        command: '--help',
        args: ['arg1', 'arg2'],
      };

      const processId = await service.startProcess(command);
      
      expect(processId).toBeTruthy();
      expect(mockSpawn).toHaveBeenCalledTimes(2); // availability check + actual process
      
      const status = service.getProcessStatus(processId);
      expect(status).toBeTruthy();
      expect(status?.state).toBe('running');
      expect(status?.pid).toBe(actualProcess.pid);
    });

    it('should fail when Claude CLI is not available', async () => {
      mockFailedAvailabilityCheck(new Error('Command not found'));

      const command: ClaudeCommand = {
        command: '--help',
        args: [],
      };

      await expect(service.startProcess(command)).rejects.toMatchObject({
        code: 'CLAUDE_NOT_INSTALLED',
      });
    });

    it('should fail when working directory does not exist', async () => {
      // Mock fs.access to fail
      mockFs.access.mockRejectedValueOnce(new Error('Directory not found'));

      const command: ClaudeCommand = {
        command: '--help',
        args: [],
        workingDirectory: '/nonexistent/directory',
      };

      await expect(service.startProcess(command)).rejects.toMatchObject({
        code: 'INVALID_WORKING_DIRECTORY',
      });
    });

    it('should fail when max processes limit is reached', async () => {
      const command: ClaudeCommand = { command: '--help', args: [] };
      
      // Start first process
      mockSuccessfulSpawn();
      await service.startProcess(command);
      
      // Start second process (reaches limit)
      mockSuccessfulSpawn();
      await service.startProcess(command);
      
      // Third process should fail without needing to mock anything since we hit the limit
      await expect(service.startProcess(command)).rejects.toMatchObject({
        code: 'MAX_PROCESSES_REACHED',
      });
    });

    it('should handle process spawn errors', async () => {
      // Mock Claude CLI availability check to succeed
      const checkProcess = new MockChildProcess();
      mockSpawn.mockReturnValueOnce(checkProcess as any);
      setImmediate(() => checkProcess.emit('close', 0));

      // Mock spawn to throw error on actual process creation
      mockSpawn.mockImplementationOnce(() => {
        throw new Error('Spawn failed');
      });

      const command: ClaudeCommand = { command: '--help', args: [] };

      await expect(service.startProcess(command)).rejects.toMatchObject({
        code: 'PROCESS_START_FAILED',
      });
    });
  });

  describe('continueSession', () => {
    it('should continue a session successfully', async () => {
      // Ensure fs.access is mocked for session file
      mockFs.access.mockResolvedValue(undefined);
      
      // Set up fresh mock for this test
      const checkProcess = new MockChildProcess();
      const actualProcess = new MockChildProcess();
      
      mockSpawn
        .mockReturnValueOnce(checkProcess as any)  // Availability check
        .mockReturnValueOnce(actualProcess as any); // Actual process
      
      // Trigger availability check success
      setImmediate(() => checkProcess.emit('close', 0));

      const request: SessionContinuationRequest = {
        sessionId: 'test-session-id',
        sessionPath: '/path/to/session.jsonl',
      };

      const response = await service.continueSession(request);

      expect(response.success).toBe(true);
      expect(response.processId).toBeTruthy();
      expect(response.message).toContain('started successfully');
      expect(response.claudeProcessUrl).toBeTruthy();
    });

    it('should fail when session file does not exist', async () => {
      // Mock fs.access to fail
      mockFs.access.mockRejectedValueOnce(new Error('File not found'));

      const request: SessionContinuationRequest = {
        sessionId: 'test-session-id',
        sessionPath: '/nonexistent/session.jsonl',
      };

      const response = await service.continueSession(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('does not exist');
    });

    it('should handle process start failures in session continuation', async () => {
      // Ensure fs.access succeeds for session file
      mockFs.access.mockResolvedValue(undefined);
      
      // Mock Claude CLI availability check to fail
      const checkProcess = new MockChildProcess();
      mockSpawn.mockReturnValueOnce(checkProcess as any);
      setImmediate(() => checkProcess.emit('error', new Error('Claude not found')));

      const request: SessionContinuationRequest = {
        sessionId: 'test-session-id',
        sessionPath: '/path/to/session.jsonl',
      };

      const response = await service.continueSession(request);

      expect(response.success).toBe(false);
      expect(response.error).toBeTruthy();
    });
  });

  describe('process management', () => {
    it('should get process status correctly', async () => {
      const { actualProcess } = mockSuccessfulSpawn();

      const command: ClaudeCommand = { command: '--help', args: [] };
      const processId = await service.startProcess(command);

      const status = service.getProcessStatus(processId);
      expect(status).toBeTruthy();
      expect(status?.processId).toBe(processId);
      expect(status?.state).toBe('running');
    });

    it('should return null for non-existent process', () => {
      const status = service.getProcessStatus('non-existent-id');
      expect(status).toBeNull();
    });

    it('should get all process statuses', async () => {
      const command: ClaudeCommand = { command: '--help', args: [] };
      
      // Start two processes
      mockSuccessfulSpawn();
      await service.startProcess(command);
      
      mockSuccessfulSpawn();
      await service.startProcess(command);

      const allStatuses = service.getAllProcessStatus();
      expect(allStatuses).toHaveLength(2);
    });
  });

  describe('sendInput', () => {
    it('should send input to process successfully', async () => {
      const { actualProcess } = mockSuccessfulSpawn();

      const command: ClaudeCommand = { command: '--help', args: [] };
      const processId = await service.startProcess(command);

      const result = service.sendInput(processId, 'test input\n');

      expect(result).toBe(true);
      expect(actualProcess.stdin.write).toHaveBeenCalledWith('test input\n');
    });

    it('should fail to send input to non-existent process', () => {
      const result = service.sendInput('non-existent-id', 'test input\n');
      expect(result).toBe(false);
    });
  });

  describe('killProcess', () => {
    it('should kill a process successfully', async () => {
      const { actualProcess } = mockSuccessfulSpawn();

      const command: ClaudeCommand = { command: '--help', args: [] };
      const processId = await service.startProcess(command);

      const result = await service.killProcess(processId, 'Test termination');

      expect(result).toBe(true);
      expect(actualProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      const status = service.getProcessStatus(processId);
      expect(status?.state).toBe('stopping');
      expect(status?.error).toBe('Test termination');
    });

    it('should return false for non-existent process', async () => {
      const result = await service.killProcess('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('event handling', () => {
    it('should emit output events', async () => {
      const { actualProcess } = mockSuccessfulSpawn();

      const command: ClaudeCommand = { command: '--help', args: [] };
      const processId = await service.startProcess(command);

      // Set up event listener before emitting
      const outputPromise = new Promise((resolve) => {
        service.once('output', resolve);
      });

      // Emit stdout data on the actual process
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure process is registered
      actualProcess.stdout.emit('data', Buffer.from('test output'));

      const output = await outputPromise;
      expect(output).toMatchObject({
        processId,
        type: 'stdout',
        data: 'test output',
      });
    }, 15000);

    it('should emit error events', async () => {
      const { actualProcess } = mockSuccessfulSpawn();

      const command: ClaudeCommand = { command: '--help', args: [] };
      const processId = await service.startProcess(command);

      // Set up event listener before emitting
      const errorPromise = new Promise((resolve) => {
        service.once('error', resolve);
      });

      // Emit error on the actual process
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure process is registered
      actualProcess.emit('error', new Error('Process error'));

      const errorEvent = await errorPromise;
      expect(errorEvent).toMatchObject({
        processId,
        error: expect.any(Error),
      });
    }, 15000);

    it('should emit exit events', async () => {
      const { actualProcess } = mockSuccessfulSpawn();

      const command: ClaudeCommand = { command: '--help', args: [] };
      const processId = await service.startProcess(command);

      // Set up event listener before emitting
      const exitPromise = new Promise((resolve) => {
        service.once('exit', resolve);
      });

      // Emit exit on the actual process
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure process is registered
      actualProcess.emit('exit', 0, null);

      const exitEvent = await exitPromise;
      expect(exitEvent).toMatchObject({
        processId,
        code: 0,
        signal: null,
      });

      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Process should be removed from active processes
      const status = service.getProcessStatus(processId);
      expect(status?.state).toBe('stopped');
      expect(status?.exitCode).toBe(0);
    }, 15000);
  });

  describe('cleanup', () => {
    it('should clean up all processes on service shutdown', async () => {
      const command: ClaudeCommand = { command: '--help', args: [] };
      
      // Start two processes
      const { actualProcess: process1 } = mockSuccessfulSpawn();
      await service.startProcess(command);
      
      const { actualProcess: process2 } = mockSuccessfulSpawn();
      await service.startProcess(command);

      // Verify processes are running
      expect(service.getAllProcessStatus()).toHaveLength(2);

      // Clean up
      await service.cleanup();

      // Verify cleanup was called on both processes
      expect(process1.kill).toHaveBeenCalled();
      expect(process2.kill).toHaveBeenCalled();

      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify all processes are cleaned up
      expect(service.getAllProcessStatus()).toHaveLength(0);
    }, 15000);
  });

  describe('configuration', () => {
    it('should respect process timeout configuration', async () => {
      // Create service with very short timeout
      const shortTimeoutService = new ClaudeIntegrationService({
        processTimeout: 50, // 50ms
        cleanupInterval: 25, // Check more frequently
      });

      const { actualProcess } = mockSuccessfulSpawn();

      const command: ClaudeCommand = { command: '--help', args: [] };
      const processId = await shortTimeoutService.startProcess(command);

      // Wait for timeout to trigger
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Process should be killed due to timeout
      expect(actualProcess.kill).toHaveBeenCalled();

      await shortTimeoutService.cleanup();
    }, 15000);
  });
});