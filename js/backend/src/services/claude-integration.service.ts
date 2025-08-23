import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import {
  ClaudeCommand,
  ClaudeCommandSchema,
  ClaudeProcessState,
  ClaudeProcessStatus,
  ClaudeOutput,
  ClaudeProcessEvent,
  ClaudeIntegrationConfig,
  ClaudeIntegrationError,
  SessionContinuationRequest,
  SessionContinuationResponse,
  SessionContinuationWithContextRequest,
  ContextPreparationRequest,
  ContextPreparationResult,
  ALLOWED_CLAUDE_COMMANDS,
} from '../../../shared/src/schemas/claude-integration.js';
import { ISession } from '../../../shared/src/schemas/session.js';
import { SessionContextService } from './session-context.service.js';

/**
 * Claude Code Integration Service
 * 
 * Manages Claude Code CLI processes for session continuation and interactive development.
 * Uses Node.js child_process.spawn() for process management with TypeScript type safety.
 * 
 * Features:
 * - Process lifecycle management (start, monitor, stop, cleanup)
 * - Real-time output streaming
 * - Session continuation from JSONL files
 * - Resource management and cleanup
 * - Error handling and process recovery
 */
export class ClaudeIntegrationService extends EventEmitter {
  private processes = new Map<string, ChildProcess>();
  private processStatus = new Map<string, ClaudeProcessStatus>();
  private config: ClaudeIntegrationConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private contextService: SessionContextService;
  
