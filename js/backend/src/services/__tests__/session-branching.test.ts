import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import SessionBranchingService, { BranchCreationRequest } from '../session-branching';
import SessionStateManager from '../session-state';
import { TranscriptEntry, JsonlParser, organizeIntoSessionsOptimized } from '@app/shared';

// Mock the SessionStateManager
vi.mock('../session-state');

// Mock fs promises and createReadStream
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    promises: {
      readdir: vi.fn(),
      writeFile: vi.fn(),
    },
    createReadStream: vi.fn(),
  };
});

// Mock the @app/shared module
vi.mock('@app/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/shared')>();
  return {
    ...actual,
    JsonlParser: vi.fn().mockImplementation(() => ({
      parseFile: vi.fn(),
    })),
    organizeIntoSessionsOptimized: vi.fn(),
  };
});

describe('SessionBranchingService', () => {
  let service: SessionBranchingService;
  let mockSessionStateManager: vi.Mocked<SessionStateManager>;

  const mockTranscriptEntries: TranscriptEntry[] = [
    {
      type: 'user',
      message: {
        role: 'user',
        content: 'Hello, can you help me with a coding problem?'
      },
      parentUuid: undefined,
      isSidechain: false,
      userType: 'human',
      cwd: '/test/project',
      sessionId: 'test-session-123',
      version: '1.0.0',
      uuid: 'msg-1',
      timestamp: '2024-01-01T10:00:00Z',
    },
    {
      type: 'assistant',
      message: {
        id: 'msg-2',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-sonnet',
        content: [
          {
            type: 'text',
            text: 'Of course! I\'d be happy to help you with your coding problem. What specific issue are you working on?'
          }
        ]
      },
      parentUuid: undefined,
      isSidechain: false,
      userType: 'assistant',
      cwd: '/test/project',
      sessionId: 'test-session-123',
      version: '1.0.0',
      uuid: 'msg-2',
      timestamp: '2024-01-01T10:01:00Z',
    },
    {
      type: 'user',
      message: {
        role: 'user',
        content: 'I\'m working on a React component and having trouble with state management.'
      },
      parentUuid: undefined,
      isSidechain: false,
      userType: 'human',
      cwd: '/test/project',
      sessionId: 'test-session-123',
      version: '1.0.0',
      uuid: 'msg-3',
      timestamp: '2024-01-01T10:02:00Z',
    },
    {
      type: 'assistant',
      message: {
        id: 'msg-4',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-sonnet',
        content: [
          {
            type: 'text',
            text: 'React state management can be tricky! Let me help you with that. There are several approaches we can take...'
          }
        ]
      },
      parentUuid: undefined,
      isSidechain: false,
      userType: 'assistant',
      cwd: '/test/project',
      sessionId: 'test-session-123',
      version: '1.0.0',
      uuid: 'msg-4',
      timestamp: '2024-01-01T10:03:00Z',
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create service instance
    service = new SessionBranchingService();
    
    // Get the mocked SessionStateManager instance
    mockSessionStateManager = vi.mocked(new SessionStateManager());
    (service as any).sessionStateManager = mockSessionStateManager;

    // Mock fs.readdir to return JSONL files
    vi.mocked(fs.readdir).mockResolvedValue(['session1.jsonl', 'session2.jsonl', 'other.txt'] as any);
  });

  afterEach(() => {
    if (service) {
      service.clearCache();
    }
  });

  describe('createBranch', () => {
    const mockParentSession = {
      id: 'parent-session-123',
      workingDirectory: '/test/project',
      environment: { NODE_ENV: 'test' },
      commandHistory: [],
      status: 'active' as const,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      lastActiveAt: new Date('2024-01-01T10:05:00Z'),
    };

    const mockBranchSession = {
      id: 'branch-session-456',
      parentSessionId: 'parent-session-123',
      branchPoint: 1,
      branchTimestamp: new Date('2024-01-01T11:00:00Z'),
      branchMetadata: {
        branchName: 'alternative-approach',
        branchReason: 'Testing different implementation',
        originalMessage: 'Original assistant message',
      },
      workingDirectory: '/test/project',
      environment: { NODE_ENV: 'test' },
      commandHistory: [],
      status: 'active' as const,
      createdAt: new Date('2024-01-01T11:00:00Z'),
      lastActiveAt: new Date('2024-01-01T11:00:00Z'),
    };

    it('should create a branch successfully', async () => {
      // Arrange
      mockSessionStateManager.getSession.mockReturnValue(mockParentSession);
      mockSessionStateManager.createBranch.mockResolvedValue('branch-session-456');
      mockSessionStateManager.getSession.mockReturnValueOnce(mockParentSession);
      mockSessionStateManager.getSession.mockReturnValueOnce(mockBranchSession);

      const request: BranchCreationRequest = {
        parentSessionId: 'parent-session-123',
        branchPoint: 1,
        metadata: {
          branchName: 'alternative-approach',
          branchReason: 'Testing different implementation',
          originalMessage: 'Original assistant message',
        },
      };

      // Act
      const result = await service.createBranch(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('branch-session-456');
      expect(result.session).toEqual(mockBranchSession);
      expect(mockSessionStateManager.createBranch).toHaveBeenCalledWith(
        'parent-session-123',
        1,
        {
          branchName: 'alternative-approach',
          branchReason: 'Testing different implementation',
          originalMessage: 'Original assistant message',
          workingDirectory: '/test/project',
          environment: { NODE_ENV: 'test' },
        }
      );
    });

    it('should fail when parent session does not exist', async () => {
      // Arrange
      mockSessionStateManager.getSession.mockReturnValue(undefined);

      const request: BranchCreationRequest = {
        parentSessionId: 'nonexistent-session',
        branchPoint: 1,
      };

      // Act
      const result = await service.createBranch(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Parent session nonexistent-session not found');
    });

    it('should fail when branch creation fails', async () => {
      // Arrange
      mockSessionStateManager.getSession.mockReturnValue(mockParentSession);
      mockSessionStateManager.createBranch.mockResolvedValue(null);

      const request: BranchCreationRequest = {
        parentSessionId: 'parent-session-123',
        branchPoint: 1,
      };

      // Act
      const result = await service.createBranch(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create branch session');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockSessionStateManager.getSession.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request: BranchCreationRequest = {
        parentSessionId: 'parent-session-123',
        branchPoint: 1,
      };

      // Act
      const result = await service.createBranch(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('validateBranchPoint', () => {
    beforeEach(() => {
      // Configure the JsonlParser mock
      const mockJsonlParser = {
        parseFile: vi.fn().mockResolvedValue({
          entries: mockTranscriptEntries,
          errors: [],
        }),
      };

      // Configure the mocked modules directly
      vi.mocked(JsonlParser).mockImplementation(() => mockJsonlParser as any);
      vi.mocked(organizeIntoSessionsOptimized).mockResolvedValue([
        {
          sessionId: 'test-session-123',
          entries: mockTranscriptEntries,
          messageCount: mockTranscriptEntries.length,
        }
      ]);

      // Mock fs.readdir
      vi.mocked(fs.readdir).mockResolvedValue(['session1.jsonl', 'session2.jsonl', 'other.txt'] as any);
    });

    it('should validate a valid assistant message branch point', async () => {
      // Act
      const result = await service.validateBranchPoint('test-session-123', 1, '/test/directory');

      // Assert
      expect(result.valid).toBe(true);
      expect(result.messageExists).toBe(true);
      expect(result.messageType).toBe('assistant');
      expect(result.messagePreview).toContain('Of course! I\'d be happy to help');
    });

    it('should reject a user message branch point', async () => {
      // Act
      const result = await service.validateBranchPoint('test-session-123', 0, '/test/directory');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.messageExists).toBe(true);
      expect(result.messageType).toBe('user');
      expect(result.error).toContain('is not an assistant message');
    });

    it('should reject branch point beyond session length', async () => {
      // Act
      const result = await service.validateBranchPoint('test-session-123', 10, '/test/directory');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.messageExists).toBe(false);
      expect(result.error).toContain('exceeds session length');
    });

    it('should handle session not found', async () => {
      // Mock organizeIntoSessionsOptimized to return empty array for this test
      vi.mocked(organizeIntoSessionsOptimized).mockResolvedValueOnce([]);

      // Act
      const result = await service.validateBranchPoint('nonexistent-session', 1, '/test/directory');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found in directory');
    });

    it('should use cache for repeated validations', async () => {
      // Clear any previous calls to fs.readdir
      vi.mocked(fs.readdir).mockClear();
      
      // First call
      const result1 = await service.validateBranchPoint('test-session-123', 1, '/test/directory');
      
      // Second call with same parameters
      const result2 = await service.validateBranchPoint('test-session-123', 1, '/test/directory');

      expect(result1).toEqual(result2);
      // fs.readdir should only be called once due to caching
      expect(fs.readdir).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBranches', () => {
    it('should return branches from SessionStateManager', async () => {
      // Arrange
      const mockBranches = [
        {
          id: 'branch-1',
          parentSessionId: 'parent-session',
          branchPoint: 1,
          branchTimestamp: new Date('2024-01-01T11:00:00Z'),
          status: 'active' as const,
          createdAt: new Date('2024-01-01T11:00:00Z'),
          lastActiveAt: new Date('2024-01-01T11:00:00Z'),
          workingDirectory: '/test',
          commandHistory: [],
        },
        {
          id: 'branch-2',
          parentSessionId: 'parent-session',
          branchPoint: 3,
          branchTimestamp: new Date('2024-01-01T12:00:00Z'),
          status: 'active' as const,
          createdAt: new Date('2024-01-01T12:00:00Z'),
          lastActiveAt: new Date('2024-01-01T12:00:00Z'),
          workingDirectory: '/test',
          commandHistory: [],
        },
      ];

      mockSessionStateManager.getBranches.mockReturnValue(mockBranches);

      // Act
      const result = await service.getBranches('parent-session');

      // Assert
      expect(result).toEqual(mockBranches);
      expect(mockSessionStateManager.getBranches).toHaveBeenCalledWith('parent-session');
    });
  });

  describe('getBranchTree', () => {
    it('should return branch tree from SessionStateManager', async () => {
      // Arrange
      const mockBranchTree = {
        root: {
          id: 'root-session',
          status: 'active' as const,
          createdAt: new Date(),
          lastActiveAt: new Date(),
          workingDirectory: '/test',
          commandHistory: [],
        },
        branches: new Map([
          ['root-session', [
            {
              id: 'branch-1',
              parentSessionId: 'root-session',
              branchPoint: 1,
              status: 'active' as const,
              createdAt: new Date(),
              lastActiveAt: new Date(),
              workingDirectory: '/test',
              commandHistory: [],
            },
          ]],
        ]),
      };

      mockSessionStateManager.getBranchTree.mockReturnValue(mockBranchTree);

      // Act
      const result = await service.getBranchTree('root-session');

      // Assert
      expect(result).toEqual(mockBranchTree);
      expect(mockSessionStateManager.getBranchTree).toHaveBeenCalledWith('root-session');
    });
  });

  describe('deleteBranch', () => {
    it('should delete branch using SessionStateManager', async () => {
      // Arrange
      mockSessionStateManager.terminateSession.mockResolvedValue(true);

      // Act
      const result = await service.deleteBranch('branch-session-123');

      // Assert
      expect(result).toBe(true);
      expect(mockSessionStateManager.terminateSession).toHaveBeenCalledWith('branch-session-123');
    });

    it('should return false when branch does not exist', async () => {
      // Arrange
      mockSessionStateManager.terminateSession.mockResolvedValue(false);

      // Act
      const result = await service.deleteBranch('nonexistent-branch');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache correctly', () => {
      // Act
      service.clearCache();

      // Assert - should not throw any errors
      expect(() => service.clearCache()).not.toThrow();
    });
  });
});