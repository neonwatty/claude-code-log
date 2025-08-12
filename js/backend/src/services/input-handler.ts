import { EventEmitter } from 'events';
import { Writable } from 'stream';

export interface InputQueueItem {
  id: string;
  data: string | Buffer;
  timestamp: Date;
  priority?: number;
}

export interface InputHandlerEvents {
  'input-queued': (processId: string, queueItem: InputQueueItem) => void;
  'input-sent': (processId: string, queueItem: InputQueueItem) => void;
  'input-failed': (processId: string, queueItem: InputQueueItem, error: Error) => void;
  'queue-full': (processId: string, droppedCount: number) => void;
  'special-sequence': (processId: string, sequence: string) => void;
  'interactive-mode-detected': (processId: string, isInteractive: boolean) => void;
}

declare interface InputHandler {
  on<U extends keyof InputHandlerEvents>(
    event: U, listener: InputHandlerEvents[U]
  ): this;
  
  emit<U extends keyof InputHandlerEvents>(
    event: U, ...args: Parameters<InputHandlerEvents[U]>
  ): boolean;
}

/**
 * InputHandler manages stdin writes to Claude Code CLI processes with support for
 * input queuing, special key sequences, and interactive mode detection.
 */
class InputHandler extends EventEmitter {
  private inputQueues = new Map<string, InputQueueItem[]>();
  private processingQueues = new Set<string>();
  private processStreams = new Map<string, Writable | null>();
  private interactiveModes = new Map<string, boolean>();
  
  // Configuration
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly HIGH_PRIORITY_QUEUE_SIZE = 100;
  private readonly PROCESSING_DELAY = 10; // milliseconds between queue processing
  
  // Special key sequences
  private static readonly SPECIAL_SEQUENCES = {
    CTRL_C: '\x03',
    CTRL_D: '\x04',
    CTRL_Z: '\x1A',
    ENTER: '\n',
    TAB: '\t',
    BACKSPACE: '\x08',
    DELETE: '\x7F',
    ESC: '\x1B',
    UP_ARROW: '\x1B[A',
    DOWN_ARROW: '\x1B[B',
    RIGHT_ARROW: '\x1B[C',
    LEFT_ARROW: '\x1B[D',
  };

  // Interactive mode detection patterns
  private static readonly INTERACTIVE_PATTERNS = [
    /^\s*\?\s*$/, // Question prompts
    /\[y\/n\]/i, // Yes/No prompts
    /press\s+any\s+key/i, // Press any key
    /continue\s*\?\s*$/i, // Continue prompts
    /enter\s+your\s+choice/i, // Choice prompts
    /select\s+an\s+option/i, // Option selection
    /password:/i, // Password prompts
    /confirm/i, // Confirmation prompts
  ];

  constructor() {
    super();
  }

  /**
   * Registers a process for input handling
   */
  registerProcess(processId: string, stdin: Writable | null): void {
    this.processStreams.set(processId, stdin);
    this.inputQueues.set(processId, []);
    this.interactiveModes.set(processId, false);
    
    console.log(`Input handler registered for process ${processId}`);
  }

  /**
   * Unregisters a process from input handling
   */
  unregisterProcess(processId: string): void {
    // Clear any pending inputs
    this.inputQueues.delete(processId);
    this.processStreams.delete(processId);
    this.interactiveModes.delete(processId);
    this.processingQueues.delete(processId);
    
    console.log(`Input handler unregistered for process ${processId}`);
  }

