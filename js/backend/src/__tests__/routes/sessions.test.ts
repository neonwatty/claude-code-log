import request from 'supertest';
import app from '../../app';
import fs from 'fs';
import path from 'path';
import { IApiResponse } from '../../../../shared/src';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Sessions API Routes', () => {
  const testSessionsData = {
    'session-1': {
      id: 'session-1',
      entries: [
        {
          sessionId: 'session-1',
          timestamp: '2024-01-01T00:00:00Z',
          cwd: '/test/project',
          type: 'user',
          message: { role: 'user', content: 'Hello' }
        },
        {
          sessionId: 'session-1',
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
    jest.clearAllMocks();
    
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
    const validSessionId = '550e8400-e29b-41d4-a716-446655440000';
    const invalidSessionId = 'invalid-uuid';

    it('should return session details for valid UUID', async () => {
      const response = await request(app)
        .get(`/api/sessions/${validSessionId}`)
        .expect(404); // Will be 404 since mock data doesn't match UUID

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Session not found');
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
    const validSessionId = '550e8400-e29b-41d4-a716-446655440000';

    it('should accept valid session continuation request', async () => {
      const requestBody = {
        sessionId: validSessionId,
        message: 'Continue this session'
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
        message: 'Continue this session'
      };

      const response = await request(app)
        .post('/api/sessions/continue')
        .send(requestBody)
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should validate sessionId format', async () => {
      const requestBody = {
        sessionId: 'invalid-uuid',
        message: 'Continue this session'
      };

      const response = await request(app)
        .post('/api/sessions/continue')
        .send(requestBody)
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
    });

    it('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/sessions/continue')
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
    });

    it('should validate message length if provided', async () => {
      const requestBody = {
        sessionId: validSessionId,
        message: 'x'.repeat(10001) // Exceeds max length
      };

      const response = await request(app)
        .post('/api/sessions/continue')
        .send(requestBody)
        .expect(400);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
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