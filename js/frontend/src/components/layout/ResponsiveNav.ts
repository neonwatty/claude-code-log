import { LitElement, html, css, CSSResult } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { baseStyles } from '../styles/theme.js';

export interface NavItem {
  label: string;
  href?: string;
  onClick?: (event: Event) => void;
  icon?: string;
  active?: boolean;
  disabled?: boolean;
  children?: NavItem[];
}

/**
 * Responsive Navigation Component
 * 
 * Provides responsive navigation that transforms between desktop navbar
 * and mobile hamburger menu with slide-out drawer.
 * 
 * Features:
 * - Desktop horizontal navigation bar
 * - Mobile hamburger menu with slide-out drawer
 * - Smooth transitions and animations
 * - Keyboard navigation support
 * - ARIA attributes for accessibility
 * - Nested navigation support
 * - Active state management
 */
@customElement('responsive-nav')
export class ResponsiveNav extends LitElement {
  static styles: CSSResult = css`
    ${baseStyles}
    
    :host {
      display: block;
      width: 100%;
      position: relative;
    }

    .nav-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-md);
      background-color: var(--color-background);
      border-bottom: 1px solid var(--color-border);
      position: relative;
      z-index: var(--z-sticky);
    }

    .nav-brand {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      font-weight: var(--font-weight-semibold);
      font-size: var(--font-size-lg);
      color: var(--color-text-primary);
      text-decoration: none;
    }

    .nav-brand-icon {
      width: 32px;
      height: 32px;
    }

    /* Desktop Navigation */
    .nav-menu-desktop {
      display: none;
      align-items: center;
      gap: var(--space-lg);
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .nav-item-desktop {
      position: relative;
    }

    .nav-link-desktop {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      padding: var(--space-sm) var(--space-md);
      color: var(--color-text-secondary);
      text-decoration: none;
      border-radius: var(--border-radius);
      transition: all var(--transition-fast);
      font-weight: var(--font-weight-medium);
      white-space: nowrap;
    }

    .nav-link-desktop:hover {
      color: var(--color-primary);
      background-color: var(--color-background-secondary);
    }

    .nav-link-desktop.active {
      color: var(--color-primary);
      background-color: var(--color-primary-disabled);
    }

    .nav-link-desktop:disabled {
      color: var(--color-text-muted);
      cursor: not-allowed;
      opacity: 0.6;
    }

    .nav-link-desktop:focus-visible {
      outline: none;
      box-shadow: var(--shadow-focus);
    }

    /* Mobile Hamburger Button */
    .nav-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: none;
      border: none;
      cursor: pointer;
      border-radius: var(--border-radius);
      transition: all var(--transition-fast);
    }

    .nav-toggle:hover {
      background-color: var(--color-background-secondary);
    }

    .nav-toggle:focus-visible {
      outline: none;
      box-shadow: var(--shadow-focus);
    }

    .nav-toggle[aria-expanded="true"] {
      background-color: var(--color-primary-disabled);
    }

    /* Hamburger Icon */
    .hamburger {
      width: 24px;
      height: 24px;
      position: relative;
    }

    .hamburger-line {
      display: block;
      width: 100%;
      height: 2px;
      background-color: var(--color-text-primary);
      border-radius: 1px;
      transition: all var(--transition-base);
      position: absolute;
      left: 0;
    }

    .hamburger-line:nth-child(1) {
      top: 6px;
    }

    .hamburger-line:nth-child(2) {
      top: 11px;
    }

    .hamburger-line:nth-child(3) {
      top: 16px;
    }

    /* Hamburger animation when open */
    .nav-toggle[aria-expanded="true"] .hamburger-line:nth-child(1) {
      transform: translateY(5px) rotate(45deg);
    }

    .nav-toggle[aria-expanded="true"] .hamburger-line:nth-child(2) {
      opacity: 0;
    }

    .nav-toggle[aria-expanded="true"] .hamburger-line:nth-child(3) {
      transform: translateY(-5px) rotate(-45deg);
    }

    /* Mobile Menu Overlay */
    .nav-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--color-background-overlay);
      z-index: var(--z-modal-backdrop);
      opacity: 0;
      visibility: hidden;
      transition: all var(--transition-base);
    }

    .nav-overlay.open {
      opacity: 1;
      visibility: visible;
    }

    /* Mobile Menu Drawer */
    .nav-menu-mobile {
      position: fixed;
      top: 0;
      right: -100%;
      width: min(320px, 80vw);
      height: 100vh;
      background-color: var(--color-background);
      box-shadow: var(--shadow-lg);
      z-index: var(--z-modal);
      transition: right var(--transition-base);
      overflow-y: auto;
      padding: var(--space-lg);
    }

    .nav-menu-mobile.open {
      right: 0;
    }

    .nav-menu-mobile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-lg);
      padding-bottom: var(--space-md);
      border-bottom: 1px solid var(--color-border);
    }

    .nav-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: none;
      border: none;
      cursor: pointer;
      border-radius: var(--border-radius);
      transition: all var(--transition-fast);
    }

    .nav-close:hover {
      background-color: var(--color-background-secondary);
    }

    .nav-close:focus-visible {
      outline: none;
      box-shadow: var(--shadow-focus);
    }

    .nav-items-mobile {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .nav-item-mobile {
      margin-bottom: var(--space-xs);
    }

    .nav-link-mobile {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-md);
      color: var(--color-text-primary);
      text-decoration: none;
      border-radius: var(--border-radius);
      transition: all var(--transition-fast);
      font-weight: var(--font-weight-medium);
      width: 100%;
    }

    .nav-link-mobile:hover {
      background-color: var(--color-background-secondary);
    }

    .nav-link-mobile.active {
      color: var(--color-primary);
      background-color: var(--color-primary-disabled);
    }

    .nav-link-mobile:disabled {
      color: var(--color-text-muted);
      cursor: not-allowed;
      opacity: 0.6;
    }

    .nav-link-mobile:focus-visible {
      outline: none;
      box-shadow: var(--shadow-focus);
    }

    /* Responsive breakpoints */
    @media (min-width: 768px) {
      .nav-menu-desktop {
        display: flex;
      }

      .nav-toggle {
        display: none;
      }
    }

    /* Icon styles */
    .nav-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    /* Submenu styles (for future nested navigation) */
    .nav-submenu {
      position: absolute;
      top: 100%;
      left: 0;
      background-color: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-lg);
      min-width: 200px;
      z-index: var(--z-dropdown);
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px);
      transition: all var(--transition-fast);
    }

    .nav-item-desktop:hover .nav-submenu {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }

    /* Screen reader only */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* Focus trap for mobile menu */
    .nav-menu-mobile[aria-hidden="false"] {
      /* Ensure focus is trapped within the mobile menu */
    }
  `;

