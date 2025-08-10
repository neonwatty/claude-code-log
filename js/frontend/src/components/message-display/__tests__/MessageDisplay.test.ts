import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fixture, html, expect as expectLit } from '@open-wc/testing';
import { MessageDisplay } from '../MessageDisplay';
import type { DisplayMode } from '../../../components/types/session-types';

// Mock the shared module types - these would normally be imported
type TranscriptEntry = {
  type: 'user' | 'assistant' | 'system';
  timestamp?: string;
  message?: any;
  content?: string;
};

type ContentItem = {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'image';
  text?: string;
  content?: any;
  name?: string;
  input?: any;
  tool_use_id?: string;
  is_error?: boolean;
  thinking?: string;
  source?: {
    media_type: string;
    data: string;
  };
};

// Mock syntax-highlighter component
class MockSyntaxHighlighter extends HTMLElement {
  code = '';
  language = '';
  lineNumbers = false;
  copyable = false;
  compact = false;
  theme = 'auto';

  connectedCallback() {
    this.innerHTML = `<pre><code>${this.code}</code></pre>`;
  }
}

customElements.define('syntax-highlighter', MockSyntaxHighlighter);

// Mock marked
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn((text: string) => `<p>${text}</p>`)
  }
}));

describe('MessageDisplay', () => {
  let element: MessageDisplay;

  beforeEach(async () => {
    element = await fixture(html`<message-display></message-display>`);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with default properties', () => {
      expect(element).to.exist;
      expect(element.displayMode).to.equal('detailed');
      expect(element.selected).to.be.false;
      expect(element.collapsed).to.be.false;
      expect(element.messageIndex).to.equal(0);
    });

    it('should show loading state when no entry provided', async () => {
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container?.textContent?.includes('Loading')).to.be.true;
    });

    it('should render user message', async () => {
      const userEntry: TranscriptEntry = {
        type: 'user',
        timestamp: new Date().toISOString(),
        message: {
          content: 'Hello, how are you?',
          role: 'user'
        }
      };

      element.entry = userEntry;
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container?.classList.contains('user')).to.be.true;
      
      const roleElement = element.shadowRoot?.querySelector('.message-role');
      expect(roleElement?.textContent).to.equal('user');
    });

    it('should render assistant message', async () => {
      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        timestamp: new Date().toISOString(),
        message: {
          content: [{ type: 'text', text: 'I am doing well, thank you!' }],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container?.classList.contains('assistant')).to.be.true;
    });

    it('should render system message', async () => {
      const systemEntry: TranscriptEntry = {
        type: 'system',
        content: 'System notification message'
      };

      element.entry = systemEntry;
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container?.classList.contains('system')).to.be.true;
    });
  });

  describe('Display Modes', () => {
    it('should apply compact mode styling', async () => {
      const userEntry: TranscriptEntry = {
        type: 'user',
        message: { content: 'Test message', role: 'user' }
      };

      element.entry = userEntry;
      element.displayMode = 'compact';
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container?.classList.contains('compact')).to.be.true;
    });

    it('should show detailed view by default', async () => {
      const userEntry: TranscriptEntry = {
        type: 'user',
        message: { content: 'Test message', role: 'user' }
      };

      element.entry = userEntry;
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container?.classList.contains('compact')).to.be.false;
    });
  });

  describe('Content Processing', () => {
    it('should process text content', async () => {
      const textEntry: TranscriptEntry = {
        type: 'user',
        message: {
          content: 'This is a **bold** text with *italic* words.',
          role: 'user'
        }
      };

      element.entry = textEntry;
      await element.updateComplete;

      const textContent = element.shadowRoot?.querySelector('.text-content');
      expect(textContent).to.exist;
      
      // Should process markdown
      const marked = await import('marked');
      expect(marked.marked.parse).toHaveBeenCalled();
    });

    it('should process code content with syntax highlighting', async () => {
      const codeContent: ContentItem = {
        type: 'text',
        text: '```javascript\nconsole.log("Hello World");\n```'
      };

      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [codeContent],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      // Should use syntax-highlighter component for code blocks
      const syntaxHighlighter = element.shadowRoot?.querySelector('syntax-highlighter');
      expect(syntaxHighlighter).to.exist;
    });

    it('should process tool use content', async () => {
      const toolUseContent: ContentItem = {
        type: 'tool_use',
        name: 'Write',
        input: { file_path: 'test.js', content: 'console.log("test");' }
      };

      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [toolUseContent],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const toolSection = element.shadowRoot?.querySelector('.tool-use-content');
      expect(toolSection).to.exist;
      
      const toolName = element.shadowRoot?.querySelector('.tool-name');
      expect(toolName?.textContent).to.equal('Write');
    });

    it('should process tool result content', async () => {
      const toolResultContent: ContentItem = {
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: 'File created successfully',
        is_error: false
      };

      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [toolResultContent],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const toolResult = element.shadowRoot?.querySelector('.tool-use-content');
      expect(toolResult).to.exist;
      
      const status = element.shadowRoot?.querySelector('.tool-status.success');
      expect(status).to.exist;
    });

    it('should process thinking content', async () => {
      const thinkingContent: ContentItem = {
        type: 'thinking',
        thinking: 'Let me think about this problem step by step...'
      };

      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [thinkingContent],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const thinkingDiv = element.shadowRoot?.querySelector('.thinking-content');
      expect(thinkingDiv).to.exist;
      expect(thinkingDiv?.textContent?.includes('thinking')).to.be.true;
    });

    it('should process image content', async () => {
      const imageContent: ContentItem = {
        type: 'image',
        source: {
          media_type: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        }
      };

      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [imageContent],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const imageDiv = element.shadowRoot?.querySelector('.image-content');
      const img = element.shadowRoot?.querySelector('img');
      expect(imageDiv).to.exist;
      expect(img).to.exist;
      expect(img?.src).to.include('data:image/png;base64,');
    });
  });

  describe('Message Metadata', () => {
    it('should display timestamp', async () => {
      const timestamp = new Date('2023-01-01T12:00:00Z');
      const userEntry: TranscriptEntry = {
        type: 'user',
        timestamp: timestamp.toISOString(),
        message: { content: 'Test', role: 'user' }
      };

      element.entry = userEntry;
      await element.updateComplete;

      const timestampElement = element.shadowRoot?.querySelector('.message-timestamp');
      expect(timestampElement).to.exist;
      expect(timestampElement?.textContent).to.include(timestamp.toLocaleTimeString());
    });

    it('should show badges for tool use', async () => {
      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', name: 'Test', input: {} }],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const toolsBadge = element.shadowRoot?.querySelector('.badge.tools');
      expect(toolsBadge).to.exist;
      expect(toolsBadge?.textContent).to.equal('Tools');
    });

    it('should show badges for thinking content', async () => {
      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [{ type: 'thinking', thinking: 'Thinking...' }],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const thinkingBadge = element.shadowRoot?.querySelector('.badge.thinking');
      expect(thinkingBadge).to.exist;
      expect(thinkingBadge?.textContent).to.equal('Thinking');
    });

    it('should show badges for errors', async () => {
      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_result', tool_use_id: '1', content: 'Error', is_error: true }],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const errorBadge = element.shadowRoot?.querySelector('.badge.error');
      expect(errorBadge).to.exist;
      expect(errorBadge?.textContent).to.equal('Error');
    });

    it('should show token count when available', async () => {
      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Response' }],
          role: 'assistant',
          usage: {
            input_tokens: 10,
            output_tokens: 15
          }
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const tokenBadge = element.shadowRoot?.querySelector('.badge.tokens');
      expect(tokenBadge).to.exist;
      expect(tokenBadge?.textContent).to.equal('25 tokens');
    });
  });

  describe('Collapsible Functionality', () => {
    it('should show collapse toggle when multiple content items exist', async () => {
      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'First item' },
            { type: 'text', text: 'Second item' }
          ],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const collapseToggle = element.shadowRoot?.querySelector('.collapse-toggle');
      expect(collapseToggle).to.exist;
    });

    it('should toggle collapsed state when collapse button clicked', async () => {
      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'First' },
            { type: 'text', text: 'Second' }
          ],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const collapseToggle = element.shadowRoot?.querySelector('.collapse-toggle') as HTMLButtonElement;
      collapseToggle?.click();
      
      await element.updateComplete;
      
      expect(element.collapsed).to.be.true;
      const messageContent = element.shadowRoot?.querySelector('.message-content');
      expect(messageContent?.classList.contains('collapsed')).to.be.true;
    });

    it('should handle collapsible sections', async () => {
      const assistantEntry: TranscriptEntry = {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', name: 'Test', input: { param: 'value' } }],
          role: 'assistant'
        }
      };

      element.entry = assistantEntry;
      await element.updateComplete;

      const sectionHeader = element.shadowRoot?.querySelector('.section-header') as HTMLElement;
      expect(sectionHeader).to.exist;
      
      // Click to toggle section
      sectionHeader?.click();
      await element.updateComplete;
      
      // Check if section content is collapsed
      const sectionContent = element.shadowRoot?.querySelector('.section-content');
      expect(sectionContent).to.exist;
    });
  });

  describe('Selection State', () => {
    it('should apply selected styling when selected', async () => {
      const userEntry: TranscriptEntry = {
        type: 'user',
        message: { content: 'Test', role: 'user' }
      };

      element.entry = userEntry;
      element.selected = true;
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container?.classList.contains('selected')).to.be.true;
    });

    it('should not apply selected styling by default', async () => {
      const userEntry: TranscriptEntry = {
        type: 'user',
        message: { content: 'Test', role: 'user' }
      };

      element.entry = userEntry;
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container?.classList.contains('selected')).to.be.false;
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed message data gracefully', async () => {
      const malformedEntry = {
        type: 'unknown',
        invalidData: true
      } as any;

      element.entry = malformedEntry;
      
      // Should not throw
      await expect(element.updateComplete).to.not.be.rejected;
    });

    it('should handle missing message content gracefully', async () => {
      const emptyEntry: TranscriptEntry = {
        type: 'user'
        // Missing message property
      };

      element.entry = emptyEntry;
      await element.updateComplete;

      // Should render without crashing
      const container = element.shadowRoot?.querySelector('.message-container');
      expect(container).to.exist;
    });

    it('should handle markdown parsing errors', async () => {
      const marked = await import('marked');
      marked.marked.parse.mockImplementation(() => {
        throw new Error('Markdown parsing failed');
      });

      const textEntry: TranscriptEntry = {
        type: 'user',
        message: {
          content: 'Some **markdown** text',
          role: 'user'
        }
      };

      element.entry = textEntry;
      
      // Should fallback to basic processing
      await expect(element.updateComplete).to.not.be.rejected;
    });
  });
});