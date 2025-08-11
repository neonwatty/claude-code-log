import { LitElement, html, css, CSSResult, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { baseStyles } from '../styles/theme.js';

/**
 * Breakpoint definitions matching common responsive design patterns
 */
export interface BreakpointConfig {
  sm: number;   // Small screens (tablets)
  md: number;   // Medium screens (small laptops)
  lg: number;   // Large screens (desktops)
  xl: number;   // Extra large screens
}

export const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  sm: 640,   // Similar to Tailwind's sm: breakpoint
  md: 768,   // Similar to Tailwind's md: breakpoint  
  lg: 1024,  // Similar to Tailwind's lg: breakpoint
  xl: 1280,  // Similar to Tailwind's xl: breakpoint
};

export type BreakpointKey = 'mobile' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Layout template types for different responsive layouts
 */
export type LayoutTemplate = 'default' | 'grid' | 'flex' | 'sidebar-left' | 'sidebar-right' | 'full-width';

/**
 * Grid layout configuration
 */
export interface GridLayoutConfig {
  columns: {
    mobile: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  gap: string;
  autoRows?: string;
}

/**
 * Responsive Layout Component Base
 * 
 * Provides responsive breakpoint detection and reactive properties for building
 * responsive web components using Lit's template system.
 * 
 * Features:
 * - Automatic breakpoint detection using ResizeObserver
 * - Reactive properties that trigger re-renders on breakpoint changes
 * - Customizable breakpoint values
 * - Slot-based content projection
 * - Built-in responsive utility classes
 */
@customElement('responsive-layout')
export class ResponsiveLayout extends LitElement {
  static styles: CSSResult = css`
    ${baseStyles}
    
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    .responsive-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      width: 100%;
    }

    .responsive-header {
      flex-shrink: 0;
      width: 100%;
    }

    .responsive-main {
      display: flex;
      flex: 1;
      width: 100%;
      min-height: 0; /* Prevent flex item from growing beyond container */
    }

    .responsive-content {
      flex: 1;
      min-width: 0; /* Prevent flex item overflow */
      padding: var(--space-md);
    }

    .responsive-sidebar {
      flex-shrink: 0;
      background-color: var(--color-background-secondary);
      border-right: 1px solid var(--color-border);
      transition: all var(--transition-base);
    }

    .responsive-footer {
      flex-shrink: 0;
      width: 100%;
      padding: var(--space-md);
      background-color: var(--color-background-secondary);
      border-top: 1px solid var(--color-border);
    }

    /* Mobile-first responsive breakpoints */
    
    /* Mobile styles (default) */
    .responsive-main {
      flex-direction: column;
    }

    .responsive-sidebar {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--color-border);
    }

    .responsive-content {
      padding: var(--space-sm);
    }

    /* Small screens and up (640px+) */
    :host([breakpoint="sm"]) .responsive-main,
    :host([breakpoint="md"]) .responsive-main,
    :host([breakpoint="lg"]) .responsive-main,
    :host([breakpoint="xl"]) .responsive-main {
      flex-direction: row;
    }

    :host([breakpoint="sm"]) .responsive-sidebar,
    :host([breakpoint="md"]) .responsive-sidebar,
    :host([breakpoint="lg"]) .responsive-sidebar,
    :host([breakpoint="xl"]) .responsive-sidebar {
      width: 250px;
      border-right: 1px solid var(--color-border);
      border-bottom: none;
    }

    :host([breakpoint="sm"]) .responsive-content,
    :host([breakpoint="md"]) .responsive-content,
    :host([breakpoint="lg"]) .responsive-content,
    :host([breakpoint="xl"]) .responsive-content {
      padding: var(--space-md);
    }

    /* Medium screens and up (768px+) */
    :host([breakpoint="md"]) .responsive-sidebar,
    :host([breakpoint="lg"]) .responsive-sidebar,
    :host([breakpoint="xl"]) .responsive-sidebar {
      width: 280px;
    }

    :host([breakpoint="md"]) .responsive-content,
    :host([breakpoint="lg"]) .responsive-content,
    :host([breakpoint="xl"]) .responsive-content {
      padding: var(--space-lg);
    }

    /* Large screens and up (1024px+) */
    :host([breakpoint="lg"]) .responsive-sidebar,
    :host([breakpoint="xl"]) .responsive-sidebar {
      width: 320px;
    }

    /* Extra large screens and up (1280px+) */
    :host([breakpoint="xl"]) .responsive-sidebar {
      width: 360px;
    }

    :host([breakpoint="xl"]) .responsive-content {
      padding: var(--space-xl);
    }

    /* Hide sidebar when hasSidebar is false */
    :host([has-sidebar="false"]) .responsive-sidebar {
      display: none;
    }

    /* Debug styles - only shown when debug attribute is present */
    :host([debug]) {
      position: relative;
    }

    :host([debug])::before {
      content: attr(breakpoint);
      position: fixed;
      top: 0;
      right: 0;
      z-index: var(--z-tooltip);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      padding: var(--space-xs) var(--space-sm);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      border-radius: 0 0 0 var(--border-radius);
      box-shadow: var(--shadow);
    }

    /* Grid Layout Templates */
    .layout-template-grid .responsive-content {
      display: grid;
      gap: var(--grid-gap, var(--space-md));
      grid-auto-rows: var(--grid-auto-rows, minmax(200px, auto));
      padding: var(--space-md);
    }

    /* Mobile grid - 1 column */
    .layout-template-grid .responsive-content {
      grid-template-columns: repeat(var(--grid-cols-mobile, 1), 1fr);
    }

    /* Small screens - configurable columns */
    :host([breakpoint="sm"]) .layout-template-grid .responsive-content,
    :host([breakpoint="md"]) .layout-template-grid .responsive-content,
    :host([breakpoint="lg"]) .layout-template-grid .responsive-content,
    :host([breakpoint="xl"]) .layout-template-grid .responsive-content {
      grid-template-columns: repeat(var(--grid-cols-sm, 2), 1fr);
    }

    /* Medium screens */
    :host([breakpoint="md"]) .layout-template-grid .responsive-content,
    :host([breakpoint="lg"]) .layout-template-grid .responsive-content,
    :host([breakpoint="xl"]) .layout-template-grid .responsive-content {
      grid-template-columns: repeat(var(--grid-cols-md, 2), 1fr);
    }

    /* Large screens */
    :host([breakpoint="lg"]) .layout-template-grid .responsive-content,
    :host([breakpoint="xl"]) .layout-template-grid .responsive-content {
      grid-template-columns: repeat(var(--grid-cols-lg, 3), 1fr);
    }

    /* Extra large screens */
    :host([breakpoint="xl"]) .layout-template-grid .responsive-content {
      grid-template-columns: repeat(var(--grid-cols-xl, 4), 1fr);
    }

    /* Flexbox Layout Templates */
    .layout-template-flex .responsive-content {
      display: flex;
      flex-wrap: wrap;
      gap: var(--flex-gap, var(--space-md));
      padding: var(--space-md);
    }

    /* Mobile flex - column direction */
    .layout-template-flex .responsive-content {
      flex-direction: var(--flex-direction-mobile, column);
    }

    /* Small screens and up - row direction */
    :host([breakpoint="sm"]) .layout-template-flex .responsive-content,
    :host([breakpoint="md"]) .layout-template-flex .responsive-content,
    :host([breakpoint="lg"]) .layout-template-flex .responsive-content,
    :host([breakpoint="xl"]) .layout-template-flex .responsive-content {
      flex-direction: var(--flex-direction-sm, row);
    }

    /* Flex item sizing utilities */
    .layout-template-flex .responsive-content ::slotted(*) {
      flex: var(--flex-item, 1 1 auto);
      min-width: var(--flex-item-min-width, 0);
    }

    /* Sidebar Layout Templates */
    .layout-template-sidebar-left .responsive-main {
      flex-direction: row;
    }

    .layout-template-sidebar-left .responsive-sidebar {
      order: 1;
    }

    .layout-template-sidebar-left .responsive-content {
      order: 2;
    }

    .layout-template-sidebar-right .responsive-main {
      flex-direction: row;
    }

    .layout-template-sidebar-right .responsive-sidebar {
      order: 2;
    }

    .layout-template-sidebar-right .responsive-content {
      order: 1;
    }

    /* Mobile sidebar layouts stack vertically */
    .layout-template-sidebar-left .responsive-main,
    .layout-template-sidebar-right .responsive-main {
      flex-direction: column;
    }

    :host([breakpoint="sm"]) .layout-template-sidebar-left .responsive-main,
    :host([breakpoint="md"]) .layout-template-sidebar-left .responsive-main,
    :host([breakpoint="lg"]) .layout-template-sidebar-left .responsive-main,
    :host([breakpoint="xl"]) .layout-template-sidebar-left .responsive-main,
    :host([breakpoint="sm"]) .layout-template-sidebar-right .responsive-main,
    :host([breakpoint="md"]) .layout-template-sidebar-right .responsive-main,
    :host([breakpoint="lg"]) .layout-template-sidebar-right .responsive-main,
    :host([breakpoint="xl"]) .layout-template-sidebar-right .responsive-main {
      flex-direction: row;
    }

    /* Full Width Layout Template */
    .layout-template-full-width .responsive-main {
      flex-direction: column;
    }

    .layout-template-full-width .responsive-content {
      width: 100%;
      max-width: none;
      padding: var(--space-lg);
    }

    .layout-template-full-width .responsive-sidebar {
      display: none;
    }

    /* Content area utilities for different layouts */
    .content-grid-item {
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      padding: var(--space-md);
      box-shadow: var(--shadow-sm);
      transition: all var(--transition-fast);
    }

    .content-grid-item:hover {
      box-shadow: var(--shadow);
      transform: translateY(-2px);
    }

    .content-flex-item {
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      padding: var(--space-md);
      min-width: 200px;
      flex: 1 1 auto;
    }

    /* Responsive content utilities */
    .responsive-grid {
      display: grid;
      gap: var(--space-md);
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    }

    .responsive-flex {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-md);
    }

    .responsive-flex > * {
      flex: 1 1 300px;
      min-width: 0;
    }
  `;

