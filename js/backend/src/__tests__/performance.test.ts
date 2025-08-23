/**
 * Performance tests for JSONL parser
 * Tests parsing speed and memory usage with large files
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadTranscript, parseJsonlLine } from '../parsers/jsonl-parser';

describe('JSONL Parser Performance', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-perf-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('parses large file in reasonable time', () => {
    // Create a large test file with 1000 entries
    const sampleEntry = {
      type: 'user',
      uuid: 'user-uuid-{{INDEX}}',
      timestamp: '2025-01-15T10:30:{{INDEX}}.000Z',
      sessionId: 'session-{{SESSION}}',
      parentUuid: null,
      isSidechain: false,
      userType: 'human',
      cwd: '/test/path',
      version: '1.0.0',
      message: {
        role: 'user',
        content: 'This is test message number {{INDEX}} with some content that simulates real user input. ' +
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
                'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
                'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.'
      }
    };

    const lines: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const entry = JSON.parse(JSON.stringify(sampleEntry)
        .replace(/\{\{INDEX\}\}/g, i.toString().padStart(2, '0'))
        .replace(/\{\{SESSION\}\}/g, Math.floor(i / 10).toString()));
      lines.push(JSON.stringify(entry));
    }

    const content = lines.join('\n');
    const filePath = path.join(tempDir, 'large-test.jsonl');
    fs.writeFileSync(filePath, content);

    // Measure parsing time
    const startTime = process.hrtime.bigint();
    const result = loadTranscript(filePath, { silent: true });
    const endTime = process.hrtime.bigint();

    const durationMs = Number(endTime - startTime) / 1_000_000;

    expect(result.entries).toHaveLength(1000);
    expect(result.errors).toHaveLength(0);
    
    // Should parse 1000 entries in less than 5 seconds
    expect(durationMs).toBeLessThan(5000);
    
    // Log performance for monitoring
    console.log(`Parsed 1000 entries in ${durationMs.toFixed(2)}ms (${(1000 / durationMs * 1000).toFixed(0)} entries/sec)`);
  });

  test('parses very large individual messages efficiently', () => {
    // Create entries with very large content
    const largeContent = 'A'.repeat(100000); // 100KB of text
    
    const entry = {
      type: 'user',
      uuid: 'large-message-uuid',
      timestamp: '2025-01-15T10:30:00.000Z',
      sessionId: 'large-session',
      parentUuid: null,
      isSidechain: false,
      userType: 'human',
      cwd: '/test/path',
      version: '1.0.0',
      message: {
        role: 'user',
        content: largeContent
      }
    };

    const line = JSON.stringify(entry);
    
    const startTime = process.hrtime.bigint();
    const result = parseJsonlLine(line, 1);
    const endTime = process.hrtime.bigint();

    const durationMs = Number(endTime - startTime) / 1_000_000;

    expect(result).not.toHaveProperty('error');
    expect(durationMs).toBeLessThan(100); // Should parse large message in <100ms
    
    console.log(`Parsed 100KB message in ${durationMs.toFixed(2)}ms`);
  });

  test('handles memory efficiently with many small messages', () => {
    // Create many small messages to test memory handling
    const entries: string[] = [];
    
    for (let i = 0; i < 5000; i++) {
      const entry = {
        type: 'assistant',
        uuid: `msg-${i}`,
        timestamp: `2025-01-15T10:${Math.floor(i / 60).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}.000Z`,
        sessionId: `session-${Math.floor(i / 100)}`,
        parentUuid: i > 0 ? `msg-${i-1}` : null,
        isSidechain: false,
        userType: 'assistant',
        cwd: '/test',
        version: '1.0.0',
        message: {
          id: `assistant-${i}`,
          type: 'message',
          role: 'assistant',
          model: 'claude-3-sonnet',
          content: [{ type: 'text', text: `Response ${i}` }],
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 10 + (i % 20),
            output_tokens: 5 + (i % 10)
          }
        }
      };
      entries.push(JSON.stringify(entry));
    }

    const content = entries.join('\n');
    const filePath = path.join(tempDir, 'many-small.jsonl');
    fs.writeFileSync(filePath, content);

    const startTime = process.hrtime.bigint();
    const result = loadTranscript(filePath, { silent: true });
    const endTime = process.hrtime.bigint();

    const durationMs = Number(endTime - startTime) / 1_000_000;

    expect(result.entries).toHaveLength(5000);
    expect(result.errors).toHaveLength(0);
    expect(durationMs).toBeLessThan(10000); // Should parse 5000 entries in <10s
    
    console.log(`Parsed 5000 small messages in ${durationMs.toFixed(2)}ms`);
  });

  test('gracefully handles corrupted large files', () => {
    // Create file with mix of valid and invalid lines
    const lines: string[] = [];
    
    for (let i = 0; i < 100; i++) {
      if (i % 10 === 7) {
        // Add corrupted line every 10th entry
        lines.push('{ invalid json on line ' + i + ' }');
      } else {
        const entry = {
          type: 'user',
          uuid: `user-${i}`,
          timestamp: `2025-01-15T10:30:${(i % 60).toString().padStart(2, '0')}.000Z`,
          sessionId: 'session-mixed',
          parentUuid: null,
          isSidechain: false,
          userType: 'human',
          cwd: '/test',
          version: '1.0.0',
          message: {
            role: 'user',
            content: `Message ${i}`
          }
        };
        lines.push(JSON.stringify(entry));
      }
    }

    const content = lines.join('\n');
    const filePath = path.join(tempDir, 'corrupted.jsonl');
    fs.writeFileSync(filePath, content);

    const startTime = process.hrtime.bigint();
    const result = loadTranscript(filePath, { silent: true, skipMalformed: true });
    const endTime = process.hrtime.bigint();

    const durationMs = Number(endTime - startTime) / 1_000_000;

    // Should successfully parse valid entries
    expect(result.entries.length).toBe(90); // 100 - 10 corrupted
    expect(result.errors.length).toBe(10); // 10 corrupted lines
    expect(durationMs).toBeLessThan(1000); // Should handle corruption gracefully
    
    console.log(`Parsed file with 10% corruption in ${durationMs.toFixed(2)}ms`);
  });

  test('streaming parser performance simulation', () => {
    // Simulate streaming by parsing lines one by one
    const numLines = 1000;
    const lines: string[] = [];
    
    for (let i = 0; i < numLines; i++) {
      const entry = {
        type: 'user',
        uuid: `stream-${i}`,
        timestamp: `2025-01-15T${Math.floor(i / 3600).toString().padStart(2, '0')}:${Math.floor((i % 3600) / 60).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}.000Z`,
        sessionId: `stream-session-${Math.floor(i / 50)}`,
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/test',
        version: '1.0.0',
        message: {
          role: 'user',
          content: `Streaming message ${i}`
        }
      };
      lines.push(JSON.stringify(entry));
    }

    const startTime = process.hrtime.bigint();
    const results = [];
    
    for (let i = 0; i < lines.length; i++) {
      const result = parseJsonlLine(lines[i], i + 1);
      results.push(result);
    }
    
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    expect(results).toHaveLength(numLines);
    expect(results.filter(r => !('error' in r))).toHaveLength(numLines);
    expect(durationMs).toBeLessThan(2000); // Streaming should be fast
    
    console.log(`Streamed ${numLines} lines in ${durationMs.toFixed(2)}ms`);
  });
});