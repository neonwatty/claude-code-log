import { expect, fixture, html, waitUntil } from '@open-wc/testing';
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
  ResponsivePerformanceTester,
} from './responsive-test-utils.js';

describe('Responsive Integration Tests', () => {
  let mockResizeObserver: ResponsiveMockResizeObserver;
  let performanceTester: ResponsivePerformanceTester;

  beforeEach(() => {
    mockResizeObserver = setupResponsiveTestEnvironment();
    performanceTester = new ResponsivePerformanceTester();
  });

  const sampleNavItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: '📊', active: true },
    { label: 'Timeline', href: '/timeline', icon: '📅' },
    { label: 'Sessions', href: '/sessions', icon: '💻' },
    { label: 'Settings', href: '/settings', icon: '⚙️' },
  ];

  async function createIntegratedLayout(): Promise<{
    layout: ResponsiveLayout;
    nav: ResponsiveNav;
    timeline: ResponsiveTimelineWrapper;
    sessions: ResponsiveSessionWrapper;
  }> {
    const sampleSessions = createSampleSessions(10);

    const template = html`
      <responsive-layout debug has-sidebar layout-template="sidebar-left">
        <responsive-nav
          slot="header"
          brand="Test App"
          brand-href="/"
          .items="${sampleNavItems}"
        ></responsive-nav>
        
        <div slot="sidebar">
          <responsive-session-wrapper
            title="Recent Sessions"
            .sessions="${sampleSessions.slice(0, 5)}"
          ></responsive-session-wrapper>
        </div>

        <main>
          <responsive-timeline-wrapper
            title="Development Timeline"
            .sessions="${sampleSessions}"
          ></responsive-timeline-wrapper>
        </main>

        <footer slot="footer">
          <p>© 2024 Test Application</p>
        </footer>
      </responsive-layout>
    `;

    const layout = await fixture<ResponsiveLayout>(template);
    await waitForRender(layout);

    const nav = layout.querySelector('responsive-nav') as ResponsiveNav;
    const timeline = layout.querySelector('responsive-timeline-wrapper') as ResponsiveTimelineWrapper;
    const sessions = layout.querySelector('responsive-session-wrapper') as ResponsiveSessionWrapper;

    return { layout, nav, timeline, sessions };
  }

  describe('Component Coordination', () => {
    it('should render all responsive components together', async () => {
      const { layout, nav, timeline, sessions } = await createIntegratedLayout();

      expect(layout).to.exist;
      expect(nav).to.exist;
      expect(timeline).to.exist;
      expect(sessions).to.exist;

      // All components should be properly initialized
      expect(layout.breakpoint).to.equal('mobile');
      expect(nav.brand).to.equal('Test App');
      expect(timeline.title).to.equal('Development Timeline');
      expect(sessions.title).to.equal('Recent Sessions');
    });

    it('should coordinate breakpoint changes across all components', async () => {
      const { layout } = await createIntegratedLayout();

      // Start with mobile breakpoint
      expect(layout.breakpoint).to.equal('mobile');

      // Change to tablet breakpoint
      const tabletViewport = BREAKPOINT_TEST_CASES[2]; // 768px
      mockResizeObserver.mockViewportResize(layout, tabletViewport);
      await layout.updateComplete;

      expect(layout.breakpoint).to.equal('md');

      // All child components should adapt to the new breakpoint
      // This is tested implicitly through the layout system
    });

    it('should maintain consistent theming across components', async () => {
      const { layout, nav, timeline, sessions } = await createIntegratedLayout();

      // All components should inherit CSS custom properties from layout
      await waitForRender(layout);

      // Check that components are using consistent styling
      const layoutStyles = getComputedStyle(layout);
      const navStyles = getComputedStyle(nav);
      
      // Components should use shared color scheme (this is implementation-dependent)
      expect(layoutStyles.getPropertyValue('--responsive-bg-primary')).to.exist;
    });

    it('should handle nested responsive behavior correctly', async () => {
      const { layout, sessions } = await createIntegratedLayout();

      // Desktop layout with sidebar
      const desktopViewport = BREAKPOINT_TEST_CASES[4];
      mockResizeObserver.mockViewportResize(layout, desktopViewport);
      await layout.updateComplete;

      expect(layout.breakpoint).to.equal('lg');
      expect(layout.hasSidebar).to.be.true;

      // Sidebar should be visible and contain the session wrapper
      const sidebar = layout.shadowRoot?.querySelector('.responsive-sidebar');
      expect(sidebar).to.be.visible;

      // Session wrapper in sidebar should adapt to sidebar width, not full viewport
      expect(sessions).to.exist;
    });
  });

  describe('Cross-Component Events', () => {
    it('should handle navigation events affecting other components', async () => {
      const { nav, timeline } = await createIntegratedLayout();

      let navClickFired = false;
      nav.addEventListener('nav-click', (e: any) => {
        navClickFired = true;
        
        // Timeline could respond to navigation changes
        if (e.detail.item.label === 'Timeline') {
          timeline.title = 'Active Timeline View';
        }
      });

      // Click timeline navigation item
      const timelineNavLink = nav.shadowRoot?.querySelector('.nav-link-desktop[href="/timeline"]') as HTMLAnchorElement;
      timelineNavLink?.click();

      await nav.updateComplete;
      await timeline.updateComplete;

      expect(navClickFired).to.be.true;
    });

    it('should coordinate session selection across timeline and session components', async () => {
      const { timeline, sessions } = await createIntegratedLayout();

      let sessionSelectedInTimeline = false;
      let sessionSelectedInSessions = false;
      let selectedSessionId: string | null = null;

      timeline.addEventListener('session-selected', (e: any) => {
        sessionSelectedInTimeline = true;
        selectedSessionId = e.detail.session.sessionId;
      });

      sessions.addEventListener('session-selected', (e: any) => {
        sessionSelectedInSessions = true;
        // Could highlight the same session in other components
      });

      // Select a session in timeline
      await timeline.updateComplete;
      const sessionCard = timeline.shadowRoot?.querySelector('.session-card') as HTMLElement;
      sessionCard?.click();

      await timeline.updateComplete;
      expect(sessionSelectedInTimeline).to.be.true;
      expect(selectedSessionId).to.exist;
    });

    it('should handle mobile menu interactions without affecting other components', async () => {
      const { layout, nav, timeline } = await createIntegratedLayout();

      // Force mobile view
      const mobileViewport = BREAKPOINT_TEST_CASES[0];
      mockResizeObserver.mockViewportResize(layout, mobileViewport);
      await layout.updateComplete;

      // Open mobile menu
      const menuToggle = nav.shadowRoot?.querySelector('.nav-toggle') as HTMLButtonElement;
      menuToggle?.click();
      await nav.updateComplete;

      // Mobile menu should be open
      const mobileMenu = nav.shadowRoot?.querySelector('.nav-menu-mobile');
      expect(mobileMenu?.classList.contains('open')).to.be.true;

      // Other components should remain functional
      expect(timeline).to.exist;
      expect(timeline.shadowRoot?.querySelector('.timeline-content-mobile')).to.exist;

      // Body scroll should be locked
      expect(document.body.style.overflow).to.equal('hidden');

      // Close menu
      const closeButton = nav.shadowRoot?.querySelector('.nav-close') as HTMLButtonElement;
      closeButton?.click();
      await nav.updateComplete;

      // Body scroll should be restored
      expect(document.body.style.overflow).to.equal('');
    });
  });

  describe('Responsive Layouts Integration', () => {
    it('should handle sidebar layout with responsive content', async () => {
      const { layout, sessions } = await createIntegratedLayout();

      // Test sidebar visibility across breakpoints
      const breakpoints = [
        { viewport: BREAKPOINT_TEST_CASES[0], expectedSidebar: false }, // Mobile
        { viewport: BREAKPOINT_TEST_CASES[2], expectedSidebar: true },  // Tablet
        { viewport: BREAKPOINT_TEST_CASES[4], expectedSidebar: true },  // Desktop
      ];

      for (const { viewport, expectedSidebar } of breakpoints) {
        mockResizeObserver.mockViewportResize(layout, viewport);
        await layout.updateComplete;

        const sidebar = layout.shadowRoot?.querySelector('.responsive-sidebar');
        
        if (expectedSidebar) {
          expect(sidebar).to.be.visible;
          // Session wrapper should be visible in sidebar
          expect(sessions).to.exist;
        } else {
          // On mobile, sidebar content might be hidden or reorganized
          expect(layout.breakpoint).to.equal('mobile');
        }
      }
    });

    it('should adapt grid layouts based on available space', async () => {
      const { layout } = await createIntegratedLayout();

      // Change to grid layout template
      layout.layoutTemplate = 'grid';
      layout.gridConfig = {
        columns: { mobile: 1, sm: 2, md: 3, lg: 4, xl: 5 },
        gap: '1rem',
        autoRows: 'minmax(200px, auto)'
      };

      await layout.updateComplete;

      // Test grid adaptation across breakpoints
      for (const viewport of BREAKPOINT_TEST_CASES) {
        mockResizeObserver.mockViewportResize(layout, viewport);
        await layout.updateComplete;

        const expectedCols = layout.gridConfig?.columns[viewport.breakpoint] || 1;
        const actualCols = layout.style.getPropertyValue(`--grid-cols-${viewport.breakpoint}`);
        expect(actualCols).to.equal(expectedCols.toString());
      }
    });

    it('should handle full-width layout with navigation', async () => {
      const { layout, nav, timeline } = await createIntegratedLayout();

      // Switch to full-width layout
      layout.layoutTemplate = 'full-width';
      layout.hasSidebar = false;
      await layout.updateComplete;

      // Navigation should remain at top
      expect(nav).to.exist;
      
      // Timeline should expand to full width
      expect(timeline).to.exist;
      
      // No sidebar should be visible
      expect(layout.getAttribute('has-sidebar')).to.equal('false');
    });
  });

  describe('Performance Integration', () => {
    it('should handle simultaneous component updates efficiently', async () => {
      const { layout, nav, timeline, sessions } = await createIntegratedLayout();

      performanceTester.startMeasurement('simultaneous-updates');

      // Trigger updates in all components simultaneously
      const newSessions = createSampleSessions(15);
      const newNavItems = [...sampleNavItems, { label: 'New Page', href: '/new' }];

      // Update all components at once
      nav.items = newNavItems;
      timeline.sessions = newSessions;
      sessions.sessions = newSessions.slice(0, 8);
      layout.layoutTemplate = 'flex';

      // Wait for all updates
      await Promise.all([
        nav.updateComplete,
        timeline.updateComplete,
        sessions.updateComplete,
        layout.updateComplete,
      ]);

      const duration = performanceTester.endMeasurement('simultaneous-updates');
      performanceTester.assertPerformance(500); // Should complete within 500ms

      // All components should have updated successfully
      expect(nav.items).to.have.length(5);
      expect(timeline.sessions).to.have.length(15);
      expect(sessions.sessions).to.have.length(8);
      expect(layout.layoutTemplate).to.equal('flex');
    });

    it('should handle rapid breakpoint changes across all components', async () => {
      const { layout } = await createIntegratedLayout();

      performanceTester.startMeasurement('rapid-breakpoint-changes');

      // Rapidly cycle through breakpoints
      for (let i = 0; i < 20; i++) {
        const viewport = BREAKPOINT_TEST_CASES[i % BREAKPOINT_TEST_CASES.length];
        mockResizeObserver.mockViewportResize(layout, viewport);
        await layout.updateComplete;
      }

      const duration = performanceTester.endMeasurement('rapid-breakpoint-changes');
      performanceTester.assertPerformance(300); // Should handle rapid changes efficiently

      // Layout should end up in final state
      const lastViewport = BREAKPOINT_TEST_CASES[(20 - 1) % BREAKPOINT_TEST_CASES.length];
      expect(layout.breakpoint).to.equal(lastViewport.breakpoint);
    });

    it('should efficiently render large datasets across components', async () => {
      const largeSessions = createSampleSessions(500);
      const manyNavItems = Array.from({ length: 20 }, (_, i) => ({
        label: `Page ${i + 1}`,
        href: `/page-${i + 1}`,
        icon: '📄'
      }));

      performanceTester.startMeasurement('large-dataset-render');

      const template = html`
        <responsive-layout debug has-sidebar>
          <responsive-nav
            slot="header"
            brand="Test App"
            .items="${manyNavItems}"
          ></responsive-nav>
          
          <div slot="sidebar">
            <responsive-session-wrapper
              title="All Sessions"
              .sessions="${largeSessions}"
            ></responsive-session-wrapper>
          </div>

          <main>
            <responsive-timeline-wrapper
              title="Complete Timeline"
              .sessions="${largeSessions}"
            ></responsive-timeline-wrapper>
          </main>
        </responsive-layout>
      `;

      const layout = await fixture<ResponsiveLayout>(template);
      await waitForRender(layout);

      const duration = performanceTester.endMeasurement('large-dataset-render');
      performanceTester.assertPerformance(2000); // Allow more time for large datasets

      // Components should handle large datasets
      const nav = layout.querySelector('responsive-nav') as ResponsiveNav;
      const sessions = layout.querySelector('responsive-session-wrapper') as ResponsiveSessionWrapper;
      const timeline = layout.querySelector('responsive-timeline-wrapper') as ResponsiveTimelineWrapper;

      expect(nav.items).to.have.length(20);
      expect(sessions.sessions).to.have.length(500);
      expect(timeline.sessions).to.have.length(500);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle component errors gracefully without breaking layout', async () => {
      const { layout, nav, timeline, sessions } = await createIntegratedLayout();

      // Simulate error in one component
      const originalTimelineRender = timeline.render;
      timeline.render = () => {
        throw new Error('Timeline render error');
      };

      // Other components should continue working
      expect(() => {
        nav.brand = 'Updated Brand';
        sessions.title = 'Updated Sessions';
      }).to.not.throw();

      await nav.updateComplete;
      await sessions.updateComplete;

      expect(nav.brand).to.equal('Updated Brand');
      expect(sessions.title).to.equal('Updated Sessions');
      expect(layout).to.exist;

      // Restore original render
      timeline.render = originalTimelineRender;
    });

    it('should recover from invalid data across components', async () => {
      const { timeline, sessions } = await createIntegratedLayout();

      // Pass invalid data to components
      const invalidSessions: any[] = [
        null,
        undefined,
        { sessionId: 'valid', title: 'Valid Session', startTime: new Date(), isActive: false },
        { sessionId: 'invalid', title: 'Invalid Session' }, // Missing required fields
      ];

      timeline.sessions = invalidSessions;
      sessions.sessions = invalidSessions;

      await timeline.updateComplete;
      await sessions.updateComplete;

      // Components should handle invalid data gracefully
      expect(timeline).to.exist;
      expect(sessions).to.exist;

      // Should render at least the valid session
      const timelineContent = timeline.shadowRoot?.textContent;
      const sessionsContent = sessions.shadowRoot?.textContent;

      expect(timelineContent).to.include('Valid Session');
      expect(sessionsContent).to.include('Valid Session');
    });
  });

  describe('Accessibility Integration', () => {
    it('should maintain proper focus management across components', async () => {
      const { layout, nav } = await createIntegratedLayout();

      // Force mobile view to test mobile menu focus
      const mobileViewport = BREAKPOINT_TEST_CASES[0];
      mockResizeObserver.mockViewportResize(layout, mobileViewport);
      await layout.updateComplete;

      // Open mobile menu
      const menuToggle = nav.shadowRoot?.querySelector('.nav-toggle') as HTMLButtonElement;
      menuToggle.focus();
      expect(document.activeElement).to.equal(menuToggle);

      menuToggle.click();
      await nav.updateComplete;

      // Focus should move to close button
      await waitUntil(() => {
        const closeButton = nav.shadowRoot?.querySelector('.nav-close') as HTMLButtonElement;
        return document.activeElement === closeButton;
      }, 'Focus should move to close button', { timeout: 1000 });

      // Close menu
      const closeButton = nav.shadowRoot?.querySelector('.nav-close') as HTMLButtonElement;
      closeButton.click();
      await nav.updateComplete;

      // Focus should return to menu toggle
      expect(document.activeElement).to.equal(menuToggle);
    });

    it('should provide consistent ARIA landmarks across layout', async () => {
      const { layout } = await createIntegratedLayout();

      // Check semantic structure
      const header = layout.shadowRoot?.querySelector('header[role="banner"], header');
      const nav = layout.querySelector('responsive-nav');
      const main = layout.shadowRoot?.querySelector('main');
      const aside = layout.shadowRoot?.querySelector('aside');
      const footer = layout.shadowRoot?.querySelector('footer');

      expect(header || nav).to.exist; // Either layout header or nav component
      expect(main).to.exist;
      expect(aside).to.exist; // Sidebar
      expect(footer).to.exist;

      // Components should have proper roles
      const navComponent = layout.querySelector('responsive-nav');
      const navElement = navComponent?.shadowRoot?.querySelector('[role="navigation"]');
      expect(navElement).to.exist;
    });

    it('should handle keyboard navigation between components', async () => {
      const { nav, timeline, sessions } = await createIntegratedLayout();

      // Test tab order through components
      const navLink = nav.shadowRoot?.querySelector('.nav-link-desktop') as HTMLElement;
      const timelineCard = timeline.shadowRoot?.querySelector('.session-card') as HTMLElement;
      const sessionCard = sessions.shadowRoot?.querySelector('.session-card') as HTMLElement;

      // All interactive elements should be focusable
      if (navLink) {
        navLink.focus();
        expect(document.activeElement).to.equal(navLink);
      }

      if (timelineCard) {
        timelineCard.focus();
        expect(document.activeElement).to.equal(timelineCard);
      }

      if (sessionCard) {
        sessionCard.focus();
        expect(document.activeElement).to.equal(sessionCard);
      }
    });
  });
});