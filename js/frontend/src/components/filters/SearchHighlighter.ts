import { html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { SearchMatch } from './FilterEngine';

/**
 * Component for highlighting search matches in text
 */
@customElement('search-highlighter')
export class SearchHighlighter extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: contents;
      }

      .highlight {
        background: var(--color-warning-light, #fff3cd);
        color: var(--color-warning-dark, #856404);
        padding: 1px 2px;
        border-radius: 2px;
        font-weight: var(--font-weight-medium);
        border: 1px solid var(--color-warning, #ffc107);
        box-shadow: 0 0 0 1px rgba(255, 193, 7, 0.25);
        animation: highlight-pulse 0.3s ease-in-out;
      }

      .highlight.primary {
        background: var(--color-primary-light, #cfe2ff);
        color: var(--color-primary-dark, #003d82);
        border-color: var(--color-primary, #0d6efd);
        box-shadow: 0 0 0 1px rgba(13, 110, 253, 0.25);
      }

      .highlight.success {
        background: var(--color-success-light, #d1e7dd);
        color: var(--color-success-dark, #0a3622);
        border-color: var(--color-success, #198754);
        box-shadow: 0 0 0 1px rgba(25, 135, 84, 0.25);
      }

      .highlight.fuzzy {
        background: var(--color-info-light, #d6f5f5);
        color: var(--color-info-dark, #055160);
        border-color: var(--color-info, #20c997);
        box-shadow: 0 0 0 1px rgba(32, 201, 151, 0.25);
        opacity: 0.8;
      }

      .highlight.context {
        background: var(--color-secondary-light, #f8f9fa);
        color: var(--color-text-secondary);
        border-color: var(--color-border);
        font-weight: normal;
        opacity: 0.7;
      }

      @keyframes highlight-pulse {
        0% {
          transform: scale(1);
          opacity: 0.8;
        }
        50% {
          transform: scale(1.02);
          opacity: 1;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }

      /* Screen reader support */
      .sr-only {
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .highlight {
          border-width: 2px;
          font-weight: var(--font-weight-bold);
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .highlight {
          animation: none;
        }
      }
    `,
  ];

  /**
   * The text to highlight matches in
   */
  @property({ type: String })
  text = '';

  /**
   * Array of search matches to highlight
   */
  @property({ type: Array })
  matches: SearchMatch[] = [];

  /**
   * Highlight style variant
   */
  @property({ type: String })
  variant: 'default' | 'primary' | 'success' | 'fuzzy' = 'default';

  /**
   * Whether to show match context in tooltips
   */
  @property({ type: Boolean })
  showContext = true;

  /**
   * Maximum length of text to display (0 = no limit)
   */
  @property({ type: Number })
  maxLength = 0;

  /**
   * Whether to escape HTML in the text
   */
  @property({ type: Boolean })
  escapeHtml = true;

  render() {
    if (!this.text || this.matches.length === 0) {
      return this.renderPlainText();
    }

    const highlightedHtml = this.highlightMatches();
    
    return html`
      <span class="highlighted-text" role="img" aria-label="Text with highlighted search results">
        ${this.escapeHtml ? html`${highlightedHtml}` : unsafeHTML(highlightedHtml)}
        <span class="sr-only">
          ${this.matches.length} match${this.matches.length !== 1 ? 'es' : ''} found
        </span>
      </span>
    `;
  }

  private renderPlainText() {
    let text = this.text;
    
    if (this.maxLength > 0 && text.length > this.maxLength) {
      text = text.substring(0, this.maxLength) + '...';
    }

    return html`<span>${text}</span>`;
  }

  private highlightMatches(): string {
    let text = this.text;
    
    if (this.maxLength > 0 && text.length > this.maxLength) {
      text = text.substring(0, this.maxLength) + '...';
    }

    // Sort matches by start position (descending) to avoid index issues when inserting
    const sortedMatches = [...this.matches]
      .filter(match => match.start < text.length) // Only matches within visible text
      .sort((a, b) => b.start - a.start);

    let highlightedText = text;
    let matchCount = 0;

    for (const match of sortedMatches) {
      const start = Math.max(0, match.start);
      const end = Math.min(text.length, match.end);
      
      if (start >= end) continue;

      const matchText = highlightedText.substring(start, end);
      const highlightClass = `highlight ${this.variant}`;
      const contextAttr = this.showContext && match.context 
        ? ` title="${this.escapeAttribute(match.context)}"` 
        : '';
      
      const highlightedMatch = `<mark class="${highlightClass}" data-match="${matchCount}"${contextAttr}>${
        this.escapeHtml ? this.escapeHtmlString(matchText) : matchText
      }</mark>`;
      
      highlightedText = highlightedText.substring(0, start) + 
                      highlightedMatch + 
                      highlightedText.substring(end);
      
      matchCount++;
    }

    return highlightedText;
  }

  private escapeHtmlString(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private escapeAttribute(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Get the number of highlighted matches
   */
  getMatchCount(): number {
    return this.matches.filter(match => 
      match.start < (this.maxLength > 0 ? Math.min(this.text.length, this.maxLength) : this.text.length)
    ).length;
  }

  /**
   * Get match at specific index
   */
  getMatch(index: number): SearchMatch | undefined {
    return this.matches[index];
  }

  /**
   * Scroll to a specific match (if visible in DOM)
   */
  scrollToMatch(index: number) {
    const markElement = this.shadowRoot?.querySelector(`mark[data-match="${index}"]`);
    if (markElement) {
      markElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });
      
      // Temporarily emphasize the match
      markElement.classList.add('emphasized');
      setTimeout(() => {
        markElement.classList.remove('emphasized');
      }, 1000);
    }
  }

  /**
   * Get summary of matches for accessibility
   */
  getMatchSummary(): string {
    const count = this.getMatchCount();
    const fields = [...new Set(this.matches.map(m => m.field))];
    
    return `${count} match${count !== 1 ? 'es' : ''} found in ${fields.join(', ')}`;
  }
}

/**
 * Utility function to create highlighted text template
 */
export function highlightText(
  text: string, 
  matches: SearchMatch[], 
  options: {
    variant?: 'default' | 'primary' | 'success' | 'fuzzy';
    maxLength?: number;
    showContext?: boolean;
    escapeHtml?: boolean;
  } = {}
): TemplateResult {
  return html`
    <search-highlighter
      .text=${text}
      .matches=${matches}
      .variant=${options.variant || 'default'}
      .maxLength=${options.maxLength || 0}
      .showContext=${options.showContext !== false}
      .escapeHtml=${options.escapeHtml !== false}
    ></search-highlighter>
  `;
}

/**
 * Utility function to highlight search terms in plain text (without component)
 */
export function highlightSearchTerms(
  text: string,
  searchQuery: string,
  options: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    className?: string;
  } = {}
): string {
  if (!text || !searchQuery) return text;

  const className = options.className || 'highlight';
  const flags = options.caseSensitive ? 'g' : 'gi';
  
  let pattern: RegExp;
  
  if (options.wholeWord) {
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = new RegExp(`\\b(${escapedQuery})\\b`, flags);
  } else {
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = new RegExp(`(${escapedQuery})`, flags);
  }

  return text.replace(pattern, `<mark class="${className}">$1</mark>`);
}

declare global {
  interface HTMLElementTagNameMap {
    'search-highlighter': SearchHighlighter;
  }
}