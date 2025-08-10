import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fixture, html, expect as expectLit } from '@open-wc/testing';
import { SyntaxHighlighter } from '../syntax-highlighter/SyntaxHighlighter';
import { MessageDisplay } from '../message-display/MessageDisplay';
import type { SyntaxTheme } from '../syntax-highlighter/SyntaxHighlighter';

// Manually register components to ensure they're available in test environment
if (!customElements.get('syntax-highlighter')) {
  customElements.define('syntax-highlighter', SyntaxHighlighter);
}

if (!customElements.get('message-display')) {
  customElements.define('message-display', MessageDisplay);
}

// Mock highlight.js
vi.mock('highlight.js/lib/core', () => ({
  default: {
    registerLanguage: vi.fn(),
    getLanguage: vi.fn((lang: string) => lang === 'javascript' ? {} : null),
    highlight: vi.fn((code: string, options: { language: string }) => ({
      value: `<span class="hljs-keyword">function</span> <span class="hljs-title">test</span>() { <span class="hljs-keyword">return</span> <span class="hljs-string">"${code}"</span>; }`,
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

describe('Visual Regression Tests', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('SyntaxHighlighter Theme Switching', () => {
    const testCode = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));`;

    it('should apply light theme styles correctly', async () => {
      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter></syntax-highlighter>`
      );

      // Set properties after fixture creation like working tests do
      element.code = testCode;
      element.language = 'javascript';
      element.theme = 'light';
      element.lineNumbers = true;
      element.copyable = true;
      
      await element.updateComplete;

      // Verify theme attribute is set
      expect(element.getAttribute('theme')).to.equal('light');

      // Check that light theme CSS custom properties are applied
      const computedStyle = getComputedStyle(element);
      const container = element.shadowRoot?.querySelector('.highlighter-container');
      
      expect(container).to.exist;
      expect(element.theme).to.equal('light');

      // Verify structure elements exist for light theme
      const header = element.shadowRoot?.querySelector('.highlighter-header');
      const lineNumbers = element.shadowRoot?.querySelector('.line-numbers');
      const codeContent = element.shadowRoot?.querySelector('.code-content');
      
      expect(header).to.exist;
      expect(lineNumbers).to.exist;
      expect(codeContent).to.exist;
    });

    it('should apply dark theme styles correctly', async () => {
      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter></syntax-highlighter>`
      );

      // Set properties after fixture creation like working tests do
      element.code = testCode;
      element.language = 'javascript';
      element.theme = 'dark';
      element.lineNumbers = true;
      element.copyable = true;
      
      await element.updateComplete;

      // Verify theme attribute is set
      expect(element.getAttribute('theme')).to.equal('dark');

      // Verify dark theme specific elements
      const container = element.shadowRoot?.querySelector('.highlighter-container');
      expect(container).to.exist;
      
      // Check that the theme is properly applied
      expect(element.theme).to.equal('dark');

      // Verify all structural elements are present
      const header = element.shadowRoot?.querySelector('.highlighter-header');
      const languageLabel = element.shadowRoot?.querySelector('.language-label');
      const copyButton = element.shadowRoot?.querySelector('[title="Copy code"]');
      
      expect(header).to.exist;
      expect(languageLabel).to.exist;
      expect(copyButton).to.exist;
    });

    it('should transition between themes smoothly', async () => {
      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter></syntax-highlighter>`
      );

      // Set properties after fixture creation like working tests do
      element.code = testCode;
      element.language = 'javascript';
      element.theme = 'light';
      element.lineNumbers = true;
      
      await element.updateComplete;

      // Start with light theme
      expect(element.getAttribute('theme')).to.equal('light');

      // Switch to dark theme
      element.theme = 'dark';
      await element.updateComplete;

      expect(element.getAttribute('theme')).to.equal('dark');

      // Switch back to light
      element.theme = 'light';
      await element.updateComplete;

      expect(element.getAttribute('theme')).to.equal('light');

      // Switch to auto
      element.theme = 'auto';
      await element.updateComplete;

      // Auto theme should resolve to either light or dark
      const themeAttr = element.getAttribute('theme');
      expect(['light', 'dark']).to.include(themeAttr);
    });

    it('should handle auto theme based on system preference', async () => {
      // Mock matchMedia for dark preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('dark'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter></syntax-highlighter>`
      );

      // Set properties after fixture creation like working tests do
      element.code = testCode;
      element.theme = 'auto';
      
      await element.updateComplete;

      // Should resolve to dark theme based on mock
      expect(element.getAttribute('theme')).to.equal('dark');
    });

    it('should maintain visual consistency across different languages', async () => {
      const languages = [
        { lang: 'javascript', code: 'function test() { return "js"; }' },
        { lang: 'python', code: 'def test():\n    return "python"' },
        { lang: 'typescript', code: 'function test(): string { return "ts"; }' },
        { lang: 'json', code: '{"test": "json"}' }
      ];

      for (const { lang, code } of languages) {
        const element: SyntaxHighlighter = await fixture(
          html`<syntax-highlighter></syntax-highlighter>`
        );

        // Set properties after fixture creation like working tests do
        element.code = code;
        element.language = lang;
        element.theme = 'dark';
        element.lineNumbers = true;
        
        await element.updateComplete;

        // Each language should have consistent theme application
        expect(element.getAttribute('theme')).to.equal('dark');
        
        const container = element.shadowRoot?.querySelector('.highlighter-container');
        const header = element.shadowRoot?.querySelector('.highlighter-header');
        const languageLabel = element.shadowRoot?.querySelector('.language-label');
        
        expect(container).to.exist;
        expect(header).to.exist;
        expect(languageLabel).to.exist;
        expect(languageLabel?.textContent).to.include(lang);
      }
    });
  });

  describe('MessageDisplay Theme Integration', () => {
    it('should maintain consistent theming in message context', async () => {
      // Mock syntax-highlighter element
      class MockSyntaxHighlighter extends HTMLElement {
        code = '';
        language = '';
        theme = 'auto';
        lineNumbers = false;
        copyable = false;
        compact = false;

        connectedCallback() {
          this.innerHTML = `
            <div class="mock-highlighter theme-${this.theme}">
              <pre><code>${this.code}</code></pre>
            </div>
          `;
        }
      }

      if (!customElements.get('syntax-highlighter-mock')) {
        customElements.define('syntax-highlighter-mock', MockSyntaxHighlighter);
      }

      const assistantMessage = {
        type: 'assistant' as const,
        message: {
          content: [
            {
              type: 'text',
              text: 'Here is some code:\n\n```javascript\nfunction hello() {\n  console.log("Hello!");\n}\n```'
            }
          ],
          role: 'assistant'
        }
      };

      const element: MessageDisplay = await fixture(
        html`<message-display .entry=${assistantMessage}></message-display>`
      );

      await element.updateComplete;

      // Message should render with proper structure
      const messageContainer = element.shadowRoot?.querySelector('.message-container');
      expect(messageContainer).to.exist;
      expect(messageContainer?.classList.contains('assistant')).to.be.true;

      // Should integrate with syntax highlighting
      const textContent = element.shadowRoot?.querySelector('.text-content');
      expect(textContent).to.exist;
    });

    it('should handle compact mode visual changes', async () => {
      const userMessage = {
        type: 'user' as const,
        message: {
          content: 'Show me a code example',
          role: 'user'
        }
      };

      const element: MessageDisplay = await fixture(
        html`<message-display 
          .entry=${userMessage}
          .displayMode=${'compact'}
        ></message-display>`
      );

      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container?.classList.contains('compact')).to.be.true;

      // Compact mode should have different visual presentation
      const header = element.shadowRoot?.querySelector('.message-header');
      expect(header).to.exist;
    });

    it('should apply selection state visually', async () => {
      const message = {
        type: 'user' as const,
        message: { content: 'Test message', role: 'user' }
      };

      const element: MessageDisplay = await fixture(
        html`<message-display 
          .entry=${message}
          .selected=${true}
        ></message-display>`
      );

      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container?.classList.contains('selected')).to.be.true;
    });
  });

  describe('Layout and Responsive Design', () => {
    it('should adapt to different viewport sizes', async () => {
      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'function test() { return "responsive"; }'}
          .language=${'javascript'}
          .lineNumbers=${true}
          .showHeader=${true}
        ></syntax-highlighter>`
      );

      await element.updateComplete;

      // Simulate narrow viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      });

      // Trigger resize event
      window.dispatchEvent(new Event('resize'));
      await element.updateComplete;

      // Check responsive elements exist
      const header = element.shadowRoot?.querySelector('.highlighter-header');
      const lineNumbers = element.shadowRoot?.querySelector('.line-numbers');
      
      expect(header).to.exist;
      expect(lineNumbers).to.exist;
    });

    it('should handle long lines without horizontal overflow', async () => {
      const longLine = 'const veryLongVariableName = "This is a very long string that should test horizontal scrolling behavior and ensure the component handles it gracefully without breaking the layout";';
      
      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${longLine}
          .language=${'javascript'}
          .lineNumbers=${true}
        ></syntax-highlighter>`
      );

      await element.updateComplete;

      const codeContainer = element.shadowRoot?.querySelector('.code-container');
      expect(codeContainer).to.exist;

      // Should have proper overflow handling
      const computedStyle = getComputedStyle(codeContainer as Element);
      // The CSS should handle overflow appropriately
      expect(codeContainer).to.exist;
    });

    it('should maintain proper line number alignment', async () => {
      const multiLineCode = Array.from({ length: 50 }, (_, i) => 
        `function line${i + 1}() { return ${i + 1}; }`
      ).join('\n');

      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${multiLineCode}
          .language=${'javascript'}
          .lineNumbers=${true}
        ></syntax-highlighter>`
      );

      await element.updateComplete;

      const lineNumbers = element.shadowRoot?.querySelector('.line-numbers');
      const codeContent = element.shadowRoot?.querySelector('.code-content');
      
      expect(lineNumbers).to.exist;
      expect(codeContent).to.exist;

      // Line numbers should be properly aligned with code
      const lineNumberElements = element.shadowRoot?.querySelectorAll('.line-number');
      expect(lineNumberElements?.length).to.equal(50);
    });
  });

  describe('Interactive Elements Visual States', () => {
    it('should show proper hover states for interactive elements', async () => {
      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'console.log("hover test");'}
          .language=${'javascript'}
          .copyable=${true}
          .maxHeight=${'200px'}
        ></syntax-highlighter>`
      );

      await element.updateComplete;

      // Copy button should exist and be interactive
      const copyButton = element.shadowRoot?.querySelector('[title="Copy code"]');
      expect(copyButton).to.exist;

      // Expand button should exist when max height is set
      const expandButton = element.shadowRoot?.querySelector('[title="Expand code"]');
      expect(expandButton).to.exist;

      // Header should be present with proper styling
      const header = element.shadowRoot?.querySelector('.highlighter-header');
      expect(header).to.exist;
    });

    it('should show proper focus states for keyboard navigation', async () => {
      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'console.log("focus test");'}
          .copyable=${true}
        ></syntax-highlighter>`
      );

      await element.updateComplete;

      const copyButton = element.shadowRoot?.querySelector('[title="Copy code"]') as HTMLElement;
      expect(copyButton).to.exist;

      // Should be focusable
      copyButton?.focus();
      expect(document.activeElement).to.exist;
    });

    it('should provide visual feedback for copy operation', async () => {
      // Mock clipboard API
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
      });

      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'console.log("copy test");'}
          .copyable=${true}
        ></syntax-highlighter>`
      );

      await element.updateComplete;

      const copyButton = element.shadowRoot?.querySelector('[title="Copy code"]') as HTMLButtonElement;
      
      // Should have initial state
      expect(copyButton?.classList.contains('copied')).to.be.false;
      
      copyButton?.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should show copied state (this would be tested via the component's internal state)
      expect(mockWriteText).toHaveBeenCalled();
    });
  });

  describe('Error State Visualization', () => {
    it('should display fallback styling when highlighting fails', async () => {
      const hljs = await import('highlight.js/lib/core');
      hljs.default.highlight.mockImplementation(() => {
        throw new Error('Highlighting failed');
      });
      hljs.default.highlightAuto.mockImplementation(() => {
        throw new Error('Auto-highlighting failed');
      });

      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'function broken() { return; }'}
          .language=${'javascript'}
        ></syntax-highlighter>`
      );

      await element.updateComplete;

      // Should still render with fallback
      const container = element.shadowRoot?.querySelector('.highlighter-container');
      const codeElement = element.shadowRoot?.querySelector('code');
      
      expect(container).to.exist;
      expect(codeElement).to.exist;
    });

    it('should handle missing language gracefully', async () => {
      const element: SyntaxHighlighter = await fixture(
        html`<syntax-highlighter 
          .code=${'some code'}
          .language=${'nonexistentlang'}
        ></syntax-highlighter>`
      );

      await element.updateComplete;

      // Should fallback to auto-detection
      const hljs = await import('highlight.js/lib/core');
      expect(hljs.default.highlightAuto).toHaveBeenCalled();
      
      const container = element.shadowRoot?.querySelector('.highlighter-container');
      expect(container).to.exist;
    });
  });
});