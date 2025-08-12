import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import config from '../config/env';

export interface ProcessConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
}

export interface ProcessInfo {
  id: string;
  pid?: number;
  command: string;
  args: string[];
  status: 'starting' | 'running' | 'stopped' | 'error' | 'timeout';
  startedAt: Date;
  stoppedAt?: Date;
  exitCode?: number;
  signal?: string;
  error?: string;
}

export interface ProcessManagerEvents {
  'process-started': (processInfo: ProcessInfo) => void;
  'process-stopped': (processInfo: ProcessInfo) => void;
  'process-error': (processInfo: ProcessInfo, error: Error) => void;
  'process-timeout': (processInfo: ProcessInfo) => void;
  'stdout-data': (processId: string, data: Buffer) => void;
  'stderr-data': (processId: string, data: Buffer) => void;
}

declare interface ProcessManager {
  on<U extends keyof ProcessManagerEvents>(
    event: U, listener: ProcessManagerEvents[U]
  ): this;
  
  emit<U extends keyof ProcessManagerEvents>(
    event: U, ...args: Parameters<ProcessManagerEvents[U]>
  ): boolean;
}

/**
 * ProcessManager handles spawning and managing Claude Code CLI child processes
 * with proper lifecycle management, environment configuration, and event handling.
 */
class ProcessManager extends EventEmitter {
  private processes = new Map<string, {
    childProcess: ChildProcess;
    info: ProcessInfo;
    timeoutHandle?: NodeJS.Timeout;
  }>();

  constructor() {
    super();
  }

