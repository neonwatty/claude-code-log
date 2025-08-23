import request from 'supertest';
import app from '../../app';
import fs from 'fs';
import path from 'path';
import { IApiResponse } from '../../../../shared/src';
import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';

// Mock fs module
vi.mock('fs');
const mockFs = fs as Mocked<typeof fs>;

// Mock Claude integration service
vi.mock('../../services/claude-integration.service.js', () => ({
  ClaudeIntegrationService: vi.fn().mockImplementation(() => ({
    continueSession: vi.fn().mockResolvedValue({
      success: true,
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'pending'
    }),
    getAllProcessStatus: vi.fn().mockReturnValue([]),
    getProcessStatus: vi.fn().mockReturnValue(null),
    sendInput: vi.fn().mockReturnValue(false),
    killProcess: vi.fn().mockResolvedValue(false)
  }))
}));

describe('Sessions API Routes', () => {
  const validSessionId = '550e8400-e29b-41d4-a716-446655440000';
  const testSessionsData = {
    [validSessionId]: {
      id: validSessionId,
      entries: [
        {
          sessionId: validSessionId,
          timestamp: '2024-01-01T00:00:00Z',
          cwd: '/test/project',
          type: 'user',
          message: { role: 'user', content: 'Hello' }
        },
        {
          sessionId: validSessionId,
          timestamp: '2024-01-01T00:01:00Z',
          cwd: '/test/project',
          type: 'assistant',
          message: { 
            id: 'msg-1',
            role: 'assistant', 
            content: [{ type: 'text', text: 'Hi there!' }],
            type: 'message',
            model: 'claude-3',
            usage: { input_tokens: 10, output_tokens: 5 }
          }
        }
      ],
      firstTimestamp: '2024-01-01T00:00:00Z',
      lastTimestamp: '2024-01-01T00:01:00Z',
      cwd: '/test/project',
      totalUsage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fs.existsSync to return true for test paths
    mockFs.existsSync.mockReturnValue(true);
    
    // Mock fs.readdirSync for directory traversal - prevent infinite recursion
    let callCount = 0;
    mockFs.readdirSync.mockImplementation((dir: any) => {
      callCount++;
      if (callCount > 3) {
        return []; // Prevent infinite recursion
      }
      return [
        { name: 'test.jsonl', isDirectory: () => false } as any
      ];
    });
    
    // Mock fs.readFileSync for JSONL content
    const jsonlContent = Object.values(testSessionsData)
      .flatMap(session => session.entries)
      .map(entry => JSON.stringify(entry))
      .join('\n');
    
    mockFs.readFileSync.mockReturnValue(jsonlContent);
  });

  describe('GET /api/sessions', () => {
    it('should return paginated sessions list', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('sessions');
      expect(body.data).toHaveProperty('pagination');
      expect(Array.isArray(body.data.sessions)).toBe(true);
      expect(body.data.pagination).toHaveProperty('total');
      expect(body.data.pagination).toHaveProperty('limit');
      expect(body.data.pagination).toHaveProperty('offset');
      expect(body.data.pagination).toHaveProperty('hasMore');
    });

    it('should respect pagination parameters', async () => {
      const response = await request(app)
        .get('/api/sessions?limit=1&offset=0')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data.pagination.limit).toBe(1);
      expect(body.data.pagination.offset).toBe(0);
    });

    it('should filter by project when specified', async () => {
      const response = await request(app)
        .get('/api/sessions?project=test')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('sessions');
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/sessions?limit=invalid')
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should enforce maximum limit', async () => {
      const response = await request(app)
        .get('/api/sessions?limit=200')
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
    });
  });

  describe('GET /api/sessions/:id', () => {
    const invalidSessionId = 'invalid-uuid';

    it('should return session details for valid UUID', async () => {
      const response = await request(app)
        .get(`/api/sessions/${validSessionId}`)
        .expect(200); // Now expects 200 since mock data matches UUID

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id', validSessionId);
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get(`/api/sessions/${invalidSessionId}`)
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should include proper error details for validation failures', async () => {
      const response = await request(app)
        .get('/api/sessions/123')
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.data).toHaveProperty('errors');
      expect(Array.isArray(body.data.errors)).toBe(true);
    });
  });

  describe('POST /api/sessions/continue', () => {

    it('should accept valid session continuation request', async () => {
      const requestBody = {
        sessionId: validSessionId,
        command: 'Continue this session'
      };

      const response = await request(app)
        .post('/api/sessions/continue')
        .send(requestBody)
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('sessionId', validSessionId);
      expect(body.data).toHaveProperty('status', 'pending');
    });

    it('should validate required sessionId field', async () => {
      const requestBody = {
        command: 'Continue this session'
      };

      const response = await request(app)
        .post('/api/sessions/continue')
        .send(requestBody)
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid session continuation request');
    });

    it('should return 404 for non-existent session', async () => {
      const requestBody = {
        sessionId: 'non-existent-session-id',
        command: 'Continue this session'
      };

      const response = await request(app)
        .post('/api/sessions/continue')
        .send(requestBody)
        .expect(404);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Session file not found');
    });

    it('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/sessions/continue')
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
    });

    it('should handle invalid field types', async () => {
      const requestBody = {
        sessionId: 123, // Should be string
        command: 'Continue this session'
      };

      const response = await request(app)
        .post('/api/sessions/continue')
        .send(requestBody)
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid session continuation request');
    });
  });

  describe('Error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data.sessions).toEqual([]);
    });

    it('should handle corrupted JSONL files', async () => {
      mockFs.readFileSync.mockReturnValue('invalid-json\n{"valid": "json"}');

      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      // Should still process valid entries
    });
  });

  describe('Response format validation', () => {
    it('should include timestamp in all responses', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body).toHaveProperty('timestamp');
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);
    });

    it('should include success field in all responses', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body).toHaveProperty('success');
      expect(typeof body.success).toBe('boolean');
    });
  });
});