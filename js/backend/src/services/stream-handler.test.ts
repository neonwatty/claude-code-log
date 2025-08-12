import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import StreamHandler, { ParsedOutput } from './stream-handler';
import { Writable } from 'stream';

describe('StreamHandler', () => {
  let streamHandler: StreamHandler;

  beforeEach(() => {
    streamHandler = new StreamHandler();
  });

  describe('createStreamHandlers', () => {
    it('should create stdout and stderr handlers', () => {
      const processId = 'test-process';
      const handlers = streamHandler.createStreamHandlers(processId);

      expect(handlers.stdoutHandler).toBeInstanceOf(Writable);
      expect(handlers.stderrHandler).toBeInstanceOf(Writable);
    });

    it('should emit raw-data events when data is written', (done) => {
      const processId = 'test-process';
      const testData = Buffer.from('test output');

      streamHandler.once('raw-data', (pid, type, data) => {
        expect(pid).toBe(processId);
        expect(type).toBe('stdout');
        expect(data).toEqual(testData);
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(testData);
    });
  });

  describe('line processing', () => {
    it('should emit line-complete events for complete lines', (done) => {
      const processId = 'test-process';

      streamHandler.once('line-complete', (pid, type, line) => {
        expect(pid).toBe(processId);
        expect(type).toBe('stdout');
        expect(line).toBe('hello world');
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('hello world\n'));
    });

    it('should buffer incomplete lines', () => {
      const processId = 'test-process';
      const handlers = streamHandler.createStreamHandlers(processId);

      // Write incomplete line
      handlers.stdoutHandler.write(Buffer.from('hello '));
      
      const buffer = streamHandler.getBuffer(processId, 'stdout');
      expect(buffer).toBe('hello ');
    });

    it('should complete buffered lines when more data arrives', (done) => {
      const processId = 'test-process';
      let lineCount = 0;

      streamHandler.on('line-complete', (pid, type, line) => {
        lineCount++;
        if (lineCount === 1) {
          expect(line).toBe('hello world');
        }
        if (lineCount === 1) {
          done();
        }
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('hello '));
      handlers.stdoutHandler.write(Buffer.from('world\n'));
    });
  });

  describe('JSON detection', () => {
    it('should detect JSON objects', (done) => {
      const processId = 'test-process';

      streamHandler.once('json-detected', (pid, data) => {
        expect(pid).toBe(processId);
        expect(data).toEqual({ message: 'hello', code: 200 });
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('{"message": "hello", "code": 200}\n'));
    });

    it('should detect JSON arrays', (done) => {
      const processId = 'test-process';

      streamHandler.once('json-detected', (pid, data) => {
        expect(pid).toBe(processId);
        expect(data).toEqual([1, 2, 3]);
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('[1, 2, 3]\n'));
    });

    it('should handle invalid JSON gracefully', (done) => {
      const processId = 'test-process';

      streamHandler.once('parsed-output', (pid, output) => {
        expect(pid).toBe(processId);
        expect(output.parsed?.isJson).toBe(false);
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('{ invalid json\n'));
    });
  });

  describe('tool use detection', () => {
    it('should detect function calls', (done) => {
      const processId = 'test-process';

      streamHandler.once('tool-use-detected', (pid, toolData) => {
        expect(pid).toBe(processId);
        expect(toolData.line).toContain('<function_calls>');
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('<function_calls>\n'));
    });
  });

  describe('markdown detection', () => {
    it('should detect markdown headers', (done) => {
      const processId = 'test-process';

      streamHandler.once('markdown-detected', (pid, markdown) => {
        expect(pid).toBe(processId);
        expect(markdown).toBe('# Title');
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('# Title\n'));
    });

    it('should detect markdown code blocks', (done) => {
      const processId = 'test-process';

      streamHandler.once('markdown-detected', (pid, markdown) => {
        expect(pid).toBe(processId);
        expect(markdown).toBe('```javascript');
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('```javascript\n'));
    });

    it('should detect markdown lists', (done) => {
      const processId = 'test-process';

      streamHandler.once('markdown-detected', (pid, markdown) => {
        expect(pid).toBe(processId);
        expect(markdown).toBe('- List item');
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('- List item\n'));
    });
  });

  describe('ANSI escape code handling', () => {
    it('should detect ANSI codes in output', (done) => {
      const processId = 'test-process';

      streamHandler.once('parsed-output', (pid, output) => {
        expect(pid).toBe(processId);
        expect(output.parsed?.hasAnsiCodes).toBe(true);
        expect(output.content).toContain('\x1b[31m'); // Original with ANSI
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('\x1b[31mRed text\x1b[0m\n'));
    });

    it('should strip ANSI codes for analysis', (done) => {
      const processId = 'test-process';

      streamHandler.once('parsed-output', (pid, output) => {
        // The JSON should be detected even with ANSI codes
        expect(output.parsed?.isJson).toBe(true);
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('\x1b[32m{"clean": "json"}\x1b[0m\n'));
    });
  });

  describe('buffer management', () => {
    it('should return current buffer content', () => {
      const processId = 'test-process';
      const handlers = streamHandler.createStreamHandlers(processId);

      handlers.stdoutHandler.write(Buffer.from('partial'));
      handlers.stderrHandler.write(Buffer.from('error'));

      const allBuffers = streamHandler.getBuffer(processId);
      expect(allBuffers).toEqual({
        stdout: 'partial',
        stderr: 'error',
      });

      const stdoutBuffer = streamHandler.getBuffer(processId, 'stdout');
      expect(stdoutBuffer).toBe('partial');
    });

    it('should return undefined for non-existent process', () => {
      const buffer = streamHandler.getBuffer('non-existent');
      expect(buffer).toBeUndefined();
    });
  });

  describe('flushBuffer', () => {
    it('should flush remaining buffer content as complete lines', (done) => {
      const processId = 'test-process';
      let lineReceived = false;

      streamHandler.on('line-complete', (pid, type, line) => {
        if (!lineReceived) {
          expect(pid).toBe(processId);
          expect(type).toBe('stdout');
          expect(line).toBe('final output');
          lineReceived = true;
          done();
        }
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('final output'));
      
      // Flush should process the remaining buffer
      streamHandler.flushBuffer(processId);
    });
  });

  describe('clearBuffer', () => {
    it('should clear all buffers for a process', () => {
      const processId = 'test-process';
      const handlers = streamHandler.createStreamHandlers(processId);

      handlers.stdoutHandler.write(Buffer.from('test'));
      
      // Buffer should have content
      let buffer = streamHandler.getBuffer(processId, 'stdout');
      expect(buffer).toBe('test');

      streamHandler.clearBuffer(processId);

      // Buffer should be cleared
      buffer = streamHandler.getBuffer(processId, 'stdout');
      expect(buffer).toBeUndefined();
    });
  });

  describe('createTransformStream', () => {
    it('should create a transform stream that passes data through', (done) => {
      const processId = 'test-process';
      streamHandler.createStreamHandlers(processId); // Initialize buffers

      const transformStream = streamHandler.createTransformStream(processId, 'stdout');
      
      let dataReceived = false;
      transformStream.on('data', (data) => {
        expect(data.toString()).toBe('test data');
        if (!dataReceived) {
          dataReceived = true;
          done();
        }
      });

      transformStream.write(Buffer.from('test data'));
    });
  });

  describe('analyzeOutput', () => {
    it('should analyze complete output string for patterns', () => {
      const output = `
# Markdown Header
Regular text
{"json": "data"}
<function_calls>
\x1b[31mColored text\x1b[0m
- List item
      `;

      const analysis = streamHandler.analyzeOutput(output);

      expect(analysis.hasJson).toBe(true);
      expect(analysis.hasToolUse).toBe(true);
      expect(analysis.hasMarkdown).toBe(true);
      expect(analysis.hasAnsiCodes).toBe(true);
      expect(analysis.jsonBlocks).toHaveLength(1);
      expect(analysis.jsonBlocks[0]).toEqual({ json: 'data' });
    });

    it('should handle multiline JSON blocks', () => {
      const output = `
{
  "multiline": "json",
  "with": ["arrays", "and", "objects"]
}
      `;

      const analysis = streamHandler.analyzeOutput(output);

      expect(analysis.hasJson).toBe(true);
      expect(analysis.jsonBlocks).toHaveLength(1);
      expect(analysis.jsonBlocks[0]).toEqual({
        multiline: 'json',
        with: ['arrays', 'and', 'objects'],
      });
    });

    it('should return empty analysis for simple text', () => {
      const output = 'Simple text output without special patterns';

      const analysis = streamHandler.analyzeOutput(output);

      expect(analysis.hasJson).toBe(false);
      expect(analysis.hasToolUse).toBe(false);
      expect(analysis.hasMarkdown).toBe(false);
      expect(analysis.hasAnsiCodes).toBe(false);
      expect(analysis.jsonBlocks).toHaveLength(0);
      expect(analysis.toolUseBlocks).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should emit error events on processing errors', (done) => {
      const processId = 'test-process';

      streamHandler.once('error', (pid, error) => {
        expect(pid).toBe(processId);
        expect(error).toBeInstanceOf(Error);
        done();
      });

      // Simulate an error in the stream handler
      const handlers = streamHandler.createStreamHandlers(processId);
      
      // Mock a scenario that would cause an error in processing
      vi.spyOn(streamHandler as any, 'processLine').mockImplementationOnce(() => {
        throw new Error('Processing error');
      });

      handlers.stdoutHandler.write(Buffer.from('error trigger\n'));
    });
  });

  describe('parsed output events', () => {
    it('should emit parsed-output events with correct format', (done) => {
      const processId = 'test-process';

      streamHandler.once('parsed-output', (pid, output) => {
        expect(pid).toBe(processId);
        expect(output).toHaveProperty('type');
        expect(output).toHaveProperty('content');
        expect(output).toHaveProperty('timestamp');
        expect(output).toHaveProperty('parsed');
        expect(output.timestamp).toBeInstanceOf(Date);
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stdoutHandler.write(Buffer.from('test output\n'));
    });

    it('should handle stderr output correctly', (done) => {
      const processId = 'test-process';

      streamHandler.once('parsed-output', (pid, output) => {
        expect(pid).toBe(processId);
        expect(output.type).toBe('stderr');
        expect(output.content).toBe('error message');
        done();
      });

      const handlers = streamHandler.createStreamHandlers(processId);
      handlers.stderrHandler.write(Buffer.from('error message\n'));
    });
  });
});