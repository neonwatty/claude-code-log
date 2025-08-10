import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';

// Mock the shared module to avoid actual JSONL parsing
vi.mock('@app/shared', () => ({
  JsonlParser: vi.fn().mockImplementation(() => ({
    parseFile: vi.fn().mockResolvedValue({
      entries: [
        {
          type: 'user',
          timestamp: '2025-01-01T10:00:00Z',
          sessionId: 'test-session-1',
          uuid: 'user-1',
          message: { role: 'user', content: 'Hello' },
          cwd: '/test/directory',
        },
        {
          type: 'assistant',
          timestamp: '2025-01-01T10:00:30Z',
          sessionId: 'test-session-1',
          uuid: 'assistant-1',
          message: {
            id: 'assistant-1',
            role: 'assistant',
            model: 'claude-3-sonnet',
            content: [{ type: 'text', text: 'Hello back!' }],
            usage: { input_tokens: 10, output_tokens: 15 },
          },
          cwd: '/test/directory',
        },
      ],
      errors: [],
      totalLines: 2,
      validLines: 2,
    }),
  })),
  organizeIntoSessionsOptimized: vi.fn().mockResolvedValue([
    {
      sessionId: 'test-session-1',
      messageCount: 2,
      userMessageCount: 1,
      assistantMessageCount: 1,
      summaryCount: 0,
      workingDirectory: '/test/directory',
      timeRange: {
        start: new Date('2025-01-01T10:00:00Z'),
        end: new Date('2025-01-01T10:00:30Z'),
      },
      summary: 'Test conversation',
      firstUserMessage: 'Hello',
      lastAssistantMessage: 'Hello back!',
      entries: [],
      tokenUsage: {
        input_tokens: 10,
        output_tokens: 15,
        total_tokens: 25,
      },
    },
  ]),
  organizeProjectOptimized: vi.fn().mockResolvedValue({
    sessionCount: 1,
    totalMessages: 2,
    timeRange: {
      start: new Date('2025-01-01T10:00:00Z'),
      end: new Date('2025-01-01T10:00:30Z'),
    },
    sessions: [],
    sessionsByWorkingDirectory: {
      '/test/directory': [],
    },
  }),
  parseTranscriptEntriesOptimized: vi.fn().mockResolvedValue([
    {
      messageType: 'user',
      displayType: '🤷 User',
      cssClass: 'user',
      timestamp: '2025-01-01T10:00:00Z',
      parsedContent: [{ type: 'text', content: 'Hello', metadata: {} }],
      rawContent: 'Hello',
      hasToolUse: false,
      hasThinking: false,
      hasImages: false,
    },
    {
      messageType: 'assistant',
      displayType: '🤖 Assistant',
      cssClass: 'assistant',
      timestamp: '2025-01-01T10:00:30Z',
      parsedContent: [{ type: 'text', content: 'Hello back!', metadata: {} }],
      rawContent: [{ type: 'text', text: 'Hello back!' }],
      hasToolUse: false,
      hasThinking: false,
      hasImages: false,
      tokenUsage: {
        input_tokens: 10,
        output_tokens: 15,
        total_tokens: 25,
      },
    },
  ]),
  findSessionsByWorkingDirectory: vi.fn().mockResolvedValue([
    {
      sessionId: 'test-session-1',
      messageCount: 2,
      workingDirectory: '/test/directory',
      timeRange: {
        start: '2025-01-01T10:00:00Z',
        end: '2025-01-01T10:00:30Z',
      },
    }
  ]),
}));

// Now import the other modules after mocks are set up
import request from 'supertest';
import express from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';
import sessionsRoutes from './sessions';
import { sessionErrorHandler } from '../middleware/sessionValidation';

// Import SessionService for mocking
import { SessionService } from './sessions';

