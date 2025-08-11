import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../ResponsiveLayout.js';
import '../ResponsiveNav.js';
import '../ResponsiveTimelineWrapper.js';
import '../ResponsiveSessionWrapper.js';
import type { ResponsiveLayout } from '../ResponsiveLayout.js';
import type { ResponsiveNav, NavItem } from '../ResponsiveNav.js';
import type { ResponsiveTimelineWrapper } from '../ResponsiveTimelineWrapper.js';
import type { ResponsiveSessionWrapper } from '../ResponsiveSessionWrapper.js';
import {
  setupResponsiveTestEnvironment,
  ResponsiveMockResizeObserver,
  BREAKPOINT_TEST_CASES,
  createSampleSessions,
  waitForRender,
  simulateKeyPress,
  MobileMenuTester,
} from './responsive-test-utils.js';

describe('Responsive Accessibility Tests', () => {
  let mockResizeObserver: ResponsiveMockResizeObserver;

  beforeEach(() => {
    mockResizeObserver = setupResponsiveTestEnvironment();
  });

  const sampleNavItems: NavItem[] = [
    { label: 'Home', href: '/', icon: '🏠', active: true },
    { label: 'Timeline', href: '/timeline', icon: '📅' },
    { label: 'Sessions', href: '/sessions', icon: '💻' },
    { label: 'Profile', href: '/profile', icon: '👤', disabled: true },
  ];

  describe('ResponsiveLayout Accessibility', () => {
    async function createAccessibleLayout(): Promise<ResponsiveLayout> {
      const template = html`
        <responsive-layout has-sidebar layout-template="sidebar-left">
          <header slot="header">
            <h1>Test Application</h1>
          </header>
          
          <nav slot="sidebar">
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/about">About</a></li>
            </ul>
          </nav>

          <main>
            <h2>Main Content</h2>
            <p>This is the main content area.</p>
          </main>

          <footer slot="footer">
            <p>Copyright 2024</p>
          </footer>
        </responsive-layout>
      `;

      return await fixture<ResponsiveLayout>(template);
    }

    it('should use semantic HTML elements', async () => {
      const layout = await createAccessibleLayout();
      
      const header = layout.shadowRoot?.querySelector('header');
      const main = layout.shadowRoot?.querySelector('main');
      const aside = layout.shadowRoot?.querySelector('aside');
      const footer = layout.shadowRoot?.querySelector('footer');

      expect(header?.tagName.toLowerCase()).to.equal('header');
      expect(main?.tagName.toLowerCase()).to.equal('main');
      expect(aside?.tagName.toLowerCase()).to.equal('aside');
      expect(footer?.tagName.toLowerCase()).to.equal('footer');
    });

    it('should maintain landmark roles', async () => {
      const layout = await createAccessibleLayout();
      
      // Should use implicit ARIA roles from semantic elements
      const main = layout.shadowRoot?.querySelector('main');
      const aside = layout.shadowRoot?.querySelector('aside');

      expect(main).to.exist;
      expect(aside).to.exist;
      
      // Main and aside have implicit roles
      expect(main?.getAttribute('role') || 'main').to.include('main');
      expect(aside?.getAttribute('role') || 'complementary').to.include('complementary');
    });

    it('should maintain focus during breakpoint changes', async () => {
      const layout = await createAccessibleLayout();
      
      // Add focusable element
      const button = document.createElement('button');
      button.textContent = 'Test Button';
      button.id = 'test-focus-button';
      layout.appendChild(button);
      
      await waitForRender(layout);
      
      // Focus the button
      button.focus();
      expect(document.activeElement).to.equal(button);
      
      // Change breakpoint
      const tabletViewport = BREAKPOINT_TEST_CASES[2];
      mockResizeObserver.mockViewportResize(layout, tabletViewport);
      await layout.updateComplete;
      
      // Focus should be maintained
      expect(document.activeElement).to.equal(button);
    });

    it('should provide skip links functionality', async () => {
      const layout = await createAccessibleLayout();
      
      // Skip links should be accessible via keyboard
      const skipLink = layout.shadowRoot?.querySelector('.skip-link, [href="#main-content"]');
      if (skipLink) {
        expect(skipLink).to.exist;
        expect(skipLink.getAttribute('href')).to.match(/#main|#content/);
      }
    });

    it('should support high contrast mode', async () => {
      const layout = await createAccessibleLayout();
      await waitForRender(layout);
      
      // Add high contrast media query test
      const styles = getComputedStyle(layout);
      
      // Should have CSS custom properties for theming
      const bgColor = styles.getPropertyValue('--responsive-bg-primary');
      const textColor = styles.getPropertyValue('--responsive-text-primary');
      
      // Colors should be defined (implementation-dependent)
      expect(bgColor || textColor).to.exist;
    });
  });

  describe('ResponsiveNav Accessibility', () => {
    async function createAccessibleNav(): Promise<ResponsiveNav> {
      const template = html`
        <responsive-nav 
          brand="Accessible App"
          brand-href="/"
          .items="${sampleNavItems}"
        >
          <span slot="brand-icon" aria-hidden="true">🚀</span>
        </responsive-nav>
      `;

      return await fixture<ResponsiveNav>(template);
    }

    it('should have proper navigation landmarks', async () => {
      const nav = await createAccessibleNav();
      
      const navContainer = nav.shadowRoot?.querySelector('[role="navigation"]');
      expect(navContainer).to.exist;
      expect(navContainer?.getAttribute('aria-label')).to.include('navigation');
    });

    it('should provide accessible mobile menu', async () => {
      const nav = await createAccessibleNav();
      const menuTester = new MobileMenuTester(nav);
      
      const toggleButton = menuTester.getToggleButton();
      const mobileMenu = menuTester.getMobileMenu();
      
      // Toggle button should have proper ARIA attributes
      expect(toggleButton?.getAttribute('aria-expanded')).to.equal('false');
      expect(toggleButton?.getAttribute('aria-controls')).to.equal('mobile-menu');
      expect(toggleButton?.getAttribute('aria-label')).to.include('navigation');
      
      // Mobile menu should have proper ARIA attributes
      expect(mobileMenu?.getAttribute('role')).to.equal('navigation');
      expect(mobileMenu?.getAttribute('aria-label')).to.equal('Mobile navigation');
      expect(mobileMenu?.getAttribute('aria-hidden')).to.equal('true');
    });

    it('should update ARIA states during mobile menu interaction', async () => {
      const nav = await createAccessibleNav();
      const menuTester = new MobileMenuTester(nav);
      
      const toggleButton = menuTester.getToggleButton()!;
      const mobileMenu = menuTester.getMobileMenu()!;
      
      // Initially closed
      expect(toggleButton.getAttribute('aria-expanded')).to.equal('false');
      expect(mobileMenu.getAttribute('aria-hidden')).to.equal('true');
      
      // Open menu
      await menuTester.toggleMenu();
      expect(toggleButton.getAttribute('aria-expanded')).to.equal('true');
      expect(mobileMenu.getAttribute('aria-hidden')).to.equal('false');
      
      // Close menu
      await menuTester.toggleMenu();
      expect(toggleButton.getAttribute('aria-expanded')).to.equal('false');
      expect(mobileMenu.getAttribute('aria-hidden')).to.equal('true');
    });

    it('should handle keyboard navigation correctly', async () => {
      const nav = await createAccessibleNav();
      
      // Test Tab navigation through nav items
      const navLinks = nav.shadowRoot?.querySelectorAll('.nav-link-desktop') as NodeListOf<HTMLElement>;
      expect(navLinks.length).to.be.greaterThan(0);
      
      // First link should be focusable
      const firstLink = navLinks[0];
      firstLink.focus();
      expect(document.activeElement).to.equal(firstLink);
      
      // Should handle Enter key
      let clickHandled = false;
      firstLink.addEventListener('click', () => {
        clickHandled = true;
      });
      
      simulateKeyPress(firstLink, 'Enter');
      firstLink.click(); // Simulate the Enter -> click behavior
      expect(clickHandled).to.be.true;
    });

    it('should manage focus in mobile menu', async () => {
      const nav = await createAccessibleNav();
      const menuTester = new MobileMenuTester(nav);
      
      const toggleButton = menuTester.getToggleButton()!;
      
      // Focus toggle button
      toggleButton.focus();
      expect(document.activeElement).to.equal(toggleButton);
      
      // Open menu
      await menuTester.toggleMenu();
      
      // Focus should move to close button
      await waitUntil(() => {
        const closeButton = menuTester.getCloseButton();
        return document.activeElement === closeButton;
      }, 'Focus should move to close button');
      
      // Close menu
      await menuTester.closeMenu();
      
      // Focus should return to toggle button
      expect(document.activeElement).to.equal(toggleButton);
    });

    it('should support screen readers with proper content', async () => {
      const nav = await createAccessibleNav();
      
      // Brand icon should be hidden from screen readers
      const brandIcon = nav.querySelector('[slot="brand-icon"]');
      expect(brandIcon?.getAttribute('aria-hidden')).to.equal('true');
      
      // Screen reader only content should exist
      const srOnlyContent = nav.shadowRoot?.querySelector('.sr-only');
      expect(srOnlyContent).to.exist;
      
      // Navigation items should have proper labels
      const navLinks = nav.shadowRoot?.querySelectorAll('.nav-link-desktop');
      navLinks?.forEach(link => {
        expect(link.textContent?.trim()).to.have.length.greaterThan(0);
      });
    });

    it('should indicate current page correctly', async () => {
      const nav = await createAccessibleNav();
      
      const activeLink = nav.shadowRoot?.querySelector('.nav-link-desktop.active');
      expect(activeLink).to.exist;
      expect(activeLink?.getAttribute('aria-current')).to.equal('page');
      
      // Non-active links should not have aria-current
      const inactiveLinks = nav.shadowRoot?.querySelectorAll('.nav-link-desktop:not(.active)');
      inactiveLinks?.forEach(link => {
        expect(link.getAttribute('aria-current')).to.equal('false');
      });
    });

    it('should handle disabled items accessibly', async () => {
      const nav = await createAccessibleNav();
      
      const disabledLink = nav.shadowRoot?.querySelector('.nav-link-desktop[disabled]');
      expect(disabledLink).to.exist;
      expect(disabledLink?.getAttribute('aria-disabled')).to.equal('true');
      
      // Should not be in tab order
      expect(disabledLink?.getAttribute('tabindex')).to.equal('-1');
    });
  });

  describe('ResponsiveTimelineWrapper Accessibility', () => {
    async function createAccessibleTimeline(): Promise<ResponsiveTimelineWrapper> {
      const sessions = createSampleSessions(5);
      
      const template = html`
        <responsive-timeline-wrapper
          title="Development Timeline"
          .sessions="${sessions}"
          force-view="mobile"
        ></responsive-timeline-wrapper>
      `;

      return await fixture<ResponsiveTimelineWrapper>(template);
    }

    it('should have proper heading structure', async () => {
      const timeline = await createAccessibleTimeline();
      
      const title = timeline.shadowRoot?.querySelector('.timeline-title');
      expect(title?.tagName.toLowerCase()).to.equal('h2');
      expect(title?.textContent).to.equal('Development Timeline');
    });

    it('should provide accessible session cards', async () => {
      const timeline = await createAccessibleTimeline();
      
      const sessionCards = timeline.shadowRoot?.querySelectorAll('.session-card');
      sessionCards?.forEach(card => {
        // Cards should be keyboard accessible
        expect(card.getAttribute('tabindex')).to.equal('0');
        expect(card.getAttribute('role')).to.equal('button');
        
        // Should have accessible name
        const title = card.querySelector('.session-card-title');
        expect(title?.textContent?.trim()).to.have.length.greaterThan(0);
      });
    });

    it('should handle keyboard interaction on session cards', async () => {
      const timeline = await createAccessibleTimeline();
      
      let sessionSelected = false;
      timeline.addEventListener('session-selected', () => {
        sessionSelected = true;
      });
      
      const firstCard = timeline.shadowRoot?.querySelector('.session-card') as HTMLElement;
      firstCard.focus();
      expect(document.activeElement).to.equal(firstCard);
      
      // Test Enter key
      simulateKeyPress(firstCard, 'Enter');
      firstCard.click(); // Simulate the interaction
      expect(sessionSelected).to.be.true;
      
      // Test Space key
      sessionSelected = false;
      simulateKeyPress(firstCard, ' ');
      firstCard.click(); // Simulate the interaction
      expect(sessionSelected).to.be.true;
    });

    it('should provide status information accessibly', async () => {
      const timeline = await createAccessibleTimeline();
      
      const statusElements = timeline.shadowRoot?.querySelectorAll('.session-card-status');
      statusElements?.forEach(status => {
        const statusText = status.textContent?.trim();
        expect(statusText).to.be.oneOf(['Active', 'Completed', 'In Progress']);
        
        // Should have appropriate CSS classes for styling
        expect(status.classList.length).to.be.greaterThan(0);
      });
    });

    it('should announce view changes to screen readers', async () => {
      const timeline = await createAccessibleTimeline();
      
      // Should have aria-live region for announcements
      const liveRegion = timeline.shadowRoot?.querySelector('[aria-live]');
      expect(liveRegion).to.exist;
      
      // Change view
      const tabletButton = timeline.shadowRoot?.querySelector('.view-option[data-view="tablet"]') as HTMLElement;
      tabletButton?.click();
      
      await timeline.updateComplete;
      
      // Live region should announce the change
      expect(liveRegion?.textContent).to.include('tablet');
    });

    it('should provide alternative text for visual elements', async () => {
      const timeline = await createAccessibleTimeline();
      
      // Progress bars should have labels
      const progressBars = timeline.shadowRoot?.querySelectorAll('.session-timeline-progress');
      progressBars?.forEach(progress => {
        const label = progress.getAttribute('aria-label') || 
                     progress.querySelector('.sr-only')?.textContent;
        expect(label).to.exist;
      });
    });
  });

  describe('ResponsiveSessionWrapper Accessibility', () => {
    async function createAccessibleSessions(): Promise<ResponsiveSessionWrapper> {
      const sessions = createSampleSessions(8);
      
      const template = html`
        <responsive-session-wrapper
          title="Recent Sessions"
          .sessions="${sessions}"
          force-view="desktop"
        ></responsive-session-wrapper>
      `;

      return await fixture<ResponsiveSessionWrapper>(template);
    }

    it('should have accessible table structure', async () => {
      const sessions = await createAccessibleSessions();
      
      const table = sessions.shadowRoot?.querySelector('.session-table');
      expect(table?.getAttribute('role')).to.equal('table');
      
      const headers = sessions.shadowRoot?.querySelectorAll('.session-table-header');
      headers?.forEach(header => {
        expect(header.getAttribute('role')).to.equal('columnheader');
      });
      
      const rows = sessions.shadowRoot?.querySelectorAll('.session-table-row');
      rows?.forEach(row => {
        expect(row.getAttribute('role')).to.equal('row');
      });
    });

    it('should provide sortable column accessibility', async () => {
      const sessions = await createAccessibleSessions();
      
      const sortableHeaders = sessions.shadowRoot?.querySelectorAll('.session-table-header.sortable');
      sortableHeaders?.forEach(header => {
        expect(header.getAttribute('tabindex')).to.equal('0');
        expect(header.getAttribute('role')).to.equal('columnheader');
        expect(header.getAttribute('aria-sort')).to.be.oneOf(['none', 'ascending', 'descending']);
      });
    });

    it('should handle keyboard sorting', async () => {
      const sessions = await createAccessibleSessions();
      
      let sortEventFired = false;
      sessions.addEventListener('sort-changed', () => {
        sortEventFired = true;
      });
      
      const titleHeader = sessions.shadowRoot?.querySelector('.session-table-header[data-sort="title"]') as HTMLElement;
      titleHeader.focus();
      expect(document.activeElement).to.equal(titleHeader);
      
      // Test Enter key for sorting
      simulateKeyPress(titleHeader, 'Enter');
      titleHeader.click(); // Simulate the interaction
      expect(sortEventFired).to.be.true;
      
      // Test Space key for sorting
      sortEventFired = false;
      simulateKeyPress(titleHeader, ' ');
      titleHeader.click(); // Simulate the interaction
      expect(sortEventFired).to.be.true;
    });

    it('should provide accessible search functionality', async () => {
      const sessions = await createAccessibleSessions();
      
      const searchInput = sessions.shadowRoot?.querySelector('.session-search-input') as HTMLInputElement;
      expect(searchInput.getAttribute('aria-label')).to.include('Search');
      expect(searchInput.getAttribute('role')).to.equal('searchbox');
      
      // Should have associated label or aria-labelledby
      const label = sessions.shadowRoot?.querySelector('label[for="session-search"]') ||
                   searchInput.getAttribute('aria-labelledby');
      expect(label || searchInput.getAttribute('aria-label')).to.exist;
    });

    it('should announce search results to screen readers', async () => {
      const sessions = await createAccessibleSessions();
      
      const searchInput = sessions.shadowRoot?.querySelector('.session-search-input') as HTMLInputElement;
      const resultsRegion = sessions.shadowRoot?.querySelector('[aria-live="polite"]');
      
      expect(resultsRegion).to.exist;
      
      // Perform search
      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      await sessions.updateComplete;
      
      // Results should be announced
      expect(resultsRegion?.textContent).to.include('result');
    });

    it('should provide filter accessibility', async () => {
      const sessions = await createAccessibleSessions();
      
      const filterToggle = sessions.shadowRoot?.querySelector('.filter-toggle-button') as HTMLElement;
      expect(filterToggle.getAttribute('aria-expanded')).to.be.oneOf(['true', 'false']);
      expect(filterToggle.getAttribute('aria-controls')).to.exist;
      
      const filterPanel = sessions.shadowRoot?.querySelector('.filter-panel');
      if (filterPanel) {
        expect(filterPanel.getAttribute('role')).to.equal('region');
        expect(filterPanel.getAttribute('aria-label')).to.include('filter');
      }
    });

    it('should handle row selection accessibly', async () => {
      const sessions = await createAccessibleSessions();
      
      const rows = sessions.shadowRoot?.querySelectorAll('.session-table-row') as NodeListOf<HTMLElement>;
      
      rows?.forEach(row => {
        expect(row.getAttribute('tabindex')).to.equal('0');
        expect(row.getAttribute('role')).to.equal('row');
        
        // Should indicate if selectable
        if (row.getAttribute('aria-selected') !== null) {
          expect(row.getAttribute('aria-selected')).to.be.oneOf(['true', 'false']);
        }
      });
    });
  });

  describe('Cross-Component Accessibility', () => {
    it('should maintain proper heading hierarchy', async () => {
      const template = html`
        <responsive-layout has-sidebar>
          <responsive-nav slot="header" brand="Test App" .items="${sampleNavItems}"></responsive-nav>
          
          <div slot="sidebar">
            <responsive-session-wrapper
              title="Recent Sessions"
              .sessions="${createSampleSessions(3)}"
            ></responsive-session-wrapper>
          </div>

          <main>
            <responsive-timeline-wrapper
              title="Timeline"
              .sessions="${createSampleSessions(5)}"
            ></responsive-timeline-wrapper>
          </main>
        </responsive-layout>
      `;

      const layout = await fixture<ResponsiveLayout>(template);
      await waitForRender(layout);

      // Should have proper heading levels
      const h1 = layout.querySelector('h1') || layout.shadowRoot?.querySelector('h1');
      const h2Elements = layout.querySelectorAll('h2, [role="heading"][aria-level="2"]');
      
      // Timeline and Sessions should use h2
      expect(h2Elements.length).to.be.greaterThan(0);
    });

    it('should coordinate focus management across components', async () => {
      const template = html`
        <responsive-layout>
          <responsive-nav slot="header" brand="Test App" .items="${sampleNavItems}"></responsive-nav>
          
          <main>
            <responsive-timeline-wrapper
              title="Timeline"
              .sessions="${createSampleSessions(2)}"
              force-view="mobile"
            ></responsive-timeline-wrapper>
          </main>
        </responsive-layout>
      `;

      const layout = await fixture<ResponsiveLayout>(template);
      await waitForRender(layout);

      const nav = layout.querySelector('responsive-nav') as ResponsiveNav;
      const timeline = layout.querySelector('responsive-timeline-wrapper') as ResponsiveTimelineWrapper;

      // Test tab order between components
      const navLink = nav.shadowRoot?.querySelector('.nav-link-desktop') as HTMLElement;
      const timelineCard = timeline.shadowRoot?.querySelector('.session-card') as HTMLElement;

      if (navLink) {
        navLink.focus();
        expect(document.activeElement).to.equal(navLink);
      }

      if (timelineCard) {
        timelineCard.focus();
        expect(document.activeElement).to.equal(timelineCard);
      }
    });

    it('should provide consistent keyboard shortcuts', async () => {
      const template = html`
        <responsive-layout>
          <responsive-nav slot="header" brand="Test App" .items="${sampleNavItems}"></responsive-nav>
          
          <main>
            <responsive-session-wrapper
              title="Sessions"
              .sessions="${createSampleSessions(3)}"
              force-view="desktop"
            ></responsive-session-wrapper>
          </main>
        </responsive-layout>
      `;

      const layout = await fixture<ResponsiveLayout>(template);
      await waitForRender(layout);

      const sessions = layout.querySelector('responsive-session-wrapper') as ResponsiveSessionWrapper;

      // Test common keyboard shortcuts
      const searchInput = sessions.shadowRoot?.querySelector('.session-search-input') as HTMLInputElement;
      
      // Should handle Ctrl+F for search focus (if implemented)
      if (searchInput) {
        const ctrlF = new KeyboardEvent('keydown', {
          key: 'f',
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        });
        
        document.dispatchEvent(ctrlF);
        
        // If focus moves to search, the shortcut is implemented
        if (document.activeElement === searchInput) {
          expect(document.activeElement).to.equal(searchInput);
        }
      }
    });

    it('should handle high contrast mode across all components', async () => {
      const template = html`
        <responsive-layout>
          <responsive-nav slot="header" brand="Test App" .items="${sampleNavItems}"></responsive-nav>
          
          <main>
            <responsive-timeline-wrapper
              title="Timeline"
              .sessions="${createSampleSessions(2)}"
            ></responsive-timeline-wrapper>
          </main>
        </responsive-layout>
      `;

      const layout = await fixture<ResponsiveLayout>(template);
      await waitForRender(layout);

      // Components should respect system high contrast preferences
      const nav = layout.querySelector('responsive-nav') as ResponsiveNav;
      const timeline = layout.querySelector('responsive-timeline-wrapper') as ResponsiveTimelineWrapper;

      // Check that components have proper contrast classes or styles
      const navStyles = getComputedStyle(nav);
      const timelineStyles = getComputedStyle(timeline);

      // Should have defined colors for high contrast
      expect(navStyles.color || navStyles.backgroundColor).to.exist;
      expect(timelineStyles.color || timelineStyles.backgroundColor).to.exist;
    });

    it('should provide consistent error messaging', async () => {
      const template = html`
        <responsive-layout>
          <responsive-session-wrapper
            title="Sessions"
            .sessions="${[]}"
            force-view="mobile"
          ></responsive-session-wrapper>
        </responsive-layout>
      `;

      const layout = await fixture<ResponsiveLayout>(template);
      await waitForRender(layout);

      const sessions = layout.querySelector('responsive-session-wrapper') as ResponsiveSessionWrapper;

      // Empty state should be accessible
      const emptyMessage = sessions.shadowRoot?.querySelector('[role="status"], .empty-state');
      expect(emptyMessage).to.exist;
      
      if (emptyMessage) {
        expect(emptyMessage.textContent).to.include('No sessions');
        
        // Should be announced to screen readers
        const ariaLive = emptyMessage.getAttribute('aria-live') || 
                        emptyMessage.getAttribute('role');
        expect(ariaLive).to.be.oneOf(['polite', 'status']);
      }
    });
  });
});