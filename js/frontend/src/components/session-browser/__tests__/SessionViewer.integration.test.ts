import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fixture, html, expect as expectLit, nextFrame, oneEvent } from '@open-wc/testing';
import { SessionViewer } from '../viewer/SessionViewer';
import { SessionDetail, SessionBranchData } from '../../types/session-types';

// Mock MessageDisplay with full interaction capabilities
class MockMessageDisplay extends HTMLElement {
  entry: any = null;
  processedContent: any[] = [];
  metadata: any = {};
  collapsible = false;
  showSyntaxHighlighting = false;
  showToolDetails = false;

  connectedCallback() {
    this.innerHTML = `
      <div class="mock-message-display">
        <div class="message-role">${this.entry?.role || 'unknown'}</div>
        <div class="message-content">${this.getContentPreview()}</div>
        ${this.metadata.hasToolUse ? '<div class="tool-indicator">🛠️ Tool Use</div>' : ''}
        ${this.metadata.hasThinking ? '<div class="thinking-indicator">💭 Thinking</div>' : ''}
        <button class="expand-content">Expand</button>
        <button class="copy-content">Copy</button>
      </div>
    `;
    this.attachEventListeners();
  }

  private getContentPreview() {
    if (typeof this.entry?.content === 'string') {
      return this.entry.content.slice(0, 100) + '...';
    }
    if (Array.isArray(this.entry?.content)) {
      const textContent = this.entry.content.find((item: any) => item.type === 'text');
      return textContent ? textContent.text.slice(0, 100) + '...' : 'Complex content';
    }
    return 'No content';
  }

  private attachEventListeners() {
    const expandButton = this.querySelector('.expand-content');
    const copyButton = this.querySelector('.copy-content');

    expandButton?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('content-expanded', {
        detail: { expanded: true, entry: this.entry },
        bubbles: true
      }));
    });

    copyButton?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('content-copied', {
        detail: { entry: this.entry },
        bubbles: true
      }));
    });
  }
}

// Mock SyntaxHighlighter with interactive features
class MockSyntaxHighlighter extends HTMLElement {
  code = '';
  language = '';
  lineNumbers = false;
  copyable = false;
  compact = false;
  theme = 'auto';

  connectedCallback() {
    this.innerHTML = `
      <div class="mock-syntax-highlighter" data-language="${this.language}">
        <div class="highlighter-header">
          <span class="language-label">${this.language}</span>
          ${this.copyable ? '<button class="copy-code">Copy</button>' : ''}
        </div>
        <pre class="code-block"><code>${this.escapeHtml(this.code)}</code></pre>
      </div>
    `;
    this.attachEventListeners();
  }

  private escapeHtml(text: string) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private attachEventListeners() {
    const copyButton = this.querySelector('.copy-code');
    copyButton?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('code-copied', {
        detail: { code: this.code, language: this.language },
        bubbles: true
      }));
    });
  }
}

// Register mock components
if (!customElements.get('message-display')) {
  customElements.define('message-display', MockMessageDisplay);
}

if (!customElements.get('syntax-highlighter')) {
  customElements.define('syntax-highlighter', MockSyntaxHighlighter);
}

