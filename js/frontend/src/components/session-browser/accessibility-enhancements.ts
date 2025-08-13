import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';

/**
 * Screen reader announcements component
 */
@customElement('screen-reader-announcements')
export class ScreenReaderAnnouncements extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }

      .announcement {
        display: block;
      }
    `,
  ];

  @state()
  private announcements: Array<{
    id: string;
    message: string;
    priority: 'polite' | 'assertive';
    timestamp: number;
  }> = [];

  private announcementId = 0;

  render() {
    return html`
      ${this.announcements.map(announcement => html`
        <div 
          class="announcement"
          aria-live="${announcement.priority}"
          aria-atomic="true"
          key="${announcement.id}"
        >
          ${announcement.message}
        </div>
      `)}
    `;
  }

  /**
   * Announce a message to screen readers
   */
  public announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const id = `announcement-${this.announcementId++}`;
    const timestamp = Date.now();

    this.announcements = [
      ...this.announcements,
      { id, message, priority, timestamp }
    ];

    // Clear old announcements after 5 seconds
    setTimeout(() => {
      this.announcements = this.announcements.filter(a => a.timestamp > timestamp - 5000);
    }, 5000);
  }

  /**
   * Clear all announcements
   */
  public clear(): void {
    this.announcements = [];
  }
}

/**
 * Skip links component for keyboard navigation
 */
@customElement('skip-links')
export class SkipLinks extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 10000;
      }

      .skip-links {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .skip-link {
        position: absolute;
        top: -100px;
        left: var(--space-sm);
        background: var(--color-primary);
        color: var(--color-text-inverse);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--border-radius);
        text-decoration: none;
        font-weight: var(--font-weight-medium);
        font-size: var(--font-size-sm);
        white-space: nowrap;
        transition: top var(--transition-fast);
        border: 2px solid var(--color-primary-dark);
      }

      .skip-link:focus {
        top: var(--space-sm);
        outline: 2px solid var(--color-primary-light);
        outline-offset: 2px;
      }

      .skip-link:hover {
        background: var(--color-primary-dark);
      }
    `,
  ];

  @property({ type: Array })
  links: Array<{ href: string; text: string }> = [
    { href: '#main-content', text: 'Skip to main content' },
    { href: '#session-navigation', text: 'Skip to navigation' },
    { href: '#session-list', text: 'Skip to session list' },
  ];

  render() {
    return html`
      <div class="skip-links">
        ${this.links.map(link => html`
          <a class="skip-link" href="${link.href}">
            ${link.text}
          </a>
        `)}
      </div>
    `;
  }
}

/**
 * Keyboard navigation helper component
 */
