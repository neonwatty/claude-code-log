import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";

export type NavigationSection = 'dashboard' | 'sessions' | 'analytics';

export interface NavigationItem {
  id: NavigationSection;
  label: string;
  icon: string;
  description?: string;
}

@customElement("app-navigation")
export class AppNavigation extends BaseComponent {
  @property({ type: String, attribute: "active-section" })
  activeSection: NavigationSection = 'dashboard';

  @property({ type: Boolean, attribute: "mobile-view" })
  mobileView = false;

  @state()
  private isMenuOpen = false;

  private readonly navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      description: 'Overview and statistics'
    },
    {
      id: 'sessions',
      label: 'Sessions',
      icon: '💬',
      description: 'Browse conversation sessions'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '📈',
      description: 'Usage insights and trends'
    }
  ];

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        font-family: var(--font-family-sans);
      }

      /* Desktop Navigation - Horizontal Tabs */
      .nav-container {
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-sm);
        margin-bottom: var(--spacing-lg);
        box-shadow: var(--shadow-neumorphic);
        border: 1px solid var(--color-border-light);
      }

      .nav-tabs {
        display: flex;
        gap: var(--spacing-xs);
        justify-content: center;
      }

      .nav-tab {
        flex: 1;
        max-width: 200px;
        padding: var(--spacing-md) var(--spacing-lg);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        text-decoration: none;
        font-weight: var(--font-weight-medium);
        font-size: var(--font-size-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-xs);
        text-align: center;
      }

      .nav-tab:hover {
        background: var(--color-surface-hover);
        transform: var(--transform-hover);
        box-shadow: var(--shadow-md);
      }

      .nav-tab.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
        box-shadow: var(--shadow-lg);
      }

      .nav-tab-icon {
        font-size: 1.2em;
      }

      .nav-tab-label {
        font-weight: var(--font-weight-semibold);
      }

      .nav-tab-description {
        font-size: var(--font-size-xs);
        opacity: 0.8;
        margin-top: var(--spacing-xs);
      }

      .nav-tab.active .nav-tab-description {
        opacity: 0.9;
      }

      /* Mobile Navigation - Bottom Tabs */
      .mobile-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--color-surface);
        border-top: 1px solid var(--color-border-light);
        box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        padding: var(--spacing-sm) var(--spacing-md);
        padding-bottom: calc(var(--spacing-sm) + env(safe-area-inset-bottom));
      }

      .mobile-nav-tabs {
        display: flex;
        justify-content: space-around;
        gap: var(--spacing-sm);
      }

      .mobile-nav-tab {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-xs);
        padding: var(--spacing-sm);
        border-radius: var(--border-radius-sm);
        color: var(--color-text-muted);
        text-decoration: none;
        cursor: pointer;
        transition: all var(--transition-fast);
        min-height: 60px;
        justify-content: center;
      }

      .mobile-nav-tab:hover,
      .mobile-nav-tab.active {
        color: var(--color-primary);
        background: var(--color-primary-light);
      }

      .mobile-nav-icon {
        font-size: 1.4em;
      }

      .mobile-nav-label {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        text-align: center;
      }

      /* Hide desktop nav on mobile */
      @media (max-width: 768px) {
        .nav-container {
          display: none;
        }

        /* Add bottom padding to body content to account for fixed nav */
        :host([mobile-view]) {
          padding-bottom: 80px;
        }
      }

      /* Hide mobile nav on desktop */
      @media (min-width: 769px) {
        .mobile-nav {
          display: none;
        }
      }

      /* Responsive adjustments */
      @media (max-width: 480px) {
        .mobile-nav-label {
          display: none;
        }

        .mobile-nav-tab {
          min-height: 50px;
        }

        .mobile-nav-icon {
          font-size: 1.6em;
        }
      }
    `
  ];

  private handleTabClick(section: NavigationSection, event: Event): void {
    event.preventDefault();
    
    if (this.activeSection !== section) {
      this.activeSection = section;
      this.emitEvent('navigation-change', { section });
    }
  }

  private renderDesktopNavigation(): TemplateResult {
    return html`
      <div class="nav-container">
        <nav class="nav-tabs" role="tablist">
          ${this.navigationItems.map(item => html`
            <button
              class="nav-tab ${this.activeSection === item.id ? 'active' : ''}"
              role="tab"
              aria-selected=${this.activeSection === item.id}
              aria-controls="content-${item.id}"
              @click=${(e: Event) => this.handleTabClick(item.id, e)}
            >
              <span class="nav-tab-icon">${item.icon}</span>
              <span class="nav-tab-label">${item.label}</span>
              ${item.description ? html`
                <span class="nav-tab-description">${item.description}</span>
              ` : ''}
            </button>
          `)}
        </nav>
      </div>
    `;
  }

  private renderMobileNavigation(): TemplateResult {
    return html`
      <div class="mobile-nav">
        <nav class="mobile-nav-tabs" role="tablist">
          ${this.navigationItems.map(item => html`
            <button
              class="mobile-nav-tab ${this.activeSection === item.id ? 'active' : ''}"
              role="tab"
              aria-selected=${this.activeSection === item.id}
              aria-controls="content-${item.id}"
              aria-label="${item.label} - ${item.description || ''}"
              @click=${(e: Event) => this.handleTabClick(item.id, e)}
            >
              <span class="mobile-nav-icon">${item.icon}</span>
              <span class="mobile-nav-label">${item.label}</span>
            </button>
          `)}
        </nav>
      </div>
    `;
  }

  protected safeRender(): TemplateResult {
    return html`
      ${this.renderDesktopNavigation()}
      ${this.renderMobileNavigation()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-navigation": AppNavigation;
  }
}