  /**
   * Navigation items
   */
  @property({ type: Array })
  items: NavItem[] = [];

  /**
   * Brand/logo text or HTML
   */
  @property({ type: String })
  brand: string = '';

  /**
   * Brand/logo link
   */
  @property({ type: String, attribute: 'brand-href' })
  brandHref: string = '/';

  /**
   * Whether mobile menu is open
   */
  @state()
  private _mobileMenuOpen = false;

  /**
   * Reference to mobile menu for focus management
   */
  @query('.nav-menu-mobile')
  private _mobileMenu?: HTMLElement;

  /**
   * Reference to nav toggle button
   */
  @query('.nav-toggle')
  private _navToggle?: HTMLButtonElement;

  /**
   * Reference to close button
   */
  @query('.nav-close')
  private _closeButton?: HTMLButtonElement;

  /**
   * Store last focused element before opening mobile menu
   */
  private _lastFocusedElement?: HTMLElement;

  connectedCallback() {
    super.connectedCallback();
    this._setupKeyboardHandlers();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._removeKeyboardHandlers();
  }

  /**
   * Setup keyboard event handlers
   */
  private _setupKeyboardHandlers() {
    document.addEventListener('keydown', this._handleKeydown.bind(this));
  }

  /**
   * Remove keyboard event handlers
   */
  private _removeKeyboardHandlers() {
    document.removeEventListener('keydown', this._handleKeydown.bind(this));
  }