  /**
   * Queues input for a process
   */
  async queueInput(
    processId: string,
    data: string | Buffer,
    options: {
      priority?: number;
      skipQueue?: boolean;
    } = {}
  ): Promise<string> {
    const queue = this.inputQueues.get(processId);
    const stream = this.processStreams.get(processId);

    if (!queue || !stream) {
      throw new Error(`Process ${processId} not registered for input handling`);
    }

    // Sanitize and validate input
    const sanitizedData = this.sanitizeInput(data);
    const queueItem: InputQueueItem = {
      id: `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: sanitizedData,
      timestamp: new Date(),
      priority: options.priority || 0,
    };

    // Check for special sequences
    this.checkForSpecialSequences(processId, sanitizedData);

    // Skip queue for high-priority or immediate inputs
    if (options.skipQueue && queue.length === 0) {
      return await this.sendInputDirectly(processId, queueItem);
    }

    // Check queue capacity
    const maxSize = options.priority && options.priority > 0 
      ? this.HIGH_PRIORITY_QUEUE_SIZE 
      : this.MAX_QUEUE_SIZE;

    if (queue.length >= maxSize) {
      // Drop oldest low-priority items
      const droppedCount = this.dropOldestItems(processId, 1);
      this.emit('queue-full', processId, droppedCount);
    }

    // Add to queue with priority sorting
    queue.push(queueItem);
    queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    this.emit('input-queued', processId, queueItem);

    // Start processing if not already processing
    if (!this.processingQueues.has(processId)) {
      this.processQueue(processId);
    }

    return queueItem.id;
  }

  /**
   * Sends a special key sequence
   */
  async sendSpecialSequence(processId: string, sequence: keyof typeof InputHandler.SPECIAL_SEQUENCES): Promise<string> {
    const specialData = InputHandler.SPECIAL_SEQUENCES[sequence];
    if (!specialData) {
      throw new Error(`Unknown special sequence: ${sequence}`);
    }

    this.emit('special-sequence', processId, sequence);
    
    return await this.queueInput(processId, specialData, {
      priority: 10, // High priority for special sequences
      skipQueue: true,
    });
  }

  /**
   * Detects if process output indicates interactive mode
   */
  detectInteractiveMode(processId: string, output: string): boolean {
    const lines = output.split('\n').map(line => line.trim());
    const lastFewLines = lines.slice(-3); // Check last 3 lines

    let isInteractive = false;
    for (const line of lastFewLines) {
      for (const pattern of InputHandler.INTERACTIVE_PATTERNS) {
        if (pattern.test(line)) {
          isInteractive = true;
          break;
        }
      }
      if (isInteractive) break;
    }

    // Update interactive mode tracking
    const wasInteractive = this.interactiveModes.get(processId) || false;
    if (isInteractive !== wasInteractive) {
      this.interactiveModes.set(processId, isInteractive);
      this.emit('interactive-mode-detected', processId, isInteractive);
    }

    return isInteractive;
  }

  /**
   * Checks if a process is in interactive mode
   */
  isInteractiveMode(processId: string): boolean {
    return this.interactiveModes.get(processId) || false;
  }

  /**
   * Gets the current input queue for a process
   */
  getInputQueue(processId: string): InputQueueItem[] {
    const queue = this.inputQueues.get(processId);
    return queue ? [...queue] : [];
  }

  /**
   * Clears the input queue for a process
   */
  clearInputQueue(processId: string): number {
    const queue = this.inputQueues.get(processId);
    if (!queue) return 0;

    const clearedCount = queue.length;
    queue.length = 0;
    return clearedCount;
  }

  /**
   * Gets input handling statistics
   */
  getStats(processId?: string) {
    if (processId) {
      const queue = this.inputQueues.get(processId);
      return {
        processId,
        queueSize: queue?.length || 0,
        isProcessing: this.processingQueues.has(processId),
        isInteractive: this.interactiveModes.get(processId) || false,
        hasStream: this.processStreams.has(processId) && this.processStreams.get(processId) !== null,
      };
    }

    const totalProcesses = this.processStreams.size;
    const totalQueuedItems = Array.from(this.inputQueues.values()).reduce((sum, queue) => sum + queue.length, 0);
    const processingCount = this.processingQueues.size;
    const interactiveCount = Array.from(this.interactiveModes.values()).filter(Boolean).length;

    return {
      totalProcesses,
      totalQueuedItems,
      processingCount,
      interactiveCount,
      averageQueueSize: totalProcesses > 0 ? totalQueuedItems / totalProcesses : 0,
    };
  }

  /**
   * Sanitizes input data
   */
  private sanitizeInput(data: string | Buffer): string {
    let input = typeof data === 'string' ? data : data.toString('utf8');
    
    // Remove null bytes and other potentially problematic characters
    input = input.replace(/\0/g, '');
    
    // Limit input length to prevent abuse
    const maxLength = 10000; // 10KB limit
    if (input.length > maxLength) {
      input = input.substring(0, maxLength);
    }

    return input;
  }

  /**
   * Checks for special key sequences in input
   */
  private checkForSpecialSequences(processId: string, data: string): void {
    for (const [name, sequence] of Object.entries(InputHandler.SPECIAL_SEQUENCES)) {
      if (data.includes(sequence)) {
        this.emit('special-sequence', processId, name);
      }
    }
  }

  /**
   * Sends input directly to process stream
   */
  private async sendInputDirectly(processId: string, queueItem: InputQueueItem): Promise<string> {
    const stream = this.processStreams.get(processId);
    if (!stream) {
      throw new Error(`No stream available for process ${processId}`);
    }

    try {
      const success = stream.write(queueItem.data);
      if (success) {
        this.emit('input-sent', processId, queueItem);
      } else {
        throw new Error('Stream write returned false (backpressure)');
      }
      return queueItem.id;
    } catch (error) {
      this.emit('input-failed', processId, queueItem, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Processes the input queue for a process
   */
  private async processQueue(processId: string): Promise<void> {
    if (this.processingQueues.has(processId)) {
      return; // Already processing
    }

    const queue = this.inputQueues.get(processId);
    const stream = this.processStreams.get(processId);

    if (!queue || !stream) {
      return;
    }

    this.processingQueues.add(processId);

    try {
      while (queue.length > 0) {
        const queueItem = queue.shift()!;
        
        try {
          await this.sendInputDirectly(processId, queueItem);
          
          // Small delay to prevent overwhelming the process
          if (queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, this.PROCESSING_DELAY));
          }
        } catch (error) {
          console.error(`Failed to send input to process ${processId}:`, error);
          break; // Stop processing on error
        }
      }
    } finally {
      this.processingQueues.delete(processId);
    }
  }

  /**
   * Drops oldest items from queue
   */
  private dropOldestItems(processId: string, count: number): number {
    const queue = this.inputQueues.get(processId);
    if (!queue) return 0;

    // Remove oldest low-priority items first
    let dropped = 0;
    for (let i = queue.length - 1; i >= 0 && dropped < count; i--) {
      if ((queue[i].priority || 0) <= 0) {
        queue.splice(i, 1);
        dropped++;
      }
    }

    // If we still need to drop more, remove oldest items regardless of priority
    if (dropped < count) {
      const remainingToDrop = count - dropped;
      const removed = queue.splice(-remainingToDrop, remainingToDrop);
      dropped += removed.length;
    }

    return dropped;
  }

  /**
   * Graceful shutdown - clear all queues and streams
   */
  async shutdown(): Promise<void> {
    console.log('InputHandler shutting down...');
    
    // Clear all processing
    this.processingQueues.clear();
    
    // Clear all queues
    this.inputQueues.clear();
    
    // Clear stream references
    this.processStreams.clear();
    
    // Clear interactive mode tracking
    this.interactiveModes.clear();
    
    console.log('InputHandler shutdown complete');
  }
}

export default InputHandler;