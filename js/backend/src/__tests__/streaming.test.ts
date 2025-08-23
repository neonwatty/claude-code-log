/**
 * Tests for streaming parser functionality
 * Tests interrupted reads, partial data, and streaming scenarios
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseJsonlLine, loadTranscript } from '../parsers/jsonl-parser';

describe('Streaming Parser Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streaming-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('line-by-line streaming', () => {
    test('processes lines incrementally as they arrive', () => {
      const sampleLines = [
        {
          type: 'user',
          uuid: 'user-1',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'streaming-session',
          parentUuid: null,
          isSidechain: false,
          userType: 'human',
          cwd: '/test',
          version: '1.0.0',
          message: { role: 'user', content: 'First message' }
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          timestamp: '2025-01-15T10:30:30.000Z',
          sessionId: 'streaming-session',
          parentUuid: 'user-1',
          isSidechain: false,
          userType: 'assistant',
          cwd: '/test',
          version: '1.0.0',
          message: {
            id: 'msg-1',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-sonnet',
            content: [{ type: 'text', text: 'First response' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 15 }
          }
        },
        {
          type: 'user',
          uuid: 'user-2',
          timestamp: '2025-01-15T10:31:00.000Z',
          sessionId: 'streaming-session',
          parentUuid: 'assistant-1',
          isSidechain: false,
          userType: 'human',
          cwd: '/test',
          version: '1.0.0',
          message: { role: 'user', content: 'Second message' }
        }
      ];

      const processedEntries = [];
      const errors = [];

      // Simulate streaming by processing one line at a time
      sampleLines.forEach((entry, index) => {
        const jsonLine = JSON.stringify(entry);
        const result = parseJsonlLine(jsonLine, index + 1);
        
        if ('error' in result) {
          errors.push(result);
        } else {
          processedEntries.push(result);
        }
      });

      expect(processedEntries).toHaveLength(3);
      expect(errors).toHaveLength(0);
      expect(processedEntries[0].type).toBe('user');
      expect(processedEntries[1].type).toBe('assistant');
      expect(processedEntries[2].type).toBe('user');
    });

    test('handles partial lines gracefully', () => {
      const completeEntry = {
        type: 'user',
        uuid: 'user-partial',
        timestamp: '2025-01-15T10:30:00.000Z',
        sessionId: 'partial-session',
        message: { role: 'user', content: 'Complete message' }
      };

      const completeLine = JSON.stringify(completeEntry);
      const partialLines = [
        completeLine.substring(0, 20),
        completeLine.substring(0, 50),
        completeLine.substring(0, 80),
        completeLine // complete line
      ];

      let lastResult;
      partialLines.forEach((partialLine, index) => {
        const result = parseJsonlLine(partialLine, index + 1);
        lastResult = result;
        
        if (index < partialLines.length - 1) {
          // Partial lines should result in parse errors
          expect(result).toHaveProperty('error');
        }
      });

      // Final complete line should parse successfully
      expect(lastResult).not.toHaveProperty('error');
      if (lastResult && !('error' in lastResult)) {
        expect(lastResult.type).toBe('user');
      }
    });

    test('recovers from corrupted lines in stream', () => {
      const streamLines = [
        JSON.stringify({
          type: 'user',
          uuid: 'user-1',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'recovery-session',
          message: { role: 'user', content: 'Before corruption' }
        }),
        '{ corrupted json line }',
        'another bad line',
        JSON.stringify({
          type: 'user',
          uuid: 'user-2',
          timestamp: '2025-01-15T10:31:00.000Z',
          sessionId: 'recovery-session',
          message: { role: 'user', content: 'After corruption' }
        }),
        JSON.stringify({
          type: 'assistant',
          uuid: 'assistant-1',
          timestamp: '2025-01-15T10:31:30.000Z',
          sessionId: 'recovery-session',
          message: {
            id: 'msg-1',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-sonnet',
            content: [{ type: 'text', text: 'Recovery successful' }]
          }
        })
      ];

      const processedEntries = [];
      const errors = [];

      streamLines.forEach((line, index) => {
        const result = parseJsonlLine(line, index + 1);
        
        if ('error' in result) {
          errors.push(result);
        } else {
          processedEntries.push(result);
        }
      });

      expect(processedEntries).toHaveLength(3); // 3 valid entries
      expect(errors).toHaveLength(2); // 2 corrupted lines
      expect(processedEntries[0].message.content).toBe('Before corruption');
      expect(processedEntries[1].message.content).toBe('After corruption');
    });
  });

  describe('interrupted file reads', () => {
    test('handles incomplete file reads gracefully', () => {
      const fullContent = [
        JSON.stringify({
          type: 'user',
          uuid: 'user-1',
          timestamp: '2025-01-15T10:30:00.000Z',
          sessionId: 'interrupt-session',
          message: { role: 'user', content: 'First complete message' }
        }),
        JSON.stringify({
          type: 'user',
          uuid: 'user-2',
          timestamp: '2025-01-15T10:30:30.000Z',
          sessionId: 'interrupt-session',
          message: { role: 'user', content: 'Second complete message' }
        }),
        JSON.stringify({
          type: 'user',
          uuid: 'user-3',
          timestamp: '2025-01-15T10:31:00.000Z',
          sessionId: 'interrupt-session',
          message: { role: 'user', content: 'Third message that will be cut off' }
        })
      ].join('\n');

      // Simulate interrupted read by cutting off the last line
      const interruptedContent = fullContent.substring(0, fullContent.length - 50);
      
      const filePath = path.join(tempDir, 'interrupted.jsonl');
      fs.writeFileSync(filePath, interruptedContent);

      const result = loadTranscript(filePath, { silent: true, skipMalformed: true });

      // Should successfully parse the complete lines
      expect(result.entries).toHaveLength(2);
      expect(result.errors).toHaveLength(1); // One incomplete line
      if (result.entries[0].type === 'user') {
        expect(result.entries[0].message.content).toBe('First complete message');
      }
      if (result.entries[1].type === 'user') {
        expect(result.entries[1].message.content).toBe('Second complete message');
      }
    });

    test('handles file that ends mid-JSON gracefully', () => {
      const partialJson = '{"type":"user","uuid":"partial-uuid","timestamp":"2025-01-15T10:30:00.000Z","sessionId":"partial-session","message":{"role":"user","content":"This JSON will be cut o';
      
      const filePath = path.join(tempDir, 'partial.jsonl');
      fs.writeFileSync(filePath, partialJson);

      const result = loadTranscript(filePath, { silent: true, skipMalformed: true });

      expect(result.entries).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].lineNumber).toBe(1);
    });

    test('handles empty file gracefully', () => {
      const filePath = path.join(tempDir, 'empty.jsonl');
      fs.writeFileSync(filePath, '');

      const result = loadTranscript(filePath, { silent: true });

      expect(result.entries).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    test('handles file with only whitespace', () => {
      const filePath = path.join(tempDir, 'whitespace.jsonl');
      fs.writeFileSync(filePath, '   \n\t\n   \n');

      const result = loadTranscript(filePath, { silent: true, skipMalformed: true });

      expect(result.entries).toHaveLength(0);
      // Empty lines are skipped, not counted as errors in current implementation
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('real-time streaming simulation', () => {
    test('processes messages as they arrive in real conversation', () => {
      // Simulate a real conversation with timing
      const conversationFlow = [
        {
          entry: {
            type: 'user',
            uuid: 'user-real-1',
            timestamp: '2025-01-15T10:30:00.000Z',
            sessionId: 'real-conversation',
            message: { role: 'user', content: 'Hello Claude!' }
          },
          delay: 0
        },
        {
          entry: {
            type: 'assistant',
            uuid: 'assistant-real-1',
            timestamp: '2025-01-15T10:30:02.000Z',
            sessionId: 'real-conversation',
            message: {
              id: 'msg-real-1',
              type: 'message',
              role: 'assistant',
              model: 'claude-3-sonnet',
              content: [{ type: 'text', text: 'Hello! How can I help you today?' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 8, output_tokens: 12 }
            }
          },
          delay: 2000
        },
        {
          entry: {
            type: 'user',
            uuid: 'user-real-2',
            timestamp: '2025-01-15T10:30:10.000Z',
            sessionId: 'real-conversation',
            message: { role: 'user', content: 'Can you help me with TypeScript?' }
          },
          delay: 8000
        }
      ];

      const processedEntries = [];
      const processingTimes = [];

      conversationFlow.forEach((item, index) => {
        const startTime = process.hrtime.bigint();
        const jsonLine = JSON.stringify(item.entry);
        const result = parseJsonlLine(jsonLine, index + 1);
        const endTime = process.hrtime.bigint();

        const processingTimeMs = Number(endTime - startTime) / 1_000_000;
        processingTimes.push(processingTimeMs);

        expect(result).not.toHaveProperty('error');
        if (!('error' in result)) {
          processedEntries.push(result);
        }
      });

      expect(processedEntries).toHaveLength(3);
      expect(processedEntries[0].type).toBe('user');
      expect(processedEntries[1].type).toBe('assistant');
      expect(processedEntries[2].type).toBe('user');

      // Each message should process quickly (< 10ms)
      processingTimes.forEach(time => {
        expect(time).toBeLessThan(10);
      });
    });

    test('handles burst of messages efficiently', () => {
      // Simulate a burst of messages arriving quickly
      const burstMessages = [];
      for (let i = 0; i < 50; i++) {
        burstMessages.push({
          type: 'user',
          uuid: `burst-${i}`,
          timestamp: `2025-01-15T10:30:${i.toString().padStart(2, '0')}.000Z`,
          sessionId: 'burst-session',
          message: { role: 'user', content: `Burst message ${i}` }
        });
      }

      const startTime = process.hrtime.bigint();
      const processedEntries = [];

      burstMessages.forEach((entry, index) => {
        const jsonLine = JSON.stringify(entry);
        const result = parseJsonlLine(jsonLine, index + 1);
        
        expect(result).not.toHaveProperty('error');
        if (!('error' in result)) {
          processedEntries.push(result);
        }
      });

      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1_000_000;

      expect(processedEntries).toHaveLength(50);
      expect(totalTimeMs).toBeLessThan(100); // Should process 50 messages in < 100ms
      
      console.log(`Processed 50 burst messages in ${totalTimeMs.toFixed(2)}ms`);
    });
  });

  describe('memory management during streaming', () => {
    test('does not accumulate excessive memory during long streams', () => {
      // This test simulates processing a very long stream
      // and verifies that memory usage remains reasonable
      
      const getMemoryUsage = () => {
        if (process.memoryUsage) {
          return process.memoryUsage().heapUsed / 1024 / 1024; // MB
        }
        return 0;
      };

      const initialMemory = getMemoryUsage();
      let maxMemoryIncrease = 0;

      // Process 1000 messages one by one
      for (let i = 0; i < 1000; i++) {
        const entry = {
          type: 'user',
          uuid: `memory-${i}`,
          timestamp: `2025-01-15T${Math.floor(i / 3600).toString().padStart(2, '0')}:${Math.floor((i % 3600) / 60).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}.000Z`,
          sessionId: 'memory-session',
          message: { role: 'user', content: `Memory test message ${i}` }
        };

        const jsonLine = JSON.stringify(entry);
        const result = parseJsonlLine(jsonLine, i + 1);
        
        expect(result).not.toHaveProperty('error');

        // Check memory every 100 messages
        if (i % 100 === 0) {
          const currentMemory = getMemoryUsage();
          const memoryIncrease = currentMemory - initialMemory;
          maxMemoryIncrease = Math.max(maxMemoryIncrease, memoryIncrease);
        }
      }

      // Memory increase should be reasonable (< 50MB for 1000 messages)
      expect(maxMemoryIncrease).toBeLessThan(50);
      
      console.log(`Max memory increase during streaming: ${maxMemoryIncrease.toFixed(2)}MB`);
    });
  });

  describe('concurrent streaming scenarios', () => {
    test('handles multiple concurrent parse operations', () => {
      const concurrentEntries = Array.from({ length: 10 }, (_, i) => ({
        type: 'user',
        uuid: `concurrent-${i}`,
        timestamp: '2025-01-15T10:30:00.000Z',
        sessionId: `concurrent-session-${i}`,
        message: { role: 'user', content: `Concurrent message ${i}` }
      }));

      // Process all entries simultaneously
      const promises = concurrentEntries.map((entry, index) => {
        return new Promise<any>((resolve) => {
          setTimeout(() => {
            const jsonLine = JSON.stringify(entry);
            const result = parseJsonlLine(jsonLine, index + 1);
            resolve(result);
          }, Math.random() * 10); // Random delay 0-10ms
        });
      });

      return Promise.all(promises).then(results => {
        expect(results).toHaveLength(10);
        results.forEach((result, index) => {
          expect(result).not.toHaveProperty('error');
          if (!('error' in result)) {
            expect(result.type).toBe('user');
            expect(result.uuid).toBe(`concurrent-${index}`);
          }
        });
      });
    });
  });
});