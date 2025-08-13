import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SessionViewer } from '../viewer/SessionViewer';
import { SessionDetail } from '../../types/session-types';

// Performance monitoring utilities
class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();
  
  startMeasurement(name: string) {
    return performance.now();
  }
  
  endMeasurement(name: string, startTime: number) {
    const duration = performance.now() - startTime;
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);
    return duration;
  }
  
  getAverageTime(name: string): number {
    const times = this.measurements.get(name) || [];
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }
  
  getMaxTime(name: string): number {
    const times = this.measurements.get(name) || [];
    return Math.max(...times);
  }
  
  getMinTime(name: string): number {
    const times = this.measurements.get(name) || [];
    return Math.min(...times);
  }
  
  clear() {
    this.measurements.clear();
  }
}

// Mock components with performance considerations
class PerformantMockMessageDisplay extends HTMLElement {
  entry: any = null;
  processedContent: any[] = [];
  metadata: any = {};
  
  private static instanceCount = 0;
  private renderCount = 0;
  
  connectedCallback() {
    PerformantMockMessageDisplay.instanceCount++;
    this.innerHTML = this.renderOptimized();
  }
  
  disconnectedCallback() {
    PerformantMockMessageDisplay.instanceCount--;
  }
  
  private renderOptimized() {
    this.renderCount++;
    const startTime = performance.now();
    
    const content = `
      <div class="mock-message-display" data-render-count="${this.renderCount}">
        <div class="message-role">${this.entry?.role || 'unknown'}</div>
        <div class="message-content">${this.getContentPreview()}</div>
      </div>
    `;
    
    const renderTime = performance.now() - startTime;
    this.dataset.renderTime = renderTime.toString();
    
    return content;
  }
  
  private getContentPreview() {
    if (typeof this.entry?.content === 'string') {
      return this.entry.content.slice(0, 100);
    }
    return 'Complex content';
  }
  
  static getInstanceCount() {
    return this.instanceCount;
  }
  
  getRenderCount() {
    return this.renderCount;
  }
}

class PerformantMockSyntaxHighlighter extends HTMLElement {
  code = '';
  language = '';
  
  private static instanceCount = 0;
  
  connectedCallback() {
    PerformantMockSyntaxHighlighter.instanceCount++;
    this.innerHTML = this.renderCode();
  }
  
  disconnectedCallback() {
    PerformantMockSyntaxHighlighter.instanceCount--;
  }
  
  private renderCode() {
    // Simulate syntax highlighting processing time
    const startTime = performance.now();
    
    // Mock processing delay based on code length
    const processingDelay = Math.min(this.code.length * 0.01, 50);
    let elapsed = 0;
    while (elapsed < processingDelay) {
      elapsed = performance.now() - startTime;
    }
    
    return `
      <div class="mock-syntax-highlighter" data-language="${this.language}">
        <pre><code>${this.escapeHtml(this.code)}</code></pre>
      </div>
    `;
  }
  
