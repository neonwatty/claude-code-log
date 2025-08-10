import { html, css, CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { TranscriptEntry } from '@app/shared';
import './MessageDisplay';

/**
 * Demo component for testing MessageDisplay with different message types
 */
@customElement('message-display-demo')
export class MessageDisplayDemo extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: var(--space-lg);
        max-width: 1200px;
        margin: 0 auto;
      }

      .demo-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-lg);
      }

      .demo-section {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .demo-header {
        background: var(--color-background-secondary);
        padding: var(--space-md);
        border-bottom: 1px solid var(--color-border);
      }

      .demo-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        color: var(--color-text-primary);
      }

      .demo-description {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin-top: var(--space-xs);
      }

      .demo-content {
        padding: var(--space-md);
      }

      .controls {
        display: flex;
        gap: var(--space-sm);
        margin-bottom: var(--space-lg);
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border);
      }

      .controls button {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: none;
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--border-radius);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: all var(--transition-fast);
      }

      .controls button:hover {
        background: var(--color-primary-dark);
      }

      .controls button.active {
        background: var(--color-success);
      }
    `,
  ];

  @state()
  private selectedDemo = 'user-text';

  @state()
  private displayMode: 'compact' | 'detailed' | 'minimal' = 'detailed';

  render() {
    return html`
      <div class="demo-container">
        <div class="controls">
          <button 
            class="${this.displayMode === 'detailed' ? 'active' : ''}"
            @click=${() => this.displayMode = 'detailed'}
          >
            Detailed
          </button>
          <button 
            class="${this.displayMode === 'compact' ? 'active' : ''}"
            @click=${() => this.displayMode = 'compact'}
          >
            Compact
          </button>
          <button 
            class="${this.displayMode === 'minimal' ? 'active' : ''}"
            @click=${() => this.displayMode = 'minimal'}
          >
            Minimal
          </button>
        </div>

        ${this.renderUserTextDemo()}
        ${this.renderAssistantTextDemo()}
        ${this.renderToolUseDemo()}
        ${this.renderThinkingDemo()}
        ${this.renderComplexMessageDemo()}
      </div>
    `;
  }

  private renderUserTextDemo() {
    const entry: TranscriptEntry = {
      type: 'user',
      message: {
        role: 'user',
        content: 'Can you help me implement a **React component** for displaying markdown? I need it to support:\n\n- Syntax highlighting for code blocks\n- Tables\n- Links\n\nHere\'s what I have so far:\n\n```typescript\nimport React from "react";\n\nconst MarkdownViewer = ({ content }: { content: string }) => {\n  return <div>{content}</div>;\n};\n```\n\nWhat would you suggest?'
      },
      parentUuid: undefined,
      isSidechain: false,
      userType: 'user',
      cwd: '/demo/project',
      sessionId: 'demo-session',
      version: '1.0.0',
      uuid: 'user-message-1',
      timestamp: new Date().toISOString(),
    };

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h3 class="demo-title">User Message with Markdown</h3>
          <p class="demo-description">
            User message containing markdown formatting, code blocks, and lists
          </p>
        </div>
        <div class="demo-content">
          <message-display
            .entry=${entry}
            .displayMode=${this.displayMode}
            .messageIndex=${1}
          ></message-display>
        </div>
      </div>
    `;
  }

  private renderAssistantTextDemo() {
    const entry: TranscriptEntry = {
      type: 'assistant',
      message: {
        id: 'assistant-1',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: [
          {
            type: 'text',
            text: 'I\'d be happy to help you improve your React markdown component! Here\'s a more complete implementation:\n\n```typescript\nimport React from "react";\nimport ReactMarkdown from "react-markdown";\nimport { Prism as SyntaxHighlighter } from "react-syntax-highlighter";\nimport { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism";\nimport remarkGfm from "remark-gfm";\n\ninterface MarkdownViewerProps {\n  content: string;\n  className?: string;\n}\n\nconst MarkdownViewer: React.FC<MarkdownViewerProps> = ({ \n  content, \n  className \n}) => {\n  return (\n    <div className={className}>\n      <ReactMarkdown\n        remarkPlugins={[remarkGfm]}\n        components={{\n          code({ node, inline, className, children, ...props }) {\n            const match = /language-(\\w+)/.exec(className || \'\');\n            return !inline && match ? (\n              <SyntaxHighlighter\n                style={tomorrow}\n                language={match[1]}\n                PreTag="div"\n                {...props}\n              >\n                {String(children).replace(/\\n$/, \'\')}\n              </SyntaxHighlighter>\n            ) : (\n              <code className={className} {...props}>\n                {children}\n              </code>\n            );\n          },\n        }}\n      >\n        {content}\n      </ReactMarkdown>\n    </div>\n  );\n};\n\nexport default MarkdownViewer;\n```\n\nKey improvements:\n\n1. **react-markdown** - Proper markdown parsing\n2. **react-syntax-highlighter** - Beautiful code highlighting\n3. **remark-gfm** - GitHub Flavored Markdown support (tables, strikethrough, etc.)\n4. **TypeScript support** - Full type safety\n\nYou\'ll need to install the dependencies:\n\n```bash\nnpm install react-markdown react-syntax-highlighter remark-gfm\nnpm install -D @types/react-syntax-highlighter\n```'
          }
        ],
        usage: {
          input_tokens: 150,
          output_tokens: 450,
        }
      },
      parentUuid: undefined,
      isSidechain: false,
      userType: 'user',
      cwd: '/demo/project',
      sessionId: 'demo-session',
      version: '1.0.0',
      uuid: 'assistant-message-1',
      timestamp: new Date().toISOString(),
    };

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h3 class="demo-title">Assistant Response with Code</h3>
          <p class="demo-description">
            Assistant message with syntax highlighted code blocks and detailed explanations
          </p>
        </div>
        <div class="demo-content">
          <message-display
            .entry=${entry}
            .displayMode=${this.displayMode}
            .messageIndex=${2}
          ></message-display>
        </div>
      </div>
    `;
  }

  private renderToolUseDemo() {
    const entry: TranscriptEntry = {
      type: 'assistant',
      message: {
        id: 'assistant-2',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: [
          {
            type: 'text',
            text: 'I\'ll help you create the component file. Let me write it for you:'
          },
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Write',
            input: {
              file_path: '/demo/project/src/components/MarkdownViewer.tsx',
              content: 'import React from "react";\nimport ReactMarkdown from "react-markdown";\n\nconst MarkdownViewer = ({ content }) => {\n  return <ReactMarkdown>{content}</ReactMarkdown>;\n};\n\nexport default MarkdownViewer;'
            }
          }
        ],
      },
      parentUuid: undefined,
      isSidechain: false,
      userType: 'user',
      cwd: '/demo/project',
      sessionId: 'demo-session',
      version: '1.0.0',
      uuid: 'assistant-message-2',
      timestamp: new Date().toISOString(),
    };

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h3 class="demo-title">Tool Use Message</h3>
          <p class="demo-description">
            Assistant message that uses tools to create files or run commands
          </p>
        </div>
        <div class="demo-content">
          <message-display
            .entry=${entry}
            .displayMode=${this.displayMode}
            .messageIndex=${3}
          ></message-display>
        </div>
      </div>
    `;
  }

  private renderThinkingDemo() {
    const entry: TranscriptEntry = {
      type: 'assistant',
      message: {
        id: 'assistant-3',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: [
          {
            type: 'thinking',
            thinking: 'The user is asking about React components for markdown. I should consider their requirements:\n\n1. Syntax highlighting - they want code blocks to be highlighted\n2. Tables - GitHub flavored markdown support\n3. Links - basic markdown feature\n\nI should recommend react-markdown as the standard solution, along with react-syntax-highlighter for the code highlighting. For tables, they\'ll need remark-gfm plugin.\n\nLet me provide a comprehensive solution that addresses all their needs.'
          },
          {
            type: 'text',
            text: 'Based on your requirements, I\'ll recommend a solution using react-markdown with the necessary plugins for syntax highlighting and table support.'
          }
        ],
      },
      parentUuid: undefined,
      isSidechain: false,
      userType: 'user',
      cwd: '/demo/project',
      sessionId: 'demo-session',
      version: '1.0.0',
      uuid: 'assistant-message-3',
      timestamp: new Date().toISOString(),
    };

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h3 class="demo-title">Message with Thinking</h3>
          <p class="demo-description">
            Assistant message that includes internal thinking process
          </p>
        </div>
        <div class="demo-content">
          <message-display
            .entry=${entry}
            .displayMode=${this.displayMode}
            .messageIndex=${4}
          ></message-display>
        </div>
      </div>
    `;
  }

  private renderComplexMessageDemo() {
    const entry: TranscriptEntry = {
      type: 'assistant',
      message: {
        id: 'assistant-4',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: [
          {
            type: 'thinking',
            thinking: 'This is a complex implementation that will involve multiple steps. I need to:\n1. Create the main component file\n2. Set up the proper imports\n3. Configure syntax highlighting\n4. Test the implementation\n\nI should break this down into clear steps.'
          },
          {
            type: 'text',
            text: 'I\'ll create a complete implementation with all the features you requested. Let me break this down into steps:'
          },
          {
            type: 'tool_use',
            id: 'tool-2',
            name: 'Write',
            input: {
              file_path: '/demo/project/src/components/MarkdownViewer.tsx',
              content: 'import React from "react";\nimport ReactMarkdown from "react-markdown";\nimport { Prism as SyntaxHighlighter } from "react-syntax-highlighter";\nimport { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism";\nimport remarkGfm from "remark-gfm";\n\ninterface MarkdownViewerProps {\n  content: string;\n  className?: string;\n}\n\nconst MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className }) => {\n  return (\n    <div className={className}>\n      <ReactMarkdown\n        remarkPlugins={[remarkGfm]}\n        components={{\n          code({ node, inline, className, children, ...props }) {\n            const match = /language-(\\w+)/.exec(className || \'\');\n            return !inline && match ? (\n              <SyntaxHighlighter\n                style={tomorrow}\n                language={match[1]}\n                PreTag="div"\n                {...props}\n              >\n                {String(children).replace(/\\n$/, \'\')}\n              </SyntaxHighlighter>\n            ) : (\n              <code className={className} {...props}>\n                {children}\n              </code>\n            );\n          },\n        }}\n      >\n        {content}\n      </ReactMarkdown>\n    </div>\n  );\n};\n\nexport default MarkdownViewer;'
            }
          },
          {
            type: 'text',
            text: 'Now let me create a test file to verify everything works:'
          },
          {
            type: 'tool_use',
            id: 'tool-3',
            name: 'Write',
            input: {
              file_path: '/demo/project/src/components/__tests__/MarkdownViewer.test.tsx',
              content: 'import React from "react";\nimport { render, screen } from "@testing-library/react";\nimport MarkdownViewer from "../MarkdownViewer";\n\nconst testMarkdown = `# Test Heading\n\nThis is a **bold** text and this is *italic*.\n\n## Code Example\n\n\`\`\`typescript\nconst greeting = "Hello, World!";\nconsole.log(greeting);\n\`\`\`\n\n| Column 1 | Column 2 |\n|----------|----------|\n| Value 1  | Value 2  |\n`;\n\ndescribe("MarkdownViewer", () => {\n  it("renders markdown content correctly", () => {\n    render(<MarkdownViewer content={testMarkdown} />);\n    \n    expect(screen.getByText("Test Heading")).toBeInTheDocument();\n    expect(screen.getByText(/bold/)).toBeInTheDocument();\n    expect(screen.getByText(/italic/)).toBeInTheDocument();\n  });\n\n  it("applies custom className", () => {\n    const { container } = render(\n      <MarkdownViewer content="# Test" className="custom-class" />\n    );\n    \n    expect(container.firstChild).toHaveClass("custom-class");\n  });\n});'
            }
          }
        ],
        usage: {
          input_tokens: 200,
          output_tokens: 800,
        }
      },
      parentUuid: undefined,
      isSidechain: false,
      userType: 'user',
      cwd: '/demo/project',
      sessionId: 'demo-session',
      version: '1.0.0',
      uuid: 'assistant-message-4',
      timestamp: new Date().toISOString(),
    };

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h3 class="demo-title">Complex Message</h3>
          <p class="demo-description">
            Message with thinking, multiple tool uses, and rich content
          </p>
        </div>
        <div class="demo-content">
          <message-display
            .entry=${entry}
            .displayMode=${this.displayMode}
            .messageIndex=${5}
          ></message-display>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'message-display-demo': MessageDisplayDemo;
  }
}