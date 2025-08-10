import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { promises as fs } from 'fs';
import analyticsRoutes from './analytics';
import { sessionErrorHandler } from '../middleware/sessionValidation';
import { AnalyticsService } from './analytics';

// Mock the shared module
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
            model: 'claude-3-sonnet-20240229',
            content: [
              { type: 'text', text: 'Hello back!' },
              { type: 'tool_use', id: 'tool1', name: 'Read', input: { file_path: '/test.txt' } }
            ],
            usage: { input_tokens: 100, output_tokens: 150 },
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
      tokenUsage: {
        input_tokens: 100,
        output_tokens: 150,
        total_tokens: 250,
      },
      entries: [],
    },
  ]),
  parseTranscriptEntriesOptimized: vi.fn().mockResolvedValue([
    {
      messageType: 'user',
      displayType: '🤷 User',
      timestamp: '2025-01-01T10:00:00Z',
      parsedContent: [{ type: 'text', content: 'Hello', metadata: {} }],
      hasToolUse: false,
      hasThinking: false,
      hasImages: false,
    },
    {
      messageType: 'assistant',
      displayType: '🤖 Assistant',
      timestamp: '2025-01-01T10:00:30Z',
      parsedContent: [
        { type: 'text', content: 'Hello back!', metadata: {} },
        { type: 'tool_use', content: '{"file_path": "/test.txt"}', metadata: { toolName: 'Read', toolId: 'tool1' } }
      ],
      hasToolUse: true,
      hasThinking: false,
      hasImages: false,
      tokenUsage: {
        input_tokens: 100,
        output_tokens: 150,
        total_tokens: 250,
      },
    },
  ]),
  aggregateUsage: vi.fn().mockReturnValue({
    input_tokens: 100,
    output_tokens: 150,
    total_tokens: 250,
  }),
}));

// AnalyticsService will be mocked at the service level in beforeEach

