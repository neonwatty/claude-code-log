/**
 * JSONL parser for Claude Code transcript files.
 * Provides both streaming and non-streaming parsers with error handling.
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { createReadStream } from "fs";
import { createGunzip } from "zlib";
import { Readable } from "stream";
import {
  ITranscriptEntry,
  IContentItem,
  ITextContent,
  ISummaryTranscriptEntry,
} from "../../../shared/src/interfaces";

export interface ParseResult {
  entries: ITranscriptEntry[];
  errors: ParseError[];
}

export interface ParseError {
  lineNumber: number;
  error: string;
  line: string;
}

export interface ParserOptions {
  silent?: boolean;
  maxErrors?: number;
  skipMalformed?: boolean;
}

/**
 * Extract text content from message content structure.
 * Handles both string and array content, filtering out thinking content.
 */
export function extractTextContent(
  content: string | IContentItem[] | null | undefined,
): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const item of content) {
      if (item.type === "text") {
        const textItem = item as ITextContent;
        textParts.push(textItem.text);
      } else if (item.type === "thinking") {
        // Skip thinking content in main text extraction
        continue;
      }
    }
    return textParts.join("\n");
  }

  return String(content);
}

/**
 * Parse ISO timestamp to Date object.
 */
export function parseTimestamp(timestampStr: string): Date | null {
  try {
    // Handle both Z suffix and explicit timezone
    const normalizedTimestamp = timestampStr.replace("Z", "+00:00");
    const date = new Date(normalizedTimestamp);

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  } catch {
    return null;
  }
}

/**
 * Validate and parse a single transcript entry from JSON.
 */
export function parseTranscriptEntry(data: any): ITranscriptEntry {
  const entryType = data.type;

  if (
    !entryType ||
    !["user", "assistant", "summary", "system"].includes(entryType)
  ) {
    throw new Error(`Unknown transcript entry type: ${entryType}`);
  }

  // Basic validation for required fields based on entry type
  if (entryType === "summary") {
    if (!data.summary || !data.leafUuid) {
      throw new Error(
        "Summary entry missing required fields: summary, leafUuid",
      );
    }
    return data as ISummaryTranscriptEntry;
  }

  if (!data.uuid || !data.timestamp || !data.sessionId) {
    throw new Error(
      `Entry missing required fields: uuid, timestamp, sessionId`,
    );
  }

  if (entryType === "user" || entryType === "assistant") {
    if (!data.message) {
      throw new Error(`${entryType} entry missing message field`);
    }
  }

  if (entryType === "system") {
    if (!data.content) {
      throw new Error("System entry missing content field");
    }
  }

  return data as ITranscriptEntry;
}

/**
 * Parse a single line of JSONL content.
 */
export function parseJsonlLine(
  line: string,
  lineNumber: number,
): ITranscriptEntry | ParseError {
  try {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      throw new Error("Empty line");
    }

    const entryDict = JSON.parse(trimmedLine);
    if (typeof entryDict !== "object" || entryDict === null) {
      throw new Error("Line is not a JSON object");
    }

    return parseTranscriptEntry(entryDict);
  } catch (error) {
    return {
      lineNumber,
      error: error instanceof Error ? error.message : String(error),
      line: line.substring(0, 200) + (line.length > 200 ? "..." : ""),
    };
  }
}

/**
 * Load and parse a JSONL file synchronously.
 */
export function loadTranscript(
  filePath: string,
  options: ParserOptions = {},
): ParseResult {
  const { silent = false, maxErrors = 100, skipMalformed = true } = options;
  const entries: ITranscriptEntry[] = [];
  const errors: ParseError[] = [];

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    if (!silent) {
      console.log(`Processing ${filePath}...`);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const result = parseJsonlLine(line, i + 1);

      if ("lineNumber" in result) {
        // It's a ParseError
        errors.push(result);
        if (!silent) {
          console.error(
            `Line ${result.lineNumber} of ${filePath}: ${result.error}`,
          );
        }

        if (!skipMalformed || errors.length >= maxErrors) {
          break;
        }
      } else {
        // It's a valid entry
        entries.push(result);
      }
    }

    if (!silent && errors.length > 0) {
      console.warn(`Parsed ${filePath} with ${errors.length} errors`);
    }
  } catch (error) {
    const parseError: ParseError = {
      lineNumber: 0,
      error: `File reading error: ${error instanceof Error ? error.message : String(error)}`,
      line: "",
    };
    errors.push(parseError);

    if (!silent) {
      console.error(`Error reading ${filePath}: ${parseError.error}`);
    }
  }

  return { entries, errors };
}

/**
 * Load and parse a JSONL file asynchronously with streaming.
 */
