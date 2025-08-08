import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { TranscriptEntry } from './index';
import { parseTranscriptEntry } from './utils';

export interface JsonlParserOptions {
  /**
   * Maximum number of lines to process before yielding control.
   * Helps prevent blocking the event loop for large files.
   */
  batchSize?: number;
  
  /**
   * Whether to continue processing when encountering invalid JSON lines.
   * If false, parsing stops on first error.
   */
  skipInvalidLines?: boolean;
  
  /**
   * Called when an invalid line is encountered
   */
  onError?: (line: string, lineNumber: number, error: Error) => void;
  
  /**
   * Called for each successfully parsed entry
   */
  onEntry?: (entry: TranscriptEntry, lineNumber: number) => void;
}

export interface JsonlParseResult {
  entries: TranscriptEntry[];
  totalLines: number;
  validLines: number;
  errors: Array<{
    line: string;
    lineNumber: number;
    error: string;
  }>;
}

/**
 * Streaming JSONL file reader that efficiently processes large files
 * without loading the entire content into memory.
 */
export class JsonlParser {
  private options: Required<JsonlParserOptions>;

  constructor(options: JsonlParserOptions = {}) {
    this.options = {
      batchSize: options.batchSize ?? 1000,
      skipInvalidLines: options.skipInvalidLines ?? true,
      onError: options.onError ?? (() => {}),
      onEntry: options.onEntry ?? (() => {}),
    };
  }

  /**
   * Parse a JSONL file and return all entries
   */
  async parseFile(filePath: string): Promise<JsonlParseResult> {
    const entries: TranscriptEntry[] = [];
    const errors: JsonlParseResult['errors'] = [];
    let totalLines = 0;
    let validLines = 0;
    let batchCount = 0;

    const fileStream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity, // Handle Windows line endings
    });

    for await (const line of rl) {
      totalLines++;
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        continue;
      }

      try {
        const jsonData = JSON.parse(trimmedLine);
        
        // Validate that it's an object
        if (typeof jsonData !== 'object' || jsonData === null) {
          throw new Error('Line is not a JSON object');
        }

        const entry = parseTranscriptEntry(jsonData);
        if (entry) {
          entries.push(entry);
          validLines++;
          this.options.onEntry(entry, totalLines);
        } else {
          throw new Error('Failed to parse transcript entry');
        }
      } catch (error) {
        const errorInfo = {
          line: trimmedLine,
          lineNumber: totalLines,
          error: error instanceof Error ? error.message : String(error),
        };
        
        errors.push(errorInfo);
        this.options.onError(trimmedLine, totalLines, error instanceof Error ? error : new Error(String(error)));
        
        if (!this.options.skipInvalidLines) {
          break;
        }
      }

      // Yield control periodically to prevent blocking the event loop
      batchCount++;
      if (batchCount >= this.options.batchSize) {
        batchCount = 0;
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    return {
      entries,
      totalLines,
      validLines,
      errors,
    };
  }

  /**
   * Parse a JSONL file as an async generator for memory-efficient streaming
   */
  async* parseFileStream(filePath: string): AsyncGenerator<TranscriptEntry, JsonlParseResult['errors'], unknown> {
    const errors: JsonlParseResult['errors'] = [];
    let totalLines = 0;
    let batchCount = 0;

    const fileStream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        totalLines++;
        const trimmedLine = line.trim();
        
        if (!trimmedLine) {
          continue;
        }

        try {
          const jsonData = JSON.parse(trimmedLine);
          
          if (typeof jsonData !== 'object' || jsonData === null) {
            throw new Error('Line is not a JSON object');
          }

          const entry = parseTranscriptEntry(jsonData);
          if (entry) {
            this.options.onEntry(entry, totalLines);
            yield entry;
          } else {
            throw new Error('Failed to parse transcript entry');
          }
        } catch (error) {
          const errorInfo = {
            line: trimmedLine,
            lineNumber: totalLines,
            error: error instanceof Error ? error.message : String(error),
          };
          
          errors.push(errorInfo);
          this.options.onError(trimmedLine, totalLines, error instanceof Error ? error : new Error(String(error)));
          
          if (!this.options.skipInvalidLines) {
            break;
          }
        }

        // Yield control periodically
        batchCount++;
        if (batchCount >= this.options.batchSize) {
          batchCount = 0;
          await new Promise(resolve => setImmediate(resolve));
        }
      }
    } finally {
      rl.close();
      fileStream.destroy();
    }

    return errors;
  }

  /**
   * Parse JSONL string content
   */
  parseString(jsonlString: string): JsonlParseResult {
    const lines = jsonlString.split('\n');
    const entries: TranscriptEntry[] = [];
    const errors: JsonlParseResult['errors'] = [];
    let validLines = 0;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      const lineNumber = index + 1;
      
      if (!trimmedLine) {
        return;
      }

      try {
        const jsonData = JSON.parse(trimmedLine);
        
        if (typeof jsonData !== 'object' || jsonData === null) {
          throw new Error('Line is not a JSON object');
        }

        const entry = parseTranscriptEntry(jsonData);
        if (entry) {
          entries.push(entry);
          validLines++;
          this.options.onEntry(entry, lineNumber);
        } else {
          throw new Error('Failed to parse transcript entry');
        }
      } catch (error) {
        const errorInfo = {
          line: trimmedLine,
          lineNumber,
          error: error instanceof Error ? error.message : String(error),
        };
        
        errors.push(errorInfo);
        this.options.onError(trimmedLine, lineNumber, error instanceof Error ? error : new Error(String(error)));
      }
    });

    return {
      entries,
      totalLines: lines.length,
      validLines,
      errors,
    };
  }
}

/**
 * Convenience function to parse a JSONL file
 */
export async function parseJsonlFile(
  filePath: string, 
  options?: JsonlParserOptions
): Promise<JsonlParseResult> {
  const parser = new JsonlParser(options);
  return parser.parseFile(filePath);
}

/**
 * Convenience function to parse JSONL string
 */
export function parseJsonlString(
  jsonlString: string, 
  options?: JsonlParserOptions
): JsonlParseResult {
  const parser = new JsonlParser(options);
  return parser.parseString(jsonlString);
}