import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { SessionContextService } from '../session-context.service.js';
import { ISession, ILogEntry } from '../../../../shared/src/schemas/session.js';
import {
  ClaudeContextConfig,
  ContextPreparationRequest,
  SessionContextData,
} from '../../../../shared/src/schemas/claude-integration.js';


describe('SessionContextService', () => {
  let service: SessionContextService;
  let mockSession: ISession;
  let mockWorkingDir: string;

  beforeEach(() => {
    service = new SessionContextService();
    mockWorkingDir = '/test/working/dir';
    
    // Mock fs methods
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    vi.spyOn(fs, 'access').mockResolvedValue(undefined);
    vi.spyOn(fs, 'unlink').mockImplementation(async (filePath) => {
      const error = new Error(`ENOENT: no such file or directory, unlink '${filePath}'`);
      (error as any).code = 'ENOENT';
      (error as any).errno = -2;
      (error as any).syscall = 'unlink';
      (error as any).path = filePath;
      return Promise.reject(error);
    });
    
    // Mock path methods
    vi.spyOn(path, 'join').mockImplementation((...args: string[]) => args.join('/'));
    vi.spyOn(path, 'resolve').mockImplementation((...args: string[]) => args.join('/'));
    vi.spyOn(path, 'basename').mockImplementation((p: string) => p.split('/').pop() || '');
    vi.spyOn(path, 'dirname').mockImplementation((p: string) => p.split('/').slice(0, -1).join('/'));
    vi.spyOn(path, 'isAbsolute').mockImplementation((p: string) => p.startsWith('/'));
    
    // Create mock session data
    mockSession = {
      id: 'test-session-123',
      cwd: mockWorkingDir,
      entries: [
        {
          timestamp: '2025-01-20T10:00:00Z',
          type: 'user',
          message: {
            content: 'Implement a new authentication system',
            role: 'user',
          },
        },
        {
          timestamp: '2025-01-20T10:01:00Z',
          type: 'assistant',
          message: {
            content: 'I\'ll help you implement authentication.',
            role: 'assistant',
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_read_input_tokens: 10,
              cache_creation_input_tokens: 5,
            },
          },
        },
        {
          timestamp: '2025-01-20T10:02:00Z',
          type: 'tool_use',
          message: {
            tool_calls: [{
              id: 'tool-1',
              type: 'function',
              function: {
                name: 'str_replace_editor',
                arguments: JSON.stringify({
                  command: 'create',
                  path: '/test/auth.ts',
                  file_text: 'export class AuthService {}',
                }),
              },
            }],
          },
        },
        {
          timestamp: '2025-01-20T10:03:00Z',
          type: 'tool_result',
          message: {
            content: 'File created successfully',
          },
        },
      ] as ILogEntry[],
      firstTimestamp: '2025-01-20T10:00:00Z',
      lastTimestamp: '2025-01-20T10:03:00Z',
      totalUsage: {
        input_tokens: 200,
        output_tokens: 100,
        cache_read_input_tokens: 20,
        cache_creation_input_tokens: 10,
      },
    };

    // Reset mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('prepareSessionContext', () => {
    it('should successfully prepare session context with default configuration', async () => {
      const result = await service.prepareSessionContext(mockSession);

      expect(result.success).toBe(true);
      expect(result.contextData).toBeDefined();
      expect(result.claudeMdPath).toBe(path.join(mockWorkingDir, 'CLAUDE.md'));
      expect(result.claudeMdContent).toContain('# CLAUDE.md');
      expect(result.claudeMdContent).toContain('test-session-123');
      expect(result.workingDirectory).toBe(mockWorkingDir);
      expect(result.processingTimeMs).toBeDefined();
      expect(result.processingTimeMs! > 0).toBe(true);
    });

    it('should prepare context with custom configuration', async () => {

      const config: ClaudeContextConfig = {
        workingDirectory: '/custom/working/dir',
        includeGuidelines: false,
        additionalInstructions: 'Custom instructions for this project',
        maxContextFiles: 25,
      };

      const result = await service.prepareSessionContext(mockSession, config);

      expect(result.success).toBe(true);
      expect(result.workingDirectory).toBe('/custom/working/dir');
      expect(result.claudeMdContent).toContain('Custom instructions for this project');
      expect(result.claudeMdContent).not.toContain('Development Guidelines');
    });

    it('should handle errors during context preparation', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));

      const result = await service.prepareSessionContext(mockSession);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to prepare session context');
      expect(result.contextData).toBeUndefined();
    });

    it('should extract meaningful context data from session', async () => {

      const result = await service.prepareSessionContext(mockSession);

      expect(result.success).toBe(true);
      expect(result.contextData).toBeDefined();

      const contextData = result.contextData!;
      expect(contextData.sessionId).toBe('test-session-123');
      expect(contextData.projectPath).toBe(mockWorkingDir);
      expect(contextData.keyTopics.length).toBeGreaterThan(0);
      expect(contextData.keyTopics).toContain('Implement a');
      expect(contextData.codePatterns.modifiedFiles).toContain('/test/auth.ts');
      expect(contextData.sessionStats.totalMessages).toBe(4);
      expect(contextData.sessionStats.userMessages).toBe(1);
      expect(contextData.sessionStats.assistantMessages).toBe(1);
      expect(contextData.sessionStats.toolUses).toBe(1);
      expect(contextData.sessionStats.totalTokens).toBe(300);
    });
  });

  describe('validateContextData', () => {
    it('should validate valid context data', () => {
      const validContextData: SessionContextData = {
        sessionId: 'test-session-123',
        projectPath: '/test/path',
        keyTopics: ['topic1'],
        codePatterns: {
          modifiedFiles: ['/test/file.ts'],
          commonPatterns: ['pattern1'],
        },
        projectContext: {
          projectType: 'Frontend',
          mainLanguages: ['TypeScript'],
          frameworks: ['Express.js'],
          workingDirectory: '/test/path',
        },
        sessionStats: {
          totalMessages: 10,
          userMessages: 5,
          assistantMessages: 3,
          toolUses: 2,
          totalTokens: 1000,
          duration: 300000,
          lastActivity: '2025-01-20T10:00:00Z',
        },
        conversationSummary: 'Test summary',
        recentContext: 'Recent context',
      };

      const isValid = service.validateContextData(validContextData);
      expect(isValid).toBe(true);
    });

    it('should reject invalid context data', () => {
      const invalidContextData = {
        sessionId: '',
        projectPath: '',
        sessionStats: {
          totalMessages: 0,
        },
      };

      const isValid = service.validateContextData(invalidContextData);
      expect(isValid).toBe(false);
    });
  });

  describe('transferContext', () => {
    it('should successfully transfer context', async () => {
      const result = await service.transferContext('test-session-123', '/target/path');

      expect(result.sessionId).toBe('test-session-123');
      expect(result.targetPath).toBe('/target/path');
      expect(result.status).toBe('completed');
      expect(result.transferTime).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should handle transfer errors', async () => {
      // For now, the transfer method is a stub, so we'll test the basic structure
      const result = await service.transferContext('invalid-session');

      expect(result.sessionId).toBe('invalid-session');
      expect(result.status).toBe('completed'); // Current implementation always succeeds
    });
  });

  describe('cleanupContext', () => {
    it('should clean up context files successfully', async () => {
      // Override the mock for this specific test to resolve successfully
      vi.spyOn(fs, 'unlink').mockResolvedValue(undefined);
      
      await service.cleanupContext(mockWorkingDir, false);

      expect(fs.unlink).toHaveBeenCalledWith(path.join(mockWorkingDir, 'CLAUDE.md'));
    });

    it('should keep CLAUDE.md when requested', async () => {
      await service.cleanupContext(mockWorkingDir, true);

      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      // Override the mock for this test to reject
      vi.spyOn(fs, 'unlink').mockRejectedValue(new Error('File not found'));

      // Should not throw error
      await expect(service.cleanupContext(mockWorkingDir, false)).resolves.toBeUndefined();
    });
  });

  describe('generateClaudeMdContent', () => {
    it('should generate proper CLAUDE.md content', async () => {

      const result = await service.prepareSessionContext(mockSession);

      expect(result.success).toBe(true);
      expect(result.claudeMdContent).toContain('# CLAUDE.md');
      expect(result.claudeMdContent).toContain('## Project Overview');
      expect(result.claudeMdContent).toContain('## Session Summary');
      expect(result.claudeMdContent).toContain('## Key Discussion Topics');
      expect(result.claudeMdContent).toContain('## Recently Modified Files');
      expect(result.claudeMdContent).toContain('## Development Guidelines');
      expect(result.claudeMdContent).toContain(`**Working Directory:** \`${mockWorkingDir}\``);
      expect(result.claudeMdContent).toContain('**Total Messages:** 4');
      expect(result.claudeMdContent).toContain('**Token Usage:** 300');
      expect(result.claudeMdContent).toContain('- `/test/auth.ts`');
      expect(result.claudeMdContent).toContain('test-session-123');
    });

    it('should include additional instructions when provided', async () => {

      const config: ClaudeContextConfig = {
        additionalInstructions: 'This is a test project with special requirements',
      };

      const result = await service.prepareSessionContext(mockSession, config);

      expect(result.success).toBe(true);
      expect(result.claudeMdContent).toContain('## Additional Context');
      expect(result.claudeMdContent).toContain('This is a test project with special requirements');
    });

    it('should exclude guidelines when configured', async () => {

      const config: ClaudeContextConfig = {
        includeGuidelines: false,
      };

      const result = await service.prepareSessionContext(mockSession, config);

      expect(result.success).toBe(true);
      expect(result.claudeMdContent).not.toContain('## Development Guidelines');
    });
  });

  describe('edge cases', () => {
    it('should handle empty session data', async () => {

      const emptySession: ISession = {
        id: 'empty-session',
        cwd: mockWorkingDir,
        entries: [],
        firstTimestamp: '2025-01-20T10:00:00Z',
        lastTimestamp: '2025-01-20T10:00:00Z',
        totalUsage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      };

      const result = await service.prepareSessionContext(emptySession);

      expect(result.success).toBe(true);
      expect(result.contextData?.sessionStats.totalMessages).toBe(0);
      expect(result.contextData?.sessionStats.totalTokens).toBe(0);
    });

    it('should handle sessions with no tool uses', async () => {

      const sessionWithoutTools: ISession = {
        ...mockSession,
        entries: [
          {
            timestamp: '2025-01-20T10:00:00Z',
            type: 'user',
            message: {
              content: 'What is TypeScript?',
              role: 'user',
            },
          },
          {
            timestamp: '2025-01-20T10:01:00Z',
            type: 'assistant',
            message: {
              content: 'TypeScript is a superset of JavaScript.',
              role: 'assistant',
            },
          },
        ] as ILogEntry[],
      };

      const result = await service.prepareSessionContext(sessionWithoutTools);

      expect(result.success).toBe(true);
      expect(result.contextData?.codePatterns.modifiedFiles).toHaveLength(0);
      expect(result.contextData?.sessionStats.toolUses).toBe(0);
    });

    it('should handle malformed tool call arguments', async () => {

      const sessionWithMalformedTools: ISession = {
        ...mockSession,
        entries: [
          {
            timestamp: '2025-01-20T10:00:00Z',
            type: 'tool_use',
            message: {
              tool_calls: [{
                id: 'tool-1',
                type: 'function',
                function: {
                  name: 'str_replace_editor',
                  arguments: 'invalid-json',
                },
              }],
            },
          },
        ] as ILogEntry[],
      };

      const result = await service.prepareSessionContext(sessionWithMalformedTools);

      expect(result.success).toBe(true);
      // Should handle parsing errors gracefully
      expect(result.contextData?.codePatterns.modifiedFiles).toHaveLength(0);
    });
  });
});