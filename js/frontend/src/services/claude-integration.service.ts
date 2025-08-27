/**
 * Claude Integration Service - Frontend service for Claude Code CLI integration
 *
 * This service provides a frontend interface for:
 * - Session continuation with Claude Code CLI
 * - Process status monitoring
 * - Context preparation and management
 * - Real-time updates via WebSocket integration
 */

import { EventEmitter } from "../utils/event-emitter";
import { getWebSocketService } from "./websocket-service";
import type {
  SessionContinuationRequest,
  SessionContinuationResponse,
  SessionContinuationWithContextRequest,
  ClaudeProcessStatus,
  ClaudeProcessState,
  ClaudeOutput,
  ContextPreparationRequest,
  ContextPreparationResult,
  ClaudeIntegrationError,
} from "../../../../shared/src/schemas/claude-integration";
import type { ZodSession } from "../../../../shared/src/schemas/index";

/**
 * Claude Integration Service Configuration
 */
export interface ClaudeIntegrationServiceConfig {
  apiBaseUrl?: string;
  enableWebSocketUpdates?: boolean;
  debug?: boolean;
  requestTimeout?: number;
}

/**
 * Event map for Claude Integration Service
 */
export interface ClaudeIntegrationEventMap {
  "process:status": ClaudeProcessStatus;
  "process:output": ClaudeOutput;
  "process:error": { processId: string; error: string };
  "context:prepared": {
    sessionId: string;
    claudeMdPath?: string;
    processingTime?: number;
  };
  "session:continued": { sessionId: string; processId: string };
  error: ClaudeIntegrationError;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<ClaudeIntegrationServiceConfig> = {
  apiBaseUrl: "/api",
  enableWebSocketUpdates: true,
  debug: false,
  requestTimeout: 30000, // 30 seconds
};

/**
 * Claude Integration Service
 * Manages frontend interactions with Claude Code CLI via backend API
 */
export class ClaudeIntegrationService {
  private static instance: ClaudeIntegrationService | null = null;

  private config: Required<ClaudeIntegrationServiceConfig>;
  private eventEmitter: EventEmitter<ClaudeIntegrationEventMap>;
  private processes = new Map<string, ClaudeProcessStatus>();
  private webSocketUnsubscribers: Array<() => void> = [];

  /**
   * Private constructor for singleton pattern
   */
  private constructor(config: ClaudeIntegrationServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventEmitter = new EventEmitter<ClaudeIntegrationEventMap>();

    if (this.config.debug) {
      console.log(
        "[ClaudeIntegrationService] Initialized with config:",
        this.config,
      );
    }

    // Set up WebSocket listeners for real-time updates
    if (this.config.enableWebSocketUpdates) {
      this.setupWebSocketListeners();
    }
  }

  /**
   * Get singleton instance of ClaudeIntegrationService
   */
  public static getInstance(
    config?: ClaudeIntegrationServiceConfig,
  ): ClaudeIntegrationService {
    if (!ClaudeIntegrationService.instance) {
      ClaudeIntegrationService.instance = new ClaudeIntegrationService(config);
    } else if (config) {
      // Update configuration if provided
      ClaudeIntegrationService.instance.config = {
        ...DEFAULT_CONFIG,
        ...config,
      };
    }

    return ClaudeIntegrationService.instance;
  }