  // Security constants
  private static readonly KILL_TIMEOUT_MS = 5000;
  private static readonly MAX_INPUT_LENGTH = 10000;
  private static readonly DANGEROUS_CHARS_REGEX = /[;&|`$()><]/g;

  constructor(config?: Partial<ClaudeIntegrationConfig>) {
    super();
    
    // Increase max listeners to prevent memory leak warnings
    this.setMaxListeners(20);
    
    // Default configuration with overrides
    this.config = {
      claudeExecutablePath: 'claude',
      maxProcesses: 5,
      processTimeout: 300000, // 5 minutes
      outputBufferSize: 1024 * 1024, // 1MB
      cleanupInterval: 60000, // 1 minute
      ...config,
    };

    // Initialize context service
    this.contextService = new SessionContextService();

    // Start cleanup timer
    this.startCleanupTimer();

    // Handle process cleanup on service shutdown - bind methods to avoid memory leaks
    this.handleCleanup = this.handleCleanup.bind(this);
    process.on('beforeExit', this.handleCleanup);
    process.on('SIGTERM', this.handleCleanup);
    process.on('SIGINT', this.handleCleanup);
  }

  private handleCleanup() {
    this.cleanup();
  }

  /**
   * Sanitize user input to prevent injection attacks
   */
  private sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      throw this.createError('INVALID_COMMAND', 'Input must be a string');
    }
    
    if (input.length > ClaudeIntegrationService.MAX_INPUT_LENGTH) {
      throw this.createError('INVALID_COMMAND', `Input too long (max ${ClaudeIntegrationService.MAX_INPUT_LENGTH} characters)`);
    }
    
    // Remove dangerous shell metacharacters
    return input.replace(ClaudeIntegrationService.DANGEROUS_CHARS_REGEX, '');
  }

  /**
   * Validate and sanitize command before execution
   */
  private validateCommand(command: ClaudeCommand): ClaudeCommand {
    // Validate command structure
    const validation = ClaudeCommandSchema.safeParse(command);
    if (!validation.success) {
      throw this.createError('INVALID_COMMAND', `Invalid command structure: ${validation.error.message}`);
    }

    const validated = validation.data;
    
    // Additional security validation
    if (!ALLOWED_CLAUDE_COMMANDS.includes(validated.command as any)) {
      throw this.createError('INVALID_COMMAND', `Command not allowed: ${validated.command}`);
    }

    // Sanitize arguments
    const sanitizedArgs = validated.args.map(arg => this.sanitizeInput(arg));

    // Validate working directory (prevent path traversal)
    if (validated.workingDirectory) {
      const resolvedPath = path.resolve(validated.workingDirectory);
      const allowedBasePaths = [
        process.cwd(),
        path.resolve(process.env.HOME || '/tmp'),
        '/tmp'
      ];
      
      const isAllowed = allowedBasePaths.some(basePath => 
        resolvedPath.startsWith(path.resolve(basePath))
      );
      
      if (!isAllowed) {
        throw this.createError('INVALID_WORKING_DIRECTORY', `Working directory not allowed: ${validated.workingDirectory}`);
      }
    }

    return {
      ...validated,
      args: sanitizedArgs,
    };
  }

  /**
   * Start a Claude Code process with the given command
   */
  async startProcess(command: ClaudeCommand): Promise<string> {
    // Check process limits
    if (this.processes.size >= this.config.maxProcesses) {
      throw this.createError('MAX_PROCESSES_REACHED', `Maximum ${this.config.maxProcesses} processes reached`);
    }

    // Validate and sanitize command
    const validatedCommand = this.validateCommand(command);

    // Validate working directory exists if provided
    if (validatedCommand.workingDirectory) {
      try {
        await fs.access(validatedCommand.workingDirectory);
      } catch (error) {
        throw this.createError('INVALID_WORKING_DIRECTORY', `Working directory does not exist: ${validatedCommand.workingDirectory}`);
      }
    }

    // Generate unique process ID
    const processId = uuidv4();
    const startTime = new Date();

    try {
      // Check if Claude CLI is available
      await this.checkClaudeAvailability();

      // Build spawn arguments using validated command
      const args = [validatedCommand.command, ...validatedCommand.args];
      const options = {
        cwd: validatedCommand.workingDirectory || process.cwd(),
        env: { ...process.env, ...validatedCommand.env },
        stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'],
      };

      // Spawn the process
      const childProcess = spawn(this.config.claudeExecutablePath, args, options);

      // Store process reference
      this.processes.set(processId, childProcess);

      // Initialize process status
      const status: ClaudeProcessStatus = {
        processId,
        state: 'starting',
        pid: childProcess.pid || undefined,
        startTime,
        lastActivity: startTime,
      };
      this.processStatus.set(processId, status);

      // Set up process event handlers
      this.setupProcessHandlers(processId, childProcess);

      // Set process timeout
      const timeoutMs = validatedCommand.timeout || this.config.processTimeout;
      setTimeout(() => {
        if (this.processes.has(processId)) {
          this.killProcess(processId, 'Process timeout exceeded');
        }
      }, timeoutMs);

      // Update status to running
      this.updateProcessStatus(processId, { state: 'running' });

      // Emit start event
      this.emitProcessEvent(processId, 'start', { command: validatedCommand, startTime });

      return processId;
    } catch (error) {
      // Clean up on failure
      this.processes.delete(processId);
      this.processStatus.delete(processId);

      // Preserve original error code if it's a ClaudeIntegrationError
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw this.createError('PROCESS_START_FAILED', `Failed to start Claude process: ${errorMessage}`, processId);
    }
  }

  /**
   * Continue a Claude Code session from a JSONL file
   */
  async continueSession(request: SessionContinuationRequest): Promise<SessionContinuationResponse> {
    try {
      // SessionPath is required at this point
      if (!request.sessionPath) {
        return {
          success: false,
          processId: '',
          message: 'Session path is required',
          error: 'Session path must be provided for continuation',
        };
      }

      // Validate session file exists
      try {
        await fs.access(request.sessionPath);
      } catch (error) {
        return {
          success: false,
          processId: '',
          message: 'Session file not found',
          error: `Session file does not exist: ${request.sessionPath}`,
        };
      }

      // Build Claude command for session continuation
      const command: ClaudeCommand = {
        command: (request.command as typeof ALLOWED_CLAUDE_COMMANDS[number]) || '--continue-session',
        args: [request.sessionPath],
        workingDirectory: request.workingDirectory,
        env: request.env,
        timeout: this.config.processTimeout,
      };

      // Start the process
      const processId = await this.startProcess(command);

      return {
        success: true,
        processId,
        message: 'Session continuation started successfully',
        claudeProcessUrl: `/api/processes/${processId}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        processId: '',
        message: 'Failed to continue session',
        error: errorMessage,
      };
    }
  }

  /**
   * Get status of a specific process
   */
  getProcessStatus(processId: string): ClaudeProcessStatus | null {
    return this.processStatus.get(processId) || null;
  }

  /**
   * Get status of all processes
   */
  getAllProcessStatus(): ClaudeProcessStatus[] {
    return Array.from(this.processStatus.values());
  }

  /**
   * Send input to a process
   */
  sendInput(processId: string, input: string): boolean {
    const process = this.processes.get(processId);
    if (!process || !process.stdin) {
      return false;
    }

    try {
      // Validate and sanitize input
      if (typeof input !== 'string') {
        throw new Error('Input must be a string');
      }
      
      if (input.length > ClaudeIntegrationService.MAX_INPUT_LENGTH) {
        throw new Error(`Input too long (max ${ClaudeIntegrationService.MAX_INPUT_LENGTH} characters)`);
      }

      // Note: We don't sanitize input here as heavily as commands since this is user interaction
      // But we do basic validation and length limits
      process.stdin.write(input);
      this.updateProcessStatus(processId, { lastActivity: new Date() });
      return true;
    } catch (error) {
      console.error(`Failed to send input to process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Kill a specific process
   */
  async killProcess(processId: string, reason?: string): Promise<boolean> {
    const process = this.processes.get(processId);
    if (!process) {
      return false;
    }

    try {
      // Update status
      this.updateProcessStatus(processId, { 
        state: 'stopping',
        error: reason,
      });

      // Kill process
      process.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (this.processes.has(processId)) {
          process.kill('SIGKILL');
        }
      }, ClaudeIntegrationService.KILL_TIMEOUT_MS);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Prepare session context for Claude Code continuation
   */
  async prepareSessionContext(request: ContextPreparationRequest, session: ISession): Promise<ContextPreparationResult> {
    try {
      const config = request.config || {};
      const workingDirectory = request.workingDirectory || session.cwd;
      
      // Prepare context using the context service
      const result = await this.contextService.prepareSessionContext(session, {
        ...config,
        workingDirectory,
      });
      
      if (result.success) {
        this.emit('contextPrepared', {
          sessionId: session.id,
          claudeMdPath: result.claudeMdPath,
          processingTime: result.processingTimeMs,
        });
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to prepare session context: ${errorMessage}`,
      };
    }
  }

  /**
   * Continue session with automatic context preparation
   */
  async continueSessionWithContext(request: SessionContinuationWithContextRequest, session: ISession): Promise<SessionContinuationResponse> {
    try {
      // Prepare context if requested
      if (request.prepareContext && !request.useExistingClaudeMd) {
        const contextRequest: ContextPreparationRequest = {
          sessionId: request.sessionId,
          workingDirectory: request.workingDirectory,
          config: request.contextConfig,
        };
        
        const contextResult = await this.prepareSessionContext(contextRequest, session);
        
        if (!contextResult.success) {
          return {
            success: false,
            processId: '',
            message: 'Failed to prepare session context',
            error: contextResult.error,
          };
        }
        
        // Update working directory to use the prepared context directory
        request.workingDirectory = contextResult.workingDirectory;
      }
      
      // Continue with the regular session continuation process
      return await this.continueSession(request as SessionContinuationRequest);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        processId: '',
        message: 'Failed to continue session with context',
        error: errorMessage,
      };
    }
  }

  /**
   * Get session context data without starting a process
   */
  async getSessionContextData(sessionId: string, session: ISession): Promise<ContextPreparationResult> {
    try {
      const result = await this.contextService.prepareSessionContext(session, {
        workingDirectory: session.cwd,
      });
      
      // Don't write files, just return the context data
      return {
        ...result,
        claudeMdPath: undefined, // Don't include file paths since we're not writing
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to extract session context: ${errorMessage}`,
      };
    }
  }

  /**
   * Validate context data integrity
   */
  validateContextData(contextData: any): boolean {
    try {
      return this.contextService.validateContextData(contextData);
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up context files
   */
  async cleanupSessionContext(workingDirectory: string, keepClaudeMd: boolean = false): Promise<void> {
    try {
      await this.contextService.cleanupContext(workingDirectory, keepClaudeMd);
    } catch (error) {
      console.warn('Failed to cleanup session context:', error);
    }
  }

  /**
   * Clean up all processes and resources
   */
  async cleanup(): Promise<void> {
    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Kill all active processes
    const processIds = Array.from(this.processes.keys());
    await Promise.all(processIds.map(id => this.killProcess(id, 'Service shutdown')));

    // Clear maps
    this.processes.clear();
    this.processStatus.clear();

    // Remove process event listeners
    process.removeListener('beforeExit', this.handleCleanup);
    process.removeListener('SIGTERM', this.handleCleanup);
    process.removeListener('SIGINT', this.handleCleanup);

    // Remove event listeners
    this.removeAllListeners();
  }

  /**
   * Check if Claude CLI is available in the system
   */
  private async checkClaudeAvailability(): Promise<void> {
    return new Promise((resolve, reject) => {
      const testProcess = spawn(this.config.claudeExecutablePath, ['--version'], {
        stdio: 'pipe',
      });

      testProcess.on('error', (error) => {
        reject(this.createError('CLAUDE_NOT_INSTALLED', `Claude CLI not found: ${error.message}`));
      });

      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(this.createError('CLAUDE_NOT_INSTALLED', `Claude CLI test failed with code: ${code}`));
        }
      });
    });
  }

  /**
   * Set up event handlers for a spawned process
   */
  private setupProcessHandlers(processId: string, childProcess: ChildProcess): void {
    // Handle stdout data
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        const output: ClaudeOutput = {
          processId,
          type: 'stdout',
          data: data.toString(),
          timestamp: new Date(),
        };
        
        this.updateProcessStatus(processId, { lastActivity: new Date() });
        this.emit('output', output);
        this.emitProcessEvent(processId, 'data', output);
      });
    }

    // Handle stderr data
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        const output: ClaudeOutput = {
          processId,
          type: 'stderr',
          data: data.toString(),
          timestamp: new Date(),
        };
        
        this.updateProcessStatus(processId, { lastActivity: new Date() });
        this.emit('output', output);
        this.emitProcessEvent(processId, 'data', output);
      });
    }

    // Handle process errors
    childProcess.on('error', (error) => {
      this.updateProcessStatus(processId, {
        state: 'error',
        error: error.message,
      });
      
      this.emit('error', { processId, error });
      this.emitProcessEvent(processId, 'error', { error: error.message });
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      this.updateProcessStatus(processId, {
        state: 'stopped',
        endTime: new Date(),
        exitCode: code !== null ? code : undefined,
        signal: signal || undefined,
      });

      this.processes.delete(processId);
      this.emit('exit', { processId, code, signal });
      this.emitProcessEvent(processId, 'exit', { code, signal });
    });

    // Handle process close
    childProcess.on('close', (code, signal) => {
      this.emitProcessEvent(processId, 'close', { code, signal });
    });
  }

  /**
   * Update process status
   */
  private updateProcessStatus(processId: string, updates: Partial<ClaudeProcessStatus>): void {
    const current = this.processStatus.get(processId);
    if (current) {
      this.processStatus.set(processId, { ...current, ...updates });
    }
  }

  /**
   * Emit a process event
   */
  private emitProcessEvent(processId: string, event: ClaudeProcessEvent['event'], data?: any): void {
    const processEvent: ClaudeProcessEvent = {
      processId,
      event,
      data,
      timestamp: new Date(),
    };
    
    this.emit('processEvent', processEvent);
  }

  /**
   * Start the cleanup timer for inactive processes
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = new Date();
      const inactiveProcesses: string[] = [];

      // Find inactive processes
      for (const [processId, status] of this.processStatus.entries()) {
        if (status.lastActivity && status.state === 'running') {
          const timeSinceActivity = now.getTime() - status.lastActivity.getTime();
          if (timeSinceActivity > this.config.processTimeout) {
            inactiveProcesses.push(processId);
          }
        }
      }

      // Clean up inactive processes
      inactiveProcesses.forEach(processId => {
        this.killProcess(processId, 'Process inactive timeout');
      });
    }, this.config.cleanupInterval);
  }

  /**
   * Create a standardized error object
   */
  private createError(
    code: ClaudeIntegrationError['code'], 
    message: string, 
    processId?: string, 
    details?: any
  ): ClaudeIntegrationError {
    return {
      code,
      message,
      processId,
      details,
    };
  }
}