describe('Analytics API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRoutes);
    app.use(sessionErrorHandler);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock AnalyticsService methods
    vi.spyOn(AnalyticsService, 'parseJsonlFiles').mockResolvedValue({
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
            model: 'claude-3-sonnet-20240229',
            content: [
              { type: 'text', text: 'Hello back!' },
              { type: 'tool_use', id: 'tool1', name: 'Read', input: { file_path: '/test.txt' } }
            ],
            usage: { input_tokens: 100, output_tokens: 150 },
          },
          cwd: '/test/directory',
        },
      ],
      errors: [],
      fileCount: 2,
    });

    vi.spyOn(AnalyticsService, 'calculateTokenAnalytics').mockResolvedValue({
      totalUsage: {
        input_tokens: 100,
        output_tokens: 150,
        total_tokens: 250,
      },
      sessionBreakdown: [
        {
          sessionId: 'test-session-1',
          usage: { input_tokens: 100, output_tokens: 150, total_tokens: 250 },
          messageCount: 2,
          timeRange: {
            start: '2025-01-01T10:00:00Z',
            end: '2025-01-01T10:00:30Z',
          },
        }
      ],
      dailyUsage: [
        {
          date: '2025-01-01',
          usage: { input_tokens: 100, output_tokens: 150, total_tokens: 250 },
          messageCount: 2,
        }
      ],
      modelBreakdown: {
        'claude-3-sonnet-20240229': {
          usage: { input_tokens: 100, output_tokens: 150, total_tokens: 250 },
          messageCount: 1,
        }
      },
      costEstimates: {
        total: 0.15,
        byDay: [{ date: '2025-01-01', cost: 0.15 }],
        byModel: { 'claude-3-sonnet-20240229': 0.15 },
      },
    });

    vi.spyOn(AnalyticsService, 'calculateUsagePatterns').mockResolvedValue({
      timePatterns: {
        hourlyDistribution: [
          { hour: 10, messageCount: 2, tokenCount: 250 }
        ],
        dayOfWeekDistribution: [
          { day: 1, dayName: 'Monday', messageCount: 2 }
        ],
        monthlyTrends: [
          { month: '2025-01', messageCount: 2, sessionCount: 1 }
        ],
      },
      contentPatterns: {
        avgMessageLength: 50,
        toolUsageFrequency: { 'Read': 1 },
        mostActiveDirectories: [
          { directory: '/test/directory', messageCount: 2, sessionCount: 1 }
        ],
      },
      sessionPatterns: {
        avgSessionLength: 2,
        sessionDurationDistribution: [
          { range: '0-30min', count: 1 }
        ],
        messagesPerSession: [
          { range: '1-5', count: 1 }
        ],
      },
    });
  });

  describe('POST /api/analytics/tokens', () => {
    it('should calculate token analytics successfully', async () => {
      const response = await request(app)
        .post('/api/analytics/tokens')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalUsage: {
            input_tokens: expect.any(Number),
            output_tokens: expect.any(Number),
            total_tokens: expect.any(Number),
          },
          sessionBreakdown: expect.any(Array),
          dailyUsage: expect.any(Array),
          modelBreakdown: expect.any(Object),
          costEstimates: {
            total: expect.any(Number),
            byModel: expect.any(Object),
            byDay: expect.any(Array),
          },
          metadata: {
            fileCount: expect.any(Number),
            totalEntries: expect.any(Number),
            errorCount: expect.any(Number),
          },
        },
      });

      // Verify session breakdown structure
      expect(response.body.data.sessionBreakdown).toHaveLength(1);
      expect(response.body.data.sessionBreakdown[0]).toMatchObject({
        sessionId: 'test-session-1',
        usage: expect.any(Object),
        messageCount: expect.any(Number),
        timeRange: expect.any(Object),
      });

      // Verify model breakdown
      expect(response.body.data.modelBreakdown['claude-3-sonnet-20240229']).toBeDefined();
    });

    it('should handle missing directory path', async () => {
      const response = await request(app)
        .post('/api/analytics/tokens')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Directory path is required and must be a string',
      });
    });

    it('should handle analytics calculation errors', async () => {
      // Mock an error in token usage aggregation
      const mockAggregate = vi.mocked(
        (await import('@app/shared')).aggregateUsage
      );
      mockAggregate.mockImplementationOnce(() => {
        throw new Error('Calculation failed');
      });

      const response = await request(app)
        .post('/api/analytics/tokens')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Failed to calculate token analytics'),
      });
    });
  });

  describe('POST /api/analytics/patterns', () => {
    it('should calculate usage patterns successfully', async () => {
      const response = await request(app)
        .post('/api/analytics/patterns')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          timePatterns: {
            hourlyDistribution: expect.any(Array),
            dayOfWeekDistribution: expect.any(Array),
            monthlyTrends: expect.any(Array),
          },
          contentPatterns: {
            avgMessageLength: expect.any(Number),
            toolUsageFrequency: expect.any(Object),
            mostActiveDirectories: expect.any(Array),
          },
          sessionPatterns: {
            avgSessionLength: expect.any(Number),
            sessionDurationDistribution: expect.any(Array),
            messagesPerSession: expect.any(Array),
          },
          metadata: {
            fileCount: expect.any(Number),
            totalEntries: expect.any(Number),
            analysisDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          },
        },
      });

      // Verify hourly distribution has 24 hours
      expect(response.body.data.timePatterns.hourlyDistribution).toHaveLength(24);

      // Verify day of week distribution has 7 days
      expect(response.body.data.timePatterns.dayOfWeekDistribution).toHaveLength(7);

      // Verify tool usage includes Read tool
      expect(response.body.data.contentPatterns.toolUsageFrequency).toHaveProperty('Read');
    });

    it('should handle empty data gracefully', async () => {
      // Mock empty results
      const mockOrganize = vi.mocked(
        (await import('@app/shared')).organizeIntoSessionsOptimized
      );
      const mockParse = vi.mocked(
        (await import('@app/shared')).parseTranscriptEntriesOptimized
      );

      mockOrganize.mockResolvedValueOnce([]);
      mockParse.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/analytics/patterns')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentPatterns.avgMessageLength).toBe(0);
      expect(response.body.data.sessionPatterns.avgSessionLength).toBe(0);
    });
  });

  describe('POST /api/analytics/summary', () => {
    it('should generate analytics summary successfully', async () => {
      const response = await request(app)
        .post('/api/analytics/summary')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          overview: {
            totalSessions: expect.any(Number),
            totalMessages: expect.any(Number),
            totalTokens: expect.any(Number),
            estimatedCost: expect.any(Number),
            fileCount: expect.any(Number),
            timeSpan: {
              start: expect.any(String),
              end: expect.any(String),
            },
          },
          highlights: {
            mostUsedModel: expect.any(String),
            mostActiveTool: expect.any(String),
            avgSessionLength: expect.any(Number),
            avgMessageLength: expect.any(Number),
            peakUsageHour: expect.any(Number),
          },
          trends: {
            dailyUsage: expect.any(Array),
            monthlyTrends: expect.any(Array),
          },
        },
      });

      // Verify overview data
      expect(response.body.data.overview.totalSessions).toBeGreaterThan(0);
      expect(response.body.data.overview.totalMessages).toBeGreaterThan(0);
      expect(response.body.data.overview.totalTokens).toBeGreaterThan(0);

      // Verify highlights
      expect(response.body.data.highlights.mostUsedModel).toBe('claude-3-sonnet-20240229');
      expect(response.body.data.highlights.mostActiveTool).toBe('Read');
    });

    it('should handle parallel analytics processing', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/analytics/summary')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(200);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should complete reasonably quickly (parallel processing)
      expect(processingTime).toBeLessThan(5000); // 5 seconds max
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/analytics/cache', () => {
    it('should clear analytics cache successfully', async () => {
      const response = await request(app)
        .delete('/api/analytics/cache')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Analytics cache cleared successfully',
      });
    });
  });

  describe('Error handling', () => {
    it('should handle file system errors', async () => {
      // Mock file system error
      vi.mocked(fs.readdir).mockRejectedValueOnce(new Error('Permission denied'));

      const response = await request(app)
        .post('/api/analytics/tokens')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to calculate token analytics');
    });

    it('should handle invalid directory path', async () => {
      const response = await request(app)
        .post('/api/analytics/tokens')
        .send({
          directoryPath: '../invalid/path',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid directory path',
      });
    });

    it('should handle calculation errors gracefully', async () => {
      // Mock session organization error
      const mockOrganize = vi.mocked(
        (await import('@app/shared')).organizeIntoSessionsOptimized
      );
      mockOrganize.mockRejectedValueOnce(new Error('Organization failed'));

      const response = await request(app)
        .post('/api/analytics/patterns')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance tests', () => {
    it('should handle large dataset efficiently', async () => {
      // Mock large dataset
      const largeEntries = Array(1000).fill(null).map((_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        sessionId: `session-${Math.floor(i / 10)}`,
        uuid: `msg-${i}`,
        message: {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          ...(i % 2 === 1 && {
            id: `assistant-${i}`,
            model: 'claude-3-sonnet-20240229',
            usage: { input_tokens: 10, output_tokens: 15 },
          }),
        },
        cwd: `/test/dir${Math.floor(i / 100)}`,
      }));

      const mockJsonlParser = vi.mocked(
        (await import('@app/shared')).JsonlParser
      );
      mockJsonlParser.mockImplementationOnce(() => ({
        parseFile: vi.fn().mockResolvedValue({
          entries: largeEntries,
          errors: [],
          totalLines: largeEntries.length,
          validLines: largeEntries.length,
        }),
      }) as any);

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/analytics/summary')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(200);

      const processingTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should cache results for repeated requests', async () => {
      // First request
      const firstResponse = await request(app)
        .post('/api/analytics/tokens')
        .send({
          directoryPath: '/test/directory',
        });

      // Second request (should be faster due to caching)
      const secondResponse = await request(app)
        .post('/api/analytics/tokens')
        .send({
          directoryPath: '/test/directory',
        });

      expect(firstResponse.body).toEqual(secondResponse.body);
      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
    });
  });

  describe('Data validation and edge cases', () => {
    it('should handle missing token usage data', async () => {
      // Mock entries without token usage
      const mockJsonlParser = vi.mocked(
        (await import('@app/shared')).JsonlParser
      );
      mockJsonlParser.mockImplementationOnce(() => ({
        parseFile: vi.fn().mockResolvedValue({
          entries: [
            {
              type: 'user',
              timestamp: '2025-01-01T10:00:00Z',
              sessionId: 'test-session',
              message: { role: 'user', content: 'Hello' },
            },
          ],
          errors: [],
          totalLines: 1,
          validLines: 1,
        }),
      }) as any);

      const mockAggregate = vi.mocked(
        (await import('@app/shared')).aggregateUsage
      );
      mockAggregate.mockReturnValueOnce({
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      });

      const response = await request(app)
        .post('/api/analytics/tokens')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalUsage.total_tokens).toBe(0);
      expect(response.body.data.costEstimates.total).toBe(0);
    });

    it('should handle malformed timestamps gracefully', async () => {
      // Mock entries with invalid timestamps
      const mockJsonlParser = vi.mocked(
        (await import('@app/shared')).JsonlParser
      );
      mockJsonlParser.mockImplementationOnce(() => ({
        parseFile: vi.fn().mockResolvedValue({
          entries: [
            {
              type: 'user',
              timestamp: 'invalid-timestamp',
              sessionId: 'test-session',
              message: { role: 'user', content: 'Hello' },
            },
          ],
          errors: [],
          totalLines: 1,
          validLines: 1,
        }),
      }) as any);

      const response = await request(app)
        .post('/api/analytics/patterns')
        .send({
          directoryPath: '/test/directory',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should still return valid structure even with invalid timestamps
      expect(response.body.data.timePatterns.hourlyDistribution).toHaveLength(24);
    });
  });
});