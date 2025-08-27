import { html, css, TemplateResult, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { BaseComponent } from "../base/base-component.js";
import type {
  ZodContentItem,
  ZodTranscriptEntry,
} from "../../../../shared/src/schemas/index.js";

// Import Prism.js for syntax highlighting
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-css";
import "prismjs/components/prism-html";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-yaml";

// Import marked for markdown rendering
import { marked } from "marked";

export interface MessageCardState {
  expandedSections: Set<string>;
  copiedBlocks: Set<string>;
}

export type MessageRole =
  | "user"
  | "assistant"
  | "system"
  | "tool_use"
  | "tool_result"
  | "thinking"
  | "image"
  | "summary";

@customElement("message-card")
export class MessageCard extends BaseComponent {
  @property({ type: Object })
  message: ZodTranscriptEntry | null = null;

  @property({ type: String })
  role: MessageRole = "user";

  @property({ type: Boolean, attribute: "enable-copy" })
  enableCopy = true;

  @property({ type: Boolean, attribute: "enable-markdown" })
  enableMarkdown = true;

  @property({ type: Boolean, attribute: "enable-syntax-highlighting" })
  enableSyntaxHighlighting = true;

  @property({ type: Boolean, attribute: "show-timestamps" })
  showTimestamps = true;

  @property({ type: Boolean, attribute: "show-token-usage" })
  showTokenUsage = true;

  @state()
  private cardState: MessageCardState = {
    expandedSections: new Set(),
    copiedBlocks: new Set(),
  };

  private readonly roleIcons: Record<MessageRole, string> = {
    user: "🤷",
    assistant: "🤖",
    system: "⚙️",
    tool_use: "🛠️",
    tool_result: "🧰",
    thinking: "💭",
    image: "🖼️",
    summary: "📋",
  };

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        font-family: var(--font-family-mono);
      }

      .message-card {
        margin-bottom: 1em;
        padding: 1em;
        border-radius: var(--border-radius-md);
        border-left: var(--color-border-light) 1px solid;
        background-color: var(--color-surface);
        box-shadow:
          -7px -7px 10px var(--color-shadow-light),
          7px 7px 10px var(--color-shadow-dark);
        border-top: var(--color-border-light) 1px solid;
        border-bottom: var(--color-border-dark) 1px solid;
        border-right: var(--color-border-dark) 1px solid;
        transition: all var(--transition-fast);
      }

      .message-card:hover {
        transform: translateY(-1px);
        box-shadow:
          -10px -10px 15px var(--color-shadow-hover-light),
          10px 10px 15px var(--color-shadow-hover-dark);
      }

      /* Role-based styling */
      .message-card.user {
        border-left-color: var(--color-primary);
      }

      .message-card.assistant {
        border-left-color: var(--color-secondary);
      }

      .message-card.system {
        border-left-color: var(--color-warning);
      }

      .message-card.tool_use {
        border-left-color: var(--color-tool-use);
      }

      .message-card.tool_result {
        border-left-color: var(--color-tool-result);
      }

      .message-card.thinking {
        border-left-color: var(--color-thinking);
      }

      .message-card.image {
        border-left-color: var(--color-image);
      }

      .message-card.summary {
        border-left-color: var(--color-success);
        background-color: var(--color-surface-hover);
      }

      .message-card.sidechain {
        opacity: 0.85;
        background-color: var(--color-surface-hover);
        border-left-width: 2px;
        border-left-style: dashed;
      }

      .message-header {
        font-weight: 600;
        margin-bottom: var(--spacing-sm);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      .message-type {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        font-size: 0.9em;
      }

      .message-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        font-size: 0.8em;
        color: var(--color-text-muted);
      }

      .message-content {
        word-wrap: break-word;
        line-height: var(--line-height);
      }

      .content-section {
        margin-bottom: var(--spacing-sm);
      }

      .content-section:last-child {
        margin-bottom: 0;
      }

      /* Text content styling */
      .text-content {
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .text-content.markdown {
        white-space: normal;
      }

      .text-content.markdown h1,
      .text-content.markdown h2,
      .text-content.markdown h3,
      .text-content.markdown h4,
      .text-content.markdown h5,
      .text-content.markdown h6 {
        margin: var(--spacing-md) 0 var(--spacing-sm) 0;
        font-weight: 600;
      }

      .text-content.markdown p {
        margin: var(--spacing-sm) 0;
      }

      .text-content.markdown ul,
      .text-content.markdown ol {
        margin: var(--spacing-sm) 0;
        padding-left: var(--spacing-lg);
      }

      .text-content.markdown blockquote {
        margin: var(--spacing-sm) 0;
        padding-left: var(--spacing-md);
        border-left: 3px solid var(--color-border-dark);
        color: var(--color-text-muted);
        font-style: italic;
      }

      /* Code block styling */
      .code-block {
        position: relative;
        margin: var(--spacing-sm) 0;
      }

      .code-block-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-xs) var(--spacing-sm);
        background-color: var(--color-surface-active);
        border-radius: var(--border-radius-sm) var(--border-radius-sm) 0 0;
        font-size: 0.8em;
        color: var(--color-text-muted);
        border-bottom: 1px solid var(--color-border-dark);
      }

      .code-language {
        font-weight: 600;
        text-transform: uppercase;
      }

      .copy-button {
        padding: var(--spacing-xs);
        border: none;
        background: transparent;
        color: var(--color-text-muted);
        cursor: pointer;
        border-radius: var(--border-radius-sm);
        transition: all var(--transition-fast);
        font-size: 0.8em;
      }

      .copy-button:hover {
        background-color: var(--color-surface-hover);
        color: var(--color-text);
      }

      .copy-button.copied {
        color: var(--color-success);
      }

      .code-content {
        background-color: var(--color-surface-hover);
        padding: var(--spacing-sm);
        border-radius: 0 0 var(--border-radius-sm) var(--border-radius-sm);
        overflow-x: auto;
        font-family: var(--font-family-mono);
        font-size: 0.9em;
        line-height: 1.4;
      }

      .code-content pre {
        margin: 0;
        background: transparent;
        padding: 0;
        white-space: pre;
        word-wrap: normal;
        overflow-x: auto;
      }

      .code-content code {
        background: transparent;
        padding: 0;
        border-radius: 0;
        font-family: inherit;
        font-size: inherit;
      }

      /* Inline code styling */
      .text-content code {
        background-color: var(--color-surface-hover);
        padding: 2px 4px;
        border-radius: var(--border-radius-sm);
        font-family: var(--font-family-mono);
        font-size: 0.9em;
      }

      /* Tool content styling */
      .tool-content {
        background-color: var(--color-surface-hover);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-sm);
        margin: var(--spacing-sm) 0;
        overflow-x: auto;
        box-shadow:
          -4px -4px 10px var(--color-shadow-light),
          4px 4px 10px var(--color-shadow-dark);
        border-left: var(--color-border-light) 1px solid;
        border-top: var(--color-border-light) 1px solid;
        border-bottom: var(--color-border-dark) 1px solid;
        border-right: var(--color-border-dark) 1px solid;
      }

      .tool-content.tool-use {
        background-color: #e3f2fd66;
        border-left-color: var(--color-tool-use);
      }

      .tool-content.tool-result {
        background-color: #e8f5e866;
        border-left-color: var(--color-tool-result);
      }

      .tool-header {
        font-weight: 600;
        margin-bottom: var(--spacing-xs);
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .tool-input {
        background-color: #fff3cd66;
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-xs);
        margin: var(--spacing-xs) 0;
        font-size: 0.9em;
      }

      /* Thinking content styling */
      .thinking-content {
        background-color: #f0f0f066;
        border-left: var(--color-thinking) 1px solid;
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-sm);
        font-style: italic;
        color: var(--color-text-light);
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      /* Image content styling */
      .image-content {
        margin: var(--spacing-sm) 0;
        text-align: center;
      }

      .image-content img {
        max-width: 100%;
        height: auto;
        border-radius: var(--border-radius-sm);
        box-shadow:
          -3px -3px 6px var(--color-shadow-light),
          3px 3px 6px var(--color-shadow-dark);
      }

      .image-info {
        font-size: 0.8em;
        color: var(--color-text-muted);
        margin-bottom: var(--spacing-xs);
      }

      /* Sidechain indicator */
      .sidechain-indicator {
        color: var(--color-text-muted);
        font-size: 0.9em;
        margin-bottom: 5px;
        padding: 2px 6px;
        background-color: var(--color-surface-active);
        border-radius: var(--border-radius-sm);
        display: inline-block;
      }

      /* Token usage styling */
      .token-usage {
        font-size: 0.75em;
        color: var(--color-text-muted);
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .message-header {
          flex-direction: column;
          align-items: stretch;
        }

        .message-meta {
          align-items: flex-start;
        }

        .code-block-header {
          flex-direction: column;
          align-items: stretch;
          gap: var(--spacing-xs);
        }
      }

      /* Prism.js theme integration */
      .language-javascript .token.keyword,
      .language-typescript .token.keyword,
      .language-python .token.keyword {
        color: #d73a49;
      }

      .language-javascript .token.string,
      .language-typescript .token.string,
      .language-python .token.string {
        color: #032f62;
      }

      .language-javascript .token.function,
      .language-typescript .token.function,
      .language-python .token.function {
        color: #6f42c1;
      }

      .language-javascript .token.comment,
      .language-typescript .token.comment,
      .language-python .token.comment {
        color: #6a737d;
        font-style: italic;
      }

      .language-javascript .token.number,
      .language-typescript .token.number,
      .language-python .token.number {
        color: #005cc5;
      }

      .language-json .token.property {
        color: #d73a49;
      }

      .language-json .token.string {
        color: #032f62;
      }
    `,
  ];

  private detectLanguage(code: string): string {
    // Simple language detection based on common patterns
    const trimmed = code.trim();

    // TypeScript/JavaScript detection
    if (
      trimmed.includes("interface ") ||
      trimmed.includes("type ") ||
      trimmed.includes(": string") ||
      trimmed.includes(": number")
    ) {
      return "typescript";
    }
    if (
      trimmed.includes("function ") ||
      trimmed.includes("const ") ||
      trimmed.includes("let ") ||
      trimmed.includes("=>") ||
      trimmed.includes("console.log")
    ) {
      return "javascript";
    }

    // Python detection
    if (
      trimmed.includes("def ") ||
      trimmed.includes("import ") ||
      trimmed.includes("from ") ||
      trimmed.includes("print(") ||
      /^\s*#/.test(trimmed)
    ) {
      return "python";
    }

    // Shell/Bash detection
    if (
      trimmed.startsWith("#!/bin/bash") ||
      trimmed.startsWith("$ ") ||
      trimmed.includes("npm ") ||
      trimmed.includes("git ")
    ) {
      return "bash";
    }

    // JSON detection
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        JSON.parse(trimmed);
        return "json";
      } catch {
        // Not valid JSON, continue with other checks
      }
    }

    // CSS detection
    if (
      trimmed.includes("{") &&
      trimmed.includes("}") &&
      (trimmed.includes(":") ||
        trimmed.includes("px") ||
        trimmed.includes("em"))
    ) {
      return "css";
    }

    // HTML detection
    if (
      trimmed.includes("<") &&
      trimmed.includes(">") &&
      (trimmed.includes("<div") ||
        trimmed.includes("<span") ||
        trimmed.includes("<html"))
    ) {
      return "html";
    }

    // SQL detection
    if (/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\b/i.test(trimmed)) {
      return "sql";
    }

    // YAML detection
    if (/^\s*[\w\-]+\s*:\s*/.test(trimmed) || trimmed.includes("---")) {
      return "yaml";
    }

    return "text";
  }

  private highlightCode(code: string, language: string): string {
    if (!this.enableSyntaxHighlighting) {
      return code;
    }

    try {
      if (language === "text" || !Prism.languages[language]) {
        return code;
      }
      return Prism.highlight(code, Prism.languages[language], language);
    } catch (error) {
      console.warn("Prism.js highlighting failed:", error);
      return code;
    }
  }

  private async copyToClipboard(text: string, blockId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.cardState = {
        ...this.cardState,
        copiedBlocks: new Set([...this.cardState.copiedBlocks, blockId]),
      };

      // Reset copied state after 2 seconds
      setTimeout(() => {
        this.cardState = {
          ...this.cardState,
          copiedBlocks: new Set(
            [...this.cardState.copiedBlocks].filter((id) => id !== blockId),
          ),
        };
      }, 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  }

  private renderMarkdown(text: string): string {
    if (!this.enableMarkdown) {
      return text;
    }

    try {
      return marked.parse(text);
    } catch (error) {
      console.warn("Markdown parsing failed:", error);
      return text;
    }
  }

  private extractCodeBlocks(text: string): {
    beforeCode: string;
    codeBlocks: Array<{ language: string; code: string; id: string }>;
    afterCode: string;
  } {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const codeBlocks: Array<{ language: string; code: string; id: string }> =
      [];
    let lastIndex = 0;
    let beforeCode = "";
    let afterCode = "";
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (codeBlocks.length === 0) {
        beforeCode = text.slice(0, match.index);
      }

      const language = match[1] || this.detectLanguage(match[2]);
      const code = match[2].trim();
      const id = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      codeBlocks.push({ language, code, id });
      lastIndex = match.index + match[0].length;
    }

    afterCode = text.slice(lastIndex);

    if (codeBlocks.length === 0) {
      beforeCode = text;
    }

    return { beforeCode, codeBlocks, afterCode };
  }

  private renderCodeBlock(codeBlock: {
    language: string;
    code: string;
    id: string;
  }): TemplateResult {
    const { language, code, id } = codeBlock;
    const highlightedCode = this.highlightCode(code, language);
    const isCopied = this.cardState.copiedBlocks.has(id);

    return html`
      <div class="code-block">
        <div class="code-block-header">
          <span class="code-language">${language}</span>
          ${this.enableCopy
            ? html`
                <button
                  class="copy-button ${isCopied ? "copied" : ""}"
                  @click=${() => this.copyToClipboard(code, id)}
                  title="${isCopied ? "Copied!" : "Copy to clipboard"}"
                >
                  ${isCopied ? "✓ Copied" : "📋 Copy"}
                </button>
              `
            : ""}
        </div>
        <div class="code-content">
          <pre><code>${unsafeHTML(highlightedCode)}</code></pre>
        </div>
      </div>
    `;
  }

  private renderTextContent(content: string): TemplateResult {
    const { beforeCode, codeBlocks, afterCode } =
      this.extractCodeBlocks(content);

    // Check if this looks like markdown (has headers, lists, etc.)
    const isMarkdown =
      /^#{1,6}\s|^\*\s|^\d+\.\s|^\>\s/m.test(content) ||
      content.includes("**") ||
      content.includes("*");

    return html`
      <div class="content-section">
        ${beforeCode
          ? html`
              <div class="text-content ${isMarkdown ? "markdown" : ""}">
                ${isMarkdown
                  ? unsafeHTML(this.renderMarkdown(beforeCode))
                  : beforeCode}
              </div>
            `
          : ""}
        ${codeBlocks.map((block) => this.renderCodeBlock(block))}
        ${afterCode
          ? html`
              <div class="text-content ${isMarkdown ? "markdown" : ""}">
                ${isMarkdown
                  ? unsafeHTML(this.renderMarkdown(afterCode))
                  : afterCode}
              </div>
            `
          : ""}
      </div>
    `;
  }

  private renderContentItem(
    content: ZodContentItem,
    index: number,
  ): TemplateResult {
    switch (content.type) {
      case "text":
        return this.renderTextContent(content.text);

      case "tool_use":
        const toolUseId = `tool-use-${index}`;
        return html`
          <div class="tool-content tool-use">
            <div class="tool-header">🛠️ ${content.name}</div>
            <div class="tool-input">
              ${this.renderCodeBlock({
                language: "json",
                code: JSON.stringify(content.input, null, 2),
                id: toolUseId,
              })}
            </div>
          </div>
        `;

      case "tool_result":
        const toolResultId = `tool-result-${index}`;
        const resultContent =
          typeof content.content === "string"
            ? content.content
            : JSON.stringify(content.content, null, 2);
        return html`
          <div class="tool-content tool-result">
            <div class="tool-header">
              🧰 Tool Result ${content.is_error ? "(Error)" : ""}
            </div>
            ${this.renderCodeBlock({
              language: content.is_error
                ? "text"
                : this.detectLanguage(resultContent),
              code: resultContent,
              id: toolResultId,
            })}
          </div>
        `;

      case "thinking":
        return html`
          <div class="thinking-content">
            <div style="margin-bottom: var(--spacing-xs); font-weight: 600;">
              💭 Thinking
            </div>
            ${content.thinking}
          </div>
        `;

      case "image":
        return html`
          <div class="image-content">
            <div class="image-info">
              🖼️ Image (${content.source.media_type})
            </div>
            <img
              src="data:${content.source.media_type};base64,${content.source
                .data}"
              alt="Content image"
            />
          </div>
        `;

      default:
        return html`<div class="unknown-content">Unknown content type</div>`;
    }
  }

  private formatTokenUsage(usage: any): string {
    if (!usage) return "";

    const parts = [];
    if (usage.input_tokens)
      parts.push(`In: ${this.formatTokenCount(usage.input_tokens)}`);
    if (usage.output_tokens)
      parts.push(`Out: ${this.formatTokenCount(usage.output_tokens)}`);
    if (usage.cache_creation_input_tokens)
      parts.push(
        `Cache+: ${this.formatTokenCount(usage.cache_creation_input_tokens)}`,
      );
    if (usage.cache_read_input_tokens)
      parts.push(
        `Cache: ${this.formatTokenCount(usage.cache_read_input_tokens)}`,
      );
    return parts.join(" | ");
  }

  protected override render(): TemplateResult {
    if (!this.message) {
      return html`<div class="message-card empty">No message data</div>`;
    }

    const messageRole = this.role;
    const icon = this.roleIcons[messageRole];
    const isSidechain =
      "isSidechain" in this.message && this.message.isSidechain;

    // Handle different message types
    if (this.message.type === "summary") {
      return html`
        <div class="message-card summary">
          <div class="message-header">
            <div class="message-type">
              <span>${this.roleIcons.summary}</span>
              <span>Summary</span>
            </div>
          </div>
          <div class="message-content">
            ${this.renderTextContent(this.message.summary)}
          </div>
        </div>
      `;
    }

    if (this.message.type === "system") {
      return html`
        <div class="message-card system ${isSidechain ? "sidechain" : ""}">
          ${isSidechain
            ? html`<div class="sidechain-indicator">🔗 Sub-conversation</div>`
            : ""}
          <div class="message-header">
            <div class="message-type">
              <span>${icon}</span>
              <span>System</span>
            </div>
            ${this.showTimestamps
              ? html`
                  <div class="message-meta">
                    <span class="timestamp"
                      >${this.formatTimestamp(this.message.timestamp)}</span
                    >
                  </div>
                `
              : ""}
          </div>
          <div class="message-content">
            ${this.renderTextContent(this.message.content)}
          </div>
        </div>
      `;
    }

    if (this.message.type === "user") {
      return html`
        <div class="message-card user ${isSidechain ? "sidechain" : ""}">
          ${isSidechain
            ? html`<div class="sidechain-indicator">🔗 Sub-conversation</div>`
            : ""}
          <div class="message-header">
            <div class="message-type">
              <span>${icon}</span>
              <span>User</span>
            </div>
            ${this.showTimestamps
              ? html`
                  <div class="message-meta">
                    <span class="timestamp"
                      >${this.formatTimestamp(this.message.timestamp)}</span
                    >
                  </div>
                `
              : ""}
          </div>
          <div class="message-content">
            ${this.message.message.content?.map((content, index) =>
              this.renderContentItem(content, index),
            )}
          </div>
        </div>
      `;
    }

    if (this.message.type === "assistant") {
      const usage = this.message.message.usage;
      const tokenUsage =
        this.showTokenUsage && usage ? this.formatTokenUsage(usage) : "";

      return html`
        <div class="message-card assistant ${isSidechain ? "sidechain" : ""}">
          ${isSidechain
            ? html`<div class="sidechain-indicator">🔗 Sub-conversation</div>`
            : ""}
          <div class="message-header">
            <div class="message-type">
              <span>${icon}</span>
              <span>Assistant</span>
            </div>
            ${this.showTimestamps || tokenUsage
              ? html`
                  <div class="message-meta">
                    ${this.showTimestamps
                      ? html`<span class="timestamp"
                          >${this.formatTimestamp(this.message.timestamp)}</span
                        >`
                      : ""}
                    ${tokenUsage
                      ? html`<span class="token-usage">${tokenUsage}</span>`
                      : ""}
                  </div>
                `
              : ""}
          </div>
          <div class="message-content">
            ${this.message.message.content?.map((content, index) =>
              this.renderContentItem(content, index),
            )}
          </div>
        </div>
      `;
    }

    return html`<div class="message-card unknown">
      Unknown message type: ${this.message.type}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "message-card": MessageCard;
  }
}
