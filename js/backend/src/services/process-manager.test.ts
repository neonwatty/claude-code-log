import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { EventEmitter } from 'events';

// Mock child_process module
vi.mock('child_process', () => {
  return {
    spawn: vi.fn(),
  };
});

import ProcessManager, { ProcessConfig } from './process-manager';

describe('ProcessManager', () => {
  let processManager: ProcessManager;
  let mockSpawn: any;
  let mockChildProcess: any;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    // Create a fresh mock child process for each test
    mockChildProcess = new EventEmitter();
    mockChildProcess.pid = 12345;
    mockChildProcess.killed = false;
    mockChildProcess.stdin = {
      write: vi.fn().mockReturnValue(true),
    };
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.kill = vi.fn().mockReturnValue(true);

    // Setup spawn mock
    const { spawn } = await import('child_process');
    mockSpawn = vi.mocked(spawn);
    mockSpawn.mockReturnValue(mockChildProcess as any);

    processManager = new ProcessManager();
  });

  afterEach(async () => {
    await processManager.shutdown();
  });

  describe('spawn', () => {
    it('should spawn a new process and return process ID', async () => {
      const config: ProcessConfig = {
        command: 'echo',
        args: ['hello'],
      };

      const processId = await processManager.spawn(config);
      
      expect(processId).toBeDefined();
      expect(typeof processId).toBe('string');
      expect(mockSpawn).toHaveBeenCalledWith('echo', ['hello'], expect.any(Object));
    });

    it('should emit process-started event when process spawns', async () => {
      const config: ProcessConfig = {
        command: 'echo',
        args: ['hello'],
      };

      const startedPromise = new Promise((resolve) => {
        processManager.once('process-started', resolve);
      });

      const processId = await processManager.spawn(config);
      
      // Simulate spawn event
      mockChildProcess.emit('spawn');
      
      const processInfo = await startedPromise;
      expect(processInfo).toBeDefined();
      expect((processInfo as any).id).toBe(processId);
    });

    it('should handle spawn errors gracefully', async () => {
      const config: ProcessConfig = {
        command: 'nonexistent-command',
      };

      const errorPromise = new Promise((resolve) => {
        processManager.once('process-error', resolve);
      });

      const processId = await processManager.spawn(config);
      
      // Simulate error event
      const error = new Error('Command not found');
      mockChildProcess.emit('error', error);
      
      const errorEvent = await errorPromise;
      expect(errorEvent).toBeDefined();
    });

    it('should set up environment variables correctly', async () => {
      const config: ProcessConfig = {
        command: 'echo',
        args: ['test'],
        env: {
          TEST_VAR: 'test_value',
        },
      };

      await processManager.spawn(config);

      expect(mockSpawn).toHaveBeenCalledWith(
        'echo',
        ['test'],
        expect.objectContaining({
          env: expect.objectContaining({
            TEST_VAR: 'test_value',
            NODE_CHANNEL_FD: undefined, // Should be undefined for security
          }),
        })
      );
    });

    it('should handle working directory configuration', async () => {
      const config: ProcessConfig = {
        command: 'echo',
        args: ['test'],
        cwd: '/tmp',
      };

      await processManager.spawn(config);

      expect(mockSpawn).toHaveBeenCalledWith(
        'echo',
        ['test'],
        expect.objectContaining({
          cwd: '/tmp',
        })
      );
    });
  });

  describe('terminate', () => {
    it('should terminate a process by ID', async () => {
      const config: ProcessConfig = {
        command: 'echo',
        args: ['hello'],
      };

      const processId = await processManager.spawn(config);
      mockChildProcess.emit('spawn');

      const result = await processManager.terminate(processId);
      
      expect(result).toBe(true);
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should return false for non-existent process', async () => {
      const result = await processManager.terminate('non-existent-id');
      expect(result).toBe(false);
    });

    it('should handle custom signals', async () => {
      const config: ProcessConfig = {
        command: 'echo',
        args: ['hello'],
      };

      const processId = await processManager.spawn(config);
      mockChildProcess.emit('spawn');

      await processManager.terminate(processId, 'SIGKILL');
      
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('writeToProcess', () => {
    it('should write data to process stdin', async () => {
      const config: ProcessConfig = {
        command: 'cat',
      };

      const processId = await processManager.spawn(config);
      mockChildProcess.emit('spawn');

      const result = await processManager.writeToProcess(processId, 'test data');
      
      expect(result).toBe(true);
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('test data');
    });

    it('should return false for non-existent process', async () => {
      const result = await processManager.writeToProcess('non-existent', 'data');
      expect(result).toBe(false);
    });

    it('should handle buffer input', async () => {
      const config: ProcessConfig = {
        command: 'cat',
      };

      const processId = await processManager.spawn(config);
      mockChildProcess.emit('spawn');

      const buffer = Buffer.from('test buffer');
      const result = await processManager.writeToProcess(processId, buffer);
      
      expect(result).toBe(true);
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(buffer);
    });
  });

  describe('getProcessInfo', () => {
    it('should return process information', async () => {
      const config: ProcessConfig = {
        command: 'echo',
        args: ['hello'],
      };

      const processId = await processManager.spawn(config);
      mockChildProcess.emit('spawn');

      const info = processManager.getProcessInfo(processId);
      
      expect(info).toBeDefined();
      expect(info!.id).toBe(processId);
      expect(info!.command).toBe('echo');
      expect(info!.args).toEqual(['hello']);
      expect(info!.status).toBe('running');
    });

    it('should return undefined for non-existent process', () => {
      const info = processManager.getProcessInfo('non-existent');
      expect(info).toBeUndefined();
    });
  });

  describe('getAllProcesses', () => {
    it('should return all process information', async () => {
      const config1: ProcessConfig = { command: 'echo', args: ['1'] };
      const config2: ProcessConfig = { command: 'echo', args: ['2'] };

      const processId1 = await processManager.spawn(config1);
      const processId2 = await processManager.spawn(config2);

      const allProcesses = processManager.getAllProcesses();
      
      expect(allProcesses).toHaveLength(2);
      expect(allProcesses.map(p => p.id)).toContain(processId1);
      expect(allProcesses.map(p => p.id)).toContain(processId2);
    });

    it('should return empty array when no processes', () => {
      const allProcesses = processManager.getAllProcesses();
      expect(allProcesses).toEqual([]);
    });
  });

  describe('getProcessesByStatus', () => {
    it('should filter processes by status', async () => {
      const config: ProcessConfig = { command: 'echo', args: ['hello'] };
      const processId = await processManager.spawn(config);
      
      mockChildProcess.emit('spawn');
      
      const runningProcesses = processManager.getProcessesByStatus('running');
      expect(runningProcesses).toHaveLength(1);
      expect(runningProcesses[0].id).toBe(processId);

      const stoppedProcesses = processManager.getProcessesByStatus('stopped');
      expect(stoppedProcesses).toHaveLength(0);
    });
  });

  describe('isProcessRunning', () => {
    it('should return true for running process', async () => {
      const config: ProcessConfig = { command: 'echo', args: ['hello'] };
      const processId = await processManager.spawn(config);
      
      mockChildProcess.emit('spawn');
      
      const isRunning = processManager.isProcessRunning(processId);
      expect(isRunning).toBe(true);
    });

    it('should return false for non-existent process', () => {
      const isRunning = processManager.isProcessRunning('non-existent');
      expect(isRunning).toBe(false);
    });
  });

  describe('getProcessStdin', () => {
    it('should return stdin stream for existing process', async () => {
      const config: ProcessConfig = { command: 'cat' };
      const processId = await processManager.spawn(config);
      
      const stdin = processManager.getProcessStdin(processId);
      expect(stdin).toBe(mockChildProcess.stdin);
    });

    it('should return null for non-existent process', () => {
      const stdin = processManager.getProcessStdin('non-existent');
      expect(stdin).toBeNull();
    });
  });

  describe('timeout handling', () => {
    it('should handle process timeout', async () => {
      const config: ProcessConfig = {
        command: 'sleep',
        args: ['10'],
        timeout: 100, // 100ms timeout
      };

      const timeoutPromise = new Promise((resolve) => {
        processManager.once('process-timeout', resolve);
      });

      const processId = await processManager.spawn(config);
      mockChildProcess.emit('spawn');

      // Wait for timeout event
      const timeoutEvent = await timeoutPromise;
      expect(timeoutEvent).toBeDefined();
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('stdout/stderr handling', () => {
    it('should emit stdout-data events', async () => {
      const config: ProcessConfig = { command: 'echo', args: ['hello'] };
      const processId = await processManager.spawn(config);

      const dataPromise = new Promise((resolve) => {
        processManager.once('stdout-data', (pid, data) => {
          resolve({ pid, data });
        });
      });

      mockChildProcess.emit('spawn');
      mockChildProcess.stdout.emit('data', Buffer.from('hello\n'));

      const { pid, data } = await dataPromise as any;
      expect(pid).toBe(processId);
      expect(data.toString()).toBe('hello\n');
    });

    it('should emit stderr-data events', async () => {
      const config: ProcessConfig = { command: 'echo', args: ['hello'] };
      const processId = await processManager.spawn(config);

      const dataPromise = new Promise((resolve) => {
        processManager.once('stderr-data', (pid, data) => {
          resolve({ pid, data });
        });
      });

      mockChildProcess.emit('spawn');
      mockChildProcess.stderr.emit('data', Buffer.from('error\n'));

      const { pid, data } = await dataPromise as any;
      expect(pid).toBe(processId);
      expect(data.toString()).toBe('error\n');
    });
  });

  describe('process exit handling', () => {
    it('should handle normal process exit', async () => {
      const config: ProcessConfig = { command: 'echo', args: ['hello'] };
      const processId = await processManager.spawn(config);

      const exitPromise = new Promise((resolve) => {
        processManager.once('process-stopped', resolve);
      });

      mockChildProcess.emit('spawn');
      mockChildProcess.emit('exit', 0, null);

      const processInfo = await exitPromise;
      expect((processInfo as any).exitCode).toBe(0);
      expect((processInfo as any).status).toBe('stopped');
    });

    it('should handle process killed by signal', async () => {
      const config: ProcessConfig = { command: 'echo', args: ['hello'] };
      const processId = await processManager.spawn(config);

      const exitPromise = new Promise((resolve) => {
        processManager.once('process-stopped', resolve);
      });

      mockChildProcess.emit('spawn');
      mockChildProcess.emit('exit', null, 'SIGTERM');

      const processInfo = await exitPromise;
      expect((processInfo as any).signal).toBe('SIGTERM');
      expect((processInfo as any).status).toBe('stopped');
    });
  });

  describe('getStats', () => {
    it('should return process statistics', async () => {
      const config1: ProcessConfig = { command: 'echo', args: ['1'] };
      const config2: ProcessConfig = { command: 'echo', args: ['2'] };

      const processId1 = await processManager.spawn(config1);
      const processId2 = await processManager.spawn(config2);

      mockChildProcess.emit('spawn');

      const stats = processManager.getStats();
      expect(stats.total).toBe(2);
      expect(stats.running).toBe(2);
      expect(stats.stopped).toBe(0);
      expect(stats.error).toBe(0);
      expect(stats.timeout).toBe(0);
    });
  });

  describe('terminateAll', () => {
    it('should terminate all processes', async () => {
      const config1: ProcessConfig = { command: 'echo', args: ['1'] };
      const config2: ProcessConfig = { command: 'echo', args: ['2'] };

      await processManager.spawn(config1);
      await processManager.spawn(config2);

      await processManager.terminateAll();

      // Should have called kill on both processes
      expect(mockChildProcess.kill).toHaveBeenCalledTimes(2);
    });
  });

  describe('shutdown', () => {
    it('should gracefully shutdown all processes', async () => {
      const config: ProcessConfig = { command: 'echo', args: ['hello'] };
      await processManager.spawn(config);

      await processManager.shutdown();

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });
});