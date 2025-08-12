import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import InputHandler from './input-handler';
import { Writable } from 'stream';

describe('InputHandler', () => {
  let inputHandler: InputHandler;
  let mockStream: any;

  beforeEach(() => {
    inputHandler = new InputHandler();
    mockStream = {
      write: vi.fn().mockReturnValue(true),
    } as any;
  });

  afterEach(async () => {
    await inputHandler.shutdown();
  });

  describe('registerProcess', () => {
    it('should register a process for input handling', () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const queue = inputHandler.getInputQueue(processId);
      expect(queue).toEqual([]);
      expect(inputHandler.isInteractiveMode(processId)).toBe(false);
    });

    it('should handle null stream', () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, null);

      const queue = inputHandler.getInputQueue(processId);
      expect(queue).toEqual([]);
    });
  });

  describe('unregisterProcess', () => {
    it('should unregister a process and clear resources', () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      // Add some items to queue
      inputHandler.queueInput(processId, 'test input');

      inputHandler.unregisterProcess(processId);

      const queue = inputHandler.getInputQueue(processId);
      expect(queue).toEqual([]);
    });
  });

  describe('queueInput', () => {
    it('should queue input for a registered process', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const inputId = await inputHandler.queueInput(processId, 'test command');

      expect(inputId).toBeDefined();
      expect(typeof inputId).toBe('string');

      const queue = inputHandler.getInputQueue(processId);
      expect(queue).toHaveLength(1);
      expect(queue[0].data).toBe('test command');
    });

    it('should throw error for unregistered process', async () => {
      await expect(
        inputHandler.queueInput('unregistered', 'test')
      ).rejects.toThrow('Process unregistered not registered for input handling');
    });

    it('should handle buffer input', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const buffer = Buffer.from('test buffer');
      const inputId = await inputHandler.queueInput(processId, buffer);

      expect(inputId).toBeDefined();

      const queue = inputHandler.getInputQueue(processId);
      expect(queue[0].data).toBe('test buffer');
    });

    it('should sanitize input data', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      // Input with null bytes should be sanitized
      const inputWithNulls = 'test\x00data\x00';
      await inputHandler.queueInput(processId, inputWithNulls);

      const queue = inputHandler.getInputQueue(processId);
      expect(queue[0].data).toBe('testdata');
    });

    it('should limit input length', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      // Create input longer than 10KB limit
      const longInput = 'a'.repeat(10001);
      await inputHandler.queueInput(processId, longInput);

      const queue = inputHandler.getInputQueue(processId);
      expect((queue[0].data as string).length).toBe(10000);
    });

    it('should handle priority input', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      await inputHandler.queueInput(processId, 'low priority');
      await inputHandler.queueInput(processId, 'high priority', { priority: 10 });
      await inputHandler.queueInput(processId, 'normal priority');

      const queue = inputHandler.getInputQueue(processId);
      expect(queue[0].data).toBe('high priority'); // Should be first due to priority
    });

    it('should emit input-queued event', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const eventPromise = new Promise((resolve) => {
        inputHandler.once('input-queued', (pid, queueItem) => {
          resolve({ pid, queueItem });
        });
      });

      await inputHandler.queueInput(processId, 'test input');

      const { pid, queueItem } = await eventPromise as any;
      expect(pid).toBe(processId);
      expect(queueItem.data).toBe('test input');
    });

    it('should skip queue for immediate input', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const inputId = await inputHandler.queueInput(processId, 'immediate', {
        skipQueue: true
      });

      expect(mockStream.write).toHaveBeenCalledWith('immediate');
      
      // Queue should still be empty since it was sent immediately
      const queue = inputHandler.getInputQueue(processId);
      expect(queue).toHaveLength(0);
    });

    it('should drop oldest items when queue is full', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, null); // Use null stream to prevent processing

      // Fill queue to capacity (using private MAX_QUEUE_SIZE = 1000)
      for (let i = 0; i < 1001; i++) {
        await inputHandler.queueInput(processId, `command-${i}`);
      }

      const queue = inputHandler.getInputQueue(processId);
      expect(queue.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('sendSpecialSequence', () => {
    it('should send CTRL_C sequence', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const inputId = await inputHandler.sendSpecialSequence(processId, 'CTRL_C');

      expect(inputId).toBeDefined();
      expect(mockStream.write).toHaveBeenCalledWith('\x03');
    });

    it('should send ENTER sequence', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      await inputHandler.sendSpecialSequence(processId, 'ENTER');

      expect(mockStream.write).toHaveBeenCalledWith('\n');
    });

    it('should send TAB sequence', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      await inputHandler.sendSpecialSequence(processId, 'TAB');

      expect(mockStream.write).toHaveBeenCalledWith('\t');
    });

    it('should emit special-sequence event', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const eventPromise = new Promise((resolve) => {
        inputHandler.once('special-sequence', (pid, sequence) => {
          resolve({ pid, sequence });
        });
      });

      await inputHandler.sendSpecialSequence(processId, 'CTRL_D');

      const { pid, sequence } = await eventPromise as any;
      expect(pid).toBe(processId);
      expect(sequence).toBe('CTRL_D');
    });

    it('should throw error for unknown sequence', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      await expect(
        inputHandler.sendSpecialSequence(processId, 'UNKNOWN' as any)
      ).rejects.toThrow('Unknown special sequence: UNKNOWN');
    });
  });

  describe('detectInteractiveMode', () => {
    it('should detect yes/no prompts', () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const isInteractive = inputHandler.detectInteractiveMode(processId, 'Continue? [y/n]');

      expect(isInteractive).toBe(true);
      expect(inputHandler.isInteractiveMode(processId)).toBe(true);
    });

    it('should detect password prompts', () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const isInteractive = inputHandler.detectInteractiveMode(processId, 'Password:');

      expect(isInteractive).toBe(true);
    });

    it('should detect press any key prompts', () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const isInteractive = inputHandler.detectInteractiveMode(processId, 'Press any key to continue...');

      expect(isInteractive).toBe(true);
    });

    it('should detect confirmation prompts', () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const isInteractive = inputHandler.detectInteractiveMode(processId, 'Please confirm your action');

      expect(isInteractive).toBe(true);
    });

    it('should not detect interactive mode in regular output', () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const isInteractive = inputHandler.detectInteractiveMode(processId, 'Regular command output');

      expect(isInteractive).toBe(false);
      expect(inputHandler.isInteractiveMode(processId)).toBe(false);
    });

    it('should emit interactive-mode-detected event when mode changes', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const eventPromise = new Promise((resolve) => {
        inputHandler.once('interactive-mode-detected', (pid, isInteractive) => {
          resolve({ pid, isInteractive });
        });
      });

      inputHandler.detectInteractiveMode(processId, 'Continue? [y/n]');

      const { pid, isInteractive } = await eventPromise as any;
      expect(pid).toBe(processId);
      expect(isInteractive).toBe(true);
    });

    it('should handle multiline output', () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const output = `
      Some regular output
      More output here
      Continue? [y/n]
      `;

      const isInteractive = inputHandler.detectInteractiveMode(processId, output);
      expect(isInteractive).toBe(true);
    });
  });

  describe('getInputQueue', () => {
    it('should return current input queue', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, null); // Use null to prevent processing

      await inputHandler.queueInput(processId, 'command 1');
      await inputHandler.queueInput(processId, 'command 2');

      const queue = inputHandler.getInputQueue(processId);
      expect(queue).toHaveLength(2);
      expect(queue[0].data).toBe('command 1');
      expect(queue[1].data).toBe('command 2');
    });

    it('should return empty array for non-existent process', () => {
      const queue = inputHandler.getInputQueue('non-existent');
      expect(queue).toEqual([]);
    });

    it('should return a copy of the queue', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, null);

      await inputHandler.queueInput(processId, 'test');

      const queue1 = inputHandler.getInputQueue(processId);
      const queue2 = inputHandler.getInputQueue(processId);

      expect(queue1).not.toBe(queue2); // Different array references
      expect(queue1).toEqual(queue2); // Same content
    });
  });

  describe('clearInputQueue', () => {
    it('should clear the input queue and return count', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, null);

      await inputHandler.queueInput(processId, 'command 1');
      await inputHandler.queueInput(processId, 'command 2');

      const clearedCount = inputHandler.clearInputQueue(processId);

      expect(clearedCount).toBe(2);
      expect(inputHandler.getInputQueue(processId)).toHaveLength(0);
    });

    it('should return 0 for non-existent process', () => {
      const clearedCount = inputHandler.clearInputQueue('non-existent');
      expect(clearedCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return stats for specific process', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);
      
      await inputHandler.queueInput(processId, 'test');
      inputHandler.detectInteractiveMode(processId, 'Continue? [y/n]');

      const stats = inputHandler.getStats(processId);

      expect(stats.processId).toBe(processId);
      expect(stats.queueSize).toBe(1);
      expect(stats.isInteractive).toBe(true);
      expect(stats.hasStream).toBe(true);
    });

    it('should return global stats', async () => {
      const processId1 = 'test-process-1';
      const processId2 = 'test-process-2';
      
      inputHandler.registerProcess(processId1, mockStream);
      inputHandler.registerProcess(processId2, null);

      await inputHandler.queueInput(processId1, 'test1');
      await inputHandler.queueInput(processId2, 'test2');

      inputHandler.detectInteractiveMode(processId1, 'Continue? [y/n]');

      const stats = inputHandler.getStats();

      expect(stats.totalProcesses).toBe(2);
      expect(stats.totalQueuedItems).toBe(2);
      expect(stats.interactiveCount).toBe(1);
      expect(stats.averageQueueSize).toBe(1);
    });
  });

  describe('input processing', () => {
    it('should process queued inputs in order', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      await inputHandler.queueInput(processId, 'first');
      await inputHandler.queueInput(processId, 'second');
      await inputHandler.queueInput(processId, 'third');

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockStream.write).toHaveBeenCalledTimes(3);
      expect(mockStream.write).toHaveBeenNthCalledWith(1, 'first');
      expect(mockStream.write).toHaveBeenNthCalledWith(2, 'second');
      expect(mockStream.write).toHaveBeenNthCalledWith(3, 'third');
    });

    it('should process high priority inputs first', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      await inputHandler.queueInput(processId, 'normal', { priority: 0 });
      await inputHandler.queueInput(processId, 'high', { priority: 10 });
      await inputHandler.queueInput(processId, 'low', { priority: -1 });

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockStream.write).toHaveBeenNthCalledWith(1, 'high');
      expect(mockStream.write).toHaveBeenNthCalledWith(2, 'normal');
      expect(mockStream.write).toHaveBeenNthCalledWith(3, 'low');
    });

    it('should emit input-sent events', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const eventPromise = new Promise((resolve) => {
        inputHandler.once('input-sent', (pid, queueItem) => {
          resolve({ pid, queueItem });
        });
      });

      await inputHandler.queueInput(processId, 'test input');

      const { pid, queueItem } = await eventPromise as any;
      expect(pid).toBe(processId);
      expect(queueItem.data).toBe('test input');
    });

    it('should handle stream write failure', async () => {
      const processId = 'test-process';
      const failingStream = {
        write: vi.fn().mockReturnValue(false), // Simulate backpressure
      } as any;

      inputHandler.registerProcess(processId, failingStream);

      const eventPromise = new Promise((resolve) => {
        inputHandler.once('input-failed', (pid, queueItem, error) => {
          resolve({ pid, queueItem, error });
        });
      });

      await inputHandler.queueInput(processId, 'test input');

      const { pid, error } = await eventPromise as any;
      expect(pid).toBe(processId);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('special sequence detection', () => {
    it('should detect CTRL_C in input', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const eventPromise = new Promise((resolve) => {
        inputHandler.once('special-sequence', (pid, sequence) => {
          resolve({ pid, sequence });
        });
      });

      await inputHandler.queueInput(processId, 'test\x03input');

      const { pid, sequence } = await eventPromise as any;
      expect(pid).toBe(processId);
      expect(sequence).toBe('CTRL_C');
    });

    it('should detect multiple special sequences', async () => {
      const processId = 'test-process';
      inputHandler.registerProcess(processId, mockStream);

      const sequences: string[] = [];
      inputHandler.on('special-sequence', (pid, sequence) => {
        sequences.push(sequence);
      });

      await inputHandler.queueInput(processId, '\x03\n\t'); // CTRL_C, ENTER, TAB

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(sequences).toContain('CTRL_C');
      expect(sequences).toContain('ENTER');
      expect(sequences).toContain('TAB');
    });
  });

  describe('shutdown', () => {
    it('should clear all resources during shutdown', async () => {
      const processId1 = 'test-process-1';
      const processId2 = 'test-process-2';

      inputHandler.registerProcess(processId1, mockStream);
      inputHandler.registerProcess(processId2, mockStream);

      await inputHandler.queueInput(processId1, 'test1');
      await inputHandler.queueInput(processId2, 'test2');

      await inputHandler.shutdown();

      // Queues should be cleared
      expect(inputHandler.getInputQueue(processId1)).toEqual([]);
      expect(inputHandler.getInputQueue(processId2)).toEqual([]);

      // Stats should show no processes
      const stats = inputHandler.getStats();
      expect(stats.totalProcesses).toBe(0);
      expect(stats.totalQueuedItems).toBe(0);
    });
  });
});