  /**
   * Continue a Claude Code session
   */
  public async continueSession(
    request: SessionContinuationRequest,
  ): Promise<SessionContinuationResponse> {
    try {
      this.log(`Continuing session: ${request.sessionId}`);

      const response = await this.makeRequest<SessionContinuationResponse>(
        "/sessions/continue",
        "POST",
        request,
      );

      if (response.success) {
        // Store process status
        this.processes.set(response.processId, {
          processId: response.processId,
          state: "starting",
          startTime: new Date(),
          lastActivity: new Date(),
        });

        this.eventEmitter.emit("session:continued", {
          sessionId: request.sessionId,
          processId: response.processId,
        });

        this.log(`Session continuation started: ${response.processId}`);
      } else {
        this.log(`Session continuation failed: ${response.error}`, "error");
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.log(`Failed to continue session: ${errorMessage}`, "error");

      const errorResponse: SessionContinuationResponse = {
        success: false,
        processId: "",
        message: "Failed to continue session",
        error: errorMessage,
      };

      return errorResponse;
    }
  }

  /**
   * Continue a session with context preparation
   */
  public async continueSessionWithContext(
    request: SessionContinuationWithContextRequest,
    _session: ZodSession,
  ): Promise<SessionContinuationResponse> {
    try {
      this.log(`Continuing session with context: ${request.sessionId}`);

      const response = await this.makeRequest<SessionContinuationResponse>(
        "/sessions/continue-with-context",
        "POST",
        request,
      );

      if (response.success) {
        // Store process status
        this.processes.set(response.processId, {
          processId: response.processId,
          state: "starting",
          startTime: new Date(),
          lastActivity: new Date(),
        });

        this.eventEmitter.emit("session:continued", {
          sessionId: request.sessionId,
          processId: response.processId,
        });

        this.log(
          `Session continuation with context started: ${response.processId}`,
        );
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.log(
        `Failed to continue session with context: ${errorMessage}`,
        "error",
      );

      return {
        success: false,
        processId: "",
        message: "Failed to continue session with context",
        error: errorMessage,
      };
    }
  }

  /**
   * Prepare session context without starting a process
   */
  public async prepareSessionContext(
    request: ContextPreparationRequest,
    session: ZodSession,
  ): Promise<ContextPreparationResult> {
    try {
      this.log(`Preparing context for session: ${request.sessionId}`);

      const response = await this.makeRequest<ContextPreparationResult>(
        "/sessions/prepare-context",
        "POST",
        { ...request, session },
      );

      if (response.success) {
        this.eventEmitter.emit("context:prepared", {
          sessionId: request.sessionId,
          claudeMdPath: response.claudeMdPath,
          processingTime: response.processingTimeMs,
        });

        this.log(
          `Context preparation completed for session: ${request.sessionId}`,
        );
      } else {
        this.log(`Context preparation failed: ${response.error}`, "error");
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.log(`Failed to prepare context: ${errorMessage}`, "error");

      return {
        success: false,
        error: `Failed to prepare session context: ${errorMessage}`,
      };
    }
  }

  /**
   * Get session context data
   */
  public async getSessionContextData(
    sessionId: string,
    session: ZodSession,
  ): Promise<ContextPreparationResult> {
    try {
      this.log(`Getting context data for session: ${sessionId}`);

      const response = await this.makeRequest<ContextPreparationResult>(
        "/sessions/context-data",
        "POST",
        { sessionId, session },
      );

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.log(`Failed to get context data: ${errorMessage}`, "error");

      return {
        success: false,
        error: `Failed to get session context data: ${errorMessage}`,
      };
    }
  }

  /**
   * Get status of a specific process
   */
  public async getProcessStatus(
    processId: string,
  ): Promise<ClaudeProcessStatus | null> {
    try {
      // Check local cache first
      const cachedStatus = this.processes.get(processId);
      if (cachedStatus) {
        return cachedStatus;
      }

      // Fetch from API
      const response = await this.makeRequest<ClaudeProcessStatus>(
        `/processes/${processId}`,
        "GET",
      );

      // Update cache
      this.processes.set(processId, response);

      return response;
    } catch (error) {
      this.log(`Failed to get process status: ${error}`, "error");
      return null;
    }
  }

  /**
   * Get status of all processes
   */
  public async getAllProcessStatus(): Promise<ClaudeProcessStatus[]> {
    try {
      const response = await this.makeRequest<ClaudeProcessStatus[]>(
        "/processes",
        "GET",
      );

      // Update cache
      response.forEach((status) => {
        this.processes.set(status.processId, status);
      });

      return response;
    } catch (error) {
      this.log(`Failed to get all process status: ${error}`, "error");
      return [];
    }
  }

  /**
   * Send input to a process
   */
  public async sendInput(processId: string, input: string): Promise<boolean> {
    try {
      const response = await this.makeRequest<{ success: boolean }>(
        `/processes/${processId}/input`,
        "POST",
        { input },
      );

      return response.success;
    } catch (error) {
      this.log(`Failed to send input to process: ${error}`, "error");
      return false;
    }
  }

  /**
   * Stop a specific process
   */
  public async stopProcess(processId: string): Promise<boolean> {
    try {
      this.log(`Stopping process: ${processId}`);

      const response = await this.makeRequest<{ success: boolean }>(
        `/processes/${processId}/stop`,
        "POST",
      );

      if (response.success) {
        // Update local status
        const status = this.processes.get(processId);
        if (status) {
          this.processes.set(processId, {
            ...status,
            state: "stopping",
            lastActivity: new Date(),
          });
        }
      }

      return response.success;
    } catch (error) {
      this.log(`Failed to stop process: ${error}`, "error");
      return false;
    }
  }

  /**
   * Subscribe to events
   */
  public on<K extends keyof ClaudeIntegrationEventMap>(
    event: K,
    handler: (data: ClaudeIntegrationEventMap[K]) => void,
  ): () => void {
    return this.eventEmitter.on(event, handler);
  }

  /**
   * Subscribe to an event once
   */
  public once<K extends keyof ClaudeIntegrationEventMap>(
    event: K,
    handler: (data: ClaudeIntegrationEventMap[K]) => void,
  ): () => void {
    return this.eventEmitter.once(event, handler);
  }

  /**
   * Unsubscribe from events
   */
  public off<K extends keyof ClaudeIntegrationEventMap>(
    event: K,
    handler?: (data: ClaudeIntegrationEventMap[K]) => void,
  ): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Get cached process status
   */
  public getCachedProcessStatus(processId: string): ClaudeProcessStatus | null {
    return this.processes.get(processId) || null;
  }

  /**
   * Check if a process is running
   */
  public isProcessRunning(processId: string): boolean {
    const status = this.processes.get(processId);
    return status?.state === "running";
  }

  /**
   * Get all cached processes
   */
  public getCachedProcesses(): ClaudeProcessStatus[] {
    return Array.from(this.processes.values());
  }

  /**
   * Clear cached process data
   */
  public clearProcessCache(): void {
    this.processes.clear();
  }

  /**
   * Setup WebSocket listeners for real-time updates
   */
  private setupWebSocketListeners(): void {
    try {
      const webSocketService = getWebSocketService();

      // Listen for Claude process status updates
      const statusUnsubscriber = webSocketService.on("message", (message) => {
        if (message.type === "claude_process_status") {
          const status = message.data as ClaudeProcessStatus;
          this.processes.set(status.processId, status);
          this.eventEmitter.emit("process:status", status);
        }
      });

      // Listen for Claude process output
      const outputUnsubscriber = webSocketService.on("message", (message) => {
        if (message.type === "claude_process_output") {
          const output = message.data as ClaudeOutput;
          this.eventEmitter.emit("process:output", output);
        }
      });

      // Listen for Claude process errors
      const errorUnsubscriber = webSocketService.on("message", (message) => {
        if (message.type === "claude_process_error") {
          const error = message.data as { processId: string; error: string };
          this.eventEmitter.emit("process:error", error);
        }
      });

      this.webSocketUnsubscribers.push(
        statusUnsubscriber,
        outputUnsubscriber,
        errorUnsubscriber,
      );

      this.log("WebSocket listeners setup completed");
    } catch (error) {
      this.log(`Failed to setup WebSocket listeners: ${error}`, "warn");
      // Continue without WebSocket updates
    }
  }

  /**
   * Make HTTP request to backend API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown,
  ): Promise<T> {
    const url = `${this.config.apiBaseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    options.signal = controller.signal;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.requestTimeout);

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout");
      }

      throw error;
    }
  }

  /**
   * Log helper
   */
  private log(message: string, level: "log" | "warn" | "error" = "log"): void {
    if (this.config.debug) {
      console[level](`[ClaudeIntegrationService] ${message}`);
    }
  }

  /**
   * Destroy the service and clean up
   */
  public destroy(): void {
    // Unsubscribe from WebSocket events
    this.webSocketUnsubscribers.forEach((unsubscriber) => unsubscriber());
    this.webSocketUnsubscribers = [];

    // Clear cached data
    this.processes.clear();

    // Remove all event listeners
    this.eventEmitter.removeAllListeners();

    // Clear singleton instance
    ClaudeIntegrationService.instance = null;

    this.log("Service destroyed");
  }
}

/**
 * Export singleton getter for convenience
 */
export function getClaudeIntegrationService(
  config?: ClaudeIntegrationServiceConfig,
): ClaudeIntegrationService {
  return ClaudeIntegrationService.getInstance(config);
}

/**
 * Export utility functions
 */
export function isProcessActive(state: ClaudeProcessState): boolean {
  return state === "starting" || state === "running";
}

export function isProcessFinished(state: ClaudeProcessState): boolean {
  return state === "stopped" || state === "error";
}

export function getProcessStateLabel(state: ClaudeProcessState): string {
  const labels: Record<ClaudeProcessState, string> = {
    idle: "⚪ Ready",
    starting: "🟡 Starting...",
    running: "🟢 Running",
    stopping: "🟡 Stopping...",
    stopped: "⚫ Stopped",
    error: "🔴 Error",
  };

  return labels[state] || "❓ Unknown";
}
