/**
 * Tests for compatibility with Python-generated test data
 * Uses actual test files from python/test/test_data/ to verify cross-language compatibility
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseJsonlLine, parseTranscriptEntry, loadTranscript } from '../../../backend/src/parsers/jsonl-parser';
import { ITranscriptEntry, IUserTranscriptEntry, IAssistantTranscriptEntry, ISummaryTranscriptEntry } from '../interfaces';

// Path to Python test data directory
const PYTHON_TEST_DATA_DIR = path.join(__dirname, '../../../../python/test/test_data');

describe('Python Test Data Compatibility', () => {
  test('Python test data directory exists', () => {
    expect(fs.existsSync(PYTHON_TEST_DATA_DIR)).toBe(true);
  });

  describe('representative_messages.jsonl compatibility', () => {
    const testFilePath = path.join(PYTHON_TEST_DATA_DIR, 'representative_messages.jsonl');

    test('can parse representative_messages.jsonl file', () => {
      expect(fs.existsSync(testFilePath)).toBe(true);
      
      const result = loadTranscript(testFilePath, { silent: true });
      
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    });

    test('parses user messages correctly', () => {
      const result = loadTranscript(testFilePath, { silent: true });
      const userMessages = result.entries.filter((entry): entry is IUserTranscriptEntry => entry.type === 'user');
      
      expect(userMessages.length).toBeGreaterThan(0);
      
      userMessages.forEach(userMsg => {
        expect(userMsg).toHaveProperty('uuid');
        expect(userMsg).toHaveProperty('timestamp');
        expect(userMsg).toHaveProperty('sessionId');
        expect(userMsg).toHaveProperty('message');
        expect(userMsg.message.role).toBe('user');
      });
    });

    test('parses assistant messages correctly', () => {
      const result = loadTranscript(testFilePath, { silent: true });
      const assistantMessages = result.entries.filter((entry): entry is IAssistantTranscriptEntry => entry.type === 'assistant');
      
      expect(assistantMessages.length).toBeGreaterThan(0);
      
      assistantMessages.forEach(assistantMsg => {
        expect(assistantMsg).toHaveProperty('uuid');
        expect(assistantMsg).toHaveProperty('timestamp');
        expect(assistantMsg).toHaveProperty('sessionId');
        expect(assistantMsg).toHaveProperty('message');
        expect(assistantMsg.message.role).toBe('assistant');
        expect(assistantMsg.message).toHaveProperty('id');
        expect(assistantMsg.message).toHaveProperty('model');
        expect(assistantMsg.message).toHaveProperty('content');
      });
    });

    test('parses summary entries correctly', () => {
      const result = loadTranscript(testFilePath, { silent: true });
      const summaryEntries = result.entries.filter((entry): entry is ISummaryTranscriptEntry => entry.type === 'summary');
      
      if (summaryEntries.length > 0) {
        summaryEntries.forEach(summary => {
          expect(summary).toHaveProperty('summary');
          expect(summary).toHaveProperty('leafUuid');
          expect(typeof summary.summary).toBe('string');
          expect(typeof summary.leafUuid).toBe('string');
        });
      }
    });
  });

  describe('edge_cases.jsonl compatibility', () => {
    const testFilePath = path.join(PYTHON_TEST_DATA_DIR, 'edge_cases.jsonl');

    test('can parse edge_cases.jsonl file', () => {
      expect(fs.existsSync(testFilePath)).toBe(true);
      
      const result = loadTranscript(testFilePath, { silent: true });
      
      expect(result.entries.length).toBeGreaterThan(0);
      // Edge cases file intentionally contains some parsing errors for testing
      expect(result.errors.length).toBeLessThan(10);
    });

    test('handles markdown content correctly', () => {
      const result = loadTranscript(testFilePath, { silent: true });
      const userMessages = result.entries.filter((entry): entry is IUserTranscriptEntry => entry.type === 'user');
      
      // Find the first user message which should contain markdown
      const firstUser = userMessages[0];
      expect(firstUser).toBeDefined();
      
      if (firstUser && typeof firstUser.message.content === 'object' && Array.isArray(firstUser.message.content)) {
        const textContent = firstUser.message.content.find(item => item.type === 'text');
        if (textContent && 'text' in textContent) {
          expect(textContent.text).toContain('**markdown**');
          expect(textContent.text).toContain('`inline code`');
          expect(textContent.text).toContain('[link](https://example.com)');
        }
      }
    });

    test('handles tool use and tool results correctly', () => {
      const result = loadTranscript(testFilePath, { silent: true });
      const assistantMessages = result.entries.filter((entry): entry is IAssistantTranscriptEntry => entry.type === 'assistant');
      
      // Find assistant message with tool use
      const toolUseMessage = assistantMessages.find(msg => 
        Array.isArray(msg.message.content) && 
        msg.message.content.some(item => item.type === 'tool_use')
      );
      
      expect(toolUseMessage).toBeDefined();
      
      if (toolUseMessage && Array.isArray(toolUseMessage.message.content)) {
        const toolUse = toolUseMessage.message.content.find(item => item.type === 'tool_use');
        if (toolUse && 'id' in toolUse) {
          expect(toolUse).toHaveProperty('id');
          expect(toolUse).toHaveProperty('name');
          expect(toolUse).toHaveProperty('input');
        }
      }

      // Find corresponding tool result
      const userMessages = result.entries.filter((entry): entry is IUserTranscriptEntry => entry.type === 'user');
      const toolResultMessage = userMessages.find(msg => 
        Array.isArray(msg.message.content) && 
        msg.message.content.some(item => item.type === 'tool_result')
      );
      
      if (toolResultMessage && Array.isArray(toolResultMessage.message.content)) {
        const toolResult = toolResultMessage.message.content.find(item => item.type === 'tool_result');
        if (toolResult && 'tool_use_id' in toolResult) {
          expect(toolResult).toHaveProperty('tool_use_id');
          expect(toolResult).toHaveProperty('content');
          expect(toolResult).toHaveProperty('is_error');
        }
      }
    });

    test('handles complex MultiEdit tool correctly', () => {
      const result = loadTranscript(testFilePath, { silent: true });
      const assistantMessages = result.entries.filter((entry): entry is IAssistantTranscriptEntry => entry.type === 'assistant');
      
      // Find MultiEdit tool use
      const multiEditMessage = assistantMessages.find(msg => 
        Array.isArray(msg.message.content) && 
        msg.message.content.some(item => 
          item.type === 'tool_use' && 'name' in item && item.name === 'MultiEdit'
        )
      );
      
      if (multiEditMessage && Array.isArray(multiEditMessage.message.content)) {
        const toolUse = multiEditMessage.message.content.find(item => 
          item.type === 'tool_use' && 'name' in item && item.name === 'MultiEdit'
        );
        
        if (toolUse && 'input' in toolUse) {
          expect(toolUse.input).toHaveProperty('file_path');
          expect(toolUse.input).toHaveProperty('edits');
          expect(Array.isArray(toolUse.input.edits)).toBe(true);
        }
      }
    });

    test('handles usage information correctly', () => {
      const result = loadTranscript(testFilePath, { silent: true });
      const assistantMessages = result.entries.filter((entry): entry is IAssistantTranscriptEntry => entry.type === 'assistant');
      
      assistantMessages.forEach(msg => {
        if (msg.message.usage) {
          expect(msg.message.usage).toHaveProperty('input_tokens');
          expect(msg.message.usage).toHaveProperty('output_tokens');
          expect(typeof msg.message.usage.input_tokens).toBe('number');
          expect(typeof msg.message.usage.output_tokens).toBe('number');
        }
      });
    });
  });

  describe('all test files compatibility', () => {
    const testFiles = [
      'representative_messages.jsonl',
      'edge_cases.jsonl',
      'session_b.jsonl',
      'sidechain.jsonl',
      'system_model_change.jsonl',
      'todowrite_examples.jsonl'
    ];

    testFiles.forEach(filename => {
      test(`can parse ${filename}`, () => {
        const testFilePath = path.join(PYTHON_TEST_DATA_DIR, filename);
        
        if (fs.existsSync(testFilePath)) {
          const result = loadTranscript(testFilePath, { silent: true });
          
          expect(result.entries.length).toBeGreaterThan(0);
          // Allow some parsing errors but not complete failure
          expect(result.errors.length).toBeLessThan(result.entries.length);
          
          // Verify each entry has required fields
          result.entries.forEach((entry, index) => {
            expect(entry).toHaveProperty('type');
            expect(['user', 'assistant', 'summary', 'system']).toContain(entry.type);
            
            if (entry.type === 'user' || entry.type === 'assistant') {
              expect(entry).toHaveProperty('uuid');
              expect(entry).toHaveProperty('timestamp');
              expect(entry).toHaveProperty('sessionId');
            }
          });
        }
      });
    });
  });

  describe('line-by-line parsing validation', () => {
    test('parses each line from edge_cases.jsonl individually', () => {
      const testFilePath = path.join(PYTHON_TEST_DATA_DIR, 'edge_cases.jsonl');
      
      if (fs.existsSync(testFilePath)) {
        const content = fs.readFileSync(testFilePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        
        lines.forEach((line, index) => {
          const result = parseJsonlLine(line, index + 1);
          
          // Some lines may have intentional parse errors for edge case testing
          if (!('error' in result)) {
            // Should have correct structure
            expect(result).toHaveProperty('type');
            expect(['user', 'assistant', 'summary', 'system']).toContain(result.type);
          } else {
            // Parse errors should have proper error structure
            expect(result).toHaveProperty('lineNumber');
            expect(result).toHaveProperty('error');
            expect(result).toHaveProperty('line');
          }
        });
      }
    });
  });

  describe('session consistency', () => {
    test('messages within same session have consistent sessionId', () => {
      const testFilePath = path.join(PYTHON_TEST_DATA_DIR, 'representative_messages.jsonl');
      
      if (fs.existsSync(testFilePath)) {
        const result = loadTranscript(testFilePath, { silent: true });
        const sessionIds = new Set();
        
        result.entries.forEach(entry => {
          if (entry.type === 'user' || entry.type === 'assistant') {
            sessionIds.add(entry.sessionId);
          }
        });
        
        // Should have at least one session
        expect(sessionIds.size).toBeGreaterThan(0);
        
        // All messages in each session should have consistent data
        sessionIds.forEach(sessionId => {
          const sessionEntries = result.entries.filter(entry => 
            (entry.type === 'user' || entry.type === 'assistant') && 
            entry.sessionId === sessionId
          );
          
          expect(sessionEntries.length).toBeGreaterThan(0);
          
          // Check timestamp ordering
          const timestamps = sessionEntries.map(entry => 
            entry.type !== 'summary' ? new Date(entry.timestamp) : new Date()
          );
          for (let i = 1; i < timestamps.length; i++) {
            expect(timestamps[i].getTime()).toBeGreaterThanOrEqual(timestamps[i-1].getTime());
          }
        });
      }
    });
  });
});