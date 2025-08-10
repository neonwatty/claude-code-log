import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import hljs from 'highlight.js/lib/core';

// Import common languages for performance
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import cssLang from 'highlight.js/lib/languages/css';
import htmlLang from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import yaml from 'highlight.js/lib/languages/yaml';

// Register common languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', cssLang);
hljs.registerLanguage('html', htmlLang);
hljs.registerLanguage('xml', htmlLang);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);

export type SyntaxTheme = 'light' | 'dark' | 'auto';
export type LanguageDetection = 'auto' | 'manual';

/**
 * A comprehensive syntax highlighter component with support for multiple languages,
 * themes, line numbers, and copy functionality
 */
@customElement('syntax-highlighter')
export class SyntaxHighlighter extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        --syntax-bg: var(--color-background-secondary);
        --syntax-border: var(--color-border);
        --syntax-text: var(--color-text-primary);
        --syntax-line-number: var(--color-text-muted);
        --syntax-line-highlight: var(--color-background-tertiary);
        
        /* Syntax highlighting colors */
        --syntax-comment: var(--color-text-muted);
        --syntax-keyword: var(--color-primary);
        --syntax-string: var(--color-success);
        --syntax-number: var(--color-error);
        --syntax-function: var(--color-warning);
        --syntax-variable: var(--color-text-primary);
        --syntax-type: var(--color-info);
        --syntax-operator: var(--color-text-secondary);
      }

      :host([theme="dark"]) {
        --syntax-bg: #1e1e1e;
        --syntax-text: #d4d4d4;
        --syntax-comment: #6a9955;
        --syntax-keyword: #569cd6;
        --syntax-string: #ce9178;
        --syntax-number: #b5cea8;
        --syntax-function: #dcdcaa;
        --syntax-variable: #9cdcfe;
        --syntax-type: #4ec9b0;
        --syntax-operator: #d4d4d4;
      }

      .highlighter-container {
        border: 1px solid var(--syntax-border);
        border-radius: var(--border-radius);
        background: var(--syntax-bg);
        overflow: hidden;
        position: relative;
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
        line-height: 1.4;
      }

      .highlighter-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-xs) var(--space-sm);
        background: var(--color-background-tertiary);
        border-bottom: 1px solid var(--syntax-border);
        font-size: var(--font-size-xs);
      }

      .language-label {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-medium);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .language-icon {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.7;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .action-button {
        background: none;
        border: none;
        padding: var(--space-xs);
        border-radius: var(--border-radius-sm);
        color: var(--color-text-secondary);
        cursor: pointer;
        font-size: var(--font-size-xs);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .action-button:hover {
        background: var(--color-background-secondary);
        color: var(--color-text-primary);
      }

      .action-button:active {
        transform: scale(0.95);
      }

      .action-button.copied {
        color: var(--color-success);
      }

      .code-container {
        position: relative;
        overflow-x: auto;
        max-height: var(--max-height, none);
      }

      .code-container.scrollable {
        max-height: 400px;
      }

      .line-numbers {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: var(--line-number-width, 3em);
        background: var(--color-background-tertiary);
        border-right: 1px solid var(--syntax-border);
        padding: var(--space-sm) var(--space-xs);
        color: var(--syntax-line-number);
        font-size: var(--font-size-xs);
        line-height: 1.4;
        user-select: none;
        text-align: right;
        z-index: 1;
      }

      .line-numbers .line-number {
        display: block;
        position: relative;
      }

      .line-numbers .line-number.highlighted {
        background: var(--syntax-line-highlight);
        color: var(--color-text-primary);
        font-weight: var(--font-weight-medium);
        margin: 0 calc(-1 * var(--space-xs));
        padding: 0 var(--space-xs);
        border-radius: var(--border-radius-sm);
      }

      .code-content {
        padding: var(--space-sm);
        min-height: 100%;
        margin-left: var(--line-number-offset, 0);
      }

      .code-content.with-line-numbers {
        margin-left: calc(var(--line-number-width, 3em) + 1px);
      }

      .code-content pre {
        margin: 0;
        padding: 0;
        background: none;
        border: none;
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        color: var(--syntax-text);
        overflow: visible;
        white-space: pre;
      }

      .code-content code {
        background: none;
        padding: 0;
        border: none;
        font-family: inherit;
        font-size: inherit;
        display: block;
      }

      /* Syntax highlighting styles */
      .hljs-comment,
      .hljs-quote {
        color: var(--syntax-comment);
        font-style: italic;
      }

      .hljs-keyword,
      .hljs-selector-tag,
      .hljs-literal,
      .hljs-type,
      .hljs-built_in {
        color: var(--syntax-keyword);
        font-weight: var(--font-weight-medium);
      }

      .hljs-string,
      .hljs-doctag,
      .hljs-template-tag {
        color: var(--syntax-string);
      }

      .hljs-title,
      .hljs-section,
      .hljs-selector-id,
      .hljs-function {
        color: var(--syntax-function);
        font-weight: var(--font-weight-medium);
      }

      .hljs-number,
      .hljs-regexp,
      .hljs-link {
        color: var(--syntax-number);
      }

      .hljs-variable,
      .hljs-template-variable,
      .hljs-attr {
        color: var(--syntax-variable);
      }

      .hljs-subst,
      .hljs-tag,
      .hljs-name,
      .hljs-attribute,
      .hljs-class .hljs-title {
        color: var(--syntax-type);
      }

      .hljs-symbol,
      .hljs-bullet,
      .hljs-addition,
      .hljs-meta,
      .hljs-meta-keyword {
        color: var(--syntax-operator);
        font-weight: var(--font-weight-medium);
      }

      .hljs-deletion {
        color: var(--color-error);
        background: var(--color-error-light);
      }

      .hljs-emphasis {
        font-style: italic;
      }

      .hljs-strong {
        font-weight: var(--font-weight-bold);
      }

      .compact .highlighter-header {
        display: none;
      }

      .compact .highlighter-container {
        border-radius: var(--border-radius-sm);
      }

      .compact .code-content {
        padding: var(--space-xs) var(--space-sm);
      }

      @media (max-width: 768px) {
        .line-numbers {
          --line-number-width: 2.5em;
        }

        .header-actions {
          gap: var(--space-xs);
        }

        .action-button {
          padding: var(--space-xs);
        }

        .action-button .button-text {
          display: none;
        }
      }

      /* Performance optimization for large code blocks */
      .large-content {
        contain: layout style paint;
      }

      .large-content .code-content {
        will-change: scroll-position;
      }
    `,
  ];

  /**
   * The source code to highlight
   */
  @property({ type: String })
  code = '';

  /**
   * Programming language for syntax highlighting
   */
  @property({ type: String })
  language = '';

  /**
   * Theme for syntax highlighting
   */
  @property({ type: String, reflect: true })
  theme: SyntaxTheme = 'auto';

  /**
   * Whether to show line numbers
   */
  @property({ type: Boolean })
  lineNumbers = false;

  /**
   * Whether to show the header with language and actions
   */
  @property({ type: Boolean })
  showHeader = true;

  /**
   * Whether to enable copy functionality
   */
  @property({ type: Boolean })
  copyable = true;

  /**
   * Compact display mode
   */
  @property({ type: Boolean })
  compact = false;

  /**
   * Maximum height for scrollable content
   */
  @property({ type: String })
  maxHeight = '';

  /**
   * Lines to highlight (1-based)
   */
  @property({ type: Array })
  highlightLines: number[] = [];

  /**
   * Language detection mode
   */
  @property({ type: String })
  detection: LanguageDetection = 'auto';

  /**
   * Whether to wrap long lines
   */
  @property({ type: Boolean })
  wrapLines = false;

  @state()
  private highlightedCode = '';

  @state()
  private detectedLanguage = '';

  @state()
  private copySuccess = false;

  @state()
  private lineCount = 0;

  @state()
  private isLargeContent = false;

  constructor() {
    super();
    // Fallback for test environment where decorators might fail
    if (typeof this.code === 'undefined') {
      this.code = '';
    }
    if (typeof this.language === 'undefined') {
      this.language = '';
    }
    if (typeof this.theme === 'undefined') {
      this.theme = 'auto';
    }
    if (typeof this.lineNumbers === 'undefined') {
      this.lineNumbers = false;
    }
    if (typeof this.showHeader === 'undefined') {
      this.showHeader = true;
    }
    if (typeof this.copyable === 'undefined') {
      this.copyable = true;
    }
    if (typeof this.compact === 'undefined') {
      this.compact = false;
    }
    if (typeof this.maxHeight === 'undefined') {
      this.maxHeight = '';
    }
    if (typeof this.highlightLines === 'undefined') {
      this.highlightLines = [];
    }
    if (typeof this.detection === 'undefined') {
      this.detection = 'auto';
    }
    if (typeof this.wrapLines === 'undefined') {
      this.wrapLines = false;
    }
  }

  protected updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('code') || 
        changedProperties.has('language') || 
        changedProperties.has('detection')) {
      this.highlightCode();
    }

    if (changedProperties.has('theme')) {
      this.updateTheme();
    }
  }

  protected firstUpdated(changedProperties: Map<string, any>) {
    super.firstUpdated(changedProperties);
    // Ensure theme is set on first render
    this.updateTheme();
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>) {
    super.willUpdate(changedProperties);
    // Also update theme before render if theme property changed
    if (changedProperties.has('theme')) {
      this.updateTheme();
    }
  }

  render() {
    const containerClasses = {
      'highlighter-container': true,
      'compact': this.compact,
      'large-content': this.isLargeContent,
    };

    const codeContainerClasses = {
      'code-container': true,
      'scrollable': !!this.maxHeight,
    };

    const codeContentClasses = {
      'code-content': true,
      'with-line-numbers': this.lineNumbers,
    };

    const maxHeightStyle = this.maxHeight ? { '--max-height': this.maxHeight } : {};

    return html`
      <div class="${classMap(containerClasses)}" style=${JSON.stringify(maxHeightStyle)}>
        ${this.showHeader && !this.compact ? this.renderHeader() : ''}
        <div class="${classMap(codeContainerClasses)}">
          ${this.lineNumbers ? this.renderLineNumbers() : ''}
          <div class="${classMap(codeContentClasses)}">
            <pre><code class="hljs ${this.getLanguageClass()}">${unsafeHTML(this.highlightedCode)}</code></pre>
          </div>
        </div>
      </div>
    `;
  }

  private renderHeader() {
    const displayLanguage = this.detectedLanguage || this.language || 'text';

    return html`
      <div class="highlighter-header">
        <div class="language-label">
          <div class="language-icon" style="background-color: ${this.getLanguageColor(displayLanguage)}"></div>
          <span>${displayLanguage}</span>
          ${this.lineCount ? html`<span>(${this.lineCount} lines)</span>` : ''}
        </div>
        <div class="header-actions">
          ${this.copyable ? html`
            <button 
              class="action-button ${this.copySuccess ? 'copied' : ''}"
              @click=${this.copyCode}
              title="Copy code"
            >
              <span class="button-icon">${this.copySuccess ? '✓' : '📋'}</span>
              <span class="button-text">${this.copySuccess ? 'Copied!' : 'Copy'}</span>
            </button>
          ` : ''}
          ${this.maxHeight ? html`
            <button 
              class="action-button"
              @click=${this.expandCode}
              title="Expand code"
            >
              <span class="button-icon">⤢</span>
              <span class="button-text">Expand</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderLineNumbers() {
    const lines = Array.from({ length: this.lineCount }, (_, i) => i + 1);
    const lineNumberWidth = Math.max(3, this.lineCount.toString().length + 1);
    
    this.style.setProperty('--line-number-width', `${lineNumberWidth}em`);

    return html`
      <div class="line-numbers">
        ${lines.map(lineNum => html`
          <span 
            class="line-number ${this.highlightLines.includes(lineNum) ? 'highlighted' : ''}"
          >
            ${lineNum}
          </span>
        `)}
      </div>
    `;
  }

  private highlightCode() {
    if (!this.code.trim()) {
      this.highlightedCode = '';
      this.lineCount = 0;
      return;
    }

    // Count lines
    this.lineCount = this.code.split('\n').length;
    
    // Check if content is large (performance optimization)
    this.isLargeContent = this.code.length > 10000 || this.lineCount > 500;

    // Determine language
    let targetLanguage = this.language;
    
    if (this.detection === 'auto' && !targetLanguage) {
      const autoResult = hljs.highlightAuto(this.code.substring(0, 1000)); // Only analyze first 1000 chars for performance
      this.detectedLanguage = autoResult.language || '';
      targetLanguage = this.detectedLanguage;
    } else {
      this.detectedLanguage = '';
    }

    // Perform syntax highlighting
    try {
      if (targetLanguage && hljs.getLanguage(targetLanguage)) {
        const result = hljs.highlight(this.code, { 
          language: targetLanguage,
          ignoreIllegals: true
        });
        this.highlightedCode = result.value;
      } else {
        // Fallback to auto-detection
        const result = hljs.highlightAuto(this.code);
        this.highlightedCode = result.value;
        if (result.language) {
          this.detectedLanguage = result.language;
        }
      }
    } catch (err) {
      console.warn('Syntax highlighting failed:', err);
      this.highlightedCode = this.escapeHtml(this.code);
    }
  }

  private updateTheme() {
    if (this.theme === 'auto') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setAttribute('theme', isDark ? 'dark' : 'light');
    } else {
      this.setAttribute('theme', this.theme);
    }
  }

  private getLanguageClass(): string {
    return this.detectedLanguage || this.language || '';
  }

  private getLanguageColor(language: string): string {
    const colors: Record<string, string> = {
      'javascript': '#f7df1e',
      'typescript': '#3178c6',
      'python': '#3776ab',
      'java': '#ed8b00',
      'cpp': '#00599c',
      'c': '#a8b9cc',
      'go': '#00add8',
      'rust': '#000000',
      'html': '#e34c26',
      'css': '#1572b6',
      'json': '#000000',
      'bash': '#4eaa25',
      'sql': '#336791',
      'yaml': '#cb171e',
      'markdown': '#083fa1',
    };
    
    return colors[language.toLowerCase()] || '#6b7280';
  }

  private async copyCode() {
    try {
      await navigator.clipboard.writeText(this.code);
      this.copySuccess = true;
      
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
      
      this.dispatchEvent(new CustomEvent('code-copied', {
        detail: { code: this.code, language: this.language },
        bubbles: true
      }));
    } catch (err) {
      console.warn('Copy failed:', err);
      // Fallback for older browsers
      this.fallbackCopyCode();
    }
  }

  private fallbackCopyCode() {
    const textArea = document.createElement('textarea');
    textArea.value = this.code;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      this.copySuccess = true;
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
    } catch (err) {
      console.warn('Fallback copy failed:', err);
    } finally {
      document.body.removeChild(textArea);
    }
  }

  private expandCode() {
    this.maxHeight = '';
    this.dispatchEvent(new CustomEvent('code-expanded', {
      detail: { code: this.code, language: this.language },
      bubbles: true
    }));
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  connectedCallback() {
    super.connectedCallback();
    
    // Set initial theme attribute
    this.updateTheme();
    
    // Listen for theme changes
    if (this.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', this.updateTheme.bind(this));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'syntax-highlighter': SyntaxHighlighter;
  }
}