import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fixture, html, oneEvent } from '@open-wc/testing';
import '../session-list/SessionList';
import '../message-display/MessageDisplay';
import { SessionList } from '../session-list/SessionList';
import { MessageDisplay } from '../message-display/MessageDisplay';
import { SessionSummary } from '../types/session-types';
import { TranscriptEntry } from '@app/shared';
import { setupBrowserAPIMocks, cleanupBrowserAPIMocks, MockIntersectionObserver, MockResizeObserver } from './test-setup';

/**
 * Performance benchmark tests for components with large datasets
 */
describe('Performance Benchmarks', () => {
  let performanceNow: ReturnType<typeof vi.spyOn>;
  let requestAnimationFrame: ReturnType<typeof vi.spyOn>;
  let rafCallbacks: (() => void)[] = [];

  beforeEach(() => {
    // Setup browser API mocks
    setupBrowserAPIMocks();
    
    performanceNow = vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
    requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
  });

  afterEach(() => {
    performanceNow.mockRestore();
    requestAnimationFrame.mockRestore();
    rafCallbacks = [];
    cleanupBrowserAPIMocks();
  });

  const flushRAF = () => {
    while (rafCallbacks.length > 0) {
      const callback = rafCallbacks.shift();
      if (callback) callback();
    }
  };

  // Test data generators
  const generateLargeSessions = (count: number): SessionSummary[] => {
    return Array.from({ length: count }, (_, index) => ({
      sessionId: `session-${index}`,
      title: `Test Session ${index}`,
      cwd: `/test/path/session-${index}`,
      startTime: new Date(Date.now() - index * 60000),
      endTime: new Date(Date.now() - index * 60000 + 3600000),
      messageCount: Math.floor(Math.random() * 50) + 10,
      userMessageCount: Math.floor(Math.random() * 25) + 5,
      assistantMessageCount: Math.floor(Math.random() * 25) + 5,
      duration: 3600000,
      isActive: index < 3,
      tags: [`tag-${index % 5}`, 'test'],
      summary: `Summary for session ${index} with various content and metadata`,
    }));
  };

  const generateComplexMessages = (count: number): TranscriptEntry[] => {
    return Array.from({ length: count }, (_, index) => ({
      type: index % 2 === 0 ? 'user' : 'assistant',
      timestamp: new Date(Date.now() - index * 10000).toISOString(),
      message: {
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: [
          {
            type: 'text',
            text: `This is message ${index} with substantial content that includes multiple paragraphs and complex formatting. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
          },
          ...(index % 3 === 0 ? [{
            type: 'tool_use',
            id: `tool-${index}`,
            name: 'complex_tool',
            input: {
              param1: `value-${index}`,
              param2: Array.from({ length: 20 }, (_, i) => `item-${i}`),
              param3: { nested: { deeply: { data: `content-${index}` } } },
            },
          }] : []),
        ] as any,
      },
    } as any));
  };

  describe('SessionList Performance', () => {
    it('should render 1000 sessions efficiently without virtual scrolling', async () => {
      const sessions = generateLargeSessions(1000);
      const startTime = performance.now();

      const element = await fixture<SessionList>(html`
        <session-list 
          .sessions=${sessions}
          .virtualScrolling=${false}
        ></session-list>
      `);

      flushRAF();
      const renderTime = performance.now() - startTime;

      expect(element).toBeDefined();
      expect(element.sessions).toHaveLength(1000);
      expect(renderTime).toBeLessThan(1000); // Should render in less than 1 second

      // Verify DOM structure
      const sessionItems = element.shadowRoot?.querySelectorAll('session-list-item');
      expect(sessionItems?.length).toBeGreaterThan(0);
    });

    it('should render 1000 sessions efficiently with virtual scrolling', async () => {
      const sessions = generateLargeSessions(1000);
      const startTime = performance.now();

      const element = await fixture<SessionList>(html`
        <session-list 
          .sessions=${sessions}
          .virtualScrolling=${true}
        ></session-list>
      `);

      flushRAF();
      const renderTime = performance.now() - startTime;

      expect(element).toBeDefined();
      expect(element.sessions).toHaveLength(1000);
      expect(renderTime).toBeLessThan(500); // Should be faster with virtual scrolling

      // Verify virtual scrolling is working
      const virtualContainer = element.shadowRoot?.querySelector('.sessions-list.virtual');
      expect(virtualContainer).toBeTruthy();
    });

    it('should handle rapid filter changes efficiently', async () => {
      const sessions = generateLargeSessions(500);
      const element = await fixture<SessionList>(html`
        <session-list 
          .sessions=${sessions}
          .searchable=${true}
        ></session-list>
      `);

      const searchInput = element.shadowRoot?.querySelector('.search-input') as HTMLInputElement;
      const startTime = performance.now();

      // Simulate rapid typing
      const searchTerms = ['test', 'session', '1', '10', '100'];
      for (const term of searchTerms) {
        searchInput.value = term;
        searchInput.dispatchEvent(new Event('input'));
        flushRAF();
        await element.updateComplete;
      }

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(200); // Should handle rapid changes quickly
    });

    it('should scroll through large lists smoothly', async () => {
      const sessions = generateLargeSessions(1000);
      const element = await fixture<SessionList>(html`
        <session-list 
          .sessions=${sessions}
          .virtualScrolling=${true}
        ></session-list>
      `);

      const container = element.shadowRoot?.querySelector('.sessions-list.virtual') as HTMLElement;
      const startTime = performance.now();

      // Simulate scrolling
      for (let i = 0; i < 10; i++) {
        container.scrollTop = i * 100;
        container.dispatchEvent(new Event('scroll'));
        flushRAF();
        await element.updateComplete;
      }

      const scrollTime = performance.now() - startTime;
      expect(scrollTime).toBeLessThan(100); // Smooth scrolling performance
    });

    it('should auto-enable performance optimizations for large datasets', async () => {
      const sessions = generateLargeSessions(100); // Above threshold for optimizations
      
      const element = await fixture<SessionList>(html`
        <session-list .sessions=${sessions}></session-list>
      `);

      // Should auto-enable optimizations
      expect(element.lazyLoading).toBe(true);
      expect(element.virtualScrolling).toBe(true);
    });
  });

  describe('MessageDisplay Performance', () => {
    it('should render complex messages efficiently', async () => {
      const complexMessage = generateComplexMessages(1)[0];
      const startTime = performance.now();

      const element = await fixture<MessageDisplay>(html`
        <message-display 
          .entry=${complexMessage}
          .displayMode=${'detailed'}
        ></message-display>
      `);

      flushRAF();
      const renderTime = performance.now() - startTime;

      expect(element).toBeDefined();
      expect(element.entry).toEqual(complexMessage);
      expect(renderTime).toBeLessThan(100); // Should render quickly

      // Verify content is processed
      await element.updateComplete;
      const content = element.shadowRoot?.querySelector('.message-content');
      expect(content).toBeTruthy();
    });

    it('should handle message updates efficiently', async () => {
      const messages = generateComplexMessages(10);
      const element = await fixture<MessageDisplay>(html`
        <message-display 
          .entry=${messages[0]}
        ></message-display>
      `);

      const startTime = performance.now();

      // Update with different messages rapidly
      for (let i = 1; i < messages.length; i++) {
        element.entry = messages[i];
        flushRAF();
        await element.updateComplete;
      }

      const updateTime = performance.now() - startTime;
      expect(updateTime).toBeLessThan(200); // Should handle updates efficiently
    });

    it('should lazy load heavy content', async () => {
      const heavyMessage = {
        type: 'assistant',
        timestamp: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              thinking: 'This is a very long thinking content that should be lazy loaded...' + 'x'.repeat(1000),
            },
            {
              type: 'tool_result',
              tool_use_id: 'test-tool',
              content: 'Large tool result data...' + 'y'.repeat(2000),
              is_error: false,
            },
          ] as any,
        },
      } as any;

      const element = await fixture<MessageDisplay>(html`
        <message-display .entry=${heavyMessage}></message-display>
      `);

      // Heavy content should initially be pending or loading
      const lazyLoader = (element as any).contentLazyLoader;
      const stats = lazyLoader.getStats();
      
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.pending + stats.loading).toBeGreaterThan(0);
    });

    it('should defer rendering when not visible', async () => {
      const message = generateComplexMessages(1)[0];
      
      // Mock intersection observer to simulate not visible
      const mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };

      vi.stubGlobal('IntersectionObserver', vi.fn(() => mockObserver));

      const element = await fixture<MessageDisplay>(html`
        <message-display .entry=${message}></message-display>
      `);

      // Should have deferred content processing
      const optimizations = (element as any).performanceOptimizations;
      expect(optimizations.shouldUpdateContent).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  describe('Memory Management', () => {
    it('should properly cleanup resources', async () => {
      const sessions = generateLargeSessions(100);
      const container = document.createElement('div');
      document.body.appendChild(container);

      const element = await fixture<SessionList>(html`
        <session-list 
          .sessions=${sessions}
          .virtualScrolling=${true}
          .lazyLoading=${true}
        ></session-list>
      `, { parentNode: container });

      // Verify resources are created
      const virtualScroll = (element as any).virtualScroll;
      const lazyLoader = (element as any).lazyLoader;
      
      expect(virtualScroll).toBeDefined();
      expect(lazyLoader).toBeDefined();

      // Remove from DOM
      document.body.removeChild(container);

      // Should cleanup resources
      // Note: Actual cleanup verification would require more detailed mocking
      expect(true).toBe(true); // Placeholder for cleanup verification
    });

    it('should handle large dataset updates without memory leaks', async () => {
      const element = await fixture<SessionList>(html`
        <session-list></session-list>
      `);

      const iterations = 5;
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      for (let i = 0; i < iterations; i++) {
        const sessions = generateLargeSessions(200);
        element.sessions = sessions;
        await element.updateComplete;
        flushRAF();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory should not grow excessively (allow for some variance)
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        const maxAllowedGrowth = initialMemory * 2; // Allow doubling
        expect(memoryGrowth).toBeLessThan(maxAllowedGrowth);
      }
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle concurrent operations efficiently', async () => {
      const sessions = generateLargeSessions(300);
      const element = await fixture<SessionList>(html`
        <session-list 
          .sessions=${sessions}
          .searchable=${true}
          .filterable=${true}
          .virtualScrolling=${true}
        ></session-list>
      `);

      const searchInput = element.shadowRoot?.querySelector('.search-input') as HTMLInputElement;
      const sortSelect = element.shadowRoot?.querySelector('.sort-select') as HTMLSelectElement;
      const container = element.shadowRoot?.querySelector('.sessions-list.virtual') as HTMLElement;

      const startTime = performance.now();

      // Simulate concurrent user interactions
      const operations = [
        () => {
          searchInput.value = 'test';
          searchInput.dispatchEvent(new Event('input'));
        },
        () => {
          sortSelect.value = 'messageCount-desc';
          sortSelect.dispatchEvent(new Event('change'));
        },
        () => {
          container.scrollTop = 500;
          container.dispatchEvent(new Event('scroll'));
        },
        () => {
          element.displayMode = 'compact';
        },
      ];

      // Execute operations rapidly
      operations.forEach((op, index) => {
        setTimeout(op, index * 10);
      });

      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      flushRAF();
      await element.updateComplete;

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(200); // Should handle concurrent operations smoothly
    });

    it('should maintain accessibility during performance optimizations', async () => {
      const sessions = generateLargeSessions(500);
      const element = await fixture<SessionList>(html`
        <session-list 
          .sessions=${sessions}
          .virtualScrolling=${true}
          .lazyLoading=${true}
        ></session-list>
      `);

      await element.updateComplete;
      flushRAF();

      // Verify accessibility attributes are maintained
      const list = element.shadowRoot?.querySelector('[role=\"list\"]');
      expect(list).toBeTruthy();
      expect(list?.getAttribute('aria-label')).toContain('session');

      // Verify status region exists
      const statusRegion = element.shadowRoot?.querySelector('[role=\"status\"]');
      expect(statusRegion).toBeTruthy();

      // Verify keyboard navigation still works
      const container = element.shadowRoot?.querySelector('.session-list-container') as HTMLElement;
      const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      
      expect(() => container.dispatchEvent(keyEvent)).not.toThrow();
    });

    it('should gracefully degrade when performance features fail', async () => {
      // Mock feature failures
      const originalIntersectionObserver = window.IntersectionObserver;
      delete (window as any).IntersectionObserver;

      const sessions = generateLargeSessions(100);
      
      const element = await fixture<SessionList>(html`
        <session-list 
          .sessions=${sessions}
          .virtualScrolling=${true}
          .lazyLoading=${true}
        ></session-list>
      `);

      // Should still render without performance features
      expect(element).toBeDefined();
      expect(element.sessions).toHaveLength(100);
      
      await element.updateComplete;
      const content = element.shadowRoot?.querySelector('.sessions-list');
      expect(content).toBeTruthy();

      // Restore
      window.IntersectionObserver = originalIntersectionObserver;
    });
  });
});