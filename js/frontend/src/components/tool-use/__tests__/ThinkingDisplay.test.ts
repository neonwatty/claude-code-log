import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fixture, html, expect as expectLit } from '@open-wc/testing';
import { ThinkingDisplay } from '../ThinkingDisplay';
import { createReliableFixture, ensureComponentProperties } from '../../../test-setup';

// Mock shared types
type ThinkingContent = {
  type: 'thinking';
  thinking: string;
  signature?: string;
};

describe('ThinkingDisplay', () => {
  let element: ThinkingDisplay;

  beforeEach(async () => {
    // Ensure custom element is registered before creating fixtures
    if (!globalThis.customElements?.get('thinking-display')) {
      globalThis.customElements?.define('thinking-display', ThinkingDisplay);
    }
    
    element = await createReliableFixture<ThinkingDisplay>(
      html`<thinking-display></thinking-display>`,
      {
        collapsible: true,
        defaultCollapsed: true,
        compact: false,
        truncateThreshold: 500
      }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with default properties', () => {
      expect(element).to.exist;
      console.log('collapsible:', element.collapsible);
      console.log('defaultCollapsed:', element.defaultCollapsed);
      console.log('compact:', element.compact);
      console.log('truncateThreshold:', element.truncateThreshold);
      expect(element.collapsible).to.be.true;
      expect(element.defaultCollapsed).to.be.true;
      expect(element.compact).to.be.false;
      expect(element.truncateThreshold).to.equal(500);
    });

    it('should render empty state when no thinking content provided', async () => {
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.thinking-container');
      expect(container).to.not.exist;
    });

    it('should render thinking content', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Let me think about this step by step. First, I need to understand the problem...'
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.thinking-container');
      expect(container).to.exist;
      
      const content = element.shadowRoot?.querySelector('.thinking-text');
      expect(content?.textContent).to.include('Let me think about this');
    });
  });

  describe('Content Truncation', () => {
    it('should not truncate short content', async () => {
      const shortThinking = 'This is a short thought.';
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: shortThinking
      };

      element.thinkingContent = thinkingContent;
      element.truncateThreshold = 100;
      await element.updateComplete;

      const content = element.shadowRoot?.querySelector('.thinking-text');
      expect(content?.textContent).to.equal(shortThinking);
      
      const expandButton = element.shadowRoot?.querySelector('.expand-text-btn');
      expect(expandButton).to.not.exist;
    });

    it('should truncate long content', async () => {
      const longThinking = 'A'.repeat(1000); // 1000 characters
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: longThinking
      };

      element.thinkingContent = thinkingContent;
      element.truncateThreshold = 500;
      await element.updateComplete;

      const content = element.shadowRoot?.querySelector('.thinking-text');
      const displayedText = content?.textContent || '';
      
      // Should be truncated
      expect(displayedText.length).to.be.lessThan(longThinking.length);
      expect(displayedText).to.include('...');
      
      const expandButton = element.shadowRoot?.querySelector('.expand-text-btn');
      expect(expandButton).to.exist;
      expect(expandButton?.textContent).to.include('Show more');
    });

    it('should expand truncated content when expand button clicked', async () => {
      const longThinking = 'This is a very long thinking process. '.repeat(50);
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: longThinking
      };

      element.thinkingContent = thinkingContent;
      element.truncateThreshold = 100;
      await element.updateComplete;

      // Initially truncated
      let content = element.shadowRoot?.querySelector('.thinking-text');
      let displayedText = content?.textContent || '';
      expect(displayedText).to.include('...');

      // Click expand button
      const expandButton = element.shadowRoot?.querySelector('.expand-text-btn') as HTMLButtonElement;
      expandButton?.click();
      await element.updateComplete;

      // Should now show full content
      content = element.shadowRoot?.querySelector('.thinking-text');
      displayedText = content?.textContent || '';
      expect(displayedText).to.equal(longThinking);

      // Button should now say "Show less"
      const collapseButton = element.shadowRoot?.querySelector('.expand-text-btn');
      expect(collapseButton?.textContent).to.include('Show less');
    });

    it('should collapse expanded content when collapse button clicked', async () => {
      const longThinking = 'This is a very long thinking process. '.repeat(50);
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: longThinking
      };

      element.thinkingContent = thinkingContent;
      element.truncateThreshold = 100;
      await element.updateComplete;

      // Expand first
      const expandButton = element.shadowRoot?.querySelector('.expand-text-btn') as HTMLButtonElement;
      expandButton?.click();
      await element.updateComplete;

      // Then collapse
      const collapseButton = element.shadowRoot?.querySelector('.expand-text-btn') as HTMLButtonElement;
      collapseButton?.click();
      await element.updateComplete;

      // Should be truncated again
      const content = element.shadowRoot?.querySelector('.thinking-text');
      const displayedText = content?.textContent || '';
      expect(displayedText).to.include('...');
    });

    it('should respect custom truncate threshold', async () => {
      const mediumThinking = 'A'.repeat(300);
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: mediumThinking
      };

      element.thinkingContent = thinkingContent;
      element.truncateThreshold = 200;
      await element.updateComplete;

      const expandButton = element.shadowRoot?.querySelector('.expand-text-btn');
      expect(expandButton).to.exist; // Should be truncated at 200 chars

      // Change threshold
      element.truncateThreshold = 400;
      await element.updateComplete;

      const expandButton2 = element.shadowRoot?.querySelector('.expand-text-btn');
      expect(expandButton2).to.not.exist; // Should not be truncated at 400 chars
    });
  });

  describe('Word Count Display', () => {
    it('should display word count', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'This is exactly five words here.'
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const wordCount = element.shadowRoot?.querySelector('.word-count');
      expect(wordCount).to.exist;
      expect(wordCount?.textContent).to.include('6 words'); // "This is exactly five words here" = 6 words
    });

    it('should handle empty content for word count', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: ''
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const wordCount = element.shadowRoot?.querySelector('.word-count');
      expect(wordCount?.textContent).to.include('0 words');
    });

    it('should count words correctly with punctuation', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: "Hello, world! How are you today? I'm fine."
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const wordCount = element.shadowRoot?.querySelector('.word-count');
      // Should count "Hello", "world", "How", "are", "you", "today", "I'm", "fine" = 8 words
      expect(wordCount?.textContent).to.include('8 words');
    });
  });

  describe('Signature Display', () => {
    it('should display signature when provided', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Some thinking content',
        signature: 'thinking_2024_01_15_12_30_45_abc123'
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const signature = element.shadowRoot?.querySelector('.thinking-signature');
      expect(signature).to.exist;
      expect(signature?.textContent).to.include('thinking_2024_01_15_12_30_45_abc123');
    });

    it('should not display signature section when not provided', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Some thinking content'
        // No signature
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const signature = element.shadowRoot?.querySelector('.thinking-signature');
      expect(signature).to.not.exist;
    });

    it('should format signature appropriately', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Test',
        signature: 'thinking_2024_01_15_12_30_45_abc123'
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const signature = element.shadowRoot?.querySelector('.thinking-signature');
      const signatureText = signature?.textContent || '';
      
      // Should be monospace and smaller
      expect(signature).to.exist;
      expect(signatureText).to.include('thinking_2024_01_15_12_30_45_abc123');
    });
  });

  describe('Collapsible Behavior', () => {
    it('should be collapsed by default', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Some thinking'
      };

      element.thinkingContent = thinkingContent;
      element.defaultCollapsed = true;
      await element.updateComplete;

      const content = element.shadowRoot?.querySelector('.thinking-content');
      expect(content?.classList.contains('collapsed')).to.be.true;
    });

    it('should be expanded when defaultCollapsed is false', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Some thinking'
      };

      element.thinkingContent = thinkingContent;
      element.defaultCollapsed = false;
      await element.updateComplete;

      const content = element.shadowRoot?.querySelector('.thinking-content');
      expect(content?.classList.contains('collapsed')).to.be.false;
    });

    it('should toggle collapse state when header clicked', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Some thinking'
      };

      element.thinkingContent = thinkingContent;
      element.collapsible = true;
      await element.updateComplete;

      const header = element.shadowRoot?.querySelector('.thinking-header') as HTMLElement;
      const initialCollapsed = element.shadowRoot?.querySelector('.thinking-content')?.classList.contains('collapsed');
      
      header?.click();
      await element.updateComplete;
      
      const afterClickCollapsed = element.shadowRoot?.querySelector('.thinking-content')?.classList.contains('collapsed');
      expect(afterClickCollapsed).to.not.equal(initialCollapsed);
    });

    it('should not be clickable when collapsible is false', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Some thinking'
      };

      element.thinkingContent = thinkingContent;
      element.collapsible = false;
      await element.updateComplete;

      const header = element.shadowRoot?.querySelector('.thinking-header');
      expect(header?.classList.contains('non-interactive')).to.be.true;
    });

    it('should show expand/collapse indicator', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Some thinking'
      };

      element.thinkingContent = thinkingContent;
      element.collapsible = true;
      await element.updateComplete;

      const toggle = element.shadowRoot?.querySelector('.collapse-toggle');
      expect(toggle).to.exist;
      expect(toggle?.textContent).to.equal('▼');
    });
  });

  describe('Compact Mode', () => {
    it('should apply compact styling', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Some thinking'
      };

      element.thinkingContent = thinkingContent;
      element.compact = true;
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.thinking-container');
      expect(container?.classList.contains('compact')).to.be.true;
    });

    it('should hide detailed information in compact mode', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Some thinking with a signature',
        signature: 'thinking_2024_01_15_12_30_45_abc123'
      };

      element.thinkingContent = thinkingContent;
      element.compact = true;
      await element.updateComplete;

      // In compact mode, certain elements should be hidden or condensed
      const container = element.shadowRoot?.querySelector('.thinking-container.compact');
      expect(container).to.exist;
    });
  });

  describe('Text Processing', () => {
    it('should preserve line breaks in thinking content', async () => {
      const multilineThinking = 'First line\nSecond line\nThird line';
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: multilineThinking
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const content = element.shadowRoot?.querySelector('.thinking-text');
      // Should preserve whitespace and line breaks
      expect(content?.innerHTML).to.include('First line');
      expect(content?.innerHTML).to.include('Second line');
      expect(content?.innerHTML).to.include('Third line');
    });

    it('should handle special characters in thinking content', async () => {
      const specialChars = 'Content with <script>, &amp;, and "quotes"';
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: specialChars
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const content = element.shadowRoot?.querySelector('.thinking-text');
      // Should escape HTML properly
      expect(content?.textContent).to.include('<script>');
      expect(content?.textContent).to.include('&');
      expect(content?.textContent).to.include('"quotes"');
    });

    it('should handle very long words without breaking layout', async () => {
      const longWord = 'supercalifragilisticexpialidocious'.repeat(10);
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: `This is a sentence with a very long word: ${longWord} that should not break the layout.`
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const content = element.shadowRoot?.querySelector('.thinking-text');
      expect(content).to.exist;
      // Content should render without breaking
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for collapsible content', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Some thinking'
      };

      element.thinkingContent = thinkingContent;
      element.collapsible = true;
      await element.updateComplete;

      const header = element.shadowRoot?.querySelector('.thinking-header');
      expect(header).to.have.attribute('role', 'button');
      expect(header).to.have.attribute('aria-expanded');
    });

    it('should provide appropriate labels for screen readers', async () => {
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: 'Some thinking'
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.thinking-container');
      expect(container).to.exist;
      
      // Should have appropriate semantic markup
      const header = element.shadowRoot?.querySelector('.thinking-header');
      expect(header?.textContent).to.include('💭');
    });

    it('should make expand/collapse buttons accessible', async () => {
      const longThinking = 'A'.repeat(1000);
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: longThinking
      };

      element.thinkingContent = thinkingContent;
      element.truncateThreshold = 100;
      await element.updateComplete;

      const expandButton = element.shadowRoot?.querySelector('.expand-text-btn');
      expect(expandButton).to.exist;
      expect(expandButton).to.have.attribute('aria-label');
    });
  });

  describe('Error Handling', () => {
    it('should handle null thinking content gracefully', async () => {
      const thinkingContent = {
        type: 'thinking' as const,
        thinking: null as any
      };

      element.thinkingContent = thinkingContent;
      
      // Should not throw
      await expect(element.updateComplete).to.not.be.rejected;
    });

    it('should handle undefined thinking content', async () => {
      element.thinkingContent = undefined as any;
      
      await expect(element.updateComplete).to.not.be.rejected;
      
      const container = element.shadowRoot?.querySelector('.thinking-container');
      expect(container).to.not.exist;
    });

    it('should handle extremely long content without performance issues', async () => {
      const extremelyLongThinking = 'A'.repeat(100000); // 100k characters
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: extremelyLongThinking
      };

      element.thinkingContent = thinkingContent;
      element.truncateThreshold = 1000;
      
      const startTime = performance.now();
      await element.updateComplete;
      const endTime = performance.now();
      
      // Should complete reasonably quickly (less than 1 second)
      expect(endTime - startTime).to.be.lessThan(1000);
      
      // Should be truncated for performance
      const expandButton = element.shadowRoot?.querySelector('.expand-text-btn');
      expect(expandButton).to.exist;
    });
  });

  describe('Integration', () => {
    it('should work with different thinking patterns', async () => {
      const structuredThinking = `
        I need to approach this systematically:
        
        1. First, understand the requirements
        2. Then, analyze the constraints
        3. Finally, propose a solution
        
        Let me work through each step:
        
        Step 1: Requirements analysis...
        Step 2: Constraint evaluation...
        Step 3: Solution design...
      `;
      
      const thinkingContent: ThinkingContent = {
        type: 'thinking',
        thinking: structuredThinking
      };

      element.thinkingContent = thinkingContent;
      await element.updateComplete;

      const content = element.shadowRoot?.querySelector('.thinking-text');
      expect(content?.textContent).to.include('systematically');
      expect(content?.textContent).to.include('Step 1');
      expect(content?.textContent).to.include('Solution design');
    });
  });
});