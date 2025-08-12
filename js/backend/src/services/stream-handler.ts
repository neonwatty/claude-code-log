import { EventEmitter } from 'events';
import { Transform, Writable } from 'stream';

export interface ParsedOutput {
  type: 'stdout' | 'stderr';
  content: string;
  timestamp: Date;
  parsed?: {
    isJson?: boolean;
    isMarkdown?: boolean;
    isToolUse?: boolean;
    hasAnsiCodes?: boolean;
    data?: any;
  };
}

export interface StreamHandlerEvents {
  'parsed-output': (processId: string, output: ParsedOutput) => void;
  'raw-data': (processId: string, type: 'stdout' | 'stderr', data: Buffer) => void;
  'line-complete': (processId: string, type: 'stdout' | 'stderr', line: string) => void;
  'json-detected': (processId: string, data: any) => void;
  'tool-use-detected': (processId: string, toolData: any) => void;
  'markdown-detected': (processId: string, markdown: string) => void;
  'error': (processId: string, error: Error) => void;
}

declare interface StreamHandler {
  on<U extends keyof StreamHandlerEvents>(
    event: U, listener: StreamHandlerEvents[U]
  ): this;
  
  emit<U extends keyof StreamHandlerEvents>(
    event: U, ...args: Parameters<StreamHandlerEvents[U]>
  ): boolean;
}

/**
 * StreamHandler manages parsing and buffering of Claude Code CLI output streams
 * with support for JSON detection, markdown parsing, and ANSI escape code handling.
 */
class StreamHandler extends EventEmitter {
  private buffers = new Map<string, {
    stdout: string;
    stderr: string;
  }>();

