import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { JsonlParser, parseJsonlFile, parseJsonlString } from './jsonl-parser';

// Helper to create valid test entry
function createUserEntry(id: string, text: string, timestamp = '2025-07-03T15:50:07.874717Z') {
  return {
    type: 'user',
    timestamp,
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd: '/tmp',
    sessionId: 'test',
    version: '1.0.0',
    uuid: id,
    message: {
      role: 'user',
      content: [{ type: 'text', text }]
    }
  };
}

function createAssistantEntry(id: string, text: string, timestamp = '2025-07-03T15:52:07.874717Z') {
  return {
    type: 'assistant',
    timestamp,
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd: '/tmp',
    sessionId: 'test',
    version: '1.0.0',
    uuid: id,
    message: {
      id,
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet-20240229',
      content: [{ type: 'text', text }],
      usage: { input_tokens: 10, output_tokens: 20 }
    }
  };
}

describe('JsonlParser', () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = join(tmpdir(), `test-${Date.now()}-${Math.random()}.jsonl`);
  });

  afterEach(() => {
    if (existsSync(tempFilePath)) {
      unlinkSync(tempFilePath);
    }
  });

  describe('parseString', () => {
    it('should parse valid JSONL string', () => {
      const entries = [
        createUserEntry('test_001', 'Hello'),
        createAssistantEntry('test_002', 'Hi there')
      ];
      const jsonlContent = entries.map(e => JSON.stringify(e)).join('\n');

      const parser = new JsonlParser();
      const result = parser.parseString(jsonlContent);

      expect(result.entries).toHaveLength(2);
      expect(result.totalLines).toBe(2);
      expect(result.validLines).toBe(2);
      expect(result.errors).toHaveLength(0);
      
      expect(result.entries[0].type).toBe('user');
      expect(result.entries[1].type).toBe('assistant');
    });

    it('should handle empty lines', () => {
      const entries = [
        createUserEntry('test_001', 'Hello'),
        createAssistantEntry('test_002', 'Hi there')
      ];
      const jsonlContent = JSON.stringify(entries[0]) + '\n\n' + JSON.stringify(entries[1]) + '\n\n';

      const parser = new JsonlParser();
      const result = parser.parseString(jsonlContent);

      expect(result.entries).toHaveLength(2);
      expect(result.validLines).toBe(2);
      expect(result.totalLines).toBe(5); // Including empty lines
    });

    it('should handle invalid JSON lines with skipInvalidLines=true', () => {
      const entries = [
        createUserEntry('test_001', 'Hello'),
        createAssistantEntry('test_002', 'Hi there')
      ];
      const jsonlContent = JSON.stringify(entries[0]) + '\ninvalid json line\n' + JSON.stringify(entries[1]);

      const parser = new JsonlParser({ skipInvalidLines: true });
      const result = parser.parseString(jsonlContent);

      expect(result.entries).toHaveLength(2);
      expect(result.validLines).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].lineNumber).toBe(2);
      expect(result.errors[0].line).toBe('invalid json line');
    });

    it('should call onError callback for invalid lines', () => {
      const errors: Array<{ line: string; lineNumber: number; error: Error }> = [];
      const parser = new JsonlParser({
        onError: (line, lineNumber, error) => {
          errors.push({ line, lineNumber, error });
        }
      });

      const userEntry = createUserEntry('test_001', 'Hello');
      const jsonlContent = JSON.stringify(userEntry) + '\n{invalid: json}';

      parser.parseString(jsonlContent);

      expect(errors).toHaveLength(1);
      expect(errors[0].lineNumber).toBe(2);
    });

    it('should call onEntry callback for valid entries', () => {
      const entries: Array<{ lineNumber: number }> = [];
      const parser = new JsonlParser({
        onEntry: (entry, lineNumber) => {
          entries.push({ lineNumber });
        }
      });

      const userEntry = createUserEntry('test_001', 'Hello');
      const jsonlContent = JSON.stringify(userEntry);

      parser.parseString(jsonlContent);

      expect(entries).toHaveLength(1);
      expect(entries[0].lineNumber).toBe(1);
    });
  });

  describe('parseFile', () => {
    it('should parse valid JSONL file', async () => {
      const entries = [
        createUserEntry('test_001', 'Hello'),
        createAssistantEntry('test_002', 'Hi there')
      ];
      const jsonlContent = entries.map(e => JSON.stringify(e)).join('\n');

      writeFileSync(tempFilePath, jsonlContent, 'utf8');

      const parser = new JsonlParser();
      const result = await parser.parseFile(tempFilePath);

      expect(result.entries).toHaveLength(2);
      expect(result.totalLines).toBe(2);
      expect(result.validLines).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle file with mixed valid and invalid lines', async () => {
      const entries = [
        createUserEntry('test_001', 'Hello'),
        createAssistantEntry('test_002', 'Hi there')
      ];
      const jsonlContent = JSON.stringify(entries[0]) + '\ninvalid json\n' + JSON.stringify(entries[1]);

      writeFileSync(tempFilePath, jsonlContent, 'utf8');

      const parser = new JsonlParser({ skipInvalidLines: true });
      const result = await parser.parseFile(tempFilePath);

      expect(result.entries).toHaveLength(2);
      expect(result.validLines).toBe(2);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('parseFileStream', () => {
    it('should stream parse entries from file', async () => {
      const entries = [
        createUserEntry('test_001', 'Hello'),
        createAssistantEntry('test_002', 'Hi there', '2025-07-03T15:52:07.874717Z'),
        createUserEntry('test_003', 'How are you?', '2025-07-03T15:54:07.874717Z')
      ];
      const jsonlContent = entries.map(e => JSON.stringify(e)).join('\n');

      writeFileSync(tempFilePath, jsonlContent, 'utf8');

      const parser = new JsonlParser();
      const parsedEntries = [];
      
      for await (const entry of parser.parseFileStream(tempFilePath)) {
        parsedEntries.push(entry);
      }

      expect(parsedEntries).toHaveLength(3);
      expect(parsedEntries[0].type).toBe('user');
      expect(parsedEntries[1].type).toBe('assistant');
      expect(parsedEntries[2].type).toBe('user');
    });

    it('should handle errors in streaming mode', async () => {
      const entries = [
        createUserEntry('test_001', 'Hello'),
        createAssistantEntry('test_002', 'Hi there')
      ];
      const jsonlContent = JSON.stringify(entries[0]) + '\ninvalid json line\n' + JSON.stringify(entries[1]);

      writeFileSync(tempFilePath, jsonlContent, 'utf8');

      const errors: Array<{ line: string; lineNumber: number; error: Error }> = [];
      const parser = new JsonlParser({
        skipInvalidLines: true,
        onError: (line, lineNumber, error) => {
          errors.push({ line, lineNumber, error });
        }
      });

      const parsedEntries = [];
      for await (const entry of parser.parseFileStream(tempFilePath)) {
        parsedEntries.push(entry);
      }

      expect(parsedEntries).toHaveLength(2);
      expect(errors).toHaveLength(1);
    });
  });

  describe('batch processing', () => {
    it('should respect batchSize option', async () => {
      // Create a file with more entries than batch size
      const entries = [];
      for (let i = 0; i < 5; i++) {
        entries.push(createUserEntry(`test_${i.toString().padStart(3, '0')}`, `Hello ${i}`, `2025-07-03T15:5${i}:07.874717Z`));
      }
      const jsonlContent = entries.map(e => JSON.stringify(e)).join('\n');
      writeFileSync(tempFilePath, jsonlContent, 'utf8');

      const parser = new JsonlParser({ batchSize: 2 });
      const result = await parser.parseFile(tempFilePath);

      expect(result.entries).toHaveLength(5);
      expect(result.validLines).toBe(5);
    });
  });
});

describe('convenience functions', () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = join(tmpdir(), `test-${Date.now()}-${Math.random()}.jsonl`);
  });

  afterEach(() => {
    if (existsSync(tempFilePath)) {
      unlinkSync(tempFilePath);
    }
  });

  it('parseJsonlFile should work', async () => {
    const userEntry = createUserEntry('test_001', 'Hello');
    const jsonlContent = JSON.stringify(userEntry);
    writeFileSync(tempFilePath, jsonlContent, 'utf8');

    const result = await parseJsonlFile(tempFilePath);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].type).toBe('user');
  });

  it('parseJsonlString should work', () => {
    const userEntry = createUserEntry('test_001', 'Hello');
    const jsonlContent = JSON.stringify(userEntry);

    const result = parseJsonlString(jsonlContent);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].type).toBe('user');
  });
});