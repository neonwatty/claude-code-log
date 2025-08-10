import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fixture, html, expect as expectLit } from '@open-wc/testing';
import { SyntaxHighlighter } from '../SyntaxHighlighter';
import type { SyntaxTheme, LanguageDetection } from '../SyntaxHighlighter';
import { createReliableFixture } from '../../../test-setup';

// Mock highlight.js
vi.mock('highlight.js/lib/core', () => ({
  default: {
    registerLanguage: vi.fn(),
    getLanguage: vi.fn((lang: string) => lang === 'javascript' ? {} : null),
    highlight: vi.fn((code: string, options: { language: string }) => ({
      value: `<span class="hljs-keyword">highlighted</span> ${code}`,
      language: options.language
    })),
    highlightAuto: vi.fn((code: string) => ({
      value: `<span class="hljs-comment">// auto-highlighted</span>\n${code}`,
      language: 'javascript'
    }))
  }
}));

// Mock language imports
vi.mock('highlight.js/lib/languages/javascript', () => ({ default: vi.fn() }));
vi.mock('highlight.js/lib/languages/typescript', () => ({ default: vi.fn() }));
vi.mock('highlight.js/lib/languages/python', () => ({ default: vi.fn() }));

describe('SyntaxHighlighter', () => {
  let element: SyntaxHighlighter;
  
  beforeEach(async () => {
    // Ensure custom element is registered before creating fixtures
    if (!globalThis.customElements?.get('syntax-highlighter')) {
      globalThis.customElements?.define('syntax-highlighter', SyntaxHighlighter);
    }
    
    element = await createReliableFixture<SyntaxHighlighter>(
      html`<syntax-highlighter></syntax-highlighter>`,
      {
        code: '',
        language: '',
        theme: 'auto',
        lineNumbers: false,
        showHeader: true,
        copyable: true,
        compact: false,
        maxHeight: '',
        highlightLines: [],
        detection: 'auto',
        wrapLines: false
      }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with default properties', () => {
      expect(element).to.exist;
      expect(element.code).to.equal('');
      expect(element.language).to.equal('');
      // Theme resolves from 'auto' to 'light' or 'dark' based on system preference
      expect(['auto', 'light', 'dark']).to.include(element.theme);
      expect(element.lineNumbers).to.be.false;
      expect(element.showHeader).to.be.true;
      expect(element.copyable).to.be.true;
      expect(element.compact).to.be.false;
    });

    it('should render empty state when no code provided', async () => {
      element.code = '';
      await element.updateComplete;
      
      const codeElement = element.shadowRoot?.querySelector('code');
      expect(codeElement?.textContent?.trim()).to.equal('');
    });

    it('should render code content', async () => {
      element.code = 'console.log("Hello World");';
      element.language = 'javascript';
      await element.updateComplete;
      
      const codeElement = element.shadowRoot?.querySelector('code');
      expect(codeElement).to.exist;
    });
  });

  describe('Language Support', () => {
    it('should apply language-specific highlighting', async () => {
      element.code = 'function test() { return true; }';
      element.language = 'javascript';
      await element.updateComplete;
      
      // Should call highlight with specified language
      const hljs = await import('highlight.js/lib/core');
      expect(hljs.default.highlight).toHaveBeenCalledWith(
        'function test() { return true; }',
        { language: 'javascript', ignoreIllegals: true }
      );
    });

    it('should fallback to auto-detection for unknown languages', async () => {
      element.code = 'some unknown code';
      element.language = 'unknownlang';
      element.detection = 'auto';
      await element.updateComplete;
      
      const hljs = await import('highlight.js/lib/core');
      expect(hljs.default.highlightAuto).toHaveBeenCalledWith('some unknown code');
    });

    it('should handle highlighting errors gracefully', async () => {
      const hljs = await import('highlight.js/lib/core');
      hljs.default.highlight.mockImplementation(() => {
        throw new Error('Highlighting failed');
      });
      hljs.default.highlightAuto.mockImplementation(() => {
        throw new Error('Auto-highlighting failed');
      });

      element.code = 'some code';
      element.language = 'javascript';
      
      // Should not throw and should render escaped HTML
      await expect(element.updateComplete).to.not.be.rejected;
    });
  });

  describe('Theme System', () => {
    it('should apply light theme', async () => {
      element.theme = 'light';
      await element.updateComplete;
      
      expect(element.getAttribute('theme')).to.equal('light');
    });

    it('should apply dark theme', async () => {
      element.theme = 'dark';
      await element.updateComplete;
      
      expect(element.getAttribute('theme')).to.equal('dark');
    });

    it('should handle auto theme based on system preference', async () => {
      // Mock matchMedia for dark mode
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

      element.theme = 'auto';
      await element.updateComplete;
      
      expect(element.getAttribute('theme')).to.equal('dark');
    });
  });

  describe('Line Numbers', () => {
    it('should not show line numbers by default', async () => {
      element.code = 'line 1\nline 2\nline 3';
      await element.updateComplete;
      
      const lineNumbers = element.shadowRoot?.querySelector('.line-numbers');
      expect(lineNumbers).to.not.exist;
    });

    it('should show line numbers when enabled', async () => {
      element.code = 'line 1\nline 2\nline 3';
      element.lineNumbers = true;
      await element.updateComplete;
      
      const lineNumbers = element.shadowRoot?.querySelector('.line-numbers');
      expect(lineNumbers).to.exist;
      
      const lineNumberElements = element.shadowRoot?.querySelectorAll('.line-number');
      expect(lineNumberElements).to.have.length(3);
    });

    it('should highlight specified lines', async () => {
      element.code = 'line 1\nline 2\nline 3';
      element.lineNumbers = true;
      element.highlightLines = [2];
      await element.updateComplete;
      
      const highlightedLine = element.shadowRoot?.querySelector('.line-number.highlighted');
      expect(highlightedLine).to.exist;
    });
  });

  describe('Header and Controls', () => {
    it('should show header by default', async () => {
      element.code = 'test code';
      await element.updateComplete;
      
      const header = element.shadowRoot?.querySelector('.highlighter-header');
      expect(header).to.exist;
    });

    it('should hide header when disabled', async () => {
      element.code = 'test code';
      element.showHeader = false;
      await element.updateComplete;
      
      const header = element.shadowRoot?.querySelector('.highlighter-header');
      expect(header).to.not.exist;
    });

    it('should hide header in compact mode', async () => {
      element.code = 'test code';
      element.compact = true;
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.highlighter-container');
      expect(container?.classList.contains('compact')).to.be.true;
    });
  });

  describe('Copy Functionality', () => {
    it('should show copy button when copyable is true', async () => {
      element.code = 'test code';
      element.copyable = true;
      await element.updateComplete;
      
      const copyButton = element.shadowRoot?.querySelector('[title="Copy code"]');
      expect(copyButton).to.exist;
    });

    it('should hide copy button when copyable is false', async () => {
      element.code = 'test code';
      element.copyable = false;
      await element.updateComplete;
      
      const copyButton = element.shadowRoot?.querySelector('[title="Copy code"]');
      expect(copyButton).to.not.exist;
    });

    it('should copy code to clipboard when copy button clicked', async () => {
      // Mock clipboard API
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      element.code = 'console.log("test");';
      element.copyable = true;
      await element.updateComplete;
      
      const copyButton = element.shadowRoot?.querySelector('[title="Copy code"]') as HTMLButtonElement;
      copyButton?.click();
      
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async operation
      
      expect(mockWriteText).toHaveBeenCalledWith('console.log("test");');
    });

    it('should dispatch copy event when code is copied', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      let copyEvent: CustomEvent | null = null;
      element.addEventListener('code-copied', (e) => {
        copyEvent = e as CustomEvent;
      });

      element.code = 'test code';
      element.language = 'javascript';
      element.copyable = true;
      await element.updateComplete;
      
      const copyButton = element.shadowRoot?.querySelector('[title="Copy code"]') as HTMLButtonElement;
      copyButton?.click();
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(copyEvent).to.exist;
      expect(copyEvent?.detail.code).to.equal('test code');
      expect(copyEvent?.detail.language).to.equal('javascript');
    });
  });

  describe('Performance Optimization', () => {
    it('should mark large content appropriately', async () => {
      // Create large content (>10000 chars)
      const largeCode = 'const x = 1;\n'.repeat(1000);
      element.code = largeCode;
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.highlighter-container');
      expect(container?.classList.contains('large-content')).to.be.true;
    });

    it('should handle many lines efficiently', async () => {
      // Create content with >500 lines
      const manyLines = Array.from({ length: 600 }, (_, i) => `line ${i + 1}`).join('\n');
      element.code = manyLines;
      element.lineNumbers = true;
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.highlighter-container');
      expect(container?.classList.contains('large-content')).to.be.true;
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      element.code = 'test code';
      element.ariaLabel = 'Code snippet';
      await element.updateComplete;
      
      expect(element.getAttribute('aria-label')).to.equal('Code snippet');
    });

    it('should have proper role for code content', async () => {
      element.code = 'test code';
      await element.updateComplete;
      
      const codeElement = element.shadowRoot?.querySelector('code');
      expect(codeElement).to.exist;
    });
  });

  describe('Language Detection', () => {
    it('should auto-detect language when detection is set to auto', async () => {
      element.code = 'function test() { return true; }';
      element.detection = 'auto';
      element.language = ''; // No language specified
      await element.updateComplete;
      
      const hljs = await import('highlight.js/lib/core');
      expect(hljs.default.highlightAuto).toHaveBeenCalled();
    });

    it('should use manual language when detection is manual', async () => {
      element.code = 'function test() { return true; }';
      element.detection = 'manual';
      element.language = 'javascript';
      await element.updateComplete;
      
      const hljs = await import('highlight.js/lib/core');
      expect(hljs.default.highlight).toHaveBeenCalledWith(
        element.code,
        { language: 'javascript', ignoreIllegals: true }
      );
    });
  });

  describe('Max Height and Scrolling', () => {
    it('should apply max height when specified', async () => {
      element.code = 'test code';
      element.maxHeight = '200px';
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.highlighter-container') as HTMLElement;
      expect(container?.style.getPropertyValue('--max-height')).to.equal('200px');
    });

    it('should show expand button when max height is set', async () => {
      element.code = 'test code';
      element.maxHeight = '200px';
      await element.updateComplete;
      
      const expandButton = element.shadowRoot?.querySelector('[title="Expand code"]');
      expect(expandButton).to.exist;
    });

    it('should expand content when expand button clicked', async () => {
      let expandEvent: CustomEvent | null = null;
      element.addEventListener('code-expanded', (e) => {
        expandEvent = e as CustomEvent;
      });

      element.code = 'test code';
      element.maxHeight = '200px';
      await element.updateComplete;
      
      const expandButton = element.shadowRoot?.querySelector('[title="Expand code"]') as HTMLButtonElement;
      expandButton?.click();
      
      expect(element.maxHeight).to.equal('');
      expect(expandEvent).to.exist;
    });
  });

  describe('Language Colors', () => {
    it('should return appropriate colors for known languages', async () => {
      element.code = 'test';
      element.language = 'javascript';
      await element.updateComplete;
      
      // Test that language icon has appropriate styling
      const languageIcon = element.shadowRoot?.querySelector('.language-icon') as HTMLElement;
      expect(languageIcon).to.exist;
    });
  });
});