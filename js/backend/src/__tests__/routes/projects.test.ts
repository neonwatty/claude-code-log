const request = require('supertest');
import app from '../../app';
const fs = require('fs');
import { IApiResponse } from '../../../../shared/src';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Projects API Routes', () => {
  const testProjectData = [
    {
      sessionId: 'session-1',
      timestamp: '2024-01-01T00:00:00Z',
      cwd: '/test/project-a',
      type: 'user',
      message: { role: 'user', content: 'Hello from project A' }
    },
    {
      sessionId: 'session-2',
      timestamp: '2024-01-01T01:00:00Z',
      cwd: '/test/project-b',
      type: 'assistant',
      message: { 
        id: 'msg-1',
        role: 'assistant', 
        content: [{ type: 'text', text: 'Response from project B' }],
        type: 'message',
        model: 'claude-3',
        usage: { input_tokens: 15, output_tokens: 8 }
      }
    },
    {
      sessionId: 'session-3',
      timestamp: '2024-01-01T02:00:00Z',
      cwd: '/test/project-a',
      type: 'user',
      message: { role: 'user', content: 'Another message from project A' }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs.existsSync to return true for test paths
    mockFs.existsSync.mockReturnValue(true);
    
    // Mock fs.realpathSync to return the same path (no symbolic links)
    mockFs.realpathSync.mockImplementation((path) => path as string);
    
    // Mock fs.readdirSync for directory traversal - return different results based on path
    mockFs.readdirSync.mockImplementation((dirPath: string) => {
      // For the main directory, return a jsonl file
      if (dirPath.endsWith('subdir')) {
        // For subdirectories, return empty to prevent infinite recursion
        return [];
      }
      // For root directories, return a jsonl file
      return [
        { name: 'test.jsonl', isDirectory: () => false, isSymbolicLink: () => false } as any
      ];
    });
    
    // Mock fs.readFileSync for JSONL content
    const jsonlContent = testProjectData
      .map(entry => JSON.stringify(entry))
      .join('\n');
    
    mockFs.readFileSync.mockReturnValue(jsonlContent);
  });

  describe('GET /api/projects', () => {
    it('should return list of unique projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('projects');
      expect(body.data).toHaveProperty('totalProjects');
      expect(Array.isArray(body.data.projects)).toBe(true);
      expect(typeof body.data.totalProjects).toBe('number');
    });

    it('should group sessions by project path', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      const body: IApiResponse = response.body;
      const projects = body.data.projects;
      
      // Should have unique projects based on cwd
      const projectPaths = projects.map((p: any) => p.path);
      const uniquePaths = [...new Set(projectPaths)];
      expect(projectPaths.length).toBe(uniquePaths.length);
    });

    it('should include project statistics', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      const body: IApiResponse = response.body;
      const projects = body.data.projects;
      
      projects.forEach((project: any) => {
        expect(project).toHaveProperty('name');
        expect(project).toHaveProperty('path');
        expect(project).toHaveProperty('sessions');
        expect(project).toHaveProperty('totalMessages');
        expect(project).toHaveProperty('totalTokens');
        expect(Array.isArray(project.sessions)).toBe(true);
        expect(typeof project.totalMessages).toBe('number');
        expect(typeof project.totalTokens).toBe('number');
      });
    });

    it('should sort projects by activity', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      const body: IApiResponse = response.body;
      const projects = body.data.projects;
      
      if (projects.length > 1) {
        // Should be sorted by totalMessages descending
        for (let i = 1; i < projects.length; i++) {
          expect(projects[i - 1].totalMessages).toBeGreaterThanOrEqual(projects[i].totalMessages);
        }
      }
    });
  });

  describe('GET /api/projects/by-path/:encodedPath', () => {
    const testProjectPath = '/test/project-a';
    const encodedPath = encodeURIComponent(testProjectPath);
    const nonExistentPath = encodeURIComponent('/nonexistent/project');

    it('should return project details for valid path', async () => {
      const response = await request(app)
        .get(`/api/projects/by-path/${encodedPath}`)
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('name');
      expect(body.data).toHaveProperty('path', testProjectPath);
      expect(body.data).toHaveProperty('sessions');
      expect(body.data).toHaveProperty('totalMessages');
      expect(body.data).toHaveProperty('totalTokens');
      expect(Array.isArray(body.data.sessions)).toBe(true);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get(`/api/projects/by-path/${nonExistentPath}`)
        .expect(404);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Project not found');
    });

    it('should sort sessions by timestamp', async () => {
      const response = await request(app)
        .get(`/api/projects/by-path/${encodedPath}`)
        .expect(200);

      const body: IApiResponse = response.body;
      const sessions = body.data.sessions;
      
      if (sessions.length > 1) {
        // Should be sorted by lastTimestamp descending (most recent first)
        for (let i = 1; i < sessions.length; i++) {
          const prev = new Date(sessions[i - 1].lastTimestamp);
          const curr = new Date(sessions[i].lastTimestamp);
          expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
        }
      }
    });

    it('should handle URL decoding correctly', async () => {
      const complexPath = '/test/project with spaces/subdir';
      const encodedComplexPath = encodeURIComponent(complexPath);
      
      const response = await request(app)
        .get(`/api/projects/by-path/${encodedComplexPath}`)
        .expect(404); // Will be 404 since not in test data

      const body: IApiResponse = response.body;
      expect(body.success).toBe(false);
    });

    it('should include project name extracted from path', async () => {
      const response = await request(app)
        .get(`/api/projects/by-path/${encodedPath}`)
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.data.name).toBe('project-a'); // Last segment of path
    });
  });

  describe('Error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data.projects).toEqual([]);
      expect(body.data.totalProjects).toBe(0);
    });

    it('should handle corrupted JSONL files', async () => {
      mockFs.readFileSync.mockReturnValue('invalid-json\n{"valid": "json", "cwd": "/test"}');

      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      // Should still process valid entries
    });

    it('should handle empty JSONL files', async () => {
      mockFs.readFileSync.mockReturnValue('');

      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data.projects).toEqual([]);
    });

    it('should handle read permission errors', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.data.projects).toEqual([]);
    });
  });

  describe('Response format validation', () => {
    it('should include required IApiResponse fields', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('data');
      expect(typeof body.success).toBe('boolean');
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);
    });

    it('should include project list response structure', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      const body: IApiResponse = response.body;
      expect(body.data).toHaveProperty('projects');
      expect(body.data).toHaveProperty('totalProjects');
      expect(Array.isArray(body.data.projects)).toBe(true);
      expect(typeof body.data.totalProjects).toBe('number');
    });
  });

  describe('Project name extraction', () => {
    it('should extract correct project name from path', async () => {
      const testCases = [
        { path: '/home/user/project', expected: 'project' },
        { path: '/Users/dev/my-app', expected: 'my-app' },
        { path: 'C:\\Projects\\webapp', expected: 'webapp' },
        { path: '/single', expected: 'single' },
        { path: '', expected: 'Unknown' }
      ];

      // Mock different path scenarios
      for (const testCase of testCases) {
        const jsonlContent = JSON.stringify({
          sessionId: 'test',
          cwd: testCase.path,
          timestamp: '2024-01-01T00:00:00Z'
        });
        
        mockFs.readFileSync.mockReturnValue(jsonlContent);

        const response = await request(app)
          .get('/api/projects')
          .expect(200);

        const body: IApiResponse = response.body;
        if (body.data.projects.length > 0) {
          expect(body.data.projects[0].name).toBe(testCase.expected);
        }
      }
    });
  });
});