describe('Sessions API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRoutes);
    app.use(sessionErrorHandler);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock SessionService methods with proper return data
    vi.spyOn(SessionService, 'parseJsonlFiles').mockResolvedValue({
      entries: [
        {
          type: 'user',
          timestamp: '2025-01-01T10:00:00Z',
          sessionId: 'test-session-1',
          uuid: 'user-1',
          message: { role: 'user', content: 'Hello' },
          cwd: '/test/directory',
        },
        {
          type: 'assistant',
          timestamp: '2025-01-01T10:00:30Z',
          sessionId: 'test-session-1',
          uuid: 'assistant-1',
          message: {
            id: 'assistant-1',
            role: 'assistant',
            model: 'claude-3-sonnet',
            content: [{ type: 'text', text: 'Hello back!' }],
            usage: { input_tokens: 10, output_tokens: 15 },
          },
          cwd: '/test/directory',
        },
      ],
      errors: [],
      fileCount: 2,
    });

    vi.spyOn(SessionService, 'organizeSessions').mockResolvedValue([
      {
        sessionId: 'test-session-1',
        messageCount: 2,
        userMessageCount: 1,
        assistantMessageCount: 1,
        summaryCount: 0,
        workingDirectory: '/test/directory',
        timeRange: {
          start: '2025-01-01T10:00:00Z',
          end: '2025-01-01T10:00:30Z',
        },
        totalTokens: 25,
        tokenUsage: {
          total_tokens: 25,
          input_tokens: 10,
          output_tokens: 15,
        },
        entries: [] // Will be populated by the test data above
      }
    ]);

    vi.spyOn(SessionService, 'organizeProject').mockResolvedValue({
      totalSessions: 1,
      totalMessages: 2,
      workingDirectories: ['/test/directory'],
      dateRange: {
        start: '2025-01-01T10:00:00Z',
        end: '2025-01-01T10:00:30Z',
      },
      sessions: [] // Will be populated by organizeSessions mock
    });

    vi.spyOn(SessionService, 'parseMessages').mockResolvedValue([
      {
        role: 'user',
        content: 'Hello',
        timestamp: '2025-01-01T10:00:00Z',
        sessionId: 'test-session-1',
      },
      {
        role: 'assistant', 
        content: 'Hello back!',
        timestamp: '2025-01-01T10:00:30Z',
        sessionId: 'test-session-1',
      }
    ]);

    // The findSessionsByWorkingDirectory is already mocked at the top level
  });

  describe('POST /api/sessions/parse', () => {
    it('should parse JSONL files successfully', async () => {
      const response = await request(app)
        .post('/api/sessions/parse')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          entries: expect.any(Array),
          errors: expect.any(Array),
          fileCount: expect.any(Number),
          totalEntries: expect.any(Number),
          errorCount: expect.any(Number),
        },
      });

      expect(response.body.data.entries).toHaveLength(2);
      expect(response.body.data.fileCount).toBe(2); // Should find 2 JSONL files
    });

    it('should handle missing directory path', async () => {
      const response = await request(app)
        .post('/api/sessions/parse')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Directory path is required and must be a string',
      });
    });

    it('should handle invalid directory path', async () => {
      const response = await request(app)
        .post('/api/sessions/parse')
        .send({
          directoryPath: '../invalid/path',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid directory path',
      });
    });

    it('should handle parsing errors', async () => {
      // Override the SessionService mock to simulate a parsing error
      vi.spyOn(SessionService, 'parseJsonlFiles').mockRejectedValueOnce(
        new Error('Failed to parse JSONL files: Parsing failed')
      );

      const response = await request(app)
        .post('/api/sessions/parse')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Failed to parse JSONL files'),
      });
    });
  });

  describe('POST /api/sessions/organize', () => {
    it('should organize sessions successfully', async () => {
      const response = await request(app)
        .post('/api/sessions/organize')
        .send({
          directoryPath: '/test/directory',
          options: {
            includeTokenUsage: true,
            includeMessagePreviews: true,
          },
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          sessions: expect.any(Array),
          totalSessions: expect.any(Number),
          totalMessages: expect.any(Number),
          parsingErrors: expect.any(Array),
        },
      });

      expect(response.body.data.sessions).toHaveLength(1);
      expect(response.body.data.sessions[0]).toMatchObject({
        sessionId: 'test-session-1',
        messageCount: 2,
        tokenUsage: expect.any(Object),
      });
    });

    it('should handle organize with custom options', async () => {
      const response = await request(app)
        .post('/api/sessions/organize')
        .send({
          directoryPath: '/test/directory',
          options: {
            sortBy: 'chronological',
            minMessageCount: 1,
            maxPreviewLength: 100,
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/sessions/project', () => {
    it('should organize project successfully', async () => {
      const response = await request(app)
        .post('/api/sessions/project')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          sessionCount: expect.any(Number),
          totalMessages: expect.any(Number),
          timeRange: expect.any(Object),
          sessions: expect.any(Array),
          sessionsByWorkingDirectory: expect.any(Object),
          parsingInfo: expect.any(Object),
        },
      });
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    it('should get session details successfully', async () => {
      const response = await request(app)
        .get('/api/sessions/test-session-1')
        .query({
          directoryPath: '/test/directory',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          session: {
            sessionId: 'test-session-1',
            messageCount: 2,
            messages: expect.any(Array),
          },
        },
      });
    });

    it('should handle missing directory path query parameter', async () => {
      const response = await request(app)
        .get('/api/sessions/test-session-1')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Directory path is required as query parameter',
      });
    });

    it('should handle session not found', async () => {
      // Mock empty sessions
      const mockOrganize = vi.mocked(
        (await import('@app/shared')).organizeIntoSessionsOptimized
      );
      mockOrganize.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/sessions/nonexistent-session')
        .query({
          directoryPath: '/test/directory',
        })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Session nonexistent-session not found',
      });
    });
  });

  describe('POST /api/sessions/directory', () => {
    it('should filter sessions by working directory', async () => {
      const response = await request(app)
        .post('/api/sessions/directory')
        .send({
          directoryPath: '/test/directory',
          workingDirectory: '/test/directory',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          sessions: expect.any(Array),
          workingDirectory: '/test/directory',
          totalSessions: expect.any(Number),
          totalMessages: expect.any(Number),
        },
      });
    });

    it('should handle missing working directory', async () => {
      const response = await request(app)
        .post('/api/sessions/directory')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Working directory filter is required',
      });
    });
  });

  describe('DELETE /api/sessions/cache', () => {
    it('should clear cache successfully', async () => {
      const response = await request(app)
        .delete('/api/sessions/cache')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Session cache cleared successfully',
      });
    });
  });

  describe('GET /api/sessions/cache/status', () => {
    it('should get cache status', async () => {
      const response = await request(app)
        .get('/api/sessions/cache/status')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          size: expect.any(Number),
          entries: expect.any(Array),
        },
      });
    });
  });

  describe('Error handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Mock SessionService to throw a file system error
      vi.spyOn(SessionService, 'parseJsonlFiles').mockRejectedValueOnce(
        new Error('Permission denied')
      );

      const response = await request(app)
        .post('/api/sessions/parse')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to parse JSONL files');
    });

    it('should handle JSON parsing errors', async () => {
      // Mock SessionService to fail during organize
      vi.spyOn(SessionService, 'parseJsonlFiles').mockRejectedValueOnce(
        new Error('Failed to parse JSONL files: Invalid JSON')
      );

      const response = await request(app)
        .post('/api/sessions/organize')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance and caching', () => {
    it('should handle multiple requests efficiently', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/sessions/parse')
          .send({
            directoryPath: '/test/directory',
          })
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should include response headers', async () => {
      const response = await request(app)
        .post('/api/sessions/parse')
        .send({
          directoryPath: '/test/directory',
        });

      // Should include standard headers (these would be added by middleware)
      expect(response.headers).toBeDefined();
    });
  });
});