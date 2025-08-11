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
  MemoryLeakTester,
} from './responsive-test-utils.js';

describe('Responsive Performance Tests', () => {
  let mockResizeObserver: ResponsiveMockResizeObserver;
  let performanceTester: ResponsivePerformanceTester;
  let memoryTester: MemoryLeakTester;

  beforeEach(() => {
    mockResizeObserver = setupResponsiveTestEnvironment();
    performanceTester = new ResponsivePerformanceTester();
    memoryTester = new MemoryLeakTester();
  });

  afterEach(() => {
    performanceTester.reset();
  });

  describe('ResponsiveLayout Performance', () => {
    it('should initialize quickly with default configuration', async () => {
      performanceTester.startMeasurement('layout-init');
      
      const template = html`
        <responsive-layout debug has-sidebar>
          <div slot="header">Header</div>
          <div slot="sidebar">Sidebar</div>
          <div>Main content</div>
          <div slot="footer">Footer</div>
        </responsive-layout>
      `;
      
      const layout = await fixture<ResponsiveLayout>(template);
      await waitForRender(layout);
      
      const duration = performanceTester.endMeasurement('layout-init');
      performanceTester.assertPerformance(50); // Should init in under 50ms
      
      expect(layout.breakpoint).to.equal('mobile');
    });

    it('should handle rapid breakpoint changes efficiently', async () => {
      const layout = await fixture<ResponsiveLayout>(html`
        <responsive-layout debug>
          <div>Content</div>
        </responsive-layout>
      `);

      performanceTester.startMeasurement('rapid-breakpoints');
      
      // Rapidly cycle through all breakpoints multiple times
      for (let cycle = 0; cycle < 10; cycle++) {
        for (const viewport of BREAKPOINT_TEST_CASES) {
          mockResizeObserver.mockViewportResize(layout, viewport);
          await layout.updateComplete;
        }
      }
      
      const duration = performanceTester.endMeasurement('rapid-breakpoints');
      performanceTester.assertPerformance(500); // Should handle 70 changes in under 500ms
      
      // Should end in correct state
      const lastViewport = BREAKPOINT_TEST_CASES[BREAKPOINT_TEST_CASES.length - 1];
      expect(layout.breakpoint).to.equal(lastViewport.breakpoint);
    });

    it('should efficiently update grid configuration', async () => {
      const layout = await fixture<ResponsiveLayout>(html`
        <responsive-layout layout-template="grid">
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </responsive-layout>
      `);

      performanceTester.startMeasurement('grid-updates');
      
      // Rapidly change grid configurations
      for (let i = 0; i < 50; i++) {
        layout.gridConfig = {
          columns: { 
            mobile: i % 3 + 1, 
            sm: i % 4 + 2, 
            md: i % 5 + 3, 
            lg: i % 6 + 4, 
            xl: i % 7 + 5 
          },
          gap: `${i % 3 + 1}rem`,
          autoRows: `minmax(${100 + i * 10}px, auto)`
        };
        await layout.updateComplete;
      }
      
      const duration = performanceTester.endMeasurement('grid-updates');
      performanceTester.assertPerformance(200); // Should handle 50 updates in under 200ms
    });

    it('should maintain performance with complex nested content', async () => {
      performanceTester.startMeasurement('complex-layout');
      
      const template = html`
        <responsive-layout has-sidebar layout-template="sidebar-left">
          <header slot="header">
            <nav>
              <ul>
                ${Array.from({ length: 20 }, (_, i) => html`
                  <li><a href="/page-${i}">${`Page ${i + 1}`}</a></li>
                `)}
              </ul>
            </nav>
          </header>
          
          <div slot="sidebar">
            ${Array.from({ length: 10 }, (_, i) => html`
              <div class="sidebar-item">
                <h3>Section ${i + 1}</h3>
                <p>Content for section ${i + 1}</p>
              </div>
            `)}
          </div>

          <main>
            ${Array.from({ length: 100 }, (_, i) => html`
              <article class="content-item">
                <h2>Article ${i + 1}</h2>
                <p>This is article content ${i + 1} with some text.</p>
              </article>
            `)}
          </main>

          <footer slot="footer">
            <p>Footer with ${Array.from({ length: 5 }, (_, i) => `Link ${i + 1}`).join(' | ')}</p>
          </footer>
        </responsive-layout>
      `;
      
      const layout = await fixture<ResponsiveLayout>(template);
      await waitForRender(layout);
      
      const duration = performanceTester.endMeasurement('complex-layout');
      performanceTester.assertPerformance(300); // Complex layout should render in under 300ms
      
      expect(layout.children.length).to.be.greaterThan(0);
    });

    it('should not cause memory leaks during breakpoint changes', async () => {
      memoryTester.startTest();
      
      const layout = await fixture<ResponsiveLayout>(html`
        <responsive-layout debug>
          <div>Memory test content</div>
        </responsive-layout>
      `);

      // Simulate extensive breakpoint changes
      for (let i = 0; i < 200; i++) {
        const viewport = BREAKPOINT_TEST_CASES[i % BREAKPOINT_TEST_CASES.length];
        mockResizeObserver.mockViewportResize(layout, viewport);
        await layout.updateComplete;
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      memoryTester.checkForLeaks(2 * 1024 * 1024); // 2MB max increase
    });
  });

  describe('ResponsiveNav Performance', () => {
    it('should render large navigation menus efficiently', async () => {
      const manyNavItems: NavItem[] = Array.from({ length: 100 }, (_, i) => ({
        label: `Menu Item ${i + 1}`,
        href: `/page-${i + 1}`,
        icon: i % 10 === 0 ? '⭐' : '📄',
        active: i === 0
      }));

      performanceTester.startMeasurement('large-nav-render');
      
      const template = html`
        <responsive-nav 
          brand="Performance Test"
          brand-href="/"
          .items="${manyNavItems}"
        ></responsive-nav>
      `;
      
      const nav = await fixture<ResponsiveNav>(template);
      await waitForRender(nav);
      
      const duration = performanceTester.endMeasurement('large-nav-render');
      performanceTester.assertPerformance(150); // Should render 100 items in under 150ms
      
      // Verify all items rendered
      const desktopItems = nav.shadowRoot?.querySelectorAll('.nav-link-desktop');
      const mobileItems = nav.shadowRoot?.querySelectorAll('.nav-link-mobile');
      expect(desktopItems).to.have.length(100);
      expect(mobileItems).to.have.length(100);
    });

    it('should handle rapid mobile menu toggles efficiently', async () => {
      const nav = await fixture<ResponsiveNav>(html`
        <responsive-nav brand="Test" .items="${[
          { label: 'Home', href: '/', active: true },
          { label: 'About', href: '/about' },
          { label: 'Contact', href: '/contact' }
        ]}"></responsive-nav>
      `);

      const toggleButton = nav.shadowRoot?.querySelector('.nav-toggle') as HTMLButtonElement;
      
      performanceTester.startMeasurement('rapid-menu-toggles');
      
      // Rapidly toggle mobile menu
      for (let i = 0; i < 50; i++) {
        toggleButton.click();
        await nav.updateComplete;
      }
      
      const duration = performanceTester.endMeasurement('rapid-menu-toggles');
      performanceTester.assertPerformance(300); // 50 toggles in under 300ms
      
      // Menu should end in closed state (even number of toggles)
      const mobileMenu = nav.shadowRoot?.querySelector('.nav-menu-mobile');
      expect(mobileMenu?.classList.contains('open')).to.be.false;
    });

    it('should efficiently update navigation items', async () => {
      const nav = await fixture<ResponsiveNav>(html`
        <responsive-nav brand="Test" .items="${[]}"></responsive-nav>
      `);

      performanceTester.startMeasurement('nav-item-updates');
      
      // Gradually add navigation items
      for (let i = 1; i <= 50; i++) {
        const newItems: NavItem[] = Array.from({ length: i }, (_, j) => ({
          label: `Item ${j + 1}`,
          href: `/item-${j + 1}`,
          active: j === 0
        }));
        
        nav.items = newItems;
        await nav.updateComplete;
      }
      
      const duration = performanceTester.endMeasurement('nav-item-updates');
      performanceTester.assertPerformance(400); // 50 updates in under 400ms
      
      expect(nav.items).to.have.length(50);
    });

    it('should not leak event listeners during menu interactions', async () => {
      memoryTester.startTest();
      
      const nav = await fixture<ResponsiveNav>(html`
        <responsive-nav brand="Memory Test" .items="${[
          { label: 'Test', href: '/test' }
        ]}"></responsive-nav>
      `);

      const toggleButton = nav.shadowRoot?.querySelector('.nav-toggle') as HTMLButtonElement;
      
      // Extensive menu interactions
      for (let i = 0; i < 100; i++) {
        toggleButton.click();
        await nav.updateComplete;
        
        // Simulate navigation clicks
        const navLink = nav.shadowRoot?.querySelector('.nav-link-mobile') as HTMLElement;
        navLink?.click();
        await nav.updateComplete;
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      memoryTester.checkForLeaks(1.5 * 1024 * 1024); // 1.5MB max increase
    });
  });

  describe('ResponsiveTimelineWrapper Performance', () => {
    it('should render large timelines efficiently', async () => {
      const largeSessions = createSampleSessions(500);
      
      performanceTester.startMeasurement('large-timeline-render');
      
      const template = html`
        <responsive-timeline-wrapper
          title="Large Timeline"
          .sessions="${largeSessions}"
          force-view="mobile"
        ></responsive-timeline-wrapper>
      `;
      
      const timeline = await fixture<ResponsiveTimelineWrapper>(template);
      await waitForRender(timeline);
      
      const duration = performanceTester.endMeasurement('large-timeline-render');
      performanceTester.assertPerformance(1000); // 500 sessions in under 1s
      
      expect(timeline.sessions).to.have.length(500);
    });

    it('should handle rapid view switching efficiently', async () => {
      const timeline = await fixture<ResponsiveTimelineWrapper>(html`
        <responsive-timeline-wrapper
          title="View Switch Test"
          .sessions="${createSampleSessions(20)}"
        ></responsive-timeline-wrapper>
      `);

      performanceTester.startMeasurement('timeline-view-switching');
      
      const views = ['mobile', 'tablet', 'desktop'] as const;
      
      // Rapidly switch between views
      for (let i = 0; i < 60; i++) { // 20 cycles of all views
        const view = views[i % views.length];
        timeline['_handleViewChange'](view);
        await timeline.updateComplete;
      }
      
      const duration = performanceTester.endMeasurement('timeline-view-switching');
      performanceTester.assertPerformance(400); // 60 view changes in under 400ms
    });

    it('should efficiently handle session data updates', async () => {
      const timeline = await fixture<ResponsiveTimelineWrapper>(html`
        <responsive-timeline-wrapper
          title="Data Update Test"
          .sessions="${createSampleSessions(10)}"
        ></responsive-timeline-wrapper>
      `);

      performanceTester.startMeasurement('timeline-data-updates');
      
      // Rapidly update session data
      for (let i = 0; i < 30; i++) {
        const sessionCount = (i % 20) + 5; // 5-25 sessions
        timeline.sessions = createSampleSessions(sessionCount);
        await timeline.updateComplete;
      }
      
      const duration = performanceTester.endMeasurement('timeline-data-updates');
      performanceTester.assertPerformance(500); // 30 updates in under 500ms
    });

    it('should virtualize large datasets efficiently', async () => {
      const enormousSessions = createSampleSessions(2000);
      
      performanceTester.startMeasurement('timeline-virtualization');
      
      const timeline = await fixture<ResponsiveTimelineWrapper>(html`
        <responsive-timeline-wrapper
          title="Virtualization Test"
          .sessions="${enormousSessions}"
          force-view="mobile"
        ></responsive-timeline-wrapper>
      `);
      
      await waitForRender(timeline);
      
      const duration = performanceTester.endMeasurement('timeline-virtualization');
      performanceTester.assertPerformance(2000); // Even with 2000 sessions, under 2s
      
      // Should render only visible items (virtualization)
      const visibleCards = timeline.shadowRoot?.querySelectorAll('.session-card');
      expect(visibleCards?.length).to.be.lessThan(enormousSessions.length);
      expect(visibleCards?.length).to.be.greaterThan(0);
    });
  });

  describe('ResponsiveSessionWrapper Performance', () => {
    it('should render large session lists efficiently', async () => {
      const largeSessions = createSampleSessions(300);
      
      performanceTester.startMeasurement('large-session-render');
      
      const template = html`
        <responsive-session-wrapper
          title="Large Session List"
          .sessions="${largeSessions}"
          force-view="desktop"
        ></responsive-session-wrapper>
      `;
      
      const sessions = await fixture<ResponsiveSessionWrapper>(template);
      await waitForRender(sessions);
      
      const duration = performanceTester.endMeasurement('large-session-render');
      performanceTester.assertPerformance(800); // 300 sessions in under 800ms
      
      expect(sessions.sessions).to.have.length(300);
    });

    it('should handle rapid search queries efficiently', async () => {
      const sessions = await fixture<ResponsiveSessionWrapper>(html`
        <responsive-session-wrapper
          title="Search Performance Test"
          .sessions="${createSampleSessions(100)}"
          force-view="desktop"
        ></responsive-session-wrapper>
      `);

      const searchInput = sessions.shadowRoot?.querySelector('.session-search-input') as HTMLInputElement;
      
      performanceTester.startMeasurement('rapid-search');
      
      const searchTerms = ['test', 'session', 'active', 'complete', 'project', ''];
      
      // Rapidly change search queries
      for (let i = 0; i < 100; i++) {
        const term = searchTerms[i % searchTerms.length] + i;
        searchInput.value = term;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sessions.updateComplete;
      }
      
      const duration = performanceTester.endMeasurement('rapid-search');
      performanceTester.assertPerformance(300); // 100 searches in under 300ms
    });

    it('should efficiently sort large datasets', async () => {
      const largeSessions = createSampleSessions(200);
      
      const sessions = await fixture<ResponsiveSessionWrapper>(html`
        <responsive-session-wrapper
          title="Sort Performance Test"
          .sessions="${largeSessions}"
          force-view="desktop"
        ></responsive-session-wrapper>
      `);

      performanceTester.startMeasurement('large-dataset-sorting');
      
      const sortableColumns = ['title', 'date', 'duration', 'status'];
      
      // Test sorting performance on each column
      for (const column of sortableColumns) {
        const header = sessions.shadowRoot?.querySelector(`.session-table-header[data-sort="${column}"]`) as HTMLElement;
        if (header) {
          // Sort ascending
          header.click();
          await sessions.updateComplete;
          
          // Sort descending
          header.click();
          await sessions.updateComplete;
        }
      }
      
      const duration = performanceTester.endMeasurement('large-dataset-sorting');
      performanceTester.assertPerformance(400); // Multiple sorts of 200 items in under 400ms
    });

    it('should handle filter combinations efficiently', async () => {
      const sessions = await fixture<ResponsiveSessionWrapper>(html`
        <responsive-session-wrapper
          title="Filter Performance Test"
          .sessions="${createSampleSessions(150)}"
          force-view="mobile"
        ></responsive-session-wrapper>
      `);

      performanceTester.startMeasurement('complex-filtering');
      
      // Apply various filter combinations
      for (let i = 0; i < 20; i++) {
        const filterOptions = {
          status: i % 2 === 0 ? ['active'] : ['completed'],
          dateRange: {
            start: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
            end: new Date()
          },
          tags: i % 3 === 0 ? ['test'] : ['tag-1', 'tag-2']
        };
        
        sessions.filterOptions = filterOptions;
        await sessions.updateComplete;
      }
      
      const duration = performanceTester.endMeasurement('complex-filtering');
      performanceTester.assertPerformance(300); // 20 filter combinations in under 300ms
    });
  });

  describe('Integration Performance', () => {
    it('should efficiently render complete responsive application', async () => {
      const largeSessions = createSampleSessions(100);
      const manyNavItems: NavItem[] = Array.from({ length: 15 }, (_, i) => ({
        label: `Page ${i + 1}`,
        href: `/page-${i + 1}`,
        icon: '📄',
        active: i === 0
      }));

      performanceTester.startMeasurement('full-app-render');
      
      const template = html`
        <responsive-layout has-sidebar layout-template="sidebar-left">
          <responsive-nav
            slot="header"
            brand="Performance Test App"
            brand-href="/"
            .items="${manyNavItems}"
          ></responsive-nav>
          
          <div slot="sidebar">
            <responsive-session-wrapper
              title="All Sessions"
              .sessions="${largeSessions.slice(0, 30)}"
            ></responsive-session-wrapper>
          </div>

          <main>
            <responsive-timeline-wrapper
              title="Development Timeline"
              .sessions="${largeSessions}"
            ></responsive-timeline-wrapper>
          </main>

          <footer slot="footer">
            <p>© 2024 Performance Test Application</p>
          </footer>
        </responsive-layout>
      `;
      
      const layout = await fixture<ResponsiveLayout>(template);
      await waitForRender(layout);
      
      const duration = performanceTester.endMeasurement('full-app-render');
      performanceTester.assertPerformance(1500); // Full app in under 1.5s
      
      // Verify all components rendered
      const nav = layout.querySelector('responsive-nav');
      const sessions = layout.querySelector('responsive-session-wrapper');
      const timeline = layout.querySelector('responsive-timeline-wrapper');
      
      expect(nav).to.exist;
      expect(sessions).to.exist;
      expect(timeline).to.exist;
    });

    it('should handle simultaneous component updates efficiently', async () => {
      const layout = await fixture<ResponsiveLayout>(html`
        <responsive-layout has-sidebar>
          <responsive-nav
            slot="header"
            brand="Test App"
            .items="${[{ label: 'Home', href: '/', active: true }]}"
          ></responsive-nav>
          
          <div slot="sidebar">
            <responsive-session-wrapper
              title="Sessions"
              .sessions="${createSampleSessions(10)}"
            ></responsive-session-wrapper>
          </div>

          <main>
            <responsive-timeline-wrapper
              title="Timeline"
              .sessions="${createSampleSessions(20)}"
            ></responsive-timeline-wrapper>
          </main>
        </responsive-layout>
      `);

      const nav = layout.querySelector('responsive-nav') as ResponsiveNav;
      const sessions = layout.querySelector('responsive-session-wrapper') as ResponsiveSessionWrapper;
      const timeline = layout.querySelector('responsive-timeline-wrapper') as ResponsiveTimelineWrapper;

      performanceTester.startMeasurement('simultaneous-updates');
      
      // Update all components simultaneously multiple times
      for (let i = 0; i < 20; i++) {
        const newSessions = createSampleSessions(15 + i);
        const newNavItems: NavItem[] = Array.from({ length: (i % 5) + 2 }, (_, j) => ({
          label: `Page ${j + 1}`,
          href: `/page-${j + 1}`,
          active: j === 0
        }));

        // Trigger simultaneous updates
        nav.items = newNavItems;
        sessions.sessions = newSessions.slice(0, 8);
        timeline.sessions = newSessions;
        layout.layoutTemplate = i % 2 === 0 ? 'sidebar-left' : 'flex';

        // Wait for all updates
        await Promise.all([
          nav.updateComplete,
          sessions.updateComplete,
          timeline.updateComplete,
          layout.updateComplete,
        ]);
      }
      
      const duration = performanceTester.endMeasurement('simultaneous-updates');
      performanceTester.assertPerformance(1000); // 20 simultaneous updates in under 1s
    });

    it('should maintain performance during extended use simulation', async () => {
      const layout = await fixture<ResponsiveLayout>(html`
        <responsive-layout debug>
          <responsive-timeline-wrapper
            title="Extended Use Test"
            .sessions="${createSampleSessions(50)}"
          ></responsive-timeline-wrapper>
        </responsive-layout>
      `);

      const timeline = layout.querySelector('responsive-timeline-wrapper') as ResponsiveTimelineWrapper;
      
      memoryTester.startTest();
      performanceTester.startMeasurement('extended-use');

      // Simulate extended application use
      for (let hour = 0; hour < 24; hour++) { // Simulate 24 hours of use
        // Simulate typical user interactions per hour
        for (let interaction = 0; interaction < 10; interaction++) {
          // Breakpoint changes (window resizing)
          const viewport = BREAKPOINT_TEST_CASES[interaction % BREAKPOINT_TEST_CASES.length];
          mockResizeObserver.mockViewportResize(layout, viewport);
          await layout.updateComplete;
          
          // Data updates (new sessions)
          const sessionCount = 45 + (interaction % 10);
          timeline.sessions = createSampleSessions(sessionCount);
          await timeline.updateComplete;
          
          // View switching
          const views = ['mobile', 'tablet', 'desktop'] as const;
          timeline['_handleViewChange'](views[interaction % views.length]);
          await timeline.updateComplete;
        }
        
        // Periodic garbage collection simulation
        if (hour % 6 === 0 && global.gc) {
          global.gc();
        }
      }

      const duration = performanceTester.endMeasurement('extended-use');
      
      // Should maintain reasonable performance even after extended use
      performanceTester.assertPerformance(10000); // 240 operations in under 10s
      
      // Memory usage should not grow excessively
      memoryTester.checkForLeaks(5 * 1024 * 1024); // 5MB max increase
    });

    it('should efficiently handle stress test scenarios', async () => {
      // Create extremely large datasets
      const massiveSessions = createSampleSessions(1000);
      const massiveNavItems: NavItem[] = Array.from({ length: 50 }, (_, i) => ({
        label: `Stress Test Item ${i + 1}`,
        href: `/stress-${i + 1}`,
        icon: '🔧',
        active: i === 0
      }));

      performanceTester.startMeasurement('stress-test');
      
      const template = html`
        <responsive-layout has-sidebar layout-template="grid">
          <responsive-nav
            slot="header"
            brand="Stress Test App"
            .items="${massiveNavItems}"
          ></responsive-nav>
          
          <div slot="sidebar">
            <responsive-session-wrapper
              title="Massive Sessions"
              .sessions="${massiveSessions.slice(0, 200)}"
            ></responsive-session-wrapper>
          </div>

          <main>
            <responsive-timeline-wrapper
              title="Massive Timeline"
              .sessions="${massiveSessions}"
            ></responsive-timeline-wrapper>
          </main>
        </responsive-layout>
      `;
      
      const layout = await fixture<ResponsiveLayout>(template);
      await waitForRender(layout);
      
      // Perform stress operations
      for (let i = 0; i < 5; i++) {
        // Rapid breakpoint changes
        for (const viewport of BREAKPOINT_TEST_CASES) {
          mockResizeObserver.mockViewportResize(layout, viewport);
          await layout.updateComplete;
        }
        
        // Update grid configuration
        layout.gridConfig = {
          columns: { mobile: i + 1, sm: i + 2, md: i + 3, lg: i + 4, xl: i + 5 },
          gap: `${i + 1}rem`,
          autoRows: `minmax(${200 + i * 50}px, auto)`
        };
        await layout.updateComplete;
      }
      
      const duration = performanceTester.endMeasurement('stress-test');
      performanceTester.assertPerformance(5000); // Stress test in under 5s
      
      // Components should still be functional
      const nav = layout.querySelector('responsive-nav');
      const sessions = layout.querySelector('responsive-session-wrapper');
      const timeline = layout.querySelector('responsive-timeline-wrapper');
      
      expect(nav?.items).to.have.length(50);
      expect(sessions?.sessions).to.have.length(200);
      expect(timeline?.sessions).to.have.length(1000);
    });
  });
});