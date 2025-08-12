import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import WebSocketService from './websocket';
import { CLIProcessConfig, CLIProcessInfo } from '../types/websocket';

// Mock CLI integration
vi.mock('./cli-integration');

describe('WebSocket CLI Events', () => {
  let httpServer: HttpServer;
  let webSocketService: WebSocketService;
  let clientSocket: ClientSocket;
  let serverPort: number;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
  });

  beforeEach((context) => {
    return new Promise<void>((resolve) => {
      // Create HTTP server
      httpServer = createServer();
      
      // Initialize WebSocket service
      webSocketService = new WebSocketService(httpServer);
      
      // Start server on random port
      httpServer.listen(() => {
        serverPort = (httpServer.address() as AddressInfo).port;
        
        // Create client connection
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          transports: ['websocket'],
          forceNew: true,
        });
        
        clientSocket.on('connect', () => {
          resolve();
        });
      });
    });
  }, 10000);

  afterEach(async () => {
    // Comprehensive cleanup
    const cleanup = async () => {
      if (clientSocket?.connected) {
        clientSocket.disconnect();
        clientSocket.close();
      }

      if (webSocketService) {
        await webSocketService.close();
      }

      if (httpServer?.listening) {
        await new Promise<void>((resolve) => {
          httpServer.close(() => resolve());
        });
      }
    };

    await Promise.race([
      cleanup(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 5000))
    ]);
  });

  describe('CLI authentication', () => {
    it('should require authentication for CLI operations', (done) => {
      const config: CLIProcessConfig = {
        command: 'claude',
        args: ['--help'],
      };

      clientSocket.emit('cli-spawn', config, (response) => {
        expect(response.success).toBe(false);
        expect(response.error).toBe('Authentication required');
        done();
      });
    });
  });

  describe('authenticated CLI operations', () => {
    beforeEach((context) => {
      return new Promise<void>((resolve) => {
        // Authenticate the client first
        clientSocket.emit('authenticate', {
          userId: 'test-user',
          sessionId: 'test-session',
        });

        clientSocket.once('authenticated', (data) => {
          expect(data.success).toBe(true);
          resolve();
        });
      });
    });

    describe('cli-spawn', () => {
      it('should spawn a new CLI process', (done) => {
        const config: CLIProcessConfig = {
          command: 'claude',
          args: ['--help'],
          cwd: '/tmp',
          env: { TEST: 'value' },
          timeout: 30000,
        };

        // Mock the CLI integration
        const mockCLIIntegration = (webSocketService as any).cliIntegration;
        mockCLIIntegration.spawnProcess = vi.fn().mockResolvedValue('process-123');

        clientSocket.emit('cli-spawn', config, (response) => {
          expect(response.success).toBe(true);
          expect(response.processId).toBe('process-123');
          expect(mockCLIIntegration.spawnProcess).toHaveBeenCalledWith(config);
          done();
        });
      });

      it('should handle spawn errors', (done) => {
        const config: CLIProcessConfig = {
          command: 'invalid-command',
        };

        const mockCLIIntegration = (webSocketService as any).cliIntegration;
        mockCLIIntegration.spawnProcess = vi.fn().mockRejectedValue(new Error('Command not found'));

        clientSocket.emit('cli-spawn', config, (response) => {
          expect(response.success).toBe(false);
          expect(response.error).toBe('Command not found');
          done();
        });
      });

      it('should respect rate limits', (done) => {
        const config: CLIProcessConfig = {
          command: 'claude',
        };

        // Mock rate limit exceeded
        const mockConnectionManager = (webSocketService as any).connectionManager;
        mockConnectionManager.checkRateLimit = vi.fn().mockReturnValue(false);

        clientSocket.emit('cli-spawn', config, (response) => {
          expect(response.success).toBe(false);
          expect(response.error).toBe('Rate limit exceeded');
          done();
        });
      });
    });

    describe('cli-terminate', () => {
      it('should terminate a CLI process', (done) => {
        const processId = 'process-123';

        const mockCLIIntegration = (webSocketService as any).cliIntegration;
        mockCLIIntegration.terminateProcess = vi.fn().mockResolvedValue(true);

        clientSocket.emit('cli-terminate', processId, (response) => {
          expect(response.success).toBe(true);
          expect(mockCLIIntegration.terminateProcess).toHaveBeenCalledWith(processId);
          done();
        });
      });

      it('should handle termination failure', (done) => {
        const processId = 'process-123';

        const mockCLIIntegration = (webSocketService as any).cliIntegration;
        mockCLIIntegration.terminateProcess = vi.fn().mockResolvedValue(false);

        clientSocket.emit('cli-terminate', processId, (response) => {
          expect(response.success).toBe(false);
          expect(response.error).toBe('Failed to terminate process');
          done();
        });
      });
    });

    describe('cli-input', () => {
      it('should send input to CLI process', (done) => {
        const processId = 'process-123';
        const inputData = 'test command';

        const mockCLIIntegration = (webSocketService as any).cliIntegration;
        mockCLIIntegration.sendInput = vi.fn().mockResolvedValue(true);

        // Listen for successful input processing
        setTimeout(() => {
          expect(mockCLIIntegration.sendInput).toHaveBeenCalledWith(processId, inputData);
          done();
        }, 10);

        clientSocket.emit('cli-input', processId, inputData);
      });

      it('should handle input errors', (done) => {
        const processId = 'process-123';
        const inputData = 'test command';

        const mockCLIIntegration = (webSocketService as any).cliIntegration;
        mockCLIIntegration.sendInput = vi.fn().mockRejectedValue(new Error('Input failed'));

        clientSocket.once('error-message', (error) => {
          expect(error.code).toBe('CLI_INPUT_ERROR');
          expect(error.message).toBe('Input failed');
          done();
        });

        clientSocket.emit('cli-input', processId, inputData);
      });

      it('should respect rate limits for input', (done) => {
        const processId = 'process-123';
        const inputData = 'test command';

        const mockConnectionManager = (webSocketService as any).connectionManager;
        mockConnectionManager.checkRateLimit = vi.fn().mockReturnValue(false);

        clientSocket.once('error-message', (error) => {
          expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
          expect(error.message).toContain('CLI inputs');
          done();
        });

        clientSocket.emit('cli-input', processId, inputData);
      });
    });

    describe('cli-get-processes', () => {
      it('should return list of processes', (done) => {
        const mockProcesses: CLIProcessInfo[] = [
          {
            id: 'process-123',
            pid: 456,
            command: 'claude',
            args: ['--help'],
            status: 'running',
            startedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'process-456',
            command: 'echo',
            args: ['hello'],
            status: 'stopped',
            startedAt: '2024-01-01T00:01:00.000Z',
            stoppedAt: '2024-01-01T00:01:01.000Z',
            exitCode: 0,
          },
        ];

        const mockCLIIntegration = (webSocketService as any).cliIntegration;
        mockCLIIntegration.getAllProcesses = vi.fn().mockReturnValue(mockProcesses);

        clientSocket.emit('cli-get-processes', (processes) => {
          expect(processes).toEqual(mockProcesses);
          expect(mockCLIIntegration.getAllProcesses).toHaveBeenCalled();
          done();
        });
      });

      it('should return empty array on error', (done) => {
        const mockCLIIntegration = (webSocketService as any).cliIntegration;
        mockCLIIntegration.getAllProcesses = vi.fn().mockImplementation(() => {
          throw new Error('Failed to get processes');
        });

        clientSocket.emit('cli-get-processes', (processes) => {
          expect(processes).toEqual([]);
          done();
        });
      });
    });

    describe('cli-get-process', () => {
      it('should return specific process info', (done) => {
        const processId = 'process-123';
        const mockProcess: CLIProcessInfo = {
          id: 'process-123',
          pid: 456,
          command: 'claude',
          args: ['--help'],
          status: 'running',
          startedAt: '2024-01-01T00:00:00.000Z',
        };

        const mockCLIIntegration = (webSocketService as any).cliIntegration;
        mockCLIIntegration.getProcessInfo = vi.fn().mockReturnValue(mockProcess);

        clientSocket.emit('cli-get-process', processId, (process) => {
          expect(process).toEqual(mockProcess);
          expect(mockCLIIntegration.getProcessInfo).toHaveBeenCalledWith(processId);
          done();
        });
      });

      it('should return null for non-existent process', (done) => {
        const processId = 'non-existent';

        const mockCLIIntegration = (webSocketService as any).cliIntegration;
        mockCLIIntegration.getProcessInfo = vi.fn().mockReturnValue(null);

        clientSocket.emit('cli-get-process', processId, (process) => {
          expect(process).toBeNull();
          done();
        });
      });
    });
  });

  describe('CLI event broadcasting', () => {
    it('should broadcast process-started events', (done) => {
      const processId = 'process-123';
      const processInfo: CLIProcessInfo = {
        id: 'process-123',
        command: 'claude',
        args: [],
        status: 'running',
        startedAt: '2024-01-01T00:00:00.000Z',
      };

      clientSocket.once('cli-process-started', (data) => {
        expect(data.processId).toBe(processId);
        expect(data.processInfo).toEqual(processInfo);
        done();
      });

      // Simulate CLI integration event
      const mockCLIIntegration = (webSocketService as any).cliIntegration;
      mockCLIIntegration.emit('process-started', processId, processInfo);
    });

    it('should broadcast process-stopped events', (done) => {
      const processId = 'process-123';
      const processInfo: CLIProcessInfo = {
        id: 'process-123',
        command: 'claude',
        args: [],
        status: 'stopped',
        startedAt: '2024-01-01T00:00:00.000Z',
        stoppedAt: '2024-01-01T00:01:00.000Z',
        exitCode: 0,
      };

      clientSocket.once('cli-process-stopped', (data) => {
        expect(data.processId).toBe(processId);
        expect(data.processInfo).toEqual(processInfo);
        done();
      });

      const mockCLIIntegration = (webSocketService as any).cliIntegration;
      mockCLIIntegration.emit('process-stopped', processId, processInfo);
    });

    it('should broadcast process-error events', (done) => {
      const processId = 'process-123';
      const processInfo: CLIProcessInfo = {
        id: 'process-123',
        command: 'invalid-command',
        args: [],
        status: 'error',
        startedAt: '2024-01-01T00:00:00.000Z',
        stoppedAt: '2024-01-01T00:00:01.000Z',
        error: 'Command not found',
      };
      const error = 'Command not found';

      clientSocket.once('cli-process-error', (data) => {
        expect(data.processId).toBe(processId);
        expect(data.processInfo).toEqual(processInfo);
        expect(data.error).toBe(error);
        done();
      });

      const mockCLIIntegration = (webSocketService as any).cliIntegration;
      mockCLIIntegration.emit('process-error', processId, processInfo, error);
    });

    it('should broadcast stdout-data events', (done) => {
      const processId = 'process-123';
      const content = 'Hello, World!';
      const timestamp = '2024-01-01T00:00:00.000Z';
      const parsed = { isJson: false, hasAnsiCodes: false };

      clientSocket.once('cli-stdout-data', (data) => {
        expect(data.processId).toBe(processId);
        expect(data.content).toBe(content);
        expect(data.timestamp).toBe(timestamp);
        expect(data.parsed).toEqual(parsed);
        done();
      });

      const mockCLIIntegration = (webSocketService as any).cliIntegration;
      mockCLIIntegration.emit('stdout-data', processId, content, timestamp, parsed);
    });

    it('should broadcast stderr-data events', (done) => {
      const processId = 'process-123';
      const content = 'Error message';
      const timestamp = '2024-01-01T00:00:00.000Z';

      clientSocket.once('cli-stderr-data', (data) => {
        expect(data.processId).toBe(processId);
        expect(data.content).toBe(content);
        expect(data.timestamp).toBe(timestamp);
        done();
      });

      const mockCLIIntegration = (webSocketService as any).cliIntegration;
      mockCLIIntegration.emit('stderr-data', processId, content, timestamp);
    });

    it('should broadcast parsed-output events', (done) => {
      const processId = 'process-123';
      const output = {
        type: 'stdout' as const,
        content: '{"message": "hello"}',
        timestamp: '2024-01-01T00:00:00.000Z',
        parsed: {
          isJson: true,
          data: { message: 'hello' },
        },
      };

      clientSocket.once('cli-parsed-output', (data) => {
        expect(data.processId).toBe(processId);
        expect(data.output).toEqual(output);
        done();
      });

      const mockCLIIntegration = (webSocketService as any).cliIntegration;
      mockCLIIntegration.emit('parsed-output', processId, output);
    });
  });

  describe('CLI management methods', () => {
    it('should provide CLI stats', () => {
      const mockStats = {
        processes: { total: 3, running: 2, stopped: 1 },
        sessions: { total: 2, active: 1, suspended: 1 },
        integration: { totalManagedProcesses: 3, activeIntegrations: 2 },
      };

      const mockCLIIntegration = (webSocketService as any).cliIntegration;
      mockCLIIntegration.getStats = vi.fn().mockReturnValue(mockStats);

      const stats = webSocketService.getCLIStats();

      expect(stats).toEqual(mockStats);
      expect(mockCLIIntegration.getStats).toHaveBeenCalled();
    });

    it('should cleanup CLI resources', async () => {
      const mockResult = { expiredSessions: 2, orphanedProcesses: 1 };

      const mockCLIIntegration = (webSocketService as any).cliIntegration;
      mockCLIIntegration.cleanup = vi.fn().mockResolvedValue(mockResult);

      const result = await webSocketService.cleanupCLI();

      expect(result).toEqual(mockResult);
      expect(mockCLIIntegration.cleanup).toHaveBeenCalled();
    });

    it('should recover CLI sessions', async () => {
      const mockResult = { recovered: 3, failed: 1 };

      const mockCLIIntegration = (webSocketService as any).cliIntegration;
      mockCLIIntegration.recoverSessions = vi.fn().mockResolvedValue(mockResult);

      const result = await webSocketService.recoverCLISessions();

      expect(result).toEqual(mockResult);
      expect(mockCLIIntegration.recoverSessions).toHaveBeenCalled();
    });
  });

  describe('shutdown behavior', () => {
    it('should shutdown CLI integration during close', async () => {
      const mockCLIIntegration = (webSocketService as any).cliIntegration;
      mockCLIIntegration.shutdown = vi.fn().mockResolvedValue(undefined);

      await webSocketService.close();

      expect(mockCLIIntegration.shutdown).toHaveBeenCalled();
    });
  });
});