@customElement('keyboard-navigation-help')
export class KeyboardNavigationHelp extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .help-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-xl);
        padding: var(--space-lg);
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        z-index: 2000;
      }

      .help-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1999;
      }

      .help-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-lg);
        padding-bottom: var(--space-sm);
        border-bottom: 1px solid var(--color-border-light);
      }

      .help-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        color: var(--color-text-primary);
      }

      .close-button {
        background: none;
        border: none;
        font-size: var(--font-size-lg);
        cursor: pointer;
        color: var(--color-text-muted);
        padding: var(--space-xs);
        border-radius: var(--border-radius);
      }

      .close-button:hover {
        background: var(--color-background-secondary);
        color: var(--color-text-primary);
      }

      .shortcuts-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-md);
      }

      .shortcut-section {
        margin-bottom: var(--space-lg);
      }

      .section-title {
        font-size: var(--font-size-md);
        font-weight: var(--font-weight-medium);
        margin: 0 0 var(--space-sm) 0;
        color: var(--color-text-primary);
      }

      .shortcut-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .shortcut-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-xs) 0;
        border-bottom: 1px solid var(--color-border-light);
      }

      .shortcut-item:last-child {
        border-bottom: none;
      }

      .shortcut-description {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }

      .shortcut-keys {
        display: flex;
        gap: var(--space-xs);
      }

      .key {
        background: var(--color-background-tertiary);
        color: var(--color-text-secondary);
        padding: 2px var(--space-xs);
        border-radius: var(--border-radius-sm);
        font-family: var(--font-family-mono);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        border: 1px solid var(--color-border);
      }

      @media (max-width: 768px) {
        .help-container {
          max-width: 90vw;
          margin: var(--space-sm);
        }

        .shortcuts-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @property({ type: Boolean })
  visible = false;

  @property({ type: Array })
  shortcuts = [
    {
      section: 'Navigation',
      items: [
        { keys: ['Ctrl', '←'], description: 'Previous session' },
        { keys: ['Ctrl', '→'], description: 'Next session' },
        { keys: ['Ctrl', 'B'], description: 'Create branch' },
        { keys: ['Ctrl', 'F'], description: 'Search sessions' },
        { keys: ['?'], description: 'Show keyboard shortcuts' },
      ]
    },
    {
      section: 'Selection',
      items: [
        { keys: ['Space'], description: 'Select/deselect session' },
        { keys: ['Ctrl', 'A'], description: 'Select all sessions' },
        { keys: ['Ctrl', 'D'], description: 'Deselect all' },
        { keys: ['Shift', '↑/↓'], description: 'Select range' },
      ]
    },
    {
      section: 'Actions',
      items: [
        { keys: ['Enter'], description: 'Open selected session' },
        { keys: ['Delete'], description: 'Delete selected' },
        { keys: ['Ctrl', 'E'], description: 'Export selected' },
        { keys: ['Ctrl', 'D'], description: 'Duplicate session' },
      ]
    },
    {
      section: 'View',
      items: [
        { keys: ['V'], description: 'Toggle view mode' },
        { keys: ['S'], description: 'Toggle sort order' },
        { keys: ['A'], description: 'Toggle archived' },
        { keys: ['B'], description: 'Toggle branches' },
      ]
    }
  ];

  render() {
    if (!this.visible) return '';

    return html`
      <div class="help-overlay" @click=${this.close}></div>
      <div class="help-container" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div class="help-header">
          <h2 id="help-title" class="help-title">Keyboard Shortcuts</h2>
          <button 
            class="close-button" 
            @click=${this.close}
            aria-label="Close keyboard shortcuts help"
          >
            ×
          </button>
        </div>

        <div class="shortcuts-grid">
          ${this.shortcuts.map(section => html`
            <div class="shortcut-section">
              <h3 class="section-title">${section.section}</h3>
              <ul class="shortcut-list">
                ${section.items.map(item => html`
                  <li class="shortcut-item">
                    <span class="shortcut-description">${item.description}</span>
                    <div class="shortcut-keys">
                      ${item.keys.map(key => html`<span class="key">${key}</span>`)}
                    </div>
                  </li>
                `)}
              </ul>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  public show() {
    this.visible = true;
    // Focus the close button when opened
    this.updateComplete.then(() => {
      const closeButton = this.shadowRoot?.querySelector('.close-button') as HTMLElement;
      closeButton?.focus();
    });
  }

  public close() {
    this.visible = false;
    this.emitEvent('help-closed', {});
  }

  // Handle keyboard events
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeydown);
  }

  private handleKeydown = (event: KeyboardEvent) => {
    if (this.visible) {
      if (event.key === 'Escape') {
        this.close();
      }
    } else {
      if (event.key === '?' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        // Only show if not typing in an input
        const target = event.target as HTMLElement;
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
          event.preventDefault();
          this.show();
        }
      }
    }
  };
}

/**
 * Focus management utility component
 */
@customElement('focus-manager')
export class FocusManager extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: contents;
      }

      .focus-trap {
        outline: none;
      }

      .visually-hidden {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
    `,
  ];

  private previousFocus?: HTMLElement;
  private focusableElements?: HTMLElement[];

  /**
   * Set up focus trap for modal dialogs
   */
  public setupFocusTrap(container: HTMLElement): void {
    this.previousFocus = document.activeElement as HTMLElement;
    this.focusableElements = this.getFocusableElements(container);
    
    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus();
    }

    container.addEventListener('keydown', this.handleFocusTrap);
  }

  /**
   * Remove focus trap
   */
  public removeFocusTrap(container: HTMLElement): void {
    container.removeEventListener('keydown', this.handleFocusTrap);
    
    if (this.previousFocus && document.body.contains(this.previousFocus)) {
      this.previousFocus.focus();
    }
  }

  /**
   * Get all focusable elements within a container
   */
  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }

  private handleFocusTrap = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !this.focusableElements) return;

    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };

  /**
   * Announce a status message
   */
  public announceStatus(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcer = document.querySelector('screen-reader-announcements') as ScreenReaderAnnouncements;
    if (announcer) {
      announcer.announce(message, priority);
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'screen-reader-announcements': ScreenReaderAnnouncements;
    'skip-links': SkipLinks;
    'keyboard-navigation-help': KeyboardNavigationHelp;
    'focus-manager': FocusManager;
  }
}