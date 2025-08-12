import { EventEmitter } from 'events';
import ProcessManager, { ProcessInfo } from './process-manager';
import StreamHandler, { ParsedOutput } from './stream-handler';
import SessionStateManager from './session-state';
import InputHandler from './input-handler';
import { CLIProcessConfig, CLIProcessInfo, ParsedCLIOutput } from '../types/websocket';

export interface CLIIntegrationEvents {
  'process-started': (processId: string, processInfo: CLIProcessInfo) => void;
  'process-stopped': (processId: string, processInfo: CLIProcessInfo) => void;
  'process-error': (processId: string, processInfo: CLIProcessInfo, error: string) => void;
  'process-timeout': (processId: string, processInfo: CLIProcessInfo) => void;
  'stdout-data': (processId: string, content: string, timestamp: string, parsed?: any) => void;
  'stderr-data': (processId: string, content: string, timestamp: string, parsed?: any) => void;
  'parsed-output': (processId: string, output: ParsedCLIOutput) => void;
}

declare interface CLIIntegration {
  on<U extends keyof CLIIntegrationEvents>(
    event: U, listener: CLIIntegrationEvents[U]
  ): this;
  
  emit<U extends keyof CLIIntegrationEvents>(
    event: U, ...args: Parameters<CLIIntegrationEvents[U]>
  ): boolean;
}

/**
 * CLIIntegration orchestrates ProcessManager, StreamHandler, and SessionStateManager
 * to provide a unified interface for Claude Code CLI integration.
 */
class CLIIntegration extends EventEmitter {
  private processManager: ProcessManager;
  private streamHandler: StreamHandler;
  private sessionManager: SessionStateManager;
  private inputHandler: InputHandler;

  constructor() {
    super();
    
    this.processManager = new ProcessManager();
    this.streamHandler = new StreamHandler();
    this.sessionManager = new SessionStateManager(this.processManager);
    this.inputHandler = new InputHandler();

    this.setupEventHandlers();
  }