  private escapeHtml(text: string) {
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  
  static getInstanceCount() {
    return this.instanceCount;
  }
}

// Register performance-aware mock components
if (!customElements.get('message-display')) {
  customElements.define('message-display', PerformantMockMessageDisplay);
}

if (!customElements.get('syntax-highlighter')) {
  customElements.define('syntax-highlighter', PerformantMockSyntaxHighlighter);
}

describe('SessionViewer Performance Tests', () => {
  let element: SessionViewer;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(async () => {
    performanceMonitor = new PerformanceMonitor();
    element = await fixture(html`<session-viewer></session-viewer>`) as SessionViewer;
  });

  afterEach(() => {
    vi.clearAllMocks();
    performanceMonitor.clear();
  });

  // Helper function to create large session data
  function createLargeSession(messageCount: number): SessionDetail {
    return {
      sessionId: `perf-test-${messageCount}`,
      title: `Performance Test Session (${messageCount} messages)`,
      cwd: '/performance/test',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T15:00:00Z'),
      messageCount,
      userMessageCount: Math.floor(messageCount / 2),
      assistantMessageCount: Math.ceil(messageCount / 2),
      duration: 18000000,
      isActive: false,
      tags: ['performance', 'testing'],
      summary: `Large session with ${messageCount} messages for performance testing`,
      tokenUsage: {
        inputTokens: messageCount * 50,
        outputTokens: messageCount * 75,
        totalTokens: messageCount * 125
      },
      entries: Array.from({ length: messageCount }, (_, i) => {
        const isUser = i % 2 === 0;
        const content = isUser 
          ? `User message ${i + 1} with some content that varies in length. This message contains ${Math.floor(Math.random() * 100)} characters of additional text.`
          : [
              {
                type: 'text',
                text: `Assistant response ${i + 1} with detailed explanation and code examples:\n\n\`\`\`javascript\nfunction performanceTest${i}() {\n  const data = new Array(${Math.floor(Math.random() * 1000)}).fill(0).map((_, idx) => idx * 2);\n  return data.reduce((sum, val) => sum + val, 0);\n}\n\nconsole.log('Performance test ${i} completed');\n\`\`\``
              },
              ...(i % 5 === 1 ? [{
                type: 'tool_use',
                id: `tool-perf-${i}`,
                name: 'Read',
                input: { file_path: `/perf/test-${i}.js` }
              }] : [])
            ];
            
        return {
          role: isUser ? 'user' : 'assistant',
          content,
          timestamp: new Date(Date.now() + i * 60000).toISOString(),
          tokenCount: 50 + Math.floor(Math.random() * 200),
          ...(i % 7 === 1 && { thinking: [`Performance test thinking for message ${i}`] })
        };
      }),
      metadata: {
        version: '1.0.0',
        client: 'performance-test'
      },
      referencedFiles: Array.from({ length: Math.min(messageCount / 10, 50) }, (_, i) => `/perf/file-${i}.js`),
      toolsUsed: ['Read', 'Write', 'Edit'],
      errors: []
    };
  }

  describe('Initial Rendering Performance', () => {
    it('should render small sessions (≤50 messages) quickly', async () => {
      const session = createLargeSession(50);
      
      const startTime = performanceMonitor.startMeasurement('small-session-render');
      element.session = session;
      await element.updateComplete;
      const renderTime = performanceMonitor.endMeasurement('small-session-render', startTime);
      
      expect(renderTime).to.be.lessThan(500); // Should render in under 500ms
      
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item');
      expect(messageItems?.length).to.equal(50);
    });

    it('should render medium sessions (≤200 messages) reasonably fast', async () => {
      const session = createLargeSession(200);
      
      const startTime = performanceMonitor.startMeasurement('medium-session-render');
      element.session = session;
      await element.updateComplete;
      const renderTime = performanceMonitor.endMeasurement('medium-session-render', startTime);
      
      expect(renderTime).to.be.lessThan(1500); // Should render in under 1.5 seconds
      
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item');
      expect(messageItems?.length).to.equal(200);
    });

    it('should handle large sessions (≤1000 messages) with virtual scrolling', async () => {
      const session = createLargeSession(1000);
      
      element.virtualScrolling = true;
      
      const startTime = performanceMonitor.startMeasurement('large-session-render');
      element.session = session;
      await element.updateComplete;
      const renderTime = performanceMonitor.endMeasurement('large-session-render', startTime);
      
      expect(renderTime).to.be.lessThan(3000); // Should render in under 3 seconds
      
      // With virtual scrolling, should render fewer DOM elements
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item');
      expect(messageItems?.length).to.be.lessThan(100); // Much fewer than total messages
    });

    it('should automatically enable virtual scrolling for very large sessions', async () => {
      const session = createLargeSession(500);
      
      element.session = session;
      await element.updateComplete;
      
      // Component should auto-enable virtual scrolling for large sessions
      const virtualContainer = element.shadowRoot?.querySelector('.timeline-container.virtual');
      
      if (session.messageCount > 100) {
        expect(virtualContainer).to.exist;
      }
    });
  });

  describe('Virtual Scrolling Performance', () => {
    beforeEach(async () => {
      element.virtualScrolling = true;
    });

    it('should render only visible items in virtual scrolling mode', async () => {
      const session = createLargeSession(500);
      
      element.session = session;
      await element.updateComplete;
      
      const renderedMessages = element.shadowRoot?.querySelectorAll('.message-item');
      const totalMessages = session.entries.length;
      
      expect(renderedMessages?.length).to.be.lessThan(totalMessages * 0.2); // Should render < 20% of messages
      expect(renderedMessages?.length).to.be.greaterThan(0);
    });

    it('should handle rapid scrolling efficiently', async () => {
      const session = createLargeSession(1000);
      element.session = session;
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.timeline-container') as HTMLElement;
      if (!container) return;
      
      // Simulate rapid scrolling
      const scrollTests = Array.from({ length: 10 }, (_, i) => i * 1000);
      const scrollTimes: number[] = [];
      
      for (const scrollTop of scrollTests) {
        const startTime = performance.now();
        
        container.scrollTop = scrollTop;
        container.dispatchEvent(new Event('scroll'));
        
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const scrollTime = performance.now() - startTime;
        scrollTimes.push(scrollTime);
      }
      
      const averageScrollTime = scrollTimes.reduce((sum, time) => sum + time, 0) / scrollTimes.length;
      expect(averageScrollTime).to.be.lessThan(50); // Each scroll should take < 50ms
    });

    it('should maintain consistent performance during scroll', async () => {
      const session = createLargeSession(800);
      element.session = session;
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.timeline-container') as HTMLElement;
      if (!container) return;
      
      const performanceEntries: number[] = [];
      
      // Test scroll performance at different positions
      for (let i = 0; i < 20; i++) {
        const scrollPosition = (i / 19) * (container.scrollHeight - container.clientHeight);
        
        const startTime = performance.now();
        container.scrollTop = scrollPosition;
        container.dispatchEvent(new Event('scroll'));
        await new Promise(resolve => requestAnimationFrame(resolve));
        const endTime = performance.now();
        
        performanceEntries.push(endTime - startTime);
      }
      
      // Check that performance remains consistent (no significant spikes)
      const average = performanceEntries.reduce((sum, time) => sum + time, 0) / performanceEntries.length;
      const maxTime = Math.max(...performanceEntries);
      
      expect(maxTime).to.be.lessThan(average * 3); // No scroll should take > 3x average time
    });

    it('should efficiently update visible items when scrolling', async () => {
      const session = createLargeSession(600);
      element.session = session;
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.timeline-container') as HTMLElement;
      if (!container) return;
      
      const initialRenderedCount = element.shadowRoot?.querySelectorAll('.message-item').length || 0;
      
      // Scroll to different position
      container.scrollTop = container.scrollHeight * 0.5;
      container.dispatchEvent(new Event('scroll'));
      await element.updateComplete;
      
      const newRenderedCount = element.shadowRoot?.querySelectorAll('.message-item').length || 0;
      
      // Should maintain similar number of rendered items
      expect(Math.abs(newRenderedCount - initialRenderedCount)).to.be.lessThan(10);
    });
  });

  describe('Memory Management', () => {
    it('should not create excessive DOM elements for large sessions', async () => {
      const session = createLargeSession(1000);
      element.virtualScrolling = true;
      
      const initialElementCount = document.querySelectorAll('*').length;
      
      element.session = session;
      await element.updateComplete;
      
      const finalElementCount = document.querySelectorAll('*').length;
      const addedElements = finalElementCount - initialElementCount;
      
      // Should not add more than 200 elements for 1000 messages
      expect(addedElements).to.be.lessThan(200);
    });

    it('should cleanup components when session changes', async () => {
      const firstSession = createLargeSession(100);
      element.session = firstSession;
      await element.updateComplete;
      
      const initialMessageDisplayCount = PerformantMockMessageDisplay.getInstanceCount();
      const initialSyntaxHighlighterCount = PerformantMockSyntaxHighlighter.getInstanceCount();
      
      // Switch to different session
      const secondSession = createLargeSession(150);
      element.session = secondSession;
      await element.updateComplete;
      
      // Should not accumulate component instances
      expect(PerformantMockMessageDisplay.getInstanceCount()).to.be.lessThan(initialMessageDisplayCount * 1.5);
      expect(PerformantMockSyntaxHighlighter.getInstanceCount()).to.be.lessThan(initialSyntaxHighlighterCount * 1.5);
    });

    it('should handle rapid session switching without memory leaks', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) => createLargeSession(50 + i * 10));
      
      const initialInstanceCount = PerformantMockMessageDisplay.getInstanceCount();
      
      // Rapidly switch between sessions
      for (const session of sessions) {
        element.session = session;
        await element.updateComplete;
      }
      
      // Allow cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalInstanceCount = PerformantMockMessageDisplay.getInstanceCount();
      
      // Should not accumulate instances beyond reasonable bounds
      expect(finalInstanceCount).to.be.lessThan(initialInstanceCount + 200);
    });
  });

  describe('Feature Toggle Performance', () => {
    beforeEach(async () => {
      const session = createLargeSession(300);
      element.session = session;
      await element.updateComplete;
    });

    it('should toggle threading visualization quickly', async () => {
      const toggleTimes: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        element.showThreading = !element.showThreading;
        await element.updateComplete;
        const toggleTime = performance.now() - startTime;
        
        toggleTimes.push(toggleTime);
      }
      
      const averageToggleTime = toggleTimes.reduce((sum, time) => sum + time, 0) / toggleTimes.length;
      expect(averageToggleTime).to.be.lessThan(200); // Should toggle in < 200ms
    });

    it('should toggle branch visualization efficiently', async () => {
      const toggleTimes: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        element.showBranches = !element.showBranches;
        await element.updateComplete;
        const toggleTime = performance.now() - startTime;
        
        toggleTimes.push(toggleTime);
      }
      
      const averageToggleTime = toggleTimes.reduce((sum, time) => sum + time, 0) / toggleTimes.length;
      expect(averageToggleTime).to.be.lessThan(150); // Should toggle in < 150ms
    });

    it('should toggle virtual scrolling without performance degradation', async () => {
      const startTime = performance.now();
      
      element.virtualScrolling = !element.virtualScrolling;
      await element.updateComplete;
      
      const toggleTime = performance.now() - startTime;
      expect(toggleTime).to.be.lessThan(300); // Should toggle in < 300ms
      
      // Verify functionality after toggle
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item');
      expect(messageItems?.length).to.be.greaterThan(0);
    });
  });

  describe('Real-time Update Performance', () => {
    it('should handle incremental message additions efficiently', async () => {
      const baseSession = createLargeSession(200);
      element.session = baseSession;
      await element.updateComplete;
      
      const updateTimes: number[] = [];
      
      // Simulate adding messages one by one
      for (let i = 0; i < 20; i++) {
        const newMessage = {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Real-time message ${i + 1}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          tokenCount: 50
        };
        
        const startTime = performance.now();
        
        const updatedSession = {
          ...baseSession,
          entries: [...baseSession.entries, newMessage],
          messageCount: baseSession.messageCount + i + 1
        };
        
        element.session = updatedSession;
        await element.updateComplete;
        
        const updateTime = performance.now() - startTime;
        updateTimes.push(updateTime);
      }
      
      const averageUpdateTime = updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;
      expect(averageUpdateTime).to.be.lessThan(100); // Each update should take < 100ms
    });

    it('should handle bulk message updates efficiently', async () => {
      const baseSession = createLargeSession(100);
      element.session = baseSession;
      await element.updateComplete;
      
      // Add 50 messages at once
      const newMessages = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Bulk message ${i + 1}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        tokenCount: 50
      }));
      
      const startTime = performance.now();
      
      const updatedSession = {
        ...baseSession,
        entries: [...baseSession.entries, ...newMessages],
        messageCount: baseSession.messageCount + 50
      };
      
      element.session = updatedSession;
      await element.updateComplete;
      
      const updateTime = performance.now() - startTime;
      expect(updateTime).to.be.lessThan(500); // Bulk update should take < 500ms
    });
  });

  describe('Interaction Performance', () => {
    beforeEach(async () => {
      const session = createLargeSession(200);
      element.session = session;
      await element.updateComplete;
    });

    it('should handle message expansion quickly', async () => {
      const messageHeaders = element.shadowRoot?.querySelectorAll('.message-header') as NodeListOf<HTMLElement>;
      if (messageHeaders.length === 0) return;
      
      const expansionTimes: number[] = [];
      
      // Test expanding first 10 messages
      for (let i = 0; i < Math.min(10, messageHeaders.length); i++) {
        const startTime = performance.now();
        
        messageHeaders[i].click();
        await element.updateComplete;
        
        const expansionTime = performance.now() - startTime;
        expansionTimes.push(expansionTime);
      }
      
      const averageExpansionTime = expansionTimes.reduce((sum, time) => sum + time, 0) / expansionTimes.length;
      expect(averageExpansionTime).to.be.lessThan(100); // Each expansion should take < 100ms
    });

    it('should handle expand all messages efficiently', async () => {
      const expandAllButton = element.shadowRoot?.querySelector('[title="Expand all messages"]') as HTMLButtonElement;
      if (!expandAllButton) return;
      
      const startTime = performance.now();
      
      expandAllButton.click();
      await element.updateComplete;
      
      const expandAllTime = performance.now() - startTime;
      expect(expandAllTime).to.be.lessThan(1000); // Expand all should take < 1 second
    });

    it('should handle rapid user interactions without lag', async () => {
      const controlButtons = element.shadowRoot?.querySelectorAll('.control-button') as NodeListOf<HTMLButtonElement>;
      if (controlButtons.length === 0) return;
      
      const interactionTimes: number[] = [];
      
      // Rapidly click different control buttons
      for (let i = 0; i < Math.min(10, controlButtons.length); i++) {
        const button = controlButtons[i % controlButtons.length];
        
        const startTime = performance.now();
        button.click();
        await element.updateComplete;
        const interactionTime = performance.now() - startTime;
        
        interactionTimes.push(interactionTime);
      }
      
      const averageInteractionTime = interactionTimes.reduce((sum, time) => sum + time, 0) / interactionTimes.length;
      expect(averageInteractionTime).to.be.lessThan(150); // Each interaction should take < 150ms
    });
  });

  describe('Stress Testing', () => {
    it('should handle extreme session sizes gracefully', async () => {
      const extremeSession = createLargeSession(2000);
      element.virtualScrolling = true;
      
      const startTime = performance.now();
      
      element.session = extremeSession;
      await element.updateComplete;
      
      const renderTime = performance.now() - startTime;
      expect(renderTime).to.be.lessThan(5000); // Should handle 2000 messages in < 5 seconds
      
      // Should still be functional
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item');
      expect(messageItems?.length).to.be.greaterThan(0);
    });

    it('should maintain performance under memory pressure', async () => {
      // Create multiple large arrays to simulate memory pressure
      const memoryPressure = Array.from({ length: 10 }, () => new Array(100000).fill('memory pressure'));
      
      const session = createLargeSession(500);
      element.virtualScrolling = true;
      
      const startTime = performance.now();
      
      element.session = session;
      await element.updateComplete;
      
      const renderTime = performance.now() - startTime;
      expect(renderTime).to.be.lessThan(4000); // Should still render reasonably fast under memory pressure
      
      // Cleanup
      memoryPressure.length = 0;
    });

    it('should recover gracefully from performance issues', async () => {
      const session = createLargeSession(1000);
      element.virtualScrolling = true;
      element.session = session;
      await element.updateComplete;
      
      // Simulate performance issue by rapidly updating session
      const rapidUpdates = Array.from({ length: 20 }, (_, i) => ({
        ...session,
        entries: [
          ...session.entries,
          {
            role: 'user',
            content: `Rapid update ${i}`,
            timestamp: new Date(Date.now() + i * 100).toISOString(),
            tokenCount: 50
          }
        ],
        messageCount: session.messageCount + i + 1
      }));
      
      // Apply updates rapidly
      const startTime = performance.now();
      for (const update of rapidUpdates) {
        element.session = update;
        // Don't wait for update complete to simulate rapid updates
      }
      
      // Wait for final update
      await element.updateComplete;
      const totalTime = performance.now() - startTime;
      
      expect(totalTime).to.be.lessThan(3000); // Should handle rapid updates in < 3 seconds
      
      // Should still be functional
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item');
      expect(messageItems?.length).to.be.greaterThan(0);
    });
  });
});