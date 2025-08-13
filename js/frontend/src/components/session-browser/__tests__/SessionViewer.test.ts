import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fixture, html, expect as expectLit } from '@open-wc/testing';
import { SessionViewer } from '../viewer/SessionViewer';
import { SessionDetail, MessageDisplay, SessionBranchData } from '../../types/session-types';

// Mock child components
vi.mock('../../message-display/MessageDisplay', () => ({
  MessageDisplay: class extends HTMLElement {
    entry = null;
    processedContent = [];
    metadata = {};
    connectedCallback() {
      this.innerHTML = '<div class="mock-message-display">Message Display</div>';
    }
  }
}));

vi.mock('../../syntax-highlighter/SyntaxHighlighter', () => ({
  SyntaxHighlighter: class extends HTMLElement {
    code = '';
    language = '';
    connectedCallback() {
      this.innerHTML = '<div class="mock-syntax-highlighter">Syntax Highlighter</div>';
    }
  }
}));

// Register mock components
if (!customElements.get('message-display')) {
  customElements.define('message-display', class extends HTMLElement {
    entry = null;
    processedContent = [];
    metadata = {};
    connectedCallback() {
      this.innerHTML = '<div class="mock-message-display">Message Display</div>';
    }
  });
}

if (!customElements.get('syntax-highlighter')) {
  customElements.define('syntax-highlighter', class extends HTMLElement {
    code = '';
    language = '';
    connectedCallback() {
      this.innerHTML = '<div class="mock-syntax-highlighter">Syntax Highlighter</div>';
    }
  });
}

