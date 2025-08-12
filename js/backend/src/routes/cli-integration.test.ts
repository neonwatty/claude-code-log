import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';
import cliIntegrationRoutes, { cliIntegrationService } from './cli-integration';
import { ApiResponse } from '@app/shared';

// Mock external dependencies
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
  },
}));

vi.mock('@app/shared', async () => {
  const actual = await vi.importActual('@app/shared');
  return {
    ...actual,
    JsonlParser: vi.fn().mockImplementation(() => ({
      parseFile: vi.fn(),
    })),
    organizeIntoSessionsOptimized: vi.fn(),
    parseTranscriptEntriesOptimized: vi.fn(),
  };
});

describe('CLI Integration API Routes', () => {
  let app: express.Application;
  let mockJsonlParser: any;
  let mockSessionData: any;
  let mockTranscriptEntries: any[];

  beforeEach(() => {
    // Setup Express app with middleware
    app = express();
    app.use(express.json());
    app.use('/api/cli', cliIntegrationRoutes);

    // Error handling middleware
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(500).json({
        success: false,
        error: err.message,
        code: 'INTERNAL_ERROR'
      });
    });

    // Mock session data
    mockSessionData = {
      sessionId: 'test-session-123',
      title: 'Test Session',
      cwd: '/test/project',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T11:00:00Z'),
      messageCount: 3,
      userMessageCount: 2,
      assistantMessageCount: 1,
      isActive: false,
      tags: ['test'],
      tokenUsage: {
        inputTokens: 500,
        outputTokens: 300,
        totalTokens: 800,
      },
    };

    // Mock transcript entries
    mockTranscriptEntries = [
      {
        type: 'user',
        uuid: 'entry-1',
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'test-session-123',
        cwd: '/test/project',
        message: {
          role: 'user',
          content: 'Hello, can you help me with this file: /test/project/app.ts?',
        },
      },
      {
        type: 'assistant',
        uuid: 'entry-2',
        timestamp: '2024-01-01T10:05:00Z',
        sessionId: 'test-session-123',
        cwd: '/test/project',
        message: {
          id: 'msg-1',
          role: 'assistant',
          model: 'claude-3-sonnet',
          content: [
            {
              type: 'text',
              text: 'I\'ll help you with the app.ts file.',
            },
          ],
        },
      },
    ];

    // Setup mocks
    const { JsonlParser, organizeIntoSessionsOptimized, parseTranscriptEntriesOptimized } = require('@app/shared');
    
    mockJsonlParser = {
      parseFile: vi.fn().mockResolvedValue({
        success: true,
        entries: mockTranscriptEntries,
        stats: { total: 2, valid: 2, invalid: 0 },
      }),
    };

    JsonlParser.mockImplementation(() => mockJsonlParser);
    
    parseTranscriptEntriesOptimized.mockReturnValue(mockTranscriptEntries);
    organizeIntoSessionsOptimized.mockReturnValue([mockSessionData]);

    // Mock fs operations
    const mockFs = fs as any;
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isFile: () => true });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cliIntegrationService.shutdown();
  });

  describe('Authentication', () => {
    it('should require CLI auth token', async () => {
      const response = await request(app)
        .post('/api/cli/context/prepare')
        .send({ sessionPath: '/test/session.jsonl' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('CLI_AUTH_REQUIRED');
    });

    it('should validate CLI auth token format', async () => {
      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set('X-CLI-Auth-Token', 'short')
        .set('User-Agent', 'claude-code-cli/1.0')
        .send({ sessionPath: '/test/session.jsonl' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('CLI_AUTH_INVALID');
    });

    it('should require Claude Code CLI user agent', async () => {
      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set('X-CLI-Auth-Token', 'valid-token-12345')
        .set('User-Agent', 'some-other-client/1.0')
        .send({ sessionPath: '/test/session.jsonl' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('CLI_CLIENT_INVALID');
    });

    it('should accept valid CLI authentication', async () => {
      const mockFs = fs as any;
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ isFile: () => true });

      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set('X-CLI-Auth-Token', 'valid-token-12345')
        .set('User-Agent', 'claude-code-cli/1.0')
        .send({ sessionPath: '/test/session.jsonl' });

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(400);
    });
  });

  describe('POST /api/cli/context/prepare', () => {
    const validHeaders = {
      'X-CLI-Auth-Token': 'valid-token-12345',
      'User-Agent': 'claude-code-cli/1.0',
    };

    it('should prepare session context successfully', async () => {
      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '/test/session.jsonl',
          options: {
            includeAllEntries: true,
            includeTokenUsage: true,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('packageId');
      expect(response.body.data).toHaveProperty('sessionId', 'test-session-123');
      expect(response.body.data).toHaveProperty('preparationStats');
      expect(response.body.data).toHaveProperty('packageInfo');
      expect(response.body.data).toHaveProperty('expiresAt');
    });

    it('should validate required sessionPath', async () => {
      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate sessionPath format', async () => {
      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '', // Empty path
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should check if session file exists', async () => {
      const mockFs = fs as any;
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '/nonexistent/session.jsonl',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('FILE_NOT_FOUND');
    });

    it('should validate that path is a file', async () => {
      const mockFs = fs as any;
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ isFile: () => false });

      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '/test/directory',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_FILE_PATH');
    });

    it('should handle invalid options gracefully', async () => {
      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '/test/session.jsonl',
          options: {
            maxEntries: -1, // Invalid negative number
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should process date range options', async () => {
      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '/test/session.jsonl',
          options: {
            dateRange: {
              start: '2024-01-01T10:00:00Z',
              end: '2024-01-01T11:00:00Z',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle parsing errors', async () => {
      mockJsonlParser.parseFile.mockResolvedValue({
        success: false,
        error: 'Invalid JSONL format',
      });

      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '/test/invalid.jsonl',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle no sessions found', async () => {
      const { organizeIntoSessionsOptimized } = require('@app/shared');
      organizeIntoSessionsOptimized.mockReturnValue([]);

      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '/test/empty.jsonl',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/cli/context/:packageId', () => {
    const validHeaders = {
      'X-CLI-Auth-Token': 'valid-token-12345',
      'User-Agent': 'claude-code-cli/1.0',
    };

    it('should retrieve a context package successfully', async () => {
      // First prepare a context package
      const prepareResponse = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '/test/session.jsonl',
        });

      expect(prepareResponse.status).toBe(200);
      const packageId = prepareResponse.body.data.packageId;

      // Then retrieve it
      const response = await request(app)
        .get(`/api/cli/context/${packageId}`)
        .set(validHeaders);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('context');
      expect(response.body.data).toHaveProperty('packageInfo');
      expect(response.body.data.packageInfo.id).toBe(packageId);
    });

    it('should validate package ID format', async () => {
      const response = await request(app)
        .get('/api/cli/context/invalid-id-format')
        .set(validHeaders);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_PACKAGE_ID');
    });

    it('should return 404 for non-existent package', async () => {
      const fakeUuid = '12345678-1234-1234-1234-123456789012';
      const response = await request(app)
        .get(`/api/cli/context/${fakeUuid}`)
        .set(validHeaders);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('PACKAGE_NOT_FOUND');
    });
  });

  describe('POST /api/cli/transfer/:packageId', () => {
    const validHeaders = {
      'X-CLI-Auth-Token': 'valid-token-12345',
      'User-Agent': 'claude-code-cli/1.0',
    };

    it('should mark a package as transferred', async () => {
      // First prepare a context package
      const prepareResponse = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '/test/session.jsonl',
        });

      expect(prepareResponse.status).toBe(200);
      const packageId = prepareResponse.body.data.packageId;

      // Then mark it as transferred
      const response = await request(app)
        .post(`/api/cli/transfer/${packageId}`)
        .set(validHeaders);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.packageId).toBe(packageId);
      expect(response.body.data.status).toBe('transferred');
      expect(response.body.data).toHaveProperty('transferredAt');
    });

    it('should validate package ID format', async () => {
      const response = await request(app)
        .post('/api/cli/transfer/invalid-id-format')
        .set(validHeaders);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_PACKAGE_ID');
    });

    it('should return 404 for non-existent package', async () => {
      const fakeUuid = '12345678-1234-1234-1234-123456789012';
      const response = await request(app)
        .post(`/api/cli/transfer/${fakeUuid}`)
        .set(validHeaders);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('PACKAGE_NOT_FOUND');
    });
  });

  describe('GET /api/cli/status', () => {
    const validHeaders = {
      'X-CLI-Auth-Token': 'valid-token-12345',
      'User-Agent': 'claude-code-cli/1.0',
    };

    it('should return CLI integration status', async () => {
      const response = await request(app)
        .get('/api/cli/status')
        .set(validHeaders);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'operational');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('packages');
      expect(response.body.data).toHaveProperty('limits');
    });

    it('should include package statistics', async () => {
      // Prepare a package to get some stats
      await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '/test/session.jsonl',
        });

      const response = await request(app)
        .get('/api/cli/status')
        .set(validHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.packages).toHaveProperty('total');
      expect(response.body.data.packages).toHaveProperty('ready');
      expect(response.body.data.packages.total).toBeGreaterThan(0);
    });
  });

  describe('GET /api/cli/health', () => {
    const validHeaders = {
      'X-CLI-Auth-Token': 'valid-token-12345',
      'User-Agent': 'claude-code-cli/1.0',
    };

    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/cli/health')
        .set(validHeaders);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
    });
  });

  describe('Rate Limiting', () => {
    const validHeaders = {
      'X-CLI-Auth-Token': 'valid-token-12345',
      'User-Agent': 'claude-code-cli/1.0',
    };

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/cli/health')
        .set(validHeaders);

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should enforce rate limits', async () => {
      const requests = Array.from({ length: 35 }, (_, i) => 
        request(app)
          .get('/api/cli/health')
          .set({
            ...validHeaders,
            'X-CLI-Auth-Token': `rate-limit-test-token-${i}`, // Different tokens to test per-client limits
          })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      // Rate limited responses should have proper error structure
      for (const response of rateLimitedResponses) {
        expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(response.body).toHaveProperty('retryAfter');
      }
    });
  });

  describe('Error Handling', () => {
    const validHeaders = {
      'X-CLI-Auth-Token': 'valid-token-12345',
      'User-Agent': 'claude-code-cli/1.0',
    };

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .set('Content-Type', 'application/json')
        .send('{ invalid json');

      expect(response.status).toBe(400);
    });

    it('should handle service errors gracefully', async () => {
      // Mock a service error
      const { JsonlParser } = require('@app/shared');
      JsonlParser.mockImplementation(() => ({
        parseFile: vi.fn().mockRejectedValue(new Error('Service error')),
      }));

      const response = await request(app)
        .post('/api/cli/context/prepare')
        .set(validHeaders)
        .send({
          sessionPath: '/test/session.jsonl',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});