export async function loadTranscriptAsync(
  filePath: string,
  options: ParserOptions = {},
): Promise<ParseResult> {
  const { silent = false, maxErrors = 100, skipMalformed = true } = options;
  const entries: ITranscriptEntry[] = [];
  const errors: ParseError[] = [];

  try {
    let fileStream: Readable = createReadStream(filePath);

    // Handle compressed files
    if (filePath.endsWith(".gz")) {
      fileStream = fileStream.pipe(createGunzip());
    }

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    if (!silent) {
      console.log(`Processing ${filePath}...`);
    }

    let lineNumber = 0;
    for await (const line of rl) {
      lineNumber++;

      if (!line.trim()) continue;

      const result = parseJsonlLine(line, lineNumber);

      if ("lineNumber" in result) {
        // It's a ParseError
        errors.push(result);
        if (!silent) {
          console.error(
            `Line ${result.lineNumber} of ${filePath}: ${result.error}`,
          );
        }

        if (!skipMalformed || errors.length >= maxErrors) {
          break;
        }
      } else {
        // It's a valid entry
        entries.push(result);
      }
    }

    if (!silent && errors.length > 0) {
      console.warn(`Parsed ${filePath} with ${errors.length} errors`);
    }
  } catch (error) {
    const parseError: ParseError = {
      lineNumber: 0,
      error: `File reading error: ${error instanceof Error ? error.message : String(error)}`,
      line: "",
    };
    errors.push(parseError);

    if (!silent) {
      console.error(`Error reading ${filePath}: ${parseError.error}`);
    }
  }

  return { entries, errors };
}

/**
 * Find all JSONL files in a directory.
 */
export function findJsonlFiles(directoryPath: string): string[] {
  try {
    const files = fs.readdirSync(directoryPath);
    return files
      .filter((file) => file.endsWith(".jsonl") || file.endsWith(".jsonl.gz"))
      .map((file) => path.join(directoryPath, file))
      .sort();
  } catch (error) {
    console.error(`Error reading directory ${directoryPath}: ${error}`);
    return [];
  }
}

/**
 * Load all JSONL files from a directory and combine them.
 */
export async function loadDirectoryTranscripts(
  directoryPath: string,
  options: ParserOptions = {},
): Promise<ParseResult> {
  const allEntries: ITranscriptEntry[] = [];
  const allErrors: ParseError[] = [];

  const jsonlFiles = findJsonlFiles(directoryPath);

  for (const filePath of jsonlFiles) {
    const result = await loadTranscriptAsync(filePath, options);
    allEntries.push(...result.entries);
    allErrors.push(...result.errors);
  }

  // Sort entries chronologically
  allEntries.sort((a, b) => {
    const timestampA = "timestamp" in a ? a.timestamp : "";
    const timestampB = "timestamp" in b ? b.timestamp : "";
    return timestampA.localeCompare(timestampB);
  });

  return { entries: allEntries, errors: allErrors };
}

/**
 * Watch a JSONL file for changes and emit new entries.
 */
export class JsonlWatcher {
  private filePath: string;
  private options: ParserOptions;
  private lastPosition: number = 0;
  private watcher: fs.FSWatcher | null = null;

  constructor(filePath: string, options: ParserOptions = {}) {
    this.filePath = filePath;
    this.options = options;
  }

  /**
   * Start watching the file for changes.
   */
  public watch(
    callback: (entries: ITranscriptEntry[], errors: ParseError[]) => void,
  ): void {
    // Initialize position to end of file
    try {
      const stats = fs.statSync(this.filePath);
      this.lastPosition = stats.size;
    } catch {
      this.lastPosition = 0;
    }

    this.watcher = fs.watch(
      this.filePath,
      { persistent: false },
      (eventType) => {
        if (eventType === "change") {
          this.processNewContent(callback);
        }
      },
    );
  }

  /**
   * Stop watching the file.
   */
  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private processNewContent(
    callback: (entries: ITranscriptEntry[], errors: ParseError[]) => void,
  ): void {
    try {
      const stats = fs.statSync(this.filePath);
      if (stats.size <= this.lastPosition) {
        return; // No new content
      }

      const stream = fs.createReadStream(this.filePath, {
        start: this.lastPosition,
        encoding: "utf-8",
      });

      let buffer = "";
      const entries: ITranscriptEntry[] = [];
      const errors: ParseError[] = [];
      let lineNumber = 0;

      stream.on("data", (chunk: string | Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          lineNumber++;
          if (!line.trim()) continue;

          const result = parseJsonlLine(line, lineNumber);
          if ("lineNumber" in result) {
            errors.push(result);
          } else {
            entries.push(result);
          }
        }
      });

      stream.on("end", () => {
        // Process any remaining content in buffer
        if (buffer.trim()) {
          lineNumber++;
          const result = parseJsonlLine(buffer, lineNumber);
          if ("lineNumber" in result) {
            errors.push(result);
          } else {
            entries.push(result);
          }
        }

        this.lastPosition = stats.size;
        callback(entries, errors);
      });

      stream.on("error", (error) => {
        const parseError: ParseError = {
          lineNumber: 0,
          error: `File watch error: ${error.message}`,
          line: "",
        };
        callback([], [parseError]);
      });
    } catch (error) {
      const parseError: ParseError = {
        lineNumber: 0,
        error: `File watch error: ${error instanceof Error ? error.message : String(error)}`,
        line: "",
      };
      callback([], [parseError]);
    }
  }
}