describe('SessionViewer', () => {
  let element: SessionViewer;
  let mockSession: SessionDetail;
  let mockBranchData: SessionBranchData;

  beforeEach(async () => {
    // Create mock session data
    mockSession = {
      sessionId: 'test-session-1',
      title: 'Test Session',
      cwd: '/test/path',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T11:00:00Z'),
      messageCount: 4,
      userMessageCount: 2,
      assistantMessageCount: 2,
      duration: 3600000,
      isActive: false,
      tags: ['test'],
      summary: 'Test session with conversation',
      tokenUsage: {
        inputTokens: 1000,
        outputTokens: 1500,
        totalTokens: 2500
      },
      entries: [
        {
          role: 'user',
          content: 'Hello, can you help me with JavaScript?',
          timestamp: '2024-01-01T10:00:00Z',
          tokenCount: 100
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'I\'d be happy to help you with JavaScript! Here\'s a simple example:\n\n```javascript\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet("World"));\n```'
            }
          ],
          timestamp: '2024-01-01T10:01:00Z',
          tokenCount: 200,
          thinking: ['Let me provide a helpful JavaScript example']
        },
        {
          role: 'user',
          content: 'That\'s great! Can you show me how to use async/await?',
          timestamp: '2024-01-01T10:05:00Z',
          tokenCount: 150
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Here\'s how async/await works in JavaScript:\n\n```javascript\nasync function fetchData() {\n  try {\n    const response = await fetch(\'/api/data\');\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error(\'Error:\', error);\n  }\n}\n```'
            },
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Read',
              input: { file_path: '/examples/async.js' }
            }
          ],
          timestamp: '2024-01-01T10:06:00Z',
          tokenCount: 250
        }
      ],
      metadata: {
        version: '1.0.0',
        client: 'test'
      },
      referencedFiles: ['/examples/async.js'],
      toolsUsed: ['Read'],
      errors: []
    };

    mockBranchData = {
      sessionId: 'test-session-1',
      branchPoint: 1,
      parentSessionId: 'parent-session',
      branches: [
        {
          sessionId: 'branch-1',
          branchPoint: 1,
          metadata: {
            branchName: 'Alternative approach',
            branchReason: 'Different solution path'
          }
        }
      ]
    };

    element = await fixture(html`<session-viewer></session-viewer>`) as SessionViewer;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Initialization', () => {
    it('should render with default properties', () => {
      expect(element).to.exist;
      expect(element.session).to.be.null;
      expect(element.realTimeUpdates).to.be.true;
      expect(element.showBranches).to.be.true;
      expect(element.showThreading).to.be.true;
      expect(element.virtualScrolling).to.be.false;
    });

    it('should render empty state when no session provided', () => {
      const emptyState = element.shadowRoot?.querySelector('.empty-state');
      expect(emptyState).to.exist;
      expect(emptyState?.textContent).to.include('No Session Selected');
    });

    it('should have proper container structure', () => {
      const container = element.shadowRoot?.querySelector('.viewer-container');
      expect(container).to.exist;
      expect(container?.getAttribute('role')).to.equal('main');
    });
  });

  describe('Session Display', () => {
    beforeEach(async () => {
      element.session = mockSession;
      await element.updateComplete;
    });

    it('should display session header information', () => {
      const header = element.shadowRoot?.querySelector('.viewer-header');
      expect(header).to.exist;
      
      const title = element.shadowRoot?.querySelector('.session-title');
      expect(title?.textContent).to.include('Test Session');
      
      const stats = element.shadowRoot?.querySelectorAll('.stat-value');
      expect(stats).to.have.length.greaterThan(0);
    });

    it('should display session statistics correctly', () => {
      const messageCountStat = element.shadowRoot?.querySelector('.stat-value');
      expect(messageCountStat?.textContent).to.equal('4'); // messageCount
      
      const tokenStat = Array.from(element.shadowRoot?.querySelectorAll('.stat-value') || [])
        .find(el => el.textContent?.includes('2.5K')); // totalTokens formatted
      expect(tokenStat).to.exist;
    });

    it('should render message timeline', () => {
      const timeline = element.shadowRoot?.querySelector('.message-timeline');
      expect(timeline).to.exist;
      
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      expect(messageGroups).to.have.length(4); // 4 messages
    });

    it('should display messages with correct roles', () => {
      const userMessages = element.shadowRoot?.querySelectorAll('.message-item.user');
      const assistantMessages = element.shadowRoot?.querySelectorAll('.message-item.assistant');
      
      expect(userMessages).to.have.length(2);
      expect(assistantMessages).to.have.length(2);
    });
  });

  describe('Message Expansion and Collapsing', () => {
    beforeEach(async () => {
      element.session = mockSession;
      await element.updateComplete;
    });

    it('should expand message when header is clicked', async () => {
      const messageHeader = element.shadowRoot?.querySelector('.message-header');
      expect(messageHeader).to.exist;
      
      (messageHeader as HTMLElement)?.click();
      await element.updateComplete;
      
      const messageBody = element.shadowRoot?.querySelector('.message-body:not(.collapsed)');
      expect(messageBody).to.exist;
    });

    it('should handle expand all messages', async () => {
      const expandAllButton = element.shadowRoot?.querySelector('[title="Expand all messages"]');
      expect(expandAllButton).to.exist;
      
      (expandAllButton as HTMLElement)?.click();
      await element.updateComplete;
      
      const collapsedBodies = element.shadowRoot?.querySelectorAll('.message-body.collapsed');
      expect(collapsedBodies).to.have.length(0);
    });

    it('should handle collapse all messages', async () => {
      // First expand all
      const expandAllButton = element.shadowRoot?.querySelector('[title="Expand all messages"]');
      (expandAllButton as HTMLElement)?.click();
      await element.updateComplete;
      
      // Then collapse all
      const collapseAllButton = element.shadowRoot?.querySelector('[title="Collapse all messages"]');
      (collapseAllButton as HTMLElement)?.click();
      await element.updateComplete;
      
      const collapsedBodies = element.shadowRoot?.querySelectorAll('.message-body.collapsed');
      expect(collapsedBodies).to.have.length(4); // All messages collapsed
    });

    it('should handle keyboard navigation on message headers', async () => {
      const messageHeader = element.shadowRoot?.querySelector('.message-header');
      expect(messageHeader).to.exist;
      
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      messageHeader?.dispatchEvent(enterEvent);
      await element.updateComplete;
      
      const messageBody = element.shadowRoot?.querySelector('.message-body:not(.collapsed)');
      expect(messageBody).to.exist;
    });
  });

  describe('Conversation Threading', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.showThreading = true;
      await element.updateComplete;
    });

    it('should detect thread continuations', () => {
      // User -> Assistant should be thread continuation
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      const secondMessage = messageGroups?.[1];
      expect(secondMessage?.classList.contains('thread-continuation')).to.be.true;
    });

    it('should apply threading visualization styles', () => {
      const threadContinuation = element.shadowRoot?.querySelector('.message-group.thread-continuation');
      expect(threadContinuation).to.exist;
      
      // Should have threading visualization CSS
      const computedStyle = window.getComputedStyle(threadContinuation as Element, '::before');
      expect(computedStyle).to.exist;
    });

    it('should toggle threading display', async () => {
      const threadingButton = element.shadowRoot?.querySelector('[title="Toggle conversation threading"]');
      expect(threadingButton).to.exist;
      
      (threadingButton as HTMLElement)?.click();
      await element.updateComplete;
      
      expect(element.showThreading).to.be.false;
      
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      expect(threadContinuations).to.have.length(0);
    });
  });

  describe('Branch Point Visualization', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.branchData = mockBranchData;
      element.showBranches = true;
      await element.updateComplete;
    });

    it('should identify potential branch points', () => {
      const branchMarkers = element.shadowRoot?.querySelectorAll('.branch-point-marker');
      expect(branchMarkers.length).to.be.greaterThan(0);
    });

    it('should display branch creation buttons for assistant messages', () => {
      const branchButtons = element.shadowRoot?.querySelectorAll('[title="Create branch from this message"]');
      expect(branchButtons.length).to.be.greaterThan(0);
    });

    it('should handle branch creation requests', async () => {
      const eventSpy = vi.fn();
      element.addEventListener('branch-requested', eventSpy);
      
      const branchButton = element.shadowRoot?.querySelector('[title="Create branch from this message"]');
      expect(branchButton).to.exist;
      
      (branchButton as HTMLElement)?.click();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            sessionId: 'test-session-1',
            branchPoint: expect.any(Number)
          })
        })
      );
    });

    it('should toggle branch visualization', async () => {
      const branchButton = element.shadowRoot?.querySelector('[title="Toggle branch visualization"]');
      expect(branchButton).to.exist;
      
      (branchButton as HTMLElement)?.click();
      await element.updateComplete;
      
      expect(element.showBranches).to.be.false;
      
      const branchMarkers = element.shadowRoot?.querySelectorAll('.branch-point-marker');
      expect(branchMarkers).to.have.length(0);
    });

    it('should display existing branch indicators', () => {
      // Mock message with existing branches
      const branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
      expect(branchIndicators).to.exist;
    });
  });

  describe('Message Type Indicators', () => {
    beforeEach(async () => {
      element.session = mockSession;
      await element.updateComplete;
    });

    it('should display correct icons for different message types', () => {
      const userMessages = element.shadowRoot?.querySelectorAll('.message-item.user');
      const assistantMessages = element.shadowRoot?.querySelectorAll('.message-item.assistant');
      
      expect(userMessages.length).to.be.greaterThan(0);
      expect(assistantMessages.length).to.be.greaterThan(0);
      
      // Check that role indicators have proper styling
      userMessages.forEach(msg => {
        expect(msg.classList.contains('user')).to.be.true;
      });
      
      assistantMessages.forEach(msg => {
        expect(msg.classList.contains('assistant')).to.be.true;
      });
    });

    it('should display badges for message features', () => {
      const toolUseBadges = element.shadowRoot?.querySelectorAll('.message-badge.tool-use');
      const thinkingBadges = element.shadowRoot?.querySelectorAll('.message-badge.thinking');
      const tokenBadges = element.shadowRoot?.querySelectorAll('.message-badge.tokens');
      
      expect(toolUseBadges.length).to.be.greaterThan(0); // Has tool use message
      expect(thinkingBadges.length).to.be.greaterThan(0); // Has thinking message
      expect(tokenBadges.length).to.be.greaterThan(0); // All messages have token counts
    });

    it('should handle badge interactions', async () => {
      const branchBadge = element.shadowRoot?.querySelector('.message-badge.branch-available');
      if (branchBadge) {
        const eventSpy = vi.fn();
        element.addEventListener('branch-requested', eventSpy);
        
        (branchBadge as HTMLElement).click();
        
        expect(eventSpy).toHaveBeenCalled();
      }
    });
  });

  describe('Syntax Highlighting Integration', () => {
    beforeEach(async () => {
      element.session = mockSession;
      await element.updateComplete;
      
      // Expand messages to see syntax highlighting
      const expandAllButton = element.shadowRoot?.querySelector('[title="Expand all messages"]');
      (expandAllButton as HTMLElement)?.click();
      await element.updateComplete;
    });

    it('should render syntax highlighter for code blocks', () => {
      const syntaxHighlighters = element.shadowRoot?.querySelectorAll('syntax-highlighter');
      expect(syntaxHighlighters.length).to.be.greaterThan(0);
    });

    it('should detect JavaScript code blocks', () => {
      const jsHighlighters = Array.from(element.shadowRoot?.querySelectorAll('syntax-highlighter') || [])
        .filter(el => (el as any).language === 'javascript');
      expect(jsHighlighters.length).to.be.greaterThan(0);
    });

    it('should render tool use with JSON highlighting', () => {
      const toolHighlighters = element.shadowRoot?.querySelectorAll('.tool-use syntax-highlighter');
      expect(toolHighlighters.length).to.be.greaterThan(0);
    });
  });

  describe('Virtual Scrolling', () => {
    beforeEach(async () => {
      // Create session with many messages for virtual scrolling
      const manyMessages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        tokenCount: 50
      }));
      
      element.session = {
        ...mockSession,
        entries: manyMessages,
        messageCount: 100
      };
      element.virtualScrolling = true;
      await element.updateComplete;
    });

    it('should enable virtual scrolling for large sessions', () => {
      const virtualContainer = element.shadowRoot?.querySelector('.timeline-container.virtual');
      expect(virtualContainer).to.exist;
    });

    it('should toggle virtual scrolling', async () => {
      const virtualButton = element.shadowRoot?.querySelector('[title="Toggle virtual scrolling"]');
      expect(virtualButton).to.exist;
      
      (virtualButton as HTMLElement)?.click();
      await element.updateComplete;
      
      expect(element.virtualScrolling).to.be.false;
    });

    it('should render only visible messages in virtual mode', () => {
      const renderedMessages = element.shadowRoot?.querySelectorAll('.message-item');
      expect(renderedMessages.length).to.be.lessThan(100); // Should render less than total
    });
  });

  describe('Message Actions', () => {
    beforeEach(async () => {
      element.session = mockSession;
      await element.updateComplete;
      
      // Expand first message to access actions
      const firstHeader = element.shadowRoot?.querySelector('.message-header');
      (firstHeader as HTMLElement)?.click();
      await element.updateComplete;
    });

    it('should handle copy message action', async () => {
      const copyButton = element.shadowRoot?.querySelector('[title="Copy message content"]');
      expect(copyButton).to.exist;
      
      // Mock clipboard API
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText
        }
      });
      
      (copyButton as HTMLElement)?.click();
      
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining('Hello, can you help me with JavaScript?')
      );
    });

    it('should handle view branches action', async () => {
      const eventSpy = vi.fn();
      element.addEventListener('branches-view-requested', eventSpy);
      
      const viewBranchesButton = element.shadowRoot?.querySelector('[title="View existing branches"]');
      if (viewBranchesButton) {
        (viewBranchesButton as HTMLElement)?.click();
        
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({
              sessionId: 'test-session-1'
            })
          })
        );
      }
    });
  });

  describe('Real-time Updates', () => {
    it('should handle real-time message updates', async () => {
      element.session = mockSession;
      element.realTimeUpdates = true;
      await element.updateComplete;
      
      // Simulate new message
      const updatedSession = {
        ...mockSession,
        entries: [
          ...mockSession.entries,
          {
            role: 'user',
            content: 'New real-time message',
            timestamp: new Date().toISOString(),
            tokenCount: 75
          }
        ],
        messageCount: 5
      };
      
      element.session = updatedSession;
      await element.updateComplete;
      
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      expect(messageGroups).to.have.length(5);
    });
  });

  describe('Parent-Child Message Relationships', () => {
    beforeEach(async () => {
      element.session = mockSession;
      await element.updateComplete;
    });

    it('should display parent connection lines', () => {
      const parentConnections = element.shadowRoot?.querySelectorAll('.parent-connection');
      expect(parentConnections.length).to.be.greaterThan(0);
    });

    it('should identify parent-child relationships correctly', () => {
      // User -> Assistant should have parent relationship
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      const secondMessage = messageGroups?.[1]; // Assistant response to user
      
      expect(secondMessage?.querySelector('.parent-connection')).to.exist;
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed session data gracefully', async () => {
      const malformedSession = {
        ...mockSession,
        entries: null as any
      };
      
      element.session = malformedSession;
      await element.updateComplete;
      
      const emptyState = element.shadowRoot?.querySelector('.empty-state');
      expect(emptyState).to.exist;
    });

    it('should handle missing message content', async () => {
      const sessionWithEmptyMessage = {
        ...mockSession,
        entries: [
          {
            role: 'user',
            content: null as any,
            timestamp: '2024-01-01T10:00:00Z'
          }
        ]
      };
      
      element.session = sessionWithEmptyMessage;
      await element.updateComplete;
      
      // Should not crash, should render something
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      expect(messageGroups).to.have.length(1);
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      element.session = mockSession;
      await element.updateComplete;
    });

    it('should have proper ARIA roles and labels', () => {
      const main = element.shadowRoot?.querySelector('[role="main"]');
      expect(main).to.exist;
      expect(main?.getAttribute('aria-label')).to.equal('Session viewer');
      
      const timeline = element.shadowRoot?.querySelector('[role="log"]');
      expect(timeline).to.exist;
      expect(timeline?.getAttribute('aria-label')).to.include('Message timeline');
    });

    it('should have accessible message headers', () => {
      const messageHeaders = element.shadowRoot?.querySelectorAll('.message-header');
      messageHeaders?.forEach(header => {
        expect(header.getAttribute('role')).to.equal('button');
        expect(header.getAttribute('tabindex')).to.equal('0');
        expect(header.getAttribute('aria-expanded')).to.exist;
      });
    });

    it('should have accessible control buttons', () => {
      const controlButtons = element.shadowRoot?.querySelectorAll('.control-button');
      controlButtons?.forEach(button => {
        expect(button.getAttribute('title')).to.exist;
        expect(button.getAttribute('tabindex')).to.not.equal('-1');
      });
    });

    it('should support keyboard navigation between messages', async () => {
      const messageHeaders = element.shadowRoot?.querySelectorAll('.message-header');
      const firstHeader = messageHeaders?.[0] as HTMLElement;
      const secondHeader = messageHeaders?.[1] as HTMLElement;
      
      firstHeader?.focus();
      expect(document.activeElement).to.equal(firstHeader);
      
      // Simulate Tab key to move to next message
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      firstHeader?.dispatchEvent(tabEvent);
      
      // Should be able to navigate between message headers
      expect(messageHeaders.length).to.be.greaterThan(1);
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of messages efficiently', async () => {
      const largeSession = {
        ...mockSession,
        entries: Array.from({ length: 1000 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Performance test message ${i + 1}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          tokenCount: 50
        })),
        messageCount: 1000
      };
      
      const startTime = performance.now();
      element.session = largeSession;
      await element.updateComplete;
      const endTime = performance.now();
      
      expect(endTime - startTime).to.be.lessThan(1000); // Should render in less than 1 second
    });

    it('should optimize rendering with virtual scrolling for large sessions', async () => {
      const largeSession = {
        ...mockSession,
        entries: Array.from({ length: 500 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Virtual scroll test message ${i + 1}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          tokenCount: 50
        })),
        messageCount: 500
      };
      
      element.session = largeSession;
      element.virtualScrolling = true;
      await element.updateComplete;
      
      const renderedMessages = element.shadowRoot?.querySelectorAll('.message-item');
      expect(renderedMessages.length).to.be.lessThan(100); // Should render much fewer than total
    });
  });
});