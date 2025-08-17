/**
 * Unit tests for typed EventEmitter utility
 * Tests event handling, memory management, and type safety
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter, createEventEmitter, type EventHandler } from '../../src/utils/event-emitter';

// Test event map interface
interface TestEventMap {
  'user:login': { userId: string; username: string };
  'user:logout': { userId: string };
  'session:created': { sessionId: string; timestamp: string };
  'session:updated': { sessionId: string; changes: string[] };
  'error': { message: string; code: number };
  'data': string;
  'number': number;
  'void-event': void;
}

describe('EventEmitter', () => {
  let emitter: EventEmitter<TestEventMap>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    emitter = new EventEmitter<TestEventMap>();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('on()', () => {
    it('should register event handler and return unsubscribe function', () => {
      const handler = jest.fn();
      const unsubscribe = emitter.on('user:login', handler);

      expect(typeof unsubscribe).toBe('function');
      expect(emitter.listenerCount('user:login')).toBe(1);
    });

    it('should register multiple handlers for same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('user:login', handler1);
      emitter.on('user:login', handler2);

      expect(emitter.listenerCount('user:login')).toBe(2);
    });

    it('should register handlers for different events', () => {
      const loginHandler = jest.fn();
      const logoutHandler = jest.fn();

      emitter.on('user:login', loginHandler);
      emitter.on('user:logout', logoutHandler);

      expect(emitter.listenerCount('user:login')).toBe(1);
      expect(emitter.listenerCount('user:logout')).toBe(1);
    });

    it('should warn when approaching max listeners', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      emitter.setMaxListeners(2);

      // Add 2 handlers, then a 3rd should trigger warning
      emitter.on('user:login', jest.fn());
      emitter.on('user:login', jest.fn());
      expect(warnSpy).not.toHaveBeenCalled();

      emitter.on('user:login', jest.fn()); // Should trigger warning
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Possible event emitter memory leak detected')
      );

      warnSpy.mockRestore();
    });
  });

  describe('once()', () => {
    it('should register handler that auto-unsubscribes after first call', () => {
      const handler = jest.fn();
      emitter.once('user:login', handler);

      expect(emitter.listenerCount('user:login')).toBe(1);

      emitter.emit('user:login', { userId: '123', username: 'testuser' });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(emitter.listenerCount('user:login')).toBe(0);

      // Second emit should not call handler
      emitter.emit('user:login', { userId: '456', username: 'testuser2' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function that works before first emit', () => {
      const handler = jest.fn();
      const unsubscribe = emitter.once('user:login', handler);

      expect(emitter.listenerCount('user:login')).toBe(1);

      unsubscribe();
      expect(emitter.listenerCount('user:login')).toBe(0);

      emitter.emit('user:login', { userId: '123', username: 'testuser' });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('off()', () => {
    it('should remove specific handler', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('user:login', handler1);
      emitter.on('user:login', handler2);
      expect(emitter.listenerCount('user:login')).toBe(2);

      emitter.off('user:login', handler1);
      expect(emitter.listenerCount('user:login')).toBe(1);

      emitter.emit('user:login', { userId: '123', username: 'testuser' });
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should remove all handlers when no specific handler provided', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('user:login', handler1);
      emitter.on('user:login', handler2);
      expect(emitter.listenerCount('user:login')).toBe(2);

      emitter.off('user:login');
      expect(emitter.listenerCount('user:login')).toBe(0);
    });

    it('should handle removing non-existent handler gracefully', () => {
      const handler = jest.fn();
      expect(() => {
        emitter.off('user:login', handler);
      }).not.toThrow();
    });

    it('should work with unsubscribe function returned from on()', () => {
      const handler = jest.fn();
      const unsubscribe = emitter.on('user:login', handler);

      expect(emitter.listenerCount('user:login')).toBe(1);

      unsubscribe();
      expect(emitter.listenerCount('user:login')).toBe(0);
    });
  });

  describe('emit()', () => {
    it('should call all registered handlers with correct data', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const loginData = { userId: '123', username: 'testuser' };

      emitter.on('user:login', handler1);
      emitter.on('user:login', handler2);

      emitter.emit('user:login', loginData);

      expect(handler1).toHaveBeenCalledWith(loginData);
      expect(handler2).toHaveBeenCalledWith(loginData);
    });

    it('should not call handlers for different events', () => {
      const loginHandler = jest.fn();
      const logoutHandler = jest.fn();

      emitter.on('user:login', loginHandler);
      emitter.on('user:logout', logoutHandler);

      emitter.emit('user:login', { userId: '123', username: 'testuser' });

      expect(loginHandler).toHaveBeenCalled();
      expect(logoutHandler).not.toHaveBeenCalled();
    });

    it('should handle events with no listeners gracefully', () => {
      expect(() => {
        emitter.emit('user:login', { userId: '123', username: 'testuser' });
      }).not.toThrow();
    });

    it('should catch and log handler errors without affecting other handlers', () => {
      const errorHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const successHandler = jest.fn();

      emitter.on('user:login', errorHandler);
      emitter.on('user:login', successHandler);

      emitter.emit('user:login', { userId: '123', username: 'testuser' });

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in event handler'),
        expect.any(Error)
      );
    });

    it('should handle different data types correctly', () => {
      const stringHandler = jest.fn();
      const numberHandler = jest.fn();
      const voidHandler = jest.fn();

      emitter.on('data', stringHandler);
      emitter.on('number', numberHandler);
      emitter.on('void-event', voidHandler);

      emitter.emit('data', 'test string');
      emitter.emit('number', 42);
      emitter.emit('void-event', undefined);

      expect(stringHandler).toHaveBeenCalledWith('test string');
      expect(numberHandler).toHaveBeenCalledWith(42);
      expect(voidHandler).toHaveBeenCalledWith(undefined);
    });
  });

  describe('removeAllListeners()', () => {
    it('should remove all listeners for specific event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('user:login', handler1);
      emitter.on('user:logout', handler2);

      emitter.removeAllListeners('user:login');

      expect(emitter.listenerCount('user:login')).toBe(0);
      expect(emitter.listenerCount('user:logout')).toBe(1);
    });

    it('should remove all listeners for all events when no event specified', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('user:login', handler1);
      emitter.on('user:logout', handler2);

      emitter.removeAllListeners();

      expect(emitter.listenerCount('user:login')).toBe(0);
      expect(emitter.listenerCount('user:logout')).toBe(0);
    });
  });

  describe('listenerCount()', () => {
    it('should return correct count of listeners', () => {
      expect(emitter.listenerCount('user:login')).toBe(0);

      emitter.on('user:login', jest.fn());
      expect(emitter.listenerCount('user:login')).toBe(1);

      emitter.on('user:login', jest.fn());
      expect(emitter.listenerCount('user:login')).toBe(2);

      emitter.on('user:logout', jest.fn());
      expect(emitter.listenerCount('user:login')).toBe(2);
      expect(emitter.listenerCount('user:logout')).toBe(1);
    });

    it('should return 0 for non-existent events', () => {
      expect(emitter.listenerCount('user:login')).toBe(0);
    });
  });

  describe('setMaxListeners()', () => {
    it('should set maximum listener threshold', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      emitter.setMaxListeners(1);

      emitter.on('user:login', jest.fn());
      expect(warnSpy).not.toHaveBeenCalled();

      emitter.on('user:login', jest.fn()); // Should trigger warning
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('eventNames()', () => {
    it('should return array of event names with listeners', () => {
      expect(emitter.eventNames()).toEqual([]);

      emitter.on('user:login', jest.fn());
      emitter.on('user:logout', jest.fn());

      const eventNames = emitter.eventNames();
      expect(eventNames).toContain('user:login');
      expect(eventNames).toContain('user:logout');
      expect(eventNames).toHaveLength(2);
    });

    it('should not include events with no listeners', () => {
      emitter.on('user:login', jest.fn());
      emitter.on('user:logout', jest.fn());
      emitter.off('user:logout'); // Remove all handlers

      const eventNames = emitter.eventNames();
      expect(eventNames).toContain('user:login');
      expect(eventNames).not.toContain('user:logout');
      expect(eventNames).toHaveLength(1);
    });
  });

  describe('Memory Management', () => {
    it('should properly clean up handlers to prevent memory leaks', () => {
      const handlers = Array.from({ length: 10 }, () => jest.fn());

      // Add handlers
      const unsubscribeFns = handlers.map(handler => 
        emitter.on('user:login', handler)
      );

      expect(emitter.listenerCount('user:login')).toBe(10);

      // Remove all handlers
      unsubscribeFns.forEach(unsubscribe => unsubscribe());

      expect(emitter.listenerCount('user:login')).toBe(0);
      expect(emitter.eventNames()).not.toContain('user:login');
    });

    it('should clean up event entirely when no handlers remain', () => {
      const handler = jest.fn();
      emitter.on('user:login', handler);

      expect(emitter.eventNames()).toContain('user:login');

      emitter.off('user:login', handler);

      expect(emitter.eventNames()).not.toContain('user:login');
    });
  });
});

describe('createEventEmitter factory', () => {
  it('should create new EventEmitter instance', () => {
    const emitter = createEventEmitter<TestEventMap>();
    expect(emitter).toBeInstanceOf(EventEmitter);
  });

  it('should create independent instances', () => {
    const emitter1 = createEventEmitter<TestEventMap>();
    const emitter2 = createEventEmitter<TestEventMap>();

    const handler1 = jest.fn();
    const handler2 = jest.fn();

    emitter1.on('user:login', handler1);
    emitter2.on('user:login', handler2);

    emitter1.emit('user:login', { userId: '123', username: 'test' });

    expect(handler1).toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });
});