describe('SessionViewer Integration Tests', () => {
  let element: SessionViewer;
  let mockSession: SessionDetail;
  let mockBranchData: SessionBranchData;
  let complexSession: SessionDetail;

  beforeEach(async () => {
    // Create comprehensive mock session data
    mockSession = {
      sessionId: 'integration-test-session',
      title: 'Full Integration Test Session',
      cwd: '/integration-test',
      startTime: new Date('2024-01-01T09:00:00Z'),
      endTime: new Date('2024-01-01T12:00:00Z'),
      messageCount: 8,
      userMessageCount: 4,
      assistantMessageCount: 4,
      duration: 10800000, // 3 hours
      isActive: false,
      tags: ['integration', 'testing', 'javascript'],
      summary: 'Comprehensive integration test session',
      tokenUsage: {
        inputTokens: 2500,
        outputTokens: 3500,
        totalTokens: 6000
      },
      entries: [
        {
          role: 'user',
          content: 'I need help building a JavaScript application with async functions.',
          timestamp: '2024-01-01T09:00:00Z',
          tokenCount: 150
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'I\'ll help you build a JavaScript application with async functions. Let\'s start with a basic example:\n\n```javascript\nasync function fetchUserData(userId) {\n  try {\n    const response = await fetch(`/api/users/${userId}`);\n    const userData = await response.json();\n    return userData;\n  } catch (error) {\n    console.error(\'Error fetching user data:\', error);\n    throw error;\n  }\n}\n\n// Usage\nfetchUserData(123).then(user => {\n  console.log(user);\n});\n```'
            }
          ],
          timestamp: '2024-01-01T09:05:00Z',
          tokenCount: 300,
          thinking: ['The user wants to learn async/await in JavaScript', 'I should provide a comprehensive example with error handling']
        },
        {
          role: 'user',
          content: 'That\'s great! Can you show me how to handle multiple async operations in parallel?',
          timestamp: '2024-01-01T09:15:00Z',
          tokenCount: 120
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Absolutely! Here are several ways to handle parallel async operations:\n\n```javascript\n// Method 1: Promise.all() - all must succeed\nasync function fetchAllUserData(userIds) {\n  try {\n    const promises = userIds.map(id => fetchUserData(id));\n    const users = await Promise.all(promises);\n    return users;\n  } catch (error) {\n    // If any promise fails, this will catch it\n    console.error(\'One or more requests failed:\', error);\n    throw error;\n  }\n}\n\n// Method 2: Promise.allSettled() - get results even if some fail\nasync function fetchAllUserDataSafely(userIds) {\n  const promises = userIds.map(id => fetchUserData(id));\n  const results = await Promise.allSettled(promises);\n  \n  const successful = results\n    .filter(result => result.status === \'fulfilled\')\n    .map(result => result.value);\n  \n  const failed = results\n    .filter(result => result.status === \'rejected\')\n    .map(result => result.reason);\n  \n  return { successful, failed };\n}\n```'
            },
            {
              type: 'tool_use',
              id: 'tool-read-1',
              name: 'Read',
              input: { file_path: '/examples/async-patterns.js' }
            }
          ],
          timestamp: '2024-01-01T09:25:00Z',
          tokenCount: 450
        },
        {
          role: 'user',
          content: 'Perfect! Now I need to implement error handling and retry logic.',
          timestamp: '2024-01-01T10:00:00Z',
          tokenCount: 100
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Great question! Here\'s a robust retry implementation:\n\n```javascript\nclass RetryableError extends Error {\n  constructor(message, retryable = true) {\n    super(message);\n    this.retryable = retryable;\n  }\n}\n\nasync function withRetry(fn, maxRetries = 3, delay = 1000) {\n  let lastError;\n  \n  for (let attempt = 0; attempt <= maxRetries; attempt++) {\n    try {\n      const result = await fn();\n      return result;\n    } catch (error) {\n      lastError = error;\n      \n      // Don\'t retry if error is not retryable\n      if (error.retryable === false) {\n        throw error;\n      }\n      \n      // Don\'t retry on last attempt\n      if (attempt === maxRetries) {\n        break;\n      }\n      \n      // Exponential backoff\n      const backoffDelay = delay * Math.pow(2, attempt);\n      console.log(`Attempt ${attempt + 1} failed, retrying in ${backoffDelay}ms...`);\n      await new Promise(resolve => setTimeout(resolve, backoffDelay));\n    }\n  }\n  \n  throw new Error(`Failed after ${maxRetries + 1} attempts: ${lastError.message}`);\n}\n\n// Usage with your fetch function\nasync function fetchUserDataWithRetry(userId) {\n  return withRetry(async () => {\n    const response = await fetch(`/api/users/${userId}`);\n    \n    if (!response.ok) {\n      if (response.status >= 500) {\n        // Server errors are retryable\n        throw new RetryableError(`Server error: ${response.status}`);\n      } else {\n        // Client errors (4xx) are not retryable\n        throw new RetryableError(`Client error: ${response.status}`, false);\n      }\n    }\n    \n    return response.json();\n  });\n}\n```'
            }
          ],
          timestamp: '2024-01-01T10:15:00Z',
          tokenCount: 600,
          thinking: ['User needs robust error handling', 'Should show retry logic with exponential backoff', 'Include both retryable and non-retryable errors']
        },
        {
          role: 'user',
          content: 'This is excellent! Can you help me test these async functions?',
          timestamp: '2024-01-01T11:00:00Z',
          tokenCount: 80
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Absolutely! Testing async functions is crucial. Here\'s a comprehensive testing approach:\n\n```javascript\n// Using Jest or Vitest\ndescribe(\'Async Functions\', () => {\n  beforeEach(() => {\n    // Reset mocks before each test\n    vi.clearAllMocks();\n  });\n  \n  describe(\'fetchUserData\', () => {\n    it(\'should fetch user data successfully\', async () => {\n      const mockUser = { id: 1, name: \'John Doe\' };\n      global.fetch = vi.fn().mockResolvedValue({\n        ok: true,\n        json: vi.fn().mockResolvedValue(mockUser)\n      });\n      \n      const result = await fetchUserData(1);\n      \n      expect(fetch).toHaveBeenCalledWith(\'/api/users/1\');\n      expect(result).toEqual(mockUser);\n    });\n    \n    it(\'should handle network errors\', async () => {\n      global.fetch = vi.fn().mockRejectedValue(new Error(\'Network error\'));\n      \n      await expect(fetchUserData(1)).rejects.toThrow(\'Network error\');\n    });\n    \n    it(\'should handle HTTP errors\', async () => {\n      global.fetch = vi.fn().mockResolvedValue({\n        ok: false,\n        status: 404\n      });\n      \n      await expect(fetchUserData(1)).rejects.toThrow();\n    });\n  });\n  \n  describe(\'withRetry\', () => {\n    it(\'should succeed on first try\', async () => {\n      const mockFn = vi.fn().mockResolvedValue(\'success\');\n      \n      const result = await withRetry(mockFn);\n      \n      expect(result).toBe(\'success\');\n      expect(mockFn).toHaveBeenCalledTimes(1);\n    });\n    \n    it(\'should retry on retryable errors\', async () => {\n      const mockFn = vi.fn()\n        .mockRejectedValueOnce(new RetryableError(\'Temporary error\'))\n        .mockRejectedValueOnce(new RetryableError(\'Another error\'))\n        .mockResolvedValue(\'success\');\n      \n      const result = await withRetry(mockFn, 3, 10); // Fast retry for tests\n      \n      expect(result).toBe(\'success\');\n      expect(mockFn).toHaveBeenCalledTimes(3);\n    });\n    \n    it(\'should not retry non-retryable errors\', async () => {\n      const mockFn = vi.fn().mockRejectedValue(\n        new RetryableError(\'Not retryable\', false)\n      );\n      \n      await expect(withRetry(mockFn)).rejects.toThrow(\'Not retryable\');\n      expect(mockFn).toHaveBeenCalledTimes(1);\n    });\n  });\n});\n```'
            },
            {
              type: 'tool_use',
              id: 'tool-write-1',
              name: 'Write',
              input: { 
                file_path: '/tests/async-functions.test.js',
                content: '// Test file content would be written here'
              }
            }
          ],
          timestamp: '2024-01-01T11:30:00Z',
          tokenCount: 750
        }
      ],
      metadata: {
        version: '1.0.0',
        client: 'claude-code',
        environment: 'integration-test'
      },
      referencedFiles: [
        '/examples/async-patterns.js',
        '/tests/async-functions.test.js'
      ],
      toolsUsed: ['Read', 'Write'],
      errors: []
    };

    mockBranchData = {
      sessionId: 'integration-test-session',
      branchPoint: 3, // Branch from the parallel async explanation
      parentSessionId: 'parent-session',
      branches: [
        {
          sessionId: 'branch-async-advanced',
          branchPoint: 3,
          metadata: {
            branchName: 'Advanced Async Patterns',
            branchReason: 'Explore more complex async scenarios'
          }
        },
        {
          sessionId: 'branch-testing-focus',
          branchPoint: 5,
          metadata: {
            branchName: 'Testing Focus',
            branchReason: 'Deep dive into testing strategies'
          }
        }
      ]
    };

    // Create complex session for performance testing
    complexSession = {
      ...mockSession,
      sessionId: 'complex-session',
      messageCount: 100,
      entries: Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: i % 2 === 0 
          ? `User message ${i + 1} with some content that might be longer and contain more details about the request.`
          : [
              {
                type: 'text',
                text: `Assistant response ${i + 1} with detailed explanation and code examples:\n\n\`\`\`javascript\nfunction example${i}() {\n  console.log("Example ${i}");\n  return ${i};\n}\n\`\`\``
              },
              ...(i % 4 === 1 ? [{
                type: 'tool_use',
                id: `tool-${i}`,
                name: 'Read',
                input: { file_path: `/examples/file-${i}.js` }
              }] : [])
            ],
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
        tokenCount: 50 + Math.floor(Math.random() * 200),
        ...(i % 5 === 1 && { thinking: [`Thinking about problem ${i}`] })
      }))
    };

    element = await fixture(html`<session-viewer></session-viewer>`) as SessionViewer;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Display Integration', () => {
    beforeEach(async () => {
      element.session = mockSession;
      await element.updateComplete;
    });

    it('should integrate with MessageDisplay components', async () => {
      const messageDisplays = element.shadowRoot?.querySelectorAll('message-display') as NodeListOf<MockMessageDisplay>;
      expect(messageDisplays.length).to.be.greaterThan(0);

      // Verify each MessageDisplay receives correct data
      messageDisplays.forEach((display, index) => {
        expect(display.entry).to.deep.equal(mockSession.entries[index]);
        expect(display.metadata).to.exist;
      });
    });

    it('should handle content expansion events from MessageDisplay', async () => {
      const expandEventSpy = vi.fn();
      element.addEventListener('content-expanded', expandEventSpy);

      const firstMessageDisplay = element.shadowRoot?.querySelector('message-display') as MockMessageDisplay;
      const expandButton = firstMessageDisplay.querySelector('.expand-content') as HTMLButtonElement;
      
      expandButton.click();

      expect(expandEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            expanded: true,
            entry: mockSession.entries[0]
          })
        })
      );
    });

    it('should propagate tool selection events', async () => {
      const toolSelectedSpy = vi.fn();
      element.addEventListener('tool-selected', toolSelectedSpy);

      // Find a message with tool use
      const messageDisplays = element.shadowRoot?.querySelectorAll('message-display') as NodeListOf<MockMessageDisplay>;
      const toolMessage = Array.from(messageDisplays).find(display => display.metadata.hasToolUse);
      
      if (toolMessage) {
        const toolEvent = new CustomEvent('tool-selected', {
          detail: { toolId: 'tool-read-1', toolName: 'Read' },
          bubbles: true
        });
        toolMessage.dispatchEvent(toolEvent);

        expect(toolSelectedSpy).toHaveBeenCalledOnce();
      }
    });

    it('should handle copy events from MessageDisplay', async () => {
      const copyButton = element.shadowRoot?.querySelector('message-display .copy-content') as HTMLButtonElement;
      expect(copyButton).to.exist;

      // Mock clipboard API
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText }
      });

      copyButton.click();
      await nextFrame();

      // Should trigger copy functionality
      expect(copyButton).to.exist;
    });
  });

  describe('Syntax Highlighting Integration', () => {
    beforeEach(async () => {
      element.session = mockSession;
      await element.updateComplete;
      
      // Expand messages to show syntax highlighting
      const expandAllButton = element.shadowRoot?.querySelector('[title="Expand all messages"]') as HTMLButtonElement;
      expandAllButton?.click();
      await element.updateComplete;
    });

    it('should integrate with SyntaxHighlighter components', () => {
      const syntaxHighlighters = element.shadowRoot?.querySelectorAll('syntax-highlighter') as NodeListOf<MockSyntaxHighlighter>;
      expect(syntaxHighlighters.length).to.be.greaterThan(0);

      // Verify JavaScript code blocks are highlighted
      const jsHighlighters = Array.from(syntaxHighlighters).filter(
        highlighter => highlighter.language === 'javascript'
      );
      expect(jsHighlighters.length).to.be.greaterThan(0);
    });

    it('should handle code copying from SyntaxHighlighter', async () => {
      const syntaxHighlighter = element.shadowRoot?.querySelector('syntax-highlighter') as MockSyntaxHighlighter;
      const copyButton = syntaxHighlighter?.querySelector('.copy-code') as HTMLButtonElement;
      
      if (copyButton) {
        const codeCopiedSpy = vi.fn();
        element.addEventListener('code-copied', codeCopiedSpy);
        
        copyButton.click();
        
        expect(codeCopiedSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({
              code: expect.any(String),
              language: expect.any(String)
            })
          })
        );
      }
    });

    it('should render different languages with appropriate highlighting', () => {
      const syntaxHighlighters = element.shadowRoot?.querySelectorAll('syntax-highlighter') as NodeListOf<MockSyntaxHighlighter>;
      
      const languages = new Set(
        Array.from(syntaxHighlighters).map(h => h.language).filter(lang => lang)
      );
      
      expect(languages.has('javascript')).to.be.true;
    });

    it('should handle tool use JSON highlighting', () => {
      // Tool use should be highlighted as JSON
      const toolHighlighters = element.shadowRoot?.querySelectorAll('.tool-use syntax-highlighter') as NodeListOf<MockSyntaxHighlighter>;
      
      if (toolHighlighters.length > 0) {
        Array.from(toolHighlighters).forEach(highlighter => {
          expect(['json', '']).to.include(highlighter.language);
        });
      }
    });
  });

  describe('Threading and Branch Integration', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.branchData = mockBranchData;
      element.showThreading = true;
      element.showBranches = true;
      await element.updateComplete;
    });

    it('should coordinate threading visualization with branch points', () => {
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      const branchPoints = element.shadowRoot?.querySelectorAll('.branch-point-marker');
      
      expect(threadContinuations.length).to.be.greaterThan(0);
      expect(branchPoints.length).to.be.greaterThan(0);
    });

    it('should handle branch creation from threaded conversations', async () => {
      const branchEventSpy = vi.fn();
      element.addEventListener('branch-requested', branchEventSpy);

      const branchButton = element.shadowRoot?.querySelector('[title="Create branch from this message"]') as HTMLButtonElement;
      if (branchButton) {
        branchButton.click();

        expect(branchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({
              sessionId: 'integration-test-session',
              branchPoint: expect.any(Number)
            })
          })
        );
      }
    });

    it('should display existing branch indicators in threaded view', () => {
      const branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
      expect(branchIndicators.length).to.be.greaterThan(0);

      // Should show branch information
      const branchInfo = element.shadowRoot?.querySelector('.branch-info');
      expect(branchInfo).to.exist;
    });

    it('should handle branch navigation from threaded messages', async () => {
      const viewBranchesButton = element.shadowRoot?.querySelector('[title="View all branches from this point"]') as HTMLButtonElement;
      
      if (viewBranchesButton) {
        const branchViewSpy = vi.fn();
        element.addEventListener('branches-view-requested', branchViewSpy);
        
        viewBranchesButton.click();
        
        expect(branchViewSpy).toHaveBeenCalledOnce();
      }
    });
  });

  describe('Virtual Scrolling Integration', () => {
    beforeEach(async () => {
      element.session = complexSession;
      element.virtualScrolling = true;
      await element.updateComplete;
    });

    it('should enable virtual scrolling for large sessions', () => {
      const virtualContainer = element.shadowRoot?.querySelector('.timeline-container.virtual');
      expect(virtualContainer).to.exist;
    });

    it('should render only visible messages in virtual mode', () => {
      const renderedMessages = element.shadowRoot?.querySelectorAll('.message-item');
      expect(renderedMessages.length).to.be.lessThan(complexSession.messageCount);
      expect(renderedMessages.length).to.be.greaterThan(0);
    });

    it('should maintain scroll position when messages update', async () => {
      const container = element.shadowRoot?.querySelector('.timeline-container') as HTMLElement;
      
      // Simulate scroll
      container.scrollTop = 500;
      
      // Update session with new message
      const updatedSession = {
        ...complexSession,
        entries: [
          ...complexSession.entries,
          {
            role: 'user',
            content: 'New message during virtual scrolling',
            timestamp: new Date().toISOString(),
            tokenCount: 50
          }
        ],
        messageCount: complexSession.messageCount + 1
      };
      
      element.session = updatedSession;
      await element.updateComplete;
      
      // Should maintain reasonable scroll position
      expect(container.scrollTop).to.be.greaterThan(0);
    });

    it('should handle scroll events efficiently', async () => {
      const container = element.shadowRoot?.querySelector('.timeline-container') as HTMLElement;
      
      // Simulate rapid scrolling
      const scrollEvents = Array.from({ length: 10 }, (_, i) => {
        container.scrollTop = i * 100;
        return new Promise(resolve => {
          container.dispatchEvent(new Event('scroll'));
          requestAnimationFrame(resolve);
        });
      });
      
      await Promise.all(scrollEvents);
      
      // Should handle all scroll events without crashing
      expect(container.scrollTop).to.be.greaterThan(0);
    });
  });

  describe('Real-time Updates Integration', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.realTimeUpdates = true;
      await element.updateComplete;
    });

    it('should handle real-time message additions', async () => {
      const initialMessageCount = element.shadowRoot?.querySelectorAll('.message-item').length || 0;
      
      // Simulate real-time message
      const updatedSession = {
        ...mockSession,
        entries: [
          ...mockSession.entries,
          {
            role: 'user',
            content: 'Real-time message addition',
            timestamp: new Date().toISOString(),
            tokenCount: 75
          }
        ],
        messageCount: mockSession.messageCount + 1
      };
      
      element.session = updatedSession;
      await element.updateComplete;
      
      const newMessageCount = element.shadowRoot?.querySelectorAll('.message-item').length || 0;
      expect(newMessageCount).to.equal(initialMessageCount + 1);
    });

    it('should auto-scroll to new messages in real-time', async () => {
      const container = element.shadowRoot?.querySelector('.timeline-container') as HTMLElement;
      const initialScrollTop = container.scrollTop;
      
      // Add new message
      const updatedSession = {
        ...mockSession,
        entries: [
          ...mockSession.entries,
          {
            role: 'assistant',
            content: 'Real-time assistant response',
            timestamp: new Date().toISOString(),
            tokenCount: 100
          }
        ],
        messageCount: mockSession.messageCount + 1
      };
      
      element.session = updatedSession;
      await element.updateComplete;
      
      // Should scroll to show new message if user was at bottom
      expect(container.scrollTop).to.be.greaterThan(initialScrollTop - 10);
    });

    it('should handle message updates without losing scroll position', async () => {
      const container = element.shadowRoot?.querySelector('.timeline-container') as HTMLElement;
      container.scrollTop = 200; // Scroll to middle
      
      // Update existing message
      const updatedEntries = [...mockSession.entries];
      updatedEntries[1] = {
        ...updatedEntries[1],
        content: [
          {
            type: 'text',
            text: 'Updated assistant response with new information'
          }
        ]
      };
      
      const updatedSession = {
        ...mockSession,
        entries: updatedEntries
      };
      
      element.session = updatedSession;
      await element.updateComplete;
      
      // Should maintain scroll position for updates
      expect(container.scrollTop).to.be.approximately(200, 50);
    });
  });

  describe('Accessibility Integration', () => {
    beforeEach(async () => {
      element.session = mockSession;
      await element.updateComplete;
    });

    it('should coordinate ARIA properties across components', () => {
      const main = element.shadowRoot?.querySelector('[role="main"]');
      const timeline = element.shadowRoot?.querySelector('[role="log"]');
      
      expect(main?.getAttribute('aria-label')).to.exist;
      expect(timeline?.getAttribute('aria-label')).to.exist;
      
      // Should have proper hierarchy
      expect(main?.contains(timeline as Node)).to.be.true;
    });

    it('should manage focus across message components', async () => {
      const messageHeaders = element.shadowRoot?.querySelectorAll('.message-header') as NodeListOf<HTMLElement>;
      
      messageHeaders.forEach(header => {
        expect(header.getAttribute('role')).to.equal('button');
        expect(header.getAttribute('tabindex')).to.equal('0');
      });
      
      // Focus should be manageable
      const firstHeader = messageHeaders[0];
      firstHeader.focus();
      expect(document.activeElement).to.equal(firstHeader);
    });

    it('should announce dynamic content changes', async () => {
      // Mock aria-live region
      const liveRegion = element.shadowRoot?.querySelector('[aria-live]');
      
      if (!liveRegion) {
        // Create mock aria-live region for testing
        const mockLiveRegion = document.createElement('div');
        mockLiveRegion.setAttribute('aria-live', 'polite');
        mockLiveRegion.setAttribute('class', 'sr-only');
        element.shadowRoot?.appendChild(mockLiveRegion);
      }
      
      // Expand a message
      const messageHeader = element.shadowRoot?.querySelector('.message-header') as HTMLElement;
      messageHeader.click();
      await element.updateComplete;
      
      // Should have accessibility attributes
      expect(messageHeader.getAttribute('aria-expanded')).to.exist;
    });

    it('should provide keyboard navigation between message actions', async () => {
      // Expand a message to show actions
      const messageHeader = element.shadowRoot?.querySelector('.message-header') as HTMLElement;
      messageHeader.click();
      await element.updateComplete;
      
      const actionButtons = element.shadowRoot?.querySelectorAll('.message-action') as NodeListOf<HTMLElement>;
      
      actionButtons.forEach(button => {
        expect(button.getAttribute('tabindex')).to.not.equal('-1');
        expect(button.getAttribute('aria-label')).to.exist;
      });
    });
  });

  describe('Performance Integration', () => {
    it('should handle large sessions efficiently with all features enabled', async () => {
      const largeSession = {
        ...complexSession,
        messageCount: 500,
        entries: Array.from({ length: 500 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: i % 2 === 0 
            ? `Performance test user message ${i + 1}`
            : [
                {
                  type: 'text',
                  text: `Performance test assistant message ${i + 1}\n\n\`\`\`javascript\nfunction test${i}() {\n  return "test ${i}";\n}\n\`\`\``
                },
                ...(i % 10 === 1 ? [{
                  type: 'tool_use',
                  id: `tool-perf-${i}`,
                  name: 'Read',
                  input: { file_path: `/perf/file-${i}.js` }
                }] : [])
              ],
          timestamp: new Date(Date.now() + i * 30000).toISOString(),
          tokenCount: 50 + Math.floor(Math.random() * 300),
          ...(i % 8 === 1 && { thinking: [`Performance test thinking ${i}`] })
        }))
      };

      element.showThreading = true;
      element.showBranches = true;
      element.virtualScrolling = true;
      
      const startTime = performance.now();
      element.session = largeSession;
      await element.updateComplete;
      const endTime = performance.now();
      
      expect(endTime - startTime).to.be.lessThan(3000); // Should handle 500 messages in under 3 seconds
      
      // Should still render properly
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item');
      expect(messageItems.length).to.be.greaterThan(0);
    });

    it('should optimize re-renders when switching features', async () => {
      element.session = mockSession;
      await element.updateComplete;
      
      const toggles = [
        () => { element.showThreading = !element.showThreading; },
        () => { element.showBranches = !element.showBranches; },
        () => { element.virtualScrolling = !element.virtualScrolling; }
      ];
      
      for (const toggle of toggles) {
        const startTime = performance.now();
        toggle();
        await element.updateComplete;
        const endTime = performance.now();
        
        expect(endTime - startTime).to.be.lessThan(200); // Each toggle should be fast
      }
    });

    it('should maintain performance during rapid message updates', async () => {
      element.session = mockSession;
      element.realTimeUpdates = true;
      await element.updateComplete;
      
      // Simulate rapid message additions
      const updates = Array.from({ length: 20 }, (_, i) => ({
        ...mockSession,
        entries: [
          ...mockSession.entries,
          {
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Rapid update message ${i + 1}`,
            timestamp: new Date(Date.now() + i * 100).toISOString(),
            tokenCount: 50
          }
        ],
        messageCount: mockSession.messageCount + i + 1
      }));
      
      const startTime = performance.now();
      
      for (const update of updates) {
        element.session = update;
        await element.updateComplete;
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).to.be.lessThan(2000); // Should handle 20 rapid updates in under 2 seconds
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from MessageDisplay component errors', async () => {
      // Create session with problematic message
      const problematicSession = {
        ...mockSession,
        entries: [
          ...mockSession.entries,
          {
            role: 'assistant',
            content: null as any, // Intentionally problematic
            timestamp: '2024-01-01T12:00:00Z',
            tokenCount: 0
          }
        ]
      };
      
      element.session = problematicSession;
      await element.updateComplete;
      
      // Should still render other messages
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item');
      expect(messageItems.length).to.be.greaterThan(mockSession.entries.length);
    });

    it('should handle SyntaxHighlighter failures gracefully', async () => {
      element.session = mockSession;
      await element.updateComplete;
      
      // Mock SyntaxHighlighter failure
      const syntaxHighlighters = element.shadowRoot?.querySelectorAll('syntax-highlighter');
      
      syntaxHighlighters?.forEach(highlighter => {
        // Simulate error in syntax highlighter
        highlighter.dispatchEvent(new Event('error'));
      });
      
      // Should continue functioning
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item');
      expect(messageItems.length).to.equal(mockSession.entries.length);
    });

    it('should maintain state consistency across component errors', async () => {
      element.session = mockSession;
      element.showThreading = true;
      element.showBranches = true;
      await element.updateComplete;
      
      // Simulate error during feature toggle
      try {
        // Force an error during update
        const originalUpdate = element.requestUpdate;
        element.requestUpdate = function() {
          throw new Error('Simulated update error');
        };
        
        element.showThreading = false;
      } catch (error) {
        // Error caught, restore original function
        element.requestUpdate = originalUpdate;
      }
      
      // Should maintain previous state
      expect(element.showThreading).to.be.true;
    });
  });
});