  /**
   * Custom breakpoint configuration
   */
  @property({ type: Object })
  breakpoints: BreakpointConfig = DEFAULT_BREAKPOINTS;

  /**
   * Current breakpoint key
   */
  @property({ type: String, reflect: true })
  breakpoint: BreakpointKey = 'mobile';

  /**
   * Current viewport width in pixels
   */
  @property({ type: Number })
  viewportWidth: number = 0;

  /**
   * Whether to show the sidebar
   */
  @property({ type: Boolean, attribute: 'has-sidebar', reflect: true })
  hasSidebar: boolean = true;

  /**
   * Debug mode - shows current breakpoint indicator
   */
  @property({ type: Boolean, reflect: true })
  debug: boolean = false;

  /**
   * Layout template type
   */
  @property({ type: String, attribute: 'layout-template', reflect: true })
  layoutTemplate: LayoutTemplate = 'default';

  /**
   * Grid layout configuration
   */
  @property({ type: Object })
  gridConfig: GridLayoutConfig = {
    columns: { mobile: 1, sm: 2, md: 2, lg: 3, xl: 4 },
    gap: 'var(--space-md)',
    autoRows: 'minmax(200px, auto)'
  };

  /**
   * Internal state for resize observer
   */
  @state()
  private _resizeObserver?: ResizeObserver;

