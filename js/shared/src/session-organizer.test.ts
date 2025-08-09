import { describe, it, expect } from 'vitest';
import {
  organizeIntoSessions,
  organizeProject,
  findSessionsByWorkingDirectory,
  findSessionsByTimeRange,
  getSessionStatistics,
  formatSessionSummary,
  type SessionInfo,
  type ProjectSessions,
} from './session-organizer';
import { detectMessageType } from './message-detector';

// Test data helpers
function createUserMessage(sessionId: string, timestamp: string, content: string, cwd: string = '/tmp') {
  return {
    type: 'user',
    timestamp,
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd,
    sessionId,
    version: '1.0.0',
    uuid: `user_${sessionId}_${Date.now()}`,
    message: {
      role: 'user',
      content: [{ type: 'text', text: content }],
    },
  };
}

function createAssistantMessage(sessionId: string, timestamp: string, content: string, usage: any = undefined, cwd: string = '/tmp') {
  return {
    type: 'assistant',
    timestamp,
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd,
    sessionId,
    version: '1.0.0',
    uuid: `assistant_${sessionId}_${Date.now()}`,
    message: {
      id: `assistant_${sessionId}_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet-20240229',
      content: [{ type: 'text', text: content }],
      usage,
    },
  };
}

function createSummaryMessage(leafUuid: string, summary: string, cwd?: string) {
  return {
    type: 'summary',
    summary,
    leafUuid,
    cwd,
  };
}

describe('Session Organizer', () => {
  describe('organizeIntoSessions', () => {
    it('should organize entries into sessions correctly', () => {
      const messages = [
        createUserMessage('session1', '2025-07-03T15:50:00Z', 'Hello from session 1'),
        createAssistantMessage('session1', '2025-07-03T15:51:00Z', 'Response from session 1', {
          input_tokens: 100,
          output_tokens: 150,
        }),
        createUserMessage('session2', '2025-07-03T16:00:00Z', 'Hello from session 2'),
        createAssistantMessage('session2', '2025-07-03T16:01:00Z', 'Response from session 2', {
          input_tokens: 200,
          output_tokens: 250,
        }),
      ];

      const entries = messages.map(msg => detectMessageType(msg).entry!).filter(e => e);
      const sessions = organizeIntoSessions(entries);

      expect(sessions).toHaveLength(2);
      
      const session1 = sessions.find(s => s.sessionId === 'session1')!;
      expect(session1).toBeDefined();
      expect(session1.messageCount).toBe(2);
      expect(session1.userMessageCount).toBe(1);
      expect(session1.assistantMessageCount).toBe(1);
      expect(session1.firstUserMessage).toBe('Hello from session 1');
      expect(session1.tokenUsage?.total_tokens).toBe(250);

      const session2 = sessions.find(s => s.sessionId === 'session2')!;
      expect(session2).toBeDefined();
      expect(session2.messageCount).toBe(2);
      expect(session2.tokenUsage?.total_tokens).toBe(450);
    });

    it('should handle sessions with summaries', () => {
      const assistantUuid = 'assistant_123';
      const messages = [
        createUserMessage('session1', '2025-07-03T15:50:00Z', 'Hello'),
        createAssistantMessage('session1', '2025-07-03T15:51:00Z', 'Response'),
        createSummaryMessage(assistantUuid, 'This session was about greetings'),
      ];

      // Set the assistant message UUID to match the summary leafUuid
      messages[1].uuid = assistantUuid;

      const entries = messages.map(msg => detectMessageType(msg).entry!).filter(e => e);
      const sessions = organizeIntoSessions(entries);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].summaryCount).toBe(1);
      expect(sessions[0].summary).toBe('This session was about greetings');
    });

    it('should sort sessions chronologically', () => {
      const messages = [
        createUserMessage('session2', '2025-07-03T16:00:00Z', 'Later session'),
        createUserMessage('session1', '2025-07-03T15:00:00Z', 'Earlier session'),
      ];

      const entries = messages.map(msg => detectMessageType(msg).entry!).filter(e => e);
      const sessions = organizeIntoSessions(entries, { sortBy: 'chronological' });

      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe('session1'); // Earlier session first
      expect(sessions[1].sessionId).toBe('session2');
    });

    it('should sort sessions reverse-chronologically', () => {
      const messages = [
        createUserMessage('session1', '2025-07-03T15:00:00Z', 'Earlier session'),
        createUserMessage('session2', '2025-07-03T16:00:00Z', 'Later session'),
      ];

      const entries = messages.map(msg => detectMessageType(msg).entry!).filter(e => e);
      const sessions = organizeIntoSessions(entries, { sortBy: 'reverse-chronological' });

      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe('session2'); // Later session first
      expect(sessions[1].sessionId).toBe('session1');
    });

    it('should filter sessions by minimum message count', () => {
      const messages = [
        createUserMessage('session1', '2025-07-03T15:00:00Z', 'Only one message'),
        createUserMessage('session2', '2025-07-03T16:00:00Z', 'First message'),
        createAssistantMessage('session2', '2025-07-03T16:01:00Z', 'Second message'),
      ];

      const entries = messages.map(msg => detectMessageType(msg).entry!).filter(e => e);
      const sessions = organizeIntoSessions(entries, { minMessageCount: 2 });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('session2');
    });

    it('should truncate long message previews', () => {
      const longMessage = 'A'.repeat(300);
      const messages = [
        createUserMessage('session1', '2025-07-03T15:00:00Z', longMessage),
      ];

      const entries = messages.map(msg => detectMessageType(msg).entry!).filter(e => e);
      const sessions = organizeIntoSessions(entries, { maxPreviewLength: 100 });

      expect(sessions[0].firstUserMessage).toHaveLength(103); // 100 + '...'
      expect(sessions[0].firstUserMessage?.endsWith('...')).toBe(true);
    });

    it('should handle sessions without token usage when disabled', () => {
      const messages = [
        createUserMessage('session1', '2025-07-03T15:00:00Z', 'Hello'),
        createAssistantMessage('session1', '2025-07-03T15:01:00Z', 'Response', {
          input_tokens: 100,
          output_tokens: 150,
        }),
      ];

      const entries = messages.map(msg => detectMessageType(msg).entry!).filter(e => e);
      const sessions = organizeIntoSessions(entries, { includeTokenUsage: false });

      expect(sessions[0].tokenUsage).toBeUndefined();
    });

    it('should handle different working directories', () => {
      const messages = [
        createUserMessage('session1', '2025-07-03T15:00:00Z', 'Hello', '/home/user/project1'),
        createUserMessage('session2', '2025-07-03T16:00:00Z', 'Hello', '/home/user/project2'),
      ];

      const entries = messages.map(msg => detectMessageType(msg).entry!).filter(e => e);
      const sessions = organizeIntoSessions(entries);

      expect(sessions[0].workingDirectory).toBe('/home/user/project1');
      expect(sessions[1].workingDirectory).toBe('/home/user/project2');
    });
  });

  describe('organizeProject', () => {
    it('should create project-level organization', () => {
      const messages = [
        createUserMessage('session1', '2025-07-03T15:00:00Z', 'Hello', '/project'),
        createAssistantMessage('session1', '2025-07-03T15:01:00Z', 'Response', {
          input_tokens: 100,
          output_tokens: 150,
        }, '/project'),
        createUserMessage('session2', '2025-07-03T16:00:00Z', 'Hello', '/project'),
        createAssistantMessage('session2', '2025-07-03T16:01:00Z', 'Response', {
          input_tokens: 200,
          output_tokens: 250,
        }, '/project'),
      ];

      const entries = messages.map(msg => detectMessageType(msg).entry!).filter(e => e);
      const project = organizeProject(entries);

      expect(project.sessionCount).toBe(2);
      expect(project.totalMessages).toBe(4);
      expect(project.timeRange.start).toBeDefined();
      expect(project.timeRange.end).toBeDefined();
      expect(project.sessions).toHaveLength(2);
      expect(project.sessionsByWorkingDirectory['/project']).toHaveLength(2);
    });

    it('should group sessions by working directory', () => {
      const messages = [
        createUserMessage('session1', '2025-07-03T15:00:00Z', 'Hello', '/project1'),
        createUserMessage('session2', '2025-07-03T16:00:00Z', 'Hello', '/project1'),
        createUserMessage('session3', '2025-07-03T17:00:00Z', 'Hello', '/project2'),
      ];

      const entries = messages.map(msg => detectMessageType(msg).entry!).filter(e => e);
      const project = organizeProject(entries, { groupByWorkingDirectory: true });

      expect(project.sessionsByWorkingDirectory['/project1']).toHaveLength(2);
      expect(project.sessionsByWorkingDirectory['/project2']).toHaveLength(1);
    });
  });

  describe('findSessionsByWorkingDirectory', () => {
    it('should find sessions matching working directory pattern', () => {
      const sessions: SessionInfo[] = [
        {
          sessionId: 'session1',
          workingDirectory: '/home/user/my-project',
          messageCount: 2,
          userMessageCount: 1,
          assistantMessageCount: 1,
          summaryCount: 0,
          timeRange: { start: null, end: null },
          summary: '',
          entries: [],
        },
        {
          sessionId: 'session2',
          workingDirectory: '/home/user/another-project',
          messageCount: 2,
          userMessageCount: 1,
          assistantMessageCount: 1,
          summaryCount: 0,
          timeRange: { start: null, end: null },
          summary: '',
          entries: [],
        },
      ];

      const matches = findSessionsByWorkingDirectory(sessions, 'my-project');
      expect(matches).toHaveLength(1);
      expect(matches[0].sessionId).toBe('session1');

      const allMatches = findSessionsByWorkingDirectory(sessions, '/home/user');
      expect(allMatches).toHaveLength(2);
    });
  });

  describe('findSessionsByTimeRange', () => {
    it('should find sessions within time range', () => {
      const startDate1 = new Date('2025-07-03T15:00:00Z');
      const startDate2 = new Date('2025-07-03T16:00:00Z');
      
      const sessions: SessionInfo[] = [
        {
          sessionId: 'session1',
          workingDirectory: '/tmp',
          messageCount: 1,
          userMessageCount: 1,
          assistantMessageCount: 0,
          summaryCount: 0,
          timeRange: { start: startDate1, end: null },
          summary: '',
          entries: [],
        },
        {
          sessionId: 'session2',
          workingDirectory: '/tmp',
          messageCount: 1,
          userMessageCount: 1,
          assistantMessageCount: 0,
          summaryCount: 0,
          timeRange: { start: startDate2, end: null },
          summary: '',
          entries: [],
        },
      ];

      // Find sessions after 15:30
      const matches = findSessionsByTimeRange(sessions, new Date('2025-07-03T15:30:00Z'));
      expect(matches).toHaveLength(1);
      expect(matches[0].sessionId).toBe('session2');

      // Find sessions between 15:00 and 15:30
      const rangeMatches = findSessionsByTimeRange(
        sessions, 
        new Date('2025-07-03T14:00:00Z'),
        new Date('2025-07-03T15:30:00Z')
      );
      expect(rangeMatches).toHaveLength(1);
      expect(rangeMatches[0].sessionId).toBe('session1');
    });
  });

  describe('getSessionStatistics', () => {
    it('should calculate session statistics correctly', () => {
      const sessions: SessionInfo[] = [
        {
          sessionId: 'session1',
          workingDirectory: '/project1',
          messageCount: 4,
          userMessageCount: 2,
          assistantMessageCount: 2,
          summaryCount: 0,
          timeRange: { 
            start: new Date('2025-07-03T15:00:00Z'), 
            end: new Date('2025-07-03T15:10:00Z') 
          },
          summary: '',
          entries: [],
          tokenUsage: {
            input_tokens: 100,
            output_tokens: 150,
            total_tokens: 250,
            estimated_cost: 0.01,
          },
        },
        {
          sessionId: 'session2',
          workingDirectory: '/project2',
          messageCount: 6,
          userMessageCount: 3,
          assistantMessageCount: 3,
          summaryCount: 0,
          timeRange: { 
            start: new Date('2025-07-03T16:00:00Z'), 
            end: new Date('2025-07-03T16:15:00Z') 
          },
          summary: '',
          entries: [],
          tokenUsage: {
            input_tokens: 200,
            output_tokens: 300,
            total_tokens: 500,
            estimated_cost: 0.02,
          },
        },
      ];

      const stats = getSessionStatistics(sessions);

      expect(stats.totalSessions).toBe(2);
      expect(stats.totalMessages).toBe(10);
      expect(stats.totalUserMessages).toBe(5);
      expect(stats.totalAssistantMessages).toBe(5);
      expect(stats.totalTokens).toBe(750);
      expect(stats.totalCost).toBe(0.03);
      expect(stats.averageMessagesPerSession).toBe(5);
      expect(stats.workingDirectories).toEqual(['/project1', '/project2']);
      expect(stats.timeSpan.durationDays).toBe(1);
    });
  });

  describe('formatSessionSummary', () => {
    it('should format session summary correctly', () => {
      const session: SessionInfo = {
        sessionId: 'test_session_123',
        workingDirectory: '/home/user/project',
        messageCount: 5,
        userMessageCount: 2,
        assistantMessageCount: 3,
        summaryCount: 0,
        timeRange: { 
          start: new Date('2025-07-03T15:00:00Z'), 
          end: new Date('2025-07-03T15:30:00Z') 
        },
        summary: 'Discussion about TypeScript implementation',
        entries: [],
        tokenUsage: {
          input_tokens: 300,
          output_tokens: 450,
          total_tokens: 750,
          estimated_cost: 0.0375,
        },
      };

      const formatted = formatSessionSummary(session);

      expect(formatted).toContain('Session: test_session_123');
      expect(formatted).toContain('Messages: 5 (2U, 3A)');
      expect(formatted).toContain('Dir: /home/user/project');
      expect(formatted).toContain('Tokens: 750 ($0.0375)');
      expect(formatted).toContain('Summary: Discussion about TypeScript implementation');
    });

    it('should handle missing optional fields', () => {
      const session: SessionInfo = {
        sessionId: 'minimal_session',
        workingDirectory: '',
        messageCount: 1,
        userMessageCount: 1,
        assistantMessageCount: 0,
        summaryCount: 0,
        timeRange: { start: null, end: null },
        summary: '',
        entries: [],
      };

      const formatted = formatSessionSummary(session);

      expect(formatted).toContain('Session: minimal_session');
      expect(formatted).toContain('Messages: 1 (1U, 0A)');
      expect(formatted).not.toContain('Dir:');
      expect(formatted).not.toContain('Tokens:');
      expect(formatted).not.toContain('Summary:');
    });
  });
});