import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { marked } from 'marked';
import { AriaRoles, AriaAttributes, KeyboardKeys, A11yConfig, generateId } from '../utils/accessibility';
import { useFocusManagement, skipLinkManager } from '../utils/focus-management';

/**
 * Component for rendering markdown content with full support for:
 * - Headers, paragraphs, and text formatting
 * - Lists (ordered and unordered)
 * - Tables with proper styling
 * - Links and images
 * - Code blocks and inline code
 * - Blockquotes
 * - Horizontal rules
 */
@customElement('markdown-renderer')
export class MarkdownRenderer extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        line-height: 1.6;
        color: var(--color-text-primary);
      }

      /* Headers */
      :host h1,
      :host h2,
      :host h3,
      :host h4,
      :host h5,
      :host h6 {
        margin: var(--space-lg) 0 var(--space-md) 0;
        font-weight: var(--font-weight-semibold);
        line-height: 1.3;
        color: var(--color-text-primary);
      }

      :host h1 {
        font-size: 2rem;
        border-bottom: 2px solid var(--color-border);
        padding-bottom: var(--space-sm);
        margin-bottom: var(--space-lg);
      }

      :host h2 {
        font-size: 1.5rem;
        border-bottom: 1px solid var(--color-border-light);
        padding-bottom: var(--space-xs);
      }

      :host h3 {
        font-size: 1.25rem;
      }

      :host h4 {
        font-size: 1.1rem;
      }

      :host h5,
      :host h6 {
        font-size: 1rem;
      }

      /* First header should not have top margin */
      :host h1:first-child,
      :host h2:first-child,
      :host h3:first-child,
      :host h4:first-child,
      :host h5:first-child,
      :host h6:first-child {
        margin-top: 0;
      }

      /* Paragraphs */
      :host p {
        margin: var(--space-md) 0;
      }

      :host p:first-child {
        margin-top: 0;
      }

      :host p:last-child {
        margin-bottom: 0;
      }

      /* Text formatting */
      :host strong {
        font-weight: var(--font-weight-semibold);
      }

      :host em {
        font-style: italic;
      }

      :host del {
        text-decoration: line-through;
        color: var(--color-text-muted);
      }

      /* Links */
      :host a {
        color: var(--color-primary);
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: all var(--transition-fast);
      }

      :host a:hover {
        color: var(--color-primary-dark);
        border-bottom-color: var(--color-primary);
      }

      :host a:visited {
        color: var(--color-primary);
      }

      /* Lists */
      :host ul,
      :host ol {
        margin: var(--space-md) 0;
        padding-left: var(--space-xl);
      }

      :host ul ul,
      :host ul ol,
      :host ol ul,
      :host ol ol {
        margin: var(--space-xs) 0;
      }

      :host li {
        margin: var(--space-xs) 0;
      }

      :host li > p {
        margin: var(--space-xs) 0;
      }

      /* Custom bullet points */
      :host ul > li {
        list-style-type: disc;
      }

      :host ul ul > li {
        list-style-type: circle;
      }

      :host ul ul ul > li {
        list-style-type: square;
      }

      /* Code */
      :host code {
        background: var(--color-background-secondary);
        color: var(--color-text-primary);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius-sm);
        font-family: var(--font-mono);
        font-size: 0.9em;
        border: 1px solid var(--color-border-light);
      }

      :host pre {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        overflow-x: auto;
        margin: var(--space-md) 0;
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
        line-height: 1.4;
      }

      :host pre code {
        background: none;
        border: none;
        padding: 0;
        font-size: inherit;
        color: inherit;
      }

      /* Tables */
      :host table {
        width: 100%;
        border-collapse: collapse;
        margin: var(--space-md) 0;
        font-size: var(--font-size-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      :host thead {
        background: var(--color-background-secondary);
      }

      :host th {
        padding: var(--space-sm) var(--space-md);
        text-align: left;
        font-weight: var(--font-weight-semibold);
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text-primary);
      }

      :host td {
        padding: var(--space-sm) var(--space-md);
        border-bottom: 1px solid var(--color-border-light);
        vertical-align: top;
      }

      :host tbody tr:hover {
        background: var(--color-background-tertiary);
      }

      :host tbody tr:last-child td {
        border-bottom: none;
      }

      /* Table alignment */
      :host th[align="center"],
      :host td[align="center"] {
        text-align: center;
      }

      :host th[align="right"],
      :host td[align="right"] {
        text-align: right;
      }

      /* Blockquotes */
      :host blockquote {
        margin: var(--space-md) 0;
        padding: var(--space-md) var(--space-lg);
        border-left: 4px solid var(--color-primary);
        background: var(--color-background-secondary);
        border-radius: 0 var(--border-radius) var(--border-radius) 0;
        color: var(--color-text-secondary);
        font-style: italic;
      }

      :host blockquote > *:first-child {
        margin-top: 0;
      }

      :host blockquote > *:last-child {
        margin-bottom: 0;
      }

      /* Nested blockquotes */
      :host blockquote blockquote {
        margin: var(--space-sm) 0;
        border-left-color: var(--color-text-muted);
      }

      /* Horizontal rules */
      :host hr {
        border: none;
        height: 1px;
        background: var(--color-border);
        margin: var(--space-lg) 0;
      }

      /* Images */
      :host img {
        max-width: 100%;
        height: auto;
        border-radius: var(--border-radius);
        margin: var(--space-sm) 0;
        display: block;
      }

      /* Task lists (GitHub-style checkboxes) */
      :host input[type="checkbox"] {
        margin-right: var(--space-sm);
        accent-color: var(--color-primary);
      }

      :host li:has(input[type="checkbox"]) {
        list-style: none;
        margin-left: calc(-1 * var(--space-xl));
        padding-left: var(--space-xl);
      }

      /* Responsive design */
      @media (max-width: 768px) {
        :host {
          font-size: var(--font-size-sm);
        }

        :host h1 {
          font-size: 1.5rem;
        }

        :host h2 {
          font-size: 1.25rem;
        }

        :host h3 {
          font-size: 1.1rem;
        }

        :host table {
          font-size: var(--font-size-xs);
          display: block;
          overflow-x: auto;
          white-space: nowrap;
        }

        :host th,
        :host td {
          padding: var(--space-xs) var(--space-sm);
        }
      }

      /* Error state */
      :host(.error) {
        color: var(--color-error);
        background: var(--color-error-light);
        padding: var(--space-md);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-error);
      }

      /* Screen reader only content */
      .sr-only {
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
      }

      /* Focus management for interactive elements */
      :host a:focus {
        outline: 2px solid var(--color-border-focus);
        outline-offset: 2px;
        border-bottom-color: transparent;
      }

      :host pre:focus {
        outline: 2px solid var(--color-border-focus);
        outline-offset: 2px;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        :host a {
          text-decoration: underline;
        }
        
        :host code,
        :host pre {
          border: 2px solid;
        }
        
        :host table {
          border: 2px solid;
        }
        
        :host th,
        :host td {
          border: 1px solid;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        :host * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      /* Table of Contents */
      .table-of-contents {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        margin: var(--space-lg) 0;
        max-width: fit-content;
      }

      .table-of-contents h2 {
        margin: 0 0 var(--space-sm) 0;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        border: none;
        padding: 0;
      }

      .table-of-contents ol {
        margin: 0;
        padding-left: var(--space-lg);
        list-style: decimal;
      }

      .table-of-contents li {
        margin: var(--space-xs) 0;
      }

      .table-of-contents a {
        color: var(--color-text-secondary);
        text-decoration: none;
        border-bottom: none;
        font-size: var(--font-size-sm);
        transition: color var(--transition-fast);
      }

      .table-of-contents a:hover,
      .table-of-contents a:focus {
        color: var(--color-primary);
        outline: 2px solid var(--color-border-focus);
        outline-offset: 2px;
      }

      /* Different indentation levels for TOC */
      .toc-level-1 { font-weight: var(--font-weight-semibold); }
      .toc-level-2 { padding-left: var(--space-sm); }
      .toc-level-3 { padding-left: var(--space-md); }
      .toc-level-4 { padding-left: var(--space-lg); }
      .toc-level-5 { padding-left: var(--space-xl); }
      .toc-level-6 { padding-left: calc(var(--space-xl) + var(--space-sm)); }

      /* Heading anchors */
      :host h1 .heading-anchor,
      :host h2 .heading-anchor,
      :host h3 .heading-anchor,
      :host h4 .heading-anchor,
      :host h5 .heading-anchor,
      :host h6 .heading-anchor {
        opacity: 0;
        margin-left: var(--space-xs);
        color: var(--color-text-muted);
        text-decoration: none;
        font-weight: normal;
        transition: opacity var(--transition-fast);
      }

      :host h1:hover .heading-anchor,
      :host h2:hover .heading-anchor,
      :host h3:hover .heading-anchor,
      :host h4:hover .heading-anchor,
      :host h5:hover .heading-anchor,
      :host h6:hover .heading-anchor,
      :host h1:focus-within .heading-anchor,
      :host h2:focus-within .heading-anchor,
      :host h3:focus-within .heading-anchor,
      :host h4:focus-within .heading-anchor,
      :host h5:focus-within .heading-anchor,
      :host h6:focus-within .heading-anchor {
        opacity: 1;
      }

      :host .heading-anchor:focus {
        opacity: 1;
        outline: 2px solid var(--color-border-focus);
        outline-offset: 2px;
      }
    `,
  ];

  /**
   * The markdown content to render
   */
  @property({ type: String })
  content = '';

  /**
   * Whether to enable GitHub Flavored Markdown features
   */
  @property({ type: Boolean })
  gfm = true;

  /**
   * Whether to enable line breaks (converts \n to <br>)
   */
  @property({ type: Boolean })
  breaks = false;

  /**
   * Whether to sanitize HTML in the markdown
   */
  @property({ type: Boolean })
  sanitize = true;

  /**
   * Custom base URL for relative links
   */
  @property({ type: String })
  baseUrl = '';

  @state()
  private contentId = generateId('markdown-content');

  @state()
  private headings: { id: string; level: number; text: string }[] = [];

  private focusManager = useFocusManagement('markdown-content', this, 3);

  connectedCallback() {
    super.connectedCallback();
    
    // Register for focus management
    this.focusManager.register();
    
    // Register skip link if content has headings
    if (this.headings.length > 1) {
      skipLinkManager.registerTarget('markdown-content', this, 'Skip to markdown content');
    }
    
    this.configureMarked();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Unregister from focus management
    this.focusManager.unregister();
    skipLinkManager.unregisterTarget('markdown-content');
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('gfm') || changedProperties.has('breaks')) {
      this.configureMarked();
    }
  }

  render() {
    if (!this.content) {
      return html``;
    }

    try {
      const htmlContent = this.renderMarkdown(this.content);
      return html`
        <div
          id="${this.contentId}"
          role="${AriaRoles.DOCUMENT}"
          aria-label="Rendered markdown content"
          tabindex="0"
          @keydown=${this.handleKeydown}
        >
          ${this.headings.length > 1 ? this.renderTableOfContents() : ''}
          ${unsafeHTML(htmlContent)}
        </div>
      `;
    } catch (error) {
      console.error('Markdown rendering error:', error);
      this.classList.add('error');
      return html`
        <div
          role="${AriaRoles.ALERT}"
          aria-label="Markdown rendering error"
          tabindex="0"
        >
          <strong>Markdown Rendering Error:</strong>
          <pre>${error instanceof Error ? error.message : 'Unknown error'}</pre>
          <details>
            <summary>Raw Content</summary>
            <pre>${this.content}</pre>
          </details>
        </div>
      `;
    }
  }

  private configureMarked() {
    // Clear previous headings
    this.headings = [];
    
    // Configure marked with our options
    marked.use({
      gfm: this.gfm,
      breaks: this.breaks,
      
      // Custom renderer for better styling and accessibility
      renderer: {
        // Custom heading rendering with IDs for navigation
        heading: (token: any) => {
          const level = token.depth;
          const text = token.text || '';
          const headingId = this.generateHeadingId(text);
          
          // Store heading for table of contents
          this.headings.push({ id: headingId, level, text });
          
          return `<h${level} id="${headingId}" tabindex="-1">
            <a href="#${headingId}" class="heading-anchor" aria-label="Link to ${text}" tabindex="-1">#</a>
            ${text}
          </h${level}>`;
        },

        // Custom link rendering with rel attributes for external links
        link: (token: any) => {
          const href = token.href || '';
          const text = token.text || '';
          const title = token.title || '';
          
          const isExternal = href.startsWith('http') && !href.includes(window.location.hostname);
          const titleAttr = title ? ` title="${this.escapeHtml(title)}"` : '';
          const relAttr = isExternal ? ' rel="noopener noreferrer" target="_blank"' : '';
          const ariaLabel = isExternal ? ` aria-label="${this.escapeHtml(text)} (opens in new tab)"` : '';
          
          return `<a href="${this.escapeHtml(href)}"${titleAttr}${relAttr}${ariaLabel}>${text}</a>`;
        },

        // Custom image rendering with better accessibility
        image: (token: any) => {
          const href = token.href || '';
          const text = token.text || '';
          const title = token.title || '';
          
          const titleAttr = title ? ` title="${this.escapeHtml(title)}"` : '';
          const altText = text || 'Image';
          
          return `<img src="${this.escapeHtml(href)}" alt="${this.escapeHtml(altText)}"${titleAttr} loading="lazy" role="img">`;
        },

        // Custom table rendering with proper accessibility
        table: (token: any) => {
          const header = token.header;
          const rows = token.rows;
          
          let thead = '';
          if (header && header.length > 0) {
            thead = '<thead><tr>';
            header.forEach((cell: any) => {
              thead += `<th scope="col">${cell.text}</th>`;
            });
            thead += '</tr></thead>';
          }
          
          let tbody = '';
          if (rows && rows.length > 0) {
            tbody = '<tbody>';
            rows.forEach((row: any) => {
              tbody += '<tr>';
              row.forEach((cell: any, index: number) => {
                const isFirstColumn = index === 0;
                const scope = isFirstColumn ? ' scope="row"' : '';
                const tag = isFirstColumn ? 'th' : 'td';
                tbody += `<${tag}${scope}>${cell.text}</${tag}>`;
              });
              tbody += '</tr>';
            });
            tbody += '</tbody>';
          }
          
          return `<table role="table">${thead}${tbody}</table>`;
        },

        // Custom code block rendering with better accessibility
        code: (token: any) => {
          const code = token.text || '';
          const lang = token.lang || '';
          const langClass = lang ? ` class="language-${lang}"` : '';
          const ariaLabel = lang ? ` aria-label="Code block in ${lang}"` : ' aria-label="Code block"';
          
          return `<pre role="region"${ariaLabel} tabindex="0"><code${langClass}>${this.escapeHtml(code)}</code></pre>`;
        }
      }
    });
  }

  private renderMarkdown(content: string): string {
    // Process the content with marked
    let result = marked.parse(content);
    
    // Handle async case (marked can return Promise in some configurations)
    if (result instanceof Promise) {
      throw new Error('Async markdown rendering not supported in this context');
    }

    // Type guard to ensure we have a string
    if (typeof result !== 'string') {
      result = String(result);
    }

    // Basic HTML sanitization if enabled
    if (this.sanitize) {
      result = this.sanitizeHtml(result);
    }

    return result;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private sanitizeHtml(html: string): string {
    // Basic sanitization - remove only dangerous scripts and events
    // In production, consider using DOMPurify for more comprehensive sanitization
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, 'javascript-disabled:')
      .replace(/on\w+\s*=/gi, 'data-disabled-event=');
  }

  /**
   * Get the plain text content from markdown (strips all formatting)
   */
  getPlainText(): string {
    if (!this.content) return '';
    
    try {
      // Render to HTML first, then extract text
      const html = this.renderMarkdown(this.content);
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.textContent || div.innerText || '';
    } catch {
      // Fallback to basic text extraction
      return this.content
        .replace(/[#*_~`\[\]()]/g, '')
        .replace(/\n+/g, ' ')
        .trim();
    }
  }

  /**
   * Extract all links from the markdown content
   */
  getLinks(): { text: string; href: string; title?: string }[] {
    const links: { text: string; href: string; title?: string }[] = [];
    
    try {
      const tokens = marked.lexer(this.content);
      this.extractLinksFromTokens(tokens, links);
    } catch (error) {
      console.warn('Failed to extract links:', error);
    }
    
    return links;
  }

  private extractLinksFromTokens(tokens: any[], links: { text: string; href: string; title?: string }[]) {
    tokens.forEach(token => {
      if (token.type === 'link') {
        const linkObj: { text: string; href: string; title?: string } = {
          text: token.text,
          href: token.href,
        };
        
        // Only add title if it's not null
        if (token.title && token.title !== null) {
          linkObj.title = token.title;
        }
        
        links.push(linkObj);
      }
      
      // Recursively check child tokens
      if (token.tokens) {
        this.extractLinksFromTokens(token.tokens, links);
      }
    });
  }

  // Accessibility helper methods

  private generateHeadingId(text: string): string {
    // Create a URL-safe ID from heading text
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .trim();
  }

  private renderTableOfContents() {
    if (this.headings.length <= 1) return '';

    const tocId = generateId('toc');
    
    return html`
      <nav 
        id="${tocId}"
        role="${AriaRoles.NAVIGATION}" 
        aria-label="Table of contents"
        class="table-of-contents"
      >
        <h2 id="${tocId}-title">Contents</h2>
        <ol aria-labelledby="${tocId}-title">
          ${this.headings.map((heading, index) => html`
            <li class="toc-level-${heading.level}">
              <a 
                href="#${heading.id}" 
                @click=${this.handleTocClick}
                aria-label="Go to ${heading.text}"
              >
                ${heading.text}
              </a>
            </li>
          `)}
        </ol>
      </nav>
    `;
  }

  private handleTocClick(event: Event) {
    event.preventDefault();
    const link = event.target as HTMLAnchorElement;
    const targetId = link.getAttribute('href')?.substring(1);
    
    if (targetId) {
      const targetElement = this.shadowRoot?.getElementById(targetId);
      if (targetElement) {
        targetElement.focus();
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  protected handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case KeyboardKeys.TAB:
        // Allow normal tab navigation
        break;
        
      case 'h':
      case 'H':
        // Navigate between headings with 'h' key
        if (event.ctrlKey || event.metaKey) {
          this.navigateToNextHeading(event.shiftKey);
          event.preventDefault();
        }
        break;
        
      case KeyboardKeys.HOME:
        // Go to top of content
        if (event.ctrlKey || event.metaKey) {
          this.scrollTo({ top: 0, behavior: 'smooth' });
          event.preventDefault();
        }
        break;
        
      case KeyboardKeys.END:
        // Go to bottom of content
        if (event.ctrlKey || event.metaKey) {
          this.scrollTo({ top: this.scrollHeight, behavior: 'smooth' });
          event.preventDefault();
        }
        break;
    }
  }

  private navigateToNextHeading(reverse: boolean = false) {
    const headings = Array.from(this.shadowRoot?.querySelectorAll('h1, h2, h3, h4, h5, h6') || []) as HTMLElement[];
    
    if (headings.length === 0) return;
    
    const currentFocus = this.shadowRoot?.activeElement as HTMLElement;
    const currentIndex = headings.indexOf(currentFocus);
    
    let targetIndex: number;
    if (currentIndex === -1) {
      // No heading focused, go to first or last
      targetIndex = reverse ? headings.length - 1 : 0;
    } else {
      // Navigate to next or previous
      targetIndex = reverse 
        ? (currentIndex - 1 + headings.length) % headings.length
        : (currentIndex + 1) % headings.length;
    }
    
    const targetHeading = headings[targetIndex];
    if (targetHeading) {
      targetHeading.focus();
      targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'markdown-renderer': MarkdownRenderer;
  }
}