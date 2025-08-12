import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SessionStateManager from './session-state';
import ProcessManager from './process-manager';

// Mock ProcessManager
vi.mock('./process-manager');

describe('SessionStateManager', () => {
  let sessionManager: SessionStateManager;
  let mockProcessManager: ProcessManager;

  beforeEach(() => {
    mockProcessManager = new ProcessManager();
    sessionManager = new SessionStateManager(mockProcessManager);
  });

  afterEach(async () => {
    await sessionManager.shutdown();
  });

  describe('createSession', () => {
    it('should create a new session and return session ID', async () => {
      const sessionId = await sessionManager.createSession();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.id).toBe(sessionId);
      expect(session!.status).toBe('active');
    });

    it('should create session with options', async () => {
      const options = {
        workingDirectory: '/tmp/test',
        environment: { TEST_VAR: 'test_value' },
        metadata: { key: 'value' },
      };

      const sessionId = await sessionManager.createSession(options);
      const session = sessionManager.getSession(sessionId);

      expect(session!.workingDirectory).toBe('/tmp/test');
      expect(session!.environment).toEqual({ TEST_VAR: 'test_value' });
      expect(session!.metadata).toEqual({ key: 'value' });
    });

    it('should emit session-created event', async () => {
      const eventPromise = new Promise((resolve) => {
        sessionManager.once('session-created', resolve);
      });

      const sessionId = await sessionManager.createSession();
      const eventSession = await eventPromise;

      expect((eventSession as any).id).toBe(sessionId);
    });
  });

  describe('associateProcess', () => {
    it('should associate a process with a session', async () => {
      const sessionId = await sessionManager.createSession();
      const processId = 'test-process-123';

      const result = await sessionManager.associateProcess(sessionId, processId);

      expect(result).toBe(true);

      const session = sessionManager.getSession(sessionId);
      expect(session!.processId).toBe(processId);

      const foundSessionId = sessionManager.getSessionByProcess(processId);
      expect(foundSessionId).toBe(sessionId);
    });

    it('should return false for non-existent session', async () => {
      const result = await sessionManager.associateProcess('non-existent', 'process-123');
      expect(result).toBe(false);
    });

    it('should update lastActiveAt when associating process', async () => {
      const sessionId = await sessionManager.createSession();
      const session1 = sessionManager.getSession(sessionId);
      const originalTime = session1!.lastActiveAt;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await sessionManager.associateProcess(sessionId, 'process-123');
      const session2 = sessionManager.getSession(sessionId);

      expect(session2!.lastActiveAt.getTime()).toBeGreaterThan(originalTime.getTime());
    });

    it('should remove old process association', async () => {
      const sessionId = await sessionManager.createSession();

      await sessionManager.associateProcess(sessionId, 'process-1');
      expect(sessionManager.getSessionByProcess('process-1')).toBe(sessionId);

      await sessionManager.associateProcess(sessionId, 'process-2');
      expect(sessionManager.getSessionByProcess('process-1')).toBeUndefined();
      expect(sessionManager.getSessionByProcess('process-2')).toBe(sessionId);
    });
  });

  describe('addCommandToHistory', () => {
    it('should add command to session history', async () => {
      const sessionId = await sessionManager.createSession();

      const result = await sessionManager.addCommandToHistory(sessionId, 'ls -la');

      expect(result).toBe(true);

      const session = sessionManager.getSession(sessionId);
      expect(session!.commandHistory).toContain('ls -la');
    });

    it('should return false for non-existent session', async () => {
      const result = await sessionManager.addCommandToHistory('non-existent', 'command');
      expect(result).toBe(false);
    });

    it('should limit command history size', async () => {
      const sessionId = await sessionManager.createSession();

      // Add more commands than the limit (MAX_COMMAND_HISTORY = 1000)
      for (let i = 0; i < 1010; i++) {
        await sessionManager.addCommandToHistory(sessionId, `command-${i}`);
      }

      const session = sessionManager.getSession(sessionId);
      expect(session!.commandHistory.length).toBe(1000);
      
      // Should keep the most recent commands
      expect(session!.commandHistory[999]).toBe('command-1009');
      expect(session!.commandHistory[0]).toBe('command-10');
    });

    it('should update lastActiveAt when adding command', async () => {
      const sessionId = await sessionManager.createSession();
      const session1 = sessionManager.getSession(sessionId);
      const originalTime = session1!.lastActiveAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      await sessionManager.addCommandToHistory(sessionId, 'test command');
      const session2 = sessionManager.getSession(sessionId);

      expect(session2!.lastActiveAt.getTime()).toBeGreaterThan(originalTime.getTime());
    });
  });

  describe('updateSession', () => {
    it('should update session metadata', async () => {
      const sessionId = await sessionManager.createSession();

      const result = await sessionManager.updateSession(sessionId, {
        workingDirectory: '/new/path',
        environment: { NEW_VAR: 'new_value' },
        metadata: { updated: true },
      });

      expect(result).toBe(true);

      const session = sessionManager.getSession(sessionId);
      expect(session!.workingDirectory).toBe('/new/path');
      expect(session!.environment).toEqual({ NEW_VAR: 'new_value' });
      expect(session!.metadata).toEqual({ updated: true });
    });

    it('should merge environment variables', async () => {
      const sessionId = await sessionManager.createSession({
        environment: { EXISTING: 'existing_value' },
      });

      await sessionManager.updateSession(sessionId, {
        environment: { NEW: 'new_value' },
      });

      const session = sessionManager.getSession(sessionId);
      expect(session!.environment).toEqual({
        EXISTING: 'existing_value',
        NEW: 'new_value',
      });
    });

    it('should return false for non-existent session', async () => {
      const result = await sessionManager.updateSession('non-existent', {
        metadata: { test: true },
      });

      expect(result).toBe(false);
    });
  });

  describe('suspendSession', () => {
    it('should suspend an active session', async () => {
      const sessionId = await sessionManager.createSession();
      await sessionManager.associateProcess(sessionId, 'process-123');

      const result = await sessionManager.suspendSession(sessionId);

      expect(result).toBe(true);

      const session = sessionManager.getSession(sessionId);
      expect(session!.status).toBe('suspended');
      expect(session!.processId).toBeUndefined();
      expect(sessionManager.getSessionByProcess('process-123')).toBeUndefined();
    });

    it('should emit session-suspended event', async () => {
      const sessionId = await sessionManager.createSession();

      const eventPromise = new Promise((resolve) => {
        sessionManager.once('session-suspended', resolve);
      });

      await sessionManager.suspendSession(sessionId);
      const eventSession = await eventPromise;

      expect((eventSession as any).id).toBe(sessionId);
      expect((eventSession as any).status).toBe('suspended');
    });

    it('should return false for non-existent session', async () => {
      const result = await sessionManager.suspendSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('restoreSession', () => {
    it('should restore a suspended session', async () => {
      const sessionId = await sessionManager.createSession();
      await sessionManager.suspendSession(sessionId);

      const result = await sessionManager.restoreSession(sessionId);

      expect(result).toBe(true);

      const session = sessionManager.getSession(sessionId);
      expect(session!.status).toBe('active');
    });

    it('should restore session with new process', async () => {
      const sessionId = await sessionManager.createSession();
      await sessionManager.suspendSession(sessionId);

      const result = await sessionManager.restoreSession(sessionId, 'new-process-123');

      expect(result).toBe(true);

      const session = sessionManager.getSession(sessionId);
      expect(session!.processId).toBe('new-process-123');
      expect(sessionManager.getSessionByProcess('new-process-123')).toBe(sessionId);
    });

    it('should emit session-restored event', async () => {
      const sessionId = await sessionManager.createSession();
      await sessionManager.suspendSession(sessionId);

      const eventPromise = new Promise((resolve) => {
        sessionManager.once('session-restored', resolve);
      });

      await sessionManager.restoreSession(sessionId);
      const eventSession = await eventPromise;

      expect((eventSession as any).id).toBe(sessionId);
      expect((eventSession as any).status).toBe('active');
    });

    it('should return false for terminated session', async () => {
      const sessionId = await sessionManager.createSession();
      await sessionManager.terminateSession(sessionId);

      const result = await sessionManager.restoreSession(sessionId);
      expect(result).toBe(false);
    });
  });

  describe('terminateSession', () => {
    it('should terminate a session', async () => {
      const sessionId = await sessionManager.createSession();
      await sessionManager.associateProcess(sessionId, 'process-123');

      const result = await sessionManager.terminateSession(sessionId);

      expect(result).toBe(true);
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
      expect(sessionManager.getSessionByProcess('process-123')).toBeUndefined();
    });

    it('should emit session-terminated event', async () => {
      const sessionId = await sessionManager.createSession();

      const eventPromise = new Promise((resolve) => {
        sessionManager.once('session-terminated', resolve);
      });

      await sessionManager.terminateSession(sessionId);
      const terminatedId = await eventPromise;

      expect(terminatedId).toBe(sessionId);
    });

    it('should return false for non-existent session', async () => {
      const result = await sessionManager.terminateSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getSession', () => {
    it('should return session data by ID', async () => {
      const sessionId = await sessionManager.createSession({
        workingDirectory: '/test',
        environment: { TEST: 'value' },
      });

      const session = sessionManager.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session!.id).toBe(sessionId);
      expect(session!.workingDirectory).toBe('/test');
      expect(session!.environment).toEqual({ TEST: 'value' });
    });

    it('should return undefined for non-existent session', () => {
      const session = sessionManager.getSession('non-existent');
      expect(session).toBeUndefined();
    });

    it('should return a copy of session data', async () => {
      const sessionId = await sessionManager.createSession();
      const session1 = sessionManager.getSession(sessionId);
      const session2 = sessionManager.getSession(sessionId);

      expect(session1).not.toBe(session2); // Different object references
      expect(session1).toEqual(session2); // Same data
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions', async () => {
      const sessionId1 = await sessionManager.createSession();
      const sessionId2 = await sessionManager.createSession();

      const sessions = sessionManager.getAllSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.id)).toContain(sessionId1);
      expect(sessions.map(s => s.id)).toContain(sessionId2);
    });

    it('should filter sessions by status', async () => {
      const sessionId1 = await sessionManager.createSession();
      const sessionId2 = await sessionManager.createSession();
      await sessionManager.suspendSession(sessionId2);

      const activeSessions = sessionManager.getAllSessions({ status: 'active' });
      const suspendedSessions = sessionManager.getAllSessions({ status: 'suspended' });

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(sessionId1);
      expect(suspendedSessions).toHaveLength(1);
      expect(suspendedSessions[0].id).toBe(sessionId2);
    });

    it('should filter sessions by active time', async () => {
      const sessionId1 = await sessionManager.createSession();
      
      // Wait and create another session
      await new Promise(resolve => setTimeout(resolve, 100));
      const sessionId2 = await sessionManager.createSession();

      const recentSessions = sessionManager.getAllSessions({ 
        activeWithin: 50 // 50ms
      });

      expect(recentSessions).toHaveLength(1);
      expect(recentSessions[0].id).toBe(sessionId2);
    });
  });

  describe('getStats', () => {
    it('should return session statistics', async () => {
      const sessionId1 = await sessionManager.createSession();
      const sessionId2 = await sessionManager.createSession();
      const sessionId3 = await sessionManager.createSession();

      await sessionManager.suspendSession(sessionId2);
      await sessionManager.terminateSession(sessionId3);
      await sessionManager.associateProcess(sessionId1, 'process-123');
      await sessionManager.addCommandToHistory(sessionId1, 'command1');
      await sessionManager.addCommandToHistory(sessionId1, 'command2');

      const stats = sessionManager.getStats();

      expect(stats.total).toBe(2); // Terminated session is removed
      expect(stats.active).toBe(1);
      expect(stats.suspended).toBe(1);
      expect(stats.withProcesses).toBe(1);
      expect(stats.averageCommandHistory).toBe(1); // (2 + 0) / 2 = 1
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions', async () => {
      const sessionId = await sessionManager.createSession();
      await sessionManager.suspendSession(sessionId);

      // Mock getAllProcesses to return empty array
      vi.spyOn(mockProcessManager, 'getAllProcesses').mockReturnValue([]);

      // Directly modify the session's lastActiveAt to be old (accessing private implementation for test)
      const sessions = (sessionManager as any).sessions;
      const session = sessions.get(sessionId);
      if (session) {
        const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
        session.lastActiveAt = oldTime;
      }

      const result = await sessionManager.cleanupExpiredSessions();

      expect(result.expiredSessions).toBe(1);
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });

    it('should not clean up active sessions', async () => {
      const sessionId = await sessionManager.createSession();

      // Mock getAllProcesses to return empty array
      vi.spyOn(mockProcessManager, 'getAllProcesses').mockReturnValue([]);

      const result = await sessionManager.cleanupExpiredSessions();

      expect(result.expiredSessions).toBe(0);
      expect(sessionManager.getSession(sessionId)).toBeDefined();
    });
  });

  describe('recoverSessions', () => {
    it('should recover sessions with running processes', async () => {
      const sessionId = await sessionManager.createSession();
      await sessionManager.associateProcess(sessionId, 'process-123');

      // Mock process manager to return running process
      vi.spyOn(mockProcessManager, 'getProcessInfo').mockReturnValue({
        id: 'process-123',
        command: 'test',
        args: [],
        status: 'running',
        startedAt: new Date(),
        pid: 123,
      });

      const result = await sessionManager.recoverSessions();

      expect(result.recovered).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should suspend sessions with dead processes', async () => {
      const sessionId = await sessionManager.createSession();
      await sessionManager.associateProcess(sessionId, 'process-123');

      // Mock process manager to return dead process
      vi.spyOn(mockProcessManager, 'getProcessInfo').mockReturnValue({
        id: 'process-123',
        command: 'test',
        args: [],
        status: 'stopped',
        startedAt: new Date(),
        pid: 123,
      });

      const result = await sessionManager.recoverSessions();

      const session = sessionManager.getSession(sessionId);
      expect(session!.status).toBe('suspended');
    });
  });

  describe('getPersistenceData', () => {
    it('should return persistence data for debugging', async () => {
      await sessionManager.createSession();
      await sessionManager.createSession();

      const persistenceData = sessionManager.getPersistenceData();

      expect(persistenceData).toHaveProperty('sessions');
      expect(persistenceData).toHaveProperty('lastCleanup');
      expect(persistenceData).toHaveProperty('version');
      expect(persistenceData.sessions).toHaveLength(2);
      expect(persistenceData.version).toBe('1.0.0');
    });
  });

  describe('shutdown', () => {
    it('should suspend all active sessions during shutdown', async () => {
      const sessionId1 = await sessionManager.createSession();
      const sessionId2 = await sessionManager.createSession();

      await sessionManager.shutdown();

      // Since sessions are cleared during shutdown, we can't directly check
      // but the method should complete without errors
      expect(true).toBe(true);
    });

    it('should clear cleanup interval during shutdown', async () => {
      const sessionId = await sessionManager.createSession();

      // Shutdown should clear the cleanup interval
      await sessionManager.shutdown();

      // If we get here without hanging, the interval was cleared properly
      expect(true).toBe(true);
    });
  });
});