  /**
   * Spawns a new Claude Code CLI process
   */
  async spawn(processConfig: ProcessConfig): Promise<string> {
    const processId = randomUUID();
    const { command, args = [], cwd, env, timeout } = processConfig;

    // Merge environment variables, prioritizing provided env
    const processEnv = {
      ...process.env,
      ...env,
      // Ensure NODE_CHANNEL_FD is not passed to child processes
      NODE_CHANNEL_FD: undefined,
    };

    const spawnOptions: SpawnOptions = {
      cwd: cwd || process.cwd(),
      env: processEnv,
      stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
      shell: false, // Direct execution for security
    };

    const processInfo: ProcessInfo = {
      id: processId,
      command,
      args,
      status: 'starting',
      startedAt: new Date(),
    };

    try {
      const childProcess = spawn(command, args, spawnOptions);
      
      // Handle spawn errors (e.g., command not found)
      childProcess.on('error', (error: Error) => {
        processInfo.status = 'error';
        processInfo.error = error.message;
        processInfo.stoppedAt = new Date();
        
        this.cleanupProcess(processId);
        this.emit('process-error', processInfo, error);
      });

      // Handle process start
      childProcess.on('spawn', () => {
        processInfo.pid = childProcess.pid;
        processInfo.status = 'running';
        this.emit('process-started', processInfo);
      });

      // Handle process exit
      childProcess.on('exit', (code: number | null, signal: string | null) => {
        processInfo.status = 'stopped';
        processInfo.exitCode = code ?? undefined;
        processInfo.signal = signal ?? undefined;
        processInfo.stoppedAt = new Date();

        this.cleanupProcess(processId);
        this.emit('process-stopped', processInfo);
      });

      // Handle stdout data
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data: Buffer) => {
          this.emit('stdout-data', processId, data);
        });
      }

      // Handle stderr data
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data: Buffer) => {
          this.emit('stderr-data', processId, data);
        });
      }

      // Set up timeout if specified
      let timeoutHandle: NodeJS.Timeout | undefined;
      if (timeout && timeout > 0) {
        timeoutHandle = setTimeout(() => {
          processInfo.status = 'timeout';
          processInfo.stoppedAt = new Date();
          
          // Attempt graceful shutdown first
          childProcess.kill('SIGTERM');
          
          // Force kill after 5 seconds if still running
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 5000);

          this.emit('process-timeout', processInfo);
        }, timeout);
      }

      // Store process information
      this.processes.set(processId, {
        childProcess,
        info: processInfo,
        timeoutHandle,
      });

      return processId;

    } catch (error) {
      processInfo.status = 'error';
      processInfo.error = error instanceof Error ? error.message : String(error);
      processInfo.stoppedAt = new Date();
      
      this.emit('process-error', processInfo, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Terminates a process by ID
   */
  async terminate(processId: string, signal: NodeJS.Signals = 'SIGTERM'): Promise<boolean> {
    const processEntry = this.processes.get(processId);
    if (!processEntry) {
      return false;
    }

    const { childProcess, timeoutHandle } = processEntry;

    // Clear timeout if exists
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    try {
      const killed = childProcess.kill(signal);
      
      // If graceful termination fails, force kill after delay
      if (killed && signal !== 'SIGKILL') {
        setTimeout(() => {
          if (!childProcess.killed && this.processes.has(processId)) {
            childProcess.kill('SIGKILL');
          }
        }, 5000);
      }

      return killed;
    } catch (error) {
      console.error(`Error terminating process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Writes data to a process's stdin
   */
  async writeToProcess(processId: string, data: string | Buffer): Promise<boolean> {
    const processEntry = this.processes.get(processId);
    if (!processEntry || !processEntry.childProcess.stdin) {
      return false;
    }

    try {
      return processEntry.childProcess.stdin.write(data);
    } catch (error) {
      console.error(`Error writing to process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Gets process information by ID
   */
  getProcessInfo(processId: string): ProcessInfo | undefined {
    const processEntry = this.processes.get(processId);
    return processEntry ? { ...processEntry.info } : undefined;
  }

  /**
   * Gets all active processes
   */
  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values()).map(entry => ({ ...entry.info }));
  }

  /**
   * Gets processes by status
   */
  getProcessesByStatus(status: ProcessInfo['status']): ProcessInfo[] {
    return this.getAllProcesses().filter(info => info.status === status);
  }

  /**
   * Checks if a process exists and is running
   */
  isProcessRunning(processId: string): boolean {
    const processEntry = this.processes.get(processId);
    return processEntry?.info.status === 'running' && !processEntry.childProcess.killed;
  }

  /**
   * Gets the stdin stream for a process
   */
  getProcessStdin(processId: string): NodeJS.WritableStream | null {
    const processEntry = this.processes.get(processId);
    return processEntry?.childProcess.stdin || null;
  }

  /**
   * Terminates all running processes
   */
  async terminateAll(signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    const terminationPromises = Array.from(this.processes.keys()).map(id => 
      this.terminate(id, signal)
    );
    
    await Promise.allSettled(terminationPromises);
  }

  /**
   * Gets process statistics
   */
  getStats() {
    const all = this.getAllProcesses();
    return {
      total: all.length,
      running: all.filter(p => p.status === 'running').length,
      stopped: all.filter(p => p.status === 'stopped').length,
      error: all.filter(p => p.status === 'error').length,
      timeout: all.filter(p => p.status === 'timeout').length,
    };
  }

  /**
   * Cleans up process resources
   */
  private cleanupProcess(processId: string): void {
    const processEntry = this.processes.get(processId);
    if (processEntry) {
      // Clear timeout if exists
      if (processEntry.timeoutHandle) {
        clearTimeout(processEntry.timeoutHandle);
      }
      
      // Remove from active processes
      this.processes.delete(processId);
    }
  }

  /**
   * Graceful shutdown - terminates all processes and cleans up resources
   */
  async shutdown(): Promise<void> {
    console.log('ProcessManager shutting down...');
    
    // Terminate all processes
    await this.terminateAll('SIGTERM');
    
    // Wait a moment for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Force kill any remaining processes
    await this.terminateAll('SIGKILL');
    
    // Clear all processes
    this.processes.clear();
    
    console.log('ProcessManager shutdown complete');
  }
}

export default ProcessManager;