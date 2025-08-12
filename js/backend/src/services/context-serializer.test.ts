import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContextSerializer, ContextSerializationOptions, SerializableSessionContext } from './context-serializer';
import { TranscriptEntry, SessionInfo, UserTranscriptEntry, AssistantTranscriptEntry } from '@app/shared';
import { SessionData } from './session-state';

describe('ContextSerializer', () => {
  let contextSerializer: ContextSerializer;
  let mockSessionInfo: SessionInfo;
  let mockTranscriptEntries: TranscriptEntry[];
  let mockSessionData: SessionData;

  beforeEach(() => {
    contextSerializer = new ContextSerializer();
    
    mockSessionInfo = {
      sessionId: 'test-session-123',
      title: 'Test Session',
      cwd: '/test/project',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T11:00:00Z'),
      messageCount: 5,
      userMessageCount: 3,
      assistantMessageCount: 2,
      duration: 3600000, // 1 hour
      isActive: false,
      tags: ['test', 'development'],
      summary: 'Test session for development',
      tokenUsage: {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      },
    };

    mockTranscriptEntries = [
      {
        type: 'user',
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/test/project',
        sessionId: 'test-session-123',
        version: '1.0.0',
        uuid: 'entry-1',
        timestamp: '2024-01-01T10:00:00Z',
        message: {
          role: 'user',
          content: 'Please help me with this file: /test/project/src/app.ts',
        },
      } as UserTranscriptEntry,
      {
        type: 'assistant',
        parentUuid: null,
        isSidechain: false,
        userType: 'assistant',
        cwd: '/test/project',
        sessionId: 'test-session-123',
        version: '1.0.0',
        uuid: 'entry-2',
        timestamp: '2024-01-01T10:05:00Z',
        message: {
          id: 'msg-1',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-sonnet',
          content: [
            {
              type: 'text',
              text: 'I\'ll help you with the app.ts file. Let me read it first.',
            },
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'str_replace_editor',
              input: {
                command: 'view',
                path: '/test/project/src/app.ts',
              },
            },
          ],
          usage: {
            input_tokens: 200,
            output_tokens: 100,
          },
        },
      } as AssistantTranscriptEntry,
      {
        type: 'user',
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/test/project',
        sessionId: 'test-session-123',
        version: '1.0.0',
        uuid: 'entry-3',
        timestamp: '2024-01-01T10:10:00Z',
        message: {
          role: 'user',
          content: 'Can you also check the package.json file?',
        },
      } as UserTranscriptEntry,
      {
        type: 'assistant',
        parentUuid: null,
        isSidechain: false,
        userType: 'assistant',
        cwd: '/test/project',
        sessionId: 'test-session-123',
        version: '1.0.0',
        uuid: 'entry-4',
        timestamp: '2024-01-01T10:15:00Z',
        message: {
          id: 'msg-2',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-sonnet',
          content: [
            {
              type: 'tool_use',
              id: 'tool-2',
              name: 'bash',
              input: {
                command: 'cat package.json',
              },
            },
          ],
          usage: {
            input_tokens: 150,
            output_tokens: 80,
          },
        },
      } as AssistantTranscriptEntry,
    ];

    mockSessionData = {
      id: 'test-session-123',
      workingDirectory: '/test/project',
      commandHistory: ['cat package.json', 'ls -la'],
      status: 'active',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      lastActiveAt: new Date('2024-01-01T11:00:00Z'),
      metadata: {
        preferences: {
          displayMode: 'detailed',
          theme: 'dark',
          lastPosition: {
            messageIndex: 3,
            timestamp: '2024-01-01T10:15:00Z',
          },
        },
      },
    };
  });

  afterEach(async () => {
    await contextSerializer.shutdown();
  });

  describe('serializeSessionContext', () => {
    it('should serialize basic session context', async () => {
      const options: ContextSerializationOptions = {
        includeAllEntries: true,
        includeTokenUsage: true,
        includeFiles: true,
        includeTools: true,
      };

      const context = await contextSerializer.serializeSessionContext(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData,
        options
      );

      expect(context).toHaveProperty('id');
      expect(context.sessionId).toBe('test-session-123');
      expect(context.session.title).toBe('Test Session');
      expect(context.session.cwd).toBe('/test/project');
      expect(context.entries.total).toBe(4);
      expect(context.entries.included).toBe(4);
      expect(context.entries.data).toHaveLength(4);
      expect(context.cli.contextType).toBe('full');
    });

    it('should filter entries by date range', async () => {
      const options: ContextSerializationOptions = {
        dateRange: {
          start: new Date('2024-01-01T10:05:00Z'),
          end: new Date('2024-01-01T10:10:00Z'),
        },
      };

      const context = await contextSerializer.serializeSessionContext(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData,
        options
      );

      expect(context.entries.included).toBe(2); // Should include entries 2 and 3
      expect(context.cli.contextType).toBe('partial');
    });

    it('should filter entries by message range', async () => {
      const options: ContextSerializationOptions = {
        messageRange: {
          start: 1,
          end: 2,
        },
      };

      const context = await contextSerializer.serializeSessionContext(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData,
        options
      );

      expect(context.entries.included).toBe(2);
      expect(context.entries.range?.startIndex).toBe(1);
      expect(context.entries.range?.endIndex).toBe(2);
    });

    it('should limit entries when not including all', async () => {
      const options: ContextSerializationOptions = {
        includeAllEntries: false,
        maxEntries: 2,
      };

      const context = await contextSerializer.serializeSessionContext(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData,
        options
      );

      expect(context.entries.included).toBe(2);
      expect(context.cli.partialContext).toBe(true);
      expect(context.cli.contextType).toBe('partial');
    });

    it('should extract file references correctly', async () => {
      const context = await contextSerializer.serializeSessionContext(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData,
        { includeFiles: true }
      );

      expect(context.files.referenced).toContain('/test/project/src/app.ts');
      expect(context.files.working).toContain('/test/project');
    });

    it('should extract tool usage correctly', async () => {
      const context = await contextSerializer.serializeSessionContext(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData,
        { includeTools: true }
      );

      expect(context.tools.used).toContain('str_replace_editor');
      expect(context.tools.used).toContain('bash');
      expect(context.tools.commands).toContain('cat package.json');
    });

    it('should include token usage when requested', async () => {
      const context = await contextSerializer.serializeSessionContext(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData,
        { includeTokenUsage: true }
      );

      expect(context.tokenUsage).toBeDefined();
      expect(context.tokenUsage?.session.totalInputTokens).toBe(1000);
      expect(context.tokenUsage?.session.totalOutputTokens).toBe(500);
    });

    it('should include preferences when available', async () => {
      const context = await contextSerializer.serializeSessionContext(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData,
        { includePreferences: true }
      );

      expect(context.preferences).toBeDefined();
      expect(context.preferences?.displayMode).toBe('detailed');
      expect(context.preferences?.theme).toBe('dark');
    });

    it('should exclude optional data when not requested', async () => {
      const options: ContextSerializationOptions = {
        includeFiles: false,
        includeTools: false,
        includeTokenUsage: false,
        includePreferences: false,
      };

      const context = await contextSerializer.serializeSessionContext(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData,
        options
      );

      expect(context.files.referenced).toHaveLength(0);
      expect(context.tools.used).toHaveLength(0);
      expect(context.tokenUsage).toBeUndefined();
      expect(context.preferences).toBeUndefined();
    });
  });

  describe('prepareContextPackage', () => {
    it('should create a context package successfully', async () => {
      const result = await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData
      );

      expect(result.package).toHaveProperty('id');
      expect(result.package.sessionId).toBe('test-session-123');
      expect(result.package.status).toBe('ready');
      expect(result.stats.entriesIncluded).toBe(4);
      expect(result.stats.totalEntries).toBe(4);
      expect(result.stats.processingTimeMs).toBeGreaterThan(0);
    });

    it('should compress large contexts', async () => {
      // Create a large context by duplicating entries
      const largeEntries = Array.from({ length: 100 }, (_, i) => ({
        ...mockTranscriptEntries[0],
        uuid: `entry-${i}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
      }));

      const result = await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        largeEntries,
        mockSessionData,
        { compress: true }
      );

      expect(result.package.info.compressed).toBe(true);
      expect(result.stats.compressionRatio).toBeGreaterThan(1);
      expect(result.package.info.originalSize).toBeGreaterThan(result.package.info.size);
    });

    it('should not compress small contexts', async () => {
      const result = await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        mockTranscriptEntries.slice(0, 1), // Small context
        mockSessionData,
        { compress: true }
      );

      expect(result.package.info.compressed).toBe(false);
      expect(result.stats.compressionRatio).toBeUndefined();
    });

    it('should handle compression failure gracefully', async () => {
      // Mock gzip to throw an error
      const originalGzip = require('zlib').gzip;
      vi.spyOn(require('zlib'), 'gzip').mockImplementation(() => {
        throw new Error('Compression failed');
      });

      const result = await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData,
        { compress: true }
      );

      expect(result.warnings).toContain(expect.stringContaining('Compression failed'));
      expect(result.package.info.compressed).toBe(false);

      // Restore original function
      require('zlib').gzip = originalGzip;
    });
  });

  describe('getContextPackage', () => {
    it('should retrieve a stored package', async () => {
      const result = await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData
      );

      const retrieved = await contextSerializer.getContextPackage(result.package.id);

      expect(retrieved).toEqual(result.package);
    });

    it('should return null for non-existent package', async () => {
      const retrieved = await contextSerializer.getContextPackage('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should return null for expired package', async () => {
      const result = await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData
      );

      // Manually set expiry to past
      const pkg = await contextSerializer.getContextPackage(result.package.id);
      if (pkg) {
        pkg.expiresAt = new Date(Date.now() - 1000); // 1 second ago
      }

      const retrieved = await contextSerializer.getContextPackage(result.package.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('deserializeContextPackage', () => {
    it('should deserialize an uncompressed package', async () => {
      const result = await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData,
        { compress: false }
      );

      const deserialized = await contextSerializer.deserializeContextPackage(result.package);

      expect(deserialized).toHaveProperty('sessionId', 'test-session-123');
      expect(deserialized.entries.data).toHaveLength(4);
    });

    it('should deserialize a compressed package', async () => {
      // Create a context large enough to trigger compression
      const largeEntries = Array.from({ length: 100 }, (_, i) => ({
        ...mockTranscriptEntries[0],
        uuid: `entry-${i}`,
      }));

      const result = await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        largeEntries,
        mockSessionData,
        { compress: true }
      );

      // Only test if compression actually occurred
      if (result.package.info.compressed) {
        const deserialized = await contextSerializer.deserializeContextPackage(result.package);

        expect(deserialized).toHaveProperty('sessionId', 'test-session-123');
        expect(deserialized.entries.data).toHaveLength(100);
      }
    });

    it('should detect corrupted packages', async () => {
      const result = await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData
      );

      // Corrupt the checksum
      result.package.info.checksum = 'invalid-checksum';

      await expect(
        contextSerializer.deserializeContextPackage(result.package)
      ).rejects.toThrow('checksum mismatch');
    });
  });

  describe('markPackageTransferred', () => {
    it('should mark a ready package as transferred', async () => {
      const result = await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData
      );

      const success = contextSerializer.markPackageTransferred(result.package.id);

      expect(success).toBe(true);

      const pkg = await contextSerializer.getContextPackage(result.package.id);
      expect(pkg?.status).toBe('transferred');
    });

    it('should return false for non-existent package', () => {
      const success = contextSerializer.markPackageTransferred('non-existent-id');
      expect(success).toBe(false);
    });
  });

  describe('getPackageStats', () => {
    it('should return correct package statistics', async () => {
      // Create multiple packages
      await contextSerializer.prepareContextPackage(mockSessionInfo, mockTranscriptEntries, mockSessionData);
      const result2 = await contextSerializer.prepareContextPackage(mockSessionInfo, mockTranscriptEntries, mockSessionData);
      
      contextSerializer.markPackageTransferred(result2.package.id);

      const stats = contextSerializer.getPackageStats();

      expect(stats.total).toBe(2);
      expect(stats.ready).toBe(1);
      expect(stats.transferred).toBe(1);
      expect(stats.expired).toBe(0);
    });
  });

  describe('cleanup and lifecycle', () => {
    it('should clean up expired packages', async () => {
      const result = await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData
      );

      // Get the package and manually expire it
      const pkg = await contextSerializer.getContextPackage(result.package.id);
      if (pkg) {
        pkg.expiresAt = new Date(Date.now() - 1000);
      }

      // Trigger cleanup by trying to get the package
      const retrieved = await contextSerializer.getContextPackage(result.package.id);
      expect(retrieved).toBeNull();
    });

    it('should shutdown cleanly', async () => {
      await contextSerializer.prepareContextPackage(
        mockSessionInfo,
        mockTranscriptEntries,
        mockSessionData
      );

      await expect(contextSerializer.shutdown()).resolves.toBeUndefined();

      const stats = contextSerializer.getPackageStats();
      expect(stats.total).toBe(0);
    });
  });
});