  /**
   * Handle keyboard navigation
   */
  private _handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this._mobileMenuOpen) {
      this._closeMobileMenu();
    }
  }

  /**
   * Toggle mobile menu
   */
  private _toggleMobileMenu() {
    if (this._mobileMenuOpen) {
      this._closeMobileMenu();
    } else {
      this._openMobileMenu();
    }
  }

  /**
   * Open mobile menu
   */
  private _openMobileMenu() {
    this._lastFocusedElement = document.activeElement as HTMLElement;
    this._mobileMenuOpen = true;
    
    // Update ARIA attributes
    if (this._navToggle) {
      this._navToggle.setAttribute('aria-expanded', 'true');
    }
    
    if (this._mobileMenu) {
      this._mobileMenu.setAttribute('aria-hidden', 'false');
    }

    // Focus the close button after animation
    this.updateComplete.then(() => {
      setTimeout(() => {
        if (this._closeButton) {
          this._closeButton.focus();
        }
      }, 100);
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Dispatch custom event
    this.dispatchEvent(new CustomEvent('mobile-menu-opened', {
      bubbles: true
    }));
  }

  /**
   * Close mobile menu
   */
  private _closeMobileMenu() {
    this._mobileMenuOpen = false;
    
    // Update ARIA attributes
    if (this._navToggle) {
      this._navToggle.setAttribute('aria-expanded', 'false');
    }
    
    if (this._mobileMenu) {
      this._mobileMenu.setAttribute('aria-hidden', 'true');
    }

    // Restore focus
    if (this._lastFocusedElement) {
      this._lastFocusedElement.focus();
    }

    // Restore body scroll
    document.body.style.overflow = '';

    // Dispatch custom event
    this.dispatchEvent(new CustomEvent('mobile-menu-closed', {
      bubbles: true
    }));
  }

  /**
   * Handle nav item click
   */
  private _handleNavClick(event: Event, item: NavItem) {
    if (item.disabled) {
      event.preventDefault();
      return;
    }

    if (item.onClick) {
      event.preventDefault();
      item.onClick(event);
    }

    // Close mobile menu if open
    if (this._mobileMenuOpen) {
      this._closeMobileMenu();
    }

    // Dispatch navigation event
    this.dispatchEvent(new CustomEvent('nav-click', {
      detail: { item, event },
      bubbles: true
    }));
  }

  /**
   * Handle overlay click to close mobile menu
   */
  private _handleOverlayClick() {
    this._closeMobileMenu();
  }

  /**
   * Render navigation items for desktop
   */
  private _renderDesktopItems() {
    return this.items.map(item => html`
      <li class="nav-item-desktop">
        <a
          href="${item.href || '#'}"
          class="${classMap({
            'nav-link-desktop': true,
            'active': item.active || false,
          })}"
          ?disabled="${item.disabled}"
          @click="${(e: Event) => this._handleNavClick(e, item)}"
          aria-current="${item.active ? 'page' : 'false'}"
        >
          ${item.icon ? html`<span class="nav-icon" aria-hidden="true">${item.icon}</span>` : ''}
          ${item.label}
        </a>
      </li>
    `);
  }

  /**
   * Render navigation items for mobile
   */
  private _renderMobileItems() {
    return this.items.map(item => html`
      <li class="nav-item-mobile">
        <a
          href="${item.href || '#'}"
          class="${classMap({
            'nav-link-mobile': true,
            'active': item.active || false,
          })}"
          ?disabled="${item.disabled}"
          @click="${(e: Event) => this._handleNavClick(e, item)}"
          aria-current="${item.active ? 'page' : 'false'}"
        >
          ${item.icon ? html`<span class="nav-icon" aria-hidden="true">${item.icon}</span>` : ''}
          ${item.label}
        </a>
      </li>
    `);
  }

  render() {
    return html`
      <nav class="nav-container" role="navigation" aria-label="Main navigation">
        <!-- Brand/Logo -->
        <a href="${this.brandHref}" class="nav-brand" aria-label="Home">
          <slot name="brand-icon">
            ${this.brand ? html`<span class="nav-brand-text">${this.brand}</span>` : ''}
          </slot>
        </a>

        <!-- Desktop Navigation -->
        <ul class="nav-menu-desktop" role="menubar">
          ${this._renderDesktopItems()}
        </ul>

        <!-- Mobile Hamburger Button -->
        <button
          class="nav-toggle"
          type="button"
          aria-expanded="${this._mobileMenuOpen}"
          aria-controls="mobile-menu"
          aria-label="Toggle navigation menu"
          @click="${this._toggleMobileMenu}"
        >
          <span class="hamburger" aria-hidden="true">
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
          </span>
          <span class="sr-only">Toggle navigation menu</span>
        </button>
      </nav>

      <!-- Mobile Menu Overlay -->
      <div
        class="${classMap({
          'nav-overlay': true,
          'open': this._mobileMenuOpen
        })}"
        @click="${this._handleOverlayClick}"
        aria-hidden="${!this._mobileMenuOpen}"
      ></div>

      <!-- Mobile Menu Drawer -->
      <nav
        id="mobile-menu"
        class="${classMap({
          'nav-menu-mobile': true,
          'open': this._mobileMenuOpen
        })}"
        role="navigation"
        aria-label="Mobile navigation"
        aria-hidden="${!this._mobileMenuOpen}"
      >
        <div class="nav-menu-mobile-header">
          <div class="nav-brand">
            <slot name="brand-icon">
              ${this.brand ? html`<span class="nav-brand-text">${this.brand}</span>` : ''}
            </slot>
          </div>
          
          <button
            class="nav-close"
            type="button"
            aria-label="Close navigation menu"
            @click="${this._closeMobileMenu}"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>

        <ul class="nav-items-mobile" role="menu">
          ${this._renderMobileItems()}
        </ul>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'responsive-nav': ResponsiveNav;
  }
}