  /**
   * Spawns a new Claude Code CLI process
   */
  async spawnProcess(config: CLIProcessConfig, sessionId?: string): Promise<string> {
    try {
      // Create session if not provided
      if (!sessionId) {
        sessionId = await this.sessionManager.createSession({
          workingDirectory: config.cwd,
          environment: config.env,
        });
      }

      // Spawn the process
      const processId = await this.processManager.spawn({
        command: config.command,
        args: config.args,
        cwd: config.cwd,
        env: config.env,
        timeout: config.timeout,
      });

      // Associate process with session
      await this.sessionManager.associateProcess(sessionId, processId);

      // Set up stream handlers for this process
      this.streamHandler.createStreamHandlers(processId);

      // Register input handler with process stdin
      const stdin = this.processManager.getProcessStdin(processId);
      this.inputHandler.registerProcess(processId, stdin);

      // Add command to history
      const commandStr = [config.command, ...(config.args || [])].join(' ');
      await this.sessionManager.addCommandToHistory(sessionId, commandStr);

      return processId;

    } catch (error) {
      throw new Error(`Failed to spawn CLI process: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Terminates a CLI process
   */
  async terminateProcess(processId: string, signal?: NodeJS.Signals): Promise<boolean> {
    try {
      // Find associated session
      const sessionId = this.sessionManager.getSessionByProcess(processId);
      
      const success = await this.processManager.terminate(processId, signal);
      
      if (success && sessionId) {
        // Suspend the session
        await this.sessionManager.suspendSession(sessionId);
      }

      return success;
    } catch (error) {
      console.error(`Error terminating process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Sends input to a CLI process
   */
  async sendInput(processId: string, data: string, options?: {
    priority?: number;
    skipQueue?: boolean;
  }): Promise<boolean> {
    try {
      // Use InputHandler for queued input handling
      const inputId = await this.inputHandler.queueInput(processId, data, options);
      
      // Add input to session history
      const sessionId = this.sessionManager.getSessionByProcess(processId);
      if (sessionId) {
        await this.sessionManager.addCommandToHistory(sessionId, `INPUT: ${data.trim()}`);
      }

      return true;
    } catch (error) {
      console.error(`Error sending input to process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Sends a special key sequence to a CLI process
   */
  async sendSpecialSequence(processId: string, sequence: 'CTRL_C' | 'CTRL_D' | 'ENTER' | 'TAB'): Promise<boolean> {
    try {
      await this.inputHandler.sendSpecialSequence(processId, sequence);
      
      // Add to session history
      const sessionId = this.sessionManager.getSessionByProcess(processId);
      if (sessionId) {
        await this.sessionManager.addCommandToHistory(sessionId, `SPECIAL: ${sequence}`);
      }

      return true;
    } catch (error) {
      console.error(`Error sending special sequence to process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Checks if a process is in interactive mode
   */
  isInteractiveMode(processId: string): boolean {
    return this.inputHandler.isInteractiveMode(processId);
  }

  /**
   * Gets the input queue for a process
   */
  getInputQueue(processId: string) {
    return this.inputHandler.getInputQueue(processId);
  }

  /**
   * Clears the input queue for a process
   */
  clearInputQueue(processId: string): number {
    return this.inputHandler.clearInputQueue(processId);
  }

  /**
   * Gets information about a specific process
   */
  getProcessInfo(processId: string): CLIProcessInfo | null {
    const processInfo = this.processManager.getProcessInfo(processId);
    if (!processInfo) {
      return null;
    }

    return this.convertProcessInfo(processInfo);
  }

  /**
   * Gets all active processes
   */
  getAllProcesses(): CLIProcessInfo[] {
    const processes = this.processManager.getAllProcesses();
    return processes.map(p => this.convertProcessInfo(p));
  }

  /**
   * Gets processes by status
   */
  getProcessesByStatus(status: ProcessInfo['status']): CLIProcessInfo[] {
    const processes = this.processManager.getProcessesByStatus(status);
    return processes.map(p => this.convertProcessInfo(p));
  }

  /**
   * Checks if a process is running
   */
  isProcessRunning(processId: string): boolean {
    return this.processManager.isProcessRunning(processId);
  }

  /**
   * Gets the session associated with a process
   */
  getProcessSession(processId: string): string | undefined {
    return this.sessionManager.getSessionByProcess(processId);
  }

  /**
   * Gets statistics about processes and sessions
   */
  getStats() {
    const processStats = this.processManager.getStats();
    const sessionStats = this.sessionManager.getStats();

    return {
      processes: processStats,
      sessions: sessionStats,
      integration: {
        totalManagedProcesses: processStats.total,
        activeIntegrations: processStats.running,
      },
    };
  }

  /**
   * Performs cleanup of expired sessions and orphaned processes
   */
  async cleanup(): Promise<{
    expiredSessions: number;
    orphanedProcesses: number;
  }> {
    return await this.sessionManager.cleanupExpiredSessions();
  }

  /**
   * Recovers sessions after restart
   */
  async recoverSessions(): Promise<{
    recovered: number;
    failed: number;
  }> {
    return await this.sessionManager.recoverSessions();
  }

  /**
   * Sets up event handlers between components
   */
  private setupEventHandlers(): void {
    // Process Manager events
    this.processManager.on('process-started', (processInfo) => {
      const cliProcessInfo = this.convertProcessInfo(processInfo);
      this.emit('process-started', processInfo.id, cliProcessInfo);
    });

    this.processManager.on('process-stopped', (processInfo) => {
      const cliProcessInfo = this.convertProcessInfo(processInfo);
      this.streamHandler.flushBuffer(processInfo.id);
      this.streamHandler.clearBuffer(processInfo.id);
      this.inputHandler.unregisterProcess(processInfo.id);
      this.emit('process-stopped', processInfo.id, cliProcessInfo);
    });

    this.processManager.on('process-error', (processInfo, error) => {
      const cliProcessInfo = this.convertProcessInfo(processInfo);
      this.streamHandler.clearBuffer(processInfo.id);
      this.inputHandler.unregisterProcess(processInfo.id);
      this.emit('process-error', processInfo.id, cliProcessInfo, error.message);
    });

    this.processManager.on('process-timeout', (processInfo) => {
      const cliProcessInfo = this.convertProcessInfo(processInfo);
      this.streamHandler.clearBuffer(processInfo.id);
      this.inputHandler.unregisterProcess(processInfo.id);
      this.emit('process-timeout', processInfo.id, cliProcessInfo);
    });

    this.processManager.on('stdout-data', (processId, data) => {
      // Raw data is handled by StreamHandler, but we can emit for debugging
      const content = data.toString('utf8');
      const timestamp = new Date().toISOString();
      this.emit('stdout-data', processId, content, timestamp);
    });

    this.processManager.on('stderr-data', (processId, data) => {
      // Raw data is handled by StreamHandler, but we can emit for debugging
      const content = data.toString('utf8');
      const timestamp = new Date().toISOString();
      this.emit('stderr-data', processId, content, timestamp);
    });

    // Stream Handler events
    this.streamHandler.on('parsed-output', (processId, output) => {
      const cliOutput = this.convertParsedOutput(output);
      
      // Check for interactive mode in the output
      if (output.type === 'stdout') {
        this.inputHandler.detectInteractiveMode(processId, output.content);
      }
      
      this.emit('parsed-output', processId, cliOutput);
    });

    this.streamHandler.on('json-detected', (processId, data) => {
      // Could emit special events for JSON data if needed
      console.log(`JSON detected from process ${processId}:`, data);
    });

    this.streamHandler.on('tool-use-detected', (processId, toolData) => {
      // Could emit special events for tool use if needed
      console.log(`Tool use detected from process ${processId}:`, toolData);
    });

    // Session Manager events
    this.sessionManager.on('orphaned-process-cleaned', (processId) => {
      console.log(`Cleaned up orphaned process: ${processId}`);
    });
  }

  /**
   * Converts internal ProcessInfo to CLI ProcessInfo format
   */
  private convertProcessInfo(processInfo: ProcessInfo): CLIProcessInfo {
    return {
      id: processInfo.id,
      pid: processInfo.pid,
      command: processInfo.command,
      args: processInfo.args,
      status: processInfo.status,
      startedAt: processInfo.startedAt.toISOString(),
      stoppedAt: processInfo.stoppedAt?.toISOString(),
      exitCode: processInfo.exitCode,
      signal: processInfo.signal,
      error: processInfo.error,
    };
  }

  /**
   * Converts internal ParsedOutput to CLI ParsedOutput format
   */
  private convertParsedOutput(parsedOutput: ParsedOutput): ParsedCLIOutput {
    return {
      type: parsedOutput.type,
      content: parsedOutput.content,
      timestamp: parsedOutput.timestamp.toISOString(),
      parsed: parsedOutput.parsed,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('CLIIntegration shutting down...');
    
    await Promise.all([
      this.processManager.shutdown(),
      this.sessionManager.shutdown(),
      this.inputHandler.shutdown(),
    ]);
    
    console.log('CLIIntegration shutdown complete');
  }
}

export default CLIIntegration;