import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import sessionsRouter from '../sessions';
import SessionBranchingService from '../../services/session-branching';

// Mock the SessionBranchingService
vi.mock('../../services/session-branching');

const app = express();
app.use(express.json());
app.use('/api/sessions', sessionsRouter);

describe('Sessions Branching API Endpoints', () => {
  let mockSessionBranchingService: vi.Mocked<SessionBranchingService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionBranchingService = vi.mocked(new SessionBranchingService());
    // Mock the constructor to return our mock instance
    vi.mocked(SessionBranchingService).mockImplementation(() => mockSessionBranchingService);
  });

  describe('POST /api/sessions/:sessionId/branch', () => {
    const validBranchRequest = {
      branchPoint: 2,
      metadata: {
        branchName: 'alternative-approach',
        branchReason: 'Testing different implementation',
        originalMessage: 'Original assistant message preview',
      },
      workingDirectory: '/test/project',
      directoryPath: '/test/jsonl/directory',
    };

    it('should create a branch successfully', async () => {
      // Arrange
      const mockBranchResponse = {
        sessionId: 'new-branch-session-123',
        session: {
          id: 'new-branch-session-123',
          parentSessionId: 'parent-session-123',
          branchPoint: 2,
          branchTimestamp: new Date('2024-01-01T12:00:00Z'),
          branchMetadata: {
            branchName: 'alternative-approach',
            branchReason: 'Testing different implementation',
            originalMessage: 'Original assistant message preview',
          },
          workingDirectory: '/test/project',
          status: 'active',
          createdAt: new Date('2024-01-01T12:00:00Z'),
          lastActiveAt: new Date('2024-01-01T12:00:00Z'),
          commandHistory: [],
        },
        success: true,
      };

      mockSessionBranchingService.createBranch.mockResolvedValue(mockBranchResponse);

      // Act
      const response = await request(app)
        .post('/api/sessions/parent-session-123/branch')
        .send(validBranchRequest);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe('new-branch-session-123');
      expect(response.body.data.session.parentSessionId).toBe('parent-session-123');
      expect(response.body.data.session.branchPoint).toBe(2);
      expect(response.body.data.session.branchMetadata.branchName).toBe('alternative-approach');

      expect(mockSessionBranchingService.createBranch).toHaveBeenCalledWith(
        {
          parentSessionId: 'parent-session-123',
          branchPoint: 2,
          metadata: validBranchRequest.metadata,
          workingDirectory: '/test/project',
          environment: undefined,
        },
        '/test/jsonl/directory'
      );
    });

    it('should handle branch creation failure', async () => {
      // Arrange
      const mockErrorResponse = {
        sessionId: '',
        session: {} as any,
        success: false,
        error: 'Parent session not found',
      };

      mockSessionBranchingService.createBranch.mockResolvedValue(mockErrorResponse);

      // Act
      const response = await request(app)
        .post('/api/sessions/nonexistent-session/branch')
        .send(validBranchRequest);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Parent session not found');
    });

    it('should validate request body - missing branchPoint', async () => {
      // Act
      const response = await request(app)
        .post('/api/sessions/parent-session-123/branch')
        .send({
          metadata: { branchName: 'test' },
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate request body - invalid branchPoint', async () => {
      // Act
      const response = await request(app)
        .post('/api/sessions/parent-session-123/branch')
        .send({
          branchPoint: -1, // Invalid: negative
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      // Arrange
      mockSessionBranchingService.createBranch.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const response = await request(app)
        .post('/api/sessions/parent-session-123/branch')
        .send(validBranchRequest);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database connection failed');
    });
  });

  describe('POST /api/sessions/:sessionId/validate-branch-point', () => {
    const validValidationRequest = {
      branchPoint: 2,
      directoryPath: '/test/jsonl/directory',
    };

    it('should validate branch point successfully', async () => {
      // Arrange
      const mockValidationResponse = {
        valid: true,
        messageExists: true,
        messageType: 'assistant',
        messagePreview: 'This is an assistant message that can be used as a branch point...',
      };

      mockSessionBranchingService.validateBranchPoint.mockResolvedValue(mockValidationResponse);

      // Act
      const response = await request(app)
        .post('/api/sessions/test-session-123/validate-branch-point')
        .send(validValidationRequest);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.messageType).toBe('assistant');

      expect(mockSessionBranchingService.validateBranchPoint).toHaveBeenCalledWith(
        'test-session-123',
        2,
        '/test/jsonl/directory'
      );
    });

    it('should return invalid for user message', async () => {
      // Arrange
      const mockValidationResponse = {
        valid: false,
        messageExists: true,
        messageType: 'user',
        error: 'Branch point 0 is not an assistant message (type: user)',
      };

      mockSessionBranchingService.validateBranchPoint.mockResolvedValue(mockValidationResponse);

      // Act
      const response = await request(app)
        .post('/api/sessions/test-session-123/validate-branch-point')
        .send({
          branchPoint: 0,
          directoryPath: '/test/jsonl/directory',
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.error).toContain('not an assistant message');
    });

    it('should validate request body - missing directoryPath', async () => {
      // Act
      const response = await request(app)
        .post('/api/sessions/test-session-123/validate-branch-point')
        .send({
          branchPoint: 2,
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      // Arrange
      mockSessionBranchingService.validateBranchPoint.mockRejectedValue(new Error('JSONL parsing failed'));

      // Act
      const response = await request(app)
        .post('/api/sessions/test-session-123/validate-branch-point')
        .send(validValidationRequest);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('JSONL parsing failed');
    });
  });

  describe('GET /api/sessions/:sessionId/branches', () => {
    it('should get branches for a session', async () => {
      // Arrange
      const mockBranches = [
        {
          id: 'branch-session-1',
          parentSessionId: 'parent-session-123',
          branchPoint: 2,
          branchTimestamp: new Date('2024-01-01T12:00:00Z'),
          branchMetadata: {
            branchName: 'alternative-approach',
            branchReason: 'Testing different implementation',
          },
          workingDirectory: '/test/project',
          status: 'active',
          createdAt: new Date('2024-01-01T12:00:00Z'),
          lastActiveAt: new Date('2024-01-01T12:01:00Z'),
          commandHistory: [],
        },
        {
          id: 'branch-session-2',
          parentSessionId: 'parent-session-123',
          branchPoint: 4,
          branchTimestamp: new Date('2024-01-01T13:00:00Z'),
          branchMetadata: {
            branchName: 'experimental-feature',
          },
          workingDirectory: '/test/project',
          status: 'active',
          createdAt: new Date('2024-01-01T13:00:00Z'),
          lastActiveAt: new Date('2024-01-01T13:02:00Z'),
          commandHistory: [],
        },
      ];

      mockSessionBranchingService.getBranches.mockResolvedValue(mockBranches);

      // Act
      const response = await request(app)
        .get('/api/sessions/parent-session-123/branches');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.parentSessionId).toBe('parent-session-123');
      expect(response.body.data.branches).toHaveLength(2);
      expect(response.body.data.totalBranches).toBe(2);
      expect(response.body.data.branches[0].id).toBe('branch-session-1');
      expect(response.body.data.branches[1].id).toBe('branch-session-2');

      expect(mockSessionBranchingService.getBranches).toHaveBeenCalledWith('parent-session-123');
    });

    it('should return empty array for session with no branches', async () => {
      // Arrange
      mockSessionBranchingService.getBranches.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/sessions/session-no-branches/branches');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.branches).toHaveLength(0);
      expect(response.body.data.totalBranches).toBe(0);
    });
  });

  describe('GET /api/sessions/:sessionId/branch-tree', () => {
    it('should get branch tree for a session', async () => {
      // Arrange
      const mockBranchTree = {
        root: {
          id: 'root-session-123',
          parentSessionId: undefined,
          branchPoint: undefined,
          branchTimestamp: undefined,
          branchMetadata: undefined,
          workingDirectory: '/test/project',
          status: 'active',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          lastActiveAt: new Date('2024-01-01T10:30:00Z'),
          commandHistory: [],
        },
        branches: new Map([
          ['root-session-123', [
            {
              id: 'branch-session-1',
              parentSessionId: 'root-session-123',
              branchPoint: 2,
              branchTimestamp: new Date('2024-01-01T12:00:00Z'),
              branchMetadata: { branchName: 'alternative' },
              workingDirectory: '/test/project',
              status: 'active',
              createdAt: new Date('2024-01-01T12:00:00Z'),
              lastActiveAt: new Date('2024-01-01T12:01:00Z'),
              commandHistory: [],
            },
          ]],
          ['branch-session-1', [
            {
              id: 'nested-branch-1',
              parentSessionId: 'branch-session-1',
              branchPoint: 1,
              branchTimestamp: new Date('2024-01-01T13:00:00Z'),
              branchMetadata: { branchName: 'nested-experiment' },
              workingDirectory: '/test/project',
              status: 'active',
              createdAt: new Date('2024-01-01T13:00:00Z'),
              lastActiveAt: new Date('2024-01-01T13:01:00Z'),
              commandHistory: [],
            },
          ]],
        ]),
      };

      mockSessionBranchingService.getBranchTree.mockResolvedValue(mockBranchTree);

      // Act
      const response = await request(app)
        .get('/api/sessions/root-session-123/branch-tree');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.root.id).toBe('root-session-123');
      expect(response.body.data.branches['root-session-123']).toHaveLength(1);
      expect(response.body.data.branches['branch-session-1']).toHaveLength(1);

      expect(mockSessionBranchingService.getBranchTree).toHaveBeenCalledWith('root-session-123');
    });

    it('should return 404 for session with no branch tree', async () => {
      // Arrange
      mockSessionBranchingService.getBranchTree.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get('/api/sessions/nonexistent-session/branch-tree');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found or has no branch tree');
    });
  });

  describe('DELETE /api/sessions/:sessionId/branch', () => {
    it('should delete a branch successfully', async () => {
      // Arrange
      mockSessionBranchingService.deleteBranch.mockResolvedValue(true);

      // Act
      const response = await request(app)
        .delete('/api/sessions/branch-session-123/branch');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedSessionId).toBe('branch-session-123');
      expect(response.body.data.message).toContain('deleted successfully');

      expect(mockSessionBranchingService.deleteBranch).toHaveBeenCalledWith('branch-session-123');
    });

    it('should return 404 for non-existent branch', async () => {
      // Arrange
      mockSessionBranchingService.deleteBranch.mockResolvedValue(false);

      // Act
      const response = await request(app)
        .delete('/api/sessions/nonexistent-branch/branch');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should handle service errors', async () => {
      // Arrange
      mockSessionBranchingService.deleteBranch.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .delete('/api/sessions/branch-session-123/branch');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });
});