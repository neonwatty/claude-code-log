import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fixture, html, expect as expectLit } from '@open-wc/testing';
import { MessageDisplay } from '../message-display/MessageDisplay';
import { SyntaxHighlighter } from '../syntax-highlighter/SyntaxHighlighter';

// Mock highlight.js
vi.mock('highlight.js/lib/core', () => ({
  default: {
    registerLanguage: vi.fn(),
    getLanguage: vi.fn((lang: string) => lang === 'javascript' ? {} : null),
    highlight: vi.fn((code: string, options: { language: string }) => ({
      value: `<span class="hljs-keyword">function</span> <span class="hljs-title">${code}</span>`,
      language: options.language
    })),
    highlightAuto: vi.fn((code: string) => ({
      value: `<span class="hljs-comment">// ${code}</span>`,
      language: 'javascript'
    }))
  }
}));

// Mock language imports
vi.mock('highlight.js/lib/languages/javascript', () => ({ default: vi.fn() }));
vi.mock('highlight.js/lib/languages/typescript', () => ({ default: vi.fn() }));

// Mock marked
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn((text: string) => {
      if (text.includes('```')) {
        // Return HTML with code blocks
        return text.replace(/```(\w+)\n(.*?)\n```/gs, '<pre><code class="language-$1">$2</code></pre>');
      }
      return `<p>${text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    })
  }
}));

// Mock SyntaxHighlighter custom element
class MockSyntaxHighlighter extends HTMLElement {
  code = '';
  language = '';
  lineNumbers = false;
  copyable = false;
  compact = false;
  theme = 'auto';

  connectedCallback() {
    this.innerHTML = `<div class="mock-syntax-highlighter">
      <pre><code class="language-${this.language}">${this.code}</code></pre>
    </div>`;
  }
}

// Only define if not already defined
if (!customElements.get('syntax-highlighter')) {
  customElements.define('syntax-highlighter', MockSyntaxHighlighter);
}

describe('Component Integration Tests', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('MessageDisplay + SyntaxHighlighter Integration', () => {
    it('should integrate SyntaxHighlighter for code content', async () => {
      const assistantEntry = {
        type: 'assistant' as const,
        timestamp: new Date().toISOString(),
        message: {
          content: [
            {
              type: 'text',
              text: '```javascript\nfunction hello() {\n  console.log("Hello World");\n}\n```'
            }
          ],
          role: 'assistant'
        }
      };

      const element: MessageDisplay = await fixture(
        html`<message-display .entry=${assistantEntry}></message-display>`
      );

      await element.updateComplete;

      // Should use syntax-highlighter component instead of basic highlighting
      const syntaxHighlighter = element.shadowRoot?.querySelector('syntax-highlighter');
      expect(syntaxHighlighter).to.exist;
    });

    it('should pass correct properties to SyntaxHighlighter', async () => {
      const codeBlock = 'function test() { return 42; }';
      const assistantEntry = {
        type: 'assistant' as const,
        message: {
          content: [
            {
              type: 'text',
              text: `\`\`\`typescript\n${codeBlock}\n\`\`\``
            }
          ],
          role: 'assistant'
        }
      };

      const element: MessageDisplay = await fixture(
        html`<message-display .entry=${assistantEntry}></message-display>`
      );

      await element.updateComplete;

      const syntaxHighlighter = element.shadowRoot?.querySelector('syntax-highlighter') as any;
      expect(syntaxHighlighter).to.exist;
      expect(syntaxHighlighter.code).to.equal(codeBlock);
      expect(syntaxHighlighter.language).to.equal('typescript');
      expect(syntaxHighlighter.lineNumbers).to.be.true;
      expect(syntaxHighlighter.copyable).to.be.true;
      expect(syntaxHighlighter.theme).to.equal('auto');
    });

    it('should handle multiple code blocks in a single message', async () => {
      const assistantEntry = {
        type: 'assistant' as const,
        message: {
          content: [
            {
              type: 'text',
              text: 'Here are two examples:\n\n```javascript\nconsole.log("JS");\n```\n\nAnd:\n\n```python\nprint("Python")\n```'
            }
          ],
          role: 'assistant'
        }
      };

      const element: MessageDisplay = await fixture(
        html`<message-display .entry=${assistantEntry}></message-display>`
      );

      await element.updateComplete;

      const syntaxHighlighters = element.shadowRoot?.querySelectorAll('syntax-highlighter');
      expect(syntaxHighlighters?.length).to.be.greaterThan(0);
    });

    it('should handle mixed content with code and text', async () => {
      const assistantEntry = {
        type: 'assistant' as const,
        message: {
          content: [
            {
              type: 'text',
              text: 'Here is some **bold text** and a code example:\n\n```javascript\nconst x = 42;\n```\n\nAnd more text after.'
            }
          ],
          role: 'assistant'
        }
      };

      const element: MessageDisplay = await fixture(
        html`<message-display .entry=${assistantEntry}></message-display>`
      );

      await element.updateComplete;

      // Should have both markdown processing and syntax highlighting
      const textContent = element.shadowRoot?.querySelector('.text-content');
      expect(textContent).to.exist;
      
      const syntaxHighlighter = element.shadowRoot?.querySelector('syntax-highlighter');
      expect(syntaxHighlighter).to.exist;
    });
  });

  describe('Theme Consistency', () => {
    it('should maintain consistent theming across components', async () => {
      const syntaxHighlighter: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'console.log("test");'} 
          .language=${'javascript'}
          theme="dark"
        ></syntax-highlighter>`
      );

      await syntaxHighlighter.updateComplete;

      expect(syntaxHighlighter.getAttribute('theme')).to.equal('dark');
    });

    it('should handle theme changes dynamically', async () => {
      const syntaxHighlighter: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'console.log("test");'} 
          .language=${'javascript'}
          theme="light"
        ></syntax-highlighter>`
      );

      await syntaxHighlighter.updateComplete;
      expect(syntaxHighlighter.getAttribute('theme')).to.equal('light');

      // Change theme
      syntaxHighlighter.theme = 'dark';
      await syntaxHighlighter.updateComplete;
      expect(syntaxHighlighter.getAttribute('theme')).to.equal('dark');
    });

    it('should respect system theme preferences for auto mode', async () => {
      // Mock matchMedia for light mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: !query.includes('dark'), // Light mode
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const syntaxHighlighter: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'console.log("test");'} 
          theme="auto"
        ></syntax-highlighter>`
      );

      await syntaxHighlighter.updateComplete;

      expect(syntaxHighlighter.getAttribute('theme')).to.equal('light');
    });
  });

  describe('Performance Integration', () => {
    it('should handle large content efficiently across components', async () => {
      const largeCode = 'console.log("line");'.repeat(1000);
      const largeMessage = {
        type: 'assistant' as const,
        message: {
          content: [
            {
              type: 'text',
              text: `Here's a large code block:\n\n\`\`\`javascript\n${largeCode}\n\`\`\``
            }
          ],
          role: 'assistant'
        }
      };

      const startTime = performance.now();
      
      const element: MessageDisplay = await fixture(
        html`<message-display .entry=${largeMessage}></message-display>`
      );
      
      await element.updateComplete;
      
      const endTime = performance.now();
      
      // Should render in reasonable time (less than 1 second)
      expect(endTime - startTime).to.be.lessThan(1000);
      
      const syntaxHighlighter = element.shadowRoot?.querySelector('syntax-highlighter') as any;
      expect(syntaxHighlighter).to.exist;
      
      // Large content should be marked appropriately
      const container = syntaxHighlighter.shadowRoot?.querySelector('.highlighter-container');
      expect(container?.classList.contains('large-content')).to.be.true;
    });

    it('should optimize rendering for multiple code blocks', async () => {
      const multipleCodeBlocks = Array.from({ length: 10 }, (_, i) => 
        `\`\`\`javascript\nfunction test${i}() { return ${i}; }\n\`\`\``
      ).join('\n\n');

      const message = {
        type: 'assistant' as const,
        message: {
          content: [{ type: 'text', text: multipleCodeBlocks }],
          role: 'assistant'
        }
      };

      const startTime = performance.now();
      
      const element: MessageDisplay = await fixture(
        html`<message-display .entry=${message}></message-display>`
      );
      
      await element.updateComplete;
      
      const endTime = performance.now();
      
      // Should handle multiple blocks efficiently
      expect(endTime - startTime).to.be.lessThan(2000);
      
      const syntaxHighlighters = element.shadowRoot?.querySelectorAll('syntax-highlighter');
      expect(syntaxHighlighters?.length).to.be.greaterThan(1);
    });
  });

  describe('Accessibility Integration', () => {
    it('should maintain accessibility across integrated components', async () => {
      const assistantEntry = {
        type: 'assistant' as const,
        message: {
          content: [
            {
              type: 'text',
              text: '```javascript\n// This is a test function\nfunction test() {\n  return "hello";\n}\n```'
            }
          ],
          role: 'assistant'
        }
      };

      const element: MessageDisplay = await fixture(
        html`<message-display .entry=${assistantEntry}></message-display>`
      );

      await element.updateComplete;

      // Message display should have proper structure
      const messageContainer = element.shadowRoot?.querySelector('.message-container');
      expect(messageContainer).to.exist;
      
      // Syntax highlighter should be accessible
      const syntaxHighlighter = element.shadowRoot?.querySelector('syntax-highlighter');
      expect(syntaxHighlighter).to.exist;
      
      // Should have proper semantic structure
      const codeElement = element.shadowRoot?.querySelector('code');
      expect(codeElement).to.exist;
    });

    it('should support keyboard navigation across components', async () => {
      const syntaxHighlighter: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'console.log("test");'} 
          .language=${'javascript'}
          .copyable=${true}
        ></syntax-highlighter>`
      );

      await syntaxHighlighter.updateComplete;

      const copyButton = syntaxHighlighter.shadowRoot?.querySelector('[title="Copy code"]') as HTMLElement;
      expect(copyButton).to.exist;
      expect(copyButton.tabIndex).to.not.equal(-1); // Should be keyboard accessible
    });
  });

  describe('Error Handling Integration', () => {
    it('should gracefully handle highlighting errors in integrated context', async () => {
      const hljs = await import('highlight.js/lib/core');
      hljs.default.highlight.mockImplementation(() => {
        throw new Error('Highlighting failed');
      });
      hljs.default.highlightAuto.mockImplementation(() => {
        throw new Error('Auto-highlighting failed');
      });

      const message = {
        type: 'assistant' as const,
        message: {
          content: [
            {
              type: 'text',
              text: '```javascript\nfunction broken() { return; }\n```'
            }
          ],
          role: 'assistant'
        }
      };

      const element: MessageDisplay = await fixture(
        html`<message-display .entry=${message}></message-display>`
      );

      // Should not throw and should render fallback
      await expect(element.updateComplete).to.not.be.rejected;
      
      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container).to.exist;
    });

    it('should handle malformed markdown with code blocks', async () => {
      const marked = await import('marked');
      marked.marked.parse.mockImplementation(() => {
        throw new Error('Markdown parsing failed');
      });

      const message = {
        type: 'assistant' as const,
        message: {
          content: [
            {
              type: 'text',
              text: '```javascript\nconsole.log("test");\n```'
            }
          ],
          role: 'assistant'
        }
      };

      const element: MessageDisplay = await fixture(
        html`<message-display .entry=${message}></message-display>`
      );

      // Should fallback to basic processing
      await expect(element.updateComplete).to.not.be.rejected;
    });
  });

  describe('Event Integration', () => {
    it('should properly handle copy events from SyntaxHighlighter', async () => {
      // Mock clipboard API
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      let copyEventFired = false;
      let copyEventDetail: any = null;

      const syntaxHighlighter: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'console.log("test");'} 
          .language=${'javascript'}
          .copyable=${true}
          @code-copied=${(e: CustomEvent) => {
            copyEventFired = true;
            copyEventDetail = e.detail;
          }}
        ></syntax-highlighter>`
      );

      await syntaxHighlighter.updateComplete;

      const copyButton = syntaxHighlighter.shadowRoot?.querySelector('[title="Copy code"]') as HTMLButtonElement;
      copyButton?.click();

      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async operation

      expect(copyEventFired).to.be.true;
      expect(copyEventDetail.code).to.equal('console.log("test");');
      expect(copyEventDetail.language).to.equal('javascript');
    });

    it('should handle expand events from SyntaxHighlighter', async () => {
      let expandEventFired = false;

      const syntaxHighlighter: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'console.log("test");'} 
          .maxHeight=${'200px'}
          @code-expanded=${() => {
            expandEventFired = true;
          }}
        ></syntax-highlighter>`
      );

      await syntaxHighlighter.updateComplete;

      const expandButton = syntaxHighlighter.shadowRoot?.querySelector('[title="Expand code"]') as HTMLButtonElement;
      expandButton?.click();

      expect(expandEventFired).to.be.true;
      expect(syntaxHighlighter.maxHeight).to.equal('');
    });
  });
});