  connectedCallback() {
    super.connectedCallback();
    this._initializeBreakpointDetection();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._cleanupBreakpointDetection();
  }

  /**
   * Initialize breakpoint detection using ResizeObserver
   */
  private _initializeBreakpointDetection() {
    // Initial viewport width detection
    this._updateViewportWidth();

    // Set up ResizeObserver for responsive updates
    if ('ResizeObserver' in window) {
      this._resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          this._updateBreakpoint(width);
        }
      });

      // Observe the host element itself
      this._resizeObserver.observe(this);
    } else {
      // Fallback for browsers without ResizeObserver
      this._setupFallbackBreakpointDetection();
    }
  }

  /**
   * Fallback breakpoint detection using window resize events
   */
  private _setupFallbackBreakpointDetection() {
    const handleResize = () => {
      this._updateViewportWidth();
    };

    window.addEventListener('resize', handleResize);
    
    // Store the cleanup function
    (this as any)._fallbackCleanup = () => {
      window.removeEventListener('resize', handleResize);
    };
  }

  /**
   * Update viewport width from window.innerWidth
   */
  private _updateViewportWidth() {
    const width = window.innerWidth;
    this._updateBreakpoint(width);
  }

  /**
   * Update breakpoint based on width
   */
  private _updateBreakpoint(width: number) {
    this.viewportWidth = width;
    
    let newBreakpoint: BreakpointKey = 'mobile';
    
    if (width >= this.breakpoints.xl) {
      newBreakpoint = 'xl';
    } else if (width >= this.breakpoints.lg) {
      newBreakpoint = 'lg';
    } else if (width >= this.breakpoints.md) {
      newBreakpoint = 'md';
    } else if (width >= this.breakpoints.sm) {
      newBreakpoint = 'sm';
    }

    if (newBreakpoint !== this.breakpoint) {
      const oldBreakpoint = this.breakpoint;
      this.breakpoint = newBreakpoint;
      
      // Dispatch custom event for breakpoint change
      this.dispatchEvent(new CustomEvent('breakpoint-change', {
        detail: {
          breakpoint: newBreakpoint,
          oldBreakpoint,
          viewportWidth: width
        },
        bubbles: true
      }));
    }
  }

  /**
   * Clean up breakpoint detection
   */
  private _cleanupBreakpointDetection() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    
    // Clean up fallback if it was set up
    if ((this as any)._fallbackCleanup) {
      (this as any)._fallbackCleanup();
    }
  }

  /**
   * Get the current breakpoint information
   */
  getCurrentBreakpoint() {
    return {
      key: this.breakpoint,
      viewportWidth: this.viewportWidth,
      breakpoints: this.breakpoints
    };
  }

  /**
   * Check if current breakpoint is at least the specified size
   */
  isBreakpointAtLeast(breakpoint: BreakpointKey): boolean {
    const breakpointOrder: BreakpointKey[] = ['mobile', 'sm', 'md', 'lg', 'xl'];
    const currentIndex = breakpointOrder.indexOf(this.breakpoint);
    const targetIndex = breakpointOrder.indexOf(breakpoint);
    return currentIndex >= targetIndex;
  }

  /**
   * Set CSS custom properties for grid configuration
   */
  private _setGridCSSProperties() {
    if (this.layoutTemplate === 'grid') {
      this.style.setProperty('--grid-cols-mobile', this.gridConfig.columns.mobile.toString());
      this.style.setProperty('--grid-cols-sm', this.gridConfig.columns.sm.toString());
      this.style.setProperty('--grid-cols-md', this.gridConfig.columns.md.toString());
      this.style.setProperty('--grid-cols-lg', this.gridConfig.columns.lg.toString());
      this.style.setProperty('--grid-cols-xl', this.gridConfig.columns.xl.toString());
      this.style.setProperty('--grid-gap', this.gridConfig.gap);
      
      if (this.gridConfig.autoRows) {
        this.style.setProperty('--grid-auto-rows', this.gridConfig.autoRows);
      }
    }
  }

  /**
   * Get CSS classes for the container based on layout template
   */
  private _getContainerClasses(): string {
    const classes = ['responsive-container'];
    if (this.layoutTemplate !== 'default') {
      classes.push(`layout-template-${this.layoutTemplate}`);
    }
    return classes.join(' ');
  }

  /**
   * Render content based on layout template
   */
  private _renderContent(): TemplateResult {
    switch (this.layoutTemplate) {
      case 'grid':
        return html`
          <section class="responsive-content">
            <slot></slot>
          </section>
        `;
      
      case 'flex':
        return html`
          <section class="responsive-content">
            <slot></slot>
          </section>
        `;
      
      case 'sidebar-left':
      case 'sidebar-right':
        return html`
          ${this.hasSidebar ? html`
            <aside class="responsive-sidebar">
              <slot name="sidebar"></slot>
            </aside>
          ` : ''}
          
          <section class="responsive-content">
            <slot></slot>
          </section>
        `;
      
      case 'full-width':
        return html`
          <section class="responsive-content">
            <slot></slot>
          </section>
        `;
      
      default:
        return html`
          ${this.hasSidebar ? html`
            <aside class="responsive-sidebar">
              <slot name="sidebar"></slot>
            </aside>
          ` : ''}
          
          <section class="responsive-content">
            <slot></slot>
          </section>
        `;
    }
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    
    if (changedProperties.has('gridConfig') || changedProperties.has('layoutTemplate')) {
      this._setGridCSSProperties();
    }
  }

  render() {
    // Set grid CSS properties before rendering
    this._setGridCSSProperties();
    
    return html`
      <div class="${this._getContainerClasses()}">
        <header class="responsive-header">
          <slot name="header"></slot>
        </header>
        
        <main class="responsive-main">
          ${this._renderContent()}
        </main>
        
        <footer class="responsive-footer">
          <slot name="footer"></slot>
        </footer>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'responsive-layout': ResponsiveLayout;
  }
}