  // ANSI escape sequence regex patterns
  private static readonly ANSI_ESCAPE_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;
  private static readonly ANSI_COLOR_REGEX = /\x1b\[[\d;]+m/g;
  
  // Claude Code specific patterns
  private static readonly JSON_START_REGEX = /^\s*[\{\[]]/;
  private static readonly TOOL_USE_REGEX = /<function_calls>/;
  private static readonly MARKDOWN_HEADER_REGEX = /^#{1,6}\s/;
  private static readonly MARKDOWN_CODE_BLOCK_REGEX = /^```/;

  constructor() {
    super();
  }

  /**
   * Creates stream handlers for a process
   */
  createStreamHandlers(processId: string) {
    // Initialize buffers for this process
    this.buffers.set(processId, {
      stdout: '',
      stderr: '',
    });

    const stdoutHandler = new Writable({
      write: (chunk: Buffer, _encoding, callback) => {
        this.handleData(processId, 'stdout', chunk);
        callback();
      }
    });

    const stderrHandler = new Writable({
      write: (chunk: Buffer, _encoding, callback) => {
        this.handleData(processId, 'stderr', chunk);
        callback();
      }
    });

    return { stdoutHandler, stderrHandler };
  }

  /**
   * Handles incoming data from streams
   */
  private handleData(processId: string, type: 'stdout' | 'stderr', data: Buffer): void {
    try {
      // Emit raw data event
      this.emit('raw-data', processId, type, data);

      const bufferEntry = this.buffers.get(processId);
      if (!bufferEntry) {
        console.warn(`No buffer found for process ${processId}`);
        return;
      }

      // Convert buffer to string and add to appropriate buffer
      const chunk = data.toString('utf8');
      bufferEntry[type] += chunk;

      // Process complete lines
      this.processLines(processId, type);

    } catch (error) {
      this.emit('error', processId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Processes complete lines from buffers
   */
  private processLines(processId: string, type: 'stdout' | 'stderr'): void {
    const bufferEntry = this.buffers.get(processId);
    if (!bufferEntry) return;

    const buffer = bufferEntry[type];
    const lines = buffer.split('\n');
    
    // Keep the last incomplete line in the buffer
    bufferEntry[type] = lines.pop() || '';

    // Process complete lines
    for (const line of lines) {
      if (line.length > 0) {
        this.processLine(processId, type, line);
      }
    }
  }

  /**
   * Processes a single complete line
   */
  private processLine(processId: string, type: 'stdout' | 'stderr', line: string): void {
    // Emit line complete event
    this.emit('line-complete', processId, type, line);

    // Parse the line and create output object
    const parsedOutput = this.parseLine(type, line);
    
    // Emit parsed output
    this.emit('parsed-output', processId, parsedOutput);

    // Emit specific detection events
    if (parsedOutput.parsed?.isJson && parsedOutput.parsed.data) {
      this.emit('json-detected', processId, parsedOutput.parsed.data);
    }

    if (parsedOutput.parsed?.isToolUse) {
      this.emit('tool-use-detected', processId, { line, timestamp: parsedOutput.timestamp });
    }

    if (parsedOutput.parsed?.isMarkdown) {
      this.emit('markdown-detected', processId, line);
    }
  }

  /**
   * Parses a line and determines its type and content
   */
  private parseLine(type: 'stdout' | 'stderr', line: string): ParsedOutput {
    const timestamp = new Date();
    
    // Remove ANSI escape codes for analysis
    const cleanLine = this.stripAnsiCodes(line);
    const hasAnsiCodes = cleanLine !== line;

    const parsed: ParsedOutput['parsed'] = {
      hasAnsiCodes,
    };

    // Check if it's JSON
    if (this.isJsonLine(cleanLine)) {
      parsed.isJson = true;
      try {
        parsed.data = JSON.parse(cleanLine);
      } catch (error) {
        // Not valid JSON despite appearing to be JSON-like
        parsed.isJson = false;
      }
    }

    // Check for tool use
    if (StreamHandler.TOOL_USE_REGEX.test(line)) {
      parsed.isToolUse = true;
    }

    // Check for markdown
    if (this.isMarkdownLine(cleanLine)) {
      parsed.isMarkdown = true;
    }

    return {
      type,
      content: line, // Keep original line with ANSI codes
      timestamp,
      parsed,
    };
  }

  /**
   * Checks if a line appears to be JSON
   */
  private isJsonLine(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.length === 0) return false;
    
    return StreamHandler.JSON_START_REGEX.test(trimmed) || 
           trimmed.endsWith('}') || 
           trimmed.endsWith(']');
  }

  /**
   * Checks if a line appears to be Markdown
   */
  private isMarkdownLine(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.length === 0) return false;

    return StreamHandler.MARKDOWN_HEADER_REGEX.test(trimmed) ||
           StreamHandler.MARKDOWN_CODE_BLOCK_REGEX.test(trimmed) ||
           trimmed.startsWith('- ') ||
           trimmed.startsWith('* ') ||
           trimmed.startsWith('1. ') ||
           trimmed.includes('`') ||
           trimmed.includes('**') ||
           trimmed.includes('__');
  }

  /**
   * Strips ANSI escape codes from a string
   */
  private stripAnsiCodes(text: string): string {
    return text
      .replace(StreamHandler.ANSI_ESCAPE_REGEX, '')
      .replace(StreamHandler.ANSI_COLOR_REGEX, '');
  }

  /**
   * Gets the current buffer content for a process
   */
  getBuffer(processId: string, type?: 'stdout' | 'stderr'): string | { stdout: string; stderr: string } | undefined {
    const bufferEntry = this.buffers.get(processId);
    if (!bufferEntry) return undefined;

    if (type) {
      return bufferEntry[type];
    }

    return { ...bufferEntry };
  }

  /**
   * Flushes any remaining buffered content for a process
   */
  flushBuffer(processId: string): void {
    const bufferEntry = this.buffers.get(processId);
    if (!bufferEntry) return;

    // Process any remaining content in buffers
    if (bufferEntry.stdout.length > 0) {
      this.processLine(processId, 'stdout', bufferEntry.stdout);
      bufferEntry.stdout = '';
    }

    if (bufferEntry.stderr.length > 0) {
      this.processLine(processId, 'stderr', bufferEntry.stderr);
      bufferEntry.stderr = '';
    }
  }

  /**
   * Clears buffers for a process
   */
  clearBuffer(processId: string): void {
    this.buffers.delete(processId);
  }

  /**
   * Creates a transform stream that can be piped to
   */
  createTransformStream(processId: string, type: 'stdout' | 'stderr'): Transform {
    return new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        this.handleData(processId, type, chunk);
        // Pass through the original data
        callback(null, chunk);
      }
    });
  }

  /**
   * Analyzes a complete output string for patterns
   */
  analyzeOutput(output: string): {
    hasJson: boolean;
    hasToolUse: boolean;
    hasMarkdown: boolean;
    hasAnsiCodes: boolean;
    lineCount: number;
    jsonBlocks: any[];
    toolUseBlocks: string[];
  } {
    const lines = output.split('\n');
    const analysis = {
      hasJson: false,
      hasToolUse: false,
      hasMarkdown: false,
      hasAnsiCodes: false,
      lineCount: lines.length,
      jsonBlocks: [] as any[],
      toolUseBlocks: [] as string[],
    };

    let currentJsonBlock = '';
    let inJsonBlock = false;
    let currentToolBlock = '';
    let inToolBlock = false;

    for (const line of lines) {
      // Check for ANSI codes
      if (StreamHandler.ANSI_ESCAPE_REGEX.test(line)) {
        analysis.hasAnsiCodes = true;
      }

      const cleanLine = this.stripAnsiCodes(line).trim();

      // JSON detection
      if (this.isJsonLine(cleanLine)) {
        analysis.hasJson = true;
        if (cleanLine.startsWith('{') || cleanLine.startsWith('[')) {
          inJsonBlock = true;
          currentJsonBlock = cleanLine;
        } else if (inJsonBlock) {
          currentJsonBlock += '\n' + cleanLine;
          if (cleanLine.endsWith('}') || cleanLine.endsWith(']')) {
            try {
              const parsed = JSON.parse(currentJsonBlock);
              analysis.jsonBlocks.push(parsed);
            } catch (error) {
              // Invalid JSON, ignore
            }
            inJsonBlock = false;
            currentJsonBlock = '';
          }
        }
      }

      // Tool use detection
      if (StreamHandler.TOOL_USE_REGEX.test(line)) {
        analysis.hasToolUse = true;
        inToolBlock = true;
        currentToolBlock = line;
      } else if (inToolBlock) {
        currentToolBlock += '\n' + line;
        if (line.includes('</function_calls>')) {
          analysis.toolUseBlocks.push(currentToolBlock);
          inToolBlock = false;
          currentToolBlock = '';
        }
      }

      // Markdown detection
      if (this.isMarkdownLine(cleanLine)) {
        analysis.hasMarkdown = true;
      }
    }

    return analysis;
  }

  /**
   * Graceful shutdown - clear all buffers and streams
   */
  async shutdown(): Promise<void> {
    console.log('StreamHandler shutting down...');
    
    // Clear all buffers
    this.buffers.clear();
    
    console.log('StreamHandler shutdown complete');
  }
}

export default StreamHandler;